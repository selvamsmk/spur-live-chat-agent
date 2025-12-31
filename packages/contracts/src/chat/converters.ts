import type { ChatMessage, MessageDTO } from "./index.js";

/**
 * Convert MessageDTO (database format with "ai" role) to ChatMessage (AI SDK format with "assistant" role)
 * This handles the role mapping between internal and external formats
 */
export function convertMessageDTOToChatMessage(msg: MessageDTO): ChatMessage {
	return {
		id: msg.id,
		role: msg.role === "ai" ? "assistant" : msg.role,
		parts: [
			{
				type: "text" as const,
				text: msg.content,
			},
		],
	};
}

/**
 * Convert MessageDTO array to ChatMessage array
 */
export function convertMessageDTOsToChatMessages(
	messages: MessageDTO[]
): ChatMessage[] {
	return messages.map(convertMessageDTOToChatMessage);
}
