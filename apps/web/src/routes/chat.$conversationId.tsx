import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSessionId } from "@/lib/useSessionId";
import { hideTypingIndicator, validateAndTruncateMessage, MAX_MESSAGE_LENGTH } from "@/lib/chat-utils";
import { getApiUrl } from "@/lib/api-client";
import { ChatMessages } from "@/components/chat-messages";
import { toast } from "sonner";

import type { MessageListResponse } from "@spur-live-chat-agent/contracts";
import { convertMessageDTOsToChatMessages } from "@spur-live-chat-agent/contracts";

export const Route = createFileRoute("/chat/$conversationId")({
	component: ChatRoute,
});

function ChatRoute() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-full">
					<div className="text-gray-500">Loading conversation...</div>
				</div>
			}
		>
			<ChatComponent />
		</Suspense>
	);
}

function ChatComponent() {
	const params = Route.useParams();
	const { data: previousMessages = [] } = useSuspenseQuery({
		queryKey: ["messages", params.conversationId],
		queryFn: async () => {
			const response = await fetch(
				getApiUrl(`/api/conversations/${params.conversationId}/messages`)
			);
			if (!response.ok) throw new Error("Failed to load messages");
			return response.json() as Promise<MessageListResponse>;
		},
	});

	return (
		<ChatContent
			key={params.conversationId}
			conversationId={params.conversationId}
			initialMessages={previousMessages}
		/>
	);
}

function ChatContent({
	conversationId,
	initialMessages,
}: {
	conversationId: string;
	initialMessages: MessageListResponse;
}) {
	const sessionId = useSessionId();
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const [isTyping, setIsTyping] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const typingStartTimeRef = useRef<number | null>(null);

	const {
		messages,
		sendMessage,
		status,
		error: chatError,
		clearError,
		stop,
	} = useChat({
		transport: new DefaultChatTransport({
			api: getApiUrl("/api/ai"),
		}),
		messages: convertMessageDTOsToChatMessages(initialMessages),
		onFinish: ({ isError, isAbort }) => {
			hideTypingIndicator(setIsTyping, typingStartTimeRef);
			if (isError) {
				console.error("Error during message streaming");
			}
			if (isAbort) {
				console.log("Message streaming was aborted");
			}
			// Ensure the input is focused again after a response
			if (!isError && !isAbort && inputRef.current) {
				inputRef.current.focus();
			}
		},
	});

	const [actionError, submitAction, isPending] = useActionState(
		async (previousState: string | null, formData: FormData) => {
			const value = formData.get("message");
			if (typeof value !== "string" || !value.trim()) {
				return previousState;
			}

			if (chatError) clearError();

			// Validate and truncate message
			const truncatedMessage = validateAndTruncateMessage(value.trim());

			try {
				typingStartTimeRef.current = Date.now();
				setIsTyping(true);
				await sendMessage(
					{ text: truncatedMessage },
					{
						body: {
							conversationId,
							sessionId,
						},
					}
				);
				// Reset input and height
				setInputValue("");
				if (inputRef.current) {
					inputRef.current.style.height = "auto";
				}
				return null;
			} catch (err) {
				hideTypingIndicator(setIsTyping, typingStartTimeRef);
				const errorMessage = err instanceof Error ? err.message : "Unknown error";
				toast.error("Failed to send message", {
					description: errorMessage,
				});
				console.error("Error sending message:", err);
				return "Failed to send message";
			}
		},
		null as string | null,
	);

	// Keep the input focused, especially after an AI response finishes
	useEffect(() => {
		if (status === "ready" && inputRef.current) {
			inputRef.current.focus();
		}
	}, [status]);

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex-1 overflow-y-auto p-4">
				<ChatMessages
					messages={messages as any}
					status={status}
					hasError={!!actionError}
					isTyping={isTyping}
				/>
			</div>

			<div className="border-t p-4">
				<form action={submitAction} className="flex flex-col gap-2">
					<div className="flex gap-2 items-end">
						<textarea
							name="message"
							value={inputValue}
							onChange={(e) => {
								setInputValue(e.target.value);
								const textarea = e.currentTarget;
								textarea.style.height = "auto";
								textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
							}}
							placeholder="Type your message..."
							ref={inputRef}
							rows={1}
							disabled={status !== "ready" || isPending}
							className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-700 disabled:opacity-50 resize-none overflow-y-auto"
							style={{ maxHeight: "96px" }}
							maxLength={MAX_MESSAGE_LENGTH}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									const form = e.currentTarget.form;
									if (form) {
										form.requestSubmit();
									}
								}
							}}
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
								disabled={status !== "ready" || isPending}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
							>
								Send
							</button>
						)}
					</div>
					{inputValue.length > 0 && (
						<div className="text-xs text-right text-gray-500 dark:text-gray-400">
							{inputValue.length}/{MAX_MESSAGE_LENGTH} characters
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
