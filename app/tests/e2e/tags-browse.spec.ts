import { browser, $, expect } from "@wdio/globals";

describe("Browse by tag", () => {
  it("tags a bookmark, finds it in the Tags view, and jumps to it", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const jumpInput = await $('input[aria-label="Jump to reference"]');
    await jumpInput.waitForDisplayed({ timeout: 5_000 });
    await jumpInput.setValue("Genesis 1:1");
    await $("button=Go").click();

    // Open verse 1 actions and bookmark it.
    const verseOne = await $('button[aria-label="Verse 1 actions"]');
    await verseOne.waitForClickable({ timeout: 10_000 });
    await browser.execute((el: HTMLElement) => el.scrollIntoView({ block: "center" }), verseOne);
    await verseOne.click();
    const label = `Browse bm ${Date.now()}`;
    const bookmarkLabel = await $('input[aria-label="Bookmark label"]');
    await bookmarkLabel.waitForDisplayed({ timeout: 5_000 });
    await bookmarkLabel.setValue(label);
    await (await $("button=Bookmark")).click();
    const shortcut = await $(`button=${label}`);
    await shortcut.waitForDisplayed({ timeout: 10_000 });
    await $('button[aria-label="Close verse panel"]').click();

    // Tag the bookmark in the sidebar.
    const tagName = `browse${Date.now()}`;
    const li = await (await $(`button=${label}`)).parentElement();
    await li.$('[data-testid="bookmark-add-tag"]').click();
    const tagInput = await li.$('[data-testid="bookmark-tag-input"]');
    await tagInput.waitForDisplayed({ timeout: 5_000 });
    await tagInput.setValue(tagName);
    await browser.keys("Enter");
    await $(`[data-testid="bookmark-tag-chip"]*=${tagName}`).waitForDisplayed({ timeout: 10_000 });

    // Open the Tags view, select the tag, see the item.
    await (await $("button=Tags")).click();
    const browserView = await $('[data-testid="tag-browser"]');
    await browserView.waitForDisplayed({ timeout: 10_000 });
    const tagButton = await $(`[data-testid="tag-browser-tag"]*=${tagName}`);
    await tagButton.waitForClickable({ timeout: 10_000 });
    await tagButton.click();
    const item = await $('[data-testid="tag-browser-item"]');
    await item.waitForDisplayed({ timeout: 10_000 });
    await expect(item).toHaveText("Genesis 1:1", { containing: true, ignoreCase: true });

    // Click the item → reader navigates.
    await item.click();
    const heading = await $("h1*=Genesis");
    await heading.waitForDisplayed({ timeout: 10_000 });
    await expect(heading).toBeDisplayed();
  });
});
