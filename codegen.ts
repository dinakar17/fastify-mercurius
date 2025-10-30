import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "./src/graphql/schema.graphql",
  generates: {
    "src/generated/graphql.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "../types#MercuriusContext",
        mappers: {
          DbAccount: "../db/schema#DbAccount",
          NewAccount: "../db/schema#InsertAccount",
          DbCategory: "../db/schema#DbCategory",
          NewCategory: "../db/schema#InsertCategory",
          DbCustomTransactionName: "../db/schema#DbCustomTransactionName",
          NewCustomTransactionName: "../db/schema#InsertCustomTransactionName",
          DbTransaction: "../db/schema#DbTransaction",
          NewTransaction: "../db/schema#InsertTransaction",
        },
        useIndexSignature: true,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
