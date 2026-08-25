---
"@iloveagents/foundry-web-ui": minor
---

Let a theme set the brand mark's height (`branding.logoHeight`)

The lockup pinned every mark to 20px. That is fine for an icon and wrong for
a wordmark that carries a tagline under the name — a common wordmark shape —
where 20px turns the tagline into a smear and the whole lockup reads as
undersized beside the product name. The tenant supplying the asset is the only
one who knows how much height it needs.

`branding.logoHeight` takes a CSS length (`"2rem"`, `"32px"`); unset keeps the
previous 20px, so no existing theme changes. Setting it also lifts the
max-width guard, since a taller mark is proportionally wider and the old 7rem
cap would letterbox exactly the marks that asked for more room.

The value reaches an inline style and themes are tenant-authored, so it is
allowlisted to a plain non-negative length in px/rem/em. Anything else —
`calc()`, `var()`, a url, a second declaration behind a `;` — is ignored in
favour of the default.
