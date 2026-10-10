# FitLink Documentation

## 1. Tong quan du an

FitLink la nen tang ket noi `student` voi `PT` (personal trainer), gom 2 phan:

- `fitlink-frontend`: React + Vite, giao dien cho hoc vien, PT va admin.
- `fitlink-backend`: Express + SQL Server/Sequelize, phu trach auth, booking, payment, chat realtime, thong bao va quan ly du lieu.

Muc tieu nghiep vu chinh:

- Hoc vien tim PT, xem profile va goi tap.
- Dat lich, thanh toan, sinh goi hoc da mua va cac buoi tap.
- Chat truc tiep student/PT.
- PT quan ly profile, goi tap, hoc vien, tai lieu va vi.
- Admin quan ly user, thong ke, phe duyet PT va payout.

## 2. Kien truc tong quat

### Frontend

Cac nhom chuc nang chinh trong `fitlink-frontend/src`:

- `pages/student`: trang cho hoc vien.
- `pages/pt`: trang cho huan luyen vien.
- `pages/admin`: trang quan tri.
- `components/chat`: giao dien chat realtime.
- `services`: lop goi API chinh.
- `api`: co mot so wrapper API rieng, trong do co `messageApi.js`.

### Backend

`fitlink-backend/src/server.js` dang mount cac nhom route chinh:

- `auth`, `student`, `pt`, `admin`
- `booking`, `sessions`, `student-packages`
- `messages`, `notifications`, `ai`
- `transactions`, `payouts`, `stats`

Backend dung:

- `Sequelize` de anh xa 20 bang trong SQL Server; khoa chinh va khoa ngoai dung UUID
- `Socket.IO` cho chat va notification realtime
- `PayOS` cho thanh toan
- `Cloudinary/multer` cho upload tai lieu

## 3. Data model cot loi

Data cua FitLink di theo truc nghiep vu sau:

`User -> PTProfile/StudentProfile -> Package -> Booking -> Transaction -> StudentPackage -> Session`

Ngoai truc chinh con co:

- `Chat -> Message`
- `Notification`
- `PTWallet -> PTWalletTransaction -> PayoutRequest`
- `Feedback`
- `PTApprovalRequest`
- `PTMaterial`

### Thuc the chinh

#### `User`

Bang goc cho moi tai khoan:

- thong tin dang nhap: `email`, `phone`, `password`, `googleId`
- vai tro: `student`, `pt`, `admin`
- thong tin co ban: `name`, `avatar`, `gender`, `dob`
- vi tri nha: `home.address`, `home.location`

`User` la trung tam lien ket toi:

- `PTProfile` theo quan he 1-1
- `StudentProfile` theo quan he 1-1

#### `PTProfile`

Mo ta nang luc va pham vi day cua PT:

- gym chinh: `primaryGym`
- cach day: `deliveryModes`
- chinh sach di chuyen: `travelPolicy`
- marketing/profile: `bio`, `specialties`, `certificates`, `coverImage`
- lich lam viec: `workingHours`
- chat luong ho so: `verified`, `ratingAvg`, `ratingCount`

#### `StudentProfile`

Mo ta tinh trang hoc vien:

- `heightCm`, `weightKg`, `bmi`
- `goals`
- `defaultLocation`
- `bmiHistory`

#### `Package`

San pham ma PT ban:

- PT so huu: `pt`
- gia va noi dung: `name`, `description`, `price`
- quy mo: `totalSessions`, `sessionDurationMin`, `durationDays`
- lich lap: `recurrence.daysOfWeek`
- cach hoc ho tro: `supports`
- phi di chuyen theo goi: `travelPricing`
- phan loai: `tags`

#### `Booking`

Ban ghi dat mua goi truoc khi hoan tat toan bo quy trinh:

- nguoi hoc, PT, goi: `student`, `pt`, `package`
- lich da chot: `pattern`, `slot`, `startDate`, `mode`
- snapshot dia diem va travel fee
- snapshot gia goi tai thoi diem dat
- tong tien trong `pricing`
- trang thai: `PENDING_PAYMENT`, `PAID`, `CANCELLED`, `REFUNDED`, `EXPIRED`

`Booking` dong vai tro snapshot nghiep vu de tranh viec sua `Package` sau nay lam sai lich su don.

#### `Transaction`

Ban ghi thanh toan:

