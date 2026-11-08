# Vé tập lẻ tại phòng gym

Thêm 4 gói mẫu tiếng Anh: `npm run seed:gym-packages`. Chạy lại không tạo
trùng hoặc ghi đè gói đã chỉnh sửa. Giá và thông tin FitLink Demo Gym là mẫu;
admin cần cập nhật địa chỉ và điều kiện thực tế trước khi nhận thanh toán.
Để áp dụng mức giá mẫu mới: `npm run seed:gym-packages -- --refresh-demo`.
Lệnh chỉ cập nhật giá và mô tả gói ở FitLink Demo Gym có tag demo, cùng số tiền
chuyển khoản đang chờ của các gói đó. Giao dịch đã thanh toán giữ nguyên.

Chạy `npm run db:migrate:sqlserver` trước khi khởi động backend trên máy khác.
Migration cho phép `pt_id` rỗng trong packages, transactions, student_packages
và thêm gym_name, gym_address vào packages. Gói PT vẫn dùng PT và lịch hẹn cũ.

1. Admin mở `/admin/gym-packages`, tạo vé 1 lượt hoặc nhiều lượt, giá,
   thời hạn sử dụng, tên và địa chỉ phòng gym. Không cần giáo án.
2. Học viên mở `/gym-packages`, mua vé và thanh toán đúng giá admin đặt.
3. Admin mở `/admin-transactions`, lọc Chờ xác nhận chuyển khoản và xác nhận
   sau khi nhận tiền. Vé được kích hoạt từ thời điểm xác nhận.
4. Học viên xem mã vé, số lượt còn lại và hạn sử dụng ở `/gym-packages`.
5. Khi học viên vào gym, admin nhập mã vé ở `/admin/gym-packages` và xác nhận
   dùng 1 lượt. Hệ thống chỉ trừ lượt nếu vé còn hạn, active và còn lượt.
   Khi hết lượt hoặc hết hạn, học viên có thể mua vé mới.

Vé gym không tạo booking, lịch PT, session hoặc thu nhập ví PT.
Toàn bộ doanh thu vé được ghi nhận cho nền tảng.

Đăng nhập: `/login`. Đường dẫn `/` đưa tài khoản đang đăng nhập về trang
theo vai trò. Đăng xuất xóa cookie phía server và trạng thái tài khoản trên UI.

Kiểm tra: `npm run test:unit:booking`, `npm run test:sql`, `npm run build`;
frontend: `npm run build`.
