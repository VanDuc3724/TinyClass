# TinyClass — Kho tài liệu, bài học và giao bài

Cập nhật 02/11/2026. Phần này hoạt động bằng email/mật khẩu, không cần cấu hình Google. Phạm vi đã triển khai: TC-010/012/013/014; xem [báo cáo kiểm tra](verification/2026-11-02-learning.md).

## Chuẩn bị kho LOCAL

Chạy backend/frontend theo [README](../README.md). Khi chạy backend từ Backend/, mặc định tệp nằm trong `.local/uploads/` ở thư mục gốc dự án; database chỉ chứa metadata, không chứa video BLOB. Thư mục này được gitignore, tách khỏi static/public, build và Vite.

Có thể đặt trong `.env`:

```dotenv
TINYCLASS_UPLOAD_ROOT=../.local/uploads
TINYCLASS_STORAGE_QUOTA_BYTES=5368709120
```

Đây là mặc định kỹ thuật 5 GiB cho giáo viên, có thể điều chỉnh theo ổ lưu/ngân sách. Khởi động lại backend sau khi sửa cấu hình. Production bắt buộc khai báo thư mục bền vững bằng biến môi trường. Khi đổi root, giữ/mang theo cây tệp đang có để các khóa trong database vẫn tìm đúng byte; thay biến không tự chuyển dữ liệu.

Sao lưu database **và** thư mục upload cùng mốc. JAR không chứa học liệu. Không đặt thư mục upload trong public/static/dist/target hoặc trỏ qua symlink. Kiểm tra khôi phục và triển khai thực tế thuộc TC-027.

## Giáo viên chuẩn bị học liệu

1. Vào **Kho tài liệu → Tải tệp lên**, chọn tệp, nơi lưu và quyền cho gia đình tải. Hiện LOCAL khả dụng; lựa chọn Drive chưa kết nối.
2. Xem trước tệp bằng cách mở thẻ tài liệu. Giáo viên có thể tải bản gốc và thay cờ tải học liệu. Cờ tác động mọi bài đang dùng tệp, nhưng chưa tự cấp quyền cho gia đình.
3. Vào **Thư viện học liệu → Chủ đề**, thêm nhóm như Màu sắc, Thế giới quanh bé.
4. Chọn **Soạn bài học**, điền giới thiệu/gợi ý/hướng dẫn, thêm các khối chữ/ảnh/video/âm thanh/PDF. Chọn tệp có sẵn hoặc tải mới ngay trong biểu mẫu; sắp xếp bằng nút lên/xuống.
5. **Lưu bản nháp**, kiểm tra rồi **Xuất bản**. Nháp có thể chưa đủ nội dung; xuất bản cần nội dung hợp lệ và tệp READY. Thư viện xuất bản vẫn riêng tư với gia đình đến khi có lần giao.
6. Tạo **Khóa học**, chọn và sắp thứ tự các bài đã có. Một bài chỉ xuất hiện một lần trong cùng khóa. Xuất bản khóa cần ít nhất một bài đã xuất bản.

Định dạng hiện có: PNG/JPEG/GIF/WebP, PDF, MP3/WAV/OGG, MP4/WebM. Giới hạn theo byte: ảnh 10 MiB, âm thanh 20 MiB, PDF 50 MiB, video 200 MiB. Backend đối chiếu nội dung, đuôi và MIME; SVG/HTML, liên kết video ngoài và tệp văn phòng chưa được mở ở bản này. Khả năng phát codec phụ thuộc trình duyệt; hệ thống chưa chuyển mã video.

Sửa bài đã xuất bản cần xác nhận cập nhật dùng chung. Nội dung bài thay đổi ở các lần giao đang dùng bài; danh sách/yêu cầu của lần giao không tự đổi. Lưu trữ ngừng dùng cho lần giao mới, giữ nội dung đã giao; khôi phục trở lại trạng thái trước lưu trữ.

## Giao cho lớp hoặc riêng bé

1. Tại bài/khóa đã xuất bản, chọn **Giao cho gia đình**, hoặc vào **Giao bài → Tạo lần giao**.
2. Chọn đúng một bài/khóa và một lớp/bé; đặt thời điểm mở, hạn gợi ý. Tạo bản nháp.
3. Kiểm tra các bài/yêu cầu bắt buộc và cách hoàn thành, lưu thay đổi rồi **Xuất bản lần giao**.
4. Với lớp, người nhận là các bé đang tham gia tại thời điểm xuất bản. Bé vào sau không tự nhận bài cũ; chọn **Cấp thêm bé**, chọn bé hiện đang trong lớp và ghi lý do để chia sẻ bổ sung.

Bản nháp giữ danh sách bài đã sao chép từ nguồn. Việc thêm bài vào khóa sau đó không sửa bản nháp/lần giao cũ. Giao lại cùng bài là lần giao mới, có tiến độ riêng. API chống tạo trùng khi gửi lại cùng client request ID; xuất bản lại không nhân đôi người nhận.

**Thu hồi lần giao** ngừng quyền truy cập mới và giữ lịch sử. Bé rời lớp mất quyền bài/tệp được giao qua lớp đó. Quay lại không tự khôi phục bài cũ; giáo viên phải cấp lại có chủ đích. Bài giao riêng cho bé được xét độc lập.

## Gia đình cùng bé học

Từ hồ sơ con, chọn **Góc học của bé** → hoạt động → bài học. Bài chưa đến giờ mở chỉ hiện thông tin thời gian; API chưa trả nội dung/tệp. Lớp đã kết thúc được xem lại nhưng không xác nhận mới.

- **Tham khảo:** ghi nhận mở, không đưa vào mẫu số hoàn thành.
- **Gia đình xác nhận:** mở video chưa hoàn thành. Sau khi cùng bé thực hiện, đánh dấu xác nhận rồi bấm **Xác nhận đã hoàn thành**.
- **Giáo viên duyệt sản phẩm:** dữ liệu yêu cầu đã có; nộp sản phẩm và duyệt/hoàn thành sẽ triển khai ở TC-015/016. Chưa dùng cách này cho một luồng cần hoàn thành ngay ở mốc hiện tại.

Tiến độ được tính theo số bài bắt buộc, bỏ REFERENCE; không có bài bắt buộc thì hiển thị “Nội dung tham khảo”. Giáo viên xem tiến độ từng người nhận tại chi tiết lần giao.

Tài liệu được phép tải hiện đường tải riêng. File xem/tải đều kiểm tra đúng bé/item/quyền hiện tại; biết ID hoặc từng mở URL không giữ quyền sau thu hồi. Cờ chỉ xem kiểm soát tính năng tải của ứng dụng; byte đã truyền hoặc bản đã tải trước đó không thể thu lại.

## Giới hạn hiện tại

Nộp/duyệt sản phẩm đã có trong [hướng dẫn riêng](09-san-pham-va-phan-hoi.md); lịch dạy tại [hướng dẫn lịch](10-lich-day.md). Drive, điểm danh/bù, nhận xét định kỳ, học phí và thông báo theo [backlog](plan/02-backlog.md). Kho hiện chưa tự dọn tệp rời lâu ngày hoặc có giao diện xóa tệp; giữ metadata FAILED để theo dõi lỗi upload. Mất byte trong ổ lưu trả STORAGE_UNAVAILABLE, không xóa metadata hay tự đổi kho.
