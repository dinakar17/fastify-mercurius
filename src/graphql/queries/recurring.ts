import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { categories, recurringPatterns } from "@/db/schema";
import type { QueryResolvers } from "@/generated/graphql";

const DEFAULT_PATTERN_LIMIT = 100;

// Helper to calculate status based on nextDueDate and other fields
const calculateStatus = (
  pattern: typeof recurringPatterns.$inferSelect
): "UPCOMING" | "OVERDUE" | "PAID" => {
  const now = new Date();
  const nextDue = new Date(pattern.nextDueDate);

  // If lastGeneratedDate exists and is >= nextDueDate, it's PAID
  if (
    pattern.lastGeneratedDate &&
    new Date(pattern.lastGeneratedDate) >= nextDue
  ) {
    return "PAID";
  }

  // If nextDueDate has passed, it's OVERDUE
  if (nextDue < now) {
    return "OVERDUE";
  }

  // Otherwise it's UPCOMING
  return "UPCOMING";
};

// Helper function to format recurring pattern for GraphQL
const formatRecurringPatternForGraphQL = (
  pattern: typeof recurringPatterns.$inferSelect
) => ({
  patternId: pattern.patternId,
  accountId: pattern.accountId,
  categoryId: pattern.categoryId,
  customNameId: pattern.customNameId,
  amount: pattern.amount,
  transactionType: pattern.transactionType,
  description: pattern.description,
  location: pattern.location,
  paymentMethod: pattern.paymentMethod,
  frequency: pattern.frequency,
  startDate: pattern.startDate.toISOString(),
  endDate: pattern.endDate ? pattern.endDate.toISOString() : null,
  nextDueDate: pattern.nextDueDate.toISOString(),
  lastGeneratedDate: pattern.lastGeneratedDate
    ? pattern.lastGeneratedDate.toISOString()
    : null,
  isActive: pattern.isActive,
  isPaused: pattern.isPaused,
  generatedCount: pattern.generatedCount,
  skippedCount: pattern.skippedCount,
  notes: pattern.notes,
  createdAt: pattern.createdAt.toISOString(),
  updatedAt: pattern.updatedAt.toISOString(),
  status: calculateStatus(pattern),
});

export const recurringQueries: Pick<QueryResolvers, "getMyRecurringPatterns"> =
  {
    getMyRecurringPatterns: async (_, { input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const {
        status,
        accountId,
        categoryNumber,
        isActive,
        limit = 100,
      } = input ?? {};

      // Build base conditions
      const conditions: SQL[] = [eq(recurringPatterns.userId, user.id)];

      // Filter by account IDs if provided
      if (accountId && accountId.length > 0) {
        conditions.push(inArray(recurringPatterns.accountId, accountId));
      }

      // Filter by category number if provided
      if (categoryNumber !== undefined && categoryNumber !== null) {
        const categoryResult = await db
          .select({ categoryId: categories.categoryId })
          .from(categories)
          .where(eq(categories.categoryNumber, categoryNumber))
          .limit(1);

        if (categoryResult[0]) {
          conditions.push(
            eq(recurringPatterns.categoryId, categoryResult[0].categoryId)
          );
        }
      }

      // Filter by active status if provided
      if (isActive !== undefined && isActive !== null) {
        conditions.push(eq(recurringPatterns.isActive, isActive));
      }

      // Fetch all patterns (we'll filter by status in memory for now)
      const result = await db
        .select()
        .from(recurringPatterns)
        .where(and(...conditions))
        .orderBy(desc(recurringPatterns.nextDueDate))
        .limit(limit || DEFAULT_PATTERN_LIMIT);

      // Format patterns and calculate status
      let patterns = result.map(formatRecurringPatternForGraphQL);

      // Filter by status if provided
      if (status && status !== "ALL") {
        patterns = patterns.filter((p) => p.status === status);
      }

      return {
        patterns: patterns as never,
        totalCount: patterns.length,
      };
    },
  };
