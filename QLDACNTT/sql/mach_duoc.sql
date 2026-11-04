-- Mạch Dược — cơ sở dữ liệu MySQL 8
-- Trong MySQL Workbench: File > Open SQL Script > chọn file này > Execute (tia sét).
-- Chạy lại sẽ xóa và tạo lại database mach_duoc cùng dữ liệu mẫu.

DROP DATABASE IF EXISTS mach_duoc;

CREATE DATABASE mach_duoc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mach_duoc;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_paid_invoice_lines;
DROP VIEW IF EXISTS v_paid_invoices;
DROP VIEW IF EXISTS v_confirmed_receipts;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS invoice_lines;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS goods_receipt_lines;
DROP TABLE IF EXISTS goods_receipts;
DROP TABLE IF EXISTS transfer_lines;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS stocktake_lines;
DROP TABLE IF EXISTS stocktakes;
DROP TABLE IF EXISTS medicine_lots;
DROP TABLE IF EXISTS medicines;
DROP TABLE IF EXISTS staff_transfers;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS access_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS branch_contacts;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS discount_codes;
DROP TABLE IF EXISTS customer_roles;
DROP TABLE IF EXISTS dosage_forms;
DROP TABLE IF EXISTS measure_units;
DROP TABLE IF EXISTS manufacturers;
DROP TABLE IF EXISTS drug_categories;
DROP TABLE IF EXISTS alert_policy;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS branches;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  id           VARCHAR(40)  NOT NULL,
  name         VARCHAR(80)  NOT NULL,
  description  VARCHAR(255) NOT NULL DEFAULT '',
  builtin      TINYINT(1)   NOT NULL DEFAULT 0,
  status       VARCHAR(16)  NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id          VARCHAR(40)  NOT NULL,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  group_name  VARCHAR(40)  NOT NULL,
  builtin     TINYINT(1)   NOT NULL DEFAULT 0,
  status      VARCHAR(16)  NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id        VARCHAR(40) NOT NULL,
  permission_id  VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE branches (
  id          VARCHAR(40)  NOT NULL,
  name        VARCHAR(160) NOT NULL,
  short_name  VARCHAR(80)  NOT NULL,
  address     VARCHAR(255) NOT NULL,
  phone       VARCHAR(40)  NOT NULL,
  hours       VARCHAR(80)  NOT NULL DEFAULT '08:00 – 21:00',
  status      VARCHAR(16)  NOT NULL DEFAULT 'open',
  manager     VARCHAR(120) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_branches_name (name),
  KEY idx_branches_status (status),
  CONSTRAINT ck_branch_status CHECK (status IN ('open', 'maintenance', 'closed'))
) ENGINE=InnoDB;

