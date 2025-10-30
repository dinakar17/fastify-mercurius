import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { SupabaseUser } from "@/types";

declare module "fastify" {
  // biome-ignore lint: Module augmentation requires interfaces
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
  // biome-ignore lint: Module augmentation requires interfaces
  interface FastifyRequest {
    user: SupabaseUser | null;
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is required");
  }
  if (!supabaseAnonKey) {
    throw new Error("SUPABASE_ANON_KEY environment variable is required");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  fastify.decorate("supabase", supabase);

  // Authentication hook
  await fastify.addHook("onRequest", async (request) => {
    const token = request.headers.authorization?.replace("Bearer ", "");

    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        // Convert Supabase User to SupabaseUser type
        request.user = {
          id: data.user.id,
          email: data.user.email,
          ...data.user.user_metadata,
        } as SupabaseUser;
      } else {
        request.user = null;
      }
    } else {
      request.user = null;
    }
  });
};

export default fp(supabasePlugin, {
  name: "supabase",
});
