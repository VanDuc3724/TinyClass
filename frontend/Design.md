# TinyClass — Quy chuẩn thiết kế giao diện

Phiên bản: **1.1** · Ngày cập nhật: **02/11/2026**
Áp dụng cho: **frontend React + TypeScript + Vite**.  
Tham chiếu nghiệp vụ: [Đặc tả hệ thống TinyClass](../doc/01-mo-ta-he-thong.md).

Tài liệu này quy định phong cách, bố cục, thành phần và hành vi giao diện TinyClass. Bộ token và khung giao diện đã được áp dụng vào các module hiện có ngày 02/11/2026; những mục thuộc module tương lai vẫn là thiết kế đích. Xem [phạm vi và bằng chứng áp dụng](../doc/verification/2026-11-02-design.md). Cấu trúc thư mục bên dưới là hướng tổ chức, không yêu cầu tạo các module nghiệp vụ chưa triển khai.

## 1. Định hướng từ ảnh tham chiếu

Ảnh dashboard giáo viên do người dùng cung cấp là tham chiếu thị giác chính. Giao diện cần tạo cảm giác thân thiện với lớp học mầm non, nhẹ nhàng và dễ thao tác trong công việc hằng ngày.

| Đặc điểm trong ảnh | Quy ước cho TinyClass |
|---|---|
| Sidebar tím đậm, chữ và icon trắng | Dùng tím làm màu nhận diện và điều hướng chính. |
| Nền gần trắng, nhiều khoảng trống | Nội dung thoáng; nhóm dữ liệu vào các thẻ trắng. |
| Thẻ bo góc, viền mảnh, bóng nhẹ | Dùng một bộ bán kính và bóng đổ thống nhất. |
| Các ô icon tím, xanh lá, hồng, xanh dương nhạt | Dùng màu pastel cho nền; chữ/icon có sắc độ đậm dễ đọc. |
| Lời chào lớn, số liệu nổi bật | Ưu tiên lịch hôm nay, việc chờ xử lý và thao tác thường dùng. |
| Ảnh hoạt động, avatar tròn, minh họa voi | Dùng hình học tập gần gũi; minh họa trang trí ở vị trí phụ. |
| Sidebar và hàng điểm danh theo lớp | Giữ cách tổ chức; bổ sung chọn lớp/buổi vì TinyClass quản lý nhiều lớp. |

Tên hiển thị luôn là **TinyClass**. Nội dung giao diện mặc định bằng **tiếng Việt**. Nhãn “Lớp học”, “Chủ đề”, “Khóa học”, “Bài học”, “Buổi học” phải theo đúng định nghĩa trong đặc tả.

Các mục “Messages”, “Photos”, “Reports” trong ảnh chỉ gợi ý cách trình bày. Điều hướng thực tế theo nghiệp vụ TinyClass; ảnh nằm trong học liệu, sản phẩm hoặc thông báo có liên quan. Phạm vi hiện tại chưa có module chat riêng.

## 2. Bộ biến thiết kế

Các mã màu và kích thước là giá trị thiết kế được chọn gần với ảnh tham chiếu, không phải kết quả lấy mẫu màu chính xác từ ảnh. Dùng biến có ý nghĩa thay cho việc khai báo mã màu riêng ở từng màn hình.

### 2.1. Màu sắc, kích thước và hiệu ứng

Mẫu cho `src/styles/tokens.css` khi triển khai:

```css
:root {
  color-scheme: light;

  --tc-font: 'Nunito', 'Segoe UI', Arial, sans-serif;

  --tc-primary: #5926cf;
  --tc-primary-hover: #4c1db5;
  --tc-primary-soft: #f2ecff;
  --tc-sidebar-start: #5826d2;
  --tc-sidebar-end: #4820bd;
  --tc-sidebar-active: rgb(255 255 255 / 20%);
  --tc-on-primary: #ffffff;

  --tc-accent: #c72570;
  --tc-accent-soft: #fff1f7;
  --tc-success: #137a5a;
  --tc-success-soft: #eaf8f1;
  --tc-info: #1c66bf;
  --tc-info-soft: #eef4ff;
  --tc-warning: #986100;
  --tc-warning-soft: #fff6de;
  --tc-danger: #c43755;
  --tc-danger-soft: #fff0f3;

  --tc-canvas: #fcfcfe;
  --tc-surface: #ffffff;
  --tc-surface-muted: #f7f6fb;
  --tc-text: #1d1835;
  --tc-text-muted: #6d687d;
  --tc-border: #eeecf4;
  --tc-control-border: #8f899e;
  --tc-focus: #7c3aed;

  --tc-space-1: 4px;
  --tc-space-2: 8px;
  --tc-space-3: 12px;
  --tc-space-4: 16px;
  --tc-space-5: 20px;
  --tc-space-6: 24px;
  --tc-space-8: 32px;
  --tc-space-10: 40px;
  --tc-space-12: 48px;

  --tc-radius-sm: 8px;
  --tc-radius-md: 12px;
  --tc-radius-lg: 20px;
  --tc-radius-pill: 999px;

  --tc-shadow-card: 0 2px 10px rgb(29 24 53 / 6%);
  --tc-shadow-hover: 0 6px 18px rgb(29 24 53 / 10%);
  --tc-shadow-overlay: 0 16px 48px rgb(29 24 53 / 18%);

  --tc-sidebar-width: 264px;
  --tc-topbar-height: 80px;
  --tc-content-max: 1440px;
  --tc-control-height: 44px;
  --tc-bottom-nav-height: 72px;

  --tc-z-sticky: 10;
  --tc-z-popover: 20;
  --tc-z-backdrop: 30;
  --tc-z-drawer: 40;
  --tc-z-modal: 50;
  --tc-z-toast: 60;

  --tc-motion-fast: 150ms;
  --tc-motion-normal: 220ms;
  --tc-ease: cubic-bezier(0.2, 0, 0, 1);
}
```

