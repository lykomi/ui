import { cloneElement, isValidElement, useCallback, useState, type FC } from "react";
import { useMessagePartText } from "@assistant-ui/react";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Children, type ReactElement, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { MermaidDiagram, MermaidStreamingContext } from "./mermaid-diagram.tsx";
import { useStore } from "zustand";
import {
  citationStore,
  linkStore,
  resolveLinkHandler,
  type CitationResult,
} from "@iloveagents/foundry-agent";

/* ---------- Shared copy-to-clipboard button ---------- */

const CopyButton: FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "flex items-center justify-center size-7 rounded-md",
        "hover:bg-muted/50 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
    </button>
  );
};

/* ---------- Inline code ---------- */

function textFromChildren(children: ReactNode): string | null {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!Array.isArray(children)) return null;
  let out = "";
  for (const child of children) {
    if (typeof child === "string" || typeof child === "number") {
      out += String(child);
    } else {
      return null;
    }
  }
  return out;
}

function resolveHandledHref(rawHref: string): string | null {
  return resolveLinkHandler(rawHref)?.href ?? null;
}

function openHandledHref(href: string) {
  const resolved = resolveLinkHandler(href);
  resolved?.handler.openLink(resolved.href);
}

const TRAILING_LINK_PUNCT_RE = /[.,;:!?)\]]+$/;

function trimLinkCandidate(value: string): { href: string; suffix: string } {
  const match = value.match(TRAILING_LINK_PUNCT_RE);
  if (!match) return { href: value, suffix: "" };
  return {
    href: value.slice(0, -match[0].length),
    suffix: match[0],
  };
}

function exactHandledHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const { href, suffix } = trimLinkCandidate(trimmed);
  if (suffix) return null;
  return resolveHandledHref(href);
}

