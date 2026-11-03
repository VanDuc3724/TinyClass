# TinyClass — Cấu hình học phí

Cập nhật 02/11/2026 · TC-020. Cô đặt mức mặc định của lớp rồi lưu điều kiện riêng cho từng bé. Mốc này lưu điều kiện và lịch sử, chưa tính khoản phải thu, phát hành phiếu hoặc ghi nhận thanh toán.

TC-021 đã bổ sung [phiếu học phí](14-phieu-hoc-phi.md). Khi thỏa thuận có phiếu chưa hủy, thay/kết thúc không cắt phần ngày đã lập phiếu; hủy nguồn cần xử lý các phiếu trước. Bên dưới mô tả phần cấu hình TC-020.

## Thiết lập cho lớp

Mở **Lớp học → chọn lớp → Học phí → Thiết lập học phí**. Lớp ở trạng thái chuẩn bị hoặc đang dạy được chỉnh chính sách; lớp kết thúc/lưu trữ chỉ xem lại.

| Cách tính | Cần nhập |
|---|---|
| Theo buổi | Đơn giá mỗi buổi; chọn riêng có/không tính phí khi nghỉ có phép và nghỉ chưa báo |
| Cố định theo tháng | Mức mỗi tháng; giữ mức thỏa thuận hoặc cô điều chỉnh khi chốt kỳ |
| Trọn khóa | Tổng phí, tên khóa tính phí; số buổi dự kiến tùy chọn; chọn quy tắc khi bé nghỉ |

**Thời điểm thu dự kiến** được chọn riêng: đầu kỳ, cuối kỳ hoặc đóng trước. Không tự chọn chính sách nghỉ hay thời điểm thu thay cô. Tiền là VND nguyên, từ 0 đến 1.000.000.000.000; 0 cho phép ghi điều kiện miễn phí. Số tiền kiểm thử không dùng làm mặc định. Chỉ nhập tham số tương ứng cách tính đã chọn; khi đổi cách tính trong biểu mẫu, cần nhập lại số tiền/quy tắc phù hợp.

Trọn khóa là một đợt tính phí có tên riêng, không bắt buộc gắn với khóa trong thư viện. Số buổi dự kiến từ 1–10.000 nếu nhập, không tạo gói tín dụng hoặc quyết định hoàn thành bài học.

**Điều kiện chia sẻ với gia đình** tối đa 5.000 ký tự. **Ghi chú riêng của cô** cũng tối đa 5.000 ký tự, chỉ giáo viên xem. Policy lớp chưa được chia sẻ trực tiếp cho gia đình; chỉ điều kiện cô lưu cho từng bé mới hiện ở tài khoản phụ huynh.

Sửa chính sách cần phiên bản hiện tại và lý do riêng (tối đa 1.000 ký tự). Thay đổi mức mặc định **không đổi thỏa thuận đã lưu của bé**. Lịch sử chính sách giữ nội dung trước/sau, cô thực hiện, thời gian và lý do.

## Lưu điều kiện riêng cho bé

Trong tab Học phí chọn **Học phí của [tên bé] → Thêm thỏa thuận**. Cũng có lối vào từ dòng học sinh trong lớp. Tạo/thay mức cần lớp, hồ sơ và quan hệ tham gia đều đang hoạt động.

- **Sao chép chính sách lớp:** xem lại mức hiện tại rồi lưu. Hệ thống kiểm tra phiên bản chính sách và tạo bản sao riêng; không liên kết động giá của bé với giá lớp.
- **Thiết lập riêng cho bé:** có thể bắt đầu từ các giá trị hiện có rồi sửa đầy đủ. Giá và quy tắc của bé khác được giữ nguyên.
- Chọn **Ngày bắt đầu áp dụng** và **Ngày cuối áp dụng** nếu có. Khoảng bao gồm cả hai ngày; để trống ngày cuối nếu chưa ấn định và lớp chưa có ngày kết thúc. Với lớp có ngày kết thúc, phải đặt ngày cuối không vượt ngày đó.
- Bắt đầu không trước ngày bé tham gia/ngày bắt đầu lớp. Tạo khoảng ban đầu cho phép ngày đã qua nếu hợp lệ và không trùng; giao diện mặc định ngày hiện tại hoặc ngày bắt đầu hợp lệ sắp tới. Ngày hợp lệ trong năm 1900–2200 theo giờ Việt Nam.
- Bấm **Lưu và chia sẻ điều kiện**. Phụ huynh được liên kết với đúng bé sẽ thấy mức phí, điều kiện công khai và ngày áp dụng.

