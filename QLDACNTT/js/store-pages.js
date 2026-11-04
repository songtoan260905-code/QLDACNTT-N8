/* Cửa hàng cho tài khoản khách: thuốc, đơn đã mua và điểm. */
(function (root) {
  function availability(med, today) {
    var expiry = String(med.expiry || "");
    if ((med.status || "active") !== "active") return ["neutral", "Ngừng bán"];
    if (expiry && today && expiry < today) return ["bad", "Hết hạn"];
    if ((Number(med.stock) || 0) <= 0) return ["bad", "Hết hàng"];
    if ((Number(med.stock) || 0) <= (Number(med.minStock) || 0)) return ["warn", "Sắp hết"];
    return ["ok", "Còn hàng"];
  }

  function shopId(host) {
    var open = (host.db.branches || []).filter(function (branch) { return branch.status === "open"; });
    if (open.some(function (branch) { return branch.id === host.ui.shopBranch; })) return host.ui.shopBranch;
    var home = host.user && open.some(function (branch) { return branch.id === host.user.branchId; }) ? host.user.branchId : "";
    host.ui.shopBranch = home || (open[0] ? open[0].id : "");
    return host.ui.shopBranch;
  }

  function customerOf(host) {
    var user = host.user;
    if (!user) return null;
    return root.PharmaCustomers.byId(host.db, user.customerId) || (host.db.customers || []).find(function (item) {
      return item.accountUserId === user.id;
    }) || null;
  }

  function loyaltyCard(host) {
    var customer = customerOf(host);
    if (!customer) return '<section class="card"><p>Chưa gắn hồ sơ khách cho tài khoản này.</p></section>';
    var role = root.PharmaCustomers.roleById(host.db, customer.roleId);
    return '<section class="card"><div class="med-head"><b>' + host.esc(customer.name) + "</b>" +
      (role ? '<span class="badge-pill ok">' + host.esc(role.name) + "</span>" : "") +
      '</div><dl class="med-facts"><div><dt>Điểm</dt><dd>' + (Number(customer.points) || 0) +
      '</dd></div><div><dt>Tổng chi</dt><dd>' + host.money(customer.totalSpend || 0) +
      '</dd></div><div><dt>Điện thoại</dt><dd>' + host.esc(customer.phone) + "</dd></div></dl>" +
      (role ? '<p class="tiny muted">' + host.esc(root.PharmaCustomers.benefitText(role)) + "</p>" : "") +
      "</section>";
  }

  function catalog(host) {
    var branchId = shopId(host);
    var branch = (host.db.branches || []).find(function (item) { return item.id === branchId; });
    if (!branch) {
      return '<div class="card empty"><h3>Chưa có chi nhánh đang mở</h3><p>Cửa hàng tạm nghỉ. Hãy quay lại khi nhà thuốc mở cửa.</p></div>';
    }
    var keyword = String(host.ui.qStore || "").toLowerCase().split(/\s+/).filter(Boolean);
    var rows = (host.db.medicines || []).filter(function (med) {
      if (med.branchId !== branchId) return false;
      var blob = [med.name, med.code, med.sku, med.activeIngredient].join(" ").toLowerCase();
      return keyword.every(function (part) { return blob.indexOf(part) >= 0; });
    });
    rows.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "vi"); });
    var listed = root.PharmaPager.clamp(rows, host.ui.storePage, 6);
    host.ui.storePage = listed.page;
    var cards = listed.rows.map(function (med) {
      var state = availability(med, host.today);
      return '<article class="med-row"><div class="med-main"><div class="med-head"><b>' + host.esc(med.name) + '</b><span class="badge-pill ' + state[0] + '">' + state[1] +
        '</span></div><div class="tiny muted">' + host.esc(med.code || med.sku || "") + (med.activeIngredient ? " · " + host.esc(med.activeIngredient) : "") +
        '</div><dl class="med-facts"><div><dt>Giá bán</dt><dd>' + host.money(med.price) + '</dd></div><div><dt>Đơn vị</dt><dd>' + host.esc(med.unit || "—") +
        '</dd></div><div><dt>Hạn dùng</dt><dd>' + (med.expiry ? host.dateLabel(med.expiry) : "—") + "</dd></div></dl></div></article>";
    }).join("");
    return '<div class="page-head"><div><h1>Cửa hàng</h1><p>' + host.esc(branch.name) + " · " + listed.total + ' thuốc đang bày</p></div></div>' +
      loyaltyCard(host) +
      '<div class="toolbar" style="margin-top:14px"><label class="search">' + host.icon("search") +
      '<input id="q-store" placeholder="Tìm tên thuốc, mã hoặc hoạt chất" data-input="qStore" value="' + host.esc(host.ui.qStore || "") + '" /></label></div>' +
      '<div class="med-list" style="margin-top:14px">' + (cards || '<div class="empty">Không có thuốc khớp từ khóa tại chi nhánh này.</div>') + "</div>" +
      host.pagerBar(listed, "store-page");
  }

  function orders(host) {
    shopId(host);
    var customer = customerOf(host);
    var sales = customer ? root.PharmaCustomers.history(host.db, customer) : [];
    var listed = root.PharmaPager.clamp(sales, host.ui.storeOrderPage, 6);
    host.ui.storeOrderPage = listed.page;
    var rows = listed.rows.map(function (sale) {
      var points = sale.spendCounted && !sale.pointsReversed ? (Number(sale.pointsEarned) || 0) : 0;
      var status = (sale.status || "paid") === "cancelled" ? "Đã hủy" : "Đã thanh toán";
      return "<tr><td><button class=\"linkish\" data-action=\"open-store-order\" data-id=\"" + host.esc(sale.id) + "\">" + host.esc(sale.code) +
        "</button></td><td>" + host.esc(host.timeLabel(sale.at)) + "</td><td>" + host.esc(host.branchName(sale.branchId) || "—") +
        "</td><td><b>" + host.money(sale.total || 0) + "</b></td><td>" + points + "</td><td>" + status + "</td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Đơn của tôi</h1><p>Hóa đơn gắn với số điện thoại và hồ sơ của bạn</p></div></div>' +
      loyaltyCard(host) +
      '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Mã</th><th>Ngày</th><th>Chi nhánh</th><th>Tổng</th><th>Điểm</th><th>Trạng thái</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6"><div class="empty">Bạn chưa có hóa đơn.</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "store-order-page");
  }

  function orderView(host, modal) {
    var customer = customerOf(host);
    var sale = (host.db.sales || []).find(function (item) { return item.id === modal.id; });
    if (!sale || !customer || (sale.customerId !== customer.id && root.PharmaCustomers.normalizePhone(sale.customerPhone) !== customer.phone)) {
      return "<h3>Đơn hàng</h3><p>Không tìm thấy đơn của bạn.</p>";
    }
    var lines = (sale.lines || []).map(function (line) {
      return '<div class="cart-line"><span>' + host.esc(line.name) + " × " + line.qty + "</span><b>" + host.money(line.amount != null ? line.amount : line.price * line.qty) + "</b></div>";
    }).join("");
    return "<h3>Đơn " + host.esc(sale.code) + "</h3><p class=\"muted\">" + host.esc(host.branchName(sale.branchId) || "") + "<br/>" + host.esc(host.timeLabel(sale.at)) + "</p>" +
      lines + '<div class="total-line"><span>Tổng thanh toán</span><span>' + host.money(sale.total || 0) + "</span></div>" +
      '<div style="text-align:right"><button type="button" class="btn" data-action="close">Đóng</button></div>';
  }

  function modalBody(modal, host) {
    if (!modal || modal.type !== "store-order") return null;
    return orderView(host, modal);
  }

  function handleClick(action, el, host) {
    if (action === "store-page") {
      host.ui.storePage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "store-order-page") {
      host.ui.storeOrderPage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "open-store-order") {
      host.ui.modal = { type: "store-order", id: el.dataset.id };
      host.render();
      return true;
    }
    return false;
  }

  root.PharmaStorePages = {
    catalog: catalog,
    orders: orders,
    modalBody: modalBody,
    handleClick: handleClick,
  };
})(typeof window !== "undefined" ? window : globalThis);
