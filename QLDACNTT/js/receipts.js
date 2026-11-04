/* Phiếu nhập: lập phiếu, dòng thuốc, lô, hạn dùng, tổng tiền, lưu, hủy, xác nhận và cộng tồn kho (task 220–235). */
(function (root) {
  var PAGE_SIZE = 6;

  function text(value) {
    return String(value == null ? "" : value).trim();
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

  function qtyOk(value) {
    var raw = digits(value);
    if (!/^\d+$/.test(raw)) return false;
    var n = Number(raw);
    return n > 0 && n < 1000000;
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

  function batchOk(value) {
    return /^[A-Z0-9][A-Z0-9./-]{1,29}$/.test(text(value).toUpperCase());
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

  function blank(branchId) {
    return { id: "", supplierId: "", branchId: branchId || "", note: "", lines: [] };
  }

  function byId(db, id) {
    return (db.receipts || []).find(function (item) { return item.id === id; }) || null;
  }

  function amountOf(line) {
    if (!qtyOk(line && line.qty) || !moneyOk(line && line.cost)) return null;
    return Number(digits(line.qty)) * Number(digits(line.cost));
  }

  function totalOf(lines) {
    var sum = 0;
    var ready = true;
    (lines || []).forEach(function (line) {
      var amount = amountOf(line);
      if (amount == null) ready = false;
      else sum += amount;
    });
    return { ready: ready, total: sum };
  }

  function addLine(draft, medicine) {
    if (!draft) return { ok: false, message: "Chưa mở phiếu nhập." };
    if (!medicine) return { ok: false, message: "Không tìm thấy thuốc." };
    var exists = (draft.lines || []).some(function (line) {
      return line.medicineId === medicine.id && !text(line.batch);
    });
    if (exists) return { ok: false, message: "Thuốc này đã có trong phiếu. Hãy nhập số lô hoặc xóa dòng cũ." };
    draft.lines = draft.lines || [];
    draft.lines.push({
      key: "ln" + Date.now() + draft.lines.length,
      medicineId: medicine.id,
      name: medicine.name,
      unit: medicine.unit || "",
      qty: "1",
      cost: String(medicine.cost || 0),
      batch: "",
      expiry: "",
    });
    return { ok: true };
  }

  function validateLine(line, ctx) {
    ctx = ctx || {};
    var med = (ctx.medicines || []).find(function (item) { return item.id === line.medicineId; });
    if (!med) return { ok: false, message: "Không tìm thấy thuốc trong phiếu nhập." };
    if (ctx.branchId && med.branchId !== ctx.branchId) {
      return { ok: false, message: med.name + " không thuộc chi nhánh của phiếu nhập." };
    }
    if (!qtyOk(line.qty)) return { ok: false, message: "Số lượng " + med.name + " phải là số nguyên lớn hơn 0." };
    if (!moneyOk(line.cost)) return { ok: false, message: "Giá nhập " + med.name + " phải là số nguyên không âm." };
    var batch = text(line.batch).toUpperCase();
    var expiry = text(line.expiry);
    if (!batchOk(batch)) return { ok: false, message: "Số lô cần 2–30 ký tự chữ, số, dấu chấm, gạch hoặc gạch chéo." };
    if (!dateOk(expiry)) return { ok: false, message: "Hạn sử dụng chưa đúng định dạng ngày (YYYY-MM-DD)." };
    if (ctx.today && expiry < ctx.today) return { ok: false, message: "Hạn sử dụng phải từ hôm nay trở đi." };
    var qty = Number(digits(line.qty));
    var cost = Number(digits(line.cost));
    return {
      ok: true,
      value: {
        key: line.key || ("ln" + med.id + batch),
        medicineId: med.id,
        name: med.name,
        unit: med.unit || "",
        qty: qty,
        cost: cost,
        batch: batch,
        expiry: expiry,
        amount: qty * cost,
      },
    };
  }

  function validate(draft, ctx) {
    ctx = ctx || {};
    var supplier = (ctx.suppliers || []).find(function (item) { return item.id === text(draft.supplierId); });
    var branch = (ctx.branches || []).find(function (item) { return item.id === text(draft.branchId); });
    var note = text(draft.note);
    if (!text(draft.supplierId)) return { ok: false, message: "Cần chọn nhà cung cấp." };
    if (!supplier) return { ok: false, message: "Không tìm thấy nhà cung cấp." };
    if ((supplier.status || "active") !== "active") return { ok: false, message: "Nhà cung cấp đang ngừng hợp tác." };
    if (!text(draft.branchId)) return { ok: false, message: "Cần chọn chi nhánh." };
    if (!branch) return { ok: false, message: "Không tìm thấy chi nhánh." };
    if (branch.status !== "open") return { ok: false, message: "Chi nhánh chưa mở cửa, không lập phiếu nhập." };
    if (note.length > 300) return { ok: false, message: "Ghi chú phiếu nhập quá dài." };
    var lines = draft.lines || [];
    if (!lines.length) return { ok: false, message: "Phiếu nhập cần ít nhất một dòng thuốc." };
    if (lines.length > 50) return { ok: false, message: "Một phiếu nhập tối đa 50 dòng thuốc." };
    var values = [];
    var seen = {};
    for (var i = 0; i < lines.length; i++) {
      var check = validateLine(lines[i], {
        medicines: ctx.medicines,
        branchId: branch.id,
        today: ctx.today,
      });
      if (!check.ok) return check;
      var key = check.value.medicineId + "|" + check.value.batch;
      if (seen[key]) return { ok: false, message: "Số lô " + check.value.batch + " của " + check.value.name + " bị trùng trong phiếu nhập." };
      seen[key] = true;
      values.push(check.value);
    }
    var total = values.reduce(function (sum, line) { return sum + line.amount; }, 0);
    return {
      ok: true,
      value: {
        supplierId: supplier.id,
        branchId: branch.id,
        note: note,
        lines: values,
        total: total,
      },
    };
  }

  function nextCode(receipts, day) {
    var prefix = "PN" + text(day).replace(/-/g, "") + "-";
    var max = 0;
    (receipts || []).forEach(function (item) {
      if (text(item.code).indexOf(prefix) !== 0) return;
      var n = Number(text(item.code).slice(prefix.length));
      if (n > max) max = n;
    });
    return prefix + String(max + 1).padStart(3, "0");
  }

  function contextOf(db, today) {
    return {
      suppliers: db.suppliers || [],
      branches: db.branches || [],
      medicines: db.medicines || [],
      today: today,
    };
  }

  function save(db, draft, actor, today) {
    ensure(db);
    draft = draft || {};
    var existing = text(draft.id) ? byId(db, draft.id) : null;
    if (text(draft.id) && !existing) return { ok: false, message: "Không tìm thấy phiếu nhập." };
    if (existing && existing.status !== "draft") return { ok: false, message: "Chỉ sửa phiếu đang nháp." };
    var check = validate(draft, contextOf(db, today));
    if (!check.ok) return check;
    if (existing) {
      existing.supplierId = check.value.supplierId;
      existing.branchId = check.value.branchId;
      existing.note = check.value.note;
      existing.lines = check.value.lines;
      existing.total = check.value.total;
      existing.updatedAt = new Date().toISOString();
      return { ok: true, message: "Đã lưu thay đổi phiếu nhập.", receipt: existing };
    }
    var row = {
      id: "pn" + Date.now(),
      code: nextCode(db.receipts, today),
      supplierId: check.value.supplierId,
      branchId: check.value.branchId,
      note: check.value.note,
      lines: check.value.lines,
      total: check.value.total,
      status: "draft",
      createdBy: actor && actor.name ? actor.name : "",
      at: new Date().toISOString(),
    };
    db.receipts.unshift(row);
    return { ok: true, message: "Đã lưu phiếu nhập.", receipt: row };
  }

  function toDraft(receipt) {
    return {
      id: receipt.id,
      supplierId: receipt.supplierId,
      branchId: receipt.branchId,
      note: receipt.note || "",
      lines: (receipt.lines || []).map(function (line, index) {
        return {
          key: line.key || ("ln" + index),
          medicineId: line.medicineId,
          name: line.name,
          unit: line.unit || "",
          qty: String(line.qty),
          cost: String(line.cost),
          batch: line.batch,
          expiry: line.expiry,
        };
      }),
    };
  }

  function existingLot(med, batch) {
    var key = text(batch).toUpperCase();
    var lots = Array.isArray(med.lots) ? med.lots : [];
    var found = null;
    lots.forEach(function (lot) {
      if (text(lot.batch).toUpperCase() === key) found = lot;
    });
    if (found) return found;
    if (!lots.length && text(med.batch).toUpperCase() === key) {
      return { batch: key, expiry: med.expiry || "", qty: Number(med.stock) || 0, virtual: true };
    }
    return null;
  }

  function lotConflict(med, line) {
    var found = existingLot(med, line.batch);
    if (found && found.expiry && found.expiry !== line.expiry) {
      return "Số lô " + line.batch + " của " + (line.name || med.name) + " đã có hạn sử dụng khác.";
    }
    return "";
  }

  function ensureLots(med) {
    if (!Array.isArray(med.lots)) med.lots = [];
    if (!med.lots.length && text(med.batch)) {
      med.lots.push({
        id: "lot-seed-" + med.id,
        batch: text(med.batch).toUpperCase(),
        expiry: med.expiry || "",
        qty: Number(med.stock) || 0,
      });
    }
    return med.lots;
  }

  function syncPrimary(med) {
    var lots = (med.lots || []).filter(function (lot) { return Number(lot.qty) > 0 && lot.expiry; });
    lots.sort(function (a, b) { return String(a.expiry).localeCompare(String(b.expiry)); });
    if (!lots.length) return;
    med.batch = lots[0].batch;
    med.expiry = lots[0].expiry;
  }

  function addStock(med, line) {
    var before = Number(med.stock) || 0;
    var lots = ensureLots(med);
    var key = text(line.batch).toUpperCase();
    var found = null;
    lots.forEach(function (lot) {
      if (text(lot.batch).toUpperCase() === key) found = lot;
    });
    if (found && found.expiry && found.expiry !== line.expiry) {
      return { ok: false, message: "Số lô " + key + " của " + med.name + " đã có hạn sử dụng khác." };
    }
    if (found) {
      found.qty = Number(found.qty) + line.qty;
      found.expiry = line.expiry;
      found.batch = key;
    } else {
      lots.unshift({
        id: "lot" + Date.now() + "-" + med.id + "-" + key,
        batch: key,
        expiry: line.expiry,
        qty: line.qty,
      });
    }
    med.stock = before + line.qty;
    syncPrimary(med);
    return { ok: true, before: before, after: med.stock };
  }

  function canReverse(med, line) {
    var found = existingLot(med, line.batch);
    if (!found) return { ok: false, message: "Không thấy số lô " + line.batch + " để hoàn kho." };
    if (Number(found.qty) < Number(line.qty)) return { ok: false, message: "Lô " + line.batch + " không đủ số lượng để hoàn." };
    if ((Number(med.stock) || 0) < Number(line.qty)) return { ok: false, message: "Tồn kho không đủ để hủy phiếu đã nhập." };
    return { ok: true };
  }

  function reverseStock(med, line) {
    var gate = canReverse(med, line);
    if (!gate.ok) return gate;
    var lots = ensureLots(med);
    var key = text(line.batch).toUpperCase();
    var found = null;
    lots.forEach(function (lot) {
      if (text(lot.batch).toUpperCase() === key) found = lot;
    });
    found.qty = Number(found.qty) - Number(line.qty);
    if (found.qty <= 0) med.lots = med.lots.filter(function (lot) { return lot !== found; });
    med.stock = (Number(med.stock) || 0) - Number(line.qty);
    syncPrimary(med);
    return { ok: true, after: med.stock };
  }

  function prepare(db, receipt, today) {
    if (!receipt) return { ok: false, message: "Không tìm thấy phiếu nhập." };
    if (receipt.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    if (receipt.status === "confirmed") return { ok: false, message: "Phiếu đã nhập kho, không xác nhận lại." };
    if (receipt.status !== "draft") return { ok: false, message: "Chỉ xác nhận phiếu đang nháp." };
    var check = validate(receipt, contextOf(db, today));
    if (!check.ok) return check;
    var rows = [];
    var bump = {};
    for (var i = 0; i < check.value.lines.length; i++) {
      var line = check.value.lines[i];
      var med = (db.medicines || []).find(function (item) { return item.id === line.medicineId; });
      var conflict = lotConflict(med, line);
      if (conflict) return { ok: false, message: conflict };
      var before = (Number(med.stock) || 0) + (bump[med.id] || 0);
      bump[med.id] = (bump[med.id] || 0) + line.qty;
      rows.push({ name: line.name, qty: line.qty, before: before, after: before + line.qty, batch: line.batch });
    }
    return { ok: true, value: check.value, rows: rows };
  }

  function confirm(db, id, today) {
    ensure(db);
    var receipt = byId(db, id);
    var plan = prepare(db, receipt, today);
    if (!plan.ok) return plan;
    receipt.lines = plan.value.lines;
    receipt.total = plan.value.total;
    receipt.lines.forEach(function (line) {
      var med = db.medicines.find(function (item) { return item.id === line.medicineId; });
      var applied = addStock(med, line);
      line.stockBefore = applied.before;
      line.stockAfter = applied.after;
    });
    receipt.status = "confirmed";
    receipt.confirmedAt = new Date().toISOString();
    return { ok: true, message: "Đã xác nhận nhập hàng và cộng tồn kho.", receipt: receipt, rows: plan.rows };
  }

  function cancel(db, id) {
    ensure(db);
    var receipt = byId(db, id);
    if (!receipt) return { ok: false, message: "Không tìm thấy phiếu nhập." };
    if (receipt.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    if (receipt.status === "confirmed") {
      var stockUse = {};
      var lotUse = {};
      for (var i = 0; i < (receipt.lines || []).length; i++) {
        var line = receipt.lines[i];
        var med = (db.medicines || []).find(function (item) { return item.id === line.medicineId; });
        if (!med) return { ok: false, message: "Không tìm thấy thuốc để hoàn kho." };
        var qty = Number(line.qty);
        var found = existingLot(med, line.batch);
        if (!found) return { ok: false, message: "Không thấy số lô " + line.batch + " để hoàn kho." };
        var lotKey = med.id + "|" + text(line.batch).toUpperCase();
        var nextLot = (lotUse[lotKey] || 0) + qty;
        var nextStock = (stockUse[med.id] || 0) + qty;
        if (Number(found.qty) < nextLot) return { ok: false, message: "Lô " + line.batch + " không đủ số lượng để hoàn." };
        if ((Number(med.stock) || 0) < nextStock) return { ok: false, message: "Tồn kho không đủ để hủy phiếu đã nhập." };
        lotUse[lotKey] = nextLot;
        stockUse[med.id] = nextStock;
      }
      for (var n = 0; n < receipt.lines.length; n++) {
        var row = receipt.lines[n];
        var target = db.medicines.find(function (item) { return item.id === row.medicineId; });
        var applied = reverseStock(target, row);
        if (!applied.ok) return applied;
      }
    }
    receipt.status = "cancelled";
    receipt.cancelledAt = new Date().toISOString();
    return { ok: true, message: "Đã hủy phiếu nhập.", receipt: receipt };
  }

  function query(list, opts) {
    opts = opts || {};
    var status = opts.status || "all";
    var branchId = opts.branchId || "all";
    var suppliers = opts.suppliers || [];
    var rows = (list || []).filter(function (item) {
      if (status !== "all" && item.status !== status) return false;
      if (branchId !== "all" && item.branchId !== branchId) return false;
      var supplier = suppliers.find(function (row) { return row.id === item.supplierId; });
      var blob = [item.code, item.note, supplier ? supplier.name : ""].join(" ");
      return keywordHit(blob, opts.q);
    });
    rows.sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || PAGE_SIZE);
  }

  root.PharmaReceipts = {
    PAGE_SIZE: PAGE_SIZE,
    ensure: ensure,
    blank: blank,
    byId: byId,
    amountOf: amountOf,
    totalOf: totalOf,
    addLine: addLine,
    validateLine: validateLine,
    validate: validate,
    nextCode: nextCode,
    save: save,
    toDraft: toDraft,
    prepare: prepare,
    confirm: confirm,
    cancel: cancel,
    query: query,
    lotConflict: lotConflict,
  };
})(typeof window !== "undefined" ? window : globalThis);
