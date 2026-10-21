# Management dashboard

A responsive composition of the shared chart components: KPI sparklines,
revenue versus plan, a delivery gauge with its target, ranked bars and a donut.
The reporting-period selector updates the summary cards and revenue chart;
the breakdowns are explicitly full-year. All data is illustrative.

From this repository, after the documented workspace install and build:

```sh
pnpm dlx @tailwindcss/cli@4 -i examples/management-dashboard/styles.css -o examples/management-dashboard/generated.css
pnpm --filter @iloveagents/foundry-web-shell exec vite ../../examples/management-dashboard --host 127.0.0.1
```

Open the printed local URL, or add `?gallery` for the full component gallery.
Use **All components** / **Show dashboard** to switch views. Check desktop and phone widths, light/dark,
keyboard controls and chart tooltips. This example imports source to preview
unreleased framework APIs. Consumers must wait for the Changesets release,
then import from `@iloveagents/foundry-web-ui/chart`.
