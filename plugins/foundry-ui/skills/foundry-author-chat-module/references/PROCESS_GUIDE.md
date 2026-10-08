<!-- Generated from docs/PROCESS_GUIDE.md; do not edit. -->

# Process guidance

`ProcessSteps` visualizes a process. `ProcessGuide` adds the inspected step's
heading, guidance, content and host-owned actions. Both ship from
`@iloveagents/foundry-web-ui`; import its `styles.css` once in the host.

Use a **wizard** for sequential input with a stable set of chapters. Use a
**process overview** for work that resumes across sessions or includes background
jobs. These share presentation, but the host owns validation, prerequisites,
saved state, permissions and navigation. For independent tasks without a
meaningful sequence, use a task list instead of connecting them into a path.

## Principles

- Name steps with short, recognizable labels. Use the focus heading and
  description to say what the person should do now.
- Keep actual process position (`currentStepId`) separate from the inspected
  step (`selectedStepId`). Going back never marks a later step incomplete or
  completed. `onStepSelect` is controlled and fires only for steps explicitly
  marked `selectable`; the host must enforce its navigation rules.
- Use `pending`, `ready`, `running`, `complete`, `blocked`, `error`, or `skipped`.
  They describe real state, not a guess from field completeness. Do not call
  skipped work complete. Override `statusLabel` for domain language/localization.
- Put failure or prerequisite explanations in `message`. They appear in the detailed rail and unfolded guidance. Compact rails keep
  prerequisite messages visually hidden (available to screen readers) and use
  the short “Blocked” status; failure messages remain visible. Locked steps with a `message` also expose that explanation on hover and
  keyboard focus, without becoming navigation buttons. Recovery actions belong in the
  affected step; never restart a job just because its step was clicked.
- A running job needs honest, task-specific progress in `content`. Do not infer
  elapsed-time percentages from the number of steps or invent a completion time.
- Use one primary action for the current transaction. Completed steps can remain selectable so users can revise earlier input.
  Supply Back, Continue,
  Retry, Save or Cancel through `actions`; validate/save in the host before
  advancing. Don't make a process indicator replace form navigation.
- Action hierarchy belongs to the host's standard Button variants. Use a filled
  primary action for the next commit or transition (Select documents, Confirm,
  Continue, Run). Use an outline action for revising completed input (Change
  documents, Edit setup), and a secondary/outline action for Back. A highlighted
  outline may use the theme's primary text/border tokens; never hardcode a brand
  color. The guide accepts actions without overriding their visual variant.
  Keep the filled action for the main forward task, rather than every editable
  step. For example, initial document selection can be filled, while changing
  an existing selection is outlined.
- Passive steps aren't buttons. Interactive steps use normal keyboard buttons;
  the actual step has `aria-current="step"`, and the inspected button has
  `aria-pressed`. Status is text and an icon, never color alone. State changes
  are announced without announcing whole forms or every progress tick.
- `variant="compact"` places markers beside labels and status for a slim rail.
  Pair it with `guidance="collapsible"` to keep the focused heading visible and
  unfold guidance, content and actions. Blocked steps use a short label; their prerequisite explanations appear
  in the detailed view and unfolded guidance. Failure messages stay visible. Forms remain mounted while folded, preserving unsaved input.
  Use `defaultGuidanceOpen` for the initial state, or `guidanceOpen` with
  `onGuidanceOpenChange` for host control. The uncontrolled state resets when
  the inspected step changes. Localize `guidanceToggleLabel` when needed.
  Keep guidance expanded for a full-page form where users need its fields to
  complete the task; use disclosure when the guide accompanies a working area.
- Set `framed` when embedding the guide in a content page. One themed border
  groups the rail and guidance, and the focus heading includes the inspected
  step name. Omit the frame when a surrounding panel already groups them.
- Responsive rails become a vertical flow based on available container width.
  The vertical rail is centered as a group, keeping labels aligned to the start.
  `orientation="vertical"` is useful in narrow panels. `variant="overview"`
  additionally shows descriptions for each step. Respect reduced motion.
- Empty step arrays render nothing. An absent/invalid current ID does not claim
  completion; `completion` appears only when all steps are complete or skipped.

## Example

```tsx
<ProcessGuide
  steps={[
    { id: "sources", label: "Sources", status: "complete", selectable: true },
    {
      id: "setup",
      label: "Setup",
      status: "ready",
      selectable: true,
      title: "Confirm the detected equipment",
      description: "Check each role and capacity before continuing.",
      content: <EquipmentForm />,
      actions: <Button onClick={validateAndSave}>Continue</Button>,
    },
    { id: "analyze", label: "Analysis", status: "blocked", message: "Confirm setup first." },
  ]}
  framed
  variant="compact"
  guidance="collapsible"
  currentStepId="setup"
  selectedStepId={inspectedStep}
  onStepSelect={setInspectedStep}
  headingLevel={2}
/>
```

Persistence and async work stay outside the component. It never fetches, saves,
runs validation, infers permissions or silently advances. Local source previews
may exercise new components; production consumers must wait for their published
package release before native imports; stored JSX also requires renderer scope
exposure before using a new API.

## Research

- [USWDS step indicator](https://designsystem.digital.gov/components/step-indicator/):
  distinguish current/completed/pending, keep explicit headings and navigation.
- [GOV.UK multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/):
  long-running, resumable work needs clear task statuses and prerequisites.
- [Carbon progress indicator](https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/guidelines):
  supports linear tasks with validation; avoid suggesting a fixed sequence for
  independent or unpredictable branching work.

- [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):
  keyboard operation and explicit expanded state for unfolding guidance.

These inform this design; usability with real users still needs validation.
