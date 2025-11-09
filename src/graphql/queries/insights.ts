import { eq, gte, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { GraphQLError } from "graphql";
import type * as schema from "../../db/schema";
import { categories, transactions } from "../../db/schema";
import type {
  QueryResolvers,
  TotalsFilterInput,
} from "../../generated/graphql";
import { aggregateTotals } from "../totals-helpers";

// Constants for end-of-day time
const END_OF_DAY_HOURS = 23;
const END_OF_DAY_MINUTES = 59;
const END_OF_DAY_SECONDS = 59;
const END_OF_DAY_MILLISECONDS = 999;

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

    // Parse dates - default to "all time" if not provided
    const start = startDate ? new Date(startDate) : new Date(0); // Beginning of time
    const end = endDate ? new Date(endDate) : new Date(); // Now

    // Make endDate inclusive by setting time to end of day
    end.setHours(
      END_OF_DAY_HOURS,
      END_OF_DAY_MINUTES,
      END_OF_DAY_SECONDS,
      END_OF_DAY_MILLISECONDS
    );

    if (start > end) {
      throw new GraphQLError("startDate must be before or equal to endDate", {
        extensions: { code: "INVALID_INPUT" },
      });
    }

    // Build base conditions
    const conditions: SQL[] = [eq(transactions.userId, user.id)];

    // Only add date filters if dates are provided
    if (startDate) {
      conditions.push(gte(transactions.transactionDateTime, start));
    }
    if (endDate) {
      conditions.push(lte(transactions.transactionDateTime, end));
    }

    // Filter by account IDs if provided
    if (filters?.accountIds && filters.accountIds.length > 0) {
      conditions.push(inArray(transactions.accountId, filters.accountIds));

      // Exclude transfers only when filtering by MULTIPLE accounts
      // BUT only exclude transfers where BOTH accounts are in the selected list
      // (to avoid double-counting transfers between selected accounts)
      // Include transfers when filtering by a SINGLE account
      // (to show money moving in/out of that specific account)
      if (filters.accountIds.length > 1) {
        // Exclude transfers where the linked transaction is in one of the selected accounts
        // Use inArray subquery for proper parameterization
        const transferExclusion = or(
          eq(transactions.isTransfer, false),
          sql`${transactions.linkedTransactionId} IS NULL`,
          sql`${transactions.linkedTransactionId} NOT IN (
            SELECT ${transactions.transactionId}
            FROM ${transactions}
            WHERE ${inArray(transactions.accountId, filters.accountIds)}
          )`
        );
        if (transferExclusion) {
          conditions.push(transferExclusion);
        }
      }
    } else {
      // When viewing ALL accounts, exclude transfers (internal movements that cancel out)
      conditions.push(eq(transactions.isTransfer, false));
    }

    // Apply additional filters
    await buildFilterConditions(db, conditions, filters);

    // Use the new unified aggregation function
    return aggregateTotals({
      db,
      conditions,
      startDate: startDate || start.toISOString(),
      endDate: endDate || end.toISOString(),
      filters,
      groupBy: groupBy || "NONE",
      timeBucket: timeBucket || "NONE",
      limit: limit ?? undefined,
    });
  },
};
