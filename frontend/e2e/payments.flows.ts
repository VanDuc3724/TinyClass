import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerPaymentFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const childName = "Mộc Nhiên (thu phí demo)",
    otherName = "An Hạ (thu phí demo)";
  const publicMemo = "Gia đình gửi đợt đầu (thu phí demo)",
    privateMemo = "Riêng TC022: ghi nhận nội bộ lần đầu.";
  let classroom = "",
    child = "",
    other = "",
    enrollment = "",
    guardian = "",
    invoice = "",
    code = "",
    otherInvoice = "";
  const day = (offset = 0) =>
    new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
  const teacherPath = () => `/teacher/invoices/${invoice}`,
    familyPath = () => `/family/children/${child}/invoices/${invoice}`;
  async function login(page: Page, parent = false) {
    page.setDefaultTimeout(15_000);
    await page.goto("/login");
    await page
      .getByLabel("Địa chỉ email")
      .fill(parent ? parentEmail : teacherEmail);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(parent ? parentPassword : teacherPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(parent ? /\/family$/ : /\/teacher$/);
  }
  async function write(
    request: APIRequestContext,
    path: string,
    body: unknown,
    method = "POST",
    key?: string,
  ) {
    const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.fetch(`/api/v1${path}`, {
      method,
      headers: {
        [csrf.headerName]: csrf.token,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      data: body,
    });
  }
  async function get(page: Page, path: string) {
    const response = await page.request.get(`/api/v1${path}`);
    expect(response.status()).toBe(200);
    return (await response.json()).data;
  }
  async function capture(
    page: Page,
    name: string,
    center?: ReturnType<Page["getByRole"]>,
  ) {
    await page.evaluate(() => document.fonts.ready);
    if (center)
      await center.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
    else await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/payments-${name}.png`,
      fullPage: !center,
      animations: "disabled",
    });
  }
  const balance = (page: Page) =>
    page.getByRole("group", { name: "Tình hình thanh toán", exact: true });
  async function fillPayment(
    page: Page,
    amount: string,
    method: string,
    note: string,
  ) {
    const modal = page.getByRole("dialog");
    await modal
      .getByLabel("Số tiền đã nhận (VND)", { exact: true })
      .fill(amount);
    await modal
      .getByRole("combobox", { name: "Phương thức nhận tiền", exact: true })
      .selectOption(method);
    await modal.getByLabel(/^Ghi chú gửi gia đình/).fill(note);
    return modal;
  }
  async function createInvoice(page: Page, e: string, amount: number) {
    let r = await write(page.request, `/enrollments/${e}/tuition-agreements`, {
      clientRequestId: crypto.randomUUID(),
      source: "CUSTOM",
      terms: {
        pricingMode: "PER_SESSION",
        collectionTiming: "UPFRONT",
        sessionUnitPriceVnd: 100000,
        chargeExcusedAbsence: false,
        chargeUnexcusedAbsence: true,
      },
      effectiveFrom: day(),
      effectiveTo: day(30),
    });
    expect(r.status()).toBe(201);
    const agreement = (await r.json()).data.id;
    r = await write(page.request, "/billing/previews", {
      agreementId: agreement,
      periodStart: day(),
      periodEnd: day(),
    });
    expect(r.status()).toBe(200);
    const p = (await r.json()).data;
    r = await write(page.request, "/invoices", {
      clientRequestId: crypto.randomUUID(),
      agreementId: agreement,
      periodStart: day(),
      periodEnd: day(),
      previewKey: p.previewKey,
      lines: [
        {
          description: "Mức học phí đã trao đổi (thu phí demo)",
          pricingBasis: "OTHER",
          quantity: 1,
          unitPriceVnd: amount,
          discountVnd: 0,
        },
      ],
      adjustmentReason: "Cô và gia đình chốt mức thu thử nghiệm.",
      publicNote: "Phiếu dùng kiểm tra ghi nhận tiền đã thu.",
    });
    expect(r.status()).toBe(201);
    const i = (await r.json()).data;
    r = await write(page.request, `/invoices/${i.id}/issue`, {
      version: i.version,
      reviewKey: i.reviewKey,
    });
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  }

  test("thu từng phần giữ form khi mất phản hồi, retry một khoản và gia đình chỉ xem lịch sử công khai", async ({
    page,
    browser,
  }) => {
    test.setTimeout(110_000);
    const runtime: string[] = [];
    page.on("pageerror", (error) => runtime.push(error.message));
    await login(page);
    let r = await write(page.request, "/classes", {
      name: "Lớp Mây Nhỏ (thu phí demo)",
      capacity: 4,
    });
    expect(r.status()).toBe(201);
    classroom = (await r.json()).data.id;
    expect(
      (
        await write(page.request, `/classes/${classroom}/activate`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    const context = await browser.newContext({
        timezoneId: "America/Los_Angeles",
      }),
      parent = await context.newPage();
    try {
      await login(parent, true);
      for (const name of [childName, otherName]) {
        r = await write(page.request, "/students", { fullName: name });
        expect(r.status()).toBe(201);
        const id = (await r.json()).data.id;
        if (name === childName) child = id;
        else other = id;
        r = await write(page.request, `/classes/${classroom}/enrollments`, {
          studentId: id,
        });
        expect(r.status()).toBe(201);
        const e = (await r.json()).data.id;
        if (name === childName) enrollment = e;
        r = await write(page.request, `/students/${id}/guardian-invitations`, {
          email: parentEmail,
        });
        expect(r.status()).toBe(201);
        const invitation = (await r.json()).data;
        const token = new URLSearchParams(
          new URL(invitation.inviteUrl).hash.slice(1),
        ).get("token");
        expect(
          (
            await write(parent.request, "/guardian-invitations/accept", {
              token,
              relationshipLabel: "Gia đình",
            })
          ).status(),
        ).toBe(200);
        const i = await createInvoice(
          page,
          e,
          name === childName ? 800000 : 900000,
        );
        if (name === childName) {
          invoice = i.id;
          code = i.invoiceCode;
        } else otherInvoice = i.id;
      }
      guardian = (await get(page, `/students/${child}/guardians`)).find(
        (row: { email: string }) => row.email === parentEmail,
      ).id;
      await page.goto(teacherPath());
      await page
        .getByRole("button", { name: "Ghi nhận thanh toán", exact: true })
        .click();
      const modal = await fillPayment(page, "500000", "CASH", publicMemo);
      await modal.getByLabel(/^Thời điểm nhận tiền/).fill(`${day(-1)}T10:30`);
      await modal.getByLabel(/^Ghi chú riêng của cô/).fill(privateMemo);
      await page.setViewportSize({ width: 375, height: 812 });
      await capture(page, "record-form-375", modal);
      const path = `**/api/v1/invoices/${invoice}/payments`;
      let initialKey = "";
      await page.route(path, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        initialKey = route.request().headers()["idempotency-key"];
        expect(initialKey.length).toBeGreaterThan(7);
        const actual = await route.fetch();
        expect(actual.status()).toBe(201);
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SYNTHETIC_RESPONSE_LOSS",
            message: "Mất phản hồi thử nghiệm sau khi đã ghi thu.",
          }),
        });
      });
      await modal
        .getByRole("button", { name: "Lưu khoản đã nhận", exact: true })
        .click();
      await expect(modal.getByRole("alert")).toContainText(
        "Mất phản hồi thử nghiệm",
      );
      await expect(
        modal.getByLabel("Số tiền đã nhận (VND)", { exact: true }),
      ).toHaveValue("500000");
      await expect(modal.getByLabel(/^Ghi chú riêng của cô/)).toHaveValue(
        privateMemo,
      );
      await capture(page, "response-loss-375", modal.getByRole("alert"));
      await page.unroute(path);
      const retry = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().endsWith(`/invoices/${invoice}/payments`),
      );
      await modal
        .getByRole("button", { name: "Lưu khoản đã nhận", exact: true })
        .click();
      expect((await retry).headers()["idempotency-key"]).toBe(initialKey);
      await expect(modal).toHaveCount(0);
      await expect(balance(page).getByText(/500\.000/)).toBeVisible();
      await expect(balance(page).getByText(/300\.000/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Hủy phiếu", exact: true }),
      ).toHaveCount(0);
      const list = await page.request.get(
        `/api/v1/invoices/${invoice}/payments`,
      );
      expect((await list.json()).meta.totalElements).toBe(1);
      expect((await get(page, `/invoices/${invoice}`)).paymentStatus).toBe(
        "PARTIAL",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await capture(page, "teacher-partial-desktop");
      const row = page.getByRole("article").filter({ hasText: publicMemo });
      await row
        .getByRole("button", { name: "Lịch sử khoản thu", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByText("Ghi nhận tiền đã nhận", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByText("Sau thay đổi", { exact: true })
        .click();
      await capture(page, "payment-history-desktop", page.getByRole("dialog"));
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .click();
      await parent.goto(familyPath());
      await expect(balance(parent).getByText(/500\.000/)).toBeVisible();
      await expect(balance(parent).getByText(/300\.000/)).toBeVisible();
      const familyRow = parent
        .getByRole("article")
        .filter({ hasText: publicMemo });
      await expect(familyRow).toContainText("10:30");
      expect(await parent.getByRole("main").innerText()).not.toContain(
        privateMemo,
      );
      await expect(
        parent.getByRole("button", {
          name: "Ghi nhận thanh toán",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        parent.getByRole("button", { name: "Hủy bản ghi", exact: true }),
      ).toHaveCount(0);
      const publicRows = await get(
        parent,
        `/family/children/${child}/invoices/${invoice}/payments`,
      );
      expect(publicRows).toHaveLength(1);
      expect(publicRows[0]).not.toHaveProperty("internalNote");
      expect(publicRows[0]).not.toHaveProperty("version");
      expect(publicRows[0]).not.toHaveProperty("idempotencyKey");
      expect(new Date(publicRows[0].paidAt).toISOString()).toBe(
        new Date(`${day(-1)}T10:30:00+07:00`).toISOString(),
      );
      await parent.setViewportSize({ width: 375, height: 812 });
      await capture(parent, "family-partial-375");
      expect(runtime).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("thu tiền dùng phiên bản hiện tại, xung đột giữ nội dung và ghi đủ thì số còn lại bằng 0", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto(teacherPath());
    await page
      .getByRole("button", { name: "Ghi nhận thanh toán", exact: true })
      .click();
    let modal = await fillPayment(
      page,
      "200000",
      "BANK_TRANSFER",
      "Bản đang nhập cần giữ TC022.",
    );
    await modal
      .getByLabel(/^Ghi chú riêng của cô/)
      .fill("Riêng bản nháp TC022.");
    let current = await get(page, `/invoices/${invoice}`);
    let r = await write(
      page.request,
      `/invoices/${invoice}/payments`,
      {
        invoiceVersion: current.version,
        amountVnd: 100000,
        method: "OTHER",
        paidAt: new Date(Date.now() - 60000).toISOString(),
        publicNote: "Cửa sổ khác ghi nhận (demo)",
        internalNote: "Riêng cửa sổ khác TC022.",
      },
      "POST",
      crypto.randomUUID(),
    );
    expect(r.status()).toBe(201);
    await modal
      .getByRole("button", { name: "Lưu khoản đã nhận", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText("Dữ liệu đã thay đổi");
    await expect(
      modal.getByLabel("Số tiền đã nhận (VND)", { exact: true }),
    ).toHaveValue("200000");
    await expect(modal.getByLabel(/^Ghi chú gửi gia đình/)).toHaveValue(
      "Bản đang nhập cần giữ TC022.",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await capture(page, "stale-balance-375", modal.getByRole("alert"));
    page.once("dialog", (dialog) => dialog.accept());
    await modal
      .getByRole("button", { name: "Đóng và cập nhật số liệu", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect(balance(page).getByText(/600\.000/)).toBeVisible();
    await expect(balance(page).getByText(/200\.000/)).toBeVisible();
    await page
      .getByRole("button", { name: "Ghi nhận thanh toán", exact: true })
      .click();
    modal = await fillPayment(
      page,
      "200000",
      "BANK_TRANSFER",
      "Gia đình trả đủ (thu phí demo)",
    );
    await modal
      .getByRole("button", { name: "Lưu khoản đã nhận", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect(
      balance(page).getByText("Đã thu đủ", { exact: true }),
    ).toBeVisible();
    await expect(balance(page).getByText(/800\.000/)).toBeVisible();
    current = await get(page, `/invoices/${invoice}`);
    expect(current.paidAmountVnd).toBe(800000);
    expect(current.outstandingAmountVnd).toBe(0);
    await expect(
      page.getByRole("button", { name: "Ghi nhận thanh toán", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Hủy phiếu", exact: true }),
    ).toHaveCount(0);
    r = await write(
      page.request,
      `/invoices/${invoice}/payments`,
      {
        invoiceVersion: current.version,
        amountVnd: 1,
        method: "CASH",
        paidAt: new Date().toISOString(),
      },
      "POST",
      crypto.randomUUID(),
    );
    expect(r.status()).toBe(409);
    await page.setViewportSize({ width: 320, height: 780 });
    await capture(page, "teacher-paid-320");
  });

  test("hủy bản ghi nhập sai có lịch sử, chặn hủy phiếu còn tiền; gia đình xem đúng bé và mất quyền khi thu hồi", async ({
    page,
    browser,
  }) => {
    test.setTimeout(110_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await page.goto(teacherPath());
      let row = page.getByRole("article").filter({ hasText: publicMemo });
      await row
        .getByRole("button", { name: "Hủy bản ghi", exact: true })
        .click();
      const modal = page.getByRole("dialog");
      const reason =
        "Lý do riêng TC022: khoản đầu được nhập nhầm trong kiểm thử.";
      await modal
        .getByRole("textbox", { name: "Lý do hủy bản ghi", exact: true })
        .fill(reason);
      const path = "**/api/v1/payments/*/void";
      await page.route(path, (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Dịch vụ thử nghiệm điều chỉnh đang gián đoạn.",
          }),
        }),
      );
      await modal
        .getByRole("button", { name: "Xác nhận hủy bản ghi", exact: true })
        .click();
      await expect(modal.getByRole("alert")).toContainText("đang gián đoạn");
      await expect(
        modal.getByRole("textbox", {
          name: "Lý do hủy bản ghi",
          exact: true,
        }),
      ).toHaveValue(reason);
      await page.unroute(path);
      await modal
        .getByRole("button", { name: "Xác nhận hủy bản ghi", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await expect(balance(page).getByText(/300\.000/)).toBeVisible();
      await expect(balance(page).getByText(/500\.000/)).toBeVisible();
      row = page.getByRole("article").filter({ hasText: publicMemo });
      await expect(
        row.getByText("Đã hủy bản ghi", { exact: true }),
      ).toBeVisible();
      await expect(row.getByText(reason)).toBeVisible();
      await row
        .getByRole("button", { name: "Lịch sử khoản thu", exact: true })
        .click();
      await expect(page.getByRole("dialog").getByText(reason)).toBeVisible();
      await capture(page, "void-history-desktop", page.getByRole("dialog"));
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .click();
      let current = await get(page, `/invoices/${invoice}`);
      expect(
        (
          await write(page.request, `/invoices/${invoice}/cancel`, {
            version: current.version,
            reason: "Không được hủy khi còn khoản hợp lệ",
          })
        ).status(),
      ).toBe(409);
      await parent.goto(familyPath());
      await expect(balance(parent).getByText(/300\.000/)).toBeVisible();
      await expect(balance(parent).getByText(/500\.000/)).toBeVisible();
      await expect(
        parent
          .getByRole("article")
          .filter({ hasText: publicMemo })
          .getByText("Đã hủy bản ghi", { exact: true }),
      ).toBeVisible();
      expect(await parent.getByRole("main").innerText()).not.toContain(reason);
      await parent.setViewportSize({ width: 375, height: 812 });
      await capture(parent, "family-corrected-375");
      const ledger = await get(page, `/invoices/${invoice}/payments`);
      for (const payment of ledger.filter(
        (p: { status: string }) => p.status === "RECORDED",
      )) {
        current = await get(page, `/invoices/${invoice}`);
        expect(
          (
            await write(page.request, `/payments/${payment.id}/void`, {
              version: payment.version,
              invoiceVersion: current.version,
              reason: "Điều chỉnh khoản kiểm thử nhập sai trước khi hủy phiếu.",
            })
          ).status(),
        ).toBe(200);
      }
      await page
        .getByRole("button", { name: "Cập nhật phiếu", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Hủy phiếu", exact: true }),
      ).toBeEnabled();
      await expect(
        balance(page).getByText("Chưa thu", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Hủy phiếu", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do", { exact: true })
        .fill("Hủy phiếu kiểm thử đã điều chỉnh đủ các khoản nhập sai.");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận hủy phiếu", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        balance(page).getByText("Phiếu đã hủy", { exact: true }),
      ).toBeVisible();
      await capture(page, "teacher-cancelled-desktop");
      await parent
        .getByRole("button", { name: "Cập nhật phiếu", exact: true })
        .click();
      await expect(
        balance(parent).getByText("Phiếu đã hủy", { exact: true }),
      ).toBeVisible();
      expect(
        (
          await get(
            parent,
            `/family/children/${child}/invoices/${invoice}/payments`,
          )
        ).every((p: { status: string }) => p.status === "VOIDED"),
      ).toBe(true);
      await parent.getByLabel("Chọn bé", { exact: true }).selectOption(other);
      await expect(parent).toHaveURL(
        new RegExp(`/children/${other}/invoices$`),
      );
      await expect(parent.getByText(code, { exact: true })).toHaveCount(0);
      await expect(
        parent.getByRole("link", { name: new RegExp("Xem phiếu") }),
      ).toBeVisible();
      await parent.goto(`/family/children/${other}/invoices/${otherInvoice}`);
      await expect(balance(parent).getByText(/900\.000/)).toBeVisible();
      await parent.getByLabel("Chọn bé", { exact: true }).selectOption(child);
      await parent
        .getByRole("link", { name: `Xem phiếu ${code}`, exact: true })
        .click();
      const members = (
        await (
          await page.request.get(`/api/v1/classes/${classroom}/enrollments`)
        ).json()
      ).data;
      const membership = members.find(
        (p: { id: string }) => p.id === enrollment,
      );
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollment}`,
            {
              version: membership.version,
              status: "WITHDRAWN",
              reason: "Dừng tham gia lớp kiểm thử thanh toán.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật phiếu", exact: true })
        .click();
      await expect(
        parent.getByRole("article").filter({ hasText: publicMemo }),
      ).toBeVisible();
      await parent.setViewportSize({ width: 320, height: 780 });
      await capture(parent, "family-withdrawn-320");
      const link = (await get(page, `/students/${child}/guardians`)).find(
        (p: { id: string }) => p.id === guardian,
      );
      expect(
        (
          await write(page.request, `/student-guardians/${guardian}/revoke`, {
            version: link.version,
            reason: "Thu hồi liên kết kiểm thử thanh toán.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật lịch sử", exact: true })
        .click();
      await expect(parent.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(parent.getByRole("article")).toHaveCount(0);
      await expect(
        parent.getByRole("group", {
          name: "Tình hình thanh toán",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${child}/invoices/${invoice}/payments`,
          )
        ).status(),
      ).toBe(404);
      await capture(parent, "family-revoked-320");
    } finally {
      await context.close();
    }
  });
}
