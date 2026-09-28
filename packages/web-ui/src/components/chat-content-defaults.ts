import { createContext } from "react";
import type { ChatContentProps } from "./assistant-chat.tsx";

/** Workbench presentation defaults; a routed chat page can override any of them. */
export const ChatContentDefaultsContext = createContext<ChatContentProps | null>(null);
