# TinyClass frontend

React + TypeScript + Vite, React Router 7; CSS variables + CSS Modules theo [Design.md](Design.md). Giao diện tiếng Việt dùng API Spring Boot thật qua proxy `/api`, theme tím và Nunito tự phục vụ. [Bằng chứng UI](../doc/verification/2026-11-02-design.md).

Hướng dẫn chuẩn bị database/backend, tạo tài khoản giáo viên và chạy ứng dụng ở [README dự án](../README.md). Spec/plan nằm trong [doc](../doc/README.md).

```powershell
npm.cmd install
npm.cmd run dev
```

E2E tự build frontend bằng `pretest:e2e`, rồi dùng Vite preview để kiểm tra gói production ở cổng 5174. Proxy API hoạt động ở cả dev và preview. Cách này giảm yêu cầu tải từng module phát triển trong trình duyệt thử nghiệm.

Kiểm tra: `npm.cmd run build`, `npm.cmd run lint`. `npm.cmd run test:e2e` dùng Playwright/Edge trên database/mailbox test riêng; cần backend verify thành công, PostgreSQL test và Mailpit test đang chạy. Không chạy cùng lúc với Maven. Hiện 44 E2E đạt; xem [báo cáo tổng quan và ảnh minh chứng](../doc/verification/2026-11-03-dashboard.md).

Tổng quan giáo viên lọc lớp/học phí/cập nhật; trang chủ gia đình có cập nhật toàn tài khoản, hồ sơ bé có tiến độ/tiếp tục/lịch/phí/phản hồi/bảng tin riêng. Các tổng VND nhiều phiếu được nhận dạng chuỗi và hiển thị bằng BigInt/Intl. Xem [hướng dẫn](../doc/17-tong-quan-va-trai-nghiem.md).

Trang nhận xét/hành trình tải riêng khi mở qua React.lazy/Suspense, giữ khung điều hướng. CSS dùng token/Nunito/CSS Modules hiện có; không thêm thư viện UI.
