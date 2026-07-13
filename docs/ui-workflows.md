# UI Workflow Design

This document describes how the planned features should appear in the existing React app.

## Navigation Model

Current modes:

- Reader
- Council
- Settings

Add modes:

- Workspaces
- Search, optional later if search grows beyond the current main-pane overlay

Recommended sidebar order:

1. Reader
2. Council
3. Workspaces
4. Settings

Keep the book/chapter navigator visible in Reader mode. In Workspaces mode, replace the chapter grid with workspace-specific navigation if needed.

## Study Workspace Workflow

Primary flow:

1. User creates a workspace from the Workspaces view.
2. User reads, searches, or runs Council.
3. User chooses "Add to workspace" from an item action menu.
4. User selects an existing workspace or creates one inline.
5. Workspace detail view shows the item in context.
6. Sidebar workspace shortcuts reopen recent workspaces directly.

Workspace detail layout:

- Header: editable title and description, export actions, archive/delete actions.
- Left or top list: ordered items.
- Main content: selected item details.
- Empty state: compact prompt to add verses/search/Council results.

Item action conventions:

- Every workspace item: edit title, move up, move down, remove.
- Note/freeform: create from workspace detail, edit body, copy, include in Markdown export.
- Verse and verse range: copy, open in Reader, ask Council, explain.
- Search hit/search group: open verse, rerun saved query.
- Council result: restore in Council, copy Markdown.
- Explanation: render summary/context/cautions, open source passage, copy.
- Module entry: render module title/body, open source verse when available, copy.

## Verse Range Selection

Desktop behavior:

- Click verse number selects one verse.
- Shift-click verse number extends selection.
- Escape clears selection.
- Selecting outside the chapter clears selection unless an action panel is open.

Mobile/small-window behavior:

- Tap verse number selects.
- Second tap on another verse extends range if selection mode is active.
- Provide an explicit clear button.

Range action bar:

- Appears near the top of the chapter viewport or fixed at bottom of main pane.
- Shows citation and selected verse count.
- Actions: Copy, Highlight, Note, Ask Council, Explain, Add to workspace.
- Bookmark action saves the range under its citation.

## Markdown Export

Workspace export flow:

1. User opens workspace.
2. User clicks Export.
3. App opens a preview panel with Markdown.
4. User copies Markdown, saves it to the local app-data exports directory, or chooses a custom `.md` destination through the OS save dialog.

Preview requirements:

- Clearly show exported content.
- No hidden network calls.
- Include source references for Council results and module entries.
- Council result exports include cited evidence, dissent notes, and unresolved tensions when the saved result contains full response details.

Export format note: Markdown, HTML, and PDF exports all preserve Unicode — PDF
embeds the DejaVu Sans font, which covers accented Latin, Greek, and Hebrew.
PDF lays text out left-to-right with no bidirectional reordering, so Hebrew
appears in logical (not visual) order. It is not a tagged PDF/UA artifact.
The UI explicitly identifies HTML as the preferred accessible, reflowable
workspace export and Markdown as the preferred theology export; use those
formats whenever assistive technology or Hebrew word order matters.

## Reader Navigation

Bookmarks:

- Add bookmark action in verse panel and range action bar.
- Verse panel bookmark action accepts an optional label.
- Sidebar section lists bookmarks with citation and optional label.
- Bookmark click navigates to the passage.

Reading history:

- Sidebar section lists recent chapters.
- Record chapter changes after a short debounce.
- Keep history compact and non-intrusive.

Startup:

- Open last location if available.
- Otherwise default to Genesis 1 as today.

## Parallel Translation Layout

Layout controls:

- Columns
- Interleaved
- Compact
- Sync scroll

Columns:

- Existing behavior.
- Add optional scroll sync.

Interleaved:

- One passage stream.
- Each verse block contains each active translation.
- Best for comparing wording verse by verse.

Compact:

- Smaller spacing.
- Verse references stay aligned.
- Avoid truncating Bible text.

## Original-Language Tools

Word click behavior:

- Tagged word opens `WordStudyPanel`.
- Panel stays open while navigating occurrences.
- Occurrence click navigates Reader and keeps panel context.

Panel sections:

- Header: surface, lemma, Strong's code.
- Definition/gloss.
- Morphology.
- Occurrences grouped by book.
- Current verse context.

## Saved Searches

Save flow:

1. User enters query and filters.
2. User clicks Save Search.
3. App suggests title from query.
4. Saved search appears in sidebar/search panel.

Rerun flow:

- Clicking a saved search restores query and filters, then runs search.
- Saved search shortcut actions allow renaming or deleting the saved search.

Workspace integration:

- Add individual result to workspace.
- Select multiple results and add them to a workspace as a grouped search item.

## Council Retrieval Controls and Audit

Council form additions:

- Retrieval strategy: keyword, semantic, hybrid.
- Include cross-references toggle.
- Evidence translation.
- Restrict to book/testament/range.
- Evidence limit.

Keep defaults simple:

- Hybrid.
- Cross-references on.
- KJV unless user setting says otherwise.
- Evidence limit 60.

Audit view:

- Collapsed by default after answer.
- Sections:
  - Retrieved evidence
  - Used by synthesis
  - Used by voices
  - Retrieved but unused
- Retrieved evidence rows show classification badges: used, supporting, conflicting, ignored.
- Classification reasoning appears below the verse text when the provider supplies it.
- Every verse links back to Reader.
- A process view above the raw audit explains the Council flow in inspectable steps: retrieve bounded evidence, run provider voices, cluster arguments, and expose the audit.
- The leading-argument comparison explains why the top weighted position ranked above the nearest alternative using visible data: final weight, cited passages, voice agreement, and conflicting evidence.

## Explain Passage Mode

The next Council transparency UX expansion is planned in [`council-transparency-visualization-plan.md`](council-transparency-visualization-plan.md). It adds per-position evidence tabs, a voice agreement matrix, retrieval trace visualization, confidence rationale, and a raw source drawer.

Entry points:

- Verse panel.
- Range action bar.
- Workspace item action.

Result view:

- Summary.
- Literary/contextual notes.
- Key terms.
- Cross-references.
- Cautions or disputed points.

If the explanation detects a disputed theological question, offer "Ask the Council" instead of pretending one explanation is final.

## Settings and Diagnostics

Keep existing Settings diagnostics and expand as features land:

- Add module import status.
- Add installed module list with uninstall actions.
- Add corpus/version status.
- Add backup location.
- Add JSON import textarea with conflict strategy selector.
- Add SQLite backup and path-based restore controls.
- Add last successful export/import/restore status.

## Learning And Theology Extension

Detailed UX for phases 14-19 is in [`learning-ui-workflows.md`](learning-ui-workflows.md).

The extension adds:

- Council "My Judgment" workflow.
- Research Trail timeline.
- Argument Map tabs and annotations.
- Theology top-level mode.
- Resource browser and resource detail screens.
- Guided learning templates that ask for user reflection before AI output.
