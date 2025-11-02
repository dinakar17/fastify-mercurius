import type { Resolvers } from "../generated/graphql";
import { mutations } from "./mutations";
import { queries } from "./queries";

export const resolvers: Resolvers = {
  Query: queries,
  Mutation: mutations,
};
