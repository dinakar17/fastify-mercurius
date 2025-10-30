import { and, asc, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { GraphQLError } from "graphql";
import type * as schema from "@/db/schema";
import { MAX_TRANSACTION_LIMIT } from "../config/constants";
import {
  accounts,
  categories,
  customTransactionNames,
  transactions,
} from "../db/schema";
import type { Account, Resolvers, Transaction } from "../generated/graphql";

const DEFAULT_TRANSACTION_LIMIT = 50;

// Helper function to format transaction for GraphQL
const formatTransactionForGraphQL = (
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

// Helper function to verify account ownership
const verifyAccountOwnership = async (
  db: PostgresJsDatabase<typeof schema>,
  accountId: string,
  userId: string
): Promise<void> => {
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.accountId, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account[0]) {
    throw new GraphQLError("Account not found or access denied", {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

// Helper function to verify transaction ownership
const verifyTransactionOwnership = async (
  db: PostgresJsDatabase<typeof schema>,
  transactionId: string,
  userId: string
): Promise<typeof transactions.$inferSelect> => {
  const transaction = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.transactionId, transactionId),
        eq(transactions.userId, userId)
      )
    )
    .limit(1);

  if (!transaction[0]) {
    throw new GraphQLError("Transaction not found or access denied", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  return transaction[0];
};

// Helper function to get category by number
const getCategoryByNumber = async (
  db: PostgresJsDatabase<typeof schema>,
  categoryNumber: number
): Promise<typeof categories.$inferSelect> => {
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.categoryNumber, categoryNumber))
    .limit(1);

  if (!category[0]) {
    throw new GraphQLError("Category not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  return category[0];
};

// Helper function to find or create custom name
const findOrCreateCustomName = async (
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  customName: string,
  categoryId: string
): Promise<string> => {
  // First try to find existing custom name
  const existing = await db
    .select()
    .from(customTransactionNames)
    .where(
      and(
        eq(customTransactionNames.userId, userId),
        eq(customTransactionNames.customName, customName)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Update usage count and last used date
    await db
      .update(customTransactionNames)
      .set({
        usageCount: existing[0].usageCount + 1,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customTransactionNames.customNameId, existing[0].customNameId));

    return existing[0].customNameId;
  }

  // Create new custom name
  const newCustomName = await db
    .insert(customTransactionNames)
    .values({
      userId,
      categoryId,
      customName,
      usageCount: 1,
      lastUsedAt: new Date(),
    })
    .returning();

  return newCustomName[0].customNameId;
};

export const resolvers: Resolvers = {
  Query: {
    // Get all accounts for authenticated user
    getMyAccounts: async (_, __, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const result = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id))
        .orderBy(desc(accounts.createdAt));

      return result.map((account) => ({
        ...account,
        balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
        manualBalanceUpdatedAt: account.manualBalanceUpdatedAt.toISOString(),
        loanStartDate: account.loanStartDate?.toISOString() ?? null,
        loanEndDate: account.loanEndDate?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        lastTransactionDate: account.balanceUpdatedAt
          ? account.balanceUpdatedAt.toISOString()
          : null,
        // transactions field will be resolved by loader
      })) as unknown as Account[];
    },

    // Get specific account by ID
    getAccount: async (_, { accountId }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const result = await db
        .select()
        .from(accounts)
        .where(
          and(eq(accounts.accountId, accountId), eq(accounts.userId, user.id))
        )
        .limit(1);

      if (!result[0]) {
        throw new GraphQLError("Account not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const account = result[0];
      return {
        ...account,
        balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
        manualBalanceUpdatedAt: account.manualBalanceUpdatedAt.toISOString(),
        loanStartDate: account.loanStartDate?.toISOString() ?? null,
        loanEndDate: account.loanEndDate?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        lastTransactionDate: account.balanceUpdatedAt
          ? account.balanceUpdatedAt.toISOString()
          : null,
        // transactions field will be resolved by loader
      } as unknown as Account;
    },

    // Get transactions for authenticated user
    getMyTransactions: async (_, { options }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const {
        limit = 50,
        accountId,
        customNameId,
        categoryId,
        order = "new_to_old",
        type,
        month,
      } = options ?? {};

      const conditions: SQL[] = [eq(transactions.userId, user.id)];

      // Filter by accountId (single or multiple)
      if (accountId) {
        if (Array.isArray(accountId)) {
          if (accountId.length > 0) {
            conditions.push(inArray(transactions.accountId, accountId));
          }
        } else {
          conditions.push(eq(transactions.accountId, accountId));
        }
      }

      // Filter by categoryId
      if (categoryId) {
        conditions.push(eq(transactions.categoryId, categoryId));
      }

      // Filter by custom name
      if (customNameId) {
        conditions.push(eq(transactions.customNameId, customNameId));
      }

      // Filter by transaction type
      if (type) {
        addTypeFilter(conditions, type);
      }

      // Filter by month
      if (month) {
        addMonthFilter(conditions, month);
      }

      const orderByClause = getOrderByClause(order || "new_to_old");

      const result = await db
        .select()
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.accountId))
        .leftJoin(
          categories,
          eq(transactions.categoryId, categories.categoryId)
        )
        .leftJoin(
          customTransactionNames,
          eq(transactions.customNameId, customTransactionNames.customNameId)
        )
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(
          Math.min(limit || DEFAULT_TRANSACTION_LIMIT, MAX_TRANSACTION_LIMIT)
        );

      return result.map((row) =>
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
      ) as unknown as Transaction[];
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
        .leftJoin(
          categories,
          eq(transactions.categoryId, categories.categoryId)
        )
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
  },

  Mutation: {
    // Create a new account
    createAccount: async (_, { input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const newAccount = await db
        .insert(accounts)
        .values({
          userId: user.id,
          accountType: input.accountType,
          accountGroup: input.accountGroup,
          accountName: input.accountName,
          accountNumber: input.accountNumber,
          institutionName: input.institutionName,
          currentBalance: input.initialBalance || "0.00",
          logoUrl: input.logoUrl,
          creditLimit: input.creditLimit,
        })
        .returning();

      const account = newAccount[0];
      return {
        ...account,
        balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
        manualBalanceUpdatedAt: account.manualBalanceUpdatedAt.toISOString(),
        loanStartDate: account.loanStartDate?.toISOString() ?? null,
        loanEndDate: account.loanEndDate?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        lastTransactionDate: account.balanceUpdatedAt
          ? account.balanceUpdatedAt.toISOString()
          : null,
      } as unknown as Account;
    },

    // Update an account
    updateAccount: async (_, { accountId, input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Verify account ownership
      await verifyAccountOwnership(db, accountId, user.id);

      // Build update object
      const updates: Partial<typeof accounts.$inferInsert> & {
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      // Update basic fields
      if (input.accountName) {
        updates.accountName = input.accountName;
      }
      if (input.accountNumber) {
        updates.accountNumber = input.accountNumber;
      }
      if (input.institutionName) {
        updates.institutionName = input.institutionName;
      }
      if (input.logoUrl) {
        updates.logoUrl = input.logoUrl;
      }
      if (input.isActive !== null) {
        updates.isActive = input.isActive;
      }
      if (input.isDefault !== null) {
        updates.isDefault = input.isDefault;
      }

      // Update balance if provided
      if (input.currentBalance) {
        updates.currentBalance = input.currentBalance;
        updates.balanceUpdatedAt = new Date();
        updates.manualBalanceUpdatedAt = new Date();
      }

      const updated = await db
        .update(accounts)
        .set(updates)
        .where(eq(accounts.accountId, accountId))
        .returning();

      const account = updated[0];
      return {
        ...account,
        balanceUpdatedAt: account.balanceUpdatedAt.toISOString(),
        manualBalanceUpdatedAt: account.manualBalanceUpdatedAt.toISOString(),
        loanStartDate: account.loanStartDate?.toISOString() ?? null,
        loanEndDate: account.loanEndDate?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        lastTransactionDate: account.balanceUpdatedAt
          ? account.balanceUpdatedAt.toISOString()
          : null,
      } as unknown as Account;
    },

    // Delete an account
    deleteAccount: async (_, { accountId }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Verify account ownership
      await verifyAccountOwnership(db, accountId, user.id);

      // Delete account (cascade will handle related transactions)
      await db.delete(accounts).where(eq(accounts.accountId, accountId));

      return { success: true, accountId };
    },

    // Create a transaction
    createTransaction: async (_, { input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Verify account ownership
      await verifyAccountOwnership(db, input.accountId, user.id);

      // Get category by number
      const category = await getCategoryByNumber(db, input.categoryNumber);

      // Handle custom name if provided
      let customNameId: string | undefined;
      if (input.customName) {
        customNameId = await findOrCreateCustomName(
          db,
          user.id,
          input.customName,
          category.categoryId
        );
      }

      // If this is a transfer, verify the other account
      if (input.isTransfer && input.otherAccountId) {
        await verifyAccountOwnership(db, input.otherAccountId, user.id);
      }

      // Create the main transaction
      const newTransaction = await db
        .insert(transactions)
        .values({
          userId: user.id,
          accountId: input.accountId,
          categoryId: category.categoryId,
          amount: input.amount,
          transactionType: input.transactionType,
          transactionDateTime: new Date(input.transactionDateTime),
          description: input.description,
          customNameId,
          // Investment fields
          isInvestment: Boolean(input.isInvestment),
          assetSymbol: input.assetSymbol,
          quantity: input.quantity,
          pricePerUnit: input.pricePerUnit,
          investmentAction: input.investmentAction,
          // Transfer fields
          isTransfer: Boolean(input.isTransfer),
          // Recurring fields
          isRecurring: Boolean(input.isRecurring),
          recurringFrequency: input.recurringFrequency,
          recurringPatternName: input.recurringPatternName,
          // Additional fields
          location: input.location,
          paymentMethod: input.paymentMethod,
        } as typeof transactions.$inferInsert)
        .returning();

      const transaction = newTransaction[0];

      // Handle transfer paired transaction
      if (input.isTransfer && input.otherAccountId) {
        const pairedTransactionType =
          input.transactionType === "DEBIT" ? "CREDIT" : "DEBIT";

        const pairedTransaction = await db
          .insert(transactions)
          .values({
            userId: user.id,
            accountId: input.otherAccountId,
            categoryId: category.categoryId,
            amount: input.amount,
            transactionType: pairedTransactionType,
            transactionDateTime: new Date(input.transactionDateTime),
            description: input.description,
            customNameId,
            isTransfer: true,
            linkedTransactionId: transaction.transactionId,
            location: input.location,
            paymentMethod: input.paymentMethod,
          })
          .returning();

        // Update main transaction with linked ID
        await db
          .update(transactions)
          .set({ linkedTransactionId: pairedTransaction[0].transactionId })
          .where(eq(transactions.transactionId, transaction.transactionId));
      }

      return formatTransactionForGraphQL(transaction) as unknown as Transaction;
    },

    // Update a transaction
    updateTransaction: async (_, { transactionId, input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Verify transaction ownership
      const existing = await verifyTransactionOwnership(
        db,
        transactionId,
        user.id
      );

      // Prevent modifying transfer transaction amount
      if (existing.isTransfer && input.amount !== undefined) {
        throw new GraphQLError(
          "Cannot modify transfer transaction amount. Delete and recreate the transfer instead.",
          {
            extensions: { code: "TRANSFER_MODIFICATION_NOT_ALLOWED" },
          }
        );
      }

      // Build update object
      const updates: Partial<typeof transactions.$inferInsert> & {
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (input.amount !== undefined && input.amount !== null) {
        updates.amount = input.amount;
      }
      if (input.description !== undefined && input.description !== null) {
        updates.description = input.description;
      }
      if (input.categoryNumber !== undefined && input.categoryNumber !== null) {
        const category = await getCategoryByNumber(db, input.categoryNumber);
        updates.categoryId = category.categoryId;
      }
      if (input.customName !== undefined) {
        if (input.customName) {
          const categoryId = updates.categoryId || existing.categoryId;
          updates.customNameId = await findOrCreateCustomName(
            db,
            user.id,
            input.customName,
            categoryId
          );
        } else {
          updates.customNameId = null;
        }
      }

      const updated = await db
        .update(transactions)
        .set(updates)
        .where(eq(transactions.transactionId, transactionId))
        .returning();

      const transaction = updated[0];
      return formatTransactionForGraphQL(transaction) as unknown as Transaction;
    },

    // Delete a transaction
    deleteTransaction: async (_, { transactionId }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Verify transaction ownership
      await verifyTransactionOwnership(db, transactionId, user.id);

      // Delete transaction
      await db
        .delete(transactions)
        .where(eq(transactions.transactionId, transactionId));

      return { success: true, transactionId };
    },
  },
};
