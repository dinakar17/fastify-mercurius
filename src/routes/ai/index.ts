import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import { convertToModelMessages, streamText } from "ai";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

// Temperature constants
const TEMP_CELSIUS = 22;
const TEMP_FAHRENHEIT = 72;
const HUMIDITY_PERCENT = 65;

// Define tools
const tools = {
  getCurrentWeather: {
    description: "Get the current weather in a given location",
    inputSchema: z.object({
      location: z
        .string()
        .describe("The city and state, e.g. San Francisco, CA"),
      unit: z
        .enum(["celsius", "fahrenheit"])
        .optional()
        .describe("Temperature unit"),
    }),
    execute: (params: {
      location: string;
      unit?: "celsius" | "fahrenheit";
    }) => {
      // Mock implementation - replace with actual weather API
      const temp = params.unit === "celsius" ? TEMP_CELSIUS : TEMP_FAHRENHEIT;
      return {
        location: params.location,
        temperature: temp,
        unit: params.unit || "celsius",
        condition: "Sunny",
        humidity: HUMIDITY_PERCENT,
      };
    },
  },
  calculateExpression: {
    description: "Calculate a mathematical expression",
    inputSchema: z.object({
      expression: z
        .string()
        .describe("The mathematical expression to calculate, e.g. '2 + 2'"),
    }),
    execute: (params: { expression: string }) => {
      try {
        // Simple eval replacement - in production use a proper math parser
        const result = Function(
          `"use strict"; return (${params.expression})`
        )();
        return { expression: params.expression, result };
      } catch {
        return { expression: params.expression, error: "Invalid expression" };
      }
    },
  },
  getTime: {
    description: "Get the current date and time",
    inputSchema: z.object({
      timezone: z
        .string()
        .optional()
        .describe("Timezone, e.g. 'America/New_York'"),
    }),
    execute: (params: { timezone?: string }) => {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        timezone: params.timezone || "UTC",
        formatted: params.timezone
          ? now.toLocaleString("en-US", { timeZone: params.timezone })
          : now.toUTCString(),
      };
    },
  },
};

const aiRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.post<{
    Body: { messages: UIMessage[]; model?: string };
  }>("/stream", (request, reply) => {
    const { messages, model = "gpt-4o" } = request.body;

    console.log("AI Stream Request:", { messages, model });

    const result = streamText({
      model: openai(model),
      messages: convertToModelMessages(messages),
      tools,
    });

    // Mark the response as a v1 data stream
    reply.header("X-Vercel-AI-Data-Stream", "v1");
    reply.header("Content-Type", "text/plain; charset=utf-8");

    return reply.send(result.toUIMessageStreamResponse());
  });
};

export default aiRoute;
