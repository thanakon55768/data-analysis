import { test, expect } from "@playwright/test";
test("long text uses smaller pages without changing statistics", async ({
  page,
}) => {
  const body =
    "name,text,value\n" +
    Array.from(
      { length: 61 },
      (_, i) => `item-${i},${"a".repeat(44000)},${i}`,
    ).join("\n");
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "long.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(body),
    });
  await expect(page.getByTestId("stat-rows")).toHaveText("61");
  await expect(page.getByTestId("metric-sum")).toHaveText("1,830");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "ลดจำนวนแถว",
  );
  await page.getByRole("button", { name: "หน้าถัดไป" }).click();
  await expect(
    page.getByRole("cell", { name: "item-25", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "หน้าก่อนหน้า" }).click();
  await expect(
    page.getByRole("cell", { name: "item-0", exact: true }),
  ).toBeVisible();
});
test("statistics stay available if only preview endpoint fails", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/preview?**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: "preview_unavailable", message: "โหลดตัวอย่างไม่สำเร็จ" },
      },
    }),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "data.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("name,value\nA,10\nB,20\nC,30\nD,\n"),
    });
  await expect(page.getByTestId("stat-rows")).toHaveText("4");
  await expect(page.getByTestId("metric-sum")).toHaveText("60");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "โหลดตัวอย่างไม่สำเร็จ",
  );
  await page.unrouteAll();
  await page.getByRole("button", { name: "ลองโหลดข้อมูลอีกครั้ง" }).click();
  await expect(
    page.getByRole("cell", { name: "A", exact: true }),
  ).toBeVisible();
});
