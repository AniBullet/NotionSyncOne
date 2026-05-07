# Repository Stabilization And Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize NotionSyncOne with focused tests, then split the large SyncService into smaller behavior-preserving modules.

**Architecture:** Keep user-visible behavior unchanged while extracting pure logic first, then state storage, then platform orchestration. Each task must be a small branch/PR-sized unit with tests and fresh `npm run check` plus `npm run build:dir` before commit.

**Tech Stack:** Electron 35, Vite 6, TypeScript, Node test runner, ESLint, electron-builder.

---

## Current Progress Snapshot

**Completed before this plan file:**
- Quality gates added to `package.json`: `check:type`, `check:lint`, `check:test`, `check`.
- Tests added for ConfigService base validation/defaults.
- Tests added for preload listener argument forwarding and listener removal.
- Tests added for SyncService cover URL, rich text HTML, list grouping, image URL mapping, and code block rendering.
- Extracted HTML/rich-text/title helpers from `src/main/services/SyncService.ts` into `src/main/services/sync/html.ts`.
- Latest completed commit on `codex/extract-sync-html-tools`: `6ad93b8 refactor: extract sync html helpers`.

**Completed after this plan file was created:**
- Dev startup stabilized: fixed Vite/Electron port alignment and Windows command runner behavior.
- ConfigService tests now cover Notion-required/WeChat-optional validation, encrypted secret reload, and deep merge.
- SyncService helper tests now cover tag extraction, cover/image helpers, renderer extraction, and state-store behavior.
- Extracted state storage into `src/main/services/sync/stateStore.ts`.
- Extracted platform sync orchestration into `wechatSync.ts`, `wordpressSync.ts`, and `bilibiliSync.ts`.
- Added focused workbench/settings UI status tests and compacted workbench controls, settings status, article card status dots, and sync action labels.

**Still open:**
- Manual app smoke test for settings save, Notion list load, WeChat preview, WordPress button state, and Bilibili button state.
- Build warning cleanup: only the `file-type@16.5.4` dependency eval warning is still present.
- Product UX improvements: readable sync errors, steadier WordPress/Bilibili long-task progress, and real-window startup/workbench smoke review.

---

## Execution Rules

- Use Chinese in user-facing updates.
- Do not continue piling changes on an unmerged branch unless the user explicitly asks.
- Prefer one branch/PR per task below.
- Before each code task, use `test-driven-development`.
- Before claiming completion or committing, use `verification-before-completion`.
- Verification for every code task:
  - `npm.cmd run check`
  - `npm.cmd run build:dir`
- Commit only scoped files for that task.
- If PowerShell displays Chinese as mojibake, do not rewrite Chinese-heavy files through shell redirection. Use `apply_patch`.

---

## Task 0: Finish Current HTML Helper Branch

**Purpose:** Close the already-created extraction branch before starting new work.

**Files:**
- Existing: `src/main/services/SyncService.ts`
- Existing: `src/main/services/sync/html.ts`
- Existing: `tests/sync-html.test.cjs`

- [x] **Step 1: Confirm worktree is clean**

Run:

```powershell
git status --short
git branch --show-current
```

Expected:

```text
codex/extract-sync-html-tools
```

No changed files should appear.

- [x] **Step 2: Push branch**

Run:

```powershell
git push -u origin codex/extract-sync-html-tools
```

Expected: branch pushed successfully.

- [x] **Step 3: Open PR**

Use the GitHub workflow or `gh pr create` if needed.

PR title:

```text
refactor: extract sync html helpers
```

PR body:

```markdown
## Summary
- Extract HTML/rich-text/title helper logic from SyncService into src/main/services/sync/html.ts
- Keep SyncService private methods as thin wrappers for compatibility
- Add focused helper tests

## Verification
- npm run check
- npm run build:dir
```

- [x] **Step 4: Merge PR after checks/review**

Expected: `main` includes commit `6ad93b8` or its squash equivalent.

---

## Task 1: Manual Smoke Test Baseline

**Purpose:** Verify the app still works from a user perspective before deeper refactors.

