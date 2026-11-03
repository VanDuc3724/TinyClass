# Triển khai TC-015/016 — Sản phẩm và phản hồi

Phạm vi: phụ huynh lưu nháp/upload/gửi sản phẩm cho item TEACHER_REVIEW; giáo viên xem hàng đợi, chấp nhận/yêu cầu bổ sung, phản hồi chữ hoặc âm thanh và mở lại yêu cầu đã hoàn thành. PARENT_CONFIRM giữ luồng xác nhận hiện có và có thể được cô mở lại từ tiến độ từng bé. Giao diện theo frontend/Design.md; Google thật tiếp tục tạm hoãn.

- V8 thêm lượt gửi, tệp đính kèm, sự kiện và vòng duyệt. Mỗi tác giả có một nháp trong một vòng; mỗi bé/item chỉ một lượt SUBMITTED. Cấp số lượt và đổi tiến độ dưới khóa giao dịch. Lượt đã gửi bất biến; mở lại tạo vòng mới, giữ phản hồi cũ.
- Phụ huynh tải vào kho mặc định của giáo viên; quota tính cả tệp của gia đình. Server tự ràng buộc tệp với bé/item/người upload; tối đa 5 tệp/tổng 250 MiB, kiểm tra MIME/loại trả lời. Upload lỗi giữ chữ và các tệp đã lưu.
- Lịch sử sản phẩm/phản hồi vẫn đọc được khi rời lớp nếu liên kết gia đình còn hiệu lực; quyền bài gốc không được khôi phục. Thu hồi liên kết gia đình chặn cả lịch sử và tệp. Cô có thể xử lý lượt đã gửi sau khi rời lớp, nhưng mở lại để làm mới cần lần giao/người nhận còn hoạt động.
- UI có nháp/gửi riêng, lịch sử theo bé, nhãn gửi muộn, hàng đợi lọc lớp/trạng thái, xem media và tiến độ/mở lại từng bé. Không giả lập thông báo hoặc triển khai lịch/học phí trong task này.
- Nghiệm thu bằng migration từ schema rỗng/nâng V7, HTTP quyền/trạng thái/đồng thời/tệp/vòng mới, E2E gia đình–giáo viên, build/lint, cập nhật OpenAPI và bằng chứng desktop/mobile.

Kết quả: **DONE**. Backend 83 test, 19 E2E và frontend build/lint đạt. [Báo cáo và ảnh](../verification/2026-11-02-submissions.md), [hướng dẫn sử dụng](../09-san-pham-va-phan-hoi.md). TC-017 lịch dạy đã READY.