Mỗi quan hệ bé–lớp không có hai khoảng ngày hiệu lực trùng nhau. Hai khoảng cùng chứa một ngày cuối/đầu cũng bị coi là trùng. Ví dụ bản cũ hết ngày 10 thì bản tiếp theo sớm nhất bắt đầu ngày 11. Khoảng đã hủy không giữ ngày hiệu lực.

## Thay mức, kết thúc và hủy

**Thay mức học phí** tạo bản mới, giữ giá và điều kiện cũ. Ngày thay từ hôm nay trở đi và nằm trong khoảng của bản gốc. Bản cũ kết thúc vào ngày liền trước ngày đổi; toàn bộ thao tác thành công cùng nhau. Nếu thay đúng ngày bắt đầu của bản cũ (hôm nay hoặc tương lai), bản cũ được giữ với trạng thái **Đã hủy** thay vì tạo khoảng ngày ngược. Cô cần nhập lý do cho mỗi lần thay.

**Kết thúc hiệu lực** chỉ rút ngắn ngày cuối từ hôm nay trở đi, không kéo dài bản cũ hoặc sửa các ngày đã qua. Ngày cuối vẫn bao gồm trong thỏa thuận. Bản đã đặt kết thúc tương lai vẫn hiển thị **Đang áp dụng** hoặc **Sắp áp dụng** cho đến đúng mốc ngày; trạng thái hiển thị được tính theo ngày Việt Nam.

**Hủy điều kiện** chỉ dành cho bản bắt đầu hôm nay hoặc tương lai, chưa qua ngày áp dụng trước đó. Bản đã áp dụng từ ngày trước cần kết thúc phần tương lai hoặc tạo mức thay thế. Hủy giữ nguyên nội dung/ngày và lịch sử, không xóa và không ghi nhận hoàn tiền.

Sau khi bé rời lớp/hồ sơ lưu trữ hoặc lớp đóng, cô vẫn xem và có thể kết thúc/hủy phần tương lai theo các điều kiện trên; không tạo/thay mức mới. Việc rời lớp không tự đóng thỏa thuận. Cô cần đối chiếu và kết thúc ngày áp dụng phù hợp. Dữ liệu hiện tại không tái dựng đầy đủ mọi khoảng gián đoạn tham gia trong quá khứ.

Chọn **Lịch sử thay đổi** để xem snapshot trước/sau và lý do riêng. Bản đã bị thay/hủy chỉ được xem lại. TC-021 phải dùng đúng khoảng ngày, bỏ bản CANCELLED và bảo vệ các điều kiện đã dùng khi triển khai phiếu; TC-020 chưa có phiếu hay liên kết sử dụng khoản thu.

## Lỗi kết nối và hai cửa sổ cùng sửa

Biểu mẫu giữ chữ, nguồn điều kiện, ngày và lý do khi nhận lỗi lưu. Lỗi chung được đưa vào vùng nhìn và nhận focus. Nếu phiên bản chính sách/thỏa thuận đã thay đổi, cần đối chiếu bản mới; **Đóng và cập nhật dữ liệu** hỏi trước khi bỏ bản nhập. Đóng biểu mẫu hoặc rời trình duyệt khi có thay đổi cũng có cảnh báo.