**Files:**
- No code changes expected.
- Optional note file if findings need tracking: `docs/superpowers/plans/2026-05-05-smoke-test-notes.md`

- [x] **Step 1: Start the app**

Run:

```powershell
npm.cmd run dev:start
```

Expected: Electron app opens without startup errors.

Verified on 2026-05-08 with `npm.cmd run dev:start`: Vite served `http://127.0.0.1:5173/`, Electron process started, services initialized, and Notion API fetched 310 articles. Remaining smoke steps still need interactive window checks.

- [ ] **Step 2: Test settings save**

Actions:
- Open settings.
- Save existing configuration without changing secrets.
- Confirm no validation error appears for optional WeChat/WordPress/Bilibili fields.

Expected: save succeeds if Notion required fields are present.

- [x] **Step 3: Test Notion list load**

Actions:
- Open the Notion article list.
- Trigger refresh/load if needed.

Expected: list loads or shows a clear config/network error.

Verified on 2026-05-08: the workbench rendered the Notion list with 310 articles, cached cards, cover images, footer status, and no default DevTools pane after the `OPEN_DEVTOOLS=1` gate was added.

- [ ] **Step 4: Test WeChat preview**

Actions:
- Pick one article.
- Open WeChat preview path.

Expected: preview opens, rich text/list/image/code content renders without obvious escaping regressions.

- [x] **Step 5: Test WordPress and Bilibili button state**

Actions:
- Inspect WordPress controls.
- Inspect Bilibili controls.

Expected: disabled/enabled state matches saved config, with no crash.

Verified on 2026-05-08: with no selected article, sync buttons were disabled; after selecting one article, WeChat, WordPress, Bilibili, and All buttons became available. No sync action was triggered.

- [ ] **Step 6: Record issues**

If problems appear, create a short note:

```markdown
# Smoke Test Notes

- Settings save:
- Notion list:
- WeChat preview:
- WordPress state:
- Bilibili state:
```

---

## Task 2: Complete ConfigService Test Guardrails

**Purpose:** Finish P1 ConfigService coverage before refactors.

**Files:**
- Modify: `tests/config-service.test.cjs`
- Read: `src/main/services/ConfigService.ts`

- [x] **Step 1: Write failing encryption/decryption test**

Add a test to `tests/config-service.test.cjs` that saves secrets, verifies disk values are encrypted, then creates a fresh `ConfigService` and verifies `getConfig()` returns decrypted values.

Test shape:

```javascript
test('ConfigService reloads encrypted secrets as plaintext config values', async () => {
  await withConfigService(async ({ configPath }) => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    const service = new ConfigService();

    await service.saveConfig({
      notion: { apiKey: 'notion-secret', databaseId: 'db-id' },
      wechat: { appId: 'wx-id', appSecret: 'wx-secret' },
    });

    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.match(saved.notion.apiKey, /^\[encrypted\]/);
    assert.match(saved.wechat.appSecret, /^\[encrypted\]/);

    delete require.cache[require.resolve('../src/main/services/ConfigService.ts')];
    const { ConfigService: FreshConfigService } = require('../src/main/services/ConfigService.ts');
    const freshService = new FreshConfigService();
    const loaded = await freshService.getConfig();

    assert.equal(loaded.notion.apiKey, 'notion-secret');
    assert.equal(loaded.wechat.appSecret, 'wx-secret');
  });
});
```

- [x] **Step 2: Run failing test**

Run:

```powershell
node --test tests\config-service.test.cjs
```

Expected: either fail for missing behavior or pass if behavior already exists. If it passes, keep it as regression coverage.

- [x] **Step 3: Write deep merge test**

Add a test that saves full config, then saves a partial nested update and confirms untouched nested platform config survives.

Test shape:

