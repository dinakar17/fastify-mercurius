import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import mercurius from 'mercurius';
import drizzlePlugin from './plugins/drizzle';
import supabasePlugin from './plugins/supabase';
import usersRoutes from './routes/users';
import { schema } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { loaders } from './graphql/loaders';

async function startServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register plugins
  await fastify.register(cors);
  await fastify.register(drizzlePlugin);
  await fastify.register(supabasePlugin);

  // Health check
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  });

  // REST API routes
  await fastify.register(usersRoutes, { prefix: '/api/users' });

  // GraphQL with Mercurius
  await fastify.register(mercurius, {
    schema,
    resolvers,
    loaders,
    graphiql: process.env.NODE_ENV !== 'production',
    jit: 1, // Enable JIT compilation for performance
    context: (request, reply) => {
      return {
        app: fastify,
        user: request.user,
      };
    },
  });

  // Start server
  try {
    const port = parseInt(process.env.PORT || '4000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    fastify.log.info(`🚀 Server ready at http://localhost:${port}`);
    fastify.log.info(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
    fastify.log.info(`🔗 REST API: http://localhost:${port}/api/users`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

startServer();
