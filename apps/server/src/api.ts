import prisma from "@spur-live-chat-agent/db";
import { convertToModelMessages } from "ai";
import { Hono } from "hono";
import { generateReply, LLMError } from "./llm";
import {
  conversationListCacheKey,
  conversationMessagesCacheKey,
  deleteCached,
  getCached,
  getRedisClient,
  setCached,
} from "./redis";

// Initialize Redis client on module load
getRedisClient();

export function registerApiRoutes(app: Hono) {
  /* ----------------------------- AI Chat ----------------------------- */

  app.post("/api/ai", async (c) => {
    try {
      const body = await c.req.json();
      const uiMessages = body.messages || [];
      const conversationId = body.conversationId;
      const sessionId = body.sessionId;

      let currentConversationId = conversationId;

      if (currentConversationId) {
        const conversation = await prisma.conversation.findUnique({
          where: { id: currentConversationId },
        });

        if (!conversation) {
          return c.json({ error: "Conversation not found" }, 404);
        }
      } else {
        const newConversation = await prisma.conversation.create({
          data: { sessionId: sessionId || null },
        });

        currentConversationId = newConversation.id;
      }

      const userMessage = uiMessages[uiMessages.length - 1];

      if (userMessage?.role === "user") {
        const text =
          userMessage.parts?.find((p: any) => p.type === "text")?.text ??
          userMessage.content;

        if (text) {
          await prisma.message.create({
            data: {
              conversationId: currentConversationId,
              role: "user",
              content: text,
            },
          });
        }
      }

      const modelMessages = await convertToModelMessages(uiMessages);
      const result = await generateReply(modelMessages);

      result.onFinish(async (event) => {
        await prisma.message.create({
          data: {
            conversationId: currentConversationId,
            role: "ai",
            content: event.text,
          },
        });

        const invalidationKeys = [
          conversationMessagesCacheKey(currentConversationId),
        ];

        if (sessionId) {
          invalidationKeys.push(conversationListCacheKey(sessionId));
        }

        await deleteCached(...invalidationKeys);
      });

      const response = result.toUIMessageStreamResponse();
      response.headers.set("X-Conversation-Id", currentConversationId);

      return response;
    } catch (error) {
      console.error("POST /api/ai error:", error);

      if (error instanceof LLMError) {
        return c.json(
          { error: error.userMessage, code: error.code },
          error.code === "RATE_LIMIT" ? 429 : 500
        );
      }

      return c.json(
        { error: "We encountered an issue processing your request." },
        500
      );
    }
  });

  /* ------------------------ Conversation list ------------------------- */

  app.get("/api/conversations", async (c) => {
    try {
      const sessionId = c.req.query("sessionId");

      if (sessionId) {
        const cacheKey = conversationListCacheKey(sessionId);
        const cached = await getCached<any[]>(cacheKey);

        if (cached) {
          c.header("X-Cache", "HIT");
          return c.json(cached);
        }
      }

      const conversations = await prisma.conversation.findMany({
        where: sessionId ? { sessionId } : {},
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      });

      const result = conversations.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        firstMessage: c.messages[0]?.content.slice(0, 100) || "(no messages)",
      }));

      if (sessionId) {
        await setCached(conversationListCacheKey(sessionId), result, 90);
      }

      c.header("X-Cache", "MISS");
      return c.json(result);
    } catch (error) {
      console.error("GET /api/conversations error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /* --------------------- Conversation messages ------------------------ */

  app.get("/api/conversations/:id/messages", async (c) => {
    try {
      const id = c.req.param("id");
      const cacheKey = conversationMessagesCacheKey(id);

      const cached = await getCached<any[]>(cacheKey);
      if (cached) {
        c.header("X-Cache", "HIT");
        return c.json(cached);
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
      });

      if (!conversation) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "asc" },
      });

      await setCached(cacheKey, messages, 90);

      c.header("X-Cache", "MISS");
      return c.json(messages);
    } catch (error) {
      console.error(
        "GET /api/conversations/:id/messages error:",
        error
      );
      return c.json({ error: "Internal server error" }, 500);
    }
  });
}
