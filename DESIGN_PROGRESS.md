# Design progress

Audit 2026-11-19 (six widths, light and dark, home, tool pages, privacy, 404). No horizontal scroll at any width.

## Findings, worst first

1. [x] Home on phones: tool descriptions cut off with an ellipsis, hiding what each tool does. Now shown in full; the menu sheet stays compact.
2. [x] Monospace used for file sizes and counts inside sentences; looked inconsistent with the body type. Now the body face with tabular figures.
3. [x] Loaded file lists: long file names were cut off on phones; they now wrap on phones and truncate from 640 px up. Merge, split and compress states checked at 360, 390, 768, 1280, light and dark: consistent.
4. [x] Editor: the selected-item toolbar clipped the move-down and move-right arrows at 360 px; actions and arrows are now two groups that wrap. Page labels no longer use monospace. Text sheet and error pages checked: consistent.
5. [ ] Remaining: Lighthouse re-run, share images.

Note: the drawn-signature end-to-end test failed once in ten runs under load (passes alone); it is a timing flake in the test, not related to layout.

## Status

IN PROGRESS
