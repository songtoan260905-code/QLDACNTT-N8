/* Thuốc: mã, giá, hạn dùng, lô, tìm kiếm, lọc và trạng thái kinh doanh (task 176–189, 192–196, 207–208). */
(function (root) {
  var PAGE_SIZE = 6;

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

  function moneyOk(value) {
    var raw = digits(value);
    if (!/^\d+$/.test(raw)) return false;
    return Number(raw) < 1e12;
  }

  function intOk(value) {
    var raw = digits(value);
    if (!/^\d+$/.test(raw)) return false;
    return Number(raw) < 1000000;
  }

  function dateOk(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    if (!match) return false;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function daysUntil(iso, today) {
    if (!dateOk(iso) || !dateOk(today)) return -99999;
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
    var b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    var left = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
    var right = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
    return Math.round((right - left) / 86400000);
  }

  function codeOk(value) {
    return /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(text(value).toUpperCase());
  }

  function strengthOk(value) {
    return /^\d+(?:[.,]\d+)?\s*(mg|g|mcg|µg|ml|l|iu|ui|%)$/i.test(text(value));
  }

  function batchOk(value) {
    return /^[A-Z0-9][A-Z0-9./-]{1,29}$/.test(text(value).toUpperCase());
  }

  function nextCode(medicines) {
    var max = 0;
    (medicines || []).forEach(function (med) {
      var match = text(med.code || med.sku).toUpperCase().match(/^T(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    });
    return "T" + String(max + 1).padStart(4, "0");
  }

  function sameCode(med, code, id) {
    if (med.id === id) return false;
    var needle = text(code).toUpperCase();
    return text(med.code).toUpperCase() === needle || text(med.sku).toUpperCase() === needle;
  }

  function validate(data, ctx) {
    ctx = ctx || {};
    var id = text(data.id);
    var name = text(data.name);
    var code = text(data.code).toUpperCase();
    var ingredient = text(data.activeIngredient);
    var strength = text(data.strength);
    var batch = text(data.batch).toUpperCase();
    var expiry = text(data.expiry);
    var branchId = text(data.branchId);
    var status = data.status === "discontinued" ? "discontinued" : "active";
    var category = (ctx.categories || []).find(function (item) { return item.id === data.categoryId; });
    var maker = (ctx.manufacturers || []).find(function (item) { return item.id === data.manufacturerId; });
    var unit = (ctx.units || []).find(function (item) { return item.id === data.unitId; });
    var form = (ctx.forms || []).find(function (item) { return item.id === data.dosageFormId; });

    if (name.length < 2) return { ok: false, message: "Tên thuốc cần ít nhất 2 ký tự." };
    if (name.length > 160) return { ok: false, message: "Tên thuốc quá dài." };
    if (!codeOk(code)) return { ok: false, message: "Mã thuốc cần 2–20 ký tự chữ, số hoặc gạch ngang." };
    if ((ctx.medicines || []).some(function (med) { return sameCode(med, code, id); })) {
      return { ok: false, message: "Mã thuốc đã tồn tại." };
    }
    if (ingredient.length < 2) return { ok: false, message: "Cần nhập hoạt chất." };
    if (ingredient.length > 160) return { ok: false, message: "Hoạt chất quá dài." };
    if (!strengthOk(strength)) return { ok: false, message: "Hàm lượng cần dạng như 500mg, 5ml hoặc 10%." };
    if (!category) return { ok: false, message: "Cần chọn danh mục thuốc." };
    if (!maker) return { ok: false, message: "Cần chọn nhà sản xuất." };
    if (maker.status === "inactive" && data.manufacturerId !== ctx.keepManufacturerId) {
      return { ok: false, message: "Nhà sản xuất đang ngừng hợp tác." };
    }
    if (!unit) return { ok: false, message: "Cần chọn đơn vị tính." };
    if (!form) return { ok: false, message: "Cần chọn dạng bào chế." };
    if (!moneyOk(data.cost)) return { ok: false, message: "Giá nhập phải là số nguyên không âm." };
    if (!moneyOk(data.price)) return { ok: false, message: "Giá bán phải là số nguyên không âm." };
    var cost = Number(digits(data.cost));
    var price = Number(digits(data.price));
    if (price < cost) return { ok: false, message: "Giá bán không được thấp hơn giá nhập." };
    if (!intOk(data.minStock)) return { ok: false, message: "Tồn tối thiểu phải là số nguyên không âm." };
    var stock = 0;
    if (!ctx.editing) {
      if (!intOk(data.stock)) return { ok: false, message: "Tồn đầu phải là số nguyên không âm." };
      stock = Number(digits(data.stock));
    }
    if (!dateOk(expiry)) return { ok: false, message: "Hạn sử dụng chưa đúng định dạng ngày (YYYY-MM-DD)." };
    if (!ctx.editing && ctx.today && expiry < ctx.today) return { ok: false, message: "Hạn sử dụng phải từ hôm nay trở đi." };
    if (!batchOk(batch)) return { ok: false, message: "Số lô cần 2–30 ký tự chữ, số, dấu chấm, gạch hoặc gạch chéo." };
    if (!branchId) return { ok: false, message: "Cần chọn chi nhánh." };
    var duplicated = (ctx.medicines || []).some(function (med) {
      if (med.id === id) return false;
      return med.branchId === branchId && lower(med.name) === lower(name) && lower(med.strength || "") === lower(strength);
    });
    if (duplicated) return { ok: false, message: "Thuốc cùng tên và hàm lượng đã có tại chi nhánh này." };

    var value = {
      name: name,
      code: code,
      sku: code,
      categoryId: category.id,
      category: category.name,
      manufacturerId: maker.id,
      supplier: maker.name,
      unitId: unit.id,
      unit: unit.name,
      dosageFormId: form.id,
      dosageForm: form.name,
      activeIngredient: ingredient,
      strength: strength,
      cost: cost,
      price: price,
      minStock: Number(digits(data.minStock)),
      expiry: expiry,
      batch: batch,
      branchId: branchId,
      status: status,
    };
    if (!ctx.editing) value.stock = stock;
    return { ok: true, value: value };
  }

  function rememberLot(med, batch, expiry, qty) {
    if (!Array.isArray(med.lots)) med.lots = [];
    var key = text(batch).toUpperCase();
    var found = med.lots.find(function (lot) { return text(lot.batch).toUpperCase() === key; });
    if (found) {
      found.expiry = expiry;
      found.qty = qty;
      found.batch = key;
    } else {
      med.lots.unshift({ id: "lot" + Date.now(), batch: key, expiry: expiry, qty: qty });
    }
    med.batch = key;
    med.expiry = expiry;
    return med.lots;
  }

  function lotsOf(med) {
    if (med.lots && med.lots.length) return med.lots;
    if (!med.batch && !med.expiry) return [];
    return [{ batch: med.batch || "", expiry: med.expiry || "", qty: med.stock }];
  }

  function tradeOf(med) {
    if ((med.status || "active") === "discontinued") return ["bad", "Ngừng kinh doanh", "discontinued"];
    return ["ok", "Đang kinh doanh", "active"];
  }

  function setStatus(med, status) {
    if (!med) return { ok: false, message: "Không tìm thấy thuốc." };
    if (status !== "active" && status !== "discontinued") return { ok: false, message: "Trạng thái thuốc không hợp lệ." };
    med.status = status;
    return {
      ok: true,
      message: status === "discontinued" ? "Đã ngừng kinh doanh thuốc." : "Đã mở bán lại thuốc.",
    };
  }

  function sellable(med, today) {
    if (!med) return { ok: false, message: "Không tìm thấy thuốc." };
    if ((med.status || "active") !== "active") return { ok: false, message: "Thuốc đang ngừng kinh doanh, không bán được." };
    if (daysUntil(med.expiry, today) < 0) return { ok: false, message: "Thuốc đã hết hạn." };
    if (Number(med.stock) <= 0) return { ok: false, message: "Thuốc đã hết hàng." };
    return { ok: true };
  }

  function relatedSales(sales, medicineId) {
    var count = 0;
    (sales || []).forEach(function (sale) {
      (sale.lines || []).forEach(function (line) {
        if (line.medicineId === medicineId) count += 1;
      });
    });
    return { count: count, blocked: count > 0 };
  }

  function keywordHit(blob, q) {
    var parts = text(q).toLowerCase().split(/\s+/).filter(Boolean);
    if (!parts.length) return true;
    var hay = String(blob || "").toLowerCase();
    return parts.every(function (part) { return hay.indexOf(part) >= 0; });
  }

  function isStable(med, today) {
    if ((med.status || "active") === "discontinued") return false;
    var left = daysUntil(med.expiry, today);
    if (left <= 30) return false;
    if (Number(med.stock) <= 0) return false;
    if (Number(med.stock) <= Number(med.minStock)) return false;
    return true;
  }

  function query(list, opts) {
    opts = opts || {};
    var categoryId = opts.categoryId || "all";
    var manufacturerId = opts.manufacturerId || "all";
    var status = opts.status || "all";
    var selected = (opts.categories || []).find(function (item) { return item.id === categoryId; });
    var categoryName = selected ? selected.name : categoryId;
    var rows = (list || []).filter(function (med) {
      var blob = [
        med.name, med.code, med.sku, med.activeIngredient, med.strength,
        med.category, med.batch, med.supplier, med.dosageForm,
      ].join(" ");
      if (!keywordHit(blob, opts.q)) return false;
      if (categoryId !== "all" && med.categoryId !== categoryId && lower(med.category) !== lower(categoryName)) return false;
      if (manufacturerId !== "all" && med.manufacturerId !== manufacturerId) return false;
      if (status !== "all" && (med.status || "active") !== status) return false;
      if (opts.chip === "low" && !(Number(med.stock) <= Number(med.minStock))) return false;
      if (opts.chip === "exp" && daysUntil(med.expiry, opts.today) > 45) return false;
      if (opts.chip === "ok" && !isStable(med, opts.today)) return false;
      return true;
    });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || PAGE_SIZE);
  }

  root.PharmaMedicines = {
    PAGE_SIZE: PAGE_SIZE,
    nextCode: nextCode,
    validate: validate,
    rememberLot: rememberLot,
    lotsOf: lotsOf,
    tradeOf: tradeOf,
    setStatus: setStatus,
    sellable: sellable,
    relatedSales: relatedSales,
    query: query,
    daysUntil: daysUntil,
  };
})(typeof window !== "undefined" ? window : globalThis);
