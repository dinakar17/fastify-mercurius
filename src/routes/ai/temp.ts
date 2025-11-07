import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import { convertToModelMessages, streamText } from "ai";
import type { FastifyPluginAsync } from "fastify";
import { COMBINED_ASSISTANT_PROMPT } from "./prompts";
import { createTransactionTool, getFinancialInsightsTool } from "./tools";

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
      getFinancialInsights: await getFinancialInsightsTool(
        fastify,
        user,
        request,
        reply
      ),
    };

    const result = streamText({
      model: openai(model),
      system: COMBINED_ASSISTANT_PROMPT,
      messages: convertToModelMessages(messages),
      tools: dynamicTools,
    });

    // Mark the response as a v1 data stream
    reply.header("X-Vercel-AI-Data-Stream", "v1");
    reply.header("Content-Type", "text/plain; charset=utf-8");

    return reply.send(result.toUIMessageStreamResponse());
  });
};

export default aiRoute;
