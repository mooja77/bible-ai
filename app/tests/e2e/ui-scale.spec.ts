import { browser, $, expect } from "@wdio/globals";

/**
 * H1 — whole-app text-size control. Increasing it raises the document root
 * font-size (so every rem-based UI element grows) and updates the readout.
 * The test resets the scale to 100% at the end so it does not perturb later
 * specs in the shared wdio session.
 */
describe("App text size control", () => {
  it("scales the whole UI and persists the readout, then resets", async () => {
    const rootFontSize = () =>
      browser.execute(() => window.getComputedStyle(document.documentElement).fontSize);

    const before = parseFloat(await rootFontSize());

    const inc = await $('[data-testid="ui-scale-inc"]');
    await inc.waitForClickable({ timeout: 10_000 });
    await inc.click();

    // Readout reflects the new step and the root font-size actually grew.
    const value = await $('[data-testid="ui-scale-value"]');
    await expect(value).toHaveText("112%");
    await browser.waitUntil(
      async () => parseFloat(await rootFontSize()) > before,
      { timeout: 5_000, timeoutMsg: "root font-size should grow when text size is increased" },
    );

    // Reset to 100% so the shared session is left at the default.
    const dec = await $('[data-testid="ui-scale-dec"]');
    await dec.click();
    await expect(value).toHaveText("100%");
    await browser.waitUntil(
      async () => Math.abs(parseFloat(await rootFontSize()) - before) < 0.5,
      { timeout: 5_000, timeoutMsg: "root font-size should return to the default" },
    );
  });
});
