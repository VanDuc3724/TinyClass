# TinyClass — Bằng chứng cấu hình học phí TC-020

Ngày kiểm tra: **02/11/2026**. Phạm vi: chính sách lớp, snapshot học phí riêng từng bé, ngày hiệu lực/thay mức/kết thúc/hủy, lịch sử riêng và gia đình xem đúng điều kiện công khai. [Hướng dẫn](../13-cau-hinh-hoc-phi.md), [plan](../plan/2026-11-02-tuition-settings.md), [OpenAPI](../spec/openapi.yaml).

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| `Backend/mvnw.cmd -B verify` | **133 test đạt**, không lỗi/skip; executable JAR thành công |
| `TuitionTests,MigrationTests` | **19 test tập trung đạt**, gồm 12 test học phí và 7 migration; nằm trong bộ đầy đủ trên |
| `npm.cmd run build` | TypeScript/Vite production build đạt; trang học phí tải theo nhu cầu, main JS 430,41 kB |
| `npm.cmd run lint` | oxlint đạt |
| `npm.cmd run test:e2e` | **31 E2E Edge đạt**, gồm ba luồng học phí mới; 2,6 phút |
| OpenAPI 0.0.11 | **130 path, 154 operation, 206 schema, 2.047 tham chiếu** hợp lệ; operationId duy nhất |
| Tài liệu/mã nguồn | 39 tệp Markdown, 375 liên kết nội bộ hợp lệ; không thấy ba giá trị bí mật local trong 253 tệp nguồn đã rà; `git diff --check` đạt |

Maven và E2E chạy tuần tự trên PostgreSQL/Mailpit test riêng. E2E dùng bundle production, API và database thật; dữ liệu tên/email/mức tiền đều giả. OIDC trong các luồng cũ dùng provider thử nghiệm. 503 mất phản hồi được giả lập **sau khi backend đã lưu thành công**, sau đó gửi lại để kiểm tra chống trùng. Xung đột policy được tạo bằng một cập nhật thật từ yêu cầu khác, không giả lập 409 ở frontend.

## Hành vi đã kiểm tra

- Ba cách tính và thời điểm thu tách biệt; kiểm tra VND nguyên, tiền lẻ/âm/quá miền, mức 0, trường không tương thích và việc chưa chọn rõ quy tắc nghỉ. Không tự lấy tiền ví dụ hoặc boolean mặc định làm chính sách thật.
- Mức sao chép policy và mức CUSTOM giữ nguyên khi policy thay đổi. Policy cũ bị từ chối khi tạo bản mới, còn retry của bản đã lưu trả đúng snapshot cũ dù policy đã đổi.
- Khoảng ngày bao gồm hai đầu; ngày biên trùng bị chặn, ngày liền kề được chấp nhận. Kiểm tra ngày tham gia/ngày lớp, lớp có ngày kết thúc và các thao tác không được sửa ngày đã qua.
- Thay mức đóng bản cũ/tạo bản mới trong một giao dịch. Thay đúng ngày bắt đầu hôm nay/tương lai giữ bản cũ CANCELLED và liên kết thay thế, không sửa số tiền cũ. Kết thúc chỉ rút ngắn; hủy không cho bản bắt đầu từ ngày trước.
- Hai lượt tạo policy, tạo khoảng chồng ngày hoặc thay cùng bản đồng thời chỉ một lượt ghi hợp lệ; retry cùng mã/nội dung không sinh thêm agreement. Xung đột không đóng bản cũ một phần. Vai trò, CSRF, owner, reason/version và pagination được kiểm tra qua HTTP.
- Lịch sử trước/sau, private note, source policy version và lý do chỉ cô xem. Family DTO/count/detail chỉ đúng bé, không private note/reason/audit/version/request/hash, giá mặc định lớp hay giá bé khác.
- Sau rời lớp/lưu trữ vẫn xem điều kiện lịch sử khi guardian còn hiệu lực; tạo/thay bị chặn khi ngữ cảnh dừng. Cô vẫn có thể kết thúc/hủy phần tương lai. Thu hồi guardian chặn family list/detail ở yêu cầu tiếp theo; UI bỏ nội dung cũ khi nhận lỗi quyền.
- UI giữ nguồn/ngày/nội dung/lý do khi lưu 503 hoặc policy 409; có cảnh báo trước khi bỏ bản nhập để cập nhật. Lưu lại sau mất phản hồi chỉ có một agreement. Tab lớp hỗ trợ phím mũi tên/End; đổi bé giữ route học phí và bỏ dữ liệu bé trước. Các trang mới không tràn ngang ở 375/320px.
- Nâng V11 có nhận xét PRIVATE, version và tệp đã gắn lên V12 giữ nguyên dữ liệu/binding. Các bài kiểm tra nâng từ V1/V7/V8/V9/V10 và các module cũ tiếp tục đạt.

## Ảnh minh chứng

Ảnh từ lần chạy đạt 31 luồng, đã xem lại bố cục thẻ/nhãn riêng/chia sẻ, modal lịch sử và màn hình gia đình. Ảnh được lưu riêng khỏi thư mục kết quả test tạm. Thanh điều hướng gia đình cố định theo viewport; ảnh toàn trang có thể chụp thanh này giữa trang dài.

| Màn hình | Ảnh |
|---|---|
| Chính sách lớp và lối vào từng bé | [1440px](assets/2026-11-02-tuition-class-policy-desktop.png), [375px](assets/2026-11-02-tuition-class-policy-mobile-375.png) |
| Snapshot riêng, nguồn và ghi chú cô | [1440px](assets/2026-11-02-tuition-teacher-agreement-desktop.png) |
| Mất phản hồi sau lưu, giữ bản nhập | [1440px](assets/2026-11-02-tuition-draft-response-loss.png) |
| Xung đột policy, lý do còn nguyên | [1440px](assets/2026-11-02-tuition-stale-policy-draft.png) |
| Audit trước/sau và lý do hủy | [1440px](assets/2026-11-02-tuition-teacher-history-desktop.png) |
| Các bản cũ/hủy trên màn hình cô | [320px](assets/2026-11-02-tuition-teacher-history-mobile-320.png) |
| Gia đình chỉ thấy điều kiện công khai | [1440px](assets/2026-11-02-tuition-family-desktop.png), [375px](assets/2026-11-02-tuition-family-mobile-375.png) |
| Lịch sử vẫn xem sau rời lớp | [320px](assets/2026-11-02-tuition-family-withdrawn-320.png) |
| Thu hồi liên kết, bỏ nội dung cũ | [320px](assets/2026-11-02-tuition-family-revoked-320.png) |

## Giới hạn và phần tiếp theo

TC-020 lưu điều kiện, chưa có tính phí từ điểm danh, preview, invoice/phiếu, ghi thu, cổng thanh toán hoặc hoàn tiền. Không có học bù/gói tín dụng tự động. Sửa trạng thái lớp/tham gia không tự đóng agreement; ngày tham gia hiện có không tái dựng đủ mọi lần gián đoạn lịch sử. TC-021 cần dùng đúng snapshot/ngày hiệu lực, bỏ bản CANCELLED và thêm bảo vệ các điều kiện đã được dùng lập phiếu; TC-022 mới ghi nhận tiền thực tế đã thu.

Google thật/học bù tiếp tục tạm hoãn. Drive, thông báo, SMTP nhà cung cấp thật và nghiệm thu tải/backup/vận hành thật theo backlog; không coi các kết quả local này là đã nghiệm thu phát hành toàn hệ thống.
