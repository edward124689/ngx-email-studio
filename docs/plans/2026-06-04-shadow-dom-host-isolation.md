# Shadow DOM Host Isolation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add Shadow DOM isolation to the reusable `ngx-email-studio` component so host app CSS cannot break the builder UI, while preserving current Angular edit canvas, CDK drag/drop, TinyMCE editor, import/export modals, and iframe Preview mode.

**Architecture:** Treat Shadow DOM as a feature-flagged host-shell isolation layer first, not a rewrite. Keep parent Angular state/rendering exactly as-is, add `ViewEncapsulation.ShadowDom`, then fix the integration points that are known to cross the shadow boundary: tests, icons, CDK drag preview styling, and TinyMCE skin/chrome loading. Ship only after real browser smoke confirms drag/drop and TinyMCE are usable.

**Tech Stack:** Angular 21 standalone component, `ViewEncapsulation.ShadowDom`, Angular CDK drag/drop, TinyMCE Angular wrapper, inline/SVG or self-hosted icon fallback, Vitest/Angular unit tests, demo browser smoke.

---

## Review Summary

Current implementation is a single standalone Angular component:

- Main file: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Component declaration: lines `66-879`
- Styles are inline in component metadata: lines `686-878`
- No existing `encapsulation` option yet.
- Current Preview mode already uses isolated iframe `srcdoc`: lines `237-245` and `1566-1571`.
- Current CDK drag/drop is still parent-page DOM based: palette/root/columns/sections at lines `115-123`, `198-205`, `596-604`, `638-651`.
- Current icons rely on global Font Awesome classes such as `fa-envelope-open-o`, `fa-upload`, `fa-download`: lines `78`, `84`, `87`, etc.
- TinyMCE is embedded in inspector/modal: lines `328-334`, `507-513`; init config is at lines `1603-1630`.
- Most component DOM querying already uses `hostRef.nativeElement`, which is good for Shadow DOM: lines `1531-1549`.

## Decisions Confirmed

- Shadow DOM should isolate the reusable library shell from host CSS.
- Keep the existing Angular canvas in Edit mode for now.
- Keep iframe Preview mode as-is; Shadow DOM is for the builder shell, iframe is for exported email preview.
- Do not reintroduce full editable iframe work in this plan.

## Open Questions

1. Should Shadow DOM be always-on in `0.0.1`, or config gated first?
   - Recommended: config-gated first with default `false` during spike, then flip default only after browser smoke.
   - Practical note: Angular `encapsulation` is static, so a true runtime toggle needs either two wrapper components or a separate spike branch. For normal implementation, use branch-level spike then merge always-on if green.
2. If TinyMCE skin does not render inside shadow root, should we:
   - inject TinyMCE skin CSS/link into the shadow root;
   - fall back to plaintext editor under Shadow DOM;
   - or defer Shadow DOM until TinyMCE supports it cleanly?
   - Recommended: try shadow-root skin injection first; fallback plaintext only as temporary non-release option.
3. Should Font Awesome remain a host dependency?
   - Recommended: no. For Shadow DOM, replace visual dependency with internal inline icons while preserving semantic FA icon names in the data model/config.

---

## Phase 0: Baseline and Safety

### Task 0.1: Create Shadow DOM spike branch

**Objective:** Keep this isolated from main until browser behavior is proven.

**Files:** none

**Steps:**
```bash
git checkout -b spike/shadow-dom-host-isolation
npm run build:lib
npm test -- --watch=false
```

**Expected:** current baseline build/tests pass before any Shadow DOM change.

### Task 0.2: Add test helper for querying through shadow root

**Objective:** Make tests compatible with both light DOM and Shadow DOM.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation sketch:**
```ts
function studioRoot(fixture: ComponentFixture<NgxEmailStudio>): ParentNode {
  return fixture.nativeElement.shadowRoot || fixture.nativeElement;
}

function query<T extends Element = Element>(fixture: ComponentFixture<NgxEmailStudio>, selector: string): T | null {
  return studioRoot(fixture).querySelector(selector) as T | null;
}
```

**Steps:**
1. Replace direct `fixture.nativeElement.querySelector(...)` assertions for component internals with `query(fixture, ...)`.
2. Keep host-level assertions on `fixture.nativeElement` only when intentionally checking the custom element host.
3. Run:
   ```bash
   npm test -- --watch=false
   ```

**Expected:** tests still pass before enabling Shadow DOM.

---

## Phase 1: Enable Shadow DOM on the component

### Task 1.1: Add `ViewEncapsulation.ShadowDom`

**Objective:** Put all builder shell DOM/styles inside the component shadow root.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation sketch:**
```ts
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ngx-email-studio',
  standalone: true,
  encapsulation: ViewEncapsulation.ShadowDom,
  ...
})
export class NgxEmailStudio implements OnChanges {}
```

**Test:**
```ts
it('should render the builder inside a shadow root', () => {
  fixture.detectChanges();
  expect(fixture.nativeElement.shadowRoot).toBeTruthy();
  expect(query(fixture, '.nes-shell')).toBeTruthy();
});
```

