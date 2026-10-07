import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { TooltipProvider } from "../../ui/tooltip.tsx";
import { Dialog, DialogPortal } from "../../ui/dialog.tsx";
import { FocusDialog } from "../focus-dialog.tsx";

/** A stable portal host preserves filters, selection and drafts across focus transitions. */
export interface DataTableFrameContextValue {
  focused: boolean;
  setFocused: (focused: boolean) => void;
}
const DataTableFrameContext = createContext<DataTableFrameContextValue | null>(null);
export function useDataTableFrame(): DataTableFrameContextValue | null {
  return useContext(DataTableFrameContext);
}
export interface DataTableFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  focusClassName?: string;
  defaultFocused?: boolean;
  onFocusChange?: (focused: boolean) => void;
}
export const DataTableFrame = forwardRef<HTMLDivElement, DataTableFrameProps>(
  function DataTableFrame(
    { children, className, focusClassName, defaultFocused = false, onFocusChange, ...rest },
    ref,
  ) {
    const [focused, setFocused] = useState(defaultFocused);
    const [host] = useState(() =>
      typeof document === "undefined" ? null : document.createElement("div"),
    );
    const returnFocus = useRef<HTMLElement | null>(null);
    const value = useMemo(
      () => ({
        focused,
        setFocused: (next: boolean) => {
          if (next && !focused) returnFocus.current = document.activeElement as HTMLElement | null;
          setFocused(next);
          onFocusChange?.(next);
        },
      }),
      [focused, onFocusChange],
    );
    const attach = (element: HTMLDivElement | null) => {
      if (element && host && host.parentElement !== element) {
        host.style.display = "contents";
        element.appendChild(host);
      }
    };
    const content = (
      <div
        {...rest}
        ref={ref}
        data-table-layout=""
        data-focused={focused ? "" : undefined}
        data-focus-title={rest["aria-label"] || "Focused content"}
        className={
          focused
            ? cn(
                "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-4 sm:p-6",
                focusClassName,
              )
            : className
        }
      >
        {children}
      </div>
    );
    return (
      <DataTableFrameContext.Provider value={value}>
        <TooltipProvider>
          <div ref={focused ? undefined : attach} className="contents" />
          <Dialog open={focused} onOpenChange={value.setFocused}>
            <FocusDialog
              focused={focused}
              setFocused={value.setFocused}
              host={host}
              attach={attach}
              title={rest["aria-label"] || "Table focus"}
              onReturnFocus={() => returnFocus.current?.focus()}
            />
            {host ? (
              <DialogPortal container={host} forceMount>
                {content}
              </DialogPortal>
            ) : (
              content
            )}
          </Dialog>
        </TooltipProvider>
      </DataTableFrameContext.Provider>
    );
  },
);
