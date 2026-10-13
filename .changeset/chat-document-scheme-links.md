---
"@iloveagents/foundry-web-ui": patch
---

Preserve registered document URLs in chat Markdown so source links open through the host application at their cited location. Re-evaluate links when handlers are registered after history loads, while retaining the default safety rules for unhandled URLs and images.
