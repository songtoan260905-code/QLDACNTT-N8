-- Sơ đồ chi nhánh, liên hệ và phân công nhân sự PharmaCare Pro.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.

CREATE TABLE branches (
  id          VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(160) NOT NULL UNIQUE,
  short_name  VARCHAR(80) NOT NULL,
  address     VARCHAR(255) NOT NULL,
  phone       VARCHAR(40) NOT NULL,
  hours       VARCHAR(80) NOT NULL DEFAULT '08:00 – 21:00',
  status      VARCHAR(16) NOT NULL DEFAULT 'open',
  manager     VARCHAR(120) NOT NULL DEFAULT '',
  CONSTRAINT ck_branch_status CHECK (status IN ('open', 'maintenance', 'closed'))
);

CREATE TABLE branch_contacts (
  branch_id    VARCHAR(40) PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  email        VARCHAR(160) NOT NULL DEFAULT '',
  phone        VARCHAR(40) NOT NULL,
  address      VARCHAR(255) NOT NULL
);

CREATE TABLE staff_transfers (
  id          VARCHAR(40) PRIMARY KEY,
  user_id     VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_branch VARCHAR(40) NOT NULL,
  to_branch   VARCHAR(40) NOT NULL REFERENCES branches(id),
  actor_id    VARCHAR(40) NOT NULL REFERENCES users(id),
  kind        VARCHAR(16) NOT NULL,
  at          TIMESTAMP NOT NULL,
  CONSTRAINT ck_transfer_kind CHECK (kind IN ('assign', 'transfer'))
);

CREATE INDEX idx_branches_status ON branches(status);
CREATE INDEX idx_branches_phone ON branches(phone);
CREATE INDEX idx_transfers_user ON staff_transfers(user_id);
CREATE INDEX idx_transfers_to ON staff_transfers(to_branch);
