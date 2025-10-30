import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface GraphQLContext {
  app: FastifyInstance;
  request: FastifyRequest;
  reply: FastifyReply;
  user: any | null;
}