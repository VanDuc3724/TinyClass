# TinyClass — Tổng quan và trải nghiệm sử dụng

Cập nhật **03/11/2026**, TC-025. Tổng quan dùng dữ liệu thật, giữ phạm vi lớp/bé và quyền của từng nguồn. Không tự ghi thu, giao bài hoặc điểm danh khi mở một thẻ.

## Tổng quan giáo viên

Mở **Tổng quan**, chọn **Tất cả lớp học** hoặc một lớp trong **Phạm vi thống kê**. Phạm vi nằm trong URL, được giữ khi tải lại/quay về bằng trình duyệt. Nút **Cập nhật tổng quan** lấy số liệu mới; lớp không thuộc quyền trả lỗi và có lối về tất cả lớp.

- **Học sinh đang học:** đếm bé duy nhất có hồ sơ, quan hệ tham gia và lớp đang hoạt động. Một bé trong nhiều lớp chỉ tính một lần khi xem toàn bộ.
- **Bé có mặt hôm nay:** bé duy nhất PRESENT/LATE trên dòng điểm danh còn hiệu lực trong buổi của ngày Việt Nam. **Buổi học hôm nay** gồm SCHEDULED/COMPLETED của lớp đủ điều kiện, bỏ buổi hủy.
- **Sản phẩm chờ duyệt:** lượt đã gửi đang SUBMITTED, gồm công việc lịch sử cô còn được xử lý. Liên kết mở danh sách chờ duyệt theo lớp đang chọn.
- **Lịch dạy hôm nay:** tối đa sáu buổi, giờ Việt Nam, có lối vào lịch tuần/điểm danh. Buổi đã qua giờ không tự thành đã học.
- **Học phí cần theo dõi:** số phiếu còn tiền, số quá hạn, tổng còn phải thu và khoản ghi nhận trong tháng. Có tối đa bốn phiếu ưu tiên cần xem; chọn phiếu để mở chi tiết.
- **Cập nhật gần đây:** tối đa ba mục và số chưa đọc trong lớp đang lọc; mở mục kiểm tra lại quyền nguồn, đánh dấu rồi điều hướng. Hộp cập nhật đầy đủ vẫn thuộc tài khoản cô.
- **Hoạt động hôm nay / Thao tác nhanh / Lớp học:** các dữ liệu và lối vào thật cho thư viện, tải tệp, giao bài, điểm danh, phiếu và bảng tin; thao tác nhanh chỉ mở màn hình tương ứng.

Nếu tải lại lỗi tạm thời, cô thấy lỗi và nhãn đang dùng số liệu tải trước đó; **Thử lại** hoặc **Cập nhật tổng quan** để lấy mới. Đổi phạm vi không dùng dữ liệu lớp trước để lấp màn hình đang tải. Lỗi quyền không giữ tổng cũ.

## Quy tắc tổng tiền

| Chỉ số | Cách tính |
|---|---|
| Phiếu còn phải thu | ISSUED có tổng lớn hơn tổng các payment RECORDED |
| Phiếu quá hạn | Phiếu còn tiền và dueOn trước ngày Việt Nam hiện tại; hạn hôm nay chưa quá hạn |
| Còn phải thu | Tổng phần còn lại của các phiếu trên, gồm lịch sử lớp đã kết thúc/lưu trữ |
| Đã ghi nhận tháng này | Tổng payment RECORDED theo paidAt trong tháng lịch Việt Nam; bỏ VOIDED, không dùng createdAt làm ngày nhận tiền |

Nháp, phiếu hủy và phiếu ISSUED 0 không tạo khoản phải thu. Phiếu 0 vẫn là NO_PAYMENT_DUE, không được coi đã nhận một khoản 0. Hủy bản ghi nhập sai sẽ điều chỉnh cả tổng tháng tương ứng với ngày nhận tiền gốc; không thực hiện hoàn tiền.

Từ dashboard có thể mở **Xem phiếu còn phải thu** hoặc **Xem phiếu quá hạn**. Danh sách phiếu có bộ lọc **Tình hình thu phí**: tất cả, còn phải thu, quá hạn và còn tiền, đã đủ/không cần thu. Bộ lọc này kết hợp với trạng thái/lớp/bé và được áp dụng trước count/page. Chọn các điều kiện không giao nhau sẽ cho danh sách rỗng.

Tổng nhiều phiếu có thể vượt miền số nguyên an toàn của JavaScript. Vì vậy `outstandingAmountVnd` và `receivedThisMonthVnd` trong **dashboard billing** là chuỗi số nguyên, ví dụ `"500000"`; React dùng BigInt/Intl để hiển thị. Không chuyển chúng sang Number. Tiền trên từng phiếu/khoản thu vẫn giữ kiểu số nguyên cũ trong miền đến 1e12.

## Trang chủ và tổng quan gia đình

