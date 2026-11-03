# TinyClass — Bằng chứng tổng quan và trải nghiệm TC-025

Ngày kiểm tra: **03/11/2026**. Phạm vi: tổng quan giáo viên theo lớp, tổng quan tài khoản gia đình/đúng bé, tiến độ/tiếp tục, lịch/phản hồi/học phí/bảng tin/cập nhật và các trạng thái rỗng/lỗi/mất quyền. [Hướng dẫn](../17-tong-quan-va-trai-nghiem.md), [plan](../plan/2026-11-03-dashboard.md), [OpenAPI](../spec/openapi.yaml).

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| `Backend/mvnw.cmd -B verify` | **196 test đạt**, không lỗi/skip; executable JAR tạo thành công |
| HTTP tổng quan | **12 DashboardTests đạt**: tiền, khoảng thời gian, lớp/bé, quyền nguồn, lịch sử, preview và trạng thái rỗng |
| Migration | **10 test đạt**; V1–V17 từ schema rỗng/nâng các mốc trước; TC-025 không thêm migration |
| Production build | TypeScript/Vite đạt qua pretest:e2e; main JS khoảng 449 kB, giữ các trang tải riêng hiện có |
| `npm.cmd run lint` | oxlint đạt, không cảnh báo |
| `npm.cmd run test:e2e` | **44 E2E Edge đạt**, gồm ba luồng tổng quan mới; khoảng 4,9 phút, exit 0; .last-run.json passed và không failedTests |
| OpenAPI 0.0.15 | **157 path, 186 operation, 272 schema, 2.339 tham chiếu** hợp lệ, operationId duy nhất |
| Tài liệu/mã nguồn | 51 tệp Markdown, 523 liên kết nội bộ hợp lệ; không thấy ba giá trị bí mật local trong 305 tệp nguồn đã rà |
| `git diff --check` | Đạt, không lỗi khoảng trắng |

Maven và E2E chạy tuần tự trên PostgreSQL/Mailpit test riêng. E2E dùng bundle production và API/database thật, với tài khoản/tên/nội dung giả. Provider OIDC thử nghiệm không kết nối Google thật. Lỗi 503 của tổng quan được mô phỏng; thay đổi quyền/rời lớp/lưu trữ dùng request nghiệp vụ thật. Database/volume phát triển được giữ nguyên.

## Hành vi đã xác nhận

- Tổng quan cô chỉ nhận lớp của cô; classId ngoài quyền trả 404 và có lối về tất cả lớp. Đổi lớp, tải lại và quay về giữ đúng phạm vi URL. Các số lớp/bé/điểm danh/lịch và sản phẩm chờ duyệt tiếp tục lấy từ dữ liệu thật; không tự tạo nghiệp vụ khi bấm một thẻ.
- Chỉ ISSUED còn tiền góp vào khoản phải thu; nháp/hủy/0 VND không tạo khoản nợ giả. Số còn lại trừ các khoản RECORDED, bỏ VOIDED. Quá hạn cần dueOn trước ngày Việt Nam và vẫn còn tiền; hạn hôm nay không quá hạn. Bộ lọc OPEN/OVERDUE/SETTLED dùng cùng định nghĩa trước count/page và kết hợp các bộ lọc cũ.
- Khoản ghi nhận tháng này dựa trên paidAt trong khoảng tháng Asia/Ho_Chi_Minh, không phải createdAt. Biên tháng và void khoản cũ có kiểm tra. Tổng VND dùng chuỗi nguyên/BigInt; fixture 9.008 phiếu cho đúng **9.007.199.254.740.993 VND**, JSON vẫn là `"9007199254740993"` ở cả cô và gia đình, không bị làm tròn bởi Number.
- Trang chủ gia đình có cập nhật toàn tài khoản theo nguồn còn quyền; hồ sơ bé có dữ liệu riêng, không cộng tiền hoặc việc của bé khác. Ngày nghiệp vụ vẫn đúng Việt Nam khi trình duyệt ở America/Los_Angeles. Tài khoản chưa xác minh, sai vai trò, bé không liên kết và truy cập ẩn danh bị chặn.
- Tiến độ chỉ gồm bài bắt buộc đang mở mà bé còn được thực hiện; REFERENCE/future không làm tăng việc cần làm. Không hiện tỷ lệ 0/0 khi chưa có bài; continueAssignment null khi không còn việc. Xác nhận hoàn thành qua hoạt động thật rồi quay về làm mới tiến độ; bài của lớp COMPLETED chỉ xem lại không trở thành việc phải làm mới.
- Lịch sắp tới chỉ SCHEDULED chưa bắt đầu theo quyền lịch hiện tại, đến hết bảy ngày tiếp theo; bỏ buổi hủy/ngoài khoảng và giới hạn ba. Phản hồi gần đây dùng lịch sử công khai, nhãn ACCEPTED theo ngữ cảnh sản phẩm. Bảng tin chưa đọc theo revision hiện tại, sửa làm cần đọc lại.
- Các preview mới giới hạn ba mục, phiếu bốn; lịch cô hôm nay giữ tối đa sáu buổi như trước. Điều kiện nguồn áp dụng trước count/limit. Mở cập nhật từ tổng quan kiểm tra lại quyền và POST read có CSRF, dùng đường dẫn mới từ backend rồi cập nhật chuông. Tổng quan không chứa ghi chú/lý do riêng, audit, request/hash hay version quản trị của gia đình.
- Rời lớp bỏ bài/lịch/bảng tin và cập nhật từ các nguồn đó; giữ phí và phản hồi lịch sử đúng bé khi guardian còn hiệu lực. Lưu trữ lớp không làm mất khoản phải thu của cô. Thu hồi guardian chặn toàn bộ tổng quan bé ở request tiếp theo; UI cập nhật bỏ các khối cũ, hồ sơ của bé khác vẫn hoạt động.
- Lỗi tổng quan 503 cùng phạm vi giữ số liệu tải trước với thông báo rõ; retry lấy lại dữ liệu. Đổi phạm vi hoặc lỗi quyền không ghép dữ liệu cũ vào trang mới. Form sản phẩm/phản hồi/thu phí hiện có giữ cơ chế nháp; không thêm nút reload vào form đang nhập sản phẩm.
- Ảnh và kiểm tra trình duyệt đã phát hiện/sửa lỗi tên bé bị bó thành cột hẹp do flex ở layer base ghi đè layer features; kiểm tra chiều rộng tên ở 375/320px. Bộ cũ tiếp tục kiểm tra sáu breakpoint, drawer/focus/Escape, zoom 200% và cuối trang trên thanh điều hướng cố định. Các ảnh tổng quan không tràn ngang.

