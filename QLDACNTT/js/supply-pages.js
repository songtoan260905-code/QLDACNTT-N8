/* Màn hình nhà cung cấp và phiếu nhập. */
(function (root) {
  function supplierPill(status) {
    if (status === "inactive") return '<span class="badge-pill neutral">Ngừng hợp tác</span>';
    return '<span class="badge-pill ok">Đang hợp tác</span>';
  }

  function receiptPill(status) {
    if (status === "confirmed") return '<span class="badge-pill ok">Đã nhập kho</span>';
    if (status === "cancelled") return '<span class="badge-pill bad">Đã hủy</span>';
    return '<span class="badge-pill warn">Nháp</span>';
  }

  function field(ctx, label, name, value, extra, type) {
    return '<div class="field ' + (extra || "") + '"><div class="field-head"><span>' + label + '</span></div><label class="control"><input name="' + name + '" type="' + ctx.esc(type || "text") + '" value="' + ctx.esc(value == null ? "" : value) + '" autocomplete="off" /></label></div>';
  }

  function selectBox(label, name, html, extra, change) {
    var attr = change ? ' data-change="' + change + '"' : "";
    return '<div class="field ' + (extra || "") + '"><div class="field-head"><span>' + label + '</span></div><label class="control"><select name="' + name + '"' + attr + ">" + html + "</select></label></div>";
  }

  function syncDraftFromForm(host) {
    var form = document.getElementById("receipt-form");
    if (!form || !host.ui.receiptDraft) return;
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    rememberHeader(host, data);
  }

  function guard(host) {
    if (host.canEdit) return true;
    host.toast("Không có quyền chỉnh nhà cung cấp hoặc phiếu nhập.");
    return false;
  }

  function openBranches(host) {
    return (host.db.branches || []).filter(function (branch) {
      if (branch.status !== "open") return false;
      if (!host.user || host.user.role === "admin") return true;
      return branch.id === host.user.branchId;
    });
  }

  function supplierPage(host) {
    var listed = root.PharmaSuppliers.query(host.db.suppliers, {
      q: host.ui.qSupplier,
      status: host.ui.supplierStatus,
      page: host.ui.supplierPage,
    });
    host.ui.supplierPage = listed.page;
    var filters = [["all", "Tất cả"], ["active", "Đang hợp tác"], ["inactive", "Ngừng hợp tác"]];
    var rows = listed.rows.map(function (item) {
      var next = item.status === "inactive" ? "active" : "inactive";
      var actions = ['<button class="btn sm soft" data-action="open-supplier" data-id="' + host.esc(item.id) + '">Chi tiết</button>'];
      if (host.canEdit) {
        actions.push('<button class="btn sm ghost" data-action="edit-supplier" data-id="' + host.esc(item.id) + '">Sửa</button>');
        actions.push('<button class="btn sm ghost" data-action="supplier-contact" data-id="' + host.esc(item.id) + '">Liên hệ</button>');
        actions.push('<button class="btn sm ghost" data-action="supplier-status" data-id="' + host.esc(item.id) + '" data-next="' + next + '">' + (next === "inactive" ? "Ngừng hợp tác" : "Mở lại") + "</button>");
        actions.push('<button class="btn sm danger" data-action="delete-supplier" data-id="' + host.esc(item.id) + '">Xóa</button>');
      }
      var sub = host.esc(item.code) + (item.contact ? " · " + host.esc(item.contact) : "");
      return '<article class="med-row"><div class="med-main"><div class="med-head"><b>' + host.esc(item.name) + "</b>" + supplierPill(item.status) + '</div><div class="tiny muted">' + sub + '</div><dl class="med-facts"><div><dt>Điện thoại</dt><dd>' + host.esc(item.phone || "—") + "</dd></div><div><dt>Email</dt><dd>" + host.esc(item.email || "—") + "</dd></div><div><dt>Địa chỉ</dt><dd>" + host.esc(item.address || "—") + '</dd></div></dl></div><div class="action-row med-actions">' + actions.join("") + "</div></article>";
    }).join("");
    return '<div class="page-head"><div><h1>Nhà cung cấp</h1><p>' + listed.total + ' nhà cung cấp</p></div>' +
      (host.canEdit ? '<button class="btn" data-action="edit-supplier">' + host.icon("plus") + " Thêm nhà cung cấp</button>" : "") +
      '</div><div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-supplier" placeholder="Tên, mã, điện thoại, email hoặc địa chỉ" data-input="qSupplier" value="' + host.esc(host.ui.qSupplier || "") + '" /></label><div class="chips">' +
      filters.map(function (pair) {
        return '<button class="chip ' + (host.ui.supplierStatus === pair[0] ? "on" : "") + '" data-action="supplier-filter" data-value="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("") +
      '</div></div><div class="med-list">' +
      (rows || '<div class="empty">Chưa có nhà cung cấp khớp bộ lọc.</div>') +
      "</div>" + host.pagerBar(listed, "supplier-page");
  }

  function supplierOptions(host, selected) {
    var rows = (host.db.suppliers || []).filter(function (item) {
      return item.status !== "inactive" || item.id === selected;
    });
    var html = '<option value="">Chọn nhà cung cấp</option>';
    rows.forEach(function (item) {
      var mark = item.status === "inactive" ? " (ngừng hợp tác)" : "";
      html += '<option value="' + host.esc(item.id) + '" ' + (item.id === selected ? "selected" : "") + ">" + host.esc(item.name + mark) + "</option>";
    });
    return html;
  }

  function branchOptions(host, selected) {
    var rows = openBranches(host);
    if (selected && !rows.some(function (item) { return item.id === selected; })) {
      var current = (host.db.branches || []).find(function (item) { return item.id === selected; });
      if (current) rows = [current].concat(rows);
    }
    var html = '<option value="">Chọn chi nhánh</option>';
    rows.forEach(function (item) {
      html += '<option value="' + host.esc(item.id) + '" ' + (item.id === selected ? "selected" : "") + ">" + host.esc(item.name) + "</option>";
    });
    return html;
  }

  function receiptEditor(host) {
    var draft = host.ui.receiptDraft;
    var branches = openBranches(host);
    if (!host.db.suppliers.length) {
      return '<div class="card empty"><h3>Chưa có nhà cung cấp</h3><p>Hãy thêm nhà cung cấp trước khi lập phiếu nhập.</p><button class="btn" data-action="go" data-path="nha-cung-cap">Tới nhà cung cấp</button></div>';
    }
    if (!branches.length) {
      return '<div class="card empty"><h3>Chưa có chi nhánh đang mở</h3><p>Phiếu nhập chỉ gắn vào chi nhánh đang hoạt động.</p></div>';
    }
    var meds = (host.db.medicines || []).filter(function (med) {
      if (!draft.branchId || med.branchId !== draft.branchId) return false;
      var blob = [med.name, med.code, med.sku, med.activeIngredient].join(" ").toLowerCase();
      var parts = String(host.ui.qReceiptMed || "").toLowerCase().split(/\s+/).filter(Boolean);
      return parts.every(function (part) { return blob.indexOf(part) >= 0; });
    }).slice(0, 6);
    var picks = meds.map(function (med) {
      return '<div class="row-item"><div><b>' + host.esc(med.name) + "</b><div class=\"tiny muted\">" + host.esc(med.code || med.sku || "") + " · tồn " + med.stock + " " + host.esc(med.unit || "") + "</div></div><button type=\"button\" class=\"btn sm\" data-action=\"add-receipt-line\" data-id=\"" + host.esc(med.id) + "\">Thêm</button></div>";
    }).join("");
    var lines = (draft.lines || []).map(function (line) {
      var amount = root.PharmaReceipts.amountOf(line);
      return "<tr><td><b>" + host.esc(line.name) + "</b><div class=\"tiny muted\">" + host.esc(line.unit || "") + "</div></td>" +
        '<td><input class="cell-input" id="ln-qty-' + host.esc(line.key) + '" data-line="' + host.esc(line.key) + '" data-field="qty" inputmode="numeric" value="' + host.esc(line.qty) + '" /></td>' +
        '<td><input class="cell-input" id="ln-cost-' + host.esc(line.key) + '" data-line="' + host.esc(line.key) + '" data-field="cost" inputmode="numeric" value="' + host.esc(line.cost) + '" /></td>' +
        '<td><input class="cell-input" id="ln-batch-' + host.esc(line.key) + '" data-line="' + host.esc(line.key) + '" data-field="batch" value="' + host.esc(line.batch) + '" /></td>' +
        '<td><input class="cell-input" id="ln-exp-' + host.esc(line.key) + '" data-line="' + host.esc(line.key) + '" data-field="expiry" type="date" value="' + host.esc(line.expiry) + '" /></td>' +
        "<td><b>" + (amount == null ? "—" : host.money(amount)) + '</b></td><td><button type="button" class="btn sm ghost" data-action="remove-receipt-line" data-key="' + host.esc(line.key) + '">Xóa</button></td></tr>';
    }).join("");
    var summary = root.PharmaReceipts.totalOf(draft.lines);
    return '<div class="page-head"><div><h1>' + (draft.id ? "Sửa phiếu nhập" : "Tạo phiếu nhập") + '</h1><p>Chọn nhà cung cấp, chi nhánh rồi thêm thuốc, số lượng, giá nhập, số lô và hạn dùng.</p></div><button class="btn ghost" data-action="receipt-back">Quay lại danh sách</button></div>' +
      '<form id="receipt-form" data-form="receipt" class="card"><input type="hidden" name="id" value="' + host.esc(draft.id || "") + '" /><div class="form-grid">' +
      selectBox("Nhà cung cấp", "supplierId", supplierOptions(host, draft.supplierId), "", "receipt-header") +
      selectBox("Chi nhánh nhập", "branchId", branchOptions(host, draft.branchId), "", "receipt-header") +
      field(host, "Ghi chú", "note", draft.note || "", "full") +
      '</div></form>' +
      '<section class="card" style="margin-top:14px"><h3>Thêm thuốc</h3><label class="search">' + host.icon("search") +
      '<input id="q-receipt-med" placeholder="Tên thuốc, mã hoặc hoạt chất" data-input="qReceiptMed" value="' + host.esc(host.ui.qReceiptMed || "") + '" /></label>' +
      '<div class="list" style="margin-top:10px">' + (draft.branchId ? (picks || '<div class="empty">Không có thuốc khớp tại chi nhánh này.</div>') : '<div class="empty">Hãy chọn chi nhánh trước khi tìm thuốc.</div>') + "</div></section>" +
      '<section class="card supply-lines" style="margin-top:14px"><h3>Chi tiết phiếu</h3><div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Số lượng</th><th>Giá nhập</th><th>Số lô</th><th>Hạn dùng</th><th>Thành tiền</th><th></th></tr></thead><tbody>' +
      (lines || '<tr><td colspan="7"><div class="empty">Chưa thêm thuốc vào phiếu.</div></td></tr>') +
      '</tbody></table></div><div class="total-line"><span>Tổng tiền phiếu nhập</span><span>' + (summary.ready ? host.money(summary.total) : "Chưa đủ số lượng hoặc giá") + '</span></div><p class="tiny muted">Thành tiền từng thuốc bằng số lượng nhân giá nhập. Tổng phiếu là cộng các dòng.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="receipt-back">Hủy</button><button class="btn" type="submit" form="receipt-form">Lưu phiếu nhập</button></div></section>';
  }

  function receiptPage(host) {
    if (host.ui.receiptDraft) return receiptEditor(host);
    var branchId = host.user && host.user.role === "admin" ? (host.ui.receiptBranch || "all") : (host.user ? host.user.branchId : "all");
    var listed = root.PharmaReceipts.query(host.db.receipts, {
      q: host.ui.qReceipt,
      status: host.ui.receiptStatus,
      branchId: branchId,
      page: host.ui.receiptPage,
      suppliers: host.db.suppliers,
    });
    host.ui.receiptPage = listed.page;
    var filters = [["all", "Tất cả"], ["draft", "Nháp"], ["confirmed", "Đã nhập kho"], ["cancelled", "Đã hủy"]];
    var branchFilter = "";
    if (host.user && host.user.role === "admin") {
      branchFilter = '<label class="control"><select data-change="receipt-branch-filter"><option value="all">Mọi chi nhánh</option>' +
        (host.db.branches || []).map(function (branch) {
          return '<option value="' + host.esc(branch.id) + '" ' + (host.ui.receiptBranch === branch.id ? "selected" : "") + ">" + host.esc(branch.short || branch.name) + "</option>";
        }).join("") + "</select></label>";
    }
    var rows = listed.rows.map(function (item) {
      var supplier = root.PharmaSuppliers.byId(host.db, item.supplierId);
      var actions = ['<button class="btn sm soft" data-action="open-receipt" data-id="' + host.esc(item.id) + '">Chi tiết</button>'];
      if (host.canEdit && item.status === "draft") {
        actions.push('<button class="btn sm ghost" data-action="edit-receipt" data-id="' + host.esc(item.id) + '">Sửa</button>');
        actions.push('<button class="btn sm" data-action="ask-confirm-receipt" data-id="' + host.esc(item.id) + '">Xác nhận</button>');
        actions.push('<button class="btn sm danger" data-action="cancel-receipt" data-id="' + host.esc(item.id) + '">Hủy phiếu</button>');
      } else if (host.canEdit && item.status === "confirmed") {
        actions.push('<button class="btn sm danger" data-action="cancel-receipt" data-id="' + host.esc(item.id) + '">Hủy phiếu</button>');
      }
      return "<tr><td><b>" + host.esc(item.code) + "</b></td><td>" + host.timeLabel(item.at) + "</td><td>" + host.esc(supplier ? supplier.name : "—") + "</td><td>" + host.esc(host.branchName(item.branchId) || "—") + "</td><td>" + (item.lines || []).length + "</td><td><b>" + host.money(item.total) + "</b></td><td>" + receiptPill(item.status) + '</td><td><div class="action-row">' + actions.join("") + "</div></td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Nhập hàng</h1><p>' + listed.total + ' phiếu nhập trong phạm vi bạn đang xem</p></div>' +
      (host.canEdit ? '<button class="btn" data-action="new-receipt">' + host.icon("plus") + " Tạo phiếu nhập</button>" : "") +
      '</div><div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-receipt" placeholder="Mã phiếu, nhà cung cấp hoặc ghi chú" data-input="qReceipt" value="' + host.esc(host.ui.qReceipt || "") + '" /></label>' +
      branchFilter + '<div class="chips">' + filters.map(function (pair) {
        return '<button class="chip ' + (host.ui.receiptStatus === pair[0] ? "on" : "") + '" data-action="receipt-filter" data-value="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("") + '</div></div><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Ngày</th><th>Nhà cung cấp</th><th>Chi nhánh</th><th>Số thuốc</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="8"><div class="empty">Chưa có phiếu nhập khớp bộ lọc.</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "receipt-page");
  }

  function supplierForm(host, modal) {
    var found = modal.id ? root.PharmaSuppliers.byId(host.db, modal.id) : null;
    var draft = Object.assign({ name: "", phone: "", email: "", address: "", contact: "", taxCode: "", note: "", status: "active" }, found || {}, modal.draft || {});
    return "<h3>" + (found ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp") + '</h3><form data-form="supplier"><input type="hidden" name="id" value="' + host.esc(modal.id || "") + '" /><div class="form-grid">' +
      field(host, "Tên nhà cung cấp", "name", draft.name, "full") +
      field(host, "Người liên hệ", "contact", draft.contact) +
      field(host, "Điện thoại", "phone", draft.phone) +
      field(host, "Email", "email", draft.email, "", "email") +
      field(host, "Mã số thuế", "taxCode", draft.taxCode) +
      '<div class="field"><div class="field-head"><span>Trạng thái</span></div><label class="control"><select name="status"><option value="active" ' + (draft.status !== "inactive" ? "selected" : "") + '>Đang hợp tác</option><option value="inactive" ' + (draft.status === "inactive" ? "selected" : "") + ">Ngừng hợp tác</option></select></label></div>" +
      field(host, "Địa chỉ", "address", draft.address, "full") +
      field(host, "Ghi chú", "note", draft.note, "full") +
      '</div><p class="tiny muted">Điện thoại 10–11 số. Mã số thuế để trống hoặc gồm 10 hay 13 chữ số.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu</button></div></form>';
  }

  function supplierView(host, modal) {
    var supplier = root.PharmaSuppliers.byId(host.db, modal.id);
    if (!supplier) return "<h3>Nhà cung cấp</h3><p>Không tìm thấy nhà cung cấp.</p>";
    var check = root.PharmaSuppliers.inspect(supplier);
    var history = root.PharmaSuppliers.history(host.db.receipts, supplier.id);
    var rows = [
      ["Mã", supplier.code],
      ["Người liên hệ", supplier.contact || "—"],
      ["Điện thoại", supplier.phone],
      ["Email", supplier.email || "—"],
      ["Địa chỉ", supplier.address],
      ["Mã số thuế", supplier.taxCode || "—"],
      ["Ghi chú", supplier.note || "—"],
    ];
    var historyRows = history.map(function (item) {
      return "<tr><td><b>" + host.esc(item.code) + "</b></td><td>" + host.timeLabel(item.at) + "</td><td>" + host.esc(host.branchName(item.branchId) || "—") + "</td><td>" + host.money(item.total) + "</td><td>" + receiptPill(item.status) + '</td><td><button class="btn sm ghost" data-action="open-receipt" data-id="' + host.esc(item.id) + '">Xem</button></td></tr>';
    }).join("");
    return "<h3>" + host.esc(supplier.name) + " " + supplierPill(supplier.status) + '</h3><dl class="detail-grid">' +
      rows.map(function (pair) { return "<dt>" + pair[0] + "</dt><dd>" + host.esc(pair[1]) + "</dd>"; }).join("") +
      "</dl>" + (check.ok ? '<p class="note">Thông tin liên hệ đủ để đặt hàng.</p>' : '<p class="note">Thiếu dữ liệu: ' + host.esc(check.missing.join(", ")) + ".</p>") +
      "<h3>Lịch sử nhập hàng</h3><div class=\"table-wrap\"><table><thead><tr><th>Phiếu</th><th>Ngày</th><th>Chi nhánh</th><th>Tổng</th><th>Trạng thái</th><th></th></tr></thead><tbody>" +
      (historyRows || '<tr><td colspan="6"><div class="empty">Chưa có phiếu nhập từ nhà cung cấp này.</div></td></tr>') +
      '</tbody></table></div><div class="action-row" style="margin-top:12px;justify-content:flex-end">' +
      (host.canEdit ? '<button class="btn ghost" data-action="edit-supplier" data-id="' + host.esc(supplier.id) + '">Sửa</button><button class="btn ghost" data-action="supplier-contact" data-id="' + host.esc(supplier.id) + '">Liên hệ</button>' : "") +
      '<button class="btn" data-action="close">Đóng</button></div>';
  }

  function contactForm(host, modal) {
    var supplier = root.PharmaSuppliers.byId(host.db, modal.id);
    if (!supplier) return "";
    var draft = Object.assign({}, supplier, modal.draft || {});
    return "<h3>Liên hệ " + host.esc(supplier.name) + '</h3><form data-form="supplier-contact"><input type="hidden" name="id" value="' + host.esc(supplier.id) + '" /><div class="form-grid">' +
      field(host, "Điện thoại", "phone", draft.phone) +
      field(host, "Email", "email", draft.email, "", "email") +
      field(host, "Địa chỉ", "address", draft.address, "full") +
      '</div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu liên hệ</button></div></form>';
  }

  function receiptView(host, modal) {
    var receipt = root.PharmaReceipts.byId(host.db, modal.id);
    if (!receipt) return "<h3>Phiếu nhập</h3><p>Không tìm thấy phiếu nhập.</p>";
    var supplier = root.PharmaSuppliers.byId(host.db, receipt.supplierId);
    var rows = (receipt.lines || []).map(function (line) {
      var stock = line.stockAfter != null ? line.stockBefore + " → " + line.stockAfter : "—";
      return "<tr><td><b>" + host.esc(line.name) + "</b></td><td>" + line.qty + " " + host.esc(line.unit || "") + "</td><td>" + host.money(line.cost) + "</td><td>" + host.esc(line.batch) + "</td><td>" + host.dateLabel(line.expiry) + "</td><td>" + host.money(line.amount) + "</td><td>" + host.esc(stock) + "</td></tr>";
    }).join("");
    var actions = "";
    if (host.canEdit && receipt.status === "draft") {
      actions = '<button class="btn ghost" data-action="edit-receipt" data-id="' + host.esc(receipt.id) + '">Sửa</button><button class="btn" data-action="ask-confirm-receipt" data-id="' + host.esc(receipt.id) + '">Xác nhận nhập</button><button class="btn danger" data-action="cancel-receipt" data-id="' + host.esc(receipt.id) + '">Hủy phiếu</button>';
    } else if (host.canEdit && receipt.status === "confirmed") {
      actions = '<button class="btn danger" data-action="cancel-receipt" data-id="' + host.esc(receipt.id) + '">Hủy phiếu</button>';
    }
    return "<h3>Phiếu " + host.esc(receipt.code) + " " + receiptPill(receipt.status) + "</h3><dl class=\"detail-grid\">" +
      "<dt>Nhà cung cấp</dt><dd>" + host.esc(supplier ? supplier.name : "—") + "</dd>" +
      "<dt>Chi nhánh</dt><dd>" + host.esc(host.branchName(receipt.branchId) || "—") + "</dd>" +
      "<dt>Người lập</dt><dd>" + host.esc(receipt.createdBy || "—") + "</dd>" +
      "<dt>Ngày lập</dt><dd>" + host.timeLabel(receipt.at) + "</dd>" +
      "<dt>Ghi chú</dt><dd>" + host.esc(receipt.note || "—") + "</dd></dl>" +
      "<h3>Danh sách thuốc</h3><div class=\"table-wrap\"><table><thead><tr><th>Thuốc</th><th>Số lượng</th><th>Giá nhập</th><th>Số lô</th><th>Hạn dùng</th><th>Thành tiền</th><th>Tồn sau nhập</th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="7"><div class="empty">Phiếu chưa có thuốc.</div></td></tr>') +
      '</tbody></table></div><div class="total-line"><span>Tổng tiền</span><span>' + host.money(receipt.total) + '</span></div><div class="action-row" style="justify-content:flex-end">' +
      actions + '<button class="btn ghost" data-action="close">Đóng</button></div>';
  }

  function modalBody(modal, host) {
    if (!modal) return null;
    if (modal.type === "supplier") return supplierForm(host, modal);
    if (modal.type === "supplier-view") return supplierView(host, modal);
    if (modal.type === "supplier-contact") return contactForm(host, modal);
    if (modal.type === "delete-supplier") {
      var supplier = root.PharmaSuppliers.byId(host.db, modal.id);
      if (!supplier) return "";
      var count = root.PharmaSuppliers.receiptCount(host.db.receipts, supplier.id);
      var extra = count ? "Đang có " + count + " phiếu nhập nên chưa xóa được." : "Nhà cung cấp chưa phát sinh phiếu nhập.";
      return "<h3>Xóa nhà cung cấp</h3><p>Xóa <b>" + host.esc(supplier.name) + "</b>? " + extra + '</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>' +
        (count ? "" : '<button type="button" class="btn danger" data-action="confirm-delete-supplier" data-id="' + host.esc(supplier.id) + '">Xóa nhà cung cấp</button>') + "</div>";
    }
    if (modal.type === "receipt-view") return receiptView(host, modal);
    if (modal.type === "cancel-receipt") {
      var receipt = root.PharmaReceipts.byId(host.db, modal.id);
      if (!receipt) return "";
      var warn = receipt.status === "confirmed" ? " Phiếu đã cộng tồn kho. Hủy sẽ trừ lại số lượng đã nhập nếu kho còn đủ." : " Phiếu nháp sẽ chuyển sang trạng thái đã hủy.";
      return "<h3>Hủy phiếu nhập</h3><p>Hủy phiếu <b>" + host.esc(receipt.code) + "</b>?" + warn + '</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Không</button><button type="button" class="btn danger" data-action="confirm-cancel-receipt" data-id="' + host.esc(receipt.id) + '">Xác nhận hủy</button></div>';
    }
    if (modal.type === "confirm-receipt") {
      var pending = root.PharmaReceipts.byId(host.db, modal.id);
      if (!pending) return "";
      var plan = root.PharmaReceipts.prepare(host.db, pending, host.today);
      if (!plan.ok) {
        return "<h3>Xác nhận nhập hàng</h3><p>" + host.esc(plan.message) + '</p><div style="text-align:right"><button class="btn" data-action="close">Đóng</button></div>';
      }
      var preview = plan.rows.map(function (row) {
        return "<tr><td>" + host.esc(row.name) + "</td><td>" + row.qty + "</td><td>" + host.esc(row.batch) + "</td><td>" + row.before + " → <b>" + row.after + "</b></td></tr>";
      }).join("");
      return "<h3>Xác nhận nhập hàng</h3><p>Nhận phiếu <b>" + host.esc(pending.code) + "</b> sẽ cộng tồn kho các dòng dưới đây.</p><div class=\"table-wrap\"><table><thead><tr><th>Thuốc</th><th>Số lượng nhập</th><th>Số lô</th><th>Tồn kho mới</th></tr></thead><tbody>" +
        preview + '</tbody></table></div><div class="total-line"><span>Tổng tiền</span><span>' + host.money(pending.total) + '</span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button type="button" class="btn" data-action="do-confirm-receipt" data-id="' + host.esc(pending.id) + '">Xác nhận nhận hàng</button></div>';
    }
    return null;
  }

  function rememberHeader(host, data) {
    var draft = host.ui.receiptDraft;
    if (!draft) return;
    if (data.supplierId != null) draft.supplierId = data.supplierId;
    if (data.branchId != null) draft.branchId = data.branchId;
    if (data.note != null) draft.note = data.note;
  }

  function handleSubmit(kind, data, host) {
    if (kind === "supplier") {
      if (!guard(host)) return true;
      var saved = root.PharmaSuppliers.save(host.db, data);
      if (!saved.ok) {
        if (host.ui.modal) host.ui.modal.draft = data;
        host.toast(saved.message);
        return true;
      }
      host.ui.modal = null;
      host.persist();
      host.toast(saved.message);
      return true;
    }
    if (kind === "supplier-contact") {
      if (!guard(host)) return true;
      var supplier = root.PharmaSuppliers.byId(host.db, data.id);
      var contact = root.PharmaSuppliers.applyContact(supplier, data);
      if (!contact.ok) {
        if (host.ui.modal) host.ui.modal.draft = data;
        host.toast(contact.message);
        return true;
      }
      host.ui.modal = null;
      host.persist();
      host.toast(contact.message);
      return true;
    }
    if (kind === "receipt") {
      if (!guard(host)) return true;
      rememberHeader(host, data);
      var stored = root.PharmaReceipts.save(host.db, host.ui.receiptDraft, host.user, host.today);
      if (!stored.ok) {
        host.toast(stored.message);
        return true;
      }
      host.ui.receiptDraft = null;
      host.persist();
      host.toast(stored.message);
      return true;
    }
    return false;
  }

  function handleClick(action, el, host) {
    var id = el.dataset.id;
    if (action === "edit-supplier") {
      if (!guard(host)) return true;
      host.ui.modal = { type: "supplier", id: id || null };
      host.render();
      return true;
    }
    if (action === "open-supplier") {
      host.ui.modal = { type: "supplier-view", id: id };
      host.render();
      return true;
    }
    if (action === "supplier-contact") {
      if (!guard(host)) return true;
      host.ui.modal = { type: "supplier-contact", id: id };
      host.render();
      return true;
    }
    if (action === "supplier-status") {
      if (!guard(host)) return true;
      var changed = root.PharmaSuppliers.setStatus(root.PharmaSuppliers.byId(host.db, id), el.dataset.next);
      if (!changed.ok) { host.toast(changed.message); return true; }
      host.persist();
      host.toast(changed.message);
      return true;
    }
    if (action === "delete-supplier") {
      if (!guard(host)) return true;
      host.ui.modal = { type: "delete-supplier", id: id };
      host.render();
      return true;
    }
    if (action === "confirm-delete-supplier") {
      if (!guard(host)) return true;
      var removed = root.PharmaSuppliers.remove(host.db, id);
      if (!removed.ok) { host.toast(removed.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(removed.message);
      return true;
    }
    if (action === "supplier-filter") {
      host.ui.supplierStatus = el.dataset.value;
      host.ui.supplierPage = 1;
      host.render();
      return true;
    }
    if (action === "supplier-page") {
      host.ui.supplierPage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "new-receipt") {
      if (!guard(host)) return true;
      var branchId = host.user && host.user.role !== "admin" ? host.user.branchId : "";
      host.ui.receiptDraft = root.PharmaReceipts.blank(branchId);
      host.ui.qReceiptMed = "";
      host.render();
      return true;
    }
    if (action === "edit-receipt") {
      if (!guard(host)) return true;
      var receipt = root.PharmaReceipts.byId(host.db, id);
      if (!receipt) { host.toast("Không tìm thấy phiếu nhập."); return true; }
      if (receipt.status !== "draft") { host.toast("Chỉ sửa phiếu đang nháp."); return true; }
      host.ui.receiptDraft = root.PharmaReceipts.toDraft(receipt);
      host.ui.modal = null;
      host.ui.qReceiptMed = "";
      host.render();
      return true;
    }
    if (action === "open-receipt") {
      host.ui.modal = { type: "receipt-view", id: id };
      host.render();
      return true;
    }
    if (action === "receipt-back") {
      host.ui.receiptDraft = null;
      host.render();
      return true;
    }
    if (action === "add-receipt-line") {
      syncDraftFromForm(host);
      var med = (host.db.medicines || []).find(function (item) { return item.id === id; });
      var added = root.PharmaReceipts.addLine(host.ui.receiptDraft, med);
      if (!added.ok) { host.toast(added.message); return true; }
      host.render();
      return true;
    }
    if (action === "remove-receipt-line") {
      syncDraftFromForm(host);
      if (!host.ui.receiptDraft) return true;
      host.ui.receiptDraft.lines = host.ui.receiptDraft.lines.filter(function (line) { return line.key !== el.dataset.key; });
      host.render();
      return true;
    }
    if (action === "cancel-receipt") {
      if (!guard(host)) return true;
      host.ui.modal = { type: "cancel-receipt", id: id };
      host.render();
      return true;
    }
    if (action === "confirm-cancel-receipt") {
      if (!guard(host)) return true;
      var cancelled = root.PharmaReceipts.cancel(host.db, id);
      if (!cancelled.ok) { host.toast(cancelled.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(cancelled.message);
      return true;
    }
    if (action === "ask-confirm-receipt") {
      if (!guard(host)) return true;
      host.ui.modal = { type: "confirm-receipt", id: id };
      host.render();
      return true;
    }
    if (action === "do-confirm-receipt") {
      if (!guard(host)) return true;
      var confirmed = root.PharmaReceipts.confirm(host.db, id, host.today);
      if (!confirmed.ok) { host.toast(confirmed.message); return true; }
      host.ui.modal = { type: "receipt-view", id: id };
      host.persist();
      host.toast(confirmed.message);
      return true;
    }
    if (action === "receipt-filter") {
      host.ui.receiptStatus = el.dataset.value;
      host.ui.receiptPage = 1;
      host.render();
      return true;
    }
    if (action === "receipt-page") {
      host.ui.receiptPage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    return false;
  }

  function handleInput(event, host) {
    if (host.ui.receiptDraft) syncDraftFromForm(host);
    var el = event.target.closest("[data-line]");
    if (!el || !host.ui.receiptDraft) return false;
    var line = host.ui.receiptDraft.lines.find(function (item) { return item.key === el.dataset.line; });
    if (!line) return false;
    line[el.dataset.field] = el.value;
    host.state._focus = el.id;
    host.state._pos = null;
    if (el.type !== "date") {
      try { host.state._pos = el.selectionStart; } catch (err) { host.state._pos = null; }
    }
    host.render();
    return true;
  }

  function handleChange(event, host) {
    var el = event.target.closest("[data-change]");
    if (!el) return false;
    if (el.dataset.change === "receipt-branch-filter") {
      host.ui.receiptBranch = el.value;
      host.ui.receiptPage = 1;
      host.render();
      return true;
    }
    if (el.dataset.change === "receipt-header") {
      var previous = host.ui.receiptDraft ? host.ui.receiptDraft.branchId : "";
      syncDraftFromForm(host);
      if (host.ui.receiptDraft && host.ui.receiptDraft.branchId !== previous) {
        host.ui.receiptDraft.lines = (host.ui.receiptDraft.lines || []).filter(function (line) {
          var med = (host.db.medicines || []).find(function (item) { return item.id === line.medicineId; });
          return med && med.branchId === host.ui.receiptDraft.branchId;
        });
      }
      host.render();
      return true;
    }
    return false;
  }

  root.PharmaSupplyPages = {
    supplierPage: supplierPage,
    receiptPage: receiptPage,
    modalBody: modalBody,
    handleSubmit: handleSubmit,
    handleClick: handleClick,
    handleInput: handleInput,
    handleChange: handleChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
