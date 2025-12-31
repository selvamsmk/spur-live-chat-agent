import { devToolsMiddleware } from "@ai-sdk/devtools";
import { openai } from "@ai-sdk/openai";
import prisma from "@spur-live-chat-agent/db";
import { convertToModelMessages, streamText, wrapLanguageModel } from "ai";
import { Hono } from "hono";

export function registerApiRoutes(app: Hono) {
	app.post("/api/ai", async (c) => {
		try {
			const body = await c.req.json();
			const uiMessages = body.messages || [];
			const conversationId = body.conversationId;
			const sessionId = body.sessionId;

			let currentConversationId = conversationId;

			// Create or load conversation
			if (currentConversationId) {
				const conversation = await prisma.conversation.findUnique({
					where: { id: currentConversationId },
				});
				if (!conversation) {
					return c.json({ error: "Conversation not found" }, 404);
				}
			} else {
				// Create new conversation
				const newConversation = await prisma.conversation.create({
					data: {
						sessionId: sessionId || null,
					},
				});
				currentConversationId = newConversation.id;
			}

			// Save user message (assuming last message is the user message)
			const userMessage = uiMessages[uiMessages.length - 1];
			if (userMessage && userMessage.role === "user") {
				// Extract text from parts array (new AI SDK format)
				const textContent = userMessage.parts
					?.find((part: any) => part.type === "text")
					?.text || userMessage.content;

				if (textContent) {
					await prisma.message.create({
						data: {
							conversationId: currentConversationId,
							role: "user",
							content: textContent,
						},
					});
				}
			}

			// Stream AI response
			const model = wrapLanguageModel({
				model: openai("gpt-4.1-mini"),
				middleware: devToolsMiddleware(),
			});

			const result = streamText({
				model,
				messages: await convertToModelMessages(uiMessages),
				maxOutputTokens: 50,
				onFinish: async (event) => {
					// Save assistant message
					await prisma.message.create({
						data: {
							conversationId: currentConversationId,
							role: "ai",
							content: event.text,
						},
					});
				},
			});

			// Create the streaming response and add conversationId header
			const response = result.toUIMessageStreamResponse();
			response.headers.set("X-Conversation-Id", currentConversationId);
			return response;
		} catch (error) {
			console.error("Error in POST /api/ai:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	});

	app.get("/api/conversations", async (c) => {
		try {
			const sessionId = c.req.query("sessionId");

			const conversations = await prisma.conversation.findMany({
				where: sessionId ? { sessionId } : {},
				include: {
					messages: {
						orderBy: { createdAt: "asc" },
					},
				},
				orderBy: { createdAt: "desc" },
			});

			const result = conversations.map((conv) => ({
				id: conv.id,
				createdAt: conv.createdAt,
				firstMessage: conv.messages[0]?.content.slice(0, 100) || "(no messages)",
			}));

			return c.json(result);
		} catch (error) {
			console.error("Error in GET /api/conversations:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	});

	app.get("/api/conversations/:id/messages", async (c) => {
		try {
			const id = c.req.param("id");

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

			return c.json(messages);
		} catch (error) {
			console.error("Error in GET /api/conversations/:id/messages:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	});
}
