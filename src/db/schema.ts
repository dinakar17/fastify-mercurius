import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  foreignKey,
  index,
  integer,
  json,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";

// ===========================
// ENUMS
// ===========================

export const accountTypeEnum = pgEnum("account_type", [
  "SAVINGS_ACCOUNT",
  "CURRENT_ACCOUNT",
  "WALLET",
  "CASH",
  "CREDIT_CARD",
  "BNPL",
  "LOAN_LENT",
  "LOAN_BORROWED",
  "FIXED_DEPOSIT",
  "TRADING_DEMAT",
]);

export const accountGroupEnum = pgEnum("account_group", [
  "PREPAID",
  "POSTPAID",
  "LOAN",
  "INVESTMENT",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "DEBIT",
  "CREDIT",
]);

export const categoryTypeEnum = pgEnum("category_type", [
  "GENERAL",
  "INVESTMENT",
]);

export const investmentActionEnum = pgEnum("investment_action", [
  "BUY",
  "SELL",
  "DIVIDEND",
  "BONUS",
  "SPLIT",
]);

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "CUSTOM",
]);

// ===========================
// ACCOUNTS TABLE WITH RLS
// ===========================

export const accounts = pgTable(
  "accounts",
  {
    accountId: uuid("account_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(), // References auth.users(id)

    // Account Classification
    accountType: accountTypeEnum("account_type").notNull(),
    accountGroup: accountGroupEnum("account_group").notNull(),

    // Account Details
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accountNumber: varchar("account_number", { length: 4 }),
    institutionName: varchar("institution_name", { length: 255 }),

    // Balance Information
    currentBalance: decimal("current_balance", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    manualBalanceUpdatedAt: timestamp("manual_balance_updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    currency: varchar("currency", { length: 3 }).default("INR"),

    // Credit Card Specific+
    creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }),
    billingCycleDay: integer("billing_cycle_day"),

    // Loan Specific
    loanAmount: decimal("loan_amount", { precision: 15, scale: 2 }),
    interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
    loanStartDate: timestamp("loan_start_date", { withTimezone: true }),
    loanEndDate: timestamp("loan_end_date", { withTimezone: true }),

    // Metadata
    logoUrl: varchar("logo_url", { length: 500 }),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes
    index("accounts_user_active_idx").on(table.userId, table.isActive),
    index("accounts_type_idx").on(table.accountType),
    index("accounts_group_idx").on(table.accountGroup),
    index("accounts_user_default_idx").on(table.userId, table.isDefault),

    // Foreign key to Supabase auth.users
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "accounts_user_id_fkey",
    }).onDelete("cascade"),

    // RLS Policies
    pgPolicy("authenticated users can view own accounts", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can insert own accounts", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can update own accounts", {
      for: "update",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can delete own accounts", {
      for: "delete",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),
  ]
);

// ===========================
// CATEGORIES TABLE WITH RLS
// ===========================

