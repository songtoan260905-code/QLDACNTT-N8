const http = require("http");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("./config");
const store = require("./store");

const root = path.join(__dirname, "..");
const pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  charset: "utf8mb4",
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 8,
});

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, limit) {
  const max = limit || 32768;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error("payload"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function text(value) {
  return String(value || "").trim();
}

function phone(value) {
  let raw = text(value).replace(/[\s.+()-]/g, "");
  if (/^84\d{8,10}$/.test(raw)) raw = "0" + raw.slice(2);
  return raw;
}

function mysqlTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return mysqlTime();
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

function duplicateMessage(error) {
  const message = String(error && error.sqlMessage || "");
  if (message.includes("uq_users_email")) return "Email này đã được dùng.";
  if (message.includes("uq_customers_phone")) return "Số điện thoại đã có hồ sơ.";
  if (message.includes("uq_customers_code")) return "Mã khách hàng bị trùng. Hãy thử lại.";
  if (error && error.code === "ER_NO_REFERENCED_ROW_2") return "Chi nhánh hoặc vai trò không còn trong MySQL.";
  return "Không ghi được tài khoản vào MySQL.";
}

async function nextCustomerCode(conn) {
  const [rows] = await conn.execute(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)), 0) AS n FROM customers WHERE code REGEXP '^KH[0-9]+$'"
  );
  const n = Number(rows[0] && rows[0].n) || 0;
  return "KH" + String(n + 1).padStart(4, "0");
}

async function register(payload) {
  const user = payload.user || {};
  const customer = payload.customer || {};
  const name = text(user.name || customer.name);
  const email = text(user.email || customer.email).toLowerCase();
  const mobile = phone(user.phone || customer.phone);
  const branchId = text(user.branchId || customer.branchId);
  const roleId = text(customer.roleId) || "member";
  const passwordHash = text(user.passwordHash);
  const userId = text(user.id);
  const customerId = text(customer.id || user.customerId);
  if (name.length < 2) return { status: 400, body: { message: "Họ tên cần ít nhất 2 ký tự." } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { message: "Email chưa đúng định dạng." } };
  if (!/^0\d{8,10}$/.test(mobile)) return { status: 400, body: { message: "Số điện thoại khách hàng chưa đúng." } };
  if (!/^h1\.[0-9a-f]{16}\.[0-9a-f]{64}$/.test(passwordHash)) return { status: 400, body: { message: "Mật khẩu chưa được băm đúng cách." } };
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(userId) || !/^[A-Za-z0-9_-]{2,40}$/.test(customerId)) {
    return { status: 400, body: { message: "Mã tài khoản không hợp lệ." } };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [branches] = await conn.execute(
      "SELECT id FROM branches WHERE id = ? AND status = 'open'",
      [branchId]
    );
    if (!branches.length) {
      await conn.rollback();
      return { status: 400, body: { message: "Chi nhánh không còn mở." } };
    }
    const [roles] = await conn.execute("SELECT id FROM customer_roles WHERE id = ? AND status = 'active'", [roleId]);
    const customerRole = roles.length ? roleId : "member";
    let code = text(customer.code).toUpperCase();
    if (!/^KH\d{4,}$/.test(code)) code = await nextCustomerCode(conn);
    const [used] = await conn.execute("SELECT id FROM customers WHERE code = ?", [code]);
    if (used.length) code = await nextCustomerCode(conn);
    await conn.execute(
      `INSERT INTO customers
        (id, code, name, phone, email, address, role_id, branch_id, points, total_spend, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, '', ?, ?, 0, 0, 'active', '', ?)`,
      [customerId, code, name, mobile, email, customerRole, branchId, mysqlTime(customer.createdAt)]
    );
    await conn.execute(
      `INSERT INTO users
        (id, name, email, phone, password_hash, role_id, branch_id, customer_id, title, status)
       VALUES (?, ?, ?, ?, ?, 'customer', ?, ?, 'Khách hàng', 'active')`,
      [userId, name, email, mobile, passwordHash, branchId, customerId]
    );
    await conn.commit();
    return { status: 201, body: { ok: true, id: userId, code: code } };
  } catch (error) {
    await conn.rollback();
    return { status: 409, body: { message: duplicateMessage(error) } };
  } finally {
    conn.release();
  }
}

function serveFile(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(root, "." + pathname);
  const base = path.resolve(root);
  if (file !== base && !file.startsWith(base + path.sep)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, data, types[path.extname(file).toLowerCase()] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = req.url.split("?")[0];
  if (pathname === "/api/db" && req.method === "GET") {
    try {
      const db = await store.load(pool);
      send(res, 200, JSON.stringify(db ? { source: "mysql", db } : { source: "empty" }));
    } catch (error) {
      console.error("load", error.code || "", error.sqlMessage || error.message);
      send(res, 500, JSON.stringify({ message: "Không đọc được dữ liệu từ MySQL." }));
    }
    return;
  }
  if (pathname === "/api/db" && req.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(req, 4000000) || "{}");
      await store.save(pool, payload);
      send(res, 200, JSON.stringify({ ok: true }));
    } catch (error) {
      const message = error.status === 400
        ? error.message
        : "MySQL từ chối dữ liệu: " + (error.sqlMessage || error.message || "không rõ nguyên nhân");
      console.error("sync", error.code || "", error.sqlMessage || error.message);
      send(res, error.status || 500, JSON.stringify({ message: message }));
    }
    return;
  }
  if (req.method === "POST" && pathname === "/api/register") {
    try {
      const payload = JSON.parse(await readBody(req) || "{}");
      const result = await register(payload);
      send(res, result.status, JSON.stringify(result.body));
    } catch (error) {
      send(res, 400, JSON.stringify({ message: "Dữ liệu đăng ký không đọc được." }));
    }
    return;
  }
  if (req.method === "GET") {
    serveFile(req, res);
    return;
  }
  send(res, 405, JSON.stringify({ message: "Không hỗ trợ thao tác này." }));
});

store.ensureSchema(pool).then(() => {
  server.listen(config.webPort, "127.0.0.1", () => {
    console.log("Mạch Dược đang chạy tại http://127.0.0.1:" + config.webPort);
  });
}).catch((error) => {
  console.error("MySQL", error.message);
  process.exit(1);
});
