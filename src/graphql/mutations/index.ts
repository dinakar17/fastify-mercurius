import type { MutationResolvers } from "../../generated/graphql";
import { accountMutations } from "./accounts";
import { recurringMutations } from "./recurring";
import { transactionMutations } from "./transactions";

export const mutations: MutationResolvers = {
  ...accountMutations,
  ...transactionMutations,
  ...recurringMutations,
};
