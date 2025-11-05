import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { GraphQLError } from "graphql";
import { MAX_TRANSACTION_LIMIT } from "../../config/constants";
import {
  accounts,
  categories,
  customTransactionNames,
  transactions,
} from "../../db/schema";
import type { QueryResolvers, Transaction } from "../../generated/graphql";

const DEFAULT_TRANSACTION_LIMIT = 50;

// Helper function to format transaction for GraphQL
export const formatTransactionForGraphQL = (
  transaction: typeof transactions.$inferSelect,
  joinedData?: {
    accountName?: string | null;
    accountNumber?: string | null;
    accountLogoUrl?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryNumber?: number | null;
    categoryType?: (typeof categories.$inferSelect)["categoryType"] | null;
    investmentSector?: string | null;
    categoryIconUrl?: string | null;
    customNameId?: string | null;
    customName?: string | null;
    customLogoUrl?: string | null;
  }
) => ({
  transactionId: transaction.transactionId,
  accountId: transaction.accountId,
  amount: transaction.amount,
  currency: transaction.currency,
  transactionType: transaction.transactionType,
  transactionDateTime: transaction.transactionDateTime.toISOString(),
  description: transaction.description,
  location: transaction.location,
  paymentMethod: transaction.paymentMethod,
  attachments: transaction.attachments
    ? JSON.stringify(transaction.attachments)
    : null,

  // Investment fields
  isInvestment: transaction.isInvestment,
  assetSymbol: transaction.assetSymbol,
  quantity: transaction.quantity,
  pricePerUnit: transaction.pricePerUnit,
  investmentAction: transaction.investmentAction,
  feesCharges: transaction.feesCharges,

  // Recurring fields
  isRecurring: transaction.isRecurring,
  recurringFrequency: transaction.recurringFrequency,
  recurringPatternName: transaction.recurringPatternName,

  // Transfer fields
  isTransfer: transaction.isTransfer,
  linkedTransactionId: transaction.linkedTransactionId,

  // Timestamps
  createdAt: transaction.createdAt.toISOString(),
  updatedAt: transaction.updatedAt.toISOString(),

  // Joined data
  accountName: joinedData?.accountName ?? null,
  accountNumber: joinedData?.accountNumber ?? null,
  accountLogoUrl: joinedData?.accountLogoUrl ?? null,
  categoryId: joinedData?.categoryId ?? null,
  categoryName: joinedData?.categoryName ?? null,
  categoryNumber: joinedData?.categoryNumber ?? null,
  categoryType: joinedData?.categoryType ?? null,
  investmentSector: joinedData?.investmentSector ?? null,
  categoryIconUrl: joinedData?.categoryIconUrl ?? null,
  customNameId: joinedData?.customNameId ?? null,
  customNameText: joinedData?.customName ?? null,
  customLogoUrl: joinedData?.customLogoUrl ?? null,
});

// Helper function to add type filter conditions
const addTypeFilter = (
  conditions: SQL[],
  type: "credit" | "debit" | "recurring" | "investment" | "transfer"
): void => {
  if (type === "credit") {
    conditions.push(eq(transactions.transactionType, "CREDIT"));
  } else if (type === "debit") {
    conditions.push(eq(transactions.transactionType, "DEBIT"));
  } else if (type === "recurring") {
    conditions.push(eq(transactions.isRecurring, true));
  } else if (type === "investment") {
    conditions.push(eq(transactions.isInvestment, true));
  } else if (type === "transfer") {
    conditions.push(eq(transactions.isTransfer, true));
  }
};

// Helper function to add account filter
const addAccountFilter = (
  conditions: SQL[],
  accountId: string | string[]
): void => {
  if (Array.isArray(accountId)) {
    if (accountId.length > 0) {
      conditions.push(inArray(transactions.accountId, accountId));
    }
  } else {
    conditions.push(eq(transactions.accountId, accountId));
  }
};

