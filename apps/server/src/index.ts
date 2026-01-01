import { env } from "@spur-live-chat-agent/env/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerApiRoutes } from "./api";
import { loadStoreFaqs } from "./faq-loader";
import fs from "fs";
import path from "path";

const app = new Hono();

/* ----------------------------- Global middleware ---------------------------- */

app.use(logger());

app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN || "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

/* -------------------------------- API routes -------------------------------- */

registerApiRoutes(app);

/* ----------------------------- Production setup ------------------------------ */

const IS_PROD =
  process.env.BUN_ENV === "production" ||
  process.env.NODE_ENV === "production";

if (IS_PROD) {
  const distDir = new URL("../../web/dist/", import.meta.url).pathname;

  /* ---------------------------- Static assets ---------------------------- */

  app.use("/assets/*", serveStatic({ root: distDir }));

  app.get(
    "/favicon.ico",
    serveStatic({ path: path.join(distDir, "favicon.ico") })
  );

  /* ----------------------------- SPA fallback ----------------------------- */

  const indexHtmlPath = path.join(distDir, "index.html");

  const serveIndex = async (c: any) => {
    try {
      const html = await fs.promises.readFile(indexHtmlPath, "utf8");
      return c.html(html);
    } catch (err) {
      console.error("Failed to serve index.html", err);
      return c.text("Internal Server Error", 500);
    }
  };

  // IMPORTANT:
  // - Let /api/* pass through
  // - Let /assets/* and files pass through
  // - Everything else → index.html (TanStack Router)
  app.get("*", async (c, next) => {
    const pathname = c.req.path;

    if (
      pathname.startsWith("/api") ||
      pathname.startsWith("/assets") ||
      pathname.includes(".")
    ) {
      return next();
    }

    return serveIndex(c);
  });
} else {
  /* ------------------------------ Dev fallback ------------------------------ */
  app.get("/", (c) => c.text("OK"));
}

/* ---------------------------- Startup sequence ------------------------------- */

// Load FAQs into memory before accepting traffic
await loadStoreFaqs();

/* ----------------------------- Start server ---------------------------------- */

const PORT = Number(process.env.PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(`Server running on http://0.0.0.0:${info.port}`);
  }
);
