import { z } from "zod";

/**
 * ISO 8601 timestamp validation
 */
export const ISOTimestampSchema = z.string().datetime();

export type ISOTimestamp = string;

/**
 * Mixin type for entities with timestamps
 */
export type WithTimestamps = {
	createdAt: ISOTimestamp;
	updatedAt?: ISOTimestamp;
};

export const WithTimestampsSchema = z.object({
	createdAt: ISOTimestampSchema,
	updatedAt: ISOTimestampSchema.optional(),
});
