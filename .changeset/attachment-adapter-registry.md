---
"@iloveagents/foundry-web-ui": minor
---

Attachment adapter registry + Office MIME resolution + graceful drop rejection.

- `registerAttachmentAdapter(adapter)` — hosts can inject a custom composer
  attachment adapter (mirrors the `registerChatSlots` pattern); the AG-UI
  runtime falls back to the built-in `FileAttachmentAdapter` when none is
  registered.
- `resolveMimeType(file)` is now exported, and the extension→MIME fallback
  table covers `.xlsx` and `.pptx` (browsers often report an empty
  `file.type` for Office files).
- The chat drop zone now surfaces per-file rejections from the adapter's
  `add()` (previously an unhandled promise rejection and a silently missing
  attachment chip). Drops bypass the file picker's `accept` filter, so a
  composite adapter's "no matching adapter" error is the real gate — it now
  shows as a transient inline alert.
