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

## Warnings Observed

- Existing dependency warning: `file-type@16.5.4` uses `eval`.
- Electron/DevTools noise:
  - `punycode` deprecation warning.
  - DevTools `Autofill.enable` and `Autofill.setAddresses` protocol errors.

These warnings did not stop app startup during the observed run.

## Manual Checks Still Needed

- Settings save:
- Notion list visual display:
- WeChat preview:
- WordPress button state:
- Bilibili button state:
- Updated workbench/card layout:
