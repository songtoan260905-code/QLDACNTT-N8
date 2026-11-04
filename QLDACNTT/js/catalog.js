/* Danh mục, nhà sản xuất, đơn vị tính và dạng bào chế (task 190–191, 197–206). */
(function (root) {
  var UNITS = [
    { id: "u-hop", name: "Hộp" },
    { id: "u-vien", name: "Viên" },
    { id: "u-chai", name: "Chai" },
    { id: "u-tuyp", name: "Tuýp" },
    { id: "u-goi", name: "Gói" },
    { id: "u-lo", name: "Lọ" },
  ];
  var FORMS = [
    { id: "f-vien", name: "Viên nén" },
    { id: "f-nang", name: "Viên nang" },
    { id: "f-siro", name: "Siro" },
    { id: "f-goi", name: "Cốm / gói" },
    { id: "f-ong", name: "Ống tiêm" },
    { id: "f-mo", name: "Thuốc mỡ" },
    { id: "f-nho", name: "Dung dịch nhỏ" },
    { id: "f-hon", name: "Hỗn dịch" },
  ];

  function text(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function phoneOk(value) {
    var raw = text(value).replace(/[\s.+()-]/g, "");
    return /^0\d{8,10}$/.test(raw) || /^84\d{8,10}$/.test(raw);
  }

  function tokens(q) {
    return text(q).toLowerCase().split(/\s+/).filter(Boolean);
  }

  function ensure(db) {
    if (!Array.isArray(db.categories)) db.categories = [];
    if (!Array.isArray(db.manufacturers)) db.manufacturers = [];
    if (!Array.isArray(db.units)) db.units = [];
    if (!Array.isArray(db.dosageForms)) db.dosageForms = [];
    UNITS.forEach(function (item) {
      if (!db.units.some(function (unit) { return unit.id === item.id; })) {
        db.units.push({ id: item.id, name: item.name, builtin: true });
      }
    });
    FORMS.forEach(function (item) {
      if (!db.dosageForms.some(function (form) { return form.id === item.id; })) {
        db.dosageForms.push({ id: item.id, name: item.name, builtin: true });
      }
    });
  }

  function uniqueName(list, name, id) {
    return (list || []).some(function (item) {
      return item.id !== id && lower(item.name) === lower(name);
    });
  }

  function validateCategory(data, categories) {
    var name = text(data.name);
    var id = text(data.id);
    if (name.length < 2) return { ok: false, message: "Tên danh mục cần ít nhất 2 ký tự." };
    if (name.length > 80) return { ok: false, message: "Tên danh mục quá dài." };
    if (uniqueName(categories, name, id)) return { ok: false, message: "Tên danh mục đã tồn tại." };
    return { ok: true, value: { name: name } };
  }

  function validateManufacturer(data, manufacturers) {
    var name = text(data.name);
    var id = text(data.id);
    var phone = text(data.phone);
    var country = text(data.country);
    var status = data.status === "inactive" ? "inactive" : "active";
    if (name.length < 2) return { ok: false, message: "Tên nhà sản xuất cần ít nhất 2 ký tự." };
    if (name.length > 120) return { ok: false, message: "Tên nhà sản xuất quá dài." };
    if (phone && !phoneOk(phone)) return { ok: false, message: "Số điện thoại nhà sản xuất chưa hợp lệ." };
    if (country.length > 80) return { ok: false, message: "Quốc gia quá dài." };
    if (uniqueName(manufacturers, name, id)) return { ok: false, message: "Nhà sản xuất đã tồn tại." };
    return { ok: true, value: { name: name, phone: phone, country: country, status: status } };
  }

  function validateNamed(data, list, emptyMessage, longMessage, dupMessage) {
    var name = text(data.name);
    var id = text(data.id);
    if (!name) return { ok: false, message: emptyMessage };
    if (name.length > 40) return { ok: false, message: longMessage };
    if (uniqueName(list, name, id)) return { ok: false, message: dupMessage };
    return { ok: true, value: { name: name } };
  }

  function validateUnit(data, units) {
    return validateNamed(data, units, "Cần tên đơn vị tính.", "Tên đơn vị quá dài.", "Đơn vị tính đã tồn tại.");
  }

  function validateForm(data, forms) {
    return validateNamed(data, forms, "Cần tên dạng bào chế.", "Tên dạng bào chế quá dài.", "Dạng bào chế đã tồn tại.");
  }

  function setMakerStatus(maker, status) {
    if (!maker) return { ok: false, message: "Không tìm thấy nhà sản xuất." };
    if (status !== "active" && status !== "inactive") return { ok: false, message: "Trạng thái nhà sản xuất không hợp lệ." };
    maker.status = status;
    return {
      ok: true,
      message: status === "inactive" ? "Đã ngừng hợp tác với nhà sản xuất." : "Đã kích hoạt nhà sản xuất.",
    };
  }

  function label(list, id) {
    var found = (list || []).find(function (item) { return item.id === id; });
    return found ? found.name : "";
  }

  function usage(medicines, key, id) {
    var count = (medicines || []).filter(function (med) { return med[key] === id; }).length;
    return { count: count, blocked: count > 0 };
  }

  function renameLinked(medicines, idKey, id, nameKey, name) {
    (medicines || []).forEach(function (med) {
      if (med[idKey] === id) med[nameKey] = name;
    });
  }

  function queryList(list, opts) {
    opts = opts || {};
    var parts = tokens(opts.q);
    var status = opts.status || "all";
    var rows = (list || []).filter(function (item) {
      if (status !== "all" && (item.status || "active") !== status) return false;
      if (!parts.length) return true;
      var blob = [item.name, item.phone, item.country].join(" ").toLowerCase();
      return parts.every(function (part) { return blob.indexOf(part) >= 0; });
    });
    rows = rows.slice().sort(function (a, b) {
      return text(a.name).localeCompare(text(b.name), "vi");
    });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || 5);
  }

  root.PharmaCatalog = {
    ensure: ensure,
    validateCategory: validateCategory,
    validateManufacturer: validateManufacturer,
    validateUnit: validateUnit,
    validateForm: validateForm,
    setMakerStatus: setMakerStatus,
    label: label,
    usage: usage,
    renameLinked: renameLinked,
    queryList: queryList,
  };
})(typeof window !== "undefined" ? window : globalThis);
