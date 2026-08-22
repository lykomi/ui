/**
 * The frame around a list: normally a plain container, in focus mode a
 * fullscreen layer (Escape leaves it). `DataTableToolbar` shows the focus
 * button whenever it renders inside a frame — users with wide lists get a
 * way out of a cramped page without the host doing anything.
 *
 * The focus layer stays where it is in the tree — only its classes change —
 * so entering and leaving focus never remounts the list (its rows, drawer,
 * selection and in-flight edits survive) and it keeps inheriting the host's
 * theme scope. It never scrolls itself: it is a fixed flex column whose
 * growing child — the table — owns the scrolling, which keeps the toolbar in
 * place while the rows move under a sticky header (see `DataTable`, which
 * reads this context).
 *
 * A `position: fixed` layer is relative to the viewport unless an ancestor
 * establishes a containing block (`transform`, `filter`, `perspective`,
 * `contain: paint`); a host that does that on a list's ancestor has to opt
 * out of focus mode.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@iloveagents/foundry-web-primitives";

export interface DataTableFrameContextValue {
  focused: boolean;
  setFocused: (focused: boolean) => void;
}

const DataTableFrameContext = createContext<DataTableFrameContextValue | null>(null);

/** The enclosing frame's focus state, or `null` outside a frame. */
export function useDataTableFrame(): DataTableFrameContextValue | null {
  return useContext(DataTableFrameContext);
}

export interface DataTableFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  /** Classes applied in focus mode on top of the fullscreen layer. */
  focusClassName?: string;
  defaultFocused?: boolean;
}

export function DataTableFrame({
  children,
  className,
  focusClassName,
  defaultFocused = false,
  ...rest
}: DataTableFrameProps) {
  const [focused, setFocused] = useState(defaultFocused);
  useEffect(() => {
    if (!focused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [focused]);
  const value = useMemo(() => ({ focused, setFocused }), [focused]);
  return (
    <DataTableFrameContext.Provider value={value}>
      <div
        {...rest}
        data-focused={focused ? "" : undefined}
        className={
          focused
            ? cn(
                "fixed inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-background p-4 sm:p-6",
                focusClassName,
              )
            : className
        }
      >
        {children}
      </div>
    </DataTableFrameContext.Provider>
  );
}