```javascript
test('ConfigService deep merges partial nested platform config', async () => {
  await withConfigService(async () => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    const service = new ConfigService();

    await service.saveConfig({
      notion: { apiKey: 'notion-secret', databaseId: 'db-id' },
      wechat: { appId: 'wx-id', appSecret: 'wx-secret' },
      bilibili: { enabled: true, titleTemplate: 'old {title}' },
    });

    await service.saveConfig({
      bilibili: { titleTemplate: 'new {title}' },
    });

    const loaded = await service.getConfig();
    assert.equal(loaded.bilibili.enabled, true);
    assert.equal(loaded.bilibili.titleTemplate, 'new {title}');
    assert.equal(loaded.wechat.appId, 'wx-id');
  });
});
```

- [x] **Step 4: Implement only if needed**

If tests fail due to real behavior gaps, modify only `src/main/services/ConfigService.ts`.

- [x] **Step 5: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

Expected: both exit 0.

- [x] **Step 6: Commit**

Run:

```powershell
git add tests\config-service.test.cjs src\main\services\ConfigService.ts
git commit -m "test: cover config encryption and deep merge"
```

---

## Task 3: Add SyncService Tag Extraction Guardrail

**Purpose:** Cover FeatureTag behavior before splitting more SyncService logic.

**Files:**
- Modify: `tests/sync-service.test.cjs`
- Read: `src/main/services/SyncService.ts`

- [x] **Step 1: Write failing test for WeChat tag extraction**

Add a test that calls the smallest currently accessible conversion method that includes `FeatureTag` in rendered article metadata. Prefer an existing helper already used by tests.

Test intent:

```javascript
test('SyncService renders FeatureTag metadata for select and multi_select values', () => {
  const service = createSyncService();

  const selectHtml = service.createArticleInfo(
    {
      title: 'Article',
      properties: {
        FeatureTag: { type: 'select', select: { name: 'AI' } },
      },
    },
    '',
    '',
    ''
  );

  assert.match(selectHtml, /AI/);
});
```

If `createArticleInfo` is not accessible or has different parameters, adjust test to call `convertToWeChatArticle` through the existing dynamic private-method access pattern used in this test file.

- [x] **Step 2: Run failing/passing targeted test**

Run:

```powershell
node --test tests\sync-service.test.cjs
```

Expected: test covers actual current behavior. If it already passes, keep as guardrail.

- [x] **Step 3: Implement only if behavior is missing**

Modify only `src/main/services/SyncService.ts` if the test reveals a true gap.

- [x] **Step 4: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

Expected: both exit 0.

- [x] **Step 5: Commit**

Run:

```powershell
git add tests\sync-service.test.cjs src\main\services\SyncService.ts
git commit -m "test: cover sync feature tag metadata"
```

---

## Task 4: Extract Cover And Image URL Helpers

**Purpose:** Continue P2 by moving cover/image extraction out of SyncService without behavior changes.

**Files:**
- Create: `src/main/services/sync/images.ts`
- Modify: `src/main/services/SyncService.ts`
- Add or modify: `tests/sync-images.test.cjs`
- Keep: existing `tests/sync-service.test.cjs` cover/image tests

- [x] **Step 1: Write helper tests first**

Create `tests/sync-images.test.cjs` with coverage for:
- page cover beats Cover property
- direct URL property
- rich_text URL property
- file/external block image URL extraction
- mapped uploaded image URL uses map value

- [x] **Step 2: Run red test**

Run:

```powershell
node --test tests\sync-images.test.cjs
```

Expected: fail because `src/main/services/sync/images.ts` does not exist yet.

- [x] **Step 3: Create image helper module**

Create exports:

```typescript
export function getCoverImageUrl(page: NotionPage): string
export function extractImageUrls(blocks: NotionBlock[], coverImageUrl?: string): string[]
export function resolveImageUrl(originalUrl: string, imageUrlMap?: Map<string, string>): string
```

Move logic from `SyncService.ts` with no behavior changes.

- [x] **Step 4: Replace SyncService methods with wrappers**

Keep private methods for compatibility:

```typescript
private getCoverImageUrl(page: NotionPage): string {
  return getCoverImageUrl(page);
}

private extractImageUrls(blocks: NotionBlock[], coverImageUrl?: string): string[] {
  return extractImageUrls(blocks, coverImageUrl);
}
```

- [x] **Step 5: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

Expected: both exit 0.

