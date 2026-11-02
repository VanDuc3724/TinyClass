# TinyClass — Buổi dạy, nhận xét, học phí và thông báo

Nguồn: [quy tắc nghiệp vụ](../01-mo-ta-he-thong.md#s06), [dữ liệu/API](../01-mo-ta-he-thong.md#s09). Những mặc định nghỉ/bù, giữ lịch sử và phạm vi phát hành vẫn theo [quyết định cần chốt](06-decisions.md).

<a id="requirements"></a>
## 1. Lịch và điểm danh

| Mã | Yêu cầu |
|---|---|
| TEACH-01 | Quy tắc lịch tuần có thứ ISO, giờ, ngày hiệu lực, timezone; tạo được buổi riêng. |
| TEACH-02 | Sinh buổi trong khoảng chọn, chạy lại không tạo trùng theo rule/thời điểm bắt đầu. |
| TEACH-03 | Sửa lịch tuần áp dụng đúng phạm vi tương lai, giữ buổi đã diễn ra/chỉnh riêng/có điểm danh. |
| TEACH-04 | Cảnh báo trùng giờ của giáo viên, xác nhận ngoại lệ trước khi lưu. |
| TEACH-05 | Danh sách điểm danh được chụp cho từng buổi, không viết lại theo danh sách lớp hiện tại. |
| TEACH-06 | UNMARKED khác có mặt/đi muộn/nghỉ có phép/nghỉ chưa báo. Buổi CANCELLED không tính là đã học. |
| TEACH-07 | Một bé/buổi có một dòng điểm danh, kể cả học bù; sửa có version và lịch sử. |

Giờ nghiệp vụ là `Asia/Ho_Chi_Minh`; giờ tuyệt đối lưu UTC. Khi hủy buổi đã có điểm danh cần lý do và giữ bản ghi cũ để đối chiếu. API lưu nhiều dòng điểm danh trong cùng giao dịch; lỗi một dòng không ghi một phần không được thông báo.

## 2. Học bù

- Kế hoạch bù bắt nguồn từ một dòng nghỉ của đúng bé, có trạng thái PENDING/SCHEDULED/COMPLETED/CANCELLED.
- Một lần nghỉ tối đa một kế hoạch chưa hủy; kế hoạch SCHEDULED cần điểm danh đích hợp lệ.
- Có thể học bù ở buổi khác lớp mà không đổi tư cách thành viên dài hạn; backend kiểm tra đúng bé, cùng không gian giáo viên và nguồn MAKEUP.
- Đích có mặt/đi muộn trong buổi không bị hủy mới hoàn thành bù. Hủy/đổi kết quả đích phải cập nhật lại kế hoạch.
- Với buổi giáo viên hủy, có thể đổi/tạo buổi thay thế theo lịch lớp; không mặc nhiên ghi tất cả trẻ là nghỉ cá nhân.
- Giá/quy tắc của chuỗi nghỉ–bù lấy theo buổi gốc; dùng khóa nguồn gốc để tránh tính tiền lần hai.

Quyền được bù và cách tính nghỉ có phép/chưa báo là lựa chọn chính sách, không được tự coi đã chốt khi triển khai.

## 3. Nhận xét

`student_notes` gắn bé, tùy chọn lớp/buổi, nội dung và `PRIVATE`/`SHARED`. Tệp kế thừa đúng mức chia sẻ. Gia đình chỉ thấy SHARED của con; phản hồi sản phẩm là nguồn riêng nhưng có thể tổng hợp vào trang tiến bộ.

Sửa/chuyển phạm vi/lưu trữ giữ lịch sử cần thiết. Backend không trả ghi chú PRIVATE rồi trông chờ React ẩn đi. Các FK lớp/buổi phải thuộc cùng ngữ cảnh giáo viên và hợp lệ với bé.

## 4. Cách tính và thời điểm thu

| Cách tính | Tham số | Mặc định thời điểm thu đề xuất |
|---|---|---|
| PER_SESSION | Đơn giá/buổi, điều kiện điểm danh được tính | Cuối kỳ, giáo viên xem và duyệt |
| MONTHLY_FIXED | Số tiền thỏa thuận cho tháng | Đầu hoặc cuối tháng |
| FULL_PROGRAM | Tổng tiền trọn đợt/lộ trình dạy, tên đợt và số buổi dự kiến nếu có | Thu trước; vẫn ghi nhận được trả từng phần |

Cấu hình lớp được sao chép sang `enrollment_tuition_agreements`, cho phép điều kiện riêng từng bé. Thỏa thuận có khoảng hiệu lực không chồng nhau. Giá đã dùng không sửa hồi tố: kết thúc thỏa thuận và tạo bản mới. Phiếu giữ bản chụp điều kiện.

Trọn đợt không bắt buộc trùng một khóa trong thư viện; cũng không tạo quyền nội dung ngoài thời gian được cấp. Rời lớp vẫn dừng bài/khóa của lớp dù đã thu đủ. Việc quyết toán phần chưa học cần giáo viên chốt theo thỏa thuận, không tự hoàn tiền.

## 5. Nghỉ và học bù ảnh hưởng số phí thế nào

Các giá trị sau là gợi ý để review, không phải chính sách đã duyệt:

| Tình huống | Theo buổi | Tháng/trọn đợt |
|---|---|---|
| Có mặt/đi muộn | Một buổi | Trong mức thỏa thuận |
| Nghỉ có phép | Không tính, hoặc cấu hình tính/cho bù | Giữ mức hoặc điều chỉnh thủ công theo thỏa thuận |
| Nghỉ chưa báo | Mặc định tính, có thể đổi | Giữ mức; quyền bù được cấu hình |
| Giáo viên hủy | Không tính buổi hủy | Sắp lại lịch/quyết toán thủ công |
| Học bù | Nếu gốc chưa tính thì tính khi đến bù; nếu đã tính thì không thu lần hai | Không tự sinh thêm phí |

Preview là gợi ý. Giáo viên chốt mới tạo phiếu và giữ các buổi qua `session_charge_entries`; không tự trừ tiền hoặc phát hành theo sự kiện điểm danh. Sửa điểm danh sau phát hành cần cảnh báo đối chiếu, không thay số đã công bố.

## 6. Phiếu và ghi nhận thanh toán

1. Chọn bé/lớp/thỏa thuận và kỳ thu; nhập tay các dòng hoặc lấy gợi ý.
2. Backend kiểm tra điều kiện hiện tại, tính tổng và tạo DRAFT với khóa chống gửi lặp.
3. Giáo viên kiểm tra/phát hành; chỉ ISSUED và lịch sử từng phát hành mới hiển thị cho gia đình.
4. Ghi tiền thực tế đã thu; phương thức CASH/BANK_TRANSFER/OTHER chỉ là ghi nhận, không thực hiện giao dịch ngân hàng.
5. Số đã thu lấy tổng khoản RECORDED; còn lại = tổng phiếu − đã thu. Trả một phần là PARTIAL, thu đủ là PAID.

Các điều kiện bắt buộc:

- VND là số nguyên, số lượng dòng là số nguyên dương, giảm trừ không làm dòng âm.
- Tổng/đã thu/còn lại do backend tính; không nhận số tổng từ React để tin dùng.
- Chỉ sửa dòng tiền khi DRAFT; phiếu phát hành giữ nguyên điều kiện/số tiền.
- Khoản thanh toán phải dương, không quá số còn lại; khóa giao dịch hoặc version chống hai yêu cầu cùng thu vượt.
- Idempotency key gắn người ghi và hash gồm invoice/payload: retry cùng dữ liệu trả cùng kết quả; khác dữ liệu báo xung đột.
- Khoản nhập sai VOIDED có lý do/lịch sử; không xóa và không suy diễn là hoàn tiền thực tế.
- Không hủy phiếu còn khoản thu hợp lệ. Hủy nháp/phiếu hợp lệ giải phóng các buổi tính phí bằng trạng thái VOIDED, giữ tham chiếu cũ.
- Phí theo buổi có khóa duy nhất cho buổi gốc còn hiệu lực; nhiều phiếu/kỳ không được thu lại cùng buổi đã giữ/tính.
- Phiếu 0 VND hiển thị không còn khoản phải thu, không tạo thanh toán 0.

Tự động hoàn tiền, số dư giữ hộ, gói N buổi trả trước và cổng thanh toán là hướng mở rộng. Chưa có yêu cầu triển khai các nghiệp vụ đó trong bản đầu đề xuất.

## 7. Thông báo

Thông báo lớp có nháp/xuất bản/lưu trữ, tiêu đề và nội dung; gia đình xem theo lớp có quyền và có thể đánh dấu đã đọc. Thông báo cá nhân trong ứng dụng có thể phát sinh sau khi giao bài, gửi sản phẩm, phản hồi, đổi lịch hoặc phát hành phiếu thành công.

Ghi thông báo sau giao dịch nghiệp vụ đã thành công, có dedupe key; kiểm tra lại quyền khi trả thông báo/điều hướng. Không lưu hồ sơ nhạy cảm hoặc token vào payload chỉ để hiển thị badge. Email xác minh/khôi phục là luồng tài khoản riêng; tự gửi mọi thông báo nghiệp vụ qua dịch vụ ngoài chưa nằm trong bản đầu.

## 8. Dữ liệu và API

| Nhóm | Bảng | API chính sau `/api/v1` |
|---|---|---|
| Lịch/điểm danh | `class_schedule_rules`, `class_sessions`, `attendance_records`, `makeup_plans` | schedule-rules, sessions/generate, sessions, attendance-roster, attendance, makeup-plans |
| Nhận xét | `student_notes`, `student_note_attachments` | `/students/{studentId}/notes`, `/student-notes/{noteId}`, các endpoint family |
| Chính sách | `class_tuition_policies`, `enrollment_tuition_agreements` | `/classes/{classId}/tuition-policy`, `/enrollments/{enrollmentId}/tuition-agreements` |
| Khoản thu | `invoices`, `invoice_lines`, `session_charge_entries`, `payments` | `/billing/previews`, `/invoices`, issue/cancel/payments, `/payments/{paymentId}/void` |
| Thông báo | `class_announcements`, `announcement_reads`, `notifications` | announcements, publish/read, notifications và các endpoint family |

Những tên nhóm API rút gọn trong bảng phải tra đường dẫn đầy đủ ở [tổng quan mục 10.5](../01-mo-ta-he-thong.md#s10), rồi ghi chính xác trong OpenAPI khi triển khai module.

<a id="acceptance"></a>
## 9. Nghiệm thu

Tham chiếu `AC-23`–`AC-30`, `AC-38`–`AC-40` ở [bộ gốc](../01-mo-ta-he-thong.md#s13).

- Sinh lịch lại không trùng; đổi lịch không viết lại quá khứ/chỉnh riêng.
- Lớp thay đổi danh sách không làm sai điểm danh cũ; buổi hủy không tính đã học.
- Một lần nghỉ/bù không có hai kế hoạch hoặc hai lần thu còn hiệu lực.
- Nhận xét PRIVATE và tệp riêng không lộ sang gia đình.
- Ví dụ 8 × 100.000 VND, thu 500.000 VND phải còn 300.000 VND; retry không thu hai lần, yêu cầu đồng thời không thu vượt.
- Thỏa thuận riêng và thay đổi giá không đổi phiếu đã chốt; trả cả khóa không giữ quyền sau rời lớp.
- Thông báo có nguồn hợp lệ, không nhân đôi do retry và không dẫn đến dữ liệu ngoài quyền.

