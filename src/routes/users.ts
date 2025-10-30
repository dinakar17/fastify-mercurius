import type { FastifyPluginAsync } from "fastify";

// HTTP Status Codes
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const HTTP_CREATED = 201;

// Sample user data
const sampleUsers = [
  {
    id: 1,
    email: "alice@example.com",
    name: "Alice Johnson",
    createdAt: new Date("2024-01-15"),
  },
  {
    id: 2,
    email: "bob@example.com",
    name: "Bob Smith",
    createdAt: new Date("2024-02-20"),
  },
  {
    id: 3,
    email: "charlie@example.com",
    name: "Charlie Davis",
    createdAt: new Date("2024-03-10"),
  },
];

const usersRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/users - Get all users
  await fastify.get("/", () => ({ success: true, data: sampleUsers }));

  // GET /api/users/:id - Get user by ID
  await fastify.get<{ Params: { id: string } }>("/:id", (request, reply) => {
    const userId = Number.parseInt(request.params.id, 10);
    const user = sampleUsers.find((u) => u.id === userId);

    if (!user) {
      reply.status(HTTP_NOT_FOUND);
      return { success: false, error: "User not found" };
    }

    return { success: true, data: user };
  });

  // POST /api/users - Create user
  await fastify.post<{
    Body: { email: string; name: string };
  }>("/", (request, reply) => {
    const { email, name } = request.body;

    if (!(email && name)) {
      reply.status(HTTP_BAD_REQUEST);
      return {
        success: false,
        error: "Email and name are required",
      };
    }

    const newUser = {
      id: sampleUsers.length + 1,
      email,
      name,
      createdAt: new Date(),
    };

    sampleUsers.push(newUser);

    reply.status(HTTP_CREATED);
    return { success: true, data: newUser };
  });
};

export default usersRoute;
