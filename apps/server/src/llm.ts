import { devToolsMiddleware } from "@ai-sdk/devtools";
import { openai } from "@ai-sdk/openai";
import type { ModelMessage } from "ai";
import { streamText, wrapLanguageModel } from "ai";
import { env } from "@spur-live-chat-agent/env/server";
import type { ChatFinishEvent } from "@spur-live-chat-agent/contracts";
import { getSystemPrompt } from "./prompts";

/**
 * Streaming chat result wrapper that hides AI SDK implementation details.
 * Only exposes the methods needed by the API layer.
 */
export interface StreamingChatResult {
	/**
	 * Register a callback for when streaming completes
	 */
	onFinish(callback: (event: ChatFinishEvent) => void | Promise<void>): void;

	/**
	 * Convert to a streaming HTTP response for the UI
	 */
	toUIMessageStreamResponse(): Response;
}

/**
 * Configuration for LLM cost control and safety
 */
const LLM_CONFIG = {
	// Model to use (gpt-4o-mini is cost-effective for support use cases)
	model: "gpt-4o-mini",
	// Maximum tokens in the response (prevents runaway costs)
	maxOutputTokens: 500,
	// Maximum conversation history messages to include (keeps context manageable)
	maxHistoryMessages: 20,
	// Request timeout in milliseconds
	timeoutMs: 30000,
} as const;

/**
 * Error types that can occur during LLM operations
 */
export class LLMError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly userMessage: string,
	) {
		super(message);
		this.name = "LLMError";
	}
}

/**
 * Convert conversation history to the format expected by the LLM.
 * Limits history to prevent excessive token usage.
 */
function prepareMessages(history: ModelMessage[]): ModelMessage[] {
	// Add system prompt as first message (includes FAQ knowledge base)
	const systemMessage: ModelMessage = {
		role: "system",
		content: getSystemPrompt(),
	};

	// Limit history to most recent messages for cost control
	const recentHistory =
		history.length > LLM_CONFIG.maxHistoryMessages
			? history.slice(-LLM_CONFIG.maxHistoryMessages)
			: history;

	return [systemMessage, ...recentHistory];
}

/**
 * Generate a reply from the LLM with proper error handling and guardrails.
 *
 * @param history - Array of conversation messages (user and assistant)
 * @returns Streaming chat result wrapper
 * @throws LLMError with user-friendly message on failure
 */
export async function generateReply(
	history: ModelMessage[],
): Promise<StreamingChatResult> {
	// Validate API key is configured
	if (!env.OPENAI_API_KEY) {
		throw new LLMError(
			"OpenAI API key not configured",
			"MISSING_API_KEY",
			"The chat service is not properly configured. Please contact support.",
		);
	}

	// Validate input
	if (!Array.isArray(history) || history.length === 0) {
		throw new LLMError(
			"Invalid conversation history",
			"INVALID_INPUT",
			"Unable to process your message. Please try again.",
		);
	}

	try {
		// Prepare messages with system prompt and history limit
		const messages = prepareMessages(history);

		// Wrap model with devtools middleware for debugging
		const model = wrapLanguageModel({
			model: openai(LLM_CONFIG.model),
			middleware: devToolsMiddleware(),
		});

		// Store callbacks to be invoked when streaming completes
		const finishCallbacks: Array<
			(event: ChatFinishEvent) => void | Promise<void>
		> = [];

		// Generate streaming response with configured limits
		const result = streamText({
			model,
			messages,
			maxOutputTokens: LLM_CONFIG.maxOutputTokens,
			abortSignal: AbortSignal.timeout(LLM_CONFIG.timeoutMs),
			onFinish: async (sdkEvent) => {
				// Map SDK event to domain DTO
				const wrappedEvent: ChatFinishEvent = {
					text: sdkEvent.text,
					finishReason: sdkEvent.finishReason,
					usage: sdkEvent.usage
						? {
								promptTokens: sdkEvent.usage.inputTokens ?? 0,
								completionTokens: sdkEvent.usage.outputTokens ?? 0,
								totalTokens: sdkEvent.usage.totalTokens ?? 0,
							}
						: undefined,
				};

				// Invoke all registered callbacks
				for (const callback of finishCallbacks) {
					await callback(wrappedEvent);
				}
			},
		});

		// Wrap the AI SDK result to hide internal types
		return {
			onFinish(callback: (event: ChatFinishEvent) => void | Promise<void>): void {
				finishCallbacks.push(callback);
			},
			toUIMessageStreamResponse(): Response {
				return result.toUIMessageStreamResponse();
			},
		};
	} catch (error: any) {
		// Handle specific error types with user-friendly messages
		if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
			throw new LLMError(
				"Request timeout",
				"TIMEOUT",
				"The response took too long. Please try again.",
			);
		}

		if (error.status === 401 || error.code === "invalid_api_key") {
			throw new LLMError(
				"Invalid API key",
				"AUTH_ERROR",
				"Authentication failed. Please contact support.",
			);
		}

		if (error.status === 429 || error.code === "rate_limit_exceeded") {
			throw new LLMError(
				"Rate limit exceeded",
				"RATE_LIMIT",
				"Our service is busy right now. Please try again in a moment.",
			);
		}

		if (error.status === 500 || error.status === 503) {
			throw new LLMError(
				"LLM provider error",
				"PROVIDER_ERROR",
				"Our AI service is temporarily unavailable. Please try again later.",
			);
		}

		// Generic error fallback
		console.error("[LLM] Unexpected error:", error);
		throw new LLMError(
			`Unexpected LLM error: ${error.message}`,
			"UNKNOWN_ERROR",
			"Something went wrong. Please try again or contact support if the issue persists.",
		);
	}
}

/**
 * Get current LLM configuration (for logging/debugging)
 */
export function getLLMConfig() {
	return {
		...LLM_CONFIG,
		systemPrompt: getSystemPrompt(),
	};
}