- [x] **Step 6: Commit**

Run:

```powershell
git add src\main\services\SyncService.ts src\main\services\sync\images.ts tests\sync-images.test.cjs tests\sync-service.test.cjs
git commit -m "refactor: extract sync image helpers"
```

---

## Task 5: Extract Notion Block Renderer

**Purpose:** Move block-to-HTML rendering out of SyncService after helper coverage exists.

**Files:**
- Create: `src/main/services/sync/notionToHtml.ts`
- Modify: `src/main/services/SyncService.ts`
- Add or modify: `tests/notion-to-html.test.cjs`
- Keep: `src/main/services/sync/html.ts`
- Keep: `src/main/services/sync/images.ts`

- [x] **Step 1: Write renderer tests**

Create tests for:
- paragraph/heading rich text rendering
- adjacent list grouping
- code block language label and line numbers
- image caption escaping
- file/video fallback rendering

- [x] **Step 2: Run red test**

Run:

```powershell
node --test tests\notion-to-html.test.cjs
```

Expected: fail because module does not exist yet.

- [x] **Step 3: Create renderer module**

Create exports:

```typescript
export function convertBlocksToHtml(
  blocks: NotionBlock[],
  imageUrlMap?: Map<string, string>,
  forWeChat?: boolean
): string

export function convertBlockToHtml(
  block: NotionBlock,
  imageUrlMap?: Map<string, string>,
  theme?: ThemeStyles,
  forWeChat?: boolean
): string
```

Move logic from `SyncService.ts`; import helpers from `sync/html.ts` and `sync/images.ts`.

- [x] **Step 4: Replace SyncService renderer methods with wrappers**

Keep current private methods as wrappers so existing callers and tests still work.

- [x] **Step 5: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

Expected: both exit 0.

- [x] **Step 6: Commit**

Run:

```powershell
git add src\main\services\SyncService.ts src\main\services\sync\notionToHtml.ts tests\notion-to-html.test.cjs
git commit -m "refactor: extract notion html renderer"
```

---

## Task 6: Extract Sync State Store

**Purpose:** Move state file read/write/reset logic out of SyncService.

**Files:**
- Create: `src/main/services/sync/stateStore.ts`
- Modify: `src/main/services/SyncService.ts`
- Create: `tests/sync-state-store.test.cjs`

- [x] **Step 1: Write state store tests**

Cover:
- missing state file initializes empty state
- load resets `SYNCING` to `FAILED`
- update merges results with existing results
- reset deletes one article state

- [x] **Step 2: Run red test**

Run:

```powershell
node --test tests\sync-state-store.test.cjs
```

Expected: fail because module does not exist yet.

- [x] **Step 3: Create state store module**

Create class:

```typescript
export class SyncStateStore {
  constructor(syncStateFile: string) {}
  get(articleId: string): SyncState | undefined
  getAll(): { [key: string]: SyncState }
  update(articleId: string, status: SyncStatus, error?: string, results?: SyncState['results']): SyncState
  reset(articleId: string): void
  resetStuck(stuckTimeoutMs: number, now?: number): string[]
}
```

- [x] **Step 4: Wire SyncService to SyncStateStore**

Replace direct `syncStates` and `syncStateFile` manipulation with store calls. Keep public methods unchanged:

```typescript
getSyncState(articleId: string): SyncState | undefined
getAllSyncStates(): { [key: string]: SyncState }
resetSyncState(articleId: string): void
resetStuckSyncStates(): void
```

- [x] **Step 5: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

Expected: both exit 0.

- [x] **Step 6: Commit**

Run:

```powershell
git add src\main\services\SyncService.ts src\main\services\sync\stateStore.ts tests\sync-state-store.test.cjs
git commit -m "refactor: extract sync state store"
```

---

## Task 7: Split Platform Sync Orchestration Last

**Purpose:** Separate WeChat, WordPress, and Bilibili flows only after pure helpers and state storage are stable.

