import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerStudentNoteFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const childName = "Mộc An (nhận xét demo)",
    otherName = "Bé chưa có ghi nhận (demo)",
    className = "Lớp Chồi Nhỏ (nhận xét demo)";
  const privateTitle = "Quan sát riêng của cô (demo)",
    privateBody = "Riêng TC019: con cần được hỗ trợ thêm khi chuyển hoạt động.",
    sharedTitle = "Một bước tiến nhỏ (demo)",
    sharedBody = "Con tự chọn màu và hoàn thành bức tranh của mình.",
    correctedBody = "Con đã biết chờ đến lượt và cùng bạn xếp khối.";
  const privateCorrection = "Phiên bản riêng TC019 không được đưa ra gia đình.",
    lessonTitle = "Vẽ khu vườn của con (tiến bộ demo)";
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGdoAAAAASUVORK5CYII=",
    "base64",
  );
  const previewImage = readFileSync("src/assets/hero.png");
  let child = "",
    otherChild = "",
    classId = "",
    sessionId = "",
    enrollmentId = "",
    guardianId = "",
    privateId = "",
    sharedId = "",
    sharedFile = "",
    privateFile = "";
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
  const teacherPath = () => `/teacher/students/${child}/progress`,
    familyPath = () => `/family/children/${child}/progress`;
  const card = (page: Page, title: string) =>
    page.getByRole("article", { name: `Nhận xét ${title}`, exact: true });
  async function note(page: Page, id: string) {
    const response = await page.request.get(`/api/v1/student-notes/${id}`);
    expect(response.status()).toBe(200);
    return (await response.json()).data;
  }
  function changes(value: Record<string, unknown>, body: string) {
    return {
      version: value.version,
      title: value.title,
      body,
      observedOn: value.observedOn,
      visibility: value.visibility,
      classId: value.classId,
      sessionId: value.sessionId,
      fileIds: (value.attachments as { id: string }[]).map((file) => file.id),
      reason: "Cô sửa từ cửa sổ khác để kiểm tra phiên bản.",
    };
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
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/student-notes-${name}.png`,
      fullPage: !center,
      animations: "disabled",
    });
  }
  async function saveEdit(
    page: Page,
    body: string,
    visibility: "PRIVATE" | "SHARED",
    reason: string,
  ) {
    const modal = page.getByRole("dialog");
    await modal
      .getByRole("combobox", { name: "Phạm vi nhận xét", exact: true })
      .selectOption(visibility);
    await modal.getByLabel("Nội dung nhận xét").fill(body);
    await modal.getByLabel("Lý do chỉnh sửa").fill(reason);
    await modal
      .getByRole("button", {
        name: visibility === "PRIVATE" ? "Lưu chỉ cô xem" : "Lưu và chia sẻ",
        exact: true,
      })
      .click();
    await expect(modal).toHaveCount(0);
  }
  async function seedProduct(teacher: Page, parent: Page) {
    let response = await write(teacher.request, "/lessons", {
      title: lessonTitle,
      defaultCompletionMode: "TEACHER_REVIEW",
      defaultResponseTypes: ["TEXT"],
      topicIds: [],
      blocks: [{ type: "TEXT", textContent: "Cùng con vẽ một khu vườn." }],
    });
    expect(response.status()).toBe(201);
    const lesson = (await response.json()).data.id;
    expect(
      (
        await write(teacher.request, `/lessons/${lesson}/publish`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    response = await write(teacher.request, "/assignments", {
      title: "Ghi lại khu vườn của con (demo)",
      sourceType: "LESSON",
      lessonId: lesson,
      targetType: "STUDENT",
      studentId: child,
      availableAt: new Date(Date.now() - 60_000).toISOString(),
      clientRequestId: crypto.randomUUID(),
    });
    expect(response.status()).toBe(201);
    const assignment = (await response.json()).data;
    expect(
      (
        await write(teacher.request, `/assignments/${assignment.id}/publish`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    response = await write(
      parent.request,
      `/family/children/${child}/assignment-items/${assignment.items[0].id}/submissions`,
      {},
    );
    expect(response.status()).toBe(201);
    let product = (await response.json()).data;
    response = await write(
      parent.request,
      `/submissions/${product.id}`,
      {
        version: product.version,
        textResponse: "Con kể về khu vườn nhiều màu sắc của mình.",
        fileIds: [],
      },
      "PATCH",
    );
    expect(response.status()).toBe(200);
    product = (await response.json()).data;
    response = await write(
      parent.request,
      `/submissions/${product.id}/submit`,
      { version: product.version },
    );
    expect(response.status()).toBe(200);
    product = (await response.json()).data;
    expect(
      (
        await write(teacher.request, `/submissions/${product.id}/review`, {
          version: product.version,
          outcome: "ACCEPTED",
          feedbackText: "Cô thích cách con kể về bức tranh.",
        })
      ).status(),
    ).toBe(200);
  }

  test("nhận xét cô tải tệp lỗi vẫn giữ chữ, lưu lại không trùng và xem dòng thời gian chung với sản phẩm", async ({
    page,
    browser,
  }) => {
    test.setTimeout(110_000);
    const runtime: string[] = [];
    page.on("pageerror", (error) => runtime.push(error.message));
    await login(page);
    let response = await write(page.request, "/classes", {
      name: className,
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
          `/students/${id}/guardian-invitations`,
          { email: parentEmail },
        );
        expect(response.status()).toBe(201);
        const invitation = (await response.json()).data,
          token = new URLSearchParams(
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
      response = await write(page.request, `/classes/${classId}/enrollments`, {
        studentId: child,
      });
      expect(response.status()).toBe(201);
      enrollmentId = (await response.json()).data.id;
      guardianId = (
        await (
          await page.request.get(`/api/v1/students/${child}/guardians`)
        ).json()
      ).data.find((link: { email: string }) => link.email === parentEmail).id;
      const now = Date.now();
      response = await write(page.request, "/sessions", {
        classId,
        clientRequestId: crypto.randomUUID(),
        title: "Cùng cô khám phá khu vườn (demo)",
        startsAt: new Date(now + 1_000).toISOString(),
        endsAt: new Date(now + 3_000).toISOString(),
        preview: false,
      });
      expect(response.status()).toBe(201);
      sessionId = (await response.json()).data.session.id;
      await page.goto(`/teacher/students/${child}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: "Nhận xét & tiến bộ", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Viết nhận xét", exact: true })
        .click();
      let modal = page.getByRole("dialog");
      await modal.getByLabel("Tiêu đề").fill(privateTitle);
      await modal.getByLabel("Nội dung nhận xét").fill(privateBody);
      const uploadPath = "**/api/v1/files";
      await page.route(uploadPath, (route) =>
        route.request().method() === "POST"
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                message: "Kho thử nghiệm đang gián đoạn.",
                code: "STORAGE_UNAVAILABLE",
              }),
            })
          : route.continue(),
      );
      await modal.getByLabel("Thêm tệp nhận xét").setInputFiles({
        name: "nhan-xet-rieng.png",
        mimeType: "image/png",
        buffer: previewImage,
      });
      await expect(modal.getByRole("alert")).toContainText(
        "Kho thử nghiệm đang gián đoạn.",
      );
      await expect(modal.getByLabel("Nội dung nhận xét")).toHaveValue(
        privateBody,
      );
      await page.unroute(uploadPath);
      await modal.getByLabel("Thêm tệp nhận xét").setInputFiles({
        name: "nhan-xet-rieng.png",
        mimeType: "image/png",
        buffer: previewImage,
      });
      await expect(
        modal.getByText("nhan-xet-rieng.png", { exact: true }),
      ).toBeVisible();
      await expect(modal.getByRole("status")).toHaveCount(0);
      await page.setViewportSize({ width: 375, height: 900 });
      await capture(page, "teacher-editor-375", modal);
      await modal
        .getByRole("button", { name: "Xem trước", exact: true })
        .click();
      const image = modal.getByRole("img", {
        name: "nhan-xet-rieng.png",
        exact: true,
      });
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        )
        .toBe(343);
      expect(
        await modal.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await capture(page, "teacher-file-preview-375", image);
      await modal
        .getByRole("button", { name: "Đóng xem trước", exact: true })
        .click();
      const createPath = `**/api/v1/students/${child}/notes`;
      let saves = 0;
      await page.route(createPath, async (route) => {
        if (route.request().method() === "POST" && saves++ === 0) {
          const committed = await route.fetch();
          expect(committed.status()).toBe(201);
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Mất phản hồi sau khi lưu, thử lưu lại.",
              code: "TEMPORARY_UNAVAILABLE",
            }),
          });
        } else await route.continue();
      });
      await modal
        .getByRole("button", { name: "Lưu chỉ cô xem", exact: true })
        .click();
      await expect(modal.getByRole("alert")).toContainText(
        "Mất phản hồi sau khi lưu",
      );
      await expect(modal.getByLabel("Nội dung nhận xét")).toHaveValue(
        privateBody,
      );
      await modal
        .getByRole("button", { name: "Lưu chỉ cô xem", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await page.unroute(createPath);
      await expect(card(page, privateTitle)).toBeVisible();
      let notes = (
        await (await page.request.get(`/api/v1/students/${child}/notes`)).json()
      ).data;
      expect(notes.length).toBe(1);
      privateId = notes[0].id;
      privateFile = notes[0].attachments[0].id;
      expect(
        (
          await (
            await page.request.get(`/api/v1/student-notes/${privateId}/history`)
          ).json()
        ).meta.totalElements,
      ).toBe(1);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("button", { name: "Viết nhận xét", exact: true })
        .click();
      modal = page.getByRole("dialog");
      await modal.getByLabel("Tiêu đề").fill(sharedTitle);
      await modal.getByLabel("Nội dung nhận xét").fill(sharedBody);
      await modal
        .getByRole("combobox", { name: "Phạm vi nhận xét", exact: true })
        .selectOption("SHARED");
      await modal
        .getByRole("combobox", { name: /^Lớp liên quan/ })
        .selectOption(classId);
      await expect(
        modal
          .getByRole("combobox", { name: /^Buổi liên quan/ })
          .getByRole("option", { name: /Cùng cô khám phá khu vườn/ }),
      ).toHaveCount(1);
      await modal
        .getByRole("combobox", { name: /^Buổi liên quan/ })
        .selectOption(sessionId);
      await modal.getByLabel("Thêm tệp nhận xét").setInputFiles({
        name: "nhan-xet-chia-se.png",
        mimeType: "image/png",
        buffer: png,
      });
      await expect(
        modal.getByText("nhan-xet-chia-se.png", { exact: true }),
      ).toBeVisible();
      await modal
        .getByRole("button", { name: "Chia sẻ nhận xét", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await expect(card(page, sharedTitle)).toBeVisible();
      notes = (
        await (await page.request.get(`/api/v1/students/${child}/notes`)).json()
      ).data;
      const shared = notes.find(
        (item: { title: string }) => item.title === sharedTitle,
      );
      sharedId = shared.id;
      sharedFile = shared.attachments[0].id;
      expect(shared.sessionId).toBe(sessionId);
      await seedProduct(page, parent);
      await page.getByRole("button", { name: "Tất cả", exact: true }).click();
      await expect(page.getByRole("article")).toHaveCount(3);
      await expect(
        page.getByRole("article", {
          name: `Sản phẩm ${lessonTitle}`,
          exact: true,
        }),
      ).toContainText("Đã chấp nhận");
      await capture(page, "teacher-timeline-1440");
      await page.setViewportSize({ width: 375, height: 900 });
      await capture(page, "teacher-timeline-375");
      expect(runtime).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("nhận xét gia đình chỉ thấy phần chia sẻ, xem tải tệp và đổi bé không giữ nội dung cũ", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    await page.goto(teacherPath());
    const context = await browser.newContext({
        viewport: { width: 375, height: 900 },
      }),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.goto(`/family/children/${child}`);
      await parent
        .getByRole("main")
        .getByRole("link", { name: "Nhận xét & tiến bộ", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toContainText(sharedBody);
      await expect(card(parent, privateTitle)).toHaveCount(0);
      await expect(parent.getByText(privateBody, { exact: true })).toHaveCount(
        0,
      );
      await expect(
        parent.getByRole("article", {
          name: `Sản phẩm ${lessonTitle}`,
          exact: true,
        }),
      ).toBeVisible();
      await capture(parent, "family-timeline-375", card(parent, sharedTitle));
      const payload = await (
        await parent.request.get(`/api/v1/family/children/${child}/progress`)
      ).json();
      expect(JSON.stringify(payload)).not.toMatch(
        /privateNotes|version|archivedAt|createHash|clientRequestId/,
      );
      expect(JSON.stringify(payload)).not.toContain(privateBody);
      expect(JSON.stringify(payload)).not.toContain(privateFile);
      await parent
        .getByRole("button", { name: "Sản phẩm", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toHaveCount(0);
      await expect(parent.getByRole("article")).toHaveCount(1);
      await parent
        .getByRole("button", { name: "Nhận xét", exact: true })
        .click();
      await card(parent, sharedTitle)
        .getByRole("button", { name: "Xem tệp", exact: true })
        .click();
      await expect(
        parent
          .getByRole("dialog")
          .getByRole("img", { name: "nhan-xet-chia-se.png", exact: true }),
      ).toBeVisible();
      const download = parent.waitForEvent("download");
      await parent
        .getByRole("dialog")
        .getByRole("link", { name: "Tải tệp", exact: true })
        .click();
      expect((await download).suggestedFilename()).toBe("nhan-xet-chia-se.png");
      await parent
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .click();
      await card(page, sharedTitle)
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .click();
      await saveEdit(
        page,
        privateCorrection,
        "PRIVATE",
        "Nhận xét này cần cô xem xét riêng.",
      );
      await parent
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toHaveCount(0);
      const filePath = `/api/v1/family/children/${child}/notes/${sharedId}/files/${sharedFile}/content`;
      expect((await parent.request.get(filePath)).status()).toBe(404);
      await card(page, sharedTitle)
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .click();
      await saveEdit(
        page,
        correctedBody,
        "SHARED",
        "Chia sẻ nội dung đã kiểm tra lại.",
      );
      await parent
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toContainText(correctedBody);
      await expect(
        parent.getByText(privateCorrection, { exact: true }),
      ).toHaveCount(0);
      expect((await parent.request.get(filePath)).status()).toBe(200);
      await card(page, sharedTitle)
        .getByRole("button", { name: "Lịch sử thay đổi", exact: true })
        .click();
      let modal = page.getByRole("dialog");
      await modal
        .getByText("Xem nội dung trước và sau", { exact: true })
        .first()
        .click();
      await expect(
        modal
          .locator("details")
          .first()
          .getByText(privateCorrection, { exact: true }),
      ).toBeVisible();
      await capture(page, "teacher-history-1440", modal);
      await modal.getByRole("button", { name: "Đóng", exact: true }).click();
      await parent
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(otherChild);
      await expect(parent).toHaveURL(
        new RegExp(`/children/${otherChild}/progress$`),
      );
      await expect(
        parent.getByRole("heading", {
          name: `Hành trình của ${otherName}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(parent.getByRole("article")).toHaveCount(0);
      await expect(
        parent.getByText(correctedBody, { exact: true }),
      ).toHaveCount(0);
      await parent.setViewportSize({ width: 320, height: 900 });
      await capture(parent, "family-other-child-320");
    } finally {
      await context.close();
    }
  });

  test("nhận xét giữ bản sửa khi 503 hoặc 409, lưu trữ khôi phục có lịch sử và thu hồi chặn cả tệp", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    await page.goto(`${teacherPath()}?type=NOTE`);
    await card(page, privateTitle)
      .getByRole("button", { name: "Chỉnh sửa", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    const draftBody = "Bản sửa đang nhập phải được giữ khi lưu lỗi TC019.";
    await modal.getByLabel("Nội dung nhận xét").fill(draftBody);
    await modal.getByLabel("Lý do chỉnh sửa").fill("Bổ sung ghi nhận của cô.");
    const path = `**/api/v1/student-notes/${privateId}`;
    await page.route(path, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Kết nối lưu thử nghiệm bị gián đoạn.",
              code: "TEMPORARY_UNAVAILABLE",
            }),
          })
        : route.continue(),
    );
    await modal
      .getByRole("button", { name: "Lưu chỉ cô xem", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText(
      "Kết nối lưu thử nghiệm bị gián đoạn.",
    );
    await expect(modal.getByLabel("Nội dung nhận xét")).toHaveValue(draftBody);
    await page.unroute(path);
    const current = await note(page, privateId);
    expect(
      (
        await write(
          page.request,
          `/student-notes/${privateId}`,
          changes(current, "Bản đã lưu từ một cửa sổ khác."),
          "PATCH",
        )
      ).status(),
    ).toBe(200);
    await modal
      .getByRole("button", { name: "Lưu chỉ cô xem", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText(/thay đổi|tải lại/i);
    await expect(modal.getByLabel("Nội dung nhận xét")).toHaveValue(draftBody);
    await page.setViewportSize({ width: 375, height: 900 });
    await capture(page, "teacher-conflict-375", modal.getByRole("alert"));
    page.once("dialog", (dialog) => dialog.accept());
    await modal
      .getByRole("button", { name: "Tải lại bản mới", exact: true })
      .click();
    await expect(modal.getByLabel("Nội dung nhận xét")).toHaveValue(
      "Bản đã lưu từ một cửa sổ khác.",
    );
    await saveEdit(
      page,
      "Bản nhận xét riêng đã đối chiếu xong.",
      "PRIVATE",
      "Cô đã đối chiếu hai bản ghi.",
    );
    const context = await browser.newContext({
        viewport: { width: 375, height: 900 },
      }),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.goto(familyPath());
      await expect(card(parent, sharedTitle)).toBeVisible();
      await card(page, sharedTitle)
        .getByRole("button", { name: "Lưu trữ nhận xét", exact: true })
        .click();
      modal = page.getByRole("dialog");
      await modal.getByLabel("Lý do").fill("Tạm lưu trữ để đối chiếu.");
      await modal
        .getByRole("button", { name: "Lưu trữ nhận xét", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await expect(card(page, sharedTitle)).toHaveCount(0);
      await parent
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toHaveCount(0);
      await page.getByLabel("Bao gồm nhận xét lưu trữ").check();
      await expect(card(page, sharedTitle)).toContainText("Đã lưu trữ");
      await capture(page, "teacher-archived-375");
      await card(page, sharedTitle)
        .getByRole("button", { name: "Khôi phục nhận xét", exact: true })
        .click();
      modal = page.getByRole("dialog");
      await expect(
        modal.getByRole("heading", {
          name: "Khôi phục và chia sẻ lại",
          exact: true,
        }),
      ).toBeVisible();
      await modal.getByLabel("Lý do").fill("Đã đối chiếu, tiếp tục chia sẻ.");
      await modal
        .getByRole("button", { name: "Xác nhận khôi phục", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await parent
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toContainText(correctedBody);
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollmentId}`,
            {
              version: 0,
              status: "WITHDRAWN",
              reason: "Gia đình dừng lớp thử nghiệm.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      expect(
        (
          await write(page.request, `/students/${child}/archive`, {
            version: 0,
            reason: "Lưu hồ sơ để xem lại.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(card(parent, sharedTitle)).toBeVisible();
      await expect(
        parent.getByRole("article", {
          name: `Sản phẩm ${lessonTitle}`,
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Viết nhận xét", exact: true }),
      ).toBeDisabled();
      expect(
        (
          await write(page.request, `/student-guardians/${guardianId}/revoke`, {
            version: 0,
            reason: "Thu hồi liên kết thử nghiệm nhận xét.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật hành trình", exact: true })
        .click();
      await expect(parent.getByRole("alert")).toBeVisible();
      await expect(card(parent, sharedTitle)).toHaveCount(0);
      await expect(
        parent.getByText(correctedBody, { exact: true }),
      ).toHaveCount(0);
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${child}/notes/${sharedId}/files/${sharedFile}/content`,
          )
        ).status(),
      ).toBe(404);
      await parent.setViewportSize({ width: 320, height: 900 });
      await capture(parent, "family-revoked-320");
    } finally {
      await context.close();
    }
  });
}
