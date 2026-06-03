# HƯỚNG DẪN VÀ QUY TẮC PHÁT TRIỂN DỰ ÁN (DEVELOPER GUIDELINES)

Tệp tin này ghi nhớ các luật bắt buộc phải tuân theo khi thiết kế, chỉnh sửa hoặc thêm mới bất kỳ tính năng nào cho giao diện hệ thống ERP Sản xuất Tem Nhãn.

---

## 1. QUY TẮC THIẾT KẾ GIAO DIỆN (UI/UX RULES)

### 1.1. Tông màu (Color Theme)
- **Bắt buộc**: Chỉ sử dụng **MÀU SÁNG (Light Theme)** làm chủ đạo.
- Không sử dụng chế độ Dark Mode hoặc các bảng màu tối, âm u.
- Sử dụng màu trắng, xám nhạt, xanh nhạt hoặc các màu pastel lịch sự, tinh tế để tạo không gian làm việc chuyên nghiệp, dễ chịu cho nhân viên văn phòng.
- Sử dụng độ tương phản tốt để dễ đọc số liệu bảng biểu.

### 1.2. Biểu tượng (Icons)
- **QUY TẮC CỐT LÕI**: **TUYỆT ĐỐI KHÔNG SỬ DỤNG ICON** (Không dùng FontAwesome, Lucide, Heroicons, Material Icons, hay bất kỳ ký tự biểu tượng nào).
- **Giải pháp thay thế**: Sử dụng **VĂN BẢN (Text Labels)** rõ nghĩa. 
  - *Ví dụ*: Thay vì dùng nút icon `[+]`, hãy dùng nút chữ `Thêm mới`.
  - Thay vì dùng nút icon thùng rác `[🗑️]`, hãy dùng chữ `Xóa`.
  - Thay vì dùng icon kính lúp `[🔍]`, hãy dùng chữ `Tìm kiếm`.
  - Thay vì icon cài đặt `[⚙️]`, hãy dùng chữ `Cấu hình`.
- Thiết kế nút bấm và danh mục điều hướng bằng văn bản rõ ràng, sắp xếp khoa học để bù đắp cho việc thiếu biểu tượng trực quan.

### 1.3. Phong cách (Aesthetic & Vibe)
- **Lịch sự văn phòng, tiện nghi**: Bố cục bảng biểu (table), biểu mẫu (form), bảng thông tin (dashboard) gọn gàng, ngăn nắp.
- Khoảng cách (padding, margin) hợp lý, không quá chật chội nhưng cũng không quá rộng làm lãng phí không gian màn hình.
- Các nút bấm có viền nhẹ (border), hiệu ứng hover đổi màu tinh tế, góc bo tròn nhẹ (border-radius: 4px hoặc 6px) để tạo cảm giác trang nhã, tin cậy.

---

## 2. QUY TẮC KỸ THUẬT & DỮ LIỆU (TECHNICAL RULES)

### 2.1. Quản lý Hình ảnh (Base64)
- **Không sử dụng dịch vụ Cloud Storage (Firebase Storage)** để lưu hình ảnh trực tiếp.
- Mọi hình ảnh tải lên (ảnh mẫu tem, ảnh duyệt màu thiết kế, ảnh chữ ký biên bản giao hàng) phải được xử lý qua Client:
  1. Sử dụng `FileReader` để đọc file ảnh dưới dạng Data URL.
  2. Vẽ ảnh lên một thẻ `<canvas>` ẩn để thay đổi kích thước (tối đa 600px - 800px chiều rộng/cao).
  3. Nén chất lượng ảnh bằng `canvas.toDataURL('image/jpeg', 0.7)` (chất lượng 70%) để chuyển thành chuỗi Base64.
  4. Lưu chuỗi Base64 này trực tiếp dưới dạng trường kiểu `String` trong cơ sở dữ liệu **Firebase Firestore**.
- Khi hiển thị, truyền trực tiếp chuỗi Base64 vào thuộc tính `src` của thẻ `<img>`.

### 2.2. Quản lý File lớn (PDF, Excel, AI, Corel)
- Các file tài liệu và file thiết kế gốc có dung lượng lớn (> 1MB) không được lưu dưới dạng Base64 vào Firestore (tránh giới hạn 1MB của tài liệu Firestore).
- Sử dụng các ô nhập **Đường dẫn liên kết ngoài (Link Google Drive, OneDrive...)**. Người dùng tải file lên dịch vụ lưu trữ ngoài và dán link vào ERP để chia sẻ.

### 2.3. Cơ sở dữ liệu & Xác thực
- Sử dụng **Firebase Firestore** làm cơ sở dữ liệu lưu trữ cấu trúc.
- Sử dụng **Firebase Auth** để quản lý người dùng và phân quyền (Role-based access control - RBAC).
- Toàn bộ dữ liệu dùng chung giữa các bộ phận, nhưng giao diện sẽ hiển thị các tính năng được phân quyền tương ứng cho từng vai trò: Admin, Sale, Thiết kế (Designer), Mua hàng (Purchaser), Sản xuất (Producer), Kế toán (Accountant).
