/* Tồn kho, lô, hạn dùng, kiểm kê, chuyển kho và cảnh báo (task 262–280). */
(function (root) {
  var PAGE_SIZE = 8;
  var REASONS = [
    ["count", "Đếm lệch"],
    ["damage", "Hỏng, vỡ"],
    ["expiry", "Loại bỏ hết hạn"],
    ["loss", "Thất thoát"],
    ["found", "Phát hiện thừa"],
    ["other", "Nguyên nhân khác"],
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

  function parseQty(value, allowZero) {
    var raw = digits(value);
    if (!/^\d+$/.test(raw)) return null;
    var number = Number(raw);
    if (number >= 1000000) return null;
    if (!allowZero && number < 1) return null;
    return number;
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
    if (!dateOk(iso) || !dateOk(today)) return null;
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
    var b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    var left = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
    var right = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
    return Math.round((right - left) / 86400000);
  }

  function pageOf(rows, page, size) {
    if (root.PharmaPager) return root.PharmaPager.clamp(rows, page, size || PAGE_SIZE);
    var list = rows || [];
    var pageSize = size > 0 ? size : PAGE_SIZE;
    var pages = Math.max(1, Math.ceil(list.length / pageSize));
    var current = Math.min(Math.max(1, Number(page) || 1), pages);
    var start = (current - 1) * pageSize;
    return { rows: list.slice(start, start + pageSize), total: list.length, page: current, pages: pages, pageSize: pageSize };
  }

  function stamp() {
    return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function ensure(db) {
    if (!db.settings || typeof db.settings !== "object") db.settings = {};
    if (db.settings.stockAlert == null) db.settings.stockAlert = true;
    if (db.settings.expiryAlert == null) db.settings.expiryAlert = true;
    if (!Number.isInteger(db.settings.expiryWarnDays)) db.settings.expiryWarnDays = 45;
    if (!Array.isArray(db.stocktakes)) db.stocktakes = [];
    if (!Array.isArray(db.transfers)) db.transfers = [];
    if (!Array.isArray(db.notifications)) db.notifications = [];
    if (!db.alertInbox || typeof db.alertInbox !== "object" || Array.isArray(db.alertInbox)) db.alertInbox = {};
  }

  function warnDays(settings) {
    var number = Number(settings && settings.expiryWarnDays);
    if (!Number.isInteger(number) || number < 1 || number > 365) return 45;
    return number;
  }

  function setWarnDays(settings, value) {
    var number = parseQty(value, false);
    if (number == null || number > 365) return { ok: false, message: "Khoảng cảnh báo hạn dùng từ 1 đến 365 ngày." };
    settings.expiryWarnDays = number;
    return { ok: true, days: number, message: "Đã lưu mốc cảnh báo hạn dùng: " + number + " ngày." };
  }

  function keywordHit(med, q) {
    var parts = text(q).toLowerCase().split(/\s+/).filter(Boolean);
    if (!parts.length) return true;
    var hay = (text(med.code) + " " + text(med.sku) + " " + text(med.name)).toLowerCase();
    return parts.every(function (part) { return hay.indexOf(part) >= 0; });
  }

  function filterMeds(list, opts) {
    opts = opts || {};
    var branchId = opts.branchId || "all";
    var categoryId = opts.categoryId || "all";
    return (list || []).filter(function (med) {
      if (!keywordHit(med, opts.q)) return false;
      if (branchId !== "all" && med.branchId !== branchId) return false;
      if (categoryId !== "all" && med.categoryId !== categoryId) return false;
      return true;
    });
  }

  function lotsOf(med) {
    if (root.PharmaMedicines && root.PharmaMedicines.lotsOf) return root.PharmaMedicines.lotsOf(med);
    if (med.lots && med.lots.length) return med.lots;
    if (!med.batch && !med.expiry) return [];
    return [{ batch: med.batch || "", expiry: med.expiry || "", qty: med.stock }];
  }

  function sumLots(med) {
    return (med.lots || []).reduce(function (total, lot) { return total + (Number(lot.qty) || 0); }, 0);
  }

  function stockCheck(med) {
    var stock = Number(med.stock) || 0;
    var lots = Array.isArray(med.lots) ? med.lots : [];
    if (!lots.length) return { ok: true, stock: stock, lotSum: stock, hasLots: false };
    var lotSum = sumLots(med);
    return { ok: lotSum === stock, stock: stock, lotSum: lotSum, hasLots: true };
  }

  function queryStock(list, opts) {
    var rows = filterMeds(list, opts).slice().sort(function (a, b) {
      return text(a.name).localeCompare(text(b.name), "vi");
    });
    return pageOf(rows, opts && opts.page);
  }

  function listLots(list, opts) {
    var items = [];
    filterMeds(list, opts).forEach(function (med) {
      lotsOf(med).forEach(function (lot) {
        items.push({
          med: med,
          batch: lot.batch || "",
          expiry: lot.expiry || "",
          qty: Number(lot.qty) || 0,
          strength: med.strength || "",
          supplier: med.supplier || "",
          unit: med.unit || "",
        });
      });
    });
    items.sort(function (a, b) {
      var byName = text(a.med.name).localeCompare(text(b.med.name), "vi");
      if (byName) return byName;
      return text(a.expiry).localeCompare(text(b.expiry));
    });
    return pageOf(items, opts && opts.page);
  }

  function expiryKey(value) {
    return dateOk(value) ? text(value) : "9999-12-31";
  }

  function expiryBoard(list, opts) {
    opts = opts || {};
    var windowDays = warnDays(opts.settings);
    var items = [];
    var near = 0;
    filterMeds(list, opts).forEach(function (med) {
      var lots = lotsOf(med);
      if (!lots.length) {
        lots = [{ batch: med.batch || "", expiry: med.expiry || "", qty: Number(med.stock) || 0 }];
      }
      lots.forEach(function (lot) {
        var expiry = lot.expiry || "";
        var left = daysUntil(expiry, opts.today);
        var flagged = left != null && left <= windowDays;
        if (flagged) near += 1;
        var label = "Còn hạn";
        var level = "ok";
        if (left == null) {
          label = "Chưa có hạn";
          level = "neutral";
        } else if (left < 0) {
          label = "Đã hết hạn";
          level = "bad";
        } else if (left <= windowDays) {
          label = "Gần hết hạn";
          level = "warn";
        }
        items.push({
          med: med,
          batch: lot.batch || "",
          expiry: expiry,
          qty: Number(lot.qty) || 0,
          left: left,
          near: flagged,
          label: label,
          level: level,
        });
      });
    });
    items.sort(function (a, b) { return expiryKey(a.expiry).localeCompare(expiryKey(b.expiry)); });
    var shown = opts.nearOnly ? items.filter(function (item) { return item.near; }) : items;
    var paged = pageOf(shown, opts.page);
    paged.near = near;
    paged.windowDays = windowDays;
    return paged;
  }

  function pushAlert(rows, med, kind, code, level, title, body) {
    rows.push({
      id: med.id + "-" + code,
      med: med,
      kind: kind,
      code: code,
      level: level,
      title: title,
      text: body,
    });
  }

  function soonest(med, today) {
    var best = null;
    lotsOf(med).forEach(function (lot) {
      var left = daysUntil(lot.expiry, today);
      if (left == null) return;
      if (!best || left < best.left) best = { left: left, expiry: lot.expiry, batch: lot.batch || "" };
    });
    return best;
  }

  function collect(list, opts) {
    opts = opts || {};
    var settings = opts.settings || {};
    var windowDays = warnDays(settings);
    var stockOn = settings.stockAlert !== false;
    var expiryOn = settings.expiryAlert !== false;
    var rows = [];
    (list || []).forEach(function (med) {
      var stock = Number(med.stock) || 0;
      var minStock = Number(med.minStock) || 0;
      var unit = med.unit || "đơn vị";
      if (stockOn) {
        if (stock <= 0) {
          pushAlert(rows, med, "stock", "out", "bad", "Hết hàng", med.name + " đã hết hàng.");
        } else if (minStock > 0 && stock < minStock) {
          pushAlert(rows, med, "stock", "under", "bad", "Dưới tồn tối thiểu", med.name + " còn " + stock + " " + unit + ", mức tối thiểu " + minStock + ".");
        } else if (minStock > 0 && stock === minStock) {
          pushAlert(rows, med, "stock", "low", "warn", "Sắp hết", med.name + " đang chạm mức cảnh báo " + minStock + " " + unit + ".");
        }
      }
      if (expiryOn) {
        var hit = soonest(med, opts.today);
        if (hit && hit.left < 0) {
          pushAlert(rows, med, "expiry", "expired", "bad", "Đã hết hạn", med.name + " lô " + (hit.batch || "—") + " hết hạn " + hit.expiry + ".");
        } else if (hit && hit.left <= windowDays) {
          pushAlert(rows, med, "expiry", "soon", "warn", "Sắp hết hạn", med.name + " còn " + hit.left + " ngày, hạn " + hit.expiry + ".");
        }
      }
    });
    return rows;
  }

  function openAlerts(list, opts) {
    opts = opts || {};
    if (opts.db) ensure(opts.db);
    var inbox = (opts.db && opts.db.alertInbox) || {};
    return collect(list, opts).filter(function (row) {
      return !(inbox[row.id] && inbox[row.id].dismissed);
    }).map(function (row) {
      row.read = !!(inbox[row.id] && inbox[row.id].read);
      return row;
    });
  }

  function markAlertRead(db, id) {
    ensure(db);
    if (!id) return { ok: false, message: "Không tìm thấy cảnh báo." };
    var entry = db.alertInbox[id] || { read: false, dismissed: false };
    if (entry.dismissed) return { ok: false, message: "Cảnh báo đã được xóa." };
    if (entry.read) return { ok: true, already: true };
    entry.read = true;
    db.alertInbox[id] = entry;
    return { ok: true, already: false };
  }

  function dismissAlert(db, id) {
    ensure(db);
    var entry = db.alertInbox[id];
    if (!entry || !entry.read) return { ok: false, message: "Hãy đọc cảnh báo trước khi xóa." };
    if (entry.dismissed) return { ok: true, already: true, message: "Cảnh báo đã được xóa." };
    entry.dismissed = true;
    db.alertInbox[id] = entry;
    return { ok: true, already: false, message: "Đã xóa cảnh báo." };
  }

  function collectView(list, opts) {
    opts = opts || {};
    var rows = openAlerts(list, opts);
    var counts = { all: rows.length, low: 0, under: 0, out: 0, expiry: 0, stock: 0 };
    rows.forEach(function (row) {
      if (row.kind === "stock") counts.stock += 1;
      if (row.kind === "expiry") counts.expiry += 1;
      if (counts[row.code] != null) counts[row.code] += 1;
    });
    var chip = opts.chip || "all";
    var shown = rows.filter(function (row) {
      if (chip === "all") return true;
      if (chip === "stock") return row.kind === "stock";
      if (chip === "expiry") return row.kind === "expiry";
      return row.code === chip;
    });
    var paged = pageOf(shown, opts.page);
    paged.counts = counts;
    paged.windowDays = warnDays(opts.settings);
    return paged;
  }

  function findById(list, id) {
    var found = null;
    (list || []).forEach(function (item) {
      if (item.id === id) found = item;
    });
    return found;
  }

  function nextCode(rows, prefix, today) {
    var stampDay = text(today).replace(/-/g, "");
    if (!/^\d{8}$/.test(stampDay)) stampDay = "00000000";
    var base = prefix + stampDay + "-";
    var max = 0;
    (rows || []).forEach(function (row) {
      var code = text(row.code);
      if (code.indexOf(base) !== 0) return;
      var number = Number(code.slice(base.length));
      if (number > max) max = number;
    });
    return base + String(max + 1).padStart(3, "0");
  }

  function noteOf(db, title, body, priority) {
    db.notifications.unshift({
      id: "n" + stamp(),
      type: "stock",
      title: title,
      body: body,
      at: new Date().toISOString(),
      read: false,
      priority: priority || "low",
    });
  }

  function reasonName(id) {
    var found = "Nguyên nhân khác";
    REASONS.forEach(function (row) {
      if (row[0] === id) found = row[1];
    });
    return found;
  }

  function createStocktake(db, input) {
    ensure(db);
    input = input || {};
    var branch = findById(db.branches, text(input.branchId));
    if (!branch) return { ok: false, message: "Cần chọn chi nhánh." };
    if (branch.status !== "open") return { ok: false, message: "Chi nhánh đang ngừng hoạt động, chưa lập phiếu kiểm kê." };
    var meds = (db.medicines || []).filter(function (med) { return med.branchId === branch.id; });
    if (!meds.length) return { ok: false, message: "Chi nhánh chưa có thuốc để kiểm kê." };
    var lines = meds.map(function (med) {
      return {
        medicineId: med.id,
        name: med.name,
        code: med.code || med.sku || "",
        unit: med.unit || "",
        batch: med.batch || "",
        systemQty: Number(med.stock) || 0,
        actualQty: null,
        variance: null,
        reason: "",
        stockAfter: null,
      };
    });
    var sheet = {
      id: "kk" + stamp(),
      code: nextCode(db.stocktakes, "KK", input.today),
      branchId: branch.id,
      note: text(input.note).slice(0, 300),
      status: "draft",
      lines: lines,
      minute: "",
      createdAt: new Date().toISOString(),
      createdBy: text(input.actor),
      postedAt: "",
      checks: [],
    };
    db.stocktakes.unshift(sheet);
    return { ok: true, message: "Đã lưu phiếu kiểm kê " + sheet.code + ".", sheet: sheet };
  }

  function sheetEditable(sheet) {
    if (!sheet) return { ok: false, message: "Không tìm thấy phiếu kiểm kê." };
    if (sheet.status === "posted") return { ok: false, message: "Phiếu đã cập nhật tồn, không sửa số lượng." };
    if (sheet.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    if (sheet.status === "minuted") return { ok: false, message: "Đã ghi biên bản. Hủy phiếu nếu cần nhập lại." };
    return { ok: true };
  }

  function saveCounts(sheet, values) {
    var gate = sheetEditable(sheet);
    if (!gate.ok) return gate;
    values = values || {};
    var parsed = [];
    for (var i = 0; i < sheet.lines.length; i++) {
      var line = sheet.lines[i];
      var raw = values[line.medicineId];
      if (raw == null || text(raw) === "") return { ok: false, message: "Cần nhập số lượng thực tế cho mọi thuốc." };
      var qty = parseQty(raw, true);
      if (qty == null) return { ok: false, message: "Số lượng thực tế phải là số nguyên không âm." };
      parsed.push({ line: line, qty: qty });
    }
    parsed.forEach(function (item) {
      item.line.actualQty = item.qty;
      item.line.variance = item.qty - (Number(item.line.systemQty) || 0);
    });
    sheet.status = "counted";
    return { ok: true, message: "Đã lưu số lượng kiểm kê.", reconcile: reconcile(sheet) };
  }

  function reconcile(sheet) {
    if (!sheet) return { ok: false, message: "Không tìm thấy phiếu kiểm kê.", rows: [], shortage: 0, surplus: 0, matched: 0 };
    var shortage = 0;
    var surplus = 0;
    var matched = 0;
    var ready = true;
    var rows = sheet.lines.map(function (line) {
      var systemQty = Number(line.systemQty) || 0;
      var variance = line.actualQty == null || line.actualQty === "" ? null : Number(line.actualQty) - systemQty;
      if (variance == null) ready = false;
      else if (variance < 0) shortage += -variance;
      else if (variance > 0) surplus += variance;
      else matched += 1;
      return {
        medicineId: line.medicineId,
        name: line.name,
        code: line.code,
        unit: line.unit,
        systemQty: systemQty,
        actualQty: line.actualQty,
        variance: variance,
        reason: line.reason || "",
      };
    });
    return { ok: ready, rows: rows, shortage: shortage, surplus: surplus, matched: matched };
  }

  function recordMinute(sheet, input) {
    if (!sheet) return { ok: false, message: "Không tìm thấy phiếu kiểm kê." };
    if (sheet.status === "posted") return { ok: false, message: "Phiếu đã cập nhật tồn." };
    if (sheet.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    if (sheet.status !== "counted") return { ok: false, message: "Nhập và lưu số lượng thực tế trước khi ghi biên bản." };
    input = input || {};
    var minute = text(input.minute);
    if (minute.length < 5) return { ok: false, message: "Biên bản kiểm kê cần ít nhất 5 ký tự." };
    if (minute.length > 500) return { ok: false, message: "Biên bản quá dài." };
    var reasons = input.reasons || {};
    var chosen = [];
    for (var i = 0; i < sheet.lines.length; i++) {
      var line = sheet.lines[i];
      var variance = Number(line.actualQty) - (Number(line.systemQty) || 0);
      if (!variance) {
        chosen.push({ line: line, reason: "" });
        continue;
      }
      var reason = text(reasons[line.medicineId]);
      if (!REASONS.some(function (row) { return row[0] === reason; })) {
        return { ok: false, message: "Chọn nguyên nhân cho " + line.name + "." };
      }
      chosen.push({ line: line, reason: reason });
    }
    chosen.forEach(function (item) { item.line.reason = item.reason; });
    sheet.minute = minute;
    sheet.status = "minuted";
    return { ok: true, message: "Đã lưu biên bản kiểm kê." };
  }

  function backup(med) {
    return {
      stock: med.stock,
      lots: JSON.parse(JSON.stringify(med.lots || [])),
      batch: med.batch || "",
      expiry: med.expiry || "",
    };
  }

  function restore(med, saved) {
    med.stock = saved.stock;
    med.lots = saved.lots;
    med.batch = saved.batch;
    med.expiry = saved.expiry;
  }

  function syncPrimary(med) {
    var lots = (med.lots || []).filter(function (lot) { return Number(lot.qty) > 0 && lot.expiry; });
    lots.sort(function (a, b) { return String(a.expiry).localeCompare(String(b.expiry)); });
    if (!lots.length) {
      var alive = (med.lots || []).some(function (lot) { return Number(lot.qty) > 0; });
      if (!alive) {
        med.batch = "";
        med.expiry = "";
      }
      return;
    }
    med.batch = lots[0].batch;
    med.expiry = lots[0].expiry;
  }

  function setAbsoluteStock(med, actual) {
    var target = Number(actual) || 0;
    if (!Array.isArray(med.lots)) med.lots = [];
    if (!med.lots.length && text(med.batch)) {
      med.lots.push({
        id: "lot-" + med.id,
        batch: text(med.batch).toUpperCase(),
        expiry: med.expiry || "",
        qty: Number(med.stock) || 0,
      });
    }
    if (!med.lots.length) {
      med.stock = target;
      return { ok: true, stock: med.stock, lotSum: 0 };
    }
    var delta = target - sumLots(med);
    if (delta > 0) {
      var newest = med.lots.slice().sort(function (a, b) { return String(b.expiry || "").localeCompare(String(a.expiry || "")); })[0];
      newest.qty = (Number(newest.qty) || 0) + delta;
    } else if (delta < 0) {
      var need = -delta;
      var ordered = med.lots.slice().sort(function (a, b) { return String(a.expiry || "").localeCompare(String(b.expiry || "")); });
      ordered.forEach(function (lot) {
        if (need <= 0) return;
        var have = Number(lot.qty) || 0;
        var take = Math.min(have, need);
        lot.qty = have - take;
        need -= take;
      });
      med.lots = med.lots.filter(function (lot) { return Number(lot.qty) > 0; });
    }
    if (sumLots(med) !== target) {
      med.lots = target ? [{ id: "lot-kk-" + med.id, batch: text(med.batch).toUpperCase() || "KK", expiry: med.expiry || "", qty: target }] : [];
    }
    med.stock = target;
    syncPrimary(med);
    var lotSum = sumLots(med);
    var ok = med.stock === target && (!med.lots.length || lotSum === target);
    return { ok: ok, stock: med.stock, lotSum: lotSum };
  }

  function postStocktake(db, id) {
    ensure(db);
    var sheet = findById(db.stocktakes, id);
    if (!sheet) return { ok: false, message: "Không tìm thấy phiếu kiểm kê." };
    if (sheet.status === "posted") return { ok: false, message: "Phiếu đã cập nhật tồn." };
    if (sheet.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    if (sheet.status !== "minuted") return { ok: false, message: "Cần ghi nhận biên bản trước khi cập nhật tồn." };
    var prepared = [];
    for (var i = 0; i < sheet.lines.length; i++) {
      var line = sheet.lines[i];
      var med = findById(db.medicines, line.medicineId);
      if (!med) return { ok: false, message: "Không còn thuốc " + line.name + " để cập nhật." };
      prepared.push({ line: line, med: med, saved: backup(med) });
    }
    var checks = [];
    for (var n = 0; n < prepared.length; n++) {
      var item = prepared[n];
      var applied = setAbsoluteStock(item.med, item.line.actualQty);
      if (!applied.ok) {
        prepared.forEach(function (row) { restore(row.med, row.saved); });
        return { ok: false, message: "Không cập nhật được tồn " + item.line.name + "." };
      }
      item.line.stockAfter = item.med.stock;
      checks.push({
        medicineId: item.med.id,
        name: item.med.name,
        expected: Number(item.line.actualQty) || 0,
        stock: applied.stock,
        lotSum: applied.lotSum,
        ok: applied.stock === (Number(item.line.actualQty) || 0),
      });
    }
    sheet.checks = checks;
    sheet.status = "posted";
    sheet.postedAt = new Date().toISOString();
    noteOf(db, "Cập nhật tồn sau kiểm kê", sheet.code + " đã chốt tồn kho.", "low");
    var bad = checks.filter(function (row) { return !row.ok; });
    if (bad.length) return { ok: false, message: "Còn " + bad.length + " dòng lệch sau cập nhật.", checks: checks, sheet: sheet };
    return { ok: true, message: "Đã cập nhật tồn kho theo phiếu " + sheet.code + ".", checks: checks, sheet: sheet };
  }

  function cancelStocktake(db, id) {
    ensure(db);
    var sheet = findById(db.stocktakes, id);
    if (!sheet) return { ok: false, message: "Không tìm thấy phiếu kiểm kê." };
    if (sheet.status === "posted") return { ok: false, message: "Phiếu đã cập nhật tồn, không hủy." };
    if (sheet.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    sheet.status = "cancelled";
    return { ok: true, message: "Đã hủy phiếu kiểm kê " + sheet.code + ".", sheet: sheet };
  }

  function branchGate(db, id, roleName) {
    var branch = findById(db.branches, text(id));
    if (!branch) return { ok: false, message: "Cần chọn chi nhánh " + roleName + "." };
    if (branch.status !== "open") return { ok: false, message: branch.name + " đang ngừng hoạt động." };
    return { ok: true, branch: branch };
  }

  function findDest(medicines, source, branchId) {
    var name = lower(source.name);
    var strength = lower(source.strength || "");
    var found = null;
    (medicines || []).forEach(function (med) {
      if (found) return;
      if (med.branchId === branchId && lower(med.name) === name && lower(med.strength || "") === strength) found = med;
    });
    return found;
  }

  function lotState(med) {
    var lots = [];
    if (Array.isArray(med.lots) && med.lots.length) {
      med.lots.forEach(function (lot) {
        lots.push({ batch: text(lot.batch).toUpperCase(), expiry: lot.expiry || "", qty: Number(lot.qty) || 0 });
      });
    } else if (text(med.batch)) {
      lots.push({ batch: text(med.batch).toUpperCase(), expiry: med.expiry || "", qty: Number(med.stock) || 0 });
    }
    return { stock: Number(med.stock) || 0, lots: lots };
  }

  function planTake(state, qty, batch) {
    if (state.stock < qty) return { ok: false, message: "Tồn kho không đủ để chuyển." };
    var portions = [];
    if (!state.lots.length) {
      state.stock -= qty;
      portions.push({ batch: text(batch).toUpperCase() || "CK", expiry: "", qty: qty });
      return { ok: true, portions: portions };
    }
    var pool = state.lots.filter(function (lot) { return lot.qty > 0; });
    if (text(batch)) {
      var key = text(batch).toUpperCase();
      pool = pool.filter(function (lot) { return lot.batch === key; });
      var have = pool.reduce(function (total, lot) { return total + lot.qty; }, 0);
      if (have < qty) return { ok: false, message: "Lô " + key + " không đủ số lượng." };
    }
    pool = pool.slice().sort(function (a, b) { return String(a.expiry).localeCompare(String(b.expiry)); });
    var need = qty;
    for (var i = 0; i < pool.length && need > 0; i++) {
      var take = Math.min(pool[i].qty, need);
      pool[i].qty -= take;
      need -= take;
      portions.push({ batch: pool[i].batch, expiry: pool[i].expiry, qty: take });
    }
    if (need > 0) return { ok: false, message: "Không trừ đủ số lượng từ các lô." };
    state.stock -= qty;
    return { ok: true, portions: portions };
  }

  function planGive(state, portions) {
    for (var i = 0; i < portions.length; i++) {
      var portion = portions[i];
      var found = null;
      for (var j = 0; j < state.lots.length; j++) {
        if (state.lots[j].batch === portion.batch) found = state.lots[j];
      }
      if (found && found.expiry && portion.expiry && found.expiry !== portion.expiry) {
        return { ok: false, message: "Số lô " + portion.batch + " ở chi nhánh nhận đang có hạn khác." };
      }
      if (found) {
        if (!found.expiry && portion.expiry) found.expiry = portion.expiry;
        found.qty += portion.qty;
      } else state.lots.push({ batch: portion.batch, expiry: portion.expiry || "", qty: portion.qty });
      state.stock += portion.qty;
    }
    return { ok: true };
  }

  function planTransfer(db, transfer) {
    ensure(db);
    transfer = transfer || {};
    var from = branchGate(db, transfer.fromBranchId, "gửi");
    if (!from.ok) return from;
    var to = branchGate(db, transfer.toBranchId, "nhận");
    if (!to.ok) return to;
    if (from.branch.id === to.branch.id) return { ok: false, message: "Chi nhánh gửi và chi nhánh nhận phải khác nhau." };
    var lines = transfer.lines || [];
    if (!lines.length) return { ok: false, message: "Chọn thuốc và số lượng cần chuyển." };
    var sourceState = {};
    var destState = {};
    var destMeta = {};
    var moves = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var qty = parseQty(line.qty, false);
      if (qty == null) return { ok: false, message: "Số lượng chuyển phải là số nguyên từ 1 trở lên." };
      var med = findById(db.medicines, line.medicineId);
      if (!med || med.branchId !== from.branch.id) return { ok: false, message: "Thuốc không thuộc chi nhánh gửi." };
      if (!sourceState[med.id]) sourceState[med.id] = lotState(med);
      var sourceBefore = sourceState[med.id].stock;
      var taken = planTake(sourceState[med.id], qty, line.batch || "");
      if (!taken.ok) return { ok: false, message: med.name + ": " + taken.message };
      if (!destMeta[med.id]) {
        var dest = findDest(db.medicines, med, to.branch.id);
        destMeta[med.id] = dest ? { create: false, destId: dest.id, name: dest.name } : { create: true, destId: "", name: med.name };
        destState[med.id] = dest ? lotState(dest) : { stock: 0, lots: [] };
      }
      var destBefore = destState[med.id].stock;
      var given = planGive(destState[med.id], taken.portions);
      if (!given.ok) return given;
      taken.portions.forEach(function (portion) {
        moves.push({
          sourceId: med.id,
          sourceName: med.name,
          code: med.code || med.sku || "",
          unit: med.unit || "",
          destId: destMeta[med.id].destId,
          destName: destMeta[med.id].name,
          createDest: destMeta[med.id].create,
          batch: portion.batch,
          expiry: portion.expiry,
          qty: portion.qty,
          sourceBefore: sourceBefore,
          sourceAfter: sourceState[med.id].stock,
          destBefore: destBefore,
          destAfter: destState[med.id].stock,
        });
      });
    }
    return { ok: true, moves: moves, from: from.branch, to: to.branch };
  }

  function summarizeMoves(moves) {
    var map = {};
    var order = [];
    (moves || []).forEach(function (move) {
      if (!map[move.sourceId]) {
        map[move.sourceId] = {
          sourceId: move.sourceId,
          name: move.sourceName,
          code: move.code,
          unit: move.unit,
          qty: 0,
          sourceBefore: move.sourceBefore,
          sourceAfter: move.sourceAfter,
          destBefore: move.destBefore,
          destAfter: move.destAfter,
          createDest: move.createDest,
          destName: move.destName,
          batches: [],
        };
        order.push(move.sourceId);
      }
      var row = map[move.sourceId];
      row.qty += move.qty;
      row.sourceAfter = move.sourceAfter;
      row.destAfter = move.destAfter;
      row.batches.push((move.batch || "CK") + " × " + move.qty);
    });
    return order.map(function (id) { return map[id]; });
  }

  function applyTake(med, portions) {
    if (!Array.isArray(med.lots)) med.lots = [];
    if (!med.lots.length && text(med.batch)) {
      med.lots.push({
        id: "lot-" + med.id,
        batch: text(med.batch).toUpperCase(),
        expiry: med.expiry || "",
        qty: Number(med.stock) || 0,
      });
    }
    var qty = portions.reduce(function (total, portion) { return total + portion.qty; }, 0);
    if ((Number(med.stock) || 0) < qty) return { ok: false, message: "Tồn không đủ khi trừ kho." };
    if (!med.lots.length) {
      med.stock -= qty;
      return { ok: true };
    }
    for (var i = 0; i < portions.length; i++) {
      var portion = portions[i];
      var lot = null;
      med.lots.forEach(function (item) {
        if (lot) return;
        if (text(item.batch).toUpperCase() === portion.batch && (item.expiry || "") === (portion.expiry || "")) lot = item;
      });
      if (!lot) {
        med.lots.forEach(function (item) {
          if (!lot && text(item.batch).toUpperCase() === portion.batch) lot = item;
        });
      }
      if (!lot || (Number(lot.qty) || 0) < portion.qty) return { ok: false, message: "Lô " + portion.batch + " đã đổi, không trừ được." };
      lot.qty = Number(lot.qty) - portion.qty;
    }
    med.lots = med.lots.filter(function (lot) { return Number(lot.qty) > 0; });
    med.stock = (Number(med.stock) || 0) - qty;
    syncPrimary(med);
    return { ok: true };
  }

  function applyGive(med, portions) {
    if (!Array.isArray(med.lots)) med.lots = [];
    for (var i = 0; i < portions.length; i++) {
      var portion = portions[i];
      var found = null;
      med.lots.forEach(function (lot) {
        if (text(lot.batch).toUpperCase() === portion.batch) found = lot;
      });
      if (found && found.expiry && portion.expiry && found.expiry !== portion.expiry) {
        return { ok: false, message: "Số lô " + portion.batch + " ở chi nhánh nhận đang có hạn khác." };
      }
      if (found) {
        found.qty = (Number(found.qty) || 0) + portion.qty;
        if (!found.expiry && portion.expiry) found.expiry = portion.expiry;
        found.batch = portion.batch;
      } else {
        med.lots.push({
          id: "lot" + stamp(),
          batch: portion.batch,
          expiry: portion.expiry || "",
          qty: portion.qty,
        });
      }
      med.stock = (Number(med.stock) || 0) + portion.qty;
    }
    syncPrimary(med);
    return { ok: true };
  }

  function cloneMedicine(db, source, branchId) {
    var code = root.PharmaMedicines && root.PharmaMedicines.nextCode
      ? root.PharmaMedicines.nextCode(db.medicines)
      : nextCode(db.medicines, "T", "");
    var copy = {
      id: "m" + stamp(),
      name: source.name,
      code: code,
      sku: code,
      categoryId: source.categoryId || "",
      category: source.category || "",
      manufacturerId: source.manufacturerId || "",
      supplier: source.supplier || "",
      unitId: source.unitId || "",
      unit: source.unit || "",
      dosageFormId: source.dosageFormId || "",
      dosageForm: source.dosageForm || "",
      activeIngredient: source.activeIngredient || "",
      strength: source.strength || "",
      cost: Number(source.cost) || 0,
      price: Number(source.price) || 0,
      minStock: Number(source.minStock) || 0,
      stock: 0,
      lots: [],
      batch: "",
      expiry: "",
      branchId: branchId,
      status: source.status === "discontinued" ? "discontinued" : "active",
    };
    db.medicines.push(copy);
    return copy;
  }

  function snapshotCheck(med, expected, role) {
    var check = stockCheck(med);
    return {
      name: med.name,
      role: role,
      expected: expected,
      stock: check.stock,
      lotSum: check.hasLots ? check.lotSum : check.stock,
      ok: check.stock === expected && check.ok,
    };
  }

  function confirmTransfer(db, id) {
    ensure(db);
    var transfer = findById(db.transfers, id);
    if (!transfer) return { ok: false, message: "Không tìm thấy phiếu chuyển." };
    if (transfer.status === "confirmed") return { ok: false, message: "Phiếu đã xác nhận." };
    if (transfer.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    if (transfer.status !== "draft") return { ok: false, message: "Chỉ xác nhận phiếu đang nháp." };
    var plan = planTransfer(db, transfer);
    if (!plan.ok) return plan;
    var groups = {};
    var order = [];
    plan.moves.forEach(function (move) {
      if (!groups[move.sourceId]) {
        groups[move.sourceId] = [];
        order.push(move.sourceId);
      }
      groups[move.sourceId].push(move);
    });
    var backups = [];
    var created = [];
    function remember(med) {
      if (backups.some(function (row) { return row.med === med; })) return;
      backups.push({ med: med, saved: backup(med) });
    }
    function rollback() {
      backups.forEach(function (row) { restore(row.med, row.saved); });
      if (created.length) {
        db.medicines = db.medicines.filter(function (med) { return created.indexOf(med) < 0; });
      }
    }
    var destOf = {};
    for (var i = 0; i < order.length; i++) {
      var sourceId = order[i];
      var source = findById(db.medicines, sourceId);
      remember(source);
      var taken = applyTake(source, groups[sourceId]);
      if (!taken.ok) {
        rollback();
        return taken;
      }
      var sample = groups[sourceId][0];
      var dest = sample.destId ? findById(db.medicines, sample.destId) : null;
      if (!sample.createDest && !dest) {
        rollback();
        return { ok: false, message: "Không tìm thấy thuốc ở chi nhánh nhận." };
      }
      if (!dest) {
        dest = cloneMedicine(db, source, transfer.toBranchId);
        created.push(dest);
      } else remember(dest);
      var given = applyGive(dest, groups[sourceId]);
      if (!given.ok) {
        rollback();
        return given;
      }
      destOf[sourceId] = dest;
    }
    var checks = [];
    order.forEach(function (sourceId) {
      var source = findById(db.medicines, sourceId);
      var last = groups[sourceId][groups[sourceId].length - 1];
      checks.push(snapshotCheck(source, last.sourceAfter, "source"));
      checks.push(snapshotCheck(destOf[sourceId], last.destAfter, "dest"));
    });
    var bad = checks.filter(function (row) { return !row.ok; });
    if (bad.length) {
      rollback();
      return { ok: false, message: "Số liệu tồn sau chuyển chưa khớp.", checks: checks };
    }
    transfer.status = "confirmed";
    transfer.confirmedAt = new Date().toISOString();
    transfer.applied = plan.moves;
    transfer.checks = checks;
    noteOf(db, "Chuyển kho", transfer.code + " đã chuyển thuốc sang chi nhánh nhận.", "low");
    return { ok: true, message: "Đã xác nhận chuyển kho và cập nhật tồn.", transfer: transfer, checks: checks };
  }

  function createTransfer(db, input) {
    ensure(db);
    input = input || {};
    var draft = {
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      lines: (input.lines || []).map(function (line) {
        return { medicineId: line.medicineId, qty: line.qty, batch: text(line.batch).toUpperCase() };
      }),
    };
    var plan = planTransfer(db, draft);
    if (!plan.ok) return plan;
    var lines = draft.lines.map(function (line) {
      var med = findById(db.medicines, line.medicineId);
      return {
        medicineId: med.id,
        name: med.name,
        code: med.code || med.sku || "",
        unit: med.unit || "",
        qty: parseQty(line.qty, false),
        batch: line.batch,
      };
    });
    var row = {
      id: "ck" + stamp(),
      code: nextCode(db.transfers, "CK", input.today),
      fromBranchId: draft.fromBranchId,
      toBranchId: draft.toBranchId,
      status: "draft",
      lines: lines,
      note: text(input.note).slice(0, 300),
      createdAt: new Date().toISOString(),
      createdBy: text(input.actor),
      applied: [],
      checks: [],
    };
    db.transfers.unshift(row);
    return { ok: true, message: "Đã lưu phiếu chuyển " + row.code + ".", transfer: row, plan: plan };
  }

  function cancelTransfer(db, id) {
    ensure(db);
    var transfer = findById(db.transfers, id);
    if (!transfer) return { ok: false, message: "Không tìm thấy phiếu chuyển." };
    if (transfer.status === "confirmed") return { ok: false, message: "Phiếu đã xác nhận, không hủy." };
    if (transfer.status === "cancelled") return { ok: false, message: "Phiếu đã hủy." };
    transfer.status = "cancelled";
    return { ok: true, message: "Đã hủy phiếu chuyển " + transfer.code + ".", transfer: transfer };
  }

  root.PharmaInventory = {
    PAGE_SIZE: PAGE_SIZE,
    REASONS: REASONS,
    ensure: ensure,
    warnDays: warnDays,
    setWarnDays: setWarnDays,
    queryStock: queryStock,
    listLots: listLots,
    expiryBoard: expiryBoard,
    stockCheck: stockCheck,
    collect: collect,
    openAlerts: openAlerts,
    markAlertRead: markAlertRead,
    dismissAlert: dismissAlert,
    collectView: collectView,
    reasonName: reasonName,
    createStocktake: createStocktake,
    saveCounts: saveCounts,
    reconcile: reconcile,
    recordMinute: recordMinute,
    postStocktake: postStocktake,
    cancelStocktake: cancelStocktake,
    createTransfer: createTransfer,
    planTransfer: planTransfer,
    summarizeMoves: summarizeMoves,
    confirmTransfer: confirmTransfer,
    cancelTransfer: cancelTransfer,
  };
})(typeof window !== "undefined" ? window : globalThis);
