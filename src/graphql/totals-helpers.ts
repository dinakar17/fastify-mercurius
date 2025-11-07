import { and, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import {
  accounts,
  categories,
  customTransactionNames,
  transactions,
} from "../db/schema";
import type {
  GroupByDimension,
  TimeBucket,
  TotalResult,
  TotalsFilterInput,
} from "../generated/graphql";

type AggregationOptions = {
  db: PostgresJsDatabase<typeof schema>;
  conditions: SQL[];
  startDate: string;
  endDate: string;
  filters: TotalsFilterInput | null | undefined;
  groupBy: GroupByDimension;
  timeBucket: TimeBucket;
  limit?: number;
};

type MonthRange = {
  startDate: Date;
  endDate: Date;
  monthString: string; // YYYY-MM format
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

// Helper to generate month ranges from start to end date
const generateMonthRanges = (startDate: Date, endDate: Date): MonthRange[] => {
  const ranges: MonthRange[] = [];
  const current = new Date(startDate);
  const FIRST_DAY = 1;
  const HOURS_MAX = 23;
  const MINUTES_MAX = 59;
  const SECONDS_MAX = 59;
  const MS_MAX = 999;

  current.setDate(FIRST_DAY); // Start at beginning of month
  current.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const monthStart = new Date(current);
    const monthEnd = new Date(current);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); // Last day of current month
    monthEnd.setHours(HOURS_MAX, MINUTES_MAX, SECONDS_MAX, MS_MAX);

    // Adjust first and last ranges to match actual start/end dates
    const rangeStart =
      monthStart < startDate ? new Date(startDate) : monthStart;
    const rangeEnd = monthEnd > endDate ? new Date(endDate) : monthEnd;

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");

    ranges.push({
      startDate: rangeStart,
      endDate: rangeEnd,
      monthString: `${year}-${month}`,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return ranges;
};

// Main aggregation function that handles all combinations
export const aggregateTotals = (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { timeBucket } = options;

  // If no time bucketing, use the original date range
  if (timeBucket === "NONE") {
    return aggregateForPeriod(options);
  }

  // If time bucketing by month, split into month ranges
  if (timeBucket === "MONTH") {
    return aggregateByMonths(options);
  }

  // Default fallback
  return aggregateForPeriod(options);
};

// Aggregate data for a single time period (no time bucketing)
const aggregateForPeriod = (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { groupBy, limit } = options;

  // If limit is specified but no groupBy, ignore the limit (can't order without grouping)
  if (limit && groupBy === "NONE") {
    console.warn("Limit is ignored when groupBy is NONE");
  }

  switch (groupBy) {
    case "CATEGORY":
      return aggregateByCategory(options);
    case "CUSTOM_NAME":
      return aggregateByCustomName(options);
    case "ACCOUNT":
      return aggregateByAccount(options);
    default:
      return aggregateWithoutGrouping(options);
  }
};

// Aggregate data split by months
const aggregateByMonths = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { startDate, endDate, groupBy, db, conditions, filters } = options;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const monthRanges = generateMonthRanges(start, end);

  const results: TotalResult[] = [];

  // Extract non-date conditions (filter out the original date range conditions)
  const baseConditions = conditions.filter((condition) => {
    const conditionStr = condition.toString();
    return !(
      conditionStr.includes("transaction_date_time") &&
      (conditionStr.includes(">=") || conditionStr.includes("<="))
    );
  });

  for (const monthRange of monthRanges) {
    // Build fresh conditions with month-specific date range
    // Use the SQL functions that match the original query format
    const monthConditions = [
      ...baseConditions,
      gte(transactions.transactionDateTime, monthRange.startDate),
      lte(transactions.transactionDateTime, monthRange.endDate),
    ];

    // Create new options for this month
    const monthOptions: AggregationOptions = {
      db,
      conditions: monthConditions,
      startDate: monthRange.startDate.toISOString(),
      endDate: monthRange.endDate.toISOString(),
      filters,
      groupBy,
      timeBucket: "NONE", // Don't recursively bucket
    };

    // Get results for this month
    const monthResults = await aggregateForPeriod(monthOptions);

    // Add month metadata to each result
    for (const result of monthResults) {
      results.push({
        ...result,
        metadata: result.metadata
          ? {
              ...result.metadata,
              month: monthRange.monthString,
            }
          : {
              category: null,
              customName: null,
              account: null,
              month: monthRange.monthString,
            },
      });
    }
  }

  return results;
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
  const { db, conditions, startDate, endDate, filters, limit } = options;

  let query = db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.categoryId)
    .orderBy(sql`COALESCE(SUM(${transactions.amount}), '0') DESC`);

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  const result = await query;

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
            customName: null,
            account: null,
            month: null,
          }
        : null,
    };
  });
};

// Helper to aggregate by custom name
export const aggregateByCustomName = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { db, conditions, startDate, endDate, filters, limit } = options;

  let query = db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      customNameId: transactions.customNameId,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.customNameId)
    .orderBy(sql`COALESCE(SUM(${transactions.amount}), '0') DESC`);

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  const result = await query;

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
            account: null,
            month: null,
          }
        : null,
    };
  });
};

// Helper to aggregate by account
export const aggregateByAccount = async (
  options: AggregationOptions
): Promise<TotalResult[]> => {
  const { db, conditions, startDate, endDate, filters, limit } = options;

  let query = db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.accountId)
    .orderBy(sql`COALESCE(SUM(${transactions.amount}), '0') DESC`);

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  const result = await query;

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
            month: null,
          }
        : null,
    };
  });
};