// Helper function to add month filter
const addMonthFilter = (conditions: SQL[], month: string): void => {
  const [year, monthNum] = month.split("-").map(Number);
  const minMonth = 1;
  const maxMonth = 12;
  const lastDayOfMonth = 0;
  const lastHour = 23;
  const lastMinute = 59;
  const lastSecond = 59;
  const lastMillisecond = 999;

  if (year && monthNum >= minMonth && monthNum <= maxMonth) {
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(
      year,
      monthNum,
      lastDayOfMonth,
      lastHour,
      lastMinute,
      lastSecond,
      lastMillisecond
    );

    conditions.push(
      gte(transactions.transactionDateTime, startDate),
      lte(transactions.transactionDateTime, endDate)
    );
  }
};

// Helper function to add search filter
const addSearchFilter = (conditions: SQL[], search: string): void => {
  const searchPattern = `%${search}%`;
  const searchConditions: SQL[] = [];

  // Search in description
  searchConditions.push(ilike(transactions.description, searchPattern));

  // Search in custom name (only if joined)
  searchConditions.push(
    ilike(customTransactionNames.customName, searchPattern)
  );

  const searchOr = or(...searchConditions);
  if (searchOr) {
    conditions.push(searchOr);
  }
};

// Helper function to add amount range filter
const addAmountRangeFilter = (
  conditions: SQL[],
  amountRange: { min?: string | null; max?: string | null }
): void => {
  if (amountRange.min) {
    conditions.push(gte(transactions.amount, amountRange.min));
  }
  if (amountRange.max) {
    conditions.push(lte(transactions.amount, amountRange.max));
  }
};

// Helper function to add cursor-based pagination filter
const addCursorFilter = (
  conditions: SQL[],
  cursor: string,
  order: "new_to_old" | "old_to_new" | "high_to_low" | "low_to_high"
): void => {
  if (order === "new_to_old") {
    // For descending date order, get transactions older than cursor
    conditions.push(
      lt(
        transactions.transactionDateTime,
        sql`(SELECT transaction_date_time FROM transactions WHERE transaction_id = ${cursor})`
      )
    );
  } else if (order === "old_to_new") {
    // For ascending date order, get transactions newer than cursor
    conditions.push(
      gt(
        transactions.transactionDateTime,
        sql`(SELECT transaction_date_time FROM transactions WHERE transaction_id = ${cursor})`
      )
    );
  } else if (order === "high_to_low") {
    // For descending amount order, get transactions with lower amounts OR same amount but older
    const cursorAmountSubquery = sql`(SELECT amount FROM transactions WHERE transaction_id = ${cursor})`;
    const cursorDateSubquery = sql`(SELECT transaction_date_time FROM transactions WHERE transaction_id = ${cursor})`;

    const orCondition = or(
      lt(transactions.amount, cursorAmountSubquery),
      and(
        eq(transactions.amount, cursorAmountSubquery),
        lt(transactions.transactionDateTime, cursorDateSubquery)
      )
    );
    if (orCondition) {
      conditions.push(orCondition);
    }
  } else if (order === "low_to_high") {
    // For ascending amount order, get transactions with higher amounts OR same amount but newer
    const cursorAmountSubquery = sql`(SELECT amount FROM transactions WHERE transaction_id = ${cursor})`;
    const cursorDateSubquery = sql`(SELECT transaction_date_time FROM transactions WHERE transaction_id = ${cursor})`;

    const orCondition = or(
      gt(transactions.amount, cursorAmountSubquery),
      and(
        eq(transactions.amount, cursorAmountSubquery),
        gt(transactions.transactionDateTime, cursorDateSubquery)
      )
    );
    if (orCondition) {
      conditions.push(orCondition);
    }
  }
};

// Helper function to get order by clause
const getOrderByClause = (
  order: "new_to_old" | "old_to_new" | "high_to_low" | "low_to_high"
): ReturnType<typeof desc | typeof asc> => {
  if (order === "old_to_new") {
    return asc(transactions.transactionDateTime);
  }
  if (order === "high_to_low") {
    return desc(transactions.amount);
  }
  if (order === "low_to_high") {
    return asc(transactions.amount);
  }
  // new_to_old (default)
  return desc(transactions.transactionDateTime);
};

