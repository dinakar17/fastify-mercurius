import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import {
  accounts,
  categories,
  customTransactionNames,
  transactions,
} from "../db/schema";
import type { TotalResult, TotalsFilterInput } from "../generated/graphql";

type AggregationOptions = {
  db: PostgresJsDatabase<typeof schema>;
  conditions: SQL[];
  startDate: string;
  endDate: string;
  filters: TotalsFilterInput | null | undefined;
};

// Helper to get prepaid account IDs
export const getPrepaidAccountIds = async (
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  filterAccountIds?: string[] | null
): Promise<string[]> => {
  const conditions: SQL[] = [
    eq(accounts.userId, userId),
    eq(accounts.accountGroup, "PREPAID"),
  ];

  if (filterAccountIds && filterAccountIds.length > 0) {
    conditions.push(inArray(accounts.accountId, filterAccountIds));
  }

  const result = await db
    .select({ accountId: accounts.accountId })
    .from(accounts)
    .where(and(...conditions));

  return result.map((a) => a.accountId);
};

// Helper to aggregate without grouping
export const aggregateWithoutGrouping = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { db, conditions, startDate, endDate, filters } = options;

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(and(...conditions));

  return [
    {
      total: result[0]?.total || "0",
      startDate,
      endDate,
      filters: filters || null,
      metadata: null,
    },
  ];
};

// Helper to aggregate by category
export const aggregateByCategory = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { db, conditions, startDate, endDate, filters } = options;

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.categoryId);

  const categoryIds = result
    .map((r) => r.categoryId)
    .filter((id): id is string => id !== null);

  const categoriesResult =
    categoryIds.length > 0
      ? await db
          .select()
          .from(categories)
          .where(inArray(categories.categoryId, categoryIds))
      : [];

  const categoryMap = new Map(categoriesResult.map((c) => [c.categoryId, c]));

  return result.map((r) => {
    const category = r.categoryId ? categoryMap.get(r.categoryId) : null;
    return {
      total: r.total,
      startDate,
      endDate,
      filters: filters || null,
      metadata: category
        ? {
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
            average: null,
            customName: null,
            account: null,
          }
        : null,
    };
  });
};

// Helper to aggregate by custom name
export const aggregateByCustomName = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { db, conditions, startDate, endDate, filters } = options;

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      customNameId: transactions.customNameId,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.customNameId);

  const customNameIds = result
    .map((r) => r.customNameId)
    .filter((id): id is string => id !== null);

  const customNamesResult =
    customNameIds.length > 0
      ? await db
          .select()
          .from(customTransactionNames)
          .where(inArray(customTransactionNames.customNameId, customNameIds))
      : [];

  const customNameMap = new Map(
    customNamesResult.map((c) => [c.customNameId, c])
  );

  return result.map((r) => {
    const customName = r.customNameId
      ? customNameMap.get(r.customNameId)
      : null;
    return {
      total: r.total,
      startDate,
      endDate,
      filters: filters || null,
      metadata: customName
        ? {
            customName: {
              customNameId: customName.customNameId,
              userId: customName.userId,
              customName: customName.customName,
              logoUrl: customName.customLogoUrl,
              createdAt: customName.createdAt.toISOString(),
              updatedAt: customName.createdAt.toISOString(),
            },
            category: null,
            average: null,
            account: null,
          }
        : null,
    };
  });
};

// Helper to aggregate by account
export const aggregateByAccount = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { db, conditions, startDate, endDate, filters } = options;

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.accountId);

  const accountIds = result.map((r) => r.accountId);

  const accountsResult =
    accountIds.length > 0
      ? await db
          .select()
          .from(accounts)
          .where(inArray(accounts.accountId, accountIds))
      : [];

  const accountMap = new Map(accountsResult.map((a) => [a.accountId, a]));

  return result.map((r) => {
    const account = accountMap.get(r.accountId);
    return {
      total: r.total,
      startDate,
      endDate,
      filters: filters || null,
      metadata: account
        ? {
            account: {
              accountId: account.accountId,
              accountType: account.accountType,
              accountGroup: account.accountGroup,
              accountName: account.accountName,
              accountNumber: account.accountNumber,
              institutionName: account.institutionName,
              currentBalance: account.currentBalance,
              balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
              manualBalanceUpdatedAt:
                account.manualBalanceUpdatedAt.toISOString(),
              currency: account.currency,
              creditLimit: account.creditLimit,
              billingCycleDay: account.billingCycleDay,
              loanAmount: account.loanAmount,
              interestRate: account.interestRate,
              loanStartDate: account.loanStartDate?.toISOString() ?? null,
              loanEndDate: account.loanEndDate?.toISOString() ?? null,
              logoUrl: account.logoUrl,
              notes: account.notes,
              isActive: account.isActive,
              isDefault: account.isDefault,
              createdAt: account.createdAt.toISOString(),
              updatedAt: account.updatedAt.toISOString(),
              lastTransactionDate: account.balanceUpdatedAt
                ? account.balanceUpdatedAt.toISOString()
                : null,
            },
            category: null,
            customName: null,
            average: null,
          }
        : null,
    };
  });
};
