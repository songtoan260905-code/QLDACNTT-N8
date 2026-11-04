/* Chi nhánh: kiểm tra, tìm kiếm, lọc, trạng thái và liên hệ (task 151–160). */
(function (root) {
  var PAGE_SIZE = 4;
  var STATUSES = ["open", "maintenance", "closed"];

  function text(value) {
    return String(value || "").trim();
  }

  function digits(value) {
    return text(value).replace(/[\s.+()-]/g, "");
  }

  function phoneOk(value) {
    var raw = digits(value);
    return /^0\d{8,10}$/.test(raw) || /^84\d{8,10}$/.test(raw);
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  }

  function shortName(name) {
    return text(name).replace(/^PharmaCare\s+/i, "") || text(name);
  }

  function validate(data, branches) {
    var name = text(data.name);
    var address = text(data.address);
    var phone = text(data.phone);
    var hours = text(data.hours) || "08:00 – 21:00";
    var status = STATUSES.indexOf(data.status) >= 0 ? data.status : "open";
    var email = text(data.email);
    var contact = text(data.contact);
    var id = text(data.id);
    if (name.length < 2) return { ok: false, message: "Tên chi nhánh cần ít nhất 2 ký tự." };
    if (!address) return { ok: false, message: "Cần địa chỉ chi nhánh." };
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại chi nhánh chưa hợp lệ." };
    if (!hours) return { ok: false, message: "Cần giờ mở cửa." };
    if (email && !emailOk(email)) return { ok: false, message: "Email liên hệ chưa đúng định dạng." };
    if (contact && contact.length < 2) return { ok: false, message: "Người liên hệ cần ít nhất 2 ký tự." };
    var dup = (branches || []).some(function (branch) {
      return branch.id !== id && text(branch.name).toLowerCase() === name.toLowerCase();
    });
    if (dup) return { ok: false, message: "Tên chi nhánh đã tồn tại." };
    return {
      ok: true,
      value: {
        name: name,
        short: shortName(name),
        address: address,
        phone: phone,
        hours: hours,
        status: status,
        email: email,
        contact: contact,
      },
    };
  }

  function validateContact(data) {
    var phone = text(data.phone);
    var email = text(data.email);
    var contact = text(data.contact);
    var address = text(data.address);
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại liên hệ chưa hợp lệ." };
    if (email && !emailOk(email)) return { ok: false, message: "Email liên hệ chưa đúng định dạng." };
    if (contact && contact.length < 2) return { ok: false, message: "Người liên hệ cần ít nhất 2 ký tự." };
    if (!address) return { ok: false, message: "Cần địa chỉ liên hệ." };
    return { ok: true, value: { phone: phone, email: email, contact: contact, address: address } };
  }

  function keywordHit(branch, q) {
    if (!q) return true;
    var blob = [branch.name, branch.short, branch.address, branch.phone, branch.email, branch.contact, branch.hours].join(" ").toLowerCase();
    return blob.indexOf(q) >= 0;
  }

  function visibleTo(branch, viewer) {
    if (!viewer) return false;
    if (viewer.role === "admin" || viewer.preview) return true;
    return branch.id === viewer.branchId;
  }

  function query(branches, opts) {
    opts = opts || {};
    var q = text(opts.q).toLowerCase();
    var status = opts.status || "all";
    var list = (branches || []).filter(function (branch) {
      if (!visibleTo(branch, opts.viewer)) return false;
      if (status !== "all" && branch.status !== status) return false;
      return keywordHit(branch, q);
    });
    return root.PharmaPager.clamp(list, opts.page, opts.pageSize || PAGE_SIZE);
  }

  function inspect(branch) {
    if (!branch) return { ok: false, missing: ["chi nhánh"] };
    var missing = [];
    if (text(branch.name).length < 2) missing.push("tên");
    if (!text(branch.address)) missing.push("địa chỉ");
    if (!phoneOk(branch.phone || "")) missing.push("điện thoại");
    if (!text(branch.hours)) missing.push("giờ mở cửa");
    return { ok: missing.length === 0, missing: missing };
  }

  function constraints(db, branchId) {
    var medicines = (db.medicines || []).filter(function (item) { return item.branchId === branchId; }).length;
    var sales = (db.sales || []).filter(function (item) { return item.branchId === branchId; }).length;
    var staff = (db.users || []).filter(function (item) { return item.branchId === branchId && item.role !== "admin"; }).length;
    return {
      medicines: medicines,
      sales: sales,
      staff: staff,
      blocked: medicines + sales + staff > 0,
    };
  }

  function isOperating(branch) {
    return !!(branch && branch.status === "open");
  }

  function setStatus(branch, next, actor) {
    if (!actor || actor.role !== "admin") {
      return { ok: false, message: "Chỉ quản trị được đổi trạng thái hoạt động của chi nhánh." };
    }
    if (!branch) return { ok: false, message: "Không tìm thấy chi nhánh." };
    if (next === "open") {
      var check = inspect(branch);
      if (!check.ok) return { ok: false, message: "Chưa đủ dữ liệu để mở cửa: " + check.missing.join(", ") + "." };
      branch.status = "open";
      return { ok: true, message: "Đã kích hoạt chi nhánh. Cửa hàng đang hoạt động." };
    }
    if (next === "closed") {
      branch.status = "closed";
      return { ok: true, message: "Đã ngừng hoạt động chi nhánh. Nhân sự chi nhánh không bán hàng hoặc sửa kho." };
    }
    return { ok: false, message: "Trạng thái không hợp lệ." };
  }

  function applyContact(branch, data) {
    if (!branch) return { ok: false, message: "Không tìm thấy chi nhánh." };
    var check = validateContact(data);
    if (!check.ok) return check;
    branch.phone = check.value.phone;
    branch.email = check.value.email;
    branch.contact = check.value.contact;
    branch.address = check.value.address;
    return { ok: true, message: "Đã cập nhật thông tin liên hệ." };
  }

  root.PharmaBranches = {
    PAGE_SIZE: PAGE_SIZE,
    validate: validate,
    validateContact: validateContact,
    query: query,
    inspect: inspect,
    constraints: constraints,
    isOperating: isOperating,
    setStatus: setStatus,
    applyContact: applyContact,
    phoneOk: phoneOk,
  };
})(typeof window !== "undefined" ? window : globalThis);
