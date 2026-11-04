# QLDACNTT-N8

Dự án Mạch Dược của nhóm 8, sử dụng Node.js và MySQL.

## Yêu cầu

- Node.js và npm.
- MySQL 8 đang chạy; có thể dùng MySQL Workbench để nhập dữ liệu.
- Git để tải mã nguồn.

## Cài đặt và chạy trên Windows

### 1. Tải mã nguồn và cài thư viện

Mở PowerShell và chạy:

```powershell
git clone https://github.com/songtoan260905-code/QLDACNTT-N8.git
cd QLDACNTT-N8/QLDACNTT
npm install
```

Nếu đã có mã nguồn, mở terminal tại thư mục chứa `QLDACNTT/package.json` rồi chạy `npm install`.

### 2. Khởi tạo cơ sở dữ liệu

Trong MySQL Workbench, kết nối tới MySQL, chọn **File → Open SQL Script**, mở `sql/mach_duoc.sql` trong thư mục ứng dụng và thực thi toàn bộ script.

**Lưu ý:** script xóa và tạo lại database `mach_duoc`, bao gồm dữ liệu mẫu. Sao lưu dữ liệu hiện có trước khi chạy; chỉ chạy trên cơ sở dữ liệu dành cho dự án.

### 3. Cấu hình kết nối MySQL

Tại thư mục chứa `package.json`, chạy:

```powershell
Copy-Item server/config.example.js server/config.js
```

Mở `server/config.js` và sửa `host`, `port`, `user`, `password` cho đúng MySQL trên máy. Giữ `database: "mach_duoc"` nếu dùng script ở bước 2. Cổng web mặc định là `webPort: 8080`.

Tệp `server/config.js` đã được loại khỏi Git bằng `.gitignore`; không đưa thông tin đăng nhập MySQL lên repository.

### 4. Khởi động ứng dụng

```powershell
npm start
```

Mở trình duyệt tại **http://127.0.0.1:8080**. Nếu đổi `webPort`, dùng cổng đã cấu hình. Nhấn `Ctrl+C` trong terminal để dừng ứng dụng.

## Xử lý lỗi thường gặp

- Thiếu module `mysql2`: chạy `npm install` tại thư mục chứa `package.json`.
- Không tìm thấy `./config`: tạo `server/config.js` theo bước 3.
- Không kết nối được MySQL: kiểm tra dịch vụ MySQL, thông tin đăng nhập và database `mach_duoc`.
- Cổng web đã được sử dụng: đổi `webPort` trong `server/config.js` rồi khởi động lại.
