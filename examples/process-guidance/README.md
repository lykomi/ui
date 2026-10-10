# Compact process guidance example

Render this composition in a Foundry starter with its existing Vite and Tailwind pipeline, as with the form preset example. It uses the actual source `ProcessGuide`, not a separate mock.

Guidance starts collapsed. Selecting any inspectable step opens its guidance, including selecting the same step again. The separate chevron toggles guidance without selecting or advancing a step, and folding keeps inputs mounted. Draft values are owned by the host. Try each step at desktop and narrow widths in light and dark themes.

Use `guidance="collapsible"` and `guidanceTogglePlacement="step"` for this behavior. `defaultGuidanceOpen` configures initial state; `guidanceOpen` and `onGuidanceOpenChange` allow host-controlled state. Downstream consumers must wait for the package release before using the new prop.
