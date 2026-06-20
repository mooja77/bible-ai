/**
 * Semantic search strategy E2E test.
 *
 * Tests the search-strategy control (Keyword/Meaning/Both) and the graceful
 * degradation path. The degradation is forced deterministically by selecting the
 * WEB translation (which has no semantic index in the corpus database) before
 * switching to Meaning strategy. This guarantees the "No meaning index" branch
 * in the Rust search handler fires — regardless of whether Ollama happens to be
 * running locally.
 *
 * Persistence assertion is NOT included because the harness creates a fresh
 * temp profile per session (mkdtempSync in beforeSession) and provides no
 * mechanism to restart the app while keeping that profile alive. A persistence
 * check would be a guaranteed false failure in CI.
 */

import { $, $$, browser, expect } from "@wdio/globals";

describe("Semantic search strategy", () => {
  it("shows strategy buttons with Keyword selected by default", async () => {
    // Wait for the app shell to be interactive (same baseline as other specs).
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 30_000 });

    await browser.keys("/");
    await $('[data-testid="search-panel"]').waitForDisplayed({ timeout: 5_000 });

    const keyword = await $('[data-testid="search-strategy-keyword"]');
    const semantic = await $('[data-testid="search-strategy-semantic"]');
    const hybrid = await $('[data-testid="search-strategy-hybrid"]');

    await keyword.waitForDisplayed({ timeout: 10_000 });
    await expect(keyword).toBeDisplayed();
    await expect(semantic).toBeDisplayed();
    await expect(hybrid).toBeDisplayed();

    // Keyword is the default — aria-pressed should be "true".
    await expect(keyword).toHaveAttribute("aria-pressed", "true");

    // Leave the panel closed so the next test can click the sidebar nav.
    await browser.keys("Escape");
    await $('[data-testid="search-panel"]').waitForDisplayed({ reverse: true, timeout: 5_000 });
  });

  it("selects Meaning strategy and shows degraded fallback notice with results", async () => {
    // Navigate to Reader mode first (council-mock spec leaves the app in
    // Council mode; the search input is in the sidebar and always visible, but
    // we need Reader mode active so Search Results can mount in the main pane).
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    // Search controls now live in the SearchPanel overlay — open it via "/".
    await browser.keys("/");
    await $('[data-testid="search-panel"]').waitForDisplayed({ timeout: 5_000 });

    // Select the WEB translation in the search-scope filter. WEB has no
    // semantic index in the corpus database, so any Meaning-strategy search
    // against it will degrade to keyword — deterministically, regardless of
    // whether Ollama is running in this environment.
    const translationFilter = await $('select[aria-label="Search translation"]');
    await translationFilter.waitForDisplayed({ timeout: 10_000 });
    await translationFilter.selectByVisibleText("WEB");

    // Switch to Meaning (semantic) strategy BEFORE typing so the strategy is
    // set when the search fires — avoids a race where the strategy changes
    // mid-flight while a prior keyword search is still settling.
    const semantic = await $('[data-testid="search-strategy-semantic"]');
    await semantic.waitForClickable({ timeout: 10_000 });
    await semantic.click();

    // The button should now report aria-pressed="true".
    await browser.waitUntil(
      async () => (await semantic.getAttribute("aria-pressed")) === "true",
      { timeout: 10_000, timeoutMsg: "search-strategy-semantic did not become aria-pressed=true" },
    );
    await expect(semantic).toHaveAttribute("aria-pressed", "true");

    // Keyword button should no longer be pressed.
    const keyword = await $('[data-testid="search-strategy-keyword"]');
    await expect(keyword).toHaveAttribute("aria-pressed", "false");

    // Type the search query — the search fires with strategy=semantic and
    // translation=WEB (no index) → backend degrades to keyword immediately.
    const search = await $('input[type="search"]');
    await search.waitForDisplayed({ timeout: 10_000 });
    await search.click();
    await search.setValue("love");

    // The results header confirms the search is active.
    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 15_000 });

    // WEB has no meaning index → backend sets degraded=true immediately
    // (no Ollama call needed). The UI shows a notice and falls back to keyword.
    // Poll via execute() since the element is conditionally rendered.
    await browser.waitUntil(
      () =>
        browser.execute(
          () =>
            !!document.querySelector('[data-testid="search-degraded-notice"]'),
        ),
      {
        timeout: 20_000,
        timeoutMsg:
          "search-degraded-notice did not appear (expected 'No meaning index for WEB' degradation)",
      },
    );
    const degradedNotice = await $('[data-testid="search-degraded-notice"]');
    await expect(degradedNotice).toBeDisplayed();

    // Keyword fallback still returns results (WEB has FTS content).
    await browser.waitUntil(
      async () => (await $$('[data-testid="search-result"]')).length > 0,
      { timeout: 20_000, timeoutMsg: "no search results rendered after semantic strategy degraded to keyword" },
    );
    const hits = await $$('[data-testid="search-result"]');
    expect(hits.length).toBeGreaterThan(0);

    // Clean up: restore keyword strategy, reset translation filter, clear search.
    await keyword.waitForClickable({ timeout: 5_000 });
    await keyword.click();
    await browser.waitUntil(
      async () => (await keyword.getAttribute("aria-pressed")) === "true",
      { timeout: 5_000, timeoutMsg: "keyword strategy did not restore after test cleanup" },
    );
    await translationFilter.selectByVisibleText("Active translation");
    await $('[aria-label="Clear search"]').click();
    await resultsHeader.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await browser.keys("Escape");
    await $('[data-testid="search-panel"]').waitForDisplayed({ reverse: true, timeout: 5_000 });
  });
});
