import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Task, TaskView } from "../../src/shared/task.js";

test.afterEach(async ({ request }) => {
  for (const view of ["inbox", "today", "completed"] satisfies TaskView[]) {
    const response = await request.get(`/api/tasks?view=${view}`);
    const tasks = (await response.json()) as Task[];
    for (const task of tasks) await request.delete(`/api/tasks/${task.id}`);
  }
});

test("supports the complete task workflow with keyboard-accessible controls", async ({ page }) => {
  const firstTitle = `Review notes ${Date.now()}`;
  const secondTitle = `Call the shop ${Date.now()}`;
  await page.goto("/");

  const quickAdd = page.getByRole("textbox", { name: "Capture a task" });
  await expect(quickAdd).toBeFocused();
  await quickAdd.fill(firstTitle);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").getByText(firstTitle, { exact: true })).toBeVisible();

  await quickAdd.fill(secondTitle);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").getByText(secondTitle, { exact: true })).toBeVisible();
  const listAccessibility = await new AxeBuilder({ page }).analyze();
  expect(listAccessibility.violations).toEqual([]);

  const moveFirst = page.getByRole("button", { name: `Move to Today: ${firstTitle}` });
  await moveFirst.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("button", { name: `Move to Today: ${secondTitle}` }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: `Move to Inbox: ${secondTitle}` }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page.getByRole("listitem").getByText(secondTitle, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Move to Today: ${secondTitle}` }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);

  const moveUp = page.getByRole("button", { name: `Move up: ${secondTitle}` });
  await moveUp.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").first()).toContainText(secondTitle);

  await page.getByRole("button", { name: `Edit task: ${secondTitle}` }).click();
  const editTitle = page.getByRole("textbox", { name: "Edit task title" });
  await editTitle.fill("Call the garden shop");
  await editTitle.press("Enter");
  await expect(
    page.getByRole("listitem").getByText("Call the garden shop", { exact: true }),
  ).toBeVisible();
  const editButton = page.getByRole("button", { name: "Edit task: Call the garden shop" });
  await editButton.click();
  const canceledTitle = page.getByRole("textbox", { name: "Edit task title" });
  await canceledTitle.fill("This edit should be canceled");
  await canceledTitle.press("Escape");
  await expect(editButton).toBeFocused();
  await expect(page.getByText("Call the garden shop", { exact: true })).toBeVisible();

  const completeFirst = page.getByRole("checkbox", { name: `Complete task: ${firstTitle}` });
  await completeFirst.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.getByRole("listitem").getByText(firstTitle, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Reopen task: ${firstTitle}` }).click();
  await expect(page.getByText("No completed tasks yet.")).toBeVisible();

  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page.getByRole("listitem").getByText(firstTitle, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Delete task: ${firstTitle}` }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  const dialogAccessibility = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(dialogAccessibility.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole("listitem").getByText(firstTitle, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Delete task: ${firstTitle}` }).click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Keep task" }).click();
  await expect(page.getByRole("listitem").getByText(firstTitle, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Delete task: ${firstTitle}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByRole("listitem").getByText(firstTitle, { exact: true })).toHaveCount(0);
});

test("shows recoverable loading and API error states without losing captured input", async ({
  page,
}) => {
  let listRequests = 0;
  await page.route("**/api/tasks?view=inbox", async (route) => {
    listRequests += 1;
    if (listRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Please try again." } }),
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  await page.goto("/");
  const quickAdd = page.getByRole("textbox", { name: "Capture a task" });
  await quickAdd.fill("Keep my unsent note");
  await expect(page.getByRole("alert")).toContainText("Please try again.");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status")).toContainText("Loading tasks");
  await expect(quickAdd).toHaveValue("Keep my unsent note");
  await expect(page.getByText("Your inbox is clear.")).toBeVisible();
});

test("does not show stale tasks from another view when loading the new view fails", async ({
  page,
}) => {
  const staleTitle = `Inbox-only task ${Date.now()}`;
  await page.goto("/");
  const quickAdd = page.getByRole("textbox", { name: "Capture a task" });
  await quickAdd.fill(staleTitle);
  await page.keyboard.press("Enter");
  await expect(page.getByText(staleTitle, { exact: true })).toBeVisible();

  await page.route("**/api/tasks?view=today", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Today is unavailable." } }),
    }),
  );
  await quickAdd.fill("Keep this draft while changing views");
  await page.getByRole("button", { name: "Today", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("Today is unavailable.");
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(quickAdd).toHaveValue("Keep this draft while changing views");
});

test("has no automated serious accessibility violations on the empty planner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("fits narrow mobile and desktop viewport widths without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  const quickAdd = page.getByRole("textbox", { name: "Capture a task" });
  await quickAdd.fill(`A task for responsive layout ${Date.now()}`);
  await page.keyboard.press("Enter");

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(quickAdd).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    const overflowingElements = overflows
      ? await page.evaluate(() =>
          Array.from(document.querySelectorAll("body *"))
            .map((element) => ({
              element: `${element.tagName.toLowerCase()}.${(element as HTMLElement).className}`,
              right: Math.round(element.getBoundingClientRect().right),
              width: Math.round(element.getBoundingClientRect().width),
            }))
            .filter((item) => item.right > window.innerWidth + 1),
        )
      : [];
    expect(
      overflows,
      `layout should fit at ${width}px: ${JSON.stringify(overflowingElements)}`,
    ).toBe(false);
  }
});
