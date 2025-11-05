import { and, eq, isNull, or } from "drizzle-orm";
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
} from "../../db/schema";
import type {
  MutationResolvers,
  Transaction,
  UpdateTransactionInput,
} from "../../generated/graphql";
import { formatTransactionForGraphQL } from "../queries/transactions";
import { verifyAccountOwnership } from "./accounts";

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
// Maintains the same day from the start date regardless of when payment is made
const calculateNextDueDate = (
  startDate: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  fromDate?: Date
): Date => {
  const baseDate = fromDate ?? startDate;
  const next = new Date(baseDate);

  switch (frequency) {
    case "DAILY": {
      next.setDate(next.getDate() + 1);
      break;
    }
    case "WEEKLY": {
      // Maintain the same day of the week as startDate
      next.setDate(next.getDate() + DAYS_IN_WEEK);
      break;
    }
    case "MONTHLY": {
      // Maintain the same day of the month as startDate
      const targetDay = startDate.getDate();
      next.setMonth(next.getMonth() + 1);

      // Handle cases where target day doesn't exist in next month (e.g., Jan 31 -> Feb)
      const maxDayInMonth = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0
      ).getDate();
      next.setDate(Math.min(targetDay, maxDayInMonth));
      break;
    }
    case "YEARLY": {
      // Maintain the same day and month as startDate
      const targetDay = startDate.getDate();
      const targetMonth = startDate.getMonth();
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(targetMonth);

      // Handle leap year edge cases (e.g., Feb 29)
      const maxDayInMonth = new Date(
        next.getFullYear(),
        targetMonth + 1,
        0
      ).getDate();
      next.setDate(Math.min(targetDay, maxDayInMonth));
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

// Helper function to handle recurring pattern creation or linking
const handleRecurringPattern = async (
  db: PostgresJsDatabase<typeof schema>,
  params: {
    userId: string;
    accountId: string;
    categoryId: string;
    customNameId?: string;
    amount: string;
    transactionType: "DEBIT" | "CREDIT";
    description?: string | null;
    location?: string | null;
    paymentMethod?: string | null;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    transactionDateTime: Date;
    recurringPatternName?: string | null;
    transactionId: string;
  }
): Promise<void> => {
  const {
    userId,
    categoryId,
    customNameId,
    amount,
    transactionType,
    description,
    location,
    paymentMethod,
    frequency,
    transactionDateTime,
    recurringPatternName,
    transactionId,
    accountId,
  } = params;

  // Check if a pattern already exists based on customNameId and categoryId
  // (not accountId, as user can pay from different accounts)
  const whereConditions = [
    eq(recurringPatterns.userId, userId),
    eq(recurringPatterns.categoryId, categoryId),
    eq(recurringPatterns.isActive, true),
  ];

  // Add customNameId condition
  if (customNameId) {
    whereConditions.push(eq(recurringPatterns.customNameId, customNameId));
  } else {
    whereConditions.push(isNull(recurringPatterns.customNameId));
  }

  const existingPattern = await db
    .select()
    .from(recurringPatterns)
    .where(and(...whereConditions))
    .limit(1);

  if (existingPattern[0]) {
    // Pattern exists - link this transaction to it and increment generated count
    const currentCount = existingPattern[0].generatedCount;
    const newCount = currentCount + 1;

    const currentStartDate = new Date(existingPattern[0].startDate);
    const currentLastGenerated = existingPattern[0].lastGeneratedDate
      ? new Date(existingPattern[0].lastGeneratedDate)
      : null;

    // Update startDate if this transaction is earlier than the current startDate
    const shouldUpdateStartDate = transactionDateTime < currentStartDate;

    // Only update lastGeneratedDate and nextDueDate if this transaction is the most recent
    const shouldUpdateLastGenerated =
      !currentLastGenerated || transactionDateTime > currentLastGenerated;

    const updateData: {
      generatedCount: number;
      updatedAt: Date;
      startDate?: Date;
      lastGeneratedDate?: Date;
      nextDueDate?: Date;
    } = {
      generatedCount: newCount,
      updatedAt: new Date(),
    };

    // Update startDate if this is an earlier transaction
    if (shouldUpdateStartDate) {
      updateData.startDate = transactionDateTime;
    }

    // Only update lastGeneratedDate and nextDueDate if this is the most recent transaction
    if (shouldUpdateLastGenerated) {
      updateData.lastGeneratedDate = transactionDateTime;
      // Calculate nextDueDate from the pattern's startDate to maintain the same billing day
      // Use the pattern's current nextDueDate as the base to keep the schedule consistent
      updateData.nextDueDate = calculateNextDueDate(
        currentStartDate,
        frequency,
        new Date(existingPattern[0].nextDueDate)
      );
    }

    await db
      .update(recurringPatterns)
      .set(updateData)
      .where(eq(recurringPatterns.patternId, existingPattern[0].patternId));

    // Link transaction to existing pattern
    await db
      .update(transactions)
      .set({
        recurringPatternId: existingPattern[0].patternId,
        isRecurringGenerated: true,
      })
      .where(eq(transactions.transactionId, transactionId));
  } else {
    // No pattern exists - create a new one
    const nextDueDate = calculateNextDueDate(transactionDateTime, frequency);

    const [newPattern] = await db
      .insert(recurringPatterns)
      .values({
        userId,
        accountId,
        categoryId,
        customNameId: customNameId || null,
        amount,
        transactionType,
        description: description || null,
        location: location || null,
        paymentMethod: paymentMethod || null,
        frequency,
        startDate: transactionDateTime,
        nextDueDate,
        lastGeneratedDate: transactionDateTime,
        generatedCount: 1,
        notes: recurringPatternName || null,
      })
      .returning();

    // Link transaction to new pattern
    await db
      .update(transactions)
      .set({
        recurringPatternId: newPattern.patternId,
        isRecurringGenerated: true,
      })
      .where(eq(transactions.transactionId, transactionId));
  }
};

// Constants for decimal precision
const QUANTITY_DECIMALS = 6;
const PRICE_DECIMALS = 4;
const AMOUNT_DECIMALS = 2;

// Helper function to update account balance after transaction
const updateAccountBalance = async (
  db: PostgresJsDatabase<typeof schema>,
  params: {
    accountId: string;
    amount: string;
    transactionType: "DEBIT" | "CREDIT";
    transactionDateTime: Date;
  }
): Promise<void> => {
  const { accountId, amount, transactionType, transactionDateTime } = params;

  // Get current account balance
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.accountId, accountId))
    .limit(1);

  if (!account) {
    throw new GraphQLError("Account not found", {
      extensions: { code: "ACCOUNT_NOT_FOUND" },
    });
  }

  // Check if transaction is before the manual balance checkpoint
  // If so, don't update the balance
  if (transactionDateTime < account.manualBalanceUpdatedAt) {
    return;
  }

  const currentBalance = Number.parseFloat(account.currentBalance);
  const transactionAmount = Number.parseFloat(amount);

  // Calculate new balance based on transaction type
  // DEBIT = Money going out = Decrease balance (or increase for loan accounts)
  // CREDIT = Money coming in = Increase balance (or decrease for loan accounts)
  let newBalance: number;

  if (account.accountGroup === "POSTPAID" || account.accountGroup === "LOAN") {
    // For POSTPAID (credit cards) and LOAN accounts:
    // DEBIT increases the balance (you owe more or lent more)
    // CREDIT decreases the balance (you paid off or received payment)
    newBalance =
      transactionType === "DEBIT"
        ? currentBalance + transactionAmount
        : currentBalance - transactionAmount;
  } else {
    // For PREPAID and INVESTMENT accounts:
    // DEBIT decreases the balance (money goes out)
    // CREDIT increases the balance (money comes in)
    newBalance =
      transactionType === "DEBIT"
        ? currentBalance - transactionAmount
        : currentBalance + transactionAmount;
  }

  // Update account balance
  await db
    .update(accounts)
    .set({
      currentBalance: newBalance.toFixed(AMOUNT_DECIMALS),
      balanceUpdatedAt: transactionDateTime,
      updatedAt: new Date(),
    })
    .where(eq(accounts.accountId, accountId));
};

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
    transactionId: string;
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
    transactionId,
  } = params;

  // Find existing holding based on assetSymbol (unique key)
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
    let holdingId: string;

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

      holdingId = existingHolding[0].holdingId;
    } else {
      // Create new holding
      const [newHolding] = await db
        .insert(investmentHoldings)
        .values({
          userId,
          accountId,
          categoryId,
          assetSymbol,
          totalQuantity: quantity,
          averageBuyPrice: pricePerUnit,
          totalInvestedAmount: amount,
        })
        .returning();

      holdingId = newHolding.holdingId;
    }

    // Link transaction to holding
    await db
      .update(transactions)
      .set({
        investmentHoldingId: holdingId,
      })
      .where(eq(transactions.transactionId, transactionId));
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
      // Delete holding if fully sold - but keep the holdingId link on transaction
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

    // Link transaction to holding (even if sold out, keep reference)
    await db
      .update(transactions)
      .set({
        investmentHoldingId: existingHolding[0].holdingId,
      })
      .where(eq(transactions.transactionId, transactionId));
  } else if (existingHolding[0]) {
    // For DIVIDEND, BONUS, SPLIT - link to existing holding but don't update quantities
    await db
      .update(transactions)
      .set({
        investmentHoldingId: existingHolding[0].holdingId,
      })
      .where(eq(transactions.transactionId, transactionId));
  }
};

