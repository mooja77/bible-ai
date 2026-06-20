import { browser, $, expect } from "@wdio/globals";

/**
 * Canon-limited translations must not eat a column. The bundled corpus has
 * TR (Textus Receptus, New Testament only) and WLC (Westminster Leningrad
 * Codex, Old Testament only). With KJV + TR active:
 *   - on Genesis (OT), TR has no verses → it must be omitted, not rendered as a
 *     full "No verses for this chapter." column, and a calm note says so;
 *   - on John (NT), both have text → every translation shows, no note.
 *
 * The corpus ships six translations; earlier specs may leave some enabled, so
 * the test pins the exact active set and restores the default (KJV only) at the
 * end to keep the shared wdio session clean.
 */
describe("Empty translation columns", () => {
  const ALL_CODES = ["KJV", "ASV", "YLT", "WLC", "TR", "WEB"];

  async function setChecked(code: string, desired: boolean) {
    const box = await $(`[data-testid="translation-${code}"]`);
    // The translation rows depend on the async translations load; on a cold
    // start (this spec running first) that fetch can lag, so wait for existence
    // generously, scroll into view, then toggle.
    await box.waitForExist({ timeout: 20_000 });
    await box.scrollIntoView();
    await box.waitForDisplayed({ timeout: 10_000 });
    if ((await box.isSelected()) !== desired) {
      await box.click();
    }
  }

  // Make exactly `codes` active and everything else off.
  async function setExactActive(codes: string[]) {
    for (const code of ALL_CODES) {
      await setChecked(code, codes.includes(code));
    }
  }

  // Book navigation now lives in the on-demand BookNav drawer (WC1 shell).
  async function openBookNav() {
    const nav = await $('[data-testid="book-nav"]');
    if (await nav.isExisting()) return;
    await $('[data-testid="book-nav-toggle"]').click();
    await nav.waitForDisplayed({ timeout: 5_000 });
  }

  // The drawer overlays the main column; close it before touching main-area
  // controls (translation checkboxes) or asserting the omission note.
  async function closeBookNav() {
    const nav = await $('[data-testid="book-nav"]');
    if (!(await nav.isExisting())) return;
    await browser.keys("Escape");
    await nav.waitForDisplayed({ reverse: true, timeout: 5_000 });
  }

  async function headingIncludes(text: string) {
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          (t) =>
            Array.from(document.querySelectorAll("h1")).some((h) =>
              (h.textContent ?? "").includes(t),
            ),
          text,
        )) === true,
      { timeout: 10_000, timeoutMsg: `reader heading should include "${text}"` },
    );
  }

  it("omits a translation that has no text for the chapter, with a note", async () => {
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();

    // Active = KJV (present in Genesis) + TR (NT-only, absent in Genesis).
    await setExactActive(["KJV", "TR"]);

    // Go to Genesis 1, where TR has no verses. Use the book list button (exact
    // text) so navigation does not race the controlled jump-input state.
    await openBookNav();
    const genesis = await $("button=Genesis");
    await genesis.waitForClickable({ timeout: 10_000 });
    await genesis.click();
    await closeBookNav();
    await headingIncludes("Genesis");

    // The omission note is shown and names TR (and only TR).
    const note = await $('[data-testid="absent-translations-note"]');
    await note.waitForDisplayed({ timeout: 10_000 });
    await expect(note).toHaveText(expect.stringContaining("TR"));
    await expect(note).not.toHaveText(expect.stringContaining("KJV"));

    // The raw empty-column message must NOT appear anywhere on the page.
    const emptyMsg = await $("p*=No verses for this chapter");
    await expect(emptyMsg).not.toBeExisting();

    // KJV's text still renders (Genesis 1:1 well-known opening).
    const body = await $("body");
    await expect(body).toHaveText(expect.stringContaining("In the beginning"));
  });

  it("shows every active translation when all have text for the chapter", async () => {
    // Self-sufficient setup (do not depend on the previous test's end state):
    // ensure the Reader is active and KJV+TR are the active set.
    const reader = await $("button=Reader");
    await reader.waitForClickable({ timeout: 10_000 });
    await reader.click();
    await setExactActive(["KJV", "TR"]);

    // John exists in both KJV and TR, so nothing is omitted.
    await openBookNav();
    const john = await $("button=John");
    await john.waitForClickable({ timeout: 10_000 });
    await john.click();
    await closeBookNav();
    await headingIncludes("John");

    const note = await $('[data-testid="absent-translations-note"]');
    await note.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await expect(note).not.toBeExisting();

    // Restore the shared session to the default single-KJV state.
    await setExactActive(["KJV"]);
  });
});