export const categories = pgTable(
  "categories",
  {
    categoryId: uuid("category_id").defaultRandom().primaryKey(),
    categoryType: categoryTypeEnum("category_type").notNull(),
    categoryName: varchar("category_name", { length: 100 }).notNull().unique(),
    categoryNumber: integer("category_number").notNull().unique(),
    investmentSector: varchar("investment_sector", { length: 100 }),
    description: text("description"),
    defaultIconUrl: varchar("default_icon_url", { length: 500 }),
    // Todo: Remove this later
    displayOrder: integer("display_order"),
    isSystemCategory: boolean("is_system_category").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes
    index("categories_type_idx").on(table.categoryType),
    uniqueIndex("categories_name_idx").on(table.categoryName),
    uniqueIndex("categories_number_idx").on(table.categoryNumber),

    // RLS Policies - Categories are public (read-only for all authenticated users)
    pgPolicy("authenticated users can view categories", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // Only allow service role to modify categories (system-level)
    // You can remove these if you want users to create custom categories
    pgPolicy("service role can insert categories", {
      for: "insert",
      to: "service_role",
      withCheck: sql`true`,
    }),

    pgPolicy("service role can update categories", {
      for: "update",
      to: "service_role",
      using: sql`true`,
    }),

    pgPolicy("service role can delete categories", {
      for: "delete",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

// ===========================
// CUSTOM TRANSACTION NAMES TABLE WITH RLS
// ===========================

export const customTransactionNames = pgTable(
  "custom_transaction_names",
  {
    customNameId: uuid("custom_name_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.categoryId),

    customName: varchar("custom_name", { length: 255 }).notNull(),
    customLogoUrl: varchar("custom_logo_url", { length: 500 }),
    assetSymbol: varchar("asset_symbol", { length: 50 }), // For investment transactions

    usageCount: integer("usage_count").default(0).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes
    uniqueIndex("custom_names_user_name_idx").on(
      table.userId,
      table.customName
    ),
    index("custom_names_user_idx").on(table.userId),
    index("custom_names_category_idx").on(table.categoryId),

    // Foreign key to Supabase auth.users
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "custom_names_user_id_fkey",
    }).onDelete("cascade"),

    // RLS Policies
    pgPolicy("authenticated users can view own custom names", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can insert own custom names", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can update own custom names", {
      for: "update",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can delete own custom names", {
      for: "delete",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),
  ]
);

// ===========================
// INVESTMENT HOLDINGS TABLE WITH RLS
// ===========================

export const investmentHoldings = pgTable(
  "investment_holdings",
  {
    holdingId: uuid("holding_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.accountId, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.categoryId),

    // Asset Information (auto-assigned from transactions)
    assetSymbol: varchar("asset_symbol", { length: 50 }).notNull(),
    assetName: varchar("asset_name", { length: 255 }),

    // Current Holdings
    totalQuantity: decimal("total_quantity", { precision: 15, scale: 6 })
      .default("0")
      .notNull(),
    averageBuyPrice: decimal("average_buy_price", {
      precision: 15,
      scale: 4,
    }),
    totalInvestedAmount: decimal("total_invested_amount", {
      precision: 15,
      scale: 2,
    })
      .default("0")
      .notNull(),

    // Realized Gains (from sales)
    realizedGainLoss: decimal("realized_gain_loss", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Metadata
    currency: varchar("currency", { length: 3 }).default("INR"),
    // Todo: Delete this later. We get the investment_sector from the category id
    sector: varchar("sector", { length: 100 }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes
    uniqueIndex("holdings_user_account_asset_idx").on(
      table.userId,
      table.accountId,
      table.assetSymbol
    ),
    index("holdings_user_idx").on(table.userId),
    index("holdings_account_idx").on(table.accountId),
    index("holdings_asset_idx").on(table.assetSymbol),
    index("holdings_category_idx").on(table.categoryId),
    index("holdings_user_quantity_idx").on(
      table.userId,
      table.totalQuantity.desc()
    ),

    // Foreign key to Supabase auth.users
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "holdings_user_id_fkey",
    }).onDelete("cascade"),

    // RLS Policies
    pgPolicy("authenticated users can view own holdings", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can insert own holdings", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can update own holdings", {
      for: "update",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can delete own holdings", {
      for: "delete",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),
  ]
);

// ===========================
// RECURRING PATTERNS TABLE WITH RLS
// ===========================

export const recurringPatterns = pgTable(
  "recurring_patterns",
  {
    patternId: uuid("pattern_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.accountId, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.categoryId),
    customNameId: uuid("custom_name_id").references(
      () => customTransactionNames.customNameId
    ),

    // Template Data
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    transactionType: transactionTypeEnum("transaction_type").notNull(),
    description: text("description"),
    location: varchar("location", { length: 255 }),
    paymentMethod: varchar("payment_method", { length: 100 }),

    // Scheduling
    frequency: recurringFrequencyEnum("frequency").notNull(),
    customFrequencyDays: integer("custom_frequency_days"), // Only used when frequency = 'CUSTOM'
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }), // NULL = indefinite
    nextDueDate: timestamp("next_due_date", { withTimezone: true }).notNull(),
    lastGeneratedDate: timestamp("last_generated_date", { withTimezone: true }),

    // State Management
    isActive: boolean("is_active").default(true).notNull(),
    isPaused: boolean("is_paused").default(false).notNull(),

    // Tracking
    generatedCount: integer("generated_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),

    // Metadata
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes
    index("recurring_patterns_user_idx").on(table.userId),
    index("recurring_patterns_user_active_idx").on(
      table.userId,
      table.isActive
    ),
    index("recurring_patterns_next_due_idx").on(
      table.nextDueDate,
      table.isActive
    ),
    index("recurring_patterns_account_idx").on(table.accountId),
    index("recurring_patterns_category_idx").on(table.categoryId),

    // Foreign key to Supabase auth.users
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "recurring_patterns_user_id_fkey",
    }).onDelete("cascade"),

    // RLS Policies
    pgPolicy("authenticated users can view own recurring patterns", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can insert own recurring patterns", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can update own recurring patterns", {
      for: "update",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can delete own recurring patterns", {
      for: "delete",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),
  ]
);

// ===========================
// TRANSACTIONS TABLE WITH RLS
// ===========================

export const transactions = pgTable(
  "transactions",
  {
    transactionId: uuid("transaction_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.accountId, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.categoryId),

    // Transaction Classification
    transactionType: transactionTypeEnum("transaction_type").notNull(),

    // Amount Information
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("INR"),

    // Investment Specific Fields (NULL for non-investment transactions)
    isInvestment: boolean("is_investment").default(false).notNull(),
    assetSymbol: varchar("asset_symbol", { length: 50 }),
    quantity: decimal("quantity", { precision: 15, scale: 6 }),
    pricePerUnit: decimal("price_per_unit", { precision: 15, scale: 4 }),
    investmentAction: investmentActionEnum("investment_action"),
    feesCharges: decimal("fees_charges", { precision: 10, scale: 2 }),
    investmentHoldingId: uuid("investment_holding_id"), // Links to investment_holdings table

    // Date/Time
    transactionDateTime: timestamp("transaction_date_time", {
      withTimezone: true,
    }).notNull(),

    // Description & Metadata
    description: text("description"),
    customNameId: uuid("custom_name_id").references(
      () => customTransactionNames.customNameId
    ),
    location: varchar("location", { length: 255 }),
    paymentMethod: varchar("payment_method", { length: 100 }),

    // Recurring Pattern
    isRecurring: boolean("is_recurring").default(false).notNull(),
    recurringPatternId: uuid("recurring_pattern_id"), // Links to recurring_patterns table

    // Transfer Related
    isTransfer: boolean("is_transfer").default(false).notNull(),
    linkedTransactionId: uuid("linked_transaction_id"),

    // Additional Fields
    attachments: json("attachments"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes
    index("transactions_user_date_idx").on(
      table.userId,
      table.transactionDateTime.desc()
    ),
    index("transactions_user_category_date_idx").on(
      table.userId,
      table.categoryId,
      table.transactionDateTime.desc()
    ),
    index("transactions_account_date_idx").on(
      table.accountId,
      table.transactionDateTime.desc()
    ),
    index("transactions_user_amount_idx").on(table.userId, table.amount),
    index("transactions_recurring_idx").on(table.isRecurring, table.userId),
    index("transactions_recurring_pattern_idx").on(
      table.recurringPatternId,
      table.userId
    ),
    index("transactions_investment_idx").on(
      table.isInvestment,
      table.userId,
      table.assetSymbol
    ),
    index("transactions_custom_name_idx").on(table.customNameId, table.userId),
    index("transactions_type_idx").on(table.transactionType, table.userId),
    // Index for linked transactions (optimizes transfer queries)
    index("transactions_linked_transaction_idx").on(table.linkedTransactionId),
    // Composite index for transfer + account lookups
    index("transactions_transfer_account_idx").on(
      table.isTransfer,
      table.accountId
    ),

    // Foreign key to Supabase auth.users
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "transactions_user_id_fkey",
    }).onDelete("cascade"),

    // Self-referencing foreign key for linked transactions
    foreignKey({
      columns: [table.linkedTransactionId],
      foreignColumns: [table.transactionId],
      name: "transactions_linked_transaction_fkey",
    }).onDelete("set null"),

    // Foreign key to recurring patterns
    foreignKey({
      columns: [table.recurringPatternId],
      foreignColumns: [recurringPatterns.patternId],
      name: "transactions_recurring_pattern_fkey",
    }).onDelete("set null"),

    // Foreign key to investment holdings
    foreignKey({
      columns: [table.investmentHoldingId],
      foreignColumns: [investmentHoldings.holdingId],
      name: "transactions_investment_holding_fkey",
    }).onDelete("set null"),

    // RLS Policies
    pgPolicy("authenticated users can view own transactions", {
      for: "select",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can insert own transactions", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can update own transactions", {
      for: "update",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
      withCheck: sql`(select auth.uid()) = user_id`,
    }),

    pgPolicy("authenticated users can delete own transactions", {
      for: "delete",
      to: authenticatedRole,
      using: sql`(select auth.uid()) = user_id`,
    }),
  ]
);

// ===========================
// RELATIONS
// ===========================

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  investmentHoldings: many(investmentHoldings),
  recurringPatterns: many(recurringPatterns),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  customNames: many(customTransactionNames),
  recurringPatterns: many(recurringPatterns),
}));

export const customTransactionNamesRelations = relations(
  customTransactionNames,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [customTransactionNames.categoryId],
      references: [categories.categoryId],
    }),
    transactions: many(transactions),
    recurringPatterns: many(recurringPatterns),
  })
);

