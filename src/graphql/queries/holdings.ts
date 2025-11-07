import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { categories, investmentHoldings } from "../../db/schema";
import type {
  InvestmentHolding,
  QueryResolvers,
} from "../../generated/graphql";

export const holdingsQueries: Pick<
  QueryResolvers,
  "getMyInvestmentHoldings" | "getMyPortfolioDistribution"
> = {
  // Get investment holdings for authenticated user
  getMyInvestmentHoldings: async (_, { accountId }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const conditions: SQL[] = [eq(investmentHoldings.userId, user.id)];

    // Filter by account if provided
    if (accountId) {
      conditions.push(eq(investmentHoldings.accountId, accountId));
    }

    const result = await db
      .select()
      .from(investmentHoldings)
      .where(and(...conditions))
      .orderBy(desc(investmentHoldings.totalInvestedAmount));

    return result.map((holding) => ({
      holdingId: holding.holdingId,
      accountId: holding.accountId,
      categoryId: holding.categoryId,
      assetSymbol: holding.assetSymbol,
      assetName: holding.assetName,
      totalQuantity: holding.totalQuantity,
      averageBuyPrice: holding.averageBuyPrice,
      totalInvestedAmount: holding.totalInvestedAmount,
      realizedGainLoss: holding.realizedGainLoss,
      currency: holding.currency,
      sector: holding.sector,
      notes: holding.notes,
      createdAt: holding.createdAt.toISOString(),
      updatedAt: holding.updatedAt.toISOString(),
    })) as unknown as InvestmentHolding[];
  },

  // Get portfolio distribution for donut chart
  getMyPortfolioDistribution: async (_, { input }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const conditions: SQL[] = [eq(investmentHoldings.userId, user.id)];

    // Filter by account IDs if provided
    if (input?.accountIds && input.accountIds.length > 0) {
      conditions.push(inArray(investmentHoldings.accountId, input.accountIds));
    }

    // Filter by category numbers if provided
    if (input?.categoryNumbers && input.categoryNumbers.length > 0) {
      // First get category IDs from category numbers
      const categoryResults = await db
        .select({ categoryId: categories.categoryId })
        .from(categories)
        .where(inArray(categories.categoryNumber, input.categoryNumbers));

      const categoryIds = categoryResults.map((c) => c.categoryId);

      if (categoryIds.length > 0) {
        conditions.push(inArray(investmentHoldings.categoryId, categoryIds));
      } else {
        // No matching categories found, return empty array
        return [];
      }
    }

    // Aggregate by categoryId
    const result = await db
      .select({
        categoryId: investmentHoldings.categoryId,
        totalInvestedAmount: sql<string>`COALESCE(SUM(${investmentHoldings.totalInvestedAmount}), '0')`,
        holdingsCount: sql<number>`COUNT(*)::int`,
      })
      .from(investmentHoldings)
      .where(and(...conditions))
      .groupBy(investmentHoldings.categoryId);

    // Fetch category details for each group
    const categoryIds = result.map((r) => r.categoryId);

    const categoriesResult =
      categoryIds.length > 0
        ? await db
            .select()
            .from(categories)
            .where(inArray(categories.categoryId, categoryIds))
        : [];

    const categoryMap = new Map(categoriesResult.map((c) => [c.categoryId, c]));

    return result.map((r) => {
      const category = categoryMap.get(r.categoryId);
      if (!category) {
        throw new GraphQLError("Category not found", {
          extensions: { code: "CATEGORY_NOT_FOUND" },
        });
      }

      return {
        categoryId: r.categoryId,
        categoryName: category.categoryName,
        investmentSector: category.investmentSector,
        totalInvestedAmount: r.totalInvestedAmount,
        totalCurrentValue: null,
        holdingsCount: r.holdingsCount,
        category: {
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          categoryNumber: category.categoryNumber,
          categoryType: category.categoryType,
          investmentSector: category.investmentSector,
          iconUrl: category.defaultIconUrl,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.createdAt.toISOString(),
        },
      };
    });
  },
};
