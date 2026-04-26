import "./index.css";
import { bootstrapShell } from "@iloveagents/foundry-web-shell";
import { customerPages } from "@/pages/index.tsx";

bootstrapShell({
  modules: [], // Add ChatModules here. Spaces module: see lastspace docs.
  pages: customerPages,
});
