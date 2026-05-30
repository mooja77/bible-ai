import { browser, $, expect } from "@wdio/globals";

/**
 * G2 GlobalErrorNotice — global listeners surface otherwise-silent async failures.
 *
 * Unlike G1 (no product code path throws on demand), the global `window` listener
 * CAN be exercised safely by dispatching a standard synthetic `ErrorEvent` through
 * the test harness — the production listener handles it on the same code path as a
 * real uncaught error, without shipping any fault-injection surface.
 */
describe("Global async-error notice", () => {
  it("surfaces a dismissible toast for an uncaught error", async () => {
    // The app is already loaded in the shared session — no navigation needed
    // (the Tauri/wdio harness has no baseUrl, so `browser.url("/")` is invalid).
    // The notice is mounted at the root, so it surfaces regardless of the
    // current view left behind by the previous spec.

    // No error yet — the notice should not be present.
    const before = await $('[data-testid="global-error-notice"]');
    await expect(before).not.toBeDisplayed();

    // Dispatch a synthetic uncaught error through the real window listener.
    await browser.execute(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Synthetic test error",
          error: new Error("Synthetic test error"),
        }),
      );
    });

    const notice = await $('[data-testid="global-error-notice"]');
    await notice.waitForDisplayed({ timeout: 10000 });
    await expect(notice).toHaveText(expect.stringContaining("Synthetic test error"));

    // Manual dismiss removes the notice.
    const dismiss = await $('[data-testid="global-error-dismiss"]');
    await dismiss.click();
    await expect(notice).not.toBeDisplayed();
  });
});
