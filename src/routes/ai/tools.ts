import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { GraphQLResolveInfo } from "graphql";
import { z } from "zod";
import { accounts, categories, customTransactionNames } from "../../db/schema";
import type {
  CreateTransactionInput,
  GetTotalsInput,
  TotalResult,
} from "../../generated/graphql";
import { transactionMutations } from "../../graphql/mutations/transactions";
import { insightQueries } from "../../graphql/queries/insights";
import type { SupabaseUser } from "../../types";

// Constants for default category numbers
const DEFAULT_INVESTMENT_CATEGORY = 101;
const DEFAULT_TRANSFER_CATEGORY = 50;
const DEFAULT_GENERAL_CATEGORY = 1;

// Helper function to get default account by group
const getDefaultAccountByGroup = async (
  fastify: FastifyInstance,
  userId: string,
  accountGroup: "PREPAID" | "POSTPAID" | "LOAN" | "INVESTMENT"
) => {
  const defaultAccount = await fastify.db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.accountGroup, accountGroup),
        eq(accounts.isDefault, true),
        eq(accounts.isActive, true)
      )
    )
    .limit(1);

  if (!defaultAccount[0]) {
    throw new Error(
      `No default ${accountGroup} account found. Please create one first.`
    );
  }

  return defaultAccount[0];
};

// Helper function to get user's custom transaction names
const getUserCustomNames = async (fastify: FastifyInstance, userId: string) => {
  const customNames = await fastify.db
    .select({
      customName: customTransactionNames.customName,
      assetSymbol: customTransactionNames.assetSymbol,
      usageCount: customTransactionNames.usageCount,
      categoryId: customTransactionNames.categoryId,
    })
    .from(customTransactionNames)
    .where(eq(customTransactionNames.userId, userId))
    .orderBy(customTransactionNames.usageCount);

  return customNames;
};

// Helper function to get categories by type
const getCategoriesByType = async (
  fastify: FastifyInstance,
  categoryType: "GENERAL" | "INVESTMENT"
) => {
  const cats = await fastify.db
    .select({
      categoryNumber: categories.categoryNumber,
      categoryName: categories.categoryName,
      investmentSector: categories.investmentSector,
    })
    .from(categories)
    .where(eq(categories.categoryType, categoryType))
    .orderBy(categories.displayOrder);

  return cats;
};

