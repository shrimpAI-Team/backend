# ⚙️ shrimpAI • Core Backend API Gateway

<p align="center">
  <img src="https://img.shields.io/badge/Module-Backend%20Core-ea2845?style=for-the-badge&logo=nestjs&logoColor=white" alt="Backend Core" />
  <img src="https://img.shields.io/badge/Port-4000-f59e0b?style=for-the-badge&logo=fastapi&logoColor=white" alt="Port 4000" />
  <img src="https://img.shields.io/badge/NestJS-11.0-ea2845?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/Prisma%20ORM-7.10-2d3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Security-2FA%20%7C%20JWT%20%7C%20RBAC-10b981?style=for-the-badge&logo=auth0&logoColor=white" alt="Security" />
</p>

---

## 📌 Tổng Quan (Overview)

**`backend`** là trung tâm xử lý dữ liệu và điều phối dịch vụ của toàn bộ hệ sinh thái **shrimpAI**. Được xây dựng trên nền tảng **NestJS** theo kiến trúc module hóa hướng dịch vụ (Modular Architecture), hệ thống chịu trách nhiệm quản lý cơ sở dữ liệu quan hệ, cung cấp các chuẩn giao tiếp RESTful API an toàn, xử lý xác thực bảo mật đa tầng, và làm cầu nối chuyển tiếp (Proxy Bridge) đến mô hình AI Vision & Trợ lý ảo.

Mặc định lắng nghe tại địa chỉ: **`http://localhost:4000`**.

---

## 🛡️ Hệ Thống Bảo Mật & Phân Quyền (Security Architecture)

1. **Kiểm Soát Quyền Truy Cập Dựa Trên Vai Trò (RBAC - Role-Based Access Control)**:
   - Hai vai trò hệ thống: `USER` (người dùng/nông dân) và `ADMIN` (quản trị viên cấp cao).
   - Bảo vệ phân cấp bằng Decorator `@Roles('ADMIN')` kết hợp cùng `RolesGuard` và `JwtAuthGuard`.
2. **Xác Thực Đa Tầng (Multi-Tier Authentication)**:
   - **JWT Dual-Token Pattern**: Access Token (thời hạn ngắn 15 phút) và Refresh Token lưu trữ trong bảng `Session` (thời hạn 30 ngày).
   - **Xác thực 2 bước (2FA TOTP)**: Sử dụng chuẩn RFC 6238 (`otplib`) sinh chuỗi bí mật và mã QR dùng được với Google Authenticator/Authy.
   - **OAuth2 Social Sign-In**: Tích hợp Passport Strategies cho Google và Facebook.
3. **Quản Lý & Kiểm Toán Phiên (Live Session Auditing)**:
   - Mỗi lần đăng nhập tạo một bản ghi `Session` lưu trữ chuỗi User-Agent thiết bị, địa chỉ IP và trạng thái `isRevoked`.
   - Mọi API request đều xác thực xem phiên hiện tại có bị thu hồi hay không trước khi xử lý tiếp.
4. **Phòng Thủ Hạ Tầng**:
   - Tích hợp **Helmet** để bảo vệ HTTP headers.
   - Bộ giới hạn tốc độ yêu cầu **Throttler** ngăn chặn brute-force và DDoS.
   - Băm mật khẩu một chiều bằng thuật toán **bcrypt** với salt rounds chuẩn.

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Prisma Schema Overview)

Hệ thống sử dụng **PostgreSQL** kết hợp cùng **Prisma ORM 7** với các thực thể chính:

```
┌──────────────┐       1:N       ┌────────────────────────┐
│     User     ├────────────────►│        Account         │ (OAuth: Google, Facebook)
│              │                 └────────────────────────┘
│  - id        │       1:N       ┌────────────────────────┐
│  - email     ├────────────────►│        Session         │ (Theo dõi thiết bị, IP, Revoke)
│  - password  │                 └────────────────────────┘
│  - role      │       1:N       ┌────────────────────────┐
│  - isActive  ├────────────────►│      ChatSession       │ (Phiên trò chuyện trợ lý AI)
│  - twoFactor │                 └───────────┬────────────┘
└──────────────┘                             │ 1:N
                                             ▼
                                 ┌────────────────────────┐
                                 │      ChatMessage       │ (Nội dung tin nhắn người dùng / AI)
                                 └────────────────────────┘
```

---

## 📁 Cấu Trúc Thư Mục (Directory Layout)

```text
backend/
├── prisma/
│   ├── schema.prisma           # Lược đồ quan hệ thực thể cơ sở dữ liệu
│   └── seed.ts                 # Script khởi tạo tài khoản quản trị (Admin Seed)
│
├── src/
│   ├── common/                 # Thành phần dùng chung toàn ứng dụng
│   │   ├── decorators/         # @Roles, @CurrentUser, @Public
│   │   └── guards/             # JwtAuthGuard, RolesGuard, TwoFactorGuard
│   │
│   ├── config/                 # Đọc và xác thực biến môi trường
│   │
│   ├── routes/                 # Các Module nghiệp vụ theo tính năng
│   │   ├── admin/              # Module Quản trị viên (KPI, Users, Sessions, AI Testbench, Chat)
│   │   │   ├── admin.controller.ts
│   │   │   ├── admin.service.ts
│   │   │   ├── admin.dto.ts
│   │   │   └── admin.module.ts
│   │   ├── auth/               # Module Đăng nhập, Đăng ký, 2FA, OAuth, Reset mật khẩu
│   │   ├── chat/               # Module Hội thoại & Trợ lý ảo AI
│   │   ├── sessions/           # Module Kiểm tra & Thu hồi phiên làm việc
│   │   ├── species/            # Module Danh mục giống tôm & Cầu nối AI Vision
│   │   └── users/              # Module Thông tin hồ sơ cá nhân
│   │
│   ├── services/               # Dịch vụ hạ tầng
│   │   ├── mailer.service.ts   # Gửi email OTP / Đặt lại mật khẩu (Nodemailer SMTP)
│   │   └── prisma.service.ts   # Quản lý vòng đời kết nối PostgreSQL
│   │
│   ├── app.module.ts           # Root Module liên kết các phân hệ
│   └── main.ts                 # Entrypoint khởi tạo máy chủ HTTP NestJS
│
├── .env.example                # Mẫu cấu hình biến môi trường
├── package.json
└── tsconfig.json
```

