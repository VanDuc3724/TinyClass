# TinyClass — Ghi nhận thanh toán

Cập nhật **03/11/2026** · TC-022, tích hợp màn hình tài chính TC-023. Cô ghi nhận các khoản đã nhận từ gia đình trên phiếu đã phát hành; hệ thống tính tổng còn hiệu lực và phần còn lại. Không thực hiện giao dịch ngân hàng hay hoàn tiền.

## Ghi khoản đã nhận

1. Mở **Phiếu học phí → chọn phiếu đã phát hành → Ghi nhận thanh toán**. Nút xuất hiện khi phiếu còn số tiền cần thu.
2. Nhập **Số tiền đã nhận (VND)**. Mặc định trống để cô chủ động ghi số thực nhận; số nguyên dương, tối đa 1.000.000.000.000 và không vượt phần còn lại.
3. Chọn **Tiền mặt / Chuyển khoản / Khác**. Đây là phương thức cô đã nhận tiền, không khởi tạo một giao dịch chuyển khoản.
4. Chọn **Thời điểm nhận tiền** theo giờ Việt Nam. Có thể ghi khoản nhận trước kỳ học hoặc trước ngày lập phiếu để đối chiếu thu trước. Ngày trong năm 1900–2200, không tương lai; backend chỉ dung sai lệch đồng hồ 60 giây.
5. Nhập ghi chú gửi gia đình và/hoặc ghi chú riêng của cô nếu cần, mỗi trường tối đa 1.000 ký tự, rồi **Lưu khoản đã nhận**.

Sau khi lưu, tổng trên phiếu và lịch sử được cập nhật cùng nhau. Có thể ghi từng phần hoặc nhiều đợt; không có tài khoản học sinh riêng hay yêu cầu phụ huynh phải thao tác trả tiền trong ứng dụng.

## Tổng phiếu, đã thu và còn lại

| Trường hợp | Hiển thị |
|---|---|
| Phiếu đã phát hành, chưa có khoản hợp lệ | Chưa thu; đã thu 0, còn lại bằng tổng phiếu |
| Tổng 800.000, ghi 500.000 | Đã thu một phần; đã thu 500.000, còn lại 300.000 |
| Ghi thêm đúng 300.000 | Đã thu đủ; đã thu 800.000, còn lại 0; không ghi thêm tiền vào phiếu này |
| Phiếu đã phát hành tổng 0 | Không cần thu; không tạo một thanh toán 0 để đánh dấu đã trả |
| Nháp hoặc phiếu đã hủy | Không có trạng thái đang thu và số còn lại; không coi tổng cũ là khoản còn phải trả |

Backend lấy **đã thu = tổng payment RECORDED**, **còn lại = tổng phiếu − đã thu** với phiếu ISSUED. VOIDED không được cộng. Các tổng không nhận từ React và không được lưu riêng để client tự sửa. Danh sách/chi tiết cô và gia đình cùng dùng số liệu backend; trạng thái phiếu DRAFT/ISSUED/CANCELLED tách với trạng thái tiền UNPAID/PARTIAL/PAID/NO_PAYMENT_DUE.

Nguồn điểm danh đổi, bé rời lớp hoặc hồ sơ/lớp được lưu trữ không tự đổi tổng phiếu và không chặn việc đối chiếu khoản đã nhận của phiếu còn ISSUED. Phiếu đã hủy, nháp hoặc đã đủ/không cần thu không nhận khoản mới.

## Điều chỉnh bản ghi nhập sai

Trong **Lịch sử thanh toán**, chọn **Hủy bản ghi** ở khoản nhập sai, xem lại số tiền/ngày rồi nhập **Lý do hủy bản ghi**. Lý do bắt buộc, tối đa 1.000 ký tự và chỉ cô xem. Xác nhận chuyển khoản ghi nhận sang VOIDED.

Số tiền, ngày nhận, phương thức và các ghi chú gốc vẫn được giữ. Chỉ trạng thái, mốc/người điều chỉnh, lý do và phiên bản được bổ sung. Ví dụ hủy bản ghi 500.000 trong phiếu 800.000 khi chưa có khoản khác thì đã thu trở về 0, còn lại 800.000; không có thao tác hoàn tiền thực tế.

**Lịch sử khoản thu** chỉ cô xem, có người thực hiện, thời gian, snapshot trước/sau và lý do riêng. **Lịch sử phiếu** cũng có các sự kiện ghi thu/điều chỉnh và tổng tiền trước/sau. Không sửa đè số tiền/phương thức của một bản ghi đã lưu; khi nhập sai, giữ lịch sử rồi ghi lại khoản đúng nếu cần.

## Chặn hủy phiếu còn khoản thu hợp lệ

Khi còn bất kỳ payment RECORDED nào, nút hủy phiếu được ẩn và backend chặn cả yêu cầu gọi trực tiếp. Không dùng hủy phiếu để xóa khoản đã nhận. Nếu bản ghi là nhập sai thì cô điều chỉnh đúng bản kèm lý do trước; nếu là tiền thực đã nhận thì việc quyết toán/hoàn tiền cần xử lý riêng ngoài phạm vi này.

Sau khi mọi bản ghi nhập sai đã được VOIDED, phiếu mới có thể hủy theo điều kiện hiện có. Hủy phiếu giữ lịch sử các khoản đã điều chỉnh; số còn lại của phiếu đã hủy là null, không hiển thị tổng cũ như một khoản cần nộp.

