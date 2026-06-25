# Changelog

All notable changes to `ngx-email-studio` are documented here.

## 21.0.6

- Updated Angular runtime and build dependencies to `21.2.17` to pick up upstream security fixes for Angular common, core, and compiler packages.
- Aligned related Angular packages (`forms`, `platform-browser`, `router`, CLI/build tooling, and compiler-cli) to avoid peer dependency conflicts during clean installs.
- Verified clean install, library build, test suite, package packing, and production dependency audit after the security update.
- Prepared the `ngx-email-studio@21.0.6` patch release.

## 21.0.5

- Hardened MJML import so common raw ampersands in URL attributes, such as query strings, import safely without XML parser failures.
- Ignored unsafe non-positive MJML body widths during import instead of carrying invalid dimensions into exported output.
- Hardened Social logo uploads so stale async completions cannot write to the wrong row after item removal or reordering.
- Fixed root-rerouted nested drag/drop reorders so same-array moves keep the intended insertion slot.
- Added regression coverage for the MJML import, Social logo upload, and nested reorder edge cases.
- Published `ngx-email-studio@21.0.5` to npm with the `latest` dist-tag.

## 21.0.4

- Added body typography controls for email font size, font family presets/autocomplete, and safe Google Fonts CSS import settings.
- Added body wrapper border controls and preserved wrapper radius/border styling across editable preview and frontend HTML export.
- Added configurable custom Content module templates with safe Font Awesome/image icons and editable MJML template insertion.
- Added Tiptap rich-text image insertion through URL or host-provided upload helper, with safe URL sanitization.
- Added uploaded Social logo support, including square transparent custom-logo rendering in the editor, MJML export, HTML export, and import round-trips.
- Added a ready-to-run StackBlitz consumer demo under `examples/stackblitz/` and linked consumer setup docs.
- Improved nested custom-template drops so multi-block templates keep all flattened content when dropped into sections or columns.
- Improved the font-family autocomplete UI, including pointer-down option selection, shell styling, and left-aligned preset rows.
- Published `ngx-email-studio@21.0.4` to npm with the `latest` dist-tag.

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
