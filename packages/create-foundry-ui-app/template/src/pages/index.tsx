import type { ShellPage } from "@iloveagents/foundry-web-shell";
import { ChatPage } from "./chat-page.tsx";

/**
 * Customer pages list. Add your own routes here.
 *
 * The shell renders these inside its standard layout. Customer pages win on
 * path collision with module-supplied pages — your `/` here overrides any
 * module's `/`.
 */
export const customerPages: ShellPage[] = [
  { path: "/", element: <ChatPage /> },
];
