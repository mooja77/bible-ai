/**
 * E2E tests for note search:
 *   - full flow: create a verse note containing a distinctive word, then find
 *     it via the "My notes" search scope
 *   - note search scope toggle sets aria-pressed="true"
 */

import { browser, $, expect } from "@wdio/globals";

const DISTINCTIVE_WORD = "habakkuktestnote";

describe("Note search", () => {
  it("creates a verse note and finds it via the My-notes search scope", async () => {
    // Navigate to the Reader and jump to Genesis 1:1.
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    const verseHeading = await $("h1*=Genesis");
    await verseHeading.waitForDisplayed({ timeout: 10_000 });

    // Open the verse actions panel for verse 1.
    const verseOne = await $('button[aria-label="Verse 1 actions"]');
    await verseOne.waitForDisplayed({ timeout: 10_000 });
    await browser.execute((element: HTMLElement) => {
      element.scrollIntoView({ block: "center", inline: "nearest" });
    }, verseOne);
    await verseOne.waitForClickable({ timeout: 10_000 });
    await verseOne.click();

    // The panel header reads "Verse Genesis 1:1".
    const panelHeader = await $("h3*=Verse");
    await panelHeader.waitForDisplayed({ timeout: 5_000 });

    // Switch to the Note tab.
    const noteTab = await $("button=Note");
    await noteTab.waitForClickable({ timeout: 5_000 });
    await noteTab.click();

    // The note textarea is inside the verse panel. Wait for it to load
    // (placeholder changes from "Loading…" to "Add a note for this verse…").
    const noteTextarea = await $('textarea[placeholder="Add a note for this verse…"]');
    await noteTextarea.waitForDisplayed({ timeout: 10_000 });

    // Clear any existing content and type the distinctive word.
    await noteTextarea.clearValue();
    await noteTextarea.setValue(DISTINCTIVE_WORD);

    // Blur to trigger auto-save (NoteTab calls save() on onBlur).
    await browser.execute((el: HTMLElement) => el.blur(), noteTextarea);

    // Wait for "Saved ✓" confirmation.
    const savedStatus = await $("span*=Saved");
    await savedStatus.waitForDisplayed({ timeout: 10_000 });

    // Tag the note from the Note tab.
    const tagName = `notetag${Date.now()}`;
    await $('[data-testid="note-add-tag"]').click();
    const noteTagInput = await $('[data-testid="note-tag-input"]');
    await noteTagInput.waitForDisplayed({ timeout: 5_000 });
    await noteTagInput.setValue(tagName);
    await browser.keys("Enter");
    const noteChip = await $(`[data-testid="note-tag-chip"]*=${tagName}`);
    await noteChip.waitForDisplayed({ timeout: 10_000 });

    // Close the verse panel.
    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
    await panelHeader.waitForDisplayed({ reverse: true, timeout: 3_000 });

    // Type the distinctive word into the search box.
    const searchInput = await $('input[type="search"]');
    await searchInput.waitForDisplayed({ timeout: 5_000 });
    await searchInput.setValue(DISTINCTIVE_WORD);

    // Switch to the "My notes" scope.
    const notesScope = await $('[data-testid="search-scope-notes"]');
    await notesScope.waitForClickable({ timeout: 5_000 });
    await notesScope.click();

    // Assert the toggle is active.
    await expect(notesScope).toHaveAttribute("aria-pressed", "true");

    // Wait for the note result to appear.
    const noteResult = await $('[data-testid="note-result"]');
    await noteResult.waitForDisplayed({ timeout: 15_000 });

    // Assert the result contains the distinctive word.
    await expect(noteResult).toHaveText(DISTINCTIVE_WORD, {
      containing: true,
      ignoreCase: true,
    });

    // Assert the result contains the verse citation.
    await expect(noteResult).toHaveText("Genesis", {
      containing: true,
      ignoreCase: true,
    });

    // The note-search hit shows the tag, and filtering by it keeps the note visible.
    await expect(await $('[data-testid="note-result-tag"]*=' + tagName)).toBeDisplayed();
    // TagFilterBar's tag is a <button> (hit chips are <span>), so button=<tagName> targets the filter chip:
    await (await $('button=' + tagName)).click();
    await expect(await $('[data-testid="note-result"]')).toBeDisplayed();

    // Clear the search to restore a clean state.
    await $('[aria-label="Clear search"]').click();

    // Reset scope to scripture so subsequent specs start from the default state.
    const scriptureScope = await $('[data-testid="search-scope-scripture"]');
    await scriptureScope.waitForClickable({ timeout: 5_000 });
    await scriptureScope.click();
  });
});
