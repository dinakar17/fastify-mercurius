import { eq, inArray } from 'drizzle-orm';
import { users, posts } from '../db/schema';
import type { IResolvers } from 'mercurius';

// Extend Mercurius context type
declare module 'mercurius' {
  interface MercuriusContext {
    user: any | null;
  }
}

export const resolvers: IResolvers = {
  Query: {
    users: async (_, __, { app }) => {
      return await app.db.query.users.findMany();
    },

    user: async (_, { id }, { app }) => {
      return await app.db.query.users.findFirst({
        where: eq(users.id, parseInt(id)),
      });
    },

    posts: async (_, __, { app }) => {
      return await app.db.query.posts.findMany();
    },

    post: async (_, { id }, { app }) => {
      return await app.db.query.posts.findFirst({
        where: eq(posts.id, parseInt(id)),
      });
    },
  },

  Mutation: {
    createUser: async (_, { email, name }, { app, user, reply }) => {
      if (!user) {
        reply.code(401);
        throw new Error('Unauthorized');
      }

      const [newUser] = await app.db
        .insert(users)
        .values({ email, name })
        .returning();
      return newUser;
    },

    createPost: async (_, { title, content, userId }, { app, user, reply }) => {
      if (!user) {
        reply.code(401);
        throw new Error('Unauthorized');
      }

      const [newPost] = await app.db
        .insert(posts)
        .values({ title, content, userId: parseInt(userId) })
        .returning();
      return newPost;
    },
  },
};