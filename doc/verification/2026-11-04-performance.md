# TinyClass — Tối ưu hiệu năng và giao diện

Ngày kiểm tra: 04/11/2026, Asia/Ho_Chi_Minh. Phạm vi: tối ưu các phần đã có sau TC-025, không thêm nghiệp vụ. Google thật, Drive, học bù và triển khai vẫn theo [backlog](../plan/02-backlog.md).

## Kết quả

| Kiểm tra | Quan sát |
|---|---|
| Maven test | 199 test; 198 đạt, LocalProfileStartupTests cần PostgreSQL phát triển cổng 55432 đang chạy |
| Migration | V1–V19 từ schema rỗng; các bài nâng V7–V16 đếm đúng thêm V18/V19; nâng từ V18 giữ metadata tệp, `file_chunks` rỗng và cột `data` lưu EXTERNAL |
| Frontend | build/lint thành công; VS Code Problems không còn cảnh báo |
| Playwright/Edge | 44/44 luồng đạt sau từng nhóm thay đổi |
| JS tải lần đầu | 514 KB → 315 KB chưa nén (99 KB gzip); CSS vào trang 69 KB → 46 KB |
| Chiều cao trang | Tổng quan giáo viên 375 px: 3.963 → 3.309 px; 1536 px: 2.797 → 2.240 px |
| Truy vấn khi chạy E2E | 18.668 lệnh, tổng ~1 giây thực thi; lệnh chậm nhất ngoài DDL 4 ms |

## Thay đổi

- Mọi trang sau đăng nhập tải theo chunk riêng; layout giữ sidebar trong lúc tải.
- Chuông cập nhật gộp đổi trang/focus/hiện tab thành tối đa một request mỗi 15 giây; đọc cập nhật vẫn làm mới ngay.
- V18 thêm `submissions(student_id,status,reviewed_at,id)` cho tổng quan, tiến độ và lịch sử sản phẩm theo bé.
- Thứ tự cascade layer khai báo trong `index.html`. Trước đó CSS dùng chung tải trước `index.css` nên trên bản build, quy tắc CSS Modules thua base/features: chữ logo sidebar tím trên nền tím, nút menu gia đình mobile vẫn hiện.
- Menu nhóm theo tần suất việc; trang của bé dùng cùng tên/icon/thứ tự với menu. Tổng quan dùng trạng thái rỗng gọn, ẩn bốn số 0 học phí, đưa thao tác nhanh lên khi xếp chồng.
- Phân trang một trang chỉ hiện số kết quả; chọn ngày tuần trên mobile xuống dòng riêng.
- `HttpStatus.CONTENT_TOO_LARGE` thay hằng deprecated, vẫn là 413.
- Mười hai đường đọc tệp trả `private, no-cache` kèm ETag SHA-256 thay `private, no-store`. Mở lại ảnh/video/PDF chưa đổi chỉ nhận 304 sau khi kiểm tra phiên và quyền hiện tại; đăng xuất gửi `Clear-Site-Data: "cache"`. Quyết định ghi tại [sổ quyết định](../spec/06-decisions.md).
- V19 đưa byte tệp LOCAL vào PostgreSQL (`file_chunks`, khối 1 MiB). Byte và READY commit cùng giao dịch; đọc/Range lấy từng khối bằng truy vấn ngắn, không giữ kết nối trong lúc client tải. Tệp cũ trong thư mục upload được nhập lúc khởi động khi khớp kích thước và SHA-256.

## Mở tệp

| Kiểm tra | Quan sát |
|---|---|
| LocalStorageTests | ETag đúng SHA-256 byte gốc; `If-None-Match` khớp trả 304 không body, ETag khác trả 200 |
| StudentNoteTests | Range 206 có ETag; sau lưu trữ hoặc gỡ tệp khỏi nhận xét, yêu cầu kèm ETag cũ vẫn trả 404 chứ không 304 |
| AccountsAndClassesTests | Đăng xuất trả `Clear-Site-Data: "cache"` |
| LearningTests, SubmissionTests | Đường tệp bài học/sản phẩm dùng cùng response, đạt |

## Tệp trong PostgreSQL

| Kiểm tra | Quan sát |
|---|---|
| LocalStorageTests | Ảnh nhỏ thành một khối đúng kích thước; PDF 2 MiB + 4.321 byte thành ba khối 1 MiB/1 MiB/4.321; tải đủ khớp byte gốc; Range qua ranh giới khối và `bytes=-100` trả đúng đoạn |
| Lỗi/hết dung lượng | Upload đồng thời vượt quota vẫn một 201/một 409; xóa khối trả 503 và giữ metadata READY |
| Nhập tệp cũ | Chỉ nhập tệp khớp SHA-256; tệp bị sửa và khóa `../outside.png` không được đọc, vẫn trả 503; chạy lại không nhập trùng |
| Playwright/Edge | 44/44 luồng đạt; database test có 6 tệp/6 khối, không có tệp mới trên ổ đĩa |

## Đo truy vấn

Database test bật `pg_stat_statements` tạm thời trong schema riêng, chạy trọn 44 luồng E2E rồi khôi phục cấu hình gốc. Khoảng 5 lệnh mỗi request, không thấy mẫu N+1. Lệnh tốn tổng thời gian nhất là nạp tài khoản theo session ở mỗi request (2.828 lần, trung bình 0,05 ms); giữ nguyên vì thu hồi quyền cần có hiệu lực ngay. Đếm cập nhật theo quyền nguồn trung bình 0,15 ms.

Với quy mô một giáo viên, database chưa phải điểm nghẽn; không gộp truy vấn tổng quan hoặc thêm cache phía server khi chưa có số đo cho thấy cần.

## Giới hạn

Bản sao tệp có thể nằm trong cache trình duyệt cho tới khi đăng xuất hoặc trình duyệt tự dọn; hết phiên mà không đăng xuất thì không có lệnh xóa. `Clear-Site-Data` chỉ có hiệu lực trên HTTPS hoặc localhost. Ảnh lưu nguyên kích thước upload, chưa có bản thu nhỏ. Database lớn theo dung lượng tệp (tối đa quota 5 GiB mỗi giáo viên), nên bản sao lưu và khôi phục lâu hơn; việc nhập 3 tệp cũ của database phát triển sẽ chạy ở lần khởi động local tiếp theo, chưa được chạy trong lần kiểm tra này. Thẻ `<style>` khai báo layer trong `index.html` cần được cho phép bằng hash nếu bật Content-Security-Policy ở TC-027. Số đo trên dữ liệu kiểm thử nhỏ, chưa thay cho tải thử của TC-027.