export const recurringPatternsRelations = relations(
  recurringPatterns,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [recurringPatterns.accountId],
      references: [accounts.accountId],
    }),
    category: one(categories, {
      fields: [recurringPatterns.categoryId],
      references: [categories.categoryId],
    }),
    customName: one(customTransactionNames, {
      fields: [recurringPatterns.customNameId],
      references: [customTransactionNames.customNameId],
    }),
    generatedTransactions: many(transactions),
  })
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.accountId],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.categoryId],
  }),
  customName: one(customTransactionNames, {
    fields: [transactions.customNameId],
    references: [customTransactionNames.customNameId],
  }),
  linkedTransaction: one(transactions, {
    fields: [transactions.linkedTransactionId],
    references: [transactions.transactionId],
  }),
  recurringPattern: one(recurringPatterns, {
    fields: [transactions.recurringPatternId],
    references: [recurringPatterns.patternId],
  }),
}));

export const investmentHoldingsRelations = relations(
  investmentHoldings,
  ({ one }) => ({
    account: one(accounts, {
      fields: [investmentHoldings.accountId],
      references: [accounts.accountId],
    }),
    category: one(categories, {
      fields: [investmentHoldings.categoryId],
      references: [categories.categoryId],
    }),
  })
);

// ===========================
// TYPE EXPORTS (for TypeScript)
// ===========================

