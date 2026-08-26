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
          if (id.includes("@assistant-ui")) return "vendor-assistant-ui";
          if (id.includes("@ag-ui")) return "vendor-ag-ui";
          if (id.includes("@azure/msal")) return "vendor-auth";
          if (id.includes("@iloveagents/foundry-web-ui")) return "vendor-foundry-ui";
          if (id.includes("@iloveagents/foundry-web-shell")) return "vendor-foundry-shell";
          if (id.includes("@iloveagents/foundry-agent")) return "vendor-foundry-agent";
          // Before the react rule: recharts drags react-smooth + the d3
          // sub-packages along, and "react-smooth" would land in
          // vendor-react and push it past the chunk-size gate.
          if (
            id.includes("recharts") ||
            id.includes("victory-vendor") ||
            id.includes("/d3-") ||
            id.includes("react-smooth") ||
            id.includes("decimal.js-light")
          ) {
            return "vendor-charts";
          }
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
