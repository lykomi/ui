import DOMPurify from "dompurify";
import type { MermaidConfig } from "mermaid";

export const MAX_MERMAID_LENGTH = 50_000;
let queue: Promise<unknown> = Promise.resolve();
let nextId = 0;

/** Mermaid has process-wide configuration: configure and render in one serial job. */
export function renderMermaid(source: string, themeVariables: MermaidConfig["themeVariables"]) {
  const task = queue.then(async () => {
    if (source.length > MAX_MERMAID_LENGTH) throw new Error("Diagram is too large.");
    // Render staging happens in the host DOM. Do not let source-triggered
    // images or CSS fetch a URL before the isolated preview is created.
    const resourceSource = source
      .replace(
        /\\([0-9a-f]{1,6})[ \t\r\n\f]?|\\([^\r\n\f])/gi,
        (_match, hex: string | undefined, escaped: string) =>
          hex ? String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)) : escaped,
      )
      .replace(/\/\*[\s\S]*?\*\//g, "");
    if (/url\s*\(|@import/i.test(resourceSource)) {
      throw new Error("External resources are not supported in diagrams.");
    }
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      suppressErrorRendering: true,
      maxTextSize: MAX_MERMAID_LENGTH,
      maxEdges: 500,
      // The host owns ALL configuration, including nested diagram options.
      // Source frontmatter must not inject CSS via fontFamily or change limits.
      secure: [
        ...new Set([
          ...Object.keys(mermaid.mermaidAPI.defaultConfig),
          "secure",
          "fontFamily",
          "altFontFamily",
          "fontSize",
          "htmlLabels",
          "themeCSS",
          "themeVariables",
        ]),
      ],
    });
    // Inspect parsed attributes, not labels. Mermaid's YAML parser decodes
    // quoted/escaped keys (including \u0069mg) before creating image nodes.
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
    if (diagram.type.startsWith("flowchart")) {
      const db = diagram.db as { getVertices(): Map<string, { img?: string; icon?: string }> };
      const vertices = db.getVertices();
      for (const vertex of vertices.values()) {
        if (vertex.img || vertex.icon) {
          throw new Error("External resources are not supported in diagrams.");
        }
      }
    }
    const host = document.createElement("div");
    host.style.visibility = "hidden";
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    try {
      const { svg } = await mermaid.render(`foundry-mermaid-${++nextId}`, source, host);
      return DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ["foreignObject", "script", "a", "image"],
        FORBID_ATTR: ["href", "xlink:href"],
      });
    } finally {
      host.remove();
    }
  });
  queue = task.catch(() => undefined);
  return task;
}

/** Canvas resolves CSS colors, including theme tokens expressed in OKLCH. */
export function mermaidTheme(element: HTMLElement, dark: boolean) {
  const style = getComputedStyle(element);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  const color = (token: string, fallback: string) => {
    if (!context) return fallback;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = fallback;
    context.fillStyle = style.getPropertyValue(token).trim() || fallback;
    context.fillRect(0, 0, 1, 1);
    const rgba = context.getImageData(0, 0, 1, 1).data;
    return `#${Array.from(rgba)
      .slice(0, 3)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")}`;
  };
  const foreground = color("--foreground", dark ? "#fafafa" : "#171717");
  const surface = color("--muted", dark ? "#262626" : "#f5f5f5");
  const background = color("--background", dark ? "#171717" : "#ffffff");
  const primary = color("--primary", dark ? "#a78bfa" : "#6d28d9");
  return {
    darkMode: dark,
    background,
    primaryColor: surface,
    primaryTextColor: foreground,
    primaryBorderColor: primary,
    secondaryColor: surface,
    secondaryTextColor: foreground,
    tertiaryColor: background,
    tertiaryTextColor: foreground,
    lineColor: foreground,
    textColor: foreground,
    edgeLabelBackground: background,
    actorBkg: surface,
    actorBorder: primary,
    actorTextColor: foreground,
    signalColor: foreground,
    signalTextColor: foreground,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: primary,
    labelTextColor: foreground,
    noteBkgColor: surface,
    noteBorderColor: primary,
    noteTextColor: foreground,
    fontFamily: style.fontFamily,
  };
}

/** The iframe CSP also blocks URL-valued styles supplied by diagram source. */
export function mermaidDocument(svg: string) {
  const width = Number(svg.match(/viewBox="[^"\s]+\s+[^"\s]+\s+([^"\s]+)/)?.[1]);
  const maximum = Number.isFinite(width) && width > 0 ? `${width}px` : "100%";
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;background:transparent}svg{display:block;width:100%;height:auto;max-width:${maximum}!important;margin:auto}</style></head><body>${svg}</body></html>`;
}
