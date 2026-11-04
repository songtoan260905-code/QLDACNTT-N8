-- Vai trò khách hàng và hồ sơ khách.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.
-- Điểm cộng mỗi 10.000đ theo point_rate. Giảm giá theo discount_percent khi bán.

CREATE TABLE customer_roles (
  id                VARCHAR(40) PRIMARY KEY,
  name              VARCHAR(80) NOT NULL UNIQUE,
  description       VARCHAR(200) NOT NULL DEFAULT '',
  point_rate        INTEGER NOT NULL DEFAULT 0 CHECK (point_rate BETWEEN 0 AND 20),
  discount_percent  INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 30),
  min_spend         BIGINT NOT NULL DEFAULT 0 CHECK (min_spend >= 0),
  builtin           BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(16) NOT NULL DEFAULT 'active',
  CONSTRAINT ck_customer_role_status CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE customers (
  id           VARCHAR(40) PRIMARY KEY,
  code         VARCHAR(20) NOT NULL UNIQUE,
  name         VARCHAR(80) NOT NULL,
  phone        VARCHAR(20) NOT NULL UNIQUE,
  email        VARCHAR(120) NOT NULL DEFAULT '',
  address      VARCHAR(200) NOT NULL DEFAULT '',
  birthday     DATE,
  role_id      VARCHAR(40) NOT NULL REFERENCES customer_roles(id),
  branch_id    VARCHAR(40) NOT NULL REFERENCES branches(id),
  points       INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  total_spend  BIGINT NOT NULL DEFAULT 0 CHECK (total_spend >= 0),
  status       VARCHAR(16) NOT NULL DEFAULT 'active',
  note         VARCHAR(300) NOT NULL DEFAULT '',
  created_at   TIMESTAMP NOT NULL,
  CONSTRAINT ck_customer_status CHECK (status IN ('active', 'inactive'))
);

-- Hóa đơn gắn hồ sơ khi số điện thoại khớp (bổ sung cho invoices).
ALTER TABLE invoices ADD COLUMN customer_id VARCHAR(40) REFERENCES customers(id);
ALTER TABLE invoices ADD COLUMN customer_role_id VARCHAR(40) REFERENCES customer_roles(id);
ALTER TABLE invoices ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0);
ALTER TABLE invoices ADD COLUMN spend_counted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_customers_role ON customers(role_id);
CREATE INDEX idx_customers_branch ON customers(branch_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);

-- Tài khoản đăng nhập cửa hàng, gắn một hồ sơ khách.
ALTER TABLE users ADD COLUMN customer_id VARCHAR(40) REFERENCES customers(id);
CREATE UNIQUE INDEX idx_users_customer ON users(customer_id);
