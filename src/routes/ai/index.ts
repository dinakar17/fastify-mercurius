import { anthropic } from "@ai-sdk/anthropic";
import type { UIMessage } from "ai";
import { convertToModelMessages, streamText } from "ai";
import type { FastifyPluginAsync } from "fastify";
import { CREATE_TRANSACTION_PROMPT } from "./prompts";
import { createTransactionTool } from "./tools";

const HTTP_UNAUTHORIZED = 401;

const aiRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.post<{
    Body: { messages: UIMessage[]; model?: string };
  }>("/stream", async (request, reply) => {
    const { messages, model = "gpt-4o" } = request.body;

    console.log("AI Stream Request:", { messages, model });

    // Get user from request
    const user = request.user;

    if (!user) {
      return reply.code(HTTP_UNAUTHORIZED).send({ error: "Not authenticated" });
    }

    // Create dynamic tools with database context
    const dynamicTools = {
      createTransaction: await createTransactionTool(
        fastify,
        user,
        request,
        reply
      ),
    };

    const result = streamText({
      model: anthropic("claude-sonnet-4-5-20250929"),
      system: CREATE_TRANSACTION_PROMPT,
      messages: convertToModelMessages(messages),
      tools: dynamicTools,
    });

    return reply.send(
      result.toUIMessageStreamResponse({
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "none",
        },
      })
    );
  });
};

export default aiRoute;
