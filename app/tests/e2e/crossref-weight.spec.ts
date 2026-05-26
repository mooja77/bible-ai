/**
 * E2E test for the cross-reference strength indicator (Task 2).
 *
 * Verifies that `[data-testid="crossref-strength"]` renders in the
 * Cross-refs tab of the verse panel — proving the strength meter added
 * by Task 1 is present in the DOM for a well-cross-referenced verse.
 *
 * The Cross-refs tab is the default tab (tab === "refs"), so no tab
 * click is required after opening the verse actions panel.
 */

import { browser, $, expect } from "@wdio/globals";

describe("Cross-reference strength indicator", () => {
  it("renders a strength meter for a well-cross-referenced verse", async () => {
    // Navigate to the Reader.
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    // Jump to Genesis 1:1 (heavily cross-referenced).
    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    // Wait for the chapter heading to confirm navigation.
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

    // Cross-refs is the default tab — assert the strength indicator renders.
    // Genesis 1:1 has many cross-references, so at least one meter should appear.
    const strengthIndicator = await $('[data-testid="crossref-strength"]');
    await strengthIndicator.waitForDisplayed({ timeout: 15_000 });
    await expect(strengthIndicator).toBeDisplayed();

    // Clean up: close the verse panel.
    const closeBtn = await $('button[aria-label="Close verse panel"]');
    await closeBtn.click();
    await panelHeader.waitForDisplayed({ reverse: true, timeout: 3_000 });
  });
});
