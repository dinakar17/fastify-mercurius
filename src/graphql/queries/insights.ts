import { eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { categories, transactions } from "../../db/schema";
import type { QueryResolvers } from "../../generated/graphql";
import {
  aggregateByAccount,
  aggregateByCategory,
  aggregateByCustomName,
  aggregateWithoutGrouping,
  getPrepaidAccountIds,
} from "../totals-helpers";

export const insightQueries: Pick<QueryResolvers, "getMyTotals"> = {
  // Get transaction totals with flexible filtering and grouping
  getMyTotals: async (_, { input }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const { startDate, endDate, filters, groupBy = "NONE" } = input;

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

    // Get PREPAID account IDs and add to conditions
    const prepaidAccountIds = await getPrepaidAccountIds(
      db,
      user.id,
      filters?.accountIds
    );

    if (prepaidAccountIds.length === 0) {
      return [];
    }

    conditions.push(inArray(transactions.accountId, prepaidAccountIds));

    // Apply remaining filters
    if (filters?.transactionType) {
      conditions.push(
        eq(transactions.transactionType, filters.transactionType)
      );
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

      if (!categoryResult[0]) {
        return [];
      }

      conditions.push(
        eq(transactions.categoryId, categoryResult[0].categoryId)
      );
    }

    if (filters?.customNameId) {
      conditions.push(eq(transactions.customNameId, filters.customNameId));
    }

    // Aggregate based on groupBy option
    const aggregationOptions = { db, conditions, startDate, endDate, filters };

    switch (groupBy) {
      case "CATEGORY":
        return aggregateByCategory(aggregationOptions);
      case "CUSTOM_NAME":
        return aggregateByCustomName(aggregationOptions);
      case "ACCOUNT":
        return aggregateByAccount(aggregationOptions);
      default:
        return aggregateWithoutGrouping(aggregationOptions);
    }
  },
};
