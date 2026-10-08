# Opinionated form and renderer UX

This is the default contract for developers and coding agents using Foundry UI.
Use it for native UI, generated forms, list-item inspectors and custom renderers.
Depart from the default only when the user explicitly requests the different interaction
or layout. A request for a domain-specific renderer does not request a different UX.

## Semantic composition: decide what belongs where

Start from the person's task and the real schema, not a visual template or an
alphabetical dump of properties. Keep one semantic order in View, Edit and
Read-only. These placements are product defaults; preserve an established domain
workflow and depart only on explicit user instruction.

| Order | Content and purpose                                                         | Placement                                                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Identity and orientation: what item is this, what is this form for?         | One title, optional one-sentence purpose, parent/context when needed. Reuse identity already supplied by the host.                                                                                  |
| 2     | Current situation and next step: state, outcome, blocker requiring action.  | Compact status/summary near the title. Put an actionable blocker before affected fields; put field-specific errors at the field. Do not invent a status from completeness.                          |
| 3     | Core facts needed to recognise, assign or act on the record.                | First visible group: the relevant identity/name field, type/category, responsible person and date/deadline. Include only facts meaningful to this task.                                             |
| 4     | Main work: the decision or information the person is here to supply/review. | Clearly named sections, in task order. Put a prerequisite before its dependent field. Group related fields; put narrative explanations in full-width slots.                                         |
| 5     | Evidence and related material supporting the decision.                      | Citations, sources, attachments and related records near the finding they substantiate, or in a dedicated Evidence section. Keep links usable in reading mode.                                      |
| 6     | Secondary information that rarely changes the next action.                  | Additional details, collapsed only when safe. Technical identifiers, timestamps, audit/version information go last in metadata/support, never as primary editable fields.                           |
| 7     | Complete the current transaction.                                           | One Save/Cancel group for Edit/Create, owned by the host. Primary action last; destructive actions live separately with explicit meaning. Reading states have task actions instead of a submit bar. |

Required is a validation property, not the only ordering rule. Keep essential
inputs visible early; do not collapse a missing required input or an unresolved
error. Do not sort all required fields ahead of their prerequisites or split a
logical group. Use short, task-specific section names such as “Ownership”,
“Assessment” or “Evidence”; “Details” alone is not a useful name for every group.
One page title is level 1, sections below it level 2; an embedded form headed at
level 2 uses level 3 sections. Adjust semantic heading level without inventing
another typography style.

Before generating UI, map each applicable field to a group and explain its role
(identity, status, core fact, decision, evidence or metadata). Reuse schema labels,
help, options, applicability and persisted order; do not fabricate backend fields.
An existing empty value keeps its slot so later values and Edit do not move.
Store grouping in the schema or shared composition rather than separate read/edit
layouts. Keep summaries concise and grounded in saved values; avoid repeating
all the fields above the form.

## Reading, Read-only and temporarily disabled

| State                                     | Values and interactions                                                                                                                                                                        | Actions                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| View, with write access                   | Saved values as readable text, matching the edit field slots. Text selection, copying, links and context selection work.                                                                       | Explicit Edit is available. No Save/Cancel yet.                                                                         |
| Edit/Create                               | Controls replace values within the same sections and slots. Clearly explain required fields, validation and blockers.                                                                          | One Save/Create and Cancel transaction.                                                                                 |
| Read-only record                          | Same information hierarchy and normal text contrast, with readable/copyable values. Explain the reason once near the header when available, such as “Published version” or “Read-only access”. | No Edit, inline edit triggers or Save/Cancel. Reading actions, links, export and permitted discussion remain available. |
| One protected field in an editable record | Keep its saved value readable in its normal slot; explain the field-specific lock/managed-source reason.                                                                                       | Other writable fields still work. No editor or Save for this field.                                                     |
| Temporarily disabled control              | Retain the control while a prerequisite, save or load is pending; explain what enables it.                                                                                                     | Prevent duplicate/invalid action; restore availability when the condition resolves.                                     |

