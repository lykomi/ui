import { useAui } from "@assistant-ui/react";
import { chatSkillsStore } from "@lykomi/agent";
import { useStore } from "zustand";
import { DropdownMenuItem, DropdownMenuSeparator } from "../ui/dropdown-menu.tsx";

export function ComposerSkillOptions() {
  const aui = useAui();
  const skills = useStore(chatSkillsStore, (state) => state.skills);
  if (!skills.length) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2 py-1 text-xs text-muted-foreground">Use a skill</div>
      <div className="max-h-60 overflow-y-auto">
        {skills.map((skill) => (
          <DropdownMenuItem
            key={skill.name}
            title={skill.description}
            onSelect={() => {
              const draft = aui.composer.getState().text.replace(/^\/[a-z0-9-]+(?:\s+|$)/, "");
              aui.composer.setText(`/${skill.name} ${draft}`);
            }}
          >
            /{skill.name}
          </DropdownMenuItem>
        ))}
      </div>
    </>
  );
}
