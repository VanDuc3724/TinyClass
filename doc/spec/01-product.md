# TinyClass — Đặc tả sản phẩm và phạm vi

Trạng thái: yêu cầu đã xác nhận kết hợp phạm vi phát hành đề xuất. Nguồn: [tổng quan mục 1–7](../01-mo-ta-he-thong.md#s01). Quyết định còn mở: [06-decisions.md](06-decisions.md).

<a id="requirements"></a>
## 1. Mục tiêu và người dùng

TinyClass phục vụ một giáo viên cá nhân dạy trẻ mầm non trực tiếp tại nhà. Giáo viên tạo nhiều lớp, quản lý học sinh, đăng nội dung theo chủ đề/khóa học và chia sẻ để gia đình cùng trẻ học thêm.

| Người sử dụng | Nhu cầu |
|---|---|
| Giáo viên `TEACHER` | Quản lý lớp và việc dạy, dùng lại học liệu, xem sản phẩm, theo dõi khoản thu |
| Phụ huynh `PARENT` | Xem đúng thông tin của con, mở bài, gửi sản phẩm và theo dõi phản hồi |
| Trẻ | Dùng “Góc học của bé” trong tài khoản phụ huynh, giao diện nhiều hình và ít thao tác |

Trẻ là hồ sơ học tập, không có một vai trò đăng nhập riêng trong phương án hiện tại. Quan hệ một phụ huynh–nhiều bé và nhiều người giám hộ–một bé là mặc định thiết kế cần review.

## 2. Các đối tượng chính

- **Lớp:** nhóm trẻ học thực tế; lớp kèm một bé cũng dùng cùng mô hình.
- **Buổi học:** một lần gặp có ngày/giờ, điểm danh và ghi chú.
- **Chủ đề:** phân loại bài; một bài có thể có nhiều chủ đề.
- **Khóa học:** tập bài có thứ tự; không đồng nhất với danh sách trẻ hoặc đợt thu học phí.
- **Bài học:** nội dung độc lập có hướng dẫn và các khối chữ/video/ảnh/âm thanh/PDF.
- **Lần giao:** cấp một bài hoặc khóa cho lớp/từng bé, có người nhận và yêu cầu riêng.
- **Thỏa thuận học phí:** cách tính giá, thời điểm thu và điều kiện nghỉ/bù cho một bé trong lớp.

Một bài có thể dùng ở nhiều khóa/lớp. Quyền xem xuất phát từ lần giao và quan hệ với bé, không từ việc bài đã xuất bản trong kho.

## 3. Phạm vi phát hành đầu đề xuất

| Nhóm | Kết quả tối thiểu | Tham chiếu yêu cầu gốc |
|---|---|---|
| Tài khoản | Email/mật khẩu, Google, lời mời, xác minh và khôi phục | FR-01, FR-04 |
| Lớp và học sinh | CRUD, tham gia/rút lớp, liên kết gia đình | FR-02, FR-03 |
| Học liệu | Chủ đề, bài, khóa; nháp/xuất bản/lưu trữ | FR-05 đến FR-08 |
| Lưu tệp | Chọn máy chủ hoặc Drive cá nhân, xem/tải theo quyền giáo viên đặt | FR-07 |
| Học ở nhà | Giao nội dung, xem, xác nhận, gửi sản phẩm và nhận xét | FR-09 đến FR-12 |
| Quản lý buổi dạy | Lịch, điểm danh; nhận xét riêng/chia sẻ theo task tiếp theo. Học bù tạm hoãn ngày 02/11/2026 | FR-13 đến FR-15 |
| Khoản thu | Cấu hình cách tính/thu, lập phiếu, ghi tiền và số còn lại | FR-16 |
| Trao đổi và tổng quan | Thông báo lớp, cập nhật trong ứng dụng, dashboard đúng vai trò | FR-17, FR-18 |

Đây là đề xuất đủ chức năng ở mức cơ bản, phát triển từng phần theo plan. Phạm vi phát hành cuối cùng vẫn theo quyết định `Q-09`. Trò chơi, buổi học trực tuyến, thanh toán qua cổng, tự động nhắn qua dịch vụ ngoài, ví số buổi trả trước và chuyển tệp giữa kho thuộc hướng mở rộng.

## 4. Các luồng phải chạy trọn vẹn

1. Giáo viên tạo lớp → thêm bé → mời gia đình → phụ huynh đăng nhập và thấy đúng con.
2. Giáo viên upload → chọn nơi lưu/quyền tải → tạo bài/khóa → giao lớp → gia đình mở đúng nội dung.
3. Gia đình thực hiện → xác nhận hoặc gửi sản phẩm → giáo viên phản hồi → tiến độ thay đổi đúng quy tắc.
4. Giáo viên lập lịch → chốt danh sách → điểm danh → hoàn thành buổi → xem lịch sử đúng bé, đúng buổi. Học bù chưa thuộc phạm vi hiện tại.
5. Giáo viên đặt thỏa thuận → xem trước phí → phát hành phiếu → ghi thu → gia đình thấy đúng số còn lại.
6. Bé rời lớp → ngừng bài/lịch/bảng tin theo quyền nguồn; giữ sản phẩm/phản hồi, nhận xét SHARED và học phí đúng bé khi guardian còn hiệu lực. Thu hồi guardian chặn cả lịch sử; thời hạn lưu/vận hành dữ liệu thật còn cần chốt.

## 5. Màn hình và bản phác thảo bố cục

Danh sách route ở [mục 7 của tổng quan](../01-mo-ta-he-thong.md#s07); các bố cục sau là wireframe mục tiêu. Giao diện hiện dùng tím/Nunito, CSS variables + CSS Modules theo [Design.md](../../frontend/Design.md). TC-025 bổ sung tổng học phí/cập nhật theo lớp, tổng quan tài khoản gia đình và từng bé, tiến độ/lối tiếp tục hoạt động; xem [hướng dẫn](../17-tong-quan-va-trai-nghiem.md). Các tích hợp ngoài/vận hành thật tiếp tục theo backlog.

### Trang giáo viên

```text
TinyClass                       Tài khoản giáo viên
Tổng quan | Lớp | Học sinh | Học liệu | Lịch | Học phí

Hôm nay                         Việc cần xem
- Buổi sắp dạy                  - Sản phẩm chờ nhận xét
- Danh sách điểm danh           - Cập nhật gần đây

[Tạo lớp] [Tạo bài] [Ghi nhận học phí]
```

### Chi tiết lớp

```text
Tên lớp                 Trạng thái / Lịch / Sĩ số
Thông tin | Học sinh | Bài đã giao | Lịch | Nhận xét | Phí

Danh sách tương ứng với tab đang chọn
Tìm kiếm / bộ lọc / thao tác tạo mới theo tab
```

### Gia đình và bài học

```text
TinyClass                  [Chọn con]
Lớp của con | Bài học | Lịch | Nhận xét | Học phí

Hoạt động cần xem           Buổi học tiếp theo
Phản hồi của cô             Thông báo của lớp

Bài đang mở
- Nội dung xem/nghe
- Hướng dẫn thực hành
- Nút tải nếu tệp được phép
- Xác nhận hoặc gửi sản phẩm theo yêu cầu
```

Góc học của bé tập trung một bài, nút xem/nghe lớn và phần hướng dẫn ngắn. Các thao tác thu tiền, quản lý lớp và cài đặt nằm ở giao diện người lớn. Chế độ này là cách hiển thị, không phải một hàng rào quyền mới tách khỏi session phụ huynh.

## 6. Nguyên tắc trải nghiệm

- Giao diện tiếng Việt, thuận tiện trên điện thoại; tên sản phẩm TinyClass dùng tiếng Anh như đã chốt.
- Có trạng thái đang tải, chưa có dữ liệu, lỗi, thử lại và thay đổi chưa lưu.
- Nháp/xuất bản, đã mở/đã hoàn thành và lớp/khóa là các nhãn khác nhau.
- Hiển thị phạm vi ảnh hưởng trước khi sửa bài đang được dùng, đổi cờ tải, thu hồi quyền hoặc sửa khoản thu.
- Có dữ liệu nhập mẫu giả, không yêu cầu hồ sơ trẻ thật để bắt đầu kiểm thử.

<a id="acceptance"></a>
## 7. Điều kiện hoàn thành cấp sản phẩm

- Các luồng mục 4 chạy qua frontend, API và database, không chỉ dùng dữ liệu giả ở giao diện.
- Gia đình không thấy dữ liệu của trẻ ngoài quan hệ được cấp; thay ID và đường dẫn tệp vẫn bị chặn.
- Cả hai kho lưu và cả hai cách đăng nhập có kịch bản thành công/thất bại phù hợp.
- Có bằng chứng kiểm thử cho tiến độ, thu hồi quyền, tính phí và chống gửi lặp.
- Phạm vi đưa vào phát hành được đối chiếu từng nhóm, không coi bộ khung khởi tạo là sản phẩm đã hoàn thiện.

