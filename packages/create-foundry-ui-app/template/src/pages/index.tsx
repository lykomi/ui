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
  // /chat/:aguiThreadId — clicking a Recents chat in the sidebar (or
  // reloading the URL after sending a message) navigates here. Without
  // this route react-router has no match for the location and the SPA
  // renders a blank page on the chats-as-entities resume flow.
  // ChatPage itself is URL-agnostic; foundry-ui's
  // ChatConversationAwareRuntime reads the thread id from the URL via
  // `CHAT_PATH_PATTERN` in spaces-web-ui's `chat-conversation-config`.
  { path: "chat/:id", element: <ChatPage /> },
];
