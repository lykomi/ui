import { ChatContent } from "@iloveagents/foundry-web-ui";

const starterSuggestions = [
  "What's in this graph?",
  "Show me everything connected to Metropolis",
  "Which people worked on more than one film?",
];

export function ChatPage() {
  return <ChatContent starterSuggestions={starterSuggestions} />;
}
