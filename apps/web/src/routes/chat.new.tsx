import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { useSessionId } from "@/lib/useSessionId";

import type { ConversationListResponse } from "@spur-live-chat-agent/contracts";

export const Route = createFileRoute("/chat/new")({
	component: NewChatComponent,
});

function NewChatComponent() {
	const navigate = useNavigate();
	const sessionId = useSessionId();
	const [input, setInput] = useState("");
	const [conversationId, setConversationId] = useState<string | null>(null);

	const { messages, sendMessage, status, error, clearError, stop } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/ai",
			body: { sessionId },
		}),
		onFinish: ({ message, isError }) => {
			if (!isError && message.role === "assistant" && !conversationId) {
				// After first message, fetch conversations to get the new conversationId
				fetch(`/api/conversations?sessionId=${encodeURIComponent(sessionId)}`)
					.then((res) => res.json() as Promise<ConversationListResponse>)
					.then((convs) => {
						if (convs.length > 0) {
							const newConvId = convs[0].id;
							setConversationId(newConvId);
							navigate({ to: `/chat/${newConvId}` });
						}
					})
					.catch(console.error);
			}
		},
		onError: () => {
			// Error is automatically set in the error state
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || status !== "ready") return;

		if (error) clearError();

		// If this is the first message, use it to generate conversationId
		if (!conversationId && messages.length === 0) {
			try {
				// Send message and wait for response to get conversationId
				await sendMessage(
					{ text: input },
					{
						body: {
							sessionId,
						},
					}
				);
				
				setInput("");
			} catch (err) {
				console.error("Error sending message:", err);
			}
		} else {
			await sendMessage({ text: input });
			setInput("");
		}
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
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
					messages.map((message) => (
						<div
							key={message.id}
							className={`flex ${
								message.role === "user"
									? "justify-end"
									: "justify-start"
							}`}
						>
							<div
								className={`max-w-xs lg:max-w-md rounded-lg px-4 py-2 ${
									message.role === "user"
										? "bg-blue-600 text-white"
										: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
								}`}
							>
								{message.parts.map((part, index) =>
									part.type === "text" ? (
										<span key={index}>{part.text}</span>
									) : null
								)}
							</div>
						</div>
					))
				)}
				{status === "submitted" && (
					<div className="flex justify-start">
						<div className="bg-gray-200 dark:bg-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white">
							Thinking...
						</div>
					</div>
				)}
				{error && (
					<div className="text-red-600 dark:text-red-400 text-sm">
						Something went wrong. Please try again.
					</div>
				)}
			</div>

			<div className="border-t p-4">
				<form onSubmit={handleSubmit} className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type your message..."
						disabled={status !== "ready"}
						className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-700 disabled:opacity-50"
					/>
					{status === "streaming" || status === "submitted" ? (
						<button
							type="button"
							onClick={stop}
							className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
						>
							Stop
						</button>
					) : (
						<button
							type="submit"
							disabled={status !== "ready" || !input.trim()}
							className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
						>
							Send
						</button>
					)}
				</form>
			</div>
		</div>
	);
}
