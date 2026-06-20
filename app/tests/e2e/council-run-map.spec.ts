import { browser, $, expect } from "@wdio/globals";

/**
 * The live "you are here" run map. Mock mode (BIBLE_AI_MOCK_COUNCIL=1) emits the
 * real progress event sequence, so the map must render its stages, show the
 * voices, and reach a completed verdict — never a hung spinner.
 */
describe("Council run map", () => {
  it("shows the staged run map and reaches a verdict on a mock run", async () => {
    const question = `What does the beginning say about creation? runmap ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();

    const heading = await $("h1=The Council");
    await heading.waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");

    const textarea = await $("textarea");
    await textarea.setValue(question);

    const ask = await $("button=Ask the Council");
    await ask.click();

    const map = await $('[data-testid="council-run-map"]');
    await map.waitForDisplayed({ timeout: 15_000 });

    await browser.waitUntil(
      async () => {
        const verdict = await $('[data-testid="runmap-verdict"]');
        return await verdict.isExisting();
      },
      { timeout: 30_000, timeoutMsg: "run map never reached a verdict" },
    );

    const retrieval = await $('[data-testid="runmap-stage-retrieval"]');
    expect(await retrieval.getAttribute("data-status")).toBe("done");

    const verdictStage = await $('[data-testid="runmap-stage-verdict"]');
    expect(await verdictStage.getAttribute("data-status")).toBe("done");

    const voices = await $('[data-testid="runmap-voices"]');
    expect(await voices.isExisting()).toBe(true);
  });
});
