import { createStore } from "zustand/vanilla";

export interface ChatSkill {
  name: string;
  description: string;
  scope?: string;
}

/** A backend catalogue, never skill bodies or filesystem paths. */
export const chatSkillsStore = createStore<{
  skills: ChatSkill[];
  setSkills: (value: unknown) => void;
}>((set) => ({
  skills: [],
  setSkills: (value) => {
    const skills: ChatSkill[] = [];
    const names = new Set<string>();
    if (Array.isArray(value))
      for (const row of value) {
        if (!row || typeof row !== "object") continue;
        const name = row.name ?? row.slug;
        if (
          typeof name !== "string" ||
          name.length > 64 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
          typeof row.description !== "string" ||
          !row.description.trim() ||
          names.has(name)
        )
          continue;
        names.add(name);
        skills.push({
          name,
          description: row.description.slice(0, 1024),
          ...(typeof row.scope === "string" ? { scope: row.scope } : {}),
        });
      }
    set({ skills });
  },
}));
