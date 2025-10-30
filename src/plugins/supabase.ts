import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
  interface FastifyRequest {
    user: any | null;
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify, options) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  fastify.decorate('supabase', supabase);

  // Authentication hook
  fastify.addHook('onRequest', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        request.user = data.user;
      } else {
        request.user = null;
      }
    } else {
      request.user = null;
    }
  });
};

export default fp(supabasePlugin, {
  name: 'supabase',
});