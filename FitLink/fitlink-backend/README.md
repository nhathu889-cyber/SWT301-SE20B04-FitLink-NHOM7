
# FitLink backend — SQL Server

Backend dùng SQL Server qua Sequelize/tedious. Toàn bộ model nằm trong
`src/models/sql`; không có nhánh database demo trong bộ nhớ. API giữ `_id`,
`createdAt`, `updatedAt` để tương thích frontend; ID thực tế là UUID.
Các trường cấu trúc như lịch làm việc, địa điểm, metadata được lưu dạng JSON
trong cột NVARCHAR của SQL Server.

## Chạy local

Yêu cầu Node.js 22.12+ và SQL Server có database `FitLink`.
Tạo database trước nếu chưa có, rồi cấu hình `.env` theo `.env.example`:
`MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`.
SQL Server cần bật TCP/IP và cho phép tài khoản SQL đã cấu hình đăng nhập.

```sh
npm install
npm run db:migrate:sqlserver
npm run dev
```

Migration tạo bảng, khóa ngoại và index còn thiếu; có thể chạy lại.
Không dùng `sync({ force: true })` hoặc xóa dữ liệu đang có.
Migration này chỉ xử lý schema SQL, không tự nhập dữ liệu từ database cũ.

## Dữ liệu PT mẫu

```sh
npm run seed:pt-demo
```

Script ghi dữ liệu vào SQL Server trong transaction, chạy lại không tạo trùng
và không đổi mật khẩu của tài khoản đã tồn tại. Tài khoản mới dùng mật khẩu
từ `DEMO_PT_PASSWORD`, mặc định `Fitlink123!`; email/số điện thoại được in
sau khi seed. Dữ liệu mẫu không được tự động nạp khi server khởi động.

## Kiểm tra

```sh
npm run test:sql
npm run test:api:sql
node scripts/test-profile-avatar.cjs
npm run lint
```

- `test:sql`: kiểm tra 20 model với schema thật, UUID chat, định dạng API,
  tìm PT, seed lặp lại, tạo lịch, hoàn tất gói học và cộng ví. Mọi dữ liệu
  kiểm thử được ghi trong transaction rồi rollback.
- `test:api:sql`: build backend, mở server local trên cổng ngẫu nhiên và kiểm
  tra 32 API đọc dữ liệu; tự đóng server sau khi xong.
- Kiểm thử không gọi thanh toán PayOS thật, gửi email hoặc upload Cloudinary.
  Các tích hợp này cần khóa cấu hình riêng và kiểm thử đầu cuối khi triển khai.
- Lint toàn dự án còn lỗi định dạng/cảnh báo trong source cũ; build và các
  kiểm thử SQL được kiểm tra riêng, không dùng lint làm bằng chứng hoàn tất.

Sau khi thay đổi backend, khởi động lại tiến trình đang chạy nếu không dùng nodemon.
