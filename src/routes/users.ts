import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import type { FastifyPluginAsync } from 'fastify';

const usersRoutes: FastifyPluginAsync = async (fastify, options) => {
  // GET /api/users - Get all users
  fastify.get('/', async (request, reply) => {
    try {
      const allUsers = await fastify.db.query.users.findMany();
      return { success: true, data: allUsers };
    } catch (error: any) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // GET /api/users/:id - Get user by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, parseInt(request.params.id)),
        with: { posts: true },
      });

      if (!user) {
        reply.code(404);
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: user };
    } catch (error: any) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // POST /api/users - Create user
  fastify.post<{
    Body: { email: string; name: string };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { email, name } = request.body;

        const [newUser] = await fastify.db
          .insert(users)
          .values({ email, name })
          .returning();

        reply.code(201);
        return { success: true, data: newUser };
      } catch (error: any) {
        reply.code(500);
        return { success: false, error: error.message };
      }
    }
  );
};

export default usersRoutes;