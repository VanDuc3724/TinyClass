# TinyClass — Kiểm tra, nghiệm thu và phát hành

Các trường hợp AC giữ nguyên mã ở [bộ nghiệm thu tổng quan](../01-mo-ta-he-thong.md#s13). Tài liệu này là kế hoạch kiểm tra, chưa phải báo cáo tất cả đã pass.

## 1. Bằng chứng nền tảng hiện tại

| Kiểm tra | Kết quả đã quan sát |
|---|---|
| Frontend build/lint | Hai lệnh build/lint đều thành công sau chuẩn hóa nhãn và proxy |
| Backend | com.tinyclass, Java 21, Spring Boot 4.1.2, artifact backend |
| Maven Wrapper | Đã sửa Target nullable; compile và verify thành công |
| Database/email | Local/test PostgreSQL và Mailpit riêng; V1–V7 schema rỗng/nâng cấp và SMTP đã kiểm tra |
| Kiểm thử backend | 70 test đạt: 57 test mốc trước, 6 test LOCAL và 7 test học liệu/giao bài |
| Kiểm thử UI | 13 E2E Edge đạt với API/database/SMTP, video upload và OIDC provider thử nghiệm; desktop/mobile |
| Tài khoản/lớp | Setup giáo viên/session/CSRF, lớp/bé/thành viên/audit đã chạy qua UI/API |
| Gia đình/email | Lời mời/đăng ký/xác minh/reset, nhận đồng thời một lần, nhiều quan hệ và thu hồi có bằng chứng |
| Google | UI/API và protocol đã kiểm tra bằng provider thử nghiệm; còn OAuth client/callback và nghiệm thu Google thật |
| Học liệu | LOCAL, chủ đề/bài/khóa, snapshot/recipient, family đọc/confirm và thu hồi quyền đã có bằng chứng |
| Drive/sản phẩm/lịch/phí | Các task tiếp theo; SMTP nhà cung cấp thật chưa nghiệm thu |

Bằng chứng mới nhất: [học liệu/giao bài](../verification/2026-11-02-learning.md), cùng báo cáo mốc trước. Quyền bài/tệp sau rời lớp, giờ mở, snapshot và PARENT_CONFIRM đã kiểm tra; submission/review, roster, Drive và triển khai thật chưa nghiệm thu. Google thật tạm hoãn theo yêu cầu. Không coi toàn bộ 48 AC đã đạt.

## 2. Tầng kiểm tra phù hợp

| Tầng | Dùng cho |
|---|---|
| Unit | Quy tắc trạng thái, tính tỷ lệ, tiền nguyên, điều kiện nghỉ/bù và tính hợp lệ dữ liệu |
| Integration | FK/unique, ownership, session/CSRF, atomic transaction, khóa đồng thời, gửi lặp và migration trên PostgreSQL |
| API contract | DTO/envelope/error/version, phân trang, nội dung ngoài quyền, dạng file/Range và lỗi trạng thái |
| E2E | Luồng giáo viên–gia đình chạy qua UI/API/database, nhiều con/lớp, mobile và file |
| Tích hợp nhà cung cấp | Google login, liên kết tài khoản, Drive upload/read/reconnect và email thực tế |
| Vận hành | Build sạch, startup, deploy/restart, dung lượng/tải thử, backup và restore |

Mock nhà cung cấp dùng để kiểm thử lỗi/trạng thái có thể lặp lại. Nó không thay nghiệm thu với cấu hình thực tế. Không cần viết test chỉ để lặp lại một đổi tên/định dạng; chạy kiểm tra phù hợp với rủi ro của thay đổi, và kiểm tra lại những phần bị tác động khi có sửa lỗi hoặc đổi hành vi.

## 3. Ánh xạ đầy đủ 48 tình huống AC

Mỗi AC xuất hiện một lần trong bảng để kiểm tra độ bao phủ. Thực tế một case có thể cần nhiều task hoặc chạy lại khi quyền/phí/nội dung thay đổi.

| Nhóm | Nội dung | AC cần bao phủ | Task chính |
|---|---|---|---|
| V-01 | Lớp/thành viên, nhiều quan hệ, quyền cấp lại và lịch sử roster | AC-01, AC-02, AC-03, AC-06, AC-15, AC-16, AC-24 | TC-007, TC-008, TC-013, TC-018 |
| V-02 | Lời mời và email | AC-04, AC-05 | TC-008 |
| V-03 | Quyền tài nguyên/file/ghi chú, giờ mở, CSRF, rời lớp và tài khoản khóa | AC-07, AC-12, AC-26, AC-32, AC-36, AC-48 | TC-006, TC-009, TC-013, TC-019, TC-026 |
| V-04 | Kho bài/khóa, publish, gửi lặp, snapshot và cập nhật dùng chung | AC-08, AC-09, AC-10, AC-11, AC-13, AC-14 | TC-012, TC-013 |
| V-05 | Mở/xác nhận/nộp/duyệt/gửi lại và tỷ lệ tiến độ | AC-17, AC-18, AC-19, AC-20, AC-21, AC-22 | TC-014, TC-015, TC-016 |
| V-06 | Sinh/đổi lịch, hủy và kế hoạch học bù | AC-23, AC-25 | TC-017, TC-018 |
| V-07 | Phiếu/thu, gửi lặp/đồng thời, đổi giá, thu trước và nghỉ/bù | AC-27, AC-28, AC-29, AC-38, AC-39, AC-40 | TC-020, TC-021, TC-022, TC-023 |
| V-08 | Sửa đồng thời/version | AC-30 | TC-004 và các module có cập nhật |
| V-09 | Upload, hai kho, quyền tải, lỗi Drive và bền vững khi restart | AC-31, AC-34, AC-35, AC-37, AC-41 | TC-010, TC-011, TC-027 |
| V-10 | Sao lưu/khôi phục | AC-33 | TC-027 |
| V-11 | Google signup/link/token/phương thức và tách quyền Drive | AC-42, AC-43, AC-44, AC-45, AC-46, AC-47 | TC-009, TC-011 |

Các hành vi thông báo/dashboard bổ sung kiểm tra theo spec tương ứng dù chưa có AC riêng trong danh mục gốc: đúng người nhận, dedupe, cập nhật sau giao dịch và không lộ số tổng ngoài quyền.

## 4. Bộ dữ liệu cần có

Dùng [dữ liệu giả gốc](../01-mo-ta-he-thong.md#s12) và bổ sung trạng thái theo module:

- Một cô; ít nhất ba bé, hai lớp; một bé hai lớp; một phụ huynh nhiều con; một bé hai người giám hộ.
- Ba kiểu tài khoản: local, Google-only, đã liên kết cả hai; user khóa, identity/email trùng và lời mời sai/hết hạn.
- Bài riêng và khóa dùng lại bài, ba cách hoàn thành, bài nháp/chưa mở, lần giao bị thu hồi, nhiều lượt sản phẩm.
- LOCAL và Drive, cờ tải bật/tắt, lỗi kho/quota/reconnect; tệp sai loại/quá lớn/ngoài context.
- Buổi thường, hủy, nghỉ có phép/chưa báo và bù sang kỳ khác; roster trước/sau rút lớp.
- Ba cách tính phí, thỏa thuận giá khác nhau trong một lớp, phiếu trả từng phần/0 VND, thanh toán lặp/đồng thời/void.

Fixture không chứa trẻ/tài khoản/token thật. Integration test dùng database/profile tách biệt. Chọn cách cấp PostgreSQL test khi triển khai TC-003, không mặc định mọi máy có Docker hoặc database thật sẵn.

## 5. Lệnh kiểm tra dự kiến

Trong `frontend/`, đối chiếu scripts hiện có:

```powershell
npm.cmd run build
npm.cmd run lint
```

Khởi động hai database theo [README](../../README.md), sau đó chạy trong `Backend/`:

```powershell
.\mvnw.cmd "-DskipTests" compile
.\mvnw.cmd -B verify
```

Các lệnh đã qua kiểm tra cho phần hiện tại; module mới cần kiểm tra thêm. Suite kiểm tra cả local và test nên cần hai database. `compile` bỏ test không thay cho `verify`.

Sau Maven verify, chạy `npm.cmd run test:e2e` trong `frontend/` với Edge đã cài trên Windows. Playwright tự chạy/dừng backend 18080 và Vite 5174 trên database test riêng; không chạy cùng lúc với Maven. Script E2E reset dữ liệu test theo [README](../../README.md).

Kiểm tra tính tái lập ở môi trường sạch cần dùng npm lockfile, Maven/migration đã chốt và đầy đủ phụ thuộc. Xác minh local trước; không áp dụng profile test lên dữ liệu production.

## 6. Ghi nhận kết quả theo task

Mẫu ghi ngắn:

```text
Task:
Phiên bản/commit:
Môi trường/profile/database:
Lệnh hoặc các bước thao tác:
AC/quy tắc đã kiểm tra:
Kết quả thực tế và bằng chứng:
Lỗi/giới hạn còn lại:
Trạng thái sau kiểm tra:
```

Chỉ đánh dấu pass khi đã thực hiện và đạt. Case chưa có cấu hình Google/Drive/mail thật ghi “chưa kiểm tra tích hợp thật”, không đổi thành pass do unit test/mock qua.

## 7. Điều kiện phát hành

- [ ] Phạm vi Q-09, chính sách học phí và quyền lịch sử đã chốt cho bản phát hành.
- [ ] Các task trong phạm vi đã đạt điều kiện xong; AC tương ứng có kết quả và lỗi còn lại được xử lý/ghi rõ.
- [ ] Frontend build/lint và backend verify đạt với môi trường đã ghi; migration chạy được từ database mới và nâng cấp.
- [ ] Google login/Drive/email đúng môi trường, callback và secrets không lộ; user khóa/rời lớp/sai ID đều chặn đúng.
- [ ] Kiểm tra số tiền, idempotency, đồng thời và nghỉ/bù không còn sai lệch.
- [ ] Có volume/media bền vững, backup/restore thử, quota/health/log cần thiết và kết quả tải thử.
- [ ] Có hướng dẫn dùng/vận hành, cách xử lý sự cố và phiên bản tài liệu khớp bản triển khai.

Trạng thái hiện tại: TC-001–008 và TC-010/012/013/014 có bằng chứng theo phạm vi từng task; TC-009 có mã/kiểm tra thử nghiệm, cấu hình thật tạm hoãn. Các ô phát hành toàn sản phẩm vẫn để trống vì các module còn phía trước.

