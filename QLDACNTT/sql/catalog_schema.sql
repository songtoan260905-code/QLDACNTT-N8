-- Sơ đồ thuốc, danh mục, nhà sản xuất, đơn vị và lô.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.

CREATE TABLE drug_categories (
  id   VARCHAR(40) PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE manufacturers (
  id      VARCHAR(40) PRIMARY KEY,
  name    VARCHAR(120) NOT NULL UNIQUE,
  phone   VARCHAR(40) NOT NULL DEFAULT '',
  country VARCHAR(80) NOT NULL DEFAULT '',
  status  VARCHAR(16) NOT NULL DEFAULT 'active',
  CONSTRAINT ck_maker_status CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE measure_units (
  id      VARCHAR(40) PRIMARY KEY,
  name    VARCHAR(40) NOT NULL UNIQUE,
  builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dosage_forms (
  id      VARCHAR(40) PRIMARY KEY,
  name    VARCHAR(40) NOT NULL UNIQUE,
  builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE medicines (
  id                VARCHAR(40) PRIMARY KEY,
  branch_id         VARCHAR(40) NOT NULL REFERENCES branches(id),
  code              VARCHAR(20) NOT NULL UNIQUE,
  name              VARCHAR(160) NOT NULL,
  category_id       VARCHAR(40) NOT NULL REFERENCES drug_categories(id),
  manufacturer_id   VARCHAR(40) NOT NULL REFERENCES manufacturers(id),
  unit_id           VARCHAR(40) NOT NULL REFERENCES measure_units(id),
  dosage_form_id    VARCHAR(40) NOT NULL REFERENCES dosage_forms(id),
  active_ingredient VARCHAR(160) NOT NULL,
  strength          VARCHAR(40) NOT NULL,
  cost_price        BIGINT NOT NULL CHECK (cost_price >= 0),
  sale_price        BIGINT NOT NULL CHECK (sale_price >= cost_price),
  stock             INTEGER NOT NULL CHECK (stock >= 0),
  min_stock         INTEGER NOT NULL CHECK (min_stock >= 0),
  status            VARCHAR(16) NOT NULL DEFAULT 'active',
  CONSTRAINT ck_med_status CHECK (status IN ('active', 'discontinued'))
);

CREATE TABLE medicine_lots (
  id          VARCHAR(40) PRIMARY KEY,
  medicine_id VARCHAR(40) NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_no    VARCHAR(30) NOT NULL,
  expiry      DATE NOT NULL,
  qty         INTEGER NOT NULL CHECK (qty >= 0),
  UNIQUE (medicine_id, batch_no)
);

CREATE INDEX idx_medicines_category ON medicines(category_id);
CREATE INDEX idx_medicines_maker ON medicines(manufacturer_id);
CREATE INDEX idx_medicines_status ON medicines(status);
CREATE INDEX idx_medicines_branch ON medicines(branch_id);
CREATE INDEX idx_lots_expiry ON medicine_lots(expiry);
CREATE INDEX idx_categories_name ON drug_categories(name);
CREATE INDEX idx_makers_status ON manufacturers(status);
