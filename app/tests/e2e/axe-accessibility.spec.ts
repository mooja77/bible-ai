import { $, browser, expect } from "@wdio/globals";
import { AxeBuilder } from "@axe-core/webdriverio";
import type AxeCore from "axe-core";

function violationSummary(violations: AxeCore.Result[]) {
  return violations
    .map((violation) =>
      `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}\n` +
      violation.nodes.map((node) => `  ${node.target.join(" ")}: ${node.failureSummary}`).join("\n"),
    )
    .join("\n\n");
}

async function expectNoSeriousAxeViolations(label: string) {
  const results = await new AxeBuilder({ client: browser })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  if (blocking.length > 0) {
    throw new Error(`${label}\n${violationSummary(blocking)}`);
  }
}

describe("Automated accessibility gate", () => {
  it("has no serious WCAG A/AA violations across every primary view and shell overlay", async () => {
    const reader = await $("button=Reader");
    await reader.waitForDisplayed({ timeout: 30_000 });
    await reader.click();
    await expectNoSeriousAxeViolations("Reader accessibility violations");

    for (const overlay of [
      { trigger: '[data-testid="book-nav-toggle"]', target: '[data-testid="book-nav"]', label: "Book navigation" },
      { trigger: '[data-testid="nav-drawer-toggle"]', target: '[data-testid="nav-drawer"]', label: "Navigation drawer" },
      { trigger: 'button[aria-label="Open command palette"]', target: '[role="dialog"]', label: "Command palette" },
    ]) {
      await $(overlay.trigger).click();
      await $(overlay.target).waitForDisplayed({ timeout: 10_000 });
      await expectNoSeriousAxeViolations(`${overlay.label} accessibility violations`);
      await browser.keys("Escape");
      await $(overlay.target).waitForDisplayed({ reverse: true, timeout: 10_000 });
    }

    for (const view of [
      { label: "Council", heading: "The Council" },
      { label: "Theology", heading: "Theology" },
      { label: "Resources", heading: "Resources" },
      { label: "Workspaces", heading: "Workspaces" },
      { label: "Tags", heading: "Tags" },
      { label: "Settings", heading: "Settings" },
    ]) {
      await $(`button=${view.label}`).click();
      await $(`h1=${view.heading}`).waitForDisplayed({ timeout: 15_000 });
      await expectNoSeriousAxeViolations(`${view.label} accessibility violations`);
    }
  });
});
