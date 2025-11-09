import { and, eq } from "drizzle-orm";
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
} from "@/db/schema";

// Constants for decimal precision
const QUANTITY_DECIMALS = 6;
const PRICE_DECIMALS = 4;
const AMOUNT_DECIMALS = 2;
const DAYS_IN_WEEK = 7;

// ===========================
// VERIFICATION HELPERS
// ===========================

/**
 * Verify transaction ownership
 */
export const verifyTransactionOwnership = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  transactionId: string,
  userId: string
): Promise<typeof transactions.$inferSelect> => {
  const transaction = await dbOrTx
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

/**
 * Verify account ownership
 */
export const verifyAccountOwnership = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  accountId: string,
  userId: string
): Promise<typeof accounts.$inferSelect> => {
  const account = await dbOrTx
    .select()
    .from(accounts)
    .where(and(eq(accounts.accountId, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account[0]) {
    throw new GraphQLError("Account not found or access denied", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  return account[0];
};

/**
 * Get category by number
 */
export const getCategoryByNumber = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  categoryNumber: number
): Promise<typeof categories.$inferSelect> => {
  const category = await dbOrTx
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

// ===========================
// DATE CALCULATION HELPER
// ===========================

/**
 * Calculate next due date based on frequency
 */
export const calculateNextDueDate = (
  startDate: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM",
  fromDate?: Date,
  customFrequencyDays?: number
): Date => {
  const baseDate = fromDate ?? startDate;
  const next = new Date(baseDate);

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
      const targetDay = startDate.getDate();
      next.setMonth(next.getMonth() + 1);
      const maxDayInMonth = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0
      ).getDate();
      next.setDate(Math.min(targetDay, maxDayInMonth));
      break;
    }
    case "YEARLY": {
      const targetDay = startDate.getDate();
      const targetMonth = startDate.getMonth();
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(targetMonth);
      const maxDayInMonth = new Date(
        next.getFullYear(),
        targetMonth + 1,
        0
      ).getDate();
      next.setDate(Math.min(targetDay, maxDayInMonth));
      break;
    }
    case "CUSTOM": {
      if (!customFrequencyDays || customFrequencyDays <= 0) {
        throw new GraphQLError(
          "Custom frequency requires valid number of days",
          { extensions: { code: "BAD_USER_INPUT" } }
        );
      }
      next.setDate(next.getDate() + customFrequencyDays);
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

// ===========================
// MAIN HELPER FUNCTIONS
// ===========================

/**
 * Update custom transaction names
 * Handles: create (find or create), update (find/create new, delete old if single use), delete (delete if single use, else decrement)
 */
export const updateCustomName = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  operation: "create" | "update" | "delete",
  params: {
    userId: string;
    customName?: string | null;
    categoryId: string;
    customLogoUrl?: string | null;
    assetSymbol?: string | null;
    oldCustomNameId?: string | null;
  }
): Promise<string | null> => {
  // Helper to handle old custom name cleanup (delete or decrement)
  const cleanupOldCustomName = async (customNameId: string) => {
    const [old] = await dbOrTx
      .select()
      .from(customTransactionNames)
      .where(eq(customTransactionNames.customNameId, customNameId))
      .limit(1);

    if (!old) {
      return;
    }

    if (old.usageCount <= 1) {
      await dbOrTx
        .delete(customTransactionNames)
        .where(eq(customTransactionNames.customNameId, customNameId));
    } else {
      await dbOrTx
        .update(customTransactionNames)
        .set({ usageCount: old.usageCount - 1, updatedAt: new Date() })
        .where(eq(customTransactionNames.customNameId, customNameId));
    }
  };

  // Delete operation or update with no custom name
  if (operation === "delete" || !params.customName) {
    if (params.oldCustomNameId) {
      await cleanupOldCustomName(params.oldCustomNameId);
    }
    return null;
  }

  // Find existing custom name
  const [existing] = await dbOrTx
    .select()
    .from(customTransactionNames)
    .where(
      and(
        eq(customTransactionNames.userId, params.userId),
        eq(customTransactionNames.customName, params.customName)
      )
    )
    .limit(1);

  // Update operation: cleanup old custom name if different
  if (
    operation === "update" &&
    params.oldCustomNameId &&
    (!existing || existing.customNameId !== params.oldCustomNameId)
  ) {
    await cleanupOldCustomName(params.oldCustomNameId);
  }

  // Update existing custom name
  if (existing) {
    const updateData: {
      usageCount: number;
      lastUsedAt: Date;
      updatedAt: Date;
      customLogoUrl?: string | null;
      assetSymbol?: string | null;
    } = {
      usageCount: existing.usageCount + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    };
    if (params.customLogoUrl !== undefined) {
      updateData.customLogoUrl = params.customLogoUrl;
    }
    if (params.assetSymbol !== undefined) {
      updateData.assetSymbol = params.assetSymbol;
    }

    await dbOrTx
      .update(customTransactionNames)
      .set(updateData)
      .where(eq(customTransactionNames.customNameId, existing.customNameId));
    return existing.customNameId;
  }

  // Create new custom name
  const [newCustomName] = await dbOrTx
    .insert(customTransactionNames)
    .values({
      userId: params.userId,
      categoryId: params.categoryId,
      customName: params.customName,
      customLogoUrl: params.customLogoUrl || null,
      assetSymbol: params.assetSymbol || null,
      usageCount: 1,
      lastUsedAt: new Date(),
    })
    .returning();

  return newCustomName.customNameId;
};

/**
 * Update account balances
 * Handles: create (add transaction), update (reverse old, apply new), delete (reverse transaction)
 */
export const updateAccountBalances = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  operation: "create" | "update" | "delete",
  params: {
    // Old transaction data (for update/delete)
    oldAccountId?: string;
    oldAmount?: string;
    oldTransactionType?: "DEBIT" | "CREDIT";
    oldTransactionDateTime?: Date;
    // New transaction data (for create/update)
    newAccountId?: string;
    newAmount?: string;
    newTransactionType?: "DEBIT" | "CREDIT";
    newTransactionDateTime?: Date;
  }
): Promise<void> => {
  // Helper to apply balance change
  // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex balance calculations for different account groups
  const applyBalanceChange = async (
    accountId: string,
    amount: string,
    transactionType: "DEBIT" | "CREDIT",
    transactionDateTime: Date,
    reverse = false
    // biome-ignore lint(complexity/noExcessiveParametersCount): All parameters required for balance calculation
  ) => {
    const [account] = await dbOrTx
      .select()
      .from(accounts)
      .where(eq(accounts.accountId, accountId))
      .limit(1);

    if (!account) {
      throw new GraphQLError("Account not found", {
        extensions: { code: "ACCOUNT_NOT_FOUND" },
      });
    }

    // Check manual balance checkpoint
    if (transactionDateTime < account.manualBalanceUpdatedAt) {
      return;
    }

    const currentBalance = Number.parseFloat(account.currentBalance);
    const transactionAmount = Number.parseFloat(amount);

    // Reverse the transaction type if needed
    let effectiveType = transactionType;
    if (reverse) {
      effectiveType = transactionType === "DEBIT" ? "CREDIT" : "DEBIT";
    }

    let newBalance: number;
    if (
      account.accountGroup === "POSTPAID" ||
      account.accountGroup === "LOAN"
    ) {
      newBalance =
        effectiveType === "DEBIT"
          ? currentBalance + transactionAmount
          : currentBalance - transactionAmount;
    } else {
      newBalance =
        effectiveType === "DEBIT"
          ? currentBalance - transactionAmount
          : currentBalance + transactionAmount;
    }

    await dbOrTx
      .update(accounts)
      .set({
        currentBalance: newBalance.toFixed(AMOUNT_DECIMALS),
        balanceUpdatedAt: transactionDateTime,
        updatedAt: new Date(),
      })
      .where(eq(accounts.accountId, accountId));
  };

  if (operation === "create") {
    // Simply apply the new transaction
    if (
      params.newAccountId &&
      params.newAmount &&
      params.newTransactionType &&
      params.newTransactionDateTime
    ) {
      await applyBalanceChange(
        params.newAccountId,
        params.newAmount,
        params.newTransactionType,
        params.newTransactionDateTime
      );
    }
  } else if (operation === "update") {
    // Reverse old transaction
    if (params.oldAccountId && params.oldAmount && params.oldTransactionType) {
      await applyBalanceChange(
        params.oldAccountId,
        params.oldAmount,
        params.oldTransactionType,
        new Date(), // Use current time for reversal
        true // Reverse flag
      );
    }

    // Apply new transaction
    if (
      params.newAccountId &&
      params.newAmount &&
      params.newTransactionType &&
      params.newTransactionDateTime
    ) {
      await applyBalanceChange(
        params.newAccountId,
        params.newAmount,
        params.newTransactionType,
        params.newTransactionDateTime
      );
    }
  } else if (
    operation === "delete" &&
    params.oldAccountId &&
    params.oldAmount &&
    params.oldTransactionType
  ) {
    // Reverse the transaction
    await applyBalanceChange(
      params.oldAccountId,
      params.oldAmount,
      params.oldTransactionType,
      new Date(), // Use current time for reversal
      true // Reverse flag
    );
  }
};

/**
 * Update investment holdings
 * Handles: create (add holding), update (reverse old, apply new), delete (reverse holding)
 */
export const updateInvestmentHoldings = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  operation: "create" | "update" | "delete",
  params: {
    userId: string;
    // Old transaction data (for update/delete)
    oldAccountId?: string;
    oldCategoryId?: string;
    oldAssetSymbol?: string;
    oldQuantity?: string;
    oldPricePerUnit?: string;
    oldInvestmentAction?: string;
    oldAmount?: string;
    // New transaction data (for create/update)
    newAccountId?: string;
    newCategoryId?: string;
    newAssetSymbol?: string;
    newQuantity?: string;
    newPricePerUnit?: string;
    newInvestmentAction?: string;
    newAmount?: string;
    transactionId?: string;
  }
): Promise<void> => {
  // Helper to apply holding change
  // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex investment calculations for different actions
  const applyHoldingChange = async (
    assetSymbol: string,
    accountId: string,
    categoryId: string,
    quantity: string,
    pricePerUnit: string,
    investmentAction: string,
    amount: string,
    transactionId: string | undefined,
    reverse = false
  ) => {
    const [holding] = await dbOrTx
      .select()
      .from(investmentHoldings)
      .where(
        and(
          eq(investmentHoldings.userId, params.userId),
          eq(investmentHoldings.assetSymbol, assetSymbol)
        )
      )
      .limit(1);

    const quantityNum = Number.parseFloat(quantity);
    const amountNum = Number.parseFloat(amount);

    if (investmentAction === "BUY") {
      if (reverse) {
        // Reverse BUY: decrease quantity
        if (!holding) {
          return;
        }

        const currentQty = Number.parseFloat(holding.totalQuantity);
        const currentInvested = Number.parseFloat(holding.totalInvestedAmount);
        const newQty = currentQty - quantityNum;
        const newInvested = currentInvested - amountNum;

        if (newQty <= 0) {
          await dbOrTx
            .delete(investmentHoldings)
            .where(eq(investmentHoldings.holdingId, holding.holdingId));
        } else {
          const newAvgPrice = newInvested / newQty;
          await dbOrTx
            .update(investmentHoldings)
            .set({
              totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
              totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
              averageBuyPrice: newAvgPrice.toFixed(PRICE_DECIMALS),
              updatedAt: new Date(),
            })
            .where(eq(investmentHoldings.holdingId, holding.holdingId));
        }
      } else if (holding) {
        // Normal BUY: increase quantity
        const currentQty = Number.parseFloat(holding.totalQuantity);
        const currentInvested = Number.parseFloat(holding.totalInvestedAmount);
        const newQty = currentQty + quantityNum;
        const newInvested = currentInvested + amountNum;
        const newAvgPrice = newInvested / newQty;

        await dbOrTx
          .update(investmentHoldings)
          .set({
            totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
            totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
            averageBuyPrice: newAvgPrice.toFixed(PRICE_DECIMALS),
            updatedAt: new Date(),
          })
          .where(eq(investmentHoldings.holdingId, holding.holdingId));

        if (transactionId) {
          await dbOrTx
            .update(transactions)
            .set({ investmentHoldingId: holding.holdingId })
            .where(eq(transactions.transactionId, transactionId));
        }
      } else {
        const [newHolding] = await dbOrTx
          .insert(investmentHoldings)
          .values({
            userId: params.userId,
            accountId,
            categoryId,
            assetSymbol,
            totalQuantity: quantity,
            averageBuyPrice: pricePerUnit,
            totalInvestedAmount: amount,
          })
          .returning();

        if (transactionId) {
          await dbOrTx
            .update(transactions)
            .set({ investmentHoldingId: newHolding.holdingId })
            .where(eq(transactions.transactionId, transactionId));
        }
      }
    } else if (investmentAction === "SELL") {
      if (!holding) {
        if (!reverse) {
          throw new GraphQLError("Cannot sell asset that is not in holdings", {
            extensions: { code: "HOLDING_NOT_FOUND" },
          });
        }
        return;
      }

      const currentQty = Number.parseFloat(holding.totalQuantity);
      const currentInvested = Number.parseFloat(holding.totalInvestedAmount);
      const avgBuyPrice = Number.parseFloat(holding.averageBuyPrice || "0");

      if (reverse) {
        // Reverse SELL: increase quantity
        const newQty = currentQty + quantityNum;
        const restoredInvestedAmount = avgBuyPrice * quantityNum;
        const newInvested = currentInvested + restoredInvestedAmount;
        const realizedGain = amountNum - restoredInvestedAmount;
        const currentRealizedGain = Number.parseFloat(
          holding.realizedGainLoss || "0"
        );

        await dbOrTx
          .update(investmentHoldings)
          .set({
            totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
            totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
            realizedGainLoss: (currentRealizedGain - realizedGain).toFixed(
              AMOUNT_DECIMALS
            ),
            updatedAt: new Date(),
          })
          .where(eq(investmentHoldings.holdingId, holding.holdingId));
      } else {
        // Normal SELL: decrease quantity
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
          holding.realizedGainLoss || "0"
        );

        if (transactionId) {
          await dbOrTx
            .update(transactions)
            .set({ investmentHoldingId: holding.holdingId })
            .where(eq(transactions.transactionId, transactionId));
        }

        if (newQty === 0) {
          await dbOrTx
            .delete(investmentHoldings)
            .where(eq(investmentHoldings.holdingId, holding.holdingId));
        } else {
          await dbOrTx
            .update(investmentHoldings)
            .set({
              totalQuantity: newQty.toFixed(QUANTITY_DECIMALS),
              totalInvestedAmount: newInvested.toFixed(AMOUNT_DECIMALS),
              realizedGainLoss: (currentRealizedGain + realizedGain).toFixed(
                AMOUNT_DECIMALS
              ),
              updatedAt: new Date(),
            })
            .where(eq(investmentHoldings.holdingId, holding.holdingId));
        }
      }
    } else if (holding && !reverse && transactionId) {
      // For DIVIDEND, BONUS, SPLIT - just link to holding
      await dbOrTx
        .update(transactions)
        .set({ investmentHoldingId: holding.holdingId })
        .where(eq(transactions.transactionId, transactionId));
    }
  };

  if (operation === "create") {
    if (
      params.newAssetSymbol &&
      params.newAccountId &&
      params.newCategoryId &&
      params.newQuantity &&
      params.newPricePerUnit &&
      params.newInvestmentAction &&
      params.newAmount
    ) {
      await applyHoldingChange(
        params.newAssetSymbol,
        params.newAccountId,
        params.newCategoryId,
        params.newQuantity,
        params.newPricePerUnit,
        params.newInvestmentAction,
        params.newAmount,
        params.transactionId,
        false
      );
    }
  } else if (operation === "update") {
    // Reverse old holding
    if (
      params.oldAssetSymbol &&
      params.oldAccountId &&
      params.oldCategoryId &&
      params.oldQuantity &&
      params.oldPricePerUnit &&
      params.oldInvestmentAction &&
      params.oldAmount
    ) {
      await applyHoldingChange(
        params.oldAssetSymbol,
        params.oldAccountId,
        params.oldCategoryId,
        params.oldQuantity,
        params.oldPricePerUnit,
        params.oldInvestmentAction,
        params.oldAmount,
        undefined,
        true // Reverse
      );
    }

    // Apply new holding
    if (
      params.newAssetSymbol &&
      params.newAccountId &&
      params.newCategoryId &&
      params.newQuantity &&
      params.newPricePerUnit &&
      params.newInvestmentAction &&
      params.newAmount
    ) {
      await applyHoldingChange(
        params.newAssetSymbol,
        params.newAccountId,
        params.newCategoryId,
        params.newQuantity,
        params.newPricePerUnit,
        params.newInvestmentAction,
        params.newAmount,
        params.transactionId,
        false
      );
    }
  } else if (
    operation === "delete" &&
    params.oldAssetSymbol &&
    params.oldAccountId &&
    params.oldCategoryId &&
    params.oldQuantity &&
    params.oldPricePerUnit &&
    params.oldInvestmentAction &&
    params.oldAmount
  ) {
    // Reverse the holding
    await applyHoldingChange(
      params.oldAssetSymbol,
      params.oldAccountId,
      params.oldCategoryId,
      params.oldQuantity,
      params.oldPricePerUnit,
      params.oldInvestmentAction,
      params.oldAmount,
      undefined,
      true // Reverse
    );
  }
};

