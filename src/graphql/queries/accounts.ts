import { and, desc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { accounts } from "../../db/schema";
import type { Account, QueryResolvers } from "../../generated/graphql";

export const accountQueries: Pick<
  QueryResolvers,
  "getMyAccounts" | "getAccount"
> = {
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
    } as unknown as Account;
  },
};
