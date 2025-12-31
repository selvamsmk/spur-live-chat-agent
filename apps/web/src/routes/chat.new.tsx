import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionId } from "@/lib/useSessionId";
import { hideTypingIndicator, validateAndTruncateMessage, MAX_MESSAGE_LENGTH } from "@/lib/chat-utils";
import { getApiUrl } from "@/lib/api-client";
import { ChatMessages } from "@/components/chat-messages";
import { toast } from "sonner";

import type { ConversationListResponse } from "@spur-live-chat-agent/contracts";

export const Route = createFileRoute("/chat/new")({
	component: NewChatComponent,
});

function NewChatComponent() {
	const navigate = useNavigate();
	const sessionId = useSessionId();
	const queryClient = useQueryClient();
	const [input, setInput] = useState("");
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [isTyping, setIsTyping] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const typingStartTimeRef = useRef<number | null>(null);

	// Auto-resize textarea
	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		if (inputRef.current) {
			inputRef.current.style.height = "auto";
			inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 96)}px`;
		}
	};

	const { messages, sendMessage, status, error, clearError, stop } = useChat({
		transport: new DefaultChatTransport({
			api: getApiUrl("/api/ai"),
			body: { sessionId },
		}),
		onFinish: ({ message, isError }) => {
			hideTypingIndicator(setIsTyping, typingStartTimeRef);
			if (!isError && message.role === "assistant" && !conversationId) {
				// After first message, fetch conversations to get the new conversationId
				fetch(getApiUrl(`/api/conversations?sessionId=${encodeURIComponent(sessionId)}`))
					.then((res) => res.json() as Promise<ConversationListResponse>)
					.then((convs) => {
						// Update TanStack Query cache so sidebar updates immediately
						queryClient.setQueryData(
							["conversations", sessionId],
							convs,
						);
						if (convs.length > 0) {
							const newConvId = convs[0].id;
							setConversationId(newConvId);
							navigate({ to: `/chat/${newConvId}` });
						}
					})
					.catch(console.error);
			}

			// Ensure the input is focused again after a response
			if (!isError && inputRef.current) {
				inputRef.current.focus();
			}
		},
		onError: (error) => {
			hideTypingIndicator(setIsTyping, typingStartTimeRef);
			toast.error("Failed to send message", {
				description: error.message || "Please try again",
			});
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		// Ensure we don't create a conversation without a valid sessionId
		if (!sessionId) return;
		if (!input.trim() || status !== "ready") return;

		if (error) clearError();

		// Validate and truncate message
		const truncatedMessage = validateAndTruncateMessage(input.trim());

		// If this is the first message, use it to generate conversationId
		if (!conversationId && messages.length === 0) {
			try {
				typingStartTimeRef.current = Date.now();
				setIsTyping(true);
				// Send message and wait for response to get conversationId
				await sendMessage(
					{ text: truncatedMessage },
					{
						body: {
							sessionId,
						},
					}
				);
				
				setInput("");
				// Reset textarea height
				if (inputRef.current) {
					inputRef.current.style.height = "auto";
				}
			} catch (err) {
				hideTypingIndicator(setIsTyping, typingStartTimeRef);
				const errorMessage = err instanceof Error ? err.message : "Unknown error";
				toast.error("Failed to send message", {
					description: errorMessage,
				});
				console.error("Error sending message:", err);
			}
		} else {
			typingStartTimeRef.current = Date.now();
			setIsTyping(true);
			await sendMessage({ text: truncatedMessage });
			setInput("");
			// Reset textarea height
			if (inputRef.current) {
				inputRef.current.style.height = "auto";
			}
		}
	};

	// Auto-scroll to the latest message whenever messages change
	useEffect(() => {
		if (status === "ready" && inputRef.current) {
			inputRef.current.focus();
		}
	}, [status]);

		return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold mb-2">
                                Start a conversation
                            </h1>
                            <p>
                                Type a message to begin chatting with the AI
                                assistant
                            </p>
                        </div>
                    </div>
                ) : (
                    <ChatMessages
                        messages={messages as any}
                        status={status}
                        hasError={!!error}
                        isTyping={isTyping}
                    />
                )}
            </div>
            <div className="border-t p-4">
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <div className="flex gap-2 items-end">
                        <textarea
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Type your message..."
                            ref={inputRef}
                            rows={1}
                            disabled={status !== "ready" || !sessionId}
                            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-700 disabled:opacity-50 resize-none overflow-y-auto"
                            style={{ maxHeight: "96px" }}
                            maxLength={MAX_MESSAGE_LENGTH}
                        />
                        {status === "streaming" || status === "submitted" ? (
                            <button
                                type="button"
                                onClick={stop}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shrink-0"
                            >
                                Stop
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={status !== "ready" || !input.trim() || !sessionId}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                            >
                                Send
                            </button>
                        )}
                    </div>
                    {input.length > 0 && (
                        <div className="text-xs text-right text-gray-500 dark:text-gray-400">
                            {input.length}/{MAX_MESSAGE_LENGTH} characters
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
