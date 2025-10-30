import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { MercuriusContext as BaseMercuriusContext } from "mercurius";
import type * as schema from "./db/schema";

// Re-export types from schema for convenience
export type {
  AccountGroup,
  AccountType,
  CategoryType,
  InvestmentAction,
  RecurringFrequency,
  TransactionType,
} from "./db/schema";

export type SupabaseUser = {
  id: string;
  email?: string;
  [key: string]: unknown;
};

export type MercuriusContext = BaseMercuriusContext & {
  db: PostgresJsDatabase<typeof schema>;
  user: SupabaseUser | null;
  request: FastifyRequest;
  reply: FastifyReply;
  pubsub: import("mercurius").PubSub;
};

// Enhanced transaction type that includes joined data from queries
export type TransactionWithDetails = {
  // Core transaction fields
  transactionId: string;
  accountId: string;
  amount: string;
  currency: string | null;
  transactionType: schema.TransactionType;
  transactionDateTime: Date;
  description: string | null;
  location: string | null;
  paymentMethod: string | null;
  attachments: Record<string, unknown> | null; // JSON field

  // Investment fields
  isInvestment: boolean;
  assetSymbol: string | null;
  quantity: string | null;
  pricePerUnit: string | null;
  investmentAction: schema.InvestmentAction | null;
  feesCharges: string | null;

  // Recurring fields
  isRecurring: boolean;
  recurringFrequency: schema.RecurringFrequency | null;
  recurringPatternName: string | null;

  // Transfer fields
  isTransfer: boolean;
  linkedTransactionId: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Account details (from join)
  accountName: string | null;
  accountNumber: string | null;
  accountLogoUrl: string | null;

  // Category details (from join)
  categoryId: string | null;
  categoryName: string | null;
  categoryNumber: number | null;
  categoryType: schema.CategoryType | null;
  investmentSector: string | null;
  categoryIconUrl: string | null;

  // Custom name details (from join)
  customNameId: string | null;
  customName: string | null;
  customLogoUrl: string | null;
};
