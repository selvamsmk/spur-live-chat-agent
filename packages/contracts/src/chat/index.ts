import { z } from "zod";
import { ISOTimestampSchema } from "../common/index.js";

/**
 * Conversation DTO - network representation of a conversation
 * Does NOT expose database internals (no Prisma models)
 */
export const ConversationDTOSchema = z.object({
	id: z.cuid(),
	createdAt: ISOTimestampSchema,
	firstMessage: z.string(),
});

export type ConversationDTO = z.infer<typeof ConversationDTOSchema>;

/**
 * Message role enumeration (matches Prisma schema)
 */
export enum MessageRole {
	User = "user",
	AI = "ai",
}

export const MessageRoleSchema = z.enum(["user", "ai"]);

/**
 * Message DTO - network representation of a message
 */
export const MessageDTOSchema = z.object({
	id: z.cuid(),
	conversationId: z.cuid(),
	role: MessageRoleSchema,
	content: z.string(),
	createdAt: ISOTimestampSchema,
});

export type MessageDTO = z.infer<typeof MessageDTOSchema>;

/**
 * Chat message part - used for streaming responses
 * Matches AI SDK message format
 */
export const ChatMessagePartSchema = z.object({
	type: z.literal("text"),
	text: z.string(),
});

export type ChatMessagePart = z.infer<typeof ChatMessagePartSchema>;

/**
 * Chat message - used in streaming responses
 */
export const ChatMessageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "system", "assistant"]),
	parts: z.array(ChatMessagePartSchema),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Request body for sending a message to the AI API
 */
export const SendMessageRequestSchema = z.object({
	messages: z.array(ChatMessageSchema),
	conversationId: z.string().cuid().optional(),
	sessionId: z.string().optional(),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

/**
 * Response from conversation list endpoint
 */
export const ConversationListResponseSchema = z.array(ConversationDTOSchema);

export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>;

/**
 * Response from conversation messages endpoint
 */
export const MessageListResponseSchema = z.array(MessageDTOSchema);

export type MessageListResponse = z.infer<typeof MessageListResponseSchema>;

/**
 * Finish event when a chat completion completes
 */
export interface ChatFinishEvent {
	text: string;
	finishReason?: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export * from "./converters.js";
