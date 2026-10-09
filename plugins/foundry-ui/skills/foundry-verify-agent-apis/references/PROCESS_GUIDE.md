<!-- Generated from docs/FORM_UX.md; do not edit. -->

## Wizards and process guidance

Use `ProcessSteps` for a connected status rail and `ProcessGuide` for that rail
plus a focused guidance/action panel. This section is the maintained component
contract; the standalone process guide and skill resources are generated from it.
Use a wizard for sequential input and a process overview for resumable work;
independent tasks belong in a task list rather than a misleading sequence.

- Start with `variant="compact"` and expanded guidance for an active task.
  Collapse only genuinely secondary help; do not hide the required next action. Use `framed` to make the rail and guidance read as
  one component; omit a duplicate frame inside an existing panel. Vertical
  rails center as a group while labels remain aligned to the start.
- Highlight the inspected compact step with a subtle primary fill and primary
  label; other steps use a quiet neutral surface. Keep the guidance unfilled,
  with a primary step label identifying its owner. The compact horizontal rail
  sits above the labels: completed segments and outlined checks use primary,
  unfinished segments stay neutral. Vertical connectors advance only between
  two completed steps. Reserve semantic warning/error colors for those states;
  inspection never changes status. Overview steps retain their selected border.
- Separate actual progress (`currentStepId`) from the inspected step
  (`selectedStepId`). Allow explicit navigation to completed steps so users can
  revise earlier inputs. Supply Back actions when useful. The host owns
  validation, persistence, permissions and invalidation of dependent results.
- Author the panel's `content` and `actions` with standard forms and Buttons.
  Use filled Buttons for the main forward transaction; outlined Buttons for
  revising completed input and Back. The component must not invent actions,
  choose their variants, or silently run jobs when a step is inspected.
- Announce actual current-step status changes even while an earlier step is
  inspected; do not announce whole forms or every progress tick. Running work
  needs honest task-specific progress rather than a percentage inferred from
  the step count. Use a task list for work without a meaningful sequence.
- Use explicit complete/ready/running/blocked/error/skipped/pending statuses.
  Compact locked steps use a short status; a `message` explains prerequisites
  on hover and keyboard focus, in detailed view and unfolded guidance. Errors
  remain visible. Do not communicate state through color alone.
- Preserve unsaved values while guidance is folded. Hosts persist drafts when
  navigating between steps; folding is not saving. Use theme semantic tokens,
  the accessible disclosure and reduced-motion behavior provided by the component.
- Native TypeScript verifies published installed-package exports. Stored JSX
  separately verifies the deployed renderer scope. New framework APIs must be
  published before downstream production consumers import them.

### Shared component API for builders

This self-contained contract is available in the bundled skill reference;
no framework repository checkout is needed. Verify the installed/deployed API
before authoring because a host may expose an earlier version.

`ProcessSteps` accepts `steps`, `currentStepId`, `selectedStepId`,
`onStepSelect(id)`, `variant` (`compact` or `overview`, default `compact`),
`orientation` (`responsive`, `vertical` or `horizontal`, default `responsive`),
`density` (`comfortable` or `compact`, default `comfortable`), optional
`showChevrons` (boolean, default false) and an accessible
`label` (default `Process progress`). Each step has a stable unique string `id`,
string `label`, and explicit `status`: `pending`, `ready`, `running`, `complete`,
`blocked`, `error` or `skipped`. Optional fields are `statusLabel` (localized text),
`description`, `message` and `selectable`. Only explicitly selectable steps with
an `onStepSelect` callback navigate; callbacks never advance actual progress.
A non-selectable blocked step with a message exposes a focusable tooltip.

`showChevrons` adds decorative separators only to horizontal `compact` navigation.
Their size and reserved gap follow `density`; the progress track stays above the
steps. Responsive narrow or explicitly vertical layouts retain their connected vertical
track, and `overview` is unchanged. Chevrons convey sequence, never status.

