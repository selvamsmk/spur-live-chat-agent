import { useEffect, useRef } from "react";

// Minimal shape matching useChat UI messages used in the app
interface ChatMessagePart {
	type: string;
	text?: string;
}

interface ChatMessage {
	id: string;
	role: string;
	parts: ChatMessagePart[];
}

interface ChatMessagesProps {
	messages: ChatMessage[];
	status: string;
	hasError?: boolean;
}

export function ChatMessages({ messages, status, hasError }: ChatMessagesProps) {
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	// Auto-scroll to the latest message whenever messages change
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({
				behavior: "smooth",
				block: "end",
			});
		}
	}, [messages, status]);

	return (
		<div className="space-y-4">
			{messages.map((message) => (
				<div
					key={message.id}
					className={`flex ${
						message.role === "user" ? "justify-end" : "justify-start"
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
							) : null,
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
			{hasError && (
				<div className="text-red-600 dark:text-red-400 text-sm">
					Something went wrong. Please try again.
				</div>
			)}
			<div ref={messagesEndRef} />
		</div>
	);
}
