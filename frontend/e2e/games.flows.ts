import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page, Request } from "@playwright/test";

export function registerGameFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-games@example.test",
    parentPassword = "Synthetic-games-parent-2026";
  let classroom = "",
    child = "",
    enrollment = "",
    lessonAssignment = "",
    lessonItem = "";
  const games: Record<string, string> = {},
    assignments: Record<string, string> = {};
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
    data: unknown,
    method = "POST",
  ) {
    const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.fetch(`/api/v1${path}`, {
      method,
      data,
      headers: { [csrf.headerName]: csrf.token },
    });
  }
  async function get(page: Page, path: string) {
    const r = await page.request.get(`/api/v1${path}`);
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  }
  async function post(page: Page, path: string, data: unknown, status = 200) {
    const r = await write(page.request, path, data);
    expect(r.status(), await r.text()).toBe(status);
    return (await r.json()).data;
  }
  async function capture(page: Page, name: string) {
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/games-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  async function choose(page: Page) {
    for (const label of ["🔴 Màu đỏ", "🐱 Mèo", "🍎🍎🍎 Ba quả táo"])
      await page
        .getByRole("dialog")
        .getByRole("button", { name: label, exact: true })
        .click();
    await expect(
      page.getByRole("heading", { name: "Mình đã khám phá xong rồi!" }),
    ).toBeVisible();
  }

  test("trò chơi: cô soạn ba mẫu, chơi thử, giao lớp và liên kết bài học", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);
    await login(page);
    classroom = (
      await post(
        page,
        "/classes",
        { name: "Lớp góc chơi (demo)", capacity: 5 },
        201,
      )
    ).id;
    await post(page, `/classes/${classroom}/activate`, { version: 0 });
    child = (
      await post(page, "/students", { fullName: "Bé Mây (góc chơi demo)" }, 201)
    ).id;
    enrollment = (
      await post(
        page,
        `/classes/${classroom}/enrollments`,
        { studentId: child },
        201,
      )
    ).id;
    const parentContext = await browser.newContext(),
      parent = await parentContext.newPage();
    try {
      const invite = await post(
        page,
        `/students/${child}/guardian-invitations`,
        { email: parentEmail },
        201,
      );
      await parent.goto(invite.inviteUrl);
      await parent
        .getByLabel("Họ và tên phụ huynh")
        .fill("Gia đình Mây (demo)");
      await parent.getByLabel("Địa chỉ email").fill(parentEmail);
      await parent.getByLabel("Mật khẩu").fill(parentPassword);
      await parent
        .getByRole("button", { name: "Tạo tài khoản phụ huynh" })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Xác minh email để tiếp tục" }),
      ).toBeVisible();
      let verify = "";
      await expect
        .poll(async () => {
          const mail = await parent.request.get(
            `http://127.0.0.1:18026/view/latest.txt?query=${encodeURIComponent(`to:${parentEmail}`)}`,
          );
          verify =
            (await mail.text()).match(
              /http:\/\/127\.0\.0\.1:5174\/verify-email#[^\s]+/,
            )?.[0] || "";
          return !!verify;
        })
        .toBe(true);
      await parent.goto(verify);
      await parent
        .getByRole("button", { name: "Xác minh email", exact: true })
        .click();
      await expect(
        parent.getByRole("link", { name: "Tiếp tục lời mời" }),
      ).toBeVisible();
      const token = new URLSearchParams(
        new URL(invite.inviteUrl).hash.slice(1),
      ).get("token");
      await post(parent, "/guardian-invitations/accept", {
        token,
        relationshipLabel: "Gia đình",
      });
    } finally {
      await parentContext.close();
    }
    const lesson = await post(
      page,
      "/lessons",
      {
        title: "Quan sát cùng trò chơi",
        defaultCompletionMode: "PARENT_CONFIRM",
        defaultResponseTypes: [],
        topicIds: [],
        blocks: [
          {
            type: "TEXT",
            textContent: "Gia đình quan sát, chơi rồi cùng bé thực hành ở nhà.",
          },
        ],
      },
      201,
    );
    await post(page, `/lessons/${lesson.id}/publish`, { version: 0 });
    const activity = await post(
      page,
      "/assignments",
      {
        title: "Quan sát cùng trò chơi",
        sourceType: "LESSON",
        lessonId: lesson.id,
        targetType: "CLASS",
        classId: classroom,
        availableAt: new Date(Date.now() - 60000).toISOString(),
        clientRequestId: crypto.randomUUID(),
      },
      201,
    );
    await post(page, `/assignments/${activity.id}/publish`, { version: 0 });
    lessonAssignment = activity.id;
    lessonItem = (await get(page, `/assignments/${activity.id}`)).items[0].id;
    for (const [type, title] of [
      ["CHOICE", "Chọn hình cùng Mây"],
      ["MATCH", "Ghép bạn cho con vật"],
      ["MEMORY", "Nhớ những loại quả"],
    ]) {
      await page.goto("/teacher/games/new");
      await page.getByLabel("Tên trò chơi", { exact: true }).fill(title);
      if (type !== "CHOICE") {
        const picker = page.getByRole("combobox", { name: "Kiểu trò chơi", exact: true });
        const changeType = page.getByRole("dialog", { name: "Đổi kiểu trò chơi?" });
        await picker.selectOption(type);
        await expect(changeType.getByRole("button", { name: "Hủy" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(picker).toHaveValue("CHOICE");
        await picker.selectOption(type);
        await changeType.getByRole("button", { name: "Đổi kiểu trò chơi" }).click();
        await expect(picker).toHaveValue(type);
      }
      await page.getByRole("button", { name: "Dùng nội dung gợi ý" }).click();
      if (type === "CHOICE") {
        const assetRequests: URL[] = [];
        const trackAssets = (request: Request) => {
          const url = new URL(request.url());
          if (request.method() === "GET" && url.pathname === "/api/v1/files")
            assetRequests.push(url);
        };
        page.on("request", trackAssets);
        const initialAssets = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === "/api/v1/files" && url.searchParams.get("mediaType") === "image";
        });
        await page
          .getByRole("button", { name: "Chọn ảnh câu 1", exact: true })
          .click();
        const picker = page.getByRole("dialog");
        expect((await initialAssets).status()).toBe(200);
        const searchedAssets = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === "/api/v1/files" && url.searchParams.get("q") === "game-question";
        });
        await picker.getByLabel("Tìm trong kho").pressSequentially("game-question", { delay: 5 });
        expect((await searchedAssets).status()).toBe(200);
        // One initial page and one settled search, regardless of the number of keystrokes.
        expect(assetRequests).toHaveLength(2);
        for (const url of assetRequests) {
          expect(url.searchParams.get("purpose")).toBe("LESSON_ASSET");
          expect(url.searchParams.get("mediaType")).toBe("image");
          expect(url.searchParams.get("status")).toBe("READY");
          expect(url.searchParams.get("size")).toBe("12");
          expect(url.searchParams.get("page")).toBe("0");
        }
        page.off("request", trackAssets);
        await picker.getByLabel("Tải ảnh mới").setInputFiles({
          name: "game-question.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+3sAAAAASUVORK5CYII=",
            "base64",
          ),
        });
        await picker.getByRole("button", { name: "Tải lên và chọn" }).click();
        await expect(picker).toHaveCount(0);
        const wav = Buffer.alloc(16044);
        wav.write("RIFF");
        wav.writeUInt32LE(16036, 4);
        wav.write("WAVEfmt ", 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(8000, 24);
        wav.writeUInt32LE(16000, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write("data", 36);
        wav.writeUInt32LE(16000, 40);
        const audioAssets = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return url.pathname === "/api/v1/files" && url.searchParams.get("mediaType") === "audio";
        });
        await page
          .getByRole("button", { name: "Chọn âm thanh hướng dẫn", exact: true })
          .click();
        expect((await audioAssets).status()).toBe(200);
        await page
          .getByRole("dialog")
          .getByLabel("Tải âm thanh mới")
          .setInputFiles({
            name: "game-instruction.wav",
            mimeType: "audio/wav",
            buffer: wav,
          });
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Tải lên và chọn" })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      await page
        .getByRole("button", { name: "Lưu bản nháp", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      games[type] = page.url().split("/").pop()!;
      if (type === "CHOICE") {
        await page.getByRole("link", { name: "Chơi thử", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await choose(page);
        await expect(
          page
            .getByRole("region", { name: "Kết quả lượt chơi" })
            .getByLabel("3 sao"),
        ).toBeVisible();
        await page.getByRole("button", { name: "Thoát chơi thử", exact: true }).click();
      }
      await page
        .getByRole("button", { name: "Xuất bản trò chơi", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Giao trò chơi", exact: true })
        .click();
      const modal = page.getByRole("dialog");
      await modal
        .getByRole("combobox", { name: "Lớp nhận trò chơi", exact: true })
        .selectOption(classroom);
      if (type === "CHOICE") {
        await modal
          .getByRole("combobox", { name: "Gắn với nội dung học", exact: true })
          .selectOption("LESSON");
        await modal
          .getByRole("combobox", { name: "Bài học liên quan", exact: true })
          .selectOption(lesson.id);
      }
      await modal.getByRole("button", { name: "Giao cho gia đình" }).click();
      await expect(page).toHaveURL(/\/teacher\/game-assignments\/[^/]+$/);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      assignments[type] = page.url().split("/").pop()!;
    }
    await page.goto("/teacher/games");
    await expect(
      page.getByRole("heading", { name: "Kho trò chơi", exact: true }),
    ).toBeVisible();
    await capture(page, "teacher-catalog-desktop");
  });
  test("trò chơi: bé chơi ba kiểu, tiếp tục sau reload, retry an toàn và bộ sưu tập mobile", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, true);
    await page.goto(
      `/family/children/${child}/learning/assignments/${lessonAssignment}`,
    );
    await expect(
      page.getByRole("heading", { name: "Cùng bé chơi thêm" }),
    ).toBeVisible();
    await page.goto(`/family/children/${child}/learning/items/${lessonItem}`);
    await expect(
      page.getByRole("heading", { name: "Cùng bé chơi thêm" }),
    ).toBeVisible();
    await page.goto(`/family/children/${child}/games`);
    await expect(
      page.getByRole("heading", { name: "Góc chơi của bé" }),
    ).toBeVisible();
    await page
      .locator("article")
      .filter({
        has: page.getByRole("heading", { name: "Chọn hình cùng Mây" }),
      })
      .getByRole("link", { name: "Cùng bé chơi" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "🔴 Màu đỏ", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("dialog")
          .getByRole("img", { name: "Hình cho câu hỏi" })
          .evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Nghe hướng dẫn", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .getByRole("dialog")
          .locator("audio")
          .first()
          .evaluate((el: HTMLAudioElement) => el.currentTime),
      )
      .toBeGreaterThan(0);
    const before = await get(page, `/family/children/${child}/games`);
    const attemptId = before.find(
      (g: { id: string }) => g.id === assignments.CHOICE,
    ).activeAttemptId;
    await page
      .getByRole("button", { name: "🟢 Màu xanh", exact: true })
      .click();
    await expect(
      page.getByText("Mình quan sát và thử lại nhé!", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "🔴 Màu đỏ", exact: true }),
    ).toBeVisible();
    expect(
      (await get(page, `/family/children/${child}/games`)).find(
        (g: { id: string }) => g.id === assignments.CHOICE,
      ).activeAttemptId,
    ).toBe(attemptId);
    let lost = false;
    await page.route("**/api/v1/game-attempts/*/moves", async (route) => {
      if (!lost) {
        lost = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole("button", { name: "🔴 Màu đỏ", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Thử lại", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await page.getByRole("button", { name: "🐱 Mèo", exact: true }).click();
    await page
      .getByRole("button", { name: "🍎🍎🍎 Ba quả táo", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Kết quả lượt chơi" })
        .getByLabel("2 sao"),
    ).toBeVisible();
    expect((await get(page, `/game-attempts/${attemptId}`)).moveCount).toBe(4);
    await page.unroute("**/api/v1/game-attempts/*/moves");
    await capture(page, "choice-completed-mobile");
    await page
      .getByRole("button", { name: "Về góc chơi", exact: true })
      .click();
    await page.goto(
      `/family/children/${child}/games/${assignments.MATCH}/play`,
    );
    for (const [left, right] of [
      ["🐰 Thỏ", "🥕 Cà rốt"],
      ["🐵 Khỉ", "🍌 Chuối"],
      ["🐱 Mèo", "🐟 Cá"],
    ]) {
      await page.getByRole("button", { name: left, exact: true }).click();
      await page.getByRole("button", { name: right, exact: true }).click();
    }
    await expect(
      page.getByRole("heading", { name: "Mình đã khám phá xong rồi!" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Về góc chơi", exact: true })
      .click();
    await page.goto(
      `/family/children/${child}/games/${assignments.MEMORY}/play`,
    );
    await expect(
      page.getByRole("button", { name: "Thẻ 1", exact: true }),
    ).toBeVisible();
    const memoryCards = page
      .getByRole("region", { name: "Bàn chơi", exact: true })
      .getByRole("button", { name: /^Thẻ \d+$/ });
    await expect(memoryCards).toHaveCount(8);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await memoryCards.evaluateAll((cards) =>
          cards.every((card) => {
            const box = card.getBoundingClientRect();
            return box.width >= 56 && box.height >= 56 && box.top >= 0 && box.bottom <= innerHeight;
          }),
        ),
      ).toBe(true);
      if (width === 320) await capture(page, "memory-320");
    }
    await capture(page, "memory-mobile");
    const positions = new Map<string, number[]>();
    for (let i = 0; i < 8; i++) {
      const card = page.getByRole("button", {
        name: new RegExp(`^Thẻ ${i + 1}(?:$|:)`),
      });
      const [flip] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/v1/game-attempts/") &&
            r.url().endsWith("/moves") &&
            r.request().method() === "POST",
        ),
        card.click(),
      ]);
      expect(flip.status()).toBe(200);
      // A lucky shuffled deck can finish during discovery; the board then leaves the DOM.
      if ((await flip.json()).data.status === "COMPLETED") break;
      await expect(card).toHaveAttribute("aria-label", /: /);
      const label = (await card.getAttribute("aria-label"))!
        .split(": ")[1]
        .replace(" đã ghép", "");
      positions.set(label, [...(positions.get(label) || []), i + 1]);
      if (
        i % 2 === 1 &&
        !((await card.getAttribute("aria-label")) || "").includes("đã ghép")
      )
        await expect(card).toBeEnabled();
    }
    for (const pair of positions.values()) {
      if (
        await page
          .getByRole("heading", { name: "Mình đã khám phá xong rồi!" })
          .isVisible()
      )
        break;
      const first = page.getByRole("button", {
        name: new RegExp(`^Thẻ ${pair[0]}(?:$|:)`),
      });
      if (((await first.getAttribute("aria-label")) || "").includes("đã ghép"))
        continue;
      await first.click();
      await page
        .getByRole("button", { name: new RegExp(`^Thẻ ${pair[1]}(?:$|:)`) })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: "Mình đã khám phá xong rồi!" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Về góc chơi", exact: true })
      .click();
    await expect(
      page.getByText("Nhà khám phá nhỏ", { exact: true }),
    ).toBeVisible();
    const history = page.getByRole("list", {
      name: "Lịch sử lượt chơi hoàn thành",
      exact: true,
    });
    await expect(history.getByRole("listitem")).toHaveCount(3);
    await expect(history.getByLabel(/^[0-3] sao$/)).toHaveCount(3);
    await expect(page.getByText("3 trò chơi được giao", { exact: true })).toHaveCount(1);
    await expect(page.getByText("3 kết quả", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await history.evaluate((list) => {
        const bounds = list.getBoundingClientRect();
        return list.scrollWidth <= list.clientWidth + 1 &&
          Array.from(list.querySelectorAll<HTMLElement>("[aria-label$=' sao']")).every((score) => {
            const box = score.getBoundingClientRect();
            return box.left >= bounds.left && box.right <= bounds.right;
          });
      }),
    ).toBe(true);
    await capture(page, "collection-320");
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, "collection-mobile");

    // A child can return to the board without seeing the parent's history or settings.
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto(`/family/children/${child}/kids`);
    await page.getByRole("link", { name: "Chơi", exact: true }).click();
    await expect(page).toHaveURL(/\/games\?kid=1$/);
    await expect(page.getByRole("list", { name: "Lịch sử lượt chơi hoàn thành" })).toHaveCount(0);
    await expect(page.getByLabel(/menu tài khoản/i)).toHaveCount(0);
    await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Nhớ những loại quả", exact: true }) })
      .getByRole("link", { name: "Chơi lại", exact: true }).click();
    await expect(page).toHaveURL(/\/play\?kid=1$/);
    const firstCard = page.getByRole("button", { name: "Thẻ 1", exact: true });
    await expect(firstCard).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Nhớ những loại quả", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstCard).toBeVisible();
    await expect(page.getByText("Lật một thẻ.", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/child-memory-320.png" });
    await firstCard.click();
    await expect(page.getByText("Lật thêm một thẻ.", { exact: true })).toBeVisible();
    await page.getByText("Cần giúp?", { exact: true }).click();
    const restart = page.getByRole("button", { name: "Bắt đầu lại", exact: true });
    const confirmRestart = page.getByRole("dialog", { name: "Bắt đầu lại?" });
    await restart.click();
    await expect(confirmRestart.getByRole("button", { name: "Chơi tiếp" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(restart).toBeFocused();
    await expect(page.getByText("Lật thêm một thẻ.", { exact: true })).toBeVisible();
    await restart.click();
    await confirmRestart.getByRole("button", { name: "Bắt đầu lại" }).click();
    await expect(confirmRestart).toHaveCount(0);
    await expect(firstCard).toBeEnabled();
    await expect(page.getByText("Lật một thẻ.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Rời góc chơi", exact: true }).click();
    await expect(page).toHaveURL(/\/games\?kid=1$/);
    await page.getByRole("link", { name: "Về góc của bé", exact: true }).click();
    await expect(page).toHaveURL(/\/kids$/);
    expect(errors).toEqual([]);
  });
  test("trò chơi: cô xem kết quả, rời lớp chặn chơi và quay lại cần cấp quyền rõ ràng", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    await login(page);
    await page.goto(`/teacher/game-assignments/${assignments.CHOICE}`);
    const row = page
      .getByRole("row")
      .filter({ hasText: "Bé Mây (góc chơi demo)" });
    await expect(row.getByLabel("2 sao")).toBeVisible();
    await row.getByRole("button", { name: "Xem lượt" }).click();
    await expect(
      page.getByRole("dialog").getByText("Đã hoàn thành", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Đóng" })
      .click();
    await capture(page, "teacher-results-desktop");
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.goto(
        `/family/children/${child}/games/${assignments.CHOICE}/play`,
      );
      await expect(
        parent.getByRole("button", { name: "🔴 Màu đỏ", exact: true }),
      ).toBeVisible();
      let r = await write(
        page.request,
        `/enrollments/${enrollment}`,
        { version: 0, status: "WITHDRAWN", reason: "Gia đình nghỉ tạm" },
        "PATCH",
      );
      expect(r.status()).toBe(200);
      await parent
        .getByRole("button", { name: "🔴 Màu đỏ", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Trò chơi hiện chưa thể mở" }),
      ).toBeVisible();
      await expect(
        parent.getByRole("region", { name: "Bàn chơi" }),
      ).toHaveCount(0);
      await parent
        .getByRole("button", { name: "Về góc chơi", exact: true })
        .click();
      await expect(
        parent.getByText("Nhà khám phá nhỏ", { exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByRole("link", { name: "Cùng bé chơi" }),
      ).toHaveCount(0);
      r = await write(
        page.request,
        `/enrollments/${enrollment}`,
        { version: 1, status: "ACTIVE", reason: "Gia đình quay lại" },
        "PATCH",
      );
      expect(r.status()).toBe(200);
      await parent.reload();
      await expect(
        parent.getByRole("link", { name: "Cùng bé chơi" }),
      ).toHaveCount(0);
      await page.goto(`/teacher/game-assignments/${assignments.CHOICE}`);
      await page.getByRole("button", { name: "Thêm/cấp lại quyền" }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Bé Mây (góc chơi demo)", { exact: true })
        .check();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do cấp quyền")
        .fill("Cô cho bé tiếp tục");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cấp quyền cho bé đã chọn" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await parent.reload();
      await expect(
        parent.getByRole("link", { name: "Chơi tiếp", exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
