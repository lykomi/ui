import { ChatContent } from "@lykomi/web-ui";

const starterSuggestions = [
  "Say hello world using the hello_world tool",
  "Check the weather in Seattle",
  "What tools can you use?",
];

export function ChatPage() {
  return <ChatContent starterSuggestions={starterSuggestions} />;
}
