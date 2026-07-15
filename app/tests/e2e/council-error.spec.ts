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

  it("stops a stuck run with a calm timeout message and a retry", async () => {
    // Shrink the client-side backstop so the mock's 2s slow path reliably trips
    // it. Restore it in `finally` so later specs use the real inactivity default.
    await browser.execute(() => {
      (window as unknown as { __BIBLE_AI_COUNCIL_TIMEOUT_MS__?: number }).__BIBLE_AI_COUNCIL_TIMEOUT_MS__ = 600;
    });
    try {
      const question = `What does the beginning say about creation? __FORCE_COUNCIL_SLOW__ e2e ${Date.now()}`;

      const council = await $("button=Council");
      await council.waitForClickable({ timeout: 10_000 });
      await council.click();

      const heading = await $("h1=The Council");
      await heading.waitForDisplayed({ timeout: 10_000 });

      const strategy = await $('select[aria-label="Council retrieval strategy"]');
      await strategy.selectByAttribute("value", "keyword");
      const crossRefs = await $('input[type="checkbox"]');
      if (await crossRefs.isSelected()) await crossRefs.click();

      const textarea = await $("textarea");
      await textarea.setValue(question);

      const ask = await $("button=Ask the Council");
      await ask.click();

      // The backstop must end the spinner with a clear, actionable message well
      // before the (2s) backend would have answered.
      await browser.waitUntil(
        async () => {
          const body = await $("body");
          return (await body.getText()).includes("taking longer than expected");
        },
        { timeout: 15_000, timeoutMsg: "client-side council timeout never fired" },
      );

      const retry = await $("button=Try again");
      await expect(retry).toBeDisplayed();

      const synthesis = await $("h2=Synthesis");
      await expect(synthesis).not.toBeDisplayed();
    } finally {
      await browser.execute(() => {
        delete (window as unknown as { __BIBLE_AI_COUNCIL_TIMEOUT_MS__?: number }).__BIBLE_AI_COUNCIL_TIMEOUT_MS__;
      });
    }
  });

  it("allows a long run to finish while progress remains active", async () => {
    await browser.execute(() => {
      // The forced run lasts 2s and reports activity every 500ms. Keep the
      // timeout below the total runtime (so resets are required), while leaving
      // enough scheduling margin for a loaded CI WebView to deliver each event.
      (window as unknown as { __BIBLE_AI_COUNCIL_TIMEOUT_MS__?: number }).__BIBLE_AI_COUNCIL_TIMEOUT_MS__ = 1_500;
    });
    try {
      const question = `What does the beginning say about creation? __FORCE_COUNCIL_PROGRESS_SLOW__ e2e ${Date.now()}`;
      const council = await $("button=Council");
      await council.waitForClickable({ timeout: 10_000 });
      await council.click();

      const strategy = await $('select[aria-label="Council retrieval strategy"]');
      await strategy.selectByAttribute("value", "keyword");
      const crossRefs = await $('input[type="checkbox"]');
      if (await crossRefs.isSelected()) await crossRefs.click();
      await $("textarea").setValue(question);
      await $("button=Ask the Council").click();

      const synthesis = await $("h2=Synthesis");
      const error = await $('[data-testid="council-error"]');
      await browser.waitUntil(
        async () => (await synthesis.isDisplayed()) || (await error.isDisplayed()),
        {
          timeout: 30_000,
          timeoutMsg: "Council progress run produced neither a synthesis nor an error",
        },
      );
      if (await error.isDisplayed()) {
        throw new Error(`Council progress run failed: ${await error.getText()}`);
      }
      await expect(synthesis).toBeDisplayed();
      await expect(error).not.toBeDisplayed();
    } finally {
      await browser.execute(() => {
        delete (window as unknown as { __BIBLE_AI_COUNCIL_TIMEOUT_MS__?: number }).__BIBLE_AI_COUNCIL_TIMEOUT_MS__;
      });
    }
  });
});
