-- Nhà cung cấp và phiếu nhập hàng.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.

CREATE TABLE suppliers (
  id         VARCHAR(40) PRIMARY KEY,
  code       VARCHAR(20) NOT NULL UNIQUE,
  name       VARCHAR(160) NOT NULL,
  phone      VARCHAR(40) NOT NULL,
  email      VARCHAR(120) NOT NULL DEFAULT '',
  address    VARCHAR(200) NOT NULL,
  contact    VARCHAR(80) NOT NULL DEFAULT '',
  tax_code   VARCHAR(13) NOT NULL DEFAULT '',
  note       VARCHAR(300) NOT NULL DEFAULT '',
  status     VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL,
  CONSTRAINT ck_supplier_status CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE goods_receipts (
  id            VARCHAR(40) PRIMARY KEY,
  code          VARCHAR(24) NOT NULL UNIQUE,
  supplier_id   VARCHAR(40) NOT NULL REFERENCES suppliers(id),
  branch_id     VARCHAR(40) NOT NULL REFERENCES branches(id),
  note          VARCHAR(300) NOT NULL DEFAULT '',
  status        VARCHAR(16) NOT NULL DEFAULT 'draft',
  total_amount  BIGINT NOT NULL CHECK (total_amount >= 0),
  created_by    VARCHAR(120) NOT NULL DEFAULT '',
  created_at    TIMESTAMP NOT NULL,
  confirmed_at  TIMESTAMP,
  cancelled_at  TIMESTAMP,
  CONSTRAINT ck_receipt_status CHECK (status IN ('draft', 'confirmed', 'cancelled'))
);

CREATE TABLE goods_receipt_lines (
  id            VARCHAR(40) PRIMARY KEY,
  receipt_id    VARCHAR(40) NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  medicine_id   VARCHAR(40) NOT NULL REFERENCES medicines(id),
  qty           INTEGER NOT NULL CHECK (qty > 0),
  cost_price    BIGINT NOT NULL CHECK (cost_price >= 0),
  amount        BIGINT NOT NULL CHECK (amount >= 0),
  batch_no      VARCHAR(30) NOT NULL,
  expiry        DATE NOT NULL,
  stock_before  INTEGER,
  stock_after   INTEGER,
  UNIQUE (receipt_id, medicine_id, batch_no)
);

CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_receipts_supplier ON goods_receipts(supplier_id);
CREATE INDEX idx_receipts_branch ON goods_receipts(branch_id);
CREATE INDEX idx_receipts_status ON goods_receipts(status);
CREATE INDEX idx_receipt_lines_medicine ON goods_receipt_lines(medicine_id);