**Verify:**
```bash
npm run build:lib
npm test -- --watch=false
```

### Task 1.2: Harden host-level reset carefully

**Objective:** Block host CSS leakage without breaking layout/fonts/forms.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**Implementation sketch:**
```css
:host {
  all: initial;
  --nes-accent: #2563eb;
  --nes-success: #16a34a;
  --nes-ink: #0f172a;
  --nes-muted: #64748b;
  --nes-border: #d9e2ec;
  --nes-panel: #ffffff;
  --nes-soft: #f8fafc;
  --nes-grid: rgba(148, 163, 184, .18);
  display: block;
  box-sizing: border-box;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--nes-ink);
}

*, *::before, *::after {
  box-sizing: border-box;
}
```

**Caution:** Add `all: initial` only after basic Shadow DOM render passes. If it breaks form controls/TinyMCE, keep the current lighter `:host` reset and rely on Shadow DOM isolation.

---

## Phase 2: Replace global Font Awesome dependency

### Task 2.1: Add internal icon rendering strategy

**Objective:** Avoid relying on global `.fa` CSS, which does not cross into Shadow DOM.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Recommended approach:**
- Keep `PaletteItem.icon` values as FA-compatible names (`fa-font`, `fa-picture-o`) for API/data compatibility.
- Render internal icons with a small helper instead of relying on Font Awesome font CSS.
- Use simple inline SVGs or text-safe fallback glyphs inside `.nes-icon`.

**Implementation sketch:**
```html
<span class="nes-icon" [attr.data-icon]="iconKey(item.icon)" aria-hidden="true">
  <svg *ngIf="iconSvg(item.icon) as svg" [innerHTML]="svg"></svg>
</span>
```

If inline SVG in template is too noisy, use a switch/helper:
```ts
iconLabel(icon: string): string {
  return ({
    'fa-font': 'T',
    'fa-picture-o': '▧',
    'fa-columns': '▥',
    'fa-download': '↓',
    'fa-upload': '↑',
  } as Record<string, string>)[icon] || '•';
}
```

**Tests:**
- Header still shows a visible logo icon without requiring `.fa-envelope-open-o` CSS.
- Palette icons render inside `shadowRoot`.
- No test depends on external Font Awesome stylesheet.

### Task 2.2: Keep backward-compatible CSS classes only as metadata

**Objective:** Do not break host apps or tests that inspect FA names, but avoid using them as the actual visual layer.

**Implementation sketch:**
```html
<span class="nes-icon" [attr.data-fa]="item.icon" aria-hidden="true">{{ iconLabel(item.icon) }}</span>
```

---

## Phase 3: Fix CDK drag/drop shadow-boundary issues

### Task 3.1: Keep CDK drag previews inside the shadow tree

**Objective:** `.cdk-drag-preview` styles currently live in component CSS. If CDK appends previews to `document.body`, Shadow DOM styles will not apply.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation options:**
1. Preferred first try: add `previewContainer: 'parent'` in `CDK_DRAG_CONFIG` if Angular 21 type supports it.
2. Otherwise add `[cdkDragPreviewContainer]="'parent'"` to every `cdkDrag` used by palette/root/child nodes.
3. If parent container causes clipping, use custom `cdkDragPreview` templates inside the shadow tree.

**Places to update:**
- Palette cards: around line `123`
- Root canvas nodes: around line `218`
- Column children: around line `621`
- Section children: around line `663`

**Test strategy:**
- Unit tests can confirm bindings/classes exist, but real drag preview must be browser-smoked.
- Keep current drop behavior tests for palette-to-section/column/root.

### Task 3.2: Browser smoke drag/drop

**Objective:** Verify actual user interaction, not only unit tests.

**Steps:**
```bash
npx ng serve demo --host 127.0.0.1 --port 4210
curl -I http://127.0.0.1:4210/
```

Then browser-smoke:
- Drag `Text paragraph` from Content modules into root canvas.
- Drag `Image placeholder` into a Section.
- Drag into a Row column.
- Reorder same-parent blocks.
- Confirm red insertion line / placeholder is visible and styled.
- Confirm no preview ghost appears unstyled at page body level.

---

## Phase 4: TinyMCE Shadow DOM compatibility

### Task 4.1: Check TinyMCE chrome/skin in shadow root

**Objective:** Identify whether TinyMCE toolbar chrome styles load correctly inside Shadow DOM.

**Files:**
- No code first; run browser smoke after Phase 1.

**Smoke checks:**
- Select a text block.
- Inspector inline TinyMCE appears, toolbar visible, not `visibility:hidden`.
- Click `Open editor`; large modal TinyMCE appears, toolbar visible.
- Type content; canvas updates.
- Confirm self-hosted TinyMCE assets load under current base URI:
  ```bash
  curl -I http://127.0.0.1:4210/tinymce/tinymce.min.js
  curl -I http://127.0.0.1:4210/tinymce/skins/ui/oxide/skin.min.css
  ```

### Task 4.2: If TinyMCE skin fails, inject skin CSS/link into shadow root

