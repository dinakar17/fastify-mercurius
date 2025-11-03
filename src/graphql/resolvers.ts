import type { Resolvers } from "../generated/graphql";
import { mutations } from "./mutations/index";
import { queries } from "./queries/index";

export const resolvers: Resolvers = {
  Query: queries,
  Mutation: mutations,
};
