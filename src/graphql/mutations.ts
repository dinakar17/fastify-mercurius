import { and, eq, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { GraphQLError } from "graphql";
import type * as schema from "@/db/schema";
import {
  accounts,
  categories,
  customTransactionNames,
  investmentHoldings,
  recurringPatterns,
  transactions,
} from "../db/schema";
import type {
  Account,
  MutationResolvers,
  Transaction,
  UpdateTransactionInput,
} from "../generated/graphql";
import { recurringMutations } from "./recurring-mutations";

// Helper function to format transaction for GraphQL
const formatTransactionForGraphQL = (
  transaction: typeof transactions.$inferSelect
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

  // Null fields for joined data
  accountName: null,
  accountNumber: null,
  accountLogoUrl: null,
  categoryId: null,
  categoryName: null,
  categoryNumber: null,
  categoryType: null,
  investmentSector: null,
  categoryIconUrl: null,
  customNameId: null,
  customNameText: null,
  customLogoUrl: null,
});

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
  params: {
    userId: string;
    customName: string;
    categoryId: string;
    customLogoUrl?: string | null;
  }
): Promise<string> => {
  // First try to find existing custom name
  const existing = await db
    .select()
    .from(customTransactionNames)
    .where(
      and(
        eq(customTransactionNames.userId, params.userId),
        eq(customTransactionNames.customName, params.customName)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Update usage count, last used date, and logo URL if provided
    const updateData: {
      usageCount: number;
      lastUsedAt: Date;
      updatedAt: Date;
      customLogoUrl?: string | null;
    } = {
      usageCount: existing[0].usageCount + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    };

    // Update logo URL if provided
    if (params.customLogoUrl !== undefined) {
      updateData.customLogoUrl = params.customLogoUrl;
    }

    await db
      .update(customTransactionNames)
      .set(updateData)
      .where(eq(customTransactionNames.customNameId, existing[0].customNameId));

    return existing[0].customNameId;
  }

  // Create new custom name
  const newCustomName = await db
    .insert(customTransactionNames)
    .values({
      userId: params.userId,
      categoryId: params.categoryId,
      customName: params.customName,
      customLogoUrl: params.customLogoUrl || null,
      usageCount: 1,
      lastUsedAt: new Date(),
    })
    .returning();

  return newCustomName[0].customNameId;
};

const DAYS_IN_WEEK = 7;

// Helper function to calculate next due date based on frequency
const calculateNextDueDate = (
  startDate: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
): Date => {
  const next = new Date(startDate);

  switch (frequency) {
    case "DAILY": {
      next.setDate(next.getDate() + 1);
      break;
    }
    case "WEEKLY": {
      next.setDate(next.getDate() + DAYS_IN_WEEK);
      break;
    }
    case "MONTHLY": {
      next.setMonth(next.getMonth() + 1);
      break;
    }
    case "YEARLY": {
      next.setFullYear(next.getFullYear() + 1);
      break;
    }
    default: {
      throw new GraphQLError("Invalid frequency", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
  }

  return next;
};

// Constants for decimal precision
const QUANTITY_DECIMALS = 6;
const PRICE_DECIMALS = 4;
const AMOUNT_DECIMALS = 2;

// Helper function to update investment holdings
const updateInvestmentHoldings = async (
  db: PostgresJsDatabase<typeof schema>,
  params: {
    userId: string;
    accountId: string;
    categoryId: string;
    assetSymbol: string;
    quantity: string;
    pricePerUnit: string;
    investmentAction: string;
    amount: string;
  }
): Promise<void> => {
  const {
    userId,
    accountId,
    categoryId,
    assetSymbol,
    quantity,
    pricePerUnit,
    investmentAction,
    amount,
  } = params;

  // Find existing holding
  const existingHolding = await db
    .select()
    .from(investmentHoldings)
    .where(
      and(
        eq(investmentHoldings.userId, userId),
        eq(investmentHoldings.accountId, accountId),
        eq(investmentHoldings.assetSymbol, assetSymbol)
      )
    )
    .limit(1);

  const quantityNum = Number.parseFloat(quantity);
  const amountNum = Number.parseFloat(amount);

  if (investmentAction === "BUY") {
    if (existingHolding[0]) {
      // Update existing holding
      const currentQty = Number.parseFloat(existingHolding[0].totalQuantity);
      const currentInvested = Number.parseFloat(
        existingHolding[0].totalInvestedAmount
      );

      const newQty = currentQty + quantityNum;
      const newInvested = currentInvested + amountNum;
      const newAvgPrice = newInvested / newQty;

      await db
        .update(investmentHoldings)
        .set({
          totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
          totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
          averageBuyPrice: newAvgPrice.toFixed(PRICE_DECIMALS),
          updatedAt: new Date(),
        })
        .where(eq(investmentHoldings.holdingId, existingHolding[0].holdingId));
    } else {
      // Create new holding
      await db.insert(investmentHoldings).values({
        userId,
        accountId,
        categoryId,
        assetSymbol,
        totalQuantity: quantity,
        averageBuyPrice: pricePerUnit,
        totalInvestedAmount: amount,
      });
    }
  } else if (investmentAction === "SELL") {
    if (!existingHolding[0]) {
      throw new GraphQLError("Cannot sell asset that is not in holdings", {
        extensions: { code: "HOLDING_NOT_FOUND" },
      });
    }

    const currentQty = Number.parseFloat(existingHolding[0].totalQuantity);
    const currentInvested = Number.parseFloat(
      existingHolding[0].totalInvestedAmount
    );
    const avgBuyPrice = Number.parseFloat(
      existingHolding[0].averageBuyPrice || "0"
    );

    if (currentQty < quantityNum) {
      throw new GraphQLError("Cannot sell more than available quantity", {
        extensions: { code: "INSUFFICIENT_QUANTITY" },
      });
    }

    const newQty = currentQty - quantityNum;
    const soldInvestedAmount = avgBuyPrice * quantityNum;
    const newInvested = currentInvested - soldInvestedAmount;
    const realizedGain = amountNum - soldInvestedAmount;
    const currentRealizedGain = Number.parseFloat(
      existingHolding[0].realizedGainLoss || "0"
    );

    if (newQty === 0) {
      // Delete holding if fully sold
      await db
        .delete(investmentHoldings)
        .where(eq(investmentHoldings.holdingId, existingHolding[0].holdingId));
    } else {
      // Update holding
      await db
        .update(investmentHoldings)
        .set({
          totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
          totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
          realizedGainLoss: (currentRealizedGain + realizedGain).toFixed(
            AMOUNT_DECIMALS
          ),
          updatedAt: new Date(),
        })
        .where(eq(investmentHoldings.holdingId, existingHolding[0].holdingId));
    }
  }
  // For DIVIDEND, BONUS, SPLIT - no holding updates needed (they're just recorded as transactions)
};

// Helper function to apply simple field updates
// Helper function to apply simple field updates
const applyBasicFieldUpdates = (
  updates: Partial<typeof transactions.$inferInsert>,
  input: UpdateTransactionInput
): void => {
  if (input.amount !== undefined && input.amount !== null) {
    updates.amount = input.amount;
  }
  if (input.description !== undefined && input.description !== null) {
    updates.description = input.description;
  }
  if (
    input.transactionDateTime !== undefined &&
    input.transactionDateTime !== null
  ) {
    updates.transactionDateTime = new Date(input.transactionDateTime);
  }
  if (input.location !== undefined && input.location !== null) {
    updates.location = input.location;
  }
  if (input.paymentMethod !== undefined && input.paymentMethod !== null) {
    updates.paymentMethod = input.paymentMethod;
  }
  if (input.transactionType !== undefined && input.transactionType !== null) {
    updates.transactionType = input.transactionType;
  }
};

// Helper function to apply investment field updates
const applyInvestmentFieldUpdates = (
  updates: Partial<typeof transactions.$inferInsert>,
  input: UpdateTransactionInput
): void => {
  if (input.isInvestment !== undefined && input.isInvestment !== null) {
    updates.isInvestment = input.isInvestment;
  }
  if (input.assetSymbol !== undefined && input.assetSymbol !== null) {
    updates.assetSymbol = input.assetSymbol;
  }
  if (input.pricePerUnit !== undefined && input.pricePerUnit !== null) {
    updates.pricePerUnit = input.pricePerUnit;
  }
  if (input.quantity !== undefined && input.quantity !== null) {
    updates.quantity = input.quantity;
  }
  if (input.investmentAction !== undefined && input.investmentAction !== null) {
    updates.investmentAction = input.investmentAction;
  }
};

// Helper function to apply recurring field updates
const applyRecurringFieldUpdates = (
  updates: Partial<typeof transactions.$inferInsert>,
  input: UpdateTransactionInput
): void => {
  if (input.isRecurring !== undefined && input.isRecurring !== null) {
    updates.isRecurring = input.isRecurring;
  }
  if (
    input.recurringFrequency !== undefined &&
    input.recurringFrequency !== null
  ) {
    updates.recurringFrequency = input.recurringFrequency;
  }
  if (
    input.recurringPatternName !== undefined &&
    input.recurringPatternName !== null
  ) {
    updates.recurringPatternName = input.recurringPatternName;
  }
};

// Helper function to build transaction update object
const buildTransactionUpdates = async (
  db: PostgresJsDatabase<typeof schema>,
  userId: string,
  input: UpdateTransactionInput,
  existing: typeof transactions.$inferSelect
): Promise<
  Partial<typeof transactions.$inferInsert> & {
    updatedAt: Date;
  }
> => {
  const updates: Partial<typeof transactions.$inferInsert> & {
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  // Apply all field updates
  applyBasicFieldUpdates(updates, input);
  applyInvestmentFieldUpdates(updates, input);
  applyRecurringFieldUpdates(updates, input);

  // Handle category update
  if (input.categoryNumber !== undefined && input.categoryNumber !== null) {
    const category = await getCategoryByNumber(db, input.categoryNumber);
    updates.categoryId = category.categoryId;
  }

  // Handle custom name update
  if (input.customName !== undefined) {
    if (input.customName) {
      const categoryId = updates.categoryId || existing.categoryId;
      updates.customNameId = await findOrCreateCustomName(db, {
        userId,
        customName: input.customName,
        categoryId,
        customLogoUrl: input.customNameLogoUrl,
      });
    } else {
      updates.customNameId = null;
    }
  }

  return updates;
};

export const mutations: MutationResolvers = {
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
      customNameId = await findOrCreateCustomName(db, {
        userId: user.id,
        customName: input.customName,
        categoryId: category.categoryId,
      });
    }

    // If this is a transfer, verify the other account
    let otherAccount: typeof accounts.$inferSelect | undefined;
    if (input.isTransfer && input.otherAccountId) {
      await verifyAccountOwnership(db, input.otherAccountId, user.id);

      // Fetch the other account details to check its group
      const otherAccountResult = await db
        .select()
        .from(accounts)
        .where(eq(accounts.accountId, input.otherAccountId))
        .limit(1);

      otherAccount = otherAccountResult[0];
    }

    console.log(
      `CreateTransaction input.transactionDateTime: ${input.transactionDateTime}`
    );
    console.log(
      `CreateTransaction converted date time: ${new Date(input.transactionDateTime)}`
    );

    // Determine if this should be an investment transaction
    // If transfer to an INVESTMENT group account, mark as investment
    const isInvestmentTransaction =
      input.isInvestment ||
      (input.isTransfer && otherAccount?.accountGroup === "INVESTMENT");

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
        isInvestment: isInvestmentTransaction,
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
          isInvestment: Boolean(isInvestmentTransaction),
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

    // Update investment holdings if this is an investment transaction
    if (
      isInvestmentTransaction &&
      input.assetSymbol &&
      input.quantity &&
      input.pricePerUnit &&
      input.investmentAction
    ) {
      await updateInvestmentHoldings(db, {
        userId: user.id,
        accountId: input.accountId,
        categoryId: category.categoryId,
        assetSymbol: input.assetSymbol,
        quantity: input.quantity,
        pricePerUnit: input.pricePerUnit,
        investmentAction: input.investmentAction,
        amount: input.amount,
      });
    }

    // Create recurring pattern if isRecurring is enabled
    if (input.isRecurring && input.recurringFrequency) {
      const transactionDate = new Date(input.transactionDateTime);
      const nextDueDate = calculateNextDueDate(
        transactionDate,
        input.recurringFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
      );

      // Create the recurring pattern
      const [newPattern] = await db
        .insert(recurringPatterns)
        .values({
          userId: user.id,
          accountId: input.accountId,
          categoryId: category.categoryId,
          customNameId: customNameId || null,
          amount: input.amount,
          transactionType: input.transactionType,
          description: input.description,
          location: input.location,
          paymentMethod: input.paymentMethod,
          frequency: input.recurringFrequency,
          startDate: transactionDate,
          nextDueDate,
          lastGeneratedDate: transactionDate,
          generatedCount: 1,
          notes: input.recurringPatternName || null,
        })
        .returning();

      // Update the transaction with the recurring pattern ID
      await db
        .update(transactions)
        .set({
          recurringPatternId: newPattern.patternId,
          isRecurringGenerated: true,
        })
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

    // Prevent modifying investment transactions
    if (existing.isInvestment) {
      throw new GraphQLError(
        "Cannot modify investment transactions. Delete and recreate the transaction instead.",
        {
          extensions: { code: "INVESTMENT_MODIFICATION_NOT_ALLOWED" },
        }
      );
    }

    // Prevent modifying transfer related transactions
    if (existing.isTransfer) {
      throw new GraphQLError(
        "Cannot modify transfer related transactions. Delete and recreate the transfer instead.",
        {
          extensions: { code: "TRANSFER_MODIFICATION_NOT_ALLOWED" },
        }
      );
    }

    // Prevent modifying Recurring transactions
    if (
      existing.isRecurring &&
      (input.recurringFrequency || input.recurringPatternName)
    ) {
      throw new GraphQLError(
        "Cannot modify recurring transactions. Delete and recreate the recurring transaction instead.",
        {
          extensions: { code: "RECURRING_MODIFICATION_NOT_ALLOWED" },
        }
      );
    }

    // Build update object with all changes
    const updates = await buildTransactionUpdates(db, user.id, input, existing);

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
    const transaction = await verifyTransactionOwnership(
      db,
      transactionId,
      user.id
    );

    // If this is an investment transaction, reverse the holdings
    if (
      transaction.isInvestment &&
      transaction.assetSymbol &&
      transaction.quantity &&
      transaction.pricePerUnit &&
      transaction.investmentAction
    ) {
      // Reverse the action (BUY becomes SELL, SELL becomes BUY)
      const reverseAction =
        transaction.investmentAction === "BUY" ? "SELL" : "BUY";

      await updateInvestmentHoldings(db, {
        userId: user.id,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        assetSymbol: transaction.assetSymbol,
        quantity: transaction.quantity,
        pricePerUnit: transaction.pricePerUnit,
        investmentAction: reverseAction,
        amount: transaction.amount,
      });
    }

    // If this is a transfer transaction, delete both transactions
    if (transaction.isTransfer && transaction.linkedTransactionId) {
      // Delete both the main transaction and the linked one
      // Using OR to handle both directions of the link
      await db
        .delete(transactions)
        .where(
          or(
            eq(transactions.transactionId, transactionId),
            eq(transactions.transactionId, transaction.linkedTransactionId)
          )
        );

      return { success: true, transactionId };
    }

    // If this is a recurring transaction, handle the recurring pattern
    if (transaction.isRecurring && transaction.recurringPatternId) {
      // Check if this is a generated transaction or the initial one
      if (transaction.isRecurringGenerated) {
        // This is a generated transaction - update the pattern's generated count
        const pattern = await db
          .select()
          .from(recurringPatterns)
          .where(
            and(
              eq(recurringPatterns.patternId, transaction.recurringPatternId),
              eq(recurringPatterns.userId, user.id)
            )
          )
          .limit(1);

        if (pattern[0]) {
          const newCount = Math.max(0, pattern[0].generatedCount - 1);
          await db
            .update(recurringPatterns)
            .set({
              generatedCount: newCount,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(recurringPatterns.patternId, transaction.recurringPatternId),
                eq(recurringPatterns.userId, user.id)
              )
            );
        }
      } else {
        // This is the initial transaction - check if there are other generated transactions
        const generatedTransactions = await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(
                transactions.recurringPatternId,
                transaction.recurringPatternId
              ),
              eq(transactions.isRecurringGenerated, true),
              eq(transactions.userId, user.id)
            )
          )
          .limit(1);

        if (generatedTransactions.length === 0) {
          // No generated transactions exist, safe to delete the pattern
          await db
            .delete(recurringPatterns)
            .where(
              and(
                eq(recurringPatterns.patternId, transaction.recurringPatternId),
                eq(recurringPatterns.userId, user.id)
              )
            );
        } else {
          // Generated transactions exist, just unlink this transaction
          // The pattern will remain for future generations
          await db
            .update(transactions)
            .set({
              recurringPatternId: null,
              isRecurringGenerated: false,
            })
            .where(eq(transactions.transactionId, transactionId));
        }
      }
    }

    // Delete transaction
    await db
      .delete(transactions)
      .where(eq(transactions.transactionId, transactionId));

    return { success: true, transactionId };
  },

  // Merge recurring pattern mutations
  ...recurringMutations,
};