/**
 * Update recurring patterns
 * Handles: create (link or create pattern), update (unlink/relink), delete (unlink and update pattern)
 */
export const updateRecurringPatterns = async (
  dbOrTx: PostgresJsDatabase<typeof schema>,
  operation: "create" | "update" | "delete",
  params: {
    userId: string;
    transactionId: string;
    // Old transaction data (for update/delete)
    oldRecurringPatternId?: string | null;
    oldIsRecurring?: boolean;
    oldTransactionDateTime?: Date;
    // New transaction data (for create/update)
    newIsRecurring?: boolean;
    newAccountId?: string;
    newCategoryId?: string;
    newCustomNameId?: string | null;
    newAmount?: string;
    newTransactionType?: "DEBIT" | "CREDIT";
    newDescription?: string | null;
    newLocation?: string | null;
    newPaymentMethod?: string | null;
    newFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
    newCustomFrequencyDays?: number | null;
    newTransactionDateTime?: Date;
  }
): Promise<void> => {
  // Helper to link transaction to pattern
  const linkToPattern = async (patternId: string) => {
    await dbOrTx
      .update(transactions)
      .set({ recurringPatternId: patternId, isRecurring: true })
      .where(eq(transactions.transactionId, params.transactionId));
  };

  // Helper to unlink transaction from pattern
  const unlinkFromPattern = async (
    patternId: string,
    transactionDateTime: Date
    // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex pattern unlinking logic with date calculations
  ) => {
    const linkedTransactions = await dbOrTx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.recurringPatternId, patternId),
          eq(transactions.userId, params.userId)
        )
      );

    if (linkedTransactions.length === 1) {
      // Delete pattern if this is the only transaction
      await dbOrTx
        .delete(recurringPatterns)
        .where(
          and(
            eq(recurringPatterns.patternId, patternId),
            eq(recurringPatterns.userId, params.userId)
          )
        );
    } else {
      // Update pattern dates and count
      const [pattern] = await dbOrTx
        .select()
        .from(recurringPatterns)
        .where(
          and(
            eq(recurringPatterns.patternId, patternId),
            eq(recurringPatterns.userId, params.userId)
          )
        )
        .limit(1);

      if (pattern) {
        const remainingTransactions = linkedTransactions
          .filter((t) => t.transactionId !== params.transactionId)
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
          generatedCount: Math.max(0, pattern.generatedCount - 1),
          updatedAt: new Date(),
        };

        const currentStartDate = new Date(pattern.startDate);
        const currentLastGenerated = pattern.lastGeneratedDate
          ? new Date(pattern.lastGeneratedDate)
          : null;

        if (
          transactionDateTime.getTime() === currentStartDate.getTime() &&
          remainingTransactions.length > 0
        ) {
          updateData.startDate = new Date(
            remainingTransactions[0].transactionDateTime
          );
        }

        if (
          currentLastGenerated &&
          transactionDateTime.getTime() === currentLastGenerated.getTime()
        ) {
          if (remainingTransactions.length > 0) {
            const newMostRecent = remainingTransactions.at(-1);
            if (newMostRecent) {
              updateData.lastGeneratedDate = new Date(
                newMostRecent.transactionDateTime
              );
              updateData.nextDueDate = calculateNextDueDate(
                updateData.startDate || currentStartDate,
                pattern.frequency,
                new Date(newMostRecent.transactionDateTime),
                pattern.customFrequencyDays || undefined
              );
            }
          } else {
            updateData.lastGeneratedDate = null;
          }
        }

        await dbOrTx
          .update(recurringPatterns)
          .set(updateData)
          .where(
            and(
              eq(recurringPatterns.patternId, patternId),
              eq(recurringPatterns.userId, params.userId)
            )
          );
      }
    }

    // Unlink transaction
    await dbOrTx
      .update(transactions)
      .set({ recurringPatternId: null, isRecurring: false })
      .where(eq(transactions.transactionId, params.transactionId));
  };

  // Helper to create or link to pattern
  // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex pattern creation with date calculations
  const createOrLinkPattern = async () => {
    if (
      !(
        params.newAccountId &&
        params.newCategoryId &&
        params.newAmount &&
        params.newTransactionType &&
        params.newFrequency &&
        params.newTransactionDateTime
      )
    ) {
      return;
    }

    // Check for existing pattern - customNameId is required for pattern matching
    const [existingPattern] = await dbOrTx
      .select()
      .from(recurringPatterns)
      .where(
        and(
          eq(recurringPatterns.userId, params.userId),
          eq(recurringPatterns.categoryId, params.newCategoryId),
          eq(recurringPatterns.customNameId, params.newCustomNameId || ""),
          eq(recurringPatterns.isActive, true)
        )
      )
      .limit(1);

    if (existingPattern) {
      // Link to existing pattern
      const currentCount = existingPattern.generatedCount;
      const currentStartDate = new Date(existingPattern.startDate);
      const currentLastGenerated = existingPattern.lastGeneratedDate
        ? new Date(existingPattern.lastGeneratedDate)
        : null;

      const updateData: {
        generatedCount: number;
        updatedAt: Date;
        startDate?: Date;
        lastGeneratedDate?: Date;
        nextDueDate?: Date;
      } = {
        generatedCount: currentCount + 1,
        updatedAt: new Date(),
      };

      if (params.newTransactionDateTime < currentStartDate) {
        updateData.startDate = params.newTransactionDateTime;
      }

      if (
        !currentLastGenerated ||
        params.newTransactionDateTime > currentLastGenerated
      ) {
        updateData.lastGeneratedDate = params.newTransactionDateTime;
        updateData.nextDueDate = calculateNextDueDate(
          currentStartDate,
          params.newFrequency,
          new Date(existingPattern.nextDueDate),
          existingPattern.customFrequencyDays || undefined
        );
      }

      await dbOrTx
        .update(recurringPatterns)
        .set(updateData)
        .where(eq(recurringPatterns.patternId, existingPattern.patternId));

      await linkToPattern(existingPattern.patternId);
    } else {
      // Create new pattern
      const nextDueDate = calculateNextDueDate(
        params.newTransactionDateTime,
        params.newFrequency,
        undefined,
        params.newCustomFrequencyDays || undefined
      );

      const [newPattern] = await dbOrTx
        .insert(recurringPatterns)
        .values({
          userId: params.userId,
          accountId: params.newAccountId,
          categoryId: params.newCategoryId,
          customNameId: params.newCustomNameId || null,
          amount: params.newAmount,
          transactionType: params.newTransactionType,
          description: params.newDescription || null,
          location: params.newLocation || null,
          paymentMethod: params.newPaymentMethod || null,
          frequency: params.newFrequency,
          customFrequencyDays: params.newCustomFrequencyDays || null,
          startDate: params.newTransactionDateTime,
          nextDueDate,
          lastGeneratedDate: params.newTransactionDateTime,
          generatedCount: 1,
          notes: null,
        })
        .returning();

      await linkToPattern(newPattern.patternId);
    }
  };

  if (operation === "create") {
    if (params.newIsRecurring) {
      await createOrLinkPattern();
    }
  } else if (operation === "update") {
    // Handle disabling recurring
    if (
      params.oldIsRecurring &&
      !params.newIsRecurring &&
      params.oldRecurringPatternId &&
      params.oldTransactionDateTime
    ) {
      await unlinkFromPattern(
        params.oldRecurringPatternId,
        params.oldTransactionDateTime
      );
    }

    // Handle enabling recurring
    if (!params.oldIsRecurring && params.newIsRecurring) {
      await createOrLinkPattern();
    }
  } else if (
    operation === "delete" &&
    params.oldRecurringPatternId &&
    params.oldTransactionDateTime
  ) {
    await unlinkFromPattern(
      params.oldRecurringPatternId,
      params.oldTransactionDateTime
    );
  }
};
