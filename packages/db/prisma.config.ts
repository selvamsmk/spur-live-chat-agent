import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Only load .env for local / non-production environments. Production should inject env vars.
if (process.env.NODE_ENV !== "production") {
	dotenv.config({
		path: "../../apps/server/.env",
	});
}

export default defineConfig({
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
		seed: `tsx ${path.join("prisma", "seed.ts")}`
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
