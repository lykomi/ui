# Process overview regression fixture

This isolated fixture uses synthetic labels and the real shared ProcessSteps
component. It does not connect to an application or a data service.

From the repository after the documented workspace install/build:

```sh
pnpm dlx @tailwindcss/cli@4 -i examples/process-overview/styles.css -o examples/process-overview/generated.css
pnpm --filter @iloveagents/foundry-web-shell exec vite ../../examples/process-overview --host 127.0.0.1 --port 5190
```

Query flags: `narrow`, `vertical`, `responsive`, `rtl`, `dark`, `details`,
`compact`, and `dense`. For example, `/?narrow&details&dark` checks the
overview overflow controls alongside long descriptions. Clicking a step
changes inspection only.

Run `node scripts/check-process-layout.mjs` against the running fixture to
check connector/card separation, arrow alignment, responsive orientation,
page containment and selection in both themes and directions.
