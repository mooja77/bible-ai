import { browser, $, expect } from "@wdio/globals";

/**
 * Accessibility guard: in LIGHT mode, visible text must meet WCAG AA contrast
 * (4.5:1 for normal text, 3:1 for large/bold) against its effective background.
 * Light mode is built by mirroring the neutral scale, which can leave "muted"
 * greys too light on a light background — this catches that regression across
 * the main screens. Dark mode is the default and visually verified separately.
 *
 * Contrast is computed by compositing translucent surface layers over an
 * approximate light app background; the failures this guards against (~2.5–4:1)
 * sit far below the threshold, so the approximation is more than adequate.
 */
describe("Light-mode text contrast (WCAG AA)", () => {
  async function gotoMode(label: string) {
    const btn = await $(`button=${label}`);
    await btn.waitForClickable({ timeout: 10_000 });
    await btn.click();
    await browser.pause(500);
  }

  async function failuresOnScreen() {
    return browser.execute(() => {
      const BASE = [233, 236, 239]; // approx light app background (--app-grad-b)
      const parse = (c: string): number[] | null => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(",").map((x) => parseFloat(x.trim()));
        return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
      };
      const over = (fg: number[], bg: number[]) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
      const effBg = (el: Element) => {
        const layers: number[][] = [];
        let cur: Element | null = el;
        while (cur) {
          const bc = parse(getComputedStyle(cur).backgroundColor);
          if (bc && bc[3] > 0) layers.push(bc);
          cur = cur.parentElement;
        }
        let acc = [BASE[0], BASE[1], BASE[2]];
        for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
        return acc;
      };
      const lum = (rgb: number[]) =>
        rgb
          .map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a: number[], b: number[]) => {
        const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      const out: Array<{ ratio: number; need: number; cls: string; txt: string }> = [];
      const seen = new Set<string>();
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (el.children.length > 0) continue;
        const txt = (el.textContent ?? "").trim();
        if (!txt) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const st = getComputedStyle(el);
        if (st.visibility === "hidden" || st.opacity === "0") continue;
        const fg = parse(st.color);
        if (!fg) continue;
        const bg = effBg(el);
        const fgComp = fg[3] < 1 ? over(fg, bg) : [fg[0], fg[1], fg[2]];
        const px = parseFloat(st.fontSize);
        const large = px >= 24 || (px >= 18.66 && parseInt(st.fontWeight) >= 700);
        const need = large ? 3.0 : 4.5;
        const cr = ratio(fgComp, bg);
        if (cr < need - 0.05) {
          const key = `${el.className}|${txt.slice(0, 20)}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ ratio: Math.round(cr * 100) / 100, need, cls: String(el.className).slice(0, 50), txt: txt.slice(0, 30) });
          }
        }
      }
      return out;
    });
  }

  it("meets AA across Reader, Council, Settings, Theology, and Resources", async () => {
    await gotoMode("Reader");
    const toLight = await $('button[aria-label="Switch to light theme"]');
    if (await toLight.isExisting()) {
      await toLight.click();
      await browser.pause(500);
    }

    // Book nav now lives in the on-demand BookNav drawer (WC1 shell). Open it,
    // pick Genesis, close it, so the reader shows verse text for the contrast
    // sweep. (The reader also defaults to Genesis, so this is belt-and-braces.)
    await $('[data-testid="book-nav-toggle"]').click();
    await $('[data-testid="book-nav"]').waitForDisplayed({ timeout: 5_000 });
    const genesis = await $("button=Genesis");
    if (await genesis.isClickable()) await genesis.click();
    await browser.keys("Escape");
    await $('[data-testid="book-nav"]').waitForDisplayed({ reverse: true, timeout: 5_000 });
    await browser.pause(600);
    const failures: Array<{ screen: string; items: unknown[] }> = [];
    for (const screen of ["Reader", "Council", "Settings", "Theology", "Resources"]) {
      if (screen !== "Reader") await gotoMode(screen);
      const items = await failuresOnScreen();
      if (items.length) failures.push({ screen, items });
    }

    // Restore dark mode + Reader for the shared session.
    await gotoMode("Reader");
    const toDark = await $('button[aria-label="Switch to dark theme"]');
    if (await toDark.isExisting()) await toDark.click();

    expect(failures).toEqual([]);
  });
});
