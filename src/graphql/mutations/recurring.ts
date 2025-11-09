import { and, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { MutationResolvers } from "@/generated/graphql";
import { recurringPatterns } from "../../db/schema";

export const recurringMutations: Pick<
  MutationResolvers,
  "manageRecurringPattern"
> = {
  manageRecurringPattern: async (
    _,
    { patternId, updateInput },
    { db, user }
  ) => {
    if (!user) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    if (!patternId) {
      throw new GraphQLError("Pattern ID required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    if (!updateInput) {
      throw new GraphQLError("Update input is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    // Verify pattern exists
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

    // Build update data
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
    if (updateInput.frequency) {
      updateData.frequency = updateInput.frequency;
    }
    if (updateInput.customFrequencyDays !== undefined) {
      updateData.customFrequencyDays = updateInput.customFrequencyDays;
    }
    if (updateInput.startDate) {
      updateData.startDate = new Date(updateInput.startDate);
    }
    if (updateInput.endDate !== undefined) {
      updateData.endDate = updateInput.endDate
        ? new Date(updateInput.endDate)
        : null;
    }
    if (updateInput.nextDueDate) {
      updateData.nextDueDate = new Date(updateInput.nextDueDate);
    }
    if (updateInput.lastGeneratedDate !== undefined) {
      updateData.lastGeneratedDate = updateInput.lastGeneratedDate
        ? new Date(updateInput.lastGeneratedDate)
        : null;
    }

    const [updated] = await db
      .update(recurringPatterns)
      .set(updateData)
      .where(eq(recurringPatterns.patternId, patternId))
      .returning();

    return updated as never;
  },
};