// Create the createTransaction tool
export const createTransactionTool = async (
  fastify: FastifyInstance,
  user: SupabaseUser,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Fetch context data for AI
  const [customNames, generalCategories, investmentCategories] =
    await Promise.all([
      getUserCustomNames(fastify, user.id),
      getCategoriesByType(fastify, "GENERAL"),
      getCategoriesByType(fastify, "INVESTMENT"),
    ]);

  return {
    description: `Create a financial transaction from natural language input. This tool handles:
- Normal debit transactions (e.g., "I paid 405 rs to zomato")
- Normal credit transactions (e.g., "I received 40 rs from my friend")
- Investment transactions (e.g., "I bought 2 kei shares at 3077 each")
- Transfer transactions (e.g., "I transferred 10k from my sbi to hdfc account")

The tool automatically:
- Defaults to today's date if no date is specified
- Selects the appropriate default account based on transaction type
- Determines transaction type (DEBIT/CREDIT) from context
- Identifies category from merchant/description
- Handles investment transactions with quantity and price
- Manages account transfers between user's accounts

AVAILABLE CATEGORIES:

General Categories (for normal expenses/income):
${generalCategories.map((cat) => `- ${cat.categoryNumber}: ${cat.categoryName}`).join("\n")}

Investment Categories (for stock/investment transactions):
${investmentCategories.map((cat) => `- ${cat.categoryNumber}: ${cat.categoryName}${cat.investmentSector ? ` (${cat.investmentSector})` : ""}`).join("\n")}

EXISTING CUSTOM NAMES (frequently used merchants/payees):
${customNames.length > 0 ? customNames.map((cn) => `- "${cn.customName}"${cn.assetSymbol ? ` (Stock: ${cn.assetSymbol})` : ""} [used ${cn.usageCount} times]`).join("\n") : "No custom names yet - you can create new ones"}

INSTRUCTIONS:
1. For customName: Choose from existing custom names above if the merchant matches, or create a new one
2. For assetSymbol (investments): Use the symbol from existing custom names if available, or create new
3. For categoryNumber: REQUIRED - Choose the most appropriate category number from the lists above based on transaction type`,
    inputSchema: z.object({
      customName: z
        .string()
        .describe(
          "The merchant/payee name. Choose from existing custom names listed above if there's a match, or provide a new name (e.g., 'Zomato', 'Friend', 'KEI' for stock symbol)"
        ),
      amount: z
        .string()
        .describe("Transaction amount as a string (e.g., '405', '10000')"),
      transactionType: z
        .enum(["DEBIT", "CREDIT"])
        .describe(
          "DEBIT for money going out (paid/bought), CREDIT for money coming in (received)"
        ),
      categoryNumber: z
        .number()
        .describe(
          "REQUIRED: Choose the category number from the available categories listed above. For normal transactions use general categories (1-99), for investments use investment categories (100+)"
        ),
      transactionDateTime: z
        .string()
        .optional()
        .describe(
          "ISO date string. If not specified, defaults to current date/time"
        ),
      description: z
        .string()
        .optional()
        .describe("Additional transaction description or notes"),

      // Investment specific fields
      isInvestment: z
        .boolean()
        .optional()
        .describe("True if this is a stock/investment transaction"),
      assetSymbol: z
        .string()
        .optional()
        .describe(
          "Stock symbol (e.g., 'KEI', 'RELIANCE'). Check existing custom names listed above for previously used symbols, or create a new one"
        ),
      quantity: z
        .string()
        .optional()
        .describe("Number of shares/units (e.g., '2', '10.5')"),
      pricePerUnit: z
        .string()
        .optional()
        .describe("Price per share/unit (e.g., '3077', '2500.50')"),
      investmentAction: z
        .enum(["BUY", "SELL", "DIVIDEND", "BONUS", "SPLIT"])
        .optional()
        .describe("Type of investment action"),

      // Transfer specific fields
      isTransfer: z
        .boolean()
        .optional()
        .describe("True if transferring between user's own accounts"),
      fromAccountName: z
        .string()
        .optional()
        .describe("Source account name for transfers (e.g., 'SBI', 'HDFC')"),
      toAccountName: z
        .string()
        .optional()
        .describe(
          "Destination account name for transfers (e.g., 'SBI', 'HDFC')"
        ),

      // Account specification (optional - will use defaults if not provided)
      accountName: z
        .string()
        .optional()
        .describe(
          "Specific account name if not using default (for non-transfer transactions)"
        ),
    }),
    execute: async (params: {
      customName: string;
      amount: string;
      transactionType: "DEBIT" | "CREDIT";
      categoryNumber?: number;
      transactionDateTime?: string;
      description?: string;
      isInvestment?: boolean;
      assetSymbol?: string;
      quantity?: string;
      pricePerUnit?: string;
      investmentAction?: "BUY" | "SELL" | "DIVIDEND" | "BONUS" | "SPLIT";
      isTransfer?: boolean;
      fromAccountName?: string;
      toAccountName?: string;
      accountName?: string;
    }) => {
      try {
        // Determine transaction date
        const transactionDateTime = params.transactionDateTime
          ? params.transactionDateTime
          : new Date().toISOString();

        // Determine the account ID to use
        let accountId: string;

        if (params.isTransfer && params.fromAccountName) {
          // For transfers, find the source account
          const [fromAccount] = await fastify.db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.userId, user.id),
                eq(accounts.accountName, params.fromAccountName),
                eq(accounts.isActive, true)
              )
            )
            .limit(1);

          if (!fromAccount) {
            return {
              success: false,
              error: `Source account '${params.fromAccountName}' not found`,
            };
          }

          accountId = fromAccount.accountId;
        } else if (params.isInvestment) {
          // For investments, use default INVESTMENT account
          const investmentAccount = await getDefaultAccountByGroup(
            fastify,
            user.id,
            "INVESTMENT"
          );
          accountId = investmentAccount.accountId;
        } else {
          // For normal transactions, use default PREPAID account
          const defaultAccount = await getDefaultAccountByGroup(
            fastify,
            user.id,
            "PREPAID"
          );
          accountId = defaultAccount.accountId;
        }

        // Determine default category number
        let defaultCategoryNumber = DEFAULT_GENERAL_CATEGORY;
        if (params.isInvestment) {
          defaultCategoryNumber = DEFAULT_INVESTMENT_CATEGORY;
        } else if (params.isTransfer) {
          defaultCategoryNumber = DEFAULT_TRANSFER_CATEGORY;
        }

        // Build the CreateTransactionInput
        const input: CreateTransactionInput = {
          accountId,
          categoryNumber: params.categoryNumber || defaultCategoryNumber,
          amount: params.amount,
          transactionType: params.transactionType,
          transactionDateTime,
          customName: params.customName,
          description: params.description,
          isInvestment: params.isInvestment,
          assetSymbol: params.assetSymbol,
          quantity: params.quantity,
          pricePerUnit: params.pricePerUnit,
          investmentAction: params.investmentAction,
          isTransfer: params.isTransfer,
        };

        // For transfers, find the other account
        if (params.isTransfer && params.toAccountName) {
          const [toAccount] = await fastify.db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.userId, user.id),
                eq(accounts.accountName, params.toAccountName),
                eq(accounts.isActive, true)
              )
            )
            .limit(1);

          if (!toAccount) {
            return {
              success: false,
              error: `Destination account '${params.toAccountName}' not found`,
            };
          }

          input.otherAccountId = toAccount.accountId;
        }

        // Call the createTransaction mutation resolver directly
        const createTransactionResolver =
          transactionMutations.createTransaction;
        if (typeof createTransactionResolver !== "function") {
          throw new Error("createTransaction resolver is not a function");
        }

        const transaction = await createTransactionResolver(
          {},
          { input },
          {
            db: fastify.db,
            user,
            request,
            reply,
            app: fastify,
            __currentQuery: "",
            pubsub: fastify.graphql.pubsub,
          },
          undefined as unknown as GraphQLResolveInfo
        );

        // Format success message
        let message: string;
        if (params.isInvestment) {
          message = `Created investment transaction: ${params.investmentAction} ${params.quantity} ${params.assetSymbol} at ₹${params.pricePerUnit} each`;
        } else if (params.isTransfer) {
          message = `Transferred ₹${params.amount} from ${params.fromAccountName} to ${params.toAccountName}`;
        } else {
          message = `Created ${params.transactionType.toLowerCase()} transaction: ₹${params.amount} ${params.transactionType === "DEBIT" ? "to" : "from"} ${params.customName}`;
        }

        return {
          success: true,
          transactionId: transaction.transactionId,
          message,
          amount: params.amount,
        };
      } catch (error) {
        console.error("Error creating transaction:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
  };
};

