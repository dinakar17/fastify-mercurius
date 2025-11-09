import { and, eq, or } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { accounts } from "../../db/schema";
import { transactions } from "../../db/schema";
import type { MutationResolvers, Transaction } from "../../generated/graphql";
import { fetchLocationFromIP } from "../../lib/location";
import { formatTransactionForGraphQL } from "../queries/transactions";
import {
  getCategoryByNumber,
  updateAccountBalances,
  updateCustomName,
  updateInvestmentHoldings,
  updateRecurringPatterns,
  verifyAccountOwnership,
  verifyTransactionOwnership,
} from "./transaction-helpers";

export const transactionMutations: Pick<
  MutationResolvers,
  "createTransaction" | "updateTransaction" | "deleteTransaction"
> = {
  createTransaction: async (_, { input }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const location = await fetchLocationFromIP();

    // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex atomic transaction logic required for data integrity
    return await db.transaction(async (tx) => {
      // Verify account ownership
      await verifyAccountOwnership(tx, input.accountId, user.id);

      // Get category
      const category = await getCategoryByNumber(tx, input.categoryNumber);

      // Handle custom name
      const customNameId = await updateCustomName(tx, "create", {
        userId: user.id,
        customName: input.customName,
        categoryId: category.categoryId,
        assetSymbol: input.assetSymbol || null,
      });

      // Check if transfer and verify other account
      let otherAccount: typeof accounts.$inferSelect | undefined;
      if (input.isTransfer && input.otherAccountId) {
        otherAccount = await verifyAccountOwnership(
          tx,
          input.otherAccountId,
          user.id
        );
      }

      // Determine if investment transaction
      const isInvestmentTransaction =
        input.isInvestment ||
        (input.isTransfer && otherAccount?.accountGroup === "INVESTMENT");

      // Create main transaction
      const [transaction] = await tx
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
          isInvestment: isInvestmentTransaction,
          assetSymbol: input.assetSymbol,
          quantity: input.quantity,
          pricePerUnit: input.pricePerUnit,
          investmentAction: input.investmentAction,
          isTransfer: Boolean(input.isTransfer),
          isRecurring: Boolean(input.isRecurring),
          location,
          paymentMethod: input.paymentMethod,
        } as typeof transactions.$inferInsert)
        .returning();

      // Update account balance
      await updateAccountBalances(tx, "create", {
        newAccountId: input.accountId,
        newAmount: input.amount,
        newTransactionType: input.transactionType,
        newTransactionDateTime: new Date(input.transactionDateTime),
      });

      // Handle transfer paired transaction
      if (input.isTransfer && input.otherAccountId) {
        const pairedTransactionType =
          input.transactionType === "DEBIT" ? "CREDIT" : "DEBIT";

        const [pairedTransaction] = await tx
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
            location,
            paymentMethod: input.paymentMethod,
          })
          .returning();

        // Update paired account balance
        await updateAccountBalances(tx, "create", {
          newAccountId: input.otherAccountId,
          newAmount: input.amount,
          newTransactionType: pairedTransactionType,
          newTransactionDateTime: new Date(input.transactionDateTime),
        });

        // Link transactions
        await tx
          .update(transactions)
          .set({
            linkedTransactionId: pairedTransaction.transactionId,
            isTransfer: true,
          })
          .where(eq(transactions.transactionId, transaction.transactionId));
      }

      // Update investment holdings
      if (
        isInvestmentTransaction &&
        input.assetSymbol &&
        input.quantity &&
        input.pricePerUnit &&
        input.investmentAction
      ) {
        await updateInvestmentHoldings(tx, "create", {
          userId: user.id,
          newAccountId: input.accountId,
          newCategoryId: category.categoryId,
          newAssetSymbol: input.assetSymbol,
          newQuantity: input.quantity,
          newPricePerUnit: input.pricePerUnit,
          newInvestmentAction: input.investmentAction,
          newAmount: input.amount,
          transactionId: transaction.transactionId,
        });
      }

      // Handle recurring pattern
      if (input.isRecurring && input.recurringFrequency) {
        await updateRecurringPatterns(tx, "create", {
          userId: user.id,
          transactionId: transaction.transactionId,
          newIsRecurring: true,
          newAccountId: input.accountId,
          newCategoryId: category.categoryId,
          newCustomNameId: customNameId,
          newAmount: input.amount,
          newTransactionType: input.transactionType,
          newDescription: input.description,
          newLocation: location,
          newPaymentMethod: input.paymentMethod,
          newFrequency: input.recurringFrequency as
            | "DAILY"
            | "WEEKLY"
            | "MONTHLY"
            | "YEARLY"
            | "CUSTOM",
          newCustomFrequencyDays: input.customFrequencyDays,
          newTransactionDateTime: new Date(input.transactionDateTime),
        });
      }

      return formatTransactionForGraphQL(transaction) as unknown as Transaction;
    });
  },

  updateTransaction: async (_, { transactionId, input }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex atomic transaction logic required for data integrity
    return await db.transaction(async (tx) => {
      // Verify transaction ownership
      const existing = await verifyTransactionOwnership(
        tx,
        transactionId,
        user.id
      );

      // Build updates object
      const updates: Partial<typeof transactions.$inferInsert> & {
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      // Simple field updates
      if (input.description !== undefined && input.description !== null) {
        updates.description = input.description;
      }
      if (input.amount !== undefined && input.amount !== null) {
        updates.amount = input.amount;
      }
      if (
        input.transactionDateTime !== undefined &&
        input.transactionDateTime !== null
      ) {
        updates.transactionDateTime = new Date(input.transactionDateTime);
      }

      // Category update
      let newCategoryId = existing.categoryId;
      if (input.categoryNumber !== undefined && input.categoryNumber !== null) {
        const category = await getCategoryByNumber(tx, input.categoryNumber);
        updates.categoryId = category.categoryId;
        newCategoryId = category.categoryId;
      }

      // Custom name update
      if (input.customName !== undefined) {
        const customNameId = await updateCustomName(tx, "update", {
          userId: user.id,
          customName: input.customName,
          categoryId: newCategoryId,
          customLogoUrl: input.customNameLogoUrl,
          assetSymbol: input.assetSymbol || existing.assetSymbol || null,
          oldCustomNameId: existing.customNameId, // Pass old custom name ID for cleanup
        });
        updates.customNameId = customNameId;
      }

      // Investment field updates
      if (input.assetSymbol !== undefined && input.assetSymbol !== null) {
        updates.assetSymbol = input.assetSymbol;
      }
      if (input.quantity !== undefined && input.quantity !== null) {
        updates.quantity = input.quantity;
      }

      // Account ID update
      if (input.accountId !== undefined && input.accountId !== null) {
        await verifyAccountOwnership(tx, input.accountId, user.id);
        updates.accountId = input.accountId;
      }

      // Determine old and new values for updates
      const oldAccountId = existing.accountId;
      const newAccountId = input.accountId || existing.accountId;
      const oldAmount = existing.amount;
      const newAmount = input.amount || existing.amount;
      const oldTransactionDateTime = new Date(existing.transactionDateTime);
      const newTransactionDateTime = input.transactionDateTime
        ? new Date(input.transactionDateTime)
        : oldTransactionDateTime;

      // Update account balances if needed
      const needsBalanceUpdate =
        input.amount !== undefined ||
        input.transactionDateTime !== undefined ||
        input.accountId !== undefined ||
        input.transactionType !== undefined;

      if (needsBalanceUpdate) {
        await updateAccountBalances(tx, "update", {
          oldAccountId,
          oldAmount,
          oldTransactionDateTime,
          newAccountId,
          newAmount,
          newTransactionDateTime,
        });
      }

      // Update transfer linked transaction
      if (
        existing.isTransfer &&
        input.otherAccountId !== undefined &&
        input.otherAccountId !== null &&
        existing.linkedTransactionId
      ) {
        await verifyAccountOwnership(tx, input.otherAccountId, user.id);

        const [linkedTxn] = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.transactionId, existing.linkedTransactionId))
          .limit(1);

        if (linkedTxn) {
          // Update linked transaction balances
          await updateAccountBalances(tx, "update", {
            oldAccountId: linkedTxn.accountId,
            oldAmount: linkedTxn.amount,
            oldTransactionDateTime: new Date(linkedTxn.transactionDateTime),
            newAccountId: input.otherAccountId,
            newAmount,
            newTransactionDateTime,
          });

          // Update linked transaction record
          await tx
            .update(transactions)
            .set({
              accountId: input.otherAccountId,
              amount: newAmount,
              transactionDateTime: newTransactionDateTime,
              updatedAt: new Date(),
            })
            .where(
              eq(transactions.transactionId, existing.linkedTransactionId)
            );
        }
      }

      // Update investment holdings
      if (
        existing.isInvestment &&
        (input.quantity !== undefined || input.assetSymbol !== undefined)
      ) {
        await updateInvestmentHoldings(tx, "update", {
          userId: user.id,
          oldAccountId,
          oldCategoryId: existing.categoryId,
          oldAssetSymbol: existing.assetSymbol || undefined,
          oldQuantity: existing.quantity || undefined,
          oldPricePerUnit: existing.pricePerUnit || undefined,
          oldInvestmentAction: existing.investmentAction || undefined,
          oldAmount,
          newAccountId,
          newCategoryId,
          newAssetSymbol:
            input.assetSymbol || existing.assetSymbol || undefined,
          newQuantity: input.quantity || existing.quantity || undefined,
          newPricePerUnit: existing.pricePerUnit || undefined,
          newInvestmentAction: existing.investmentAction || undefined,
          newAmount,
          transactionId,
        });
      }

      // Update recurring patterns
      if (input.isRecurring !== undefined) {
        await updateRecurringPatterns(tx, "update", {
          userId: user.id,
          transactionId,
          oldRecurringPatternId: existing.recurringPatternId,
          oldIsRecurring: existing.isRecurring,
          oldTransactionDateTime,
          newIsRecurring: input.isRecurring ?? undefined,
          newAccountId,
          newCategoryId,
          newCustomNameId: updates.customNameId || existing.customNameId,
          newAmount,
          newDescription: updates.description || existing.description,
          newLocation: updates.location || existing.location,
          newPaymentMethod: updates.paymentMethod || existing.paymentMethod,
          newFrequency: input.recurringFrequency as
            | "DAILY"
            | "WEEKLY"
            | "MONTHLY"
            | "YEARLY"
            | "CUSTOM"
            | undefined,
          newCustomFrequencyDays: input.customFrequencyDays,
          newTransactionDateTime,
        });

        if (input.isRecurring) {
          updates.isRecurring = true;
        } else {
          updates.isRecurring = false;
          updates.recurringPatternId = null;
        }
      }

      // Apply all updates
      const [updatedTransaction] = await tx
        .update(transactions)
        .set(updates)
        .where(eq(transactions.transactionId, transactionId))
        .returning();

      return formatTransactionForGraphQL(
        updatedTransaction
      ) as unknown as Transaction;
    });
  },

  deleteTransaction: async (_, { transactionId }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // biome-ignore lint(complexity/noExcessiveCognitiveComplexity): Complex cleanup logic for transfers, investments, and recurring patterns
    return await db.transaction(async (tx) => {
      // Check if transaction exists
      const [transaction] = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.transactionId, transactionId),
            eq(transactions.userId, user.id)
          )
        )
        .limit(1);

      if (!transaction) {
        return { success: true, transactionId };
      }

      // Update custom name (delete or decrement usage)
      if (transaction.customNameId) {
        await updateCustomName(tx, "delete", {
          userId: user.id,
          customName: null,
          categoryId: transaction.categoryId,
          oldCustomNameId: transaction.customNameId,
        });
      }

      // Update account balances (reverse)
      await updateAccountBalances(tx, "delete", {
        oldAccountId: transaction.accountId,
        oldAmount: transaction.amount,
        oldTransactionType: transaction.transactionType,
      });

      // Update investment holdings (reverse)
      if (
        transaction.isInvestment &&
        transaction.assetSymbol &&
        transaction.quantity &&
        transaction.pricePerUnit &&
        transaction.investmentAction
      ) {
        await updateInvestmentHoldings(tx, "delete", {
          userId: user.id,
          oldAccountId: transaction.accountId,
          oldCategoryId: transaction.categoryId,
          oldAssetSymbol: transaction.assetSymbol,
          oldQuantity: transaction.quantity,
          oldPricePerUnit: transaction.pricePerUnit,
          oldInvestmentAction: transaction.investmentAction,
          oldAmount: transaction.amount,
        });
      }

      // Handle transfer deletion
      if (transaction.isTransfer && transaction.linkedTransactionId) {
        const [linkedTransaction] = await tx
          .select()
          .from(transactions)
          .where(
            eq(transactions.transactionId, transaction.linkedTransactionId)
          )
          .limit(1);

        if (linkedTransaction) {
          // Reverse linked transaction balance
          await updateAccountBalances(tx, "delete", {
            oldAccountId: linkedTransaction.accountId,
            oldAmount: linkedTransaction.amount,
            oldTransactionType: linkedTransaction.transactionType,
          });
        }

        // Delete both transactions
        await tx
          .delete(transactions)
          .where(
            or(
              eq(transactions.transactionId, transactionId),
              eq(transactions.transactionId, transaction.linkedTransactionId)
            )
          );
      } else {
        // Delete single transaction
        await tx
          .delete(transactions)
          .where(eq(transactions.transactionId, transactionId));
      }

      // Update recurring patterns
      if (transaction.isRecurring && transaction.recurringPatternId) {
        await updateRecurringPatterns(tx, "delete", {
          userId: user.id,
          transactionId,
          oldRecurringPatternId: transaction.recurringPatternId,
          oldTransactionDateTime: new Date(transaction.transactionDateTime),
        });
      }

      return { success: true, transactionId };
    });
  },
};