**Files:**
- Create: `src/main/services/sync/wechatSync.ts`
- Create: `src/main/services/sync/wordpressSync.ts`
- Create: `src/main/services/sync/bilibiliSync.ts`
- Modify: `src/main/services/SyncService.ts`
- Tests: add focused tests only for pure decision logic; do not mock full platform APIs unless needed.

- [x] **Step 1: Identify constructor dependencies**

Map dependencies currently used by each flow:
- `notionService`
- `weChatService`
- `wordPressService`
- `bilibiliService`
- `configService`
- `SyncStateStore`
- `AbortController` map

- [x] **Step 2: Extract WeChat flow first**

Move `_syncArticleInternal` behavior into `wechatSync.ts` while leaving public `syncArticle()` on `SyncService`.

- [x] **Step 3: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

- [x] **Step 4: Commit WeChat extraction**

Run:

```powershell
git add src\main\services\SyncService.ts src\main\services\sync\wechatSync.ts
git commit -m "refactor: extract wechat sync flow"
```

- [x] **Step 5: Extract WordPress flow**

Move `_syncArticleToWordPressInternal` behavior into `wordpressSync.ts`.

- [x] **Step 6: Verify and commit**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
git add src\main\services\SyncService.ts src\main\services\sync\wordpressSync.ts
git commit -m "refactor: extract wordpress sync flow"
```

- [x] **Step 7: Extract Bilibili flow**

Move `syncVideoToBilibili` internals into `bilibiliSync.ts`.

- [x] **Step 8: Verify and commit**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
git add src\main\services\SyncService.ts src\main\services\sync\bilibiliSync.ts
git commit -m "refactor: extract bilibili sync flow"
```

---

## Task 8: Build Warning Cleanup

**Purpose:** Reduce build noise after behavior-sensitive refactors are done.

**Files:**
- Read/modify: `src/main/services/BilibiliService.ts`
- Maybe modify: dependency usage around `file-type`

- [x] **Step 1: Reproduce warnings**

Run:

```powershell
npm.cmd run build:dir
```

Record exact warnings.

Current exact warning from `npm.cmd run build:dir`:

```text
node_modules/.pnpm/file-type@16.5.4/node_modules/file-type/core.js (1419:16): Use of eval in "node_modules/.pnpm/file-type@16.5.4/node_modules/file-type/core.js" is strongly discouraged as it poses security risks and may cause issues with minification.
```

- [x] **Step 2: Fix Bilibili static/dynamic import warning if present**

Use one import style consistently in `BilibiliService.ts`.

Current status: no Bilibili static/dynamic import warning is present in the latest verified builds.

- [x] **Step 3: Leave dependency eval warning documented unless there is a low-risk upgrade**

If warning comes from `node_modules/.pnpm/file-type@16.5.4/...`, do not change dependency in this task unless tests and build show a safe upgrade path.

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd run check
npm.cmd run build:dir
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add src\main\services\BilibiliService.ts docs\superpowers\plans\2026-05-05-repo-stabilization-and-refactor.md
git commit -m "chore: reduce build warning noise"
```

---

## Task 9: Product UX Improvements

**Purpose:** Improve visible product behavior after internals are safer.

**Candidate sub-plans:**
- Configuration status detection: show which platforms can sync and which fields are missing. **Done for workbench/settings first pass.**
- Workbench sync entry clarity: readable labels, compact controls, and platform readiness dots. **Done.**
- Article cards: reduce repeated text, use compact status dots with accessible labels. **Done.**
- Sync failure messages: convert raw service/API errors into user-readable next steps.
- Long task progress: make WordPress/Bilibili status updates steadier.
- Startup responsiveness: separate cached state display from refresh operations.
- Real-window UI smoke review: verify actual default window layout, settings modal density, card spacing, and sync controls.

Task 9 has started only for low-risk UI clarity work. The behavior-sensitive UX items above remain open until manual app smoke testing is complete.

---

## Recommended Next Action

Next recommended action: run a real app smoke test for settings save, Notion list load, WeChat preview, WordPress/Bilibili button states, and the updated workbench/card layout. If that passes, merge this branch and clean old branches. If it fails, fix only the observed UI/runtime issue before doing more UX work.
