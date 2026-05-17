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

    await browser.waitUntil(
      async () => {
        const body = await $("body");
        return (await body.getText()).includes("Imported 1");
      },
      { timeout: 10_000, timeoutMsg: "backup JSON import did not complete" },
    );

    const imported = await $(`button=${bookmarkLabel}`);
    await imported.waitForDisplayed({ timeout: 10_000 });
    await expect(imported).toBeDisplayed();
  });

  it("creates a SQLite backup and restores from that backup path", async () => {
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

    const pathInput = await $('input[aria-label="SQLite restore path"]');
    await pathInput.waitForDisplayed({ timeout: 10_000 });
    await pathInput.setValue(backupPath);

    const restoreButton = await $("button=Restore SQLite");
    await restoreButton.waitForClickable({ timeout: 10_000 });
    await restoreButton.click();

    await browser.waitUntil(
      async () => {
        const body = await $("body");
        return (await body.getText()).includes("Restored SQLite. Safety backup:");
      },
      { timeout: 10_000, timeoutMsg: "SQLite restore did not complete" },
    );
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

    await browser.waitUntil(
      async () => (await (await $("body")).getText()).includes("Imported 3"),
      { timeout: 10_000, timeoutMsg: "resource backup JSON import did not complete" },
    );

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
    await expect(detail).toHaveText(expect.stringContaining("Public Domain"));
    await expect(detail).toHaveText(expect.stringContaining(shareAlike));

    const settingsAgain = await $("button=Settings");
    await settingsAgain.waitForClickable({ timeout: 10_000 });
    await settingsAgain.click();
    const dataSources = await $('[data-testid="data-sources-screen"]');
    await dataSources.waitForDisplayed({ timeout: 10_000 });
    await expect(dataSources).toHaveText(expect.stringContaining(`E2E Imported Resource ${idBase}`));
    await expect(dataSources).toHaveText(expect.stringContaining("E2E source review note."));
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

    await browser.waitUntil(
      async () => (await (await $("body")).getText()).includes("Imported 2"),
      { timeout: 10_000, timeoutMsg: "guided study backup JSON import did not complete" },
    );

    const theology = await $("button=Theology");
    await theology.waitForClickable({ timeout: 10_000 });
    await theology.click();

    const restoredTopic = await $(`button*=${topicTitle}`);
    await restoredTopic.waitForClickable({ timeout: 10_000 });
    await restoredTopic.click();

    const history = await $('[data-testid="guided-study-history"]');
    await history.waitForDisplayed({ timeout: 10_000 });
    await expect(history).toHaveText(expect.stringContaining("Completed"));
    await expect(history).toHaveText(expect.stringContaining("Review my theology"));
    await expect(history).toHaveText(expect.stringContaining(focusQuestion));

    await history.$("button*=Review my theology").click();
    const runner = await $('[data-testid="guided-study-runner"]');
    await runner.waitForDisplayed({ timeout: 10_000 });
    await expect(runner.$('textarea[aria-label="Guided study question"]')).toHaveValue(
      expect.stringContaining(focusQuestion),
    );
    const reviewCards = await $('[data-testid="guided-review-cards"]');
    await expect(reviewCards).toHaveText(expect.stringContaining("State the study question"));
    await expect(reviewCards).toHaveText(expect.stringContaining(focusQuestion));
  });
});