// Helper function to apply simple field updates
const applyBasicFieldUpdates = (
  updates: Partial<typeof transactions.$inferInsert>,
  input: UpdateTransactionInput
): void => {
  // Amount updates are disabled to maintain balance integrity
  // If amount needs to be changed, delete and recreate the transaction
  if (input.amount !== undefined && input.amount !== null) {
    throw new GraphQLError(
      "Cannot modify transaction amount. Delete and recreate the transaction instead.",
      {
        extensions: { code: "AMOUNT_MODIFICATION_NOT_ALLOWED" },
      }
    );
  }
  // DateTime updates are disabled to maintain historical integrity and accurate reporting
  if (
    input.transactionDateTime !== undefined &&
    input.transactionDateTime !== null
  ) {
    throw new GraphQLError(
      "Cannot modify transaction date/time. Delete and recreate the transaction instead.",
      {
        extensions: { code: "DATETIME_MODIFICATION_NOT_ALLOWED" },
      }
    );
  }
  if (input.description !== undefined && input.description !== null) {
    updates.description = input.description;
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

export const transactionMutations: Pick<
  MutationResolvers,
  "createTransaction" | "updateTransaction" | "deleteTransaction"
> = {
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

    // Update the main account balance
    await updateAccountBalance(db, {
      accountId: input.accountId,
      amount: input.amount,
      transactionType: input.transactionType,
      transactionDateTime: new Date(input.transactionDateTime),
    });

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

      // Update the target account balance
      await updateAccountBalance(db, {
        accountId: input.otherAccountId,
        amount: input.amount,
        transactionType: pairedTransactionType,
        transactionDateTime: new Date(input.transactionDateTime),
      });

      // Update main transaction with linked ID and mark as transfer
      await db
        .update(transactions)
        .set({
          linkedTransactionId: pairedTransaction[0].transactionId,
          isTransfer: true,
        })
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
        transactionId: transaction.transactionId,
      });
    }

    const isRecurringTransaction =
      Boolean(input.isRecurring) && input.recurringFrequency;

    // Handle recurring pattern if isRecurring is enabled
    if (isRecurringTransaction) {
      await handleRecurringPattern(db, {
        userId: user.id,
        accountId: input.accountId,
        categoryId: category.categoryId,
        customNameId,
        amount: input.amount,
        transactionType: input.transactionType,
        description: input.description,
        location: input.location,
        paymentMethod: input.paymentMethod,
        frequency: input.recurringFrequency as
          | "DAILY"
          | "WEEKLY"
          | "MONTHLY"
          | "YEARLY",
        transactionDateTime: new Date(input.transactionDateTime),
        recurringPatternName: input.recurringPatternName,
        transactionId: transaction.transactionId,
      });
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

    // Check if transaction exists (might have been already deleted by linked transaction)
    const existingTransaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionId, transactionId),
          eq(transactions.userId, user.id)
        )
      )
      .limit(1);

    if (!existingTransaction[0]) {
      // Transaction already deleted (possibly by a linked transaction deletion)
      return { success: true, transactionId };
    }

    const transaction = existingTransaction[0];

    // Reverse the account balance before deleting
    // We need to reverse the transaction effect on the balance
    await updateAccountBalance(db, {
      accountId: transaction.accountId,
      amount: transaction.amount,
      // Reverse the transaction type to undo the balance change
      transactionType:
        transaction.transactionType === "DEBIT" ? "CREDIT" : "DEBIT",
      transactionDateTime: new Date(),
    });

    // If this is an investment transaction, reverse the holdings
    if (
      transaction.isInvestment &&
      transaction.assetSymbol &&
      transaction.quantity &&
      transaction.pricePerUnit &&
      transaction.investmentAction
    ) {
      // Find the holding to reverse
      const holding = await db
        .select()
        .from(investmentHoldings)
        .where(
          and(
            eq(investmentHoldings.userId, user.id),
            eq(investmentHoldings.accountId, transaction.accountId),
            eq(investmentHoldings.assetSymbol, transaction.assetSymbol)
          )
        )
        .limit(1);

      if (holding[0]) {
        const quantityNum = Number.parseFloat(transaction.quantity);
        const amountNum = Number.parseFloat(transaction.amount);

        if (transaction.investmentAction === "BUY") {
          // Reverse BUY: decrease quantity and invested amount
          const currentQty = Number.parseFloat(holding[0].totalQuantity);
          const currentInvested = Number.parseFloat(
            holding[0].totalInvestedAmount
          );

          const newQty = currentQty - quantityNum;
          const newInvested = currentInvested - amountNum;

          if (newQty <= 0) {
            // Delete holding if quantity reaches zero or below
            await db
              .delete(investmentHoldings)
              .where(eq(investmentHoldings.holdingId, holding[0].holdingId));
          } else {
            const newAvgPrice = newInvested / newQty;
            await db
              .update(investmentHoldings)
              .set({
                totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
                totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
                averageBuyPrice: newAvgPrice.toFixed(PRICE_DECIMALS),
                updatedAt: new Date(),
              })
              .where(eq(investmentHoldings.holdingId, holding[0].holdingId));
          }
        } else if (transaction.investmentAction === "SELL") {
          // Reverse SELL: increase quantity and invested amount
          const currentQty = Number.parseFloat(holding[0].totalQuantity);
          const currentInvested = Number.parseFloat(
            holding[0].totalInvestedAmount
          );
          const avgBuyPrice = Number.parseFloat(
            holding[0].averageBuyPrice || "0"
          );

          const newQty = currentQty + quantityNum;
          const restoredInvestedAmount = avgBuyPrice * quantityNum;
          const newInvested = currentInvested + restoredInvestedAmount;

          const realizedGain = amountNum - restoredInvestedAmount;
          const currentRealizedGain = Number.parseFloat(
            holding[0].realizedGainLoss || "0"
          );

          await db
            .update(investmentHoldings)
            .set({
              totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
              totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
              realizedGainLoss: (currentRealizedGain - realizedGain).toFixed(
                AMOUNT_DECIMALS
              ),
              updatedAt: new Date(),
            })
            .where(eq(investmentHoldings.holdingId, holding[0].holdingId));
        }
        // For DIVIDEND, BONUS, SPLIT - no holding changes needed
      }
    }

    // If this is a transfer transaction, delete both transactions
    if (transaction.isTransfer && transaction.linkedTransactionId) {
      // Get the linked transaction to reverse its balance too
      const linkedTransaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.transactionId, transaction.linkedTransactionId))
        .limit(1);

      if (linkedTransaction[0]) {
        // Reverse the linked account balance
        await updateAccountBalance(db, {
          accountId: linkedTransaction[0].accountId,
          amount: linkedTransaction[0].amount,
          // Reverse the transaction type to undo the balance change
          transactionType:
            linkedTransaction[0].transactionType === "DEBIT"
              ? "CREDIT"
              : "DEBIT",
          transactionDateTime: new Date(),
        });
      }

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
      // Count how many transactions are linked to this pattern
      const linkedTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.recurringPatternId, transaction.recurringPatternId),
            eq(transactions.userId, user.id)
          )
        );

      if (linkedTransactions.length === 1) {
        // This is the only transaction linked to this pattern - delete the pattern
        await db
          .delete(recurringPatterns)
          .where(
            and(
              eq(recurringPatterns.patternId, transaction.recurringPatternId),
              eq(recurringPatterns.userId, user.id)
            )
          );
      } else {
        // Multiple transactions exist - update the pattern intuitively
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
          // Decrement the generated count
          const newCount = Math.max(0, pattern[0].generatedCount - 1);

          const transactionDate = new Date(transaction.transactionDateTime);
          const currentStartDate = new Date(pattern[0].startDate);
          const currentLastGenerated = pattern[0].lastGeneratedDate
            ? new Date(pattern[0].lastGeneratedDate)
            : null;

          // Get remaining transactions (excluding the one being deleted)
          const remainingTransactions = linkedTransactions
            .filter((t) => t.transactionId !== transactionId)
            .sort(
              (a, b) =>
                new Date(a.transactionDateTime).getTime() -
                new Date(b.transactionDateTime).getTime()
            );

          const updateData: {
            generatedCount: number;
            updatedAt: Date;
            startDate?: Date;
            lastGeneratedDate?: Date | null;
            nextDueDate?: Date;
          } = {
            generatedCount: newCount,
            updatedAt: new Date(),
          };

          // Check if the deleted transaction was the earliest one
          const isEarliestTransaction =
            transactionDate.getTime() === currentStartDate.getTime();

          // Check if the deleted transaction was the most recent one
          const isMostRecentTransaction =
            currentLastGenerated &&
            transactionDate.getTime() === currentLastGenerated.getTime();

          // Update startDate if we deleted the earliest transaction
          if (isEarliestTransaction && remainingTransactions.length > 0) {
            updateData.startDate = new Date(
              remainingTransactions[0].transactionDateTime
            );
          }

          // Update lastGeneratedDate and nextDueDate if we deleted the most recent transaction
          if (isMostRecentTransaction) {
            if (remainingTransactions.length > 0) {
              const newMostRecent = remainingTransactions.at(-1);
              if (newMostRecent) {
                updateData.lastGeneratedDate = new Date(
                  newMostRecent.transactionDateTime
                );
                // Calculate nextDueDate from the pattern's startDate to maintain the same billing day
                // Use the new most recent transaction date as the base
                updateData.nextDueDate = calculateNextDueDate(
                  updateData.startDate || currentStartDate,
                  pattern[0].frequency,
                  new Date(newMostRecent.transactionDateTime)
                );
              }
            } else {
              updateData.lastGeneratedDate = null;
            }
          }

          await db
            .update(recurringPatterns)
            .set(updateData)
            .where(
              and(
                eq(recurringPatterns.patternId, transaction.recurringPatternId),
                eq(recurringPatterns.userId, user.id)
              )
            );
        }
      }
    }

    // Delete transaction
    await db
      .delete(transactions)
      .where(eq(transactions.transactionId, transactionId));

    return { success: true, transactionId };
  },
};
