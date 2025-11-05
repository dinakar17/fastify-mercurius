import { and, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { MutationResolvers } from "@/generated/graphql";
import {
  categories,
  customTransactionNames,
  recurringPatterns,
} from "../../db/schema";

const DAYS_IN_WEEK = 7;

// Helper function to calculate next due date based on frequency
const calculateNextDueDate = (
  startDate: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
): Date => {
  const next = new Date(startDate);

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
      next.setMonth(next.getMonth() + 1);
      break;
    }
    case "YEARLY": {
      next.setFullYear(next.getFullYear() + 1);
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

export const recurringMutations: Pick<
  MutationResolvers,
  "manageRecurringPattern"
> = {
  manageRecurringPattern: async (
    _,
    { patternId, action, input, updateInput },
    { db, user }
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Single mutation handles all CRUD operations (create/update/delete/pause/resume) as requested
  ) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // CREATE action
    if (action === "create") {
      if (!input) {
        throw new GraphQLError("Input is required for create action", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Get category ID
      const categoryResult = await db
        .select({ categoryId: categories.categoryId })
        .from(categories)
        .where(eq(categories.categoryNumber, input.categoryNumber))
        .limit(1);

      if (!categoryResult[0]) {
        throw new GraphQLError("Category not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Get or create custom name
      let customNameId: string | null = null;
      if (input.customName) {
        const existingName = await db
          .select()
          .from(customTransactionNames)
          .where(
            and(
              eq(customTransactionNames.userId, user.id),
              eq(customTransactionNames.customName, input.customName)
            )
          )
          .limit(1);

        if (existingName[0]) {
          customNameId = existingName[0].customNameId;
        } else {
          const [newName] = await db
            .insert(customTransactionNames)
            .values({
              userId: user.id,
              categoryId: categoryResult[0].categoryId,
              customName: input.customName,
            })
            .returning();
          customNameId = newName.customNameId;
        }
      }

      const startDate = new Date(input.startDate);
      const nextDueDate = calculateNextDueDate(startDate, input.frequency);

      const [newPattern] = await db
        .insert(recurringPatterns)
        .values({
          userId: user.id,
          accountId: input.accountId,
          categoryId: categoryResult[0].categoryId,
          customNameId,
          amount: input.amount,
          transactionType: input.transactionType,
          description: input.description,
          location: input.location,
          paymentMethod: input.paymentMethod,
          frequency: input.frequency,
          startDate,
          endDate: input.endDate ? new Date(input.endDate) : null,
          nextDueDate,
          notes: input.notes,
        })
        .returning();

      return newPattern as never;
    }

    // Verify pattern exists for other actions
    if (!patternId) {
      throw new GraphQLError("Pattern ID required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const [existingPattern] = await db
      .select()
      .from(recurringPatterns)
      .where(
        and(
          eq(recurringPatterns.patternId, patternId),
          eq(recurringPatterns.userId, user.id)
        )
      )
      .limit(1);

    if (!existingPattern) {
      throw new GraphQLError("Pattern not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    // DELETE action
    if (action === "delete") {
      await db
        .delete(recurringPatterns)
        .where(eq(recurringPatterns.patternId, patternId));
      return null;
    }

    // PAUSE action
    if (action === "pause") {
      const [paused] = await db
        .update(recurringPatterns)
        .set({ isPaused: true, updatedAt: new Date() })
        .where(eq(recurringPatterns.patternId, patternId))
        .returning();
      return paused as never;
    }

    // RESUME action
    if (action === "resume") {
      const [resumed] = await db
        .update(recurringPatterns)
        .set({ isPaused: false, updatedAt: new Date() })
        .where(eq(recurringPatterns.patternId, patternId))
        .returning();
      return resumed as never;
    }

    // UPDATE action
    if (action === "update" && updateInput) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (updateInput.amount) {
        updateData.amount = updateInput.amount;
      }
      if (updateInput.description !== undefined) {
        updateData.description = updateInput.description;
      }
      if (updateInput.location !== undefined) {
        updateData.location = updateInput.location;
      }
      if (updateInput.paymentMethod !== undefined) {
        updateData.paymentMethod = updateInput.paymentMethod;
      }
      if (updateInput.transactionType) {
        updateData.transactionType = updateInput.transactionType;
      }
      if (updateInput.notes !== undefined) {
        updateData.notes = updateInput.notes;
      }
      if (updateInput.isActive !== undefined) {
        updateData.isActive = updateInput.isActive;
      }
      if (updateInput.isPaused !== undefined) {
        updateData.isPaused = updateInput.isPaused;
      }
      if (updateInput.startDate) {
        updateData.startDate = new Date(updateInput.startDate);
      }
      if (updateInput.endDate !== undefined) {
        updateData.endDate = updateInput.endDate
          ? new Date(updateInput.endDate)
          : null;
      }

      const [updated] = await db
        .update(recurringPatterns)
        .set(updateData)
        .where(eq(recurringPatterns.patternId, patternId))
        .returning();

      return updated as never;
    }

    throw new GraphQLError("Invalid action", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  },
};
