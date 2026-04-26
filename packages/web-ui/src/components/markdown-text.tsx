import { useCallback, useEffect, useState, type FC } from "react";
import {
  MarkdownTextPrimitive,
  type SyntaxHighlighterProps,
  type CodeHeaderProps,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Highlighter } from "shiki/bundle/web";
import { Children, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { useStore } from "zustand";
import { citationStore, type CitationResult } from "@iloveagents/foundry-agent";

/* ---------- Shiki syntax highlighter (lazy-loaded singleton) ---------- */

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki/bundle/web").then((mod) =>
      mod.createHighlighter({
        themes: ["github-dark"],
        langs: [],
      }),
    );
  }
  return highlighterPromise;
}

/**
 * Shared hook: returns highlighted HTML for a code string, or null while loading.
 * Always uses github-dark because code blocks have a dark background (bg-code-block)
 * regardless of the app's light/dark mode.
 */
function useShikiHighlight(code: string, language: string | undefined): string | null {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!language) return;
    let cancelled = false;

    getHighlighter().then(async (hl) => {
      if (cancelled) return;
      const loaded = hl.getLoadedLanguages();
      if (!loaded.includes(language as never)) {
        try {
          await hl.loadLanguage(language as never);
        } catch {
          // Language not supported -- keep html null (fallback rendering)
          return;
        }
      }
      if (cancelled) return;
      setHtml(hl.codeToHtml(code, { lang: language, theme: "github-dark" }));
    });
    return () => {
      cancelled = true;
    };
  }, [language, code]);

  return html;
}

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

const InlineCode = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground" {...props}>
    {children}
  </code>
);

/* ---------- Code block with header + highlighting (used by ReactMarkdown / tool panel) ---------- */

const HighlightedCodeBlock: FC<{ language?: string; code: string }> = ({ language, code }) => {
  const html = useShikiHighlight(code, language);

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
      {html ? (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className="[&_pre]:bg-code-block! [&_pre]:rounded-b-lg [&_pre]:rounded-t-none [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:font-mono"
        />
      ) : (
        <pre className="rounded-b-lg bg-code-block p-4 overflow-x-auto text-sm font-mono text-code-block-foreground">
          <code>{code}</code>
        </pre>
      )}
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

/* ---------- MarkdownTextPrimitive components (chat messages) ---------- */

const ShikiHighlighter: FC<SyntaxHighlighterProps> = ({ language, code, components: C }) => {
  const html = useShikiHighlight(code, language);

  if (html) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="[&_pre]:bg-code-block! [&_pre]:rounded-b-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:font-mono"
      />
    );
  }

  return (
    <C.Pre className="rounded-b-lg bg-code-block p-4 overflow-x-auto text-sm font-mono text-code-block-foreground">
      <C.Code>{code}</C.Code>
    </C.Pre>
  );
};

const CodeBlockHeader: FC<CodeHeaderProps> = ({ language, code }) => (
  <div
    className={cn(
      "flex items-center justify-between",
      "rounded-t-lg bg-code-block px-4 py-2 mt-4",
      "border-b border-border/30",
    )}
  >
    <span className="text-xs font-medium text-muted-foreground">{language || "text"}</span>
    <CopyButton text={code} />
  </div>
);

/* ---------- Shared markdown components (used by both chat + tool panel) ---------- */

/**
 * Shared markdown component overrides used by both the chat messages
 * (MarkdownTextPrimitive) and the tool panel (ReactMarkdown).
 */
export const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-bold mt-5 mb-3 text-foreground" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-semibold mt-3 mb-1.5 text-foreground" {...props}>
      {children}
    </h4>
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
    <a
      href={href}
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
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
function injectCitations(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    if (!CITE_RE.test(child)) return child;

    const parts = child.split(CITE_RE);
    return parts.map((part, i) => {
      const m = /^\[(\d+)\]$/.exec(part);
      if (m) return <CitationRef key={i} index={parseInt(m[1], 10)} />;
      return part;
    });
  });
}

/* ---------- MarkdownText (chat messages) ---------- */

export const MarkdownText: FC = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      components={{
        ...markdownComponents,
        SyntaxHighlighter: ShikiHighlighter,
        CodeHeader: CodeBlockHeader,
      }}
    />
  );
};
