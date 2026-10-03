import { safeHref } from "./model.ts";

/**
 * Opens an app's own address — `spaces://<id>#block-…`, say — the way the
 * host opens such things (a tab of its own, at the passage), or `null` when
 * the host does not claim it. Passed in by the host: this entry knows no
 * routing and no agent runtime.
 */
export type GraphLinkResolver = (href: string) => { open: () => void } | null;

/** What a detail's link opens, and how. */
export interface GraphLink {
  href: string;
  /** A web address: opened in a new browser tab. */
  external: boolean;
  /** An app address: the host's way of opening it. */
  open?: () => void;
}

/** Schemes a link may never carry, whatever handler claims it. */
const SCRIPTING = /^\s*(?:javascript|data|vbscript):/i;

/**
 * A detail's link, or `undefined` when it is not one a click may follow:
 * a web address or same-origin path (`safeHref`), or an app address the
 * host's resolver claims.
 */
export function graphLink(
  href: string | undefined,
  resolveAppLink?: GraphLinkResolver,
): GraphLink | undefined {
  if (!href || SCRIPTING.test(href)) return undefined;
  const web = safeHref(href);
  if (web) return { href: web, external: true };
  const app = resolveAppLink?.(href);
  return app ? { href, external: false, open: app.open } : undefined;
}