| Vai trò | Màu chữ/icon | Màu nền | Ví dụ |
|---|---|---|---|
| Nhận diện và điều hướng | `--tc-primary` | `--tc-primary-soft` | Liên kết, mục đang chọn, icon lớp học. |
| Hoạt động và phản hồi | `--tc-accent` | `--tc-accent-soft` | Nhận xét mới, sản phẩm chờ xem. |
| Hoàn thành và có mặt | `--tc-success` | `--tc-success-soft` | Điểm danh, bài hoàn thành, khoản đã thu đủ. |
| Thông tin | `--tc-info` | `--tc-info-soft` | Lịch, video, bài đã mở, phiếu đã phát hành. |
| Cần chú ý | `--tc-warning` | `--tc-warning-soft` | Đi muộn, chờ xử lý, cần bổ sung, thu một phần. |
| Lỗi hoặc cần xử lý gấp | `--tc-danger` | `--tc-danger-soft` | Lỗi tải, nghỉ chưa báo, khoản quá hạn. |
| Trung tính | `--tc-text-muted` | `--tc-surface-muted` | Nháp, chưa đánh dấu, lưu trữ. |

Màu hồng là màu nhấn, không thay thế màu báo lỗi. Viền thẻ dùng `--tc-border`; ô nhập liệu và đường bao của điều khiển cần nhận diện dùng `--tc-control-border`.

### 2.2. Chữ, khoảng cách và hình ảnh

Font mục tiêu là **Nunito** với bộ ký tự tiếng Việt, trọng lượng 400, 600, 700 và 800. Khi bổ sung tài nguyên font, dùng WOFF2 lưu cùng ứng dụng và `font-display: swap`; trong thời gian chưa có font, dùng chuỗi dự phòng ở biến `--tc-font`.

| Kiểu chữ | Desktop | Điện thoại | Trọng lượng / chiều cao dòng |
|---|---|---|---|
| Tiêu đề trang | 32px | 24px | 800 / 1.3 |
| Tiêu đề khối | 20px | 18px | 700 / 1.4 |
| Tiêu đề thẻ | 18px | 18px | 700 / 1.4 |
| Nội dung, ô nhập | 16px | 16px | 400–600 / 1.6 |
| Nhãn, nội dung phụ | 14px | 14px | 600 / 1.5 |
| Badge và chú thích ngắn | 12px | 12px | 600 / 1.4 |
| Số liệu tổng quan | 36px | 30px | 800 / 1.2 |

- Dùng thang khoảng cách bội số 4px; khoảng cách giữa các khối là 24px, trên điện thoại là 16px.
- Thẻ có padding 24px ở desktop và 16px trên điện thoại. Form dài giới hạn khoảng 760px để dễ đọc.
- Số lượng và số tiền dùng `font-variant-numeric: tabular-nums` khi cần so sánh theo cột.
- Icon SVG cùng một phong cách nét bo tròn; kích thước chuẩn 20–24px, icon trong thẻ số liệu 28–32px. Icon điều hướng phải đi kèm nhãn.
- Avatar: 40px ở danh sách, 48px ở topbar, 64–80px trong hàng điểm danh. Ảnh thiếu dùng chữ cái đầu trên nền pastel.
- Thumbnail học liệu tỷ lệ 4:3, ảnh bìa video 16:9, avatar 1:1; dùng `object-fit: cover`, giữ đúng tỷ lệ khi tải.
- Minh họa voi đọc sách có thể đặt ở chân sidebar hoặc trạng thái rỗng, tối đa khoảng 160px. Đây là tài nguyên cần chuẩn bị, có thể ẩn khi chưa có hoặc khi màn hình thấp.
- Logo hiển thị TinyClass bằng chữ; có thể thêm biểu tượng học tập đơn giản. Ảnh trang trí có `alt=""`; ảnh có ý nghĩa có mô tả phù hợp.

## 3. Khung giao diện và responsive

### 3.1. Bố cục desktop

Mốc tham chiếu là ảnh 1536 × 1024: sidebar rộng khoảng 264px, vùng nội dung còn lại có lề ngang 32–48px. Trang dùng chiều cao tối thiểu bằng viewport, cuộn theo nội dung.

```text
┌───────────────────┬──────────────────────────────────────────────┐
│ TinyClass         │                      Chuông · Avatar · Tên  │
│ Góc giáo viên     ├──────────────────────────────────────────────┤
│                   │ Xin chào, cô Lan!           [Chọn lớp]       │
│ Tổng quan         │ Ngày hiện tại / ngữ cảnh đang xem            │
│ Lớp học           ├──────────┬──────────┬──────────┬──────────────┤
│ Học sinh          │ Học sinh │ Có mặt   │ Chờ xem  │ Buổi hôm nay │
│ Học liệu          ├──────────┴──────────┴────┬─────┴──────────────┤
│ Phản hồi          │ Hoạt động hôm nay       │ Thao tác nhanh     │
│ Lịch dạy          │ Nội dung + thumbnail    │ 4 hàng hành động   │
│ Học phí           ├─────────────────────────┴────────────────────┤
│                   │ Điểm danh · Chọn buổi · Avatar + trạng thái  │
│ Cài đặt           └──────────────────────────────────────────────┤
│ [Minh họa nhỏ]    │ Các khối bổ sung theo module đã triển khai   │
└───────────────────┴──────────────────────────────────────────────┘
```

- Sidebar cố định bên trái, cao `100dvh`; danh sách menu tự cuộn nếu thiếu chiều cao.
- Topbar nền trắng, cao 80px, chuông thông báo và menu tài khoản căn phải; có thể sticky.
- Nội dung căn trái; giới hạn 1440px, căn giữa trong vùng còn lại ở màn hình lớn.
- Trang có một H1, mô tả ngắn nếu cần và một thao tác chính. Bộ lọc có vị trí ổn định dưới tiêu đề.
- Sidebar có nhãn “Góc giáo viên” hoặc “Góc gia đình” dạng pill; mục đang chọn có nền trắng trong suốt và chữ đậm.

### 3.2. Quy tắc theo kích thước màn hình

| Kích thước viewport | Điều hướng | Nội dung |
|---|---|---|
| Từ 1200px | Sidebar 264px, topbar 80px | KPI 4 cột; khối giữa chia khoảng 60% / 40%; padding 32px, lên 48px từ 1536px. |
| 768–1199px | Nút menu mở drawer 264px, topbar 64px | KPI 2 cột; khối giữa xếp dọc; padding 24px. |
| Dưới 768px | Giáo viên dùng drawer; gia đình dùng thanh dưới | KPI 2 cột; các khối khác 1 cột; padding 16px, topbar 64px. |
| Dưới 360px | Giữ điều hướng như điện thoại | KPI 1 cột để nhãn tiếng Việt không bị chật. |

Mẫu CSS cho khung chung khi triển khai; `.tc-shell` chứa sidebar và `.tc-main`, trong đó `.tc-main` chứa topbar và `.tc-page`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-family: var(--tc-font);
  color: var(--tc-text);
  background: var(--tc-canvas);
  line-height: 1.6;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

