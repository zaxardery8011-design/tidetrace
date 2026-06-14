# Tidetrace / 潮痕

Patrol the feed. Reply on the tide.

Tidetrace is a standalone Chrome MV3 extension for Threads patrol workflows: keyword highlighting, replied-post tracking, quick replies, random short phrases, and BYOK AI reply suggestions.

## Features

- Keyword patrol: highlight matching posts as the feed changes.
- Safety guardrails: configurable interaction-throttle warnings plus danger-zone keyword skipping to reduce account-risky workflows without blocking user control.
- Patrol dashboard: local scanned, highlighted, replied, skipped, and keyword-hit ranking stats with one-click reset.
- Replied tracking: stores post IDs in `chrome.storage.local` and marks replied posts with a badge.
- Reply modes: copy to clipboard or open the reply box and fill text for review.
- Reply library: edit reusable phrases locally.
- Random short phrases: bundled plain-text dictionary for lightweight replies.
- AI suggestions: Gemini, OpenAI, and Claude can generate three tones of replies.
- Selector layer: Threads DOM selectors are centralized in `skin/js/selectors.js`.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this folder: `C:\Users\User\Desktop\AIWORK\tidetrace`.
5. Open Threads and click the Tidetrace floating button.

No build step is required. This is plain MV3, vanilla JavaScript, CSS, and static assets.

## v1.1 Safety Guardrails And Dashboard

Tidetrace v1.1 keeps the extension semi-automatic: it never publishes for you and the new guardrails do not hard-block actions. The interaction throttle records recent copy/autofill reply interactions in `chrome.storage.local` and shows a non-blocking warning when your configured window and threshold are reached.

Danger-zone keywords are stored locally alongside patrol keywords. During patrol, posts that match danger-zone terms are skipped: Tidetrace does not highlight them or inject the quick reply button, and it can show a subtle skipped badge so you avoid high-friction threads.

The patrol dashboard stores local cumulative stats in `chrome.storage.local`: scanned posts, highlighted hits, replied interactions, danger-zone skips, and the top keyword hits. Use Reset stats from the panel to clear only the dashboard counters.

## AI BYOK

Open the Tidetrace panel, choose Gemini, OpenAI, or Claude, enter your API key and model, then save. Keys are stored in `chrome.storage.local`.

Risk notice: 金鑰僅存本機 chrome.storage.local、前端直連會暴露於本頁執行環境，請自負風險.

Claude direct browser calls require the `anthropic-dangerous-direct-browser-access` header. Tidetrace keeps that header only because the feature cannot work from a pure browser extension without it.

## Safety And ToS

Tidetrace does not automatically publish replies. It either copies text or fills the reply box so you can review before posting. You are responsible for how you use the extension and for complying with Threads, AI provider, and browser extension terms.

## Selector Maintenance

Threads can change DOM structure without notice. If reply buttons, post containers, or editable boxes stop being found, update `skin/js/selectors.js` first. The patrol and AI modules intentionally read selectors from that file instead of hard-coding page queries across the codebase.

## Reply Templates

Default reply templates are intentionally neutral and general-purpose. You can customize the library from the panel; changes stay local in `chrome.storage.local`.

## Acknowledgements

Tidetrace is derived from tingyi365/threadskit under the MIT license. Upstream copyright notice: Copyright (c) 2026 ThreadsKit Contributors.
