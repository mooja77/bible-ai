/**
 * Smoke test — does the app boot and render its shell correctly?
 * No network calls: we don't exercise the council here (that would consume
 * Claude tokens on every CI run). Council tests belong in their own spec
 * gated behind a flag.
 */

import { $, browser, expect } from "@wdio/globals";

describe("Bible AI shell", () => {
  it("loads with the Bible AI title in the sidebar", async () => {
    const reader = await $("button=Reader");
    await reader.waitForDisplayed({ timeout: 30_000 });
    const body = await $("body");
    await expect(body).toHaveText(expect.stringContaining("Bible AI"));
  });

  it("shows both Reader and Council mode buttons", async () => {
    const reader = await $("button=Reader");
    const council = await $("button=Council");
    await expect(reader).toBeDisplayed();
    await expect(council).toBeDisplayed();
  });

  it("opens the new user guide and steps through the main workflow", async () => {
    const startGuide = await $("button=Start guide");
    await startGuide.waitForClickable({ timeout: 10_000 });
    await startGuide.click();

    const tour = await $('[data-testid="guided-tour"]');
    await tour.waitForDisplayed({ timeout: 10_000 });
    const clickTourButton = async (label: string) => {
      const button = await tour.$(`button=${label}`);
      await button.waitForClickable({ timeout: 10_000 });
      await button.click();
    };

    await expect(tour).toHaveText(expect.stringContaining("Read, compare, and navigate Scripture"));
    await expect(tour).toHaveText(expect.stringContaining("Auto-playing"));

    await clickTourButton("Pause");
    await expect(tour).toHaveText(expect.stringContaining("Paused"));
    await clickTourButton("Play");
    await expect(tour).toHaveText(expect.stringContaining("Auto-playing"));
    await clickTourButton("Pause");

    await clickTourButton("Next");
    await expect(tour).toHaveText(expect.stringContaining("Search and save what you find"));

    await clickTourButton("Next");
    await expect(tour).toHaveText(expect.stringContaining("Ask the Council and inspect the reasoning"));
    const councilHeader = await $("h1=The Council");
    await councilHeader.waitForDisplayed({ timeout: 10_000 });

    await clickTourButton("Rewind");
    await expect(tour).toHaveText(expect.stringContaining("Read, compare, and navigate Scripture"));
    await clickTourButton("Pause");

    await clickTourButton("Next");
    await clickTourButton("Next");

    await clickTourButton("Next");
    await expect(tour).toHaveText(expect.stringContaining("Build reusable studies in Workspaces"));

    await clickTourButton("Next");
    await expect(tour).toHaveText(expect.stringContaining("Build a living systematic theology"));
    const theologyHeader = await $("h1=Theology");
    await theologyHeader.waitForDisplayed({ timeout: 10_000 });

    await clickTourButton("Next");
    await expect(tour).toHaveText(expect.stringContaining("Search attributable open resources"));
    const resourcesHeader = await $("h1=Resources");
    await resourcesHeader.waitForDisplayed({ timeout: 10_000 });

    await clickTourButton("Next");
    await expect(tour).toHaveText(expect.stringContaining("Connect providers and review sources"));

    await clickTourButton("Finish");
    await tour.waitForDisplayed({ reverse: true, timeout: 10_000 });

    const reader = await $("button=Reader");
    await reader.click();
  });

  it("populates the translation picker with the 6 ingested translations", async () => {
    // Each checkbox row has its translation code in a <span> with text content.
    const codes = ["KJV", "ASV", "WEB", "YLT", "TR", "WLC"];
    for (const code of codes) {
      const label = await $(`span=${code}`);
      await label.waitForExist({ timeout: 10_000 });
    }
  });

  it("renders a chapter of Genesis by default", async () => {
    // Reader defaults to Genesis chapter 1 on first launch.
    const heading = await $("h1*=Genesis");
    await heading.waitForDisplayed({ timeout: 10_000 });
    const headingText = await heading.getText();
    expect(headingText).toContain("Genesis");
    expect(headingText).toContain("1");
  });

  it("has a search input focusable via the `/` shortcut", async () => {
    const search = await $('input[type="search"]');
    await expect(search).toBeDisplayed();
  });

  it("links selected Search results directly to Theology", async () => {
    const search = await $('input[type="search"]');
    await search.waitForDisplayed({ timeout: 5_000 });
    await search.setValue("God");

    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => (await $$('[data-testid="search-result"]')).length > 0,
      { timeout: 15_000, timeoutMsg: "search results did not render for Theology link test" },
    );
    const selectors = await $$('input[aria-label^="Select "]');
    expect(selectors.length).toBeGreaterThan(0);
    await selectors[0].click();

    const linkToTheology = await $('[data-testid="link-selected-search-results-to-theology"]');
    await linkToTheology.waitForClickable({ timeout: 10_000 });
    await linkToTheology.click();
    const status = await $('[data-testid="search-theology-status"]');
    await status.waitForDisplayed({ timeout: 10_000 });
    await expect(status).toHaveText(expect.stringContaining("Linked 1 search result"));

    await $('[aria-label="Clear search"]').click();
    await resultsHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });
    const theology = await $("button=Theology");
    await theology.click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Search: God"));
    const evidenceGroups = await $('[data-testid="theology-evidence-groups"]');
    await expect(evidenceGroups).toHaveText(expect.stringContaining("KEY PASSAGES"));

    const reader = await $("button=Reader");
    await reader.click();
  });

  it("switches to the Council pane when the Council button is clicked", async () => {
    const council = await $("button=Council");
    await council.click();

    // Council pane header appears.
    const header = await $("h1=The Council");
    await header.waitForDisplayed({ timeout: 5_000 });
    await expect(header).toBeDisplayed();

    // Back to Reader for subsequent tests / clean state.
    const reader = await $("button=Reader");
    await reader.click();
  });

  it("switches to the Theology pane and shows doctrine topics", async () => {
    const theology = await $("button=Theology");
    await theology.click();

    const header = await $("h1=Theology");
    await header.waitForDisplayed({ timeout: 5_000 });
    await expect(header).toBeDisplayed();
    const progress = await $('[data-testid="theology-progress"]');
    await expect(progress).toHaveText(expect.stringContaining("MY THEOLOGY"));
    await expect(progress).toHaveText(expect.stringContaining("topics started"));
    const scripture = await $("button*=Scripture");
    await expect(scripture).toBeDisplayed();
    const askCouncil = await $("button=Ask Council");
    await askCouncil.click();
    const councilHeader = await $("h1=The Council");
    await councilHeader.waitForDisplayed({ timeout: 10_000 });
    const textarea = await $("textarea");
    await expect(textarea).toHaveValue(expect.stringContaining("Discuss the doctrine of Scripture"));

    const reader = await $("button=Reader");
    await reader.click();
  });

  it("saves a guided Theology study reflection", async () => {
    const theology = await $("button=Theology");
    await theology.click();
    const runner = await $('[data-testid="guided-study-runner"]');
    await runner.waitForDisplayed({ timeout: 10_000 });
    await runner
      .$('select[aria-label="Guided study template"]')
      .selectByVisibleText("Compare theological positions");
    await expect(runner).toHaveText(expect.stringContaining("WHICH POSITION SEEMS STRONGEST"));
    const studyPrompts = await $('[data-testid="theology-study-prompts"]');
    await expect(studyPrompts).toHaveText(expect.stringContaining("Key study questions"));
    await studyPrompts.$("button=Add to open questions").click();
    await studyPrompts.$("button=Use in guided study").click();
    const openQuestions = await $('textarea[aria-label="Unresolved questions"]');
    await expect(openQuestions).toHaveValue(expect.stringContaining("Which passages"));
    const focusQuestion = await runner.$('textarea[aria-label="Guided study question"]');
    await expect(focusQuestion).toHaveValue(expect.stringContaining("Which passages"));
    await runner
      .$(
        'textarea[aria-label="Before AI: which position seems strongest to me, and why?"]',
      )
      .setValue("Before AI, the canonical authority position seems strongest.");
    await runner
      .$(
        'textarea[aria-label="After AI: which argument ranked higher, and do I agree?"]',
      )
      .setValue("After AI, I want to compare inspiration and canon arguments more carefully.");
    await runner
      .$(
        'textarea[aria-label="What did the AI miss, overstate, or flatten between positions?"]',
      )
      .setValue("The AI should not flatten tradition-specific canon questions.");

    const positions = await $('[data-testid="theology-positions"]');
    const positionLabel = await positions.$('input[aria-label="Theology position label"]');
    await positionLabel.setValue("Canonical authority");
    const positionSummary = await positions.$('textarea[aria-label="Theology position summary"]');
    await positionSummary.setValue("Scripture functions as the rule for Christian doctrine.");
    await positions.$("button=Save position").click();
    await expect(positions).toHaveText(expect.stringContaining("Canonical authority"));

    const manualLinkTitle = await $('input[aria-label="Manual theology link title"]');
    await manualLinkTitle.setValue("2 Timothy 3:16");
    await $("button=Add link").click();
    await expect(await $("body")).toHaveText(expect.stringContaining("2 Timothy 3:16"));

    const complete = await runner.$("button=Complete");
    await complete.click();
    await expect(runner).toHaveText(expect.stringContaining("saved cards"));
    const reviewCards = await $('[data-testid="guided-review-cards"]');
    await expect(reviewCards).toHaveText(expect.stringContaining("Which passages"));
    await expect(reviewCards).toHaveText(expect.stringContaining("2 Timothy 3:16"));
    await expect(reviewCards).toHaveText(expect.stringContaining("Canonical authority"));
    const reviewDrill = await $('[data-testid="guided-review-drill"]');
    await expect(reviewDrill).toHaveText(expect.stringContaining("Study aid only"));
    await expect(reviewDrill).toHaveText(expect.stringContaining("Answer hidden"));
    await reviewDrill.$("button=Show answer").click();
    await expect(reviewDrill).not.toHaveText(expect.stringContaining("Answer hidden"));
    const guidedHistory = await $('[data-testid="guided-study-history"]');
    await expect(guidedHistory).toHaveText(expect.stringContaining("Guided study history"));
    await expect(guidedHistory).toHaveText(expect.stringContaining("Completed"));
    await expect(guidedHistory).toHaveText(expect.stringContaining("Compare theological positions"));

    await $("button=Save PDF").click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Saved PDF:"));
    await $("button=Copy Full Theology").click();
    await $("button=Save Full PDF").click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Saved PDF:"));

    const addGuidedToWorkspace = await runner.$("button=Add to workspace");
    await addGuidedToWorkspace.click();
    await $('[data-testid="add-to-workspace-confirm"]').click();
    await expect(runner).toHaveText(expect.stringContaining("Added"));

    const guidedAskCouncil = await runner.$("button=Ask Council");
    await guidedAskCouncil.click();
    const councilQuestion = await $('textarea[aria-label="Council question"]');
    await councilQuestion.waitForDisplayed({ timeout: 10_000 });
    await expect(councilQuestion).toHaveValue(expect.stringContaining("guided study"));
    await expect(councilQuestion).toHaveValue(expect.stringContaining("Which passages"));

    const reader = await $("button=Reader");
    await reader.click();
  });

  it("creates and edits a custom Theology topic", async () => {
    const theology = await $("button=Theology");
    await theology.click();

    const createPanel = await $('[data-testid="create-theology-topic"]');
    await createPanel.waitForDisplayed({ timeout: 10_000 });
    await createPanel.$('input[aria-label="New theology topic title"]').setValue("Covenant Theology Smoke");
    await createPanel
      .$('textarea[aria-label="New theology topic summary"]')
      .setValue("A local test topic for doctrine workflow coverage.");
    await createPanel
      .$('select[aria-label="New theology topic parent"]')
      .selectByVisibleText("Under Scripture");
    await createPanel.$("button=Create topic").click();

    const editPanel = await $('[data-testid="edit-theology-topic"]');
    await editPanel.waitForDisplayed({ timeout: 10_000 });
    await expect(await $("body")).toHaveText(expect.stringContaining("Covenant Theology Smoke"));
    await expect(editPanel).toHaveText(expect.stringContaining("Under Scripture"));
    const summary = await editPanel.$('textarea[aria-label="Edit theology topic summary"]');
    await summary.setValue("Updated summary for custom topic workflow coverage.");
    await editPanel.$("button=Save topic").click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Updated summary"));
    await $("button=Copy Topic + Subtopics").click();
    await $("button=Save Topic + Subtopics PDF").click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Saved PDF:"));

    await $('button[aria-label="Select theology topic Scripture"]').click();
    const subtopics = await $('[data-testid="theology-subtopics"]');
    await subtopics.waitForDisplayed({ timeout: 10_000 });
    await expect(subtopics).toHaveText(expect.stringContaining("Covenant Theology Smoke"));
    const relations = await $('[data-testid="doctrine-relations"]');
    await relations.$('select[aria-label="Doctrine relation type"]').selectByVisibleText("Tension with");
    await relations
      .$('select[aria-label="Doctrine relation target"]')
      .selectByVisibleText("Covenant Theology Smoke");
    await relations
      .$('textarea[aria-label="Doctrine relation note"]')
      .setValue("Canon and covenant commitments should be compared without collapsing either topic.");
    await relations.$("button=Save doctrine link").click();
    await expect(relations).toHaveText(expect.stringContaining("Tension with"));
    await expect(relations).toHaveText(expect.stringContaining("Canon and covenant"));
    const doctrineMap = await $('[data-testid="doctrine-map"]');
    await expect(doctrineMap).toHaveText(expect.stringContaining("Doctrine map"));
    await expect(doctrineMap).toHaveText(expect.stringContaining("Tension with Covenant Theology Smoke"));
    await expect(doctrineMap).toHaveText(expect.stringContaining("Subtopic: Covenant Theology Smoke"));

    const reader = await $("button=Reader");
    await reader.click();
  });

  it("links a Reader verse directly to Theology", async () => {
    const reader = await $("button=Reader");
    await reader.click();

    const verseOne = await $('button[aria-label="Verse 1 actions"]');
    await verseOne.waitForClickable({ timeout: 10_000 });
    await verseOne.click();
    const addToTheology = await $("button=Add to Theology");
    await addToTheology.waitForClickable({ timeout: 10_000 });
    await addToTheology.click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Linked to"));

    const theology = await $("button=Theology");
    await theology.click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Genesis 1:1"));
    const evidenceGroups = await $('[data-testid="theology-evidence-groups"]');
    await expect(evidenceGroups).toHaveText(expect.stringContaining("KEY PASSAGES"));

    await reader.click();
  });

  it("links a selected Reader range directly to Theology", async () => {
    const reader = await $("button=Reader");
    await reader.click();

    const verseOne = await $('button[aria-label="Verse 1 actions"]');
    await verseOne.waitForClickable({ timeout: 10_000 });
    await verseOne.click();
    await browser.execute(() => {
      document
        .querySelector('button[aria-label="Verse 2 actions"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    });

    const rangeBar = await $('[data-testid="range-action-bar"]');
    await rangeBar.waitForDisplayed({ timeout: 10_000 });
    const addRange = await $("button=Add range to Theology");
    await addRange.waitForClickable({ timeout: 10_000 });
    await addRange.click();
    await expect(rangeBar).toHaveText(expect.stringContaining("Range linked to"));

    const theology = await $("button=Theology");
    await theology.click();
    await expect(await $("body")).toHaveText(expect.stringContaining("Genesis 1:1-2"));

    await reader.click();
  });

  it("searches Resources and links a public-domain fixture to Theology", async () => {
    const resources = await $("button=Res");
    await resources.click();

    const header = await $("h1=Resources");
    await header.waitForDisplayed({ timeout: 10_000 });
    const search = await $('input[aria-label="Search resources"]');
    await search.setValue(`no-resource-${Date.now()}`);
    const emptyState = await $('[data-testid="resource-empty-state"]');
    await emptyState.waitForDisplayed({ timeout: 10_000 });
    await expect(emptyState).toHaveText(expect.stringContaining("No resources matched"));
    await emptyState.$("button=Import docs").click();
    const status = await $('[data-testid="resource-status"]');
    await status.waitForDisplayed({ timeout: 10_000 });
    await expect(status).toHaveText(expect.stringContaining("docs/open-resource-ingestion-plan.md"));
    await emptyState.$("button=Clear filters").click();
    await expect(await $('[data-testid="resource-results"]')).toHaveText(
      expect.stringContaining("Apostles' Creed"),
    );
    await search.setValue(`no-resource-${Date.now()}`);
    const secondEmptyState = await $('[data-testid="resource-empty-state"]');
    await secondEmptyState.waitForDisplayed({ timeout: 10_000 });
    await secondEmptyState.$("button=Open Data Sources").click();
    const dataSources = await $('[data-testid="data-sources-screen"]');
    await dataSources.waitForDisplayed({ timeout: 10_000 });
    await expect(dataSources).toHaveText(expect.stringContaining("DATA SOURCES"));

    await resources.click();
    await (await $("h1=Resources")).waitForDisplayed({ timeout: 10_000 });
    const resourceSearch = await $('input[aria-label="Search resources"]');
    await resourceSearch.setValue("creed");
    await $('select[aria-label="Resource kind filter"]').selectByVisibleText("creed");
    await $('select[aria-label="Resource license filter"]').selectByVisibleText("Public Domain");
    const results = await $('[data-testid="resource-results"]');
    await results.waitForDisplayed({ timeout: 10_000 });
    await expect(results).toHaveText(expect.stringContaining("Apostles' Creed"));

    const detail = await $('[data-testid="resource-detail"]');
    await expect(detail).toHaveText(expect.stringContaining("Public Domain"));
    const citation = await $('[data-testid="resource-citation"]');
    await expect(citation).toHaveText(expect.stringContaining("CITATION"));
    await expect(citation).toHaveText(expect.stringContaining("Apostles' Creed"));
    await expect(citation).toHaveText(expect.stringContaining("Genesis 1:1"));
    const link = await $("button=Link to Theology");
    await link.click();
    await status.waitForDisplayed({ timeout: 10_000 });
    await expect(status).toHaveText(expect.stringContaining("Resource linked to Theology"));

    await $('select[aria-label="Resource theology topic filter"]').selectByVisibleText("Scripture");
    await expect(results).toHaveText(expect.stringContaining("Apostles' Creed"));

    const addResourceToWorkspace = await $("button=Add to workspace");
    await addResourceToWorkspace.click();
    await $('[data-testid="add-to-workspace-confirm"]').click();
    await expect(await $('[data-testid="resource-detail"]')).toHaveText(expect.stringContaining("Added"));

    const askCouncil = await $("button=Ask Council");
    await askCouncil.click();
    const councilQuestion = await $('textarea[aria-label="Council question"]');
    await councilQuestion.waitForDisplayed({ timeout: 10_000 });
    await expect(councilQuestion).toHaveValue(expect.stringContaining("Apostles' Creed"));
    await expect(councilQuestion).toHaveValue(expect.stringContaining("Genesis 1:1"));

    const theology = await $("button=Theology");
    await theology.click();
    const theologyBody = await $("body");
    await expect(theologyBody).toHaveText(expect.stringContaining("Apostles' Creed"));
    const evidenceGroups = await $('[data-testid="theology-evidence-groups"]');
    await expect(evidenceGroups).toHaveText(expect.stringContaining("LINKED RESOURCES"));

    const reader = await $("button=Reader");
    await reader.click();
  });
});
