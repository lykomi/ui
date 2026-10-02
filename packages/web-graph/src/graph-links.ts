import { resolveLinkHandler } from "@iloveagents/foundry-agent";
import { safeHref } from "./model.ts";

/** What a detail's link opens, and how. */
export interface GraphLink {
  href: string;
  /** A web address: opened in a new browser tab. Otherwise the app opens it. */
  external: boolean;
}

/** Schemes a link may never carry, whatever handler claims it. */
const SCRIPTING = /^\s*(?:javascript|data|vbscript):/i;

/**
 * A detail's link, or `undefined` when it is not one a click may follow.
 *
 * Web addresses and same-origin paths open in a new tab (`safeHref`). An
 * app's own address — `spaces://<id>#block-…`, say — is followed when the
 * host registered a link handler that claims it (`linkStore` in
 * `@iloveagents/foundry-agent`): it renders as a plain link with no target,
 * so the host's own click handling opens it where the app opens such things
 * (a tab of its own, at the passage), not in a browser tab.
 */
export function graphLink(href: string | undefined): GraphLink | undefined {
  if (!href || SCRIPTING.test(href)) return undefined;
  const web = safeHref(href);
  if (web) return { href: web, external: true };
  return resolveLinkHandler(href) ? { href, external: false } : undefined;
}