// Select Types (full records from DB)
export type DbAccount = typeof accounts.$inferSelect;
export type DbCategory = typeof categories.$inferSelect;
export type DbCustomTransactionName =
  typeof customTransactionNames.$inferSelect;
export type DbTransaction = typeof transactions.$inferSelect;
export type DbInvestmentHolding = typeof investmentHoldings.$inferSelect;
export type DbRecurringPattern = typeof recurringPatterns.$inferSelect;

// Insert Types (for creating new records)
export type InsertAccount = typeof accounts.$inferInsert;
export type InsertCategory = typeof categories.$inferInsert;
export type InsertCustomTransactionName =
  typeof customTransactionNames.$inferInsert;
export type InsertTransaction = typeof transactions.$inferInsert;
export type InsertInvestmentHolding = typeof investmentHoldings.$inferInsert;
export type InsertRecurringPattern = typeof recurringPatterns.$inferInsert;

// Enum Types
export type AccountType = (typeof accountTypeEnum.enumValues)[number];
export type AccountGroup = (typeof accountGroupEnum.enumValues)[number];
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type CategoryType = (typeof categoryTypeEnum.enumValues)[number];
export type InvestmentAction = (typeof investmentActionEnum.enumValues)[number];
export type RecurringFrequency =
  (typeof recurringFrequencyEnum.enumValues)[number];
