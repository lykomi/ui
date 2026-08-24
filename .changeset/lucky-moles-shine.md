---
"@iloveagents/foundry-web-voice": patch
---

Republish with resolvable dependency ranges.

`0.1.0` went to npm carrying `workspace:^` for its two sibling dependencies
instead of the real ranges, so every install of it fails with
`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` and a scaffolded app cannot install at all.

The cause was the publish route, not the package: `pnpm publish` rewrites the
workspace protocol into a concrete range, `npm publish` uploads it verbatim,
and this first release was pushed by hand because the package did not exist
yet and OIDC cannot create one. Going back through the release workflow fixes
it, because that is the path where the rewrite — and `pack:check`, which
already refuses workspace ranges in a packed tarball — actually run.
