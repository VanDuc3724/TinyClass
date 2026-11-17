# TinyClass — Tối ưu tải học liệu và độ ổn định

Ngày thực hiện: 17/11/2026, Asia/Ho_Chi_Minh. Phạm vi: cải tiến các nghiệp vụ đang có; giữ các thay đổi chưa commit trong workspace.

## Thay đổi

### Bộ chọn ảnh và âm thanh

Trước đây, mỗi lần tìm kiếm gọi `allGameChoices`, tải tuần tự cả kho (tối đa 100 trang, mỗi trang 100 tệp), rồi mới lọc MIME/trạng thái và chia trang trên trình duyệt. Bộ chọn hiện gọi một trang 12 tệp; `/files` lọc `purpose`, `mediaType=image|audio`, `status=READY`, uploader và từ khóa trước phân trang/đếm. Hai query parameter mới là tùy chọn, giữ hành vi thư viện khi không truyền.

Tìm kiếm chờ 250 ms sau lần gõ cuối, hủy yêu cầu cũ qua `AbortSignal` và về trang đầu khi đổi từ khóa. Đây là giảm request và số bản ghi tải về; chưa đo độ trễ trên kho production lớn.

### Thống kê tiến độ

`AssignmentService.familyList` tổng hợp tiến độ cho các ID trong trang đã qua kiểm tra quyền bằng một truy vấn, thay cho hai truy vấn mỗi bài. Ví dụ, trang 100 bài giảm phần truy vấn tiến độ từ 200 xuống 1; các truy vấn xác thực, danh sách và tổng số vẫn giữ.

Chi tiết giáo viên tổng hợp số bài bắt buộc một lần và số hoàn thành theo từng bé trước khi ghép với người nhận, thay cho hai truy vấn mỗi người nhận. Giữ lịch sử của người nhận đã thu hồi, loại bài tham khảo/tùy chọn khỏi mẫu số và trả phần trăm `null` khi không có bài bắt buộc. Trang chi tiết một bài cũng gộp hai truy vấn đếm thành một.

### Khôi phục màn hình khi gặp lỗi

Thêm `PageErrorBoundary` quanh nội dung trong layout và quanh ứng dụng. Lỗi tải chunk hoặc render hiển thị thông báo tiếng Việt với nút **Tải lại trang**. Lỗi ở nội dung vẫn giữ menu điều hướng; đổi trang đặt lại trạng thái lỗi. Query tìm kiếm không làm remount nội dung đang hoạt động. Không tự tải lại để tránh mất biểu mẫu hoặc tạo vòng lặp khi mất mạng.

### Stream tệp

Sửa `DatabaseStorageAdapter.ChunkStream.read(buffer, offset, 0)` để trả `0` cả ở cuối tệp, theo hợp đồng `InputStream`. Kiểm tra giới hạn buffer vẫn chạy trước; Range tiếp tục bỏ qua khối không cần đọc.

## Kiểm tra

- Frontend `npm.cmd run build` và `npm.cmd run lint`: đạt.
- Entry JS: 251,43 → 252,27 kB; gzip 76,77 → 77,06 kB. Phần tăng chủ yếu phục vụ màn hình khôi phục lỗi; không có thay đổi dependency hoặc bundle toàn bộ trang vào entry.
- Backend: 218 kiểm thử đạt trên database test, tổng hợp 20 báo cáo suite sau lượt chạy toàn bộ và chạy lại `LocalStorageTests`. Lượt đầu phát hiện fixture mới tạo giáo viên thứ hai, vi phạm `users_single_teacher`; fixture đã sửa thành uploader phụ huynh và cả 9 bài kho tệp đạt khi chạy lại. Không thay ràng buộc database.
- Lệnh backend: `./mvnw.cmd -B "-Dtest=!LocalProfileStartupTests" verify`, sau đó `./mvnw.cmd -B "-Dtest=LocalStorageTests" verify` để xác minh fixture đã sửa và đóng gói thành công. Log ở `.local/optimization-verify.log` và `.local/optimization-storage-verify.log` (gitignored).
- Regression mới kiểm tra phân trang 12+1 tệp đúng MIME/trạng thái/uploader, bộ đếm trước phân trang, tiến độ tách từng bài/bé, bài không bắt buộc, thu hồi quyền và stream cuối tệp/biên khối.
- `npm.cmd run test:e2e`: **49/49 luồng Edge đạt**, thời gian Playwright 5,2 phút; log `.local/optimization-e2e.log` (gitignored). Giữ đủ 47 luồng cũ và thêm hai luồng lỗi tải chunk: giữ menu/đổi trang/tải lại sau đăng nhập và khôi phục màn hình công khai.
- Luồng trò chơi kiểm tra bộ chọn chỉ phát sinh hai GET khi mở kho rồi gõ 13 ký tự liên tục: một trang ban đầu và một tìm kiếm sau debounce, đều có `size=12`, `status=READY`, `mediaType=image`. Bộ chọn âm thanh cũng gọi đúng `mediaType=audio`.

## Giới hạn

Không chạy `LocalProfileStartupTests` trong lượt này vì bài đó cần database phát triển. Maven và E2E chạy tuần tự trên database `tinyclass_test`, PostgreSQL cổng 55433 và Mailpit test riêng; không reset database phát triển.

Chưa thay cơ chế cảnh báo biểu mẫu khi điều hướng SPA hoặc tối ưu các truy vấn ngoài tiến độ. Không có migration mới, thay đổi dependency, triển khai hay kiểm tra Google/SMTP thật.
