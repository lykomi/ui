import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEB_PORT ?? 8010),
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.AGENT_PORT ?? 8020}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // The force engine and its d3 stack, in one chunk of their own.
          //
          // ORDER MATTERS: "react-force-graph-2d" and "react-kapsule" both
          // contain "react", so without this rule sitting above the
          // `id.includes("react")` one below, the whole engine lands in
          // vendor-react and loads on first paint.
          //
          // And note what is NOT here: `@iloveagents/foundry-web-graph` is
          // deliberately left unassigned. It lazy-imports its canvas module,
          // and naming the package in a manualChunk puts the importer and the
          // imported module in the SAME chunk — which collapses the boundary
          // and drags ~180 kB of engine into the initial load. Left alone,
          // Rollup keeps the split and the engine arrives only when the first
          // graph renders.
          if (
            id.includes("force-graph") ||
            id.includes("react-kapsule") ||
            id.includes("/d3-") ||
            id.includes("accessor-fn") ||
            id.includes("float-tooltip") ||
            id.includes("canvas-color-tracker") ||
            id.includes("bezier-js") ||
            id.includes("@tweenjs")
          ) {
            return "vendor-graph-engine";
          }
          if (id.includes("@assistant-ui")) return "vendor-assistant-ui";
          if (id.includes("@ag-ui")) return "vendor-ag-ui";
          if (id.includes("@azure/msal")) return "vendor-auth";
          if (id.includes("@iloveagents/foundry-web-ui")) return "vendor-foundry-ui";
          if (id.includes("@iloveagents/foundry-web-shell")) return "vendor-foundry-shell";
          if (id.includes("@iloveagents/foundry-agent")) return "vendor-foundry-agent";
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react-markdown") || id.includes("remark-") || id.includes("micromark")) {
            return "vendor-markdown";
          }
        },
      },
    },
  },
});
