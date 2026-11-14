import { ChevronDown, Layers3, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu.tsx";
import type { NavGroup } from "../lib/nav-config.ts";

interface HomeQuickAction {
  id: string;
  label: string;
  description: string;
  icon?: LucideIcon;
}

function isHomeQuickAction(value: unknown): value is HomeQuickAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<HomeQuickAction>;
  return (
    typeof action.id === "string" &&
    typeof action.label === "string" &&
    action.label.trim().length > 0 &&
    typeof action.description === "string" &&
    action.description.trim().length > 0
  );
}

/** Opt-in presentation metadata never grants an action: use the owner's authorized handler. */
export function HomeDestinations({ groups }: { groups: NavGroup[] }) {
  const spaces = groups.find((group) => group.meta?.type === "spaces-workspaces");
  const createActions = spaces?.createActions ?? [];
  const declared = spaces?.meta?.homeQuickActions;
  const actions = Array.isArray(declared)
    ? declared.filter(isHomeQuickAction).flatMap((action) => {
        const create = spaces?.createActions?.find((candidate) => candidate.id === action.id);
        return create ? [{ ...action, handler: create.handler }] : [];
      })
    : [];
  if (createActions.length === 0) return null;

  const createSpaceControl = (
    <div className={`flex justify-center ${actions.length > 0 ? "mb-5" : ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-10 gap-2 px-4 font-medium">
            <Plus className="size-4" aria-hidden />
            Create a space
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {createActions.map((action) => (
            <DropdownMenuItem key={action.id} onSelect={() => action.handler()}>
              {action.label.replace(/^New /, "")}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div
      className={actions.length > 0 ? "mt-8 text-left" : "mt-4 text-left"}
      data-home-destinations
    >
      {actions.length > 0 ? (
        <section aria-label="Quick actions">
          <h2 className="mb-4 text-center text-lg font-semibold">Quick actions</h2>
          {createSpaceControl}
          <div className="flex flex-wrap justify-center gap-3">
            {actions.map((action) => {
              const Icon = action.icon ?? Layers3;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.handler}
                  className="flex min-h-32 w-full min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 text-left text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring sm:w-[calc(50%-0.375rem)] sm:max-w-sm"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium">{action.label}</span>
                    <span className="mt-1.5 block break-words text-xs leading-relaxed text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        createSpaceControl
      )}
    </div>
  );
}
