import { inArray } from 'drizzle-orm';
import { users, posts } from '../db/schema';
import type { MercuriusLoaders } from 'mercurius';

export const loaders: MercuriusLoaders = {
  User: {
    async posts(queries, { app }) {
      const userIds = queries.map(({ obj }) => obj.id);
      
      const allPosts = await app.db.query.posts.findMany({
        where: inArray(posts.userId, userIds),
      });

      const postsByUserId = new Map<number, any[]>();
      for (const post of allPosts) {
        if (!postsByUserId.has(post.userId)) {
          postsByUserId.set(post.userId, []);
        }
        postsByUserId.get(post.userId)!.push(post);
      }

      return userIds.map((id) => postsByUserId.get(id) || []);
    },
  },

  Post: {
    async author(queries, { app }) {
      const userIds = queries.map(({ obj }) => obj.userId);
      
      const allUsers = await app.db.query.users.findMany({
        where: inArray(users.id, userIds),
      });

      const usersById = new Map(allUsers.map((user) => [user.id, user]));
      return userIds.map((id) => usersById.get(id)!);
    },
  },
};