- lien ket `student`, `pt`, `package`, `booking`
- `amount`, `status`, `platformFee`, `ptEarning`
- thong tin gateway cua `PayOS`

#### `StudentPackage`

Sau khi thanh toan thanh cong, hoc vien so huu goi hoc:

- lien ket `student`, `pt`, `package`, `transaction`, `booking`
- tong buoi va buoi con lai
- lich hoc co dinh: `pattern`, `slot`
- trang thai su dung: `active`, `completed`, `expired`, `paused`

#### `Session`

Moi buoi tap cu the sinh ra tu `StudentPackage`:

- `studentPackage`, `pt`, `student`
- `startTime`, `endTime`
- `status`, `attendance`
- thong tin xin nghi/doi lich

#### `Chat` va `Message`

Module chat tach rieng khoi nghiep vu booking:

- `Chat` luu `participants`, `lastMessage`, `unreadCount`
- `Message` luu `chat`, `sender`, `text`, `attachments`, `readBy`

Frontend dang chat theo `roomId = [self._id, peer._id].sort().join("-")`.
Backend map `roomId` nay vao document `Chat`.

#### `Notification`

Thong bao 1-n cho user:

- `user`, `type`, `title`, `message`, `read`, `meta`

#### `PTWallet` va `PTWalletTransaction`

Cum du lieu tai chinh cho PT:

- `PTWallet`: so du tong hop
- `PTWalletTransaction`: lich su bien dong vi
- `PayoutRequest`: yeu cau rut tien

## 4. Luong data chinh

### Luong mua goi

1. Student xem `PTProfile` va `Package`.
2. Student tao `Booking`.
3. He thong tao `Transaction` va chuyen qua PayOS.
4. Sau khi thanh toan thanh cong, tao `StudentPackage`.
5. Tu `StudentPackage`, he thong sinh ra nhieu `Session`.

### Luong chat

1. Frontend vao room chat bang `roomId`.
2. Socket/REST tim hoac tao `Chat`.
3. Moi tin nhan duoc luu vao `Message`.
4. `Chat.lastMessage` duoc cap nhat de render danh sach nhanh.
5. He thong tao `Notification` cho nguoi nhan.

## 5. Nhan xet ngan gon ve data

### Diem tot

- Model du lieu kha ro domain, tach duoc `user`, `profile`, `package`, `booking`, `session`, `transaction`.
- Da dung `snapshot` trong `Booking`, giup lich su don hang khong bi troi theo thay doi moi cua `Package` hay dia chi.
- SQL Server co khoa ngoai va unique index; cac truong cau truc nhu lich lam viec va toa do duoc luu JSON trong NVARCHAR.
- Chat va notification da tach thanh module rieng, de mo rong realtime.

### Diem can luu y

- Frontend dang ton tai 2 lop goi API cho chat: `src/api/messageApi.js` va `src/services/messageService.js`. Dieu nay de gay lech response shape va kho maintain.
- `messageApi.js` dung bien moi truong `VITE_API_URL`, trong khi nhieu service khac dung `VITE_API_BASE_URL`. Neu config khong dong nhat, chat co the loi rieng.
- Co 2 luong chat FE: `ChatWindow.jsx` dung event moi (`joinRoom`, `sendMessage`, `receiveMessage`), con `ChatBox.jsx` dung event cu (`join_room`, `send_message`, `receive_message`). Day la dau hieu code chat dang bi song song 2 phien ban.

## 6. Ghi chu rieng cho `messageApi.js`

File `fitlink-frontend/src/api/messageApi.js` la wrapper rat mong:

- `getMessages(chatId)`: goi `GET /api/messages/:chatId`
- `sendMessage(data)`: goi `POST /api/messages`

Ve mat data:

- `chatId` thuc te dang duoc backend hieu la chuoi ghep 2 user id, vi du `studentId-ptId`
- payload gui tin nhan can toi thieu: `chat`, `sender`, `text`
- backend se tu tim/tao `Chat`, sau do tao `Message`

Neu tiep tuc dung kien truc hien tai, nen chon 1 lop API duy nhat cho chat de tranh trung lap.

## SQL Server

Xem `fitlink-backend/README.md` de cau hinh, migrate schema, seed va chay kiem thu SQL. Runtime khong con database demo trong bo nho. Script migration tao/cap nhat schema, khong tu dong sao chep du lieu tu he thong cu.
