# TinyClass — Tối ưu toàn bộ giao diện

Thời gian: 19/11/2026, Asia/Ho_Chi_Minh. Phạm vi: toàn bộ màn hình frontend của giáo viên, gia đình, góc của bé và các trang công khai. Giữ nguyên nghiệp vụ, nội dung, theme tím/Nunito; không thay backend, schema hay dependency.

## Cách rà soát

| Cách | Nội dung |
|---|---|
| Audit trong trình duyệt | Script Playwright/Edge đăng nhập giáo viên và hai phụ huynh của dữ liệu E2E, chỉ đi theo liên kết GET (không bấm nút), đo **76 màn hình × 320, 375, 768, 1280, 1536px**: tràn ngang trang, phần tử vượt khỏi thẻ, thẻ xếp sát nhau dưới 8px, vùng nhấn dưới 40px trên điện thoại, chữ dưới 12px, tương phản chữ trên nền đặc. |
| Phân tích cascade CSS | Đọc `base.css`/`features.css` bằng postcss, đối chiếu thẻ HTML thật mà từng class được gắn trong TSX. Mỗi khai báo của features được so với base: cùng selector, class luôn đi cùng trên phần tử, hoặc reset phần tử. Kết quả là danh sách khai báo **không bao giờ có hiệu lực**. |
| Quét class | Class dùng trong TSX nhưng không có CSS; class CSS/Module không còn được dùng. |
| Mốc gốc | E2E 56/56 đạt trước khi sửa; ảnh và số đo "trước" lấy trên cùng bộ dữ liệu. |

## Phát hiện chính

**Thứ tự cascade làm mất kiểu một cách âm thầm.** Thứ tự cũ là `tokens, features, base, components`, và `base.css` chứa cả reset phần tử (`h1, h2, h3, p { margin: 0 }`, `a { color: inherit }`, `button { color: inherit; font: inherit }`, `input, select, textarea {…}`). Layer sau luôn thắng layer trước bất kể độ đặc hiệu, nên **87 khai báo** trong `features.css` đặt cho tiêu đề, đoạn văn, link, nút, ô nhập chưa bao giờ có hiệu lực. Thêm **102 khai báo** bị chính base ghi đè cùng selector hoặc cùng phần tử. Hậu quả nhìn thấy được:

- Tiêu đề và mô tả dính nhau: thẻ đăng nhập, xác minh email, thẻ lớp, ghi chú riêng, trình soạn bài.
- Link phụ trên trang đăng nhập có màu xám thay vì tím. Tab thư viện không đổi màu khi chọn. Tab "Tạo tài khoản/Đã có tài khoản" ở lời mời không phân biệt màu.
- Tiêu đề phụ to gần bằng tiêu đề khối: "Chủ đề" trong trình soạn, tên tệp trong kho tài liệu, các bảng trong "Gia đình đồng hành".
- Ô mật khẩu thiếu `padding-right`, nên chữ có thể chạy dưới nút hiện/ẩn.
- Nút Google mất viền, vì `.button { border: 1px solid transparent }` ở cùng layer base thắng `.button-google` ở features. Ghi chú "Chỉ cô xem" mất nền phân biệt.

**Thành phần chưa từng có CSS.** Danh sách "Các lớp của bé" trong hồ sơ bé dùng `recent-classes/recent-class/class-mark`, nhưng các class này không có định nghĩa nào kể từ commit đầu. Icon, tên, ngày và badge hiển thị trần, nằm sát mép trái thẻ.

## Thay đổi

