import { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { defineChatModule } from "@lykomi/web-shell";
import { useNavStore } from "@lykomi/web-ui";

function useStarterNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    useNavStore.getState().addGroup({
      label: "Starter",
      hideLabel: true,
      items: [
        {
          to: "/guide",
          label: "Guide",
          icon: BookOpen,
          description: "Starter guide for the agent, tools, and UI modules",
          contextInstructions:
            "The user is reading the starter guide. Explain how to replace the sample tools, " +
            "add a page, or connect a service when asked. Do not claim a service is configured " +
            "unless the user has supplied its settings.",
        },
      ],
    });
    useNavStore.getState().setUserMenuAction({
      id: "starter-guide",
      label: "About this starter",
      onSelect: () => navigate("/guide"),
    });
    return () => {
      useNavStore.getState().removeGroup("Starter");
      useNavStore.getState().removeUserMenuAction("starter-guide");
    };
  }, [navigate]);
}

/** A small module demonstrates how an app owns its routes and navigation. */
export const starterModule = defineChatModule({
  name: "starter-guide",
  useInit: useStarterNavigation,
});
