# TC-018 — Điểm danh theo buổi

Phạm vi cập nhật theo yêu cầu người dùng ngày 02/11/2026: hoàn thiện **điểm danh**; **học bù tạm hoãn**. Dùng giao diện trong [Design.md](../../frontend/Design.md). Học phí/nhận xét định kỳ thuộc các task sau, Google thật tiếp tục tạm hoãn.

- V10 thêm điểm danh và sự kiện; không thêm bảng/API học bù. Roster ban đầu lấy các bé đang tham gia tại thời điểm chốt, giữ tên/enrollment; gọi lại giữ nguyên, kể cả roster rỗng. Lớp đã hoàn thành lấy các quan hệ hoàn thành phù hợp với thời gian buổi. Danh sách không tự thay đổi khi bé rời lớp/đổi tên; thêm/loại/khôi phục từng bé cần lý do và giữ bản ghi cũ.
- UNMARKED khác PRESENT/LATE/ABSENT_EXCUSED/ABSENT_UNEXCUSED. Có mặt/đi muộn chỉ ghi từ lúc bắt đầu; có thể ghi nghỉ sớm. API kiểm tra hết dòng/version trước khi cập nhật nguyên tử. Ghi chú riêng và ghi chú gia đình tách biệt. Chỉnh dữ liệu đã ghi cần lý do.
- Kết thúc sau giờ kết thúc khi các dòng còn hiệu lực đã được đánh dấu; buổi rỗng cần lý do. Sửa thành UNMARKED mở lại trạng thái buổi, giữ mốc cũ trong audit. Buổi hủy/lớp lưu trữ chỉ đọc; kết quả cũ không tính vào số có hiệu lực của buổi hủy.
- Gia đình có liên kết còn hiệu lực xem lịch sử riêng của bé kể cả rời lớp/lớp lưu trữ. Không trả ghi chú/lý do riêng, version, enrollment hoặc dữ liệu bé khác. Roster tương lai UNMARKED chưa hiển thị như lịch sử đã học.
- Dùng cùng khóa ghi theo giáo viên trước khóa lớp/buổi như lịch dạy; roster đã chốt tiếp tục bảo vệ giờ/lịch. Dashboard lấy số bé có mặt/đi muộn thật, mỗi bé một lần/ngày; loại dòng không hiệu lực/buổi hủy, giữ buổi COMPLETED trong số buổi hôm nay.
- Kiểm tra migration V9 có dữ liệu, HTTP snapshot/quyền/CSRF/version/đồng thời/trạng thái, E2E teacher–family, build/lint, OpenAPI và ảnh desktop/mobile trước khi DONE.

Kết quả tại mốc TC-018: **DONE trong phạm vi điểm danh; học bù tạm hoãn**. 107 backend test và 25 E2E đạt, frontend build/lint thành công; V10 nâng V9 có dữ liệu giữ lịch cũ. OpenAPI 0.0.9 mô tả API tại mốc này. [Hướng dẫn](../11-diem-danh.md), [bằng chứng và ảnh](../verification/2026-11-02-attendance.md). Phần tiếp theo đã có [TC-019 nhận xét/hành trình](2026-11-02-student-notes.md).
