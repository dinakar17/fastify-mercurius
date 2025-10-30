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
          User: "../db/schema#DbUser",
          Post: "../db/schema#DbPost",
        },
        useIndexSignature: true,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
