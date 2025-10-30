import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import type { FastifyPluginAsync } from "fastify";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

declare module "fastify" {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>;
  }
}

const drizzlePlugin: FastifyPluginAsync = async (fastify, options) => {
  const queryClient = postgres(process.env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(queryClient, { schema });

  // Test connection
  try {
    await queryClient`SELECT 1`;
    fastify.log.info("✅ Database connected successfully");
  } catch (error) {
    fastify.log.error({ error }, "❌ Database connection failed");
    throw error;
  }

  // Decorate Fastify instance
  fastify.decorate("db", db);

  // Close connection on shutdown
  fastify.addHook("onClose", async () => {
    await queryClient.end();
    fastify.log.info("Database connection closed");
  });
};

export default fp(drizzlePlugin, {
  name: "drizzle",
});