// Helper function to apply additional filters
const applyAdditionalFilters = (
  conditions: SQL[],
  options: {
    isInvestment?: boolean | null;
    isRecurring?: boolean | null;
    isTransfer?: boolean | null;
    startDate?: string | null;
    endDate?: string | null;
    assetSymbol?: string | null;
    investmentAction?: string | null;
    recurringFrequency?: string | null;
    location?: string | null;
    paymentMethod?: string | null;
    investmentHoldingId?: string | null;
    recurringPatternId?: string | null;
  }
): void => {
  // Boolean filters
  if (options.isInvestment !== undefined && options.isInvestment !== null) {
    conditions.push(eq(transactions.isInvestment, options.isInvestment));
  }

  if (options.isRecurring !== undefined && options.isRecurring !== null) {
    conditions.push(eq(transactions.isRecurring, options.isRecurring));
  }

  if (options.isTransfer !== undefined && options.isTransfer !== null) {
    conditions.push(eq(transactions.isTransfer, options.isTransfer));
  }

  // Date range filters
  if (options.startDate) {
    conditions.push(
      gte(transactions.transactionDateTime, new Date(options.startDate))
    );
  }

  if (options.endDate) {
    conditions.push(
      lte(transactions.transactionDateTime, new Date(options.endDate))
    );
  }

  // Investment-specific filters
  if (options.assetSymbol) {
    conditions.push(eq(transactions.assetSymbol, options.assetSymbol));
  }

  if (options.investmentAction) {
    conditions.push(
      eq(
        transactions.investmentAction,
        options.investmentAction as
          | "BUY"
          | "SELL"
          | "DIVIDEND"
          | "BONUS"
          | "SPLIT"
      )
    );
  }

  // Recurring-specific filters
  if (options.recurringFrequency) {
    conditions.push(
      eq(
        transactions.recurringFrequency,
        options.recurringFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
      )
    );
  }

  // Additional filters
  if (options.location) {
    conditions.push(ilike(transactions.location, `%${options.location}%`));
  }

  if (options.paymentMethod) {
    conditions.push(
      ilike(transactions.paymentMethod, `%${options.paymentMethod}%`)
    );
  }

  // Link filters
  if (options.investmentHoldingId) {
    conditions.push(
      eq(transactions.investmentHoldingId, options.investmentHoldingId)
    );
  }

  if (options.recurringPatternId) {
    conditions.push(
      eq(transactions.recurringPatternId, options.recurringPatternId)
    );
  }
};

// Helper function to build all filter conditions
const buildFilterConditions = (
  userId: string,
  options: {
    accountId?: string | string[] | null;
    categoryNumber?: number | null;
    customNameId?: string | null;
    type?: "credit" | "debit" | "recurring" | "investment" | "transfer" | null;
    month?: string | null;
    search?: string | null;
    amountRange?: { min?: string | null; max?: string | null } | null;
    cursor?: string | null;
    order?: "new_to_old" | "old_to_new" | "high_to_low" | "low_to_high" | null;
    isInvestment?: boolean | null;
    isRecurring?: boolean | null;
    isTransfer?: boolean | null;
    startDate?: string | null;
    endDate?: string | null;
    assetSymbol?: string | null;
    investmentAction?: string | null;
    recurringFrequency?: string | null;
    location?: string | null;
    paymentMethod?: string | null;
    investmentHoldingId?: string | null;
    recurringPatternId?: string | null;
  }
): SQL[] => {
  const conditions: SQL[] = [eq(transactions.userId, userId)];

  if (options.accountId) {
    addAccountFilter(conditions, options.accountId);
  }

  if (options.categoryNumber !== undefined && options.categoryNumber !== null) {
    conditions.push(eq(categories.categoryNumber, options.categoryNumber));
  }

  if (options.customNameId) {
    conditions.push(eq(transactions.customNameId, options.customNameId));
  }

  if (options.type) {
    addTypeFilter(conditions, options.type);
  }

  if (options.month) {
    addMonthFilter(conditions, options.month);
  }

  if (options.search) {
    addSearchFilter(conditions, options.search);
  }

  if (options.amountRange) {
    addAmountRangeFilter(conditions, options.amountRange);
  }

  if (options.cursor) {
    addCursorFilter(conditions, options.cursor, options.order || "new_to_old");
  }

  // Apply additional filters
  applyAdditionalFilters(conditions, options);

  return conditions;
};

export const transactionQueries: Pick<
  QueryResolvers,
  "getMyTransactions" | "getMyTransaction"
