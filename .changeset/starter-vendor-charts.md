---
"create-foundry-ui-app": patch
---

The starter's chunk rules learn about charts before they learn about
react: recharts' companions (react-smooth, the d3 sub-packages,
victory-vendor) matched the `react` substring rule and landed in
vendor-react, pushing it past the smoke gate's chunk-size limit — in a
starter that never imports a chart. They now route to a vendor-charts
chunk, which the bundler only emits when the app actually draws one.
