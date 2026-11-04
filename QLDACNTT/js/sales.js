/* Bán hàng và hóa đơn: giỏ, tồn, hạn dùng, giảm giá, thanh toán (task 237–260). */
(function (root) {
  var PAGE_SIZE = 6;
  var PAY = { cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ" };

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
    return /^\d+$/.test(raw) && Number(raw) < 1e12;
  }

  function qtyOk(value) {
    var raw = digits(value);
    if (!/^\d+$/.test(raw)) return false;
    var n = Number(raw);
    return n >= 1 && n < 1000000;
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

  function phoneOk(value) {
    var raw = text(value).replace(/[\s.+()-]/g, "");
    return /^0\d{8,10}$/.test(raw) || /^84\d{8,10}$/.test(raw);
  }

  function defaultDiscounts() {
    return [
      {
        id: "dc1", code: "GIAM10", type: "percent", value: 10, minSubtotal: 100000, maxDiscount: 50000,
        start: "", end: "", status: "active", note: "Giảm 10% cho đơn từ 100.000đ, tối đa 50.000đ",
      },
      {
        id: "dc2", code: "GIAM50", type: "amount", value: 50000, minSubtotal: 300000, maxDiscount: 50000,
        start: "", end: "", status: "active", note: "Giảm 50.000đ cho đơn từ 300.000đ",
      },
    ];
  }

  function ensure(db) {
    if (!db.settings || typeof db.settings !== "object") db.settings = {};
    if (!db.settings.bankName) db.settings.bankName = "Vietcombank";
    if (!db.settings.bankAccount) db.settings.bankAccount = "012345678901";
    if (!db.settings.bankOwner) db.settings.bankOwner = "CONG TY PHARMACARE";
    if (!db.settings.bankBranch) db.settings.bankBranch = "CN TP.HCM";
    if (!Array.isArray(db.discounts)) db.discounts = defaultDiscounts();
    (db.sales || []).forEach(function (sale) {
      if (!sale.status) sale.status = "paid";
      if (!sale.payStatus) sale.payStatus = "received";
    });
  }

  function searchMedicines(list, opts) {
    opts = opts || {};
    var q = text(opts.q).toLowerCase();
    return (list || []).filter(function (med) {
      if (opts.branchId && opts.branchId !== "all" && med.branchId !== opts.branchId) return false;
      if (!q) return true;
      var blob = [med.name, med.code, med.sku, med.activeIngredient].join(" ").toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }

  function gate(med, qty, today) {
    if (!med) return { ok: false, message: "Không tìm thấy thuốc." };
    if ((med.status || "active") !== "active") return { ok: false, message: "Thuốc đang ngừng kinh doanh, không bán được." };
    if (daysUntil(med.expiry, today) < 0) return { ok: false, message: "Thuốc đã hết hạn, không bán được.", expired: true };
    var stock = Number(med.stock) || 0;
    if (stock <= 0) return { ok: false, message: "Thuốc đã hết hàng.", stock: stock };
    if (!qtyOk(qty)) return { ok: false, message: "Số lượng bán phải là số nguyên lớn hơn 0." };
    if (Number(digits(qty)) > stock) {
      return { ok: false, message: "Số lượng bán vượt tồn kho (còn " + stock + ").", stock: stock };
    }
    return { ok: true, stock: stock, qty: Number(digits(qty)) };
  }

  function setQty(cart, med, qty, today) {
    var check = gate(med, qty, today);
    if (!check.ok) return check;
    var line = (cart || []).find(function (item) { return item.id === med.id; });
    if (line) line.qty = check.qty;
    else cart.push({ id: med.id, qty: check.qty });
    return { ok: true, qty: check.qty };
  }

  function addItem(cart, med, today) {
    if (!med) return { ok: false, message: "Không tìm thấy thuốc." };
    var line = (cart || []).find(function (item) { return item.id === med.id; });
    return setQty(cart, med, line ? Number(line.qty) + 1 : 1, today);
  }

  function removeItem(cart, id) {
    return (cart || []).filter(function (item) { return item.id !== id; });
  }

  function lineAmount(price, qty) {
    return (Number(price) || 0) * (Number(qty) || 0);
  }

  function previewCart(cart, medicines, today) {
    var lines = [];
    var problems = [];
    (cart || []).forEach(function (item) {
      var med = (medicines || []).find(function (row) { return row.id === item.id; });
      if (!med) {
        problems.push("Không tìm thấy thuốc trong giỏ.");
        return;
      }
      var check = gate(med, item.qty, today);
      var amount = lineAmount(med.price, item.qty);
      lines.push({
        id: med.id,
        name: med.name,
        unit: med.unit || "",
        price: Number(med.price) || 0,
        qty: Number(item.qty) || 0,
        amount: amount,
        stock: Number(med.stock) || 0,
        ok: check.ok,
        message: check.ok ? "" : check.message,
      });
      if (!check.ok) problems.push(med.name + ": " + check.message);
    });
    var subtotal = lines.reduce(function (sum, line) { return sum + line.amount; }, 0);
    return { lines: lines, subtotal: subtotal, problems: problems };
  }

  function discountOf(rule, subtotal) {
    var raw = rule.type === "percent" ? Math.floor(subtotal * Number(rule.value) / 100) : Number(rule.value) || 0;
    if (rule.maxDiscount) raw = Math.min(raw, Number(rule.maxDiscount));
    if (raw > subtotal) raw = subtotal;
    return raw;
  }

  function applyDiscount(subtotal, input, codes, today) {
    input = input || {};
    var mode = input.mode || "none";
    if (!mode || mode === "none") return { ok: true, mode: "none", amount: 0, code: "", label: "" };
    if (subtotal <= 0) return { ok: false, message: "Đơn hàng chưa có tiền để giảm." };
    if (mode === "code") {
      var code = text(input.code || input.value).toUpperCase();
      if (!code) return { ok: false, message: "Nhập mã giảm giá." };
      var rule = (codes || []).find(function (item) { return text(item.code).toUpperCase() === code; });
      if (!rule || rule.status === "inactive") return { ok: false, message: "Mã giảm giá không hợp lệ." };
      if (rule.start && today && today < rule.start) return { ok: false, message: "Mã giảm giá chưa đến ngày áp dụng." };
      if (rule.end && today && today > rule.end) return { ok: false, message: "Mã giảm giá đã hết hạn." };
      if (subtotal < (Number(rule.minSubtotal) || 0)) return { ok: false, message: "Đơn chưa đạt mức tối thiểu của mã giảm." };
      var coded = discountOf(rule, subtotal);
      if (coded <= 0) return { ok: false, message: "Mã giảm không áp dụng được cho đơn này." };
      return { ok: true, mode: "code", amount: coded, code: rule.code, label: rule.note || rule.code };
    }
    if (mode === "percent") {
      var rawPercent = digits(input.value);
      if (!/^\d+$/.test(rawPercent)) return { ok: false, message: "Mức giảm phần trăm phải là số nguyên." };
      var percent = Number(rawPercent);
      if (percent < 1 || percent > 50) return { ok: false, message: "Chỉ giảm từ 1% đến 50%." };
      var percentOff = Math.floor(subtotal * percent / 100);
      if (percentOff <= 0) return { ok: false, message: "Mức giảm quá nhỏ so với đơn hàng." };
      return { ok: true, mode: "percent", amount: percentOff, code: "", label: "Giảm " + percent + "%" };
    }
    if (mode === "amount") {
      if (!moneyOk(input.value)) return { ok: false, message: "Số tiền giảm phải là số nguyên không âm." };
      var moneyOff = Number(digits(input.value));
      if (moneyOff <= 0) return { ok: false, message: "Số tiền giảm phải lớn hơn 0." };
      if (moneyOff > subtotal) return { ok: false, message: "Số tiền giảm không được vượt quá tổng đơn." };
      return { ok: true, mode: "amount", amount: moneyOff, code: "", label: "Giảm tiền" };
    }
    return { ok: false, message: "Hình thức giảm giá không hợp lệ." };
  }

  function validateCustomer(data) {
    data = data || {};
    var name = text(data.customer != null ? data.customer : data.name);
    var phone = text(data.phone != null ? data.phone : data.customerPhone);
    if (!name) name = "Khách lẻ";
    if (name.length < 2) return { ok: false, message: "Tên khách hàng cần ít nhất 2 ký tự." };
    if (name.length > 80) return { ok: false, message: "Tên khách hàng quá dài." };
    if (phone) {
      if (!phoneOk(phone)) return { ok: false, message: "Số điện thoại khách hàng chưa đúng." };
      phone = phone.replace(/[\s.+()-]/g, "");
      if (phone.indexOf("84") === 0) phone = "0" + phone.slice(2);
    }
    return { ok: true, name: name, phone: phone };
  }

  function cashSettlement(total, tendered) {
    if (tendered == null || text(tendered) === "") return { ok: false, message: "Nhập số tiền khách đưa." };
    if (!moneyOk(tendered)) return { ok: false, message: "Số tiền khách đưa phải là số nguyên không âm." };
    var paid = Number(digits(tendered));
    var due = Number(total) || 0;
    if (paid < due) return { ok: false, message: "Khách đưa chưa đủ. Còn thiếu " + (due - paid) + ".", tendered: paid, change: 0 };
    return { ok: true, tendered: paid, change: paid - due };
  }

  function transferCheck(draft, settings) {
    draft = draft || {};
    settings = settings || {};
    if (!draft.transferConfirmed) return { ok: false, message: "Chưa xác nhận đã nhận chuyển khoản." };
    var ref = text(draft.transferRef);
    if (ref && (ref.length < 4 || ref.length > 40)) return { ok: false, message: "Mã giao dịch cần từ 4 đến 40 ký tự, hoặc để trống." };
    if (!text(settings.bankAccount)) return { ok: false, message: "Chưa có số tài khoản nhận tiền." };
    return {
      ok: true,
      ref: ref,
      bankName: text(settings.bankName),
      bankAccount: text(settings.bankAccount),
      bankOwner: text(settings.bankOwner),
    };
  }

  function nextCode(sales, today) {
    var stamp = text(today).replace(/-/g, "");
    var prefix = "HD" + stamp + "-";
    var max = 0;
    (sales || []).forEach(function (sale) {
      if (text(sale.code).indexOf(prefix) !== 0) return;
      var n = Number(text(sale.code).slice(prefix.length));
      if (n > max) max = n;
    });
    return prefix + String(max + 1).padStart(3, "0");
  }

  function matchingLot(med) {
    var lots = med.lots || [];
    var key = text(med.batch).toUpperCase();
    var found = lots.find(function (lot) { return text(lot.batch).toUpperCase() === key; });
    if (found) return found;
    var live = lots.filter(function (lot) { return Number(lot.qty) > 0; });
    live.sort(function (a, b) { return text(a.expiry).localeCompare(text(b.expiry)); });
    return live[0] || null;
  }

  function deduct(med, qty) {
    var before = Number(med.stock) || 0;
    med.stock = before - qty;
    var lot = matchingLot(med);
    var batch = lot ? text(lot.batch).toUpperCase() : text(med.batch).toUpperCase();
    if (lot) lot.qty = Math.max(0, (Number(lot.qty) || 0) - qty);
    return { before: before, after: med.stock, batch: batch };
  }

  function restore(med, line) {
    med.stock = (Number(med.stock) || 0) + (Number(line.qty) || 0);
    var key = text(line.batch).toUpperCase();
    if (!key || !Array.isArray(med.lots)) return;
    var lot = med.lots.find(function (item) { return text(item.batch).toUpperCase() === key; });
    if (lot) lot.qty = (Number(lot.qty) || 0) + (Number(line.qty) || 0);
  }

  function build(db, draft, ctx) {
    ctx = ctx || {};
    draft = draft || {};
    var branchId = text(draft.branchId);
    if (!branchId || branchId === "all") return { ok: false, message: "Chọn một chi nhánh trước khi lập hóa đơn." };
    if (!ctx.branchOpen) return { ok: false, message: "Chi nhánh đang ngừng hoạt động, không lập được hóa đơn." };
    if (!ctx.today || !dateOk(ctx.today)) return { ok: false, message: "Thiếu ngày bán." };
    var cart = draft.cart || [];
    if (!cart.length) return { ok: false, message: "Chưa có thuốc trong giỏ." };
    var customer = validateCustomer(draft);
    if (!customer.ok) return customer;

    var lines = [];
    var plans = [];
    var seen = {};
    for (var i = 0; i < cart.length; i += 1) {
      var item = cart[i];
      if (seen[item.id]) return { ok: false, message: "Giỏ hàng đang có thuốc trùng." };
      seen[item.id] = true;
      var med = (db.medicines || []).find(function (row) { return row.id === item.id; });
      if (!med) return { ok: false, message: "Không tìm thấy thuốc trong giỏ." };
      if (med.branchId !== branchId) return { ok: false, message: med.name + " không thuộc chi nhánh đang bán." };
      var check = gate(med, item.qty, ctx.today);
      if (!check.ok) return { ok: false, message: med.name + ": " + check.message };
      lines.push({
        medicineId: med.id,
        name: med.name,
        qty: check.qty,
        price: Number(med.price) || 0,
        cost: Number(med.cost) || 0,
        amount: lineAmount(med.price, check.qty),
        batch: "",
        stockBefore: null,
        stockAfter: null,
      });
      plans.push({ med: med, qty: check.qty });
    }

    var subtotal = lines.reduce(function (sum, line) { return sum + line.amount; }, 0);
    var discount = applyDiscount(subtotal, draft.discount || { mode: "none" }, db.discounts || [], ctx.today);
    if (!discount.ok) return discount;
    var total = subtotal - discount.amount;
    var pay = text(draft.pay || "cash");
    if (!PAY[pay]) return { ok: false, message: "Phương thức thanh toán không hợp lệ." };

    var tendered = null;
    var changeAmount = null;
    var transferRef = "";
    var bankName = "";
    var bankAccount = "";
    var bankOwner = "";
    if (pay === "cash") {
      var cash = cashSettlement(total, draft.tendered);
      if (!cash.ok) return cash;
      tendered = cash.tendered;
      changeAmount = cash.change;
    } else if (pay === "transfer") {
      var transfer = transferCheck(draft, db.settings || {});
      if (!transfer.ok) return transfer;
      transferRef = transfer.ref;
      bankName = transfer.bankName;
      bankAccount = transfer.bankAccount;
      bankOwner = transfer.bankOwner;
    }

    return {
      ok: true,
      plans: plans,
      sale: {
        id: ctx.id || ("s" + Date.now()),
        code: nextCode(db.sales, ctx.today),
        branchId: branchId,
        customer: customer.name,
        customerPhone: customer.phone,
        cashier: text(draft.cashier) || "Thu ngân",
        pay: pay,
        payStatus: "received",
        status: "paid",
        at: ctx.now || new Date().toISOString(),
        lines: lines,
        subtotal: subtotal,
        discountMode: discount.mode,
        discountCode: discount.code || "",
        discountLabel: discount.label || "",
        discountAmount: discount.amount,
        total: total,
        tendered: tendered,
        changeAmount: changeAmount,
        transferRef: transferRef,
        bankName: bankName,
        bankAccount: bankAccount,
        bankOwner: bankOwner,
      },
    };
  }

  function stockWarning(med, after) {
    if (after <= 0) return med.name + " đã hết hàng sau khi bán.";
    var minStock = Number(med.minStock) || 0;
    if (after <= minStock) return med.name + " còn " + after + ", dưới mức tối thiểu " + minStock + ".";
    return "";
  }

  function checkout(db, draft, ctx) {
    var built = build(db, draft, ctx);
    if (!built.ok) return built;
    var warnings = [];
    built.plans.forEach(function (plan, index) {
      var moved = deduct(plan.med, plan.qty);
      var line = built.sale.lines[index];
      line.batch = moved.batch;
      line.stockBefore = moved.before;
      line.stockAfter = moved.after;
      var warning = stockWarning(plan.med, moved.after);
      if (warning) warnings.push(warning);
    });
    if (!Array.isArray(db.sales)) db.sales = [];
    db.sales.push(built.sale);
    var loyalty = { note: "" };
    if (root.PharmaCustomers) loyalty = root.PharmaCustomers.applySale(db, built.sale) || loyalty;
    if (warnings.length) {
      if (!Array.isArray(db.notifications)) db.notifications = [];
      warnings.forEach(function (body, index) {
        db.notifications.unshift({
          id: "n" + Date.now() + "-" + index,
          type: "stock",
          title: "Tồn kho sau bán hàng",
          body: body,
          at: built.sale.at,
          read: false,
          priority: "high",
        });
      });
    }
    var message = "Đã thanh toán hóa đơn " + built.sale.code + ".";
    if (warnings.length) message += " " + warnings.join(" ");
    if (loyalty.note) message += loyalty.note;
    return { ok: true, sale: built.sale, warnings: warnings, message: message };
  }

  function dateSpan(from, to) {
    from = text(from);
    to = text(to);
    if (from && !dateOk(from)) return { ok: false, message: "Ngày bắt đầu chưa đúng." };
    if (to && !dateOk(to)) return { ok: false, message: "Ngày kết thúc chưa đúng." };
    if (from && to && from > to) return { ok: false, message: "Ngày bắt đầu không được sau ngày kết thúc." };
    return { ok: true };
  }

  function query(list, opts) {
    opts = opts || {};
    var q = text(opts.q).toLowerCase();
    var from = text(opts.from);
    var to = text(opts.to);
    var status = opts.status || "all";
    var rows = (list || []).filter(function (sale) {
      var day = text(sale.at).slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      var current = sale.status || "paid";
      if (status !== "all" && current !== status) return false;
      if (q && text(sale.code).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    rows.sort(function (a, b) { return text(b.at).localeCompare(text(a.at)); });
    return root.PharmaPager.clamp(rows, opts.page, opts.pageSize || PAGE_SIZE);
  }

  function cancel(db, id, now) {
    var sale = (db.sales || []).find(function (item) { return item.id === id; });
    if (!sale) return { ok: false, message: "Không tìm thấy hóa đơn." };
    if ((sale.status || "paid") === "cancelled") return { ok: false, message: "Hóa đơn đã hủy." };
    if ((sale.status || "paid") !== "paid") return { ok: false, message: "Chỉ hủy hóa đơn đã thanh toán." };
    var missing = (sale.lines || []).some(function (line) {
      return !(db.medicines || []).some(function (med) { return med.id === line.medicineId; });
    });
    if (missing) return { ok: false, message: "Không hoàn tồn được vì thiếu thuốc trên hóa đơn." };
    (sale.lines || []).forEach(function (line) {
      var med = db.medicines.find(function (item) { return item.id === line.medicineId; });
      restore(med, line);
    });
    sale.status = "cancelled";
    sale.cancelledAt = now || new Date().toISOString();
    if (root.PharmaCustomers) root.PharmaCustomers.reverseSale(db, sale);
    return { ok: true, message: "Đã hủy hóa đơn " + sale.code + ".", sale: sale };
  }

  function amount(sale) {
    if (!sale) return 0;
    if (typeof sale.total === "number" && !isNaN(sale.total)) return sale.total;
    return (sale.lines || []).reduce(function (sum, line) {
      if (typeof line.amount === "number") return sum + line.amount;
      return sum + lineAmount(line.price, line.qty);
    }, 0);
  }

  function revenueOf(sale) {
    if (!sale || (sale.status || "paid") === "cancelled") return 0;
    return amount(sale);
  }

  function profit(sale) {
    if (!sale || (sale.status || "paid") === "cancelled") return 0;
    var gross = (sale.lines || []).reduce(function (sum, line) {
      return sum + ((Number(line.price) || 0) - (Number(line.cost) || 0)) * (Number(line.qty) || 0);
    }, 0);
    return gross - (Number(sale.discountAmount) || 0);
  }

  root.PharmaSales = {
    PAGE_SIZE: PAGE_SIZE,
    PAY: PAY,
    ensure: ensure,
    searchMedicines: searchMedicines,
    gate: gate,
    setQty: setQty,
    addItem: addItem,
    removeItem: removeItem,
    lineAmount: lineAmount,
    previewCart: previewCart,
    applyDiscount: applyDiscount,
    validateCustomer: validateCustomer,
    cashSettlement: cashSettlement,
    transferCheck: transferCheck,
    nextCode: nextCode,
    review: build,
    checkout: checkout,
    dateSpan: dateSpan,
    query: query,
    cancel: cancel,
    amount: amount,
    revenueOf: revenueOf,
    profit: profit,
  };
})(typeof window !== "undefined" ? window : globalThis);