img {
  display: block;
  max-width: 100%;
}

#root,
.tc-shell {
  min-height: 100dvh;
}

.tc-main {
  min-width: 0;
}

.tc-topbar {
  min-height: var(--tc-topbar-height);
  background: var(--tc-surface);
}

.tc-page {
  width: 100%;
  max-width: var(--tc-content-max);
  margin-inline: auto;
  padding: var(--tc-space-8);
}

.tc-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--tc-space-6);
}

.tc-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr);
  gap: var(--tc-space-6);
}

.tc-card {
  min-width: 0;
  padding: var(--tc-space-6);
  background: var(--tc-surface);
  border: 1px solid var(--tc-border);
  border-radius: var(--tc-radius-lg);
  box-shadow: var(--tc-shadow-card);
}

.tc-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: var(--tc-z-sticky);
  width: var(--tc-sidebar-width);
  height: 100dvh;
  overflow-y: auto;
  color: var(--tc-on-primary);
  background: linear-gradient(
    180deg,
    var(--tc-sidebar-start),
    var(--tc-sidebar-end)
  );
}

:focus-visible {
  outline: 3px solid var(--tc-focus);
  outline-offset: 3px;
}

.tc-sidebar :focus-visible {
  outline-color: var(--tc-on-primary);
}

@media (min-width: 1200px) {
  .tc-main {
    margin-left: var(--tc-sidebar-width);
  }
}

@media (min-width: 1536px) {
  .tc-page {
    padding-inline: var(--tc-space-12);
  }
}

@media (max-width: 1199px) {
  :root {
    --tc-topbar-height: 64px;
  }

  .tc-sidebar {
    display: none;
  }

  .tc-page {
    padding: var(--tc-space-6);
  }

  .tc-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tc-dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .tc-page,
  .tc-card {
    padding: var(--tc-space-4);
  }

  .tc-kpi-grid,
  .tc-dashboard-grid {
    gap: var(--tc-space-4);
  }

  .tc-shell--family .tc-page {
    padding-bottom: calc(
      var(--tc-bottom-nav-height) + env(safe-area-inset-bottom) + 16px
    );
  }
}

