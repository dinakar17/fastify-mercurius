import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

const usersRoute: FastifyPluginAsync = async (fastify, options) => {
  // GET /api/users - Get all users
  fastify.get("/", async (request, reply) => {
    try {
      const allUsers = await fastify.db.query.users.findMany();
      return { success: true, data: allUsers };
    } catch (error: any) {
      reply.status(500);
      return { success: false, error: error.message };
    }
  });

  // GET /api/users/:id - Get user by ID
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      const user = await fastify.db.query.users.findFirst({
        where: eq(users.id, parseInt(request.params.id)),
        with: { posts: true },
      });

      if (!user) {
        reply.status(404);
        return { success: false, error: "User not found" };
      }

      return { success: true, data: user };
    } catch (error: any) {
      reply.status(500);
      return { success: false, error: error.message };
    }
  });

  // POST /api/users - Create user
  fastify.post<{
    Body: { email: string; name: string };
  }>("/", async (request, reply) => {
    try {
      const { email, name } = request.body;

      if (!email || !name) {
        reply.status(400);
        return {
          success: false,
          error: "Email and name are required",
        };
      }

      const [newUser] = await fastify.db
        .insert(users)
        .values({ email, name })
        .returning();

      reply.status(201);
      return { success: true, data: newUser };
    } catch (error: any) {
      if (error.code === "23505") {
        reply.status(409);
        return {
          success: false,
          error: "Email already exists",
        };
      }
      reply.status(500);
      return { success: false, error: error.message };
    }
  });
};

export default usersRoute;