Use display values for a read-only record, not a page of grey disabled inputs.
Do not dim the whole form, hide meaningful values or show input-required/error
badges that the reader cannot act on. Keep an explicit empty state (“Not set”,
or the schema's display convention); zero and false remain real values.
Selection keeps the same leading context marker; it never grants write access.

Read-only is enforced by application permissions and save handlers, not by CSS.
When access is unknown, withhold writes until resolved. Field locks, edit rights
and review rights are distinct: check the actual permission for each action.
Historical snapshots must not mutate or review the live record. A permission
change must stop writes without silently losing a draft. Do not use blur to save.

## Compose the shipped presets

Import `FormLayout`, `FormHeader`, `FormSection`, `FormActions`, `Field`, `FieldSet`,
`ReadOnlyField`, `Input`, `Textarea` and `Button` from `@iloveagents/foundry-web-primitives`.
Use the existing themed `FormDialog`, `SurfaceCard` and `CollectionSurface` from
`@iloveagents/foundry-web-ui` for the host surface. These presets compose with them;
do not put another card around every field or another form inside a form.

```tsx
<FormLayout>
  <FormHeader title="Contact details" description="How we can reach you." />
  <FormSection title="Contact" description="Use your work contact details.">
    <Field label="Email" htmlFor="contact-email" hint="We use this for updates.">
      <Input id="contact-email" type="email" autoComplete="email" />
    </Field>
  </FormSection>
  <FormActions className="justify-end">
    <Button variant="outline" type="button">
      Cancel
    </Button>
    <Button type="submit">Save</Button>
  </FormActions>
</FormLayout>
```

The application supplies its save handlers and one outer `<form>` if needed.
Preset layout components do not submit, fetch or store data.

## Interaction contract

- Open (including a list double-click or keyboard activation) starts in reading mode.
  Edit is an explicit, discoverable action; Create starts in editing mode.
- Labels, field order, sections, width and value origins stay in the same slots when
  switching modes. Keep the field layout mounted and replace only the value/control.
  Preserve expanded sections and reading position. Empty values retain their slots.
- Prefer one column. Put a small pair on one row only when its meaning requires it.
  Long text gets its own full-width section. Use container width rather than screen width
  when forms appear in side panels.
- Inline edits have visible Edit, Save and Cancel controls, with keyboard access and
  focus restoration. Escape cancels; a multiline Enter writes a newline. Do not save
  long text on blur. Do not put links or other controls inside an edit button or label.
- The host owns identity, navigation and the transactional Save/Cancel controls.
  Embedded renderers do not repeat the host's title or submit controls.
- Retain dirty input on failed save or conflict. Show an actionable error and let the
  person retry. Explain a disabled Save; for long forms link errors to their fields.
- Associate labels with controls; use descriptive help and errors, not placeholders
  as labels. Use an accessible Dialog for modal detail views (focus trap, Escape,
  return focus), including mobile.

## Themes and spacing

Use semantic tokens (`background`, `card`, `foreground`, `muted-foreground`, `border`,
`primary`, `ring`, `destructive`) and the existing theme. Never invent a color palette,
hard-code white/black surfaces, or create a second theme in a custom renderer.
Tailwind spacing utilities resolve through the host's `--spacing` token.
The default rhythm is 8 units between sections, 4 between fields, 2 between actions
and between a heading and help. At the standard 4px unit these are 32/16/8px.
Use `density="compact"` for constrained inspectors; keep controls comfortably usable.
Use the host radius tokens. Read/edit mode does not change density.
Test light, dark, narrow containers, long labels, empty values, keyboard and errors.

## Evidence behind the default

Checked 2026-10-06:

- [Atlassian inline edit](https://atlassian.design/components/inline-edit/usage/)
  supports matched read/edit alignment and explicit controls, with special care for
  long text and blur behavior.
- [Carbon forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms)
  supports logical grouping, a single-column default, contextual spacing and useful
  validation timing.
- [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/) and
  [WAI validation](https://www.w3.org/WAI/tutorials/forms/validation/) ground naming
  and understandable errors.
- [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/)
  describes focused summaries linking errors to fields.

These are a baseline for usability checks, not a claim that the presets alone guarantee
accessibility or usability. Browser evidence must exercise the application's real flows.

## Release boundary

New presets must be released through Changesets before downstream applications import
them. A local sibling workspace can validate this source but cannot prove registry
availability. Downstream adapters may compose the already-published `FieldSet`, `Field`
and surface components until the preset release is available; then switch their internal
composition to these presets without changing the user-facing contract.

## Selection and active context

Use one quiet leading marker for selected blocks, fields, tabs and item panels:
2px wide, inset 6px vertically, theme primary at 55% opacity. The shared
`--selection-marker-width` and `--selection-marker-color` overrides may adapt it
to the theme. Selection changes no layout geometry and adds no colored outer
frame, fill or shadow. Workbench chrome uses a neutral theme border. Keyboard
focus, input validation, drop targets and pending-review frames keep their
respective semantics. Temporary windows remain identifiable through the unpinned
icon, accessible name and tooltip.

`ReadOnlyField label hint emptyLabel` renders a semantic label/value pair with
selectable text and usable links, preserving the `Field` spacing rhythm. Use it
for View/Read-only and keep the same `FormLayout`/`FormSection` composition.
`FormSection level={2}` pairs with a page-level `FormHeader level={1}`; its default
level 3 pairs with the default header level 2. The source preview opens in View
and lets you exercise Edit, Cancel/Save and simulated read-only access.

## Required indicators and field frames

Use quiet inline “(Required)” text in mixed Create/Edit forms; no pill or badge
frame. Do not show input requirements in View or permanently read-only records.
`Field` derives the visible marker from its single control's `required` or
`aria-required` state; use `ReadOnlyField` for reading states.
Keep `required`/`aria-required` on the actual control and actionable validation.
A star requires an explanation at the form start; when almost all fields are
mandatory, marking the exceptions “(optional)” is a valid explicit product choice.
See [W3C H90](https://www.w3.org/WAI/WCAG22/Techniques/html/H90) and
[GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/).

Display values use the same neutral theme border, radius and padding as their
editor, without pretending to be disabled controls. Multi-line values and editors
share line height and a minimum height; editors grow with their content. Reserve
the reading height on the actual textarea, not just its wrapper. Verify that the
textarea has no hidden lines and that following sections do not jump. Double-click
on form text stays in View so text selection works; explicit Edit enters editing.

Field frames and editors use the same theme radius, including enum/select buttons and multiline controls. Keep single-line heights consistent; chips have their own pill treatment. Group secondary metadata in a compact footer with one separator. Helpers explain meaningful decisions in everyday language, not storage formats or schema internals. Suggestion popovers anchor to the input, match its width, fit the viewport and support keyboard selection/dismissal.

## Keeping skill guidance current

Edit this document rather than reproducing the rules in plugin skills. Run `pnpm sync:form-ux` to regenerate their bundled `references/form-ux.md` resources. `pnpm check:form-ux` (part of `pnpm test` and CI) rejects stale resources. Skills read the bundled reference even when installed outside the framework checkout.

## Fixed content versus editable values

A catalogue question, instruction or computed explanation is content. Render it
without input chrome: `ReadOnlyField valueAppearance="content"`. The default
`valueAppearance="field"` preserves a framed value slot for records whose fields
become editable through Edit. Choose the presentation from the meaning of the
value, not the current page mode, so fixed content stays content in View and Edit.
Content remains selectable and links stay usable; do not replace it with a
disabled input. Appearance does not grant or revoke edit permission. Keep
permission enforcement and pending-change review independent of presentation.

## Lists and data tables

Use the shared `useDataTable` / `DataTableFrame` / `DataTableToolbar` /
`DataTable` / `DataTablePagination` family. Start with the person's task:
identify records, compare values, find exceptions or review a queue. Put the
identity column first and keep the fields needed for that task visible. Keep
metadata secondary; do not size columns alphabetically or from the longest
raw value. Long names must not push status and dates off-screen.

Define each column's `size`, `minSize` and `maxSize` in its `ColumnDef`.
Give identity/narrative columns more room than dates, states and numeric
values. The shared defaults are 80px minimum and 1200px maximum. The hook's
`defaultColumn` configures shared bounds; individual
columns override them. Mark selection and action columns
`enableResizing: false` and give them fixed bounds. Use `meta.align` for
numbers and short comparable values, with consistent formatting and units.
Do not apply a nested fixed `max-width` to text that should benefit from
resizing. Use truncation for long identity text, expose the full value on
hover, and make the item inspector the place to read/edit long content.

Users can resize a header's separate separator by dragging, use arrow keys
(Shift for larger steps), Home/End for bounds, and Enter or double-click to
reset. The resize target must not also sort. Honor `enableResizing` and
individual bounds. User widths are part of `DataTableState.columnSizing`;
URL state stores them under a namespaced `widths` key. Each list on a page
needs a stable unique URL prefix. User choices override author defaults;
reset widths separately from filters and sorting.

For an ordinary bounded list, pass `maxHeight` (a responsive value such as
`min(70vh, 42rem)`) and keep the header sticky. The table owns one row
viewport, while toolbar and paging controls stay outside it. Focus mode
uses `fill` to occupy the available panel height. Preserve horizontal
position while navigating rows vertically. Keep native wheel, trackpad,
touch and keyboard scrolling; never translate all vertical wheel events
into sideways scrolling. Bounded tables fit the current viewport and leave room for their scrollbar and
action row. Compose `DataTableFrame` with `DataTablePagination` so wrapped paging
controls contribute their actual height. `fitViewport={false}` opts out for a host that deliberately owns
that sizing. The native horizontal scrollbar and bottom arrow controls remain
reachable without first scrolling through every row.
Honor reduced motion. Keep essential information visible before overflow.
A frozen identity column must leave room for the scrolling columns. At narrow
widths the shared table releases a wide frozen prefix while keeping narrow
leading utility columns fixed when they fit; column widths remain unchanged.

`spacer={false}` lets the first content column use spare width, up to its
maximum. A user-resized column keeps its chosen width. The default spacer
keeps declared column widths and leaves spare room at the end. Explicit
responsive column gates are separate from persisted visibility; shrinking
the panel must never overwrite the user's column choices.

Configure default sorting, filters, visibility and page size through
`initialState` for an uncontrolled table, or through the URL adapter's
`defaults` when controlled. Use real schema values and stable IDs. Choose
a default sort meaningful to the workflow (for example latest activity,
nearest deadline, or priority), and show the active sort/filter controls.
An explicitly cleared filter or sort must stay cleared after reload. Do
not silently reapply author defaults over the user's state.

Check long/empty/mixed values, pointer and keyboard resizing, width reset,
filter/sort defaults and overrides, both scroll axes, sticky/frozen columns,
and light/dark themes in wide and narrow containers. Tests and screenshots
verify behavior; claims of improved enjoyment require task-based user testing.

This contract draws on [NN/g's table task research](https://www.nngroup.com/articles/data-tables/),
[React Spectrum's column resizing and persistence](https://react-spectrum.adobe.com/v3/TableView.html),
[WAI's keyboard interaction patterns](https://www.w3.org/WAI/ARIA/apg/patterns/grid/),
and [TanStack's column sizing contract](https://tanstack.com/table/v8/docs/guide/column-sizing).
These are complementary references, not a single design-system benchmark.

Paged bounded tables reserve a stable viewport when standard pagination has multiple pages, so the next/previous controls do not jump on a short final page. `stableHeight` explicitly overrides this behavior. Page changes return to the top while preserving the horizontal position; resizing columns preserves the current reading position.

Use a single native horizontal scrollport per table. Bottom arrows provide additional access to off-screen columns; do not duplicate the horizontal scrollbar with a synchronized second track.

## Wizards and process guidance

Use `ProcessSteps` for a connected status rail and `ProcessGuide` for that rail
plus a focused guidance/action panel. This section is the maintained component
contract; the standalone process guide and skill resources are generated from it.
Use a wizard for sequential input and a process overview for resumable work;
independent tasks belong in a task list rather than a misleading sequence.

- Start with `variant="compact"` and `guidance="collapsible"` when the guide
  accompanies page content. Use `framed` to make the rail and guidance read as
  one component; omit a duplicate frame inside an existing panel. Vertical
  rails center as a group while labels remain aligned to the start.
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
`orientation` (`responsive` or `vertical`, default `responsive`) and an accessible
`label` (default `Process progress`). Each step has a stable unique string `id`,
string `label`, and explicit `status`: `pending`, `ready`, `running`, `complete`,
`blocked`, `error` or `skipped`. Optional fields are `statusLabel` (localized text),
`description`, `message` and `selectable`. Only explicitly selectable steps with
an `onStepSelect` callback navigate; callbacks never advance actual progress.
A non-selectable blocked step with a message exposes a focusable tooltip.

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
| `formatPosition(index, total)`               | Localized position text; index is one-based.                                                |
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
  guidance="collapsible"
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
        <Button variant="outline" onClick={openDocumentEditor}>
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
      actions: <Button onClick={validateAndSaveReview}>Confirm review</Button>,
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
