import "dotenv/config";
import { readFileSync } from "node:fs";
import cors from "@fastify/cors";
import Fastify from "fastify";
import mercurius from "mercurius";
import { loaders } from "./graphql/loaders";
import { resolvers } from "./graphql/resolvers";
import drizzlePlugin from "./plugins/drizzle";
import supabasePlugin from "./plugins/supabase";
import usersRoute from "./routes/users";
import type { MercuriusContext } from "./types";

async function startServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      ...(process.env.NODE_ENV !== "production" && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      }),
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Register plugins
  await fastify.register(drizzlePlugin);
  await fastify.register(supabasePlugin);

  // Health check
  fastify.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }));

  // Register REST routes
  await fastify.register(usersRoute, { prefix: "/api/users" });

  // Read GraphQL schema
  const schema = readFileSync("./src/graphql/schema.graphql", "utf-8");

  // Register Mercurius (GraphQL)
  await fastify.register(mercurius, {
    schema,
    resolvers,
    loaders,
    graphiql: process.env.NODE_ENV !== "production",
    jit: 1, // Enable JIT compilation for performance
    context: async (request, reply): Promise<MercuriusContext> => ({
      db: fastify.db,
      user: request.user,
      request,
      reply,
      app: fastify,
      __currentQuery: "",
      pubsub: fastify.graphql.pubsub,
    }),
  });

  try {
    const port = Number.parseInt(process.env.PORT || "4000", 10);
    await fastify.listen({ port, host: "0.0.0.0" });

    fastify.log.info(`🚀 Server ready at http://localhost:${port}`);
    fastify.log.info(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
    fastify.log.info(`🔗 REST API: http://localhost:${port}/api/users`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}, closing server...`);
      await fastify.close();
      process.exit(0);
    });
  }
}

startServer();
