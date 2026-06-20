import { browser, $, expect } from "@wdio/globals";

/**
 * Accessibility: the reasoning explorer must keep keyboard/screen-reader users
 * oriented. When you drill into a level, the activated control unmounts, so
 * focus must move into the new content region (re-body) rather than falling to
 * <body>. This verifies that focus management on open and on drill.
 */
describe("Reasoning explorer accessibility", () => {
  it("moves focus into the content region when opened and when drilling", async () => {
    const question = `What does the beginning say about creation? a11y ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 15_000 });
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");
    await (await $("textarea")).setValue(question);
    await (await $("button=Ask the Council")).click();

    const toggle = await $('[data-testid="trace-reasoning-toggle"]');
    await toggle.waitForClickable({ timeout: 30_000 });
    await toggle.click();

    await (await $('[data-testid="reasoning-explorer"]')).waitForDisplayed({ timeout: 10_000 });

    // On open, focus moves into the explorer content region.
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.getAttribute("data-testid"))) ===
        "re-body",
      { timeout: 5_000, timeoutMsg: "focus did not move into the explorer body on open" },
    );

    // Drill into the leading position; focus must follow into the new level.
    const firstPosition = await $('[data-testid="re-position-0"]');
    await firstPosition.waitForClickable({ timeout: 10_000 });
    await firstPosition.click();

    await (await $('[data-testid="re-zone-focus"]')).waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.activeElement?.getAttribute("data-testid"))) ===
        "re-body",
      { timeout: 5_000, timeoutMsg: "focus did not move into the explorer body after drilling" },
    );
  });
});