## Ảnh minh chứng

10 ảnh từ lần chạy đạt 44 luồng, dữ liệu giả. Đã rà bố cục desktop/mobile, phạm vi tiền, tiến độ và các trạng thái lỗi/quyền. Ảnh toàn trang gia đình giữ thanh điều hướng cố định tại vị trí viewport khi chụp; phần dưới vẫn cuộn tới được, có khoảng trống cuối trang.

| Màn hình | Ảnh |
|---|---|
| Cô lọc một lớp, còn phải thu/quá hạn/ghi nhận tháng đúng phạm vi | [1440px](assets/2026-11-03-dashboard-teacher-scoped-desktop.png) |
| Tổng quan cô, khoản phí và liên kết trên điện thoại | [375px](assets/2026-11-03-dashboard-teacher-scoped-375.png) |
| Lỗi 503, còn dữ liệu tải trước và có thử lại | [375px](assets/2026-11-03-dashboard-teacher-retry-375.png) |
| Trang chủ gia đình với cập nhật toàn tài khoản | [375px](assets/2026-11-03-dashboard-family-home-375.png) |
| Tổng quan riêng bé, tiến độ/lịch/phản hồi/phí/bảng tin | [1440px](assets/2026-11-03-dashboard-family-child-desktop.png) |
| Tiếp tục hoạt động và tổng quan bé trên điện thoại | [375px](assets/2026-11-03-dashboard-family-child-375.png) |
| Đổi sang bé khác, không giữ bài/tiền/tiến độ của bé trước | [320px](assets/2026-11-03-dashboard-family-other-child-320.png) |
| Rời lớp giữ phí và phản hồi, bỏ bài/lịch/bảng tin | [320px](assets/2026-11-03-dashboard-family-withdrawn-320.png) |
| Cô xem lớp đã lưu trữ, vẫn thấy khoản còn phải thu | [1440px](assets/2026-11-03-dashboard-teacher-archived-desktop.png) |
| Thu hồi guardian rồi cập nhật, bỏ toàn bộ tổng quan bé | [320px](assets/2026-11-03-dashboard-family-revoked-320.png) |

## Giới hạn

Các preview không thay trang nguồn có phân trang. Nút cập nhật lấy dữ liệu mới; dashboard chưa có realtime/WebSocket hoặc tự tải lại theo đồng hồ. Chuông tiếp tục polling theo TC-024. Thu hồi áp dụng ở request mới; các bản đã tải hợp lệ không thể thu lại từ máy người dùng.

Chỉ kiểm tra tính đúng của tổng lớn trong fixture; không coi đây là tải thử/p95 hay cam kết quy mô vận hành. TC-025 không triển khai học bù, adapter Drive, cấu hình Google thật, SMTP ngoài, backup/restore hoặc triển khai production. G4 còn cần chốt phạm vi và các phụ thuộc TC-009/011; không đánh dấu TC-026 READY hoặc toàn bộ 48 AC đạt từ kết quả này. Các báo cáo cũ giữ số liệu đúng từng mốc.
