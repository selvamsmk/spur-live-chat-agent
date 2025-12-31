import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useActionState } from "react";
import { useSessionId } from "@/lib/useSessionId";

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
				`/api/conversations/${params.conversationId}/messages`
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

	const {
		messages,
		sendMessage,
		status,
		error: chatError,
		clearError,
		stop,
	} = useChat({
		transport: new DefaultChatTransport({
			api: "/api/ai",
		}),
		messages: convertMessageDTOsToChatMessages(initialMessages),
		onFinish: ({ isError, isAbort }) => {
			if (isError) {
				console.error("Error during message streaming");
			}
			if (isAbort) {
				console.log("Message streaming was aborted");
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

			try {
				await sendMessage(
					{ text: value },
					{
						body: {
							conversationId,
							sessionId,
						},
					}
				);
				return null;
			} catch (err) {
				console.error("Error sending message:", err);
				return "Failed to send message";
			}
		},
		null as string | null,
	);

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message) => (
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
				))}
				{status === "submitted" && (
					<div className="flex justify-start">
						<div className="bg-gray-200 dark:bg-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white">
							Thinking...
						</div>
					</div>
				)}
				{actionError && (
					<div className="text-red-600 dark:text-red-400 text-sm">
						Something went wrong. Please try again.
					</div>
				)}
			</div>

			<div className="border-t p-4">
				<form action={submitAction} className="flex gap-2">
					<input
						type="text"
						name="message"
						placeholder="Type your message..."
						disabled={status !== "ready" || isPending}
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
							disabled={status !== "ready" || isPending}
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
