import { browser, $, $$, expect } from "@wdio/globals";

async function openWorkspaces() {
  const existingHeading = await $("h1=Workspaces");
  if (await existingHeading.isDisplayed().catch(() => false)) {
    return $("button=Workspaces");
  }
  const work = await $("button=Workspaces");
  await work.waitForExist({ timeout: 10_000 });
  await browser.execute((button) => (button as HTMLButtonElement).click(), work);
  await $("h1=Workspaces").waitForDisplayed({ timeout: 10_000 });
  return work;
}

describe("Workspaces", () => {
  it("creates and deletes a workspace", async () => {
    const title = `E2E workspace ${Date.now()}`;
    const work = await openWorkspaces();

    const heading = await $("h1=Workspaces");
    await heading.waitForDisplayed({ timeout: 10_000 });

    const input = await $('input[placeholder="New workspace"]');
    await input.setValue(title);
    await $("button=New").click();

    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    await expect(created).toBeDisplayed();

    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();
    const shortcut = await $(`button=${title}`);
    await shortcut.waitForExist({ timeout: 10_000 });
    await shortcut.scrollIntoView();
    await shortcut.waitForDisplayed({ timeout: 10_000 });
    await shortcut.waitForClickable({ timeout: 10_000 });
    await shortcut.click();
    await created.waitForDisplayed({ timeout: 10_000 });

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("updates and archives a workspace", async () => {
    const title = `E2E editable workspace ${Date.now()}`;
    const renamed = `${title} renamed`;
    await openWorkspaces();

    const input = await $('input[placeholder="New workspace"]');
    await input.waitForDisplayed({ timeout: 10_000 });
    await input.setValue(title);
    await $("button=New").click();

    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });

    const titleInput = await $('input[aria-label="Workspace title"]');
    await titleInput.waitForDisplayed({ timeout: 10_000 });
    await titleInput.setValue(renamed);
    const descriptionInput = await $('textarea[aria-label="Workspace description"]');
    await descriptionInput.setValue("Edited in the workspace E2E flow.");
    await $("button=Save Details").click();

    const saved = await $("span=Details saved");
    await saved.waitForDisplayed({ timeout: 10_000 });
    const renamedHeader = await $(`h2=${renamed}`);
    await renamedHeader.waitForDisplayed({ timeout: 10_000 });

    await $("button=Archive").click();
    await renamedHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await expect($(`button*=${renamed}`)).not.toBeDisplayed();
  });

  it("creates, edits, and exports a workspace note", async () => {
    const title = `E2E note workspace ${Date.now()}`;
    const noteTitle = `Workspace note ${Date.now()}`;
    const editedBody =
      "Edited workspace note body for Markdown export.\nOPENAI_API_KEY=TEST_WORKSPACE_LEAK_VALUE\nLocal path C:\\Users\\Example\\secret.txt";
    await openWorkspaces();

    const input = await $('input[placeholder="New workspace"]');
    await input.waitForDisplayed({ timeout: 10_000 });
    await input.setValue(title);
    await $("button=New").click();

    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    const noteTitleInput = await $('input[aria-label="Workspace note title"]');
    await noteTitleInput.waitForDisplayed({ timeout: 10_000 });
    await noteTitleInput.setValue(noteTitle);
    const noteBody = await $('textarea[aria-label="Workspace note body"]');
    await noteBody.setValue("Initial workspace note body.");
    const addNote = await $("button=Add Note");
    await addNote.waitForClickable({ timeout: 10_000 });
    await addNote.click();

    const noteHeading = await $(`h3=${noteTitle}`);
    await noteHeading.waitForDisplayed({ timeout: 10_000 });
    const itemBody = await $(`textarea[aria-label="Workspace note body: ${noteTitle}"]`);
    await itemBody.waitForDisplayed({ timeout: 10_000 });
    await itemBody.setValue(editedBody);
    const saveNote = await $("button=Save note");
    await saveNote.waitForClickable({ timeout: 10_000 });
    await saveNote.click();
    const noteSaved = await $("span=Note saved");
    await noteSaved.waitForDisplayed({ timeout: 10_000 });

    const previewButton = await $("button=Preview Markdown");
    await previewButton.waitForClickable({ timeout: 10_000 });
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return (
          text.includes(noteTitle) &&
          text.includes("Edited workspace note body for Markdown export.") &&
          text.includes("[redacted secret]") &&
          text.includes("[redacted local path]") &&
          !text.includes("TEST_WORKSPACE_LEAK_VALUE") &&
          !text.includes("C:\\Users\\Example\\secret.txt")
        );
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not sanitize workspace note export" },
    );

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("includes resource share-alike requirements in workspace Markdown export", async () => {
    const title = `E2E resource attribution workspace ${Date.now()}`;
    const workspaceId = Date.now();
    const shareAlike = "Redistributed excerpts must preserve CC BY-SA 4.0 terms.";
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 12,
      exported_at: "2026-05-07T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: null,
            created_at: "2026-05-07T00:00:00Z",
            updated_at: "2026-05-07T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: [
          {
            id: workspaceId + 1,
            workspace_id: workspaceId,
            kind: "freeform",
            title: "Resource: Share alike fixture",
            payload_json: JSON.stringify({
              type: "resource_entry",
              title: "Share alike fixture",
              body: "A resource excerpt that carries redistribution obligations.",
              source_title: "Open Resource Fixture",
              collection_title: "Doctrine Sources",
              collection_kind: "commentary",
              license: "CC BY-SA 4.0",
              attribution: "E2E attribution fixture.",
              share_alike_requirements: shareAlike,
            }),
            sort_order: 0,
            created_at: "2026-05-07T00:00:00Z",
            updated_at: "2026-05-07T00:00:00Z",
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
        return (await body.getText()).includes("Imported 2");
      },
      { timeout: 10_000, timeoutMsg: "resource attribution workspace fixture import did not complete" },
    );

    await openWorkspaces();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    const previewButton = await $("button=Preview Markdown");
    await previewButton.waitForClickable({ timeout: 10_000 });
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return (
          text.includes("**Share-alike requirements:**") &&
          text.includes(shareAlike) &&
          text.includes("E2E attribution fixture.")
        );
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include resource share-alike requirements" },
    );

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("includes guided study focus questions in workspace Markdown export", async () => {
    const title = `E2E guided study workspace ${Date.now()}`;
    const workspaceId = Date.now();
    const focusQuestion = "Which passages should govern this guided doctrine study?";
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 13,
      exported_at: "2026-05-07T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: null,
            created_at: "2026-05-07T00:00:00Z",
            updated_at: "2026-05-07T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: [
          {
            id: workspaceId + 1,
            workspace_id: workspaceId,
            kind: "freeform",
            title: "Guided study: Scripture",
            payload_json: JSON.stringify({
              type: "guided_study",
              template_title: "Compare theological positions",
              topic_title: "Scripture",
              focus_question: focusQuestion,
              body: [
                "Compare theological positions: Scripture",
                "",
                "Question",
                focusQuestion,
                "",
                "Before AI",
                "I think the canonical argument is strongest.",
              ].join("\n"),
              review_cards: [
                {
                  kind: "question",
                  prompt: "State the study question",
                  answer: focusQuestion,
                },
              ],
            }),
            sort_order: 0,
            created_at: "2026-05-07T00:00:00Z",
            updated_at: "2026-05-07T00:00:00Z",
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
        return (await body.getText()).includes("Imported 2");
      },
      { timeout: 10_000, timeoutMsg: "guided study workspace fixture import did not complete" },
    );

    await openWorkspaces();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    const previewButton = await $("button=Preview Markdown");
    await previewButton.waitForClickable({ timeout: 10_000 });
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return (
          text.includes("**Guided study question:**") &&
          text.includes(focusQuestion) &&
          text.includes("**Review cards:**")
        );
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include guided study focus question" },
    );

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("adds selected search results to a workspace and previews Markdown", async () => {
    const title = `E2E search workspace ${Date.now()}`;
    const searchInput = await $('input[type="search"]');
    await searchInput.waitForDisplayed({ timeout: 5_000 });
    await searchInput.setValue("mercy");

    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 10_000 });
    const firstHit = await $('[data-testid="search-result"]');
    await firstHit.waitForDisplayed({ timeout: 10_000 });

    await $("button=Save").click();
    const savedSearch = await $("button=mercy");
    await savedSearch.waitForDisplayed({ timeout: 10_000 });

    const selectors = await $$('input[aria-label^="Select "]');
    expect(selectors.length).toBeGreaterThan(1);
    await selectors[0].click();
    await selectors[1].click();

    const addSelected = await $('[data-testid="add-selected-search-results-to-workspace"]');
    await addSelected.waitForClickable({ timeout: 5_000 });
    await addSelected.click();
    const workspaceSelect = await $('[data-testid="add-to-workspace-select"]');
    await workspaceSelect.waitForDisplayed({ timeout: 5_000 });
    await workspaceSelect.selectByAttribute("value", "new");
    const workspaceTitle = await $('input[placeholder="Workspace title"]');
    await workspaceTitle.waitForDisplayed({ timeout: 5_000 });
    await workspaceTitle.setValue(title);
    const confirms = await $$('[data-testid="add-to-workspace-confirm"]');
    await confirms[0].click();
    const added = await $("span=Added");
    await added.waitForDisplayed({ timeout: 10_000 });
    await browser.execute(() => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await resultsHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();

    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    await expect(created).toBeDisplayed();

    const itemTitle = `Renamed saved search ${Date.now()}`;
    const itemTitleInput = await $('input[aria-label^="Workspace item title:"]');
    await itemTitleInput.waitForDisplayed({ timeout: 10_000 });
    await itemTitleInput.setValue(itemTitle);
    const saveTitle = await $("button=Save title");
    await saveTitle.waitForClickable({ timeout: 10_000 });
    await saveTitle.click();
    await browser.waitUntil(
      async () => {
        const labels = await browser.execute(() =>
          Array.from(document.querySelectorAll('[data-testid="workspace-item"] h3')).map(
            (item) => item.textContent ?? "",
          ),
        );
        return labels.some((label) => label.includes(itemTitle));
      },
      { timeout: 10_000, timeoutMsg: "workspace item title did not update" },
    );

    const linkWorkspaceItem = await $('[data-testid="link-workspace-item-to-theology"]');
    await linkWorkspaceItem.waitForClickable({ timeout: 10_000 });
    await linkWorkspaceItem.click();
    const theologyStatus = await $('[data-testid="workspace-theology-status"]');
    await theologyStatus.waitForDisplayed({ timeout: 10_000 });
    await expect(theologyStatus).toHaveText(expect.stringContaining("Linked to"));

    const theology = await $("button=Theology");
    await theology.waitForClickable({ timeout: 10_000 });
    await theology.click();
    await expect(await $("body")).toHaveText(expect.stringContaining(itemTitle));
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const linkedWorkspaceRow = await $(`button*=${title}`);
    await linkedWorkspaceRow.waitForClickable({ timeout: 10_000 });
    await linkedWorkspaceRow.click();
    await $(`h2=${title}`).waitForDisplayed({ timeout: 10_000 });

    const previewButton = await $("button=Preview Markdown");
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return text.includes("mercy") && text.includes("Results when saved") && text.includes("- **");
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include selected search results" },
    );

    const saveMarkdown = await $("button=Save Markdown");
    await saveMarkdown.waitForClickable({ timeout: 5_000 });
    await saveMarkdown.click();
    const saveStatus = await $('[data-testid="workspace-save-status"]');
    await saveStatus.waitForDisplayed({ timeout: 10_000 });
    await expect(saveStatus).toHaveText(expect.stringContaining(".md"));

    const saveHtml = await $("button=Save HTML");
    await saveHtml.waitForClickable({ timeout: 5_000 });
    await saveHtml.click();
    await expect(saveStatus).toHaveText(expect.stringContaining(".html"));

    const savePdf = await $("button=Save PDF");
    await savePdf.waitForClickable({ timeout: 5_000 });
    await savePdf.click();
    await expect(saveStatus).toHaveText(expect.stringContaining(".pdf"));

    const rerunSearch = await $("button=Rerun Search");
    await rerunSearch.waitForClickable({ timeout: 10_000 });
    await rerunSearch.click();
    const rerunHeader = await $("h2*=Search:");
    await rerunHeader.waitForDisplayed({ timeout: 10_000 });
    await expect(rerunHeader).toHaveText(expect.stringContaining("mercy"));
    await browser.execute(() => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await rerunHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const reopenedWorkspaceRow = await $(`button*=${title}`);
    await reopenedWorkspaceRow.waitForClickable({ timeout: 10_000 });
    await reopenedWorkspaceRow.click();
    await created.waitForDisplayed({ timeout: 10_000 });

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("adds an individual search hit to a workspace and reruns its query", async () => {
    const title = `E2E search hit workspace ${Date.now()}`;
    const query = "faith";
    const searchInput = await $('input[type="search"]');
    await searchInput.waitForDisplayed({ timeout: 5_000 });
    await searchInput.setValue(query);

    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 10_000 });
    const firstHit = await $('[data-testid="search-result"]');
    await firstHit.waitForDisplayed({ timeout: 10_000 });

    const addHitButtons = await $$('[data-testid="add-search-hit-to-workspace"]');
    expect(addHitButtons.length).toBeGreaterThan(0);
    await addHitButtons[0].waitForClickable({ timeout: 10_000 });
    await addHitButtons[0].click();
    const workspaceSelect = await $('[data-testid="add-to-workspace-select"]');
    await workspaceSelect.waitForDisplayed({ timeout: 5_000 });
    await workspaceSelect.selectByAttribute("value", "new");
    const workspaceTitle = await $('input[placeholder="Workspace title"]');
    await workspaceTitle.waitForDisplayed({ timeout: 5_000 });
    await workspaceTitle.setValue(title);
    const confirms = await $$('[data-testid="add-to-workspace-confirm"]');
    await confirms[0].click();
    const added = await $("span=Added");
    await added.waitForDisplayed({ timeout: 10_000 });

    await browser.execute(() => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await resultsHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });

    const previewButton = await $("button=Preview Markdown");
    await previewButton.waitForClickable({ timeout: 10_000 });
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return text.includes("Search query:") && text.includes(query);
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include search-hit query" },
    );

    const rerunSearch = await $("button=Rerun Search");
    await rerunSearch.waitForClickable({ timeout: 10_000 });
    await rerunSearch.click();
    const rerunHeader = await $("h2*=Search:");
    await rerunHeader.waitForDisplayed({ timeout: 10_000 });
    await expect(rerunHeader).toHaveText(expect.stringContaining(query));

    await browser.execute(() => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await rerunHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const reopenedWorkspaceRow = await $(`button*=${title}`);
    await reopenedWorkspaceRow.waitForClickable({ timeout: 10_000 });
    await reopenedWorkspaceRow.click();
    await created.waitForDisplayed({ timeout: 10_000 });

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("renames, reruns, and deletes a saved search", async () => {
    const title = `E2E saved search ${Date.now()}`;
    const renamed = `${title} renamed`;
    const searchInput = await $('input[type="search"]');
    await searchInput.waitForDisplayed({ timeout: 5_000 });
    await searchInput.setValue(title);

    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 10_000 });
    const saveSearch = await $("button=Save");
    await saveSearch.waitForClickable({ timeout: 10_000 });
    await saveSearch.click();

    const savedSearch = await $(`button=${title}`);
    await savedSearch.waitForExist({ timeout: 10_000 });
    await savedSearch.scrollIntoView();
    await savedSearch.waitForDisplayed({ timeout: 10_000 });
    const edit = await $(`[aria-label="Rename saved search ${title}"]`);
    await edit.waitForClickable({ timeout: 10_000 });
    await edit.click();

    const titleInput = await $('input[aria-label^="Saved search title:"]');
    await titleInput.waitForDisplayed({ timeout: 10_000 });
    await titleInput.setValue(renamed);
    const saveRename = await $(`[aria-label="Save saved search ${title}"]`);
    await saveRename.waitForClickable({ timeout: 10_000 });
    await saveRename.click();

    const renamedSearch = await $(`button=${renamed}`);
    await renamedSearch.waitForExist({ timeout: 10_000 });
    await renamedSearch.scrollIntoView();
    await renamedSearch.waitForDisplayed({ timeout: 10_000 });
    await renamedSearch.click();
    await browser.waitUntil(
      async () => {
        const inputValue = await searchInput.getValue();
        return inputValue === title;
      },
      { timeout: 10_000, timeoutMsg: "renamed saved search did not rerun original query" },
    );

    const deleteButton = await $(`[aria-label="Delete saved search ${renamed}"]`);
    await deleteButton.waitForClickable({ timeout: 10_000 });
    await deleteButton.click();
    await renamedSearch.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await browser.execute(() => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await resultsHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("reorders workspace items", async () => {
    const title = `E2E reorder workspace ${Date.now()}`;
    const workspaceId = Date.now();
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 7,
      exported_at: "2026-04-30T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: null,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: [
          {
            id: workspaceId + 1,
            workspace_id: workspaceId,
            kind: "verse",
            title: "Genesis 1:1",
            payload_json: JSON.stringify({
              verse_id: 1001001,
              citation: "Genesis 1:1",
              translation_code: "KJV",
              text: "In the beginning God created the heaven and the earth.",
            }),
            sort_order: 0,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
          },
          {
            id: workspaceId + 2,
            workspace_id: workspaceId,
            kind: "verse",
            title: "Genesis 1:2",
            payload_json: JSON.stringify({
              verse_id: 1001002,
              citation: "Genesis 1:2",
              translation_code: "KJV",
              text: "And the earth was without form, and void.",
            }),
            sort_order: 1,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
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
        return (await body.getText()).includes("Imported 3");
      },
      { timeout: 10_000, timeoutMsg: "workspace fixture import did not complete" },
    );

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();
    const created = await $(`h2=${title}`);
    await created.waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => {
        const labels = await browser.execute(() =>
          Array.from(document.querySelectorAll('[data-testid="workspace-item"] h3')).map(
            (item) => item.textContent ?? "",
          ),
        );
        return labels[0]?.includes("Genesis 1:1") && labels[1]?.includes("Genesis 1:2");
      },
      { timeout: 10_000, timeoutMsg: "workspace items did not render in original order" },
    );

    const downButtons = await $$('[data-testid="workspace-item-move-down"]');
    await downButtons[0].click();

    await browser.waitUntil(
      async () => {
        const labels = await browser.execute(() =>
          Array.from(document.querySelectorAll('[data-testid="workspace-item"] h3')).map(
            (item) => item.textContent ?? "",
          ),
        );
        return labels[0]?.includes("Genesis 1:2") && labels[1]?.includes("Genesis 1:1");
      },
      { timeout: 10_000, timeoutMsg: "workspace items did not reorder" },
    );

    const explainVerse = await $('[aria-label="Explain Genesis 1:2"]');
    await explainVerse.waitForClickable({ timeout: 10_000 });
    await explainVerse.click();
    const explanationItem = await $("h3=Explanation: Genesis 1:2");
    await explanationItem.waitForDisplayed({ timeout: 60_000 });
    await expect(explanationItem).toBeDisplayed();

    const askCouncil = await $("button=Ask Council");
    await askCouncil.waitForClickable({ timeout: 10_000 });
    await askCouncil.click();
    const councilQuestion = await $('textarea[placeholder^="e.g. Should women"]');
    await councilQuestion.waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => {
        const value = await councilQuestion.getValue();
        return value.includes("Genesis 1:2");
      },
      { timeout: 10_000, timeoutMsg: "workspace verse did not prefill Council question" },
    );

    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const reopenedWorkspaceRow = await $(`button*=${title}`);
    await reopenedWorkspaceRow.waitForClickable({ timeout: 10_000 });
    await reopenedWorkspaceRow.click();
    await created.waitForDisplayed({ timeout: 10_000 });

    await $("button=Delete").click();
    await created.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("renders an explanation workspace item and opens its source", async () => {
    const title = `E2E explanation workspace ${Date.now()}`;
    const workspaceId = Date.now();
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 7,
      exported_at: "2026-04-30T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: null,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: [
          {
            id: workspaceId + 1,
            workspace_id: workspaceId,
            kind: "explanation",
            title: "Explanation: Genesis 1:1",
            payload_json: JSON.stringify({
              verse_id: 1001001,
              citation: "Genesis 1:1",
              translation_code: "KJV",
              summary: "Genesis 1:1 introduces God as creator.",
              context: "This explanation was imported for E2E coverage.",
              cautions: ["Read the surrounding creation account."],
            }),
            sort_order: 0,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
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
        return (await body.getText()).includes("Imported 2");
      },
      { timeout: 10_000, timeoutMsg: "explanation fixture import did not complete" },
    );

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();

    const summary = await $("p*=Genesis 1:1 introduces God as creator.");
    await summary.waitForDisplayed({ timeout: 10_000 });
    await expect(summary).toBeDisplayed();

    const source = await $("button*=Open Genesis 1:1");
    await source.waitForClickable({ timeout: 10_000 });
    await source.click();
    const readerHeading = await $("h1*=Genesis");
    await readerHeading.waitForDisplayed({ timeout: 10_000 });
  });

  it("renders a module entry workspace item and exports it", async () => {
    const title = `E2E module entry workspace ${Date.now()}`;
    const workspaceId = Date.now();
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 7,
      exported_at: "2026-04-30T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: null,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: [
          {
            id: workspaceId + 1,
            workspace_id: workspaceId,
            kind: "module_entry",
            title: "Creation note",
            payload_json: JSON.stringify({
              verse_id: 1001001,
              citation: "Genesis 1:1",
              translation_code: "KJV",
              module_id: workspaceId + 2,
              module_title: "Sample Commentary",
              title: "Creation note",
              body: "A module entry attached to Genesis 1:1.",
            }),
            sort_order: 0,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
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
        return (await body.getText()).includes("Imported 2");
      },
      { timeout: 10_000, timeoutMsg: "module entry fixture import did not complete" },
    );

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();

    const body = await $("p*=A module entry attached to Genesis 1:1.");
    await body.waitForDisplayed({ timeout: 10_000 });
    await expect(body).toBeDisplayed();

    const previewButton = await $("button=Preview Markdown");
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return text.includes("Sample Commentary") && text.includes("A module entry attached");
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include module entry" },
    );
  });

  it("opens a saved Council result from a workspace", async () => {
    const title = `E2E council workspace ${Date.now()}`;
    const workspaceId = Date.now();
    const question = `Workspace Council question ${workspaceId}`;
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const response = {
      synthesis: {
        positions: [
          {
            label: "Mock position",
            weight: 0.8,
            summary: "A saved Council result can be restored from a workspace.",
            supporting_evidence_ids: [1001001],
            challenging_evidence_ids: [1001002],
            why_not_higher: "A visible alternative remains in the saved result.",
            confidence_rationale: "The saved result has direct cited evidence and low disagreement.",
            evidence: [
              {
                verse_id: 1001001,
                citation: "Genesis 1:1",
                translation_code: "KJV",
                quote: "In the beginning God created the heaven and the earth.",
                reasoning: "The saved result keeps its source citation.",
              },
            ],
          },
          {
            label: "Mock alternative",
            weight: 0.2,
            summary: "A lower-weighted alternative remains auditable.",
            supporting_evidence_ids: [1001002],
            challenging_evidence_ids: [1001001],
            why_not_higher: "The alternative has less direct support in this fixture.",
            confidence_rationale: "The alternative is included to preserve dissent.",
            evidence: [
              {
                verse_id: 1001002,
                citation: "Genesis 1:2",
                translation_code: "KJV",
                quote: "And the earth was without form, and void.",
                reasoning: "The saved alternative keeps its source citation.",
              },
            ],
          },
        ],
        dissent_notes: "Mock dissent note preserved in export.",
        unresolved_tensions: ["Mock unresolved tension preserved in export."],
        synthesis: "Restored workspace Council synthesis.",
        confidence: "high",
        confidence_rationale: "The workspace fixture includes direct evidence and preserved dissent.",
        evidence_classification: [
          {
            verse_id: 1001001,
            status: "used",
            reasoning: "Used by the leading saved position.",
          },
          {
            verse_id: 1001002,
            status: "conflicting",
            reasoning: "Retained as a challenging saved passage.",
          },
        ],
      },
      voices: [
        {
          provider: "mock",
          display_name: "Mock Council",
          status: "ok",
          result: {
            positions: [
              {
                label: "Mock position",
                weight: 0.8,
                summary: "Voice support for the saved leading position.",
                evidence: [],
              },
              {
                label: "Mock alternative",
                weight: 0.2,
                summary: "Voice support for the saved alternative.",
                evidence: [],
              },
            ],
            dissent_notes: "",
            unresolved_tensions: [],
            synthesis: "",
            confidence: "high",
          },
          error: null,
          duration_ms: 1,
        },
      ],
      manifest: [{ name: "mock", display_name: "Mock Council", available: true }],
      retrieval_mode: "fts",
      evidence_count: 2,
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
          source: "fts",
          keyword_score: 1,
          matched_terms: ["beginning"],
        },
        {
          verse_id: 1001002,
          translation_code: "KJV",
          book_id: 1,
          book_name: "Genesis",
          book_osis: "Gen",
          chapter: 1,
          verse: 2,
          text: "And the earth was without form, and void.",
          source: "fts",
          keyword_score: 1,
          matched_terms: ["earth"],
        },
      ],
    };

    const backup = {
      app: "Bible AI",
      export_version: 1,
      user_schema_version: 7,
      exported_at: "2026-04-30T00:00:00Z",
      tables: {
        study_workspaces: [
          {
            id: workspaceId,
            title,
            description: null,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
            archived_at: null,
          },
        ],
        study_items: [
          {
            id: workspaceId + 1,
            workspace_id: workspaceId,
            kind: "council_result",
            title: "Council: workspace restore",
            payload_json: JSON.stringify({
              question,
              summary: response.synthesis.synthesis,
              synthesis: response.synthesis.synthesis,
              confidence: response.synthesis.confidence,
              response,
            }),
            sort_order: 0,
            created_at: "2026-04-30T00:00:00Z",
            updated_at: "2026-04-30T00:00:00Z",
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
        return (await body.getText()).includes("Imported 2");
      },
      { timeout: 10_000, timeoutMsg: "council fixture import did not complete" },
    );

    const work = await $("button=Workspaces");
    await work.waitForClickable({ timeout: 10_000 });
    await work.click();
    const workspaceRow = await $(`button*=${title}`);
    await workspaceRow.waitForClickable({ timeout: 10_000 });
    await workspaceRow.click();

    const previewButton = await $("button=Preview Markdown");
    await previewButton.waitForClickable({ timeout: 10_000 });
    await previewButton.click();
    const preview = await $('[data-testid="markdown-preview"]');
    await preview.waitForDisplayed({ timeout: 5_000 });
    await browser.waitUntil(
      async () => {
        const text = await preview.getText();
        return (
          text.includes("Cited evidence") &&
          text.includes("Genesis 1:1") &&
          text.includes("In the beginning God created") &&
          text.includes("Mock dissent note preserved in export.") &&
          text.includes("Mock unresolved tension preserved in export.") &&
          text.includes("Council Process") &&
          text.includes("Why This Won") &&
          text.includes("Position Comparison") &&
          text.includes("Voice Agreement Matrix") &&
          text.includes("Evidence by Position") &&
          text.includes("Retrieval Trace") &&
          text.includes("Confidence Rationale")
        );
      },
      { timeout: 5_000, timeoutMsg: "markdown preview did not include Council audit details" },
    );

    const restore = await $("button=View in Council");
    await restore.waitForClickable({ timeout: 10_000 });
    await restore.click();
    const synthesis = await $("h2=Synthesis");
    await synthesis.waitForDisplayed({ timeout: 10_000 });
    const restored = await $("p*=Restored workspace Council synthesis.");
    await restored.waitForDisplayed({ timeout: 10_000 });
    await expect(restored).toBeDisplayed();
  });
});
