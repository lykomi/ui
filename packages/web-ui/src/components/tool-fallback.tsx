import { ToolCallCard, type ToolCallStatus } from "./tool-call-card.tsx";
import { Wrench } from "lucide-react";

export const ToolFallback = (props: Record<string, unknown>) => {
  const { toolName, args, result, part } = props as {
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    part: { status?: { type: string } };
  };
  const rawStatus = (part?.status as { type: string }) || (props.status as { type: string });

  // Tool results that *describe* a failure (Python ``@tool`` raises an
  // exception → agent-framework serializes it as an error string;
  // FastMCP returns ``{isError: true, content: [...]}``; our own tools
  // sometimes return a plain ``"Error: ..."`` string) arrive here with
  // ``status.type === "complete"`` because the tool-call round-trip
  // succeeded from the transport's point of view. Without sniffing
  // the payload we'd render "Execution complete" in green for a red
  // condition — exactly what the user called out. Normalize to the
  // ``incomplete + reason: "error"`` state the card knows how to
  // show in red with an X-circle.
  const isErrorResult = _detectErrorResult(result);
  const status: ToolCallStatus = isErrorResult
    ? { type: "incomplete", reason: "error" }
    : (rawStatus as ToolCallStatus);

  let description = "";
  if (status.type === "running") {
    description = `Executing ${toolName}...`;
  } else if (status.type === "incomplete" && status.reason === "error") {
    description = _extractErrorMessage(result) ?? "Execution failed";
  } else if (status.type === "complete") {
    description = result ? "Execution complete" : "Completed";
  } else if (status.type === "requires-action") {
    description = "Waiting for execution...";
  }

  return (
    <ToolCallCard
      icon={<Wrench className="size-3.5" />}
      title={formatToolName(toolName)}
      description={description}
      status={status}
      className="w-full"
    >
      {args && Object.keys(args).length > 0 && (
        <div className="text-muted-foreground text-xs space-y-1">
          {Object.entries(args).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium">{key}:</span>{" "}
              <span className="font-mono">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      )}

      {(status.type === "complete" ||
        (status.type === "incomplete" && status.reason === "error")) &&
        result != null && (
          <div className="text-muted-foreground text-xs mt-2 pt-2 border-t border-border">
            <div className="font-medium mb-1">
              {status.type === "incomplete" ? "Error" : "Result"}:
            </div>
            <pre className="font-mono text-xs bg-muted p-2 rounded overflow-x-auto">
              {formatResult(result as unknown)}
            </pre>
          </div>
        )}
    </ToolCallCard>
  );
};

function formatToolName(toolName: string): string {
  return toolName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}

/**
 * Heuristically detect a failed tool result. The agent-framework
 * adapter flattens both plain-Python and MCP tool errors into the
 * same ``result`` field without a dedicated error flag, so we have
 * to sniff:
 *
 * - MCP canonical shape: ``{isError: true, content: [...]}``
 * - Python ``@tool`` exception: a string starting with ``"Error:"``
 *   (agent-framework's default serialization — see
 *   ``agent_framework/_tools.py::_serialize_tool_exception``).
 * - Structured error objects: ``{error: "..."}`` or
 *   ``{error: {message: "..."}}`` — what FastMCP's ``ToolError``
 *   (re-)raises produce.
 *
 * Keep this narrow. A substring match on ``"Error"`` would false-
 * positive on legitimate results ("…contains the word Error in a
 * heading…"), so anchor patterns to prefix / explicit fields only.
 */
export function _detectErrorResult(result: unknown): boolean {
  if (result == null) return false;
  if (typeof result === "string") {
    // Python tools: "Error: <message>" (agent-framework default).
    return /^\s*Error:\s/.test(result);
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // MCP Streamable-HTTP canonical shape.
    if (obj.isError === true) return true;
    // FastMCP ToolError + some of our hand-rolled paths.
    if (typeof obj.error === "string" && obj.error.length > 0) return true;
    if (
      obj.error &&
      typeof obj.error === "object" &&
      typeof (obj.error as Record<string, unknown>).message === "string"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Pull a user-readable one-liner out of an error result so the card
 * header shows *why* it failed rather than the generic "Execution
 * failed". Matches the shapes enumerated in ``detectErrorResult``.
 */
export function _extractErrorMessage(result: unknown): string | null {
  if (typeof result === "string") {
    // Strip the "Error: " prefix so the header isn't redundant.
    const m = /^\s*Error:\s*(.*)$/s.exec(result);
    return m ? m[1].trim() || "Execution failed" : null;
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (
      obj.error &&
      typeof obj.error === "object" &&
      typeof (obj.error as Record<string, unknown>).message === "string"
    ) {
      return (obj.error as Record<string, unknown>).message as string;
    }
    if (Array.isArray(obj.content)) {
      // MCP error: content[].text usually carries the human message.
      for (const item of obj.content) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).text === "string"
        ) {
          return (item as Record<string, unknown>).text as string;
        }
      }
    }
  }
  return null;
}
