/* Nhà cung cấp: thêm, danh sách, chi tiết, sửa, xóa, tìm kiếm, liên hệ, trạng thái (task 212–219). */
(function (root) {
  var PAGE_SIZE = 6;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function phoneOk(value) {
    var raw = text(value).replace(/[\s.+()-]/g, "");
    return /^0\d{8,10}$/.test(raw) || /^84\d{8,10}$/.test(raw);
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  }

  function taxOk(value) {
    return /^\d{10}$/.test(text(value)) || /^\d{13}$/.test(text(value));
  }

  function keywordHit(blob, q) {
    var parts = text(q).toLowerCase().split(/\s+/).filter(Boolean);
    if (!parts.length) return true;
    var hay = String(blob || "").toLowerCase();
    return parts.every(function (part) { return hay.indexOf(part) >= 0; });
  }

  function ensure(db) {
    if (!Array.isArray(db.suppliers)) db.suppliers = [];
    if (!Array.isArray(db.receipts)) db.receipts = [];
  }

  function nextCode(suppliers) {
    var max = 0;
    (suppliers || []).forEach(function (item) {
      var match = text(item.code).toUpperCase().match(/^NCC(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    });
    return "NCC" + String(max + 1).padStart(4, "0");
  }

  function sameName(list, name, id) {
    return (list || []).some(function (item) {
      return item.id !== id && lower(item.name) === lower(name);
    });
  }

  function validate(data, suppliers) {
    var id = text(data.id);
    var name = text(data.name);
    var phone = text(data.phone);
    var email = text(data.email);
    var address = text(data.address);
    var contact = text(data.contact);
    var taxCode = text(data.taxCode);
    var note = text(data.note);
    var status = data.status === "inactive" ? "inactive" : "active";
    if (name.length < 2) return { ok: false, message: "Tên nhà cung cấp cần ít nhất 2 ký tự." };
    if (name.length > 160) return { ok: false, message: "Tên nhà cung cấp quá dài." };
    if (sameName(suppliers, name, id)) return { ok: false, message: "Tên nhà cung cấp đã tồn tại." };
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại chưa hợp lệ." };
    if (email && !emailOk(email)) return { ok: false, message: "Email chưa hợp lệ." };
    if (address.length < 5) return { ok: false, message: "Địa chỉ cần ít nhất 5 ký tự." };
    if (address.length > 200) return { ok: false, message: "Địa chỉ quá dài." };
    if (contact.length > 80) return { ok: false, message: "Người liên hệ quá dài." };
    if (taxCode && !taxOk(taxCode)) return { ok: false, message: "Mã số thuế cần 10 hoặc 13 chữ số." };
    if (note.length > 300) return { ok: false, message: "Ghi chú quá dài." };
    return {
      ok: true,
      value: {
        name: name,
        phone: phone,
        email: email,
        address: address,
        contact: contact,
        taxCode: taxCode,
        note: note,
        status: status,
      },
    };
  }

  function inspect(supplier) {
    if (!supplier) return { ok: false, missing: ["nhà cung cấp"] };
    var missing = [];
    if (text(supplier.name).length < 2) missing.push("tên");
    if (!phoneOk(supplier.phone || "")) missing.push("điện thoại");
    if (supplier.email && !emailOk(supplier.email)) missing.push("email");
    if (text(supplier.address).length < 5) missing.push("địa chỉ");
    return { ok: missing.length === 0, missing: missing };
  }

  function save(db, data) {
    ensure(db);
    var existing = text(data.id) ? db.suppliers.find(function (item) { return item.id === data.id; }) : null;
    if (text(data.id) && !existing) return { ok: false, message: "Không tìm thấy nhà cung cấp." };
    var check = validate(data, db.suppliers);
    if (!check.ok) return check;
    if (existing) {
      Object.assign(existing, check.value);
      return { ok: true, message: "Đã lưu thay đổi nhà cung cấp.", supplier: existing };
    }
    var row = Object.assign({
      id: "ncc" + Date.now(),
      code: nextCode(db.suppliers),
      createdAt: new Date().toISOString(),
    }, check.value);
    db.suppliers.push(row);
    return { ok: true, message: "Đã lưu nhà cung cấp.", supplier: row };
  }

  function applyContact(supplier, data) {
    if (!supplier) return { ok: false, message: "Không tìm thấy nhà cung cấp." };
    var phone = text(data.phone);
    var email = text(data.email);
    var address = text(data.address);
    if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại chưa hợp lệ." };
    if (email && !emailOk(email)) return { ok: false, message: "Email chưa hợp lệ." };
    if (address.length < 5) return { ok: false, message: "Địa chỉ cần ít nhất 5 ký tự." };
    if (address.length > 200) return { ok: false, message: "Địa chỉ quá dài." };
    supplier.phone = phone;
    supplier.email = email;
    supplier.address = address;
    return { ok: true, message: "Đã cập nhật thông tin liên hệ." };
  }

  function setStatus(supplier, status) {
    if (!supplier) return { ok: false, message: "Không tìm thấy nhà cung cấp." };
    if (status !== "active" && status !== "inactive") return { ok: false, message: "Trạng thái không hợp lệ." };
    supplier.status = status;
    return {
      ok: true,
      message: status === "active" ? "Đã mở lại nhà cung cấp." : "Đã ngừng hợp tác với nhà cung cấp.",
    };
  }

  function receiptCount(receipts, supplierId) {
    return (receipts || []).filter(function (item) { return item.supplierId === supplierId; }).length;
  }

  function remove(db, id) {
    ensure(db);
    var supplier = db.suppliers.find(function (item) { return item.id === id; });
    if (!supplier) return { ok: false, message: "Không tìm thấy nhà cung cấp." };
    var count = receiptCount(db.receipts, id);
    if (count) return { ok: false, message: "Nhà cung cấp đang có " + count + " phiếu nhập, không xóa được." };
    db.suppliers = db.suppliers.filter(function (item) { return item.id !== id; });
    return { ok: true, message: "Đã xóa nhà cung cấp." };
  }

  function query(list, opts) {
    opts = opts || {};
    var status = opts.status || "all";
    var rows = (list || []).filter(function (item) {
      if (status !== "all" && (item.status || "active") !== status) return false;
      var blob = [item.name, item.code, item.phone, item.email, item.address, item.contact].join(" ");
      return keywordHit(blob, opts.q);
    });
    rows.sort(function (a, b) { return text(a.name).localeCompare(text(b.name), "vi"); });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || PAGE_SIZE);
  }

  function history(receipts, supplierId) {
    return (receipts || []).filter(function (item) { return item.supplierId === supplierId; }).sort(function (a, b) {
      return String(b.at || "").localeCompare(String(a.at || ""));
    });
  }

  function byId(db, id) {
    return (db.suppliers || []).find(function (item) { return item.id === id; }) || null;
  }

  root.PharmaSuppliers = {
    PAGE_SIZE: PAGE_SIZE,
    ensure: ensure,
    nextCode: nextCode,
    validate: validate,
    inspect: inspect,
    save: save,
    applyContact: applyContact,
    setStatus: setStatus,
    receiptCount: receiptCount,
    remove: remove,
    query: query,
    history: history,
    byId: byId,
  };
})(typeof window !== "undefined" ? window : globalThis);
