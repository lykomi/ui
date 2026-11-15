import { useId, useLayoutEffect, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useAui, useAuiState } from "@assistant-ui/react";
import { chatSkillsStore } from "@lykomi/agent";
import { useStore } from "zustand";
import { cn } from "@lykomi/web-primitives";

/** Keep the real textarea in place; portal suggestions above every composer surface. */
export function useComposerSkills(input: RefObject<HTMLTextAreaElement | null>) {
  const aui = useAui();
  const text = useAuiState((state) => state.composer.text);
  const skills = useStore(chatSkillsStore, (state) => state.skills);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const id = useId();
  const query = /^\/([a-z0-9-]*)$/.exec(text)?.[1];
  const matches = query === undefined ? [] : skills.filter((skill) => skill.name.includes(query));
  const open = focused && query !== undefined && skills.length > 0 && dismissed !== text;
  const active = Math.min(cursor, Math.max(0, matches.length - 1));
  const [position, setPosition] = useState({ left: 0, bottom: 0, width: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = input.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          left: rect.left,
          bottom: window.innerHeight - rect.top + 8,
          width: rect.width,
        });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, input]);
  const choose = (name: string) => {
    aui.composer.setText(`/${name} `);
    setCursor(0);
    input.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(text);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setCursor(
        (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) %
          Math.max(1, matches.length),
      );
    } else if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      if (!matches[active]) return;
      event.preventDefault();
      choose(matches[active].name);
    }
  };
  useLayoutEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);
  return {
    inputProps: {
      onKeyDown,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onChange: () => {
        setCursor(0);
        setDismissed(null);
      },
      "aria-controls": open ? id : undefined,
      "aria-autocomplete": "list" as const,
      "aria-activedescendant": open && matches[active] ? `${id}-${active}` : undefined,
    },
    popup: open
      ? createPortal(
          <div
            id={id}
            role="listbox"
            aria-label="Available skills"
            className="fixed z-50 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
            style={{
              ...position,
              maxHeight: `min(16rem, ${Math.max(80, window.innerHeight - position.bottom - 8)}px)`,
            }}
          >
            {matches.length ? (
              matches.map((skill, index) => (
                <div
                  key={skill.name}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(skill.name)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-2 text-sm",
                    active === index && "bg-accent text-accent-foreground",
                  )}
                >
                  <div className="font-medium">/{skill.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{skill.description}</div>
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground">No matching skills</div>
            )}
          </div>,
          document.body,
        )
      : null,
  };
}
