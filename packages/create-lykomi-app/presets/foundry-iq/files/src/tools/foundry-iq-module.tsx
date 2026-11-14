import { defineChatModule } from "@lykomi/web-shell";
import { FoundryIQSearchToolUI } from "./search-results-tool-ui.tsx";

export const foundryIqModule = defineChatModule({
  name: "foundry-iq",
  toolUIs: <FoundryIQSearchToolUI />,
});
