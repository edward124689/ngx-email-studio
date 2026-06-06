# Changelog

All notable changes to `ngx-email-studio` are documented here.

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
