# Góc chơi của bé — TC-029

TinyClass bổ sung ba kiểu trò chơi cho hoạt động cô dạy tại nhà và gia đình luyện tập cùng bé. Mẫu trò chơi được soạn một lần; mỗi lần giao giữ một bản nội dung riêng. Tài liệu liên quan: [spec](spec/07-games.md), [plan](plan/2026-11-08-games.md), [API](spec/openapi.yaml).

## Giáo viên

1. Vào **Học liệu → Kho trò chơi → Tạo trò chơi**. Nhập tên, kiểu chơi, hướng dẫn và khoảng tuổi gợi ý.
2. Soạn câu hỏi/cặp thẻ hoặc chọn **Dùng nội dung gợi ý** để có nội dung khởi đầu rồi chỉnh theo bài dạy. Chữ trên thẻ dùng để mô tả hình và hỗ trợ gia đình đọc cho bé.
3. Có thể chọn ảnh và âm thanh từ kho học liệu của cô hoặc tải tệp trong cửa sổ chọn. Tệp phải thuộc cô, loại `LESSON_ASSET`, đúng MIME ảnh/âm thanh và đã sẵn sàng. Thẻ phải có nhãn; ảnh/âm thanh là tùy chọn.
4. **Lưu bản nháp** cho phép nội dung còn thiếu. **Chơi thử** và **Xuất bản** kiểm tra đầy đủ nội dung. Chơi thử dùng cùng bộ máy, được lưu riêng và không tính vào kết quả của bé.
5. **Giao trò chơi** cho một lớp đang hoạt động hoặc riêng một bé. Đặt giờ mở theo giờ Việt Nam; hạn gợi ý là tùy chọn. Có thể gắn với một bài học hoặc khóa học đã xuất bản.
6. Vào **Các lần giao và kết quả** để xem số lượt hoàn thành, sao tốt nhất và lịch sử từng bé. Có thể thu hồi cả lần giao hoặc cấp thêm/cấp lại quyền cho bé đủ điều kiện, kèm lý do.

| Kiểu | Nội dung cần soạn | Cách chơi |
|---|---|---|
| Chọn hình đúng (`CHOICE`) | 1–12 câu; mỗi câu 2–4 lựa chọn, một đáp án đúng; gợi ý tùy chọn | Bé chọn đáp án, sai được thử lại; đúng chuyển câu tiếp |
| Ghép cặp (`MATCH`) | 2–8 cặp, mỗi mặt thẻ có nội dung phân biệt | Bé chọn thẻ trái rồi chọn bạn tương ứng bên phải |
| Lật thẻ ghi nhớ (`MEMORY`) | 2–8 cặp, hai mặt trong một cặp giống nhau | Bé mở hai thẻ; cặp sai hiện ngắn rồi úp lại; cặp đúng giữ mở |

Sửa mẫu đã xuất bản cần lý do và tăng phiên bản nội dung. Các lần giao cũ tiếp tục dùng bản đã giao. Lưu trữ mẫu dừng việc tạo lần giao mới; muốn dừng quyền của gia đình, cô thu hồi lần giao tương ứng. Có thể khôi phục mẫu về trạng thái trước khi lưu trữ.

## Gia đình

Sau khi đăng nhập bằng tài khoản phụ huynh đã xác minh và chọn bé, mở **Góc chơi của bé** trong menu hoặc hồ sơ. Trò chơi đã gắn với bài/khóa cũng xuất hiện ở phần **Cùng bé chơi thêm** của nội dung đó, khi cả nội dung học và trò chơi còn quyền xem.

- **Cùng bé chơi / Chơi tiếp** mở bàn chơi toàn màn hình. Các nút lớn dùng được bằng chạm hoặc bàn phím. Âm thanh phát khi bấm nghe; không tự phát khi tải trang.
- Lượt tự lưu sau mỗi lần chọn. Rời góc chơi, tải lại hoặc quay lại sau vẫn tiếp tục lượt đang chơi của tài khoản đó. **Bắt đầu lại** dừng lượt cũ và mở lượt mới sau xác nhận.
- Sau khi hoàn thành, bé nhận sao và có thể chơi lại. Bộ sưu tập giữ số sao tốt nhất của mỗi lần giao, không cộng thêm vô hạn khi lặp một trò.
- Nếu mất phản hồi khi gửi lựa chọn, **Thử lại** gửi lại cùng mã thao tác. Hệ thống không tính hai lần. Khi hai tab thay đổi cùng lượt, server yêu cầu tải trạng thái hiện tại.
- Mỗi phụ huynh có lượt đang chơi riêng cho cùng bé/lần giao; thành tích của bé lấy kết quả tốt nhất từ các lượt thật.

