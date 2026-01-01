import { env } from "@spur-live-chat-agent/env/web";

/**
 * Constructs the full API URL using VITE_SERVER_URL if available,
 * otherwise uses relative path (for local development with proxy).
 *
 * @param path - The API path (e.g., "/api/conversations")
 * @returns The full API URL
 */
export function getApiUrl(path: string): string {
    // Prefer an explicit VITE_SERVER_URL if provided (for dev or special deployments).
    // Otherwise use the current origin so the client calls the same host that served the app.
    const explicit = env.VITE_SERVER_URL;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const base = (explicit && explicit.trim() !== "") ? explicit : origin;
    const baseUrl = base ? base.replace(/\/$/, "") : "";
    const apiPath = path.startsWith("/") ? path : `/${path}`;

    return baseUrl ? `${baseUrl}${apiPath}` : apiPath;
}
