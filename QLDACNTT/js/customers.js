/* Khách hàng và vai trò: khách lẻ, thành viên, thân thiết, khách sỉ (task 292–306). */
(function (root) {
  var PAGE_SIZE = 6;
  var DEFAULT_ROLES = [
    { id: "retail", name: "Khách lẻ", description: "Mua tại quầy, không tích điểm và không giảm theo vai trò.", pointRate: 0, discountPercent: 0, minSpend: 0, builtin: true, status: "active" },
    { id: "member", name: "Thành viên", description: "Có hồ sơ và số điện thoại, tích 1 điểm cho mỗi 10.000đ.", pointRate: 1, discountPercent: 0, minSpend: 0, builtin: true, status: "active" },
    { id: "loyal", name: "Thân thiết", description: "Khách chi từ 500.000đ, giảm 5% và tích điểm cao hơn.", pointRate: 2, discountPercent: 5, minSpend: 500000, builtin: true, status: "active" },
    { id: "wholesale", name: "Khách sỉ", description: "Mua số lượng cho quầy thuốc, giảm 8% theo vai trò.", pointRate: 1, discountPercent: 8, minSpend: 0, builtin: true, status: "active" },
  ];

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function digits(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && Math.floor(value) === value) {
      return String(value);
    }
    return text(value);
  }

  function intField(value, min, max, emptyAs) {
    if (text(value) === "" && emptyAs != null) return emptyAs;
    var raw = digits(value);
    if (!/^\d+$/.test(raw)) return null;
    var number = Number(raw);
    if (number < min || number > max) return null;
    return number;
  }

  function dateOk(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function normalizePhone(value) {
    var raw = text(value).replace(/[\s.+()-]/g, "");
    if (/^84\d{8,10}$/.test(raw)) raw = "0" + raw.slice(2);
    return raw;
  }

  function phoneOk(value) {
    return /^0\d{8,10}$/.test(normalizePhone(value));
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  }

  function keywordHit(blob, q) {
    var parts = text(q).toLowerCase().split(/\s+/).filter(Boolean);
    if (!parts.length) return true;
    var hay = String(blob || "").toLowerCase();
    return parts.every(function (part) { return hay.indexOf(part) >= 0; });
  }

  function roleById(db, id) {
    return (db.customerRoles || []).find(function (role) { return role.id === id; }) || null;
  }

  function byId(db, id) {
    return (db.customers || []).find(function (item) { return item.id === id; }) || null;
  }

  function findByPhone(db, phone) {
    var key = normalizePhone(phone);
    if (!key) return null;
    return (db.customers || []).find(function (item) { return normalizePhone(item.phone) === key; }) || null;
  }

  function nextCode(customers) {
    var max = 0;
    (customers || []).forEach(function (item) {
      var match = text(item.code).toUpperCase().match(/^KH(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    });
    return "KH" + String(max + 1).padStart(4, "0");
  }

  function sameRoleName(list, name, id) {
    return (list || []).some(function (item) {
      return item.id !== id && lower(item.name) === lower(name);
    });
  }

  function defaultRoleId(db) {
    var member = roleById(db, "member");
    if (member && member.status === "active") return member.id;
    var active = (db.customerRoles || []).find(function (role) { return role.status === "active"; });
    return active ? active.id : "";
  }

  function sampleCustomers() {
    return [
      {
        id: "kh-nam", code: "KH0001", name: "Nguyễn Văn Nam", phone: "0988123456",
        email: "nam.nguyen@gmail.com", address: "15 Lê Lợi, Quận 1, TP.HCM", birthday: "",
        roleId: "member", points: 0, totalSpend: 4950, status: "active", branchId: "br-q1",
        note: "Mua thuốc cảm tại quầy", createdAt: new Date().toISOString(),
      },
      {
        id: "kh-hoa", code: "KH0002", name: "Lê Thị Hoa", phone: "0909888777",
        email: "hoa.le@gmail.com", address: "88 Võ Văn Tần, Quận 3, TP.HCM", birthday: "",
        roleId: "wholesale", points: 40, totalSpend: 860000, status: "active", branchId: "br-q1",
        note: "Nhà thuốc tư nhân lấy sỉ", createdAt: new Date().toISOString(),
      },
      {
        id: "kh-bao", code: "KH0003", name: "Trần Quốc Bảo", phone: "0912345678",
        email: "bao.tran@gmail.com", address: "4 Kha Vạn Cân, Thủ Đức", birthday: "",
        roleId: "loyal", points: 80, totalSpend: 620000, status: "active", branchId: "br-td",
        note: "", createdAt: new Date().toISOString(),
      },
      {
        id: "kh-lan", code: "KH0004", name: "Phạm Thị Lan", phone: "0933555666",
        email: "", address: "", birthday: "",
        roleId: "retail", points: 0, totalSpend: 0, status: "inactive", branchId: "br-q1",
        note: "Ngừng chăm sóc", createdAt: new Date().toISOString(),
      },
    ];
  }

  function linkSales(db) {
    (db.sales || []).forEach(function (sale) {
      if (sale.customerId) return;
      var customer = findByPhone(db, sale.customerPhone);
      if (!customer) return;
      sale.customerId = customer.id;
      sale.customerRoleId = customer.roleId;
      if (sale.pointsEarned == null) sale.pointsEarned = 0;
    });
  }

  function ensure(db) {
    if (!Array.isArray(db.customerRoles)) db.customerRoles = [];
    DEFAULT_ROLES.forEach(function (role) {
      if (!db.customerRoles.some(function (item) { return item.id === role.id; })) {
        db.customerRoles.push(Object.assign({}, role));
      }
    });
    if (!Array.isArray(db.customers)) db.customers = [];
    if (!db.migrations || typeof db.migrations !== "object") db.migrations = {};
    if (!db.migrations.customerSamples) {
      var demo = (db.branches || []).some(function (branch) { return branch.id === "br-q1"; });
      if (!db.customers.length && demo) sampleCustomers().forEach(function (row) { db.customers.push(row); });
      db.migrations.customerSamples = true;
    }
    linkSales(db);
    if (!Array.isArray(db.users)) db.users = [];
    if (!db.migrations.customerAccounts) {
      var shop = (db.branches || []).some(function (branch) { return branch.id === "br-q1"; });
      if (shop) seedAccounts(db);
      db.migrations.customerAccounts = true;
    }
    attachBranches(db);
  }

  function emailOf(value) {
    return text(value).toLowerCase();
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  }

  function userByEmail(db, email) {
    var key = emailOf(email);
    return (db.users || []).find(function (user) { return emailOf(user.email) === key; }) || null;
  }

  function accountOf(db, customer) {
    if (!customer) return null;
    return (db.users || []).find(function (user) {
      return user.customerId === customer.id || user.id === customer.accountUserId;
    }) || null;
  }

  function hashPassword(plain) {
    if (!root.PharmaPassword) return { ok: false, message: "Chưa kiểm tra được mật khẩu." };
    var policy = root.PharmaPassword.check(plain);
    if (!policy.ok) return policy;
    return { ok: true, password: root.PharmaPassword.hash(plain) };
  }

  function seedAccounts(db) {
    var rows = [
      { id: "u-nam", customerId: "kh-nam", name: "Nguyễn Văn Nam", email: "nam.nguyen@gmail.com", phone: "0988123456", branchId: "br-q1" },
      { id: "u-hoa", customerId: "kh-hoa", name: "Lê Thị Hoa", email: "hoa.le@gmail.com", phone: "0909888777", branchId: "br-q1" },
      { id: "u-bao", customerId: "kh-bao", name: "Trần Quốc Bảo", email: "bao.tran@gmail.com", phone: "0912345678", branchId: "br-td" },
    ];
    rows.forEach(function (row) {
      var customer = byId(db, row.customerId);
      if (!customer || customer.status !== "active") return;
      if (!customer.email) customer.email = row.email;
      if (!customer.branchId) customer.branchId = row.branchId;
      var existing = userByEmail(db, row.email);
      if (existing && existing.role !== "customer") return;
      if (!existing) {
        existing = {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          password: "Khach123",
          role: "customer",
          branchId: row.branchId,
          title: "Khách hàng",
          status: "active",
          customerId: customer.id,
        };
        db.users.push(existing);
      } else if (!existing.customerId) {
        existing.customerId = customer.id;
        existing.role = "customer";
      }
      customer.accountUserId = existing.id;
    });
  }

  function openBranch(db, branchId) {
    var branch = (db.branches || []).find(function (item) { return item.id === branchId; });
    if (!branch) return { ok: false, message: "Chi nhánh không hợp lệ." };
    if (branch.status !== "open") return { ok: false, message: "Chi nhánh chưa mở cửa, chưa đăng ký được." };
    return { ok: true, branch: branch };
  }

  function registerAccount(db, data) {
    ensure(db);
    var name = text(data.name);
    var email = text(data.email);
    var phone = normalizePhone(data.phone);
    var branchId = text(data.branchId);
    if (name.length < 2) return { ok: false, message: "Họ tên cần ít nhất 2 ký tự." };
    if (name.length > 80) return { ok: false, message: "Họ tên quá dài." };
    if (!emailOk(email)) return { ok: false, message: "Email chưa đúng định dạng." };
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại khách hàng chưa đúng." };
    if (userByEmail(db, email)) return { ok: false, message: "Email này đã được dùng." };
    if (findByPhone(db, phone)) return { ok: false, message: "Số điện thoại đã có hồ sơ. Hãy đăng nhập hoặc nhờ quầy mở tài khoản." };
    var place = openBranch(db, branchId);
    if (!place.ok) return place;
    var secret = hashPassword(data.password);
    if (!secret.ok) return secret;
    var roleId = defaultRoleId(db);
    if (!roleId) return { ok: false, message: "Chưa có vai trò khách hàng đang bật." };
    var customer = {
      id: "kh" + Date.now(),
      code: nextCode(db.customers),
      name: name,
      phone: phone,
      email: email,
      address: "",
      birthday: "",
      note: "",
      status: "active",
      roleId: roleId,
      points: 0,
      totalSpend: 0,
      branchId: place.branch.id,
      createdAt: new Date().toISOString(),
    };
    var user = {
      id: "u" + Date.now(),
      name: name,
      email: email,
      phone: phone,
      password: secret.password,
      role: "customer",
      branchId: place.branch.id,
      title: "Khách hàng",
      status: "active",
      customerId: customer.id,
    };
    customer.accountUserId = user.id;
    db.customers.push(customer);
    db.users.push(user);
    return { ok: true, message: "Đã tạo tài khoản. Bạn có thể vào cửa hàng.", user: user, customer: customer };
  }

  function openAccount(db, data) {
    ensure(db);
    var customer = byId(db, data.customerId || data.id);
    if (!customer) return { ok: false, message: "Không tìm thấy khách hàng." };
    if (data.actor) {
      var gate = canEditCustomer(db, data.actor, customer);
      if (!gate.ok) return gate;
      if (data.actor.role !== "admin") data.branchId = data.actor.branchId;
    }
    if (customer.status !== "active") return { ok: false, message: "Khách đang ngừng chăm sóc, không tạo tài khoản." };
    if (accountOf(db, customer)) return { ok: false, message: "Khách đã có tài khoản đăng nhập." };
    var email = text(data.email || customer.email);
    if (!emailOk(email)) return { ok: false, message: "Email chưa đúng định dạng." };
    if (userByEmail(db, email)) return { ok: false, message: "Email này đã được dùng." };
    var secret = hashPassword(data.password);
    if (!secret.ok) return secret;
    var branchId = text(data.branchId) || homeBranch(db, customer);
    var place = branchId ? openBranch(db, branchId) : { ok: true, branch: (db.branches || []).find(function (item) { return item.status === "open"; }) };
    if (!place.ok) return place;
    if (!place.branch) return { ok: false, message: "Chưa có chi nhánh đang mở để gắn tài khoản." };
    var user = {
      id: "u" + Date.now(),
      name: customer.name,
      email: email,
      phone: customer.phone,
      password: secret.password,
      role: "customer",
      branchId: place.branch.id,
      title: "Khách hàng",
      status: "active",
      customerId: customer.id,
    };
    customer.email = email;
    customer.branchId = place.branch.id;
    customer.accountUserId = user.id;
    db.users.push(user);
    return { ok: true, message: "Đã mở tài khoản đăng nhập cho khách.", user: user, customer: customer };
  }

  function mirrorAccount(db, customer) {
    var user = accountOf(db, customer);
    if (!user) return;
    user.name = customer.name;
    user.phone = customer.phone;
    user.customerId = customer.id;
    if (text(customer.branchId) && customer.branchId !== "all") user.branchId = customer.branchId;
    if (customer.email && emailOk(customer.email)) {
      var taken = userByEmail(db, customer.email);
      if (!taken || taken.id === user.id) user.email = customer.email;
    }
  }

  function applyAccountProfile(db, user) {
    if (!user || user.role !== "customer") return { ok: true };
    var customer = byId(db, user.customerId) || (db.customers || []).find(function (item) { return item.accountUserId === user.id; });
    if (!customer) return { ok: false, message: "Không tìm thấy hồ sơ khách của tài khoản này." };
    var phone = normalizePhone(user.phone);
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại khách hàng chưa đúng." };
    var dup = (db.customers || []).some(function (item) {
      return item.id !== customer.id && normalizePhone(item.phone) === phone;
    });
    if (dup) return { ok: false, message: "Số điện thoại đã có trong hồ sơ khách." };
    customer.name = user.name;
    customer.phone = phone;
    customer.email = text(user.email);
    customer.accountUserId = user.id;
    user.phone = phone;
    user.customerId = customer.id;
    return { ok: true, customer: customer };
  }

  function loginBlock(db, user) {
    if (!user || user.role !== "customer") return null;
    var customer = byId(db, user.customerId);
    if (!customer || customer.status !== "active") return "Hồ sơ khách đang ngừng. Liên hệ nhà thuốc.";
    return null;
  }

  function benefitText(role) {
    if (!role) return "";
    var rate = Number(role.pointRate) || 0;
    var discount = Number(role.discountPercent) || 0;
    var parts = [
      rate ? "Mỗi 10.000đ tích " + rate + " điểm" : "Không tích điểm",
      discount ? "Giảm " + discount + "% theo vai trò" : "Không giảm giá theo vai trò",
    ];
    if (Number(role.minSpend) > 0) parts.push("Xét khi tổng chi từ " + role.minSpend + "đ");
    return parts.join(". ") + ".";
  }

  function validateRole(data, roles) {
    var id = text(data.id);
    var name = text(data.name);
    var description = text(data.description);
    var pointRate = intField(data.pointRate, 0, 20, null);
    var discountPercent = intField(data.discountPercent, 0, 30, null);
    var minSpend = intField(data.minSpend, 0, 999999999999, 0);
    var status = data.status === "inactive" ? "inactive" : "active";
    if (name.length < 2) return { ok: false, message: "Tên vai trò cần ít nhất 2 ký tự." };
    if (name.length > 80) return { ok: false, message: "Tên vai trò quá dài." };
    if (sameRoleName(roles, name, id)) return { ok: false, message: "Tên vai trò đã tồn tại." };
    if (description.length > 200) return { ok: false, message: "Mô tả vai trò quá dài." };
    if (pointRate == null) return { ok: false, message: "Mức tích điểm phải là số nguyên từ 0 đến 20." };
    if (discountPercent == null) return { ok: false, message: "Mức giảm phải là số nguyên từ 0 đến 30." };
    if (minSpend == null) return { ok: false, message: "Mức chi để xét vai trò phải là số nguyên không âm." };
    return {
      ok: true,
      value: {
        name: name,
        description: description,
        pointRate: pointRate,
        discountPercent: discountPercent,
        minSpend: minSpend,
        status: status,
      },
    };
  }

  function saveRole(db, data) {
    ensure(db);
    var existing = text(data.id) ? roleById(db, data.id) : null;
    if (text(data.id) && !existing) return { ok: false, message: "Không tìm thấy vai trò khách hàng." };
    var check = validateRole(data, db.customerRoles);
    if (!check.ok) return check;
    if (existing) {
      Object.assign(existing, check.value);
      return { ok: true, message: "Đã lưu vai trò khách hàng.", role: existing };
    }
    var row = Object.assign({ id: "crole" + Date.now(), builtin: false }, check.value);
    db.customerRoles.push(row);
    return { ok: true, message: "Đã thêm vai trò khách hàng.", role: row };
  }

  function setRoleStatus(db, id, status) {
    ensure(db);
    var role = roleById(db, id);
    if (!role) return { ok: false, message: "Không tìm thấy vai trò khách hàng." };
    if (status !== "active" && status !== "inactive") return { ok: false, message: "Trạng thái không hợp lệ." };
    role.status = status;
    return { ok: true, message: status === "active" ? "Đã bật vai trò." : "Đã tắt vai trò.", role: role };
  }

  function customerCount(db, roleId) {
    return (db.customers || []).filter(function (item) { return item.roleId === roleId; }).length;
  }

  function deleteRole(db, id) {
    ensure(db);
    var role = roleById(db, id);
    if (!role) return { ok: false, message: "Không tìm thấy vai trò khách hàng." };
    if (role.builtin) return { ok: false, message: "Không xóa vai trò khách hàng mặc định." };
    var used = customerCount(db, id);
    if (used) return { ok: false, message: "Còn " + used + " khách đang dùng vai trò này." };
    db.customerRoles = db.customerRoles.filter(function (item) { return item.id !== id; });
    return { ok: true, message: "Đã xóa vai trò khách hàng." };
  }

  function validateCustomer(data, customers, db, opts) {
    opts = opts || {};
    var id = text(data.id);
    var existing = id ? (customers || []).find(function (item) { return item.id === id; }) : null;
    var name = text(data.name);
    var phone = normalizePhone(data.phone);
    var email = text(data.email);
    var address = text(data.address);
    var birthday = text(data.birthday);
    var note = text(data.note);
    var status = data.status === "inactive" ? "inactive" : "active";
    var roleId = text(data.roleId);
    if (!opts.canAssign) roleId = existing ? existing.roleId : defaultRoleId(db);
    if (name.length < 2) return { ok: false, message: "Tên khách hàng cần ít nhất 2 ký tự." };
    if (name.length > 80) return { ok: false, message: "Tên khách hàng quá dài." };
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại khách hàng chưa đúng." };
    var dup = (customers || []).some(function (item) {
      return item.id !== id && normalizePhone(item.phone) === phone;
    });
    if (dup) return { ok: false, message: "Số điện thoại đã có trong hồ sơ khách." };
    if (email && !emailOk(email)) return { ok: false, message: "Email chưa hợp lệ." };
    if (address && address.length < 5) return { ok: false, message: "Địa chỉ cần ít nhất 5 ký tự." };
    if (address.length > 200) return { ok: false, message: "Địa chỉ quá dài." };
    if (birthday) {
      if (!dateOk(birthday)) return { ok: false, message: "Ngày sinh chưa đúng." };
      if (opts.today && birthday > opts.today) return { ok: false, message: "Ngày sinh không được ở tương lai." };
    }
    if (note.length > 300) return { ok: false, message: "Ghi chú quá dài." };
    var role = roleById(db, roleId);
    if (!role) return { ok: false, message: "Chưa có vai trò khách hàng đang bật." };
    if (role.status !== "active" && (!existing || existing.roleId !== role.id)) {
      return { ok: false, message: "Vai trò đang tắt, không gán được." };
    }
    return {
      ok: true,
      value: {
        name: name,
        phone: phone,
        email: email,
        address: address,
        birthday: birthday,
        note: note,
        status: status,
        roleId: role.id,
      },
    };
  }

  function branchRecord(db, branchId) {
    return (db.branches || []).find(function (item) { return item.id === branchId; }) || null;
  }

  function homeBranch(db, customer) {
    if (!customer) return "";
    var own = text(customer.branchId);
    if (own && own !== "all") return own;
    var account = accountOf(db, customer);
    if (account && text(account.branchId) && account.branchId !== "all") return account.branchId;
    return "";
  }

  function attachBranches(db) {
    var known = { "kh-nam": "br-q1", "kh-hoa": "br-q1", "kh-bao": "br-td", "kh-lan": "br-q1" };
    (db.customers || []).forEach(function (customer) {
      if (text(customer.branchId)) return;
      var account = accountOf(db, customer);
      if (account && text(account.branchId) && account.branchId !== "all") {
        customer.branchId = account.branchId;
        return;
      }
      if (known[customer.id] && branchRecord(db, known[customer.id])) customer.branchId = known[customer.id];
    });
  }

  function visibleTo(db, viewer, customer) {
    if (!viewer) return true;
    if (viewer.role === "admin" || viewer.preview) return true;
    return !!viewer.branchId && viewer.branchId !== "all" && homeBranch(db, customer) === viewer.branchId;
  }

  function canEditCustomer(db, actor, customer) {
    if (!customer) return { ok: false, message: "Không tìm thấy khách hàng." };
    if (!actor || actor.role === "admin") return { ok: true };
    if (homeBranch(db, customer) !== actor.branchId) {
      return { ok: false, message: "Khách hàng không thuộc chi nhánh của bạn." };
    }
    return { ok: true };
  }

  function governCustomer(db, actor, customer) {
    if (!customer) return { ok: false, message: "Không tìm thấy khách hàng." };
    if (!actor || (actor.role !== "admin" && actor.role !== "manager")) {
      return { ok: false, message: "Không có quyền khóa hoặc xóa tài khoản khách." };
    }
    if (actor.role === "manager" && homeBranch(db, customer) !== actor.branchId) {
      return { ok: false, message: "Khách hàng không thuộc chi nhánh của bạn." };
    }
    return { ok: true };
  }

  function placeBranch(db, data, existing, opts) {
    var actor = opts && opts.actor;
    if (actor && actor.role !== "admin") {
      if (existing) {
        var gate = canEditCustomer(db, actor, existing);
        if (!gate.ok) return gate;
      }
      if (!actor.branchId || actor.branchId === "all") return { ok: false, message: "Tài khoản chưa gắn chi nhánh." };
      return { ok: true, branchId: actor.branchId };
    }
    if (actor && actor.role === "admin") {
      var branchId = text(data.branchId) || (existing ? homeBranch(db, existing) : "");
      if (!branchRecord(db, branchId)) return { ok: false, message: "Chọn chi nhánh của khách hàng." };
      return { ok: true, branchId: branchId };
    }
    return { ok: true, branchId: text(data.branchId) || (existing ? text(existing.branchId) : "") };
  }

  function save(db, data, opts) {
    ensure(db);
    opts = opts || {};
    var existing = text(data.id) ? byId(db, data.id) : null;
    if (text(data.id) && !existing) return { ok: false, message: "Không tìm thấy khách hàng." };
    if (existing && opts.actor) {
      var gate = canEditCustomer(db, opts.actor, existing);
      if (!gate.ok) return gate;
    }
    var check = validateCustomer(data, db.customers, db, opts);
    if (!check.ok) return check;
    var placed = placeBranch(db, data, existing, opts);
    if (!placed.ok) return placed;
    if (placed.branchId) check.value.branchId = placed.branchId;
    if (existing) {
      Object.assign(existing, check.value);
      mirrorAccount(db, existing);
      return { ok: true, message: "Đã lưu hồ sơ khách hàng.", customer: existing };
    }
    var row = Object.assign({
      id: "kh" + Date.now(),
      code: nextCode(db.customers),
      points: 0,
      totalSpend: 0,
      createdAt: new Date().toISOString(),
    }, check.value);
    db.customers.push(row);
    return { ok: true, message: "Đã lưu khách hàng.", customer: row };
  }

  function setStatus(db, id, status, actor) {
    var customer = byId(db, id);
    if (!customer) return { ok: false, message: "Không tìm thấy khách hàng." };
    if (actor) {
      var gate = canEditCustomer(db, actor, customer);
      if (!gate.ok) return gate;
    }
    if (status !== "active" && status !== "inactive") return { ok: false, message: "Trạng thái không hợp lệ." };
    customer.status = status;
    return {
      ok: true,
      message: status === "active" ? "Đã mở lại hồ sơ khách." : "Đã ngừng chăm sóc khách này.",
      customer: customer,
    };
  }

  function saleCount(db, customer) {
    if (!customer) return 0;
    var phone = normalizePhone(customer.phone);
    return (db.sales || []).filter(function (sale) {
      return sale.customerId === customer.id || (phone && normalizePhone(sale.customerPhone) === phone);
    }).length;
  }

  function remove(db, id, actor) {
    ensure(db);
    var customer = byId(db, id);
    if (!customer) return { ok: false, message: "Không tìm thấy khách hàng." };
    if (actor) {
      var gate = canEditCustomer(db, actor, customer);
      if (!gate.ok) return gate;
    }
    var count = saleCount(db, customer);
    if (count) return { ok: false, message: "Khách đang có " + count + " hóa đơn, không xóa được." };
    var account = accountOf(db, customer);
    if (account) db.users = (db.users || []).filter(function (user) { return user.id !== account.id; });
    db.customers = db.customers.filter(function (item) { return item.id !== id; });
    return { ok: true, message: "Đã xóa khách hàng." };
  }

  function lockAccount(db, actor, customerId) {
    ensure(db);
    var customer = byId(db, customerId);
    var gate = governCustomer(db, actor, customer);
    if (!gate.ok) return gate;
    var account = accountOf(db, customer);
    if (!account || account.role !== "customer") return { ok: false, message: "Khách chưa có tài khoản đăng nhập." };
    var locking = account.status === "active";
    if (root.PharmaAccounts && root.PharmaAccounts.setLock) return root.PharmaAccounts.setLock(account, locking);
    account.status = locking ? "inactive" : "active";
    return { ok: true, message: locking ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.", status: account.status };
  }

  function removeAccount(db, actor, customerId) {
    ensure(db);
    var customer = byId(db, customerId);
    var gate = governCustomer(db, actor, customer);
    if (!gate.ok) return gate;
    var account = accountOf(db, customer);
    if (!account || account.role !== "customer") return { ok: false, message: "Khách chưa có tài khoản đăng nhập." };
    db.users = (db.users || []).filter(function (user) { return user.id !== account.id; });
    if (customer.accountUserId === account.id) customer.accountUserId = "";
    return { ok: true, message: "Đã xóa tài khoản khách hàng. Hồ sơ và hóa đơn vẫn được giữ.", customer: customer };
  }

  function query(list, db, opts) {
    opts = opts || {};
    var status = opts.status || "all";
    var roleId = opts.roleId || "all";
    var viewer = opts.viewer;
    var branchId = opts.branchId || "all";
    var scopeBranch = viewer && viewer.role !== "admin" && !viewer.preview;
    var rows = (list || []).filter(function (item) {
      if (scopeBranch && homeBranch(db, item) !== viewer.branchId) return false;
      if (!scopeBranch && branchId !== "all" && homeBranch(db, item) !== branchId) return false;
      if (status !== "all" && (item.status || "active") !== status) return false;
      if (roleId !== "all" && item.roleId !== roleId) return false;
      var role = roleById(db, item.roleId);
      var branch = branchRecord(db, homeBranch(db, item));
      var blob = [item.name, item.code, item.phone, item.email, item.address, role ? role.name : "", branch ? branch.name : "", branch ? branch.short : ""].join(" ");
      return keywordHit(blob, opts.q);
    });
    rows.sort(function (a, b) { return text(a.name).localeCompare(text(b.name), "vi"); });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || PAGE_SIZE);
  }

  function queryRoles(list, opts) {
    opts = opts || {};
    var status = opts.status || "all";
    var rows = (list || []).filter(function (item) {
      if (status !== "all" && (item.status || "active") !== status) return false;
      return keywordHit([item.name, item.description].join(" "), opts.q);
    });
    rows.sort(function (a, b) {
      if (!!a.builtin !== !!b.builtin) return a.builtin ? -1 : 1;
      return text(a.name).localeCompare(text(b.name), "vi");
    });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || PAGE_SIZE);
  }

  function history(db, customer) {
    if (!customer) return [];
    var phone = normalizePhone(customer.phone);
    return (db.sales || []).filter(function (sale) {
      return sale.customerId === customer.id || (phone && normalizePhone(sale.customerPhone) === phone);
    }).sort(function (a, b) { return text(b.at).localeCompare(text(a.at)); });
  }

  function pointsFor(total, rate) {
    var amount = Number(total) || 0;
    var pointRate = Number(rate) || 0;
    if (amount <= 0 || pointRate <= 0) return 0;
    return Math.floor(amount / 10000) * pointRate;
  }

  function suggest(db, customer) {
    if (!customer || customer.status !== "active") return null;
    var current = roleById(db, customer.roleId);
    var spend = Number(customer.totalSpend) || 0;
    var best = null;
    (db.customerRoles || []).forEach(function (role) {
      if (role.status !== "active" || role.id === customer.roleId) return;
      var minSpend = Number(role.minSpend) || 0;
      if (minSpend <= 0 || spend < minSpend) return;
      if (!best || minSpend > Number(best.minSpend)) best = role;
    });
    if (!best || !current) return null;
    var discount = Number(best.discountPercent) || 0;
    var points = Number(best.pointRate) || 0;
    var currentDiscount = Number(current.discountPercent) || 0;
    var currentPoints = Number(current.pointRate) || 0;
    if (discount < currentDiscount || points < currentPoints) return null;
    if (discount === currentDiscount && points === currentPoints) return null;
    return { role: best, message: "Khách đã đạt mức chi của vai trò " + best.name + "." };
  }

  function previewSale(db, sale) {
    ensure(db);
    sale = sale || {};
    var phone = normalizePhone(sale.customerPhone);
    if (!phone) return { linked: false, earned: 0, label: "Khách lẻ không tích điểm." };
    var customer = findByPhone(db, phone);
    if (!customer) return { linked: false, earned: 0, label: "Chưa có hồ sơ khách, không tích điểm." };
    var role = roleById(db, customer.roleId);
    if (customer.status !== "active" || !role || role.status !== "active") {
      return { linked: true, earned: 0, customer: customer, role: role, label: customer.name + " đang ngừng hoặc vai trò đã tắt, không tích điểm." };
    }
    var earned = pointsFor(sale.total, role.pointRate);
    var label = customer.name + " · " + role.name;
    if (earned) label += " · sẽ tích " + earned + " điểm";
    else label += " · đơn chưa đủ 10.000đ để tích điểm";
    return { linked: true, earned: earned, customer: customer, role: role, label: label };
  }

  function applySale(db, sale) {
    ensure(db);
    if (!sale || sale.spendCounted) return { ok: true, linked: !!sale.customerId, earned: Number(sale.pointsEarned) || 0 };
    var phone = normalizePhone(sale.customerPhone);
    if (!phone) return { ok: true, linked: false, earned: 0 };
    var customer = findByPhone(db, phone);
    if (!customer) return { ok: true, linked: false, earned: 0 };
    var role = roleById(db, customer.roleId);
    sale.customerId = customer.id;
    sale.customerRoleId = role ? role.id : customer.roleId;
    var active = customer.status === "active" && role && role.status === "active";
    var earned = active ? pointsFor(sale.total, role.pointRate) : 0;
    sale.pointsEarned = earned;
    if (active) {
      customer.points = (Number(customer.points) || 0) + earned;
      customer.totalSpend = (Number(customer.totalSpend) || 0) + (Number(sale.total) || 0);
      sale.spendCounted = true;
    }
    var hint = suggest(db, customer);
    var note = "";
    if (!active) note = " Khách đang ngừng hoặc vai trò đã tắt, không tích điểm.";
    else if (earned) note = " Tích " + earned + " điểm cho " + customer.name + ".";
    if (hint) note += " " + hint.message;
    return { ok: true, linked: true, earned: earned, customer: customer, hint: hint, note: note };
  }

  function reverseSale(db, sale) {
    if (!sale || !sale.spendCounted || sale.pointsReversed) return { ok: true };
    var customer = byId(db, sale.customerId) || findByPhone(db, sale.customerPhone);
    if (customer) {
      customer.points = Math.max(0, (Number(customer.points) || 0) - (Number(sale.pointsEarned) || 0));
      customer.totalSpend = Math.max(0, (Number(customer.totalSpend) || 0) - (Number(sale.total) || 0));
    }
    sale.pointsReversed = true;
    return { ok: true, customer: customer };
  }

  function inspect(db, customer) {
    if (!customer) return { ok: false, missing: ["khách hàng"] };
    var missing = [];
    if (text(customer.name).length < 2) missing.push("tên");
    if (!phoneOk(customer.phone || "")) missing.push("điện thoại");
    if (customer.email && !emailOk(customer.email)) missing.push("email");
    if (!roleById(db, customer.roleId)) missing.push("vai trò");
    return { ok: missing.length === 0, missing: missing };
  }

  root.PharmaCustomers = {
    PAGE_SIZE: PAGE_SIZE,
    DEFAULT_ROLES: DEFAULT_ROLES,
    ensure: ensure,
    normalizePhone: normalizePhone,
    roleById: roleById,
    byId: byId,
    findByPhone: findByPhone,
    nextCode: nextCode,
    benefitText: benefitText,
    validateRole: validateRole,
    saveRole: saveRole,
    setRoleStatus: setRoleStatus,
    customerCount: customerCount,
    deleteRole: deleteRole,
    validateCustomer: validateCustomer,
    homeBranch: homeBranch,
    visibleTo: visibleTo,
    save: save,
    setStatus: setStatus,
    saleCount: saleCount,
    remove: remove,
    lockAccount: lockAccount,
    removeAccount: removeAccount,
    accountOf: accountOf,
    registerAccount: registerAccount,
    openAccount: openAccount,
    applyAccountProfile: applyAccountProfile,
    loginBlock: loginBlock,
    query: query,
    queryRoles: queryRoles,
    history: history,
    pointsFor: pointsFor,
    suggest: suggest,
    previewSale: previewSale,
    applySale: applySale,
    reverseSale: reverseSale,
    inspect: inspect,
    sampleCustomers: sampleCustomers,
  };
})(typeof window !== "undefined" ? window : globalThis);
