# TinyClass frontend

React + TypeScript + Vite, React Router 7; CSS variables + CSS Modules theo [Design.md](Design.md). Giao diện tiếng Việt dùng API Spring Boot thật qua proxy `/api`, theme tím và Nunito tự phục vụ. [Bằng chứng UI](../doc/verification/2026-11-02-design.md).

Hướng dẫn chuẩn bị database/backend, tạo tài khoản giáo viên và chạy ứng dụng ở [README dự án](../README.md). Spec/plan nằm trong [doc](../doc/README.md).

```powershell
npm.cmd install
npm.cmd run dev
```

Kiểm tra: `npm.cmd run build`, `npm.cmd run lint`. `npm.cmd run test:e2e` dùng Playwright/Edge trên database/mailbox test riêng; cần backend verify thành công, PostgreSQL test và Mailpit test đang chạy. Không chạy cùng lúc với Maven. Xem [báo cáo gia đình/email và ảnh giao diện](../doc/verification/2026-11-01-family.md).
