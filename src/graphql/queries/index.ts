import type { QueryResolvers } from "../../generated/graphql";
import { accountQueries } from "./accounts";
import { holdingsQueries } from "./holdings";
import { insightQueries } from "./insights";
import { recurringQueries } from "./recurring";
import { transactionQueries } from "./transactions";

export const queries: QueryResolvers = {
  ...accountQueries,
  ...transactionQueries,
  ...holdingsQueries,
  ...recurringQueries,
  ...insightQueries,
};
