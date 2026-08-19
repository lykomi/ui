import { useStore } from "zustand";
import { Check, ChevronDown } from "lucide-react";
import {
  reasoningDefaultStore,
  reasoningEffortStore,
  REASONING_EFFORT_LABELS,
  type ReasoningEffort,
  type ResolvedReasoningEffort,
} from "@iloveagents/foundry-agent";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";

const OPTIONS: { value: ReasoningEffort; hint: string }[] = [
  { value: "default", hint: "" }, // hint is resolved at render — see autoHint
  { value: "low", hint: "Answers sooner, thinks less" },
  { value: "medium", hint: "Good default for most questions" },
  { value: "high", hint: "Slower, better on hard problems" },
  { value: "xhigh", hint: "Slowest, for the hardest questions" },
];

/** Bar count per level, lowest to highest. */
const EFFORT_RANK: Record<ResolvedReasoningEffort, number> = {
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
};

/**
 * The level as four rising bars.
 *
 * The trigger's job is to answer "how hard is it thinking?" at a glance, and
 * in a narrow composer — the chat bubble, a side panel — the words cost more
 * width than that question is worth. Bars cost ~14px and answer it without
 * reading. So the gauge is always shown and the label is what drops.
 *
 * `null` means the app has not told us what `Auto` resolves to. The gauge
 * then shows an empty track rather than a guess, for the same reason the
 * `Auto` hint refuses to name a level it does not know: a trigger that
 * confidently shows the wrong level is worse than one that shows none.
 *
 * Deliberately shows LEVEL only, never whether the level is pinned or
 * inherited from `Auto`. The level is what changes cost and latency; the mode
 * is the half this trigger already drops first when space runs short.
 *
 * `bg-current` throughout, so the bars inherit the button's own muted →
 * foreground hover transition instead of needing their own colour states.
 */
function EffortGauge({ level }: { level: ResolvedReasoningEffort | null }) {
  const rank = level ? EFFORT_RANK[level] : 0;
  return (
    <span aria-hidden="true" className="flex h-3.5 shrink-0 items-end gap-px">
      {([1, 2, 3, 4] as const).map((step) => (
        <span
          key={step}
          className={cn(
            "w-0.5 rounded-full bg-current transition-opacity",
            step === 1 && "h-1",
            step === 2 && "h-1.5",
            step === 3 && "h-2",
            step === 4 && "h-2.5",
            // The unlit bars stay visible: the gauge has to read as "2 of 4",
            // not as a bare pair of marks whose ceiling you cannot see.
            step <= rank ? "opacity-100" : "opacity-25",
          )}
        />
      ))}
    </span>
  );
}

/**
 * What `Auto` is currently doing, in words.
 *
 * Never guesses. If the app has not told us what the backend resolves to,
 * the hint says so rather than naming a level — an `Auto` that claims the
 * wrong level is the exact failure this option is meant to avoid.
 */
function autoHint(resolved: ResolvedReasoningEffort | null, scope: string | null): string {
  if (!resolved) return "Uses the app's configured level";
  const where = scope ? ` for ${scope}` : "";
  return `Currently ${REASONING_EFFORT_LABELS[resolved]}${where}`;
}

/**
 * Lets the user choose how hard the model thinks, per conversation.
 *
 * Sits in the composer next to Send. The choice rides on every request as
 * an AG-UI forwarded prop and is read at send time, so switching it
 * mid-conversation applies from the next message on.
 *
 * `Auto` follows the backend's configured level and names it, so the user
 * can always tell what they are actually running. An explicit level is a
 * pin — nothing moves it, including a change of context.
 */
export function ReasoningEffortPicker({ className }: { className?: string }) {
  const effort = useStore(reasoningEffortStore, (s) => s.effort);
  const setEffort = useStore(reasoningEffortStore, (s) => s.setEffort);
  const resolved = useStore(reasoningDefaultStore, (s) => s.resolved);
  const scope = useStore(reasoningDefaultStore, (s) => s.scope);

  // The trigger is the only thing visible without opening the menu, so it
  // carries the resolved level too — "Auto · Medium" rather than a bare
  // "Auto" that leaves the active level a mystery.
  //
  // Split into MODE and LEVEL because a narrow composer cannot afford
  // both. The level is the half worth keeping: it is what changes cost
  // and latency, and "which mode" is nearly always the default. See the
  // render below.
  const showsMode = effort === "default" && resolved !== null;
  const modeLabel = REASONING_EFFORT_LABELS.default;
  const levelLabel = showsMode
    ? REASONING_EFFORT_LABELS[resolved]
    : REASONING_EFFORT_LABELS[effort];
  const triggerLabel = showsMode ? `${modeLabel} · ${levelLabel}` : levelLabel;
  // `default` with nothing resolved is the one case with no level to draw —
  // the gauge shows an empty track rather than inventing one.
  const gaugeLevel: ResolvedReasoningEffort | null = effort === "default" ? resolved : effort;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-reasoning-effort-trigger
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1",
            "text-xs text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors",
            className,
          )}
          aria-label={`Intelligence: ${triggerLabel}`}
          title={`Intelligence: ${triggerLabel}`}
        >
          <EffortGauge level={gaugeLevel} />
          {/* In a narrow composer the WORDS drop and the gauge carries the
              level on its own. Dropping only the mode was not enough —
              "Medium" still cost more width than the message input could
              spare in a chat bubble, which is where this sits next to Send.
              The bars answer the same question in ~14px, and the full text
              stays in aria-label and title.

              A CONTAINER query, not a breakpoint: the bubble is a narrow
              panel inside a wide window, so viewport width says nothing
              about the space this button actually has. Polarity is
              deliberate — visible by default, hidden only when a
              container proves itself narrow, so a consumer that declares
              no container keeps the full label rather than silently
              losing it. */}
          <span className="whitespace-nowrap @max-[24rem]:hidden">
            {showsMode && `${modeLabel} · `}
            {levelLabel}
          </span>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Intelligence
        </DropdownMenuLabel>
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => setEffort(opt.value)}
            className="flex items-start gap-2"
          >
            {/* shrink-0: without it the icon is compressed on rows whose hint
                wraps to two lines (measured 11px instead of 16px), which
                shifts those titles left and breaks the column. */}
            <Check
              className={cn(
                "size-4 mt-0.5 shrink-0",
                effort === opt.value ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="flex flex-col">
              <span className="text-sm">{REASONING_EFFORT_LABELS[opt.value]}</span>
              <span className="text-xs text-muted-foreground">
                {opt.value === "default" ? autoHint(resolved, scope) : opt.hint}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