| Vấn đề | Thay đổi |
|---|---|
| Reset phần tử thắng class | Tách quy tắc phần tử sang `src/styles/elements.css`, layer `elements` ngay sau `tokens`. Thứ tự mới ở `index.html`/`index.css`: `tokens, elements, features, base, components, utilities`. Rà từng khai báo được bật lại; khai báo trùng mặc định hoặc làm đổi cỡ chữ mobile hiện tại thì bỏ. |
| Mã chết | Xóa 146 khai báo features bị base ghi đè. Gỡ class không dùng: `.filter-bar` (component dùng CSS Module riêng), `.peach`, `.empty` (Attendance), `.inline/.metrics/.metric` (Games), `.lineTotal` (Invoices), `.muted` (Communications). Gỡ khối `prefers-reduced-motion` lặp, hai token khai báo trùng, bốn biến bí danh `--green/--muted/--border/--surface`. Sửa `.actions > .button` trong Module thành `:global(.button)` để rule có hiệu lực trên mobile. |
| Nhịp khoảng cách | Các giá trị lẻ (5, 7, 9, 13, 15, 19, 21, 22, 25, 27, 31px) trong features đưa về thang 4px. Breakpoint 1200/760/480 chuẩn hóa thành 1199/767/479 như base. `.course-detail` dùng cùng padding với `.lesson-detail`. |
| Hồ sơ bé | Khoảng cách 24px giữa các thẻ (16px trên điện thoại); trước đó `.profile-grid` đặt `gap: 0` dưới 950px. Danh sách lớp dùng cùng cấu trúc hàng với "Lớp đang xem" ở tổng quan. Ghi chú riêng có nền tím nhạt. |
| Thẻ buổi trong tuần 7 cột | Badge "Đã hoàn thành" `nowrap` rộng 118px trong cột còn khoảng 105px nên tràn qua viền thẻ (1280px). Trong thẻ dạng gọn, badge được xuống dòng khi thiếu chỗ và bỏ chấm trang trí. |
| Tổng quan gia đình | Hai thẻ lịch/phản hồi từng nằm trong lưới của dashboard giáo viên có `grid-template-areas` hai hàng: hàng thứ hai trống vẫn cộng gap, thêm margin của thẻ và lưới (≈72px). Nay dùng lưới riêng, cách đều 24px, hai thẻ cao bằng nhau. Từ 1024px, "Mở góc của bé", "Bài của con", "Góc chơi của bé" nằm cùng một hàng. |
| Thẻ phiếu trên điện thoại | "Đã thu/Còn lại" chia hai cột. Bỏ 16px thừa trên phiếu nháp. Mã phiếu không bị ngắt giữa chừng trong nút "Xem phiếu …". |
| Khung phản hồi sản phẩm | Mô tả bám tiêu đề và cách ô nhận xét 20px. Ở cột dính (≥1200px), hai nút quyết định chia đều hàng thay vì lệch nhau. |
| Vùng nhấn | Link quay lại 32 → 44px, giảm margin để giữ tổng 48px trước tiêu đề. Thẻ số liệu tổng quan dùng stretched link: cả thẻ là vùng nhấn, vòng focus bao thẻ. "Xem phiếu quá hạn", link dưới form đăng nhập và mã phiếu trong thẻ đạt khoảng 44px. |
| Chi tiết nhỏ | `small` trong bảng 11,7 → 12px. Gợi ý dung lượng tệp chuyển vào `hint` của trường chọn tệp (cùng kiểu và `aria-describedby` như các trường khác). Mô tả thẻ lớp chỉ giữ chỗ hai dòng khi lưới có từ 2 cột. |
| Font | `@font-face` bộ `vietnamese` khai báo cuối. Với `unicode-range` chồng nhau, trình duyệt xét rule sau trước, nên ă đ ĩ ũ ơ ư dùng bộ vietnamese thay vì kéo thêm `latin-ext`. Plugin trong `vite.config.ts` chèn `<link rel="preload" crossorigin>` cho `latin` và `vietnamese` lúc build. |

Quy ước mới được ghi vào [Design.md](../../frontend/Design.md), mục 2.2 và 12.6.

## Số đo

Cùng bộ dữ liệu, bản build production phục vụ bằng Vite preview, Edge trên Windows.

| Chỉ số | Trước | Sau |
|---|---|---|
| Thẻ xếp sát nhau (< 8px) | 15 | **0** |
| Phần tử tràn khỏi thẻ | 4 | **0** |
| Chữ dưới 12px | 5 | **0** |
| Vùng nhấn < 40px trên điện thoại | 102 | **5**¹ |
| Tràn ngang trang, lỗi JS, tương phản dưới ngưỡng | 0 | 0 |
| Khai báo không bao giờ có hiệu lực trong `features.css` | 189 | **0** |
| Khai báo CSS toàn cục (`elements` + `features` + `base`) | 1.395 | 1.283 |
| CSS tải lần đầu | 60,43 kB (gzip 11,74) | 58,08 kB (gzip 11,37) |
| JS tải lần đầu | 260,68 kB (gzip 79,59) | 260,65 kB (gzip 79,59) |
| Font trên trang tiếng Việt² | 3 tệp, 85,8 kB, bắt đầu ≈ 90ms | **2 tệp, 51,0 kB, bắt đầu ≈ 17ms** |
| Chiều cao danh sách phiếu 375px | 5.834px | 5.106px (−12,5%) |
| Chiều cao tổng quan bé 1280px | 2.626px | 2.517px |