**Objective:** Put required TinyMCE skin CSS where Shadow DOM can see it.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**Implementation sketch:**
```ts
private ensureTinyMceSkinInShadowRoot(): void {
  const root = this.hostRef.nativeElement.shadowRoot;
  if (!root || root.querySelector('link[data-nes-tinymce-skin]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${this.resolveTinyMceBaseUrl()}/skins/ui/oxide/skin.min.css`;
  link.setAttribute('data-nes-tinymce-skin', 'true');
  root.appendChild(link);
}
```

Call it after view init / before opening editor if needed. If `document` access is added, guard for SSR/tests.

**Tests:**
- Stub `shadowRoot.querySelector` path or verify link exists after `fixture.detectChanges()` if implementation injects eagerly.
- Existing TinyMCE base URL tests must remain green.

---

## Phase 5: Modal/dropdown/clipboard regression

### Task 5.1: Verify top toolbar menu and modals inside shadow root

**Objective:** Ensure fixed modals/dropdowns still render above the builder and are queryable from `shadowRoot`.

**Tests:**
- Import button opens `.nes-import-modal` in `shadowRoot`.
- Export dropdown opens `.nes-export-menu` in `shadowRoot`.
- HTML output modal opens `.nes-output-modal` in `shadowRoot`.
- Rich text modal opens `.nes-rich-text-modal` in `shadowRoot`.
- Copy fallback still uses `document.body` and cleans up textarea.
- Preview window still writes generated HTML.

### Task 5.2: Verify host CSS cannot mutate internal UI

**Objective:** Prove Shadow DOM solves the original problem.

**Test idea:** create a host wrapper component with hostile global styles:
```css
button { padding: 0 !important; border-radius: 0 !important; }
div { display: flex !important; }
img { border-radius: 999px !important; }
* { box-sizing: content-box !important; }
```

Then assert inside `shadowRoot`:
- `.nes-builder` still has grid layout.
- `.nes-toolbar button` still has library button padding/radius.
- `.nes-render-image` keeps library styles.

---

## Phase 6: Full verification and release path

### Task 6.1: Run normal project checks

```bash
npm run build:lib
npm test -- --watch=false
npm run build
npm run pack:lib
```

**Expected:** all pass. Demo build warnings from budgets are acceptable only if pre-existing and non-blocking.

### Task 6.2: Clean consumer install smoke

```bash
npx -y @angular/cli@21 new ngx-email-studio-shadow-consumer --directory /tmp/ngx-email-studio-shadow-consumer --standalone --routing=false --style=scss --package-manager=npm --skip-git --skip-install --defaults
cd /tmp/ngx-email-studio-shadow-consumer
npm install
npm install /Users/edward/Desktop/ngx-email-studio/ngx-email-studio-0.0.1.tgz @angular/cdk@21 @tinymce/tinymce-angular tinymce
npx ng build
```

Then add hostile global CSS in the consumer app and rebuild/smoke render.

### Task 6.3: Demo browser smoke checklist

- Builder renders inside `ngx-email-studio.shadowRoot`.
- Host page global CSS does not affect internal buttons/layout/images.
- Palette drag/drop works.
- Section/column direct drags work.
- Outline same-parent drag reorder works.
- Inline TinyMCE visible and editable.
- Large TinyMCE modal visible and editable.
- Import modal malformed MJML error still works.
- Export MJML/HTML modal works.
- HTML Preview window writes formatted HTML.
- Preview mode iframe still works and media query reacts at `400px`.

### Task 6.4: Commit/push/deploy only after green smoke

```bash
git status --short
git add projects/ngx-email-studio/src/lib/ngx-email-studio.ts projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts docs/plans/2026-06-04-shadow-dom-host-isolation.md

git commit -m "feat: isolate email studio shell with shadow dom"
git push
npm run deploy:pages
```

Pages verification:
```bash
curl -L https://edward124689.github.io/ngx-email-studio/ -o /tmp/ngx-email-studio-pages.html
# verify current hashed JS/CSS return HTTP 200
# grep bundle for durable markers: ViewEncapsulation.ShadowDom, nes-icon, cdkDragPreviewContainer or previewContainer
curl -I https://edward124689.github.io/ngx-email-studio/tinymce/tinymce.min.js
curl -I https://edward124689.github.io/ngx-email-studio/tinymce/skins/ui/oxide/skin.min.css
```

---

## Recommended Implementation Order

1. Test helper for shadowRoot queries.
2. Flip `ViewEncapsulation.ShadowDom`.
3. Replace/insulate Font Awesome icons.
4. Fix CDK drag preview container.
5. Browser-smoke TinyMCE; patch skin injection only if needed.
6. Add hostile host CSS regression test.
7. Run build/test/pack/consumer smoke.
8. Commit/push/deploy after all checks pass.

## Non-goals

- Do not move edit canvas into iframe in this plan.
- Do not rewrite MJML compiler/parser.
- Do not add new semantic block types.
- Do not require host apps to load Font Awesome globally for internal UI.
- Do not silently downgrade TinyMCE to plaintext in release unless user explicitly accepts that trade-off.
