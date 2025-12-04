import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { QueryResolvers } from "@/generated/graphql";
import type { MercuriusContext } from "@/types";
import { categories, recurringPatterns } from "../../db/schema";

const DEFAULT_PATTERN_LIMIT = 100;
const END_OF_MONTH_HOURS = 23;
const END_OF_MONTH_MINUTES = 59;
const END_OF_MONTH_SECONDS = 59;
const END_OF_MONTH_MILLISECONDS = 999;

// Helper to calculate status based on nextDueDate and lastGeneratedDate
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

export const recurringQueries: Pick<
  QueryResolvers,
  | "getMyRecurringPatterns"
  | "getMonthlyRecurringPatterns"
  | "getRecurringPattern"
> = {
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

    // Fetch all patterns
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

    // Calculate extensive summary for current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(
      currentYear,
      currentMonth,
      0,
      END_OF_MONTH_HOURS,
      END_OF_MONTH_MINUTES,
      END_OF_MONTH_SECONDS,
      END_OF_MONTH_MILLISECONDS
    );
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let paidAmount = 0;
    let overdueAmount = 0;
    let dueTodayAmount = 0;
    let upcomingAmount = 0;
    let totalAmount = 0;

    for (const pattern of result) {
      const nextDue = new Date(pattern.nextDueDate);
      const amount = Number.parseFloat(pattern.amount);

      // Only include patterns with nextDueDate in current month
      if (nextDue >= startOfMonth && nextDue <= endOfMonth) {
        totalAmount += amount;

        const patternStatus = calculateStatus(pattern);
        const nextDueDate = new Date(
          nextDue.getFullYear(),
          nextDue.getMonth(),
          nextDue.getDate()
        );
        const isDueToday =
          nextDueDate.getFullYear() === today.getFullYear() &&
          nextDueDate.getMonth() === today.getMonth() &&
          nextDueDate.getDate() === today.getDate();

        if (patternStatus === "PAID") {
          paidAmount += amount;
        } else if (patternStatus === "OVERDUE") {
          overdueAmount += amount;
        } else if (isDueToday) {
          dueTodayAmount += amount;
        } else {
          upcomingAmount += amount;
        }
      }
    }

    return {
      patterns: patterns as never,
      totalCount: patterns.length,
      summary: {
        paid: paidAmount.toFixed(2),
        overdue: overdueAmount.toFixed(2),
        dueToday: dueTodayAmount.toFixed(2),
        upcoming: upcomingAmount.toFixed(2),
        total: totalAmount.toFixed(2),
      },
    };
  },

  getRecurringPattern: async (_, { patternId }, { db, user }) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // Fetch the pattern
    const [pattern] = await db
      .select()
      .from(recurringPatterns)
      .where(
        and(
          eq(recurringPatterns.patternId, patternId),
          eq(recurringPatterns.userId, user.id)
        )
      )
      .limit(1);

    if (!pattern) {
      throw new GraphQLError("Recurring pattern not found or access denied", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    return formatRecurringPatternForGraphQL(pattern) as never;
  },

  getMonthlyRecurringPatterns: async (
    _,
    { year, month }: { year?: number; month?: number },
    { db, user }: MercuriusContext
  ) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // Default to current month if not provided
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    // Calculate month boundaries
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(
      targetYear,
      targetMonth,
      0,
      END_OF_MONTH_HOURS,
      END_OF_MONTH_MINUTES,
      END_OF_MONTH_SECONDS,
      END_OF_MONTH_MILLISECONDS
    );
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);

    // Fetch all active recurring patterns for the user
    const result = await db
      .select()
      .from(recurringPatterns)
      .where(
        and(
          eq(recurringPatterns.userId, user.id),
          eq(recurringPatterns.isActive, true)
        )
      )
      .orderBy(desc(recurringPatterns.nextDueDate));

    // Initialize counters
    let paidCount = 0;
    let overdueCount = 0;
    let dueTodayCount = 0;
    let upcomingCount = 0;

    // Collections for each category
    const paidPatterns: (typeof recurringPatterns.$inferSelect)[] = [];
    const overduePatterns: (typeof recurringPatterns.$inferSelect)[] = [];
    const dueTodayPatterns: (typeof recurringPatterns.$inferSelect)[] = [];
    const upcomingPatterns: (typeof recurringPatterns.$inferSelect)[] = [];

    // Categorize patterns based on new logic
    for (const pattern of result) {
      const nextDue = new Date(pattern.nextDueDate);
      nextDue.setHours(0, 0, 0, 0);

      const lastGenerated = pattern.lastGeneratedDate
        ? new Date(pattern.lastGeneratedDate)
        : null;

      const isDaily = pattern.frequency === "DAILY";

      // 1. Paid: lastGeneratedDate falls in the current month
      if (
        lastGenerated &&
        lastGenerated >= startOfMonth &&
        lastGenerated <= endOfMonth
      ) {
        paidCount += 1;
        paidPatterns.push(pattern);
        // For daily patterns, also include them in other categories if applicable
        if (!isDaily) {
          continue; // Skip to next pattern for non-daily
        }
      }

      // 2. Overdue: nextDueDate is less than today (regardless of month)
      if (nextDue < today) {
        overdueCount += 1;
        overduePatterns.push(pattern);
        if (!isDaily) {
          continue;
        }
      }

      // 3. Due Today: nextDueDate equals today
      if (nextDue.getTime() === today.getTime()) {
        dueTodayCount += 1;
        dueTodayPatterns.push(pattern);
        if (!isDaily) {
          continue;
        }
      }

      // 4. Upcoming: nextDueDate is in current month and greater than today
      if (nextDue > today && nextDue >= startOfMonth && nextDue <= endOfMonth) {
        upcomingCount += 1;
        upcomingPatterns.push(pattern);
      }
    }

    // Combine patterns to return (exclude paid patterns)
    const patternsToReturn = [
      ...overduePatterns,
      ...dueTodayPatterns,
      ...upcomingPatterns,
    ];

    // Format patterns for GraphQL
    const formattedPatterns = patternsToReturn.map(
      formatRecurringPatternForGraphQL
    );

    // Total count includes all categories
    const totalCount = paidCount + overdueCount + dueTodayCount + upcomingCount;

    return {
      patterns: formattedPatterns as never,
      summary: {
        paid: paidCount,
        overdue: overdueCount,
        dueToday: dueTodayCount,
        upcoming: upcomingCount,
        total: totalCount,
      },
    };
  },
};
