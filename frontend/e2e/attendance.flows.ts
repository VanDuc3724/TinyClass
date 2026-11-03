import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import type { AttendanceWorkspace } from "../src/lib/attendance";

export function registerAttendanceFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const names = [
    "Bảo An (điểm danh demo)",
    "Minh Châu (điểm danh demo)",
    "Gia Hân (điểm danh demo)",
    "Tuệ Minh (điểm danh demo)",
    "Bé chưa có buổi (điểm danh demo)",
  ];
  const title = "Khám phá màu sắc (điểm danh demo)",
    privateNote = "Ghi chú riêng giả lập TC018, chỉ cô xem.",
    familyNote = "Hôm nay con nhận biết màu đỏ rất tốt.";
  let classId = "",
    sessionId = "",
    guardianId = "";
  const children: string[] = [],
    enrollments: string[] = [];
  async function login(page: Page, parent = false) {
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
  async function workspace(page: Page): Promise<AttendanceWorkspace> {
    const response = await page.request.get(
      `/api/v1/sessions/${sessionId}/attendance`,
    );
    expect(response.status()).toBe(200);
    return (await response.json()).data;
  }
  const row = (page: Page, index: number) =>
    page.getByRole("article", {
      name: `Điểm danh ${names[index]}`,
      exact: true,
    });
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
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/attendance-${name}.png`,
      fullPage: !center,
      animations: "disabled",
    });
  }
  async function complete(page: Page) {
    await expect
      .poll(async () => (await workspace(page)).canComplete, {
        timeout: 30_000,
      })
      .toBe(true);
    await page
      .getByRole("button", { name: "Cập nhật kết quả", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hoàn thành buổi học", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận hoàn thành", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await workspace(page)).session.status).toBe("COMPLETED");
  }

  test("điểm danh chốt danh sách, đánh dấu nhanh giữ báo nghỉ, lưu ghi chú riêng và hoàn thành buổi", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    const runtime: string[] = [];
    page.on("pageerror", (error) => runtime.push(error.message));
    await login(page);
    let response = await write(page.request, "/classes", {
      name: "Lớp Mầm Tím (điểm danh demo)",
      capacity: 6,
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
    for (const name of names) {
      response = await write(page.request, "/students", { fullName: name });
      expect(response.status()).toBe(201);
      children.push((await response.json()).data.id);
    }
    for (const child of children.slice(0, 3)) {
      response = await write(page.request, `/classes/${classId}/enrollments`, {
        studentId: child,
      });
      expect(response.status()).toBe(201);
      enrollments.push((await response.json()).data.id);
    }
    const parentContext = await browser.newContext(),
      parent = await parentContext.newPage();
    try {
      await login(parent, true);
      for (const child of [children[0], children[4]]) {
        response = await write(
          page.request,
          `/students/${child}/guardian-invitations`,
          { email: parentEmail },
        );
        expect(response.status()).toBe(201);
        const invite = (await response.json()).data;
        const token = new URLSearchParams(
          new URL(invite.inviteUrl).hash.slice(1),
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
      guardianId = (
        await (
          await page.request.get(`/api/v1/students/${children[0]}/guardians`)
        ).json()
      ).data.find((link: { email: string }) => link.email === parentEmail).id;
    } finally {
      await parentContext.close();
    }
    const now = Date.now();
    response = await write(page.request, "/sessions", {
      classId,
      clientRequestId: crypto.randomUUID(),
      title,
      startsAt: new Date(now + 2_000).toISOString(),
      endsAt: new Date(now + 20_000).toISOString(),
      preview: false,
    });
    expect(response.status()).toBe(201);
    sessionId = (await response.json()).data.session.id;
    await page.goto(`/teacher/schedule/sessions/${sessionId}`);
    await page
      .getByRole("main")
      .getByRole("link", { name: "Điểm danh", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Chốt danh sách điểm danh", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Chốt danh sách", exact: true })
      .click();
    await expect(row(page, 0)).toBeVisible();
    response = await write(page.request, `/classes/${classId}/enrollments`, {
      studentId: children[3],
    });
    expect(response.status()).toBe(201);
    enrollments.push((await response.json()).data.id);
    expect((await workspace(page)).rows.length).toBe(3);
    await expect
      .poll(async () => (await workspace(page)).canMarkPresent)
      .toBe(true);
    await page
      .getByRole("button", { name: "Cập nhật kết quả", exact: true })
      .click();
    await row(page, 1)
      .getByLabel("Trạng thái điểm danh")
      .selectOption("ABSENT_EXCUSED");
    await page
      .getByRole("button", {
        name: "Đánh dấu các bé còn lại có mặt",
        exact: true,
      })
      .click();
    await expect(row(page, 1).getByLabel("Trạng thái điểm danh")).toHaveValue(
      "ABSENT_EXCUSED",
    );
    await row(page, 0)
      .getByText("Ghi chú riêng và gửi gia đình", { exact: true })
      .click();
    await row(page, 0).getByLabel("Ghi chú riêng của cô").fill(privateNote);
    await row(page, 0).getByLabel("Ghi chú gửi gia đình").fill(familyNote);
    await page
      .getByRole("button", { name: "Lưu 3 thay đổi", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Đã lưu kết quả điểm danh.",
    );
    expect((await workspace(page)).counts).toMatchObject({
      PRESENT: 2,
      ABSENT_EXCUSED: 1,
      UNMARKED: 0,
    });
    await capture(page, "teacher-saved-1440");
    await complete(page);
    await row(page, 0).getByLabel("Trạng thái điểm danh").selectOption("LATE");
    await page
      .getByLabel("Lý do điều chỉnh")
      .fill("Điều chỉnh giờ bé đến lớp theo xác nhận của cô.");
    await page
      .getByRole("button", { name: "Lưu 1 thay đổi", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Đã lưu kết quả điểm danh.",
    );
    expect((await workspace(page)).session.status).toBe("COMPLETED");
    await page.setViewportSize({ width: 375, height: 900 });
    await capture(page, "teacher-completed-375");
    await row(page, 0)
      .getByRole("button", { name: "Lịch sử điểm danh", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Điều chỉnh giờ bé đến lớp",
    );
    await capture(page, "teacher-history-375", page.getByRole("dialog"));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Đóng", exact: true })
      .click();
    expect(runtime).toEqual([]);
  });

  test("điểm danh giữ bản nháp khi mất mạng hoặc xung đột; điều chỉnh danh sách mở lại buổi", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto(`/teacher/sessions/${sessionId}/attendance`);
    await row(page, 0)
      .getByText("Ghi chú riêng và gửi gia đình", { exact: true })
      .click();
    await row(page, 0)
      .getByLabel("Ghi chú riêng của cô")
      .fill("Bản nháp sẽ được giữ khi lưu lỗi.");
    await page.getByLabel("Lý do điều chỉnh").fill("Sửa ghi chú riêng của cô.");
    const path = `**/api/v1/sessions/${sessionId}/attendance`;
    await page.route(path, async (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              code: "TEMPORARY_UNAVAILABLE",
              message: "Kết nối thử nghiệm bị gián đoạn.",
            }),
          })
        : route.continue(),
    );
    await page
      .getByRole("button", { name: "Lưu 1 thay đổi", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Kết nối thử nghiệm bị gián đoạn.",
    );
    await expect(row(page, 0).getByLabel("Ghi chú riêng của cô")).toHaveValue(
      "Bản nháp sẽ được giữ khi lưu lỗi.",
    );
    await page.unroute(path);
    const current = await workspace(page),
      otherRow = current.rows.find((item) => item.studentId === children[2])!;
    expect(
      (
        await write(
          page.request,
          `/sessions/${sessionId}/attendance`,
          {
            sessionVersion: current.session.version,
            reason: "Cô cập nhật từ một cửa sổ khác.",
            rows: [
              {
                id: otherRow.id,
                version: otherRow.version,
                status: "ABSENT_EXCUSED",
              },
            ],
          },
          "PUT",
        )
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", { name: "Lưu 1 thay đổi", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(/thay đổi|tải lại/i);
    await expect(row(page, 0).getByLabel("Ghi chú riêng của cô")).toHaveValue(
      "Bản nháp sẽ được giữ khi lưu lỗi.",
    );
    await page.setViewportSize({ width: 375, height: 900 });
    await capture(page, "teacher-conflict-375");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Cập nhật kết quả", exact: true })
      .click();
    await expect(row(page, 2).getByLabel("Trạng thái điểm danh")).toHaveValue(
      "ABSENT_EXCUSED",
    );
    await row(page, 1)
      .getByRole("button", { name: "Loại khỏi buổi", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Lý do")
      .fill("Bé được đưa nhầm vào danh sách buổi.");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Loại khỏi danh sách buổi", exact: true })
      .click();
    await expect(row(page, 1)).toHaveCount(0);
    await page.getByRole("button", { name: "Bổ sung bé", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Bé cần bổ sung")
      .selectOption(children[3]);
    await page
      .getByRole("dialog")
      .getByLabel("Lý do bổ sung")
      .fill("Bé đã được thêm lớp sau khi cô chốt danh sách.");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Bổ sung bé", exact: true })
      .click();
    await expect(row(page, 3)).toBeVisible();
    expect((await workspace(page)).session.status).toBe("SCHEDULED");
    await row(page, 3)
      .getByLabel("Trạng thái điểm danh")
      .selectOption("PRESENT");
    await page
      .getByRole("button", { name: "Lưu 1 thay đổi", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Đã lưu kết quả điểm danh.",
    );
    await complete(page);
    let response = await write(
      page.request,
      `/students/${children[0]}`,
      { fullName: "Bảo An đổi tên (điểm danh demo)", version: 0 },
      "PATCH",
    );
    expect(response.status()).toBe(200);
    response = await write(
      page.request,
      `/enrollments/${enrollments[0]}`,
      {
        version: 0,
        status: "WITHDRAWN",
        reason: "Gia đình dừng lớp sau buổi thử.",
      },
      "PATCH",
    );
    expect(response.status()).toBe(200);
    await page
      .getByRole("button", { name: "Cập nhật kết quả", exact: true })
      .click();
    await expect(row(page, 0)).toBeVisible();
    await page.goto(`/teacher/attendance?classId=${classId}`);
    await expect(
      page.getByRole("combobox", { name: "Lớp học", exact: true }),
    ).toHaveValue(classId);
    await expect(page.getByRole("article")).toHaveCount(4);
    await capture(page, "teacher-list-375");
    await page.goto(`/teacher?classId=${classId}`);
    await expect(
      page.getByRole("region", { name: "Bé có mặt hôm nay", exact: true }),
    ).toContainText("2");
  });

  test("điểm danh gia đình chỉ thấy bé được liên kết, xem lịch sử sau rời lớp và mất quyền ngay khi thu hồi", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    await login(page);
    const context = await browser.newContext({
        viewport: { width: 375, height: 900 },
      }),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.goto(`/family/children/${children[0]}`);
      await parent
        .getByRole("main")
        .getByRole("link", { name: "Điểm danh của bé", exact: true })
        .click();
      const result = parent.getByRole("article", {
        name: `Kết quả ${title}`,
        exact: true,
      });
      await expect(result).toContainText(familyNote);
      await expect(result).toContainText("Đi muộn");
      await expect(parent.getByText(privateNote, { exact: true })).toHaveCount(
        0,
      );
      await capture(parent, "family-result-375", result);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const response = await parent.request.get(
        `/api/v1/family/children/${children[0]}/attendance?from=${today}&to=${today}`,
      );
      expect(response.status()).toBe(200);
      const payload = await response.json();
      expect(payload.data.length).toBe(1);
      expect(JSON.stringify(payload)).not.toMatch(
        /enrollmentId|studentId|version|"note"|Ghi chú riêng giả lập/,
      );
      const rowId = payload.data[0].id;
      await result
        .getByRole("button", { name: "Lịch sử điểm danh", exact: true })
        .click();
      await expect(parent.getByRole("dialog")).toContainText("Đi muộn");
      await expect(parent.getByRole("dialog")).not.toContainText(
        "Điều chỉnh giờ bé đến lớp",
      );
      await capture(parent, "family-history-375", parent.getByRole("dialog"));
      await parent
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .click();
      await parent
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(children[4]);
      await expect(parent).toHaveURL(
        new RegExp(`/children/${children[4]}/attendance$`),
      );
      await expect(
        parent.getByRole("heading", {
          name: "Chưa có kết quả trong khoảng này",
          exact: true,
        }),
      ).toBeVisible();
      await expect(parent.getByText(familyNote, { exact: true })).toHaveCount(
        0,
      );
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${children[4]}/attendance/${rowId}/history`,
          )
        ).status(),
      ).toBe(404);
      const current = await workspace(page);
      expect(
        (
          await write(page.request, `/sessions/${sessionId}/cancel`, {
            version: current.session.version,
            reason: "Cô hủy buổi để kiểm tra lịch sử vẫn được giữ.",
          })
        ).status(),
      ).toBe(200);
      await parent.goto(`/family/children/${children[0]}/attendance`);
      await parent.setViewportSize({ width: 320, height: 900 });
      await expect(result).toContainText("Buổi đã hủy:");
      await expect(result).toContainText(familyNote);
      await capture(parent, "family-cancelled-320", result);
      await page.goto(`/teacher/sessions/${sessionId}/attendance`);
      await expect(
        row(page, 0).getByLabel("Trạng thái điểm danh"),
      ).toBeDisabled();
      await capture(page, "teacher-cancelled-1440");
      expect(
        (
          await write(page.request, `/student-guardians/${guardianId}/revoke`, {
            version: 0,
            reason: "Thu hồi liên kết kiểm thử điểm danh.",
          })
        ).status(),
      ).toBe(200);
      await parent.reload();
      await expect(parent.getByRole("alert")).toBeVisible();
      await expect(parent.getByText(familyNote, { exact: true })).toHaveCount(
        0,
      );
      await expect(result).toHaveCount(0);
      await capture(parent, "family-revoked-320");
    } finally {
      await context.close();
    }
  });
}