**Trang chủ** liệt kê các hồ sơ đang liên kết, số hồ sơ và cập nhật của mọi bé phụ huynh còn quyền xem. Đây là phạm vi tài khoản; bộ chọn bé không biến hộp cập nhật chung thành số liệu riêng của một bé. **Cập nhật trang chủ** tải lại cả danh sách và phần tổng quan.

Chọn một bé để mở tổng quan riêng:

1. **Cùng con hôm nay:** số lần giao đang mở/chờ mở, số bài bắt buộc còn lại, số buổi hôm nay và lượt cô đang xem. Một lần giao có thể chứa nhiều bài; các số này dùng đơn vị khác nhau.
2. **Tiếp tục:** mở lần giao đang có bài bắt buộc chưa hoàn thành và bé còn được thực hiện. Ưu tiên hạn gợi ý sớm; không lấy bài chưa mở hoặc bài của lớp đã kết thúc làm việc cần làm mới.
3. **Tiến độ:** đếm các item bắt buộc không phải REFERENCE trong lần giao đang mở mà bé còn được thực hiện. Không hiển thị 0/0 khi chưa có bài bắt buộc; mở video không tự hoàn thành.
4. **Lịch sắp tới:** tối đa ba buổi chưa hủy/chưa bắt đầu, từ bây giờ đến hết bảy ngày tiếp theo, theo quyền lịch hiện tại.
5. **Phản hồi gần đây:** tối đa ba lượt đã được cô chấp nhận/yêu cầu bổ sung; mở lịch sử sản phẩm để xem chi tiết.
6. **Học phí / Bảng tin / Cập nhật:** tiền chỉ của đúng bé, bảng tin theo lớp còn quyền và dấu đọc bản hiện tại, cập nhật theo nguồn còn quyền. Mỗi khối có lối vào danh sách/chi tiết đầy đủ.

**Cập nhật thông tin** trên hồ sơ lấy lại cả tổng quan của bé. **Góc học của bé** có thêm **Cập nhật góc học**, giữ phân trang đầy đủ và tên truy cập tiến độ theo hoạt động. Các form sản phẩm/phản hồi hiện có tiếp tục giữ bản nhập theo cơ chế riêng, không bị thay bằng một form trên dashboard.

## Quyền khi rời lớp hoặc thu hồi liên kết

Rời lớp/lưu trữ dừng bài, lịch và bảng tin theo quy tắc của nguồn. Lớp đã kết thúc có thể giữ bài ở chế độ xem lại; các bài chưa xong trong chế độ này không trở thành việc bắt buộc còn phải làm trên tổng quan.

Sản phẩm đã gửi, phản hồi và phiếu/ghi thu đúng bé vẫn còn trong lịch sử khi guardian còn hiệu lực. Rời lớp không tự hoàn tiền, đổi tổng phiếu hoặc cấp lại bài. Thu hồi guardian chặn toàn bộ tổng quan của bé ở yêu cầu tiếp theo; giao diện bỏ các khối cũ khi nhận lỗi quyền. Đổi bé thay nguồn truy vấn và nội dung, không ghép dữ liệu từ hai bé.

Backend không gửi ghi chú/lý do riêng, request/hash, version quản trị hoặc audit trong tổng quan gia đình. Các khối học/bảng tin/cập nhật dùng lại điều kiện quyền từ module gốc trước count/limit. Dữ liệu đang tải, rỗng và lỗi có trạng thái riêng; các số chưa có phản hồi không bị tự thay thành 0.

## API và dữ liệu

| API sau `/api/v1` | Chức năng |
|---|---|
| `GET /dashboard?classId=...` | Tổng quan chủ hệ thống, kiểm tra classId thuộc cô và áp dụng phạm vi |
| `GET /family/dashboard` | Tổng quan tài khoản phụ huynh đã xác minh, số hồ sơ liên kết và cập nhật còn quyền |
| `GET /family/children/{child}/dashboard` | Tổng quan đúng bé, cần guardian hiệu lực; các preview bị giới hạn |
| `GET /invoices?collection=OPEN/OVERDUE/SETTLED` | Lọc tình hình thu phí trước phân trang, dùng cùng định nghĩa với dashboard |

Read model dùng giao dịch REPEATABLE_READ và ngày nghiệp vụ Việt Nam; không thêm bảng/migration trong TC-025. V1–V17 giữ nguyên. Preview không thay danh sách nguồn có phân trang; classOptions chỉ chứa lớp của cô. Mở cập nhật vẫn đi qua POST read có CSRF và kiểm tra nguồn hiện tại.

Xem [OpenAPI](spec/openapi.yaml), [plan](plan/2026-11-03-dashboard.md), [báo cáo/ảnh](verification/2026-11-03-dashboard.md). Google thật, Drive, học bù, SMTP ngoài, tải thử và backup/vận hành thật tiếp tục theo backlog; hoàn thành tổng quan không đồng nghĩa đã nghiệm thu phát hành toàn hệ thống.
