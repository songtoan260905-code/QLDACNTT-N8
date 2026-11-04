/* Vai trò, quyền, cấp/thu hồi và phạm vi chi nhánh (task 132–144). */
(function (root) {
  const SCREENS = [
    ["tong-quan", "Tổng quan", "Màn hình"],
    ["chi-nhanh", "Chi nhánh", "Màn hình"],
    ["kho", "Kho thuốc", "Màn hình"],
    ["ton-kho", "Tồn kho", "Màn hình"],
    ["nha-cung-cap", "Nhà cung cấp", "Màn hình"],
    ["nhap-hang", "Nhập hàng", "Màn hình"],
    ["ban-hang", "Bán hàng", "Màn hình"],
    ["khach-hang", "Khách hàng", "Màn hình"],
    ["canh-bao", "Cảnh báo", "Màn hình"],
    ["bao-cao", "Báo cáo", "Màn hình"],
    ["nhan-su", "Nhân sự", "Màn hình"],
    ["thong-bao", "Thông báo", "Màn hình"],
    ["cai-dat", "Cài đặt", "Màn hình"],
  ];
  const STORE_SCREENS = [
    ["cua-hang", "Cửa hàng", "Cửa hàng"],
    ["don-cua-toi", "Đơn của tôi", "Cửa hàng"],
  ];
  const ACTIONS = [
    ["inventory.edit", "Điều chỉnh kho", "Thao tác"],
    ["supply.edit", "Nhà cung cấp và nhập hàng", "Thao tác"],
    ["sale.create", "Lập hóa đơn", "Thao tác"],
    ["customer.edit", "Hồ sơ khách hàng", "Khách hàng"],
    ["customer.assign", "Gán vai trò khách", "Khách hàng"],
    ["customer.role", "Quản lý vai trò khách", "Khách hàng"],
    ["account.create", "Tạo tài khoản", "Tài khoản"],
    ["account.lock", "Khóa và mở khóa tài khoản", "Tài khoản"],
    ["account.delete", "Xóa tài khoản", "Tài khoản"],
    ["role.manage", "Quản lý vai trò", "Phân quyền"],
    ["permission.manage", "Quản lý quyền", "Phân quyền"],
  ];

  const ALL = SCREENS.map((row) => row[0]).concat(ACTIONS.map((row) => row[0]));
  const DEFAULT_GRANTS = {
    admin: ALL.slice(),
    manager: ["tong-quan", "chi-nhanh", "kho", "ton-kho", "nha-cung-cap", "nhap-hang", "ban-hang", "khach-hang", "canh-bao", "bao-cao", "nhan-su", "thong-bao", "cai-dat", "inventory.edit", "supply.edit", "sale.create", "customer.edit", "customer.assign", "customer.role", "account.create", "account.lock", "account.delete"],
    pharmacist: ["tong-quan", "kho", "ton-kho", "nha-cung-cap", "nhap-hang", "ban-hang", "khach-hang", "canh-bao", "thong-bao", "cai-dat", "inventory.edit", "supply.edit", "sale.create", "customer.edit"],
    cashier: ["tong-quan", "ban-hang", "khach-hang", "thong-bao", "cai-dat", "sale.create", "customer.edit"],
    customer: ["cua-hang", "don-cua-toi", "cai-dat"],
  };
  const DEFAULT_ROLES = [
    { id: "admin", name: "Quản trị", description: "Toàn quyền hệ thống, mọi chi nhánh.", builtin: true, status: "active" },
    { id: "manager", name: "Quản lý", description: "Điều hành một chi nhánh, không vào phân quyền hệ thống.", builtin: true, status: "active" },
    { id: "pharmacist", name: "Dược sĩ", description: "Nhân viên kho: thuốc, cảnh báo hạn dùng, bán tại quầy.", builtin: true, status: "active" },
    { id: "cashier", name: "Thu ngân", description: "Nhân viên bán hàng: hóa đơn và thông báo, không quản trị kho.", builtin: true, status: "active" },
    { id: "customer", name: "Khách hàng", description: "Đăng nhập cửa hàng: xem thuốc, đơn đã mua và điểm thành viên.", builtin: true, status: "active" },
  ];

  function permissionRows() {
    return SCREENS.concat(STORE_SCREENS).concat(ACTIONS).map((row) => ({
      id: row[0],
      code: row[0],
      name: row[1],
      group: row[2],
      status: "active",
      builtin: true,
    }));
  }

  function ensure(db) {
    if (!Array.isArray(db.roles)) db.roles = [];
    DEFAULT_ROLES.forEach((role) => {
      if (!db.roles.some((item) => item.id === role.id)) db.roles.push(Object.assign({}, role));
    });
    if (!Array.isArray(db.permissions)) db.permissions = [];
    permissionRows().forEach((perm) => {
      if (!db.permissions.some((item) => item.code === perm.code)) db.permissions.push(Object.assign({}, perm));
    });
    if (!db.rolePermissions || typeof db.rolePermissions !== "object") db.rolePermissions = {};
    Object.keys(DEFAULT_GRANTS).forEach((roleId) => {
      if (!Array.isArray(db.rolePermissions[roleId])) db.rolePermissions[roleId] = DEFAULT_GRANTS[roleId].slice();
    });
    const adminGrants = DEFAULT_GRANTS.admin.slice();
    (db.rolePermissions.admin || []).forEach((code) => {
      if (!adminGrants.includes(code)) adminGrants.push(code);
    });
    db.rolePermissions.admin = adminGrants;
    db.permissions.forEach((perm) => {
      if (perm.builtin) perm.status = "active";
    });
    if (!db.migrations || typeof db.migrations !== "object") db.migrations = {};
    if (!db.migrations.supply212) {
      ["manager", "pharmacist"].forEach((roleId) => {
        const grants = db.rolePermissions[roleId] || [];
        ["nha-cung-cap", "nhap-hang", "supply.edit"].forEach((code) => {
          if (!grants.includes(code)) grants.push(code);
        });
        db.rolePermissions[roleId] = grants;
      });
      db.migrations.supply212 = true;
    }
    if (!db.migrations.inventory262) {
      ["manager", "pharmacist"].forEach((roleId) => {
        const grants = db.rolePermissions[roleId] || [];
        if (!grants.includes("ton-kho")) grants.push("ton-kho");
        db.rolePermissions[roleId] = grants;
      });
      db.migrations.inventory262 = true;
    }
    if (!db.migrations.customer292) {
      var customerGrants = {
        manager: ["khach-hang", "customer.edit", "customer.assign", "customer.role"],
        pharmacist: ["khach-hang", "customer.edit"],
        cashier: ["khach-hang", "customer.edit"],
      };
      Object.keys(customerGrants).forEach(function (roleId) {
        var grants = db.rolePermissions[roleId] || [];
        customerGrants[roleId].forEach(function (code) {
          if (!grants.includes(code)) grants.push(code);
        });
        db.rolePermissions[roleId] = grants;
      });
      db.migrations.customer292 = true;
    }
    if (!Array.isArray(db.accessLogs)) db.accessLogs = [];
    if (!Array.isArray(db.auditReports)) db.auditReports = [];
  }

  function roleById(db, id) {
    return (db.roles || []).find((role) => role.id === id) || null;
  }

  function permByCode(db, code) {
    return (db.permissions || []).find((perm) => perm.code === code) || null;
  }

  function can(db, user, code) {
    if (!user || user.status !== "active") return false;
    if (user.preview) return ["chi-nhanh", "nhan-su", "ton-kho", "ban-hang", "khach-hang"].includes(code);
    const perm = permByCode(db, code);
    if (!perm || perm.status !== "active") return false;
    const role = roleById(db, user.role);
    if (role && role.status === "inactive") return false;
    const grants = (db.rolePermissions || {})[user.role] || [];
    return grants.includes(code);
  }

  function seesBranch(user, branchId, selected) {
    if (!user) return false;
    if (user.role === "admin" || user.preview) return !selected || selected === "all" || selected === branchId;
    return branchId === user.branchId;
  }

  function uniqueName(db, name, exceptId) {
    const key = name.trim().toLowerCase();
    return db.roles.some((role) => role.id !== exceptId && role.name.trim().toLowerCase() === key);
  }

  function createRole(db, data) {
    const name = String(data.name || "").trim();
    if (name.length < 2) return { ok: false, message: "Tên vai trò cần ít nhất 2 ký tự." };
    if (uniqueName(db, name)) return { ok: false, message: "Tên vai trò đã tồn tại." };
    const id = "role-" + Date.now();
    db.roles.push({
      id,
      name,
      description: String(data.description || "").trim(),
      builtin: false,
      status: "active",
    });
    db.rolePermissions[id] = ["cai-dat"];
    return { ok: true, message: "Đã lưu vai trò. Hãy cấp quyền cho vai trò này.", id };
  }

  function updateRole(db, id, data) {
    const role = roleById(db, id);
    if (!role) return { ok: false, message: "Không tìm thấy vai trò." };
    const name = String(data.name || "").trim();
    if (name.length < 2) return { ok: false, message: "Tên vai trò cần ít nhất 2 ký tự." };
    if (uniqueName(db, name, id)) return { ok: false, message: "Tên vai trò đã tồn tại." };
    role.name = name;
    role.description = String(data.description || "").trim();
    return { ok: true, message: "Đã lưu thay đổi vai trò." };
  }

  function deleteRole(db, id) {
    const role = roleById(db, id);
    if (!role) return { ok: false, message: "Không tìm thấy vai trò." };
    if (role.builtin) return { ok: false, message: "Không xóa vai trò hệ thống." };
    const used = (db.users || []).filter((user) => user.role === id);
    if (used.length) return { ok: false, message: "Còn " + used.length + " tài khoản đang dùng vai trò này." };
    db.roles = db.roles.filter((item) => item.id !== id);
    delete db.rolePermissions[id];
    return { ok: true, message: "Đã xóa vai trò." };
  }

  function savePermission(db, data) {
    const name = String(data.name || "").trim();
    const code = String(data.code || "").trim().toLowerCase();
    const group = String(data.group || "Khác").trim() || "Khác";
    if (name.length < 2) return { ok: false, message: "Tên quyền cần ít nhất 2 ký tự." };
    if (!/^[a-z][a-z0-9._-]{1,40}$/.test(code)) return { ok: false, message: "Mã quyền viết thường, bắt đầu bằng chữ." };
    const existing = data.id ? (db.permissions || []).find((perm) => perm.id === data.id) : null;
    if (existing) {
      if (db.permissions.some((perm) => perm.id !== existing.id && perm.code === code)) {
        return { ok: false, message: "Mã quyền đã tồn tại." };
      }
      const previous = existing.code;
      existing.name = name;
      existing.group = group;
      if (!existing.builtin) existing.code = code;
      if (previous !== existing.code) {
        Object.keys(db.rolePermissions).forEach((roleId) => {
          db.rolePermissions[roleId] = db.rolePermissions[roleId].map((item) => (item === previous ? existing.code : item));
        });
      }
      return { ok: true, message: "Đã cập nhật quyền." };
    }
    if (db.permissions.some((perm) => perm.code === code)) return { ok: false, message: "Mã quyền đã tồn tại." };
    db.permissions.push({ id: "perm-" + Date.now(), code, name, group, status: "active", builtin: false });
    return { ok: true, message: "Đã thêm quyền." };
  }

  function setPermissionStatus(db, id) {
    const perm = (db.permissions || []).find((item) => item.id === id);
    if (!perm) return { ok: false, message: "Không tìm thấy quyền." };
    perm.status = perm.status === "active" ? "inactive" : "active";
    return { ok: true, message: perm.status === "active" ? "Đã bật quyền." : "Đã tắt quyền.", status: perm.status };
  }

  function deletePermission(db, id) {
    const perm = (db.permissions || []).find((item) => item.id === id);
    if (!perm) return { ok: false, message: "Không tìm thấy quyền." };
    if (perm.builtin) return { ok: false, message: "Quyền hệ thống chỉ tắt, không xóa." };
    db.permissions = db.permissions.filter((item) => item.id !== id);
    Object.keys(db.rolePermissions).forEach((roleId) => {
      db.rolePermissions[roleId] = db.rolePermissions[roleId].filter((code) => code !== perm.code);
    });
    return { ok: true, message: "Đã xóa quyền." };
  }

  function setGrants(db, roleId, codes) {
    const role = roleById(db, roleId);
    if (!role) return { ok: false, message: "Không tìm thấy vai trò." };
    const allowed = new Set((db.permissions || []).filter((perm) => perm.status === "active").map((perm) => perm.code));
    const next = [];
    (codes || []).forEach((code) => {
      if (allowed.has(code) && !next.includes(code)) next.push(code);
    });
    db.rolePermissions[roleId] = next;
    return { ok: true, message: "Đã lưu phân quyền." };
  }

  function revoke(db, roleId, code) {
    const grants = db.rolePermissions[roleId];
    if (!grants || !grants.includes(code)) return { ok: false, message: "Quyền này chưa được cấp." };
    db.rolePermissions[roleId] = grants.filter((item) => item !== code);
    return { ok: true, message: "Đã thu hồi quyền." };
  }

  function assignRole(db, userId, roleId) {
    const user = (db.users || []).find((item) => item.id === userId);
    const role = roleById(db, roleId);
    if (!user || !role) return { ok: false, message: "Không tìm thấy người dùng hoặc vai trò." };
    if (role.status === "inactive") return { ok: false, message: "Vai trò đang tắt." };
    if ((user.id === "u1" || user.email === "admin@pharmacare.vn") && roleId !== "admin") {
      return { ok: false, message: "Không đổi vai trò tài khoản quản trị gốc." };
    }
    user.role = roleId;
    user.title = role.name;
    if (roleId === "admin") user.branchId = "all";
    return { ok: true, message: "Đã gán vai trò cho người dùng." };
  }

  function log(db, user, action, result, detail) {
    if (!Array.isArray(db.accessLogs)) db.accessLogs = [];
    db.accessLogs.unshift({
      id: "log" + Date.now() + Math.floor(Math.random() * 1000),
      at: new Date().toISOString(),
      userId: user ? user.id : "",
      email: user ? user.email : "",
      action,
      result,
      detail,
    });
    db.accessLogs = db.accessLogs.slice(0, 200);
  }

  root.PharmaRbac = {
    SCREENS,
    ACTIONS,
    ALL,
    DEFAULT_GRANTS,
    ensure,
    can,
    seesBranch,
    createRole,
    updateRole,
    deleteRole,
    savePermission,
    setPermissionStatus,
    deletePermission,
    setGrants,
    revoke,
    assignRole,
    log,
  };
})(typeof window !== "undefined" ? window : globalThis);
