-- Phiếu kiểm kê, chuyển kho và mốc cảnh báo tồn / hạn dùng.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.

CREATE TABLE alert_policy (
  id                VARCHAR(40) PRIMARY KEY,
  stock_alert       BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_alert      BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_warn_days  INTEGER NOT NULL DEFAULT 45,
  CONSTRAINT ck_expiry_warn_days CHECK (expiry_warn_days BETWEEN 1 AND 365)
);

CREATE TABLE stocktakes (
  id           VARCHAR(40) PRIMARY KEY,
  code         VARCHAR(24) NOT NULL UNIQUE,
  branch_id    VARCHAR(40) NOT NULL REFERENCES branches(id),
  note         VARCHAR(300) NOT NULL DEFAULT '',
  status       VARCHAR(16) NOT NULL DEFAULT 'draft',
  minute       VARCHAR(500) NOT NULL DEFAULT '',
  created_by   VARCHAR(120) NOT NULL DEFAULT '',
  created_at   TIMESTAMP NOT NULL,
  posted_at    TIMESTAMP,
  CONSTRAINT ck_stocktake_status CHECK (status IN ('draft', 'counted', 'minuted', 'posted', 'cancelled'))
);

CREATE TABLE stocktake_lines (
  id            VARCHAR(40) PRIMARY KEY,
  stocktake_id  VARCHAR(40) NOT NULL REFERENCES stocktakes(id),
  medicine_id   VARCHAR(40) NOT NULL REFERENCES medicines(id),
  system_qty    INTEGER NOT NULL CHECK (system_qty >= 0),
  actual_qty    INTEGER CHECK (actual_qty >= 0),
  variance_qty  INTEGER,
  reason_code   VARCHAR(16) NOT NULL DEFAULT '',
  stock_after   INTEGER,
  UNIQUE (stocktake_id, medicine_id),
  CONSTRAINT ck_stocktake_reason CHECK (
    reason_code IN ('', 'count', 'damage', 'expiry', 'loss', 'found', 'other')
  )
);

CREATE TABLE transfers (
  id              VARCHAR(40) PRIMARY KEY,
  code            VARCHAR(24) NOT NULL UNIQUE,
  from_branch_id  VARCHAR(40) NOT NULL REFERENCES branches(id),
  to_branch_id    VARCHAR(40) NOT NULL REFERENCES branches(id),
  note            VARCHAR(300) NOT NULL DEFAULT '',
  status          VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_by      VARCHAR(120) NOT NULL DEFAULT '',
  created_at      TIMESTAMP NOT NULL,
  confirmed_at    TIMESTAMP,
  CONSTRAINT ck_transfer_status CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  CONSTRAINT ck_transfer_branches CHECK (from_branch_id <> to_branch_id)
);

CREATE TABLE transfer_lines (
  id            VARCHAR(40) PRIMARY KEY,
  transfer_id   VARCHAR(40) NOT NULL REFERENCES transfers(id),
  medicine_id   VARCHAR(40) NOT NULL REFERENCES medicines(id),
  batch_no      VARCHAR(30) NOT NULL DEFAULT '',
  qty           INTEGER NOT NULL CHECK (qty > 0)
);

CREATE INDEX idx_stocktakes_branch ON stocktakes(branch_id);
CREATE INDEX idx_stocktakes_status ON stocktakes(status);
CREATE INDEX idx_stocktake_lines_medicine ON stocktake_lines(medicine_id);
CREATE INDEX idx_transfers_from ON transfers(from_branch_id);
CREATE INDEX idx_transfers_to ON transfers(to_branch_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_lots_expiry_qty ON medicine_lots(expiry, qty);
