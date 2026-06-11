# Changelog

All notable changes to `ngx-email-studio` are documented here.

## 21.0.4

- Added body typography controls for email font size, font family presets/autocomplete, and safe Google Fonts CSS import settings.
- Added body wrapper border controls and preserved wrapper radius/border styling across editable preview and frontend HTML export.
- Added configurable custom Content module templates with safe Font Awesome/image icons and editable MJML template insertion.
- Added Tiptap rich-text image insertion through URL or host-provided upload helper, with safe URL sanitization.
- Added uploaded Social logo support, including square transparent custom-logo rendering in the editor, MJML export, HTML export, and import round-trips.
- Added a ready-to-run StackBlitz consumer demo under `examples/stackblitz/` and linked consumer setup docs.
- Improved nested custom-template drops so multi-block templates keep all flattened content when dropped into sections or columns.
- Improved the font-family autocomplete UI, including pointer-down option selection, shell styling, and left-aligned preset rows.

## 21.0.3

- Added the Data Set merge-tag helper modal for host-provided reference keys.
- Added the Text Transform tool with whole-email Simplified/Traditional Chinese conversion and safe merge-tag preservation.
- Added the Image Upload Helper for image blocks via `config.uploadImage(file, context)`, including local preview, uploaded URL writeback, optional alt updates, undo/history integration, and PNG/JPEG/WebP/GIF validation.
- Hardened Image Upload Helper async state: stale uploads are ignored after document replacement, readonly/config changes, handler mutation, removed nodes, unsafe URLs, failures, or unsupported files.
- Clarified install docs and peer dependencies, including `@angular/platform-browser` and automatic `opencc-js` installation.
- Added Google Analytics to the demo page only; the npm package remains free of analytics scripts.
- Published `ngx-email-studio@21.0.3` to npm with the `latest` dist-tag.

## 21.0.2

- Added document-level undo/redo controls for builder editing.
- Added rich text DIV block formatting and hardened DIV paragraph conversion/import flows.
- Preserved pasted/imported rich text styles including font weight, selection state, and safe media cleanup.
- Restored canvas drag-and-drop behaviour for nested columns and root structural drops.
- Refined canvas selection/highlight handling so drag operations no longer leave stale visual highlights.
- Added Tiptap browser smoke coverage for editor rendering and cursor behaviour.
- Published `ngx-email-studio@21.0.2` to npm with `latest` dist-tag.

## 21.0.1

- Added a visual README screenshot for the Email Studio builder.
- Published the public npm package with updated package metadata.
- Added GitHub Release and GitHub Packages publication workflow.

## 21.0.0

- First public npm release for Angular 21.
- Includes MJML import/export, clean browser-side HTML export, drag-and-drop builder UI, responsive preview, Tiptap rich text editing, and standalone Angular component API.
