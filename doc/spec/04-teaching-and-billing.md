# TinyClass — Buổi dạy, nhận xét, học phí và thông báo

Nguồn: [quy tắc nghiệp vụ](../01-mo-ta-he-thong.md#s06), [dữ liệu/API](../01-mo-ta-he-thong.md#s09). Những mặc định nghỉ/bù, giữ lịch sử và phạm vi phát hành vẫn theo [quyết định cần chốt](06-decisions.md).

Trạng thái 03/11/2026: TEACH-01–07 có lịch V9/điểm danh V10; TC-019 có nhận xét/hành trình V11; TC-020 có cấu hình học phí V12; TC-021 có preview/phiếu và giữ buổi V13–V15. TC-022/023 thêm sổ thu V16, tổng đã thu/còn lại và lịch sử công khai đúng bé. Xem [lịch dạy](../10-lich-day.md), [điểm danh](../11-diem-danh.md), [nhận xét](../12-nhan-xet-va-tien-bo.md), [điều kiện học phí](../13-cau-hinh-hoc-phi.md), [phiếu](../14-phieu-hoc-phi.md), [thanh toán](../15-thanh-toan.md). **Học bù tạm hoãn theo người dùng ngày 02/11/2026**. Các đoạn bù bên dưới chỉ là đề xuất cũ cần xem lại. TC-024/V17 đã có bảng tin và cập nhật cá nhân; xem [hướng dẫn](../16-thong-bao-va-cap-nhat.md).

<a id="requirements"></a>
## 1. Lịch và điểm danh

| Mã | Yêu cầu |
|---|---|
| TEACH-01 | Quy tắc lịch tuần có thứ ISO, giờ, ngày hiệu lực, timezone; tạo được buổi riêng. |
| TEACH-02 | Sinh buổi trong khoảng chọn, chạy lại không tạo trùng theo rule/tuần ISO gốc; chuyển riêng buổi qua ngày/tuần khác vẫn giữ khóa gốc. |
| TEACH-03 | Sửa lịch tuần áp dụng đúng phạm vi tương lai, giữ buổi đã diễn ra/chỉnh riêng/có điểm danh. |
| TEACH-04 | Cảnh báo trùng giờ của giáo viên, xác nhận ngoại lệ trước khi lưu. |
| TEACH-05 | Danh sách điểm danh được chụp cho từng buổi, không viết lại theo danh sách lớp hiện tại. |
| TEACH-06 | UNMARKED khác có mặt/đi muộn/nghỉ có phép/nghỉ chưa báo. Buổi CANCELLED không tính là đã học. |
| TEACH-07 | Một bé/buổi có một dòng điểm danh; sửa có version và lịch sử. Học bù ngoài phạm vi hiện tại. |

Giờ nghiệp vụ là `Asia/Ho_Chi_Minh`; giờ tuyệt đối lưu UTC. Khi hủy buổi đã có điểm danh cần lý do và giữ bản ghi cũ để đối chiếu. API lưu nhiều dòng điểm danh trong cùng giao dịch; lỗi một dòng không ghi một phần không được thông báo.

TC-017 áp dụng các lựa chọn cụ thể sau:

- Lịch tuần cùng ngày, chính xác đến phút, tối đa 12 giờ; tối đa 50 rule/lớp. Rule được chuẩn bị ở lớp DRAFT/ACTIVE; chỉ lớp ACTIVE nhận buổi mới/đổi giờ.
- Sinh tối đa 93 ngày/lần, trong 366 ngày tới, tối đa 1.000 ứng viên; bỏ qua giờ đã qua, ngoài ngày lớp/hiệu lực hoặc đã có khóa tuần gốc. Buổi riêng dùng `clientRequestId`/hash theo lớp để retry không tạo lại.
- PATCH rule dùng `effectiveFrom` làm ngày áp dụng mới từ hôm nay. Chỉ điều chỉnh buổi tương lai đã sinh trong phạm vi; giữ ngoại lệ, hủy và mốc `roster_created_at`. Đổi thứ trong cùng tuần gốc; vị trí không còn hợp lệ bị hủy có lý do. Không tự sinh tuần chưa có buổi.
- Preview không ghi dữ liệu. Xung đột cần `allowConflicts` và `conflictKey` từ preview hiện tại; server tính lại trong khóa giao dịch theo giáo viên. Không ghi khi danh sách xung đột đã thay đổi. Hai buổi sát đầu/cuối không chồng giờ.
- Lịch gia đình theo liên kết đang hiệu lực, bé ACTIVE và cặp lớp/thành viên ACTIVE hoặc COMPLETED tương ứng; buổi kết thúc sau lúc tham gia, cặp hoàn thành chỉ thấy giờ bắt đầu đến `ended_at`. WITHDRAWN/ARCHIVED bị ẩn khỏi lịch. Không trả `lesson_plan`, rule/version hoặc trường quản trị; lý do hủy được chia sẻ. Lịch sử điểm danh dùng quyền riêng bên dưới để giữ kết quả cũ sau rời lớp.
- TC-018 chụp roster và ghi `roster_created_at` nguyên tử; dùng cùng khóa lịch theo giáo viên trước khóa lớp/buổi. Trạng thái COMPLETED được cô xác nhận, không tự đổi theo đồng hồ.

TC-018 áp dụng thêm:

- Snapshot một lần, giữ tên/enrollment; chốt lại không tạo mới. Danh sách lấy thành viên hiện đủ điều kiện, không dựng lịch sử quá khứ từ trạng thái hiện tại. Lớp COMPLETED lấy các quan hệ COMPLETED đúng thời gian buổi. Thêm/loại/khôi phục thành viên cùng lớp cần lý do, không xóa dòng cũ, tối đa 500 bé.
- Lưu từng batch nguyên tử theo version buổi/dòng; thiếu hoặc sai một dòng không ghi phần còn lại. Có mặt/đi muộn từ lúc bắt đầu; ghi nghỉ sớm được. Sửa dòng đã đánh dấu cần lý do riêng. Ghi chú riêng và ghi chú gửi gia đình là hai trường độc lập.
- Hoàn thành sau `ends_at`, có roster và mọi dòng còn hiệu lực đã đánh dấu; roster rỗng cần lý do. Đưa dòng về UNMARKED hoặc thêm bé UNMARKED mở lại buổi, giữ lần hoàn thành trước trong audit. Buổi hủy/lớp lưu trữ chỉ đọc; dòng đã loại/buổi hủy không tính kết quả hiệu lực.
- Gia đình có liên kết còn hiệu lực xem lịch sử đúng bé sau rời lớp/lưu trữ; chỉ trạng thái/ghi chú chia sẻ, không ghi chú/lý do riêng hay version/enrollment. Thu hồi liên kết chặn cả lịch sử. UNMARKED tương lai chưa hiển thị như kết quả đã học.
- Dashboard đếm DISTINCT bé PRESENT/LATE của buổi hôm nay còn hiệu lực; giữ buổi COMPLETED, loại CANCELLED. Không có API/bảng/quản lý bù trong V10.

## 2. Học bù — đề xuất cũ, tạm hoãn

Các quy tắc dưới đây được giữ để tham khảo, chưa triển khai và không phải điều kiện hoàn thành điểm danh hoặc tính phí hiện tại. Khi mở lại cần chốt nhu cầu lịch cô có dạy trước, không tự áp dụng kế hoạch bù theo từng bé.

- Kế hoạch bù bắt nguồn từ một dòng nghỉ của đúng bé, có trạng thái PENDING/SCHEDULED/COMPLETED/CANCELLED.
- Một lần nghỉ tối đa một kế hoạch chưa hủy; kế hoạch SCHEDULED cần điểm danh đích hợp lệ.
- Có thể học bù ở buổi khác lớp mà không đổi tư cách thành viên dài hạn; backend kiểm tra đúng bé, cùng không gian giáo viên và nguồn MAKEUP.
- Đích có mặt/đi muộn trong buổi không bị hủy mới hoàn thành bù. Hủy/đổi kết quả đích phải cập nhật lại kế hoạch.
- Với buổi giáo viên hủy, có thể đổi/tạo buổi thay thế theo lịch lớp; không mặc nhiên ghi tất cả trẻ là nghỉ cá nhân.
- Giá/quy tắc của chuỗi nghỉ–bù lấy theo buổi gốc; dùng khóa nguồn gốc để tránh tính tiền lần hai.

Quyền được bù và cách tính nghỉ có phép/chưa báo là lựa chọn chính sách, không được tự coi đã chốt khi triển khai.

## 3. Nhận xét

`student_notes` gắn bé, tùy chọn lớp/buổi, nội dung và `PRIVATE`/`SHARED`. Tệp kế thừa đúng mức chia sẻ. Gia đình chỉ thấy SHARED của con; phản hồi sản phẩm là nguồn riêng nhưng có thể tổng hợp vào trang tiến bộ.

Sửa/chuyển phạm vi/lưu trữ giữ lịch sử cần thiết. Backend không trả ghi chú PRIVATE rồi trông chờ React ẩn đi. Các FK lớp/buổi phải thuộc cùng ngữ cảnh giáo viên và hợp lệ với bé.

TC-019 áp dụng:

- Ngày ghi nhận theo Việt Nam, không tương lai; tiêu đề tùy chọn/200 ký tự, body bắt buộc/10.000. Mặc định PRIVATE. Lưu mới chống retry trùng; sửa/lưu trữ/khôi phục cần version và lý do riêng, audit giữ snapshot trước/sau.
- Tối đa 5 tệp NOTE_ASSET/250 MB, đã READY và do cô tải; một tệp gắn cố định với một nhận xét, không tái dùng qua nhận xét/bé khác kể cả sau gỡ/lưu trữ. Gia đình đọc/tải qua note hiện tại, kế thừa visibility và trạng thái lưu trữ; không dùng URL kho chung.
- Lớp cần quan hệ tham gia phù hợp ngày. Buổi thuộc lớp đã chọn, cùng ngày, đã bắt đầu; membership trùng thời gian hoặc roster hoạt động có bé. Cho phép ngữ cảnh lịch sử phù hợp, không thay điểm danh. Hồ sơ ARCHIVED không nhận note mới; note cũ vẫn đối chiếu/sửa/lưu trữ/khôi phục được.
- Gia đình có guardian còn hiệu lực chỉ được nhận SHARED chưa lưu trữ, lọc trước count/page. Chuyển riêng, lưu trữ, gỡ tệp hoặc thu hồi guardian chặn URL cũ ở yêu cầu tiếp theo. Không trả privateNotes count, phiên bản/lý do/audit/phiên bản riêng trước đó. SHARED được giữ sau rời lớp/lưu trữ hồ sơ khi còn guardian.
- Hành trình kết hợp note và lượt sản phẩm đã gửi; loại DRAFT. Sắp theo ngày ghi nhận (đầu ngày Việt Nam) hoặc submittedAt, rồi mốc tạo/loại/ID; lọc loại và phân trang. Thẻ số liệu đếm note chia sẻ đang hoạt động và từng lượt gửi/duyệt, không tự chấm phát triển hay sửa tiến độ bài học.

## 4. Cách tính và thời điểm thu

TC-020 đã triển khai; cô chọn rõ từng trường, không có mức tiền hoặc chính sách nghỉ mặc định thay cô.

| Cách tính | Tham số | Thời điểm thu |
|---|---|---|
| PER_SESSION | Đơn giá/buổi, hai lựa chọn tính phí nghỉ có phép/chưa báo bắt buộc | Chọn riêng đầu kỳ/cuối kỳ/đóng trước |
| MONTHLY_FIXED | Số tiền mỗi tháng, quy tắc giữ mức/điều chỉnh thủ công khi nghỉ | Chọn riêng đầu kỳ/cuối kỳ/đóng trước |
| FULL_PROGRAM | Tổng tiền, tên đợt bắt buộc, số buổi dự kiến tùy chọn, quy tắc khi nghỉ | Chọn riêng đầu kỳ/cuối kỳ/đóng trước |

Cấu hình lớp DRAFT/ACTIVE sửa có version/lý do; mức riêng lưu cho enrollment ACTIVE ở lớp/hồ sơ ACTIVE. Nguồn POLICY kiểm tra version rồi sao chụp, CUSTOM nhận đầy đủ điều kiện tương thích. Policy đổi không lan sang bản của bé. Tiền VND nguyên 0–1.000.000.000.000; từ chối tiền lẻ, trường của chế độ khác và quy tắc nghỉ chưa chọn. Trọn đợt có số buổi dự kiến 1–10.000 nếu nhập.

Khoảng ngày gồm hai đầu, không trùng các bản chưa CANCELLED của cùng enrollment; từ ngày tham gia/ngày bắt đầu lớp, nằm trong ngày kết thúc lớp nếu có. Ban đầu có thể ghi khoảng đã qua hợp lệ. Thay mức từ hôm nay và trong khoảng cũ, chốt bản cũ trước một ngày rồi tạo bản mới nguyên tử. Thay đúng ngày bắt đầu hôm nay/tương lai giữ bản cũ CANCELLED. Kết thúc chỉ rút ngắn từ hôm nay; hủy chỉ khi bắt đầu hôm nay/tương lai. Lưu phiên bản, bản thay thế và audit; không sửa giá các ngày cũ. Bản ENDED có ngày cuối tương lai vẫn CURRENT/UPCOMING theo ngày. Tạo/thay có clientRequestId/hash chống retry trùng, kể cả khi policy đã đổi sau lần lưu thành công.

Sau rời lớp/lưu trữ vẫn xem và kết thúc/hủy phần tương lai; không tự đóng thỏa thuận và không tạo/thay mức khi ngữ cảnh ngừng hoạt động. Gia đình đã xác minh/còn guardian xem snapshot công khai đúng bé, gồm ENDED/CANCELLED lịch sử. Không trả policy lớp, giá bé khác, ghi chú/lý do/nguồn/version/audit riêng. Thu hồi chặn ở lần gọi kế tiếp. Xem [hướng dẫn](../13-cau-hinh-hoc-phi.md) cho UI/API và giới hạn.

Trọn đợt không bắt buộc trùng một khóa trong thư viện; cũng không tạo quyền nội dung ngoài thời gian được cấp. Rời lớp vẫn dừng bài/khóa của lớp dù đã thu đủ. Việc quyết toán phần chưa học cần giáo viên chốt theo thỏa thuận, không tự hoàn tiền.

## 5. Nghỉ và học bù ảnh hưởng số phí thế nào

TC-020 chỉ lưu quy tắc cô chọn: theo buổi phải chọn rõ hai boolean; tháng/trọn đợt phải chọn giữ mức hoặc điều chỉnh thủ công. Chưa chạy tính phí từ điểm danh. Bảng dưới là gợi ý cũ cho TC-021; các dòng học bù tạm hoãn và không có trường allow_makeup trong V12. Không dùng bảng này làm mặc định ngầm:

| Tình huống | Theo buổi | Tháng/trọn đợt |
|---|---|---|
| Có mặt/đi muộn | Một buổi | Trong mức thỏa thuận |
| Nghỉ có phép | Không tính, hoặc cấu hình tính/cho bù | Giữ mức hoặc điều chỉnh thủ công theo thỏa thuận |
| Nghỉ chưa báo | Theo lựa chọn rõ của cô trong thỏa thuận | Theo quy tắc đã chọn; học bù tạm hoãn |
| Giáo viên hủy | Không tính buổi hủy | Sắp lại lịch/quyết toán thủ công |
| Học bù | Nếu gốc chưa tính thì tính khi đến bù; nếu đã tính thì không thu lần hai | Không tự sinh thêm phí |

Preview là gợi ý. Giáo viên chốt mới tạo phiếu và giữ các buổi qua `session_charge_entries`; không tự trừ tiền hoặc phát hành theo sự kiện điểm danh. Sửa điểm danh sau phát hành cần cảnh báo đối chiếu, không thay số đã công bố.

## 6. Phiếu và ghi nhận thanh toán

TC-021 đã có preview, tạo/sửa nháp, phát hành/hủy, lịch sử riêng và family list/detail. TC-022/023 bổ sung ghi thu/void, tổng tiền và lịch sử thu đúng quyền. Phiếu chụp đúng điều kiện V12, không lấy policy hiện tại thay giá cũ; ràng buộc nguồn đã dùng được bảo vệ.

- Theo buổi chỉ gợi ý dòng active, buổi COMPLETED đã kết thúc, đúng enrollment/ngày Việt Nam và quy tắc nghỉ. Nháp giữ buổi RESERVED, phát hành CHARGED, hủy VOIDED; unique active charge theo root attendance. Không có chuỗi học bù trong phạm vi này.
- Tháng chỉ một tháng lịch mỗi phiếu; đủ cả tháng mới gợi ý toàn mức. Kỳ lẻ nhập OTHER/lý do, không tự prorate. Khoảng phí cố định cùng enrollment không chồng phiếu chưa hủy. Trọn khóa một phiếu chưa hủy/thỏa thuận, không lập lại tổng ở kỳ khác.
- Phiếu/line/tổng VND nguyên 0–1.000.000.000.000; quantity 1–10.000. Dòng theo nguồn quantity 1/đơn giá đúng bản của bé; giảm trừ hoặc OTHER cần lý do riêng. Nháp được trống, phát hành cần dòng, 0 VND hợp lệ.
- Khoảng gồm hai đầu, tối đa 366 ngày, trong agreement/ngày lớp/thời gian tham gia. Hạn thanh toán tùy chọn, độc lập kỳ học để thu trước. Preview không ghi; tạo/sửa kiểm tra review key dưới khóa lớp → bé → enrollment → invoice. Tạo chống retry theo teacher/clientRequestId/hash; sửa/phát hành/hủy có version.
- Sửa điểm danh không đổi số tiền đã lưu/phát hành; có liên kết cảnh báo trong workspace điểm danh và sourceChanged ở phiếu. Nháp nguồn đổi cần xem/lưu lại; phiếu phát hành bất biến. Hủy giữ snapshot/dòng/audit và giải phóng charge, không hoàn tiền. Gia đình chỉ thấy bản từng phát hành, kể cả hủy sau đó; không nháp/ghi chú/lý do/version/nguồn điểm danh/audit.
- Thay/kết thúc thỏa thuận không cắt ngày có invoice chưa hủy; hủy nguồn cần xử lý phiếu trước. FULL_PROGRAM đã có invoice chưa hủy chặn thay tổng. Family history còn sau rời lớp/lưu trữ khi còn guardian; revoke chặn lần gọi tiếp theo. Xem [hướng dẫn](../14-phieu-hoc-phi.md).

Luồng đã triển khai qua TC-021/022/023:

1. Chọn bé/lớp/thỏa thuận và kỳ thu; nhập tay các dòng hoặc lấy gợi ý.
2. Backend kiểm tra điều kiện hiện tại, tính tổng và tạo DRAFT với khóa chống gửi lặp.
3. Giáo viên kiểm tra/phát hành; chỉ ISSUED và lịch sử từng phát hành mới hiển thị cho gia đình.
4. Ghi tiền thực tế đã thu; phương thức CASH/BANK_TRANSFER/OTHER chỉ là ghi nhận, không thực hiện giao dịch ngân hàng.
5. Số đã thu lấy tổng khoản RECORDED; phiếu ISSUED có còn lại = tổng phiếu − đã thu. Phiếu dương chưa thu là UNPAID, trả một phần PARTIAL, thu đủ PAID; phiếu 0 là NO_PAYMENT_DUE. Nháp/phiếu hủy có paymentStatus và outstandingAmountVnd null, không diễn giải thành PAID hoặc khoản phải thu.

Các điều kiện bắt buộc:

- VND là số nguyên, số lượng dòng là số nguyên dương, giảm trừ không làm dòng âm.
- Tổng/đã thu/còn lại do backend tính; không nhận số tổng từ React để tin dùng.
- Chỉ sửa dòng tiền khi DRAFT; phiếu phát hành giữ nguyên điều kiện/số tiền.
- Khoản thanh toán phải là VND nguyên 1–1e12, không quá số còn lại của ISSUED. Phương thức CASH/BANK_TRANSFER/OTHER và số tiền do cô chọn rõ. Ngày nhận tiền trong năm Việt Nam 1900–2200, không tương lai quá 60 giây; có thể trước kỳ học hoặc thời điểm lập phiếu để ghi nhận thu trước.
- Ghi thu/void/hủy phiếu dùng cùng khóa lớp → bé → enrollment → invoice. Ghi thu/void tăng version phiếu; cả hai cần invoiceVersion, void cần thêm version khoản thu. Ngữ cảnh đã rời lớp/lưu trữ hoặc nguồn điểm danh đổi không chặn đối chiếu tiền trên phiếu đã phát hành.
- Idempotency-Key 8–100 ký tự gắn người ghi và SHA-256 invoice/payload chuẩn hóa. Retry cùng dữ liệu trả đúng bản ghi cũ trước kiểm tra version/trạng thái/số còn lại, kể cả đã thu đủ, khoản đã VOIDED hoặc phiếu đã hủy. Khác dữ liệu/invoice cùng key trả 409; không ghi thêm hay khôi phục khoản cũ.
- Khoản nhập sai VOIDED cần lý do riêng, giữ nguyên số tiền/ngày/phương thức/ghi chú gốc và actor/mốc điều chỉnh. Ghi thu/void lưu audit PAYMENT và INVOICE nguyên tử; không xóa và không suy diễn là hoàn tiền thực tế.
- Không hủy phiếu còn khoản thu hợp lệ. Hủy nháp/phiếu hợp lệ giải phóng các buổi tính phí bằng trạng thái VOIDED, giữ tham chiếu cũ.
- Phí theo buổi có khóa duy nhất cho buổi gốc còn hiệu lực; nhiều phiếu/kỳ không được thu lại cùng buổi đã giữ/tính.
- Phiếu 0 VND hiển thị không còn khoản phải thu, không tạo thanh toán 0.
- Gia đình có email đã xác minh/guardian còn hiệu lực chỉ đọc lịch sử của invoice từng phát hành đúng bé, gồm VOIDED để đối chiếu; không ghi chú/lý do riêng, actor, version, key/hash hay audit. Giữ lịch sử sau rời lớp/lưu trữ, thu hồi liên kết chặn request tiếp theo. Màn hình danh sách/chi tiết dùng tổng do backend tính; đổi bé bỏ dữ liệu cũ.
- Form giữ số tiền/ngày/phương thức/ghi chú hoặc lý do khi 503/409; retry ghi mới dùng cùng key. Đóng/cập nhật có xác nhận bỏ bản nhập, không âm thầm đổi version hoặc số thực thu. Nút thay đổi chờ dữ liệu mới sau lưu. Giờ hiển thị/nhập luôn theo Việt Nam dù trình duyệt ở múi giờ khác.

Tự động hoàn tiền, số dư giữ hộ, gói N buổi trả trước và cổng thanh toán là hướng mở rộng. Chưa có yêu cầu triển khai các nghiệp vụ đó trong bản đầu đề xuất.

## 7. Thông báo

TC-024/V17 đã có thông báo lớp DRAFT/PUBLISHED/ARCHIVED, tiêu đề 200/nội dung chữ thuần 10.000 ký tự. Cô tạo nháp ở lớp DRAFT/ACTIVE, đăng ở lớp ACTIVE; sửa cần version và lý do riêng, bản đã đăng tăng publication revision. Lưu trữ giữ nội dung/audit và ẩn khỏi gia đình. Tạo nháp chống lặp theo teacher/clientRequestId/hash; publish lặp không nhân đôi.

Gia đình đã xác minh/còn guardian chỉ đọc PUBLISHED của đúng bé ACTIVE và lớp/enrollment ACTIVE/COMPLETED. Dấu đọc thuộc user/announcement và đúng revision đã xem; bản sửa cần đọc lại, revision cũ trả 409. Không trả version quản trị/reason/audit/request/hash. Rời lớp/lưu trữ/thu hồi chặn cả list/count/detail/read và cập nhật cá nhân ở yêu cầu tiếp theo.

Cập nhật phát sinh từ công bố/sửa bảng tin, giao/cấp lại bài, gửi/duyệt sản phẩm, tạo/đổi/hủy buổi, phát hành phiếu, ghi thu/void. DomainStore đăng ký BusinessChange; listener BEFORE_COMMIT ghi dòng cùng transaction, chỉ nhìn thấy sau commit. Rollback bỏ cả nguồn và cập nhật; unique recipient/dedupe theo loại/nguồn/phiên bản/bé chặn retry. Không gửi bù dữ liệu trước V17.

Chỉ lưu ID/loại nguồn và ngữ cảnh, không sao chép body, ghi chú riêng, lý do, số tiền hoặc token. Câu chữ chung và đường dẫn được backend sinh sau kiểm tra quyền nguồn hiện tại trước page/count/badge/detail/read. Mở cập nhật dùng POST read để kiểm tra lại, không tin link cũ. Bài/lịch/bảng tin theo quyền hiện tại; sản phẩm/phiếu/ghi thu giữ quyền lịch sử của module khi còn guardian. Read cá nhân idempotent và độc lập read revision của bảng tin. Chuông cập nhật theo điều hướng/focus/read và 60 giây khi cửa sổ hiển thị. Xem [hướng dẫn](../16-thong-bao-va-cap-nhat.md). Email xác minh/khôi phục vẫn riêng; chưa gửi email/SMS nghiệp vụ hoặc WebSocket.

## 8. Dữ liệu và API

| Nhóm | Bảng | API chính sau `/api/v1` |
|---|---|---|
| Lịch/điểm danh đã có | `class_schedule_rules`, `class_sessions`, `attendance_records`, `attendance_events` | schedule-rules, sessions/generate, sessions, attendance-roster/members, attendance/history, sessions/{id}/complete |
| Học bù tạm hoãn | Chưa có bảng thực tế; thiết kế cũ cần xem lại | Chưa có API |
| Nhận xét | `student_notes`, `student_note_attachments` | `/students/{studentId}/notes`, `/student-notes/{noteId}`, các endpoint family |
| Chính sách đã có V12 | `class_tuition_policies`, `enrollment_tuition_agreements` | `/classes/{id}/tuition-policy` + history; `/enrollments/{id}/tuition-agreements`; `/tuition-agreements/{id}` + replace/end/cancel/history; family list/detail |
| Phiếu đã có V13–V15 | `invoices`, `invoice_lines`, `session_charge_entries`, sequence mã | `/billing/previews`, `/invoices`, detail/update/issue/cancel/history và family list/detail |
| Ghi thu đã có V16 | `payments`, audit dùng chung | GET/POST `/invoices/{id}/payments`; GET `/payments/{id}` và history; POST `/payments/{id}/void`; GET family child/invoice/payments |
| Thông báo | `class_announcements`, `announcement_reads`, `notifications` | announcements, publish/read, notifications và các endpoint family |

Những tên nhóm API rút gọn trong bảng phải tra đường dẫn đầy đủ ở [tổng quan mục 10.5](../01-mo-ta-he-thong.md#s10), rồi ghi chính xác trong OpenAPI khi triển khai module.

<a id="acceptance"></a>
## 9. Nghiệm thu

Tham chiếu `AC-23`–`AC-30`, `AC-38`–`AC-40` ở [bộ gốc](../01-mo-ta-he-thong.md#s13).

- Sinh lịch lại không trùng; đổi lịch không viết lại quá khứ/chỉnh riêng.
- Lớp thay đổi danh sách không làm sai điểm danh cũ; buổi hủy không tính đã học.
- Một lần nghỉ/bù không có hai kế hoạch hoặc hai lần thu còn hiệu lực.
- Nhận xét PRIVATE và tệp riêng không lộ sang gia đình.
- Ví dụ 8 × 100.000 VND, thu 500.000 VND phải còn 300.000 VND; retry không thu hai lần, yêu cầu đồng thời không thu vượt.
- Thỏa thuận riêng và thay đổi giá không đổi phiếu đã chốt; trả cả khóa không giữ quyền sau rời lớp.
- Thông báo có nguồn hợp lệ, không nhân đôi do retry và không dẫn đến dữ liệu ngoài quyền.

