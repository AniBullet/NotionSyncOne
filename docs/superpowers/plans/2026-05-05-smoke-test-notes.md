# Smoke Test Notes

Date: 2026-05-08

## Automated Startup Check

- Command: `npm.cmd run dev:start`
- Result: startup path succeeded for the observed 25 second window.
- Evidence:
  - Vite ready on `http://127.0.0.1:5173/`.
  - Electron process started from the repo.
  - Main services initialized.
  - Config loaded with Notion, WordPress, and Bilibili enabled.
  - Notion API fetched 310 articles and updated cache.

## Visual Workbench Check

- Result: passed for the default workbench view after disabling automatic DevTools.
- Evidence:
  - Workbench rendered 310 cached Notion articles.
  - Article cards rendered in a 4-column grid at the current desktop window size.
  - Cover images, titles, authors/dates, and compact status dots were visible.
  - Footer showed `已加载 310 篇文章`.
  - DevTools no longer opened by default after gating it behind `OPEN_DEVTOOLS=1`.

## Button State Check

- Result: passed for platform button state only; no sync operation was triggered.
- Evidence:
  - With no selected article, sync buttons were disabled.
  - After selecting one article, WeChat, WordPress, Bilibili, and All buttons became available.
  - Footer showed `已选择 1 篇`.

## Warnings Observed

- Existing dependency warning: `file-type@16.5.4` uses `eval`.
- Electron/DevTools noise:
  - `punycode` deprecation warning.
  - DevTools `Autofill.enable` and `Autofill.setAddresses` protocol errors.

These warnings did not stop app startup during the observed run.

## Manual Checks Still Needed

- Settings save:
- Notion list visual display: passed
- WeChat preview:
- WordPress button state: passed
- Bilibili button state: passed
- Updated workbench/card layout: passed for default desktop view
