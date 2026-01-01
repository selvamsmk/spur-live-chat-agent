import { env } from "@spur-live-chat-agent/env/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerApiRoutes } from "./api";
import { loadStoreFaqs } from "./faq-loader";
import fs from "fs";
import path from "path";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

registerApiRoutes(app);

const IS_PROD = process.env.BUN_ENV === "production" || process.env.NODE_ENV === "production";

if (IS_PROD) {
	const distDir = new URL("../../web/dist/", import.meta.url).pathname;

	// Serve static assets (Vite default puts assets under /assets)
	app.use("/assets/*", serveStatic({ root: distDir }));

	// Favicon
	app.get("/favicon.ico", serveStatic({ path: path.join(distDir, "favicon.ico") }));

	const indexHtmlPath = path.join(distDir, "index.html");

	const serveIndex = async (c: any) => {
		try {
			if (fs.existsSync(indexHtmlPath) && fs.statSync(indexHtmlPath).isFile()) {
				const content = await fs.promises.readFile(indexHtmlPath, "utf8");
				return c.html(content);
			}
			return c.text("Not found", 404);
		} catch (err) {
			return c.text(`Server error - ${err}`, 500);
		}
	};

	app.get("/", serveIndex);
	app.get("/*", serveIndex);
} else {
	// dev / non-prod behavior
	app.get("/", (c) => c.text("OK"));
}

// Load FAQs into memory before starting the server
await loadStoreFaqs();

const PORT = Number(process.env.PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(`Server is running on http://0.0.0.0:${info.port}`);
  }
);