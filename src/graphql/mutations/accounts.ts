import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { GraphQLError } from "graphql";
import type * as schema from "@/db/schema";
import { accounts } from "../../db/schema";
import type { Account, MutationResolvers } from "../../generated/graphql";

// Helper function to verify account ownership
export const verifyAccountOwnership = async (
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

export const accountMutations: Pick<
  MutationResolvers,
  "createAccount" | "updateAccount" | "deleteAccount"
> = {
  // Create a new account
  createAccount: async (_, { input }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // Check if this is the first account in this group for the user
    const existingAccountsInGroup = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, user.id),
          eq(accounts.accountGroup, input.accountGroup)
        )
      )
      .limit(1);

    const isFirstInGroup = existingAccountsInGroup.length === 0;

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
        isDefault: isFirstInGroup, // Set as default if first in group
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

    // Small helper: unset other defaults in same group
    const unsetOtherDefaults = async (
      group: (typeof accounts.$inferSelect)["accountGroup"]
    ) => {
      await db
        .update(accounts)
        .set({ isDefault: false })
        .where(
          and(
            eq(accounts.userId, user.id),
            eq(accounts.accountGroup, group),
            sql`${accounts.accountId} != ${accountId}`
          )
        );
    };

    // Small helper: get account group
    const getAccountGroup = async (): Promise<
      (typeof accounts.$inferSelect)["accountGroup"] | undefined
    > => {
      const existing = await db
        .select()
        .from(accounts)
        .where(eq(accounts.accountId, accountId))
        .limit(1);
      return existing[0]?.accountGroup;
    };

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

      // If setting this account as default, unset isDefault on other accounts
      // in the same accountGroup for this user (exclude this accountId).
      if (input.isDefault === true) {
        const targetGroup = await getAccountGroup();

        if (targetGroup) {
          await unsetOtherDefaults(targetGroup);
        }
      }
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
};