> = {
  // Get transactions for authenticated user
  getMyTransactions: async (_, { options }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const {
      limit = 50,
      cursor,
      accountId,
      customNameId,
      categoryNumber,
      order = "new_to_old",
      type,
      month,
      search,
      amountRange,
      isInvestment,
      isRecurring,
      isTransfer,
      startDate,
      endDate,
      assetSymbol,
      investmentAction,
      recurringFrequency,
      location,
      paymentMethod,
      investmentHoldingId,
      recurringPatternId,
    } = options ?? {};

    // Build all filter conditions
    const conditions = buildFilterConditions(user.id, {
      accountId,
      categoryNumber,
      customNameId,
      type,
      month,
      search,
      amountRange,
      cursor,
      order,
      isInvestment,
      isRecurring,
      isTransfer,
      startDate,
      endDate,
      assetSymbol,
      investmentAction,
      recurringFrequency,
      location,
      paymentMethod,
      investmentHoldingId,
      recurringPatternId,
    });

    const orderByClause = getOrderByClause(order || "new_to_old");

    // Fetch one extra to determine if there's a next page
    const pageSize = Math.min(
      limit || DEFAULT_TRANSACTION_LIMIT,
      MAX_TRANSACTION_LIMIT
    );

    const result = await db
      .select()
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.accountId))
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .leftJoin(
        customTransactionNames,
        eq(transactions.customNameId, customTransactionNames.customNameId)
      )
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(pageSize + 1);

    // Determine if there's a next page
    const hasNextPage = result.length > pageSize;
    const transactionsData = hasNextPage ? result.slice(0, pageSize) : result;

    const formattedTransactions = transactionsData.map((row) =>
      formatTransactionForGraphQL(row.transactions, {
        accountName: row.accounts?.accountName ?? null,
        accountNumber: row.accounts?.accountNumber ?? null,
        accountLogoUrl: row.accounts?.logoUrl ?? null,
        categoryId: row.categories?.categoryId ?? null,
        categoryName: row.categories?.categoryName ?? null,
        categoryNumber: row.categories?.categoryNumber ?? null,
        categoryType: row.categories?.categoryType ?? null,
        investmentSector: row.categories?.investmentSector ?? null,
        categoryIconUrl: row.categories?.defaultIconUrl ?? null,
        customNameId: row.custom_transaction_names?.customNameId ?? null,
        customName: row.custom_transaction_names?.customName ?? null,
        customLogoUrl: row.custom_transaction_names?.customLogoUrl ?? null,
      })
    );

    // Get the last transaction's ID as the cursor
    const endCursor =
      transactionsData.length > 0
        ? (transactionsData.at(-1)?.transactions.transactionId ?? null)
        : null;

    return {
      transactions: formattedTransactions as unknown as Transaction[],
      pageInfo: {
        hasNextPage,
        endCursor,
      },
    };
  },

  // Get single transaction by ID
  getMyTransaction: async (_, { transactionId }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const result = await db
      .select()
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.accountId))
      .leftJoin(categories, eq(transactions.categoryId, categories.categoryId))
      .leftJoin(
        customTransactionNames,
        eq(transactions.customNameId, customTransactionNames.customNameId)
      )
      .where(
        and(
          eq(transactions.transactionId, transactionId),
          eq(transactions.userId, user.id)
        )
      )
      .limit(1);

    if (!result[0]) {
      throw new GraphQLError("Transaction not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const row = result[0];

    return formatTransactionForGraphQL(row.transactions, {
      accountName: row.accounts?.accountName ?? null,
      accountNumber: row.accounts?.accountNumber ?? null,
      accountLogoUrl: row.accounts?.logoUrl ?? null,
      categoryId: row.categories?.categoryId ?? null,
      categoryName: row.categories?.categoryName ?? null,
      categoryNumber: row.categories?.categoryNumber ?? null,
      categoryType: row.categories?.categoryType ?? null,
      investmentSector: row.categories?.investmentSector ?? null,
      categoryIconUrl: row.categories?.defaultIconUrl ?? null,
      customNameId: row.custom_transaction_names?.customNameId ?? null,
      customName: row.custom_transaction_names?.customName ?? null,
      customLogoUrl: row.custom_transaction_names?.customLogoUrl ?? null,
    }) as unknown as Transaction;
  },
};
