/* Màn hình quầy bán và danh sách hóa đơn. */
(function (root) {
  function wide(user) {
    return user.role === "admin" || !!user.preview;
  }

  function sellBranch(host) {
    var user = host.user || {};
    var branchId = wide(user) ? (host.ui.branch || "all") : user.branchId;
    var branch = (host.db.branches || []).find(function (item) { return item.id === branchId; }) || null;
    return { id: branchId, branch: branch, open: host.operating(branch) };
  }

  function visibleMedicines(host) {
    var user = host.user || {};
    return (host.db.medicines || []).filter(function (med) {
      if (!wide(user) && med.branchId !== user.branchId) return false;
      if (wide(user) && host.ui.branch !== "all" && med.branchId !== host.ui.branch) return false;
      return true;
    });
  }

  function visibleSales(host) {
    var user = host.user || {};
    return (host.db.sales || []).filter(function (sale) {
      if (!wide(user) && sale.branchId !== user.branchId) return false;
      if (wide(user) && host.ui.branch !== "all" && sale.branchId !== host.ui.branch) return false;
      return true;
    });
  }

  function draftOf(host, branchId) {
    var mode = host.ui.discountMode || "none";
    var value = host.ui.discountValue || "";
    return {
      branchId: branchId,
      cart: host.ui.cart || [],
      customer: host.ui.customer,
      phone: host.ui.customerPhone,
      discount: { mode: mode, value: value, code: value },
      pay: host.ui.pay || "cash",
      tendered: host.ui.tendered,
      transferConfirmed: !!host.ui.transferOk,
      transferRef: host.ui.transferRef || "",
      cashier: host.user ? host.user.name : "",
    };
  }

  function statusPill(status) {
    if (status === "cancelled") return '<span class="badge-pill bad">Đã hủy</span>';
    return '<span class="badge-pill ok">Đã thanh toán</span>';
  }

  function head(host) {
    var tab = host.ui.saleTab === "invoices" ? "invoices" : "desk";
    var place = sellBranch(host);
    var note = "Lập hóa đơn tại quầy.";
    if (!place.branch && place.id !== "all") note = "Chưa có chi nhánh.";
    else if (place.id === "all") note = "Chọn một chi nhánh trên thanh công cụ trước khi lập hóa đơn.";
    else if (!place.open) note = "Chi nhánh này đang ngừng hoạt động, chưa lập được hóa đơn.";
    else note = "Lập hóa đơn tại " + host.esc(place.branch.name) + ".";
    return '<div class="page-head"><div><h1>Bán hàng</h1><p>' + note + "</p></div>" +
      '<div class="chips">' +
      '<button class="chip ' + (tab === "desk" ? "on" : "") + '" data-action="sale-tab" data-value="desk">Quầy bán</button>' +
      '<button class="chip ' + (tab === "invoices" ? "on" : "") + '" data-action="sale-tab" data-value="invoices">Hóa đơn</button>' +
      "</div></div>";
  }

  function resultCard(host, med) {
    var check = root.PharmaSales.gate(med, 1, host.today);
    var left = root.PharmaMedicines.daysUntil(med.expiry, host.today);
    var flags = [];
    if ((med.status || "active") !== "active") flags.push('<span class="badge-pill neutral">Ngừng bán</span>');
    else if (left < 0) flags.push('<span class="badge-pill bad">Hết hạn</span>');
    else if ((Number(med.stock) || 0) <= 0) flags.push('<span class="badge-pill bad">Hết hàng</span>');
    else if (left <= 30) flags.push('<span class="badge-pill warn">Sắp hết hạn</span>');
    var stockText = "Còn " + (Number(med.stock) || 0);
    if ((Number(med.stock) || 0) > 0 && (Number(med.stock) || 0) <= (Number(med.minStock) || 0)) stockText += " · dưới tối thiểu";
    return '<button class="med-card sale-hit ' + (check.ok ? "" : "is-blocked") + '" data-action="add-cart" data-id="' + host.esc(med.id) + '">' +
      "<div><b>" + host.esc(med.name) + "</b>" +
      '<div class="tiny muted">' + host.esc(med.code || med.sku || "") + " · " + host.esc(host.branchName(med.branchId)) + " · " + stockText + "</div>" +
      '<div class="tiny muted">Hạn ' + host.esc(med.expiry ? host.dateLabel(med.expiry) : "—") + "</div>" +
      (flags.length ? '<div style="margin-top:6px">' + flags.join(" ") + "</div>" : "") +
      (check.ok ? "" : '<div class="sale-warn">' + host.esc(check.message) + "</div>") +
      "</div>" +
      '<div class="sale-price">' + host.money(med.price) + "</div></button>";
  }

  function cartLine(host, line) {
    return '<div class="sale-cart-line">' +
      "<div><b>" + host.esc(line.name) + "</b>" +
      '<div class="tiny muted">' + host.money(line.price) + (line.unit ? " / " + host.esc(line.unit) : "") + "</div>" +
      (line.ok ? "" : '<div class="sale-warn">' + host.esc(line.message) + "</div>") +
      "</div>" +
      '<div class="qty">' +
      '<button type="button" data-action="qty" data-id="' + host.esc(line.id) + '" data-dir="-1">−</button>' +
      '<input class="qty-input" id="cart-qty-' + host.esc(line.id) + '" data-cart-qty="' + host.esc(line.id) + '" value="' + host.esc(line.qty) + '" inputmode="numeric" autocomplete="off" />' +
      '<button type="button" data-action="qty" data-id="' + host.esc(line.id) + '" data-dir="1">+</button>' +
      "</div>" +
      '<b class="line-total">' + host.money(line.amount) + "</b>" +
      '<button type="button" class="btn sm ghost" data-action="ask-remove" data-id="' + host.esc(line.id) + '">Xóa</button>' +
      "</div>";
  }

  function discountBox(host, discount) {
    var mode = host.ui.discountMode || "none";
    var codes = (host.db.discounts || []).filter(function (item) { return item.status !== "inactive"; });
    var hint = codes.map(function (item) { return item.code; }).join(", ");
    var field = "";
    if (mode !== "none") {
      var placeholder = mode === "code" ? "VD: GIAM10" : mode === "percent" ? "VD: 10" : "VD: 20000";
      field = '<label class="control" style="margin-top:8px"><input id="discount-value" data-input="discountValue" value="' + host.esc(host.ui.discountValue || "") + '" placeholder="' + placeholder + '" autocomplete="off" /></label>';
    }
    return '<div class="field" style="margin-top:12px"><div class="field-head"><span>Giảm giá</span></div>' +
      '<label class="control"><select data-change="discount-mode">' +
      '<option value="none"' + (mode === "none" ? " selected" : "") + ">Không giảm</option>" +
      '<option value="code"' + (mode === "code" ? " selected" : "") + ">Mã giảm giá</option>" +
      '<option value="percent"' + (mode === "percent" ? " selected" : "") + ">Giảm theo %</option>" +
      '<option value="amount"' + (mode === "amount" ? " selected" : "") + ">Giảm số tiền</option>" +
      "</select></label>" + field +
      (hint ? '<p class="tiny muted" style="margin:6px 0 0">Mã đang mở: ' + host.esc(hint) + "</p>" : "") +
      (discount.ok ? "" : '<div class="sale-warn">' + host.esc(discount.message) + "</div>") +
      "</div>";
  }

  function paymentBox(host, total) {
    var pay = host.ui.pay || "cash";
    var methods = Object.keys(root.PharmaSales.PAY).map(function (key) {
      return '<button type="button" class="chip ' + (pay === key ? "on" : "") + '" data-action="pay" data-value="' + key + '">' + root.PharmaSales.PAY[key] + "</button>";
    }).join("");
    var extra = "";
    if (pay === "cash") {
      var cash = root.PharmaSales.cashSettlement(total, host.ui.tendered);
      var cashNote = "";
      if (String(host.ui.tendered || "").trim() || (host.ui.cart || []).length) {
        cashNote = cash.ok ? '<div class="sale-ok">Tiền thừa: ' + host.money(cash.change) + "</div>" : '<div class="sale-warn">' + host.esc(cash.message) + "</div>";
      }
      extra = '<div class="field" style="margin-top:8px"><div class="field-head"><span>Tiền khách đưa</span></div>' +
        '<label class="control"><input id="tendered" data-input="tendered" value="' + host.esc(host.ui.tendered || "") + '" inputmode="numeric" placeholder="Số tiền" autocomplete="off" /></label>' +
        cashNote + "</div>";
    } else if (pay === "transfer") {
      var settings = host.db.settings || {};
      var transfer = root.PharmaSales.transferCheck({
        transferConfirmed: !!host.ui.transferOk,
        transferRef: host.ui.transferRef || "",
      }, settings);
      extra = '<div class="bank-box"><b>Thông tin chuyển khoản</b>' +
        '<div class="tiny">' + host.esc(settings.bankName || "—") + " · " + host.esc(settings.bankBranch || "") + "</div>" +
        "<div>Số tài khoản: <b>" + host.esc(settings.bankAccount || "—") + "</b></div>" +
        "<div>Chủ tài khoản: " + host.esc(settings.bankOwner || "—") + "</div>" +
        '<div class="tiny muted">Nội dung: thanh toán hóa đơn tại quầy</div>' +
        '<label><input type="checkbox" data-change="transfer-ok"' + (host.ui.transferOk ? " checked" : "") + " /> Đã nhận tiền chuyển khoản</label>" +
        '<label class="control" style="margin-top:8px"><input id="transfer-ref" data-input="transferRef" value="' + host.esc(host.ui.transferRef || "") + '" placeholder="Mã giao dịch nếu có" autocomplete="off" /></label>' +
        (transfer.ok ? '<div class="sale-ok">Đã xác nhận nhận tiền.</div>' : '<div class="sale-warn">' + host.esc(transfer.message) + "</div>") +
        "</div>";
    } else {
      extra = '<p class="tiny muted">Thanh toán thẻ được xác nhận ngay tại quầy.</p>';
    }
    return '<div class="pay-row" style="margin-top:12px">' + methods + "</div>" + extra;
  }

  function matchedCustomer(host) {
    if (!root.PharmaCustomers) return null;
    return root.PharmaCustomers.findByPhone(host.db, host.ui.customerPhone);
  }

  function customerHint(host) {
    if (!root.PharmaCustomers) return "";
    var found = matchedCustomer(host);
    if (!textPhone(host.ui.customerPhone)) {
      return '<p class="tiny muted">Nhập số điện thoại để nhận vai trò và tích điểm.</p>';
    }
    if (!found) return '<p class="tiny muted">Chưa có hồ sơ. Hóa đơn vẫn lưu tên khách, chưa tích điểm.</p>';
    var role = root.PharmaCustomers.roleById(host.db, found.roleId);
    var benefit = role ? root.PharmaCustomers.benefitText(role) : "";
    var warn = found.status !== "active" || !role || role.status !== "active";
    var discount = !warn && role && role.discountPercent
      ? '<button type="button" class="btn sm ghost" data-action="apply-role-discount">Giảm ' + role.discountPercent + "% theo vai trò</button>"
      : "";
    return '<p class="note">' + host.esc(found.name) + " · " + host.esc(role ? role.name : "Chưa có vai trò") + " · " + (Number(found.points) || 0) + " điểm. " + host.esc(benefit) +
      (warn ? " Hồ sơ hoặc vai trò đang tắt, không tích điểm." : "") + "</p>" + discount;
  }

  function textPhone(value) {
    return String(value == null ? "" : value).trim();
  }

  function loyaltyLine(host, sale) {
    if (!sale || !sale.customerId || !root.PharmaCustomers) return "";
    var role = root.PharmaCustomers.roleById(host.db, sale.customerRoleId);
    var points = sale.spendCounted && !sale.pointsReversed ? (Number(sale.pointsEarned) || 0) : 0;
    var bits = [];
    if (role) bits.push(role.name);
    if (points) bits.push("+" + points + " điểm");
    else if (sale.pointsReversed) bits.push("đã hoàn điểm");
    return bits.length ? " · " + host.esc(bits.join(" · ")) : "";
  }

  function loyaltyPreview(host, sale) {
    if (!root.PharmaCustomers) return "";
    var preview = root.PharmaCustomers.previewSale(host.db, sale);
    return '<p class="note">' + host.esc(preview.label || "") + "</p>";
  }

  function deskPage(host) {
    var place = sellBranch(host);
    var found = root.PharmaSales.searchMedicines(visibleMedicines(host), { q: host.ui.qSale });
    var cartView = root.PharmaSales.previewCart(host.ui.cart, host.db.medicines, host.today);
    var discount = root.PharmaSales.applyDiscount(cartView.subtotal, {
      mode: host.ui.discountMode || "none",
      value: host.ui.discountValue || "",
      code: host.ui.discountValue || "",
    }, host.db.discounts, host.today);
    var total = discount.ok ? cartView.subtotal - discount.amount : cartView.subtotal;
    var pay = host.ui.pay || "cash";
    var payReady = pay === "card" || (pay === "cash" && root.PharmaSales.cashSettlement(total, host.ui.tendered).ok) || (pay === "transfer" && root.PharmaSales.transferCheck({ transferConfirmed: !!host.ui.transferOk, transferRef: host.ui.transferRef || "" }, host.db.settings || {}).ok);
    var ready = host.canSell && place.id !== "all" && place.open && cartView.lines.length > 0 && cartView.problems.length === 0 && discount.ok && payReady;
    var cards = found.map(function (med) { return resultCard(host, med); }).join("");
    var lines = cartView.lines.map(function (line) { return cartLine(host, line); }).join("");
    return '<div class="sale-layout">' +
      '<section class="card"><h3>Tìm thuốc</h3>' +
      '<label class="search">' + host.icon("search") + '<input id="q-sale" placeholder="Tìm theo mã hoặc tên thuốc" data-input="qSale" value="' + host.esc(host.ui.qSale || "") + '" autocomplete="off" /></label>' +
      '<div class="sale-results">' + (cards || '<div class="empty">Không có thuốc khớp từ khóa.</div>') + "</div></section>" +
      '<section class="card"><h3>Giỏ hàng</h3>' +
      (lines || '<div class="empty">Chưa chọn thuốc</div>') +
      '<div class="field" style="margin-top:12px"><div class="field-head"><span>Khách hàng</span></div><label class="control"><input id="customer" data-input="customer" value="' + host.esc(host.ui.customer || "") + '" placeholder="Khách lẻ" autocomplete="off" /></label></div>' +
      '<div class="field"><div class="field-head"><span>Điện thoại</span></div><label class="control"><input id="customer-phone" data-input="customerPhone" value="' + host.esc(host.ui.customerPhone || "") + '" placeholder="Không bắt buộc" autocomplete="off" /></label></div>' +
      customerHint(host) +
      discountBox(host, discount) +
      '<div class="sale-sum"><span>Tạm tính</span><span>' + host.money(cartView.subtotal) + "</span></div>" +
      '<div class="sale-sum"><span>Giảm giá</span><span>' + (discount.ok && discount.amount ? "− " + host.money(discount.amount) : host.money(0)) + "</span></div>" +
      '<div class="sale-sum grand"><span>Khách phải trả</span><span>' + host.money(total) + "</span></div>" +
      paymentBox(host, total) +
      (host.canSell ? "" : '<p class="sale-warn">Tài khoản không có quyền lập hóa đơn.</p>') +
      '<button class="btn block" type="button" data-action="ask-checkout"' + (ready ? "" : " disabled") + ">Thanh toán</button>" +
      "</section></div>";
  }

  function invoicePage(host) {
    var span = root.PharmaSales.dateSpan(host.ui.invoiceFrom, host.ui.invoiceTo);
    var listed = root.PharmaSales.query(visibleSales(host), {
      q: host.ui.qInvoice,
      from: span.ok ? host.ui.invoiceFrom : "2999-01-01",
      to: span.ok ? host.ui.invoiceTo : "1999-01-01",
      status: host.ui.invoiceStatus || "all",
      page: host.ui.invoicePage,
    });
    if (!span.ok) listed = { rows: [], total: 0, page: 1, pages: 1 };
    host.ui.invoicePage = listed.page;
    var filters = [["all", "Tất cả"], ["paid", "Đã thanh toán"], ["cancelled", "Đã hủy"]];
    var rows = listed.rows.map(function (sale) {
      var actions = ['<button class="btn sm soft" data-action="open-invoice" data-id="' + host.esc(sale.id) + '">Chi tiết</button>'];
      if (host.canSell && (sale.status || "paid") === "paid") {
        actions.push('<button class="btn sm danger" data-action="ask-cancel-invoice" data-id="' + host.esc(sale.id) + '">Hủy</button>');
      }
      return "<tr><td><b>" + host.esc(sale.code) + "</b></td><td>" + host.esc(host.timeLabel(sale.at)) + "</td><td>" + host.esc(sale.customer) +
        (sale.customerPhone ? '<div class="tiny muted">' + host.esc(sale.customerPhone) + "</div>" : "") +
        "</td><td>" + host.esc(host.branchName(sale.branchId)) + "</td><td>" + host.esc(sale.cashier || "") + "</td><td>" +
        host.esc(root.PharmaSales.PAY[sale.pay] || sale.pay || "") + "</td><td><b>" + host.money(root.PharmaSales.amount(sale)) + "</b></td><td>" +
        statusPill(sale.status || "paid") + '</td><td><div class="action-row">' + actions.join("") + "</div></td></tr>";
    }).join("");
    var empty = !span.ok ? span.message : "Chưa có hóa đơn khớp bộ lọc.";
    return '<div class="toolbar invoice-tools"><label class="search">' + host.icon("search") +
      '<input id="q-invoice" placeholder="Tìm theo mã hóa đơn" data-input="qInvoice" value="' + host.esc(host.ui.qInvoice || "") + '" autocomplete="off" /></label>' +
      '<label class="control"><input id="invoice-from" type="date" data-input="invoiceFrom" value="' + host.esc(host.ui.invoiceFrom || "") + '" /></label>' +
      '<label class="control"><input id="invoice-to" type="date" data-input="invoiceTo" value="' + host.esc(host.ui.invoiceTo || "") + '" /></label>' +
      '<div class="chips">' + filters.map(function (pair) {
        return '<button type="button" class="chip ' + ((host.ui.invoiceStatus || "all") === pair[0] ? "on" : "") + '" data-action="invoice-filter" data-value="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("") + "</div></div>" +
      (!span.ok ? '<p class="sale-warn">' + host.esc(span.message) + "</p>" : "") +
      '<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Thời gian</th><th>Khách</th><th>Chi nhánh</th><th>Thu ngân</th><th>Thanh toán</th><th>Tổng</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9"><div class="empty">' + host.esc(empty) + "</div></td></tr>") +
      "</tbody></table></div>" + host.pagerBar(listed, "invoice-page");
  }

  function page(host) {
    var tab = host.ui.saleTab === "invoices" ? "invoices" : "desk";
    return head(host) + (tab === "invoices" ? invoicePage(host) : deskPage(host));
  }

  function invoiceDetail(host, sale) {
    if (!sale) return "<h3>Hóa đơn</h3><p>Không tìm thấy hóa đơn.</p>";
    var lines = (sale.lines || []).map(function (line) {
      var amount = typeof line.amount === "number" ? line.amount : root.PharmaSales.lineAmount(line.price, line.qty);
      return '<div class="cart-line"><span>' + host.esc(line.name) + " × " + line.qty + "</span><b>" + host.money(amount) + "</b></div>";
    }).join("");
    var payNote = "";
    if (sale.pay === "cash") {
      payNote = "<p>Khách đưa: <b>" + host.money(sale.tendered || 0) + "</b> · Tiền thừa: <b>" + host.money(sale.changeAmount || 0) + "</b></p>";
    } else if (sale.pay === "transfer") {
      payNote = '<div class="bank-box"><div>' + host.esc(sale.bankName || "") + " · " + host.esc(sale.bankAccount || "") + "</div>" +
        "<div>" + host.esc(sale.bankOwner || "") + "</div>" +
        "<div>Mã giao dịch: " + host.esc(sale.transferRef || "—") + "</div>" +
        "<div>Trạng thái: đã nhận tiền</div></div>";
    }
    return "<h3>Hóa đơn " + host.esc(sale.code) + " " + statusPill(sale.status || "paid") + "</h3>" +
      '<p class="muted">' + host.esc(host.branchName(sale.branchId)) + "<br/>" + host.esc(host.timeLabel(sale.at)) + " · " + host.esc(sale.cashier || "") + "</p>" +
      lines +
      '<div class="sale-sum"><span>Tạm tính</span><span>' + host.money(sale.subtotal != null ? sale.subtotal : root.PharmaSales.amount(sale)) + "</span></div>" +
      (sale.discountAmount ? '<div class="sale-sum"><span>Giảm ' + host.esc(sale.discountCode || sale.discountLabel || "") + "</span><span>− " + host.money(sale.discountAmount) + "</span></div>" : "") +
      '<div class="total-line"><span>Khách trả (' + host.esc(root.PharmaSales.PAY[sale.pay] || "") + ")</span><span>" + host.money(root.PharmaSales.amount(sale)) + "</span></div>" +
      "<p>Khách: <b>" + host.esc(sale.customer) + "</b>" + (sale.customerPhone ? " · " + host.esc(sale.customerPhone) : "") + loyaltyLine(host, sale) + "</p>" +
      payNote +
      (sale.cancelledAt ? '<p class="sale-warn">Đã hủy lúc ' + host.esc(host.timeLabel(sale.cancelledAt)) + ".</p>" : "") +
      '<div style="text-align:right"><button type="button" class="btn" data-action="close">Đóng</button></div>';
  }

  function modalBody(modal, host) {
    if (!modal) return null;
    if (modal.type === "remove-cart") {
      var line = (host.ui.cart || []).find(function (item) { return item.id === modal.id; });
      var med = (host.db.medicines || []).find(function (item) { return item.id === modal.id; });
      var name = med ? med.name : "thuốc này";
      if (!line) return "<h3>Xóa khỏi giỏ</h3><p>Dòng hàng không còn trong giỏ.</p>";
      return "<h3>Xóa khỏi giỏ</h3><p>Bỏ <b>" + host.esc(name) + "</b> (" + line.qty + " " + host.esc(med && med.unit ? med.unit : "") + ") khỏi hóa đơn đang lập?</p>" +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Giữ lại</button>' +
        '<button type="button" class="btn danger" data-action="do-remove" data-id="' + host.esc(modal.id) + '">Xóa</button></div>';
    }
    if (modal.type === "checkout-sale") {
      var place = sellBranch(host);
      var reviewed = root.PharmaSales.review(host.db, draftOf(host, place.id), {
        today: host.today,
        branchOpen: place.open,
        now: new Date().toISOString(),
      });
      if (!reviewed.ok) {
        return "<h3>Xác nhận đơn</h3><p class=\"sale-warn\">" + host.esc(reviewed.message) + "</p>" +
          '<div style="text-align:right"><button type="button" class="btn ghost" data-action="close">Quay lại</button></div>';
      }
      var sale = reviewed.sale;
      var detail = (sale.lines || []).map(function (line) {
        return '<div class="cart-line"><span>' + host.esc(line.name) + " × " + line.qty + "</span><b>" + host.money(line.amount) + "</b></div>";
      }).join("");
      var cash = sale.pay === "cash" ? "<p>Khách đưa " + host.money(sale.tendered) + ", tiền thừa " + host.money(sale.changeAmount) + ".</p>" : "";
      var transfer = sale.pay === "transfer" ? "<p>Chuyển khoản vào " + host.esc(sale.bankAccount) + ". Đã xác nhận nhận tiền.</p>" : "";
      return "<h3>Xác nhận đơn " + host.esc(sale.code) + "</h3>" + detail +
        (sale.discountAmount ? '<div class="sale-sum"><span>Giảm giá</span><span>− ' + host.money(sale.discountAmount) + "</span></div>" : "") +
        '<div class="total-line"><span>' + host.esc(root.PharmaSales.PAY[sale.pay]) + "</span><span>" + host.money(sale.total) + "</span></div>" +
        "<p>Khách: <b>" + host.esc(sale.customer) + "</b></p>" + loyaltyPreview(host, sale) + cash + transfer +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Quay lại</button>' +
        '<button type="button" class="btn" data-action="do-checkout">Xác nhận thanh toán</button></div>';
    }
    if (modal.type === "invoice") {
      var found = (host.db.sales || []).find(function (item) { return item.id === modal.id; });
      return invoiceDetail(host, found);
    }
    if (modal.type === "cancel-sale") {
      var target = (host.db.sales || []).find(function (item) { return item.id === modal.id; });
      if (!target) return "<h3>Hủy hóa đơn</h3><p>Không tìm thấy hóa đơn.</p>";
      return "<h3>Hủy hóa đơn " + host.esc(target.code) + "</h3><p>Hủy hóa đơn của <b>" + host.esc(target.customer) + "</b> (" + host.money(root.PharmaSales.amount(target)) + ")? Tồn kho sẽ được cộng lại và trạng thái chuyển thành đã hủy.</p>" +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Không hủy</button>' +
        '<button type="button" class="btn danger" data-action="do-cancel-invoice" data-id="' + host.esc(target.id) + '">Xác nhận hủy</button></div>';
    }
    return null;
  }

  function handleClick(action, el, host) {
    if (action === "sale-tab") {
      host.ui.saleTab = el.dataset.value === "invoices" ? "invoices" : "desk";
      host.render();
      return true;
    }
    if (action === "add-cart") {
      var place = sellBranch(host);
      if (!host.canSell) { host.toast("Không có quyền bán hàng"); return true; }
      if (place.id === "all") { host.toast("Chọn một chi nhánh trước khi chọn thuốc."); return true; }
      if (!place.open) { host.toast("Chi nhánh đang ngừng hoạt động, không lập được hóa đơn."); return true; }
      var med = (host.db.medicines || []).find(function (item) { return item.id === el.dataset.id; });
      if (!med) return true;
      if (med.branchId !== place.id) { host.toast("Thuốc không thuộc chi nhánh đang bán."); return true; }
      var added = root.PharmaSales.addItem(host.ui.cart, med, host.today);
      if (!added.ok) { host.toast(added.message); return true; }
      host.render();
      return true;
    }
    if (action === "qty") {
      var current = (host.ui.cart || []).find(function (item) { return item.id === el.dataset.id; });
      var target = (host.db.medicines || []).find(function (item) { return item.id === el.dataset.id; });
      if (!current || !target) return true;
      var dir = Number(el.dataset.dir);
      if (dir < 0 && current.qty <= 1) {
        host.ui.modal = { type: "remove-cart", id: current.id };
        host.render();
        return true;
      }
      var changed = root.PharmaSales.setQty(host.ui.cart, target, current.qty + dir, host.today);
      if (!changed.ok) { host.toast(changed.message); return true; }
      host.render();
      return true;
    }
    if (action === "ask-remove") {
      host.ui.modal = { type: "remove-cart", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "do-remove") {
      host.ui.cart = root.PharmaSales.removeItem(host.ui.cart, el.dataset.id);
      host.ui.modal = null;
      host.render();
      return true;
    }
    if (action === "pay") {
      if (!root.PharmaSales.PAY[el.dataset.value]) return true;
      host.ui.pay = el.dataset.value;
      host.render();
      return true;
    }
    if (action === "ask-checkout") {
      if (!host.canSell) { host.toast("Không có quyền bán hàng"); return true; }
      var counter = sellBranch(host);
      var reviewed = root.PharmaSales.review(host.db, draftOf(host, counter.id), {
        today: host.today,
        branchOpen: counter.open,
      });
      if (!reviewed.ok) { host.toast(reviewed.message); return true; }
      host.ui.modal = { type: "checkout-sale" };
      host.render();
      return true;
    }
    if (action === "do-checkout") {
      if (!host.canSell) { host.toast("Không có quyền bán hàng"); return true; }
      var desk = sellBranch(host);
      var sold = root.PharmaSales.checkout(host.db, draftOf(host, desk.id), {
        today: host.today,
        branchOpen: desk.open,
        now: new Date().toISOString(),
      });
      if (!sold.ok) { host.toast(sold.message); return true; }
      host.ui.cart = [];
      host.ui.customer = "Khách lẻ";
      host.ui.customerPhone = "";
      host.ui.discountMode = "none";
      host.ui.discountValue = "";
      host.ui.tendered = "";
      host.ui.transferOk = false;
      host.ui.transferRef = "";
      host.ui.modal = { type: "invoice", id: sold.sale.id };
      host.persist();
      host.toast(sold.message);
      return true;
    }
    if (action === "invoice-filter") {
      host.ui.invoiceStatus = el.dataset.value || "all";
      host.ui.invoicePage = 1;
      host.render();
      return true;
    }
    if (action === "invoice-page") {
      host.ui.invoicePage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "open-invoice") {
      host.ui.modal = { type: "invoice", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "ask-cancel-invoice") {
      if (!host.canSell) { host.toast("Không có quyền bán hàng"); return true; }
      host.ui.modal = { type: "cancel-sale", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "do-cancel-invoice") {
      if (!host.canSell) { host.toast("Không có quyền bán hàng"); return true; }
      var cancelled = root.PharmaSales.cancel(host.db, el.dataset.id, new Date().toISOString());
      if (!cancelled.ok) { host.toast(cancelled.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(cancelled.message);
      return true;
    }
    if (action === "apply-role-discount") {
      var matched = matchedCustomer(host);
      var matchedRole = matched && root.PharmaCustomers ? root.PharmaCustomers.roleById(host.db, matched.roleId) : null;
      if (!matched || matched.status !== "active" || !matchedRole || matchedRole.status !== "active" || !matchedRole.discountPercent) {
        host.toast("Vai trò này không có mức giảm để áp dụng.");
        return true;
      }
      host.ui.discountMode = "percent";
      host.ui.discountValue = String(matchedRole.discountPercent);
      host.render();
      return true;
    }
    return false;
  }

  function handleInput(event, host) {
    var qtyEl = event.target.closest("[data-cart-qty]");
    if (qtyEl) {
      host.state._focus = qtyEl.id;
      try { host.state._pos = qtyEl.selectionStart; } catch (err) { host.state._pos = null; }
      var med = (host.db.medicines || []).find(function (item) { return item.id === qtyEl.dataset.cartQty; });
      var result = root.PharmaSales.setQty(host.ui.cart, med, qtyEl.value, host.today);
      if (!result.ok) { host.toast(result.message); return true; }
      host.render();
      return true;
    }
    var el = event.target.closest("[data-input]");
    if (!el) return false;
    var key = el.dataset.input;
    if (key === "qInvoice" || key === "invoiceFrom" || key === "invoiceTo") {
      host.state._focus = el.id;
      try { host.state._pos = el.selectionStart; } catch (err) { host.state._pos = null; }
      host.ui[key] = el.value;
      host.ui.invoicePage = 1;
      var span = root.PharmaSales.dateSpan(host.ui.invoiceFrom, host.ui.invoiceTo);
      if (!span.ok) host.toast(span.message);
      else host.render();
      return true;
    }
    if (key === "customer" || key === "customerPhone") {
      host.state._focus = el.id;
      try { host.state._pos = el.selectionStart; } catch (err) { host.state._pos = null; }
      host.ui[key] = el.value;
      if (key === "customerPhone" && root.PharmaCustomers) {
        var known = root.PharmaCustomers.findByPhone(host.db, el.value);
        if (known && (!host.ui.customer || host.ui.customer === "Khách lẻ")) host.ui.customer = known.name;
      }
      host.render();
      return true;
    }
    return false;
  }

  function handleChange(event, host) {
    var el = event.target.closest("[data-change]");
    if (!el) return false;
    if (el.dataset.change === "discount-mode") {
      host.ui.discountMode = el.value;
      host.ui.discountValue = "";
      host.render();
      return true;
    }
    if (el.dataset.change === "transfer-ok") {
      host.ui.transferOk = !!el.checked;
      host.render();
      return true;
    }
    return false;
  }

  root.PharmaSalesPages = {
    page: page,
    modalBody: modalBody,
    handleClick: handleClick,
    handleInput: handleInput,
    handleChange: handleChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