¹ Cả 5 mục đều là link của thẻ số liệu mà script đo theo hộp chữ (22px). Vùng nhấn thật là cả thẻ: `elementFromPoint` tại góc trên và tâm thẻ trả về đúng link ở 375 và 1440px.
² Cache tắt, trang đăng nhập và tổng quan giáo viên. `CSS.getPlatformFontsForNode` cho thấy tiêu đề tiếng Việt (ă ư ơ ữ ề ớ ỏ) được vẽ hoàn toàn bằng Nunito ở cả hai bản. Số đo trên localhost; lợi ích thực tế phụ thuộc mạng.

Tổng chiều cao 380 tổ hợp màn hình × độ rộng tăng 0,23%. Thẻ lớp, thư viện, giao bài trên điện thoại cao thêm khoảng 22–24px mỗi thẻ, vì tiêu đề, mô tả và thông tin được tách đúng thiết kế. Danh sách phiếu và tổng quan bé ngắn lại.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd run build` | Đạt |
| `npm.cmd run lint` (oxlint + stylelint) | Đạt, không cảnh báo |
| `npm.cmd run test:e2e` | **56/56 đạt** trước khi sửa (5,8 phút). Sau khi sửa chạy ba lượt, lượt cuối trên đúng mã nguồn bàn giao: đều **56/56 đạt** (5,6 phút) |
| Phân tích cascade sau sửa | 0 khai báo features bị base ghi đè; không rule rỗng, không selector trùng trong cùng ngữ cảnh |
| Ràng buộc E2E về hình học | Thẻ hoạt động trống < 200px, mũi tên liên kết thống kê cùng dòng ở 375px, "Cùng con hôm nay" y = 573px (< 600) ở 375 × 812, sidebar không cuộn ở 1440 × 1000 |

## Ảnh đối chiếu

| Màn hình | Trước | Sau |
|---|---|---|
| Hồ sơ bé 1440px | [Ảnh trước](images/2026-11-19-ui/student-before.png) | [Ảnh sau](images/2026-11-19-ui/student-after.png) |
| Đăng nhập 1440px | [Ảnh trước](images/2026-11-19-ui/login-before.png) | [Ảnh sau](images/2026-11-19-ui/login-after.png) |
| Trình soạn bài 1440px | [Ảnh trước](images/2026-11-19-ui/lesson-editor-before.png) | [Ảnh sau](images/2026-11-19-ui/lesson-editor-after.png) |
| Tổng quan bé 1440px | [Ảnh trước](images/2026-11-19-ui/family-child-before.png) | [Ảnh sau](images/2026-11-19-ui/family-child-after.png) |
| Tài khoản 375px | [Ảnh trước](images/2026-11-19-ui/account-375-before.png) | [Ảnh sau](images/2026-11-19-ui/account-375-after.png) |
| Danh sách phiếu 375px | [Ảnh trước](images/2026-11-19-ui/invoices-375-before.png) | [Ảnh sau](images/2026-11-19-ui/invoices-375-after.png) |

Dữ liệu giả được tạo lại giữa các lượt, nên giờ và mã phiếu trong ảnh có thể khác nhau.

## Giới hạn

- Đo bằng Edge trên Windows; chưa thử Safari/iOS hay Android thật. Khoảng cách tiêu đề–mô tả trong trình soạn và khung phản hồi dùng `:has()`. Trình duyệt không hỗ trợ sẽ giữ khoảng cách cũ. `min-height: 2lh` không được hỗ trợ thì không giữ chỗ hai dòng; nội dung vẫn hiển thị đủ.
- Audit chỉ phát hiện những gì đo được: chưa phải kiểm tra khả năng truy cập toàn diện hay với screen reader. Link nằm trong câu văn không tính vào vùng nhấn. Kiểm tra tương phản bỏ qua nền gradient/ảnh.
- Ô chọn ngày và nút chọn tệp gốc của trình duyệt hiển thị theo ngôn ngữ trình duyệt (ví dụ `11/23/2026`, "Choose File" trên Edge tiếng Anh); ngoài phạm vi vì cần thay bằng điều khiển tự dựng.
- JS khởi đầu chủ yếu là React DOM (≈ 202 kB) và React Router (≈ 38 kB); không giảm thêm nếu không đổi thư viện.
- Không thay backend nên không chạy lại kiểm thử Maven. E2E và audit dùng database `tinyclass_test` riêng; database phát triển không bị đụng tới.
