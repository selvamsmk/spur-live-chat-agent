import { useEffect, useState } from "react";

const SESSION_ID_KEY = "chat_session_id";

export function useSessionId(): string {
	const [sessionId, setSessionId] = useState<string>("");

	useEffect(() => {
		// Try to get existing session ID from localStorage
		let id = localStorage.getItem(SESSION_ID_KEY);

		// If no session ID exists, generate a new one
		if (!id) {
			id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
			localStorage.setItem(SESSION_ID_KEY, id);
		}

		setSessionId(id);
	}, []);

	return sessionId;
}