## Mất kết nối và hai cửa sổ cùng thao tác

Mỗi lần mở biểu mẫu ghi thu có một Idempotency-Key cố định. Nếu backend đã lưu mà phản hồi bị mất, thử lại **cùng số tiền/phương thức/ngày/ghi chú** trả đúng khoản đã có, kể cả lúc số còn lại đã về 0 hoặc bản đó sau này đã VOIDED. Không tự ghi lại một khoản đã điều chỉnh. Nếu sửa nội dung khi chưa rõ lần trước đã lưu chưa, cùng mã gửi sẽ bị từ chối; đối chiếu lịch sử trước khi mở form mới.

Form giữ số tiền, phương thức, ngày và ghi chú/lý do khi 503 hoặc 409. Lỗi được đưa vào vùng nhìn và focus. **Đóng và cập nhật số liệu** hỏi trước khi bỏ bản nhập; sau cập nhật cô xem khoản đã có và mở lại form với số mới nếu cần. Đóng form đang có thay đổi cũng cảnh báo.

Mọi ghi thu/void cần phiên bản invoice hiện tại; void còn cần phiên bản payment. Hai cửa sổ không được cùng dùng số còn lại cũ. Các thao tác dùng cùng khóa lớp → bé → enrollment → invoice với hủy phiếu, nên không đồng thời vừa thu tiền vừa hủy thành công từ cùng phiên bản. Ghi thu/void tăng version invoice trong cùng giao dịch với payment và audit.

Void dùng version thay vì Idempotency-Key. Nếu mất phản hồi, cập nhật để đối chiếu trạng thái đã lưu; gửi phiên bản cũ báo xung đột. Lặp trạng thái đã VOIDED với phiên bản hiện tại không tạo thêm lần hủy/audit và không sửa lý do cũ.

## Gia đình xem thông tin

Gia đình mở **Phiếu học phí → Xem phiếu** để xem tổng/đã thu/còn lại và **Lịch sử thanh toán**. Có cả khoản đã hủy bản ghi để đối chiếu, kèm số tiền/phương thức/ngày nhận, ghi chú công khai và mốc điều chỉnh. Các bản VOIDED được ghi rõ không cộng vào tổng đã thu.

Chỉ email đã xác minh và guardian đúng bé còn hiệu lực được xem, trên phiếu từng phát hành. Không có nháp, ghi chú/lý do riêng, actor, version, key/hash hoặc audit nội bộ. Gia đình không có nút ghi/void hoặc API quản trị tiền.

Đổi bé bỏ dữ liệu cũ, trở về list đúng bé khi đang ở chi tiết. Lịch sử còn sau rời lớp/lưu trữ nếu liên kết còn hiệu lực; revoke chặn tổng/chi tiết/payment list ở yêu cầu tiếp theo. Cập nhật phiếu hoặc lịch sử gặp lỗi quyền sẽ bỏ nội dung cũ. Giờ nhận tiền luôn hiển thị theo Việt Nam kể cả trình duyệt ở múi giờ khác.

## API và dữ liệu

V16 tạo `payments`, không sửa migration cũ. Tiền BIGINT dương có CHECK, trạng thái RECORDED/VOIDED và metadata void bắt buộc; `UNIQUE(recorded_by,idempotency_key)` giữ cả bản đã hủy. Thời điểm lưu UTC, ngày nghiệp vụ theo Việt Nam. Tạo/void ghi audit payment và invoice trong cùng giao dịch. Invoice summary được tổng hợp từ ledger còn hiệu lực.

| API sau `/api/v1` | Chức năng |
|---|---|
| `GET /invoices/{invoice}/payments` | Trang ledger riêng của cô |
| `POST /invoices/{invoice}/payments` | Ghi khoản đã nhận, cần `Idempotency-Key`, `invoiceVersion` |
| `GET /payments/{id}` | Chi tiết riêng của cô |
| `POST /payments/{id}/void` | Điều chỉnh nhập sai, cần payment/invoice version và lý do |
| `GET /payments/{id}/history` | Audit riêng trước/sau |
| `GET /family/children/{child}/invoices/{invoice}/payments` | Trang ledger công khai đúng bé/phiếu từng phát hành |

HTTP 400 cho số/ngày/phương thức/key/field không hợp lệ; 409 cho version cũ, key dùng cho nội dung/phiếu khác, thu quá số còn lại hoặc trạng thái phiếu không nhận thu; 403 cho vai trò/CSRF/email chưa xác minh; 404 cho tài nguyên ngoài quyền. Ghi thành công/retry cùng nội dung trả 201, void trả 200. Response quản trị không có request hash/key; projection gia đình tách riêng.

Hợp đồng chi tiết ở [OpenAPI](spec/openapi.yaml), [plan](plan/2026-11-02-payments.md) và [báo cáo kiểm tra](verification/2026-11-03-payments.md). Không có gateway, tự đối soát ngân hàng, hoàn tiền, tín dụng giữ hộ hoặc phân bổ một khoản cho nhiều phiếu trong mốc này. Drive, thông báo, vận hành/backup thật tiếp tục theo backlog; Google thật và học bù vẫn tạm hoãn.