// Create the getFinancialInsights tool
export const getFinancialInsightsTool = async (
  fastify: FastifyInstance,
  user: SupabaseUser,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Fetch context data for AI
  const [userAccounts, generalCategories, investmentCategories] =
    await Promise.all([
      fastify.db
        .select({
          accountId: accounts.accountId,
          accountName: accounts.accountName,
          accountGroup: accounts.accountGroup,
          accountType: accounts.accountType,
        })
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.isActive, true))),
      getCategoriesByType(fastify, "GENERAL"),
      getCategoriesByType(fastify, "INVESTMENT"),
    ]);

  return {
    description: `Get financial insights and analyze spending/income patterns from transaction data. This tool answers questions like:
- "How much did I spend on food last month?"
- "What's my total income this year?"
- "Show me my spending by category in October"
- "How much did I spend on Zomato in the last 3 months?"
- "What's my monthly spending trend for the last 6 months?"
- "Compare my spending across different accounts"
- "How much did I invest in stocks this quarter?"

The tool supports:
- Flexible date ranges (days, weeks, months, years, custom periods)
- Filtering by transaction type (DEBIT/CREDIT), categories, accounts, merchants
- Grouping results by account, category, or merchant
- Time-based analysis (monthly trends, year-over-year comparisons)
- Investment vs regular spending analysis
- Recurring vs one-time transaction analysis

AVAILABLE USER ACCOUNTS:
${userAccounts.map((acc) => `- ${acc.accountName} (${acc.accountGroup} - ${acc.accountType}) [ID: ${acc.accountId}]`).join("\n")}

GENERAL CATEGORIES:
${generalCategories.map((cat) => `- ${cat.categoryNumber}: ${cat.categoryName}`).join("\n")}

INVESTMENT CATEGORIES:
${investmentCategories.map((cat) => `- ${cat.categoryNumber}: ${cat.categoryName}${cat.investmentSector ? ` (${cat.investmentSector})` : ""}`).join("\n")}

IMPORTANT:
1. Dates should be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
2. startDate and endDate are REQUIRED
3. Use groupBy to split results by dimension (ACCOUNT, CATEGORY, CUSTOM_NAME)
4. Use timeBucket: MONTH to see trends over time
5. Combine groupBy and timeBucket for multi-dimensional analysis
6. Use filters to narrow down specific transaction types or categories`,
    inputSchema: z.object({
      startDate: z
        .string()
        .describe(
          "Start date in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ). REQUIRED. Parse from user's natural language (e.g., 'last month', 'this year', 'October', '3 months ago')"
        ),
      endDate: z
        .string()
        .describe(
          "End date in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ). REQUIRED. Parse from user's natural language. Should be >= startDate"
        ),
      groupBy: z
        .enum(["NONE", "ACCOUNT", "CATEGORY", "CUSTOM_NAME"])
        .optional()
        .describe(
          "How to group results: NONE (single total), ACCOUNT (by accounts), CATEGORY (by categories), CUSTOM_NAME (by merchants/payees). Use when user asks for 'breakdown', 'by category', 'for each account', etc."
        ),
      timeBucket: z
        .enum(["NONE", "MONTH"])
        .optional()
        .describe(
          "How to bucket by time: NONE (entire period), MONTH (monthly buckets). Use MONTH for trends like 'monthly spending', 'spending over time', 'last 6 months trend'"
        ),
      transactionType: z
        .enum(["DEBIT", "CREDIT"])
        .optional()
        .describe(
          "Filter by transaction type: DEBIT (expenses/money out), CREDIT (income/money in). Use when user asks about 'spending', 'expenses', 'income', 'earnings'"
        ),
      accountIds: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by specific account IDs. Use when user mentions specific accounts by name. Match account names from the AVAILABLE USER ACCOUNTS list above"
        ),
      categoryNumber: z
        .number()
        .optional()
        .describe(
          "Filter by specific category number. Use when user asks about specific categories like 'food', 'transport', etc. Choose from categories listed above"
        ),
      isInvestment: z
        .boolean()
        .optional()
        .describe(
          "Filter investment transactions: true (only investments), false (exclude investments). Use when user asks about 'stocks', 'investments', 'trading'"
        ),
      isRecurring: z
        .boolean()
        .optional()
        .describe(
          "Filter recurring transactions: true (only recurring), false (exclude recurring). Use for questions about 'subscriptions', 'bills', 'regular payments'"
        ),
      limit: z
        .number()
        .optional()
        .describe(
          "Limit number of results when groupBy is used (ordered by total descending). Use for 'top 5 categories', 'biggest expenses', etc."
        ),
    }),
    execute: async (params: {
      startDate: string;
      endDate: string;
      groupBy?: "NONE" | "ACCOUNT" | "CATEGORY" | "CUSTOM_NAME";
      timeBucket?: "NONE" | "MONTH";
      transactionType?: "DEBIT" | "CREDIT";
      accountIds?: string[];
      categoryNumber?: number;
      isInvestment?: boolean;
      isRecurring?: boolean;
      limit?: number;
    }) => {
      try {
        // Validate dates
        const startDate = new Date(params.startDate);
        const endDate = new Date(params.endDate);

        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(endDate.getTime())
        ) {
          return {
            success: false,
            error:
              "Invalid date format. Please use ISO 8601 format (YYYY-MM-DD)",
          };
        }

        if (startDate > endDate) {
          return {
            success: false,
            error: "startDate must be before or equal to endDate",
          };
        }

        // Build the GetTotalsInput
        const input: GetTotalsInput = {
          startDate: params.startDate,
          endDate: params.endDate,
          groupBy: params.groupBy || "NONE",
          timeBucket: params.timeBucket || "NONE",
          filters: {},
        };

        // Add filters - ensure filters object exists
        if (input.filters) {
          if (params.transactionType) {
            input.filters.transactionType = params.transactionType;
          }

          if (params.accountIds && params.accountIds.length > 0) {
            input.filters.accountIds = params.accountIds;
          }

          if (params.categoryNumber !== undefined) {
            input.filters.categoryNumber = params.categoryNumber;
          }

          if (params.isInvestment !== undefined) {
            input.filters.isInvestment = params.isInvestment;
          }

          if (params.isRecurring !== undefined) {
            input.filters.isRecurring = params.isRecurring;
          }
        }

        if (params.limit !== undefined) {
          input.limit = params.limit;
        }

        // Call the getMyTotals query resolver directly
        const getMyTotalsResolver = insightQueries.getMyTotals;
        if (typeof getMyTotalsResolver !== "function") {
          throw new Error("getMyTotals resolver is not a function");
        }

        const results = await getMyTotalsResolver(
          {},
          { input },
          {
            db: fastify.db,
            user,
            request,
            reply,
            app: fastify,
            __currentQuery: "",
            pubsub: fastify.graphql.pubsub,
          },
          undefined as unknown as GraphQLResolveInfo
        );

        // Type assertion - the resolver returns the actual array
        const totals = results as TotalResult[];

        // Format the results into a user-friendly message
        if (!totals || totals.length === 0) {
          return {
            success: true,
            message: "No transactions found for the specified criteria",
            results: [],
            total: "0",
          };
        }

        // Calculate grand total
        const grandTotal = totals.reduce(
          (sum, r) => sum + Number.parseFloat(r.total || "0"),
          0
        );

        // Build a descriptive message
        let message = "";
        const resultCount = totals.length;

        if (
          params.timeBucket === "MONTH" &&
          params.groupBy &&
          params.groupBy !== "NONE"
        ) {
          message = `Found ${resultCount} data points across different ${params.groupBy.toLowerCase()}s and months. Total: ₹${grandTotal.toFixed(2)}`;
        } else if (params.timeBucket === "MONTH") {
          message = `Monthly breakdown with ${resultCount} months. Total: ₹${grandTotal.toFixed(2)}`;
        } else if (params.groupBy && params.groupBy !== "NONE") {
          message = `Breakdown by ${params.groupBy.toLowerCase()} (${resultCount} items). Total: ₹${grandTotal.toFixed(2)}`;
        } else {
          message = `Total for the period: ₹${grandTotal.toFixed(2)}`;
        }

        // Format results with readable metadata
        const formattedResults = totals.map((r) => {
          const formatted: Record<string, string | number | undefined> = {
            total: `₹${Number.parseFloat(r.total).toFixed(2)}`,
            startDate: r.startDate,
            endDate: r.endDate,
          };

          if (r.metadata) {
            if (r.metadata.month) {
              formatted.month = r.metadata.month;
            }
            if (r.metadata.account) {
              formatted.account = r.metadata.account.accountName;
              formatted.accountType = r.metadata.account.accountType;
            }
            if (r.metadata.category) {
              formatted.category = r.metadata.category.categoryName;
              formatted.categoryNumber = r.metadata.category.categoryNumber;
            }
            if (r.metadata.customName) {
              formatted.merchantName = r.metadata.customName.customName;
            }
          }

          return formatted;
        });

        return {
          success: true,
          message,
          results: formattedResults,
          total: `₹${grandTotal.toFixed(2)}`,
          count: resultCount,
          period: {
            startDate: params.startDate,
            endDate: params.endDate,
          },
          filters: {
            transactionType: params.transactionType,
            isInvestment: params.isInvestment,
            isRecurring: params.isRecurring,
            categoryNumber: params.categoryNumber,
          },
        };
      } catch (error) {
        console.error("Error getting financial insights:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
  };
};
