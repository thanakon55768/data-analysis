import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
const csv = {
  name: "ยอดขาย.csv",
  mimeType: "text/csv",
  buffer: Buffer.from("\ufeffสินค้า,ยอดขาย\nชา,10\nกาแฟ,20\nชา,30\nน้ำ,\n"),
};
test("real Thai upload, statistics, search and deletion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on('console',entry=>{if(entry.type()==='error') errors.push(entry.text());});
  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.goto("/");
  await expect(page).toHaveTitle(/AI Data Analyst/);
  await expect(page.getByText("ยังไม่มีข้อมูล", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/desktop-empty.png",
    fullPage: true,
  });
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/api/v1/datasets") &&
      response.request().method() === "POST",
  );
  await page.locator("input[type=file]").setInputFiles(csv);
  const response = await uploadResponse;
  expect(response.status(), await response.text()).toBe(201);
  await expect(page.getByTestId("stat-rows")).toHaveText("4");
  await expect(page.getByTestId("stat-missing")).toHaveText("1");
  await expect(page.getByTestId("metric-sum")).toHaveText("60");
  await expect(page.getByTestId("metric-mean")).toHaveText("20");
  await page.getByRole("searchbox", { name: "ค้นหาในข้อมูล" }).fill("กาแฟ");
  await expect(page.getByText("พบ 1 จาก 4 แถว")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "กาแฟ", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/desktop-loaded.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "ลบข้อมูลและเริ่มใหม่" }).click();
  await expect(page.getByText("ยังไม่มีข้อมูล", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("pagination and keyboard search", async ({ page }) => {
  await page.goto("/");
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/backend/api/v1/datasets") &&
      response.request().method() === "POST",
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "rows.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,value\n" +
        Array.from({ length: 61 }, (_, i) => `row-${i},${i}`).join("\n"),
    ),
  });
  const response = await uploaded;
  expect(response.status(), await response.text()).toBe(201);
  await expect(page.getByTestId("stat-rows")).toHaveText("61");
  await page.getByRole("button", { name: "หน้าถัดไป" }).click();
  await expect(
    page.getByRole("cell", { name: "row-50", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "ค้นหาในข้อมูล" }).fill("row-0");
  await expect(page.getByText("พบ 1 จาก 61 แถว")).toBeVisible();
});
test("invalid files and server errors offer recovery", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2,3"),
  });
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await page.route("**/api/backend/api/v1/datasets", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "backend_unavailable",
          message: "ไม่สามารถเชื่อมต่อระบบวิเคราะห์ กรุณาลองอีกครั้ง",
        },
      },
    }),
  );
  await page.locator("input[type=file]").setInputFiles(csv);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "ไม่สามารถเชื่อมต่อ",
  );
  await page.unrouteAll();
  await page.locator("input[type=file]").setInputFiles(csv);
  await expect(page.getByTestId("stat-rows")).toHaveText("4");
});
test("mobile empty and loaded layouts have no viewport overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.screenshot({
    path: "output/playwright/mobile-empty.png",
    fullPage: true,
  });
  await page.locator("input[type=file]").setInputFiles(csv);
  await expect(page.getByTestId("stat-rows")).toHaveText("4");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/mobile-loaded.png",
    fullPage: true,
  });
});
test("Excel sheet selection shows actual sheet values and handles empty sheet", async ({
  page,
}) => {
  const workbook = execFileSync(path.resolve("../.venv/Scripts/python.exe"), [
    path.resolve("../backend/tests/generate_workbook.py"),
  ]);
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "workbook.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  const selector = page.getByLabel("ชีตที่ต้องการวิเคราะห์");
  await expect(selector).toBeVisible();
  await selector.selectOption("ยอดขาย");
  await expect(page.getByTestId("metric-sum")).toHaveText("100");
  await selector.selectOption("อื่น");
  await expect(page.getByTestId("metric-sum")).toHaveText("9");
  await selector.selectOption("ว่าง");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "ไม่พบแถวข้อมูล",
  );
  await expect(page.getByTestId("stat-rows")).toHaveText("—");
  await selector.selectOption("ยอดขาย");
  await expect(page.getByTestId("metric-sum")).toHaveText("100");
  await page.getByRole("button", { name: "ลบข้อมูลและเริ่มใหม่" }).click();
});
test("late result cannot overwrite a replacement dataset", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(csv);
  await expect(page.getByTestId("metric-sum")).toHaveText("60");
  let delayed: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    delayed = resolve;
  });
  let started: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/preview?**", async (route) => {
    if (route.request().url().includes("search=old")) {
      const response = await route.fetch();
      started();
      await released;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole("searchbox", { name: "ค้นหาในข้อมูล" }).fill("old");
  await pending;
  await page.locator("input[type=file]").setInputFiles({
    name: "new.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,value\nnew,7\n"),
  });
  await expect(page.getByTestId("metric-sum")).toHaveText("7");
  delayed();
  await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByTestId("metric-sum")).toHaveText("7");
  await expect(page.getByTestId("stat-rows")).toHaveText("1");
});

test("pending sheet change never displays values from previous sheet", async ({
  page,
}) => {
  const workbook = execFileSync(path.resolve("../.venv/Scripts/python.exe"), [
    path.resolve("../backend/tests/generate_workbook.py"),
  ]);
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "sheets.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  const selector = page.getByLabel("ชีตที่ต้องการวิเคราะห์");
  await selector.selectOption("ยอดขาย");
  await expect(page.getByTestId("metric-sum")).toHaveText("100");
  await page.getByRole("searchbox", { name: "ค้นหาในข้อมูล" }).fill("ชา");
  await expect(page.getByText("พบ 1 จาก 1 แถว")).toBeVisible();
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/sheet", async (route) => {
    await released;
    await route.continue();
  });
  await selector.selectOption("อื่น");
  await expect(page.getByText("กำลังอ่านไฟล์ กรุณารอสักครู่")).toBeVisible();
  // Wait for the otherwise-buggy read request; current metrics must remain unavailable.
  try {
    await expect(page.getByTestId("stat-rows")).toHaveText("—");
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("stat-rows")).toHaveText("—");
  } finally {
    release();
  }
  await expect(page.getByTestId("metric-sum")).toHaveText("9");
});
test("expired dataset recovery and proxy origin restrictions", async ({
  page,
}) => {
  await page.goto("/");
  const forbidden = await page.request.post("/api/backend/api/v1/datasets", {
    headers: { Origin: "https://evil.example" },
    multipart: {
      file: { name: "data.csv", mimeType: "text/csv", buffer: csv.buffer },
    },
  });
  expect(forbidden.status()).toBe(403);
  await page.locator("input[type=file]").setInputFiles(csv);
  await expect(page.getByTestId("stat-rows")).toHaveText("4");
  await page.route("**/preview?**", (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "dataset_not_found",
          message: "ไม่พบข้อมูลหรือข้อมูลหมดอายุ กรุณาอัปโหลดใหม่",
        },
      },
    }),
  );
  await page.route("**/statistics", (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "dataset_not_found",
          message: "ไม่พบข้อมูลหรือข้อมูลหมดอายุ กรุณาอัปโหลดใหม่",
        },
      },
    }),
  );
  await page.getByRole("searchbox", { name: "ค้นหาในข้อมูล" }).fill("expired");
  await expect(page.locator("main").getByRole("alert")).toContainText("หมดอายุ");
  await expect(page.getByTestId("stat-rows")).toHaveText("—");
  await page.unrouteAll();
  await page.locator("input[type=file]").setInputFiles(csv);
  await expect(page.getByTestId("stat-rows")).toHaveText("4");
});