| Kết quả hoàn thành | Sao |
|---|---|
| Không sai, không dùng gợi ý | 3 |
| Số lần sai không quá số câu/cặp và dùng không quá một gợi ý | 2 |
| Các lượt hoàn thành khác | 1 |
| Chưa hoàn thành hoặc đã dừng | 0 |

Gợi ý lặp lại ở cùng câu/bàn không tăng số gợi ý. MEMORY tính một lần sai cho một cặp lật không khớp. Nhãn bộ sưu tập xuất hiện ở mốc 1, 3 và 5 lần giao đã hoàn thành. Các số liệu này ghi nhận hoạt động chơi, không phải đánh giá phát triển của bé.

## Quyền và lưu kết quả

- Lớp/bé/người nhận phải đang hoạt động; tài khoản phụ huynh cần liên kết guardian còn hiệu lực. Trước giờ mở chỉ thấy thông tin khóa thời gian, chưa chơi hoặc lấy tệp được.
- Danh sách người nhận là các bé đủ điều kiện lúc cô giao. Thêm bé vào lớp sau đó cần cô cấp thêm quyền rõ ràng.
- Với lần giao theo lớp, rời lớp hoặc kết thúc/lưu trữ lớp chặn mở đề, lấy tệp và thao tác, kể cả gửi lại yêu cầu cũ. Quay lại/khôi phục lớp không tự nhận lại quyền chơi; cô cấp lại trong trang kết quả. Lần giao trực tiếp cho bé không gắn với một lớp cụ thể; cô thu hồi lần giao để dừng quyền đó. Lưu trữ bé chặn mọi lần giao của bé.
- Bộ sưu tập và lịch sử hoàn thành được giữ khi rời lớp hoặc lần giao bị thu hồi, nếu guardian còn hiệu lực. Thu hồi guardian chặn cả lịch sử của bé.
- Máy chủ giữ đáp án, ID cặp và mặt thẻ úp. API lượt chỉ trả nội dung đang được phép nhìn thấy. Các tệp dùng URL có ngữ cảnh bé/lần giao và được kiểm tra quyền trước stream/Range. Tải xuống tuân theo cờ cho phép tải hiện tại của tệp.
- Tiến độ trò chơi theo dõi riêng. Chơi xong không tự thay yêu cầu xác nhận của phụ huynh hoặc duyệt sản phẩm của bài học liên quan.

## Dữ liệu và API

Migration **V20** thêm `learning_games`, `game_assignments`, `game_recipients`, `game_attempts`, `game_moves`, `game_attempt_starts`; không đổi migration đã áp dụng. Tệp tiếp tục dùng cơ chế lưu byte trong database V19.

Mỗi lượt có snapshot, bộ thẻ đã xáo, trạng thái `IN_PROGRESS/COMPLETED/ABANDONED`, version và bộ đếm phía server. Mã bắt đầu mới có thể ánh xạ tới lượt đang chơi; gửi lại mã đó sau khi lượt hoàn thành vẫn trả đúng lượt cũ. Mở lượt mới dùng UUID mới. Mỗi thao tác có UUID/hash/version, giới hạn 1.000 sự kiện/lượt, gồm cả yêu cầu gợi ý. Cấp lại quyền khóa lớp/bé trước lần giao để đồng bộ với thay đổi thành viên.

Danh sách dùng quyền trước count/page, tối đa 100 phần tử/trang. Khối trò chơi liên quan lấy tối đa 100 và có danh sách đầy đủ ở góc chơi. Chi tiết endpoint/request/response nằm trong tag **Games** của OpenAPI.

## Review local

TinyClass đang chạy tại **http://127.0.0.1:5175**; backend **8081**. Cổng 5173 thuộc ứng dụng khác.

Dữ liệu demo có ba mẫu đã xuất bản và sáu lần giao cho hai lớp. Với tài khoản `parent.demo@tinyclass.test`, mật khẩu `TinyClassDemo!2026`, chọn **Nguyễn An Nhiên → Góc chơi của bé**: có một lượt chọn hình đã hoàn thành được 3 sao, một lượt ghép cặp đang làm và trò lật thẻ để khám phá. Đây là hoạt động giả phục vụ review. Tài khoản giáo viên và dữ liệu cũ được giữ nguyên.

Bản đầu chưa có thi đấu, bảng xếp hạng, chơi offline, ghi âm câu trả lời, chấm giọng nói hoặc tạo nội dung bằng AI. Google thật, Drive và công việc phát hành production vẫn theo backlog riêng.