const HANDLED_LINK_RE = /(https?:\/\/[^\s<>"`]+|\/[A-Za-z0-9][^\s<>"`]*)/g;

const HandledLink: FC<
  {
    href: string;
    children: ReactNode;
    className?: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>
> = ({ href, children, className, ...props }) => {
  const handledHref = useStore(linkStore, () => resolveHandledHref(href));

  if (!handledHref) {
    return (
      <a
        href={href}
        className={cn("text-primary hover:underline", className)}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      href={handledHref}
      className={cn("text-primary hover:underline", className)}
      onClick={(event) => {
        event.preventDefault();
        openHandledHref(handledHref);
      }}
      {...props}
    >
      {children}
    </a>
  );
};

const AutoLinkedText: FC<{ text: string }> = ({ text }) => {
  useStore(linkStore, (s) => s.handlers);

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(HANDLED_LINK_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const { href, suffix } = trimLinkCandidate(raw);
    const handledHref = resolveHandledHref(href);
    if (!handledHref) continue;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <HandledLink key={`${start}-${href}`} href={handledHref}>
        {href}
      </HandledLink>,
    );
    if (suffix) parts.push(suffix);
    lastIndex = start + raw.length;
  }
  if (lastIndex === 0) return <>{text}</>;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
};

const InlineCode = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => {
  const value = textFromChildren(children);
  const handledHref = useStore(linkStore, () => (value ? exactHandledHref(value) : null));
  const className = "rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground";

  if (handledHref) {
    return (
      <HandledLink href={handledHref} className={className}>
        {children}
      </HandledLink>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

/* ---------- Code block with header + copy action (used by ReactMarkdown / tool panel) ---------- */

const HighlightedCodeBlock: FC<{ language?: string; code: string }> = ({ language, code }) => {
  return (
    <div className="relative group my-4">
      <div
        className={cn(
          "flex items-center justify-between",
          "rounded-t-lg bg-code-block px-4 py-2",
          "border-b border-border/30",
        )}
      >
        <span className="text-xs font-medium text-muted-foreground">{language || "text"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="rounded-b-lg bg-code-block p-4 overflow-x-auto text-sm font-mono text-code-block-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Extracts language and raw code from the <code> child that ReactMarkdown
 * renders inside <pre>. Returns { language, code } or null for non-code pre.
 */
function extractCodeInfo(children: React.ReactNode): { language?: string; code: string } | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (child && typeof child === "object" && "props" in child && child.props) {
    const className: string | undefined = child.props.className;
    const lang = className?.match(/language-(\S+)/)?.[1];
    const raw = child.props.children;
    const code =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join("") : String(raw ?? "");
    return { language: lang, code: code.replace(/\n$/, "") };
  }
  return null;
}

/* ---------- Shared markdown components (used by both chat + tool panel) ---------- */

/**
 * Shared markdown component overrides used by both chat messages and the tool panel.
 */
export const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-content-heading-1" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-bold mt-5 mb-3 text-content-heading-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-content-heading-3" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-semibold mt-3 mb-1.5 text-content-heading-4" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="mt-3 mb-1.5 text-sm font-semibold text-content-heading-5" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="mt-3 mb-1.5 text-xs font-semibold text-content-heading-6" {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 leading-relaxed text-foreground" {...props}>
      {injectCitations(children)}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-outside pl-6 mb-4 space-y-1 text-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-outside pl-6 mb-4 space-y-1 text-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-foreground" {...props}>
      {injectCitations(children)}
    </li>
  ),
  pre: ({ children }) => {
    const info = extractCodeInfo(children);
    if (info) {
      if (info.language?.toLowerCase() === "mermaid") return <MermaidDiagram source={info.code} />;
      return <HighlightedCodeBlock language={info.language} code={info.code} />;
    }
    return (
      <pre className="rounded-lg bg-code-block p-4 overflow-x-auto text-sm font-mono text-code-block-foreground my-4">
        {children}
      </pre>
    );
  },
  code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
    // Fenced code blocks are wrapped in <pre><code> — the pre handles styling.
    // Only inline code (no language class, not inside pre) gets the InlineCode style.
    if (className?.includes("language-")) {
      return <code {...props}>{children}</code>;
    }
    return <InlineCode {...props}>{children}</InlineCode>;
  },
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-4 border-primary pl-4 py-2 my-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }) => (
    <HandledLink href={href || ""} {...props}>
      {children}
    </HandledLink>
  ),
  hr: (props) => <hr className="my-6 border-border" {...props} />,
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full divide-y divide-border" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  th: ({ children, ...props }) => (
    <th className="px-4 py-2 text-left text-sm font-semibold text-foreground" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-4 py-2 text-sm text-foreground" {...props}>
      {children}
    </td>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
};

/* ---------- Inline [n] citations (React-level, no remark plugin) ---------- */

const CITE_RE = /(\[\d+\])/;

/** Open a citation via the registered handler (provided by feature modules). */
function openCitation(result: CitationResult) {
  const handler = citationStore.getState().handler;
  if (handler) handler.openCitation(result);
}

/** Clickable superscript citation: [1] → opens via registered handler. */
const CitationRef: FC<{ index: number }> = ({ index }) => {
  const result = useStore(citationStore, (s) => s.results[index - 1]);
  const hasHandler = useStore(citationStore, (s) => !!s.handler);
  if (!result) return <span className="text-muted-foreground">[{index}]</span>;
  if (!hasHandler) return <span className="text-muted-foreground">[{index}]</span>;

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => openCitation(result)}
      onKeyDown={(e) => {
        if (e.key === "Enter") openCitation(result);
      }}
      title={`${result.entity_name}, p. ${result.page_number}`}
      className="inline-flex items-center text-primary font-semibold cursor-pointer hover:underline"
    >
      <sup className="text-[0.7em] ml-0.5">[{index}]</sup>
    </span>
  );
};

/**
 * Walk React children and replace [n] text fragments with CitationRef
 * components. Only processes string children — leaves elements untouched.
 */
export function injectCitations(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      if (!CITE_RE.test(child)) return <AutoLinkedText text={child} />;

      const parts = child.split(CITE_RE);
      return parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (m) return <CitationRef key={i} index={parseInt(m[1], 10)} />;
        return <AutoLinkedText key={i} text={part} />;
      });
    }

    if (!isValidElement(child)) return child;

    const element = child as ReactElement<{ children?: ReactNode }>;
    const nested = element.props.children;
    if (nested == null) return child;
    return cloneElement(element, undefined, injectCitations(nested));
  });
}

/* ---------- MarkdownText (chat messages) ---------- */

export const MarkdownText: FC = () => {
  const part = useMessagePartText();

  return (
    <MermaidStreamingContext.Provider value={part.status.type === "running"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {part.text}
      </ReactMarkdown>
    </MermaidStreamingContext.Provider>
  );
};
