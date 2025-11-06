import { and, eq, gte, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { GraphQLError } from "graphql";
import type * as schema from "@/db/schema";
import { accounts, categories, transactions } from "../../db/schema";
import type {
  QueryResolvers,
  TotalsFilterInput,
} from "../../generated/graphql";
import { aggregateTotals } from "../totals-helpers";

// Helper to build filter conditions
const buildFilterConditions = async (
  db: PostgresJsDatabase<typeof schema>,
  conditions: SQL[],
  filters: TotalsFilterInput | null | undefined
): Promise<void> => {
  if (filters?.transactionType) {
    conditions.push(eq(transactions.transactionType, filters.transactionType));
  }

  if (filters?.isInvestment !== undefined && filters?.isInvestment !== null) {
    conditions.push(eq(transactions.isInvestment, filters.isInvestment));
  }

  if (filters?.isRecurring !== undefined && filters?.isRecurring !== null) {
    conditions.push(eq(transactions.isRecurring, filters.isRecurring));
  }

  if (filters?.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }

  if (
    filters?.categoryNumber !== undefined &&
    filters?.categoryNumber !== null
  ) {
    const categoryResult = await db
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(eq(categories.categoryNumber, filters.categoryNumber))
      .limit(1);

    if (categoryResult[0]) {
      conditions.push(
        eq(transactions.categoryId, categoryResult[0].categoryId)
      );
    }
  }

  if (filters?.customNameId) {
    conditions.push(eq(transactions.customNameId, filters.customNameId));
  }
};

export const insightQueries: Pick<QueryResolvers, "getMyTotals"> = {
  // Get transaction totals with flexible filtering and grouping
  getMyTotals: async (_, { input }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const {
      startDate,
      endDate,
      filters,
      groupBy = "NONE",
      timeBucket = "NONE",
      limit,
    } = input;

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new GraphQLError("startDate must be before or equal to endDate", {
        extensions: { code: "INVALID_INPUT" },
      });
    }

    // Build base conditions
    const conditions: SQL[] = [
      eq(transactions.userId, user.id),
      gte(transactions.transactionDateTime, start),
      lte(transactions.transactionDateTime, end),
    ];

    // Handle transfer transactions carefully:
    // Exclude all transfers EXCEPT PREPAID→POSTPAID (bill payments)
    //
    // Transfer scenarios:
    // - PREPAID→POSTPAID: Bill payments (real expense) - INCLUDE
    // - PREPAID→PREPAID: Internal movements - EXCLUDE
    // - POSTPAID→PREPAID: Debt payments - EXCLUDE
    // - Others: Internal movements - EXCLUDE
    //
    // Implementation: Use a subquery to check if:
    // 1. Transaction is NOT a transfer, OR
    // 2. Transaction IS a transfer from PREPAID account to a POSTPAID account
    const transferFilter = or(
      eq(transactions.isTransfer, false),
      and(
        eq(transactions.isTransfer, true),
        sql`EXISTS (
          SELECT 1 FROM ${accounts} source_acc
          WHERE source_acc.account_id = ${transactions.accountId}
          AND source_acc.account_group = 'PREPAID'
          AND EXISTS (
            SELECT 1 FROM ${transactions} linked_txn
            INNER JOIN ${accounts} dest_acc ON dest_acc.account_id = linked_txn.account_id
            WHERE linked_txn.transaction_id = ${transactions.linkedTransactionId}
            AND dest_acc.account_group = 'POSTPAID'
          )
        )`
      )
    );

    if (transferFilter) {
      conditions.push(transferFilter);
    }

    // Filter by account IDs if provided
    if (filters?.accountIds && filters.accountIds.length > 0) {
      conditions.push(inArray(transactions.accountId, filters.accountIds));
    }

    // Apply additional filters
    await buildFilterConditions(db, conditions, filters);

    // Use the new unified aggregation function
    return aggregateTotals({
      db,
      conditions,
      startDate,
      endDate,
      filters,
      groupBy: groupBy || "NONE",
      timeBucket: timeBucket || "NONE",
      limit: limit ?? undefined,
    });
  },
};
