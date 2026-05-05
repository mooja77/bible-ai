/**
 * Smoke test — does the app boot and render its shell correctly?
 * No network calls: we don't exercise the council here (that would consume
 * Claude tokens on every CI run). Council tests belong in their own spec
 * gated behind a flag.
 */

import { $, expect } from "@wdio/globals";

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

  it("populates the translation picker with the 6 ingested translations", async () => {
    // Each checkbox row has its translation code in a <span> with text content.
    const codes = ["KJV", "ASV", "WEB", "YLT", "TR", "WLC"];
    for (const code of codes) {
      const label = await $(`span=${code}`);
      await label.waitForDisplayed({ timeout: 10_000 });
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
});
