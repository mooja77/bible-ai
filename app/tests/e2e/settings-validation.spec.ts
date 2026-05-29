import { browser, $, expect } from "@wdio/globals";

describe("Settings connection-field validation", () => {
  it("shows an advisory error for a malformed gateway URL and clears it when valid", async () => {
    const settings = await $("button=Settings");
    await settings.waitForClickable({ timeout: 10_000 });
    await settings.click();

    const gatewayUrl = await $('input[aria-label="Managed gateway URL"]');
    await gatewayUrl.waitForDisplayed({ timeout: 10_000 });

    // A malformed URL surfaces an inline advisory error (does not block saving).
    await gatewayUrl.setValue("not a url");
    const urlError = await $('[data-testid="gateway-url-error"]');
    await urlError.waitForDisplayed({ timeout: 5_000 });
    await expect(urlError).toBeDisplayed();

    // The error is associated with the input for assistive tech.
    await expect(await gatewayUrl.getAttribute("aria-invalid")).toBe("true");
    await expect(await gatewayUrl.getAttribute("aria-describedby")).toBe("gateway-url-error");

    // A valid http(s) URL clears the error and the invalid state.
    await gatewayUrl.setValue("https://gw.example.test");
    await browser.waitUntil(
      async () => !(await (await $('[data-testid="gateway-url-error"]')).isExisting()),
      { timeout: 5_000, timeoutMsg: "gateway URL error should clear once the value is a valid URL" },
    );
    await expect(await gatewayUrl.getAttribute("aria-invalid")).toBe("false");

    // Leave the draft clean for any later spec in the shared session.
    await gatewayUrl.setValue("");
  });
});
