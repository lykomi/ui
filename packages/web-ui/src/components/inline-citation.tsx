import { useState, type MouseEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.tsx";

export interface InlineCitationProps {
  marker: string;
  title: string;
  section?: string;
  location?: string;
  /** Source text supplied by the caller; never inferred from a title or claim. */
  excerpt?: string;
  href?: string;
  onOpen?: () => void;
  onPreviewOpenChange?: (open: boolean) => void;
}

/** One citation, one target. Shared by authored content and chat. */
export function InlineCitation({
  marker,
  title,
  section,
  location,
  excerpt,
  href,
  onOpen,
  onPreviewOpenChange,
}: InlineCitationProps) {
  const [open, setOpen] = useState(false);
  const description = [title, section, location].filter(Boolean).join(" — ");
  const className =
    "ms-0.5 inline-flex min-w-6 items-center justify-center rounded-sm bg-muted/70 px-1 text-[0.8125rem] font-medium leading-5 text-muted-foreground no-underline align-baseline hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:min-w-0 print:bg-transparent print:px-0";
  const activate = (event: MouseEvent) => {
    if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    if (!onOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    onPreviewOpenChange?.(false);
    onOpen();
  };
  const label = `Source ${marker}: ${description}`;
  if (!href && !onOpen) return <span className="text-muted-foreground">[{marker}]</span>;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onPreviewOpenChange?.(next);
        }}
      >
        <TooltipTrigger asChild>
          {href ? (
            <a
              data-inline-citation=""
              href={href}
              aria-label={label}
              className={className}
              onClick={activate}
            >
              {marker}
            </a>
          ) : (
            <button
              data-inline-citation=""
              type="button"
              aria-label={label}
              className={className}
              onClick={activate}
            >
              {marker}
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="max-w-sm space-y-2 border border-border bg-popover p-3 text-sm font-normal leading-relaxed text-popover-foreground shadow-md"
        >
          <div>
            <div className="break-words font-semibold">{title}</div>
            {section && section !== title && (
              <div className="break-words text-muted-foreground">{section}</div>
            )}
            {location && <div className="text-xs text-muted-foreground">{location}</div>}
          </div>
          {excerpt?.trim() && (
            <div className="border-t border-border pt-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Source excerpt</div>
              <div className="line-clamp-6 whitespace-pre-line break-words">{excerpt.trim()}</div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
