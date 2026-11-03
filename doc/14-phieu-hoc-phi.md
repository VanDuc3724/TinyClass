# TinyClass — Lập và phát hành phiếu học phí

Cập nhật 02/11/2026 · TC-021. Cô xem gợi ý từ thỏa thuận/điểm danh, chuẩn bị nháp, rồi chủ động phát hành cho gia đình. Phiếu chưa phải bản ghi tiền đã thu; ghi nhận thanh toán thuộc TC-022.

## Bắt đầu từ thỏa thuận của bé

1. Mở **Lớp học → chọn lớp → Học phí → chọn bé**.
2. Chọn **Lập phiếu** trên thỏa thuận muốn dùng. Bản đã hủy không lập phiếu mới. Giá/quy tắc lấy từ bản của bé, không lấy giá mặc định mới của lớp.
3. Chọn ngày đầu/ngày cuối kỳ và bấm **Xem trước khoản thu**. Khoảng gồm cả hai ngày, tối đa 366 ngày, trong năm 1900–2200, nằm trong thỏa thuận, ngày lớp và thời gian tham gia. Khi bé đã rời lớp, kỳ không kéo dài sau ngày rời; vẫn có thể đối chiếu/lập phiếu cho thời gian trước đó.
4. Kiểm tra gợi ý/các buổi chưa tính, chỉnh các dòng và ghi chú rồi **Lưu phiếu nháp**. Nháp chỉ cô xem. Muốn thay kỳ thì kiểm tra nguồn lại trước khi lưu.

Mục **Phiếu học phí** trong menu giáo viên có danh sách, lọc nháp/đã phát hành/đã hủy, phân trang và cập nhật. Nút lập mới hướng dẫn chọn thỏa thuận từ lớp. Có lối vào danh sách theo bé từ trang thỏa thuận và chi tiết phiếu; lọc trong URL được áp dụng trước khi đếm/phân trang.

## Gợi ý theo từng cách tính

| Cách tính | Gợi ý và điều kiện |
|---|---|
| Theo buổi | Điểm danh đúng enrollment, trong ngày bắt đầu buổi theo giờ Việt Nam, dòng còn hiệu lực; buổi đã hoàn thành và đã kết thúc. Có mặt/đi muộn tính một buổi; nghỉ tính theo lựa chọn rõ trong thỏa thuận. Buổi hủy, chưa hoàn thành, UNMARKED, dòng đã loại hoặc đang được phiếu khác giữ/tính không được gợi ý |
| Cố định theo tháng | Mỗi phiếu thuộc một tháng lịch. Kỳ đủ từ ngày 1 đến ngày cuối tháng mới gợi ý đủ mức tháng. Kỳ lẻ không tự chia tiền theo ngày; cô nhập khoản thủ công và lý do theo thỏa thuận |
| Trọn khóa | Gợi ý tổng đã thỏa thuận, một phiếu chưa hủy cho mỗi bản thỏa thuận. Không tự tạo tín dụng N buổi hoặc chia thành các khoản thu trước. Các lần thực tế gia đình trả sẽ được ghi riêng ở TC-022 |

Khoảng phí cố định của cùng quan hệ tham gia không chồng với phiếu cố định khác chưa hủy. Nháp cũng giữ khoảng này. Với trọn khóa, đổi sang khoảng ngày khác không lập lại tổng phí từ cùng thỏa thuận. Hủy phiếu đúng trước khi lập lại nếu cần điều chỉnh.

Gợi ý tối đa 500 dòng điểm danh; chọn kỳ ngắn hơn nếu vượt giới hạn. Khi tổng gợi ý vượt 1.000.000.000.000 VND, preview vẫn cho xem và cảnh báo để cô bỏ bớt/chia phiếu; không ghi một tổng vượt miền. Chọn **Các buổi chưa được tính** để thấy lý do, gồm mã phiếu đang giữ buổi nếu có.

Nếu thỏa thuận tháng/trọn khóa chọn cô điều chỉnh khi nghỉ, màn hình nhắc đối chiếu; chưa tự tính giảm theo số ngày nghỉ. Học bù tiếp tục tạm hoãn và không có phép tính học bù trong phiếu.

## Dòng tiền, hạn và ghi chú

