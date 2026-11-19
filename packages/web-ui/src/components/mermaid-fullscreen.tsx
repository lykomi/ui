import type { ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "../ui/dialog.tsx";

export function MermaidFullscreen({
  title,
  disabled,
  children,
}: {
  title: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Open diagram fullscreen"
          aria-label="Open diagram fullscreen"
          disabled={disabled}
        >
          <Maximize2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="inset-0 left-0 top-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm">{title}</DialogTitle>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Exit fullscreen"
              aria-label="Exit fullscreen"
            >
              <Minimize2 className="size-4" />
            </Button>
          </DialogClose>
        </div>
        <div
          role="region"
          aria-label="Diagram preview"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-auto p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-6"
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