---

## 🔌 Danh Sách API Endpoints Trọng Điểm

### 1. Phân Hệ Quản Trị Cấp Cao (`/admin/*` - Yêu cầu `@Roles('ADMIN')`)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `/admin/overview` | Lấy dữ liệu KPI tổng thể, thống kê người dùng, độ trễ DB và AI Engine |
| `GET` | `/admin/users` | Lấy danh sách tài khoản kèm phân trang và tìm kiếm |
| `POST` | `/admin/users` | Tạo tài khoản người dùng mới trực tiếp từ Admin Portal |
| `PATCH` | `/admin/users/:id/role` | Thăng hạng hoặc hạ quyền tài khoản (`ADMIN` ↔ `USER`) |
| `PATCH` | `/admin/users/:id/status` | Khóa hoặc kích hoạt lại tài khoản người dùng |
| `POST` | `/admin/users/:id/reset-password` | Đổi mật khẩu tài khoản và tự động thu hồi toàn bộ phiên đăng nhập |
| `DELETE` | `/admin/users/:id` | Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống |
| `GET` | `/admin/sessions` | Kiểm toán tất cả các phiên đăng nhập đang hoạt động trên hệ thống |
| `POST` | `/admin/sessions/:id/revoke` | Thu hồi ngay lập tức một phiên đăng nhập theo ID |
| `GET` | `/admin/chats` | Giám sát danh sách các phiên trò chuyện giữa nông dân và AI |
| `DELETE` | `/admin/chats/:id` | Xóa hội thoại vi phạm hoặc spam |
| `POST` | `/admin/testbench/diagnose` | Chạy chẩn đoán suy luận hình ảnh tôm và đo độ trễ toàn trình |

### 2. Phân Hệ Xác Thực & Người Dùng (`/auth/*`, `/users/*`)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Đăng nhập tài khoản bằng Email & Mật khẩu |
| `POST` | `/auth/register` | Đăng ký tài khoản người dùng mới |
| `POST` | `/auth/2fa/generate` | Tạo mã QR bí mật để kích hoạt Authenticator |
| `POST` | `/auth/2fa/verify` | Xác thực mã 6 số và kích hoạt 2FA thành công |
| `GET` | `/auth/google` | Khởi động luồng đăng nhập bằng tài khoản Google |
| `GET` | `/auth/facebook` | Khởi động luồng đăng nhập bằng tài khoản Facebook |

---

## ⚙️ Biến Môi Trường (.env)

Tạo file `backend/.env` từ mẫu sau:

```env
# Kết nối PostgreSQL (Cổng 5433 hoặc tùy chọn)
DATABASE_URL="postgresql://admin:password@localhost:5433/shrimp_vision?schema=public"
POSTGRES_USER=admin
POSTGRES_PASSWORD=password
POSTGRES_DB=shrimp_vision
POSTGRES_PORT=5433
POSTGRES_HOST=localhost

# Cổng máy chủ & Tên miền cho phép (CORS)
NODE_ENV=dev
PORT=4000
FRONTEND_URL="http://localhost:5174,http://localhost:5175,http://localhost:5173"

# Khóa bí mật JWT
JWT_ACCESS_SECRET="shrimpai_jwt_access_secret_super_secure"
JWT_ACCESS_TTL="15m"
JWT_CHALLENGE_SECRET="shrimpai_jwt_challenge_secret_super_secure"
JWT_CHALLENGE_TTL="5m"
REFRESH_TTL_DAYS=30

# Cấu hình 2FA
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
TOTP_ISSUER="shrimpAI"

# Cấu hình gửi Mail (Gmail SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-specific-password"
MAIL_FROM="no-reply@shrimp.ai"
```

---

## 🚀 Hướng Dẫn Khởi Động & Di Chuyển Dữ Liệu (Database Migration)

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Đồng bộ lược đồ vào PostgreSQL
npx prisma db push

# 4. Khởi tạo tài khoản Quản Trị Viên mặc định
npm run seed

# 5. Khởi chạy máy chủ ở chế độ phát triển
npm run start:dev
```

Kiểm tra trạng thái máy chủ tại: **`http://localhost:4000`**

### Lệnh quản lý Cơ sở Dữ liệu Prisma:
- `npx prisma studio`: Mở giao diện đồ họa web để duyệt và chỉnh sửa trực tiếp các bảng dữ liệu trong PostgreSQL.
- `npx prisma generate`: Sinh lại Prisma Client mỗi khi cập nhật file `schema.prisma`.
