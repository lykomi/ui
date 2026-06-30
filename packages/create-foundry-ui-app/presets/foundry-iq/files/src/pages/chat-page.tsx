import { ChatContent } from "@iloveagents/foundry-web-ui";

const starterSuggestions = [
  "Search Foundry IQ for a knowledge base summary",
  "What sources are available in the knowledge base?",
  "Say hello world using the hello_world tool",
];

export function ChatPage() {
  return <ChatContent starterSuggestions={starterSuggestions} />;
}
