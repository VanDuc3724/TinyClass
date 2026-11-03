# TinyClass — Học liệu, kho lưu và học ở nhà

Nguồn: [quy tắc](../01-mo-ta-he-thong.md#s06), [schema](../01-mo-ta-he-thong.md#s09), [API](../01-mo-ta-he-thong.md#s10). Phụ thuộc [tài khoản/lớp](02-auth-and-classes.md). Giới hạn dung lượng và kho mặc định là đề xuất tại [06-decisions.md](06-decisions.md).

Trạng thái 02/11/2026: đã có LOCAL, chủ đề/bài/khóa, snapshot giao bài, quyền tệp theo bé/item, Góc học, xác nhận và nộp/duyệt sản phẩm theo vòng. [Học liệu](../08-hoc-lieu-local.md), [sản phẩm/phản hồi](../09-san-pham-va-phan-hoi.md), [bằng chứng TC-015/016](../verification/2026-11-02-submissions.md), [OpenAPI thực tế](openapi.yaml). Drive và Google login thật vẫn tạm hoãn/chưa tích hợp theo phạm vi đã ghi.

<a id="requirements"></a>
## 1. Kho nội dung

| Mã | Yêu cầu |
|---|---|
| LEARN-01 | Bài tồn tại độc lập, gắn nhiều chủ đề, dùng lại trong nhiều khóa/lớp. |
| LEARN-02 | Bài gồm tiêu đề, hướng dẫn cho gia đình, hoạt động và các khối chữ/video/ảnh/âm thanh/PDF có thứ tự. |
| LEARN-03 | Khóa là tập bài có thứ tự, mỗi bài xuất hiện tối đa một lần; có bài bắt buộc/tùy chọn. |
| LEARN-04 | Nháp có thể chưa đầy đủ. Xuất bản bài cần nội dung hợp lệ và tệp READY; xuất bản khóa cần ít nhất một bài đã xuất bản. |
| LEARN-05 | Xuất bản trong kho chưa tự cấp quyền cho gia đình. Lưu trữ ngừng giao mới, không làm mất lịch sử lần giao cũ. |
| LEARN-06 | Sửa bài đã xuất bản là cập nhật nội dung dùng chung, phải báo phạm vi ảnh hưởng; không tự xóa tiến độ. |

Nội dung chữ ban đầu là plain text. Nhập URL/nhúng video ngoài, rich text và hệ thống phiên bản nội dung đầy đủ là hướng mở rộng. Các trường dự trù trong schema không đồng nghĩa đã bật các tính năng đó ở bản đầu.

## 2. Hai nơi lưu có thể chọn

| Mã | Yêu cầu |
|---|---|
| FILE-01 | Giáo viên upload trực tiếp, chọn máy chủ hệ thống (`LOCAL`) hoặc Drive cá nhân (`GOOGLE_DRIVE`). |
| FILE-02 | Một nơi mặc định, có thể đổi khi upload. Mặc định chỉ tác động tệp mới; một lớp có thể dùng tệp từ cả hai kho. |
| FILE-03 | Database lưu metadata và connection/key; byte tệp nằm trong kho riêng tư. |
| FILE-04 | Backend kiểm tra quyền và stream qua API, hỗ trợ Range cho video; không phát link Drive công khai để bỏ qua kiểm tra lớp. |
| FILE-05 | Mỗi học liệu có `learner_download_allowed`; gia đình cần quyền xem hiện tại và cờ cho phép mới gọi được download. |
| FILE-06 | Upload/sản phẩm của phụ huynh dùng kho mặc định do giáo viên chọn; phụ huynh không sửa kết nối/kho/cờ học liệu. |
| FILE-07 | Lỗi kho, hết dung lượng hoặc mất quyền Drive giữ metadata/phần chữ nháp, không tự đổi nơi lưu. |

### LOCAL

Thư mục upload nằm ngoài public/static/gói build; đường dẫn tương đối do server tạo và kiểm tra luôn trong root cấu hình. Cần ổ bền vững khi triển khai/redeploy và sao lưu folder cùng dữ liệu tham chiếu. Tệp không được đưa vào Git hoặc cột BLOB chỉ để phục vụ lưu trữ học liệu.

### Drive cá nhân

Giáo viên cấp quyền qua luồng OAuth lưu trữ riêng. Backend quản lý folder ứng dụng và token đã mã hóa; dữ liệu định danh Google login không kiêm nhiệm kết nối Drive. Giáo viên có thể dùng email/mật khẩu để đăng nhập rồi kết nối Drive. Phụ huynh không cần cấp quyền Drive.

Ngắt kết nối giữ metadata, ngừng phục vụ tệp ở kết nối đó; kết nối lại phải đúng tài khoản/kho. Việc tự chia sẻ file Drive bên ngoài ứng dụng không nằm trong quyền thu hồi lớp của TinyClass. Giao diện cần diễn đạt đúng phạm vi này.

### Xem và tải

- Preview trả inline, download trả attachment; cả hai kiểm tra ngữ cảnh tài nguyên hiện tại.
- Với học liệu, request có `studentId` và `assignmentItemId`; backend kiểm tra file thuộc bài/item, bé có quyền và đã đến giờ mở.
- Với sản phẩm/nhận xét, kiểm tra bé và bản ghi tương ứng; không chỉ xác nhận biết file ID hoặc là người upload.
- Cờ chỉ xem chặn nút/endpoint tải của ứng dụng, không bảo đảm ngăn lưu byte đã nhận hoặc quay màn hình.
- Rời lớp chặn yêu cầu mới. Bản đã tải hợp lệ, dữ liệu đã truyền hoặc buffer trước thu hồi không thể thu lại.
- Đổi cờ một file ảnh hưởng mọi nơi dùng file đó; cần nêu phạm vi trước khi lưu.

Giới hạn đề xuất: ảnh 10 MB, âm thanh 20 MB, PDF 50 MB, video 200 MB; sản phẩm tối đa 5 file/tổng 250 MB. Kiểm tra MIME, dung lượng và trạng thái, dọn tệp rời có kiểm tra tham chiếu. Hạ tầng thực tế cần xác nhận các mức này trước sử dụng thật.

## 3. Giao nội dung

1. Chọn đúng một nguồn: bài hoặc khóa; đúng một đích: lớp hoặc bé.
2. Tạo nháp, sao chép danh sách bài và yêu cầu vào `assignment_items`; giữ được các điều chỉnh của giáo viên.
3. Đặt thời điểm mở, hạn khuyến nghị và cách hoàn thành từng item.
4. Khi xuất bản, kiểm tra các bài được phép giao, cố định item và tạo người nhận trong cùng giao dịch.
5. Thêm bài/đổi thứ tự khóa nguồn không tự sửa nháp/lần giao đã tồn tại; nội dung bài dùng phiên bản đang lưu theo chính sách cập nhật dùng chung.
6. Chia sẻ nhiều lớp tạo các lần giao độc lập, hiển thị kết quả từng lớp và chống tạo lại khi retry.

Lần giao lớp lấy danh sách trẻ hiện tại khi xuất bản. Trẻ mới chỉ nhận lần giao cũ được chọn cấp thêm. Rút lớp thu hồi người nhận của lớp; quay lại không tự phục hồi. Giao riêng có quyền độc lập và phải gắn với hồ sơ bé còn hợp lệ.

Hạn là khuyến nghị: nộp muộn vẫn được nếu còn quyền, kèm nhãn sau hạn. Bài chưa đến giờ mở không trả nội dung/tệp, dù có thể hiện tiêu đề và giờ mở trong danh sách.

## 4. Tiến độ và sản phẩm

| Cách hoàn thành | Điều kiện | Tỷ lệ khóa |
|---|---|---|
| `REFERENCE` | Theo dõi việc mở, không yêu cầu hoàn thành | Không nằm trong mẫu số |
| `PARENT_CONFIRM` | Người giám hộ còn quyền xác nhận đã cùng bé thực hiện | Tính nếu item bắt buộc |
| `TEACHER_REVIEW` | Lượt sản phẩm được giáo viên chấp nhận | Tính nếu item bắt buộc |

Tiến độ riêng cho `(student_id, assignment_item_id)`. Không có dòng tương đương NOT_STARTED; mở trang chỉ đổi sang OPENED và ghi mốc mở. Không suy ra trẻ đã hiểu bài từ việc phát video.

Luồng sản phẩm: `DRAFT → SUBMITTED → ACCEPTED` hoặc `CHANGES_REQUESTED → lượt mới`. Chỉ người tạo sửa nháp; người giám hộ còn liên kết xem được sản phẩm của bé. Mỗi bé/item tối đa một lượt đang SUBMITTED. Số lượt cấp trong giao dịch; lượt cũ/phản hồi cũ được giữ.

Yêu cầu bổ sung cần nhận xét giải thích. Sau hoàn thành, làm lại cần giáo viên mở lại có lý do, đặt lại hiện trạng tiến độ và giữ lịch sử. Lượt ACCEPTED trước khi mở lại không tự hoàn thành vòng mới.

Tỷ lệ là số item bắt buộc hoàn thành chia tổng item bắt buộc không phải REFERENCE. Nếu không có item như vậy, hiển thị “Nội dung tham khảo”. Cùng bài gốc ở hai lần giao có hai tiến độ riêng.

## 5. Dữ liệu/API/màn hình

| Nhóm | Dữ liệu | API chính sau `/api/v1` |
|---|---|---|
| Thư viện | `topics`, `lessons`, `lesson_blocks`, `lesson_topics`, `courses`, `course_lessons` | `/topics`, `/lessons`, `/courses`, publish/archive và cập nhật có version |
| Kho/file | `storage_connections`, `files` | `/storage-connections`, luồng `/storage/google-drive/*`, `/files`, `/files/{fileId}/policy`, `/content`, `/download` |
| Lần giao | `assignments`, `assignment_items`, `assignment_recipients` | `/assignments`, publish/revoke/recipients |
| Học tập | `student_progress`, `submissions`, `submission_attachments` | API family theo bé/item, confirm/open, submit/review/reopen |

Route chi tiết và DTO theo [hợp đồng gốc](../01-mo-ta-he-thong.md#s10). Các dòng `/content` và `/download` trong bảng là hậu tố của `/files/{fileId}`, không phải endpoint ở gốc.

Màn hình giáo viên: thư viện, soạn bài, sắp khóa, upload/chọn kho, lần giao và hàng đợi nhận xét. Gia đình: danh sách bài theo con, khóa/item, preview, xác nhận, upload sản phẩm, lịch sử phản hồi. Chú ý trạng thái upload, lưu nháp, bị thu hồi và tài liệu tạm không khả dụng.

<a id="acceptance"></a>
## 6. Nghiệm thu

Tham chiếu `AC-08`–`AC-22`, `AC-31`, `AC-34`–`AC-37`, `AC-41` ở [bộ gốc](../01-mo-ta-he-thong.md#s13).

- Giáo viên dùng lại bài ở hai lớp; thay đổi danh sách khóa không làm sai tiến độ cũ.
- Nháp/chưa mở/thu hồi không truy cập được bằng cách gọi trực tiếp file hoặc đổi ngữ cảnh.
- Hai kho hoạt động qua cùng luồng; đổi mặc định không di chuyển file cũ.
- Cờ tải đúng ở cả UI và API; việc thu tiền trước không tạo quyền vĩnh viễn sau rời lớp.
- Gửi lại request tạo lần giao không nhân đôi; gửi sản phẩm đồng thời không có hai lượt đang chờ.
- Chấp nhận/mở lại/yêu cầu bổ sung cập nhật tiến độ và lịch sử nguyên tử.

## 7. Các lựa chọn đã áp dụng cho LOCAL và giao bài

- V5 lưu storage/files; byte ở root riêng cấu hình qua TINYCLASS_UPLOAD_ROOT, mặc định `../.local/uploads` khi chạy từ Backend/. LOCAL mặc định được tạo lười dưới khóa user. Quota kỹ thuật mặc định 5 GiB, điều chỉnh bằng TINYCLASS_STORAGE_QUOTA_BYTES; kiểm tra cả các upload đang đặt chỗ để chống vượt đồng thời.
- Kiểm tra bằng Tika Core 3.3.3 và allowlist đuôi/MIME, WebM xác minh EBML DocType. Dung lượng theo MiB; server giới hạn multipart 200 MiB/tệp, 201 MiB/request. Khóa tương đối là teacher UUID/file UUID/đuôi, không dùng tên trình duyệt làm đường dẫn. Root không nằm trong static/public/build hoặc symlink.
- Upload giữ metadata UPLOADING, ghi tệp tạm/atomic move, checksum SHA-256, rồi READY; lỗi chuyển FAILED, cố dọn byte vừa ghi và giữ metadata. Preview/download qua Resource hỗ trợ Range; response no-store/nosniff. Không có đường public đến root.
- V6 dùng plain text và khối upload TEXT/IMAGE/AUDIO/VIDEO/PDF; không bật LINK/external URL. Khóa giữ thứ tự/required; bài tham khảo là tùy chọn. Sửa published cần acknowledgeSharedUpdate; archive giữ nội dung đã giao. Restore giữ trạng thái trước lưu trữ.
- V7 sao chép item từ bài/khóa vào draft, chỉnh yêu cầu với version. Khi publish khóa target/assignment, xác minh nguồn và tệp READY, tạo người nhận trong cùng giao dịch; class lấy enrollment ACTIVE/profile ACTIVE. class/bé không hợp lệ hoặc lớp chưa có người nhận bị chặn.
- client_request_id kèm request hash chống tạo lặp; publish retry không tạo lại recipients. Cấp bài cũ chỉ thực hiện khi cô chọn bé đang ở lớp và ghi lý do. Rút lớp thu hồi recipient trong cùng giao dịch, quay lại không tự phục hồi; giao riêng độc lập.
- Family list/count/item/file kiểm tra parent xác minh, guardian ACTIVE, recipient còn hiệu lực và trạng thái profile/class/enrollment. Trước giờ mở chỉ có tiêu đề/thời gian, không trả item/content/file. Family stream dùng `/family/children/{child}/assignment-items/{item}/files/{file}/content|download`; tải cần cờ hiện tại.
- OPEN chỉ ghi mốc mở; CONFIRM chỉ PARENT_CONFIRM, giữ người/thời điểm xác nhận đầu và idempotent khi gửi lại. Tỷ lệ đếm item bắt buộc không phải REFERENCE; không có item như vậy trả phần trăm null. Mỗi lần giao có item/progress mới, không tái dùng progress theo lesson ID.
- V8 triển khai TEACHER_REVIEW: nháp theo tác giả/vòng, tệp sản phẩm, gửi, phản hồi chữ/âm thanh, yêu cầu bổ sung/chấp nhận và mở lại. Quota tính cả tệp gia đình. Sản phẩm riêng còn đọc được sau rời lớp khi guardian còn hiệu lực; không cấp lại bài gốc. PARENT_CONFIRM cũng có thể được mở lại với lý do. Xem [hướng dẫn và lựa chọn cụ thể](../09-san-pham-va-phan-hoi.md).
- Chưa tự dọn tệp rời, chuyển mã video, kiểm tra phục hồi production hoặc tích hợp Drive thật.