- Dòng theo buổi/tháng/trọn khóa giữ số lượng 1 và đơn giá từ thỏa thuận. Dòng theo buổi phải trỏ đúng một điểm danh đủ điều kiện, không được trùng trong cùng phiếu hoặc phiếu chưa hủy khác.
- Có thể bỏ dòng chưa muốn tính, nhập giảm trừ hoặc **Thêm khoản thủ công**. Khoản OTHER không gắn điểm danh, dành cho khoản cô nhập rõ như học cụ/điều chỉnh kỳ lẻ. Không dùng khoản thủ công để bỏ qua việc đối chiếu các buổi đã được tính.
- Số lượng là số nguyên 1–10.000; tiền/giảm trừ là VND nguyên 0–1.000.000.000.000, không làm tròn tiền lẻ. Tiền dòng = số lượng × đơn giá − giảm trừ, không âm; mỗi dòng và tổng phiếu không vượt miền. Backend tính lại toàn bộ, không tin tổng React gửi lên.
- Giảm trừ hoặc khoản thủ công cần **Lý do điều chỉnh khoản thu**, tối đa 1.000 ký tự, chỉ cô xem. Các ví dụ trong kiểm thử không được dùng làm mức tiền mặc định.
- **Hạn thanh toán** tùy chọn, trong năm 1900–2200 và độc lập với kỳ học. Có thể đặt trước ngày đầu/cuối kỳ để thu trước. Thời điểm thu trong thỏa thuận không tự trừ tiền hoặc tự ghi thanh toán.
- **Ghi chú gửi gia đình** được chia sẻ khi phát hành; **Ghi chú riêng của cô** chỉ cô xem, mỗi trường tối đa 5.000 ký tự.

Tổng dự kiến trên form chỉ hỗ trợ đối chiếu; sau lưu, dùng tổng backend trả về. Có thể lưu nháp chưa có dòng để chuẩn bị, nhưng phát hành cần ít nhất một dòng. Phiếu 0 VND hợp lệ khi có dòng miễn/giảm phí; không suy diễn rằng đã ghi nhận một thanh toán 0.

## Sửa, phát hành và hủy

**Sửa phiếu nháp** giữ bé/thỏa thuận của phiếu; cần phiên bản hiện tại và lý do sửa. Bấm xem trước để kiểm tra nguồn; các dòng cũ và ghi chú được giữ để đối chiếu. **Dùng các dòng gợi ý** là thao tác riêng để thay danh sách dòng, có cảnh báo khi đang có bản nhập chỉnh sửa. Các dòng/charge cũ được giữ trong lịch sử thay vì xóa.

**Phát hành phiếu** hiển thị tổng để cô xác nhận. Backend kiểm tra lại phiên bản, nguồn và các buổi đang giữ. Nháp chuyển ISSUED, buổi đang giữ chuyển CHARGED; chỉ sau đó gia đình còn liên kết mới xem được. Phiếu đã phát hành không sửa nội dung/giá/dòng/ghi chú âm thầm.

**Hủy phiếu** cần lý do riêng, giữ mã/giá/dòng/ngày và lịch sử, chuyển CANCELLED; các charge RESERVED/CHARGED chuyển VOIDED để buổi được đối chiếu/lập lại. Bản từng phát hành vẫn hiện với gia đình là đã hủy; nháp bị hủy chưa từng phát hành vẫn riêng. Hủy không thực hiện hoàn tiền. TC-022 đã chặn hủy phiếu khi còn bất kỳ khoản RECORDED nào. Chỉ hủy bản ghi nhập sai kèm lý do để điều chỉnh; thao tác này không thực hiện hoàn tiền.

**Lịch sử phiếu** chỉ cô xem: nội dung trước/sau, trạng thái, dòng tiền, ghi chú và lý do riêng, người thực hiện/thời gian. Không có endpoint audit cho phụ huynh. Mã dạng `TC-năm-số thứ tự` duy nhất; số thứ tự có thể có khoảng trống khi một giao dịch bị hủy/rollback, không dùng để suy ra số phiếu hiệu lực.

## Khi điểm danh hoặc thỏa thuận thay đổi

Nháp giữ các buổi đã chọn để hai cửa sổ/phiếu không cùng tính một lần tham gia. Preview không giữ buổi; tạo/sửa nháp tính lại nguồn trong giao dịch. Nguồn hoặc phiên bản thay đổi thì báo 409, không ghi một phần. Nháp cần kiểm tra/lưu lại trước khi phát hành; không lấy gợi ý cũ như số tiền chắc chắn.

Màn hình điểm danh có cảnh báo và liên kết tới các phiếu đang giữ/tính buổi. Sửa trạng thái/loại bé/hủy buổi sau lập phiếu không tự viết lại khoản thu; chi tiết phiếu cảnh báo nguồn đã thay đổi. Cô đối chiếu và quyết định hủy/lập lại nếu cần. Phiếu đã phát hành luôn giữ snapshot cũ.