CREATE TABLE branch_contacts (
  branch_id     VARCHAR(40)  NOT NULL,
  contact_name  VARCHAR(120) NOT NULL DEFAULT '',
  email         VARCHAR(160) NOT NULL DEFAULT '',
  phone         VARCHAR(40)  NOT NULL,
  address       VARCHAR(255) NOT NULL,
  PRIMARY KEY (branch_id),
  CONSTRAINT fk_contact_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE customer_roles (
  id                VARCHAR(40) NOT NULL,
  name              VARCHAR(80) NOT NULL,
  description       VARCHAR(200) NOT NULL DEFAULT '',
  point_rate        INT NOT NULL DEFAULT 0,
  discount_percent  INT NOT NULL DEFAULT 0,
  min_spend         BIGINT NOT NULL DEFAULT 0,
  builtin           TINYINT(1) NOT NULL DEFAULT 0,
  status            VARCHAR(16) NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_roles_name (name),
  CONSTRAINT ck_customer_role_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT ck_point_rate CHECK (point_rate BETWEEN 0 AND 20),
  CONSTRAINT ck_discount_percent CHECK (discount_percent BETWEEN 0 AND 30),
  CONSTRAINT ck_min_spend CHECK (min_spend >= 0)
) ENGINE=InnoDB;

CREATE TABLE customers (
  id           VARCHAR(40) NOT NULL,
  code         VARCHAR(20) NOT NULL,
  name         VARCHAR(80) NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  email        VARCHAR(120) NOT NULL DEFAULT '',
  address      VARCHAR(200) NOT NULL DEFAULT '',
  birthday     DATE NULL,
  role_id      VARCHAR(40) NOT NULL,
  branch_id    VARCHAR(40) NOT NULL,
  points       INT NOT NULL DEFAULT 0,
  total_spend  BIGINT NOT NULL DEFAULT 0,
  status       VARCHAR(16) NOT NULL DEFAULT 'active',
  note         VARCHAR(300) NOT NULL DEFAULT '',
  created_at   DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_code (code),
  UNIQUE KEY uq_customers_phone (phone),
  KEY idx_customers_role (role_id),
  KEY idx_customers_branch (branch_id),
  KEY idx_customers_status (status),
  CONSTRAINT fk_customers_role FOREIGN KEY (role_id) REFERENCES customer_roles (id),
  CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT ck_customer_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT ck_customer_points CHECK (points >= 0),
  CONSTRAINT ck_customer_spend CHECK (total_spend >= 0)
) ENGINE=InnoDB;

CREATE TABLE users (
  id             VARCHAR(40) NOT NULL,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  phone          VARCHAR(40) NOT NULL DEFAULT '',
  password_hash  VARCHAR(120) NOT NULL,
  role_id        VARCHAR(40) NOT NULL,
  branch_id      VARCHAR(40) NULL,
  customer_id    VARCHAR(40) NULL,
  title          VARCHAR(80) NOT NULL DEFAULT '',
  status         VARCHAR(16) NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_customer (customer_id),
  KEY idx_users_role (role_id),
  KEY idx_users_branch (branch_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
  token       VARCHAR(64) NOT NULL,
  user_id     VARCHAR(40) NOT NULL,
  issued_at   DATETIME NOT NULL,
  expires_at  DATETIME NOT NULL,
  remember    TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (token),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE access_logs (
  id       VARCHAR(40) NOT NULL,
  at       DATETIME NOT NULL,
  user_id  VARCHAR(40) NULL,
  email    VARCHAR(160) NOT NULL DEFAULT '',
  action   VARCHAR(40) NOT NULL,
  result   VARCHAR(16) NOT NULL,
  detail   VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_logs_at (at),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE staff_transfers (
  id           VARCHAR(40) NOT NULL,
  user_id      VARCHAR(40) NOT NULL,
  from_branch  VARCHAR(40) NULL,
  to_branch    VARCHAR(40) NOT NULL,
  actor_id     VARCHAR(40) NOT NULL,
  kind         VARCHAR(16) NOT NULL,
  at           DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_transfers_user (user_id),
  KEY idx_transfers_to (to_branch),
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_to FOREIGN KEY (to_branch) REFERENCES branches (id),
  CONSTRAINT fk_staff_actor FOREIGN KEY (actor_id) REFERENCES users (id),
  CONSTRAINT ck_transfer_kind CHECK (kind IN ('assign', 'transfer'))
) ENGINE=InnoDB;

CREATE TABLE drug_categories (
  id    VARCHAR(40) NOT NULL,
  name  VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE manufacturers (
  id       VARCHAR(40) NOT NULL,
  name     VARCHAR(120) NOT NULL,
  phone    VARCHAR(40) NOT NULL DEFAULT '',
  country  VARCHAR(80) NOT NULL DEFAULT '',
  status   VARCHAR(16) NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_makers_name (name),
  KEY idx_makers_status (status),
  CONSTRAINT ck_maker_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB;

CREATE TABLE measure_units (
  id       VARCHAR(40) NOT NULL,
  name     VARCHAR(40) NOT NULL,
  builtin  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_name (name)
) ENGINE=InnoDB;

CREATE TABLE dosage_forms (
  id       VARCHAR(40) NOT NULL,
  name     VARCHAR(40) NOT NULL,
  builtin  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_forms_name (name)
) ENGINE=InnoDB;

CREATE TABLE medicines (
  id                 VARCHAR(40) NOT NULL,
  branch_id          VARCHAR(40) NOT NULL,
  code               VARCHAR(20) NOT NULL,
  name               VARCHAR(160) NOT NULL,
  category_id        VARCHAR(40) NOT NULL,
  manufacturer_id    VARCHAR(40) NOT NULL,
  unit_id            VARCHAR(40) NOT NULL,
  dosage_form_id     VARCHAR(40) NOT NULL,
  active_ingredient  VARCHAR(160) NOT NULL,
  strength           VARCHAR(40) NOT NULL,
  cost_price         BIGINT NOT NULL,
  sale_price         BIGINT NOT NULL,
  stock              INT NOT NULL,
  min_stock          INT NOT NULL,
  status             VARCHAR(16) NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_medicines_code (code),
  KEY idx_medicines_category (category_id),
  KEY idx_medicines_maker (manufacturer_id),
  KEY idx_medicines_status (status),
  KEY idx_medicines_branch (branch_id),
  CONSTRAINT fk_med_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT fk_med_category FOREIGN KEY (category_id) REFERENCES drug_categories (id),
  CONSTRAINT fk_med_maker FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id),
  CONSTRAINT fk_med_unit FOREIGN KEY (unit_id) REFERENCES measure_units (id),
  CONSTRAINT fk_med_form FOREIGN KEY (dosage_form_id) REFERENCES dosage_forms (id),
  CONSTRAINT ck_med_status CHECK (status IN ('active', 'discontinued')),
  CONSTRAINT ck_med_cost CHECK (cost_price >= 0),
  CONSTRAINT ck_med_price CHECK (sale_price >= cost_price),
  CONSTRAINT ck_med_stock CHECK (stock >= 0 AND min_stock >= 0)
) ENGINE=InnoDB;

CREATE TABLE medicine_lots (
  id           VARCHAR(40) NOT NULL,
  medicine_id  VARCHAR(40) NOT NULL,
  batch_no     VARCHAR(30) NOT NULL,
  expiry       DATE NOT NULL,
  qty          INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lots_batch (medicine_id, batch_no),
  KEY idx_lots_expiry (expiry),
  CONSTRAINT fk_lots_med FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE CASCADE,
  CONSTRAINT ck_lot_qty CHECK (qty >= 0)
) ENGINE=InnoDB;

CREATE TABLE suppliers (
  id          VARCHAR(40) NOT NULL,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(160) NOT NULL,
  phone       VARCHAR(40) NOT NULL,
  email       VARCHAR(120) NOT NULL DEFAULT '',
  address     VARCHAR(200) NOT NULL,
  contact     VARCHAR(80) NOT NULL DEFAULT '',
  tax_code    VARCHAR(13) NOT NULL DEFAULT '',
  note        VARCHAR(300) NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_code (code),
  KEY idx_suppliers_status (status),
  KEY idx_suppliers_name (name),
  CONSTRAINT ck_supplier_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB;

CREATE TABLE goods_receipts (
  id            VARCHAR(40) NOT NULL,
  code          VARCHAR(24) NOT NULL,
  supplier_id   VARCHAR(40) NOT NULL,
  branch_id     VARCHAR(40) NOT NULL,
  note          VARCHAR(300) NOT NULL DEFAULT '',
  status        VARCHAR(16) NOT NULL DEFAULT 'draft',
  total_amount  BIGINT NOT NULL,
  created_by    VARCHAR(120) NOT NULL DEFAULT '',
  created_at    DATETIME NOT NULL,
  confirmed_at  DATETIME NULL,
  cancelled_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipts_code (code),
  KEY idx_receipts_supplier (supplier_id),
  KEY idx_receipts_branch (branch_id),
  KEY idx_receipts_status (status),
  CONSTRAINT fk_receipt_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_receipt_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT ck_receipt_status CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  CONSTRAINT ck_receipt_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE goods_receipt_lines (
  id            VARCHAR(40) NOT NULL,
  receipt_id    VARCHAR(40) NOT NULL,
  medicine_id   VARCHAR(40) NOT NULL,
  qty           INT NOT NULL,
  cost_price    BIGINT NOT NULL,
  amount        BIGINT NOT NULL,
  batch_no      VARCHAR(30) NOT NULL,
  expiry        DATE NOT NULL,
  stock_before  INT NULL,
  stock_after   INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipt_line (receipt_id, medicine_id, batch_no),
  KEY idx_receipt_lines_medicine (medicine_id),
  CONSTRAINT fk_rline_receipt FOREIGN KEY (receipt_id) REFERENCES goods_receipts (id) ON DELETE CASCADE,
  CONSTRAINT fk_rline_med FOREIGN KEY (medicine_id) REFERENCES medicines (id),
  CONSTRAINT ck_rline_qty CHECK (qty > 0),
  CONSTRAINT ck_rline_cost CHECK (cost_price >= 0 AND amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE discount_codes (
  id             VARCHAR(40) NOT NULL,
  code           VARCHAR(20) NOT NULL,
  discount_type  VARCHAR(16) NOT NULL,
  value          BIGINT NOT NULL,
  min_subtotal   BIGINT NOT NULL DEFAULT 0,
  max_discount   BIGINT NOT NULL DEFAULT 0,
  start_on       DATE NULL,
  end_on         DATE NULL,
  status         VARCHAR(16) NOT NULL DEFAULT 'active',
  note           VARCHAR(200) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_discount_code (code),
  CONSTRAINT ck_discount_type CHECK (discount_type IN ('percent', 'amount')),
  CONSTRAINT ck_discount_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT ck_discount_value CHECK (value > 0 AND min_subtotal >= 0 AND max_discount >= 0)
) ENGINE=InnoDB;

CREATE TABLE invoices (
  id                VARCHAR(40) NOT NULL,
  code              VARCHAR(24) NOT NULL,
  branch_id         VARCHAR(40) NOT NULL,
  customer_id       VARCHAR(40) NULL,
  customer_role_id  VARCHAR(40) NULL,
  customer_name     VARCHAR(80) NOT NULL,
  customer_phone    VARCHAR(20) NOT NULL DEFAULT '',
  cashier_name      VARCHAR(120) NOT NULL,
  pay_method        VARCHAR(16) NOT NULL,
  pay_status        VARCHAR(16) NOT NULL DEFAULT 'received',
  status            VARCHAR(16) NOT NULL DEFAULT 'paid',
  sold_at           DATETIME NOT NULL,
  subtotal          BIGINT NOT NULL,
  discount_mode     VARCHAR(16) NOT NULL DEFAULT 'none',
  discount_code     VARCHAR(20) NOT NULL DEFAULT '',
  discount_amount   BIGINT NOT NULL DEFAULT 0,
  total_amount      BIGINT NOT NULL,
  points_earned     INT NOT NULL DEFAULT 0,
  spend_counted     TINYINT(1) NOT NULL DEFAULT 0,
  tendered          BIGINT NULL,
  change_amount     BIGINT NULL,
  transfer_ref      VARCHAR(40) NOT NULL DEFAULT '',
  bank_name         VARCHAR(80) NOT NULL DEFAULT '',
  bank_account      VARCHAR(40) NOT NULL DEFAULT '',
  bank_owner        VARCHAR(120) NOT NULL DEFAULT '',
  cancelled_at      DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_code (code),
  KEY idx_invoices_branch (branch_id),
  KEY idx_invoices_sold_at (sold_at),
  KEY idx_invoices_status (status),
  KEY idx_invoices_customer (customer_id),
  CONSTRAINT fk_invoice_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_invoice_crole FOREIGN KEY (customer_role_id) REFERENCES customer_roles (id),
  CONSTRAINT ck_invoice_pay CHECK (pay_method IN ('cash', 'transfer', 'card')),
  CONSTRAINT ck_invoice_status CHECK (status IN ('paid', 'cancelled')),
  CONSTRAINT ck_invoice_money CHECK (subtotal >= 0 AND discount_amount >= 0 AND total_amount >= 0 AND points_earned >= 0),
  CONSTRAINT ck_invoice_total CHECK (total_amount = subtotal - discount_amount)
) ENGINE=InnoDB;

CREATE TABLE invoice_lines (
  id            VARCHAR(40) NOT NULL,
  invoice_id    VARCHAR(40) NOT NULL,
  medicine_id   VARCHAR(40) NOT NULL,
  qty           INT NOT NULL,
  unit_price    BIGINT NOT NULL,
  cost_price    BIGINT NOT NULL,
  amount        BIGINT NOT NULL,
  batch_no      VARCHAR(30) NOT NULL DEFAULT '',
  stock_before  INT NULL,
  stock_after   INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_line (invoice_id, medicine_id),
  KEY idx_invoice_lines_medicine (medicine_id),
  CONSTRAINT fk_iline_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_iline_med FOREIGN KEY (medicine_id) REFERENCES medicines (id),
  CONSTRAINT ck_iline_qty CHECK (qty > 0),
  CONSTRAINT ck_iline_money CHECK (unit_price >= 0 AND cost_price >= 0 AND amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE alert_policy (
  id                VARCHAR(40) NOT NULL,
  stock_alert       TINYINT(1) NOT NULL DEFAULT 1,
  expiry_alert      TINYINT(1) NOT NULL DEFAULT 1,
  expiry_warn_days  INT NOT NULL DEFAULT 45,
  PRIMARY KEY (id),
  CONSTRAINT ck_expiry_warn_days CHECK (expiry_warn_days BETWEEN 1 AND 365)
) ENGINE=InnoDB;

CREATE TABLE stocktakes (
  id          VARCHAR(40) NOT NULL,
  code        VARCHAR(24) NOT NULL,
  branch_id   VARCHAR(40) NOT NULL,
  note        VARCHAR(300) NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'draft',
  minute      VARCHAR(500) NOT NULL DEFAULT '',
  created_by  VARCHAR(120) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL,
  posted_at   DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stocktakes_code (code),
  KEY idx_stocktakes_branch (branch_id),
  KEY idx_stocktakes_status (status),
  CONSTRAINT fk_stocktake_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT ck_stocktake_status CHECK (status IN ('draft', 'counted', 'minuted', 'posted', 'cancelled'))
) ENGINE=InnoDB;

CREATE TABLE stocktake_lines (
  id            VARCHAR(40) NOT NULL,
  stocktake_id  VARCHAR(40) NOT NULL,
  medicine_id   VARCHAR(40) NOT NULL,
  system_qty    INT NOT NULL,
  actual_qty    INT NULL,
  variance_qty  INT NULL,
  reason_code   VARCHAR(16) NOT NULL DEFAULT '',
  stock_after   INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stocktake_line (stocktake_id, medicine_id),
  KEY idx_stocktake_lines_medicine (medicine_id),
  CONSTRAINT fk_sline_sheet FOREIGN KEY (stocktake_id) REFERENCES stocktakes (id) ON DELETE CASCADE,
  CONSTRAINT fk_sline_med FOREIGN KEY (medicine_id) REFERENCES medicines (id),
  CONSTRAINT ck_sline_qty CHECK (system_qty >= 0 AND (actual_qty IS NULL OR actual_qty >= 0)),
  CONSTRAINT ck_stocktake_reason CHECK (reason_code IN ('', 'count', 'damage', 'expiry', 'loss', 'found', 'other'))
) ENGINE=InnoDB;

CREATE TABLE transfers (
  id              VARCHAR(40) NOT NULL,
  code            VARCHAR(24) NOT NULL,
  from_branch_id  VARCHAR(40) NOT NULL,
  to_branch_id    VARCHAR(40) NOT NULL,
  note            VARCHAR(300) NOT NULL DEFAULT '',
  status          VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_by      VARCHAR(120) NOT NULL DEFAULT '',
  created_at      DATETIME NOT NULL,
  confirmed_at    DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transfers_code (code),
  KEY idx_transfers_from (from_branch_id),
  KEY idx_transfers_to (to_branch_id),
  KEY idx_transfers_status (status),
  CONSTRAINT fk_move_from FOREIGN KEY (from_branch_id) REFERENCES branches (id),
  CONSTRAINT fk_move_to FOREIGN KEY (to_branch_id) REFERENCES branches (id),
  CONSTRAINT ck_move_status CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  CONSTRAINT ck_move_branches CHECK (from_branch_id <> to_branch_id)
) ENGINE=InnoDB;

CREATE TABLE transfer_lines (
  id           VARCHAR(40) NOT NULL,
  transfer_id  VARCHAR(40) NOT NULL,
  medicine_id  VARCHAR(40) NOT NULL,
  batch_no     VARCHAR(30) NOT NULL DEFAULT '',
  qty          INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_transfer_lines_med (medicine_id),
  CONSTRAINT fk_mline_move FOREIGN KEY (transfer_id) REFERENCES transfers (id) ON DELETE CASCADE,
  CONSTRAINT fk_mline_med FOREIGN KEY (medicine_id) REFERENCES medicines (id),
  CONSTRAINT ck_mline_qty CHECK (qty > 0)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id         VARCHAR(40) NOT NULL,
  type       VARCHAR(16) NOT NULL,
  title      VARCHAR(160) NOT NULL,
  body       VARCHAR(500) NOT NULL,
  at         DATETIME NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  priority   VARCHAR(16) NOT NULL DEFAULT 'low',
  PRIMARY KEY (id),
  KEY idx_notifications_at (at),
  CONSTRAINT ck_note_type CHECK (type IN ('expiry', 'stock', 'system')),
  CONSTRAINT ck_note_priority CHECK (priority IN ('low', 'medium', 'high'))
) ENGINE=InnoDB;

CREATE TABLE app_meta (
  meta_key    VARCHAR(40) NOT NULL,
  meta_value  VARCHAR(40) NOT NULL,
  PRIMARY KEY (meta_key)
) ENGINE=InnoDB;

CREATE TABLE app_state (
  doc_key  VARCHAR(40) NOT NULL,
  payload  LONGTEXT NOT NULL,
  PRIMARY KEY (doc_key)
) ENGINE=InnoDB;

CREATE VIEW v_paid_invoices AS
SELECT id, code, branch_id, customer_name, cashier_name, status, sold_at, discount_amount, total_amount
FROM invoices
WHERE status = 'paid';

CREATE VIEW v_paid_invoice_lines AS
SELECT
  l.invoice_id, l.medicine_id, l.qty, l.unit_price, l.cost_price, l.amount,
  i.branch_id, i.cashier_name, i.sold_at, i.discount_amount, i.total_amount
FROM invoice_lines l
JOIN invoices i ON i.id = l.invoice_id
WHERE i.status = 'paid';

CREATE VIEW v_confirmed_receipts AS
SELECT id, code, supplier_id, branch_id, status, total_amount, created_at, confirmed_at
FROM goods_receipts
WHERE status = 'confirmed';

-- Dữ liệu mẫu. Mật khẩu lưu dạng băm, không lưu chữ thường.
-- admin@pharmacare.vn / admin123
-- ha.q1@pharmacare.vn / Quanly123
-- nam.nguyen@gmail.com / Khach123

INSERT INTO roles (id, name, description, builtin, status) VALUES
  ('admin', 'Quản trị', 'Toàn quyền hệ thống, mọi chi nhánh.', 1, 'active'),
  ('manager', 'Quản lý', 'Điều hành một chi nhánh.', 1, 'active'),
  ('pharmacist', 'Dược sĩ', 'Kho, hạn dùng và bán tại quầy.', 1, 'active'),
  ('cashier', 'Thu ngân', 'Hóa đơn và khách hàng.', 1, 'active'),
  ('customer', 'Khách hàng', 'Xem cửa hàng và đơn đã mua.', 1, 'active');

INSERT INTO permissions (id, code, name, group_name, builtin, status) VALUES
  ('p-chi-nhanh', 'chi-nhanh', 'Chi nhánh', 'Màn hình', 1, 'active'),
  ('p-kho', 'kho', 'Kho thuốc', 'Màn hình', 1, 'active'),
  ('p-ton-kho', 'ton-kho', 'Tồn kho', 'Màn hình', 1, 'active'),
  ('p-ban-hang', 'ban-hang', 'Bán hàng', 'Màn hình', 1, 'active'),
  ('p-khach-hang', 'khach-hang', 'Khách hàng', 'Màn hình', 1, 'active'),
  ('p-bao-cao', 'bao-cao', 'Báo cáo', 'Màn hình', 1, 'active'),
  ('p-nhan-su', 'nhan-su', 'Nhân sự', 'Màn hình', 1, 'active'),
  ('p-sale', 'sale.create', 'Lập hóa đơn', 'Thao tác', 1, 'active'),
  ('p-stock', 'inventory.edit', 'Điều chỉnh kho', 'Thao tác', 1, 'active');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'admin', id FROM permissions;

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('manager', 'p-chi-nhanh'),
  ('manager', 'p-kho'),
  ('manager', 'p-ton-kho'),
  ('manager', 'p-ban-hang'),
  ('manager', 'p-khach-hang'),
  ('manager', 'p-bao-cao'),
  ('manager', 'p-nhan-su'),
  ('manager', 'p-sale'),
  ('manager', 'p-stock'),
  ('pharmacist', 'p-kho'),
  ('pharmacist', 'p-ton-kho'),
  ('pharmacist', 'p-ban-hang'),
  ('pharmacist', 'p-khach-hang'),
  ('pharmacist', 'p-sale'),
  ('pharmacist', 'p-stock'),
  ('cashier', 'p-ban-hang'),
  ('cashier', 'p-khach-hang'),
  ('cashier', 'p-sale');

INSERT INTO branches (id, name, short_name, address, phone, hours, status, manager) VALUES
  ('br-q1', 'PharmaCare Quận 1', 'Quận 1', '12 Nguyễn Huệ, Quận 1, TP.HCM', '0901234567', '08:00 – 21:00', 'open', 'Trần Thu Hà'),
  ('br-td', 'PharmaCare Thủ Đức', 'Thủ Đức', '15 Võ Văn Ngân, TP. Thủ Đức', '0905556677', '07:30 – 22:00', 'open', '');

INSERT INTO branch_contacts (branch_id, contact_name, email, phone, address) VALUES
  ('br-q1', 'Trần Thu Hà', 'q1@pharmacare.vn', '0901234567', '12 Nguyễn Huệ, Quận 1, TP.HCM'),
  ('br-td', 'Lê Quốc Bảo', 'thuduc@pharmacare.vn', '0905556677', '15 Võ Văn Ngân, TP. Thủ Đức');

INSERT INTO customer_roles (id, name, description, point_rate, discount_percent, min_spend, builtin, status) VALUES
  ('member', 'Thành viên', 'Khách mua lẻ.', 1, 0, 0, 1, 'active'),
  ('loyal', 'Thân thiết', 'Khách mua thường xuyên.', 2, 5, 500000, 1, 'active'),
  ('wholesale', 'Khách sỉ', 'Nhà thuốc lấy sỉ.', 1, 8, 0, 1, 'active');

INSERT INTO customers (id, code, name, phone, email, address, role_id, branch_id, points, total_spend, status, note, created_at) VALUES
  ('kh-nam', 'KH0001', 'Nguyễn Văn Nam', '0988123456', 'nam.nguyen@gmail.com', '15 Lê Lợi, Quận 1, TP.HCM', 'member', 'br-q1', 0, 4950, 'active', 'Mua thuốc cảm tại quầy', '2026-10-19 09:00:00'),
  ('kh-hoa', 'KH0002', 'Lê Thị Hoa', '0909888777', 'hoa.le@gmail.com', '88 Võ Văn Tần, Quận 3, TP.HCM', 'wholesale', 'br-q1', 40, 860000, 'active', 'Nhà thuốc tư nhân lấy sỉ', '2026-10-18 09:00:00'),
  ('kh-bao', 'KH0003', 'Trần Quốc Bảo', '0912345678', 'bao.tran@gmail.com', '4 Kha Vạn Cân, Thủ Đức', 'loyal', 'br-td', 80, 620000, 'active', '', '2026-10-16 09:00:00');

INSERT INTO users (id, name, email, phone, password_hash, role_id, branch_id, customer_id, title, status) VALUES
  ('u1', 'Nguyễn Minh Anh', 'admin@pharmacare.vn', '', 'h1.0123456789abcdef.ebc07827d00a68f99f48c98336429805f5a4d743c13b8612f48d4db2af3614f5', 'admin', NULL, NULL, 'Quản trị hệ thống', 'active'),
  ('u-ha', 'Trần Thu Hà', 'ha.q1@pharmacare.vn', '0903111222', 'h1.0123456789abcdef.0820f34623215de7260567f6e97566997de681182b8e1885fed9d709765128bb', 'manager', 'br-q1', NULL, 'Quản lý', 'active'),
  ('u-nam', 'Nguyễn Văn Nam', 'nam.nguyen@gmail.com', '0988123456', 'h1.0123456789abcdef.ae3f838e22f2bc66ecee1941117a8f8d9fa74b400d4dedadf0ccbd49d88d4edd', 'customer', 'br-q1', 'kh-nam', 'Khách hàng', 'active');

INSERT INTO drug_categories (id, name) VALUES
  ('cat-pain', 'Giảm đau hạ sốt'),
  ('cat-abx', 'Kháng sinh'),
  ('cat-vit', 'Vitamin');

INSERT INTO manufacturers (id, name, phone, country, status) VALUES
  ('mk-dhg', 'Dược Hậu Giang', '02923891433', 'Việt Nam', 'active'),
  ('mk-imx', 'Imexpharm', '02773851234', 'Việt Nam', 'active');

INSERT INTO measure_units (id, name, builtin) VALUES
  ('u-vien', 'Viên', 1),
  ('u-hop', 'Hộp', 1);

INSERT INTO dosage_forms (id, name, builtin) VALUES
  ('f-vien', 'Viên nén', 1),
  ('f-nang', 'Viên nang', 1);

INSERT INTO medicines (id, branch_id, code, name, category_id, manufacturer_id, unit_id, dosage_form_id, active_ingredient, strength, cost_price, sale_price, stock, min_stock, status) VALUES
  ('med-para', 'br-q1', 'T0001', 'Paracetamol', 'cat-pain', 'mk-dhg', 'u-vien', 'f-vien', 'Paracetamol', '500mg', 800, 1500, 56, 20, 'active'),
  ('med-amox', 'br-q1', 'T0002', 'Amoxicillin', 'cat-abx', 'mk-imx', 'u-vien', 'f-nang', 'Amoxicillin', '500mg', 1200, 2500, 59, 15, 'active'),
  ('med-vitc', 'br-td', 'T0003', 'Vitamin C', 'cat-vit', 'mk-dhg', 'u-vien', 'f-vien', 'Acid ascorbic', '500mg', 600, 1200, 24, 10, 'active');

INSERT INTO medicine_lots (id, medicine_id, batch_no, expiry, qty) VALUES
  ('lot-para-old', 'med-para', 'L26081', '2027-05-09', 6),
  ('lot-para-new', 'med-para', 'L26101', '2027-11-09', 50),
  ('lot-amox-old', 'med-amox', 'L26032', '2027-03-24', 39),
  ('lot-amox-new', 'med-amox', 'L26102', '2027-05-29', 20),
  ('lot-vitc', 'med-vitc', 'L26111', '2026-11-17', 24);

INSERT INTO suppliers (id, code, name, phone, email, address, contact, tax_code, note, status, created_at) VALUES
  ('sup-dhg', 'NCC001', 'Dược Hậu Giang', '02923891433', 'dung@duocmiennam.vn', '288 Bis Nguyễn Văn Cừ, Cần Thơ', 'Nguyễn Văn Dũng', '1800156803', '', 'active', '2026-01-10 08:00:00');

INSERT INTO goods_receipts (id, code, supplier_id, branch_id, note, status, total_amount, created_by, created_at, confirmed_at) VALUES
  ('pn-001', 'PN20261021-001', 'sup-dhg', 'br-q1', 'Nhập bổ sung Paracetamol', 'confirmed', 40000, 'Trần Thu Hà', '2026-10-21 08:00:00', '2026-10-21 08:30:00');

INSERT INTO goods_receipt_lines (id, receipt_id, medicine_id, qty, cost_price, amount, batch_no, expiry, stock_before, stock_after) VALUES
  ('pnl-001', 'pn-001', 'med-para', 50, 800, 40000, 'L26101', '2027-11-09', 6, 56);

INSERT INTO discount_codes (id, code, discount_type, value, min_subtotal, max_discount, status, note) VALUES
  ('dc-giam10', 'GIAM10', 'percent', 10, 0, 50000, 'active', 'Giảm 10%');

INSERT INTO invoices (id, code, branch_id, customer_id, customer_role_id, customer_name, customer_phone, cashier_name, pay_method, pay_status, status, sold_at, subtotal, discount_mode, discount_code, discount_amount, total_amount, points_earned, spend_counted, tendered, change_amount) VALUES
  ('hd-001', 'HD20261021-001', 'br-q1', 'kh-nam', 'member', 'Nguyễn Văn Nam', '0988123456', 'Trần Thu Hà', 'cash', 'received', 'paid', '2026-10-21 10:00:00', 5500, 'amount', '', 550, 4950, 0, 1, 5000, 50);

INSERT INTO invoice_lines (id, invoice_id, medicine_id, qty, unit_price, cost_price, amount, batch_no, stock_before, stock_after) VALUES
  ('hdl-001', 'hd-001', 'med-para', 2, 1500, 800, 3000, 'L26081', 58, 56),
  ('hdl-002', 'hd-001', 'med-amox', 1, 2500, 1200, 2500, 'L26032', 60, 59);

INSERT INTO alert_policy (id, stock_alert, expiry_alert, expiry_warn_days) VALUES
  ('policy-1', 1, 1, 45);

INSERT INTO notifications (id, type, title, body, at, is_read, priority) VALUES
  ('note-exp-vitc', 'expiry', 'Sắp hết hạn', 'Vitamin C còn ít ngày, lô L26111 tại Thủ Đức.', '2026-10-21 10:30:00', 0, 'medium'),
  ('note-sale', 'system', 'Đã thanh toán hóa đơn', 'Hóa đơn HD20261021-001 của Nguyễn Văn Nam, tiền mặt.', '2026-10-21 10:00:00', 0, 'low');
