(function () {
  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const KEY = "pharmacare-pro-v3";
  const ROLES = {
    admin: "Quản trị",
    manager: "Quản lý",
    pharmacist: "Dược sĩ",
    cashier: "Thu ngân",
  };
  const NAV = [
    ["tong-quan", "Tổng quan", "home", ["admin", "manager", "pharmacist", "cashier"]],
    ["chi-nhanh", "Chi nhánh", "building", ["admin", "manager"]],
    ["kho", "Kho thuốc", "box", ["admin", "manager", "pharmacist"]],
    ["ton-kho", "Tồn kho", "layers", ["admin", "manager", "pharmacist"]],
    ["nha-cung-cap", "Nhà cung cấp", "truck", ["admin", "manager", "pharmacist"]],
    ["nhap-hang", "Nhập hàng", "file", ["admin", "manager", "pharmacist"]],
    ["ban-hang", "Bán hàng", "cart", ["admin", "manager", "pharmacist", "cashier"]],
    ["khach-hang", "Khách hàng", "user", ["admin", "manager", "pharmacist", "cashier"]],
    ["canh-bao", "Cảnh báo", "alert", ["admin", "manager", "pharmacist"]],
    ["bao-cao", "Báo cáo", "chart", ["admin", "manager"]],
    ["nhan-su", "Nhân sự", "users", ["admin", "manager"]],
    ["thong-bao", "Thông báo", "bell", ["admin", "manager", "pharmacist", "cashier"]],
    ["cai-dat", "Cài đặt", "settings", ["admin", "manager", "pharmacist", "cashier"]],
  ];
  const STORE_NAV = [
    ["cua-hang", "Cửa hàng", "cart"],
    ["don-cua-toi", "Đơn của tôi", "file"],
    ["cai-dat", "Tài khoản", "settings"],
  ];
  const PUBLIC = ["trang-chu", "dang-nhap", "dang-ky", "dang-ky-khach", "quen-mat-khau"];
  const PREVIEW_ROUTES = ["chi-nhanh", "nhan-su", "ton-kho", "ban-hang", "khach-hang"];
  const PREVIEW_USER = {
    id: "guest-preview",
    name: "Khách xem thử",
    role: "guest",
    status: "active",
    branchId: "all",
    preview: true,
    email: "",
  };
  const PAY = { cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ" };

  const state = load();
  let booting = true;
  let mysqlReady = false;
  let lastSent = "";
  let syncTimer = null;
  let syncWarned = false;
  let releaseBoot = function () {};
  let syncChain = new Promise((resolve) => { releaseBoot = resolve; });
  PharmaRbac.ensure(state.db);
  PharmaCatalog.ensure(state.db);
  PharmaSuppliers.ensure(state.db);
  PharmaReceipts.ensure(state.db);
  PharmaSales.ensure(state.db);
  PharmaInventory.ensure(state.db);
  PharmaCustomers.ensure(state.db);
  clearPreparedData();
  installSample();
  ensureSampleNotes();
  PharmaAccounts.upgradePasswords(state.db);
  restorePrimaryAdmin();
  persist();

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
    const db = saved && saved.db ? saved.db : PharmaSeed.createSeed();
    return {
      db,
      session: null,
      theme: saved && saved.theme ? saved.theme : "light",
      ui: {
        q: "", qInv: "", qSale: "", qStaff: "", qBranch: "",
        branchStatus: "all", branchPage: 1, staffBranch: "all", staffRole: "all", staffPage: 1,
        chip: "all", alertChip: "all", notiChip: "all", category: "all",
        catalogTab: "med", medPage: 1, maker: "all", trade: "all",
        qCat: "", catPage: 1, qMaker: "", makerPage: 1, makerStatus: "all",
        qUnit: "", unitPage: 1, qForm: "", formPage: 1,
        qSupplier: "", supplierStatus: "all", supplierPage: 1,
        qReceipt: "", receiptStatus: "all", receiptPage: 1, receiptBranch: "all",
        receiptDraft: null, qReceiptMed: "",
        saleTab: "desk", qInvoice: "", invoiceFrom: "", invoiceTo: "", invoicePage: 1, invoiceStatus: "all",
        stockTab: "stock", qStock: "", stockBranch: "all", stockCategory: "all", stockPage: 1,
        qLot: "", lotPage: 1, qExpiry: "", expiryNear: "near", expiryPage: 1,
        qSheet: "", sheetPage: 1, sheetId: "", sheetBranch: "", sheetNote: "",
        qMove: "", movePage: 1, transferId: "", transferFrom: "", transferTo: "",
        transferMed: "", transferQty: "", transferBatch: "", transferNote: "", transferLines: [],
        alertPage: 1,
        customerTab: "list", qCustomer: "", customerRole: "all", customerStatus: "all", customerBranch: "all", customerPage: 1,
        qRole: "", roleStatus: "all", rolePage: 1,
        shopBranch: "", qStore: "", storePage: 1, storeOrderPage: 1,
        reportTab: "day", reportDate: "", reportMonth: "", reportBranch: "all",
        reportStaff: "all", reportHot: "qty", reportLimit: "10", reportDays: "30", reportPage: 1,
        customerPhone: "", discountMode: "none", discountValue: "", tendered: "", transferOk: false, transferRef: "",
        range: "day", branch: "all", menu: false, accountMenu: false, side: false, newsTopic: "all",
        homeMenu: false, homeModal: null, homeRange: "7", homeConsultOk: false, homeNext: "",
        modal: null, cart: [], customer: "Khách lẻ", pay: "cash",
        toast: null, error: "",
      },
    };
  }

  function clearPreparedData() {
    const branchIds = new Set(["b1", "b2", "b3"]);
    const medicineIds = new Set(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"]);
    const saleIds = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    const noteIds = new Set(["n1", "n2", "n3", "n4"]);
    const demoEmails = new Set([
      "quanly.q1@pharmacare.vn",
      "duocsi.q1@pharmacare.vn",
      "thungan.q1@pharmacare.vn",
      "quanly.q3@pharmacare.vn",
      "thungan.q3@pharmacare.vn",
      "duocsi.td@pharmacare.vn",
    ]);
    state.db.branches = (state.db.branches || []).filter((b) => !branchIds.has(b.id));
    state.db.medicines = (state.db.medicines || []).filter((m) => !medicineIds.has(m.id) && !branchIds.has(m.branchId));
    state.db.sales = (state.db.sales || []).filter((s) => !saleIds.has(s.id) && !branchIds.has(s.branchId));
    state.db.notifications = (state.db.notifications || []).filter((n) => !noteIds.has(n.id));
    state.db.users = (state.db.users || []).filter((u) => !demoEmails.has((u.email || "").toLowerCase()));
    if (branchIds.has(state.ui.branch)) state.ui.branch = "all";
  }

  function installSample() {
    const hasWork = (state.db.branches || []).length || (state.db.medicines || []).length || (state.db.suppliers || []).length;
    if (hasWork) return;
    state.db = PharmaSeed.createSeed();
    PharmaRbac.ensure(state.db);
    PharmaCatalog.ensure(state.db);
    PharmaSuppliers.ensure(state.db);
    PharmaReceipts.ensure(state.db);
    PharmaSales.ensure(state.db);
    PharmaInventory.ensure(state.db);
    PharmaCustomers.ensure(state.db);
  }

  function ensureSampleNotes() {
    if (!state.db.settings) state.db.settings = {};
    if (state.db.settings.sampleNotesReady) return;
    const sample = (state.db.branches || []).some((branch) => branch.id === "br-q1");
    if (!sample || !window.PharmaSeed.sampleNotes) return;
    const notes = PharmaSeed.sampleNotes(state.db);
    const have = new Set((state.db.notifications || []).map((note) => note.id));
    const missing = notes.filter((note) => !have.has(note.id));
    if (missing.length) state.db.notifications = missing.concat(state.db.notifications || []);
    state.db.settings.sampleNotesReady = true;
  }

  function restorePrimaryAdmin() {
    let changed = false;
    state.db.users.forEach((u) => {
      const email = (u.email || "").toLowerCase();
      if (u.id !== "u1" && email !== "admin@pharmacare.vn") return;
      if (u.role === "admin" && u.branchId === "all" && u.status === "active") return;
      u.role = "admin";
      u.branchId = "all";
      u.status = "active";
      u.title = "Quản trị hệ thống";
      changed = true;
    });
    if (changed) persist();
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify({
      db: state.db,
      session: state.session,
      theme: state.theme,
    }));
    queueMysql();
  }

  function queueMysql() {
    if (!mysqlReady) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushMysqlNow().then((result) => {
        if (!result.ok && !syncWarned) {
          syncWarned = true;
          toast((result.data && result.data.message) || "Chưa lưu được dữ liệu vào MySQL.");
        }
        if (result.ok) syncWarned = false;
      });
    }, 400);
  }

  function pushMysqlNow() {
    const job = syncChain.then(() => sendMysql());
    syncChain = job.then(() => {}, () => {});
    return job;
  }

  function sendMysql() {
    if (!mysqlReady) return Promise.resolve({ ok: false, data: { message: "Chưa kết nối MySQL." } });
    const body = JSON.stringify(state.db);
    if (body === lastSent) return Promise.resolve({ ok: true, data: { ok: true } });
    return fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data })).catch(() => ({ ok: res.ok, data: {} }))).then((result) => {
      lastSent = result.ok ? body : "";
      return result;
    }).catch(() => {
      lastSent = "";
      return { ok: false, data: { message: "Không kết nối được máy chủ để lưu MySQL." } };
    });
  }

  function refreshFrom(db) {
    state.db = db;
    PharmaRbac.ensure(state.db);
    PharmaCatalog.ensure(state.db);
    PharmaSuppliers.ensure(state.db);
    PharmaReceipts.ensure(state.db);
    PharmaSales.ensure(state.db);
    PharmaInventory.ensure(state.db);
    PharmaCustomers.ensure(state.db);
    clearPreparedData();
    ensureSampleNotes();
    PharmaAccounts.upgradePasswords(state.db);
    restorePrimaryAdmin();
  }

  async function bootMysql() {
    let reachable = false;
    try {
      const res = await fetch("/api/db", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("mysql");
      reachable = true;
      const body = await res.json();
      if (body.source === "mysql" && body.db) refreshFrom(body.db);
    } catch (error) {
      reachable = false;
    }
    mysqlReady = reachable;
    booting = false;
    releaseBoot();
    if (reachable) {
      const result = await pushMysqlNow();
      if (!result.ok) toast((result.data && result.data.message) || "Chưa lưu được dữ liệu vào MySQL.");
    }
    render();
    if (!reachable) toast("Không kết nối được MySQL. Dữ liệu mới chỉ nằm trên trình duyệt.");
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function money(n) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n || 0);
  }

  function dateLabel(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function timeLabel(iso) {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  }

  function todayStr() { return PharmaSeed.day(0); }

  function daysUntil(iso) {
    const a = new Date(todayStr() + "T12:00:00");
    const b = new Date(iso + "T12:00:00");
    return Math.round((b - a) / 86400000);
  }

  function settled(list) {
    return list.filter((s) => (s.status || "paid") !== "cancelled");
  }

  function saleTotal(s) { return PharmaSales.revenueOf(s); }
  function saleProfit(s) { return PharmaSales.profit(s); }

  function me() {
    const check = PharmaSession.status(state.session, Date.now());
    if (check.ok) {
      const user = state.db.users.find((u) => u.id === check.session.userId);
      if (user) return user;
    }
    if (PREVIEW_ROUTES.includes(route())) return PREVIEW_USER;
    return null;
  }

  function roleLabel(id) {
    const role = (state.db.roles || []).find((item) => item.id === id);
    return role ? role.name : (ROLES[id] || id || "");
  }

  function locksOwnProfile(user) {
    return !!user && (user.role === "admin" || user.role === "manager");
  }

  function governTarget(actor, target) {
    if (!actor || !target || actor.id === target.id) return false;
    if (target.role === "admin" || target.id === "u1") return false;
    if (actor.role === "admin") return true;
    if (actor.role === "manager") return target.branchId === actor.branchId && target.role !== "admin" && target.role !== "manager";
    return false;
  }

  function canEditAccount(actor, target) {
    if (!actor || !target || actor.id === target.id) return false;
    if (actor.role === "admin") return target.role !== "admin";
    if (actor.role === "manager") return target.branchId === actor.branchId && (target.role === "pharmacist" || target.role === "cashier");
    return false;
  }

  function accountButtons(actor, u) {
    const parts = [];
    if (canEditAccount(actor, u)) parts.push(`<button class="btn sm ghost" data-action="edit-staff" data-id="${u.id}">Sửa</button>`);
    if (PharmaRbac.can(state.db, actor, "account.lock") && governTarget(actor, u)) {
      parts.push(`<button class="btn sm ghost" data-action="toggle-lock" data-id="${u.id}">${u.status === "active" ? "Khóa" : "Mở khóa"}</button>`);
    }
    if (PharmaRbac.can(state.db, actor, "account.delete") && governTarget(actor, u)) {
      parts.push(`<button class="btn sm danger" data-action="delete-user" data-id="${u.id}">Xóa</button>`);
    }
    return parts.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${parts.join("")}</div>` : "";
  }

  function allowed(route) {
    const user = me();
    if (!user) return false;
    if (user.preview) return PREVIEW_ROUTES.includes(route);
    const menus = user.role === "customer" ? STORE_NAV : NAV;
    if (!menus.some((n) => n[0] === route)) return false;
    return PharmaRbac.can(state.db, user, route);
  }

  function visibleBranch(id) {
    return PharmaRbac.seesBranch(me(), id, state.ui.branch);
  }

  function branchClosedFor(user) {
    if (!user || user.role === "admin") return false;
    const branch = state.db.branches.find((item) => item.id === user.branchId);
    return !!(branch && branch.status === "closed");
  }

  function branchPill(status) {
    if (status === "open") return `<span class="badge-pill ok">Đang mở</span>`;
    if (status === "closed") return `<span class="badge-pill bad">Ngừng hoạt động</span>`;
    return `<span class="badge-pill warn">Bảo trì</span>`;
  }

  function pagerBar(info, action) {
    return `<div class="pager">
      <button class="btn sm ghost" data-action="${action}" data-dir="-1" ${info.page <= 1 ? "disabled" : ""}>Trước</button>
      <span class="tiny muted">Trang ${info.page}/${info.pages} · ${info.total} mục</span>
      <button class="btn sm ghost" data-action="${action}" data-dir="1" ${info.page >= info.pages ? "disabled" : ""}>Sau</button>
    </div>`;
  }

  function scopeId() {
    const user = me();
    if (!user || user.role === "admin" || user.preview) return state.ui.branch;
    return user.branchId;
  }

  function meds() {
    return state.db.medicines.filter((m) => visibleBranch(m.branchId));
  }

  function sales() {
    return state.db.sales.filter((s) => visibleBranch(s.branchId));
  }

  function branchName(id) {
    return (state.db.branches.find((b) => b.id === id) || {}).short || "";
  }

  function medStatus(m) {
    const d = daysUntil(m.expiry);
    if (d < 0) return ["bad", "Hết hạn"];
    if (m.stock <= 0) return ["bad", "Hết hàng"];
    if (d <= 30) return ["warn", "Sắp hết hạn"];
    if (m.stock <= m.minStock) return ["warn", "Sắp hết"];
    return ["ok", "Ổn định"];
  }

  function alerts() {
    return PharmaInventory.openAlerts(meds(), { settings: state.db.settings, today: todayStr(), db: state.db });
  }

  function toast(msg) {
    state.ui.toast = msg;
    render();
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { state.ui.toast = null; render(); }, 2400);
  }

  function route() {
    const h = (location.hash || "#/trang-chu").replace(/^#\/?/, "");
    return h.split("?")[0] || "trang-chu";
  }

  function go(path) {
    location.hash = "#/" + path;
  }

  function icon(name) {
    const p = {
      pill: '<path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
      home: '<path d="m3 10 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
      building: '<path d="M4 21V5a2 2 0 0 1 2-2h6v18"/><path d="M12 7h6a2 2 0 0 1 2 2v12"/><path d="M8 8h.01M8 12h.01M8 16h.01M16 11h.01M16 15h.01"/>',
      box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
      layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
      truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
      cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H6"/>',
      alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      chart: '<path d="M3 3v18h18"/><path d="M7 14v4"/><path d="M12 9v9"/><path d="M17 5v13"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
      settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
      mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
      lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
      out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p[name] || ""}</svg>`;
  }

  function logo() {
    return `<span class="logo"><svg viewBox="0 0 64 64" role="img" aria-label="Biểu tượng Mạch Dược"><rect width="64" height="64" rx="18" fill="#123D39"/><path d="M25 13h14v12h12v14H39v12H25V39H13V25h12V13Z" fill="#F4FF61"/><circle cx="32" cy="32" r="5" fill="#123D39"/><path d="M32 27V18M37 32h9M32 37v9M27 32h-9" stroke="#123D39" stroke-linecap="round" stroke-width="3"/></svg></span>`;
  }

  function brandLockup() {
    return `${logo()}<span class="wordmark">MẠCH DƯỢC</span>`;
  }

  function focusRestore() {
    const id = state._focus;
    const pos = state._pos;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      if (pos != null && el.setSelectionRange) {
        try { el.setSelectionRange(pos, pos); } catch (err) { /* ô ngày không đặt được con trỏ */ }
      }
    }
  }

  function render() {
    if (booting) return;
    document.documentElement.dataset.theme = state.theme;
    const sessionCheck = PharmaSession.status(state.session, Date.now());
    if (state.session && !sessionCheck.ok) {
      state.session = null;
      if (sessionCheck.reason === "expired") state.ui.error = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      persist();
    }
    let user = me();
    const r = route();
    if (user && !user.preview && user.status !== "active") {
      state.session = null;
      state.ui.error = "Tài khoản đang bị khóa. Liên hệ quản trị.";
      persist();
      user = me();
    }
    if (!user && !PUBLIC.includes(r)) {
      go("dang-nhap");
      return;
    }
    if (user && !user.preview && r !== "trang-chu") {
      if (user.role === "customer") {
        if (r !== "cai-dat" && !STORE_NAV.some((n) => n[0] === r)) {
          go("cua-hang");
          return;
        }
      } else if (r === "phan-quyen" || !NAV.some((n) => n[0] === r)) {
        go("tong-quan");
        return;
      }
    }
    app.innerHTML = r === "trang-chu" ? PharmaHome.page(homeHost()) : (user ? shell(page(r)) : auth(r));
    if (state._painted !== r) {
      state._painted = r;
      window.scrollTo(0, 0);
    }
    if (state.ui.toast) app.insertAdjacentHTML("beforeend", `<div class="toast">${esc(state.ui.toast)}</div>`);
    focusRestore();
    if (user && !user.preview) watchNotes();
  }

  function auth(r) {
    const brand = `
      <aside class="auth-brand">
        <div class="brand-row">${brandLockup()}</div>
        <div class="brand-copy">
          <div class="brand-kicker">Nền tảng vận hành nhà thuốc</div>
          <h1>Kết nối<br>mọi nhịp<span class="brand-dot">.</span></h1>
          <p>Một trung tâm điều hành cho toàn bộ chuỗi nhà thuốc — quản lý đa chi nhánh, phân quyền minh bạch và báo cáo tức thời.</p>
          <div class="feature-list">
            <div class="feature"><i>${icon("layers")}</i><span><b>Mạch kết nối</b>Liên thông tồn kho, doanh thu và nhân sự giữa mọi chi nhánh.</span></div>
            <div class="feature"><i>${icon("chart")}</i><span><b>Nhịp chính xác</b>Dữ liệu tức thời giúp mọi quyết định đúng lúc, đúng nơi.</span></div>
            <div class="feature"><i>${icon("shield")}</i><span><b>Chuỗi vững vàng</b>Phân quyền rõ ràng để tăng trưởng an toàn và bền vững.</span></div>
          </div>
        </div>
        <div></div>
      </aside>`;
    const forms = {
      "dang-nhap": loginForm(),
      "dang-ky": registerCustomerForm(),
      "dang-ky-khach": registerCustomerForm(),
      "quen-mat-khau": forgotForm(),
    };
    return `<div class="auth">${brand}<section class="auth-panel"><div class="auth-card">${forms[r] || loginForm()}</div></section></div>`;
  }

  function loginForm() {
    return `
      <h2>Đăng nhập</h2>
      <p class="sub">Nhập thông tin tài khoản để tiếp tục</p>
      ${state.ui.error ? `<div class="form-error">${esc(state.ui.error)}</div>` : ""}
      <form data-form="login">
        <div class="field">
          <div class="field-head"><span>Email tài khoản</span></div>
          <label class="control">${icon("mail")}<input name="email" type="email" required value="admin@pharmacare.vn" autocomplete="username" /></label>
        </div>
        <div class="field">
          <div class="field-head"><span>Mật khẩu</span><button type="button" class="linkish" data-action="go" data-path="quen-mat-khau">Quên mật khẩu?</button></div>
          <label class="control">${icon("lock")}<input name="password" type="password" required value="admin123" autocomplete="current-password" /><button type="button" class="peek" data-action="show-password" aria-label="Hiện mật khẩu">Hiện</button></label>
        </div>
        <label class="remember"><input type="checkbox" name="remember" checked /> Ghi nhớ đăng nhập 7 ngày</label>
        <button class="btn block" type="submit">Đăng nhập</button>
      </form>
      <div class="demo">
        <p>Demo — bấm để điền tài khoản</p>
        <div class="demo-grid">
          <button type="button" data-action="fill-demo" data-email="admin@pharmacare.vn" data-password="admin123"><b>Quản trị</b><span>admin@pharmacare.vn</span></button>
          <button type="button" data-action="fill-demo" data-email="nam.nguyen@gmail.com" data-password="Khach123"><b>Khách hàng</b><span>nam.nguyen@gmail.com</span></button>
        </div>
      </div>
      <p class="switch-auth">Chưa có tài khoản? <button class="linkish" data-action="go" data-path="dang-ky">Đăng ký</button></p>`;
  }

  function registerCustomerForm() {
    const opts = state.db.branches.filter((b) => b.status === "open").map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
    if (!opts) {
      return `<h2>Đăng ký</h2><p class="sub">Nhà thuốc chưa có chi nhánh đang mở.</p><p class="switch-auth"><button class="linkish" data-action="go" data-path="dang-nhap">Quay lại đăng nhập</button></p>`;
    }
    return `
      <h2>Đăng ký</h2>
      <p class="sub">Tạo tài khoản khách hàng</p>
      ${state.ui.error ? `<div class="form-error">${esc(state.ui.error)}</div>` : ""}
      <form data-form="register-customer">
        <div class="field"><div class="field-head"><span>Họ và tên</span></div><label class="control"><input name="name" required placeholder="Nguyễn Văn A" /></label></div>
        <div class="field"><div class="field-head"><span>Email</span></div><label class="control">${icon("mail")}<input name="email" type="email" required placeholder="ban@gmail.com" /></label></div>
        <div class="field"><div class="field-head"><span>Số điện thoại</span></div><label class="control"><input name="phone" required placeholder="09xx xxx xxx" /></label></div>
        <div class="field"><div class="field-head"><span>Chi nhánh gần nhà</span></div><label class="control"><select name="branchId">${opts}</select></label></div>
        <div class="field"><div class="field-head"><span>Mật khẩu</span></div><label class="control">${icon("lock")}<input name="password" type="password" required minlength="8" /></label></div>
        <p class="tiny muted" style="margin-top:-6px">Ít nhất 8 ký tự, có cả chữ và số. Tài khoản này chỉ dành cho khách hàng.</p>
        <button class="btn block" type="submit">Tạo tài khoản</button>
      </form>
      <p class="switch-auth">Đã có tài khoản? <button class="linkish" data-action="go" data-path="dang-nhap">Đăng nhập</button></p>`;
  }

  function forgotForm() {
    return `
      <h2>Quên mật khẩu</h2>
      <p class="sub">Nhập email đã đăng ký để đặt mật khẩu mới</p>
      ${state.ui.error ? `<div class="form-error">${esc(state.ui.error)}</div>` : ""}
      ${state.ui.resetOk ? `<div class="success-note">Đã cập nhật mật khẩu. Bạn có thể đăng nhập lại.</div>` : ""}
      <form data-form="forgot">
        <div class="field"><div class="field-head"><span>Email tài khoản</span></div><label class="control">${icon("mail")}<input name="email" type="email" required /></label></div>
        <div class="field"><div class="field-head"><span>Mật khẩu mới</span></div><label class="control">${icon("lock")}<input name="password" type="password" required minlength="8" /></label></div>
        <p class="tiny muted" style="margin-top:-6px">Ít nhất 8 ký tự, có cả chữ và số.</p>
        <button class="btn block" type="submit">Đặt lại mật khẩu</button>
      </form>
      <p class="switch-auth"><button class="linkish" data-action="go" data-path="dang-nhap">Quay lại đăng nhập</button></p>`;
  }

  function shell(content) {
    const user = me();
    const r = route();
    const unread = state.db.notifications.filter((n) => !n.read).length;
    const alertCount = alerts().filter((row) => !row.read).length;
    const menus = user.role === "customer" ? STORE_NAV : NAV;
    const nav = menus.filter((n) => user.preview ? PREVIEW_ROUTES.includes(n[0]) : PharmaRbac.can(state.db, user, n[0])).map((n) => {
      const count = n[0] === "thong-bao" ? unread : n[0] === "canh-bao" ? alertCount : 0;
      return `<button class="nav-item ${r === n[0] ? "active" : ""}" data-action="go" data-path="${n[0]}">${icon(n[2])}<span>${n[1]}</span>${count ? `<em class="badge">${count}</em>` : ""}</button>`;
    }).join("");
    const openBranches = state.db.branches.filter((b) => b.status === "open");
    const branches = user.role === "customer"
      ? `<select class="select" data-change="shop-branch">${openBranches.map((b) => `<option value="${b.id}" ${state.ui.shopBranch === b.id ? "selected" : ""}>${esc(b.short)}</option>`).join("")}</select>`
      : user.role === "admin" || user.preview
      ? `<select class="select" data-change="branch">${["<option value='all'>Tất cả chi nhánh</option>"].concat(state.db.branches.map((b) => `<option value="${b.id}" ${state.ui.branch === b.id ? "selected" : ""}>${esc(b.short)}</option>`)).join("")}</select>`
      : `<span class="muted">${esc(branchName(user.branchId) || "Toàn hệ thống")}</span>`;
    const finder = user.role === "customer"
      ? ""
      : `<label class="search">${icon("search")}<input id="global-q" placeholder="Tìm thuốc, mã, hoạt chất..." data-input="global" value="${esc(state.ui.q)}" /></label>`;
    const bell = PharmaRbac.can(state.db, user, "thong-bao")
      ? `<button class="icon-btn" data-action="go" data-path="thong-bao" aria-label="Thông báo">${icon("bell")}${unread ? `<i class="dot"></i>` : ""}</button>`
      : "";
    return `
      <div class="app">
        <aside class="sidebar ${state.ui.side ? "open" : ""}">
          <div class="brand-row" style="color:var(--text)">${brandLockup()}</div>
          <nav class="side-nav">${nav}</nav>
          <div class="side-user-wrap">
            ${user.preview ? "" : state.ui.accountMenu ? `<div class="menu side-menu"><button data-action="go" data-path="cai-dat">Hồ sơ & cài đặt</button><button data-action="logout">Đăng xuất</button></div>` : ""}
            <button class="side-user" data-action="${user.preview ? "go" : "toggle-account"}" data-path="dang-nhap" aria-label="Tài khoản">
              <div class="avatar">${esc(user.name.split(" ").slice(-1)[0][0])}</div>
              <div><b>${esc(user.name)}</b><span>${user.preview ? "Chưa đăng nhập" : esc(roleLabel(user.role))}</span></div>
            </button>
          </div>
        </aside>
        <section class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" data-action="toggle-side" aria-label="Menu">${icon("menu")}</button>
            ${finder}
            <div class="grow">
              ${branches}
              <button class="icon-btn" data-action="theme" aria-label="Đổi giao diện">${icon(state.theme === "dark" ? "sun" : "moon")}</button>
              ${bell}
              <div style="position:relative">
                ${user.preview
                  ? `<button class="btn sm" data-action="go" data-path="dang-nhap">Đăng nhập</button>`
                  : `<button class="icon-btn" data-action="toggle-menu" aria-label="Tài khoản">${icon("users")}</button>${state.ui.menu ? `<div class="menu"><button data-action="go" data-path="cai-dat">Hồ sơ & cài đặt</button><button data-action="logout">Đăng xuất</button></div>` : ""}`}
              </div>
            </div>
          </header>
          <div class="page">${user.preview ? `<div class="note">Bạn đang xem thử, chưa cần đăng nhập. <button type="button" class="linkish" data-action="go" data-path="trang-chu">Về trang chủ</button></div>` : ""}${content}</div>
        </section>
      </div>
      ${state.ui.modal ? modal() : ""}`;
  }

  function page(r) {
    if (!allowed(r)) {
      return `<div class="card empty"><h3>Bạn không có quyền truy cập chức năng này</h3><p>Tài khoản ${esc(roleLabel(me().role))} bị từ chối vào mục này.</p></div>`;
    }
    if (branchClosedFor(me()) && (r === "ban-hang" || r === "kho" || r === "nhap-hang" || r === "ton-kho")) {
      return `<div class="card empty"><h3>Chi nhánh đang ngừng hoạt động</h3><p>Tài khoản của bạn không bán hàng, nhập hàng hoặc chỉnh kho cho đến khi quản trị kích hoạt lại chi nhánh.</p></div>`;
    }
    const map = {
      "tong-quan": viewDashboard,
      "chi-nhanh": viewBranches,
      kho: viewInventory,
      "ton-kho": function () { return PharmaInventoryPages.page(inventoryHost()); },
      "nha-cung-cap": function () { return PharmaSupplyPages.supplierPage(supplyHost()); },
      "nhap-hang": function () { return PharmaSupplyPages.receiptPage(supplyHost()); },
      "ban-hang": viewSales,
      "khach-hang": function () { return PharmaCustomerPages.page(customerHost()); },
      "cua-hang": function () { return PharmaStorePages.catalog(storeHost()); },
      "don-cua-toi": function () { return PharmaStorePages.orders(storeHost()); },
      "canh-bao": viewAlerts,
      "bao-cao": viewReports,
      "nhan-su": viewStaff,
      "thong-bao": viewNotes,
      "cai-dat": viewSettings,
    };
    const banner = branchClosedFor(me())
      ? `<div class="note" style="margin-bottom:14px">Chi nhánh của bạn đang ngừng hoạt động. Bạn không vào bán hàng, nhập hàng hoặc kho.</div>`
      : "";
    return banner + (map[r] || viewDashboard)();
  }

  function isoShift(base, offset) {
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function periodBounds() {
    const year = new Date().getFullYear();
    const start = `${year}-10-01`;
    const today = todayStr();
    const end = state.ui.range === "month" ? `${year}-10-31` : (today < start ? start : today);
    return { start, end };
  }

  function eachDate(start, end) {
    const dates = [];
    let cursor = start;
    while (cursor <= end) {
      dates.push(cursor);
      cursor = isoShift(cursor, 1);
    }
    return dates;
  }

  function inRange(iso) {
    const { start, end } = periodBounds();
    const day = iso.slice(0, 10);
    return day >= start && day <= end;
  }

  function revenueSeries() {
    const { start, end } = periodBounds();
    return eachDate(start, end).map((d) => {
      const [, m, da] = d.split("-");
      const sum = sales().filter((s) => s.at.slice(0, 10) === d).reduce((n, s) => n + saleTotal(s), 0);
      return { label: `${Number(da)}/${Number(m)}`, sum };
    });
  }

  function viewDashboard() {
    const user = me();
    const list = settled(sales().filter((s) => inRange(s.at)));
    const revenue = list.reduce((n, s) => n + saleTotal(s), 0);
    const profit = list.reduce((n, s) => n + saleProfit(s), 0);
    const low = meds().filter((m) => m.stock <= m.minStock).length;
    const exp = meds().filter((m) => daysUntil(m.expiry) <= 45).length;
    const series = revenueSeries();
    const max = Math.max(...series.map((s) => s.sum), 1);
    const recent = sales().slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
    const topMap = {};
    list.forEach((s) => s.lines.forEach((l) => { topMap[l.name] = (topMap[l.name] || 0) + l.qty; }));
    const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const greet = new Date().getHours() < 12 ? "Chào buổi sáng" : new Date().getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    return `
      <div class="page-head">
        <div><h1>${greet}, ${esc(user.name.split(" ").slice(-1)[0])}</h1><p>${new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${esc(roleLabel(user.role))}</p></div>
        <div class="chips">
          ${[["day", "Theo ngày"], ["month", "Theo tháng"]].map(([k, l]) => `<button class="chip ${state.ui.range === k ? "on" : ""}" data-action="range" data-value="${k}">${l}</button>`).join("")}
        </div>
      </div>
      <div class="stats">
        <article class="stat"><div class="k">Doanh thu <span class="bubble">${icon("chart")}</span></div><div class="v">${money(revenue)}</div><div class="d">Lợi nhuận gộp ${money(profit)}</div></article>
        <article class="stat"><div class="k">Đơn bán <span class="bubble teal">${icon("cart")}</span></div><div class="v">${list.length}</div><div class="d">Giá trị TB ${money(list.length ? revenue / list.length : 0)}</div></article>
        <article class="stat"><div class="k">Cảnh báo kho <span class="bubble warn">${icon("box")}</span></div><div class="v">${low}</div><div class="d down">Mặt hàng dưới mức tối thiểu</div></article>
        <article class="stat"><div class="k">Hạn dùng <span class="bubble bad">${icon("alert")}</span></div><div class="v">${exp}</div><div class="d down">Lô trong 45 ngày hoặc đã hết hạn</div></article>
      </div>
      <div class="grid-2">
        <section class="card">
          <h3>${state.ui.range === "month" ? "Doanh thu theo tháng" : "Doanh thu theo ngày"}</h3>
          <div class="bars ${series.length > 12 ? "dense" : ""}">${series.map((s) => `<div class="bar"><i style="height:${Math.max(6, (s.sum / max) * 150)}px" title="${money(s.sum)}"></i><span>${esc(s.label)}</span></div>`).join("")}</div>
        </section>
        <section class="card">
          <h3>Bán chạy</h3>
          <div class="list">${top.length ? top.map(([name, qty], i) => `<div class="row-item"><div><b>${i + 1}. ${esc(name)}</b><div class="tiny muted">${qty} đơn vị</div></div></div>`).join("") : `<div class="empty">Chưa có dữ liệu</div>`}</div>
        </section>
      </div>
      <section class="card" style="margin-top:14px">
        <h3>Hóa đơn gần đây</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Mã</th><th>Khách</th><th>Chi nhánh</th><th>Thu ngân</th><th>Thanh toán</th><th>Tổng</th></tr></thead>
          <tbody>${recent.map((s) => `<tr><td><button class="linkish" data-action="open-invoice" data-id="${esc(s.id)}">${esc(s.code)}</button>${(s.status || "paid") === "cancelled" ? ` <span class="badge-pill bad">Đã hủy</span>` : ""}</td><td>${esc(s.customer)}</td><td>${esc(branchName(s.branchId))}</td><td>${esc(s.cashier)}</td><td>${PAY[s.pay] || ""}</td><td><b>${money(PharmaSales.amount(s))}</b></td></tr>`).join("") || `<tr><td colspan="6"><div class="empty">Chưa có hóa đơn</div></td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  function viewBranches() {
    const user = me();
    const listed = PharmaBranches.query(state.db.branches, {
      viewer: user,
      q: state.ui.qBranch,
      status: state.ui.branchStatus,
      page: state.ui.branchPage,
    });
    state.ui.branchPage = listed.page;
    const cards = listed.rows.map((b) => {
      const rev = state.db.sales.filter((s) => s.branchId === b.id && s.at.slice(0, 7) === todayStr().slice(0, 7)).reduce((n, s) => n + saleTotal(s), 0);
      const staff = state.db.users.filter((u) => u.branchId === b.id && u.status === "active" && u.role !== "customer").length;
      const low = state.db.medicines.filter((m) => m.branchId === b.id && m.stock <= m.minStock).length;
      const own = user.role === "admin" || user.branchId === b.id;
      return `<article class="branch-card">
        <div class="row-item" style="border:0;padding:0;background:transparent">
          <h3>${esc(b.name)}</h3>
          ${branchPill(b.status)}
        </div>
        <div class="tiny muted">${esc(b.address)}</div>
        <div class="tiny muted">${esc(b.phone)} · ${esc(b.hours)}${b.email ? " · " + esc(b.email) : ""}</div>
        <div class="meta">
          <div><span class="tiny muted">Doanh thu tháng</span><b>${money(rev)}</b></div>
          <div><span class="tiny muted">Nhân sự</span><b>${staff}</b></div>
          <div><span class="tiny muted">Cảnh báo kho</span><b>${low}</b></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm soft" data-action="open-branch" data-id="${b.id}">Chi tiết</button>
          ${own ? `<button class="btn sm ghost" data-action="edit-branch" data-id="${b.id}">Sửa</button><button class="btn sm ghost" data-action="branch-contact" data-id="${b.id}">Liên hệ</button>` : ""}
          ${user.role === "admin" && b.status !== "open" ? `<button class="btn sm" data-action="branch-open" data-id="${b.id}">Kích hoạt</button>` : ""}
          ${user.role === "admin" && b.status === "open" ? `<button class="btn sm ghost" data-action="branch-close" data-id="${b.id}">Ngừng hoạt động</button>` : ""}
          ${user.role === "admin" ? `<button class="btn sm" data-action="manager-account" data-id="${b.id}">Tạo quản lý</button><button class="btn sm" data-action="employee-account" data-id="${b.id}">Tạo nhân viên</button><button class="btn sm danger" data-action="delete-branch" data-id="${b.id}">Xóa</button>` : ""}
        </div>
      </article>`;
    }).join("");
    const filters = [["all", "Tất cả"], ["open", "Đang mở"], ["maintenance", "Bảo trì"], ["closed", "Ngừng hoạt động"]];
    return `
      <div class="page-head"><div><h1>Chi nhánh</h1><p>${listed.total} chi nhánh trong phạm vi bạn đang xem</p></div>
        ${user.role === "admin" ? `<button class="btn" data-action="edit-branch">${icon("plus")} Thêm chi nhánh</button>` : ""}
      </div>
      <div class="toolbar">
        <label class="search">${icon("search")}<input id="q-branch" placeholder="Tên, địa chỉ hoặc điện thoại" data-input="qBranch" value="${esc(state.ui.qBranch)}" /></label>
        <div class="chips">${filters.map(([k, l]) => `<button class="chip ${state.ui.branchStatus === k ? "on" : ""}" data-action="branch-filter" data-value="${k}">${l}</button>`).join("")}</div>
      </div>
      <div class="branch-grid">${cards || `<div class="card empty">Không có chi nhánh khớp bộ lọc.</div>`}</div>
      ${pagerBar(listed, "branch-page")}`;
  }

  function catalogTabs() {
    const tab = state.ui.catalogTab || "med";
    const tabs = [["med", "Thuốc"], ["category", "Danh mục"], ["maker", "Nhà sản xuất"], ["unit", "Đơn vị & dạng bào chế"]];
    return `<div class="catalog-tabs">${tabs.map(([k, l]) => `<button type="button" class="chip ${tab === k ? "on" : ""}" data-action="catalog-tab" data-value="${k}">${l}</button>`).join("")}</div>`;
  }

  function medActions(m, canEdit) {
    const bits = [`<button class="btn sm soft" data-action="open-med" data-id="${m.id}">Chi tiết</button>`];
    if (!canEdit) return `<div class="action-row med-actions">${bits.join("")}</div>`;
    const next = (m.status || "active") === "discontinued" ? "active" : "discontinued";
    bits.push(`<button class="btn sm ghost" data-action="edit-med" data-id="${m.id}">Sửa</button>`);
    bits.push(`<button class="btn sm ghost" data-action="stock" data-id="${m.id}">Điều chỉnh</button>`);
    bits.push(`<button class="btn sm ghost" data-action="stop-med" data-id="${m.id}" data-next="${next}">${next === "discontinued" ? "Ngừng bán" : "Mở bán"}</button>`);
    bits.push(`<button class="btn sm danger" data-action="delete-med" data-id="${m.id}">Xóa</button>`);
    return `<div class="action-row med-actions">${bits.join("")}</div>`;
  }

  function viewInventory() {
    const tab = state.ui.catalogTab || "med";
    const body = tab === "category" ? viewCategories() : tab === "maker" ? viewMakers() : tab === "unit" ? viewMeasures() : viewMedList();
    return catalogTabs() + body;
  }

  function viewMedList() {
    const listed = PharmaMedicines.query(meds(), {
      q: state.ui.qInv,
      categoryId: state.ui.category,
      manufacturerId: state.ui.maker,
      status: state.ui.trade,
      chip: state.ui.chip,
      today: todayStr(),
      page: state.ui.medPage,
      categories: state.db.categories,
    });
    state.ui.medPage = listed.page;
    const canEdit = PharmaRbac.can(state.db, me(), "inventory.edit");
    return `
      <div class="page-head"><div><h1>Kho thuốc</h1><p>${listed.total} mặt hàng trong phạm vi bạn đang xem</p></div>
        ${canEdit ? `<button class="btn" data-action="edit-med">${icon("plus")} Thêm thuốc</button>` : ""}
      </div>
      <div class="toolbar">
        <label class="search">${icon("search")}<input id="q-inv" placeholder="Tên, mã hoặc hoạt chất" data-input="qInv" value="${esc(state.ui.qInv)}" /></label>
        <select class="select" data-change="category"><option value="all">Mọi danh mục</option>${state.db.categories.map((c) => `<option value="${esc(c.id)}" ${state.ui.category === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <select class="select" data-change="maker"><option value="all">Mọi nhà sản xuất</option>${state.db.manufacturers.map((m) => `<option value="${esc(m.id)}" ${state.ui.maker === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
        <select class="select" data-change="trade"><option value="all">Mọi trạng thái</option><option value="active" ${state.ui.trade === "active" ? "selected" : ""}>Đang kinh doanh</option><option value="discontinued" ${state.ui.trade === "discontinued" ? "selected" : ""}>Ngừng kinh doanh</option></select>
        <div class="chips">
          ${[["all", "Tất cả"], ["low", "Sắp hết"], ["exp", "Hạn dùng"], ["ok", "Ổn định"]].map(([k, l]) => `<button class="chip ${state.ui.chip === k ? "on" : ""}" data-action="chip" data-value="${k}">${l}</button>`).join("")}
        </div>
      </div>
      <div class="med-list">${listed.rows.map((m) => {
          const trade = PharmaMedicines.tradeOf(m);
          const [cls, label] = trade[2] === "discontinued" ? trade : medStatus(m);
          const extra = [m.activeIngredient, m.strength].filter(Boolean).join(" ");
          const maker = m.supplier || PharmaCatalog.label(state.db.manufacturers, m.manufacturerId);
          return `<article class="med-row">
            <div class="med-main">
              <div class="med-head"><b>${esc(m.name)}</b><span class="badge-pill ${cls}">${label}</span></div>
              <div class="tiny muted">${esc(m.code || m.sku)}${extra ? " · " + esc(extra) : ""}${m.batch ? " · Lô " + esc(m.batch) : ""}</div>
              <dl class="med-facts">
                <div><dt>Danh mục</dt><dd>${esc(m.category || "—")}</dd></div>
                <div><dt>Nhà sản xuất</dt><dd>${esc(maker || "—")}</dd></div>
                <div><dt>Chi nhánh</dt><dd>${esc(branchName(m.branchId) || "—")}</dd></div>
                <div><dt>Tồn</dt><dd>${m.stock} ${esc(m.unit || "")}</dd></div>
                <div><dt>Hạn dùng</dt><dd>${m.expiry ? dateLabel(m.expiry) : "—"}</dd></div>
                <div><dt>Giá bán</dt><dd>${money(m.price)}</dd></div>
              </dl>
            </div>
            ${medActions(m, canEdit)}
          </article>`;
        }).join("") || `<div class="empty">Chưa có thuốc trong kho</div>`}</div>
      ${pagerBar(listed, "med-page")}`;
  }

  function viewCategories() {
    const canEdit = PharmaRbac.can(state.db, me(), "inventory.edit");
    const listed = PharmaCatalog.queryList(state.db.categories, { q: state.ui.qCat, page: state.ui.catPage });
    state.ui.catPage = listed.page;
    return `
      <div class="page-head"><div><h1>Danh mục thuốc</h1><p>${listed.total} danh mục</p></div>
        ${canEdit ? `<button class="btn" data-action="edit-category">${icon("plus")} Thêm danh mục</button>` : ""}
      </div>
      <div class="toolbar">
        <label class="search">${icon("search")}<input id="q-cat" placeholder="Tên danh mục" data-input="qCat" value="${esc(state.ui.qCat)}" /></label>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Danh mục</th><th>Số thuốc</th><th></th></tr></thead>
        <tbody>${listed.rows.map((c) => {
          const used = PharmaCatalog.usage(state.db.medicines, "categoryId", c.id);
          return `<tr>
            <td><b>${esc(c.name)}</b></td>
            <td>${used.count}</td>
            <td>${canEdit ? `<div class="action-row"><button class="btn sm ghost" data-action="edit-category" data-id="${c.id}">Sửa</button><button class="btn sm danger" data-action="delete-category" data-id="${c.id}">Xóa</button></div>` : ""}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="3"><div class="empty">Chưa có danh mục</div></td></tr>`}</tbody>
      </table></div>
      ${pagerBar(listed, "cat-page")}`;
  }

  function viewMakers() {
    const canEdit = PharmaRbac.can(state.db, me(), "inventory.edit");
    const listed = PharmaCatalog.queryList(state.db.manufacturers, {
      q: state.ui.qMaker,
      status: state.ui.makerStatus,
      page: state.ui.makerPage,
    });
    state.ui.makerPage = listed.page;
    const filters = [["all", "Tất cả"], ["active", "Đang hợp tác"], ["inactive", "Ngừng hợp tác"]];
    return `
      <div class="page-head"><div><h1>Nhà sản xuất</h1><p>${listed.total} nhà sản xuất</p></div>
        ${canEdit ? `<button class="btn" data-action="edit-maker">${icon("plus")} Thêm nhà sản xuất</button>` : ""}
      </div>
      <div class="toolbar">
        <label class="search">${icon("search")}<input id="q-maker" placeholder="Tên hoặc điện thoại" data-input="qMaker" value="${esc(state.ui.qMaker)}" /></label>
        <div class="chips">${filters.map(([k, l]) => `<button class="chip ${state.ui.makerStatus === k ? "on" : ""}" data-action="maker-filter" data-value="${k}">${l}</button>`).join("")}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nhà sản xuất</th><th>Điện thoại</th><th>Quốc gia</th><th>Trạng thái</th><th>Số thuốc</th><th></th></tr></thead>
        <tbody>${listed.rows.map((m) => {
          const used = PharmaCatalog.usage(state.db.medicines, "manufacturerId", m.id);
          const on = (m.status || "active") === "active";
          return `<tr>
            <td><b>${esc(m.name)}</b></td>
            <td>${esc(m.phone || "—")}</td>
            <td>${esc(m.country || "—")}</td>
            <td><span class="badge-pill ${on ? "ok" : "neutral"}">${on ? "Đang hợp tác" : "Ngừng hợp tác"}</span></td>
            <td>${used.count}</td>
            <td>${canEdit ? `<div class="action-row"><button class="btn sm ghost" data-action="edit-maker" data-id="${m.id}">Sửa</button><button class="btn sm ghost" data-action="maker-status" data-id="${m.id}">${on ? "Ngừng hợp tác" : "Kích hoạt"}</button><button class="btn sm danger" data-action="delete-maker" data-id="${m.id}">Xóa</button></div>` : ""}</td>
          </tr>`;
        }).join("") || `<tr><td colspan="6"><div class="empty">Chưa có nhà sản xuất</div></td></tr>`}</tbody>
      </table></div>
      ${pagerBar(listed, "maker-page")}`;
  }

  function viewMeasures() {
    const canEdit = PharmaRbac.can(state.db, me(), "inventory.edit");
    const units = PharmaCatalog.queryList(state.db.units, { q: state.ui.qUnit, page: state.ui.unitPage });
    const forms = PharmaCatalog.queryList(state.db.dosageForms, { q: state.ui.qForm, page: state.ui.formPage });
    state.ui.unitPage = units.page;
    state.ui.formPage = forms.page;
    const unitRows = units.rows.map((u) => {
      const used = PharmaCatalog.usage(state.db.medicines, "unitId", u.id);
      const del = canEdit && !u.builtin ? `<button class="btn sm danger" data-action="delete-unit" data-id="${u.id}">Xóa</button>` : "";
      return `<tr><td><b>${esc(u.name)}</b></td><td>${used.count}</td><td>${canEdit ? `<div class="action-row"><button class="btn sm ghost" data-action="edit-unit" data-id="${u.id}">Sửa</button>${del}</div>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="3"><div class="empty">Chưa có đơn vị</div></td></tr>`;
    const formRows = forms.rows.map((f) => {
      const used = PharmaCatalog.usage(state.db.medicines, "dosageFormId", f.id);
      const del = canEdit && !f.builtin ? `<button class="btn sm danger" data-action="delete-form" data-id="${f.id}">Xóa</button>` : "";
      return `<tr><td><b>${esc(f.name)}</b></td><td>${used.count}</td><td>${canEdit ? `<div class="action-row"><button class="btn sm ghost" data-action="edit-form" data-id="${f.id}">Sửa</button>${del}</div>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="3"><div class="empty">Chưa có dạng bào chế</div></td></tr>`;
    return `
      <div class="page-head"><div><h1>Đơn vị tính & dạng bào chế</h1><p>Gán cho thuốc khi thêm hoặc sửa</p></div></div>
      <div class="stack-gap">
        <section class="card">
          <div class="page-head"><div><h3>Đơn vị tính</h3><p class="tiny muted">${units.total} đơn vị</p></div>
            ${canEdit ? `<button class="btn sm" data-action="edit-unit">${icon("plus")} Thêm đơn vị</button>` : ""}
          </div>
          <label class="search">${icon("search")}<input id="q-unit" placeholder="Tên đơn vị" data-input="qUnit" value="${esc(state.ui.qUnit)}" /></label>
          <div class="table-wrap" style="margin-top:12px"><table>
            <thead><tr><th>Đơn vị</th><th>Số thuốc</th><th></th></tr></thead>
            <tbody>${unitRows}</tbody>
          </table></div>
          ${pagerBar(units, "unit-page")}
        </section>
        <section class="card">
          <div class="page-head"><div><h3>Dạng bào chế</h3><p class="tiny muted">${forms.total} dạng</p></div>
            ${canEdit ? `<button class="btn sm" data-action="edit-form">${icon("plus")} Thêm dạng</button>` : ""}
          </div>
          <label class="search">${icon("search")}<input id="q-form" placeholder="Tên dạng bào chế" data-input="qForm" value="${esc(state.ui.qForm)}" /></label>
          <div class="table-wrap" style="margin-top:12px"><table>
            <thead><tr><th>Dạng bào chế</th><th>Số thuốc</th><th></th></tr></thead>
            <tbody>${formRows}</tbody>
          </table></div>
          ${pagerBar(forms, "form-page")}
        </section>
      </div>`;
  }

  function viewSales() {
    return PharmaSalesPages.page(saleHost());
  }

  function viewAlerts() {
    return PharmaInventoryPages.alertPage(inventoryHost());
  }

  function viewReports() {
    return PharmaReportPages.page(reportHost());
  }

  function viewStaff() {
    const user = me();
    const listed = PharmaStaff.query(state.db.users, {
      viewer: user,
      q: state.ui.qStaff,
      branchId: state.ui.staffBranch,
      role: state.ui.staffRole,
      page: state.ui.staffPage,
    });
    state.ui.staffPage = listed.page;
    const roles = (state.db.roles || []).filter((role) => role.status !== "inactive" && role.id !== "customer");
    const roleFilters = [["all", "Tất cả vai trò"]].concat(roles.map((role) => [role.id, role.name]));
    const branchFilter = user.role === "admin" || user.preview
      ? `<select class="select" data-change="staff-branch"><option value="all">Mọi chi nhánh</option>${state.db.branches.map((b) => `<option value="${b.id}" ${state.ui.staffBranch === b.id ? "selected" : ""}>${esc(b.short || b.name)}</option>`).join("")}</select>`
      : "";
    return `
      <div class="page-head"><div><h1>Nhân sự & phân quyền</h1><p>${listed.total} nhân sự trong bộ lọc hiện tại</p></div>
        ${PharmaRbac.can(state.db, user, "account.create") ? `<button class="btn" data-action="edit-staff">${icon("plus")} Thêm nhân sự</button>` : ""}
      </div>
      <div class="toolbar">
        <label class="search">${icon("search")}<input id="q-staff" placeholder="Tên hoặc email" data-input="qStaff" value="${esc(state.ui.qStaff)}" /></label>
        ${branchFilter}
        <div class="chips">${roleFilters.map(([k, l]) => `<button class="chip ${state.ui.staffRole === k ? "on" : ""}" data-action="staff-role" data-value="${k}">${esc(l)}</button>`).join("")}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nhân sự</th><th>Vai trò</th><th>Chi nhánh</th><th>Điện thoại</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${listed.rows.map((u) => `<tr>
          <td><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.email)}</div></td>
          <td><span class="badge-pill info">${esc(roleLabel(u.role))}</span></td>
          <td>${u.branchId === "all" ? "Toàn hệ thống" : esc(branchName(u.branchId))}</td>
          <td>${esc(u.phone)}</td>
          <td><span class="badge-pill ${u.status === "active" ? "ok" : "neutral"}">${u.status === "active" ? "Đang làm" : "Tạm khóa"}</span></td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn sm soft" data-action="open-staff" data-id="${u.id}">Chi tiết</button>
            ${PharmaStaff.canMove(user, u) ? `<button class="btn sm ghost" data-action="assign-staff" data-id="${u.id}">Phân công</button><button class="btn sm ghost" data-action="transfer-staff" data-id="${u.id}">Điều chuyển</button>` : ""}
            ${accountButtons(user, u)}
          </div></td>
        </tr>`).join("") || `<tr><td colspan="6"><div class="empty">Không có nhân sự khớp bộ lọc.</div></td></tr>`}</tbody>
      </table></div>
      ${pagerBar(listed, "staff-page")}`;
  }

  function viewNotes() {
    const list = state.db.notifications.filter((n) => state.ui.notiChip === "all" || (state.ui.notiChip === "unread" ? !n.read : n.type === state.ui.notiChip));
    return `
      <div class="page-head"><div><h1>Thông báo</h1><p>Cập nhật kho, hạn dùng và vận hành. Chỉ xóa được thông báo đã đọc.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" data-action="read-all">Đánh dấu đã đọc</button>
          <button class="btn ghost" data-action="delete-read">Xóa đã đọc</button>
        </div>
      </div>
      <div class="chips" style="margin-bottom:14px">
        ${[["all", "Tất cả"], ["unread", "Chưa đọc"], ["stock", "Kho"], ["expiry", "Hạn dùng"], ["system", "Hệ thống"]].map(([k, l]) => `<button class="chip ${state.ui.notiChip === k ? "on" : ""}" data-action="noti-chip" data-value="${k}">${l}</button>`).join("")}
      </div>
      <div class="list">${list.map((n) => `<article class="row-item" data-action="read-one" data-id="${n.id}" style="${n.read ? "" : "border-color:#93c5fd"}"><div><span class="badge-pill ${n.priority === "high" ? "bad" : n.priority === "medium" ? "warn" : "info"}">${n.priority === "high" ? "Cao" : n.priority === "medium" ? "Vừa" : "Thấp"}</span><div style="margin-top:6px"><b>${esc(n.title)}</b></div><div class="tiny">${esc(n.body)}</div><div class="tiny muted">${timeLabel(n.at)}</div></div>${n.read ? `<button type="button" class="btn sm ghost" data-action="delete-note" data-id="${n.id}">Xóa</button>` : `<span class="badge">Mới</span>`}</article>`).join("") || `<div class="card empty">Không có thông báo</div>`}</div>`;
  }

  function viewSettings() {
    const user = me();
    const s = state.db.settings;
    return `
      <div class="page-head"><div><h1>${user.role === "customer" ? "Tài khoản cửa hàng" : "Cài đặt"}</h1><p>Hồ sơ, giao diện và bảo mật tài khoản</p></div></div>
      <div class="settings-grid">
        <section class="card profile">
          <div class="avatar">${esc(user.name.split(" ").slice(-1)[0][0])}</div>
          <h2 style="margin:0">${esc(user.name)}</h2>
          <p>${esc(user.title)} · ${esc(roleLabel(user.role))}</p>
          <p>${esc(user.email)}<br/>${esc(user.phone)}</p>
        </section>
        <div>
          <section class="card">
            <h3>Thông tin cá nhân</h3>
            <form data-form="profile">
              ${field("Họ tên", "name", user.name)}
              ${field("Email", "email", user.email)}
              ${field("Điện thoại", "phone", user.phone)}
              ${user.role === "customer" ? "" : field("Chức danh", "title", user.title)}
              <button class="btn" type="submit">Lưu thông tin</button>
            </form>
          </section>
          ${user.role === "customer" ? "" : `<section class="card" style="margin-top:14px">
            <h3>Ứng dụng</h3>
            <div class="toggle"><div><b>Giao diện tối</b><div class="tiny muted">Dùng nền tối cho ca đêm</div></div><button class="switch ${state.theme === "dark" ? "on" : ""}" data-action="theme"><i></i></button></div>
            <div class="toggle"><div><b>Email cảnh báo</b><div class="tiny muted">Gửi tóm tắt mỗi sáng</div></div><button class="switch ${s.emailAlert ? "on" : ""}" data-action="setting" data-key="emailAlert"><i></i></button></div>
            <div class="toggle"><div><b>Cảnh báo tồn kho</b><div class="tiny muted">Hiện khi dưới mức tối thiểu</div></div><button class="switch ${s.stockAlert ? "on" : ""}" data-action="setting" data-key="stockAlert"><i></i></button></div>
            <div class="toggle"><div><b>Cảnh báo hạn dùng</b><div class="tiny muted">Nhắc trước 45 ngày</div></div><button class="switch ${s.expiryAlert ? "on" : ""}" data-action="setting" data-key="expiryAlert"><i></i></button></div>
          </section>`}
          <section class="card" style="margin-top:14px">
            <h3>Bảo mật & hỗ trợ</h3>
            <div class="session-note"><b>Phiên đăng nhập</b><div class="tiny">${sessionNote()}</div></div>
            <div class="row-item" style="margin-top:8px"><div><b>Đổi mật khẩu</b><div class="tiny muted">Mật khẩu được băm trước khi lưu trên trình duyệt này</div></div><button class="btn sm ghost" data-action="open-password">Đổi</button></div>
            <div class="row-item" style="margin-top:8px"><div><b>Hotline vận hành</b><div class="tiny muted">1900 636 888 · support@pharmacare.vn</div></div></div>
            <div style="margin-top:14px">
              <button class="btn danger" data-action="logout">Đăng xuất</button>
            </div>
          </section>
        </div>
      </div>`;
  }

  function sessionNote() {
    const live = PharmaSession.status(state.session, Date.now());
    if (!live.ok) return "Không có phiên hợp lệ.";
    const until = new Date(live.session.expiresAt).toLocaleString("vi-VN");
    return (live.session.remember ? "Đang ghi nhớ 7 ngày" : "Phiên ngắn 8 giờ") + " · hết hạn " + until;
  }

  function field(label, name, value, extra = "", type = "text") {
    return `<div class="field ${extra}"><div class="field-head"><span>${label}</span></div><label class="control"><input name="${name}" type="${esc(type)}" value="${esc(value ?? "")}" autocomplete="off" /></label></div>`;
  }

  function choiceOptions(items, value, placeholder) {
    const head = `<option value="">${esc(placeholder || "Chọn")}</option>`;
    return head + items.map((item) => `<option value="${esc(item.id)}" ${item.id === value ? "selected" : ""}>${esc(item.name)}</option>`).join("");
  }

  function selectField(label, name, html, extra) {
    return `<div class="field ${extra || ""}"><div class="field-head"><span>${label}</span></div><label class="control"><select name="${name}">${html}</select></label></div>`;
  }

  function medFacts(med) {
    const trade = PharmaMedicines.tradeOf(med);
    const [stockCls, stockLabel] = medStatus(med);
    const lots = PharmaMedicines.lotsOf(med);
    const rows = [
      ["Mã thuốc", med.code || med.sku || "—"],
      ["Hoạt chất", med.activeIngredient || "—"],
      ["Hàm lượng", med.strength || "—"],
      ["Dạng bào chế", med.dosageForm || PharmaCatalog.label(state.db.dosageForms, med.dosageFormId) || "—"],
      ["Danh mục", med.category || "—"],
      ["Nhà sản xuất", med.supplier || PharmaCatalog.label(state.db.manufacturers, med.manufacturerId) || "—"],
      ["Đơn vị tính", med.unit || "—"],
      ["Chi nhánh", branchName(med.branchId) || "—"],
      ["Giá nhập", money(med.cost)],
      ["Giá bán", money(med.price)],
      ["Tồn kho", `${med.stock} ${med.unit || ""}`.trim()],
      ["Tồn tối thiểu", String(med.minStock ?? "—")],
    ];
    const canEdit = PharmaRbac.can(state.db, me(), "inventory.edit");
    return `<h3>${esc(med.name)}</h3>
      <div class="action-row" style="margin-bottom:12px"><span class="badge-pill ${trade[0]}">${trade[1]}</span><span class="badge-pill ${stockCls}">${stockLabel}</span></div>
      <dl class="detail-grid">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <h3>Lô thuốc</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Số lô</th><th>Hạn sử dụng</th><th>Số lượng</th></tr></thead>
        <tbody>${lots.map((lot) => `<tr><td>${esc(lot.batch)}</td><td>${lot.expiry ? dateLabel(lot.expiry) : "—"}</td><td>${lot.qty ?? "—"}</td></tr>`).join("") || `<tr><td colspan="3"><div class="empty">Chưa có lô</div></td></tr>`}</tbody>
      </table></div>
      <div class="action-row" style="margin-top:12px;justify-content:flex-end">${canEdit ? `<button class="btn ghost" data-action="edit-med" data-id="${med.id}">Sửa</button>` : ""}<button class="btn" data-action="close">Đóng</button></div>`;
  }

  function supplyHost() {
    const user = me();
    return {
      state,
      db: state.db,
      ui: state.ui,
      user,
      canEdit: PharmaRbac.can(state.db, user, "supply.edit"),
      esc,
      money,
      dateLabel,
      timeLabel,
      icon,
      pagerBar,
      branchName,
      today: todayStr(),
      persist,
      toast,
      render,
    };
  }

  function saleHost() {
    const user = me();
    return {
      state,
      db: state.db,
      ui: state.ui,
      user,
      canSell: PharmaRbac.can(state.db, user, "sale.create"),
      esc,
      money,
      dateLabel,
      timeLabel,
      icon,
      pagerBar,
      branchName,
      today: todayStr(),
      persist,
      toast,
      render,
      operating: (branch) => PharmaBranches.isOperating(branch),
    };
  }

  function inventoryHost() {
    const user = me();
    return {
      state,
      db: state.db,
      ui: state.ui,
      user,
      canEdit: PharmaRbac.can(state.db, user, "inventory.edit"),
      esc,
      money,
      dateLabel,
      timeLabel,
      icon,
      pagerBar,
      branchName,
      today: todayStr(),
      persist,
      toast,
      render,
    };
  }

  function customerHost() {
    const user = me();
    return {
      state,
      db: state.db,
      ui: state.ui,
      user,
      canEdit: PharmaRbac.can(state.db, user, "customer.edit"),
      canAssign: PharmaRbac.can(state.db, user, "customer.assign"),
      canRole: PharmaRbac.can(state.db, user, "customer.role"),
      canLock: PharmaRbac.can(state.db, user, "account.lock"),
      canDelete: PharmaRbac.can(state.db, user, "account.delete"),
      esc,
      money,
      dateLabel,
      timeLabel,
      icon,
      pagerBar,
      branchName,
      today: todayStr(),
      persist,
      toast,
      render,
    };
  }

  function homeHost() {
    const user = me();
    return {
      db: state.db,
      ui: state.ui,
      user,
      esc,
      money,
      dateLabel,
      icon,
      render,
      go,
      toast,
      allowed,
      lockup: brandLockup,
      branchName,
      theme: state.theme,
      today: todayStr(),
    };
  }

  function storeHost() {
    const user = me();
    return {
      state,
      db: state.db,
      ui: state.ui,
      user,
      esc,
      money,
      dateLabel,
      timeLabel,
      icon,
      pagerBar,
      branchName,
      today: todayStr(),
      persist,
      toast,
      render,
    };
  }

  function reportHost() {
    const user = me();
    return {
      state,
      db: state.db,
      ui: state.ui,
      user,
      esc,
      money,
      dateLabel,
      timeLabel,
      icon,
      pagerBar,
      branchName,
      today: todayStr(),
      persist,
      toast,
      render,
    };
  }

  function modal() {
    const m = state.ui.modal;
    if (window.PharmaStorePages) {
      const storeBody = PharmaStorePages.modalBody(m, storeHost());
      if (storeBody !== null) {
        return `<div class="modal-back"><div class="modal-card">${storeBody}</div></div>`;
      }
    }
    if (window.PharmaCustomerPages) {
      const customerBody = PharmaCustomerPages.modalBody(m, customerHost());
      if (customerBody !== null) {
        const wide = m.type === "customer-view";
        return `<div class="modal-back"><div class="modal-card ${wide ? "wide" : ""}">${customerBody}</div></div>`;
      }
    }
    if (window.PharmaInventoryPages) {
      const inventoryBody = PharmaInventoryPages.modalBody(m, inventoryHost());
      if (inventoryBody !== null) {
        return `<div class="modal-back"><div class="modal-card">${inventoryBody}</div></div>`;
      }
    }
    if (window.PharmaSupplyPages) {
      const supplyBody = PharmaSupplyPages.modalBody(m, supplyHost());
      if (supplyBody !== null) {
        const wide = m.type === "supplier-view" || m.type === "receipt-view" || m.type === "confirm-receipt";
        return `<div class="modal-back"><div class="modal-card ${wide ? "wide" : ""}">${supplyBody}</div></div>`;
      }
    }
    if (window.PharmaSalesPages) {
      const salesBody = PharmaSalesPages.modalBody(m, saleHost());
      if (salesBody !== null) {
        const wide = m.type === "invoice" || m.type === "checkout-sale";
        return `<div class="modal-back"><div class="modal-card ${wide ? "wide" : ""}">${salesBody}</div></div>`;
      }
    }
    let body = "";
    if (m.type === "branch") {
      const found = m.id ? state.db.branches.find((x) => x.id === m.id) : null;
      const b = Object.assign({ name: "", address: "", phone: "", email: "", contact: "", manager: "", hours: "08:00 – 21:00", status: "open" }, found || {}, m.draft || {});
      body = `<h3>${m.id ? "Sửa chi nhánh" : "Thêm chi nhánh"}</h3><form data-form="branch">
        <input type="hidden" name="id" value="${esc(m.id || "")}" />
        <div class="form-grid">
          ${field("Tên", "name", b.name, "full")}
          ${field("Địa chỉ", "address", b.address, "full")}${field("Điện thoại", "phone", b.phone)}${field("Giờ mở cửa", "hours", b.hours)}
          ${field("Email liên hệ", "email", b.email || "")}${field("Người liên hệ", "contact", b.contact || "")}
          <div class="field"><div class="field-head"><span>Trạng thái</span></div><label class="control"><select name="status"><option value="open" ${b.status === "open" ? "selected" : ""}>Đang mở</option><option value="maintenance" ${b.status === "maintenance" ? "selected" : ""}>Bảo trì</option><option value="closed" ${b.status === "closed" ? "selected" : ""}>Ngừng hoạt động</option></select></label></div>
        </div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu</button></div></form>`;
    } else if (m.type === "branch-view") {
      const b = state.db.branches.find((x) => x.id === m.id);
      const order = { manager: 0, pharmacist: 1, cashier: 2 };
      const viewer = me();
      const check = b ? PharmaBranches.inspect(b) : { ok: false, missing: ["chi nhánh"] };
      const staff = b ? state.db.users.filter((u) => u.branchId === b.id && u.role !== "customer").sort((a, c) => (order[a.role] ?? 9) - (order[c.role] ?? 9) || a.name.localeCompare(c.name, "vi")) : [];
      const rows = staff.map((u) => `<tr>
        <td><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.email)}</div></td>
        <td><span class="badge-pill info">${esc(roleLabel(u.role))}</span></td>
        <td>${esc(u.phone || "—")}</td>
        <td><span class="badge-pill ${u.status === "active" ? "ok" : "neutral"}">${u.status === "active" ? "Đang làm" : "Tạm khóa"}</span></td>
        <td>${accountButtons(viewer, u)}</td>
      </tr>`).join("");
      body = b ? `<h3>${esc(b.name)} ${branchPill(b.status)}</h3>
        <p class="muted">${esc(b.address)}<br/>${esc(b.phone)} · ${esc(b.hours)}<br/>${esc(b.contact || "Chưa có người liên hệ")} · ${esc(b.email || "Chưa có email")}</p>
        ${check.ok ? `<p class="note">Dữ liệu chi tiết đủ để vận hành.</p>` : `<p class="note">Thiếu dữ liệu: ${esc(check.missing.join(", "))}.</p>`}
        <h3 style="margin-top:16px">Nhân viên (${staff.length})</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Điện thoại</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5"><div class="empty">Chưa có nhân viên tại chi nhánh này.</div></td></tr>`}</tbody>
        </table></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">${me().role === "admin" ? `<button class="btn" data-action="employee-account" data-id="${b.id}">Tạo nhân viên</button><button class="btn" data-action="manager-account" data-id="${b.id}">Tạo quản lý</button><button class="btn danger" data-action="delete-branch" data-id="${b.id}">Xóa</button>` : ""}<button class="btn ghost" data-action="close">Đóng</button></div>` : "";
    } else if (m.type === "branch-contact") {
      const b = state.db.branches.find((x) => x.id === m.id);
      const contact = Object.assign({}, b || {}, m.draft || {});
      body = b ? `<h3>Liên hệ ${esc(b.name)}</h3><form data-form="branch-contact">
        <input type="hidden" name="id" value="${esc(b.id)}" />
        <div class="form-grid">
          ${field("Người liên hệ", "contact", contact.contact || "", "full")}
          ${field("Điện thoại", "phone", contact.phone)}${field("Email", "email", contact.email || "")}
          ${field("Địa chỉ", "address", contact.address, "full")}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu liên hệ</button></div>
      </form>` : "";
    } else if (m.type === "staff-view") {
      const u = state.db.users.find((x) => x.id === m.id);
      const check = PharmaStaff.inspect(u);
      const history = u && u.transfers ? u.transfers : [];
      body = u ? `<h3>${esc(u.name)}</h3>
        <p class="muted">${esc(u.email)}<br/>${esc(u.phone || "Chưa có điện thoại")} · ${esc(u.title || roleLabel(u.role))}</p>
        <div class="meta">
          <div><span class="tiny muted">Vai trò</span><b>${esc(roleLabel(u.role))}</b></div>
          <div><span class="tiny muted">Chi nhánh</span><b>${u.branchId === "all" ? "Toàn hệ thống" : esc(branchName(u.branchId) || "Chưa phân công")}</b></div>
          <div><span class="tiny muted">Trạng thái</span><b>${u.status === "active" ? "Đang làm" : "Tạm khóa"}</b></div>
        </div>
        ${check.ok ? `<p class="note">Hồ sơ đủ họ tên, email, điện thoại, vai trò và chi nhánh.</p>` : `<p class="note">Thiếu dữ liệu: ${esc(check.missing.join(", "))}.</p>`}
        <h3 style="margin-top:16px">Phân công gần đây</h3>
        <div class="list">${history.length ? history.slice(0, 5).map((item) => `<div class="row-item"><div><b>${item.kind === "transfer" ? "Điều chuyển" : "Phân công"}</b><div class="tiny muted">${esc(branchName(item.from) || "Chưa gắn")} → ${esc(branchName(item.to) || item.to)} · ${timeLabel(item.at)}</div></div></div>`).join("") : `<div class="empty">Chưa có lần phân công nào.</div>`}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">
          ${PharmaStaff.canMove(me(), u) ? `<button class="btn" data-action="assign-staff" data-id="${u.id}">Phân công</button><button class="btn ghost" data-action="transfer-staff" data-id="${u.id}">Điều chuyển</button>` : ""}
          <button class="btn ghost" data-action="close">Đóng</button>
        </div>` : "";
    } else if (m.type === "staff-move") {
      const u = state.db.users.find((x) => x.id === m.id);
      const choices = state.db.branches.filter((b) => b.status !== "closed" && (!u || b.id !== u.branchId));
      const title = m.mode === "transfer" ? "Điều chuyển nhân viên" : "Phân công nhân viên";
      body = u ? `<h3>${title}</h3><p class="muted">${esc(u.name)} đang ở ${u.branchId === "all" ? "toàn hệ thống" : esc(branchName(u.branchId) || "chưa gắn chi nhánh")}.</p>
        ${choices.length ? `<form data-form="staff-move"><input type="hidden" name="id" value="${esc(u.id)}" /><input type="hidden" name="mode" value="${m.mode === "transfer" ? "transfer" : "assign"}" />
        <div class="field"><div class="field-head"><span>Chi nhánh mới</span></div><label class="control"><select name="branchId">${choices.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></label></div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu</button></div></form>` : `<p>Không còn chi nhánh đang hoạt động để chuyển tới.</p><div style="text-align:right"><button class="btn" data-action="close">Đóng</button></div>`}` : "";
    } else if (m.type === "delete-branch") {
      const b = state.db.branches.find((x) => x.id === m.id);
      const bound = b ? PharmaBranches.constraints(state.db, b.id) : null;
      const boundText = bound && bound.blocked
        ? `Đang gắn ${bound.medicines} thuốc, ${bound.sales} hóa đơn và ${bound.staff} nhân sự. Các dữ liệu này sẽ bị xóa theo.`
        : "Chi nhánh chưa phát sinh thuốc, hóa đơn hoặc nhân sự.";
      body = b ? `<h3>Xóa chi nhánh</h3><p>Xóa <b>${esc(b.name)}</b>? ${boundText}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button type="button" class="btn danger" data-action="confirm-delete-branch" data-id="${esc(b.id)}">Xóa chi nhánh</button></div>` : "";
    } else if (m.type === "manager-account") {
      const b = state.db.branches.find((x) => x.id === m.id);
      const existing = state.db.users.filter((u) => u.branchId === b.id && u.role === "manager");
      body = `<h3>Tài khoản quản lý</h3><p class="muted">Chỉ quản trị tạo được tài khoản quản lý cho ${esc(b.name)}.</p>
        ${existing.length ? `<p class="tiny muted">Đã có: ${existing.map((u) => esc(u.name + " · " + u.email)).join(", ")}</p>` : ""}
        <form data-form="manager"><input type="hidden" name="branchId" value="${esc(b.id)}" />
        <div class="form-grid">
          ${field("Họ tên", "name", b.manager || "")}${field("Email", "email", "")}${field("Điện thoại", "phone", "")}${field("Mật khẩu", "password", "", "", "password")}
          <div class="field"><div class="field-head"><span>Vai trò</span></div><label class="control"><input value="Quản lý" disabled /></label></div>
          <div class="field"><div class="field-head"><span>Chi nhánh</span></div><label class="control"><input value="${esc(b.name)}" disabled /></label></div>
        </div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Tạo tài khoản</button></div></form>`;
    } else if (m.type === "employee-account") {
      const b = state.db.branches.find((x) => x.id === m.id);
      body = `<h3>Tài khoản nhân viên</h3><p class="muted">Quản trị tạo nhân viên cho ${esc(b.name)}.</p>
        <form data-form="employee"><input type="hidden" name="branchId" value="${esc(b.id)}" />
        <div class="form-grid">
          ${field("Họ tên", "name", "")}${field("Email", "email", "")}${field("Điện thoại", "phone", "")}${field("Mật khẩu", "password", "", "", "password")}
          <div class="field"><div class="field-head"><span>Vai trò</span></div><label class="control"><select name="role"><option value="pharmacist">Dược sĩ</option><option value="cashier">Thu ngân</option></select></label></div>
          <div class="field"><div class="field-head"><span>Chi nhánh</span></div><label class="control"><input value="${esc(b.name)}" disabled /></label></div>
        </div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Tạo tài khoản</button></div></form>`;
    } else if (m.type === "delete-user") {
      const u = state.db.users.find((x) => x.id === m.id);
      body = u ? `<h3>Xóa tài khoản</h3><p>Xóa tài khoản <b>${esc(u.name)}</b>? Người này sẽ không đăng nhập được nữa.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button type="button" class="btn danger" data-action="confirm-delete-user" data-id="${esc(u.id)}">Xóa tài khoản</button></div>` : "";
    } else if (m.type === "med") {
      const branches = (me().role === "admin" ? state.db.branches : state.db.branches.filter((b) => b.id === me().branchId));
      const existing = m.id ? state.db.medicines.find((x) => x.id === m.id) : null;
      if (!branches.length) {
        body = `<h3>${existing ? "Sửa thuốc" : "Thêm thuốc"}</h3><p class="muted">Chưa có chi nhánh. Hãy thêm chi nhánh trước khi nhập thuốc.</p><div style="text-align:right"><button class="btn" data-action="close">Đóng</button></div>`;
      } else if (!existing && (!state.db.categories.length || !state.db.manufacturers.length)) {
        body = `<h3>Thêm thuốc</h3><p class="muted">Cần có ít nhất một danh mục và một nhà sản xuất trước khi thêm thuốc.</p><div class="action-row" style="justify-content:flex-end"><button class="btn ghost" data-action="catalog-tab" data-value="category">Tới danh mục</button><button class="btn" data-action="catalog-tab" data-value="maker">Tới nhà sản xuất</button></div>`;
      } else {
        const draft = Object.assign({
          name: "", code: "", activeIngredient: "", strength: "", dosageFormId: "", categoryId: "",
          unitId: "", manufacturerId: "", cost: "", price: "", minStock: "10", stock: "0",
          expiry: PharmaSeed.day(180), batch: "", branchId: "", status: "active",
        }, existing || {}, m.draft || {});
        if (!draft.code) draft.code = (existing && existing.sku) || PharmaMedicines.nextCode(state.db.medicines);
        if (!draft.branchId) draft.branchId = me().role === "admin" ? branches[0].id : me().branchId;
        const makers = state.db.manufacturers.filter((item) => item.status !== "inactive" || item.id === draft.manufacturerId);
        body = `<h3>${existing ? "Sửa thuốc" : "Thêm thuốc"}</h3><form data-form="med"><input type="hidden" name="id" value="${esc(m.id || "")}" /><div class="form-grid">
          ${field("Tên thuốc", "name", draft.name, "full")}
          <div class="field"><div class="field-head"><span>Mã thuốc</span><button type="button" class="linkish" data-action="gen-code">Tạo mã</button></div><label class="control"><input name="code" value="${esc(draft.code)}" autocomplete="off" /></label></div>
          ${field("Hoạt chất", "activeIngredient", draft.activeIngredient)}
          ${field("Hàm lượng", "strength", draft.strength)}
          ${selectField("Dạng bào chế", "dosageFormId", choiceOptions(state.db.dosageForms, draft.dosageFormId, "Chọn dạng"))}
          ${selectField("Danh mục", "categoryId", choiceOptions(state.db.categories, draft.categoryId, "Chọn danh mục"))}
          ${selectField("Đơn vị tính", "unitId", choiceOptions(state.db.units, draft.unitId, "Chọn đơn vị"))}
          ${selectField("Nhà sản xuất", "manufacturerId", choiceOptions(makers, draft.manufacturerId, "Chọn nhà sản xuất"))}
          ${field("Giá nhập", "cost", draft.cost, "", "number")}
          ${field("Giá bán", "price", draft.price, "", "number")}
          ${field("Tồn tối thiểu", "minStock", draft.minStock, "", "number")}
          ${existing ? "" : field("Tồn đầu", "stock", draft.stock, "", "number")}
          ${field("Hạn sử dụng", "expiry", draft.expiry, "", "date")}
          ${field("Số lô", "batch", draft.batch)}
          ${selectField("Trạng thái", "status", `<option value="active" ${draft.status !== "discontinued" ? "selected" : ""}>Đang kinh doanh</option><option value="discontinued" ${draft.status === "discontinued" ? "selected" : ""}>Ngừng kinh doanh</option>`)}
          <div class="field full"><div class="field-head"><span>Chi nhánh</span></div><label class="control"><select name="branchId">${branches.map((b) => `<option value="${esc(b.id)}" ${draft.branchId === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label></div>
        </div><p class="tiny muted">Mã viết hoa, 2–20 ký tự. Hàm lượng dạng 500mg, 5ml hoặc 10%. Giá bán không thấp hơn giá nhập.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn">Lưu</button></div></form>`;
      }
    } else if (m.type === "med-view") {
      const med = state.db.medicines.find((x) => x.id === m.id);
      body = med ? medFacts(med) : `<h3>Thuốc</h3><p>Không tìm thấy thuốc.</p>`;
    } else if (m.type === "delete-med") {
      const med = state.db.medicines.find((x) => x.id === m.id);
      const related = med ? PharmaMedicines.relatedSales(state.db.sales, med.id) : { count: 0, blocked: false };
      body = med ? `<h3>Xóa thuốc</h3><p>Xóa <b>${esc(med.name)}</b>? ${related.blocked ? `Thuốc đang nằm trong ${related.count} dòng hóa đơn nên chưa xóa được.` : "Thuốc chưa phát sinh hóa đơn."}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>${related.blocked ? "" : `<button type="button" class="btn danger" data-action="confirm-delete-med" data-id="${esc(med.id)}">Xóa thuốc</button>`}</div>` : "";
    } else if (m.type === "stop-med") {
      const med = state.db.medicines.find((x) => x.id === m.id);
      const stopping = m.next !== "active";
      body = med ? `<h3>${stopping ? "Ngừng kinh doanh" : "Mở bán lại"}</h3><p><b>${esc(med.name)}</b> ${stopping ? "sẽ không bán được tại quầy." : "sẽ được đưa trở lại quầy bán nếu còn hàng và còn hạn."}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button type="button" class="btn" data-action="confirm-stop-med" data-id="${esc(med.id)}" data-next="${stopping ? "discontinued" : "active"}">${stopping ? "Ngừng bán" : "Mở bán"}</button></div>` : "";
    } else if (m.type === "category") {
      const found = m.id ? state.db.categories.find((x) => x.id === m.id) : null;
      const draft = Object.assign({ name: "" }, found || {}, m.draft || {});
      body = `<h3>${found ? "Sửa danh mục" : "Thêm danh mục"}</h3><form data-form="category"><input type="hidden" name="id" value="${esc(m.id || "")}" />${field("Tên danh mục", "name", draft.name, "full")}<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn">Lưu</button></div></form>`;
    } else if (m.type === "delete-category") {
      const cat = state.db.categories.find((x) => x.id === m.id);
      const used = cat ? PharmaCatalog.usage(state.db.medicines, "categoryId", cat.id) : { count: 0, blocked: false };
      body = cat ? `<h3>Xóa danh mục</h3><p>Xóa <b>${esc(cat.name)}</b>? ${used.blocked ? `Đang có ${used.count} thuốc thuộc danh mục này.` : "Danh mục chưa gắn thuốc."}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>${used.blocked ? "" : `<button type="button" class="btn danger" data-action="confirm-delete-category" data-id="${esc(cat.id)}">Xóa danh mục</button>`}</div>` : "";
    } else if (m.type === "manufacturer") {
      const found = m.id ? state.db.manufacturers.find((x) => x.id === m.id) : null;
      const draft = Object.assign({ name: "", phone: "", country: "", status: "active" }, found || {}, m.draft || {});
      body = `<h3>${found ? "Sửa nhà sản xuất" : "Thêm nhà sản xuất"}</h3><form data-form="manufacturer"><input type="hidden" name="id" value="${esc(m.id || "")}" /><div class="form-grid">
        ${field("Tên nhà sản xuất", "name", draft.name, "full")}${field("Điện thoại", "phone", draft.phone)}${field("Quốc gia", "country", draft.country)}
        <div class="field"><div class="field-head"><span>Trạng thái</span></div><label class="control"><select name="status"><option value="active" ${draft.status !== "inactive" ? "selected" : ""}>Đang hợp tác</option><option value="inactive" ${draft.status === "inactive" ? "selected" : ""}>Ngừng hợp tác</option></select></label></div>
      </div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn">Lưu</button></div></form>`;
    } else if (m.type === "delete-maker") {
      const maker = state.db.manufacturers.find((x) => x.id === m.id);
      const used = maker ? PharmaCatalog.usage(state.db.medicines, "manufacturerId", maker.id) : { count: 0, blocked: false };
      body = maker ? `<h3>Xóa nhà sản xuất</h3><p>Xóa <b>${esc(maker.name)}</b>? ${used.blocked ? `Đang có ${used.count} thuốc của nhà sản xuất này.` : "Chưa có thuốc gắn nhà sản xuất này."}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>${used.blocked ? "" : `<button type="button" class="btn danger" data-action="confirm-delete-maker" data-id="${esc(maker.id)}">Xóa nhà sản xuất</button>`}</div>` : "";
    } else if (m.type === "unit" || m.type === "dosage-form") {
      const list = m.type === "unit" ? state.db.units : state.db.dosageForms;
      const found = m.id ? list.find((x) => x.id === m.id) : null;
      const draft = Object.assign({ name: "" }, found || {}, m.draft || {});
      const title = m.type === "unit" ? (found ? "Sửa đơn vị tính" : "Thêm đơn vị tính") : (found ? "Sửa dạng bào chế" : "Thêm dạng bào chế");
      const formName = m.type === "unit" ? "unit" : "dosage-form";
      body = `<h3>${title}</h3><form data-form="${formName}"><input type="hidden" name="id" value="${esc(m.id || "")}" />${field("Tên", "name", draft.name, "full")}<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn">Lưu</button></div></form>`;
    } else if (m.type === "delete-unit" || m.type === "delete-form") {
      const unitMode = m.type === "delete-unit";
      const list = unitMode ? state.db.units : state.db.dosageForms;
      const item = list.find((x) => x.id === m.id);
      const used = item ? PharmaCatalog.usage(state.db.medicines, unitMode ? "unitId" : "dosageFormId", item.id) : { count: 0, blocked: false };
      const noun = unitMode ? "đơn vị tính" : "dạng bào chế";
      body = item ? `<h3>Xóa ${noun}</h3><p>Xóa <b>${esc(item.name)}</b>? ${item.builtin ? "Mục mặc định không xóa được." : used.blocked ? `Đang gán cho ${used.count} thuốc.` : "Chưa gán cho thuốc nào."}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>${item.builtin || used.blocked ? "" : `<button type="button" class="btn danger" data-action="${unitMode ? "confirm-delete-unit" : "confirm-delete-form"}" data-id="${esc(item.id)}">Xóa</button>`}</div>` : "";
    } else if (m.type === "stock") {
      const med = state.db.medicines.find((x) => x.id === m.id);
      body = `<h3>Điều chỉnh tồn kho</h3><p><b>${esc(med.name)}</b> · đang có ${med.stock} ${esc(med.unit)}</p>
        <form data-form="stock"><input type="hidden" name="id" value="${esc(med.id)}" />
        ${field("Số lượng cộng / trừ", "delta", "10")}${field("Lý do", "note", "Nhập bổ sung")}
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn">Cập nhật</button></div></form>`;
    } else if (m.type === "staff") {
      const u = state.db.users.find((x) => x.id === m.id) || { name: "", email: "", phone: "", role: "pharmacist", branchId: me().branchId === "all" ? (state.db.branches[0] ? state.db.branches[0].id : "all") : me().branchId, status: "active" };
      const catalog = (state.db.roles || []).filter((role) => role.status !== "inactive" && role.id !== "customer");
      const roleOpts = me().role === "admin" ? catalog.map((role) => role.id) : ["pharmacist", "cashier"];
      const branchOpts = me().role === "admin"
        ? `<option value="all" ${u.branchId === "all" ? "selected" : ""}>Toàn hệ thống</option>${state.db.branches.map((b) => `<option value="${b.id}" ${u.branchId === b.id ? "selected" : ""}>${esc(b.short)}</option>`).join("")}`
        : state.db.branches.filter((b) => b.id === me().branchId).map((b) => `<option value="${b.id}" selected>${esc(b.short)}</option>`).join("");
      body = `<h3>${m.id ? "Sửa nhân sự" : "Thêm nhân sự"}</h3><form data-form="staff"><input type="hidden" name="id" value="${esc(m.id || "")}" /><div class="form-grid">
        ${field("Họ tên", "name", u.name)}${field("Email", "email", u.email)}${field("Điện thoại", "phone", u.phone)}${field("Mật khẩu", "password", "", "", "password")}
        <p class="tiny muted" style="margin-top:-6px">${m.id ? "Để trống nếu giữ mật khẩu cũ. Mật khẩu mới cần 8 ký tự, có chữ và số." : "Ít nhất 8 ký tự, có chữ và số."}</p>
        <div class="field"><div class="field-head"><span>Vai trò</span></div><label class="control"><select name="role">${roleOpts.map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${esc(roleLabel(r))}</option>`).join("")}</select></label></div>
        <div class="field"><div class="field-head"><span>Chi nhánh</span></div><label class="control"><select name="branchId">${branchOpts}</select></label></div>
        <div class="field"><div class="field-head"><span>Trạng thái</span></div><label class="control"><select name="status"><option value="active" ${u.status === "active" ? "selected" : ""}>Đang làm</option><option value="inactive" ${u.status === "inactive" ? "selected" : ""}>Tạm khóa</option></select></label></div>
      </div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn">Lưu</button></div></form>`;
    } else if (m.type === "password") {
      body = `<h3>Đổi mật khẩu</h3><p class="tiny muted">Ít nhất 8 ký tự, có chữ và số.</p><form data-form="password">${field("Mật khẩu hiện tại", "old", "", "", "password")}${field("Mật khẩu mới", "next", "", "", "password")}<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Cập nhật</button></div></form>`;
    } else if (m.type === "receipt") {
      const s = state.db.sales.find((x) => x.id === m.id);
      body = `<h3>Hóa đơn ${esc(s.code)}</h3><p class="muted">${esc(state.db.branches.find((b) => b.id === s.branchId).name)}<br/>${timeLabel(s.at)} · ${esc(s.cashier)}</p>
        ${s.lines.map((l) => `<div class="cart-line"><span>${esc(l.name)} × ${l.qty}</span><b>${money(l.price * l.qty)}</b></div>`).join("")}
        ${s.discountAmount ? `<div class="sale-sum"><span>Giảm giá</span><span>− ${money(s.discountAmount)}</span></div>` : ""}
        <div class="total-line"><span>Khách trả (${PAY[s.pay] || ""})</span><span>${money(PharmaSales.amount(s))}</span></div>
        <p>Khách: <b>${esc(s.customer)}</b></p><div style="text-align:right"><button class="btn" data-action="close">Xong</button></div>`;
    }
    return `<div class="modal-back"><div class="modal-card ${m.type === "branch-view" || m.type === "staff-view" || m.type === "med-view" ? "wide" : ""}">${body}</div></div>`;
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function onSubmit(e) {
    armBell();
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    const data = formData(form);
    const kind = form.dataset.form;
    state.ui.error = "";
    if (window.PharmaCustomerPages && PharmaCustomerPages.handleSubmit(kind, data, customerHost())) return;
    if (window.PharmaSupplyPages && PharmaSupplyPages.handleSubmit(kind, data, supplyHost())) return;
    if (kind === "home-consult") {
      const name = String(data.name || "").trim();
      const phone = String(data.phone || "").trim();
      const shop = String(data.shop || "").trim();
      if (!name || !/^0\d{8,10}$/.test(phone.replace(/[\s.+()-]/g, "")) || !shop) {
        state.ui.error = "Điền họ tên, số điện thoại hợp lệ và tên nhà thuốc.";
        render();
        return;
      }
      state.ui.error = "";
      state.ui.homeConsultOk = true;
      render();
      return;
    }
    if (kind === "login" || kind === "home-login") {
      const result = PharmaAccounts.authenticate(state.db.users, data.email, data.password);
      if (!result.ok) {
        state.ui.error = result.message;
        PharmaRbac.log(state.db, null, "dang-nhap", "deny", result.message);
        persist();
        render();
        return;
      }
      const block = PharmaCustomers.loginBlock(state.db, result.user);
      if (block) {
        state.ui.error = block;
        PharmaRbac.log(state.db, result.user, "dang-nhap", "deny", block);
        persist();
        render();
        return;
      }
      state.session = PharmaSession.create(result.user.id, data.remember === "on");
      const next = state.ui.homeNext || "";
      state.ui.homeModal = null;
      state.ui.homeMenu = false;
      state.ui.homeNext = "";
      state.ui.branch = result.user.role === "admin" ? "all" : result.user.branchId;
      if (result.user.role === "customer") state.ui.shopBranch = result.user.branchId;
      persist();
      if (result.user.role === "customer") {
        go("cua-hang");
        if (next) toast("Tài khoản khách không vào được mục này.");
        return;
      }
      if (next && allowed(next)) {
        go(next);
        return;
      }
      go("tong-quan");
      if (next) toast("Bạn không có quyền vào mục này.");
      return;
    }
    if (kind === "register-customer") {
      const result = PharmaCustomers.registerAccount(state.db, data);
      if (!result.ok) { state.ui.error = result.message; render(); return; }
      const dropLocal = () => {
        state.db.users = state.db.users.filter((item) => item.id !== result.user.id);
        state.db.customers = state.db.customers.filter((item) => item.id !== result.customer.id);
      };
      pushMysqlNow().then((res) => {
        if (!res.ok) {
          dropLocal();
          state.ui.error = (res.data && res.data.message) || "Không ghi được tài khoản vào MySQL.";
          render();
          return;
        }
        state.session = PharmaSession.create(result.user.id, true);
        state.ui.shopBranch = result.user.branchId;
        persist();
        go("cua-hang");
      });
      return;
    }
    if (kind === "forgot") {
      const result = PharmaAccounts.resetPassword(state.db.users, data.email, data.password);
      if (!result.ok) { state.ui.error = result.message; render(); return; }
      state.ui.resetOk = true;
      persist();
      toast(result.message);
      return;
    }
    if (kind === "branch") {
      const actor = me();
      const existing = data.id ? state.db.branches.find((x) => x.id === data.id) : null;
      if (data.id && !existing) { toast("Không tìm thấy chi nhánh"); return; }
      if (!data.id && (!actor || actor.role !== "admin")) { toast("Chỉ quản trị được thêm chi nhánh"); return; }
      if (existing && actor && actor.role !== "admin" && actor.branchId !== existing.id) { toast("Không có quyền sửa chi nhánh này"); return; }
      const check = PharmaBranches.validate(data, state.db.branches);
      if (!check.ok) { state.ui.modal.draft = data; toast(check.message); return; }
      if (check.value.status === "closed" && (!actor || actor.role !== "admin")) { toast("Chỉ quản trị được ngừng hoạt động chi nhánh."); return; }
      if (check.value.status === "open") {
        const ready = PharmaBranches.inspect(Object.assign({}, existing || {}, check.value));
        if (!ready.ok) { toast("Chưa đủ dữ liệu để mở cửa: " + ready.missing.join(", ") + "."); return; }
      }
      if (existing) Object.assign(existing, check.value);
      else state.db.branches.push(Object.assign({ id: "b" + Date.now(), manager: "" }, check.value));
      state.ui.modal = null;
      persist();
      toast("Đã lưu chi nhánh");
      return;
    }
    if (kind === "branch-contact") {
      const actor = me();
      const branch = state.db.branches.find((b) => b.id === data.id);
      if (!branch || !actor || (actor.role !== "admin" && actor.branchId !== branch.id)) { toast("Không có quyền cập nhật liên hệ"); return; }
      const result = PharmaBranches.applyContact(branch, data);
      if (!result.ok) { state.ui.modal.draft = data; toast(result.message); return; }
      state.ui.modal = null;
      persist();
      toast(result.message);
      return;
    }
    if (kind === "staff-move") {
      const person = state.db.users.find((u) => u.id === data.id);
      const result = PharmaStaff.place(person, data.branchId, state.db.branches, me(), data.mode === "transfer" ? "transfer" : "assign");
      if (!result.ok) { toast(result.message); return; }
      state.ui.modal = null;
      persist();
      toast(result.message);
      return;
    }
    if (kind === "manager") {
      if (!me() || me().role !== "admin") { toast("Chỉ quản trị mới tạo được tài khoản quản lý"); return; }
      const branch = state.db.branches.find((b) => b.id === data.branchId);
      const name = (data.name || "").trim();
      const email = (data.email || "").trim().toLowerCase();
      if (!branch) { toast("Không tìm thấy chi nhánh"); return; }
      if (!name || !email) { toast("Cần họ tên và email"); return; }
      const hashed = PharmaAccounts.applyPassword(data.password);
      if (!hashed.ok) { toast(hashed.message); return; }
      if (state.db.users.some((u) => u.email.toLowerCase() === email)) { toast("Email đã tồn tại"); return; }
      state.db.users.push({
        id: "u" + Date.now(), name, email, phone: (data.phone || "").trim(), password: hashed.password,
        role: "manager", branchId: branch.id, status: "active", title: "Quản lý",
      });
      branch.manager = name;
      state.ui.modal = null;
      persist();
      toast("Đã tạo tài khoản quản lý");
      return;
    }
    if (kind === "employee") {
      if (!me() || me().role !== "admin") { toast("Chỉ quản trị mới tạo được nhân viên cho chi nhánh"); return; }
      const branch = state.db.branches.find((b) => b.id === data.branchId);
      const name = (data.name || "").trim();
      const email = (data.email || "").trim().toLowerCase();
      const role = data.role === "cashier" ? "cashier" : "pharmacist";
      if (!branch) { toast("Không tìm thấy chi nhánh"); return; }
      if (!name || !email) { toast("Cần họ tên và email"); return; }
      const hashed = PharmaAccounts.applyPassword(data.password);
      if (!hashed.ok) { toast(hashed.message); return; }
      if (state.db.users.some((u) => u.email.toLowerCase() === email)) { toast("Email đã tồn tại"); return; }
      state.db.users.push({
        id: "u" + Date.now(), name, email, phone: (data.phone || "").trim(), password: hashed.password,
        role, branchId: branch.id, status: "active", title: roleLabel(role),
      });
      state.ui.modal = null;
      persist();
      toast("Đã tạo tài khoản nhân viên");
      return;
    }
    if (kind === "med") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const existing = data.id ? state.db.medicines.find((x) => x.id === data.id) : null;
      const targetBranch = state.db.branches.find((b) => b.id === data.branchId);
      if (!targetBranch) { toast("Không tìm thấy chi nhánh"); return; }
      if (me() && me().role !== "admin" && (data.branchId !== me().branchId || targetBranch.status === "closed")) { toast("Chi nhánh đang ngừng hoạt động hoặc ngoài phạm vi."); return; }
      const check = PharmaMedicines.validate(data, {
        medicines: state.db.medicines,
        categories: state.db.categories,
        manufacturers: state.db.manufacturers,
        units: state.db.units,
        forms: state.db.dosageForms,
        editing: !!existing,
        today: todayStr(),
        keepManufacturerId: existing ? existing.manufacturerId : "",
      });
      if (!check.ok) { state.ui.modal.draft = data; toast(check.message); return; }
      if (existing) {
        const stock = existing.stock;
        Object.assign(existing, check.value);
        existing.stock = stock;
        PharmaMedicines.rememberLot(existing, check.value.batch, check.value.expiry, stock);
        if (existing.status === "discontinued") state.ui.cart = state.ui.cart.filter((c) => c.id !== existing.id);
      } else {
        const med = Object.assign({ id: "m" + Date.now(), lots: [] }, check.value);
        PharmaMedicines.rememberLot(med, check.value.batch, check.value.expiry, med.stock);
        state.db.medicines.unshift(med);
      }
      state.ui.modal = null;
      persist();
      toast(existing ? "Đã cập nhật thuốc" : "Đã thêm thuốc");
      return;
    }
    if (kind === "category") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const check = PharmaCatalog.validateCategory(data, state.db.categories);
      if (!check.ok) { state.ui.modal.draft = data; toast(check.message); return; }
      const existing = data.id ? state.db.categories.find((x) => x.id === data.id) : null;
      if (existing) {
        existing.name = check.value.name;
        PharmaCatalog.renameLinked(state.db.medicines, "categoryId", existing.id, "category", existing.name);
      } else state.db.categories.push({ id: "c" + Date.now(), name: check.value.name });
      state.ui.modal = null;
      persist();
      toast("Đã lưu danh mục");
      return;
    }
    if (kind === "manufacturer") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const check = PharmaCatalog.validateManufacturer(data, state.db.manufacturers);
      if (!check.ok) { state.ui.modal.draft = data; toast(check.message); return; }
      const existing = data.id ? state.db.manufacturers.find((x) => x.id === data.id) : null;
      if (existing) {
        Object.assign(existing, check.value);
        PharmaCatalog.renameLinked(state.db.medicines, "manufacturerId", existing.id, "supplier", existing.name);
      } else state.db.manufacturers.push(Object.assign({ id: "p" + Date.now() }, check.value));
      state.ui.modal = null;
      persist();
      toast("Đã lưu nhà sản xuất");
      return;
    }
    if (kind === "unit" || kind === "dosage-form") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const unitMode = kind === "unit";
      const list = unitMode ? state.db.units : state.db.dosageForms;
      const check = unitMode ? PharmaCatalog.validateUnit(data, list) : PharmaCatalog.validateForm(data, list);
      if (!check.ok) { state.ui.modal.draft = data; toast(check.message); return; }
      const existing = data.id ? list.find((x) => x.id === data.id) : null;
      if (existing) {
        existing.name = check.value.name;
        PharmaCatalog.renameLinked(state.db.medicines, unitMode ? "unitId" : "dosageFormId", existing.id, unitMode ? "unit" : "dosageForm", existing.name);
      } else list.push({ id: (unitMode ? "unit" : "form") + Date.now(), name: check.value.name, builtin: false });
      state.ui.modal = null;
      persist();
      toast(unitMode ? "Đã lưu đơn vị tính" : "Đã lưu dạng bào chế");
      return;
    }
    if (kind === "stock") {
      const med = state.db.medicines.find((x) => x.id === data.id);
      const owner = state.db.branches.find((b) => b.id === med.branchId);
      if (me() && me().role !== "admin" && owner && owner.status === "closed") { toast("Chi nhánh đang ngừng hoạt động."); return; }
      const next = med.stock + Number(data.delta || 0);
      if (next < 0) { toast("Tồn kho không thể âm"); return; }
      med.stock = next;
      const lot = (med.lots || []).find((item) => String(item.batch).toUpperCase() === String(med.batch || "").toUpperCase());
      if (lot) lot.qty = med.stock;
      state.db.notifications.unshift({ id: "n" + Date.now(), type: "stock", title: "Điều chỉnh tồn kho", body: `${med.name}: ${data.note || "Cập nhật"} → còn ${med.stock}.`, at: new Date().toISOString(), read: false, priority: med.stock <= med.minStock ? "high" : "low" });
      state.ui.modal = null;
      persist();
      toast("Đã cập nhật tồn kho");
      return;
    }
    if (kind === "staff") {
      if (data.id && locksOwnProfile(me()) && data.id === me().id) {
        toast("Bạn không sửa được thông tin của chính mình");
        return;
      }
      if (data.id && me().role === "manager") {
        const current = state.db.users.find((x) => x.id === data.id);
        if (!current || current.branchId !== me().branchId) {
          toast("Chỉ sửa nhân viên trong chi nhánh của mình");
          return;
        }
      }
      if (me().role !== "admin") {
        data.branchId = me().branchId;
        if (data.role === "admin" || data.role === "manager") data.role = "pharmacist";
      }
      let nextPassword = "";
      if (data.password) {
        const hashed = PharmaAccounts.applyPassword(data.password);
        if (!hashed.ok) { toast(hashed.message); return; }
        nextPassword = hashed.password;
      } else if (!data.id) {
        toast("Cần mật khẩu cho tài khoản mới.");
        return;
      }
      if (data.id) {
        const u = state.db.users.find((x) => x.id === data.id);
        if (u.id === me().id && data.status === "inactive") { toast("Không thể tự khóa tài khoản đang dùng"); return; }
        Object.assign(u, { name: data.name, email: data.email, phone: data.phone, password: nextPassword || u.password, role: data.role, branchId: data.role === "admin" ? "all" : data.branchId, status: data.status, title: roleLabel(data.role) });
      } else {
        if (state.db.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) { toast("Email đã tồn tại"); return; }
        state.db.users.push({ id: "u" + Date.now(), name: data.name, email: data.email, phone: data.phone, password: nextPassword, role: data.role, branchId: data.role === "admin" ? "all" : data.branchId, status: data.status, title: roleLabel(data.role) });
      }
      state.ui.modal = null;
      persist();
      toast("Đã lưu nhân sự");
      return;
    }
    if (kind === "password") {
      const result = PharmaAccounts.changePassword(me(), data.old, data.next);
      if (!result.ok) { toast(result.message); return; }
      state.ui.modal = null;
      persist();
      toast(result.message);
      return;
    }
    if (kind === "profile") {
      const person = me();
      const previous = { name: person.name, email: person.email, phone: person.phone };
      const result = PharmaAccounts.updateProfile(state.db.users, person, data);
      if (!result.ok) { toast(result.message); return; }
      if (person.role === "customer") {
        const synced = PharmaCustomers.applyAccountProfile(state.db, person);
        if (!synced.ok) {
          person.name = previous.name;
          person.email = previous.email;
          person.phone = previous.phone;
          toast(synced.message);
          return;
        }
      }
      persist();
      toast(result.message);
    }
  }

  let bellCtx = null;
  let heardUnread = null;

  function armBell() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!bellCtx) bellCtx = new Ctx();
    if (bellCtx.state === "suspended") bellCtx.resume();
    return bellCtx;
  }

  function playBell() {
    const ctx = armBell();
    if (!ctx) return;
    const ring = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      [880, 1174].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + index * 0.14;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    };
    if (ctx.state === "running") ring();
    else ctx.resume().then(ring);
  }

  function watchNotes() {
    const unread = (state.db.notifications || []).filter((note) => !note.read).length;
    if (heardUnread == null) {
      heardUnread = unread;
      return;
    }
    if (unread > heardUnread) playBell();
    heardUnread = unread;
  }

  function onClick(e) {
    armBell();
    if (e.target.classList.contains("modal-back")) {
      state.ui.modal = null;
      render();
      return;
    }
    const menuWas = state.ui.menu;
    const accountWas = state.ui.accountMenu;
    if (menuWas && !e.target.closest("[data-action='toggle-menu']") && !e.target.closest(".menu")) state.ui.menu = false;
    if (accountWas && !e.target.closest("[data-action='toggle-account']") && !e.target.closest(".side-menu")) state.ui.accountMenu = false;
    const el = e.target.closest("[data-action]");
    if (!el) {
      if (menuWas || accountWas) render();
      return;
    }
    const action = el.dataset.action;
    if (action === "close") { state.ui.modal = null; render(); return; }
    if (window.PharmaHome && PharmaHome.handleClick(action, el, homeHost())) return;
    if (window.PharmaStorePages && PharmaStorePages.handleClick(action, el, storeHost())) return;
    if (window.PharmaCustomerPages && PharmaCustomerPages.handleClick(action, el, customerHost())) return;
    if (window.PharmaSupplyPages && PharmaSupplyPages.handleClick(action, el, supplyHost())) return;
    if (window.PharmaSalesPages && PharmaSalesPages.handleClick(action, el, saleHost())) return;
    if (window.PharmaInventoryPages && PharmaInventoryPages.handleClick(action, el, inventoryHost())) return;
    if (window.PharmaReportPages && PharmaReportPages.handleClick(action, el, reportHost())) return;
    if (action === "go") {
      state.ui.side = false;
      state.ui.menu = false;
      state.ui.accountMenu = false;
      state.ui.homeModal = null;
      state.ui.homeMenu = false;
      state.ui.error = "";
      go(el.dataset.path);
      return;
    }
    if (action === "fill-demo") {
      const form = el.closest("form") || el.closest(".auth-card").querySelector("form");
      form.email.value = el.dataset.email;
      form.password.value = el.dataset.password || "admin123";
      return;
    }
    if (action === "logout") { state.session = null; state.ui.modal = null; state.ui.menu = false; state.ui.accountMenu = false; persist(); go("trang-chu"); return; }
    if (action === "theme") { state.theme = state.theme === "dark" ? "light" : "dark"; persist(); render(); return; }
    if (action === "toggle-menu") { state.ui.menu = !state.ui.menu; state.ui.accountMenu = false; render(); return; }
    if (action === "toggle-account") { state.ui.accountMenu = !state.ui.accountMenu; state.ui.menu = false; render(); return; }
    if (action === "toggle-side") { state.ui.side = !state.ui.side; render(); return; }
    if (action === "range") { state.ui.range = el.dataset.value; render(); return; }
    if (action === "chip") { state.ui.chip = el.dataset.value; state.ui.medPage = 1; render(); return; }
    if (action === "alert-chip") { state.ui.alertChip = el.dataset.value; render(); return; }
    if (action === "noti-chip") { state.ui.notiChip = el.dataset.value; render(); return; }
    if (action === "setting") { state.db.settings[el.dataset.key] = !state.db.settings[el.dataset.key]; persist(); render(); return; }
    if (action === "edit-branch") { state.ui.modal = { type: "branch", id: el.dataset.id || null }; render(); return; }
    if (action === "open-branch") { state.ui.modal = { type: "branch-view", id: el.dataset.id }; render(); return; }
    if (action === "branch-contact") { state.ui.modal = { type: "branch-contact", id: el.dataset.id }; render(); return; }
    if (action === "branch-filter") { state.ui.branchStatus = el.dataset.value; state.ui.branchPage = 1; render(); return; }
    if (action === "branch-page") { state.ui.branchPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "staff-role") { state.ui.staffRole = el.dataset.value; state.ui.staffPage = 1; render(); return; }
    if (action === "staff-page") { state.ui.staffPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "branch-open" || action === "branch-close") {
      const branch = state.db.branches.find((b) => b.id === el.dataset.id);
      const result = PharmaBranches.setStatus(branch, action === "branch-open" ? "open" : "closed", me());
      if (!result.ok) { toast(result.message); return; }
      persist();
      toast(result.message);
      return;
    }
    if (action === "open-staff") { state.ui.modal = { type: "staff-view", id: el.dataset.id }; render(); return; }
    if (action === "assign-staff" || action === "transfer-staff") {
      const person = state.db.users.find((u) => u.id === el.dataset.id);
      if (!PharmaStaff.canMove(me(), person)) { toast("Không có quyền phân công nhân viên này"); return; }
      state.ui.modal = { type: "staff-move", id: person.id, mode: action === "transfer-staff" ? "transfer" : "assign" };
      render();
      return;
    }
    if (action === "delete-branch") {
      if (!me() || me().role !== "admin") return;
      state.ui.modal = { type: "delete-branch", id: el.dataset.id };
      render();
      return;
    }
    if (action === "confirm-delete-branch") {
      if (!me() || me().role !== "admin") return;
      const id = el.dataset.id;
      state.db.branches = state.db.branches.filter((b) => b.id !== id);
      state.db.medicines = state.db.medicines.filter((m) => m.branchId !== id);
      state.db.sales = state.db.sales.filter((s) => s.branchId !== id);
      state.db.users = state.db.users.filter((u) => u.role === "admin" || u.branchId !== id);
      if (state.ui.branch === id) state.ui.branch = "all";
      state.ui.modal = null;
      persist();
      toast("Đã xóa chi nhánh");
      return;
    }
    if (action === "manager-account") {
      if (!me() || me().role !== "admin") { toast("Chỉ quản trị mới tạo được tài khoản quản lý"); return; }
      state.ui.modal = { type: "manager-account", id: el.dataset.id };
      render();
      return;
    }
    if (action === "employee-account") {
      if (!me() || me().role !== "admin") { toast("Chỉ quản trị mới tạo được nhân viên cho chi nhánh"); return; }
      state.ui.modal = { type: "employee-account", id: el.dataset.id };
      render();
      return;
    }
    if (action === "toggle-lock") {
      const target = state.db.users.find((u) => u.id === el.dataset.id);
      if (!PharmaRbac.can(state.db, me(), "account.lock") || !governTarget(me(), target)) { toast("Không có quyền khóa tài khoản này"); return; }
      const result = PharmaAccounts.setLock(target, target.status === "active");
      persist();
      toast(result.message);
      return;
    }
    if (action === "delete-user") {
      const target = state.db.users.find((u) => u.id === el.dataset.id);
      if (!PharmaRbac.can(state.db, me(), "account.delete") || !governTarget(me(), target)) { toast("Không có quyền xóa tài khoản này"); return; }
      state.ui.modal = { type: "delete-user", id: target.id };
      render();
      return;
    }
    if (action === "confirm-delete-user") {
      const target = state.db.users.find((u) => u.id === el.dataset.id);
      if (!PharmaRbac.can(state.db, me(), "account.delete") || !governTarget(me(), target)) { toast("Không có quyền xóa tài khoản này"); return; }
      state.db.users = state.db.users.filter((u) => u.id !== target.id);
      if (state.session && state.session.userId === target.id) state.session = null;
      state.ui.modal = null;
      persist();
      toast("Đã xóa tài khoản");
      return;
    }
    if (action === "edit-med") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "med", id: el.dataset.id || null };
      render();
      return;
    }
    if (action === "open-med") {
      state.ui.modal = { type: "med-view", id: el.dataset.id };
      render();
      return;
    }
    if (action === "delete-med") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "delete-med", id: el.dataset.id };
      render();
      return;
    }
    if (action === "confirm-delete-med") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const related = PharmaMedicines.relatedSales(state.db.sales, el.dataset.id);
      if (related.blocked) { toast("Thuốc đã phát sinh hóa đơn, không xóa được."); return; }
      state.db.medicines = state.db.medicines.filter((m) => m.id !== el.dataset.id);
      state.ui.cart = state.ui.cart.filter((c) => c.id !== el.dataset.id);
      state.ui.modal = null;
      persist();
      toast("Đã xóa thuốc");
      return;
    }
    if (action === "stop-med") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "stop-med", id: el.dataset.id, next: el.dataset.next === "active" ? "active" : "discontinued" };
      render();
      return;
    }
    if (action === "confirm-stop-med") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const med = state.db.medicines.find((m) => m.id === el.dataset.id);
      const next = el.dataset.next === "active" ? "active" : "discontinued";
      const result = PharmaMedicines.setStatus(med, next);
      if (!result.ok) { toast(result.message); return; }
      if (next === "discontinued") state.ui.cart = state.ui.cart.filter((c) => c.id !== med.id);
      state.ui.modal = null;
      persist();
      toast(result.message);
      return;
    }
    if (action === "catalog-tab") {
      state.ui.catalogTab = el.dataset.value || "med";
      state.ui.modal = null;
      state.ui.side = false;
      if (route() !== "kho") go("kho");
      else render();
      return;
    }
    if (action === "med-page") { state.ui.medPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "cat-page") { state.ui.catPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "maker-page") { state.ui.makerPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "maker-filter") { state.ui.makerStatus = el.dataset.value; state.ui.makerPage = 1; render(); return; }
    if (action === "unit-page") { state.ui.unitPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "form-page") { state.ui.formPage += Number(el.dataset.dir || 0); render(); return; }
    if (action === "gen-code") {
      const form = el.closest("form");
      if (form && form.elements.code) form.elements.code.value = PharmaMedicines.nextCode(state.db.medicines);
      return;
    }
    if (action === "edit-category") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "category", id: el.dataset.id || null };
      render();
      return;
    }
    if (action === "delete-category") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "delete-category", id: el.dataset.id };
      render();
      return;
    }
    if (action === "confirm-delete-category") {
      const used = PharmaCatalog.usage(state.db.medicines, "categoryId", el.dataset.id);
      if (used.blocked) { toast("Danh mục đang có thuốc, không xóa được."); return; }
      state.db.categories = state.db.categories.filter((c) => c.id !== el.dataset.id);
      state.ui.modal = null;
      persist();
      toast("Đã xóa danh mục");
      return;
    }
    if (action === "edit-maker") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "manufacturer", id: el.dataset.id || null };
      render();
      return;
    }
    if (action === "maker-status") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      const maker = state.db.manufacturers.find((item) => item.id === el.dataset.id);
      const next = maker && maker.status === "inactive" ? "active" : "inactive";
      const result = PharmaCatalog.setMakerStatus(maker, next);
      if (!result.ok) { toast(result.message); return; }
      persist();
      toast(result.message);
      return;
    }
    if (action === "delete-maker") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "delete-maker", id: el.dataset.id };
      render();
      return;
    }
    if (action === "confirm-delete-maker") {
      const used = PharmaCatalog.usage(state.db.medicines, "manufacturerId", el.dataset.id);
      if (used.blocked) { toast("Nhà sản xuất đang có thuốc, không xóa được."); return; }
      state.db.manufacturers = state.db.manufacturers.filter((item) => item.id !== el.dataset.id);
      state.ui.modal = null;
      persist();
      toast("Đã xóa nhà sản xuất");
      return;
    }
    if (action === "edit-unit") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "unit", id: el.dataset.id || null };
      render();
      return;
    }
    if (action === "edit-form") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "dosage-form", id: el.dataset.id || null };
      render();
      return;
    }
    if (action === "delete-unit" || action === "delete-form") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: action === "delete-unit" ? "delete-unit" : "delete-form", id: el.dataset.id };
      render();
      return;
    }
    if (action === "confirm-delete-unit" || action === "confirm-delete-form") {
      const unitMode = action === "confirm-delete-unit";
      const list = unitMode ? state.db.units : state.db.dosageForms;
      const item = list.find((row) => row.id === el.dataset.id);
      if (!item || item.builtin) { toast("Mục mặc định không xóa được."); return; }
      const used = PharmaCatalog.usage(state.db.medicines, unitMode ? "unitId" : "dosageFormId", item.id);
      if (used.blocked) { toast("Đang gán cho thuốc, không xóa được."); return; }
      if (unitMode) state.db.units = state.db.units.filter((row) => row.id !== item.id);
      else state.db.dosageForms = state.db.dosageForms.filter((row) => row.id !== item.id);
      state.ui.modal = null;
      persist();
      toast(unitMode ? "Đã xóa đơn vị tính" : "Đã xóa dạng bào chế");
      return;
    }
    if (action === "stock") {
      if (!PharmaRbac.can(state.db, me(), "inventory.edit")) { toast("Không có quyền chỉnh kho"); return; }
      state.ui.modal = { type: "stock", id: el.dataset.id }; render(); return;
    }
    if (action === "edit-staff") {
      const viewer = me();
      const target = el.dataset.id ? state.db.users.find((u) => u.id === el.dataset.id) : null;
      if (target && locksOwnProfile(viewer) && target.id === viewer.id) {
        toast("Bạn không sửa được thông tin của chính mình");
        return;
      }
      if (target && viewer && viewer.role === "manager" && target.branchId !== viewer.branchId) {
        toast("Chỉ sửa nhân viên trong chi nhánh của mình");
        return;
      }
      if (!target && !PharmaRbac.can(state.db, viewer, "account.create")) { toast("Không có quyền tạo tài khoản"); return; }
      state.ui.modal = { type: "staff", id: el.dataset.id || null };
      render();
      return;
    }
    if (action === "open-password") { state.ui.modal = { type: "password" }; render(); return; }
    if (action === "read-all") { state.db.notifications.forEach((n) => { n.read = true; }); persist(); toast("Đã đánh dấu tất cả"); return; }
    if (action === "delete-read") {
      const before = state.db.notifications.length;
      state.db.notifications = state.db.notifications.filter((n) => !n.read);
      if (state.db.notifications.length === before) { toast("Không có thông báo đã đọc để xóa"); return; }
      persist();
      toast("Đã xóa thông báo đã đọc");
      return;
    }
    if (action === "delete-note") {
      const n = state.db.notifications.find((x) => x.id === el.dataset.id);
      if (!n) return;
      if (!n.read) { toast("Chỉ xóa được thông báo đã đọc"); return; }
      state.db.notifications = state.db.notifications.filter((x) => x.id !== n.id);
      persist();
      toast("Đã xóa thông báo");
      return;
    }
    if (action === "read-one") {
      const n = state.db.notifications.find((x) => x.id === el.dataset.id);
      if (n) n.read = true;
      persist();
      render();
      return;
    }
  }

  function onInput(e) {
    if (window.PharmaSupplyPages && PharmaSupplyPages.handleInput(e, supplyHost())) return;
    if (window.PharmaSalesPages && PharmaSalesPages.handleInput(e, saleHost())) return;
    const el = e.target.closest("[data-input]");
    if (!el) return;
    const key = el.dataset.input;
    state._focus = el.id;
    state._pos = el.selectionStart;
    if (key === "global") {
      state.ui.q = el.value;
      state.ui.qInv = el.value;
      state.ui.medPage = 1;
      state.ui.catalogTab = "med";
      if (route() !== "kho" && allowed("kho")) go("kho");
      else render();
      return;
    }
    if (key === "qBranch") state.ui.branchPage = 1;
    if (key === "qStaff") state.ui.staffPage = 1;
    if (key === "qInv") state.ui.medPage = 1;
    if (key === "qCat") state.ui.catPage = 1;
    if (key === "qMaker") state.ui.makerPage = 1;
    if (key === "qUnit") state.ui.unitPage = 1;
    if (key === "qForm") state.ui.formPage = 1;
    if (key === "qCustomer") state.ui.customerPage = 1;
    if (key === "qRole") state.ui.rolePage = 1;
    if (key === "qStore") state.ui.storePage = 1;
    if (key === "qReceipt") state.ui.receiptPage = 1;
    if (key === "qStock") state.ui.stockPage = 1;
    if (key === "qLot") state.ui.lotPage = 1;
    if (key === "qExpiry") state.ui.expiryPage = 1;
    if (key === "qSheet") state.ui.sheetPage = 1;
    if (key === "qMove") state.ui.movePage = 1;
    state.ui[key] = el.value;
    render();
  }

  function onChange(e) {
    if (window.PharmaCustomerPages && PharmaCustomerPages.handleChange(e, customerHost())) return;
    if (window.PharmaSupplyPages && PharmaSupplyPages.handleChange(e, supplyHost())) return;
    if (window.PharmaSalesPages && PharmaSalesPages.handleChange(e, saleHost())) return;
    if (window.PharmaInventoryPages && PharmaInventoryPages.handleChange(e, inventoryHost())) return;
    if (window.PharmaReportPages && PharmaReportPages.handleChange(e, reportHost())) return;
    const el = e.target.closest("[data-change]");
    if (!el) return;
    if (el.dataset.change === "branch") { state.ui.branch = el.value; state.ui.cart = []; state.ui.tendered = ""; state.ui.medPage = 1; render(); }
    if (el.dataset.change === "shop-branch") { state.ui.shopBranch = el.value; state.ui.storePage = 1; render(); }
    if (el.dataset.change === "category") { state.ui.category = el.value; state.ui.medPage = 1; render(); }
    if (el.dataset.change === "maker") { state.ui.maker = el.value; state.ui.medPage = 1; render(); }
    if (el.dataset.change === "trade") { state.ui.trade = el.value; state.ui.medPage = 1; render(); }
    if (el.dataset.change === "staff-branch") { state.ui.staffBranch = el.value; state.ui.staffPage = 1; render(); }
  }

  app.addEventListener("click", onClick);
  app.addEventListener("submit", onSubmit);
  app.addEventListener("input", onInput);
  app.addEventListener("change", onChange);
  window.addEventListener("hashchange", render);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (state.ui.modal || state.ui.homeModal || state.ui.homeMenu)) {
      state.ui.modal = null;
      state.ui.homeModal = null;
      state.ui.homeMenu = false;
      render();
    }
  });

  if (!location.hash) {
    const sessionCheck = PharmaSession.status(state.session, Date.now());
    location.hash = sessionCheck.ok ? "#/dang-nhap" : "#/trang-chu";
  }
  window.addEventListener("pagehide", () => {
    if (!mysqlReady) return;
    const body = JSON.stringify(state.db);
    if (body === lastSent) return;
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  });
  bootMysql();
})();
