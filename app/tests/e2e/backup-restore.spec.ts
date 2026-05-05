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
});