Horizontal rails retain readable minimum step widths and scroll inside their own viewport when needed. Overflow alone reveals previous/next buttons and subtle edge fades; swiping, trackpad scrolling and keyboard navigation also work. Scrolling never selects a step or advances progress. Selecting or focusing a step brings it into the rail viewport without scrolling the host page. Manual scrolling is not snapped back to the selected step. Buttons respect reduced motion and RTL. Localize their names with `scrollLabels={{ previous: "Previous steps", next: "Next steps" }}`.

Keep default `orientation="responsive"` for a full wizard: it stacks vertically in narrow containers. Use `orientation="horizontal"` for an embedded progress strip that should remain horizontal even on mobile. Guidance and host content remain outside the scroll viewport. Do not hide steps, truncate essential labels or make the entire page scroll sideways.

Use standalone `ProcessSteps density="compact"` for progress-only display: one
marker and label per step, with accessible status text. There is no guidance
panel. `onStepSelect(id)` is entirely host-owned: open a document picker,
navigate to a page or trigger another permitted action; it need not inspect
inline guidance. Omit the callback for a passive progress indicator.

`ProcessGuide` accepts the same props and adds per-step `title` (text), plus `content` and
`actions` (React nodes), plus these guide-level props:

| Prop                                         | Contract                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `framed`                                     | Optional themed frame; default false.                                                       |
| `headingLevel`                               | 2, 3 or 4; default 3.                                                                       |
| `guidance`                                   | `expanded` (default) or `collapsible`.                                                      |
| `defaultGuidanceOpen`                        | Initial uncontrolled disclosure state; default false.                                       |
| `guidanceOpen`, `onGuidanceOpenChange(open)` | Optional host-controlled disclosure state.                                                  |
| `guidanceToggleLabel`                        | Localized disclosure text; default `Guidance & actions`.                                    |
| `showPosition`                              | Optional numeric position in guidance; default false. The owning step label remains when the task title differs. |
| `formatPosition(index, total)`               | Localized position text when `showPosition` is true; index is one-based.                                                |
| `completion`                                 | Content shown only when no step is inspected/current and every step is complete or skipped. |

The selected step falls back to the current step if its ID is absent/invalid.
Changing inspected steps remounts their content; hosts must retain drafts outside
that content. Folding guidance keeps the same inputs mounted. Empty arrays render
nothing. The component never fetches, saves, authorizes, validates or runs a job.

Example composition, after availability is verified:

```jsx
<ProcessGuide
  framed
  variant="compact"
  guidance="expanded"
  currentStepId="review"
  selectedStepId={inspectedStep}
  onStepSelect={setInspectedStep}
  steps={[
    {
      id: "documents",
      label: "Documents",
      status: "complete",
      selectable: true,
      title: "Select the source documents",
      content: documentFields,
      actions: (
        <Button type="button" variant="outline" onClick={openDocumentEditor}>
          Change documents
        </Button>
      ),
    },
    {
      id: "review",
      label: "Review",
      status: "ready",
      selectable: true,
      description: "Check the findings before confirming.",
      content: reviewFields,
      actions: (
        <Button type="button" onClick={validateAndSaveReview}>
          Confirm review
        </Button>
      ),
    },
  ]}
/>
```

The host supplies the fields and handlers in this example, including saving
changes and invalidating results after source edits. In native TypeScript import
from the published package and its stylesheet. In stored JSX use only verified
scope symbols without imports.

### Design references

- [USWDS step indicator](https://designsystem.digital.gov/components/step-indicator/):
  distinguish current/completed/pending and keep explicit headings/navigation.
- [GOV.UK multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/):
  resumable work needs clear task statuses and prerequisites.
- [Carbon progress indicator](https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/guidelines):
  a stable sequence and validation are prerequisites for linear task guidance.
- [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):
  keyboard operation and expanded state for unfolding guidance.

These inform the design; usability with real users still needs validation.
