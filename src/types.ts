import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { MercuriusContext as BaseMercuriusContext } from "mercurius";
import type { SupabaseClient } from "@supabase/supabase-js";
import type * as schema from "./db/schema";

export interface SupabaseUser {
  id: string;
  email?: string;
  [key: string]: any;
}

export interface MercuriusContext extends BaseMercuriusContext {
  db: PostgresJsDatabase<typeof schema>;
  user: SupabaseUser | null;
  request: FastifyRequest;
  reply: FastifyReply;
  pubsub: import("mercurius").PubSub;
}