Thay/kết thúc thỏa thuận không được cắt ngày nằm trong phiếu chưa hủy. Hủy thỏa thuận cần xử lý các phiếu trước; trọn khóa đã có phiếu chưa hủy không được thay thành tổng mới để lập lại cả khóa. Đổi policy mặc định vẫn độc lập. Thay giá từ ngày sau phần đã lập phiếu được phép với thỏa thuận không phải trọn khóa; lịch sử cũ giữ nguyên.

## Lỗi mạng và gửi lại

Form giữ ngày/dòng/ghi chú/lý do khi lưu lỗi; đưa lỗi chung vào vùng nhìn và focus. Bản dùng phiên bản cũ không ghi đè bản mới. **Tải lại dữ liệu đã lưu** hỏi trước khi bỏ bản nhập. Có liên kết **Đối chiếu danh sách phiếu** nếu chưa rõ lần lưu trước đã thành công chưa. Đóng/rời form qua liên kết khi có thay đổi có cảnh báo; tải lại/đóng trình duyệt cũng cảnh báo.

Mỗi lần mở form tạo có clientRequestId và hash nội dung. Mất phản hồi sau khi backend lưu thành công: gửi lại **cùng dữ liệu** trả đúng phiếu cũ, không giữ/tính thêm buổi, kể cả phiếu sau đó đã hủy. Nội dung khác cùng mã bị từ chối; đối chiếu phiếu đã có trước khi mở form mới. Sửa/phát hành/hủy dùng version và cần cập nhật nếu phản hồi bị mất.

## Gia đình xem phiếu

Từ hồ sơ, menu hoặc **Điều kiện học phí → Phiếu học phí của bé**. Chỉ email đã xác minh và guardian đúng bé còn hiệu lực được xem. Đổi bé khi đang ở chi tiết đưa về danh sách phiếu của bé mới; không giữ mã phiếu bé trước.

Danh sách/chi tiết chỉ gồm bản từng phát hành của đúng bé, cả bản đã hủy sau phát hành. Có tổng phiếu, kỳ/hạn, dòng tiền, snapshot điều kiện, ghi chú công khai và mốc phát hành/hủy. Không có nháp, ghi chú/lý do riêng, version/review key/request/hash, nguồn điểm danh hoặc audit. TC-022/023 đã bổ sung số đã thu/còn lại và lịch sử thanh toán; xem [hướng dẫn ghi thu](15-thanh-toan.md).

Lịch sử vẫn xem sau rời lớp/lưu trữ khi guardian còn hiệu lực; không cấp lại bài học. Thu hồi guardian chặn danh sách/chi tiết ở yêu cầu tiếp theo. Khi cập nhật gặp lỗi quyền, giao diện bỏ nội dung phiếu cũ.

## API và dữ liệu

V13 tạo invoices/invoice_lines/session_charge_entries và sequence mã; V14–V15 hoàn thiện hạn thu trước và ràng buộc ngày có tên rõ. Có FK, unique request, unique charge còn hiệu lực theo root attendance, số tiền/số lượng/ràng buộc trạng thái. Các ghi phiếu khóa lớp → bé → enrollment → invoice, dùng cùng khóa lớp với điểm danh/thỏa thuận. Không có payments table/API trong task này.

| API sau `/api/v1` | Chức năng |
|---|---|
| `POST /billing/previews` | Xem nguồn/gợi ý, không ghi dữ liệu; vẫn cần session/CSRF |
| `GET/POST /invoices` | Danh sách giáo viên/tạo nháp |
| `GET/PUT /invoices/{id}` | Chi tiết cô/sửa nháp |
| `POST /invoices/{id}/issue` | Xác nhận phát hành |
| `POST /invoices/{id}/cancel` | Hủy và giải phóng các buổi |
| `GET /invoices/{id}/history` | Audit riêng của cô |
| `GET /family/children/{child}/invoices` | Workspace gồm bé và trang phiếu từng phát hành |
| `GET /family/children/{child}/invoices/{id}` | Chi tiết công khai đúng bé |

Schema/paging/lỗi ở [OpenAPI](spec/openapi.yaml). Phạm vi triển khai ở [plan](plan/2026-11-02-invoices.md); kết quả mốc phiếu ở [báo cáo TC-021](verification/2026-11-02-invoices.md). TC-022/023 đã bổ sung ghi thu/void, tổng tiền, lịch sử gia đình và chặn hủy phiếu còn khoản RECORDED; xem [hướng dẫn](15-thanh-toan.md). Google thật, Drive và học bù tiếp tục theo phạm vi đã hoãn.
