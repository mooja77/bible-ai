import { browser, $, expect } from "@wdio/globals";

describe("Backup and restore", () => {
  it("imports backup JSON and refreshes restored bookmarks", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const bookmarkId = Date.now();
    const bookmarkLabel = `Imported John bookmark ${bookmarkId}`;
    const importedAt = new Date(Date.now() + 60_000).toISOString();
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 7,
      exported_at: importedAt,
      tables: {
        bookmarks: [
          {
            id: bookmarkId,
            verse_id: 43001001,
            end_verse_id: null,
            label: bookmarkLabel,
            created_at: importedAt,
          },
        ],
      },
    };

    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.waitForDisplayed({ timeout: 10_000 });
    await textarea.setValue(JSON.stringify(backup));

    const importButton = await $("button=Import pasted JSON");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();

    await waitForBackupStatus("Imported 1", "backup JSON import did not complete");

    // Bookmarks/shortcuts now live in the on-demand NavigationDrawer (WC1 shell).
    await $('[data-testid="nav-drawer-toggle"]').click();
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ timeout: 5_000 });

    const imported = await $(`button=${bookmarkLabel}`);
    await imported.waitForDisplayed({ timeout: 10_000 });
    await expect(imported).toBeDisplayed();

    // Close the drawer to leave a clean state for later tests.
    await browser.keys("Escape");
    await $('[data-testid="nav-drawer"]').waitForDisplayed({ reverse: true, timeout: 5_000 });
  });

  it("renders imported ISO Council timestamps as valid relative times", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const id = Math.floor(Date.now() % 1_000_000_000);
    const question = `Imported ISO timestamp session ${id}`;
    const importedAt = new Date(Date.now() - 120_000).toISOString();
    const position = {
      label: "Fixture position",
      weight: 1,
      summary: "A timestamp regression fixture.",
      supporting_evidence_ids: [1001001],
      challenging_evidence_ids: [],
      why_not_higher: "",
      confidence_rationale: "Fixture response.",
      weakest_link: "",
      what_would_change_this: "",
      interpretive_moves: [],
      argument_map: { nodes: [], edges: [] },
      evidence: [
        {
          verse_id: 1001001,
          citation: "Genesis 1:1",
          translation_code: "KJV",
          quote: "In the beginning God created the heaven and the earth.",
          reasoning: "Fixture citation.",
        },
      ],
    };
    const response = {
      synthesis: {
        positions: [position],
        dissent_notes: "",
        unresolved_tensions: [],
        synthesis: "A minimal timestamp fixture.",
        confidence: "medium",
        confidence_rationale: "Fixture response.",
        evidence_classification: [
          { verse_id: 1001001, status: "used", reasoning: "Cited directly." },
        ],
        research_trail: [],
      },
      voices: [
        {
          provider: "mock",
          display_name: "Mock",
          status: "ok",
          result: {
            positions: [position],
            synthesis: "A minimal voice result.",
            confidence: "medium",
          },
          error: null,
          duration_ms: 1,
        },
      ],
      manifest: [{ name: "mock", display_name: "Mock", available: true }],
      retrieved_evidence: [
        {
          verse_id: 1001001,
          translation_code: "KJV",
          book_id: 1,
          book_name: "Genesis",
          book_osis: "Gen",
          chapter: 1,
          verse: 1,
          text: "In the beginning God created the heaven and the earth.",
          source: "mock",
        },
      ],
    };
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 14,
      exported_at: importedAt,
      tables: {
        council_sessions: [
          {
            id,
            question,
            topic_tag: null,
            status: "complete",
            created_at: importedAt,
            completed_at: importedAt,
            retrieval_mode: null,
            retrieval_options_json: null,
            retrieved_evidence_json: null,
            response_json: JSON.stringify(response),
          },
        ],
      },
    };
    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.setValue(JSON.stringify(backup));
    await $("button=Import pasted JSON").click();
    await waitForBackupStatus("Imported 1", "Council timestamp fixture did not import");

    await $("button=Council").click();
    const row = await $(`button[title="${question}"]`);
    await row.waitForDisplayed({ timeout: 10_000 });
    expect(await row.getText()).not.toContain("NaN");
    expect(await row.getText()).toMatch(/(?:s|m|h|d) ago/);

    // The desktop suite intentionally reuses one profile across spec files.
    // Remove this fixture so Council history tests that follow see only the
    // sessions they create themselves.
    await browser.execute((target: HTMLElement) => {
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }, row);
    await row.moveTo();
    const deleteButton = await $(
      `//button[@title="${question}"]/following-sibling::button[@aria-label="Delete session"]`,
    );
    await deleteButton.waitForClickable({ timeout: 10_000 });
    await deleteButton.click();
    await row.waitForExist({ reverse: true, timeout: 10_000 });
  });

  it("creates a SQLite backup and restores from that backup path", async () => {
    // Put a known reader preference into the backup so this exercises the live
    // React settings reload, not only the file replacement/status message.
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();
    await $('button[aria-label="Reading settings"]').click();
    const originalLayout = await $('select[aria-label="Reader layout"]');
    const originalDensity = await $('select[aria-label="Reader density"]');
    await originalLayout.selectByAttribute("value", "columns");
    await originalDensity.selectByAttribute("value", "comfortable");
    await browser.keys("Escape");
    await browser.pause(600);

    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const backupButton = await $("button=Backup SQLite");
    await backupButton.waitForClickable({ timeout: 10_000 });
    await backupButton.click();

    let backupPath = "";
    await browser.waitUntil(
      async () => {
        const body = await $("body");
        const text = await body.getText();
        const match = text.match(/SQLite saved (.+?\.sqlite)/);
        if (match) backupPath = match[1];
        return backupPath.length > 0;
      },
      { timeout: 10_000, timeoutMsg: "SQLite backup path was not shown" },
    );

    // Mutate the live/DB state after the backup. Restore must put both values
    // back and update the already-running application state in place.
    await reader.click();
    await $('button[aria-label="Reading settings"]').click();
    await $('select[aria-label="Reader layout"]').selectByAttribute("value", "interleaved");
    await $('select[aria-label="Reader density"]').selectByAttribute("value", "compact");
    await browser.keys("Escape");
    await browser.pause(600);
    await settings.click();

    const pathInput = await $('input[aria-label="SQLite restore path"]');
    await pathInput.waitForDisplayed({ timeout: 10_000 });
    await pathInput.setValue(backupPath);

    const restoreButton = await $("button=Restore SQLite");
    await restoreButton.waitForClickable({ timeout: 10_000 });
    await restoreButton.click();

    // Restore is destructive and now requires an explicit confirmation step.
    const confirmRestore = await $("button=Confirm restore");
    await confirmRestore.waitForClickable({ timeout: 10_000 });
    await confirmRestore.click();

    await browser.waitUntil(
      async () => {
        const body = await $("body");
        return (await body.getText()).includes("Restored SQLite. Safety backup:");
      },
      { timeout: 10_000, timeoutMsg: "SQLite restore did not complete" },
    );

    await reader.click();
    await $('button[aria-label="Reading settings"]').click();
    await expect(await $('select[aria-label="Reader layout"]')).toHaveValue("columns");
    await expect(await $('select[aria-label="Reader density"]')).toHaveValue("comfortable");
    await browser.keys("Escape");
  });

  it("imports resource JSON and makes entries searchable", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const idBase = Math.floor(Date.now() % 1_000_000_000);
    const uniqueTerm = `importedresource${idBase}`;
    const shareAlike = "Redistributed excerpts must preserve E2E share-alike terms.";
    const importedAt = new Date(Date.now() + 120_000).toISOString();
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 12,
      exported_at: importedAt,
      tables: {
        resource_sources: [
          {
            id: idBase,
            slug: `e2e-resource-source-${idBase}`,
            title: `E2E Imported Resource ${idBase}`,
            source_url: "E2E fixture",
            license: "Public Domain",
            attribution: "E2E resource import fixture.",
            version: "e2e",
            imported_at: importedAt,
            metadata_json: JSON.stringify({
              source_status: "user-imported",
              source_review: "E2E source review note.",
              redistribution: "Allowed in test exports with attribution.",
              share_alike_requirements: shareAlike,
            }),
          },
        ],
        resource_collections: [
          {
            id: idBase,
            source_id: idBase,
            slug: `e2e-collection-${idBase}`,
            title: "E2E Imported Collection",
            kind: "commentary",
            metadata_json: "{}",
          },
        ],
        resource_entries: [
          {
            id: idBase,
            collection_id: idBase,
            ref: "E2E 1",
            title: `Imported Resource ${idBase}`,
            body: `This imported resource entry contains the unique searchable term ${uniqueTerm}.`,
            search_text: `Imported Resource ${idBase} ${uniqueTerm}`,
            payload_json: "{}",
          },
        ],
      },
    };

    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.waitForDisplayed({ timeout: 10_000 });
    await textarea.setValue(JSON.stringify(backup));

    const importButton = await $("button=Import pasted JSON");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();

    await waitForBackupStatus("Imported 3", "resource backup JSON import did not complete");

    const resources = await $("button=Resources");
    await resources.waitForClickable({ timeout: 10_000 });
    await resources.click();

    const search = await $('input[aria-label="Search resources"]');
    await search.waitForDisplayed({ timeout: 10_000 });
    await search.setValue(uniqueTerm);

    const results = await $('[data-testid="resource-results"]');
    await browser.waitUntil(
      async () => (await results.getText()).includes(`Imported Resource ${idBase}`),
      { timeout: 10_000, timeoutMsg: "imported resource did not appear in search" },
    );
    const detail = await $('[data-testid="resource-detail"]');
    await expect(detail).toHaveText(expect.stringContaining(uniqueTerm));
    await expect(detail).toHaveText("Public Domain", { containing: true, ignoreCase: true });
    await expect(detail).toHaveText(expect.stringContaining(shareAlike));

    const settingsAgain = await $("button=Settings");
    await settingsAgain.waitForClickable({ timeout: 10_000 });
    await settingsAgain.click();
    const dataSources = await $('[data-testid="data-sources-screen"]');
    await dataSources.waitForDisplayed({ timeout: 10_000 });
    await expect(dataSources).toHaveText(expect.stringContaining(`E2E Imported Resource ${idBase}`));
    await expect(dataSources).toHaveText("E2E source review note.", { containing: true, ignoreCase: true });
    await expect(dataSources).toHaveText(expect.stringContaining(shareAlike));
  });

  it("imports guided Theology study sessions with focus questions and review cards", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const idBase = Math.floor(Date.now() % 1_000_000_000);
    const topicTitle = `Restored Guided Topic ${idBase}`;
    const focusQuestion = `Which doctrine question survived restore ${idBase}?`;
    const importedAt = new Date(Date.now() + 180_000).toISOString();
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 13,
      exported_at: importedAt,
      tables: {
        theology_topics: [
          {
            id: idBase,
            slug: `restored-guided-topic-${idBase}`,
            title: topicTitle,
            parent_id: null,
            summary: "Imported guided study backup fixture.",
            sort_order: idBase,
            created_at: importedAt,
            updated_at: importedAt,
          },
        ],
        guided_study_sessions: [
          {
            id: idBase,
            topic_id: idBase,
            template_slug: "theology-review",
            focus_question: focusQuestion,
            before_response: "Before restore, this was a user-authored starting judgment.",
            after_response: "After restore, this should still be visible.",
            critique: "The AI critique field must remain user-authored.",
            review_cards_json: JSON.stringify([
              {
                kind: "question",
                prompt: "State the study question",
                answer: focusQuestion,
              },
              {
                kind: "critique",
                prompt: "What did I correct?",
                answer: "The restored critique stays attached to the guided session.",
              },
            ]),
            completed_at: importedAt,
            created_at: importedAt,
            updated_at: importedAt,
          },
        ],
      },
    };

    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.waitForDisplayed({ timeout: 10_000 });
    await textarea.setValue(JSON.stringify(backup));

    const importButton = await $("button=Import pasted JSON");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();

    await waitForBackupStatus("Imported 2", "guided study backup JSON import did not complete");

    const theology = await $("button=Theology");
    await theology.waitForClickable({ timeout: 10_000 });
    await theology.click();

    const restoredTopic = await $(`button*=${topicTitle}`);
    await restoredTopic.waitForClickable({ timeout: 10_000 });
    await restoredTopic.click();

    const history = await $('[data-testid="guided-study-history"]');
    await history.waitForDisplayed({ timeout: 10_000 });
    await expect(history).toHaveText("Completed", { containing: true, ignoreCase: true });
    await expect(history).toHaveText("Review my theology", { containing: true, ignoreCase: true });
    await expect(history).toHaveText(expect.stringContaining(focusQuestion));

    await history.$("button*=Review my theology").click();
    const runner = await $('[data-testid="guided-study-runner"]');
    await runner.waitForDisplayed({ timeout: 10_000 });
    await expect(runner.$('textarea[aria-label="Guided study question"]')).toHaveValue(
      expect.stringContaining(focusQuestion),
    );
    const reviewCards = await $('[data-testid="guided-review-cards"]');
    await expect(reviewCards).toHaveText("State the study question", { containing: true, ignoreCase: true });
    await expect(reviewCards).toHaveText(expect.stringContaining(focusQuestion));
  });

  it("refreshes Settings Data Sources after import without leaving Settings", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const idBase = Math.floor(Date.now() % 1_000_000_000);
    const sourceTitle = `In-place Refresh Source ${idBase}`;
    const importedAt = new Date(Date.now() + 240_000).toISOString();
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 12,
      exported_at: importedAt,
      tables: {
        resource_sources: [
          {
            id: idBase,
            slug: `e2e-inplace-source-${idBase}`,
            title: sourceTitle,
            source_url: "E2E fixture",
            license: "Public Domain",
            attribution: "E2E in-place refresh fixture.",
            version: "e2e",
            imported_at: importedAt,
            metadata_json: JSON.stringify({
              source_status: "user-imported",
              source_review: "E2E in-place review note.",
            }),
          },
        ],
      },
    };

    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.waitForDisplayed({ timeout: 10_000 });
    await textarea.setValue(JSON.stringify(backup));

    const importButton = await $("button=Import pasted JSON");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();

    await waitForBackupStatus("Imported 1", "in-place resource import did not complete");

    // Without navigating away from Settings, Data Sources must reflect the import.
    const dataSources = await $('[data-testid="data-sources-screen"]');
    await dataSources.waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => (await dataSources.getText()).includes(sourceTitle),
      { timeout: 10_000, timeoutMsg: "Data Sources did not refresh in place after import" },
    );
  });

  it("flags a backup-imported source with no review as unreviewed", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const idBase = Math.floor(Date.now() % 1_000_000_000);
    const sourceTitle = `Unreviewed Source ${idBase}`;
    const importedAt = new Date(Date.now() + 300_000).toISOString();
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 12,
      exported_at: importedAt,
      tables: {
        resource_sources: [
          {
            id: idBase,
            slug: `e2e-unreviewed-${idBase}`,
            title: sourceTitle,
            source_url: "E2E fixture",
            license: "Public Domain",
            attribution: "E2E unreviewed fixture.",
            version: "e2e",
            imported_at: importedAt,
            // No source_review -> import must quarantine it as unreviewed.
            metadata_json: JSON.stringify({ source_status: "user-imported" }),
          },
        ],
      },
    };

    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.waitForDisplayed({ timeout: 10_000 });
    await textarea.setValue(JSON.stringify(backup));
    const importButton = await $("button=Import pasted JSON");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();
    await waitForBackupStatus("Imported 1", "unreviewed source import did not complete");

    const dataSources = await $('[data-testid="data-sources-screen"]');
    await dataSources.waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => (await dataSources.getText()).includes(sourceTitle),
      { timeout: 10_000, timeoutMsg: "imported source did not appear in Data Sources" },
    );
    const badge = await dataSources.$('[data-testid="source-unreviewed-badge"]');
    await expect(badge).toBeDisplayed();
  });
});

async function waitForBackupStatus(expected: string, timeoutMsg: string) {
  const status = await $('[data-testid="backup-status"]');
  await status.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => {
      const text = await status.getText();
      return text.includes(expected) || text.includes("failed");
    },
    { timeout: 10_000, timeoutMsg },
  );
  await expect(status).toHaveText(expected, { containing: true, ignoreCase: true });
}
