-- Hóa đơn bán hàng, chi tiết, mã giảm giá và thanh toán.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.

CREATE TABLE discount_codes (
  id            VARCHAR(40) PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE,
  discount_type VARCHAR(16) NOT NULL,
  value         BIGINT NOT NULL CHECK (value > 0),
  min_subtotal  BIGINT NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount  BIGINT NOT NULL DEFAULT 0 CHECK (max_discount >= 0),
  start_on      DATE,
  end_on        DATE,
  status        VARCHAR(16) NOT NULL DEFAULT 'active',
  note          VARCHAR(200) NOT NULL DEFAULT '',
  CONSTRAINT ck_discount_type CHECK (discount_type IN ('percent', 'amount')),
  CONSTRAINT ck_discount_status CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE invoices (
  id               VARCHAR(40) PRIMARY KEY,
  code             VARCHAR(24) NOT NULL UNIQUE,
  branch_id        VARCHAR(40) NOT NULL REFERENCES branches(id),
  customer_name    VARCHAR(80) NOT NULL,
  customer_phone   VARCHAR(20) NOT NULL DEFAULT '',
  cashier_name     VARCHAR(120) NOT NULL,
  pay_method       VARCHAR(16) NOT NULL,
  pay_status       VARCHAR(16) NOT NULL DEFAULT 'received',
  status           VARCHAR(16) NOT NULL DEFAULT 'paid',
  sold_at          TIMESTAMP NOT NULL,
  subtotal         BIGINT NOT NULL CHECK (subtotal >= 0),
  discount_mode    VARCHAR(16) NOT NULL DEFAULT 'none',
  discount_code    VARCHAR(20) NOT NULL DEFAULT '',
  discount_amount  BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount     BIGINT NOT NULL CHECK (total_amount >= 0),
  tendered         BIGINT,
  change_amount    BIGINT,
  transfer_ref     VARCHAR(40) NOT NULL DEFAULT '',
  bank_name        VARCHAR(80) NOT NULL DEFAULT '',
  bank_account     VARCHAR(40) NOT NULL DEFAULT '',
  bank_owner       VARCHAR(120) NOT NULL DEFAULT '',
  cancelled_at     TIMESTAMP,
  CONSTRAINT ck_invoice_pay CHECK (pay_method IN ('cash', 'transfer', 'card')),
  CONSTRAINT ck_invoice_status CHECK (status IN ('paid', 'cancelled')),
  CONSTRAINT ck_invoice_total CHECK (total_amount = subtotal - discount_amount)
);

CREATE TABLE invoice_lines (
  id            VARCHAR(40) PRIMARY KEY,
  invoice_id    VARCHAR(40) NOT NULL REFERENCES invoices(id),
  medicine_id   VARCHAR(40) NOT NULL REFERENCES medicines(id),
  qty           INTEGER NOT NULL CHECK (qty > 0),
  unit_price    BIGINT NOT NULL CHECK (unit_price >= 0),
  cost_price    BIGINT NOT NULL CHECK (cost_price >= 0),
  amount        BIGINT NOT NULL CHECK (amount >= 0),
  batch_no      VARCHAR(30) NOT NULL DEFAULT '',
  stock_before  INTEGER,
  stock_after   INTEGER,
  UNIQUE (invoice_id, medicine_id)
);

CREATE INDEX idx_invoices_branch ON invoices(branch_id);
CREATE INDEX idx_invoices_sold_at ON invoices(sold_at);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_code ON invoices(code);
CREATE INDEX idx_invoice_lines_medicine ON invoice_lines(medicine_id);
