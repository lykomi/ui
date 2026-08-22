/** The "…" menu at the end of a row. Items are data, so agents and tests can read them. */
import { MoreHorizontal } from "lucide-react";
import type { ComponentType } from "react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";

export interface DataTableRowAction {
  label: string;
  onSelect: () => void;
  icon?: ComponentType<{ className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
}

export interface DataTableRowActionsProps {
  actions: Array<DataTableRowAction | "separator">;
  label?: string;
  className?: string;
}

export function DataTableRowActions({
  actions,
  label = "Open menu",
  className,
}: DataTableRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-no-row-click=""
          className={cn("size-8 rounded-lg p-0 data-[state=open]:bg-accent", className)}
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 rounded-xl border-border/45 bg-popover/95 shadow-lg"
      >
        {actions.map((action, index) =>
          action === "separator" ? (
            <DropdownMenuSeparator key={`sep-${index}`} />
          ) : (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation();
                action.onSelect();
              }}
              className={cn(action.destructive && "text-destructive focus:text-destructive")}
            >
              {action.icon ? <action.icon className="size-4 text-muted-foreground" /> : null}
              {action.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
