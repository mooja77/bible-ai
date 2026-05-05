import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { browser, $, expect } from "@wdio/globals";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Release readiness surfaces", () => {
  it("shows provider setup, data sources, and distribution status in Settings", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const providerStatus = await $("h2=Provider Status");
    await providerStatus.waitForDisplayed({ timeout: 10_000 });
    await expect(providerStatus).toBeDisplayed();
    await expect(await $("button=Test all providers")).toBeDisplayed();
    await expect(await $("button=Test Anthropic")).toBeDisplayed();
    await expect(await $("button=Test Google")).toBeDisplayed();
    await expect(await $("button=Test OpenAI")).toBeDisplayed();

    const dataSources = await $('[data-testid="data-sources-screen"]');
    await dataSources.waitForDisplayed({ timeout: 10_000 });
    await expect(dataSources).toHaveText(expect.stringContaining("KJV"));
    await expect(dataSources).toHaveText(expect.stringContaining("World English Bible"));
    await expect(dataSources).toHaveText(expect.stringContaining("Phase 13"));

    const distribution = await $('[data-testid="about-distribution-screen"]');
    await distribution.waitForDisplayed({ timeout: 10_000 });
    await expect(distribution).toHaveText(expect.stringContaining("Bible AI 0.1.0"));
    await expect(distribution).toHaveText(expect.stringContaining("Personal-use release candidate"));

    const attribution = await $('[data-testid="license-attribution-screen"]');
    await attribution.waitForDisplayed({ timeout: 10_000 });
    await expect(attribution).toHaveText(expect.stringContaining("LICENSE & ATTRIBUTION"));
    await expect(attribution).toHaveText(expect.stringContaining("eBible.org"));
    await expect(attribution).toHaveText(expect.stringContaining("OpenBible"));
    await expect(attribution).toHaveText(expect.stringContaining("PROVIDER CALLS"));
  });

  it("redacts provider keys from JSON backup exports", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const googleKey = await $('input[aria-label="Google API key"]');
    const openAiKey = await $('input[aria-label="OpenAI API key"]');
    const anthropicKey = await $('input[aria-label="Anthropic API key"]');
    await googleKey.setValue("test-google-key-not-real");
    await openAiKey.setValue("test-openai-key-not-real");
    await anthropicKey.setValue("test-anthropic-key-not-real");

    const saveSettings = await $("button=Save settings");
    await saveSettings.waitForClickable({ timeout: 10_000 });
    await saveSettings.click();

    const saveBackup = await $("button=Save backup file");
    await saveBackup.waitForClickable({ timeout: 10_000 });
    await saveBackup.click();

    let backupPath = "";
    await browser.waitUntil(
      async () => {
        const text = await (await $("body")).getText();
        const match = text.match(/Saved (.+?\.json)/);
        if (match) backupPath = match[1];
        return backupPath.length > 0;
      },
      { timeout: 10_000, timeoutMsg: "JSON backup path was not shown" },
    );

    const backupText = readFileSync(backupPath, "utf8");
    expect(backupText).not.toContain("test-google-key-not-real");
    expect(backupText).not.toContain("test-openai-key-not-real");
    expect(backupText).not.toContain("test-anthropic-key-not-real");
    expect(backupText).not.toMatch(/(google_api_key|openai_api_key|anthropic_api_key)/);

    await googleKey.setValue("");
    await openAiKey.setValue("");
    await anthropicKey.setValue("");
    await saveSettings.click();
  });

  it("restores Council quality fixtures and renders provider-failure transparency", async () => {
    const raw = readFileSync(
      resolve(__dirname, "../fixtures/council-quality.json"),
      "utf8",
    );
    const qualityFixtures = JSON.parse(raw) as {
      fixtures: Array<{
        title: string;
        question: string;
        response: Record<string, unknown>;
      }>;
    };
    const workspaceId = Date.now();
    const title = `Council quality fixtures ${workspaceId}`;
    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 7,
      exported_at: "2026-05-02T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: "Hard-topic Council transparency fixtures.",
            created_at: "2026-05-02T00:00:00Z",
            updated_at: "2026-05-02T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: qualityFixtures.fixtures.map((fixture, index) => {
          const synthesis = fixture.response.synthesis as Record<string, unknown> | undefined;
          return {
            id: workspaceId + index + 1,
            workspace_id: workspaceId,
            kind: "council_result",
            title: fixture.title,
            payload_json: JSON.stringify({
              question: fixture.question,
              summary: String(synthesis?.synthesis ?? ""),
              synthesis: String(synthesis?.synthesis ?? ""),
              confidence: String(synthesis?.confidence ?? "low"),
              response: fixture.response,
            }),
            sort_order: index,
            created_at: "2026-05-02T00:00:00Z",
            updated_at: "2026-05-02T00:00:00Z",
          };
        }),
      },
    };

    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();
    const textarea = await $('textarea[aria-label="Backup JSON"]');
    await textarea.waitForDisplayed({ timeout: 10_000 });
    await textarea.setValue(JSON.stringify(backup));
    const importButton = await $("button=Import pasted JSON");
    await importButton.waitForClickable({ timeout: 10_000 });
    await importButton.click();

    await browser.waitUntil(
      async () => {
        const body = await $("body");
        return (await body.getText()).includes("Imported 4");
      },
      { timeout: 10_000, timeoutMsg: "quality fixture import did not complete" },
    );

    const work = await $("button=Work");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspace = await $(`button*=${title}`);
    await workspace.waitForClickable({ timeout: 10_000 });
    await workspace.click();

    const itemFilter = await $('input[aria-label="Filter workspace items"]');
    await itemFilter.waitForDisplayed({ timeout: 10_000 });
    await itemFilter.setValue("provider failure");
    const restore = await $("button=View in Council");
    await restore.waitForClickable({ timeout: 10_000 });
    await restore.click();

    const process = await $('[data-testid="council-process-view"]');
    await process.waitForDisplayed({ timeout: 10_000 });
    await expect(process).toHaveText(expect.stringContaining("1/2 voices ran"));

    const confidence = await $('[data-testid="council-confidence-rationale"]');
    await confidence.waitForDisplayed({ timeout: 10_000 });
    await expect(confidence).toHaveText(expect.stringContaining("Provider failures: 1"));

    const sourceButton = await $("button=View source data");
    await sourceButton.waitForClickable({ timeout: 10_000 });
    await sourceButton.click();
    const sourceJson = await $('[data-testid="council-source-json"]');
    await sourceJson.waitForDisplayed({ timeout: 10_000 });
    await expect(sourceJson).toHaveText(expect.stringContaining("Fixture provider timeout"));
    const sourceText = await sourceJson.getText();
    expect(sourceText).not.toMatch(/[A-Za-z]:\\/);
    expect(sourceText).not.toMatch(/(OPENAI|GOOGLE|ANTHROPIC|API_KEY|api_key)/);
  });
});
