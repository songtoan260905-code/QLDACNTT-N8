-- Sơ đồ dữ liệu đăng nhập và phân quyền PharmaCare Pro.
-- Bản chạy trên trình duyệt lưu JSON; sơ đồ này mô tả cùng một mô hình.

CREATE TABLE roles (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(80) NOT NULL UNIQUE,
  description   VARCHAR(255) NOT NULL DEFAULT '',
  builtin       BOOLEAN NOT NULL DEFAULT FALSE,
  status        VARCHAR(16) NOT NULL DEFAULT 'active'
);

CREATE TABLE permissions (
  id            VARCHAR(40) PRIMARY KEY,
  code          VARCHAR(40) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  group_name    VARCHAR(40) NOT NULL,
  builtin       BOOLEAN NOT NULL DEFAULT FALSE,
  status        VARCHAR(16) NOT NULL DEFAULT 'active'
);

CREATE TABLE role_permissions (
  role_id       VARCHAR(40) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(40) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  phone         VARCHAR(40) NOT NULL DEFAULT '',
  password_hash VARCHAR(120) NOT NULL,
  role_id       VARCHAR(40) NOT NULL REFERENCES roles(id),
  branch_id     VARCHAR(40) NOT NULL,
  title         VARCHAR(80) NOT NULL DEFAULT '',
  status        VARCHAR(16) NOT NULL DEFAULT 'active'
);

CREATE TABLE user_sessions (
  token         VARCHAR(64) PRIMARY KEY,
  user_id       VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at     TIMESTAMP NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  remember      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE access_logs (
  id            VARCHAR(40) PRIMARY KEY,
  at            TIMESTAMP NOT NULL,
  user_id       VARCHAR(40),
  email         VARCHAR(160) NOT NULL DEFAULT '',
  action        VARCHAR(40) NOT NULL,
  result        VARCHAR(16) NOT NULL,
  detail        VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_logs_at ON access_logs(at);
