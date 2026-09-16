---
"@iloveagents/foundry-web-ui": patch
"@iloveagents/foundry-web-voice": patch
---

Keep custom conversation surfaces full-height on the empty chat home, with an
optional composer takeover that preserves the speech-to-composer bridge and drafts.
Add opt-in relay acknowledgements for long agent runs, serialized with answer
speech and cancelled when answer text arrives, on interruption, completion or
disconnect. Hosts can leave the opening reply free of waiting acknowledgements.
Optional tool-activity descriptions provide spaced, deduplicated updates from the
current turn, with a maximum of three updates and no raw tool-result narration.
Keep the latest speaker's caption through playback pauses and empty transcript events.
