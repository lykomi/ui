import { Search, X } from "lucide-react";

import { Button } from "@lykomi/web-primitives";
import { Input } from "@lykomi/web-primitives";
import { cn } from "@lykomi/web-primitives";

export function CollectionSearchInput({
  value,
  onValueChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[16rem] flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border-border/45 bg-background/72 pl-9 pr-10 shadow-none hover:bg-background/82 focus:border-primary/20 focus:ring-primary/10"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onValueChange("")}
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-lg text-muted-foreground"
        >
          <X className="size-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      ) : null}
    </div>
  );
}
