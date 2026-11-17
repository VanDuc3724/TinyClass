# TinyClass — Góc chơi của bé

Ngày **08/11/2026**. Người dùng đã duyệt triển khai bản đầu gồm **Chọn hình đúng, Ghép cặp, Lật thẻ ghi nhớ**, cùng soạn/chơi thử/giao nội dung/xem kết quả. Task [TC-029](../plan/2026-11-08-games.md). Dùng React/Spring Boot hiện có và [Design.md](../../frontend/Design.md).

## Luồng giáo viên

1. Kho trò chơi: tìm kiếm/lọc loại và trạng thái, tạo mẫu, sửa, xuất bản, lưu trữ/khôi phục.
2. Soạn tên/hướng dẫn, khoảng tuổi gợi ý và nội dung theo mẫu. Câu hỏi/thẻ dùng chữ hoặc emoji, ảnh và âm thanh từ kho học liệu của cô. Ảnh/âm thanh được kiểm tra quyền và MIME tại backend.
3. Chơi thử dùng cùng bộ máy với gia đình, có thể chơi lại; kết quả thử không cộng vào hồ sơ bé.
4. Giao bản đã xuất bản cho lớp đang hoạt động hoặc riêng bé, chọn thời điểm mở và hạn gợi ý. Có thể liên kết bài học/khóa đã xuất bản để gia đình tìm trò chơi trong Góc học.
5. Mỗi lần giao giữ snapshot tên/hướng dẫn/nội dung/phiên bản. Sửa mẫu không thay đề của lần giao cũ. Lưu trữ mẫu dừng lần giao mới; cô thu hồi lần giao khi cần dừng quyền chơi bản đã giao.
6. Xem danh sách bé đã nhận, lượt đang chơi/đã xong, số đúng/sai, gợi ý, thời gian lượt chơi và sao tốt nhất; xem lịch sử lượt theo bé. Kết quả thuộc giáo viên của lần giao.

## Luồng gia đình

- Phụ huynh đã xác minh chọn bé → Góc chơi → trò được giao. Danh sách có trạng thái chờ mở, sẵn sàng, đang chơi và đã hoàn thành; bộ sưu tập sao/nhãn dán thuộc đúng bé.
- Chỉ tới thời điểm mở mới bắt đầu/tiếp tục/chơi/xem tệp. Hạn gợi ý không tự khóa trò.
- Chọn hình đúng: xem/nghe câu hỏi, chạm một đáp án; chọn sai nhận động viên và thử lại, chọn đúng chuyển câu tiếp theo.
- Ghép cặp: chọn thẻ bên trái rồi một thẻ bên phải. Cặp đúng được giữ, cặp sai được thử lại. Không cần kéo thả; dùng được bằng bàn phím.
- Lật thẻ: các thẻ ban đầu úp, chạm để lật; hai thẻ giống nhau được giữ, hai thẻ khác nhau hiện ngắn rồi úp lại. Backend chỉ trả mặt thẻ đã được phép lật hoặc đã ghép đúng.
- Có hướng dẫn, âm thanh theo nội dung cô chọn, gợi ý và nút quay về. Tiến độ lưu sau từng thao tác; quay lại tiếp tục lượt đang chơi của chính phụ huynh đó.
- Hoàn thành nhận 1–3 sao và lời động viên. Chơi lại tạo lượt mới. Bộ sưu tập lấy sao tốt nhất của mỗi lần giao, không cộng lại mãi từ một trò.
- Lịch sử kết quả chỉ gồm thông tin tóm tắt, giữ khi rời lớp nếu guardian còn hiệu lực. Rời lớp/kết thúc/lưu trữ lớp chặn đề, thao tác và tệp của các lần giao qua lớp đó. Lần giao trực tiếp cho bé độc lập với lớp, dừng khi cô thu hồi lần giao hoặc lưu trữ bé. Bé quay lại lớp không tự nhận lại quyền cũ; cô có thể cấp lại có chủ đích. Thu hồi guardian chặn cả lịch sử của bé.

## Dữ liệu và kiểm tra

