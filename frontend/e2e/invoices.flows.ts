import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerInvoiceFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const className = "Lớp Nắng Mai (phiếu demo)",
    childName = "Bảo An (phiếu demo)",
    otherName = "Hà Linh (phiếu demo)";
  const privateNote = "Riêng TC021: cô trao đổi học phí cùng gia đình.",
    publicNote = "Gia đình đối chiếu các buổi và học cụ trên phiếu.";
  let classId = "",
    child = "",
    otherChild = "",
    enrollment = "",
    agreement = "",
    guardian = "",
    firstInvoice = "",
    firstCode = "",
    secondInvoice = "",
    changedSession = "";
  const day = (offset = 0) =>
    new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
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
  ) {
    const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.fetch(`/api/v1${path}`, {
      method,
      headers: { [csrf.headerName]: csrf.token },
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
      path: `test-results/invoices-${name}.png`,
      fullPage: !center,
      animations: "disabled",
    });
  }
  async function createAgreement(
    page: Page,
    e: string,
    mode = "PER_SESSION",
    amount = 100000,
  ) {
    const terms =
      mode === "PER_SESSION"
        ? {
            pricingMode: mode,
            collectionTiming: "AT_PERIOD_END",
            sessionUnitPriceVnd: amount,
            chargeExcusedAbsence: false,
            chargeUnexcusedAbsence: true,
            publicTerms: "Điều kiện học phí công khai TC021.",
          }
        : mode === "MONTHLY_FIXED"
          ? {
              pricingMode: mode,
              collectionTiming: "AT_PERIOD_START",
              monthlyAmountVnd: amount,
              fixedFeeAbsenceRule: "MANUAL_ADJUSTMENT",
            }
          : {
              pricingMode: mode,
              collectionTiming: "UPFRONT",
              programTotalVnd: amount,
              programLabel: "Khóa khám phá (phiếu demo)",
              fixedFeeAbsenceRule: "KEEP_AGREED_AMOUNT",
            };
    const response = await write(
      page.request,
      `/enrollments/${e}/tuition-agreements`,
      {
        clientRequestId: crypto.randomUUID(),
        source: "CUSTOM",
        terms,
        effectiveFrom: day(),
        effectiveTo: day(120),
        internalNote: "Riêng điều kiện TC021",
      },
    );
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  }
  async function completedSession(page: Page, status: string, title: string) {
    const start = Date.now() + 1000,
      end = start + 1500;
    let response = await write(page.request, "/sessions", {
      classId,
      clientRequestId: crypto.randomUUID(),
      title,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      preview: false,
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).data.session.id;
    response = await write(page.request, `/sessions/${id}/attendance-roster`, {
      sessionVersion: 0,
    });
    expect(response.status()).toBe(200);
    let roster = (await response.json()).data;
    await expect
      .poll(() => Date.now(), { timeout: 10000 })
      .toBeGreaterThan(start);
    response = await write(
      page.request,
      `/sessions/${id}/attendance`,
      {
        sessionVersion: roster.session.version,
        rows: roster.rows.map(
          (row: { id: string; version: number; studentId: string }) => ({
            id: row.id,
            version: row.version,
            status: row.studentId === child ? status : "PRESENT",
            note: "Riêng điểm danh TC021",
            familyNote: "",
          }),
        ),
      },
      "PUT",
    );
    expect(response.status()).toBe(200);
    roster = (await response.json()).data;
    await expect
      .poll(() => Date.now(), { timeout: 10000 })
      .toBeGreaterThan(end);
    response = await write(page.request, `/sessions/${id}/complete`, {
      version: roster.session.version,
    });
    expect(response.status()).toBe(200);
    return id as string;
  }
  async function markExcused(page: Page, id: string) {
    const roster = await get(page, `/sessions/${id}/attendance`);
    const row = roster.rows.find(
      (value: { studentId: string }) => value.studentId === child,
    );
    expect(
      (
        await write(
          page.request,
          `/sessions/${id}/attendance`,
          {
            sessionVersion: roster.session.version,
            reason: "Điều chỉnh báo nghỉ sau khi lập phiếu TC021.",
            rows: [
              {
                id: row.id,
                version: row.version,
                status: "ABSENT_EXCUSED",
                note: row.note,
                familyNote: row.familyNote,
              },
            ],
          },
          "PUT",
        )
      ).status(),
    ).toBe(200);
  }

  test("phiếu gợi ý từ điểm danh, điều chỉnh có lý do; mất phản hồi lưu lại không trùng và phát hành cho gia đình", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const runtime: string[] = [];
    page.on("pageerror", (error) => runtime.push(error.message));
    await login(page);
    let response = await write(page.request, "/classes", {
      name: className,
      capacity: 4,
    });
    expect(response.status()).toBe(201);
    classId = (await response.json()).data.id;
    expect(
      (
        await write(page.request, `/classes/${classId}/activate`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      for (const name of [childName, otherName]) {
        response = await write(page.request, "/students", { fullName: name });
        expect(response.status()).toBe(201);
        const id = (await response.json()).data.id;
        if (name === childName) child = id;
        else otherChild = id;
        response = await write(
          page.request,
          `/classes/${classId}/enrollments`,
          { studentId: id },
        );
        expect(response.status()).toBe(201);
        if (name === childName) enrollment = (await response.json()).data.id;
        response = await write(
          page.request,
          `/students/${id}/guardian-invitations`,
          { email: parentEmail },
        );
        expect(response.status()).toBe(201);
        const invitation = (await response.json()).data;
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
      }
      guardian = (await get(page, `/students/${child}/guardians`)).find(
        (row: { email: string }) => row.email === parentEmail,
      ).id;
      agreement = await createAgreement(page, enrollment);
      await completedSession(page, "PRESENT", "Cùng cô xếp khối (phiếu demo)");
      await completedSession(page, "LATE", "Khám phá màu sắc (phiếu demo)");
      await completedSession(
        page,
        "ABSENT_EXCUSED",
        "Bé báo nghỉ có phép (phiếu demo)",
      );
      await page.goto(`/teacher/enrollments/${enrollment}/tuition`);
      await page.getByRole("link", { name: "Lập phiếu", exact: true }).click();
      await page
        .getByRole("button", { name: "Xem trước khoản thu", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Dòng khoản thu 2", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("spinbutton", { name: "Giảm trừ dòng 1 (VND)", exact: true })
        .fill("20000");
      await page
        .getByRole("button", { name: "Thêm khoản thủ công", exact: true })
        .click();
      await page
        .getByLabel("Nội dung dòng 3", { exact: true })
        .fill("Học cụ cùng bé (demo)");
      await page
        .getByRole("spinbutton", { name: "Đơn giá dòng 3 (VND)", exact: true })
        .fill("50000");
      await page
        .getByRole("textbox", { name: /^Lý do điều chỉnh khoản thu/ })
        .fill("Lý do riêng TC021: giảm buổi đầu và bổ sung học cụ.");
      await page.getByLabel(/^Ghi chú gửi gia đình/).fill(publicNote);
      await page.getByLabel(/^Ghi chú riêng của cô/).fill(privateNote);
      await page.setViewportSize({ width: 375, height: 812 });
      await capture(
        page,
        "editor-mobile-375",
        page.getByRole("heading", {
          name: "Các khoản trên phiếu",
          exact: true,
        }),
      );
      const path = "**/api/v1/invoices";
      await page.route(path, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const actual = await route.fetch();
        expect(actual.status()).toBe(201);
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "SYNTHETIC_RESPONSE_LOSS",
            message: "Mất phản hồi thử nghiệm sau khi đã lưu phiếu.",
          }),
        });
      });
      await page
        .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Mất phản hồi thử nghiệm",
      );
      await expect(page.getByLabel(/^Ghi chú riêng của cô/)).toHaveValue(
        privateNote,
      );
      await capture(page, "draft-response-loss-375", page.getByRole("alert"));
      await page.unroute(path);
      await page
        .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
        .click();
      await expect(page).toHaveURL(/\/teacher\/invoices\/[a-f0-9-]+$/);
      firstInvoice = page.url().split("/").at(-1)!;
      const saved = await get(page, `/invoices/${firstInvoice}`);
      firstCode = saved.invoiceCode;
      expect(saved.totalAmountVnd).toBe(230000);
      const list = await page.request.get(
        `/api/v1/invoices?enrollmentId=${enrollment}`,
      );
      expect((await list.json()).meta.totalElements).toBe(1);
      expect(
        (
          await parent.request.get(`/api/v1/family/children/${child}/invoices`)
        ).status(),
      ).toBe(200);
      expect(
        (await get(parent, `/family/children/${child}/invoices`)).invoices.meta
          .totalElements,
      ).toBe(0);
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${child}/invoices/${firstInvoice}`,
          )
        ).status(),
      ).toBe(404);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await capture(page, "teacher-draft-desktop");
      await page
        .getByRole("button", { name: "Phát hành phiếu", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận phát hành", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByText("Đã phát hành", { exact: true }),
      ).toBeVisible();
      await capture(page, "teacher-issued-desktop");
      await parent.goto(`/family/children/${child}/invoices`);
      await parent
        .getByRole("link", { name: `Xem phiếu ${firstCode}`, exact: true })
        .click();
      await expect(parent.getByText(publicNote, { exact: true })).toBeVisible();
      const visible = await parent.getByRole("main").innerText();
      expect(visible).not.toContain(privateNote);
      expect(visible).not.toContain("Lý do riêng TC021");
      expect(visible).not.toContain("Riêng điểm danh");
      await expect(
        parent.getByRole("button", { name: "Sửa phiếu nháp", exact: true }),
      ).toHaveCount(0);
      await capture(parent, "family-issued-desktop");
      await parent.setViewportSize({ width: 375, height: 812 });
      await capture(parent, "family-issued-mobile-375");
      expect(runtime).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("phiếu giữ bản sửa khi 503 và 409, cảnh báo thay đổi điểm danh; đối chiếu lại rồi phát hành phiếu 0", async ({
    page,
  }) => {
    test.setTimeout(110_000);
    await login(page);
    changedSession = await completedSession(
      page,
      "PRESENT",
      "Buổi mới để đối chiếu phiếu (demo)",
    );
    await page.goto(`/teacher/invoices/new?agreement=${agreement}`);
    await page
      .getByRole("button", { name: "Xem trước khoản thu", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page).toHaveURL(/\/teacher\/invoices\/[a-f0-9-]+$/);
    secondInvoice = page.url().split("/").at(-1)!;
    await page
      .getByRole("link", { name: "Sửa phiếu nháp", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Xem trước khoản thu", exact: true })
      .click();
    await page
      .getByLabel(/^Ghi chú gửi gia đình/)
      .fill("Bản sửa TC021 cần giữ lại khi lỗi.");
    await page
      .getByLabel("Lý do sửa phiếu", { exact: true })
      .fill("Đối chiếu nguồn từ cửa sổ khác TC021.");
    const path = `**/api/v1/invoices/${secondInvoice}`;
    await page.route(path, (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Dịch vụ thử nghiệm tạm gián đoạn.",
            }),
          })
        : route.continue(),
    );
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("tạm gián đoạn");
    await expect(page.getByLabel(/^Ghi chú gửi gia đình/)).toHaveValue(
      "Bản sửa TC021 cần giữ lại khi lỗi.",
    );
    await page.unroute(path);
    const saved = await get(page, `/invoices/${secondInvoice}`);
    const p = (
      await (
        await write(page.request, "/billing/previews", {
          agreementId: agreement,
          periodStart: saved.periodStart,
          periodEnd: saved.periodEnd,
          invoiceId: secondInvoice,
        })
      ).json()
    ).data;
    expect(
      (
        await write(
          page.request,
          `/invoices/${secondInvoice}`,
          {
            agreementId: agreement,
            version: saved.version,
            periodStart: saved.periodStart,
            periodEnd: saved.periodEnd,
            previewKey: p.previewKey,
            lines: saved.lines.map(
              (line: {
                description: string;
                pricingBasis: string;
                quantity: number;
                unitPriceVnd: number;
                discountVnd: number;
                attendanceId: string | null;
              }) => ({
                description: line.description,
                pricingBasis: line.pricingBasis,
                quantity: line.quantity,
                unitPriceVnd: line.unitPriceVnd,
                discountVnd: line.discountVnd,
                attendanceId: line.attendanceId,
              }),
            ),
            publicNote: "Cửa sổ khác đã cập nhật phiếu TC021.",
            reason: "Lý do riêng ở cửa sổ khác TC021.",
          },
          "PUT",
        )
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel(/^Ghi chú gửi gia đình/)).toHaveValue(
      "Bản sửa TC021 cần giữ lại khi lỗi.",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await capture(page, "stale-draft-375", page.getByRole("alert"));
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Tải lại dữ liệu đã lưu", exact: true })
      .click();
    await expect(page.getByLabel(/^Ghi chú gửi gia đình/)).toHaveValue(
      "Cửa sổ khác đã cập nhật phiếu TC021.",
    );
    await page.goto(`/teacher/invoices/${secondInvoice}`);
    await page
      .getByRole("button", { name: "Phát hành phiếu", exact: true })
      .click();
    await markExcused(page, changedSession);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận phát hành", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      /nguồn/i,
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Quay lại", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cập nhật phiếu", exact: true })
      .click();
    await expect(
      page.getByText(/Nguồn tính phí đã thay đổi/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Phát hành phiếu", exact: true }),
    ).toHaveCount(0);
    expect((await get(page, `/invoices/${secondInvoice}`)).totalAmountVnd).toBe(
      100000,
    );
    await capture(page, "source-change-375");
    await page.goto(`/teacher/sessions/${changedSession}/attendance`);
    await expect(page.getByText(/Buổi này đã được giữ\/tính/)).toBeVisible();
    await page.goto(`/teacher/invoices/${secondInvoice}/edit`);
    await page
      .getByRole("button", { name: "Xem trước khoản thu", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Dùng các dòng gợi ý", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Thêm khoản thủ công", exact: true })
      .click();
    await page
      .getByLabel("Nội dung dòng 1", { exact: true })
      .fill("Miễn phí buổi báo nghỉ (demo)");
    await page
      .getByRole("spinbutton", { name: "Đơn giá dòng 1 (VND)", exact: true })
      .fill("0");
    await page
      .getByRole("textbox", { name: /^Lý do điều chỉnh khoản thu/ })
      .fill("Cô miễn phí để đối chiếu báo nghỉ TC021.");
    await page
      .getByLabel("Lý do sửa phiếu", { exact: true })
      .fill("Đã kiểm tra lại điểm danh TC021.");
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/teacher/invoices/${secondInvoice}$`),
    );
    await page
      .getByRole("button", { name: "Phát hành phiếu", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận phát hành", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await get(page, `/invoices/${secondInvoice}`)).totalAmountVnd).toBe(
      0,
    );
  });

  test("phiếu hủy giữ lịch sử, giải phóng buổi; gia đình xem sau rời lớp và mất quyền khi thu hồi", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await page.goto(`/teacher/invoices/${firstInvoice}`);
      await page
        .getByRole("button", { name: "Hủy phiếu", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do", { exact: true })
        .fill("Lý do hủy riêng TC021: lập lại sau khi đối chiếu.");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận hủy phiếu", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect((await get(page, `/invoices/${firstInvoice}`)).status).toBe(
        "CANCELLED",
      );
      const response = await write(page.request, "/billing/previews", {
        agreementId: agreement,
        periodStart: day(),
        periodEnd: day(),
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).data.suggestedLines).toHaveLength(2);
      await page
        .getByRole("button", { name: "Lịch sử phiếu", exact: true })
        .click();
      const modal = page.getByRole("dialog");
      await expect(
        modal.getByText("Lý do hủy riêng TC021: lập lại sau khi đối chiếu."),
      ).toBeVisible();
      await modal.getByText("Sau thay đổi", { exact: true }).first().click();
      await capture(page, "teacher-history-desktop", modal);
      await modal.getByRole("button", { name: "Đóng", exact: true }).click();
      await parent.goto(`/family/children/${child}/invoices/${firstInvoice}`);
      await expect(parent.getByText("Đã hủy", { exact: true })).toBeVisible();
      expect(await parent.getByRole("main").innerText()).not.toContain(
        "Lý do hủy riêng",
      );
      await parent.setViewportSize({ width: 320, height: 780 });
      await capture(parent, "family-cancelled-320");
      await parent
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(otherChild);
      await expect(parent).toHaveURL(
        new RegExp(`/children/${otherChild}/invoices$`),
      );
      await expect(
        parent.getByRole("heading", {
          name: "Cô chưa phát hành phiếu học phí",
          exact: true,
        }),
      ).toBeVisible();
      await expect(parent.getByText(firstCode, { exact: true })).toHaveCount(0);
      await parent.getByLabel("Chọn bé", { exact: true }).selectOption(child);
      await expect(
        parent.getByRole("link", {
          name: `Xem phiếu ${firstCode}`,
          exact: true,
        }),
      ).toBeVisible();
      const members = (
        await (
          await page.request.get(`/api/v1/classes/${classId}/enrollments`)
        ).json()
      ).data;
      const membership = members.find(
        (row: { id: string }) => row.id === enrollment,
      );
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollment}`,
            {
              version: membership.version,
              status: "WITHDRAWN",
              reason: "Bé dừng tham gia lớp — kiểm thử phiếu.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await parent.goto(`/family/children/${child}/invoices/${firstInvoice}`);
      await expect(parent.getByText(publicNote, { exact: true })).toBeVisible();
      await capture(parent, "family-withdrawn-320");
      const link = (await get(page, `/students/${child}/guardians`)).find(
        (row: { id: string }) => row.id === guardian,
      );
      expect(
        (
          await write(page.request, `/student-guardians/${guardian}/revoke`, {
            version: link.version,
            reason: "Thu hồi liên kết kiểm thử phiếu.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật phiếu", exact: true })
        .click();
      await expect(parent.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(parent.getByText(publicNote, { exact: true })).toHaveCount(
        0,
      );
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${child}/invoices/${firstInvoice}`,
          )
        ).status(),
      ).toBe(404);
      await capture(parent, "family-revoked-320");
    } finally {
      await context.close();
    }
  });

  test("phiếu tháng đủ kỳ có gợi ý, kỳ lẻ nhập tay rõ lý do và trọn khóa giữ tổng thỏa thuận", async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    const agreements: string[] = [];
    for (const [name, mode, amount] of [
      ["Bé tháng (phiếu demo)", "MONTHLY_FIXED", 800000],
      ["Bé trọn khóa (phiếu demo)", "FULL_PROGRAM", 3000000],
    ] as const) {
      let response = await write(page.request, "/students", { fullName: name });
      expect(response.status()).toBe(201);
      const id = (await response.json()).data.id;
      response = await write(page.request, `/classes/${classId}/enrollments`, {
        studentId: id,
      });
      expect(response.status()).toBe(201);
      agreements.push(
        await createAgreement(
          page,
          (await response.json()).data.id,
          mode,
          amount,
        ),
      );
    }
    const current = day();
    const year = Number(current.slice(0, 4)),
      month = Number(current.slice(5, 7));
    const nextStart = new Date(Date.UTC(year, month, 1, 12))
        .toISOString()
        .slice(0, 10),
      nextEnd = new Date(Date.UTC(year, month + 1, 0, 12))
        .toISOString()
        .slice(0, 10);
    await page.goto(`/teacher/invoices/new?agreement=${agreements[0]}`);
    await page.getByLabel("Ngày đầu kỳ", { exact: true }).fill(nextStart);
    await page.getByLabel("Ngày cuối kỳ", { exact: true }).fill(nextEnd);
    await page.getByLabel(/^Hạn thanh toán/).fill(current);
    await page
      .getByRole("button", { name: "Xem trước khoản thu", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", {
        name: "Đơn giá dòng 1 (VND)",
        exact: true,
      }),
    ).toHaveValue("800000");
    await page.setViewportSize({ width: 375, height: 812 });
    await capture(
      page,
      "monthly-preview-375",
      page.getByRole("heading", { name: "Các khoản trên phiếu", exact: true }),
    );
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page).toHaveURL(/\/teacher\/invoices\/[a-f0-9-]+$/);
    await page.goto(`/teacher/invoices/new?agreement=${agreements[0]}`);
    await page.getByLabel("Ngày đầu kỳ", { exact: true }).fill(current);
    await page.getByLabel("Ngày cuối kỳ", { exact: true }).fill(current);
    await page
      .getByRole("button", { name: "Xem trước khoản thu", exact: true })
      .click();
    await expect(page.getByText(/Kỳ chưa đủ tháng/)).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Dòng khoản thu/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Thêm khoản thủ công", exact: true })
      .click();
    await page
      .getByLabel("Nội dung dòng 1", { exact: true })
      .fill("Mức riêng kỳ lẻ đã trao đổi (demo)");
    await page
      .getByRole("spinbutton", { name: "Đơn giá dòng 1 (VND)", exact: true })
      .fill("200000");
    await page
      .getByRole("textbox", { name: /^Lý do điều chỉnh khoản thu/ })
      .fill("Gia đình và cô thống nhất mức kỳ lẻ TC021.");
    await capture(
      page,
      "partial-month-manual-375",
      page.getByRole("heading", { name: "Các khoản trên phiếu", exact: true }),
    );
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page).toHaveURL(/\/teacher\/invoices\/[a-f0-9-]+$/);
    await page.goto(`/teacher/invoices/new?agreement=${agreements[1]}`);
    await page
      .getByRole("button", { name: "Xem trước khoản thu", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", {
        name: "Đơn giá dòng 1 (VND)",
        exact: true,
      }),
    ).toHaveValue("3000000");
    await page
      .getByRole("button", { name: "Lưu phiếu nháp", exact: true })
      .click();
    await expect(page).toHaveURL(/\/teacher\/invoices\/[a-f0-9-]+$/);
    await page.goto("/teacher/invoices");
    await page
      .getByRole("combobox", { name: "Trạng thái phiếu", exact: true })
      .selectOption("DRAFT");
    await expect(page.getByRole("article")).toHaveCount(3);
    await page.setViewportSize({ width: 320, height: 780 });
    await capture(page, "teacher-list-320");
  });
}
