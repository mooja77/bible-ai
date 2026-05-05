import { browser, $, $$, expect } from "@wdio/globals";

describe("Council mock workflow", () => {
  it("surfaces explicitly named passages in the retrieval trace", async () => {
    const question = `How should Acts 2:38 be interpreted? e2e ${Date.now()}`;
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();

    const heading = await $("h1=The Council");
    await heading.waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "hybrid");
    const crossRefs = await $('input[type="checkbox"]');
    if (await crossRefs.isSelected()) await crossRefs.click();

    const textarea = await $("textarea");
    await textarea.setValue(question);
    const ask = await $("button=Ask the Council");
    await ask.click();

    const synthesis = await $("h2=Synthesis");
    await synthesis.waitForDisplayed({ timeout: 20_000 });

    const trace = await $('[data-testid="council-retrieval-trace"]');
    await trace.waitForDisplayed({ timeout: 10_000 });
    await expect(trace).toHaveText(expect.stringContaining("Acts 2:38"));
    const traceText = await trace.getText();
    expect(traceText.toLowerCase()).toContain("explicit reference");

    const retrievalBadge = await $("span*=explicit reference + hybrid");
    await expect(retrievalBadge).toBeDisplayed();
  });

  it("submits, renders, persists, restores, and deletes a Council session", async () => {
    const question = `What does the beginning say about creation? e2e ${Date.now()}`;
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

    const synthesis = await $("h2=Synthesis");
    await synthesis.waitForDisplayed({ timeout: 20_000 });
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

    const processView = await $("h2=How the Council reached this");
    await processView.waitForDisplayed({ timeout: 10_000 });
    await expect(processView).toBeDisplayed();
    const rankingExplanation = await $("h3=Why this argument ranked higher");
    await expect(rankingExplanation).toBeDisplayed();
    const processText = await $('[data-testid="council-process-view"]');
    await expect(processText).toHaveText(expect.stringContaining("Separate analysis"));
    await expect(processText).toHaveText(expect.stringContaining("NEAREST ALTERNATIVE"));

    const winnerSummary = await $('[data-testid="council-winner-summary"]');
    await winnerSummary.waitForDisplayed({ timeout: 10_000 });
    await expect(winnerSummary).toHaveText(expect.stringContaining("WHY THIS RANKED HIGHEST"));
    await expect(winnerSummary).toHaveText(expect.stringContaining("Mock consensus"));

    const comparison = await $('[data-testid="council-position-comparison"]');
    await comparison.waitForDisplayed({ timeout: 10_000 });
    await expect(comparison).toHaveText(expect.stringContaining("COMPARE POSITIONS"));
    await expect(comparison).toHaveText(expect.stringContaining("Mock minority"));

    const matrix = await $('[data-testid="council-voice-matrix"]');
    await matrix.waitForDisplayed({ timeout: 10_000 });
    await expect(matrix).toHaveText(expect.stringContaining("Mock consensus"));
    await expect(matrix).toHaveText(expect.stringContaining("75%"));
    const matrixPosition = await matrix.$("button=Mock consensus");
    await matrixPosition.click();
    const focusedPosition = await $('[data-testid="council-focused-position"]');
    await expect(focusedPosition).toHaveText(expect.stringContaining("Mock consensus"));
    const matrixFocus = await $('[data-testid="council-matrix-focus"]');
    await expect(matrixFocus).toHaveText(expect.stringContaining("Focused position"));

    const evidenceTabs = await $('[data-testid="council-evidence-tabs"]');
    await evidenceTabs.waitForDisplayed({ timeout: 10_000 });
    const challengingTab = await $("button*=Challenging");
    await challengingTab.click();
    await expect(evidenceTabs).toHaveText(expect.stringContaining("complicate or limit"));

    const trace = await $('[data-testid="council-retrieval-trace"]');
    await trace.waitForDisplayed({ timeout: 10_000 });
    await expect(trace).toHaveText(expect.stringContaining("KEYWORD"));
    const highlightedEvidence = await trace.$("mark=beginning");
    await expect(highlightedEvidence).toBeDisplayed();

    const confidence = await $('[data-testid="council-confidence-rationale"]');
    await confidence.waitForDisplayed({ timeout: 10_000 });
    await expect(confidence).toHaveText(expect.stringContaining("Confidence is high"));

    const sourceButton = await $("button=View source data");
    await sourceButton.waitForClickable({ timeout: 10_000 });
    await sourceButton.click();
    const sourceJson = await $('[data-testid="council-source-json"]');
    await sourceJson.waitForDisplayed({ timeout: 10_000 });
    await expect(sourceJson).toHaveText(expect.stringContaining("Mock consensus"));
    const copyFullJson = await $("button=Copy full JSON");
    await expect(copyFullJson).toBeDisplayed();

    const evidenceAudit = await $("h2=Retrieved Evidence");
    await evidenceAudit.waitForDisplayed({ timeout: 10_000 });
    await expect(evidenceAudit).toBeDisplayed();
    const usedEvidence = await $("span=used");
    await expect(usedEvidence).toBeDisplayed();
    const retrievalBadge = await $("span*=keyword");
    await expect(retrievalBadge).toBeDisplayed();

    await browser.waitUntil(
      async () => {
        const rows = await $$(`button*=${question}`);
        return rows.length > 0;
      },
      { timeout: 10_000, timeoutMsg: "mock Council session was not persisted to history" },
    );

    const session = await $(`button*=${question}`);
    await session.click();
    await synthesis.waitForDisplayed({ timeout: 10_000 });

    const deleteButton = await $(
      `//button[@title="${question}"]/following-sibling::button[@aria-label="Delete session"]`,
    );
    await deleteButton.waitForClickable({ timeout: 10_000 });
    await deleteButton.click();

    await browser.waitUntil(
      async () => {
        const rows = await $$(`button*=${question}`);
        return rows.length === 0;
      },
      { timeout: 10_000, timeoutMsg: "mock Council session was not deleted from history" },
    );
  });
});
