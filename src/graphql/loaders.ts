import { inArray } from "drizzle-orm";
import type { MercuriusLoaders } from "mercurius";
import {
  accounts,
  categories,
  customTransactionNames,
  transactions,
} from "../db/schema";

export const loaders: MercuriusLoaders = {
  Account: {
    async transactions(queries, { app }) {
      const accountIds = queries.map(({ obj }) => obj.accountId);

      const allTransactions = await app.db.query.transactions.findMany({
        where: inArray(transactions.accountId, accountIds),
        orderBy: (table, { desc }) => [desc(table.transactionDateTime)],
      });

      const transactionsByAccountId = new Map<
        string,
        (typeof transactions.$inferSelect)[]
      >();
      for (const transaction of allTransactions) {
        if (!transactionsByAccountId.has(transaction.accountId)) {
          transactionsByAccountId.set(transaction.accountId, []);
        }
        const accountTransactions = transactionsByAccountId.get(
          transaction.accountId
        );
        if (accountTransactions) {
          accountTransactions.push(transaction);
        }
      }

      return accountIds.map((id) => transactionsByAccountId.get(id) ?? []);
    },
  },

  Transaction: {
    async account(queries, { app }) {
      const accountIds = queries.map(({ obj }) => obj.accountId);

      const allAccounts = await app.db.query.accounts.findMany({
        where: inArray(accounts.accountId, accountIds),
      });

      const accountsById = new Map(
        allAccounts.map((account) => [account.accountId, account])
      );

      return accountIds.map((id) => {
        const account = accountsById.get(id);
        if (!account) {
          throw new Error(`Account with ID ${id} not found`);
        }
        return account;
      });
    },

    async category(queries, { app }) {
      const categoryIds = queries
        .map(({ obj }) => obj.categoryId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (categoryIds.length === 0) {
        return queries.map(() => null);
      }

      const allCategories = await app.db.query.categories.findMany({
        where: inArray(categories.categoryId, categoryIds),
      });

      const categoriesById = new Map(
        allCategories.map((category) => [category.categoryId, category])
      );

      return queries.map(({ obj }) =>
        obj.categoryId ? (categoriesById.get(obj.categoryId) ?? null) : null
      );
    },

    async customName(queries, { app }) {
      const customNameIds = queries
        .map(({ obj }) => obj.customNameId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (customNameIds.length === 0) {
        return queries.map(() => null);
      }

      const allCustomNames = await app.db.query.customTransactionNames.findMany(
        {
          where: inArray(customTransactionNames.customNameId, customNameIds),
        }
      );

      const customNamesById = new Map(
        allCustomNames.map((customName) => [
          customName.customNameId,
          customName,
        ])
      );

      return queries.map(({ obj }) =>
        obj.customNameId
          ? (customNamesById.get(obj.customNameId) ?? null)
          : null
      );
    },

    async linkedTransaction(queries, { app }) {
      const linkedTransactionIds = queries
        .map(({ obj }) => obj.linkedTransactionId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (linkedTransactionIds.length === 0) {
        return queries.map(() => null);
      }

      const allLinkedTransactions = await app.db.query.transactions.findMany({
        where: inArray(transactions.transactionId, linkedTransactionIds),
      });

      const linkedTransactionsById = new Map(
        allLinkedTransactions.map((transaction) => [
          transaction.transactionId,
          transaction,
        ])
      );

      return queries.map(({ obj }) =>
        obj.linkedTransactionId
          ? (linkedTransactionsById.get(obj.linkedTransactionId) ?? null)
          : null
      );
    },
  },

  Category: {
    async transactions(queries, { app }) {
      const categoryIds = queries.map(({ obj }) => obj.categoryId);

      const allTransactions = await app.db.query.transactions.findMany({
        where: inArray(transactions.categoryId, categoryIds),
        orderBy: (table, { desc }) => [desc(table.transactionDateTime)],
      });

      const transactionsByCategoryId = new Map<
        string,
        (typeof transactions.$inferSelect)[]
      >();
      for (const transaction of allTransactions) {
        if (!transactionsByCategoryId.has(transaction.categoryId)) {
          transactionsByCategoryId.set(transaction.categoryId, []);
        }
        const categoryTransactions = transactionsByCategoryId.get(
          transaction.categoryId
        );
        if (categoryTransactions) {
          categoryTransactions.push(transaction);
        }
      }

      return categoryIds.map((id) => transactionsByCategoryId.get(id) ?? []);
    },
  },
};
