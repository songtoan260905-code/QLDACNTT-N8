/* Nhân sự: lọc, phân trang, chi tiết, phân công và điều chuyển (task 162–170). */
(function (root) {
  var PAGE_SIZE = 6;

  function text(value) {
    return String(value || "").trim();
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  }

  function inspect(user) {
    if (!user) return { ok: false, missing: ["nhân viên"] };
    var missing = [];
    if (text(user.name).length < 2) missing.push("họ tên");
    if (!emailOk(user.email || "")) missing.push("email");
    if (!text(user.phone)) missing.push("điện thoại");
    if (!text(user.role)) missing.push("vai trò");
    if (!text(user.branchId)) missing.push("chi nhánh");
    return { ok: missing.length === 0, missing: missing };
  }

  function query(users, opts) {
    opts = opts || {};
    var viewer = opts.viewer;
    var q = text(opts.q).toLowerCase();
    var branchId = opts.branchId || "all";
    var role = opts.role || "all";
    var list = (users || []).filter(function (user) {
      if (!viewer) return false;
      var wide = viewer.role === "admin" || viewer.preview;
      if (!wide && user.branchId !== viewer.branchId) return false;
      if (user.role === "customer") return false;
      if (wide && branchId !== "all" && user.branchId !== branchId) return false;
      if (role !== "all" && user.role !== role) return false;
      if (!q) return true;
      var blob = [user.name, user.email, user.title, user.phone, user.role].join(" ").toLowerCase();
      return blob.indexOf(q) >= 0;
    });
    list.sort(function (a, b) {
      return text(a.name).localeCompare(text(b.name), "vi");
    });
    return root.PharmaPager.clamp(list, opts.page, opts.pageSize || PAGE_SIZE);
  }

  function canMove(actor, user) {
    if (!actor || !user || actor.id === user.id) return false;
    if (user.role === "admin" || user.id === "u1") return false;
    return actor.role === "admin";
  }

  function place(user, branchId, branches, actor, mode) {
    if (!canMove(actor, user)) return { ok: false, message: "Không có quyền phân công nhân viên này." };
    var branch = (branches || []).find(function (item) { return item.id === branchId; });
    if (!branch) return { ok: false, message: "Chi nhánh không hợp lệ." };
    if (branch.status === "closed") return { ok: false, message: "Không phân công vào chi nhánh đã ngừng hoạt động." };
    if (user.branchId === branch.id) return { ok: false, message: "Nhân viên đang ở chi nhánh này." };
    var from = user.branchId;
    user.branchId = branch.id;
    if (user.role === "manager") branch.manager = user.name;
    user.transfers = user.transfers || [];
    user.transfers.unshift({
      at: new Date().toISOString(),
      from: from,
      to: branch.id,
      by: actor.id,
      kind: mode === "transfer" ? "transfer" : "assign",
    });
    return {
      ok: true,
      message: mode === "transfer" ? "Đã điều chuyển nhân viên." : "Đã phân công nhân viên cho chi nhánh.",
    };
  }

  root.PharmaStaff = {
    PAGE_SIZE: PAGE_SIZE,
    inspect: inspect,
    query: query,
    canMove: canMove,
    place: place,
  };
})(typeof window !== "undefined" ? window : globalThis);
