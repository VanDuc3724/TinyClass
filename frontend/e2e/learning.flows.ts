import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerLearningFlows(
  teacherEmail: string,
  teacherPassword: string,
  childName: string,
  className: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const lessonName = "Khám phá màu sắc (demo)",
    courseName = "Những khám phá đầu tiên (demo)",
    assignmentName = "Cùng con tìm ba màu (demo)";
  let videoFile = "",
    childId = "",
    classId = "",
    itemId = "",
    assignmentId = "";
  async function login(
    page: Page,
    email = teacherEmail,
    password = teacherPassword,
    role = "teacher",
  ) {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ email").fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
  }
  async function post(request: APIRequestContext, path: string, body: unknown) {
    const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.post(`/api/v1${path}`, {
      headers: { [csrf.headerName]: csrf.token },
      data: body,
    });
  }

  test("tải ảnh và video thật, xem trước và thay quyền tải trong kho riêng", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page);
    await page.getByRole("link", { name: "Kho tài liệu", exact: true }).click();
    const videoBytes = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 270;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#e7eedc";
      context.fillRect(0, 0, 480, 270);
      context.fillStyle = "#285b4e";
      context.font = "28px sans-serif";
      context.fillText("TinyClass · Video demo", 65, 100);
      ["#dc8263", "#eac565", "#729a84"].forEach((color, index) => {
        context.fillStyle = color;
        context.beginPath();
        context.arc(140 + index * 100, 175, 28, 0, Math.PI * 2);
        context.fill();
      });
      const stream = canvas.captureStream(6),
        chunks: Blob[] = [],
        recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp8",
        });
      const done = new Promise<Blob>((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start();
      let frame = 0;
      const animation = setInterval(() => {
        context.fillStyle = "#e7eedc";
        context.fillRect(20, 230, 440, 12);
        context.fillStyle = "#729a84";
        context.fillRect(20, 230, ++frame * 30, 6);
      }, 100);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      clearInterval(animation);
      recorder.stop();
      const blob = await done;
      stream.getTracks().forEach((track) => track.stop());
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page
      .getByRole("button", { name: "Tải tệp lên", exact: true })
      .click();
    await page.getByLabel("Tệp tài liệu").setInputFiles({
      name: "Ba màu sắc.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(videoBytes),
    });
    await page
      .getByRole("button", { name: "Lưu tài liệu", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ba màu sắc.webm" }),
    ).toBeVisible();
    const files = (await (await page.request.get("/api/v1/files")).json()).data;
    videoFile = files.find(
      (file: { originalName: string }) =>
        file.originalName === "Ba màu sắc.webm",
    ).id;
    await page
      .getByRole("button", { name: "Tải tệp lên", exact: true })
      .click();
    await page.getByLabel("Tệp tài liệu").setInputFiles({
      name: "Hạt mầm.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sy8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page
      .getByRole("button", { name: "Lưu tài liệu", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Hạt mầm.png" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/files-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name: "Ba màu sắc.webm" }) })
      .click();
    await expect
      .poll(() =>
        page
          .locator("dialog video")
          .evaluate((video: HTMLVideoElement) => video.readyState),
      )
      .toBeGreaterThanOrEqual(1);
    await page
      .getByRole("button", { name: "Cho phép gia đình tải", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Chuyển sang chỉ xem" }),
    ).toBeVisible();
    expect(
      (
        await page.request.get(`/api/v1/files/${videoFile}/content`, {
          headers: { Range: "bytes=0-20" },
        })
      ).status(),
    ).toBe(206);
    await page.getByRole("dialog").getByLabel("Đóng", { exact: true }).click();
    expect(errors).toEqual([]);
  });

  test("soạn bài, sắp khóa, giao lớp rồi gia đình xem video và xác nhận tiến độ", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page);
    await page.goto("/teacher/library?tab=topics");
    await page.getByRole("button", { name: "Thêm chủ đề" }).click();
    await page.getByLabel("Tên chủ đề").fill("Thế giới màu sắc (demo)");
    await page
      .getByLabel("Mô tả", { exact: false })
      .fill("Những màu sắc gần gũi quanh bé.");
    await page.getByRole("button", { name: "Lưu chủ đề" }).click();
    await page.getByRole("tab", { name: "Bài học", exact: true }).click();
    await page.getByRole("link", { name: "Soạn bài học" }).click();
    await page.getByLabel("Tên bài học").fill(lessonName);
    await page
      .getByLabel("Giới thiệu ngắn")
      .fill("Cùng bé tìm ba màu qua một đoạn video ngắn.");
    await page
      .getByLabel("Gợi ý cho gia đình")
      .fill("Chuẩn bị ba đồ vật màu đỏ, vàng và xanh.");
    await page
      .getByLabel("Hướng dẫn hoạt động")
      .fill("Cùng con chọn và gọi tên màu của từng đồ vật.");
    await page
      .getByLabel("Nội dung khối 1")
      .fill("Chào bé, hôm nay mình cùng khám phá màu sắc nhé!");
    await page.getByRole("button", { name: "Thêm khối nội dung" }).click();
    await page.getByLabel("Loại khối 2").selectOption("VIDEO");
    await page.getByLabel("Tệp cho khối 2").selectOption(videoFile);
    await page
      .getByRole("checkbox", { name: "Thế giới màu sắc (demo)" })
      .check();
    await page
      .getByRole("button", { name: "Lưu bản nháp", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: lessonName, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xuất bản", exact: true })
      .click();
    await expect(page.getByText("Đã xuất bản", { exact: true })).toBeVisible();
    const lessonId = page.url().split("/").pop()!;
    await page.goto("/teacher/library");
    await expect(
      page.getByRole("heading", { name: lessonName, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/library-desktop.png",
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Khóa học", exact: true }).click();
    await page.getByRole("link", { name: "Tạo khóa học" }).click();
    await page.getByLabel("Tên khóa học").fill(courseName);
    await page
      .getByLabel("Giới thiệu khóa học")
      .fill("Những hoạt động nhỏ để gia đình cùng con khám phá.");
    await page.getByLabel("Chọn bài vào khóa").selectOption(lessonId);
    await page.getByRole("button", { name: "Thêm bài", exact: true }).click();
    await page
      .getByRole("button", { name: "Lưu khóa học", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: courseName, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xuất bản", exact: true })
      .click();
    await page.getByRole("link", { name: "Giao cho gia đình" }).click();
    await page.getByLabel("Tên lần giao").fill(assignmentName);
    await page.getByLabel("Lớp nhận bài").selectOption({ label: className });
    await page.getByRole("button", { name: "Tạo bản nháp" }).click();
    await expect(
      page.getByRole("heading", { name: assignmentName, exact: true }),
    ).toBeVisible();
    assignmentId = page.url().split("/").pop()!;
    await page
      .getByRole("button", { name: "Xuất bản lần giao", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Xuất bản và giao bài", exact: true })
      .click();
    await expect(page.getByText(childName, { exact: true })).toBeVisible();
    const assignment = (
      await (
        await page.request.get(`/api/v1/assignments/${assignmentId}`)
      ).json()
    ).data;
    itemId = assignment.items[0].id;
    classId = assignment.classId;
    childId = assignment.recipients[0].studentId;
    await page.screenshot({
      path: "test-results/assignment-desktop.png",
      fullPage: true,
    });
    const invitation = await post(
      page.request,
      `/students/${childId}/guardian-invitations`,
      { email: parentEmail },
    );
    expect(invitation.status()).toBe(201);
    const context = await browser.newContext();
    try {
      const parent = await context.newPage();
      parent.on("pageerror", (error) => errors.push(error.message));
      await parent.goto((await invitation.json()).data.inviteUrl);
      await parent
        .getByLabel("Họ và tên phụ huynh")
        .fill("Gia đình Bé Bông (demo)");
      await parent.getByLabel("Địa chỉ email").fill(parentEmail);
      await parent.getByLabel("Mật khẩu").fill(parentPassword);
      await parent
        .getByRole("button", { name: "Tạo tài khoản phụ huynh" })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Xác minh email để tiếp tục" }),
      ).toBeVisible();
      const mail = await parent.request.get(
        `http://127.0.0.1:18026/view/latest.txt?query=${encodeURIComponent(`to:${parentEmail}`)}`,
      );
      const verify = (await mail.text()).match(
        /http:\/\/127\.0\.0\.1:5174\/verify-email#[^\s]+/,
      )?.[0];
      expect(verify).toBeTruthy();
      await parent.goto(verify!);
      await parent
        .getByRole("button", { name: "Xác minh email", exact: true })
        .click();
      await parent.getByRole("link", { name: "Tiếp tục lời mời" }).click();
      await parent
        .getByRole("button", { name: "Nhận lời mời", exact: true })
        .click();
      await parent.getByRole("link", { name: "Góc học của bé" }).click();
      await parent
        .getByRole("link")
        .filter({ has: parent.getByRole("heading", { name: assignmentName }) })
        .click();
      await expect(parent.getByRole("progressbar")).toHaveAttribute(
        "value",
        "0",
      );
      await parent.getByRole("link").filter({ hasText: lessonName }).click();
      await expect(
        parent.getByRole("heading", { name: lessonName, exact: true }),
      ).toBeVisible();
      await parent
        .locator("video")
        .evaluate(async (video: HTMLVideoElement) => {
          await video.play();
        });
      await expect
        .poll(() =>
          parent
            .locator("video")
            .evaluate((video: HTMLVideoElement) => video.currentTime),
        )
        .toBeGreaterThan(0.2);
      await parent
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.pause());
      await expect
        .poll(() =>
          parent
            .locator("video")
            .evaluate((video: HTMLVideoElement) => video.readyState),
        )
        .toBeGreaterThanOrEqual(1);
      await expect(
        parent.getByRole("button", { name: "Xác nhận đã hoàn thành" }),
      ).toBeDisabled();
      await expect(
        parent.getByRole("link", { name: "Ba màu sắc.webm", exact: true }),
      ).toBeVisible();
      await parent.screenshot({
        path: "test-results/family-learning-desktop.png",
        fullPage: true,
      });
      await parent.setViewportSize({ width: 390, height: 844 });
      await expect(parent.locator(".sidebar")).not.toBeInViewport();
      expect(
        await parent.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await parent.screenshot({
        path: "test-results/family-learning-mobile.png",
        fullPage: true,
      });
      await parent
        .getByRole("checkbox", {
          name: "Tôi đã cùng bé thực hiện hoạt động này.",
        })
        .check();
      await parent
        .getByRole("button", { name: "Xác nhận đã hoàn thành" })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Mình đã hoàn thành hoạt động!" }),
      ).toBeVisible();
      await parent
        .getByRole("link", { name: "Về danh sách hoạt động", exact: false })
        .click();
      await expect(parent.getByRole("progressbar")).toHaveAttribute(
        "value",
        "100",
      );
      await page.reload();
      await expect(
        page.getByText("1/1 bài hoàn thành", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("rời/quay lại lớp không tự mở bài cũ, giáo viên cấp lại quyền có chủ đích", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    await login(page);
    const context = await browser.newContext();
    try {
      const parent = await context.newPage();
      await login(parent, parentEmail, parentPassword, "family");
      const itemPath = `/api/v1/family/children/${childId}/assignment-items/${itemId}`;
      expect((await parent.request.get(itemPath)).status()).toBe(200);
      await page.goto(`/teacher/classes/${classId}`);
      const row = page.getByRole("row").filter({ hasText: childName });
      await row.getByRole("button", { name: "Rời lớp", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do")
        .fill("Gia đình tạm nghỉ (demo)");
      await page.getByRole("button", { name: "Xác nhận rời lớp" }).click();
      await expect(row.getByText("Đã rời lớp", { exact: true })).toBeVisible();
      expect((await parent.request.get(itemPath)).status()).toBe(404);
      expect(
        (
          await parent.request.get(`${itemPath}/files/${videoFile}/content`)
        ).status(),
      ).toBe(404);
      await row.getByRole("button", { name: "Quay lại", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do")
        .fill("Bé trở lại lớp (demo)");
      await page.getByRole("button", { name: "Xác nhận quay lại" }).click();
      await expect(
        row.getByText("Đang hoạt động", { exact: true }),
      ).toBeVisible();
      expect((await parent.request.get(itemPath)).status()).toBe(404);
      await page.goto(`/teacher/assignments/${assignmentId}`);
      await page.getByRole("button", { name: "Cấp thêm bé" }).click();
      await page.getByRole("checkbox", { name: childName }).check();
      await page
        .getByLabel("Lý do cấp thêm")
        .fill("Chia sẻ lại hoạt động cũ khi bé quay lại");
      await page.getByRole("button", { name: "Cấp quyền xem bài" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      expect((await parent.request.get(itemPath)).status()).toBe(200);
    } finally {
      await context.close();
    }
  });
}
