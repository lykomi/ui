import { createRequire } from "node:module";
import { dirname } from "node:path";

// Reuse the UI package's React installation in standalone and meta workspaces.
const require = createRequire(new URL("../../packages/web-ui/package.json", import.meta.url));

export default {
  resolve: {
    alias: {
      react: dirname(require.resolve("react/package.json")),
      "react-dom": dirname(require.resolve("react-dom/package.json")),
    },
  },
  esbuild: { jsx: "automatic" },
};
