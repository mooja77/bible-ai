import { browser, $, expect } from "@wdio/globals";

/**
 * Verdict-first result: the answer leads with a clean verdict card, and the
 * dense audit panels are collapsed by default behind "Full analysis".
 */
describe("Council verdict-first result", () => {
  it("leads with a verdict card and keeps the audit panels collapsed until asked", async () => {
    const question = `What does the beginning say about creation? verdict ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 15_000 });
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");
    await (await $("textarea")).setValue(question);
    await (await $("button=Ask the Council")).click();

    const card = await $('[data-testid="council-verdict-card"]');
    await card.waitForDisplayed({ timeout: 30_000 });
    expect((await (await $('[data-testid="council-verdict-answer"]')).getText()).length).toBeGreaterThan(0);
    expect(await (await $('[data-testid="council-verdict-confidence"]')).isExisting()).toBe(true);

    expect(await (await $('[data-testid="council-process-view"]')).isExisting()).toBe(false);

    const toggle = await $('[data-testid="council-full-analysis-toggle"]');
    await toggle.waitForClickable({ timeout: 10_000 });
    await toggle.click();

    const process = await $('[data-testid="council-process-view"]');
    await process.waitForDisplayed({ timeout: 10_000 });
    expect(await process.isExisting()).toBe(true);
  });
});
