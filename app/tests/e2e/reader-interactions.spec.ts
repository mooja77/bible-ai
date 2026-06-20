/**
 * Interaction smoke tests for reader features beyond first paint:
 *   - cross-refs panel opens when a verse number is clicked
 *   - FTS search returns hits and clicking a hit navigates the reader
 */

import { browser, $, $$, expect } from "@wdio/globals";

describe("Reader interactions", () => {
  it("opens the verse panel when a verse number is clicked", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    // Wait for the default chapter to render (Genesis 1).
    const verseHeading = await $("h1*=Genesis");
    await verseHeading.waitForDisplayed({ timeout: 10_000 });

    // Verse numbers render as <button aria-label="Verse N actions">.
    await clickVerseAction('button[aria-label*="Verse"][aria-label*="actions"]');

    // The panel header reads "Verse <BookName Ch:V>".
    const panelHeader = await $("h3*=Verse");
    await panelHeader.waitForDisplayed({ timeout: 5_000 });
    await expect(panelHeader).toBeDisplayed();

    // Tabs should be present.
    const refsTab = await $("button=Cross-refs");
    const highlightTab = await $("button=Highlight");
    const noteTab = await $("button=Note");
    await expect(refsTab).toBeDisplayed();
    await expect(highlightTab).toBeDisplayed();
    await expect(noteTab).toBeDisplayed();

    // Close it.
    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
    await panelHeader.waitForDisplayed({ reverse: true, timeout: 3_000 });
  });

  it("navigates VersePanel tabs with arrow keys (ARIA tablist)", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    const verseHeading = await $("h1*=Genesis");
    await verseHeading.waitForDisplayed({ timeout: 10_000 });

    await clickVerseAction('button[aria-label*="Verse"][aria-label*="actions"]');
    const panelHeader = await $("h3*=Verse");
    await panelHeader.waitForDisplayed({ timeout: 5_000 });

    // Tabs form an ARIA tablist; Cross-refs is selected by default.
    const tablist = await $('[role="tablist"]');
    await expect(tablist).toBeDisplayed();
    const refsTab = await $("#verse-tab-refs");
    const highlightTab = await $("#verse-tab-highlight");
    await expect(refsTab).toHaveAttribute("aria-selected", "true");

    // ArrowRight from the focused active tab moves selection + focus to Highlight.
    await browser.execute(() => document.getElementById("verse-tab-refs")?.focus());
    await browser.keys("ArrowRight");
    await expect(highlightTab).toHaveAttribute("aria-selected", "true");
    await expect(refsTab).toHaveAttribute("aria-selected", "false");
    const panel = await $("#verse-details-panel");
    await expect(panel).toHaveAttribute("aria-labelledby", "verse-tab-highlight");
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.id ?? null)) === "verse-tab-highlight",
      { timeout: 5_000, timeoutMsg: "ArrowRight did not move focus to the Highlight tab" },
    );

    // Home returns to the first tab.
    await browser.keys("Home");
    await expect(refsTab).toHaveAttribute("aria-selected", "true");
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.id ?? null)) === "verse-tab-refs",
      { timeout: 5_000, timeoutMsg: "Home did not move focus to the Cross-refs tab" },
    );

    // Close the panel.
    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
    await panelHeader.waitForDisplayed({ reverse: true, timeout: 3_000 });
  });

  it("bookmarks a verse and shows it in shortcuts", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    await clickVerseAction('button[aria-label="Verse 1 actions"]');

    const label = `Creation start ${Date.now()}`;
    const bookmarkLabel = await $('input[aria-label="Bookmark label"]');
    await bookmarkLabel.waitForDisplayed({ timeout: 5_000 });
    await bookmarkLabel.setValue(label);

    const bookmark = await $("button=Bookmark");
    await bookmark.waitForClickable({ timeout: 5_000 });
    await bookmark.click();

    // Bookmarks/shortcuts now live in the on-demand NavigationDrawer (WC1 shell).
    await $('[data-testid="nav-drawer-toggle"]').click();
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ timeout: 5_000 });
    const shortcut = await $(`button=${label}`);
    await shortcut.waitForDisplayed({ timeout: 10_000 });
    await expect(shortcut).toBeDisplayed();
    await browser.keys("Escape");
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ reverse: true, timeout: 5_000 });

    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
  });

  it("tags a bookmark and filters the sidebar by the tag", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    await clickVerseAction('button[aria-label="Verse 1 actions"]');

    const label = `Tagged bookmark ${Date.now()}`;
    const bookmarkLabel = await $('input[aria-label="Bookmark label"]');
    await bookmarkLabel.waitForDisplayed({ timeout: 5_000 });
    await bookmarkLabel.setValue(label);
    const bookmark = await $("button=Bookmark");
    await bookmark.waitForClickable({ timeout: 5_000 });
    await bookmark.click();

    // Close the verse panel so the drawer shortcut is the clear target.
    await $('button[aria-label="Close verse panel"]').click();

    // Bookmarks/shortcuts now live in the on-demand NavigationDrawer (WC1 shell).
    await $('[data-testid="nav-drawer-toggle"]').click();
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ timeout: 5_000 });

    const shortcut = await $(`button=${label}`);
    await shortcut.waitForDisplayed({ timeout: 10_000 });

    // Open the bookmark's tag input, add a tag.
    const tagName = `topic${Date.now()}`;
    const li = await (await $(`button=${label}`)).parentElement();
    await li.$('[data-testid="bookmark-add-tag"]').click();
    const tagInput = await li.$('[data-testid="bookmark-tag-input"]');
    await tagInput.waitForDisplayed({ timeout: 5_000 });
    await tagInput.setValue(tagName);
    await browser.keys("Enter");

    // The chip renders on the bookmark (re-query: the list re-rendered after refresh).
    const chip = await $(`[data-testid="bookmark-tag-chip"]*=${tagName}`);
    await chip.waitForDisplayed({ timeout: 10_000 });

    // Filtering by the tag keeps this bookmark visible.
    const filterChip = await $(`[data-testid="bookmark-tag-filter"]`).then((bar) =>
      bar.$(`button=${tagName}`),
    );
    await filterChip.click();
    await expect(await $(`button=${label}`)).toBeDisplayed();

    // Clear the filter to leave clean state for later tests.
    await (await $('[data-testid="bookmark-tag-filter"]')).$("button=Clear").click();

    // Close the drawer to leave a clean state for later tests.
    await browser.keys("Escape");
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ reverse: true, timeout: 5_000 });
  });

  it("explains a verse from the verse panel", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    const layout = await $('select[aria-label="Reader layout"]');
    await layout.selectByAttribute("value", "columns");

    const firstVerse = await $('button[aria-label="Verse 1 actions"]');
    await firstVerse.waitForClickable({ timeout: 10_000 });
    await firstVerse.click();

    const explain = await $('[data-testid="explain-verse"]');
    await explain.waitForClickable({ timeout: 5_000 });
    await explain.click();

    const explanation = await $("h4*=Explanation:");
    await explanation.waitForDisplayed({ timeout: 60_000 });
    await expect(explanation).toBeDisplayed();
    await expect(explanation).toHaveText("Explanation: Genesis 1:1", {
      containing: true,
      ignoreCase: true,
    });

    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
  });

  it("installs and displays a sample module for a verse", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const install = await $("button*=Install sample module");
    await install.waitForClickable({ timeout: 10_000 });
    await install.click();
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        const text = await body.getText();
        return text.includes("Installed Sample Study Notes") ||
          text.includes("Sample module already installed");
      },
      { timeout: 10_000, timeoutMsg: "sample module did not install" },
    );

    // Jump-to-reference now lives in the reader (WC1 shell), not the old global
    // sidebar — return to the Reader before using it.
    const readerNav = await $("button=Reader");
    await readerNav.waitForClickable({ timeout: 10_000 });
    await readerNav.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    const firstVerse = await $('button[aria-label="Verse 1 actions"]');
    await firstVerse.waitForClickable({ timeout: 10_000 });
    await firstVerse.click();

    const modules = await $("h4=Modules");
    await modules.waitForDisplayed({ timeout: 10_000 });
    await expect(await $("span=Sample Study Notes")).toBeDisplayed();

    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
  });

  it("uninstalls an installed module", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const install = await $("button*=Install sample module");
    await install.waitForClickable({ timeout: 10_000 });
    await install.click();
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        const text = await body.getText();
        return text.includes("Installed Sample Study Notes") ||
          text.includes("Sample module already installed");
      },
      { timeout: 10_000, timeoutMsg: "sample module did not install" },
    );

    const uninstall = await $('[data-testid="uninstall-module-sample-study-notes"]');
    await uninstall.waitForClickable({ timeout: 10_000 });
    await uninstall.click();
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        return (await body.getText()).includes("Removed Sample Study Notes");
      },
      { timeout: 10_000, timeoutMsg: "sample module did not uninstall" },
    );
    await uninstall.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("imports a JSONL Strong's module and displays it in word study", async () => {
    const rangeModuleWorkspace = `E2E range module workspace ${Date.now()}`;
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const importButton = await $("button=Import JSONL sample");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        const text = await body.getText();
        return text.includes("Imported Sample Strong's Notes");
      },
      { timeout: 10_000, timeoutMsg: "JSONL module did not import" },
    );

    const topicSelect = await $('select[aria-label="Module topic"]');
    await topicSelect.waitForDisplayed({ timeout: 10_000 });
    await topicSelect.selectByAttribute("value", "creation");
    const openTopic = await $("button=Open topic");
    await openTopic.waitForClickable({ timeout: 10_000 });
    await openTopic.click();
    const topicResults = await $('[data-testid="module-topic-results"]');
    await topicResults.waitForDisplayed({ timeout: 10_000 });
    await expect(topicResults).toHaveText("Creation", { containing: true, ignoreCase: true });
    await expect(topicResults).toHaveText("browsing outside a single verse", { containing: true, ignoreCase: true });

    const openTopicSource = await $("button=Open Genesis 1:1");
    await openTopicSource.waitForClickable({ timeout: 10_000 });
    await openTopicSource.click();
    const readerHeading = await $("h1*=Genesis");
    await readerHeading.waitForDisplayed({ timeout: 10_000 });

    const firstVerse = await $('button[aria-label="Verse 1 actions"]');
    await firstVerse.waitForClickable({ timeout: 10_000 });
    await firstVerse.click();
    await browser.execute(() => {
      const third = document.querySelector('button[aria-label="Verse 3 actions"]');
      third?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      );
    });
    const rangeModules = await $('[data-testid="range-module-results"]');
    await rangeModules.waitForDisplayed({ timeout: 10_000 });
    await expect(rangeModules).toHaveText("Creation opening", { containing: true, ignoreCase: true });
    await expect(rangeModules).toHaveText("single opening movement", { containing: true, ignoreCase: true });
    const addRangeModule = await $('[data-testid="add-range-module-to-workspace"]');
    await addRangeModule.waitForClickable({ timeout: 10_000 });
    await addRangeModule.click();
    const workspaceSelect = await $('[data-testid="add-to-workspace-select"]');
    await workspaceSelect.waitForDisplayed({ timeout: 5_000 });
    await workspaceSelect.selectByAttribute("value", "new");
    const workspaceTitleInput = await $('input[placeholder="Workspace title"]');
    await workspaceTitleInput.waitForDisplayed({ timeout: 5_000 });
    await workspaceTitleInput.setValue(rangeModuleWorkspace);
    await browser.execute(() => {
      const confirm = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-testid="add-to-workspace-confirm"]'),
      ).find((button) => button.offsetParent !== null && !button.disabled);
      confirm?.click();
    });
    const addedRangeModule = await $("span=Added");
    await addedRangeModule.waitForDisplayed({ timeout: 10_000 });

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${rangeModuleWorkspace}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const moduleHeading = await $("h3=Creation opening");
    await moduleHeading.waitForDisplayed({ timeout: 10_000 });
    const moduleSource = await $("button*=Open Genesis 1:1-3");
    await moduleSource.waitForDisplayed({ timeout: 10_000 });
    await expect(moduleSource).toHaveText("KJV", { containing: true, ignoreCase: true });
    const previewButton = await $("button=Preview Markdown");
    await previewButton.waitForClickable({ timeout: 10_000 });
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return (
          text.includes("Creation opening") &&
          text.includes("Genesis 1:1-3 (KJV)")
        );
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include range module entry" },
    );
    const deleteWorkspace = await $("button=Delete");
    await deleteWorkspace.waitForClickable({ timeout: 10_000 });
    await deleteWorkspace.click();
    await moduleHeading.waitForDisplayed({ reverse: true, timeout: 10_000 });

    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();
    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    await readerHeading.waitForDisplayed({ timeout: 10_000 });
    const reopenedRangeBar = await $('[data-testid="range-action-bar"]');
    if (await reopenedRangeBar.isDisplayed().catch(() => false)) {
      await clearVisibleRangeBar("Genesis 1:1-3");
    }

    const layout = await $('select[aria-label="Reader layout"]');
    await layout.selectByAttribute("value", "columns");

    const wlcCheckbox = await $('[data-testid="translation-WLC"]');
    await wlcCheckbox.waitForDisplayed({ timeout: 10_000 });
    if (!(await wlcCheckbox.isSelected())) {
      const wlcLabel = await wlcCheckbox.parentElement();
      await wlcLabel.click();
    }

    const token = await $('[data-testid="word-token"]');
    await token.waitForClickable({ timeout: 10_000 });
    await token.click();

    const modules = await $("h3=Modules");
    await modules.waitForDisplayed({ timeout: 10_000 });
    await expect(await $("span=Sample Strong's Notes")).toBeDisplayed();

    const close = await $('button[aria-label="Close Strong\'s lookup"]');
    await close.click();
  });

  it("returns FTS search results and navigates on click", async () => {
    // Search now lives in the SearchPanel overlay — open it via "/".
    await browser.keys("/");
    await $('[data-testid="search-panel"]').waitForDisplayed({ timeout: 5_000 });
    const searchInput = await $('input[type="search"]');
    await searchInput.waitForDisplayed({ timeout: 5_000 });
    await searchInput.click();
    await searchInput.setValue("predestinate");

    // Search results appear under a "Search:" header.
    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 10_000 });

    // Wait for the actual hits to render (debounce + Rust roundtrip).
    const firstHit = await $('[data-testid="search-result"]');
    await firstHit.waitForDisplayed({ timeout: 10_000 });

    const hits = await $$('[data-testid="search-result"]');
    expect(hits.length).toBeGreaterThan(0);
    await hits[0].click();

    // After click, the search clears and the reader shows the navigated chapter.
    // Heading should now be a chapter heading like "Ephesians 1" or "Romans 8".
    await browser.waitUntil(
      async () => {
        const h = await $("h1");
        const t = (await h.getText()) || "";
        // Anything that's not "Bible AI" (sidebar) — we want the chapter heading.
        // The chapter h1 is in the main pane; sidebar h1 also says "Bible AI".
        // We check that *some* h1 contains a chapter reference (digits).
        const heads = await $$("h1");
        for (const head of heads) {
          const txt = (await head.getText()) || "";
          if (/\d/.test(txt) && !/Bible AI/.test(txt)) return true;
        }
        return false;
      },
      { timeout: 10_000, timeoutMsg: "reader did not navigate after clicking a search hit" },
    );
  });

  it("selects a verse range, saves range data, and adds it to a workspace", async () => {
    const workspaceTitle = `E2E range workspace ${Date.now()}`;
    const rangeNote = `E2E range note ${Date.now()}`;
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    const verseHeading = await $("h1*=Genesis");
    await verseHeading.waitForDisplayed({ timeout: 10_000 });

    const firstVerse = await $('button[aria-label="Verse 1 actions"]');
    await firstVerse.waitForClickable({ timeout: 5_000 });
    await firstVerse.click();

    await browser.execute(() => {
      const third = document.querySelector('button[aria-label="Verse 3 actions"]');
      third?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      );
    });

    const rangeBar = await $('[data-testid="range-action-bar"]');
    await rangeBar.waitForDisplayed({ timeout: 5_000 });
    await expect(rangeBar).toBeDisplayed();

    const amber = await $('button[aria-label="Highlight range Amber"]');
    await amber.waitForClickable({ timeout: 5_000 });
    await amber.click();

    const status = await $("span=Range highlighted");
    await status.waitForDisplayed({ timeout: 5_000 });

    const bookmark = await rangeBar.$("button=Bookmark");
    const noteButton = await rangeBar.$("button=Note");
    await noteButton.waitForClickable({ timeout: 5_000 });
    await noteButton.click();
    const noteArea = await $('textarea[aria-label="Range note for Genesis 1:1-3"]');
    await noteArea.waitForDisplayed({ timeout: 5_000 });
    await noteArea.setValue(rangeNote);
    const saveRangeNote = await rangeBar.$("button=Save note");
    await saveRangeNote.waitForClickable({ timeout: 5_000 });
    await saveRangeNote.click();
    const noteStatus = await $("span=Range note saved");
    await noteStatus.waitForDisplayed({ timeout: 5_000 });

    await bookmark.waitForClickable({ timeout: 5_000 });
    await bookmark.click();
    const bookmarkStatus = await $("span=Range bookmarked");
    await bookmarkStatus.waitForDisplayed({ timeout: 5_000 });
    // Range-bookmark shortcut now lives in the on-demand NavigationDrawer.
    await $('[data-testid="nav-drawer-toggle"]').click();
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ timeout: 5_000 });
    const shortcut = await $("button=Genesis 1:1-3");
    await shortcut.waitForDisplayed({ timeout: 10_000 });
    await expect(shortcut).toBeDisplayed();
    await browser.keys("Escape");
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ reverse: true, timeout: 5_000 });

    const clear = await rangeBar.$("button=Clear");
    await clear.waitForClickable({ timeout: 5_000 });
    await clearVisibleRangeBar("Genesis 1:1-3");

    await firstVerse.waitForClickable({ timeout: 5_000 });
    await firstVerse.click();
    await browser.execute(() => {
      const third = document.querySelector('button[aria-label="Verse 3 actions"]');
      third?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      );
    });
    const reopenedRangeBar = await $('[data-testid="range-action-bar"]');
    await reopenedRangeBar.waitForDisplayed({ timeout: 5_000 });
    const reopenedNote = await reopenedRangeBar.$("button=Note");
    await reopenedNote.waitForClickable({ timeout: 5_000 });
    await reopenedNote.click();
    const reopenedNoteArea = await $('textarea[aria-label="Range note for Genesis 1:1-3"]');
    await reopenedNoteArea.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => (await reopenedNoteArea.getValue()).includes(rangeNote),
      { timeout: 10_000, timeoutMsg: "range note did not reload after reselecting range" },
    );

    const addRange = await $('[data-testid="add-range-to-workspace"]');
    await addRange.waitForClickable({ timeout: 5_000 });
    await addRange.click();
    const workspaceSelect = await $('[data-testid="add-to-workspace-select"]');
    await workspaceSelect.waitForDisplayed({ timeout: 5_000 });
    await workspaceSelect.selectByAttribute("value", "new");
    const workspaceTitleInput = await $('input[placeholder="Workspace title"]');
    await workspaceTitleInput.waitForDisplayed({ timeout: 5_000 });
    await workspaceTitleInput.setValue(workspaceTitle);
    await browser.execute(() => {
      const confirm = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-testid="add-to-workspace-confirm"]'),
      ).find((button) => button.offsetParent !== null && !button.disabled);
      confirm?.click();
    });
    const added = await $("span=Added");
    await added.waitForDisplayed({ timeout: 10_000 });

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${workspaceTitle}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const created = await $(`h2=${workspaceTitle}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    const rangeItem = await $("h3=Genesis 1:1-3");
    await rangeItem.waitForDisplayed({ timeout: 10_000 });
    await expect(rangeItem).toBeDisplayed();

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("selects a verse range from the jump box", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1-3");
    await $("button=Go").click();

    const rangeBar = await $('[data-testid="range-action-bar"]');
    await rangeBar.waitForDisplayed({ timeout: 10_000 });
    await expect(rangeBar).toHaveText("Genesis 1:1-3", { containing: true, ignoreCase: true });
    await expect(rangeBar).toHaveText("3 verses selected", { containing: true, ignoreCase: true });

    await clearVisibleRangeBar("Genesis 1:1-3");
  });

  it("opens a cross-chapter range from the jump box", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:31-2:3");
    await $("button=Go").click();

    const rangeBar = await $('[data-testid="range-action-bar"]');
    await rangeBar.waitForDisplayed({ timeout: 10_000 });
    await expect(rangeBar).toHaveText("Genesis 1:31-2:3", { containing: true, ignoreCase: true });
    await expect(rangeBar).toHaveText("4 verses selected", { containing: true, ignoreCase: true });

    await clearVisibleRangeBar("Genesis 1:31-2:3");
  });

  it("switches to interleaved compact layout for parallel translations", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    const asvCheckbox = await $('[data-testid="translation-ASV"]');
    await asvCheckbox.waitForDisplayed({ timeout: 10_000 });
    if (!(await asvCheckbox.isSelected())) {
      const asvLabel = await asvCheckbox.parentElement();
      await asvLabel.click();
    }

    const layout = await $('select[aria-label="Reader layout"]');
    await layout.selectByAttribute("value", "interleaved");
    const density = await $('select[aria-label="Reader density"]');
    await density.selectByAttribute("value", "compact");

    const interleaved = await $('[data-testid="interleaved-reader"]');
    await interleaved.waitForDisplayed({ timeout: 10_000 });
    await expect(interleaved).toBeDisplayed();
    await browser.waitUntil(
      async () => {
        const text = await interleaved.getText();
        return text.includes("KJV") && text.includes("ASV");
      },
      { timeout: 5_000, timeoutMsg: "interleaved reader did not show both translations" },
    );

    const council = await $("button=Council");
    await council.click();
    await reader.click();
    await interleaved.waitForDisplayed({ timeout: 5_000 });
  });

  it("opens Strong's lookup and occurrence navigation for tagged words", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    const layout = await $('select[aria-label="Reader layout"]');
    await layout.selectByAttribute("value", "columns");

    const wlcCheckbox = await $('[data-testid="translation-WLC"]');
    await wlcCheckbox.waitForDisplayed({ timeout: 10_000 });
    if (!(await wlcCheckbox.isSelected())) {
      const wlcLabel = await wlcCheckbox.parentElement();
      await wlcLabel.click();
    }

    const token = await $('[data-testid="word-token"]');
    await token.waitForClickable({ timeout: 10_000 });
    await token.click();

    const occurrences = await $("h3*=Occurrences");
    await occurrences.waitForDisplayed({ timeout: 10_000 });
    await expect(occurrences).toBeDisplayed();

    const close = await $('button[aria-label="Close Strong\'s lookup"]');
    await close.click();
  });

  it("closes the Strong's lookup on Escape and restores focus", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();
    const layout = await $('select[aria-label="Reader layout"]');
    await layout.selectByAttribute("value", "columns");

    const wlcCheckbox = await $('[data-testid="translation-WLC"]');
    await wlcCheckbox.waitForDisplayed({ timeout: 10_000 });
    if (!(await wlcCheckbox.isSelected())) {
      const wlcLabel = await wlcCheckbox.parentElement();
      await wlcLabel.click();
    }

    const token = await $('[data-testid="word-token"]');
    await token.waitForClickable({ timeout: 10_000 });
    await token.click();

    const popup = await $('[data-testid="strongs-popup"]');
    await popup.waitForDisplayed({ timeout: 10_000 });

    // Focus moves into the dialog on open.
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.activeElement?.getAttribute("data-testid") ?? null,
        )) === "strongs-popup",
      { timeout: 5_000, timeoutMsg: "focus did not move into the Strong's dialog on open" },
    );

    // Escape closes it.
    await browser.keys("Escape");
    await popup.waitForDisplayed({ reverse: true, timeout: 5_000 });

    // Focus returns to the word token that opened it.
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.activeElement?.getAttribute("data-testid") ?? null,
        )) === "word-token",
      { timeout: 5_000, timeoutMsg: "focus did not return to the word token after Escape" },
    );
  });
});

async function clickVerseAction(selector: string) {
  const verseAction = await $(selector);
  await verseAction.waitForDisplayed({ timeout: 10_000 });
  await browser.execute((element: HTMLElement) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  }, verseAction);
  await verseAction.waitForClickable({ timeout: 10_000 });
  await verseAction.click();
}

async function clearVisibleRangeBar(citation: string) {
  await browser.execute((expectedCitation) => {
    const bars = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="range-action-bar"]'),
    );
    const bar = bars.find(
      (element) =>
        element.getClientRects().length > 0 &&
        (element.textContent ?? "").includes(expectedCitation),
    );
    const clear = Array.from(bar?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
      (button) => button.textContent?.trim() === "Clear",
    );
    clear?.click();
  }, citation);

  await browser.waitUntil(
    async () => {
      const bars = await $$('[data-testid="range-action-bar"]');
      for (const bar of bars) {
        if ((await bar.isDisplayed().catch(() => false)) && (await bar.getText()).includes(citation)) {
          return false;
        }
      }
      return true;
    },
    { timeout: 10_000, timeoutMsg: `range bar for ${citation} did not clear` },
  );
}
