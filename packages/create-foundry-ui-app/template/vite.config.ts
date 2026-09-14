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
          // Match on the PACKAGE, not the path: pnpm's store directories
          // embed peer names ("…foundry-web-ui@…_@ag-ui+client@…_@assistant-u…"),
          // so a substring match on the full path filed foundry-web-ui under
          // whichever peer name the rules met first, and "react" matched
          // half the store. The last node_modules segment is the package.
          const pkg = id.slice(id.lastIndexOf("node_modules/") + "node_modules/".length);
          if (pkg.startsWith("@assistant-ui/")) return "vendor-assistant-ui";
          if (pkg.startsWith("@ag-ui/")) return "vendor-ag-ui";
          if (pkg.startsWith("@azure/msal")) return "vendor-auth";
          if (
            pkg.startsWith("@iloveagents/foundry-web-ui/dist/workbench.js") ||
            pkg.startsWith("@iloveagents/foundry-web-ui/dist/workbench/")
          )
            return "foundry-workbench";
          if (pkg.startsWith("@iloveagents/foundry-web-ui/")) return "vendor-foundry-ui";
          if (pkg.startsWith("@iloveagents/foundry-web-shell/")) return "vendor-foundry-shell";
          if (pkg.startsWith("@iloveagents/foundry-agent/")) return "vendor-foundry-agent";
          // Voice is optional at runtime and heavy at build; its own chunk
          // keeps the main path light and the size gate honest.
          if (pkg.startsWith("@iloveagents/foundry-web-voice/")) return "vendor-foundry-voice";
          // Before the react rule: recharts drags react-smooth + the d3
          // sub-packages along, and "react-smooth" would land in
          // vendor-react and push it past the chunk-size gate.
          if (
            pkg.startsWith("recharts/") ||
            pkg.startsWith("victory-vendor/") ||
            pkg.startsWith("d3-") ||
            pkg.startsWith("react-smooth/") ||
            pkg.startsWith("decimal.js-light/")
          ) {
            return "vendor-charts";
          }
          if (
            pkg.startsWith("react/") ||
            pkg.startsWith("react-dom/") ||
            pkg.startsWith("scheduler/")
          ) {
            return "vendor-react";
          }
          if (pkg.startsWith("lucide-react/")) return "vendor-icons";
          if (
            pkg.startsWith("react-markdown/") ||
            pkg.startsWith("remark-") ||
            pkg.startsWith("micromark")
          ) {
            return "vendor-markdown";
          }
        },
      },
    },
  },
});
