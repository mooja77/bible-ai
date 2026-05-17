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
    await expect(trace).toHaveText("Acts 2:38", { containing: true, ignoreCase: true });
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
    await expect(processText).toHaveText("Separate analysis", { containing: true, ignoreCase: true });
    await expect(processText).toHaveText("NEAREST ALTERNATIVE", { containing: true, ignoreCase: true });

    const winnerSummary = await $('[data-testid="council-winner-summary"]');
    await winnerSummary.waitForDisplayed({ timeout: 10_000 });
    await expect(winnerSummary).toHaveText("WHY THIS RANKED HIGHEST", { containing: true, ignoreCase: true });
    await expect(winnerSummary).toHaveText("Mock consensus", { containing: true, ignoreCase: true });

    const comparison = await $('[data-testid="council-position-comparison"]');
    await comparison.waitForDisplayed({ timeout: 10_000 });
    await expect(comparison).toHaveText("COMPARE POSITIONS", { containing: true, ignoreCase: true });
    await expect(comparison).toHaveText("Mock minority", { containing: true, ignoreCase: true });

    const matrix = await $('[data-testid="council-voice-matrix"]');
    await matrix.waitForDisplayed({ timeout: 10_000 });
    await expect(matrix).toHaveText("Mock consensus", { containing: true, ignoreCase: true });
    await expect(matrix).toHaveText("75%", { containing: true, ignoreCase: true });
    const matrixPosition = await matrix.$("button=Mock consensus");
    await matrixPosition.click();
    const focusedPosition = await $('[data-testid="council-focused-position"]');
    await expect(focusedPosition).toHaveText("Mock consensus", { containing: true, ignoreCase: true });
    const matrixFocus = await $('[data-testid="council-matrix-focus"]');
    await expect(matrixFocus).toHaveText("Focused position", { containing: true, ignoreCase: true });

    const evidenceTabs = await $('[data-testid="council-evidence-tabs"]');
    await evidenceTabs.waitForDisplayed({ timeout: 10_000 });
    const challengingTab = await $("button*=Challenging");
    await challengingTab.click();
    await expect(evidenceTabs).toHaveText("complicate or limit", { containing: true, ignoreCase: true });

    const trace = await $('[data-testid="council-retrieval-trace"]');
    await trace.waitForDisplayed({ timeout: 10_000 });
    await expect(trace).toHaveText("KEYWORD", { containing: true, ignoreCase: true });
    const highlightedEvidence = await trace.$("mark=beginning");
    await expect(highlightedEvidence).toBeDisplayed();

    const confidence = await $('[data-testid="council-confidence-rationale"]');
    await confidence.waitForDisplayed({ timeout: 10_000 });
    await expect(confidence).toHaveText("Confidence is high", { containing: true, ignoreCase: true });

    const researchTrail = await $('[data-testid="council-research-trail"]');
    await researchTrail.waitForDisplayed({ timeout: 10_000 });
    await expect(researchTrail).toHaveText("Research Trail", { containing: true, ignoreCase: true });
    await expect(researchTrail).toHaveText("Positions weighted", { containing: true, ignoreCase: true });

    const argumentMaps = await $('[data-testid="council-argument-maps"]');
    await argumentMaps.waitForDisplayed({ timeout: 10_000 });
    await expect(argumentMaps).toHaveText("Argument Maps", { containing: true, ignoreCase: true });
    await expect(argumentMaps).toHaveText("Weakest link", { containing: true, ignoreCase: true });
    const annotation = await argumentMaps.$('textarea[aria-label="Annotation for Consensus claim"]');
    await annotation.setValue("This node is persuasive but depends on the first retrieved passage.");
    const saveAnnotationButtons = await argumentMaps.$$("button=Save annotation");
    await saveAnnotationButtons[0].click();

    const addToTheology = await $("button=Add to Theology");
    await addToTheology.click();
    const attachSession = await $("button=Attach session");
    await attachSession.waitForClickable({ timeout: 10_000 });
    await attachSession.click();
    await $("button=Added").waitForDisplayed({ timeout: 10_000 });

    const judgment = await $('[data-testid="council-judgment-panel"]');
    await judgment.waitForDisplayed({ timeout: 10_000 });
    await expect(judgment).toHaveText("My Judgment", { containing: true, ignoreCase: true });
    const markNeedsStudy = await judgment.$("button=Mark needs study");
    await markNeedsStudy.click();
    const followUps = await $('[data-testid="council-follow-up-questions"]');
    await expect(followUps).toHaveText("AI-suggested follow-up questions", { containing: true, ignoreCase: true });
    await followUps.$("button=Add question").click();
    const judgmentTextareas = await judgment.$$("textarea");
    await judgmentTextareas[0].setValue("I initially expected a single clear answer.");
    await judgmentTextareas[1].setValue("The evidence made the minority view worth tracking.");
    await judgmentTextareas[2].setValue("Mock consensus is strongest, but I want to review the exceptions.");
    await expect(judgmentTextareas[4]).toHaveValue(
      expect.stringContaining("Needs further study"),
    );
    await expect(judgmentTextareas[4]).toHaveValue(
      expect.stringContaining("How should I resolve this tension"),
    );
    const consensusRating = await judgment.$('select[aria-label="User rating for Mock consensus"]');
    await consensusRating.selectByAttribute("value", "persuasive");
    const minorityRating = await judgment.$('select[aria-label="User rating for Mock minority"]');
    await expect(minorityRating).toHaveValue("needs_study");
    const saveJudgment = await $("button=Save judgment");
    await saveJudgment.click();
    await $("button=Saved").waitForDisplayed({ timeout: 10_000 });

    const sourceButton = await $("button=View source data");
    await sourceButton.waitForClickable({ timeout: 10_000 });
    await sourceButton.click();
    const sourceJson = await $('[data-testid="council-source-json"]');
    await sourceJson.waitForDisplayed({ timeout: 10_000 });
    await expect(sourceJson).toHaveText("Mock consensus", { containing: true, ignoreCase: true });
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
    const restoredJudgment = await $('[data-testid="council-judgment-panel"]');
    await restoredJudgment.waitForDisplayed({ timeout: 10_000 });
    await expect(restoredJudgment).toHaveText(
      expect.stringContaining("Mock consensus is strongest, but I want to review the exceptions."),
    );
    const restoredArgumentMaps = await $('[data-testid="council-argument-maps"]');
    await restoredArgumentMaps.waitForDisplayed({ timeout: 10_000 });
    const restoredAnnotation = await restoredArgumentMaps.$(
      'textarea[aria-label="Annotation for Consensus claim"]',
    );
    await expect(restoredAnnotation).toHaveValue(
      expect.stringContaining("This node is persuasive but depends on the first retrieved passage."),
    );

    const theology = await $("button=Theology");
    await theology.click();
    const theologyHeader = await $("h1=Theology");
    await theologyHeader.waitForDisplayed({ timeout: 10_000 });
    const body = await $("body");
    await expect(body).toHaveText(expect.stringContaining(`Council: ${question.slice(0, 60)}`));
    const copyMarkdown = await $("button=Copy Markdown");
    await copyMarkdown.click();
    await $("button=Copied").waitForDisplayed({ timeout: 10_000 });

    const councilAgain = await $("button=Council");
    await councilAgain.click();
    const restoredSessionRow = await $(`button*=${question}`);
    await restoredSessionRow.waitForClickable({ timeout: 10_000 });
    await restoredSessionRow.click();

    const deleteButton = await $(
      `//button[@title="${question}"]/following-sibling::button[@aria-label="Delete session"]`,
    );
    await deleteButton.scrollIntoView();
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
