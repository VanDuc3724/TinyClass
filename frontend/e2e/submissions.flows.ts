import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerSubmissionFlows(
  teacherEmail: string,
  teacherPassword: string,
  childName: string,
  className: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const lessonName = "Khám phá hình dạng (sản phẩm demo)",
    assignmentName = "Cùng con ghép hình (sản phẩm demo)";
  let childId = "",
    classId = "",
    assignmentId = "",
    itemId = "",
    firstSubmission = "",
    acceptedSubmission = "",
    audioId = "";
  async function login(
    page: Page,
    email = teacherEmail,
    password = teacherPassword,
    root = "teacher",
  ) {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ email").fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${root}$`));
  }
  async function post(
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
  const itemPath = () => `/family/children/${childId}/learning/items/${itemId}`;
  const workspacePath = () =>
    `/api/v1/family/children/${childId}/assignment-items/${itemId}/submissions`;
  async function screenshot(page: Page, name: string) {
    await page.evaluate(() => document.fonts.ready);
    const fullPage = !/^family-(feedback|history)/.test(name);
    if (name === "family-feedback-320") {
      await page
        .getByLabel("Nghe phản hồi của cô", { exact: true })
        .scrollIntoViewIfNeeded();
    }
    if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/submissions-${name}.png`,
      fullPage,
      animations: "disabled",
    });
  }
  function wave() {
    const buffer = Buffer.alloc(16044);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(buffer.length - 8, 4);
    buffer.write("WAVEfmt ", 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(8000, 24);
    buffer.writeUInt32LE(16000, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(16000, 40);
    for (let frame = 0; frame < 8000; frame++)
      buffer.writeInt16LE(
        Math.round(Math.sin((2 * Math.PI * 440 * frame) / 8000) * 4096),
        44 + frame * 2,
      );
    return buffer;
  }
  test("gia đình lưu nháp, upload lỗi giữ chữ, gửi lại sau góp ý và cô chấp nhận kèm âm thanh", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page);
    const students = (
      await (await page.request.get("/api/v1/students?size=100")).json()
    ).data;
    childId = students.find(
      (s: { fullName: string }) => s.fullName === childName,
    ).id;
    classId = (
      await (await page.request.get("/api/v1/classes?size=100")).json()
    ).data.find((c: { name: string }) => c.name === className).id;
    const lesson = await post(page.request, "/lessons", {
      title: lessonName,
      summary: "Cùng bé khám phá hình tròn và hình vuông.",
      defaultCompletionMode: "TEACHER_REVIEW",
      defaultResponseTypes: ["TEXT", "IMAGE", "AUDIO", "VIDEO"],
      topicIds: [],
      blocks: [
        {
          type: "TEXT",
          textContent:
            "Gia đình cùng bé ghép hình, chụp lại một sản phẩm và kể cho cô nghe.",
        },
      ],
    });
    expect(lesson.status()).toBe(201);
    const lessonId = (await lesson.json()).data.id;
    expect(
      (
        await post(page.request, `/lessons/${lessonId}/publish`, { version: 0 })
      ).status(),
    ).toBe(200);
    const created = await post(page.request, "/assignments", {
      title: assignmentName,
      sourceType: "LESSON",
      lessonId,
      targetType: "CLASS",
      classId,
      availableAt: new Date(Date.now() - 7_200_000).toISOString(),
      dueAt: new Date(Date.now() - 3_600_000).toISOString(),
      clientRequestId: crypto.randomUUID(),
    });
    expect(created.status()).toBe(201);
    const assignment = (await created.json()).data;
    assignmentId = assignment.id;
    itemId = assignment.items[0].id;
    expect(
      (
        await post(page.request, `/assignments/${assignmentId}/publish`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    const parentContext = await browser.newContext({
      viewport: { width: 375, height: 900 },
      reducedMotion: "reduce",
    });
    try {
      const parent = await parentContext.newPage();
      parent.on("pageerror", (error) => errors.push(error.message));
      await login(parent, parentEmail, parentPassword, "family");
      await parent.goto(itemPath());
      await parent
        .getByRole("button", { name: "Tạo bản nháp sản phẩm", exact: true })
        .click();
      const text = parent.getByLabel("Nội dung sản phẩm");
      await text.fill("Bé đã ghép hình tròn và hình vuông cùng gia đình.");
      await parent
        .getByRole("button", { name: "Lưu bản nháp", exact: true })
        .click();
      await expect(
        parent.getByRole("status").filter({ hasText: "Đã lưu bản nháp." }),
      ).toBeVisible();
      await parent.reload();
      await expect(parent.getByLabel("Nội dung sản phẩm")).toHaveValue(
        "Bé đã ghép hình tròn và hình vuông cùng gia đình.",
      );
      const image = await parent.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 220;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#f2ecff";
        context.fillRect(0, 0, 320, 220);
        context.fillStyle = "#c72570";
        context.beginPath();
        context.arc(90, 90, 48, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#1c66bf";
        context.fillRect(185, 45, 90, 90);
        context.fillStyle = "#5926cf";
        context.font = "20px Nunito";
        context.fillText("Khám phá hình dạng", 56, 185);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await parent.getByLabel("Tệp sản phẩm").setInputFiles({
        name: "hinh-dang-cua-be.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      });
      await parent.route(
        "**/api/v1/family/children/*/submissions/*/files",
        (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              code: "STORAGE_UNAVAILABLE",
              message: "Kho thử nghiệm tạm không khả dụng. Thử tải lại.",
            }),
          }),
        { times: 1 },
      );
      await parent
        .getByRole("button", { name: "Tải tệp lên và lưu nháp", exact: true })
        .click();
      await expect(parent.getByRole("alert")).toContainText(
        "Kho thử nghiệm tạm không khả dụng",
      );
      await expect(text).toHaveValue(
        "Bé đã ghép hình tròn và hình vuông cùng gia đình.",
      );
      await parent
        .getByRole("button", { name: "Tải tệp lên và lưu nháp", exact: true })
        .click();
      await expect(
        parent
          .getByRole("status")
          .filter({ hasText: "Đã tải tệp và lưu bản nháp." }),
      ).toBeVisible();
      await screenshot(parent, "family-draft-375");
      expect(
        (
          await (
            await page.request.get("/api/v1/submissions?status=SUBMITTED")
          ).json()
        ).meta.totalElements,
      ).toBe(0);
      await parent
        .getByRole("button", { name: "Gửi sản phẩm cho cô", exact: true })
        .click();
      await expect(
        parent.getByRole("button", {
          name: "Gửi sản phẩm cho cô",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await (await parent.request.get(workspacePath())).json()).data
              .progress.status,
        )
        .toBe("SUBMITTED");
      expect(
        (
          await (
            await parent.request.get(
              `/api/v1/family/children/${childId}/assignments/${assignmentId}`,
            )
          ).json()
        ).data.completionPercent,
      ).toBe(0);
      firstSubmission = (
        await (await parent.request.get(workspacePath())).json()
      ).data.submissions.data[0].id;
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto("/teacher/reviews");
      await expect(
        page.getByRole("heading", { name: "Sản phẩm của bé", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
      await page
        .getByLabel("Lọc lớp sản phẩm", { exact: true })
        .selectOption(classId);
      await screenshot(page, "teacher-queue-375");
      await page.getByRole("link").filter({ hasText: lessonName }).click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(
        page.getByRole("img", { name: "hinh-dang-cua-be.png", exact: true }),
      ).toBeVisible();
      await page
        .getByLabel("Nhận xét của cô")
        .fill("Gia đình bổ sung cách bé gọi tên hai hình nhé.");
      await screenshot(page, "teacher-review-1440");
      await page
        .getByRole("button", { name: "Yêu cầu bổ sung", exact: true })
        .click();
      await expect(
        page.getByText("Cùng bé bổ sung nhé", { exact: true }),
      ).toBeVisible();
      await parent
        .getByRole("button", { name: "Cập nhật phản hồi", exact: true })
        .click();
      await parent
        .getByRole("button", { name: "Tạo lượt gửi mới", exact: true })
        .click();
      await parent
        .getByLabel("Nội dung sản phẩm")
        .fill("Bé gọi đúng hình tròn màu hồng và hình vuông màu xanh.");
      await parent
        .getByRole("button", { name: "Gửi sản phẩm cho cô", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await (await parent.request.get(workspacePath())).json()).data
              .submissions.meta.totalElements,
        )
        .toBe(2);
      acceptedSubmission = (
        await (await parent.request.get(workspacePath())).json()
      ).data.submissions.data[0].id;
      await page.goto(`/teacher/reviews/${acceptedSubmission}`);
      await page
        .getByLabel("Nhận xét của cô")
        .fill("Cô đã ghi nhận, bé gọi tên hình rất rõ!");
      await page.getByLabel("Phản hồi âm thanh").setInputFiles({
        name: "phan-hoi-cua-co.wav",
        mimeType: "audio/wav",
        buffer: wave(),
      });
      await page
        .getByRole("button", { name: "Tải phản hồi âm thanh", exact: true })
        .click();
      await expect(
        page.getByLabel("Nghe lại phản hồi âm thanh", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Chấp nhận sản phẩm", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Đã lưu phản hồi", exact: true }),
      ).toBeVisible();
      await screenshot(page, "teacher-accepted-1440");
      const detail = (
        await (
          await page.request.get(`/api/v1/submissions/${acceptedSubmission}`)
        ).json()
      ).data;
      audioId = detail.feedbackAudioFileId;
      expect(detail.progress.status).toBe("COMPLETED");
      await parent
        .getByRole("button", { name: "Cập nhật phản hồi", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", {
          name: "Mình đã hoàn thành hoạt động!",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        (
          await (
            await parent.request.get(
              `/api/v1/family/children/${childId}/assignments/${assignmentId}`,
            )
          ).json()
        ).data.completionPercent,
      ).toBe(100);
      await parent.goto(
        `/family/children/${childId}/submissions/${acceptedSubmission}`,
      );
      await expect(
        parent.getByLabel("Nghe phản hồi của cô", { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          parent
            .getByLabel("Nghe phản hồi của cô", { exact: true })
            .evaluate((element) => (element as HTMLAudioElement).duration),
        )
        .toBeGreaterThan(0);
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${childId}/submissions/${acceptedSubmission}/files/${audioId}/content`,
          )
        ).status(),
      ).toBe(200);
      await parent.setViewportSize({ width: 320, height: 900 });
      await screenshot(parent, "family-feedback-320");
      expect(errors).toEqual([]);
    } finally {
      await parentContext.close();
    }
  });

  test("cô mở vòng mới, lượt đã chấp nhận cũ không tự hoàn thành và gia đình gửi vòng tiếp theo", async ({
    page,
    browser,
  }) => {
    await login(page);
    await page.goto(`/teacher/assignments/${assignmentId}/children/${childId}`);
    await page
      .getByRole("button", { name: "Mở lại yêu cầu", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Lý do")
      .fill("Cùng bé luyện thêm với vật dụng khác trong nhà.");
    await page
      .getByRole("button", { name: "Mở vòng học mới", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Đã mở", { exact: true })).toBeVisible();
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
    });
    try {
      const parent = await context.newPage();
      await login(parent, parentEmail, parentPassword, "family");
      await parent.goto(itemPath());
      await expect(
        parent.getByRole("heading", {
          name: "Mình đã hoàn thành hoạt động!",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        (
          await (
            await parent.request.get(
              `/api/v1/family/children/${childId}/assignments/${assignmentId}`,
            )
          ).json()
        ).data.completionPercent,
      ).toBe(0);
      expect(
        (
          await (
            await parent.request.get(
              `/api/v1/family/children/${childId}/submissions/${acceptedSubmission}`,
            )
          ).json()
        ).data.status,
      ).toBe("ACCEPTED");
      await parent
        .getByRole("button", { name: "Tạo lượt gửi mới", exact: true })
        .click();
      await parent
        .getByLabel("Nội dung sản phẩm")
        .fill("Vòng mới: bé tìm được hình tròn trên chiếc đĩa.");
      await parent
        .getByRole("button", { name: "Gửi sản phẩm cho cô", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await (await parent.request.get(workspacePath())).json()).data
              .progress.status,
        )
        .toBe("SUBMITTED");
      const newAttempt = (
        await (await parent.request.get(workspacePath())).json()
      ).data.submissions.data[0];
      expect(newAttempt.reviewCycle).toBe(1);
      expect(newAttempt.attemptNumber).toBe(3);
      await page.goto(`/teacher/reviews/${newAttempt.id}`);
      await page
        .getByLabel("Nhận xét của cô")
        .fill("Hoàn thành vòng luyện tập mới.");
      await page
        .getByRole("button", { name: "Chấp nhận sản phẩm", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Đã lưu phản hồi", exact: true }),
      ).toBeVisible();
      await parent.goto(`/family/children/${childId}/submissions`);
      await expect(
        parent.getByRole("heading", {
          name: "Sản phẩm & phản hồi",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        parent.getByRole("link").filter({ hasText: lessonName }),
      ).toHaveCount(3);
      await screenshot(parent, "family-history-375");
    } finally {
      await context.close();
    }
  });

  test("rời lớp giữ lịch sử sản phẩm, thu hồi liên kết chặn cả lịch sử và tệp; refresh bỏ nội dung cũ", async ({
    page,
    browser,
  }) => {
    await login(page);
    const enrollment = (
      await (
        await page.request.get(`/api/v1/classes/${classId}/enrollments`)
      ).json()
    ).data.find((e: { studentId: string }) => e.studentId === childId);
    expect(
      (
        await post(
          page.request,
          `/enrollments/${enrollment.id}`,
          {
            version: enrollment.version,
            status: "WITHDRAWN",
            reason: "Nghỉ học (kiểm thử sản phẩm)",
          },
          "PATCH",
        )
      ).status(),
    ).toBe(200);
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
    });
    try {
      const parent = await context.newPage();
      await login(parent, parentEmail, parentPassword, "family");
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${childId}/assignment-items/${itemId}`,
          )
        ).status(),
      ).toBe(404);
      expect(
        (
          await post(
            parent.request,
            `/family/children/${childId}/assignment-items/${itemId}/submissions`,
            {},
          )
        ).status(),
      ).toBe(404);
      await parent.goto(
        `/family/children/${childId}/submissions/${acceptedSubmission}`,
      );
      await expect(
        parent
          .getByText("Cô đã ghi nhận, bé gọi tên hình rất rõ!", { exact: true })
          .first(),
      ).toBeVisible();
      const file = `/api/v1/family/children/${childId}/submissions/${acceptedSubmission}/files/${audioId}/content`;
      expect((await parent.request.get(file)).status()).toBe(200);
      const first = (
        await (
          await parent.request.get(
            `/api/v1/family/children/${childId}/submissions/${firstSubmission}`,
          )
        ).json()
      ).data;
      expect(first.status).toBe("CHANGES_REQUESTED");
      const link = (
        await (
          await page.request.get(`/api/v1/students/${childId}/guardians`)
        ).json()
      ).data.find((g: { email: string }) => g.email === parentEmail);
      expect(
        (
          await post(page.request, `/student-guardians/${link.id}/revoke`, {
            version: link.version,
            reason: "Thu hồi quyền xem riêng (kiểm thử)",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật phản hồi", exact: true })
        .click();
      await expect(parent.getByRole("alert")).toBeVisible();
      await expect(
        parent.getByText("Cô đã ghi nhận, bé gọi tên hình rất rõ!", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect((await parent.request.get(file)).status()).toBe(404);
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${childId}/submissions`,
          )
        ).status(),
      ).toBe(404);
      await screenshot(parent, "access-revoked-375");
    } finally {
      await context.close();
    }
  });
}
