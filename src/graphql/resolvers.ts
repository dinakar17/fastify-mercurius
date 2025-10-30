import { eq, inArray } from "drizzle-orm";
import { users, posts } from "../db/schema";
import type { Resolvers } from "../generated/graphql";
import { GraphQLError } from "graphql";

export const resolvers: Resolvers = {
  Query: {
    users: async (_, __, { db }) => {
      return await db.query.users.findMany();
    },

    user: async (_, { id }, { db }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, parseInt(id as string)),
      });

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return user;
    },

    posts: async (_, __, { db }) => {
      return await db.query.posts.findMany();
    },

    post: async (_, { id }, { db }) => {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, parseInt(id as string)),
      });

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return post;
    },

    me: async (_, __, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, user.email!),
      });

      if (!dbUser) {
        throw new GraphQLError("User profile not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return dbUser;
    },
  },

  Mutation: {
    createUser: async (_, { input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const [newUser] = await db
          .insert(users)
          .values({
            email: input.email,
            name: input.name,
          })
          .returning();

        return newUser;
      } catch (error: any) {
        if (error.code === "23505") {
          throw new GraphQLError("Email already exists", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        throw error;
      }
    },

    createPost: async (_, { input }, { db, user }) => {
      if (!user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const [newPost] = await db
        .insert(posts)
        .values({
          title: input.title,
          content: input.content,
          userId: parseInt(input.userId as string),
        })
        .returning();

      return newPost;
    },
  },
};
