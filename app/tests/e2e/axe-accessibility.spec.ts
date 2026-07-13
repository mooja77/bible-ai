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
  it("has no serious WCAG A/AA violations in the Reader shell and Council", async () => {
    const reader = await $("button=Reader");
    await reader.waitForDisplayed({ timeout: 30_000 });
    await reader.click();
    await expectNoSeriousAxeViolations("Reader accessibility violations");

    const council = await $("button=Council");
    await council.click();
    await (await $("h1=The Council")).waitForDisplayed({ timeout: 15_000 });
    await expectNoSeriousAxeViolations("Council accessibility violations");
  });
});
