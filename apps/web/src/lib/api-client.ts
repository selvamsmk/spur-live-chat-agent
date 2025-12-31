import { env } from "@spur-live-chat-agent/env/web";

/**
 * Constructs the full API URL using VITE_SERVER_URL if available,
 * otherwise uses relative path (for local development with proxy).
 *
 * @param path - The API path (e.g., "/api/conversations")
 * @returns The full API URL
 */
export function getApiUrl(path: string): string {
	const serverUrl = env.VITE_SERVER_URL;
	
    // Remove trailing slash from server URL and leading slash from path if present
    const baseUrl = serverUrl.replace(/\/$/, "");
    const apiPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${apiPath}`;
}
