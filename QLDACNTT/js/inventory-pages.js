/* Màn hình tồn kho, kiểm kê, chuyển kho và cảnh báo. */
(function (root) {
  var TABS = [
    ["stock", "Tồn kho"],
    ["lots", "Lô thuốc"],
    ["expiry", "Hạn dùng"],
    ["count", "Kiểm kê"],
    ["move", "Chuyển kho"],
  ];
  var SHEET_STATUS = {
    draft: ["neutral", "Nháp"],
    counted: ["warn", "Đã nhập số"],
    minuted: ["warn", "Đã lập biên bản"],
    posted: ["ok", "Đã cập nhật tồn"],
    cancelled: ["bad", "Đã hủy"],
  };
  var MOVE_STATUS = {
    draft: ["neutral", "Nháp"],
    confirmed: ["ok", "Đã chuyển"],
    cancelled: ["bad", "Đã hủy"],
  };

  function inv() { return root.PharmaInventory; }

  function pill(pair) {
    return '<span class="badge-pill ' + pair[0] + '">' + pair[1] + "</span>";
  }

  function wide(user) {
    return user.role === "admin" || !!user.preview;
  }

  function scopedMeds(host) {
    var user = host.user || {};
    return (host.db.medicines || []).filter(function (med) {
      if (!wide(user)) return med.branchId === user.branchId;
      if (host.ui.branch && host.ui.branch !== "all") return med.branchId === host.ui.branch;
      return true;
    });
  }

  function branchChoices(host, openOnly) {
    var user = host.user || {};
    return (host.db.branches || []).filter(function (branch) {
      if (openOnly && branch.status !== "open") return false;
      if (!wide(user)) return branch.id === user.branchId;
      if (host.ui.branch && host.ui.branch !== "all") return branch.id === host.ui.branch;
      return true;
    });
  }

  function options(rows, selected, placeholder) {
    var html = placeholder ? '<option value="">' + placeholder + "</option>" : "";
    rows.forEach(function (row) {
      html += '<option value="' + row.value + '"' + (row.value === selected ? " selected" : "") + ">" + row.label + "</option>";
    });
    return html;
  }

  function tabs(host) {
    var current = host.ui.stockTab || "stock";
    return '<div class="chips inv-tabs">' + TABS.map(function (tab) {
      return '<button type="button" class="chip ' + (current === tab[0] ? "on" : "") + '" data-action="stock-tab" data-value="' + tab[0] + '">' + tab[1] + "</button>";
    }).join("") + "</div>";
  }

  function branchFilter(host) {
    var rows = [{ value: "all", label: "Mọi chi nhánh" }].concat(branchChoices(host, false).map(function (branch) {
      return { value: host.esc(branch.id), label: host.esc(branch.short || branch.name) };
    }));
    return '<select class="select" data-change="stock-branch">' + options(rows, host.ui.stockBranch || "all") + "</select>";
  }

  function categoryFilter(host) {
    var rows = [{ value: "all", label: "Mọi danh mục" }].concat((host.db.categories || []).map(function (category) {
      return { value: host.esc(category.id), label: host.esc(category.name) };
    }));
    return '<select class="select" data-change="stock-category">' + options(rows, host.ui.stockCategory || "all") + "</select>";
  }

  function queryOpts(host) {
    return {
      q: host.ui.qStock,
      branchId: host.ui.stockBranch || "all",
      categoryId: host.ui.stockCategory || "all",
      today: host.today,
      settings: host.db.settings,
    };
  }

  function varianceCell(value) {
    if (value == null) return "—";
    if (value === 0) return '<span class="var-zero">Khớp</span>';
    if (value > 0) return '<span class="var-pos">Thừa ' + value + "</span>";
    return '<span class="var-neg">Thiếu ' + (-value) + "</span>";
  }

  function stockList(host) {
    var listed = inv().queryStock(scopedMeds(host), Object.assign({ page: host.ui.stockPage }, queryOpts(host)));
    host.ui.stockPage = listed.page;
    var rows = listed.rows.map(function (med) {
      var check = inv().stockCheck(med);
      var flag = check.ok ? "" : '<div class="tiny var-neg">Lệch lô: tổng lô ' + check.lotSum + "</div>";
      return "<tr><td><b>" + host.esc(med.name) + "</b></td><td>" + host.esc(med.code || med.sku || "") + "</td><td>" +
        host.esc(med.category || "") + "</td><td>" + host.esc(host.branchName(med.branchId)) + "</td><td><b>" +
        (Number(med.stock) || 0) + "</b> " + host.esc(med.unit || "") + flag + "</td><td>" + (Number(med.minStock) || 0) + "</td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Tồn kho</h1><p>Tra cứu số lượng tồn theo mã, tên, chi nhánh và danh mục</p></div></div>' +
      '<div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-stock" placeholder="Tìm theo mã hoặc tên thuốc" data-input="qStock" value="' + host.esc(host.ui.qStock || "") + '" /></label>' +
      branchFilter(host) + categoryFilter(host) + "</div>" +
      '<div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Mã</th><th>Danh mục</th><th>Chi nhánh</th><th>Số lượng tồn</th><th>Tồn tối thiểu</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6"><div class="empty">Không có thuốc trong bộ lọc này</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "stock-page");
  }

  function lotList(host) {
    var listed = inv().listLots(scopedMeds(host), Object.assign({ page: host.ui.lotPage, q: host.ui.qLot, branchId: host.ui.stockBranch || "all", categoryId: host.ui.stockCategory || "all" }));
    host.ui.lotPage = listed.page;
    var rows = listed.rows.map(function (item) {
      var info = [item.strength, item.supplier, item.unit].filter(Boolean).join(" · ");
      return "<tr><td><b>" + host.esc(item.med.name) + "</b><div class=\"tiny muted\">" + host.esc(item.med.code || item.med.sku || "") + "</div></td><td>" +
        host.esc(host.branchName(item.med.branchId)) + "</td><td>" + host.esc(item.batch || "—") + "</td><td>" +
        (item.expiry ? host.dateLabel(item.expiry) : "—") + "</td><td><b>" + item.qty + "</b></td><td>" + host.esc(info || "—") + "</td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Lô thuốc trong kho</h1><p>Số lượng và thông tin từng lô</p></div></div>' +
      '<div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-lot" placeholder="Tìm theo mã hoặc tên thuốc" data-input="qLot" value="' + host.esc(host.ui.qLot || "") + '" /></label>' +
      branchFilter(host) + categoryFilter(host) + "</div>" +
      '<div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Chi nhánh</th><th>Số lô</th><th>Hạn dùng</th><th>Số lượng lô</th><th>Thông tin lô</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6"><div class="empty">Chưa có lô thuốc</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "lot-page");
  }

  function expiryList(host) {
    var nearOnly = host.ui.expiryNear !== "all";
    var listed = inv().expiryBoard(scopedMeds(host), {
      q: host.ui.qExpiry,
      branchId: host.ui.stockBranch || "all",
      categoryId: host.ui.stockCategory || "all",
      today: host.today,
      settings: host.db.settings,
      nearOnly: nearOnly,
      page: host.ui.expiryPage,
    });
    host.ui.expiryPage = listed.page;
    var rows = listed.rows.map(function (item) {
      var left = item.left == null ? "—" : (item.left < 0 ? "Quá " + (-item.left) + " ngày" : item.left + " ngày");
      return "<tr><td><b>" + host.esc(item.med.name) + "</b><div class=\"tiny muted\">" + host.esc(item.med.code || "") + "</div></td><td>" +
        host.esc(item.batch || "—") + "</td><td>" + host.esc(host.branchName(item.med.branchId)) + "</td><td>" +
        (item.expiry ? host.dateLabel(item.expiry) : "—") + "</td><td>" + left + "</td><td><b>" + item.qty + "</b></td><td>" +
        pill([item.level, item.label]) + "</td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Hạn sử dụng</h1><p>Sắp theo hạn gần nhất · mốc cảnh báo ' + listed.windowDays + " ngày · " + listed.near + " lô gần hoặc đã hết hạn</p></div></div>" +
      '<div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-expiry" placeholder="Tìm theo mã hoặc tên thuốc" data-input="qExpiry" value="' + host.esc(host.ui.qExpiry || "") + '" /></label>' +
      branchFilter(host) + categoryFilter(host) +
      '<div class="chips"><button type="button" class="chip ' + (nearOnly ? "on" : "") + '" data-action="expiry-near" data-value="near">Gần hết hạn</button>' +
      '<button type="button" class="chip ' + (!nearOnly ? "on" : "") + '" data-action="expiry-near" data-value="all">Mọi hạn</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Số lô</th><th>Chi nhánh</th><th>Hạn dùng</th><th>Còn lại</th><th>Số lượng</th><th>Tình trạng</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7"><div class="empty">Không có lô trong bộ lọc này</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "expiry-page");
  }

  function sheetStatus(status) {
    return pill(SHEET_STATUS[status] || ["neutral", status || ""]);
  }

  function visibleSheets(host) {
    var allowed = {};
    branchChoices(host, false).forEach(function (branch) { allowed[branch.id] = true; });
    var q = String(host.ui.qSheet || "").trim().toLowerCase();
    return (host.db.stocktakes || []).filter(function (sheet) {
      if (!allowed[sheet.branchId]) return false;
      if (!q) return true;
      return String(sheet.code || "").toLowerCase().indexOf(q) >= 0 || String(sheet.note || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  function countHome(host) {
    var rows = visibleSheets(host);
    var listed = root.PharmaPager.clamp(rows, host.ui.sheetPage, inv().PAGE_SIZE);
    host.ui.sheetPage = listed.page;
    var body = listed.rows.map(function (sheet) {
      return "<tr><td><b>" + host.esc(sheet.code) + "</b></td><td>" + host.esc(host.branchName(sheet.branchId)) + "</td><td>" +
        sheet.lines.length + "</td><td>" + sheetStatus(sheet.status) + "</td><td>" + host.esc(sheet.createdBy || "—") +
        "</td><td><button class=\"btn sm soft\" data-action=\"open-sheet\" data-id=\"" + host.esc(sheet.id) + "\">Mở</button></td></tr>";
    }).join("");
    var branches = branchChoices(host, true).map(function (branch) {
      return { value: host.esc(branch.id), label: host.esc(branch.name) };
    });
    var form = host.canEdit ? '<section class="card"><h3>Tạo phiếu kiểm kê</h3><div class="form-grid">' +
      '<div class="field"><div class="field-head"><span>Chi nhánh</span></div><label class="control"><select id="new-sheet-branch" data-change="sheet-branch">' +
      options(branches, host.ui.sheetBranch || (branches[0] ? branches[0].value : ""), "Chọn chi nhánh") +
      '</select></label></div><div class="field"><div class="field-head"><span>Ghi chú</span></div><label class="control"><input id="new-sheet-note" data-input="sheetNote" value="' +
      host.esc(host.ui.sheetNote || "") + '" placeholder="Kỳ kiểm kê" /></label></div></div>' +
      '<div class="action-row"><button type="button" class="btn" data-action="save-sheet">Lưu phiếu kiểm kê</button></div></section>' : "";
    return '<div class="page-head"><div><h1>Kiểm kê kho</h1><p>Lập phiếu, nhập số thực tế, ghi biên bản và chốt tồn</p></div></div>' + form +
      '<div class="toolbar" style="margin-top:14px"><label class="search">' + host.icon("search") +
      '<input id="q-sheet" placeholder="Tìm mã phiếu hoặc ghi chú" data-input="qSheet" value="' + host.esc(host.ui.qSheet || "") + '" /></label></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Phiếu</th><th>Chi nhánh</th><th>Số dòng</th><th>Trạng thái</th><th>Người lập</th><th></th></tr></thead><tbody>' +
      (body || '<tr><td colspan="6"><div class="empty">Chưa có phiếu kiểm kê</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "sheet-page");
  }

  function countDetail(host, sheet) {
    var report = inv().reconcile(sheet);
    var locked = sheet.status === "minuted" || sheet.status === "posted" || sheet.status === "cancelled";
    var lines = report.rows.map(function (line) {
      var actual = locked
        ? (line.actualQty == null ? "—" : line.actualQty)
        : '<input class="count-input" id="count-' + host.esc(line.medicineId) + '" data-count="' + host.esc(line.medicineId) + '" value="' +
          (line.actualQty == null ? "" : host.esc(line.actualQty)) + '" inputmode="numeric" />';
      var reason = "";
      if (sheet.status === "counted" && line.variance) {
        var choices = inv().REASONS.map(function (row) {
          return '<option value="' + row[0] + '"' + (line.reason === row[0] ? " selected" : "") + ">" + row[1] + "</option>";
        }).join("");
        reason = '<select class="select" data-reason="' + host.esc(line.medicineId) + '"><option value="">Chọn nguyên nhân</option>' + choices + "</select>";
      } else if (line.reason) reason = host.esc(inv().reasonName(line.reason));
      return "<tr><td><b>" + host.esc(line.name) + "</b><div class=\"tiny muted\">" + host.esc(line.code) + "</div></td><td>" +
        line.systemQty + " " + host.esc(line.unit || "") + "</td><td>" + actual + "</td><td>" + varianceCell(line.variance) + "</td><td>" + (reason || "—") + "</td></tr>";
    }).join("");
    var kpis = '<div class="inv-kpis"><article class="stat"><div class="k">Khớp</div><div class="v">' + report.matched + '</div></article>' +
      '<article class="stat"><div class="k">Thiếu</div><div class="v">' + report.shortage + '</div></article>' +
      '<article class="stat"><div class="k">Thừa</div><div class="v">' + report.surplus + "</div></article></div>";
    var actions = '<button type="button" class="btn ghost" data-action="close-sheet">Quay lại</button>';
    if (host.canEdit && !locked) actions += '<button type="button" class="btn" data-action="save-counts" data-id="' + host.esc(sheet.id) + '">Lưu số lượng kiểm kê</button>';
    if (host.canEdit && sheet.status === "counted") {
      actions += '<button type="button" class="btn" data-action="save-minute" data-id="' + host.esc(sheet.id) + '">Lưu biên bản</button>';
    }
    if (host.canEdit && sheet.status === "minuted") actions += '<button type="button" class="btn" data-action="ask-post-sheet" data-id="' + host.esc(sheet.id) + '">Cập nhật tồn</button>';
    if (host.canEdit && sheet.status !== "posted" && sheet.status !== "cancelled") {
      actions += '<button type="button" class="btn danger" data-action="ask-cancel-sheet" data-id="' + host.esc(sheet.id) + '">Hủy phiếu</button>';
    }
    var minute = "";
    if (sheet.status === "counted") {
      minute = '<section class="card"><h3>Biên bản chênh lệch</h3><p class="tiny muted">Dòng lệch cần nguyên nhân. Dòng khớp để trống.</p>' +
        '<label class="control"><textarea id="sheet-minute" rows="3" placeholder="Nội dung biên bản kiểm kê">' + host.esc(sheet.minute || "") + "</textarea></label></section>";
    } else if (sheet.minute) {
      minute = '<section class="card"><h3>Biên bản</h3><p>' + host.esc(sheet.minute) + "</p></section>";
    }
    var checks = "";
    if (sheet.checks && sheet.checks.length) {
      checks = '<section class="card"><h3>Đối chiếu sau cập nhật</h3><div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Số chốt</th><th>Tồn hệ thống</th><th>Tổng lô</th><th></th></tr></thead><tbody>' +
        sheet.checks.map(function (row) {
          return "<tr><td>" + host.esc(row.name) + "</td><td>" + row.expected + "</td><td>" + row.stock + "</td><td>" + row.lotSum + "</td><td>" +
            pill(row.ok ? ["ok", "Khớp"] : ["bad", "Lệch"]) + "</td></tr>";
        }).join("") + "</tbody></table></div></section>";
    }
    return '<div class="page-head"><div><h1>' + host.esc(sheet.code) + "</h1><p>" + host.esc(host.branchName(sheet.branchId)) +
      " · " + host.esc(sheet.note || "Không ghi chú") + "</p></div>" + sheetStatus(sheet.status) + "</div>" + kpis +
      '<div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Số hệ thống</th><th>Số thực tế</th><th>Chênh lệch</th><th>Nguyên nhân</th></tr></thead><tbody>' +
      lines + "</tbody></table></div>" + minute + checks + '<div class="action-row">' + actions + "</div>";
  }

  function countPage(host) {
    var sheet = (host.db.stocktakes || []).find(function (item) { return item.id === host.ui.sheetId; });
    return (sheet ? countDetail(host, sheet) : countHome(host));
  }

  function moveStatus(status) {
    return pill(MOVE_STATUS[status] || ["neutral", status || ""]);
  }

  function visibleMoves(host) {
    var allowed = {};
    branchChoices(host, false).forEach(function (branch) { allowed[branch.id] = true; });
    var q = String(host.ui.qMove || "").trim().toLowerCase();
    return (host.db.transfers || []).filter(function (row) {
      if (!allowed[row.fromBranchId] && !allowed[row.toBranchId]) return false;
      if (!q) return true;
      return String(row.code || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  function moveComposer(host) {
    if (!host.canEdit) return "";
    var open = branchChoices(host, true);
    var fromId = host.ui.transferFrom || (host.user && host.user.role !== "admin" ? host.user.branchId : "");
    if (fromId) host.ui.transferFrom = fromId;
    var fromRows = open.map(function (branch) { return { value: host.esc(branch.id), label: host.esc(branch.name) }; });
    var toRows = open.filter(function (branch) { return branch.id !== fromId; }).map(function (branch) {
      return { value: host.esc(branch.id), label: host.esc(branch.name) };
    });
    var meds = scopedMeds(host).filter(function (med) { return med.branchId === fromId && (Number(med.stock) || 0) > 0; });
    var medRows = meds.map(function (med) {
      return { value: host.esc(med.id), label: host.esc((med.code || "") + " · " + med.name + " (" + (Number(med.stock) || 0) + ")") };
    });
    var selected = meds.find(function (med) { return med.id === host.ui.transferMed; });
    var lots = [];
    if (selected && root.PharmaMedicines) {
      lots = root.PharmaMedicines.lotsOf(selected).filter(function (lot) { return (Number(lot.qty) || 0) > 0; });
    }
    var lotRows = [{ value: "", label: "Theo hạn gần nhất" }].concat(lots.map(function (lot) {
      return { value: host.esc(lot.batch || ""), label: host.esc((lot.batch || "Lô") + " · còn " + (Number(lot.qty) || 0)) };
    }));
    var lines = (host.ui.transferLines || []).map(function (line, index) {
      return "<tr><td>" + host.esc(line.name) + "</td><td>" + host.esc(line.batch || "Hạn gần nhất") + "</td><td>" + line.qty +
        "</td><td><button type=\"button\" class=\"btn sm ghost\" data-action=\"remove-move-line\" data-index=\"" + index + "\">Xóa</button></td></tr>";
    }).join("");
    return '<section class="card"><h3>Lập phiếu chuyển</h3><div class="form-grid">' +
      '<div class="field"><div class="field-head"><span>Chi nhánh gửi</span></div><label class="control"><select id="move-from" data-change="transfer-from">' +
      options(fromRows, fromId, "Chọn chi nhánh gửi") + "</select></label></div>" +
      '<div class="field"><div class="field-head"><span>Chi nhánh nhận</span></div><label class="control"><select id="move-to" data-change="transfer-to">' +
      options(toRows, host.ui.transferTo || "", "Chọn chi nhánh nhận") + "</select></label></div>" +
      '<div class="field"><div class="field-head"><span>Thuốc</span></div><label class="control"><select data-change="transfer-med">' +
      options(medRows, host.ui.transferMed || "", "Chọn thuốc") + "</select></label></div>" +
      '<div class="field"><div class="field-head"><span>Lô</span></div><label class="control"><select data-change="transfer-batch">' +
      options(lotRows, host.ui.transferBatch || "") + "</select></label></div>" +
      '<div class="field"><div class="field-head"><span>Số lượng</span></div><label class="control"><input id="transfer-qty" data-input="transferQty" value="' +
      host.esc(host.ui.transferQty || "") + '" inputmode="numeric" /></label></div>' +
      '<div class="field"><div class="field-head"><span>Ghi chú</span></div><label class="control"><input id="transfer-note" data-input="transferNote" value="' +
      host.esc(host.ui.transferNote || "") + '" /></label></div></div>' +
      '<div class="action-row"><button type="button" class="btn ghost" data-action="add-move-line">Thêm dòng</button>' +
      '<button type="button" class="btn" data-action="save-move">Lưu phiếu chuyển</button></div>' +
      (lines ? '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Thuốc</th><th>Lô</th><th>Số lượng</th><th></th></tr></thead><tbody>' + lines + "</tbody></table></div>" : "") +
      "</section>";
  }

  function moveHome(host) {
    var rows = visibleMoves(host);
    var listed = root.PharmaPager.clamp(rows, host.ui.movePage, inv().PAGE_SIZE);
    host.ui.movePage = listed.page;
    var body = listed.rows.map(function (row) {
      return "<tr><td><b>" + host.esc(row.code) + "</b></td><td>" + host.esc(host.branchName(row.fromBranchId)) + "</td><td>" +
        host.esc(host.branchName(row.toBranchId)) + "</td><td>" + row.lines.length + "</td><td>" + moveStatus(row.status) +
        "</td><td><button class=\"btn sm soft\" data-action=\"open-move\" data-id=\"" + host.esc(row.id) + "\">Mở</button></td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Chuyển kho</h1><p>Chuyển thuốc giữa các chi nhánh, xác nhận rồi trừ và cộng tồn</p></div></div>' +
      moveComposer(host) +
      '<div class="toolbar" style="margin-top:14px"><label class="search">' + host.icon("search") +
      '<input id="q-move" placeholder="Tìm mã phiếu chuyển" data-input="qMove" value="' + host.esc(host.ui.qMove || "") + '" /></label></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Phiếu</th><th>Gửi</th><th>Nhận</th><th>Dòng</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (body || '<tr><td colspan="6"><div class="empty">Chưa có phiếu chuyển</div></td></tr>') +
      "</tbody></table></div>" + host.pagerBar(listed, "move-page");
  }

  function moveDetail(host, transfer) {
    var plan = transfer.status === "draft" ? inv().planTransfer(host.db, transfer) : { ok: true, moves: transfer.applied || [] };
    var summary = plan.ok ? inv().summarizeMoves(plan.moves) : [];
    var planError = plan.ok ? "" : '<div class="form-error">' + host.esc(plan.message) + "</div>";
    var preview = !plan.ok ? "" : summary.map(function (row) {
      var dest = row.createDest ? "Tạo mặt hàng mới" : host.esc(row.destName || "");
      return "<tr><td><b>" + host.esc(row.name) + "</b><div class=\"tiny muted\">" + host.esc(row.batches.join(", ")) + "</div></td><td>" +
        row.qty + "</td><td>" + row.sourceBefore + " → " + row.sourceAfter + "</td><td>" + dest + "</td><td>" + row.destBefore + " → " + row.destAfter + "</td></tr>";
    }).join("");
    var checks = "";
    if (transfer.checks && transfer.checks.length) {
      checks = '<section class="card"><h3>Kiểm tra tồn sau chuyển</h3><div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Phía</th><th>Kỳ vọng</th><th>Tồn</th><th>Tổng lô</th><th></th></tr></thead><tbody>' +
        transfer.checks.map(function (row) {
          return "<tr><td>" + host.esc(row.name) + "</td><td>" + (row.role === "source" ? "Chi nhánh gửi" : "Chi nhánh nhận") + "</td><td>" +
            row.expected + "</td><td>" + row.stock + "</td><td>" + row.lotSum + "</td><td>" + pill(row.ok ? ["ok", "Khớp"] : ["bad", "Lệch"]) + "</td></tr>";
        }).join("") + "</tbody></table></div></section>";
    }
    var actions = '<button type="button" class="btn ghost" data-action="close-move">Quay lại</button>';
    if (host.canEdit && transfer.status === "draft" && plan.ok) {
      actions += '<button type="button" class="btn" data-action="ask-confirm-move" data-id="' + host.esc(transfer.id) + '">Xác nhận chuyển</button>';
    }
    if (host.canEdit && transfer.status === "draft") {
      actions += '<button type="button" class="btn danger" data-action="ask-cancel-move" data-id="' + host.esc(transfer.id) + '">Hủy phiếu</button>';
    }
    return '<div class="page-head"><div><h1>' + host.esc(transfer.code) + "</h1><p>" + host.esc(host.branchName(transfer.fromBranchId)) +
      " → " + host.esc(host.branchName(transfer.toBranchId)) + "</p></div>" + moveStatus(transfer.status) + "</div>" +
      (transfer.note ? '<p class="tiny muted">' + host.esc(transfer.note) + "</p>" : "") + planError +
      '<div class="table-wrap"><table><thead><tr><th>Thuốc</th><th>Số lượng</th><th>Tồn nơi gửi</th><th>Nơi nhận</th><th>Tồn nơi nhận</th></tr></thead><tbody>' +
      (preview || '<tr><td colspan="5"><div class="empty">Chưa có dòng chuyển</div></td></tr>') +
      "</tbody></table></div>" + checks + '<div class="action-row">' + actions + "</div>";
  }

  function movePage(host) {
    var transfer = (host.db.transfers || []).find(function (item) { return item.id === host.ui.transferId; });
    return transfer ? moveDetail(host, transfer) : moveHome(host);
  }

  function page(host) {
    inv().ensure(host.db);
    var tab = host.ui.stockTab || "stock";
    var body = tab === "lots" ? lotList(host) : tab === "expiry" ? expiryList(host) : tab === "count" ? countPage(host) : tab === "move" ? movePage(host) : stockList(host);
    return tabs(host) + body;
  }

  function alertPage(host) {
    inv().ensure(host.db);
    if (["all", "low", "under", "out", "expiry"].indexOf(host.ui.alertChip) < 0) host.ui.alertChip = "all";
    var listed = inv().collectView(scopedMeds(host), {
      settings: host.db.settings,
      today: host.today,
      chip: host.ui.alertChip || "all",
      page: host.ui.alertPage,
      db: host.db,
    });
    host.ui.alertPage = listed.page;
    var counts = listed.counts;
    var chips = [
      ["all", "Tất cả", counts.all],
      ["low", "Sắp hết", counts.low],
      ["under", "Dưới tối thiểu", counts.under],
      ["out", "Hết hàng", counts.out],
      ["expiry", "Hạn dùng", counts.expiry],
    ];
    var stockOff = host.db.settings.stockAlert === false;
    var expiryOff = host.db.settings.expiryAlert === false;
    var notes = [];
    if (stockOff) notes.push("Cảnh báo tồn kho đang tắt trong Cài đặt.");
    if (expiryOff) notes.push("Cảnh báo hạn dùng đang tắt trong Cài đặt.");
    var rows = listed.rows.map(function (row) {
      var side = row.read
        ? '<button type="button" class="btn sm danger" data-action="dismiss-alert" data-id="' + host.esc(row.id) + '">Xóa</button>'
        : '<span class="badge-pill info">Chưa đọc</span>';
      return '<article class="row-item' + (row.read ? "" : " alert-unread") + '">' +
        '<button type="button" class="alert-body" data-action="read-alert" data-id="' + host.esc(row.id) + '"><div>' +
        '<span class="badge-pill ' + row.level + '">' + host.esc(row.title) + "</span>" +
        '<div style="margin-top:6px"><b>' + host.esc(row.med.name) + "</b> · " + host.esc(host.branchName(row.med.branchId)) + "</div>" +
        '<div class="tiny muted">' + host.esc(row.text) + "</div></div></button>" + side + "</article>";
    }).join("");
    return '<div class="page-head"><div><h1>Cảnh báo</h1><p>Phân loại tồn kho và hạn dùng · mốc hạn ' + listed.windowDays + " ngày · bấm nội dung để đánh dấu đã đọc</p></div></div>" +
      '<section class="card inv-warn"><div class="field-head"><span>Khoảng thời gian cảnh báo sắp hết hạn</span></div>' +
      '<div class="inv-warn-row"><input id="warn-days" inputmode="numeric" value="' + host.esc(listed.windowDays) + '" />' +
      '<button type="button" class="btn" data-action="save-warn-days">Lưu mốc</button>' +
      '<span class="tiny muted">Mức sắp hết của từng thuốc là tồn tối thiểu. Dưới mức đó thành cảnh báo riêng.</span></div></section>' +
      (notes.length ? '<div class="note">' + notes.map(host.esc).join(" ") + "</div>" : "") +
      '<div class="chips" style="margin:14px 0">' + chips.map(function (chip) {
        return '<button type="button" class="chip ' + ((host.ui.alertChip || "all") === chip[0] ? "on" : "") + '" data-action="alert-chip" data-value="' + chip[0] + '">' +
          chip[1] + " (" + chip[2] + ")</button>";
      }).join("") + "</div>" +
      '<div class="list">' + (rows || '<div class="card empty">Không có cảnh báo trong bộ lọc này</div>') + "</div>" +
      host.pagerBar(listed, "alert-page");
  }

  function modalBody(modal, host) {
    if (!modal) return null;
    if (modal.type === "post-sheet") {
      var sheet = (host.db.stocktakes || []).find(function (item) { return item.id === modal.id; });
      if (!sheet) return "<h3>Cập nhật tồn</h3><p>Không tìm thấy phiếu.</p>";
      return "<h3>Cập nhật tồn theo " + host.esc(sheet.code) + "</h3><p>Số lượng thực tế sẽ thay thế tồn hệ thống của chi nhánh. Thao tác này chốt phiếu.</p>" +
        '<div class="action-row"><button type="button" class="btn ghost" data-action="close">Không cập nhật</button>' +
        '<button type="button" class="btn" data-action="do-post-sheet" data-id="' + host.esc(sheet.id) + '">Xác nhận cập nhật</button></div>';
    }
    if (modal.type === "cancel-sheet") {
      return "<h3>Hủy phiếu kiểm kê</h3><p>Phiếu chuyển sang trạng thái đã hủy và không còn cập nhật tồn.</p>" +
        '<div class="action-row"><button type="button" class="btn ghost" data-action="close">Giữ phiếu</button>' +
        '<button type="button" class="btn danger" data-action="do-cancel-sheet" data-id="' + host.esc(modal.id) + '">Hủy phiếu</button></div>';
    }
    if (modal.type === "confirm-move") {
      var transfer = (host.db.transfers || []).find(function (item) { return item.id === modal.id; });
      if (!transfer) return "<h3>Xác nhận chuyển</h3><p>Không tìm thấy phiếu.</p>";
      return "<h3>Xác nhận " + host.esc(transfer.code) + "</h3><p>Trừ tồn chi nhánh gửi, cộng tồn chi nhánh nhận và chuyển phiếu sang trạng thái đã chuyển.</p>" +
        '<div class="action-row"><button type="button" class="btn ghost" data-action="close">Chưa xác nhận</button>' +
        '<button type="button" class="btn" data-action="do-confirm-move" data-id="' + host.esc(transfer.id) + '">Xác nhận chuyển</button></div>';
    }
    if (modal.type === "cancel-move") {
      return "<h3>Hủy phiếu chuyển</h3><p>Phiếu nháp sẽ không còn được xác nhận.</p>" +
        '<div class="action-row"><button type="button" class="btn ghost" data-action="close">Giữ phiếu</button>' +
        '<button type="button" class="btn danger" data-action="do-cancel-move" data-id="' + host.esc(modal.id) + '">Hủy phiếu</button></div>';
    }
    return null;
  }

  function handleClick(action, el, host) {
    if (action === "stock-tab") {
      host.ui.stockTab = el.dataset.value || "stock";
      host.render();
      return true;
    }
    if (action === "stock-page" || action === "lot-page" || action === "expiry-page" || action === "sheet-page" || action === "move-page" || action === "alert-page") {
      var key = { "stock-page": "stockPage", "lot-page": "lotPage", "expiry-page": "expiryPage", "sheet-page": "sheetPage", "move-page": "movePage", "alert-page": "alertPage" }[action];
      host.ui[key] += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "expiry-near") {
      host.ui.expiryNear = el.dataset.value === "all" ? "all" : "near";
      host.ui.expiryPage = 1;
      host.render();
      return true;
    }
    if (action === "alert-chip") {
      host.ui.alertChip = el.dataset.value || "all";
      host.ui.alertPage = 1;
      host.render();
      return true;
    }
    if (action === "read-alert") {
      var read = inv().markAlertRead(host.db, el.dataset.id);
      if (!read.ok) { host.toast(read.message); return true; }
      if (read.already) return true;
      host.persist();
      host.render();
      return true;
    }
    if (action === "dismiss-alert") {
      var gone = inv().dismissAlert(host.db, el.dataset.id);
      if (!gone.ok) { host.toast(gone.message); return true; }
      host.persist();
      host.toast(gone.message);
      return true;
    }
    if (action === "save-warn-days") {
      var input = document.getElementById("warn-days");
      var saved = inv().setWarnDays(host.db.settings, input ? input.value : "");
      if (!saved.ok) { host.toast(saved.message); return true; }
      host.persist();
      host.toast(saved.message);
      return true;
    }
    if (action === "save-sheet") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var branchBox = document.getElementById("new-sheet-branch");
      var noteBox = document.getElementById("new-sheet-note");
      var created = inv().createStocktake(host.db, {
        branchId: branchBox ? branchBox.value : host.ui.sheetBranch,
        note: noteBox ? noteBox.value : host.ui.sheetNote,
        today: host.today,
        actor: host.user ? host.user.name : "",
      });
      if (!created.ok) { host.toast(created.message); return true; }
      host.ui.sheetId = created.sheet.id;
      host.ui.sheetNote = "";
      host.persist();
      host.toast(created.message);
      return true;
    }
    if (action === "open-sheet") {
      host.ui.sheetId = el.dataset.id;
      host.ui.stockTab = "count";
      host.render();
      return true;
    }
    if (action === "close-sheet") {
      host.ui.sheetId = "";
      host.render();
      return true;
    }
    if (action === "save-counts") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var sheet = (host.db.stocktakes || []).find(function (item) { return item.id === el.dataset.id; });
      var values = {};
      document.querySelectorAll("[data-count]").forEach(function (box) { values[box.getAttribute("data-count")] = box.value; });
      var counted = inv().saveCounts(sheet, values);
      if (!counted.ok) { host.toast(counted.message); return true; }
      host.persist();
      host.toast(counted.message);
      return true;
    }
    if (action === "save-minute") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var target = (host.db.stocktakes || []).find(function (item) { return item.id === el.dataset.id; });
      var reasons = {};
      document.querySelectorAll("[data-reason]").forEach(function (box) { reasons[box.getAttribute("data-reason")] = box.value; });
      var minuteBox = document.getElementById("sheet-minute");
      var minuted = inv().recordMinute(target, { minute: minuteBox ? minuteBox.value : "", reasons: reasons });
      if (!minuted.ok) { host.toast(minuted.message); return true; }
      host.persist();
      host.toast(minuted.message);
      return true;
    }
    if (action === "ask-post-sheet") {
      host.ui.modal = { type: "post-sheet", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "do-post-sheet") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var posted = inv().postStocktake(host.db, el.dataset.id);
      if (!posted.ok) { host.toast(posted.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(posted.message);
      return true;
    }
    if (action === "ask-cancel-sheet") {
      host.ui.modal = { type: "cancel-sheet", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "do-cancel-sheet") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var cancelled = inv().cancelStocktake(host.db, el.dataset.id);
      if (!cancelled.ok) { host.toast(cancelled.message); return true; }
      host.ui.modal = null;
      host.ui.sheetId = "";
      host.persist();
      host.toast(cancelled.message);
      return true;
    }
    if (action === "add-move-line") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var fromBox = document.getElementById("move-from");
      var toBox = document.getElementById("move-to");
      if (fromBox) host.ui.transferFrom = fromBox.value;
      if (toBox) host.ui.transferTo = toBox.value;
      var med = (host.db.medicines || []).find(function (item) { return item.id === host.ui.transferMed; });
      if (!med) { host.toast("Chọn thuốc cần chuyển."); return true; }
      var qtyBox = document.getElementById("transfer-qty");
      var qty = qtyBox ? qtyBox.value : host.ui.transferQty;
      if (!/^\d+$/.test(String(qty || "").trim()) || Number(qty) < 1) { host.toast("Số lượng chuyển phải là số nguyên từ 1 trở lên."); return true; }
      if (!host.ui.transferLines) host.ui.transferLines = [];
      host.ui.transferLines.push({
        medicineId: med.id,
        name: med.name,
        qty: Number(String(qty).trim()),
        batch: host.ui.transferBatch || "",
      });
      host.ui.transferQty = "";
      host.render();
      return true;
    }
    if (action === "remove-move-line") {
      var index = Number(el.dataset.index);
      host.ui.transferLines = (host.ui.transferLines || []).filter(function (_line, lineIndex) { return lineIndex !== index; });
      host.render();
      return true;
    }
    if (action === "save-move") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var fromPick = document.getElementById("move-from");
      var toPick = document.getElementById("move-to");
      if (fromPick) host.ui.transferFrom = fromPick.value;
      if (toPick) host.ui.transferTo = toPick.value;
      var made = inv().createTransfer(host.db, {
        fromBranchId: host.ui.transferFrom,
        toBranchId: host.ui.transferTo,
        lines: host.ui.transferLines || [],
        note: host.ui.transferNote,
        today: host.today,
        actor: host.user ? host.user.name : "",
      });
      if (!made.ok) { host.toast(made.message); return true; }
      host.ui.transferId = made.transfer.id;
      host.ui.transferLines = [];
      host.ui.transferQty = "";
      host.ui.transferNote = "";
      host.persist();
      host.toast(made.message);
      return true;
    }
    if (action === "open-move") {
      host.ui.transferId = el.dataset.id;
      host.ui.stockTab = "move";
      host.render();
      return true;
    }
    if (action === "close-move") {
      host.ui.transferId = "";
      host.render();
      return true;
    }
    if (action === "ask-confirm-move") {
      host.ui.modal = { type: "confirm-move", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "do-confirm-move") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var confirmed = inv().confirmTransfer(host.db, el.dataset.id);
      if (!confirmed.ok) { host.toast(confirmed.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(confirmed.message);
      return true;
    }
    if (action === "ask-cancel-move") {
      host.ui.modal = { type: "cancel-move", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "do-cancel-move") {
      if (!host.canEdit) { host.toast("Không có quyền chỉnh kho"); return true; }
      var dropped = inv().cancelTransfer(host.db, el.dataset.id);
      if (!dropped.ok) { host.toast(dropped.message); return true; }
      host.ui.modal = null;
      host.ui.transferId = "";
      host.persist();
      host.toast(dropped.message);
      return true;
    }
    return false;
  }

  function handleChange(event, host) {
    var el = event.target.closest("[data-change]");
    if (!el) return false;
    var key = el.dataset.change;
    if (key === "stock-branch") {
      host.ui.stockBranch = el.value;
      host.ui.stockPage = 1;
      host.ui.lotPage = 1;
      host.ui.expiryPage = 1;
      host.render();
      return true;
    }
    if (key === "stock-category") {
      host.ui.stockCategory = el.value;
      host.ui.stockPage = 1;
      host.ui.lotPage = 1;
      host.ui.expiryPage = 1;
      host.render();
      return true;
    }
    if (key === "sheet-branch") {
      host.ui.sheetBranch = el.value;
      return true;
    }
    if (key === "transfer-from") {
      host.ui.transferFrom = el.value;
      host.ui.transferMed = "";
      host.ui.transferBatch = "";
      host.ui.transferLines = [];
      host.render();
      return true;
    }
    if (key === "transfer-to") { host.ui.transferTo = el.value; host.render(); return true; }
    if (key === "transfer-med") { host.ui.transferMed = el.value; host.ui.transferBatch = ""; host.render(); return true; }
    if (key === "transfer-batch") { host.ui.transferBatch = el.value; return true; }
    return false;
  }

  root.PharmaInventoryPages = {
    page: page,
    alertPage: alertPage,
    modalBody: modalBody,
    handleClick: handleClick,
    handleChange: handleChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
