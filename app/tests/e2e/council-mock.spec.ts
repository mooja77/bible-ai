import { browser, $, $$, expect } from "@wdio/globals";

describe("Council mock workflow", () => {
  it("does not overclaim provider readiness in the voice preview", async () => {
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();
    await $("h1=The Council").waitForDisplayed({ timeout: 10_000 });

    const preview = await $('[data-testid="council-voice-preview"]');
    await preview.waitForDisplayed({ timeout: 10_000 });
    const text = (await preview.getText()).toLowerCase();
    // A saved key is not verification. The preview must describe helpers as
    // "configured" (we will attempt them), not assert they are "ready" / "will
    // run", which implies a verified working provider.
    expect(text).toContain("configured");
    expect(text).not.toContain("ready to run");
    expect(text).not.toContain("will run");
  });

  it("exports a Study Packet folder with the contract files", async () => {
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();
    await $("h1=The Council").waitForDisplayed({ timeout: 10_000 });

    const strategy = await $('select[aria-label="Council retrieval strategy"]');
    await strategy.selectByAttribute("value", "hybrid");
    const crossRefs = await $('input[type="checkbox"]');
    if (await crossRefs.isSelected()) await crossRefs.click();

    const textarea = await $("textarea");
    // Use a question with Scripture content so retrieval finds evidence.
    await textarea.setValue(`What does the beginning say about creation? packet ${Date.now()}`);
    const ask = await $("button=Ask the Council");
    await ask.waitForClickable({ timeout: 10_000 });
    await ask.click();
    await $("h2=Synthesis").waitForDisplayed({ timeout: 30_000 });

    const exportBtn = await $('[data-testid="export-study-packet"]');
    await exportBtn.waitForClickable({ timeout: 10_000 });
    await exportBtn.click();

    const status = await $('[data-testid="packet-export-status"]');
    await status.waitForDisplayed({ timeout: 10_000 });
    let folder = "";
    await browser.waitUntil(
      async () => {
        const m = (await status.getText()).match(/exported to (.+)$/);
        if (m) folder = m[1].trim();
        return folder.length > 0;
      },
      { timeout: 10_000, timeoutMsg: "packet export did not report a folder" },
    );

    // wdio specs run in Node, so verify the packet that was actually written.
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    expect(existsSync(join(folder, "README.md"))).toBe(true);
    expect(existsSync(join(folder, "council.md"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));
    expect(manifest.schema).toBe("bible-ai/study-packet");
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(readFileSync(join(folder, "council.md"), "utf8")).toContain("Synthesis");
  });

  it("routes a sensitive prompt to a safety notice instead of the Council", async () => {
    const council = await $("button=Council");
    await council.waitForClickable({ timeout: 10_000 });
    await council.click();
    await $("h1=The Council").waitForDisplayed({ timeout: 10_000 });

    const textarea = await $("textarea");
    await textarea.setValue("I want to kill myself");
    const ask = await $("button=Ask the Council");
    await ask.waitForClickable({ timeout: 10_000 });
    await ask.click();

    const notice = await $('[data-testid="sensitive-topic-notice"]');
    await notice.waitForDisplayed({ timeout: 10_000 });
    await expect(notice).toHaveText(expect.stringContaining("988"));

    // The Council must NOT have generated a result for a sensitive prompt.
    const synthesis = await $("h2=Synthesis");
    expect(await synthesis.isExisting()).toBe(false);
  });

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

    const fullAnalysis = await $('[data-testid="council-full-analysis-toggle"]');
    await fullAnalysis.waitForClickable({ timeout: 10_000 });
    await fullAnalysis.click();

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

    const fullAnalysis = await $('[data-testid="council-full-analysis-toggle"]');
    await fullAnalysis.waitForClickable({ timeout: 10_000 });
    await fullAnalysis.click();

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

    // Keyboard users reveal the delete affordance via focus-within, not just hover.
    // Re-focus each poll: focusing the row's select button puts the .group <li> in
    // :focus-within, which transitions the sibling delete button to opacity 1.
    const keyboardRevealDelete = await $(
      `//button[@title="${question}"]/following-sibling::button[@aria-label="Delete session"]`,
    );
    await browser.waitUntil(
      async () => {
        await browser.execute((title) => {
          document.querySelector<HTMLElement>(`button[title="${title}"]`)?.focus();
        }, question);
        const opacity = (await keyboardRevealDelete.getCSSProperty("opacity")).value;
        return parseFloat(String(opacity)) >= 0.99;
      },
      { timeout: 5_000, timeoutMsg: "delete affordance not revealed on keyboard focus" },
    );

    const session = await $(`button*=${question}`);
    await session.click();
    await synthesis.waitForDisplayed({ timeout: 10_000 });
    const restoredJudgment = await $('[data-testid="council-judgment-panel"]');
    await restoredJudgment.waitForDisplayed({ timeout: 10_000 });
    await expect(restoredJudgment).toHaveText(
      expect.stringContaining("Mock consensus is strongest, but I want to review the exceptions."),
    );

    const restoredFullAnalysis = await $('[data-testid="council-full-analysis-toggle"]');
    await restoredFullAnalysis.waitForClickable({ timeout: 10_000 });
    await restoredFullAnalysis.click();

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
    await scrollIntoView(restoredSessionRow);
    await restoredSessionRow.moveTo();
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

async function scrollIntoView(element: WebdriverIO.Element) {
  await browser.execute((target: HTMLElement) => {
    target.scrollIntoView({ block: "center", inline: "nearest" });
  }, element);
}
