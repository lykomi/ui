import { useState } from "react";
import { Code2, Copy } from "lucide-react";
import { Button } from "@lykomi/web-primitives";

export function SourcePanel({ files }: { files: Array<{ name: string; code: string }> }) {
  const [message, setMessage] = useState("");
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-medium">
        <Code2 className="mr-2 inline size-4 text-primary" /> Source code{" "}
        <span className="ml-2 font-normal text-muted-foreground">
          The actual example, ready to adapt
        </span>
      </summary>
      <div className="border-t border-border p-4 sm:p-5">
        {files.map(({ name, code }) => (
          <section key={name} className="mb-5 last:mb-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <code className="break-all text-xs text-muted-foreground">{name}</code>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setMessage(`Copied ${name}`);
                  } catch {
                    setMessage("Clipboard unavailable. Select the code below to copy it.");
                  }
                }}
              >
                <Copy className="size-3.5" /> Copy code
              </Button>
            </div>
            <pre
              className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed"
              tabIndex={0}
            >
              <code>{code}</code>
            </pre>
          </section>
        ))}
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {message}
        </p>
      </div>
    </details>
  );
}
