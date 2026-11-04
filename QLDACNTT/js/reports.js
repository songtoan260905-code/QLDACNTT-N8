/* Báo cáo doanh thu, bán hàng, nhập hàng và tồn (task 282–291). */
(function (root) {
  function text(value) {
    return String(value == null ? "" : value).trim();
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

  function monthOk(value) {
    var match = /^(\d{4})-(\d{2})$/.exec(text(value));
    if (!match) return false;
    var month = Number(match[2]);
    return month >= 1 && month <= 12;
  }

  function daysInMonth(month) {
    var match = /^(\d{4})-(\d{2})$/.exec(text(month));
    return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  }

  function dayOf(iso) {
    return text(iso).slice(0, 10);
  }

  function daysUntil(iso, today) {
    if (!dateOk(iso) || !dateOk(today)) return null;
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
    var b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    var left = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
    var right = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
    return Math.round((right - left) / 86400000);
  }

  function intIn(value, min, max) {
    var raw = text(value);
    if (!/^\d+$/.test(raw)) return null;
    var number = Number(raw);
    if (number < min || number > max) return null;
    return number;
  }

  function cmpText(a, b) {
    var left = text(a).toLowerCase();
    var right = text(b).toLowerCase();
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  function halfUp(value) {
    return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
  }

  function shareOf(part, total) {
    if (!total) return 0;
    return halfUp((part / total) * 1000) / 10;
  }

  function revenueOf(sale) {
    if (!sale || (sale.status || "paid") === "cancelled") return 0;
    if (typeof sale.total === "number" && !isNaN(sale.total)) return sale.total;
    return (sale.lines || []).reduce(function (sum, line) {
      if (typeof line.amount === "number") return sum + line.amount;
      return sum + (Number(line.price) || 0) * (Number(line.qty) || 0);
    }, 0);
  }

  function profitOf(sale) {
    if (!sale || (sale.status || "paid") === "cancelled") return 0;
    var gross = (sale.lines || []).reduce(function (sum, line) {
      return sum + ((Number(line.price) || 0) - (Number(line.cost) || 0)) * (Number(line.qty) || 0);
    }, 0);
    return gross - (Number(sale.discountAmount) || 0);
  }

  function lineAmount(line) {
    if (typeof line.amount === "number" && !isNaN(line.amount)) return line.amount;
    return (Number(line.price) || 0) * (Number(line.qty) || 0);
  }

  function scopeOf(viewer, requested) {
    if (!viewer || viewer.status === "inactive") return { ok: false, message: "Cần đăng nhập để xem báo cáo." };
    if (viewer.role !== "admin" && viewer.role !== "manager") {
      return { ok: false, message: "Bạn không có quyền xem báo cáo." };
    }
    if (viewer.role !== "admin") return { ok: true, branchId: text(viewer.branchId) };
    var branchId = text(requested) || "all";
    return { ok: true, branchId: branchId };
  }

  function salesIn(db, opts) {
    opts = opts || {};
    var scope = scopeOf(opts.viewer, opts.branchId);
    if (!scope.ok) return scope;
    var date = text(opts.date);
    var month = text(opts.month);
    var rows = (db.sales || []).filter(function (sale) {
      if ((sale.status || "paid") === "cancelled") return false;
      if (scope.branchId !== "all" && sale.branchId !== scope.branchId) return false;
      var day = dayOf(sale.at);
      if (date && day !== date) return false;
      if (month && day.slice(0, 7) !== month) return false;
      return true;
    });
    return { ok: true, branchId: scope.branchId, rows: rows };
  }

  function invoiceOf(sale) {
    return {
      id: sale.id,
      code: sale.code || "",
      at: sale.at || "",
      customer: sale.customer || "",
      cashier: text(sale.cashier) || "Thu ngân",
      branchId: sale.branchId || "",
      revenue: revenueOf(sale),
      profit: profitOf(sale),
    };
  }

  function totals(rows) {
    return {
      orders: rows.length,
      revenue: rows.reduce(function (sum, sale) { return sum + revenueOf(sale); }, 0),
      profit: rows.reduce(function (sum, sale) { return sum + profitOf(sale); }, 0),
    };
  }

  function paidLines(sale) {
    if ((sale.status || "paid") === "cancelled") return [];
    var lines = sale.lines || [];
    if (!lines.length) return [];
    var subtotal = lines.reduce(function (sum, line) { return sum + lineAmount(line); }, 0);
    var total = revenueOf(sale);
    var left = total;
    return lines.map(function (line, index) {
      var raw = lineAmount(line);
      var share = index === lines.length - 1 ? left : (subtotal ? halfUp((raw * total) / subtotal) : 0);
      left -= share;
      return {
        medicineId: line.medicineId || "",
        name: text(line.name) || "Thuốc",
        qty: Number(line.qty) || 0,
        revenue: share,
      };
    });
  }

  function medicineGroups(rows) {
    var map = {};
    var order = [];
    rows.forEach(function (sale) {
      paidLines(sale).forEach(function (line) {
        var key = line.medicineId || ("name:" + line.name.toLowerCase());
        if (!map[key]) {
          map[key] = { medicineId: line.medicineId, name: line.name, qty: 0, revenue: 0 };
          order.push(map[key]);
        }
        map[key].qty += line.qty;
        map[key].revenue += line.revenue;
      });
    });
    return order;
  }

  function daily(db, opts) {
    opts = opts || {};
    if (!dateOk(opts.date)) return { ok: false, message: "Ngày báo cáo không hợp lệ." };
    var found = salesIn(db, { viewer: opts.viewer, branchId: opts.branchId, date: opts.date });
    if (!found.ok) return found;
    var sum = totals(found.rows);
    var invoices = found.rows.map(invoiceOf).sort(function (a, b) { return text(b.at).localeCompare(text(a.at)); });
    return {
      ok: true,
      date: text(opts.date),
      branchId: found.branchId,
      orders: sum.orders,
      revenue: sum.revenue,
      profit: sum.profit,
      invoices: invoices,
    };
  }

  function monthly(db, opts) {
    opts = opts || {};
    if (!monthOk(opts.month)) return { ok: false, message: "Tháng báo cáo không hợp lệ." };
    var found = salesIn(db, { viewer: opts.viewer, branchId: opts.branchId, month: opts.month });
    if (!found.ok) return found;
    var month = text(opts.month);
    var bucket = {};
    found.rows.forEach(function (sale) {
      var day = dayOf(sale.at);
      if (!bucket[day]) bucket[day] = [];
      bucket[day].push(sale);
    });
    var series = [];
    var count = daysInMonth(month);
    for (var n = 1; n <= count; n += 1) {
      var day = month + "-" + String(n).padStart(2, "0");
      var list = bucket[day] || [];
      var sum = totals(list);
      series.push({
        day: day,
        label: String(n) + "/" + String(Number(month.slice(5, 7))),
        orders: sum.orders,
        revenue: sum.revenue,
        profit: sum.profit,
      });
    }
    var sumAll = totals(found.rows);
    return {
      ok: true,
      month: month,
      branchId: found.branchId,
      orders: sumAll.orders,
      revenue: sumAll.revenue,
      profit: sumAll.profit,
      series: series,
    };
  }

  function byBranch(db, opts) {
    opts = opts || {};
    if (!monthOk(opts.month)) return { ok: false, message: "Tháng báo cáo không hợp lệ." };
    var scope = scopeOf(opts.viewer, "all");
    if (!scope.ok) return scope;
    var found = salesIn(db, { viewer: opts.viewer, branchId: "all", month: opts.month });
    if (!found.ok) return found;
    var focus = scope.branchId !== "all" ? scope.branchId : (text(opts.branchId) || "all");
    var branches = (db.branches || []).filter(function (branch) {
      return scope.branchId === "all" || branch.id === scope.branchId;
    });
    var rows = branches.map(function (branch) {
      var list = found.rows.filter(function (sale) { return sale.branchId === branch.id; });
      var sum = totals(list);
      return {
        branchId: branch.id,
        name: branch.short || branch.name || branch.id,
        orders: sum.orders,
        revenue: sum.revenue,
        profit: sum.profit,
      };
    });
    var revenue = rows.reduce(function (sum, row) { return sum + row.revenue; }, 0);
    rows.forEach(function (row) { row.share = shareOf(row.revenue, revenue); });
    rows.sort(function (a, b) {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return cmpText(a.name, b.name);
    });
    var chosen = rows.filter(function (row) { return row.branchId === focus; })[0] || { orders: 0, revenue: 0, profit: 0 };
    var every = focus === "all";
    return {
      ok: true,
      month: text(opts.month),
      focus: focus,
      orders: every ? rows.reduce(function (sum, row) { return sum + row.orders; }, 0) : chosen.orders,
      revenue: every ? revenue : chosen.revenue,
      profit: every ? rows.reduce(function (sum, row) { return sum + row.profit; }, 0) : chosen.profit,
      rows: rows,
    };
  }

  function byStaff(db, opts) {
    opts = opts || {};
    if (!monthOk(opts.month)) return { ok: false, message: "Tháng báo cáo không hợp lệ." };
    var found = salesIn(db, { viewer: opts.viewer, branchId: opts.branchId, month: opts.month });
    if (!found.ok) return found;
    var staffId = text(opts.staffId) || "all";
    if (staffId !== "all") {
      var user = (db.users || []).find(function (item) { return item.id === staffId; }) || null;
      if (!user) return { ok: false, message: "Không tìm thấy nhân viên." };
      if (found.branchId !== "all" && user.branchId !== found.branchId) {
        return { ok: false, message: "Nhân viên không thuộc phạm vi báo cáo." };
      }
      var name = text(user.name);
      var own = found.rows.filter(function (sale) { return text(sale.cashier) === name; });
      var sum = totals(own);
      return {
        ok: true,
        mode: "one",
        month: text(opts.month),
        staffId: user.id,
        staffName: name,
        orders: sum.orders,
        revenue: sum.revenue,
        profit: sum.profit,
        invoices: own.map(invoiceOf).sort(function (a, b) { return text(b.at).localeCompare(text(a.at)); }),
      };
    }
    var map = {};
    var ranked = [];
    found.rows.forEach(function (sale) {
      var key = (sale.branchId || "") + "\n" + (text(sale.cashier) || "Thu ngân");
      if (!map[key]) {
        map[key] = {
          cashier: text(sale.cashier) || "Thu ngân",
          branchId: sale.branchId || "",
          orders: 0,
          revenue: 0,
          profit: 0,
        };
        ranked.push(map[key]);
      }
      map[key].orders += 1;
      map[key].revenue += revenueOf(sale);
      map[key].profit += profitOf(sale);
    });
    ranked.sort(function (a, b) {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return cmpText(a.cashier, b.cashier);
    });
    var sumAll = totals(found.rows);
    return {
      ok: true,
      mode: "all",
      month: text(opts.month),
      orders: sumAll.orders,
      revenue: sumAll.revenue,
      profit: sumAll.profit,
      rows: ranked,
    };
  }

  function qtySold(db, opts) {
    opts = opts || {};
    if (!monthOk(opts.month)) return { ok: false, message: "Tháng báo cáo không hợp lệ." };
    var found = salesIn(db, { viewer: opts.viewer, branchId: opts.branchId, month: opts.month });
    if (!found.ok) return found;
    var rows = medicineGroups(found.rows);
    var qty = rows.reduce(function (sum, row) { return sum + row.qty; }, 0);
    rows.forEach(function (row) { row.share = shareOf(row.qty, qty); });
    rows.sort(function (a, b) { return cmpText(a.name, b.name); });
    return {
      ok: true,
      month: text(opts.month),
      qty: qty,
      revenue: rows.reduce(function (sum, row) { return sum + row.revenue; }, 0),
      rows: rows,
    };
  }

  function bestsellers(db, opts) {
    opts = opts || {};
    if (!monthOk(opts.month)) return { ok: false, message: "Tháng báo cáo không hợp lệ." };
    var criterion = text(opts.criterion) || "qty";
    if (criterion !== "qty" && criterion !== "revenue") {
      return { ok: false, message: "Tiêu chí bán chạy chưa hợp lệ." };
    }
    var found = salesIn(db, { viewer: opts.viewer, branchId: opts.branchId, month: opts.month });
    if (!found.ok) return found;
    var rows = medicineGroups(found.rows);
    rows.sort(function (a, b) {
      if (b[criterion] !== a[criterion]) return b[criterion] - a[criterion];
      return cmpText(a.name, b.name);
    });
    var limit = text(opts.limit) || "all";
    if (limit !== "all") {
      var size = intIn(limit, 1, 100);
      if (size == null) return { ok: false, message: "Số dòng bán chạy chưa hợp lệ." };
      rows = rows.slice(0, size);
    }
    rows.forEach(function (row, index) { row.rank = index + 1; });
    return {
      ok: true,
      month: text(opts.month),
      criterion: criterion,
      rows: rows,
    };
  }

  function purchases(db, opts) {
    opts = opts || {};
    if (!monthOk(opts.month)) return { ok: false, message: "Tháng báo cáo không hợp lệ." };
    var scope = scopeOf(opts.viewer, opts.branchId);
    if (!scope.ok) return scope;
    var month = text(opts.month);
    var rows = [];
    var skipped = 0;
    (db.receipts || []).forEach(function (receipt) {
      var day = dayOf(receipt.confirmedAt || receipt.at);
      if (day.slice(0, 7) !== month) return;
      if (scope.branchId !== "all" && receipt.branchId !== scope.branchId) return;
      if (receipt.status !== "confirmed") {
        skipped += 1;
        return;
      }
      var supplier = (db.suppliers || []).find(function (item) { return item.id === receipt.supplierId; });
      rows.push({
        id: receipt.id,
        code: receipt.code || "",
        supplier: supplier ? supplier.name : "",
        branchId: receipt.branchId || "",
        at: receipt.confirmedAt || receipt.at || "",
        total: Number(receipt.total) || 0,
        lines: (receipt.lines || []).length,
      });
    });
    rows.sort(function (a, b) { return text(b.at).localeCompare(text(a.at)); });
    return {
      ok: true,
      month: month,
      count: rows.length,
      skipped: skipped,
      total: rows.reduce(function (sum, row) { return sum + row.total; }, 0),
      rows: rows,
    };
  }

  function stockReport(db, opts) {
    opts = opts || {};
    var scope = scopeOf(opts.viewer, opts.branchId);
    if (!scope.ok) return scope;
    var meds = (db.medicines || []).filter(function (med) {
      return scope.branchId === "all" || med.branchId === scope.branchId;
    });
    var branches = (db.branches || []).filter(function (branch) {
      return scope.branchId === "all" || branch.id === scope.branchId;
    });
    var groups = branches.map(function (branch) {
      var list = meds.filter(function (med) { return med.branchId === branch.id; });
      return {
        branchId: branch.id,
        name: branch.short || branch.name || branch.id,
        sku: list.length,
        qty: list.reduce(function (sum, med) { return sum + (Number(med.stock) || 0); }, 0),
        value: list.reduce(function (sum, med) { return sum + (Number(med.stock) || 0) * (Number(med.cost) || 0); }, 0),
      };
    });
    groups.sort(function (a, b) { return cmpText(a.name, b.name); });
    var items = meds.map(function (med) {
      return {
        id: med.id,
        name: med.name || "",
        branchId: med.branchId || "",
        stock: Number(med.stock) || 0,
        minStock: Number(med.minStock) || 0,
        value: (Number(med.stock) || 0) * (Number(med.cost) || 0),
        unit: med.unit || "",
      };
    }).sort(function (a, b) { return cmpText(a.name, b.name); });
    return {
      ok: true,
      sku: items.length,
      qty: groups.reduce(function (sum, row) { return sum + row.qty; }, 0),
      value: groups.reduce(function (sum, row) { return sum + row.value; }, 0),
      groups: groups,
      items: items,
    };
  }

  function lotsOf(med) {
    if (med.lots && med.lots.length) return med.lots;
    if (!med.batch && !med.expiry) return [];
    return [{ batch: med.batch || "", expiry: med.expiry || "", qty: Number(med.stock) || 0 }];
  }

  function expiryReport(db, opts) {
    opts = opts || {};
    var scope = scopeOf(opts.viewer, opts.branchId);
    if (!scope.ok) return scope;
    if (!dateOk(opts.today)) return { ok: false, message: "Thiếu ngày đối chiếu hạn dùng." };
    var windowDays = intIn(opts.days, 1, 365);
    if (windowDays == null) return { ok: false, message: "Số ngày cảnh báo hạn dùng từ 1 đến 365." };
    var rows = [];
    (db.medicines || []).forEach(function (med) {
      if (scope.branchId !== "all" && med.branchId !== scope.branchId) return;
      lotsOf(med).forEach(function (lot) {
        var expiry = text(lot.expiry);
        var left = daysUntil(expiry, opts.today);
        if (left == null || left > windowDays) return;
        rows.push({
          id: med.id,
          name: med.name || "",
          branchId: med.branchId || "",
          batch: text(lot.batch),
          expiry: expiry,
          qty: Number(lot.qty) || 0,
          left: left,
          expired: left < 0,
        });
      });
    });
    rows.sort(function (a, b) {
      if (a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
      return cmpText(a.name, b.name);
    });
    return {
      ok: true,
      days: windowDays,
      today: text(opts.today),
      expired: rows.filter(function (row) { return row.expired; }).length,
      soon: rows.filter(function (row) { return !row.expired; }).length,
      rows: rows,
    };
  }

  function lowStock(db, opts) {
    opts = opts || {};
    var scope = scopeOf(opts.viewer, opts.branchId);
    if (!scope.ok) return scope;
    var rows = [];
    (db.medicines || []).forEach(function (med) {
      if (scope.branchId !== "all" && med.branchId !== scope.branchId) return;
      var stock = Number(med.stock) || 0;
      var minStock = Number(med.minStock) || 0;
      if (!(minStock > 0 && stock < minStock)) return;
      rows.push({
        id: med.id,
        name: med.name || "",
        branchId: med.branchId || "",
        stock: stock,
        minStock: minStock,
        shortage: minStock - stock,
        unit: med.unit || "",
      });
    });
    rows.sort(function (a, b) {
      if (b.shortage !== a.shortage) return b.shortage - a.shortage;
      return cmpText(a.name, b.name);
    });
    return {
      ok: true,
      count: rows.length,
      shortage: rows.reduce(function (sum, row) { return sum + row.shortage; }, 0),
      rows: rows,
    };
  }

  root.PharmaReports = {
    dateOk: dateOk,
    monthOk: monthOk,
    scopeOf: scopeOf,
    revenueOf: revenueOf,
    daily: daily,
    monthly: monthly,
    byBranch: byBranch,
    byStaff: byStaff,
    qtySold: qtySold,
    bestsellers: bestsellers,
    purchases: purchases,
    stockReport: stockReport,
    expiryReport: expiryReport,
    lowStock: lowStock,
  };
})(typeof window !== "undefined" ? window : globalThis);