Tạo/thay dùng mã yêu cầu cố định theo lần mở biểu mẫu. Nếu backend đã lưu nhưng phản hồi bị mất, lưu lại **cùng nội dung** trả về đúng bản đã có, không tạo thêm và không sao chép lại chính sách vừa đổi. Nếu đổi nội dung trong khi chưa biết lần trước đã lưu chưa, đóng/cập nhật để đối chiếu rồi mở biểu mẫu mới. Sửa policy, kết thúc và hủy dùng phiên bản; phản hồi mất có thể cần cập nhật để xem kết quả đã lưu.

## Gia đình xem điều kiện

Từ hồ sơ bé hoặc menu gia đình chọn **Điều kiện học phí**. Đổi bé giữ trang học phí và tải đúng dữ liệu bé mới. Có phân trang và nút **Cập nhật**.

Gia đình cần email đã xác minh và liên kết với đúng bé còn hiệu lực. Danh sách/chi tiết chỉ chứa mức phí, điều kiện công khai, ngày và trạng thái của bé; không có mặc định lớp, giá bé khác, ghi chú riêng, lý do, nguồn/phiên bản policy, mã yêu cầu/hash, version hoặc audit. Lịch sử điều kiện đã kết thúc/đã hủy vẫn được xem sau rời lớp/lưu trữ nếu còn liên kết phụ huynh. Thu hồi liên kết chặn ở yêu cầu tiếp theo và giao diện bỏ dữ liệu cũ khi nhận lỗi quyền.

Điều kiện trọn khóa/đóng trước không cấp quyền xem bài của lớp sau khi rời lớp. Quyền học liệu vẫn theo quan hệ và lần giao hiện có. Không có phép tính từ điều kiện tự do, xử lý học bù, cổng thanh toán, số dư giữ hộ hoặc tự hoàn tiền trong mốc này.

## Dữ liệu và API đã triển khai

V12 tạo `class_tuition_policies` (duy nhất theo lớp) và `enrollment_tuition_agreements` (bản điều kiện theo enrollment). Tiền lưu `BIGINT` kèm kiểm tra miền, API kiểm tra BigDecimal trước chuyển số nguyên để từ chối tiền lẻ. Mỗi lần ghi khóa theo lớp → bé → enrollment và kiểm tra khoảng ngày trong cùng giao dịch. Agreement giữ nguồn POLICY/CUSTOM, source policy version khi sao chép, ngày, trạng thái ACTIVE/ENDED/CANCELLED, bản thay thế, private note/reason, version/timestamps và client request/hash.

| API sau `/api/v1` | Chức năng |
|---|---|
| `GET/PUT /classes/{id}/tuition-policy` | Workspace chính sách lớp; tạo/cập nhật |
| `GET /classes/{id}/tuition-policy/history` | Lịch sử riêng của policy |
| `GET/POST /enrollments/{id}/tuition-agreements` | Workspace phân trang; tạo thỏa thuận |
| `GET /tuition-agreements/{id}` | Chi tiết riêng cho cô |
| `POST /tuition-agreements/{id}/replace` | Thay mức theo ngày |
| `POST /tuition-agreements/{id}/end` | Rút ngắn ngày cuối |
| `POST /tuition-agreements/{id}/cancel` | Hủy bản chưa áp dụng qua ngày trước |
| `GET /tuition-agreements/{id}/history` | Audit riêng cho cô |
| `GET /family/children/{child}/tuition-agreements` | Workspace công khai đúng bé |
| `GET /family/children/{child}/tuition-agreements/{id}` | Chi tiết công khai đúng bé |

Hợp đồng field/paging/lỗi ở [OpenAPI](spec/openapi.yaml). Kết quả TC-020 ở [báo cáo cấu hình](verification/2026-11-02-tuition-settings.md). TC-021 đã có [preview/phiếu](14-phieu-hoc-phi.md); bước tiếp theo là ghi nhận thanh toán TC-022. Google thật và học bù tiếp tục tạm hoãn.
