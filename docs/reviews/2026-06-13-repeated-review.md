# Repeated review summary — 2026-06-13

Time: 2026-06-13 12:40 HKT
Project: `ngx-email-studio`
Scope: repeated adversarial review of the current clean `main` checkout.

## Review tracks performed

1. **Security / import-export / sanitizer path**
   - Reviewed MJML import, MJML/HTML export, rich-text sanitizer, transform utilities, output modal copy/preview handling.
   - Checked unsafe URL/style surfaces, rich-text unwrapping, XML parser handling, sandboxed HTML preview, and honest clipboard state.

2. **Tiptap / ProseMirror lifecycle and browser interaction**
   - Reviewed managed Tiptap editor creation, inline/modal editor sync, DOM/document listener cleanup, RAF/timeout guards, cursor/selection handling, toolbar state, and readonly behavior.

3. **Angular host input / CDK drag-drop / package readiness**
   - Reviewed `[mjml]` vs `[document]` precedence, transient UI cleanup on replacement, palette/drop-list guards, cyclic/invalid nested drop prevention, readonly direct method guards, compact panel sync, and library package metadata.

## Findings

- No blocking issue was found.
- Worktree had no source diff before review, and no files were modified during the review pass.
- One non-blocking UX improvement was noted: Tiptap undo/redo toolbar buttons can visually remain enabled when no editor history is available because their disabled state is mostly `readonly`-based. The command safely no-ops, so this is not data-corrupting.

## Verification commands and results

```bash
npm test -- --watch=false
```

Result: passed.

```text
175 tests passed
exit_code 0
```

```bash
npm run build:lib
npm run smoke:tiptap
npm run smoke:tiptap-cursor
git diff --check
git status --short
```

Result: passed.

```text
Built ngx-email-studio
Tiptap browser smoke passed
Tiptap cursor smoke passed
git diff --check clean
git status clean
```

Security diff scan result:

```text
Hardcoded secret patterns: none
Shell injection patterns: none
Dangerous eval/exec: none
Unsafe deserialization: none
SQL string formatting: none
```

Live GitHub Pages smoke:

```text
https://edward124689.github.io/ngx-email-studio/ -> HTTP 200
<app-root> present
<base href="/ngx-email-studio/"> present
main asset HTTP 200
styles asset HTTP 200
```

## Current status after review

- Local repo was clean after the review.
- No code fix was required.
- No deployment was performed as part of the review because there were no code changes.
- Suggested future polish: make Tiptap undo/redo button disabled state snapshot-backed for better UX/a11y.
