---
"@lykomi/web-ui": minor
---

`ui_capture_view` can black out texts and frame places before the image leaves the page. `redact` names texts to black out wherever the page shows them, form fields included; `mark` frames a control or heading by its label, numbered, with an optional label. The browser measures each place in the live DOM, paints over it on the captured canvas, and refuses the image if the page moved while it was drawn. The result reports how many places each text was blacked out in and which marks were found.
