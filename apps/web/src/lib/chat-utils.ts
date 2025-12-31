import type { RefObject } from "react";
import { toast } from "sonner";

export const MAX_MESSAGE_LENGTH = 1000;

/**
 * Validates and truncates a message to the maximum allowed length.
 * Shows a toast warning if the message was truncated.
 *
 * @param message - The message to validate
 * @returns The truncated message (if needed)
 */
export function validateAndTruncateMessage(message: string): string {
	if (message.length > MAX_MESSAGE_LENGTH) {
		toast.warning(
			`Message truncated to ${MAX_MESSAGE_LENGTH} characters`,
			{
				description: `Your message was ${message.length} characters long`,
			},
		);
		return message.slice(0, MAX_MESSAGE_LENGTH);
	}
	return message;
}

/**
 * Hides the typing indicator with a minimum display time to ensure
 * it's visible even for fast AI responses.
 *
 * @param setIsTyping - State setter to hide the typing indicator
 * @param typingStartTimeRef - Ref tracking when typing indicator was shown
 * @param minDisplayTime - Minimum time in ms to show indicator (default: 500ms)
 */
export function hideTypingIndicator(
	setIsTyping: (value: boolean) => void,
	typingStartTimeRef: RefObject<number | null>,
	minDisplayTime = 500,
): void {
	const elapsed = typingStartTimeRef.current
		? Date.now() - typingStartTimeRef.current
		: 0;
	const remainingTime = Math.max(0, minDisplayTime - elapsed);

	setTimeout(() => {
		setIsTyping(false);
		typingStartTimeRef.current = null;
	}, remainingTime);
}