@media (max-width: 359px) {
  .tc-kpi-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tc-shell *,
  .tc-shell *::before,
  .tc-shell *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Drawer trên tablet/điện thoại là thành phần overlay riêng, dùng cùng dữ liệu menu; CSS trên chỉ ẩn sidebar desktop. Drawer có backdrop, khóa cuộn nền, giữ focus bên trong, đóng bằng Escape/nút đóng và trả focus về nút mở. Khi chuyển sang desktop phải đóng drawer và giải phóng khóa cuộn. Trang không cuộn ngang toàn bộ; bảng hoặc hàng avatar có vùng cuộn riêng khi cần.

## 4. Điều hướng theo vai trò

Các đường dẫn dưới đây là đích thiết kế theo đặc tả, chưa khẳng định router đã được triển khai. Chỉ hiển thị mục có module hoạt động và người dùng có quyền truy cập.

### 4.1. Giáo viên

| Vị trí | Nhãn | Đích / nội dung |
|---|---|---|
| Chính | Tổng quan | `/teacher` — dashboard. |
| Chính | Lớp học | `/teacher/classes` — danh sách và chi tiết lớp. |
| Chính | Học sinh | `/teacher/students` — hồ sơ dùng chung giữa các lớp. |
| Chính | Học liệu | `/teacher/library` — bài học, khóa học, chủ đề. |
| Chính | Phản hồi | `/teacher/reviews` — sản phẩm cần xem và các lượt nhận xét; badge là số đang chờ. |
| P1 | Lịch dạy | `/teacher/calendar` — lịch và lối vào điểm danh từng buổi. |
| P1 | Học phí | `/teacher/billing` — thỏa thuận, phiếu và khoản thu. |
| Cuối menu | Cài đặt | `/teacher/settings` — hồ sơ, tài khoản, kho lưu trữ. |
| Topbar | Thông báo | Panel thông báo theo nghiệp vụ đã triển khai. |

Menu đang chọn phải đúng cả khi ở trang con; riêng `/teacher` chỉ active tại dashboard. Dùng `aria-current="page"`. Badge đếm hiển thị tối đa `99+`, có tên truy cập chứa số thực tế; ẩn badge khi bằng 0. Menu tài khoản gồm hồ sơ, phương thức đăng nhập và đăng xuất.

### 4.2. Phụ huynh

- Luôn có bộ chọn bé khi liên kết nhiều con; các trang học tập, tiến độ, lịch và học phí thể hiện rõ bé đang được xem.
- Desktop dùng sidebar cùng phong cách, gồm Trang chủ, Bài của con, Tiến độ, Lịch học, Học phí và Tài khoản khi module tương ứng hoạt động.
- Điện thoại dùng thanh điều hướng dưới cao 72px cộng safe area: **Trang chủ · Bài của con · Lịch học · Tài khoản**. Nếu chưa có lịch, bỏ mục này và phân bố đều các mục còn lại.
- Tiến độ và học phí có lối vào rõ ràng từ hồ sơ bé/trang chủ. Thanh dưới không che nút gửi sản phẩm hay nội dung cuối trang.
- Chuyển bé phải thay đúng dữ liệu và cache theo `studentId`; màn hình đang tải phải cho biết đang chuyển sang bé nào.

## 5. Dashboard giáo viên theo ảnh

### 5.1. Lời chào và ngữ cảnh

Tiêu đề mẫu: **“Xin chào, cô Lan!”**, lấy tên từ hồ sơ. Bên dưới có ngày hiện tại và bộ chọn **Tất cả lớp / một lớp cụ thể**. Chỉ số phải thể hiện rõ đang tính toàn hệ thống hay theo lớp được chọn. Tên và số liệu trong tài liệu là dữ liệu minh họa.

### 5.2. Hàng số liệu

| Thẻ | Màu | Số chính | Quy tắc dữ liệu |
|---|---|---|---|
| Học sinh | Tím | `28` | Số bé đang học theo phạm vi chọn; đếm bé duy nhất khi một bé tham gia nhiều lớp. |
| Điểm danh hôm nay | Xanh lá | `25/28` | Có mặt + đi muộn trên danh sách của **buổi đang chọn**; chú thích tên lớp/giờ và `89% có mặt`. |
| Sản phẩm chờ xem | Hồng | `3` | Sản phẩm đã gửi, đang chờ giáo viên nhận xét; nhấn để mở danh sách đã lọc. |
| Buổi học hôm nay | Xanh dương | `2` | Buổi có lịch hoặc đã diễn ra trong ngày tại múi giờ nghiệp vụ; loại buổi đã hủy. |

- Thẻ desktop cao tối thiểu khoảng 144px; ô icon khoảng 64px, số lớn và chú thích nhỏ. Trên điện thoại xếp icon phía trên, cho nhãn xuống dòng tự nhiên.
- Tỷ lệ là `round((PRESENT + LATE) / tổng danh sách buổi × 100)`; số `25/28` làm tròn thành `89%`. Hiện chỉ gồm thành viên cùng lớp còn hiệu lực; học bù tạm hoãn.
- Khi chưa có buổi được chọn, thẻ điểm danh ghi “Chọn buổi học”; chưa có buổi hôm nay thì ghi “Hôm nay chưa có lịch”. Không thay giá trị chưa biết bằng `0/0` hoặc trạng thái nghỉ.
- Dashboard hiện dùng “Bé có mặt hôm nay” từ điểm danh thật: DISTINCT bé PRESENT/LATE trong buổi còn hiệu lực của ngày Việt Nam và phạm vi lớp. “Buổi học hôm nay” gồm SCHEDULED/COMPLETED, bỏ CANCELLED. Không hiển thị số giả để lấp chỗ trống.
- Thẻ chỉ có hiệu ứng hover/cursor tương tác khi có đích điều hướng thực tế.

### 5.3. Hoạt động hôm nay và thao tác nhanh

Khối trái chiếm khoảng 60% chiều rộng, tiêu đề **Hoạt động hôm nay** và liên kết **Xem tất cả**. Hiển thị buổi gần nhất nếu có module lịch; bên dưới là bài mới xuất bản hoặc phản hồi gần đây. Mỗi mục có tiêu đề, lớp/bé liên quan, thời gian và lối vào chi tiết. Có thể dùng hàng ba thumbnail như ảnh tham chiếu khi có đủ nội dung; thiếu ảnh dùng placeholder nhẹ, thiếu dữ liệu dùng trạng thái rỗng.

Khối phải có tiêu đề **Thao tác nhanh**, gồm các hàng cao tối thiểu 56px, icon trái, chữ ở giữa, chevron bên phải:

| Hành động | Tông màu | Kết quả |
|---|---|---|
| Tạo bài học | Tím nhạt | Vào luồng tạo bài mới. |
| Thêm học liệu | Hồng nhạt | Vào thư viện/biên tập bài và chọn tệp cần tải. |
| Giao bài cho lớp | Xanh dương nhạt | Chọn bài/khóa đã xuất bản và người nhận. |
| Điểm danh | Xanh lá nhạt | Chọn buổi, sau đó mở danh sách điểm danh; chỉ hiện khi P1 hoạt động. |

Không tự gửi thông báo, giao bài hoặc ghi điểm danh khi người dùng chỉ mở một thao tác nhanh.

### 5.4. Hàng điểm danh

- Khối rộng toàn hàng, gồm tiêu đề **Điểm danh lớp**, bộ chọn lớp/buổi và liên kết **Mở điểm danh**.
- Mỗi bé có avatar tròn, tên, badge trạng thái; tên dài tối đa hai dòng và có cách xem tên đầy đủ.
- Desktop hiển thị khoảng 6–8 bé mỗi hàng; điện thoại cuộn ngang có khoảng hở gợi ý còn nội dung. Có nút trước/sau dùng được bằng bàn phím khi cần.
- Hàng avatar trên dashboard dùng để xem nhanh. Việc ghi/sửa thực hiện tại trang điểm danh với điều khiển có nhãn rõ ràng.
- Dùng đủ năm trạng thái ở mục 7; các bé chưa ghi nhận hiển thị “Chưa đánh dấu”. Trạng thái rỗng có nút chọn hoặc tạo buổi theo quyền.

## 6. Thành phần giao diện dùng chung

| Thành phần | Hình thức | Hành vi bắt buộc |
|---|---|---|
| `Button` | Cao tối thiểu 44px; bo 12px; cỡ lớn 48px | Primary tím/chữ trắng; secondary nền tím nhạt; ghost nền trong; danger đỏ. Có trạng thái đang xử lý và disabled. |
| `IconButton` | Vùng nhấn tối thiểu 44 × 44px | Tên truy cập rõ ràng; tooltip bổ sung khi phù hợp; tooltip không thay nhãn. |
| `Card` | Nền trắng, bo 20px, viền nhẹ, bóng nhỏ | Header icon + tiêu đề + hành động; phần thân canh trái. Thẻ tĩnh không có hiệu ứng như nút. |
| `StatCard` | Icon pastel + nhãn + số + chú thích | Hỗ trợ skeleton, trạng thái chưa có dữ liệu và liên kết tới danh sách đã lọc. |
| `Badge` | Dạng pill, chữ 12–14px, padding 4px 12px | Luôn có chữ; ý nghĩa không phụ thuộc riêng vào màu. |
| `Avatar` | Hình tròn, viền nhẹ tùy ngữ cảnh | Có fallback chữ cái; không lặp nội dung đọc nếu tên đã nằm cạnh ảnh. |
| `Input`, `Select`, `DateField` | Cao tối thiểu 44px, chữ 16px, bo 12px | Nhãn nằm phía trên; mô tả và lỗi nằm dưới; trường bắt buộc có dấu hiệu bằng chữ hoặc ký hiệu được giải thích. |
| `Textarea` | Tối thiểu 120px, cho tăng chiều cao | Giữ nội dung khi lưu/gửi lỗi; hiển thị giới hạn nếu nghiệp vụ có giới hạn. |
| `SearchFilterBar` | Tìm kiếm + bộ lọc + số kết quả | Điện thoại có nút mở bộ lọc; có “Xóa bộ lọc”; giữ tiêu chí khi quay lại từ chi tiết. |
| `Tabs` | Nhãn rõ, active tím và gạch/chỉ dấu | Có trạng thái chọn, hỗ trợ bàn phím; không tràn mất tab trên điện thoại. |
| `DataTable` | Header nền rất nhạt; hàng tối thiểu 56px | Sắp xếp có chỉ dấu, phân trang khi cần; trên điện thoại ưu tiên dạng thẻ, bảng tài chính có vùng cuộn ngang riêng. |
| `Modal`, `Drawer` | Bo 20px; nền phủ trung tính; rộng modal thường khoảng 480–640px | Tiêu đề, mô tả, hành động chính rõ ràng; quản lý focus, Escape, trả focus và chống đóng làm mất nội dung chưa lưu. |
| `Toast`, `InlineAlert` | Icon + nội dung + nút đóng/thử lại nếu có | Toast cho phản hồi ngắn; lỗi cần xử lý hiện tại vị trí liên quan. Thông tin thiết yếu tồn tại đến khi xử lý hoặc đóng. |
| `EmptyState` | Minh họa nhỏ/icon, tiêu đề, một câu hướng dẫn | Một hành động phù hợp với vai trò, ví dụ “Tạo lớp đầu tiên”. |
| `UploadField` | Khung viền nét đứt, chọn tệp, kéo thả trên desktop | Chọn tệp dùng được trên điện thoại; hiện tên, dung lượng, tiến độ và lỗi riêng từng tệp. |

`hover` thay đổi nhẹ nền/viền hoặc bóng; `active` dùng sắc đậm hơn; `focus-visible` luôn rõ. Chuyển trạng thái dùng 150–220ms và chỉ tác động thuộc tính cần thiết. Nút disabled không phải cách duy nhất giải thích vì sao thao tác chưa thực hiện được.

## 7. Nhãn trạng thái nghiệp vụ

Giữ nguyên enum từ backend; chuyển sang nhãn tiếng Việt tại một nơi dùng chung. Cùng enum ở các đối tượng khác nhau cần ánh xạ theo ngữ cảnh, ví dụ `COMPLETED` của lớp khác với của bài học.

| Nhóm | Enum | Nhãn hiển thị | Tông |
|---|---|---|---|
| Điểm danh | `UNMARKED` | Chưa đánh dấu | Trung tính |
| Điểm danh | `PRESENT` | Có mặt | Thành công |
| Điểm danh | `LATE` | Đi muộn | Chú ý |
| Điểm danh | `ABSENT_EXCUSED` | Nghỉ có phép | Thông tin |
| Điểm danh | `ABSENT_UNEXCUSED` | Nghỉ chưa báo | Nguy hiểm |
| Bài/khóa | `DRAFT` / `PUBLISHED` / `ARCHIVED` | Bản nháp / Đã xuất bản / Đã lưu trữ | Trung tính / Thành công / Trung tính |
| Lớp | `DRAFT` / `ACTIVE` / `COMPLETED` / `ARCHIVED` | Chuẩn bị / Đang dạy / Đã kết thúc / Đã lưu trữ | Trung tính / Thành công / Thông tin / Trung tính |
| Tiến độ bài | `NOT_STARTED` / `OPENED` | Chưa bắt đầu / Đã mở bài | Trung tính / Thông tin |
| Tiến độ bài | `SUBMITTED` / `NEEDS_REVISION` / `COMPLETED` | Đã gửi, chờ cô xem / Cần bổ sung / Đã hoàn thành | Chú ý / Chú ý / Thành công |
| Sản phẩm | `DRAFT` / `SUBMITTED` / `ACCEPTED` / `CHANGES_REQUESTED` | Bản nháp / Chờ nhận xét / Đã chấp nhận / Cần bổ sung | Trung tính / Chú ý / Thành công / Chú ý |
| Buổi học | `SCHEDULED` / `COMPLETED` / `CANCELLED` | Đã lên lịch / Đã diễn ra / Đã hủy | Thông tin / Thành công / Trung tính |
| Phiếu học phí | `DRAFT` / `ISSUED` / `CANCELLED` | Bản nháp / Đã phát hành / Đã hủy | Trung tính / Thông tin / Trung tính |
| Thanh toán | `UNPAID` / `PARTIAL` / `PAID` | Chưa thu / Đã thu một phần / Đã thu đủ | Chú ý / Chú ý / Thành công |
| Tệp | `PENDING` / `READY` / `REJECTED` / `DELETED` | Đang xử lý / Sẵn sàng / Tệp không hợp lệ / Đã xóa | Thông tin / Thành công / Nguy hiểm / Trung tính |
| Kho lưu | `ACTIVE` / `REAUTH_REQUIRED` / `DISCONNECTED` | Đã kết nối / Cần kết nối lại / Chưa kết nối | Thành công / Chú ý / Trung tính |

“Quá hạn” là chỉ dấu bổ sung khi phiếu đã phát hành, còn số cần thu và đã qua hạn; không thay thế trạng thái thanh toán. Tỷ lệ hoàn thành do quy tắc của lần giao quyết định; việc mở video hoặc gửi sản phẩm chờ duyệt chưa tự đồng nghĩa với hoàn thành.

## 8. Mẫu giao diện cho các màn hình chính

### 8.1. Lớp học, học sinh và gia đình

- Danh sách lớp dùng lưới thẻ: tên, trạng thái, sĩ số, buổi kế tiếp khi có lịch; có tìm kiếm và nút **Tạo lớp**. Danh sách học sinh dùng bảng desktop/thẻ điện thoại, có avatar, tên và lớp đang học.
- Chi tiết lớp có header tên lớp và tab: **Tổng quan · Học sinh · Nội dung đã giao · Lịch học · Điểm danh · Nhận xét · Học phí**. Các tab P1 chỉ hiện khi module tương ứng hoạt động.
- Hồ sơ bé ưu tiên thông tin cơ bản, lớp, người giám hộ và dòng thời gian tiến bộ; email/số liên hệ của gia đình chỉ ở nơi giáo viên có quyền xem.
- Mời phụ huynh hiển thị rõ tên bé, email nhận và trạng thái lời mời. Thu hồi liên kết hoặc cho bé rút lớp phải nêu rõ phạm vi quyền bị ngừng.
- Ghi chú riêng có nhãn **Chỉ cô xem**; nhận xét chia sẻ có nhãn **Chia sẻ với gia đình**. Hai loại nội dung phải có điều khiển và dữ liệu tách biệt.

### 8.2. Học liệu, khóa học và giao bài

- Thư viện có nhóm/tab **Bài học · Khóa học · Chủ đề**, bộ lọc chủ đề và trạng thái. Thẻ học liệu có ảnh bìa, loại nội dung, tiêu đề, chủ đề và trạng thái.
- Trình biên tập ưu tiên vùng nội dung rộng; thanh cấu hình nằm cạnh ở desktop và xếp dưới trên điện thoại. Các khối video, ảnh, âm thanh, tài liệu có nút di chuyển lên/xuống bên cạnh kéo thả.
- Các nút **Lưu nháp · Xem trước · Xuất bản** có tên riêng. Xuất bản không tự giao bài cho lớp. Hiển thị trạng thái lưu thực tế; chỉ ghi “Đã lưu” sau khi lưu thành công.
- Tệp tải lên có lựa chọn **Máy chủ hệ thống / Google Drive của cô**, lấy kho mặc định từ cài đặt và cờ **Cho phép tải xuống** riêng từng tệp.
- Tiến độ upload là dữ liệu thật; khi máy chủ đang xử lý tệp, đổi nhãn sang **Đang xử lý**. Cho thử lại từng tệp mà không mất phần chữ đã nhập.
- Drive cần cấp quyền lại thì hiện cảnh báo ngay tại vùng tải lên, có lối vào kết nối lại. Kho còn hoạt động có thể được chọn cho lần tải mới; việc đổi kho không tự di chuyển tệp cũ.
- Tạo khóa gồm tên, mô tả, danh sách bài và thứ tự. Giao bài gồm nội dung, lớp/bé nhận, giờ mở và cách hoàn thành; màn hình xem lại phải nêu số người nhận trước khi phát hành.
- Nhãn cách hoàn thành: **Chỉ tham khảo · Gia đình xác nhận · Cô duyệt sản phẩm**. Cách tính tiến độ giữ đúng đặc tả, kể cả khi cùng bài gốc được giao nhiều lần.

### 8.3. Phản hồi, lịch và điểm danh

- Trang phản hồi có bộ lọc lớp/bé/bài, danh sách chờ bên trái và nội dung sản phẩm bên phải trên desktop; điện thoại đi từ danh sách vào chi tiết. Hiện từng lượt gửi và nhận xét, không ghi đè mất lịch sử.
- Hành động chính là **Chấp nhận sản phẩm** hoặc **Yêu cầu bổ sung**; nhập nhận xét ở vùng gắn trực tiếp với sản phẩm đang xem.
- Lịch desktop có tuần/tháng; điện thoại mặc định danh sách theo ngày. Buổi học có giờ, lớp và trạng thái; nhấn mở chi tiết.
- Sửa lịch lặp phải phân biệt **Chỉ buổi này** và **Các buổi tương lai**. Hủy buổi nêu lý do và ảnh hưởng trước khi xác nhận.
- Điểm danh chọn đúng buổi, hiển thị đủ năm trạng thái và bé học bù. Thao tác **Đánh dấu tất cả có mặt** chỉ điền các dòng đang `UNMARKED`; có bước lưu rõ ràng.
- Khi lưu lỗi, giữ các lựa chọn tại màn hình và báo các dòng chưa lưu. Sửa đồng thời phải cho biết có dữ liệu mới và hướng dẫn tải lại, không im lặng ghi đè.

### 8.4. Học phí

- Tách nhãn **Cách tính: Theo buổi / Cố định theo tháng / Trọn đợt, khóa** và **Thời điểm thu** thành hai lựa chọn riêng.
- Bảng phiếu gồm bé, lớp, kỳ, tổng tiền, đã thu, còn lại, hạn thu và trạng thái. Chi tiết có các dòng tính, điều chỉnh và lịch sử khoản thu.
- Dùng **Xem trước phiếu · Phát hành phiếu · Ghi nhận thanh toán**; số tiền và phạm vi ảnh hưởng phải xuất hiện trước bước xác nhận.
- Trạng thái đã thu đủ/một phần lấy từ số tiền thực tế. Điểm danh chỉ gợi ý số buổi; không tự phát hành phiếu hoặc sửa khoản đã công bố.
- Phụ huynh xem khoản của con; luồng hiện tại chưa có thao tác thanh toán trực tuyến hoặc tự xác nhận đã thu.

### 8.5. Tài khoản và cài đặt

- Trang đăng nhập nền tím rất nhạt, form trắng bo góc ở giữa, logo TinyClass phía trên; desktop có thể thêm minh họa ở cạnh. Form gồm email, mật khẩu, hiện/ẩn mật khẩu, quên mật khẩu và nút **Tiếp tục với Google**.
- Đăng ký phụ huynh qua lời mời; hiển thị lời mời còn hiệu lực, chờ xác minh hoặc hết hạn bằng thông điệp và hành động tiếp theo rõ ràng. Luồng này không có chọn vai trò giáo viên.
- Cài đặt phân nhóm **Hồ sơ · Phương thức đăng nhập · Lưu trữ**. Nhóm lưu trữ chỉ giáo viên truy cập; liệt kê kho mặc định và trạng thái Drive.
- **Liên kết Google để đăng nhập** và **Kết nối Google Drive để lưu tệp** là hai hành động có mô tả riêng. Không thể hiện rằng đăng nhập Google đã tự kết nối kho lưu.

## 9. Giao diện gia đình và góc học của bé

### 9.1. Gia đình

Trang `/family` ưu tiên tên/ảnh bé đang chọn, bài mới, nút tiếp tục học, buổi sắp tới và phản hồi của cô. Bài học dạng thẻ có ảnh bìa lớn, tên, lớp nguồn, tiến độ và trạng thái; các con số phải thuộc đúng bé và đúng lần giao.

Trong trang bài học, thứ tự là **Tiêu đề → Hướng dẫn → Nội dung xem/nghe → Việc cần làm → Gửi sản phẩm hoặc xác nhận**. Nút tải chỉ hiển thị khi có quyền xem và tệp cho phép tải. Tệp chỉ xem vẫn có trình xem phù hợp.

Khi bài bị thu hồi hoặc bé đã rời lớp, thay nội dung bằng thông báo hết quyền và lối về danh sách còn truy cập được. Lịch sử sản phẩm/nhận xét riêng của bé hiển thị theo chính sách nghiệp vụ; việc đã đóng học phí không tự cấp lại quyền bài học.

### 9.2. Góc học của bé

- Dùng cùng màu nhận diện, tăng kích thước nút lên tối thiểu 56px; nhãn ngắn như **Xem bài · Nghe · Làm cùng con**.
- Giảm điều hướng, ưu tiên nội dung và một hành động tiếp theo. Ẩn menu quản lý, liên hệ gia đình và học phí khỏi chế độ này.
- Video/âm thanh bắt đầu bằng thao tác rõ ràng; không tự phát có âm thanh. Giữ điều khiển phát/dừng và hỗ trợ phụ đề khi có.
- Có nút **Về góc gia đình** dễ tìm. Đây là chế độ trong tài khoản phụ huynh, không phải tài khoản hoặc vai trò mới; chưa thêm PIN khi chưa có yêu cầu.

## 10. Trạng thái dữ liệu, tương tác và nội dung

| Tình huống | Cách hiển thị |
|---|---|
| Đang tải lần đầu | Skeleton theo hình dạng thẻ/bảng; vùng dữ liệu có `aria-busy`. |
| Làm mới nền | Giữ dữ liệu hiện có, có chỉ báo cập nhật nhẹ; không nhấp nháy toàn màn hình. |
| Chưa có dữ liệu | Thông điệp đúng ngữ cảnh và một hành động, ví dụ “Chưa có lớp học — Tạo lớp đầu tiên”. |
| Lọc không có kết quả | Hiện tiêu chí đang áp dụng và nút “Xóa bộ lọc”. |
| Tải danh sách lỗi | Thông báo ngay trong khối và nút “Thử lại”; phân biệt với danh sách rỗng. |
| Form không hợp lệ | Lỗi dưới trường, giữ giá trị đã nhập, đưa focus đến trường lỗi đầu tiên sau khi gửi. |
| Đang lưu/gửi | Đổi nhãn nút như “Đang lưu…”, chặn gửi trùng, giữ bố cục ổn định. |
| Lưu thành công | Phản hồi ngắn và dữ liệu/trạng thái mới; nếu cần tiếp tục thì giữ đúng ngữ cảnh. |
| Hết phiên | Hướng dẫn đăng nhập lại; không làm mất nội dung đang soạn khi có thể giữ an toàn trong bộ nhớ. |
| Không có quyền / không tìm thấy | Trang có tiêu đề rõ, mô tả dễ hiểu và lối về khu vực phù hợp với vai trò. |
| Chưa có kết nối | Giữ phần đã nhập, hiển thị trạng thái chưa lưu và nút thử lại khi kết nối được khôi phục. |
| Có thay đổi chưa lưu | Nhắc lưu/giữ hoặc bỏ thay đổi khi rời trang; không báo đã lưu khi chỉ đang giữ tạm. |
| Thao tác ảnh hưởng nhiều người | Xác nhận nêu tên đối tượng, số lớp/bé liên quan và hệ quả; nút ghi đúng động từ. |

- Ngày hiển thị `dd/MM/yyyy`, giờ `HH:mm`, múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`; dùng cấu hình locale `vi-VN`. Không suy ra ngày nghiệp vụ từ múi giờ thiết bị.
- Giá trị chỉ là ngày như ngày sinh được giữ nguyên ngày, không chuyển qua UTC làm lệch ngày. Mốc thời gian có offset mới được chuyển sang múi giờ nghiệp vụ.
- Tiền hiển thị dạng `800.000 ₫`; ô nhập có nhãn đơn vị VND. Số tiền là số nguyên, đồng bộ quy tắc tiền trong đặc tả.
- Viết ngắn, rõ hành động: **Thêm học sinh**, **Lưu nháp**, **Gửi sản phẩm**, **Thu hồi quyền xem**. Lỗi mô tả cách xử lý, không hiện stack trace hay tên mã kỹ thuật.
- Dữ liệu, nhãn và ảnh trong ví dụ là minh họa; bản triển khai dùng dữ liệu thực hoặc dữ liệu demo được ghi rõ.

## 11. Khả năng truy cập và tính nhất quán

- Mục tiêu tương phản: chữ thông thường tối thiểu 4.5:1; chữ lớn và các chỉ dấu điều khiển cần nhận diện tối thiểu 3:1. Kiểm tra cả hover, focus, badge và nền pastel.
- Mọi trạng thái có nhãn chữ hoặc dấu hiệu bổ sung; ví dụ “Có mặt”, “Nghỉ có phép”, không chỉ chấm xanh/đỏ.
- Vùng nhấn tối thiểu 44 × 44px, cách nhau đủ để thao tác trên điện thoại. Các nút trong góc học của bé dùng mức lớn hơn ở mục 9.
- Dùng đúng phần tử: link để điều hướng, button để thực hiện hành động; tránh `div` có click làm điều khiển chính.
- Có liên kết bỏ qua điều hướng đến nội dung chính; thứ tự tab theo thứ tự đọc. Menu, tabs, modal, drawer và bộ chọn ngày dùng được bằng bàn phím.
- Form có label thật, lỗi liên kết bằng `aria-describedby`, trạng thái lỗi dùng `aria-invalid`. Thông báo lưu dùng vùng đọc thích hợp, không lặp thông báo không cần thiết.
- Có thể phóng to chữ/trang mà không mất nội dung hoặc điều khiển; kiểm tra zoom 200% và màn hình rộng 320px.
- Ưu tiên nội dung tiếng Việt đầy đủ dấu; tránh cố định chiều cao cho khối văn bản dài. Tiêu đề xuống dòng tự nhiên, ô lưới có `min-width: 0`.
- Bóng đổ chỉ tạo phân lớp nhẹ; dùng tím đậm tập trung vào sidebar, nút chính và điểm nhấn. Nền nội dung giữ sáng như ảnh tham chiếu.

## 12. Quy ước triển khai và nghiệm thu

### 12.1. Tổ chức frontend

Frontend hiện dùng React, TypeScript và Vite. Hướng mặc định của bản thiết kế này là **CSS variables cho theme + CSS Modules cho component**, có thể triển khai bằng công cụ hiện có. Các thư viện bổ sung được cân nhắc khi thực hiện chức năng tương ứng.

Các đường dẫn sau là cấu trúc dự kiến, không phải danh sách file đã được tạo:

```text
frontend/
├── Design.md
└── src/
    ├── styles/
    │   ├── tokens.css           # Biến màu, khoảng cách, kích thước
    │   └── global.css           # Reset, typography, focus, lớp tiện ích chung
    ├── components/
    │   ├── ui/                 # Button, Card, Badge, Avatar, Input, Modal...
    │   └── layout/             # Sidebar, Topbar, MobileDrawer, BottomNav
    ├── features/
    │   ├── dashboard/
    │   ├── classes/
    │   ├── students/
    │   ├── library/
    │   ├── reviews/
    │   ├── calendar/
    │   ├── billing/
    │   └── family/
    ├── constants/
    │   └── status.ts           # Nhãn và tông màu theo đối tượng/enum
    └── assets/
        ├── fonts/
        └── illustrations/
```

Khi bắt đầu dựng UI, import token trước global/component CSS, bỏ các quy tắc giao diện demo Vite gây xung đột như `#root` giới hạn chiều rộng/căn chữ giữa, tiêu đề quá lớn và tự đổi dark mode. Đặt `lang="vi"`, tiêu đề TinyClass và favicon phù hợp trong `index.html`. Thiết kế phiên bản này dùng theme sáng; theme tối cần một bộ màu và kiểm tra riêng.

Các biến và class trong mẫu có tiền tố `tc-` để tránh va chạm. Component lấy màu từ token; trạng thái lấy từ bảng ánh xạ dùng chung. Mỗi module triển khai sau phải dùng lại khung, thành phần và mẫu trạng thái dữ liệu đã có.

### 12.2. Danh sách nghiệm thu giao diện

- [x] Nhận diện TinyClass; nội dung tiếng Việt nhất quán với đặc tả.
- [x] Sidebar tím, nền sáng, thẻ trắng bo góc và pastel thể hiện đúng phong cách ảnh.
- [x] Dashboard có ngữ cảnh lớp/buổi rõ; các số liệu, badge và tỷ lệ tính từ cùng phạm vi dữ liệu.
- [x] Kiểm tra ở chiều rộng 320, 375, 768, 1024, 1280 và 1536px; không mất điều khiển hoặc tràn ngang toàn trang.
- [x] Drawer, menu tài khoản, thanh dưới và vùng nội dung cuối trang hoạt động đúng khi thay kích thước màn hình.
- [ ] Mỗi danh sách/form có trạng thái tải, rỗng, lỗi, thử lại và đang lưu phù hợp; lỗi gửi không làm mất nội dung.
- [ ] Bàn phím, focus, nhãn điều khiển, tương phản và zoom 200% đáp ứng các quy tắc ở mục 11.
- [x] Ảnh lỗi/thiếu ảnh có fallback; ảnh và video không làm xô lệch bố cục khi tải.
- [ ] Điểm danh đủ năm trạng thái; chưa đánh dấu không bị hiểu thành nghỉ; sửa có phản hồi lưu rõ ràng.
- [x] Lưu nháp, xuất bản, giao bài, xác nhận hoàn thành và duyệt sản phẩm là các hành động riêng đúng nghiệp vụ.
- [x] Phụ huynh chỉ thấy bé và nội dung được cấp quyền; góc học của bé không lộ chức năng quản lý.
- [ ] Quyền xem/tải, rời lớp, Drive và học phí hiển thị đúng dữ liệu backend, không suy quyền từ nút đang ẩn/hiện.

Nếu có khác biệt về quy tắc nghiệp vụ, lấy đặc tả hệ thống làm chuẩn và cập nhật thiết kế tương ứng. Thay đổi phong cách dùng chung phải cập nhật token và tài liệu này trước khi áp dụng cho các màn hình mới.

### 12.3. Phạm vi áp dụng ngày 02/11/2026

Khung ứng dụng, dashboard, đăng nhập, lớp, hồ sơ bé, học liệu, giao bài và góc gia đình đã dùng bộ nhận diện này. Token ở `src/styles/tokens.css`, Nunito tự phục vụ ở `src/assets/fonts/`, CSS Modules cho layout/dashboard/auth/UI/bộ lọc; bố cục tính năng ở `src/styles/features.css`. Không thêm dependency UI mới. Các checkbox toàn sản phẩm chưa đánh dấu không có nghĩa đã triển khai module tương ứng; kết quả theo màn hình, kích thước và giới hạn QA ghi ở báo cáo liên kết đầu tài liệu.

Dashboard hiện dùng **Học sinh đang học · Bé có mặt hôm nay · Sản phẩm chờ duyệt · Buổi học hôm nay**. Có mặt lấy DISTINCT bé PRESENT/LATE từ các dòng còn hiệu lực; buổi hôm nay lấy SCHEDULED/COMPLETED của lớp ACTIVE/COMPLETED theo ngày Việt Nam, bỏ hủy. Các ô cùng lọc theo lớp. Có tối đa sáu buổi hôm nay; hoạt động xuất bản và lớp tiếp tục hiển thị.

TC-018 dùng thẻ điểm danh hai cột desktop/một cột mobile, trạng thái/ghi chú riêng và chia sẻ, chỉ báo chưa lưu, lý do sửa, lịch sử trong modal và thêm/loại bé có xác nhận. Có trang tra cứu và trang gia đình chỉ dữ liệu công khai. Hồ sơ bé đặt các lối vào chức năng thành hàng riêng để tên luôn đủ chỗ. [Hướng dẫn điểm danh](../doc/11-diem-danh.md). Học bù tạm hoãn theo người dùng, không tạo màn hình/số liệu bù.

Enum backend thực tế được giữ nguyên: file dùng `UPLOADING/READY/FAILED`, kho dùng `CONNECTED`; nhãn/tông màu tương ứng nằm ở `src/constants/status.ts`. [TC-015/016](../doc/verification/2026-11-02-submissions.md) có nháp/gửi/duyệt, lịch sử và vòng mới; [TC-017](../doc/verification/2026-11-02-schedule.md) có lịch tuần, sinh/đổi/hủy, xem trước và xác nhận trùng giờ, lịch gia đình. Các màn hình dùng CSS Modules và thành phần chung. Thanh mobile gia đình nay có bốn mục Trang chủ/Bài của con/Lịch học/Tài khoản khi có bé. Google thật chưa cấu hình; Điểm danh và lịch sử gia đình đã có theo TC-018; học bù tạm hoãn. Nhận xét và hành trình TC-019 đã triển khai; Drive và học phí chưa triển khai.

TC-019 hiển thị các thẻ nhận xét theo dòng thời gian, badge “Chỉ cô xem”/“Chia sẻ với gia đình”, ngữ cảnh lớp/buổi và tệp theo note. Có editor/modal/lịch sử, ghi nhận dạng sản phẩm dùng thẻ riêng, bộ lọc loại/phân trang, giữ bản nhập khi lỗi và đưa lỗi chung vào vùng nhìn. Mobile 375/320px; xem trước ảnh thật không tràn form. [Hướng dẫn](../doc/12-nhan-xet-va-tien-bo.md), [bằng chứng](../doc/verification/2026-11-02-student-notes.md).