- Ba loại `CHOICE`, `MATCH`, `MEMORY`; mẫu `DRAFT/PUBLISHED/ARCHIVED`, có version chống ghi đè và content revision. Bản nháp có thể chưa đủ nội dung; xuất bản/chơi thử cần hợp lệ đầy đủ.
- CHOICE: 1–12 câu, mỗi câu 2–4 đáp án và một đáp án đúng, gợi ý tùy chọn. ID câu/đáp án phải duy nhất.
- MATCH/MEMORY: 2–8 cặp; MEMORY dùng hai mặt giống nhau trong từng cặp. Không dùng cặp rỗng. Các lựa chọn/thẻ có giới hạn chữ, ảnh/âm thanh phải thuộc cô và còn READY.
- Lần giao có `clientRequestId/hash`, một lớp hoặc một bé, optional lesson/course context, snapshot và danh sách người nhận. Lớp chỉ lấy thành viên hiện tại; thêm bé mới sau đó cần cô cấp lại. Ngày mở/hạn đúng thứ tự, timestamps UTC; hiển thị ngày giờ Việt Nam.
- Lượt có chủ thể, snapshot/deck riêng, trạng thái phía server, version, thời gian, moves/correct/wrong/hints/stars. Có tối đa một lượt đang chơi của một phụ huynh cho một bé/lần giao; các phụ huynh cùng bé có lượt riêng.
- Thao tác có UUID chống gửi lặp và request hash. Backend kiểm tra nguồn, actor, version và tự đối chiếu đáp án, đếm và hoàn thành; client không tự gửi điểm hoặc sao. Retry không lặp điểm hay thao tác. Giới hạn tối đa 1.000 thao tác/lượt.
- Điểm tóm tắt: số hoàn thành/đúng và số lần trả lời hoặc ghép sai. Tỷ lệ đúng là correct/(correct+wrong), không suy thành đánh giá phát triển. MEMORY đếm sai theo một cặp lật, không tính từng thẻ là câu trả lời sai.
- Sao: 3 khi không sai/không dùng gợi ý, 2 khi sai không quá số câu/cặp và dùng không quá một gợi ý, 1 cho các lượt hoàn thành còn lại. Lượt chưa xong có 0 sao. Bộ sưu tập tính best stars theo lần giao; nhãn dán mốc 1/3/5 lần giao đã hoàn thành.
- Đáp án đúng, cặp bí mật và mặt thẻ úp không nằm trong DTO gia đình. Tệp gia đình dùng route có ngữ cảnh lần giao, quyền kiểm tra trước stream/Range; quyền tải theo cờ tệp hiện tại.
- Tiến độ trò chơi được theo dõi riêng. Liên kết bài/khóa là lối vào theo ngữ cảnh; trò chơi không tự thay yêu cầu PARENT_CONFIRM/TEACHER_REVIEW của các bài đã có.

## API sau `/api/v1`

| Nhóm | API |
|---|---|
| Mẫu của cô | `GET/POST /games`, `GET/PUT /games/{id}`, `POST /games/{id}/{publish|archive|restore}` |
| Chơi thử | `POST /games/{id}/preview-attempts` |
| Lần giao | `GET/POST /game-assignments`, `GET /game-assignments/{id}`, `POST /game-assignments/{id}/revoke`, `POST /game-assignments/{id}/recipients` |
| Kết quả của cô | `GET /game-assignments/{id}/results`, `GET /game-assignments/{id}/students/{child}/results` |
| Gia đình | `GET /family/children/{child}/games`, `/games/collection`, `/games/history`, `GET /family/children/{child}/game-assignments/{id}` |
| Bắt đầu/tiếp tục | `POST /family/children/{child}/game-assignments/{id}/attempts` |
| Lượt | `GET /game-attempts/{id}`, `POST /game-attempts/{id}/moves`, `POST /game-attempts/{id}/abandon` |
| Tệp | `GET /family/children/{child}/game-assignments/{id}/files/{file}/{content|download}` |
| Gắn Góc học | `GET /family/children/{child}/assignments/{assignment}/games`, `/assignment-items/{item}/games` |

Mọi list dùng filter quyền trước count/page, size tối đa 100. Khối trò chơi liên quan lấy tối đa 100, còn danh sách đầy đủ có phân trang trong góc chơi. Quản trị chỉ TEACHER; gia đình cần PARENT/verified/guardian. 404 cho ID ngoài quyền, 409 cho version/trạng thái/retry khác dữ liệu, 400 cho cấu hình không hợp lệ. POST/PUT dùng session/CSRF như hệ thống hiện tại.

Lượt có trạng thái `IN_PROGRESS/COMPLETED/ABANDONED`. Dừng lượt chưa xong dùng version và giải phóng chỗ để bắt đầu lại. Mã bắt đầu đã ánh xạ vào lượt nào giữ nguyên lượt đó khi retry, kể cả sau khi xong/dừng; bắt đầu lượt mới dùng UUID mới. Cấp lại quyền khóa đích lớp/bé trước lần giao để không mở lại quyền dựa trên điều kiện thành viên đã cũ.

## Nghiệm thu

- Ba loại tạo, sửa, chơi thử, xuất bản/giao và chơi thật hoàn thành được từ UI desktop/mobile; âm thanh/ảnh và lựa chọn bằng bàn phím hoạt động.
- Điểm/sao/bộ sưu tập đúng, retry và hai tab không ghi đè; quay lại không mất lượt; chơi thử không tạo thành tích bé.
- Mẫu sửa sau khi giao không đổi đề cũ; đáp án/mặt úp không lộ; asset không thuộc lần giao bị chặn.
- Đổi bé, sai actor/role, chưa xác minh, chưa giờ mở, rời/quay lại/lưu trữ/thu hồi đều bảo vệ list/count/attempt/move/file/history theo chính sách trên.
- Migration mới sau V19, giữ nguyên migration cũ và dữ liệu hiện có; backend verify, build/lint và E2E trên DB test riêng, không reset dữ liệu review local.
