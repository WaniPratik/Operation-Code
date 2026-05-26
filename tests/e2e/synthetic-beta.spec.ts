import { expect, test, type BrowserContext, type Page } from "@playwright/test";

test.skip(
  process.env.ALLOW_STRESS_TEST !== "true",
  "Set ALLOW_STRESS_TEST=true to run synthetic beta flows.",
);

async function completeOnboarding(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Jump In" })).not.toHaveAttribute("aria-disabled", "true");
  await page.getByRole("link", { name: "Jump In" }).click();
  await expect(page.getByRole("heading", { name: "Talk freely." })).toBeVisible();
  await page.getByLabel(/I confirm that I am 18 or older/i).check();
  await page.getByRole("button", { name: "Jump In" }).click();
  await expect(page).toHaveURL(/\/queue/);
}

async function joinQueue(page: Page) {
  const jumpIn = page.getByRole("button", { name: "Jump In" });

  if (await jumpIn.isVisible().catch(() => false)) {
    await page.getByText("Optional country filters").click();
    await page.getByRole("button", { name: "Japan" }).first().click();
    await jumpIn.click();
  }

  if (await page.getByRole("heading", { name: "You’re live." }).isVisible().catch(() => false)) {
    return;
  }

  await expect(page.getByText("Finding your match...").first()).toBeVisible();
}

async function waitForLive(page: Page) {
  await expect(page).toHaveURL(/\/match/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "You’re live." })).toBeVisible();
  return page;
}

async function leaveAnyQueue(page: Page) {
  const leave = page.getByRole("button", { name: "Leave Queue" });

  if (await leave.isVisible().catch(() => false)) {
    await leave.click();
  }
}

async function closeContext(context: BrowserContext) {
  await context.close().catch(() => undefined);
}

test("synthetic users can onboard, match, loop, report/block, and submit feedback", async ({ browser }) => {
  const contextA = await browser.newContext({
    extraHTTPHeaders: {
      "X-Forwarded-For": "10.55.0.1",
      "X-Country-Code": "JP",
    },
  });
  const contextB = await browser.newContext({
    extraHTTPHeaders: {
      "X-Forwarded-For": "10.55.0.2",
      "X-Country-Code": "JP",
    },
  });
  const userA = await contextA.newPage();
  const userB = await contextB.newPage();

  try {
    await Promise.all([completeOnboarding(userA), completeOnboarding(userB)]);
    await Promise.all([joinQueue(userA), joinQueue(userB)]);
    const activeUser = await Promise.any([waitForLive(userA), waitForLive(userB)]);

    await activeUser.waitForTimeout(5_500);
    await activeUser.getByRole("button", { name: "End & Find Next" }).click();
    await expect(activeUser).toHaveURL(/\/queue/);

    await leaveAnyQueue(activeUser);
    await activeUser.getByRole("button", { name: "Feedback" }).click();
    await activeUser.getByLabel("Type").selectOption("matching issue");
    await activeUser.getByLabel("Note").fill("Synthetic beta browser loop completed.");
    await activeUser.getByRole("button", { name: "Send" }).click();
    await expect(activeUser.getByText("Feedback sent.").last()).toBeVisible();

    await activeUser.goto("/session/complete");
    await expect(activeUser).toHaveURL(/\/session\/complete/);
    await activeUser.getByLabel("Report reason").selectOption("spam/bot");
    await activeUser.getByRole("button", { name: "Report & Skip" }).click();
    await expect(activeUser).toHaveURL(/\/queue/, { timeout: 20_000 });

    await leaveAnyQueue(activeUser);
    await userB.goto("/session/complete");
    const blockButton = userB.getByRole("button", { name: /Block/ });

    if (await blockButton.isVisible().catch(() => false)) {
      await blockButton.click();
    }
  } finally {
    await closeContext(contextA);
    await closeContext(contextB);
  }
});
