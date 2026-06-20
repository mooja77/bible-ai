import { browser, $, expect } from "@wdio/globals";

/**
 * Accessibility/layout guard: at the LARGEST App text size, the dense screens
 * (Reader, Council, Settings) must not break — nothing may overflow the viewport
 * horizontally, and no visible text may be clipped/cut off. Large text is a core
 * need for the non-technical / low-vision readers this app targets, so this is a
 * real regression gate, not a nicety.
 *
 * An intentionally screen-reader-only element (the "Skip to main content" link,
 * width ~1px with overflow:hidden) is allowed; everything else is not.
 */
describe("Layout at maximum text size", () => {
  async function stepUiScale(testId: string) {
    const btn = await $(`[data-testid="${testId}"]`);
    await btn.waitForClickable({ timeout: 10_000 });
    for (let i = 0; i < 5; i++) {
      if (await btn.isClickable()) await btn.click();
    }
  }

  // Returns layout problems on the current screen: viewport overflow, elements
  // spilling past the right edge, or genuinely clipped (not intentionally
  // truncated) text.
  async function layoutProblems() {
    return browser.execute(() => {
      const vw = document.documentElement.clientWidth;
      const out: Array<{ what: string; detail: string }> = [];
      const describe = (el: Element) => {
        const id = el.getAttribute("data-testid");
        const aria = el.getAttribute("aria-label");
        const txt = (el.textContent ?? "").trim().slice(0, 40);
        return `${el.tagName.toLowerCase()}${id ? `#${id}` : ""}${aria ? `[${aria}]` : ""} "${txt}"`;
      };

      const se = document.scrollingElement || document.documentElement;
      if (se.scrollWidth > se.clientWidth + 2) {
        out.push({ what: "page-h-overflow", detail: `scrollWidth ${se.scrollWidth} > ${se.clientWidth}` });
      }

      const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
      const seen = new Set<string>();
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 3 && r.left < vw) {
          const d = describe(el);
          if (!seen.has("spill:" + d)) {
            seen.add("spill:" + d);
            out.push({ what: "spills-right", detail: `${d} right=${Math.round(r.right)} vw=${vw}` });
          }
        }
      }

      // Form controls (input/select/textarea) have intrinsic sizing — their
      // scrollWidth includes UA spinners/padding and they scroll internally, so
      // they are not "clipped text". We only flag static text overflow.
      const FORM = new Set(["INPUT", "SELECT", "TEXTAREA"]);
      for (const el of all) {
        if (el.children.length > 0) continue; // leaf text only
        if (FORM.has(el.tagName)) continue;
        const style = getComputedStyle(el);
        if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
        if (el.scrollWidth <= el.clientWidth + 4 || el.clientWidth === 0) continue;
        // Allow intentional truncation (hidden overflow + ellipsis/nowrap), e.g.
        // the screen-reader-only skip link.
        const intentional =
          style.overflow !== "visible" &&
          (style.textOverflow === "ellipsis" || style.whiteSpace.includes("nowrap"));
        if (intentional) continue;
        const d = describe(el);
        if (!seen.has("clip:" + d)) {
          seen.add("clip:" + d);
          out.push({ what: "text-clipped", detail: `${d} sw=${el.scrollWidth} cw=${el.clientWidth}` });
        }
      }
      return out;
    });
  }

  async function gotoMode(label: string) {
    const btn = await $(`button=${label}`);
    await btn.waitForClickable({ timeout: 10_000 });
    await btn.click();
    await browser.pause(600);
  }

  it("does not overflow or clip text on Reader, Council, or Settings at max scale", async () => {
    await gotoMode("Reader");
    await stepUiScale("ui-scale-inc"); // saturate to the largest step
    await expect(await $('[data-testid="ui-scale-value"]')).toHaveText("140%");

    // Reader with content. Book nav now lives in the on-demand BookNav drawer
    // (WC1 shell); open it, pick Genesis, then close it so the overflow scan
    // runs against the reader (not the transient drawer).
    await $('[data-testid="book-nav-toggle"]').click();
    await $('[data-testid="book-nav"]').waitForDisplayed({ timeout: 5_000 });
    const genesis = await $("button=Genesis");
    if (await genesis.isClickable()) await genesis.click();
    await browser.keys("Escape");
    await $('[data-testid="book-nav"]').waitForDisplayed({ reverse: true, timeout: 5_000 });
    await browser.pause(600);
    expect(await layoutProblems()).toEqual([]);

    await gotoMode("Council");
    expect(await layoutProblems()).toEqual([]);

    await gotoMode("Settings");
    expect(await layoutProblems()).toEqual([]);

    // Restore the shared session to the default scale and the Reader.
    await stepUiScale("ui-scale-dec");
    await expect(await $('[data-testid="ui-scale-value"]')).toHaveText("100%");
    await gotoMode("Reader");
  });
});
