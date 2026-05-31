import { browser, $, expect } from "@wdio/globals";

/**
 * Council failure UX — when a provider fails, the user must see a calm,
 * plain-language, actionable message (not a hung spinner or a raw stack trace),
 * plus a way to recover.
 *
 * The happy path is covered by council-mock.spec.ts; the mock always succeeds
 * there. This spec drives the real error path end-to-end using a sentinel
 * question (`__FORCE_COUNCIL_ERROR__`) that makes the mock council throw the
 * same shape of error a real provider auth failure produces. The retrieval step
 * still runs (a real creation question retrieves evidence), so the failure
 * happens in the council step exactly as it would in production.
 */
describe("Council failure UX", () => {
  it("shows a calm, actionable error and a retry — never a false success", async () => {
    const question = `What does the beginning say about creation? __FORCE_COUNCIL_ERROR__ e2e ${Date.now()}`;

    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();

    const heading = await $("h1=The Council");
    await heading.waitForDisplayed({ timeout: 10_000 });

    // Keyword strategy + no cross-refs so the creation question deterministically
    // retrieves evidence and the run reaches the (failing) council step.
    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "keyword");
    const crossRefs = await $('input[type="checkbox"]');
    if (await crossRefs.isSelected()) await crossRefs.click();

    const textarea = await $("textarea");
    await textarea.setValue(question);

    const ask = await $("button=Ask the Council");
    await ask.click();

    // The failure must surface as a clear, finished error state — not an endless
    // "thinking" panel. Wait for the human-readable title to appear.
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        return (await body.getText()).includes("The Council could not finish");
      },
      { timeout: 30_000, timeoutMsg: "council error state never appeared (possible hang)" },
    );

    const body = await $("body");
    const text = await body.getText();

    // The actionable hint reaches the user verbatim (it points at Settings and
    // names the offending credential).
    expect(text).toContain("API key");
    expect(text.toLowerCase()).toContain("settings");

    // A recovery affordance is offered.
    const retry = await $("button=Try again");
    await expect(retry).toBeDisplayed();

    // Crucially, no false success: the synthesis result must NOT be shown.
    const synthesis = await $("h2=Synthesis");
    await expect(synthesis).not.toBeDisplayed();
  });
});
