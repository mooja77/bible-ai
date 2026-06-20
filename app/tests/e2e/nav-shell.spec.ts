import { $, expect } from "@wdio/globals";

/**
 * The main nav: icons are decorative additions; labels and navigation must be
 * unchanged. Selecting by exact button text must still work (the whole suite
 * relies on it), and each nav button must carry an aria-hidden icon.
 */
describe("Navigation shell", () => {
  it("navigates by label and shows decorative mode icons", async () => {
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 15_000 });
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 10_000 });

    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    const councilBtn = await $("button=Council");
    const icon = await councilBtn.$("svg[aria-hidden='true']");
    expect(await icon.isExisting()).toBe(true);

    // The label moved to an sr-only span + aria-label (icon-only TopBar nav), so
    // the accessible name is the assertion. The `button=Council` text selector
    // above still resolves because it matches on textContent (incl. sr-only).
    expect(await councilBtn.getAttribute("aria-label")).toBe("Council");
  });
});
