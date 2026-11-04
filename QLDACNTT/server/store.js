/* Ghi và đọc toàn bộ dữ liệu web vào các bảng MySQL. */
const CLEAR = [
  "transfer_lines",
  "transfers",
  "stocktake_lines",
  "stocktakes",
  "invoice_lines",
  "invoices",
  "goods_receipt_lines",
  "goods_receipts",
  "discount_codes",
  "medicine_lots",
  "medicines",
  "notifications",
  "suppliers",
  "staff_transfers",
  "access_logs",
  "user_sessions",
  "users",
  "customers",
  "customer_roles",
  "branch_contacts",
  "branches",
  "role_permissions",
  "permissions",
  "roles",
  "drug_categories",
  "manufacturers",
  "measure_units",
  "dosage_forms",
  "alert_policy",
  "app_state",
];

const KNOWN = new Set([
  "branches", "categories", "manufacturers", "units", "dosageForms", "medicines",
  "suppliers", "receipts", "discounts", "sales", "customers", "customerRoles",
  "users", "roles", "permissions", "rolePermissions", "accessLogs", "notifications",
  "stocktakes", "transfers", "settings", "alertInbox", "migrations", "auditReports",
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function mapOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cut(value, size) {
  return String(value == null ? "" : value).trim().slice(0, size);
}

function cleanId(value) {
  return cut(value, 40).replace(/\s+/g, "");
}

function int(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  const number = int(value, 0);
  return number < 0 ? 0 : number;
}

function clamp(value, min, max, fallback) {
  const number = int(value, fallback);
  return Math.min(max, Math.max(min, number));
}

function flag(value) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function day(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null;
  return match[0];
}

function stamp(value) {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function asDay(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : "";
}

function asIso(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const raw = String(value).trim();
  if (!raw) return "";
  const parsed = raw.includes("T") ? new Date(raw) : new Date(raw.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function takeUnique(raw, max, used, fallback) {
  let base = cut(raw, max) || cut(fallback, max) || "MA";
  let code = base;
  let n = 2;
  while (used.has(code.toLowerCase())) {
    const suffix = "-" + n;
    code = cut(base, Math.max(1, max - suffix.length)) + suffix;
    n += 1;
  }
  used.add(code.toLowerCase());
  return code;
}

function oneOf(value, allowed, fallback) {
  return allowed.indexOf(value) >= 0 ? value : fallback;
}

function idsOf(rows) {
  return rows.map((row) => row.id);
}

async function ensureSchema(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(40) NOT NULL,
      meta_value VARCHAR(40) NOT NULL,
      PRIMARY KEY (meta_key)
    ) ENGINE=InnoDB`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_state (
      doc_key VARCHAR(40) NOT NULL,
      payload LONGTEXT NOT NULL,
      PRIMARY KEY (doc_key)
    ) ENGINE=InnoDB`
  );
}

function pack(db) {
  const extra = {};
  Object.keys(db || {}).forEach((key) => {
    if (!KNOWN.has(key)) extra[key] = db[key];
  });

  const names = {
    role: new Set(),
    perm: new Set(),
    branch: new Set(),
    crole: new Set(),
    category: new Set(),
    maker: new Set(),
    unit: new Set(),
    form: new Set(),
    medCode: new Set(),
    supplier: new Set(),
    receipt: new Set(),
    discount: new Set(),
    invoice: new Set(),
    customerCode: new Set(),
    customerPhone: new Set(),
    email: new Set(),
    stocktake: new Set(),
    move: new Set(),
  };
  const have = {
    role: new Set(),
    permCode: new Map(),
    branch: new Set(),
    crole: new Set(),
    category: new Set(),
    maker: new Set(),
    unit: new Set(),
    form: new Set(),
    medicine: new Set(),
    supplier: new Set(),
    customer: new Set(),
    user: new Set(),
  };

  const roles = [];
  list(db.roles).forEach((role) => {
    const id = cleanId(role.id);
    if (!id || have.role.has(id)) return;
    const name = takeUnique(role.name || id, 80, names.role, id);
    have.role.add(id);
    roles.push([id, name, cut(role.description, 255), flag(role.builtin), oneOf(role.status, ["active", "inactive"], "active")]);
  });

  const permissions = [];
  list(db.permissions).forEach((perm) => {
    const code = cleanId(perm.code || perm.id);
    const id = cleanId(perm.id || code);
    if (!id || !code || have.permCode.has(code)) return;
    const name = takeUnique(perm.name || code, 120, names.perm, code);
    have.permCode.set(code, id);
    have.permCode.set(id, id);
    permissions.push([id, code, name, cut(perm.group || perm.group_name || "khac", 40), flag(perm.builtin), oneOf(perm.status, ["active", "inactive"], "active")]);
  });

  const rolePermissions = [];
  const grantSeen = new Set();
  Object.keys(mapOf(db.rolePermissions)).forEach((roleId) => {
    const role = cleanId(roleId);
    if (!have.role.has(role)) return;
    list(db.rolePermissions[roleId]).forEach((code) => {
      const permId = have.permCode.get(cleanId(code));
      const key = role + "|" + permId;
      if (!permId || grantSeen.has(key)) return;
      grantSeen.add(key);
      rolePermissions.push([role, permId]);
    });
  });

  const branches = [];
  const contacts = [];
  list(db.branches).forEach((branch) => {
    const id = cleanId(branch.id);
    const name = cut(branch.name, 160);
    if (!id || name.length < 2 || have.branch.has(id)) return;
    const unique = takeUnique(name, 160, names.branch, id);
    have.branch.add(id);
    const phone = cut(branch.phone, 40) || "-";
    const address = cut(branch.address, 255) || "-";
    branches.push([
      id,
      unique,
      cut(branch.short || unique, 80),
      address,
      phone,
      cut(branch.hours || "08:00 – 21:00", 80),
      oneOf(branch.status, ["open", "maintenance", "closed"], "open"),
      cut(branch.manager, 120),
    ]);
    contacts.push([id, cut(branch.contact, 120), cut(branch.email, 160), phone, address]);
  });

  const customerRoles = [];
  list(db.customerRoles).forEach((role) => addCustomerRole(role));
  function addCustomerRole(role) {
    const id = cleanId(role && role.id);
    if (!id || have.crole.has(id)) return;
    const name = takeUnique((role && role.name) || id, 80, names.crole, id);
    have.crole.add(id);
    customerRoles.push([
      id,
      name,
      cut(role && role.description, 200),
      clamp(role && role.pointRate, 0, 20, 0),
      clamp(role && role.discountPercent, 0, 30, 0),
      money(role && role.minSpend),
      flag(role && role.builtin),
      oneOf(role && role.status, ["active", "inactive"], "active"),
    ]);
  }

  const categories = [];
  function addCategory(id, name) {
    id = cleanId(id);
    if (!id || have.category.has(id)) return id;
    const unique = takeUnique(name || id, 80, names.category, id);
    have.category.add(id);
    categories.push([id, unique]);
    return id;
  }
  list(db.categories).forEach((row) => addCategory(row.id, row.name));

  const manufacturers = [];
  function addMaker(id, name, phone, country, status) {
    id = cleanId(id);
    if (!id || have.maker.has(id)) return id;
    const unique = takeUnique(name || id, 120, names.maker, id);
    have.maker.add(id);
    manufacturers.push([
      id,
      unique,
      cut(phone, 40),
      cut(country, 80),
      oneOf(status, ["active", "inactive"], "active"),
    ]);
    return id;
  }
  list(db.manufacturers).forEach((row) => addMaker(row.id, row.name, row.phone, row.country, row.status));

  const units = [];
  function addUnit(id, name, builtin) {
    id = cleanId(id);
    if (!id || have.unit.has(id)) return id;
    const unique = takeUnique(name || id, 40, names.unit, id);
    have.unit.add(id);
    units.push([id, unique, flag(builtin)]);
    return id;
  }
  list(db.units).forEach((row) => addUnit(row.id, row.name, row.builtin));

  const forms = [];
  function addForm(id, name, builtin) {
    id = cleanId(id);
    if (!id || have.form.has(id)) return id;
    const unique = takeUnique(name || id, 40, names.form, id);
    have.form.add(id);
    forms.push([id, unique, flag(builtin)]);
    return id;
  }
  list(db.dosageForms).forEach((row) => addForm(row.id, row.name, row.builtin));

  const medicines = [];
  const lots = [];
  const lotOrder = {};
  list(db.medicines).forEach((med) => {
    const id = cleanId(med.id);
    const branchId = cleanId(med.branchId);
    if (!id || !have.branch.has(branchId) || have.medicine.has(id)) return;
    const categoryId = addCategory(med.categoryId || "cat-" + id, med.category || "Chưa phân loại");
    const makerId = addMaker(med.manufacturerId || "mk-" + id, med.supplier || med.manufacturer || "Không rõ", "", "", "active");
    const unitId = addUnit(med.unitId || "unit-" + id, med.unit || "Đơn vị", 0);
    const formId = addForm(med.dosageFormId || "form-" + id, med.dosageForm || "Khác", 0);
    let cost = money(med.cost != null ? med.cost : med.costPrice);
    let price = money(med.price != null ? med.price : med.salePrice);
    if (price < cost) price = cost;
    const code = takeUnique(String(med.code || med.sku || id).toUpperCase(), 20, names.medCode, id.toUpperCase());
    have.medicine.add(id);
    medicines.push([
      id,
      branchId,
      code,
      cut(med.name, 160) || code,
      categoryId,
      makerId,
      unitId,
      formId,
      cut(med.activeIngredient || med.name, 160),
      cut(med.strength || "-", 40),
      cost,
      price,
      money(med.stock),
      money(med.minStock),
      oneOf(med.status, ["active", "discontinued"], "active"),
    ]);
    const seenBatch = new Set();
    const sourceLots = list(med.lots);
    if (!sourceLots.length && med.batch && day(med.expiry)) {
      sourceLots.push({ id: id + "-lot", batch: med.batch, expiry: med.expiry, qty: med.stock });
    }
    lotOrder[id] = [];
    sourceLots.forEach((lot, index) => {
      const expiry = day(lot.expiry);
      const batch = cut(String(lot.batch || "").toUpperCase(), 30);
      const qty = money(lot.qty);
      if (!expiry || !batch || seenBatch.has(batch)) return;
      const lotId = cleanId(lot.id) || cleanId(id + "-l" + index);
      if (!lotId) return;
      seenBatch.add(batch);
      lotOrder[id].push(lotId);
      lots.push([lotId, id, batch, expiry, qty]);
    });
  });

  const suppliers = [];
  list(db.suppliers).forEach((row) => {
    const id = cleanId(row.id);
    if (!id || have.supplier.has(id)) return;
    const code = takeUnique(row.code || id, 20, names.supplier, id);
    have.supplier.add(id);
    suppliers.push([
      id,
      code,
      cut(row.name, 160) || code,
      cut(row.phone, 40) || "-",
      cut(row.email, 120),
      cut(row.address, 200) || "-",
      cut(row.contact, 80),
      cut(row.taxCode, 13),
      cut(row.note, 300),
      oneOf(row.status, ["active", "inactive"], "active"),
      stamp(row.createdAt),
    ]);
  });

  const receipts = [];
  const receiptLines = [];
  const receiptLineOrder = {};
  list(db.receipts).forEach((row) => {
    const id = cleanId(row.id);
    const supplierId = cleanId(row.supplierId);
    const branchId = cleanId(row.branchId);
    if (!id || !have.supplier.has(supplierId) || !have.branch.has(branchId)) return;
    const code = takeUnique(row.code || id, 24, names.receipt, id);
    const lines = [];
    const seen = new Set();
    list(row.lines).forEach((line, index) => {
      const medicineId = cleanId(line.medicineId);
      const expiry = day(line.expiry);
      const qty = int(line.qty, 0);
      const batch = cut(String(line.batch || line.batchNo || "NA").toUpperCase(), 30) || "NA";
      const key = medicineId + "|" + batch;
      if (!have.medicine.has(medicineId) || !expiry || qty < 1 || seen.has(key)) return;
      seen.add(key);
      const cost = money(line.cost != null ? line.cost : line.costPrice);
      const lineId = cleanId(line.id || line.key) || cleanId(id + "-l" + index);
      lines.push([
        lineId,
        id,
        medicineId,
        qty,
        cost,
        money(line.amount != null ? line.amount : qty * cost),
        batch,
        expiry,
        line.stockBefore == null || line.stockBefore === "" ? null : money(line.stockBefore),
        line.stockAfter == null || line.stockAfter === "" ? null : money(line.stockAfter),
      ]);
    });
    receipts.push([
      id,
      code,
      supplierId,
      branchId,
      cut(row.note, 300),
      oneOf(row.status, ["draft", "confirmed", "cancelled"], "draft"),
      money(row.total != null ? row.total : row.totalAmount),
      cut(row.createdBy, 120),
      stamp(row.at || row.createdAt),
      row.confirmedAt ? stamp(row.confirmedAt) : null,
      row.cancelledAt ? stamp(row.cancelledAt) : null,
    ]);
    receiptLineOrder[id] = lines.map((line) => line[0]);
    receiptLines.push.apply(receiptLines, lines);
  });

  const discounts = [];
  list(db.discounts).forEach((row) => {
    const id = cleanId(row.id);
    const value = money(row.value);
    if (!id || value < 1) return;
    const code = takeUnique(String(row.code || id).toUpperCase(), 20, names.discount, id);
    discounts.push([
      id,
      code,
      oneOf(row.type, ["percent", "amount"], "amount"),
      value,
      money(row.minSubtotal),
      money(row.maxDiscount),
      day(row.start),
      day(row.end),
      oneOf(row.status, ["active", "inactive"], "active"),
      cut(row.note, 200),
    ]);
  });

  list(db.customers).forEach((row) => addCustomerRole({ id: row.roleId, name: row.roleId || "member" }));
  list(db.users).forEach((row) => {
    const role = cleanId(row.role || row.roleId);
    if (role && !have.role.has(role)) {
      have.role.add(role);
      roles.push([role, takeUnique(role, 80, names.role, role), "", 0, "active"]);
    }
  });

  const customers = [];
  list(db.customers).forEach((row) => {
    const id = cleanId(row.id);
    const branchId = cleanId(row.branchId);
    const roleId = cleanId(row.roleId);
    if (!id || !have.branch.has(branchId) || !have.crole.has(roleId) || have.customer.has(id)) return;
    const code = takeUnique(row.code || id, 20, names.customerCode, id);
    const phone = takeUnique(row.phone || "P" + id, 20, names.customerPhone, "P" + id);
    have.customer.add(id);
    customers.push([
      id,
      code,
      cut(row.name, 80) || code,
      phone,
      cut(row.email, 120),
      cut(row.address, 200),
      day(row.birthday),
      roleId,
      branchId,
      money(row.points),
      money(row.totalSpend),
      oneOf(row.status, ["active", "inactive"], "active"),
      cut(row.note, 300),
      stamp(row.createdAt),
    ]);
  });

  const users = [];
  const usedCustomer = new Set();
  list(db.users).forEach((row) => {
    const id = cleanId(row.id);
    const email = cut(row.email, 160).toLowerCase();
    const role = cleanId(row.role || row.roleId);
    if (!id || !email || !have.role.has(role) || have.user.has(id) || names.email.has(email)) return;
    let branchId = cleanId(row.branchId);
    if (branchId === "all" || !have.branch.has(branchId)) branchId = null;
    let customerId = cleanId(row.customerId);
    if (!have.customer.has(customerId) || usedCustomer.has(customerId)) customerId = null;
    if (customerId) usedCustomer.add(customerId);
    names.email.add(email);
    have.user.add(id);
    users.push([
      id,
      cut(row.name, 120) || email,
      email,
      cut(row.phone, 40),
      cut(row.password || row.passwordHash, 120) || "unset",
      role,
      branchId,
      customerId,
      cut(row.title, 80),
      cut(row.status || "active", 16) || "active",
    ]);
  });

  const staffTransfers = [];
  list(db.users).forEach((row) => {
    const userId = cleanId(row.id);
    if (!have.user.has(userId)) return;
    list(row.transfers).forEach((item, index) => {
      const toBranch = cleanId(item.to || item.toBranch);
      if (!have.branch.has(toBranch)) return;
      let actor = cleanId(item.by || item.actorId);
      if (!have.user.has(actor)) actor = userId;
      const fromBranch = cleanId(item.from || item.fromBranch);
      const id = cleanId(item.id) || cleanId("sf-" + userId + "-" + index);
      staffTransfers.push([
        id,
        userId,
        have.branch.has(fromBranch) ? fromBranch : null,
        toBranch,
        actor,
        oneOf(item.kind, ["assign", "transfer"], "transfer"),
        stamp(item.at),
      ]);
    });
  });

  const accessLogs = [];
  list(db.accessLogs).slice(0, 200).forEach((row) => {
    const id = cleanId(row.id);
    if (!id) return;
    const userId = cleanId(row.userId);
    accessLogs.push([
      id,
      stamp(row.at),
      have.user.has(userId) ? userId : null,
      cut(row.email, 160),
      cut(row.action || "xem", 40),
      cut(row.result || "ok", 16),
      cut(row.detail, 255),
    ]);
  });

  const invoiceDetails = {};
  const invoices = [];
  const invoiceLines = [];
  const invoiceLineOrder = {};
  list(db.sales).forEach((row) => {
    const id = cleanId(row.id);
    const branchId = cleanId(row.branchId);
    if (!id || !have.branch.has(branchId)) return;
    const code = takeUnique(row.code || id, 24, names.invoice, id);
    let customerId = cleanId(row.customerId);
    if (!have.customer.has(customerId)) customerId = null;
    let roleId = cleanId(row.customerRoleId);
    if (!have.crole.has(roleId)) roleId = null;
    const lines = [];
    const seenMed = new Set();
    list(row.lines).forEach((line, index) => {
      const medicineId = cleanId(line.medicineId);
      const qty = int(line.qty, 0);
      if (!have.medicine.has(medicineId) || qty < 1 || seenMed.has(medicineId)) return;
      seenMed.add(medicineId);
      const lineId = cleanId(line.id) || cleanId(id + "-l" + index);
      lines.push([
        lineId,
        id,
        medicineId,
        qty,
        money(line.price != null ? line.price : line.unitPrice),
        money(line.cost != null ? line.cost : line.costPrice),
        money(line.amount != null ? line.amount : qty * money(line.price)),
        cut(line.batch || line.batchNo, 30),
        line.stockBefore == null || line.stockBefore === "" ? null : money(line.stockBefore),
        line.stockAfter == null || line.stockAfter === "" ? null : money(line.stockAfter),
      ]);
    });
    let subtotal = money(row.subtotal);
    let discount = money(row.discountAmount);
    if (discount > subtotal) discount = subtotal;
    const detail = {};
    if (row.discountLabel) detail.discountLabel = cut(row.discountLabel, 80);
    if (Object.keys(detail).length) invoiceDetails[id] = detail;
    invoices.push([
      id,
      code,
      branchId,
      customerId,
      roleId,
      cut(row.customer || row.customerName || "Khách lẻ", 80),
      cut(row.customerPhone, 20),
      cut(row.cashier || row.cashierName || "Quầy", 120),
      oneOf(row.pay || row.payMethod, ["cash", "transfer", "card"], "cash"),
      cut(row.payStatus || "received", 16) || "received",
      oneOf(row.status, ["paid", "cancelled"], "paid"),
      stamp(row.at || row.soldAt),
      subtotal,
      cut(row.discountMode || "none", 16) || "none",
      cut(row.discountCode, 20),
      discount,
      subtotal - discount,
      money(row.pointsEarned),
      flag(row.spendCounted),
      row.tendered == null || row.tendered === "" ? null : money(row.tendered),
      row.changeAmount == null || row.changeAmount === "" ? null : money(row.changeAmount),
      cut(row.transferRef, 40),
      cut(row.bankName, 80),
      cut(row.bankAccount, 40),
      cut(row.bankOwner, 120),
      row.cancelledAt ? stamp(row.cancelledAt) : null,
    ]);
    invoiceLineOrder[id] = lines.map((line) => line[0]);
    invoiceLines.push.apply(invoiceLines, lines);
  });

  const settings = mapOf(db.settings);
  const warnDays = clamp(settings.expiryWarnDays, 1, 365, 45);
  const alertPolicy = [[
    "default",
    settings.stockAlert === false ? 0 : 1,
    settings.expiryAlert === false ? 0 : 1,
    warnDays,
  ]];

  const notifications = [];
  list(db.notifications).forEach((row) => {
    const id = cleanId(row.id);
    if (!id) return;
    notifications.push([
      id,
      oneOf(row.type, ["expiry", "stock", "system"], "system"),
      cut(row.title || "Thông báo", 160),
      cut(row.body, 500),
      stamp(row.at),
      flag(row.read || row.isRead),
      oneOf(row.priority, ["low", "medium", "high"], "low"),
    ]);
  });

  const stocktakeDetails = {};
  const stocktakes = [];
  const stocktakeLines = [];
  const stocktakeLineOrder = {};
  list(db.stocktakes).forEach((row) => {
    const id = cleanId(row.id);
    const branchId = cleanId(row.branchId);
    if (!id || !have.branch.has(branchId)) return;
    const code = takeUnique(row.code || id, 24, names.stocktake, id);
    const lines = [];
    const seen = new Set();
    list(row.lines).forEach((line, index) => {
      const medicineId = cleanId(line.medicineId);
      if (!have.medicine.has(medicineId) || seen.has(medicineId)) return;
      seen.add(medicineId);
      const systemQty = money(line.systemQty);
      const actual = line.actualQty == null || line.actualQty === "" ? null : money(line.actualQty);
      const variance = actual == null ? null : actual - systemQty;
      const lineId = cleanId(line.id) || cleanId(id + "-l" + index);
      lines.push([
        lineId,
        id,
        medicineId,
        systemQty,
        actual,
        line.variance == null || line.variance === "" ? variance : int(line.variance, variance || 0),
        oneOf(line.reason || line.reasonCode, ["", "count", "damage", "expiry", "loss", "found", "other"], ""),
        line.stockAfter == null || line.stockAfter === "" ? null : money(line.stockAfter),
      ]);
    });
    if (list(row.checks).length) stocktakeDetails[id] = { checks: row.checks };
    stocktakes.push([
      id,
      code,
      branchId,
      cut(row.note, 300),
      oneOf(row.status, ["draft", "counted", "minuted", "posted", "cancelled"], "draft"),
      cut(row.minute, 500),
      cut(row.createdBy, 120),
      stamp(row.createdAt),
      row.postedAt ? stamp(row.postedAt) : null,
    ]);
    stocktakeLineOrder[id] = lines.map((line) => line[0]);
    stocktakeLines.push.apply(stocktakeLines, lines);
  });

  const transferDetails = {};
  const transfers = [];
  const transferLines = [];
  const transferLineOrder = {};
  list(db.transfers).forEach((row) => {
    const id = cleanId(row.id);
    const fromId = cleanId(row.fromBranchId);
    const toId = cleanId(row.toBranchId);
    if (!id || !have.branch.has(fromId) || !have.branch.has(toId) || fromId === toId) return;
    const code = takeUnique(row.code || id, 24, names.move, id);
    const lines = [];
    list(row.lines).forEach((line, index) => {
      const medicineId = cleanId(line.medicineId);
      const qty = int(line.qty, 0);
      if (!have.medicine.has(medicineId) || qty < 1) return;
      const lineId = cleanId(line.id) || cleanId(id + "-l" + index);
      lines.push([lineId, id, medicineId, cut(line.batch || line.batchNo, 30), qty]);
    });
    const detail = {};
    if (list(row.applied).length) detail.applied = row.applied;
    if (list(row.checks).length) detail.checks = row.checks;
    if (Object.keys(detail).length) transferDetails[id] = detail;
    transfers.push([
      id,
      code,
      fromId,
      toId,
      cut(row.note, 300),
      oneOf(row.status, ["draft", "confirmed", "cancelled"], "draft"),
      cut(row.createdBy, 120),
      stamp(row.createdAt),
      row.confirmedAt ? stamp(row.confirmedAt) : null,
    ]);
    transferLineOrder[id] = lines.map((line) => line[0]);
    transferLines.push.apply(transferLines, lines);
  });

  const orders = {
    branches: idsOf(branches.map((row) => ({ id: row[0] }))),
    categories: idsOf(categories.map((row) => ({ id: row[0] }))),
    manufacturers: idsOf(manufacturers.map((row) => ({ id: row[0] }))),
    units: idsOf(units.map((row) => ({ id: row[0] }))),
    dosageForms: idsOf(forms.map((row) => ({ id: row[0] }))),
    medicines: idsOf(medicines.map((row) => ({ id: row[0] }))),
    suppliers: idsOf(suppliers.map((row) => ({ id: row[0] }))),
    receipts: idsOf(receipts.map((row) => ({ id: row[0] }))),
    discounts: idsOf(discounts.map((row) => ({ id: row[0] }))),
    sales: idsOf(invoices.map((row) => ({ id: row[0] }))),
    customers: idsOf(customers.map((row) => ({ id: row[0] }))),
    customerRoles: idsOf(customerRoles.map((row) => ({ id: row[0] }))),
    users: idsOf(users.map((row) => ({ id: row[0] }))),
    roles: idsOf(roles.map((row) => ({ id: row[0] }))),
    permissions: idsOf(permissions.map((row) => ({ id: row[0] }))),
    notifications: idsOf(notifications.map((row) => ({ id: row[0] }))),
    stocktakes: idsOf(stocktakes.map((row) => ({ id: row[0] }))),
    transfers: idsOf(transfers.map((row) => ({ id: row[0] }))),
    accessLogs: idsOf(accessLogs.map((row) => ({ id: row[0] }))),
    lots: lotOrder,
    receiptLines: receiptLineOrder,
    invoiceLines: invoiceLineOrder,
    stocktakeLines: stocktakeLineOrder,
    transferLines: transferLineOrder,
  };

  return {
    roles, permissions, rolePermissions, branches, contacts, customerRoles, customers, users,
    staffTransfers, accessLogs, categories, manufacturers, units, forms, medicines, lots,
    suppliers, receipts, receiptLines, discounts, invoices, invoiceLines, alertPolicy,
    notifications, stocktakes, stocktakeLines, transfers, transferLines,
    state: {
      settings,
      alertInbox: mapOf(db.alertInbox),
      migrations: mapOf(db.migrations),
      auditReports: list(db.auditReports),
      orders,
      details: { invoices: invoiceDetails, stocktakes: stocktakeDetails, transfers: transferDetails },
      extra,
    },
  };
}

async function insertRows(conn, sql, rows) {
  for (const row of rows) await conn.execute(sql, row);
}

async function writeAll(conn, data) {
  await insertRows(conn, "INSERT INTO roles (id, name, description, builtin, status) VALUES (?, ?, ?, ?, ?)", data.roles);
  await insertRows(conn, "INSERT INTO permissions (id, code, name, group_name, builtin, status) VALUES (?, ?, ?, ?, ?, ?)", data.permissions);
  await insertRows(conn, "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", data.rolePermissions);
  await insertRows(conn, "INSERT INTO branches (id, name, short_name, address, phone, hours, status, manager) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data.branches);
  await insertRows(conn, "INSERT INTO branch_contacts (branch_id, contact_name, email, phone, address) VALUES (?, ?, ?, ?, ?)", data.contacts);
  await insertRows(conn, "INSERT INTO customer_roles (id, name, description, point_rate, discount_percent, min_spend, builtin, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data.customerRoles);
  await insertRows(conn, "INSERT INTO customers (id, code, name, phone, email, address, birthday, role_id, branch_id, points, total_spend, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.customers);
  await insertRows(conn, "INSERT INTO users (id, name, email, phone, password_hash, role_id, branch_id, customer_id, title, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.users);
  await insertRows(conn, "INSERT INTO staff_transfers (id, user_id, from_branch, to_branch, actor_id, kind, at) VALUES (?, ?, ?, ?, ?, ?, ?)", data.staffTransfers);
  await insertRows(conn, "INSERT INTO access_logs (id, at, user_id, email, action, result, detail) VALUES (?, ?, ?, ?, ?, ?, ?)", data.accessLogs);
  await insertRows(conn, "INSERT INTO drug_categories (id, name) VALUES (?, ?)", data.categories);
  await insertRows(conn, "INSERT INTO manufacturers (id, name, phone, country, status) VALUES (?, ?, ?, ?, ?)", data.manufacturers);
  await insertRows(conn, "INSERT INTO measure_units (id, name, builtin) VALUES (?, ?, ?)", data.units);
  await insertRows(conn, "INSERT INTO dosage_forms (id, name, builtin) VALUES (?, ?, ?)", data.forms);
  await insertRows(conn, "INSERT INTO medicines (id, branch_id, code, name, category_id, manufacturer_id, unit_id, dosage_form_id, active_ingredient, strength, cost_price, sale_price, stock, min_stock, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.medicines);
  await insertRows(conn, "INSERT INTO medicine_lots (id, medicine_id, batch_no, expiry, qty) VALUES (?, ?, ?, ?, ?)", data.lots);
  await insertRows(conn, "INSERT INTO suppliers (id, code, name, phone, email, address, contact, tax_code, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.suppliers);
  await insertRows(conn, "INSERT INTO goods_receipts (id, code, supplier_id, branch_id, note, status, total_amount, created_by, created_at, confirmed_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.receipts);
  await insertRows(conn, "INSERT INTO goods_receipt_lines (id, receipt_id, medicine_id, qty, cost_price, amount, batch_no, expiry, stock_before, stock_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.receiptLines);
  await insertRows(conn, "INSERT INTO discount_codes (id, code, discount_type, value, min_subtotal, max_discount, start_on, end_on, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.discounts);
  await insertRows(conn, "INSERT INTO invoices (id, code, branch_id, customer_id, customer_role_id, customer_name, customer_phone, cashier_name, pay_method, pay_status, status, sold_at, subtotal, discount_mode, discount_code, discount_amount, total_amount, points_earned, spend_counted, tendered, change_amount, transfer_ref, bank_name, bank_account, bank_owner, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.invoices);
  await insertRows(conn, "INSERT INTO invoice_lines (id, invoice_id, medicine_id, qty, unit_price, cost_price, amount, batch_no, stock_before, stock_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.invoiceLines);
  await insertRows(conn, "INSERT INTO alert_policy (id, stock_alert, expiry_alert, expiry_warn_days) VALUES (?, ?, ?, ?)", data.alertPolicy);
  await insertRows(conn, "INSERT INTO notifications (id, type, title, body, at, is_read, priority) VALUES (?, ?, ?, ?, ?, ?, ?)", data.notifications);
  await insertRows(conn, "INSERT INTO stocktakes (id, code, branch_id, note, status, minute, created_by, created_at, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", data.stocktakes);
  await insertRows(conn, "INSERT INTO stocktake_lines (id, stocktake_id, medicine_id, system_qty, actual_qty, variance_qty, reason_code, stock_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data.stocktakeLines);
  await insertRows(conn, "INSERT INTO transfers (id, code, from_branch_id, to_branch_id, note, status, created_by, created_at, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", data.transfers);
  await insertRows(conn, "INSERT INTO transfer_lines (id, transfer_id, medicine_id, batch_no, qty) VALUES (?, ?, ?, ?, ?)", data.transferLines);
  const state = data.state;
  const docs = [
    ["settings", state.settings],
    ["alert_inbox", state.alertInbox],
    ["migrations", state.migrations],
    ["audit_reports", state.auditReports],
    ["orders", state.orders],
    ["details", state.details],
    ["extra", state.extra],
  ];
  for (const [key, value] of docs) {
    await conn.execute("INSERT INTO app_state (doc_key, payload) VALUES (?, ?)", [key, JSON.stringify(value == null ? {} : value)]);
  }
}

async function save(pool, db) {
  if (!db || typeof db !== "object" || Array.isArray(db)) {
    const error = new Error("Dữ liệu không đúng định dạng.");
    error.status = 400;
    throw error;
  }
  await ensureSchema(pool);
  const packed = pack(db);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of CLEAR) await conn.query("DELETE FROM `" + table + "`");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await writeAll(conn, packed);
    await conn.query(
      "INSERT INTO app_meta (meta_key, meta_value) VALUES ('synced', '1') ON DUPLICATE KEY UPDATE meta_value = '1'"
    );
    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch (ignore) { /* giao dịch đã đóng */ }
    throw error;
  } finally {
    try { await conn.query("SET FOREIGN_KEY_CHECKS = 1"); } catch (ignore) { /* trả kết nối */ }
    conn.release();
  }
}

function applyOrder(rows, order) {
  if (!order || !order.length) return rows;
  const rank = new Map(order.map((id, index) => [id, index]));
  return rows.slice().sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
}

function groupBy(rows, key) {
  const grouped = new Map();
  rows.forEach((row) => {
    const id = row[key];
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  });
  return grouped;
}

function readJson(raw, fallback) {
  try { return JSON.parse(raw); } catch (error) { return fallback; }
}

async function load(pool) {
  await ensureSchema(pool);
  const [meta] = await pool.query("SELECT meta_value FROM app_meta WHERE meta_key = 'synced'");
  if (!meta.length || String(meta[0].meta_value) !== "1") return null;

  const [stateRows] = await pool.query("SELECT doc_key, payload FROM app_state");
  const docs = {};
  stateRows.forEach((row) => { docs[row.doc_key] = readJson(row.payload, {}); });
  const orders = docs.orders || {};
  const details = docs.details || {};
  const byName = (table, idCol) => {
    const map = new Map();
    table.forEach((row) => map.set(row[idCol], row.name));
    return map;
  };

  const [roles] = await pool.query("SELECT * FROM roles");
  const [permissions] = await pool.query("SELECT * FROM permissions");
  const [grants] = await pool.query("SELECT role_id, permission_id FROM role_permissions");
  const [branches] = await pool.query("SELECT * FROM branches");
  const [contacts] = await pool.query("SELECT * FROM branch_contacts");
  const [customerRoles] = await pool.query("SELECT * FROM customer_roles");
  const [customers] = await pool.query("SELECT * FROM customers");
  const [users] = await pool.query("SELECT * FROM users");
  const [staff] = await pool.query("SELECT * FROM staff_transfers ORDER BY at DESC");
  const [logs] = await pool.query("SELECT * FROM access_logs");
  const [categories] = await pool.query("SELECT * FROM drug_categories");
  const [makers] = await pool.query("SELECT * FROM manufacturers");
  const [units] = await pool.query("SELECT * FROM measure_units");
  const [forms] = await pool.query("SELECT * FROM dosage_forms");
  const [medicines] = await pool.query("SELECT * FROM medicines");
  const [lots] = await pool.query("SELECT * FROM medicine_lots");
  const [suppliers] = await pool.query("SELECT * FROM suppliers");
  const [receipts] = await pool.query("SELECT * FROM goods_receipts");
  const [receiptLines] = await pool.query("SELECT * FROM goods_receipt_lines");
  const [discounts] = await pool.query("SELECT * FROM discount_codes");
  const [invoices] = await pool.query("SELECT * FROM invoices");
  const [invoiceLines] = await pool.query("SELECT * FROM invoice_lines");
  const [policyRows] = await pool.query("SELECT * FROM alert_policy WHERE id = 'default'");
  const [notes] = await pool.query("SELECT * FROM notifications");
  const [sheets] = await pool.query("SELECT * FROM stocktakes");
  const [sheetLines] = await pool.query("SELECT * FROM stocktake_lines");
  const [moves] = await pool.query("SELECT * FROM transfers");
  const [moveLines] = await pool.query("SELECT * FROM transfer_lines");

  const contactBy = new Map(contacts.map((row) => [row.branch_id, row]));
  const categoryName = byName(categories, "id");
  const makerName = byName(makers, "id");
  const unitName = byName(units, "id");
  const formName = byName(forms, "id");
  const medicineBy = new Map(medicines.map((row) => [row.id, row]));
  const permCode = new Map(permissions.map((row) => [row.id, row.code]));
  const transfersByUser = groupBy(staff, "user_id");
  const accountByCustomer = new Map();
  users.forEach((row) => { if (row.customer_id) accountByCustomer.set(row.customer_id, row.id); });

  const rolePermissions = {};
  grants.forEach((row) => {
    if (!rolePermissions[row.role_id]) rolePermissions[row.role_id] = [];
    rolePermissions[row.role_id].push(permCode.get(row.permission_id) || row.permission_id);
  });

  const lotsBy = groupBy(lots, "medicine_id");
  const medicineRows = medicines.map((row) => {
    const order = (orders.lots && orders.lots[row.id]) || [];
    const medLots = applyOrder(lotsBy.get(row.id) || [], order).map((lot) => ({
      id: lot.id,
      batch: lot.batch_no,
      expiry: asDay(lot.expiry),
      qty: num(lot.qty),
    }));
    const active = medLots.filter((lot) => lot.qty > 0 && lot.expiry).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const primary = active[0] || medLots[0] || {};
    return {
      id: row.id,
      branchId: row.branch_id,
      code: row.code,
      sku: row.code,
      name: row.name,
      categoryId: row.category_id,
      category: categoryName.get(row.category_id) || "",
      manufacturerId: row.manufacturer_id,
      supplier: makerName.get(row.manufacturer_id) || "",
      unitId: row.unit_id,
      unit: unitName.get(row.unit_id) || "",
      dosageFormId: row.dosage_form_id,
      dosageForm: formName.get(row.dosage_form_id) || "",
      activeIngredient: row.active_ingredient,
      strength: row.strength,
      cost: num(row.cost_price),
      price: num(row.sale_price),
      stock: num(row.stock),
      minStock: num(row.min_stock),
      status: row.status,
      batch: primary.batch || "",
      expiry: primary.expiry || "",
      lots: medLots,
    };
  });

  function lineName(medicineId) {
    const med = medicineBy.get(medicineId);
    return med ? med.name : "";
  }
  function lineUnit(medicineId) {
    const med = medicineBy.get(medicineId);
    return med ? (unitName.get(med.unit_id) || "") : "";
  }

  const receiptLineBy = groupBy(receiptLines, "receipt_id");
  const invoiceLineBy = groupBy(invoiceLines, "invoice_id");
  const sheetLineBy = groupBy(sheetLines, "stocktake_id");
  const moveLineBy = groupBy(moveLines, "transfer_id");
  const invoiceDetail = (details.invoices) || {};
  const sheetDetail = (details.stocktakes) || {};
  const moveDetail = (details.transfers) || {};

  const policy = policyRows[0] || {};
  const settings = Object.assign({}, docs.settings || {});
  if (policyRows.length) {
    settings.stockAlert = Number(policy.stock_alert) === 1;
    settings.expiryAlert = Number(policy.expiry_alert) === 1;
    settings.expiryWarnDays = num(policy.expiry_warn_days) || 45;
  }

  const built = {
    roles: roles.map((row) => ({ id: row.id, name: row.name, description: row.description, builtin: Number(row.builtin) === 1, status: row.status })),
    permissions: permissions.map((row) => ({ id: row.id, code: row.code, name: row.name, group: row.group_name, builtin: Number(row.builtin) === 1, status: row.status })),
    rolePermissions,
    branches: branches.map((row) => {
      const contact = contactBy.get(row.id) || {};
      return {
        id: row.id,
        name: row.name,
        short: row.short_name,
        address: row.address,
        phone: row.phone,
        hours: row.hours,
        email: contact.email || "",
        contact: contact.contact_name || "",
        manager: row.manager || "",
        status: row.status,
      };
    }),
    categories: categories.map((row) => ({ id: row.id, name: row.name })),
    manufacturers: makers.map((row) => ({ id: row.id, name: row.name, phone: row.phone || "", country: row.country || "", status: row.status })),
    units: units.map((row) => ({ id: row.id, name: row.name, builtin: Number(row.builtin) === 1 })),
    dosageForms: forms.map((row) => ({ id: row.id, name: row.name, builtin: Number(row.builtin) === 1 })),
    medicines: medicineRows,
    suppliers: suppliers.map((row) => ({
      id: row.id, code: row.code, name: row.name, phone: row.phone, email: row.email || "",
      address: row.address || "", contact: row.contact || "", taxCode: row.tax_code || "",
      note: row.note || "", status: row.status, createdAt: asIso(row.created_at),
    })),
    receipts: receipts.map((row) => ({
      id: row.id,
      code: row.code,
      supplierId: row.supplier_id,
      branchId: row.branch_id,
      note: row.note || "",
      status: row.status,
      total: num(row.total_amount),
      createdBy: row.created_by || "",
      at: asIso(row.created_at),
      createdAt: asIso(row.created_at),
      confirmedAt: asIso(row.confirmed_at),
      cancelledAt: asIso(row.cancelled_at),
      lines: applyOrder(receiptLineBy.get(row.id) || [], (orders.receiptLines || {})[row.id]).map((line) => ({
        id: line.id,
        key: line.id,
        medicineId: line.medicine_id,
        name: lineName(line.medicine_id),
        unit: lineUnit(line.medicine_id),
        qty: num(line.qty),
        cost: num(line.cost_price),
        amount: num(line.amount),
        batch: line.batch_no,
        expiry: asDay(line.expiry),
        stockBefore: line.stock_before == null ? null : num(line.stock_before),
        stockAfter: line.stock_after == null ? null : num(line.stock_after),
      })),
    })),
    discounts: discounts.map((row) => ({
      id: row.id, code: row.code, type: row.discount_type, value: num(row.value),
      minSubtotal: num(row.min_subtotal), maxDiscount: num(row.max_discount),
      start: asDay(row.start_on), end: asDay(row.end_on), status: row.status, note: row.note || "",
    })),
    sales: invoices.map((row) => Object.assign({
      id: row.id,
      code: row.code,
      branchId: row.branch_id,
      customerId: row.customer_id || "",
      customerRoleId: row.customer_role_id || "",
      customer: row.customer_name,
      customerPhone: row.customer_phone || "",
      cashier: row.cashier_name,
      pay: row.pay_method,
      payStatus: row.pay_status,
      status: row.status,
      at: asIso(row.sold_at),
      subtotal: num(row.subtotal),
      discountMode: row.discount_mode || "none",
      discountCode: row.discount_code || "",
      discountAmount: num(row.discount_amount),
      total: num(row.total_amount),
      pointsEarned: num(row.points_earned),
      spendCounted: Number(row.spend_counted) === 1,
      tendered: row.tendered == null ? "" : num(row.tendered),
      changeAmount: row.change_amount == null ? "" : num(row.change_amount),
      transferRef: row.transfer_ref || "",
      bankName: row.bank_name || "",
      bankAccount: row.bank_account || "",
      bankOwner: row.bank_owner || "",
      cancelledAt: asIso(row.cancelled_at),
      lines: applyOrder(invoiceLineBy.get(row.id) || [], (orders.invoiceLines || {})[row.id]).map((line) => ({
        id: line.id,
        medicineId: line.medicine_id,
        name: lineName(line.medicine_id),
        qty: num(line.qty),
        price: num(line.unit_price),
        cost: num(line.cost_price),
        amount: num(line.amount),
        batch: line.batch_no || "",
        stockBefore: line.stock_before == null ? null : num(line.stock_before),
        stockAfter: line.stock_after == null ? null : num(line.stock_after),
      })),
    }, invoiceDetail[row.id] || {})),
    customers: customers.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone,
      email: row.email || "",
      address: row.address || "",
      birthday: asDay(row.birthday),
      roleId: row.role_id,
      branchId: row.branch_id,
      points: num(row.points),
      totalSpend: num(row.total_spend),
      status: row.status,
      note: row.note || "",
      accountUserId: accountByCustomer.get(row.id) || "",
      createdAt: asIso(row.created_at),
    })),
    customerRoles: customerRoles.map((row) => ({
      id: row.id, name: row.name, description: row.description || "", pointRate: num(row.point_rate),
      discountPercent: num(row.discount_percent), minSpend: num(row.min_spend),
      builtin: Number(row.builtin) === 1, status: row.status,
    })),
    users: users.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || "",
      password: row.password_hash,
      role: row.role_id,
      branchId: row.branch_id || "all",
      customerId: row.customer_id || "",
      title: row.title || "",
      status: row.status,
      transfers: (transfersByUser.get(row.id) || []).map((item) => ({
        id: item.id,
        at: asIso(item.at),
        from: item.from_branch || "",
        to: item.to_branch,
        by: item.actor_id,
        kind: item.kind,
      })),
    })),
    accessLogs: logs.map((row) => ({
      id: row.id, at: asIso(row.at), userId: row.user_id || "", email: row.email || "",
      action: row.action, result: row.result, detail: row.detail || "",
    })),
    notifications: notes.map((row) => ({
      id: row.id, type: row.type, title: row.title, body: row.body, at: asIso(row.at),
      read: Number(row.is_read) === 1, priority: row.priority,
    })),
    stocktakes: sheets.map((row) => Object.assign({
      id: row.id,
      code: row.code,
      branchId: row.branch_id,
      note: row.note || "",
      status: row.status,
      minute: row.minute || "",
      createdBy: row.created_by || "",
      createdAt: asIso(row.created_at),
      postedAt: asIso(row.posted_at),
      lines: applyOrder(sheetLineBy.get(row.id) || [], (orders.stocktakeLines || {})[row.id]).map((line) => ({
        id: line.id,
        medicineId: line.medicine_id,
        name: lineName(line.medicine_id),
        code: (medicineBy.get(line.medicine_id) || {}).code || "",
        unit: lineUnit(line.medicine_id),
        systemQty: num(line.system_qty),
        actualQty: line.actual_qty == null ? null : num(line.actual_qty),
        variance: line.variance_qty == null ? null : num(line.variance_qty),
        reason: line.reason_code || "",
        stockAfter: line.stock_after == null ? null : num(line.stock_after),
      })),
    }, sheetDetail[row.id] || {})),
    transfers: moves.map((row) => Object.assign({
      id: row.id,
      code: row.code,
      fromBranchId: row.from_branch_id,
      toBranchId: row.to_branch_id,
      note: row.note || "",
      status: row.status,
      createdBy: row.created_by || "",
      createdAt: asIso(row.created_at),
      confirmedAt: asIso(row.confirmed_at),
      lines: applyOrder(moveLineBy.get(row.id) || [], (orders.transferLines || {})[row.id]).map((line) => ({
        id: line.id,
        medicineId: line.medicine_id,
        name: lineName(line.medicine_id),
        code: (medicineBy.get(line.medicine_id) || {}).code || "",
        unit: lineUnit(line.medicine_id),
        batch: line.batch_no || "",
        qty: num(line.qty),
      })),
    }, moveDetail[row.id] || { applied: [], checks: [] })),
    settings,
    alertInbox: docs.alert_inbox || {},
    migrations: docs.migrations || {},
    auditReports: Array.isArray(docs.audit_reports) ? docs.audit_reports : [],
  };

  ["roles", "permissions", "branches", "categories", "manufacturers", "units", "dosageForms", "medicines", "suppliers", "receipts", "discounts", "sales", "customers", "customerRoles", "users", "notifications", "stocktakes", "transfers", "accessLogs"].forEach((key) => {
    built[key] = applyOrder(built[key], orders[key]);
  });
  return Object.assign({}, docs.extra || {}, built);
}

module.exports = { ensureSchema, save, load, pack };
