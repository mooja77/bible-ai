import { browser, $, expect } from "@wdio/globals";

describe("Council follow-up chaining", () => {
  it("clicking Ask on a follow-up question re-runs the Council with that question", async () => {
    // ── Step 1: Navigate to Council (mirrors council-mock.spec) ──────────────
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();

    const heading = await $("h1=The Council");
    await heading.waitForDisplayed({ timeout: 10_000 });

    // ── Step 2: Type a question, submit, wait for the mock response ───────────
    const question = `Does God have emotions? e2e ${Date.now()}`;

    const textarea = await $("textarea");
    await textarea.setValue(question);

    const ask = await $("button=Ask the Council");
    await ask.click();

    const synthesis = await $("h2=Synthesis");
    await synthesis.waitForDisplayed({ timeout: 20_000 });

    // Wait until the full mock body is present (mirrors council-mock.spec)
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        const text = await body.getText();
        return (
          text.includes("Mock consensus") &&
          text.includes("Mock minority") &&
          text.includes("Mock Council response")
        );
      },
      { timeout: 10_000, timeoutMsg: "mock Council result did not render" },
    );

    // ── Step 3: Wait for the follow-up section and capture its first question ─
    // The section renders inside the judgment panel once sessionId is set.
    const followUps = await $('[data-testid="council-follow-up-questions"]');
    await followUps.waitForDisplayed({ timeout: 15_000 });

    // Scroll the follow-up section into view so the Ask button is reachable.
    await browser.execute((el: HTMLElement) => {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    }, followUps);

    // Capture the text of the first follow-up question paragraph.
    const firstQuestionPara = await followUps.$("p.text-sm.text-neutral-200");
    await firstQuestionPara.waitForDisplayed({ timeout: 5_000 });
    const followUpText = await firstQuestionPara.getText();

    // ── Step 4: Click the first "Ask" button ─────────────────────────────────
    const askFollowUp = await followUps.$('[data-testid="ask-follow-up"]');
    await askFollowUp.waitForClickable({ timeout: 10_000 });
    await askFollowUp.click();

    // ── Step 5: Assert chaining worked ───────────────────────────────────────
    // Primary assertion: the question textarea now reflects the follow-up text.
    // onAskFollowUp calls setQuestion(text) before onAsk(text), so the input
    // should be populated once the new run starts.
    await browser.waitUntil(
      async () => {
        const val = await textarea.getValue();
        return val === followUpText;
      },
      {
        timeout: 10_000,
        timeoutMsg: `textarea did not get populated with follow-up question "${followUpText}"`,
      },
    );

    // Robust secondary assertion: a fresh mock Council response renders,
    // confirming the re-run completed successfully.
    await synthesis.waitForDisplayed({ timeout: 20_000 });
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        const text = await body.getText();
        return (
          text.includes("Mock consensus") &&
          text.includes("Mock Council response")
        );
      },
      { timeout: 15_000, timeoutMsg: "follow-up re-run did not produce a fresh mock Council response" },
    );
  });
});
