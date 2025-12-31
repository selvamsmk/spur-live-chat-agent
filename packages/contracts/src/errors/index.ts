import { z } from "zod";

/**
 * Standard API error response shape
 */
export const ApiErrorSchema = z.object({
	error: z.string(),
	code: z.string(),
	details: z.record(z.string(), z.string()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Error codes for standardized error handling
 */
export enum ErrorCode {
	// Client errors
	BAD_REQUEST = "BAD_REQUEST",
	UNAUTHORIZED = "UNAUTHORIZED",
	FORBIDDEN = "FORBIDDEN",
	NOT_FOUND = "NOT_FOUND",
	CONFLICT = "CONFLICT",
	VALIDATION_ERROR = "VALIDATION_ERROR",

	// Server errors
	INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

	// Domain-specific errors
	CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND",
	MESSAGE_NOT_FOUND = "MESSAGE_NOT_FOUND",
	AI_SERVICE_ERROR = "AI_SERVICE_ERROR",
}

/**
 * Helper to create standardized API errors
 */
export const createApiError = (
	code: ErrorCode,
	error?: string,
	details?: Record<string, string>
): ApiError => ({
	error: error || code,
	code,
	...(details && { details }),
});
