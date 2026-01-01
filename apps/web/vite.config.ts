import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import flowbiteReact from "flowbite-react/plugin/vite";

export default defineConfig({
	plugins: [tailwindcss(), tanstackRouter({}), react(), flowbiteReact()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 3001,
		host: true,
		allowedHosts: ["web-production-86f7f.up.railway.app"],
	},
	preview: {
		port: 3001,
		allowedHosts: ["web-production-86f7f.up.railway.app"],
	},
	build: {
		rollupOptions: {
			output: {
				// Force single JS bundle
				manualChunks: () => "app",
				entryFileNames: "assets/app.js",
				chunkFileNames: "assets/app.js",
				assetFileNames: "assets/[name][extname]",
			},
		},
  	},
});