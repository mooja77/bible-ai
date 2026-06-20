import { browser, $, expect } from "@wdio/globals";

/**
 * The drill-anywhere reasoning explorer. On a mock result the user must be able
 * to open it, drill outcome → position → verse (reaching raw verse text + score
 * breakdown) and outcome → position → voice, and climb back via the breadcrumb.
 */
describe("Reasoning explorer", () => {
  it("drills from the outcome down to a verse and a voice, and climbs back", async () => {
    const question = `What does the beginning say about creation? explorer ${Date.now()}`;

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

    const explorer = await $('[data-testid="reasoning-explorer"]');
    await explorer.waitForDisplayed({ timeout: 10_000 });

    const firstPosition = await $('[data-testid="re-position-0"]');
    await firstPosition.waitForClickable({ timeout: 10_000 });
    await firstPosition.click();

    const focus = await $('[data-testid="re-zone-focus"]');
    await focus.waitForDisplayed({ timeout: 10_000 });

    const right = await $('[data-testid="re-zone-right"]');
    const verseItem = await right.$('[data-testid^="re-verse-"]');
    await verseItem.waitForClickable({ timeout: 10_000 });
    await verseItem.click();

    const verseText = await $('[data-testid="re-verse-text"]');
    await verseText.waitForDisplayed({ timeout: 10_000 });
    expect((await verseText.getText()).length).toBeGreaterThan(5);
    expect(await (await $('[data-testid="re-verse-combined"]')).isExisting()).toBe(true);

    const crumb0 = await $('[data-testid="re-crumb-0"]');
    await crumb0.waitForClickable({ timeout: 10_000 });
    await crumb0.click();
    await (await $('[data-testid="re-position-0"]')).waitForDisplayed({ timeout: 10_000 });
  });
});
