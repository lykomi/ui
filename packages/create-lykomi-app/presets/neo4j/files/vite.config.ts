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
    manifest: true,
    rollupOptions: {
      output: {
        // Avoid pulling unrelated dependencies into a named chunk: that can
        // create evaluation cycles and break the production entry.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Match on the PACKAGE, not the path: pnpm's store directories
          // embed peer names ("…web-ui@…_@ag-ui+client@…_@assistant-u…"),
          // so a substring match on the full path filed web-ui under
          // whichever peer name the rules met first, and "react" matched
          // half the store. The last node_modules segment is the package.
          const pkg = id.slice(id.lastIndexOf("node_modules/") + "node_modules/".length);
          // Keep Mermaid's shared modules separate; grouping them back into
          // its entry exceeds the budget and collapses useful lazy boundaries.
          const mermaidShared = pkg.match(
            /^mermaid\/dist\/chunks\/mermaid\.core\/(chunk-[^/]+)\.mjs$/,
          );
          if (mermaidShared) return `vendor-mermaid-${mermaidShared[1]}`;
          // This upstream parser ships as one prebuilt module. It is loaded
          // only by Mermaid; the smoke test checks its separate lazy budget.
          if (pkg.startsWith("@mermaid-js/parser/")) return "vendor-mermaid-parser";
          // The force engine and its d3 stack, in one chunk of their own.
          // ORDER MATTERS: "react-force-graph-2d" and "react-kapsule" would
          // otherwise be caught by a react rule and load on first paint.
          // And note what is NOT here: `@lykomi/web-graph` is
          // deliberately left unassigned. It lazy-imports its canvas module,
          // and naming the package in a manualChunk puts the importer and the
          // imported module in the SAME chunk — which collapses the boundary
          // and drags ~180 kB of engine into the initial load.
          if (
            pkg.includes("force-graph") ||
            pkg.startsWith("react-kapsule/") ||
            pkg.startsWith("d3-") ||
            pkg.startsWith("accessor-fn/") ||
            pkg.startsWith("float-tooltip/") ||
            pkg.startsWith("canvas-color-tracker/") ||
            pkg.startsWith("bezier-js/") ||
            pkg.startsWith("@tweenjs/")
          ) {
            return "vendor-graph-engine";
          }
          // Same split as the default template: the framework-free runtime
          // apart from the React bindings keeps both under the chunk gate.
          if (/^@assistant-ui\/(core|store|tap)\//.test(pkg)) return "vendor-assistant-core";
          if (pkg.startsWith("@assistant-ui/")) return "vendor-assistant-ui";
          if (pkg.startsWith("@ag-ui/")) return "vendor-ag-ui";
          if (pkg.startsWith("@azure/msal")) return "vendor-auth";
          if (
            pkg.startsWith("@lykomi/web-ui/dist/workbench.js") ||
            pkg.startsWith("@lykomi/web-ui/dist/workbench/")
          )
            return "lykomi-workbench";
          if (pkg.startsWith("@lykomi/web-ui/")) return "vendor-lykomi-ui";
          if (pkg.startsWith("@lykomi/web-shell/")) return "vendor-foundry-shell";
          if (pkg.startsWith("@lykomi/agent/")) return "vendor-lykomi-agent";
          // Voice is optional at runtime and heavy at build; its own chunk
          // keeps the main path light and the size gate honest.
          if (pkg.startsWith("@lykomi/web-voice/")) return "vendor-foundry-voice";
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
