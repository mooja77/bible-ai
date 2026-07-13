/**
 * Semantic search strategy E2E test.
 *
 * Tests the search-strategy control (Keyword/Meaning/Both), WEB's completed
 * semantic index, and the explicit fallback contract when query embedding is
 * unavailable. A machine with Ollama returns meaning hits; a machine without it
 * must explain its keyword fallback. Neither outcome may claim WEB lacks an
 * index.
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

  it("uses WEB meaning search or explains query-embedding fallback", async () => {
    // Navigate to Reader mode first (council-mock spec leaves the app in
    // Council mode; the search input is in the sidebar and always visible, but
    // we need Reader mode active so Search Results can mount in the main pane).
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    // Search controls now live in the SearchPanel overlay — open it via "/".
    await browser.keys("/");
    await $('[data-testid="search-panel"]').waitForDisplayed({ timeout: 5_000 });

    // WEB is fully embedded in the release corpus.
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

    // Type the search query. Query embedding succeeds when Ollama is available;
    // otherwise the backend must report its fallback and still return results.
    const search = await $('input[type="search"]');
    await search.waitForDisplayed({ timeout: 10_000 });
    await search.click();
    await search.setValue("love");

    // The results header confirms the search is active.
    const resultsHeader = await $("h2*=Search:");
    await resultsHeader.waitForDisplayed({ timeout: 15_000 });

    // Both the indexed semantic route and the disclosed keyword fallback must
    // return usable WEB results.
    await browser.waitUntil(
      async () => (await $$('[data-testid="search-result"]')).length > 0,
      { timeout: 30_000, timeoutMsg: "no WEB search results rendered" },
    );
    const hits = await $$('[data-testid="search-result"]');
    expect(hits.length).toBeGreaterThan(0);

    const degradedNotice = await $('[data-testid="search-degraded-notice"]');
    if (await degradedNotice.isExisting()) {
      const reason = await degradedNotice.getText();
      expect(reason).toContain("Ollama");
      expect(reason).not.toContain("No meaning index for WEB");
    } else {
      const meaningBadges = await $$('[data-testid="match-kind-badge"]');
      expect(meaningBadges.length).toBeGreaterThan(0);
    }

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
