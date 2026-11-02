# TinyClass — Backlog triển khai

Đường dẫn hiện tại: [backend POM](../../Backend/pom.xml), [frontend package](../../frontend/package.json). TC-001–008 và TC-010/012/013/014 hoàn thành theo phạm vi từng task. Cấu hình Google thật tạm hoãn theo yêu cầu người dùng ngày 02/11/2026. Bằng chứng mới nhất ở [học liệu/giao bài](../verification/2026-11-02-learning.md), cùng báo cáo mốc trước. Quy ước theo [README](README.md); mốc theo [roadmap](01-roadmap.md).

Khi bắt đầu task, ghi quyết định Q liên quan. Khi hoàn thành, thêm lệnh/kiểm tra, kết quả, giới hạn và liên kết bằng chứng; không đổi DONE chỉ vì đã tạo file hoặc nút giao diện.

## G0 — Nền tảng

<a id="tc-001"></a>
### TC-001 — Xác minh và ổn định build backend

- Trạng thái: DONE.
- Phụ thuộc: không.
- Spec: [kỹ thuật và chất lượng](../spec/05-data-api-and-quality.md#acceptance), Q-03.
- Đầu ra: backend chẩn đoán lỗi wrapper bootstrap/null array, tách khỏi lỗi thiếu cache hoặc không truy cập Maven Central; đối chiếu Maven cài sẵn/Java 21; ghi đường build dùng được. Chỉ thay wrapper/cấu hình khi có nguyên nhân và kiểm tra lại phù hợp.
- Hoàn thành khi: compile thành công bằng đường build được thống nhất, có log exit 0; nêu riêng trạng thái wrapper nếu dùng Maven cài sẵn để đối chiếu. Chưa coi compile là bằng chứng ứng dụng kết nối database/OAuth thành công.
- Kết quả: sửa guard cho Target nullable trong wrapper; compile, clean verify và verify bằng wrapper thành công. [Bằng chứng](../verification/2026-11-01-foundation.md).

<a id="tc-002"></a>
### TC-002 — Thống nhất định danh và tổ chức dự án

- Trạng thái: DONE.
- Phụ thuộc: TC-001.
- Spec: [sổ quyết định](../spec/06-decisions.md), quy ước TinyClass ở tài liệu tổng quan.
- Đầu ra: cập nhật namespace/tên ứng dụng theo phương án thống nhất, dự kiến `com.tinyclass`, artifact `backend`, service `tinyclass-backend`; rà import/test/package và nhãn frontend. Ghi quyết định dùng Git chung hay riêng từ trạng thái `.git` hiện có trong Backend; không coi gộp lịch sử Git là thao tác naming thông thường.
- Hoàn thành khi: build vẫn đạt, cấu hình/tài liệu phản ánh đúng tên/đường dẫn thực tế, không tạo nhầm module lồng nhau; quyết định tổ chức Git được ghi lại, thao tác lịch sử nếu cần được tách riêng.
- Kết quả: package com.tinyclass, artifact backend, service tinyclass-backend; nhãn/package frontend TinyClass. Giữ cấu trúc Git hiện có trong đợt nền tảng, chưa gộp repository; build backend/frontend đạt.

<a id="tc-003"></a>
### TC-003 — Database local/test và Flyway

- Trạng thái: DONE.
- Phụ thuộc: TC-002.
- Spec: [dữ liệu/migration](../spec/05-data-api-and-quality.md), Q-01.
- Đầu ra: backend có profile local/test, cấu hình PostgreSQL qua môi trường, chiến lược migration và schema validation; hướng dẫn tạo môi trường database phát triển, dữ liệu demo tách dữ liệu thật.
- Hoàn thành khi: backend khởi động và kết nối database trong môi trường kiểm tra, migration chạy từ database mới, không commit credentials thật; có bằng chứng riêng cho compile và startup.
- Kết quả: Compose PostgreSQL local/test, profile riêng và script tạo .env; Flyway V1/audit JSONB và HTTP health đã kiểm tra trên hai database. [Hướng dẫn](../../README.md).

<a id="tc-004"></a>
### TC-004 — Nền API, lỗi, quyền và lịch sử dùng chung

- Trạng thái: DONE.
- Phụ thuộc: TC-003.
- Spec: [hợp đồng API chung](../spec/05-data-api-and-quality.md).
- Đầu ra: backend có cấu trúc module, DTO/envelope, validation, exception mapping, request ID, pagination, UTC/money/version và audit dùng chung; bắt đầu OpenAPI cho những endpoint đã triển khai, định nghĩa cách kiểm tra quyền tài nguyên.
- Hoàn thành khi: response lỗi/version/role không lộ dữ liệu, kiểm tra được qua API/integration test thích hợp; trạng thái health tối thiểu nếu cung cấp không lộ cấu hình nhạy cảm.
- Kết quả: envelope/error/field errors/PageResponse, request ID, JSON lỗi security, version conflict, audit và health; [OpenAPI nền tảng](../spec/openapi.yaml). Verify đạt 12 test; quyền nghiệp vụ chi tiết sẽ được kiểm tra thêm ở module tài khoản/lớp.

<a id="tc-005"></a>
### TC-005 — Khung giao diện và API client

- Trạng thái: DONE.
- Phụ thuộc: TC-002.
- Spec: [màn hình sản phẩm](../spec/01-product.md), [API](../spec/05-data-api-and-quality.md), Q-10.
- Đầu ra: frontend có router/layout giáo viên/gia đình, provider, API client, Vite proxy/cấu hình base URL, trạng thái loading/empty/error, form và thông báo lỗi chung; chọn hướng CSS và áp dụng TinyClass.
- Hoàn thành khi: build/lint đạt, điều hướng hoạt động trên desktop/mobile, không gán quyền nghiệp vụ bằng biến cứng trong frontend; phần gọi API thật được nối khi TC-004 sẵn sàng.
- Kết quả: React Router, provider/session guard, layout giáo viên/gia đình, API client/CSRF, loading/empty/error, form và CSS thuần với token màu dùng chung; build/lint sạch. E2E trên Edge desktop/mobile chạy qua API thật. Layout gia đình là khung theo role; dữ liệu/lời mời ở TC-008.
- Cập nhật UI 02/11/2026 theo yêu cầu: áp dụng [Design.md](../../frontend/Design.md), token tím/Nunito/CSS Modules, dashboard dữ liệu thật theo lớp, drawer/focus, menu tài khoản, bộ lọc mobile và thanh gia đình/bộ chọn bé. [Phạm vi và bằng chứng](../verification/2026-11-02-design.md). Không đổi trạng thái các module nghiệp vụ chưa triển khai.

## G1 — Lớp và tài khoản

<a id="tc-006"></a>
### TC-006 — Giáo viên và session email/mật khẩu

- Trạng thái: DONE.
- Phụ thuộc: TC-004, TC-005.
- Spec: [AUTH-01 đến AUTH-06](../spec/02-auth-and-classes.md#requirements), Q-02.
- Đầu ra: migration users/audit, bootstrap một giáo viên, password hashing, login/logout/me/CSRF, session/cookie và trạng thái khóa; frontend form đăng nhập, guard giao diện và xử lý hết phiên. Schema token/lời mời ở TC-008, identity Google ở TC-009.
- Hoàn thành khi: giáo viên đăng nhập/đăng xuất qua UI, đổi dữ liệu thiếu CSRF hoặc không có quyền bị chặn, không có mật khẩu mặc định cố định trong mã; test xác thực/role/session phù hợp đạt.
- Kết quả: V2/users, khởi tạo một giáo viên bằng mã ngẫu nhiên, PBKDF2, session đổi ID và CSRF sau login, me/logout, kiểm tra lại trạng thái/role từ database, giới hạn tần suất. Đạt kiểm tra HTTP và E2E thực tế; không mở đăng ký giáo viên công khai. [Bằng chứng](../verification/2026-11-01-accounts-and-classes.md).

<a id="tc-007"></a>
### TC-007 — Lớp, hồ sơ bé và thành viên

- Trạng thái: DONE.
- Phụ thuộc: TC-006.
- Spec: [CLASS-01 đến CLASS-07](../spec/02-auth-and-classes.md#requirements).
- Đầu ra: backend migration/API lớp–trẻ–tham gia, unique/capacity/state/version/audit; frontend danh sách, tạo/sửa/chi tiết, thêm bé có sẵn và rút/quay lại; FK media được bổ sung khi có schema file.
- Hoàn thành khi: luồng quản lý lớp qua UI/API đạt AC-01/02/03, hồ sơ không nhân đôi theo lớp, rút/quay lại giữ lịch sử và không sửa danh sách quá khứ.
- Kết quả: lớp/hồ sơ bé/tham gia dùng API thật, lưu trữ/khôi phục/kết thúc, tìm kiếm/phân trang, ownership/version, unique và khóa giao dịch kiểm tra sĩ số. Rời/quay lại giữ ID, joinedAt và audit; có E2E lịch sử và test thêm trùng/cạnh tranh chỗ cuối đồng thời. AC-01/02/03 có bằng chứng; các tình huống quyền nội dung/roster khác tiếp tục TC-013/018.

<a id="tc-008"></a>
### TC-008 — Lời mời, gia đình và email tài khoản

- Trạng thái: DONE.
- Phụ thuộc: TC-006, TC-007.
- Spec: [lời mời/phân quyền](../spec/02-auth-and-classes.md), Q-02, Q-07.
- Đầu ra: backend quan hệ người giám hộ/lời mời, đăng ký qua lời mời, xác minh/reset, adapter email phát triển và DTO family; frontend mời/sao chép link, nhận lời mời, xác minh, khôi phục, chọn con và lớp của con.
- Hoàn thành khi: đúng email nhận đúng bé, token hết hạn/dùng lại/sai email không cấp quyền; nhiều quan hệ không lẫn hồ sơ; email thử nghiệm và email thật được ghi kết quả riêng.
- Kết quả: V3/quan hệ/lời mời/token băm; UI mời/nhận/xác minh/khôi phục và gia đình chọn con/xem lớp. SMTP local/test qua Mailpit, 41 test backend và 7 E2E đạt; có kiểm tra đồng thời, sai email/thu hồi và hủy phiên sau reset. Email nhà cung cấp thật chưa nghiệm thu. [Báo cáo](../verification/2026-11-01-family.md).

<a id="tc-009"></a>
### TC-009 — Google login, đăng ký và liên kết phương thức

- Trạng thái: IN_PROGRESS — mã và kiểm thử thử nghiệm hoàn tất; còn nghiệm thu Google thật.
- Phụ thuộc: TC-008.
- Spec: [Google và identity](../spec/02-auth-and-classes.md), Q-02, Q-07.
- Đầu ra: backend OIDC/state/nonce/callback/issuer-subject, collision/link/unlink/set-password, kiểm tra trạng thái; frontend nút Google và cài đặt phương thức. Tách cấu hình registration Google login khỏi Drive.
- Hoàn thành khi: AC-42 đến AC-48 đạt theo phạm vi thực tế, Google-only không cần hash giả, không auto-merge email, callback không nâng role; tích hợp thật cần cấu hình OAuth hợp lệ ngoài mock.
- Kết quả: V4/identity/credential version; OIDC PKCE/state/nonce/ID token; UI Google, phương thức/reauth/link/unlink/SET_PASSWORD. 57 test backend và 10 E2E đạt với provider OIDC có chữ ký, PostgreSQL và Mailpit test. [Bằng chứng/AC](../verification/2026-11-02-google.md).
- Còn lại: cấu hình/nghiệm thu Google thật tạm hoãn theo yêu cầu người dùng 02/11/2026; hướng dẫn đã chuẩn bị. Giữ mã và kiểm tra thử nghiệm hiện có, tiếp tục các phần độc lập bằng email/mật khẩu.

## G2 — Học liệu và học ở nhà

<a id="tc-010"></a>
### TC-010 — File và kho LOCAL

- Trạng thái: DONE trong phạm vi LOCAL.
- Phụ thuộc: TC-004, TC-006, TC-007.
- Spec: [FILE-01 đến FILE-07](../spec/03-content-and-learning.md#requirements), Q-04.
- Đầu ra: backend schema storage/file, adapter LOCAL, upload/metadata/preview/Range/download/policy, giới hạn/MIME/path/private root; frontend upload chọn kho/cờ tải. Gắn FK ảnh lớp/bé; parent upload chỉ mở khi có ngữ cảnh assignment phù hợp ở TC-015.
- Hoàn thành khi: teacher upload và xem/tải được qua quyền API, file quá giới hạn/sai loại bị chặn, cờ tải không bị sửa bởi phụ huynh; lưu tệp tách khỏi public/Git/gói build.
- Kết quả: V5/storage adapter, private root, Tika/MIME/đuôi/giới hạn/quota nguyên tử/checksum, Resource/Range/inline/attachment, policy có version; UI kho/upload/preview. FK ảnh lớp/bé và ngữ cảnh file đã thêm. Parent upload chưa mở, Drive theo TC-011. [Bằng chứng](../verification/2026-11-02-learning.md).

<a id="tc-011"></a>
### TC-011 — Adapter Google Drive cá nhân

- Trạng thái: TODO.
- Phụ thuộc: TC-010, TC-006.
- Spec: [hai kho lưu](../spec/03-content-and-learning.md), Q-04, Q-07.
- Đầu ra: backend OAuth Drive riêng, kết nối/default/disconnect/reconnect, token mã hóa, upload/read stream qua adapter; frontend cài đặt và chọn Drive khi upload, lỗi kết nối/dung lượng rõ ràng.
- Hoàn thành khi: file riêng tư, không phát link công khai, đổi default không di chuyển file, mất kết nối không xóa metadata hoặc tự đổi kho; tích hợp được xác minh với Drive thử nghiệm được cấp quyền. Không bắt giáo viên dùng Google login để mới được kết nối Drive.

<a id="tc-012"></a>
### TC-012 — Chủ đề, bài và khóa

- Trạng thái: DONE.
- Phụ thuộc: TC-010.
- Spec: [LEARN-01 đến LEARN-06](../spec/03-content-and-learning.md#requirements).
- Đầu ra: backend schema/API chủ đề, khối bài, khóa và thứ tự, publish/archive/version; frontend thư viện, soạn bài plain text/media, dùng lại bài trong khóa và preview giáo viên.
- Hoàn thành khi: bài riêng/khóa dùng lại cùng nguồn, publish không nhận file chưa READY hoặc bài nháp; các lỗi AC-08/09/10 xử lý rõ, không tự mở kho cho gia đình.
- Kết quả: V6/chủ đề/khối bài/khóa-thứ tự; UI soạn/xem/tải tệp ngay trong bài; publish/archive/restore/version, xác nhận sửa dùng chung. Nội dung plain text và media upload, chưa nhúng URL ngoài. [Bằng chứng](../verification/2026-11-02-learning.md).

<a id="tc-013"></a>
### TC-013 — Lần giao, người nhận và kiểm tra quyền nội dung

- Trạng thái: DONE.
- Phụ thuộc: TC-007, TC-008, TC-012.
- Spec: [giao nội dung](../spec/03-content-and-learning.md).
- Đầu ra: backend assignment/item/recipient, snapshot draft/publish, available/due, chống gửi lặp, revoke/cấp thêm; bổ sung FK context file; frontend giáo viên chọn lớp/bé, yêu cầu và giờ mở.
- Hoàn thành khi: publish nguyên tử, khóa thay đổi không sửa item cũ, bé mới/rút/quay lại đúng quyền; file kiểm tra đúng child/item/thời điểm, không lách bằng URL hoặc ID.
- Kết quả: V7/snapshot draft, chống tạo lặp bằng request ID/hash, publish chốt người nhận, giờ mở/hạn, thu hồi/cấp thêm có lý do. Rút lớp thu hồi recipient trong cùng giao dịch; quay lại không tự cấp bài cũ. Family file API kiểm tra ngữ cảnh mỗi request. [Bằng chứng](../verification/2026-11-02-learning.md).

<a id="tc-014"></a>
### TC-014 — Gia đình xem bài và xác nhận tiến độ

- Trạng thái: DONE trong phạm vi xem/mở/REFERENCE/PARENT_CONFIRM.
- Phụ thuộc: TC-013, TC-008, TC-005.
- Spec: [tiến độ và màn hình học](../spec/03-content-and-learning.md).
- Đầu ra: backend family list/detail/open/confirm, thống kê kể cả chưa có progress, cách tính tỷ lệ; frontend bài/khóa theo con, chờ mở/hết quyền, Góc học của bé, xem/tải theo policy.
- Hoàn thành khi: mở video không tự hoàn thành, PARENT_CONFIRM đúng actor/mốc, REFERENCE không chia cho 0, cùng bài giao lại có tiến độ mới; UI không lộ file/nội dung trước giờ mở.
- Kết quả: Góc học theo bé, danh sách/khóa/item, xem media/đường tải theo policy, open/confirm và tiến độ cả khi chưa có dòng progress. Lớp kết thúc chỉ xem lại; file/bài hết quyền bị chặn. Hoàn thành TEACHER_REVIEW cần TC-015/016, chưa nghiệm thu luồng sản phẩm. [Bằng chứng](../verification/2026-11-02-learning.md).

<a id="tc-015"></a>
### TC-015 — Sản phẩm và upload của gia đình

- Trạng thái: READY.
- Phụ thuộc: TC-014, TC-010.
- Spec: [sản phẩm](../spec/03-content-and-learning.md).
- Đầu ra: backend draft/submit/attempt/attachments/allowed types, chống hai lượt chờ, ràng buộc file đúng ngữ cảnh; frontend lưu nháp, upload/chọn file, gửi và xem lượt cũ.
- Hoàn thành khi: chỉ tác giả sửa nháp, gửi rồi không sửa trực tiếp, hai người giám hộ không ghi đè hoặc tạo hai SUBMITTED; lỗi upload giữ phần chữ, không gắn file của bé/item khác.

<a id="tc-016"></a>
### TC-016 — Giáo viên phản hồi, duyệt và mở lại

- Trạng thái: TODO.
- Phụ thuộc: TC-015.
- Spec: [hoàn thành và gửi lại](../spec/03-content-and-learning.md).
- Đầu ra: backend review/reopen, feedback, history và progress atomic; frontend hàng đợi giáo viên, xem sản phẩm, chấp nhận/yêu cầu bổ sung, gia đình xem phản hồi và gửi lại.
- Hoàn thành khi: hoàn thành TEACHER_REVIEW chỉ sau ACCEPTED, yêu cầu bổ sung có lý do, mở lại không bị lượt accepted cũ làm xong ngay; AC-17 đến AC-22 phù hợp đều đạt.

## G3 — Quản lý dạy tại nhà

<a id="tc-017"></a>
### TC-017 — Lịch tuần và buổi học

- Trạng thái: TODO.
- Phụ thuộc: TC-007, TC-004, TC-005.
- Spec: [TEACH-01 đến TEACH-04](../spec/04-teaching-and-billing.md#requirements).
- Đầu ra: backend rule/session/generate/change/cancel, khoảng ngày và cảnh báo trùng giờ; frontend lịch giáo viên/gia đình và chỉnh riêng buổi.
- Hoàn thành khi: timezone đúng, sinh lại không trùng, không sửa quá khứ/chỉnh riêng khi đổi rule, gia đình chỉ thấy lịch có quyền.

<a id="tc-018"></a>
### TC-018 — Điểm danh và kế hoạch bù

- Trạng thái: TODO.
- Phụ thuộc: TC-017, TC-007.
- Spec: [điểm danh và bù](../spec/04-teaching-and-billing.md), Q-06.
- Đầu ra: backend roster snapshot, attendance batch/version/audit, makeup nguồn/đích và trạng thái; frontend điểm danh nhanh, quản lý bù và lịch sử của con.
- Hoàn thành khi: membership đổi không viết lại roster, buổi hủy không tính đã học, một bé/buổi một dòng và một lần nghỉ một kế hoạch còn hiệu lực; dữ liệu đủ đối chiếu tính phí gốc/bù.

<a id="tc-019"></a>
### TC-019 — Nhận xét và hồ sơ tiến bộ

- Trạng thái: TODO.
- Phụ thuộc: TC-007, TC-008, TC-010.
- Spec: [nhận xét](../spec/04-teaching-and-billing.md).
- Đầu ra: backend notes/attachments/visibility và DTO theo vai trò; frontend cô viết riêng/chia sẻ, dòng thời gian kết hợp sản phẩm và nhận xét cho gia đình.
- Hoàn thành khi: PRIVATE không có trong response family kể cả file, thay visibility có lịch sử, liên kết lớp/buổi đúng ngữ cảnh.

<a id="tc-020"></a>
### TC-020 — Chính sách lớp và thỏa thuận học phí từng bé

- Trạng thái: TODO.
- Phụ thuộc: TC-007, TC-004.
- Spec: [cách tính và thời điểm thu](../spec/04-teaching-and-billing.md), Q-06.
- Đầu ra: backend policy/agreement, ba cách tính/thời điểm thu, giá trị riêng từng bé, kỳ hiệu lực và điều kiện nghỉ/bù; frontend form cấu hình và xem điều kiện của con.
- Hoàn thành khi: không có hai khoảng thỏa thuận chồng nhau, sửa policy không đổi bản sao cũ, đổi giá tạo hiệu lực mới; ghi rõ chính sách được chốt thay vì lấy số tiền ví dụ làm mặc định.

<a id="tc-021"></a>
### TC-021 — Preview, phiếu và buổi tính phí

- Trạng thái: TODO.
- Phụ thuộc: TC-020, TC-018.
- Spec: [phiếu và quy tắc tính phí](../spec/04-teaching-and-billing.md).
- Đầu ra: backend preview/create/lines/issue/cancel, terms snapshot, root charge entries, chống retry; frontend kiểm tra gợi ý, tạo và phát hành phiếu. Preview không tự phát hành/ghi thu.
- Hoàn thành khi: tổng backend tính đúng, cùng buổi gốc/bù không giữ/tính hai lần, phiếu đã phát hành không tự sửa theo điểm danh/giá mới, hủy hợp lệ giữ lịch sử và giải phóng buổi đúng cách.

<a id="tc-022"></a>
### TC-022 — Ghi nhận thanh toán và điều chỉnh nhập sai

- Trạng thái: TODO.
- Phụ thuộc: TC-021.
- Spec: [thanh toán](../spec/04-teaching-and-billing.md).
- Đầu ra: backend record/void, amount/remaining, Idempotency-Key/request hash và khóa giao dịch; frontend cô ghi thu từng phần và lý do void.
- Hoàn thành khi: 800.000 VND thu 500.000 VND còn 300.000 VND; retry không thu lại, đồng thời không vượt, không void/xóa ngầm; không gọi đây là cổng thanh toán hay hoàn tiền thực tế.

<a id="tc-023"></a>
### TC-023 — Màn hình học phí giáo viên và gia đình

- Trạng thái: TODO.
- Phụ thuộc: TC-022, TC-008, TC-005.
- Spec: [học phí và quyền gia đình](../spec/04-teaching-and-billing.md), Q-08.
- Đầu ra: frontend danh sách/bộ lọc/chi tiết phiếu, lịch sử thu và số còn lại; backend DTO gia đình chỉ có khoản công bố của đúng bé, không có ghi chú riêng.
- Hoàn thành khi: gia đình không thấy nháp hoặc phí bé khác, rời lớp không tự giữ quyền bài và không tự hoàn tiền; số hiển thị khớp backend và các tình huống thu từng phần.

<a id="tc-024"></a>
### TC-024 — Thông báo lớp và cập nhật trong ứng dụng

- Trạng thái: TODO.
- Phụ thuộc: TC-008, TC-013, TC-016, TC-017, TC-019, TC-022.
- Spec: [thông báo](../spec/04-teaching-and-billing.md).
- Đầu ra: backend schema/API announcement/read/notification, phát sau giao dịch thành công và dedupe; frontend bảng tin lớp, badge, danh sách và điều hướng theo quyền.
- Hoàn thành khi: không có thông báo trùng do retry, không lộ dữ liệu khi quyền bị thu hồi, chỉ người nhận xem/đánh dấu; không tự bật gửi qua dịch vụ nhắn tin bên ngoài.

<a id="tc-025"></a>
### TC-025 — Dashboard và hoàn thiện trải nghiệm

- Trạng thái: TODO.
- Phụ thuộc: TC-014, TC-016, TC-017, TC-018, TC-019, TC-023, TC-024.
- Spec: [màn hình sản phẩm](../spec/01-product.md), Q-10.
- Đầu ra: frontend tổng quan giáo viên/gia đình và Góc học của bé hoàn chỉnh; backend các truy vấn tổng hợp có filter quyền/phân trang; rà trạng thái rỗng/lỗi, thao tác chưa lưu, mobile và nhãn truy cập.
- Hoàn thành khi: không hiện số liệu giả/cứng hoặc aggregate ngoài quyền, các đường vào module chạy thật, dùng được ở màn hình nhỏ và các trường hợp nhiều con/lớp.

## G4 — Nghiệm thu và bàn giao

<a id="tc-026"></a>
### TC-026 — Kiểm thử các luồng và bất biến tích hợp

- Trạng thái: TODO.
- Phụ thuộc: TC-009, TC-011, TC-016, TC-018, TC-019, TC-023, TC-024, TC-025.
- Spec: các mục acceptance trong bộ spec; [kế hoạch kiểm tra](03-validation-and-release.md).
- Đầu ra: kiểm tra đơn vị/tích hợp/E2E phù hợp, dữ liệu giả và báo cáo ánh xạ AC; xử lý các lỗi trước phát hành. Xác minh Google/Drive/email thực tế riêng mock.
- Hoàn thành khi: các case nằm trong phạm vi phát hành đạt với bằng chứng; không có lỗi quyền/tiền/mất dữ liệu chưa xử lý; kiểm tra lại có mục đích sau những thay đổi liên quan.

<a id="tc-027"></a>
### TC-027 — Cấu hình triển khai và phục hồi

- Trạng thái: TODO.
- Phụ thuộc: TC-026.
- Spec: [chất lượng/vận hành](../spec/05-data-api-and-quality.md), Q-04, Q-05, Q-07, Q-08.
- Đầu ra: cấu hình môi trường đích, HTTPS/cookie/proxy, OAuth redirects/email, database, LOCAL volume/Drive, quota, log/health và backup database + media + khóa cần thiết; thử phục hồi trên môi trường phù hợp.
- Hoàn thành khi: restart/redeploy không mất file, phục hồi nhất quán theo AC-33/41, có kết quả tải thử trên quy mô đã chốt và ghi RPO/RTO thực tế; không dùng số mục tiêu thay kết quả đo.

<a id="tc-028"></a>
### TC-028 — Hướng dẫn và bàn giao bản phát hành

- Trạng thái: TODO.
- Phụ thuộc: TC-026, TC-027.
- Spec: [phạm vi sản phẩm](../spec/01-product.md), Q-09.
- Đầu ra: hướng dẫn giáo viên/phụ huynh, hướng dẫn vận hành/build/migration/backup, bản ghi phiên bản, các giới hạn và quyết định cuối cùng; cập nhật spec/plan theo hành vi đã nghiệm thu.
- Hoàn thành khi: người dùng thử được các luồng bàn giao, phạm vi phát hành đối chiếu từng mục, mọi task DONE có bằng chứng và việc còn lại có backlog rõ ràng.

