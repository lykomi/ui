---
"create-foundry-ui-app": patch
---

Doc cleanup: remove dangling `FOUNDRY_UI_TOKEN` references in README/AGENTS/template/help-text. They were left over from the era when the lastspace preset was fetched from GitHub Packages with that token; that fetch path was replaced with a no-auth npmjs registry fetch in the previous release.

The customer-side env var is now consistently named `LASTSPACE_TOKEN` (authenticates lastspace-private resources: Docker image, npm @lastspace scope, Python packages). No code-path changes — purely documentation alignment.
