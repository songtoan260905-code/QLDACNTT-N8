/* Màn hình báo cáo doanh thu, bán hàng, nhập hàng và tồn. */
(function (root) {
  var TABS = [
    ["day", "Theo ngày"],
    ["month", "Theo tháng"],
    ["branch", "Theo chi nhánh"],
    ["staff", "Theo nhân viên"],
    ["qty", "Số lượng bán"],
    ["hot", "Bán chạy"],
    ["import", "Nhập hàng"],
    ["stock", "Tồn kho"],
    ["expiry", "Sắp hết hạn"],
    ["low", "Dưới tối thiểu"],
  ];
  var COPY = {
    day: "Chọn một ngày, tính tổng doanh thu và xem hóa đơn trong ngày",
    month: "Chọn tháng, tổng hợp doanh thu theo từng ngày bằng biểu đồ và bảng",
    branch: "Chọn chi nhánh cần xem, rồi so sánh doanh thu với các chi nhánh còn lại",
    staff: "Chọn nhân viên để tổng hợp doanh thu và hóa đơn trong tháng",
    qty: "Tổng hợp số lượng đã bán và phân loại theo từng thuốc",
    hot: "Chọn tiêu chí bán chạy, sắp xếp và xem danh sách thuốc",
    import: "Tổng hợp phiếu nhập đã xác nhận và tính tổng tiền nhập",
    stock: "Tổng hợp số lượng tồn và giá trị, phân loại theo chi nhánh",
    expiry: "Lọc lô gần hoặc đã hết hạn, sắp theo ngày hết hạn",
    low: "Đối chiếu tồn với mức tối thiểu và liệt kê thuốc cần bổ sung",
  };

  function reports() { return root.PharmaReports; }

  function ready(host) {
    if (!host.ui.reportDate) host.ui.reportDate = host.today;
    if (!host.ui.reportMonth) host.ui.reportMonth = String(host.today || "").slice(0, 7);
    if (!host.ui.reportTab) host.ui.reportTab = "day";
    if (!host.ui.reportBranch) host.ui.reportBranch = "all";
    if (!host.ui.reportStaff) host.ui.reportStaff = "all";
    if (!host.ui.reportHot) host.ui.reportHot = "qty";
    if (!host.ui.reportLimit) host.ui.reportLimit = "10";
    if (!host.ui.reportDays) host.ui.reportDays = "30";
  }

  function branchLabel(host, id) {
    var branch = (host.db.branches || []).find(function (item) { return item.id === id; });
    if (!branch) return "—";
    return branch.short || branch.name || "—";
  }

  function tabs(host) {
    var current = host.ui.reportTab || "day";
    return '<div class="chips report-tabs">' + TABS.map(function (tab) {
      return '<button type="button" class="chip ' + (current === tab[0] ? "on" : "") + '" data-action="report-tab" data-value="' + tab[0] + '">' + tab[1] + "</button>";
    }).join("") + "</div>";
  }

  function branchSelect(host) {
    var user = host.user || {};
    if (user.role !== "admin") {
      return '<span class="badge-pill info">' + host.esc(branchLabel(host, user.branchId)) + "</span>";
    }
    var html = '<option value="all"' + (host.ui.reportBranch === "all" ? " selected" : "") + ">Mọi chi nhánh</option>";
    (host.db.branches || []).forEach(function (branch) {
      html += '<option value="' + host.esc(branch.id) + '"' + (host.ui.reportBranch === branch.id ? " selected" : "") + ">" + host.esc(branch.short || branch.name) + "</option>";
    });
    return '<select class="select" data-change="report-branch">' + html + "</select>";
  }

  function staffSelect(host) {
    var user = host.user || {};
    var branchId = user.role !== "admin" ? user.branchId : (host.ui.reportBranch || "all");
    var html = '<option value="all"' + (host.ui.reportStaff === "all" ? " selected" : "") + ">Mọi nhân viên</option>";
    (host.db.users || []).filter(function (person) {
      if (person.status === "inactive" || person.role === "admin") return false;
      if (branchId !== "all" && person.branchId !== branchId) return false;
      return true;
    }).forEach(function (person) {
      html += '<option value="' + host.esc(person.id) + '"' + (host.ui.reportStaff === person.id ? " selected" : "") + ">" + host.esc(person.name) + "</option>";
    });
    return '<select class="select" data-change="report-staff">' + html + "</select>";
  }

  function filters(host) {
    var tab = host.ui.reportTab || "day";
    var parts = [];
    if (tab === "day") {
      parts.push('<input class="report-date" type="date" data-change="report-date" value="' + host.esc(host.ui.reportDate) + '" />');
    }
    if (tab === "month" || tab === "branch" || tab === "staff" || tab === "qty" || tab === "hot" || tab === "import") {
      parts.push('<input class="report-month" type="month" data-change="report-month" value="' + host.esc(host.ui.reportMonth) + '" />');
    }
    parts.push(branchSelect(host));
    if (tab === "staff") parts.push(staffSelect(host));
    if (tab === "hot") {
      parts.push('<div class="chips">' + [["qty", "Theo số lượng"], ["revenue", "Theo doanh thu"]].map(function (item) {
        return '<button type="button" class="chip ' + (host.ui.reportHot === item[0] ? "on" : "") + '" data-action="report-hot" data-value="' + item[0] + '">' + item[1] + "</button>";
      }).join("") + "</div>");
      parts.push('<select class="select" data-change="report-limit">' + [["5", "Top 5"], ["10", "Top 10"], ["all", "Tất cả"]].map(function (item) {
        return '<option value="' + item[0] + '"' + (host.ui.reportLimit === item[0] ? " selected" : "") + ">" + item[1] + "</option>";
      }).join("") + "</select>");
    }
    if (tab === "expiry") {
      parts.push('<label class="tiny muted report-window">Trong <input class="report-days" type="number" min="1" max="365" data-change="report-days" value="' + host.esc(host.ui.reportDays) + '" /> ngày</label>');
    }
    return '<div class="toolbar report-filters">' + parts.filter(Boolean).join("") + "</div>";
  }

  function kpis(items) {
    return '<div class="stats report-kpis">' + items.map(function (item) {
      return '<article class="stat"><div class="k">' + item[0] + '</div><div class="v">' + item[1] + "</div></article>";
    }).join("") + "</div>";
  }

  function table(headers, body) {
    return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (name) {
      return "<th>" + name + "</th>";
    }).join("") + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '"><div class="empty">' + text + "</div></td></tr>";
  }

  function pageSlice(host, rows) {
    var pager = root.PharmaPager || { clamp: function (list) { return { rows: list || [], total: (list || []).length, page: 1, pages: 1 }; } };
    return pager.clamp(rows, host.ui.reportPage, 8);
  }

  function bars(host, series) {
    var max = 1;
    series.forEach(function (item) { if (item.revenue > max) max = item.revenue; });
    var dense = series.length > 12 ? " dense" : "";
    return '<div class="bars' + dense + '">' + series.map(function (item) {
      var height = Math.max(item.revenue ? 8 : 2, Math.round((item.revenue / max) * 150));
      return '<div class="bar"><i style="height:' + height + 'px" title="' + host.esc(host.money(item.revenue)) + '"></i><span>' + host.esc(item.label) + "</span></div>";
    }).join("") + "</div>";
  }

  function fail(host, result) {
    return '<section class="card empty"><h3>Chưa lập được báo cáo</h3><p>' + host.esc(result.message) + "</p></section>";
  }

  function invoiceRows(host, listed, cols) {
    if (!listed.rows.length) return emptyRow(cols, "Không có hóa đơn trong kỳ đã chọn.");
    return listed.rows.map(function (row) {
      return "<tr><td><b>" + host.esc(row.code) + "</b></td><td>" + host.esc(row.customer || "Khách lẻ") + "</td><td>" + host.esc(row.cashier) + "</td><td>" + host.esc(branchLabel(host, row.branchId)) + "</td><td><b>" + host.money(row.revenue) + "</b></td></tr>";
    }).join("");
  }

  function viewDay(host) {
    var result = reports().daily(host.db, {
      viewer: host.user,
      date: host.ui.reportDate,
      branchId: host.ui.reportBranch,
    });
    if (!result.ok) return fail(host, result);
    var listed = pageSlice(host, result.invoices);
    return kpis([["Doanh thu", host.money(result.revenue)], ["Lợi nhuận gộp", host.money(result.profit)], ["Số đơn", String(result.orders)]]) +
      table(["Mã hóa đơn", "Khách", "Nhân viên", "Chi nhánh", "Doanh thu"], invoiceRows(host, listed, 5)) +
      host.pagerBar(listed, "report-page");
  }

  function viewMonth(host) {
    var result = reports().monthly(host.db, {
      viewer: host.user,
      month: host.ui.reportMonth,
      branchId: host.ui.reportBranch,
    });
    if (!result.ok) return fail(host, result);
    var active = result.series.filter(function (item) { return item.orders > 0; });
    var listed = pageSlice(host, active);
    var body = listed.rows.map(function (row) {
      return "<tr><td>" + host.esc(row.label) + "</td><td>" + row.orders + "</td><td><b>" + host.money(row.revenue) + "</b></td><td>" + host.money(row.profit) + "</td></tr>";
    }).join("") || emptyRow(4, "Tháng này chưa có hóa đơn đã thanh toán.");
    return kpis([["Doanh thu", host.money(result.revenue)], ["Lợi nhuận gộp", host.money(result.profit)], ["Số đơn", String(result.orders)]]) +
      '<section class="card report-block"><h3>Biểu đồ theo ngày</h3>' + bars(host, result.series) + "</section>" +
      '<section class="card report-block"><h3>Bảng theo ngày</h3>' + table(["Ngày", "Số đơn", "Doanh thu", "Lợi nhuận"], body) + host.pagerBar(listed, "report-page") + "</section>";
  }

  function viewBranch(host) {
    var result = reports().byBranch(host.db, {
      viewer: host.user,
      month: host.ui.reportMonth,
      branchId: host.ui.reportBranch,
    });
    if (!result.ok) return fail(host, result);
    var max = 1;
    result.rows.forEach(function (row) { if (row.revenue > max) max = row.revenue; });
    var body = result.rows.map(function (row) {
      var on = result.focus !== "all" && row.branchId === result.focus;
      var width = Math.round((row.revenue / max) * 100);
      return '<tr class="' + (on ? "report-focus" : "") + '"><td><b>' + host.esc(row.name) + "</b></td><td>" + row.orders + "</td><td><b>" + host.money(row.revenue) + '</b><div class="progress" style="margin-top:6px"><i style="width:' + width + '%"></i></div></td><td>' + host.money(row.profit) + "</td><td>" + row.share + "%</td></tr>";
    }).join("") || emptyRow(5, "Chưa có chi nhánh để so sánh.");
    var title = result.focus === "all" ? "Mọi chi nhánh" : host.esc(branchLabel(host, result.focus));
    return kpis([["Đang xem", title], ["Doanh thu", host.money(result.revenue)], ["Lợi nhuận gộp", host.money(result.profit)], ["Số đơn", String(result.orders)]]) +
      '<p class="tiny muted report-note">Tỷ trọng tính trên tổng doanh thu các chi nhánh trong phạm vi so sánh. Dòng được chọn nằm trên nền xanh.</p>' +
      table(["Chi nhánh", "Số đơn", "Doanh thu", "Lợi nhuận", "Tỷ trọng"], body);
  }

  function viewStaff(host) {
    var result = reports().byStaff(host.db, {
      viewer: host.user,
      month: host.ui.reportMonth,
      branchId: host.ui.reportBranch,
      staffId: host.ui.reportStaff,
    });
    if (!result.ok) return fail(host, result);
    var head = kpis([["Doanh thu", host.money(result.revenue)], ["Lợi nhuận gộp", host.money(result.profit)], ["Số đơn", String(result.orders)]]);
    if (result.mode === "one") {
      var listed = pageSlice(host, result.invoices);
      return head + '<p class="tiny muted report-note">Nhân viên: <b>' + host.esc(result.staffName) + "</b></p>" +
        table(["Mã hóa đơn", "Khách", "Nhân viên", "Chi nhánh", "Doanh thu"], invoiceRows(host, listed, 5)) +
        host.pagerBar(listed, "report-page");
    }
    var listedAll = pageSlice(host, result.rows);
    var body = listedAll.rows.map(function (row) {
      return "<tr><td><b>" + host.esc(row.cashier) + "</b></td><td>" + host.esc(branchLabel(host, row.branchId)) + "</td><td>" + row.orders + "</td><td><b>" + host.money(row.revenue) + "</b></td><td>" + host.money(row.profit) + "</td></tr>";
    }).join("") || emptyRow(5, "Tháng này chưa có doanh thu theo nhân viên.");
    return head + table(["Nhân viên", "Chi nhánh", "Số đơn", "Doanh thu", "Lợi nhuận"], body) + host.pagerBar(listedAll, "report-page");
  }

  function viewQty(host) {
    var result = reports().qtySold(host.db, {
      viewer: host.user,
      month: host.ui.reportMonth,
      branchId: host.ui.reportBranch,
    });
    if (!result.ok) return fail(host, result);
    var listed = pageSlice(host, result.rows);
    var body = listed.rows.map(function (row) {
      return "<tr><td><b>" + host.esc(row.name) + "</b></td><td>" + row.qty + "</td><td>" + host.money(row.revenue) + "</td><td>" + row.share + "%</td></tr>";
    }).join("") || emptyRow(4, "Chưa có thuốc nào được bán trong tháng.");
    return kpis([["Số lượng bán", String(result.qty)], ["Doanh thu thuốc", host.money(result.revenue)], ["Số mặt hàng", String(result.rows.length)]]) +
      table(["Thuốc", "Số lượng", "Doanh thu", "Tỷ trọng SL"], body) + host.pagerBar(listed, "report-page");
  }

  function viewHot(host) {
    var result = reports().bestsellers(host.db, {
      viewer: host.user,
      month: host.ui.reportMonth,
      branchId: host.ui.reportBranch,
      criterion: host.ui.reportHot,
      limit: host.ui.reportLimit,
    });
    if (!result.ok) return fail(host, result);
    var listed = pageSlice(host, result.rows);
    var body = listed.rows.map(function (row) {
      return "<tr><td><b>" + row.rank + "</b></td><td>" + host.esc(row.name) + "</td><td>" + row.qty + "</td><td>" + host.money(row.revenue) + "</td></tr>";
    }).join("") || emptyRow(4, "Chưa đủ dữ liệu để xếp thuốc bán chạy.");
    var criterion = result.criterion === "revenue" ? "doanh thu" : "số lượng";
    return '<p class="tiny muted report-note">Đang sắp theo ' + criterion + ".</p>" +
      table(["Hạng", "Thuốc", "Số lượng", "Doanh thu"], body) + host.pagerBar(listed, "report-page");
  }

  function viewImport(host) {
    var result = reports().purchases(host.db, {
      viewer: host.user,
      month: host.ui.reportMonth,
      branchId: host.ui.reportBranch,
    });
    if (!result.ok) return fail(host, result);
    var listed = pageSlice(host, result.rows);
    var body = listed.rows.map(function (row) {
      return "<tr><td><b>" + host.esc(row.code) + "</b></td><td>" + host.esc(row.supplier || "—") + "</td><td>" + host.esc(branchLabel(host, row.branchId)) + "</td><td>" + row.lines + "</td><td>" + host.esc(host.dateLabel(row.at)) + "</td><td><b>" + host.money(row.total) + "</b></td></tr>";
    }).join("") || emptyRow(6, "Không có phiếu nhập đã xác nhận trong tháng.");
    return kpis([["Tổng tiền nhập", host.money(result.total)], ["Phiếu đã nhận", String(result.count)], ["Phiếu không tính", String(result.skipped)]]) +
      '<p class="tiny muted report-note">Phiếu nháp và phiếu đã hủy không cộng vào tổng tiền nhập.</p>' +
      table(["Mã phiếu", "Nhà cung cấp", "Chi nhánh", "Dòng", "Ngày", "Thành tiền"], body) +
      host.pagerBar(listed, "report-page");
  }

  function viewStock(host) {
    var result = reports().stockReport(host.db, { viewer: host.user, branchId: host.ui.reportBranch });
    if (!result.ok) return fail(host, result);
    var groups = result.groups.map(function (row) {
      return "<tr><td><b>" + host.esc(row.name) + "</b></td><td>" + row.sku + "</td><td>" + row.qty + "</td><td>" + host.money(row.value) + "</td></tr>";
    }).join("") || emptyRow(4, "Chưa có chi nhánh trong phạm vi báo cáo.");
    var listed = pageSlice(host, result.items);
    var items = listed.rows.map(function (row) {
      return "<tr><td><b>" + host.esc(row.name) + "</b></td><td>" + host.esc(branchLabel(host, row.branchId)) + "</td><td>" + row.stock + " " + host.esc(row.unit) + "</td><td>" + row.minStock + "</td><td>" + host.money(row.value) + "</td></tr>";
    }).join("") || emptyRow(5, "Chưa có thuốc trong kho.");
    return kpis([["Mặt hàng", String(result.sku)], ["Tổng tồn", String(result.qty)], ["Giá trị tồn", host.money(result.value)]]) +
      '<section class="card report-block"><h3>Theo chi nhánh</h3>' + table(["Chi nhánh", "Mặt hàng", "Số lượng tồn", "Giá trị"], groups) + "</section>" +
      '<section class="card report-block"><h3>Chi tiết thuốc</h3>' + table(["Thuốc", "Chi nhánh", "Tồn", "Tối thiểu", "Giá trị"], items) + host.pagerBar(listed, "report-page") + "</section>";
  }

  function viewExpiry(host) {
    var result = reports().expiryReport(host.db, {
      viewer: host.user,
      branchId: host.ui.reportBranch,
      days: host.ui.reportDays,
      today: host.today,
    });
    if (!result.ok) return fail(host, result);
    var listed = pageSlice(host, result.rows);
    var body = listed.rows.map(function (row) {
      var pill = row.expired ? '<span class="badge-pill bad">Hết hạn</span>' : '<span class="badge-pill warn">Còn ' + row.left + " ngày</span>";
      return "<tr><td><b>" + host.esc(row.name) + "</b></td><td>" + host.esc(row.batch || "—") + "</td><td>" + host.esc(branchLabel(host, row.branchId)) + "</td><td>" + host.esc(host.dateLabel(row.expiry)) + "</td><td>" + row.qty + "</td><td>" + pill + "</td></tr>";
    }).join("") || emptyRow(6, "Không có lô nào trong khoảng hạn đã chọn.");
    return kpis([["Sắp hết hạn", String(result.soon)], ["Đã hết hạn", String(result.expired)], ["Tổng lô", String(result.rows.length)]]) +
      table(["Thuốc", "Số lô", "Chi nhánh", "Hạn dùng", "Số lượng", "Trạng thái"], body) +
      host.pagerBar(listed, "report-page");
  }

  function viewLow(host) {
    var result = reports().lowStock(host.db, { viewer: host.user, branchId: host.ui.reportBranch });
    if (!result.ok) return fail(host, result);
    var listed = pageSlice(host, result.rows);
    var body = listed.rows.map(function (row) {
      var unit = row.unit ? " " + host.esc(row.unit) : "";
      return "<tr><td><b>" + host.esc(row.name) + "</b></td><td>" + host.esc(branchLabel(host, row.branchId)) + "</td><td>" + row.stock + unit + "</td><td>" + row.minStock + unit + "</td><td><b>" + row.shortage + unit + "</b></td></tr>";
    }).join("") || emptyRow(5, "Không có thuốc nào dưới mức tồn tối thiểu.");
    return kpis([["Thuốc cần bổ sung", String(result.count)], ["Tổng số lượng thiếu", String(result.shortage)]]) +
      table(["Thuốc", "Chi nhánh", "Tồn", "Tối thiểu", "Cần nhập thêm"], body) +
      host.pagerBar(listed, "report-page");
  }

  function page(host) {
    ready(host);
    var tab = host.ui.reportTab || "day";
    var views = {
      day: viewDay,
      month: viewMonth,
      branch: viewBranch,
      staff: viewStaff,
      qty: viewQty,
      hot: viewHot,
      import: viewImport,
      stock: viewStock,
      expiry: viewExpiry,
      low: viewLow,
    };
    var body = (views[tab] || viewDay)(host);
    return '<div class="page-head"><div><h1>Báo cáo</h1><p>' + (COPY[tab] || COPY.day) + "</p></div></div>" + tabs(host) + filters(host) + body;
  }

  function handleClick(action, el, host) {
    if (action === "report-tab") {
      host.ui.reportTab = el.dataset.value || "day";
      host.ui.reportPage = 1;
      host.render();
      return true;
    }
    if (action === "report-hot") {
      host.ui.reportHot = el.dataset.value === "revenue" ? "revenue" : "qty";
      host.ui.reportPage = 1;
      host.render();
      return true;
    }
    if (action === "report-page") {
      host.ui.reportPage = (Number(host.ui.reportPage) || 1) + Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    return false;
  }

  function handleChange(event, host) {
    var el = event.target.closest("[data-change]");
    if (!el) return false;
    var key = el.dataset.change;
    if (key === "report-date") host.ui.reportDate = el.value;
    else if (key === "report-month") host.ui.reportMonth = el.value;
    else if (key === "report-branch") {
      host.ui.reportBranch = el.value;
      host.ui.reportStaff = "all";
    } else if (key === "report-staff") host.ui.reportStaff = el.value;
    else if (key === "report-limit") host.ui.reportLimit = el.value;
    else if (key === "report-days") host.ui.reportDays = el.value;
    else return false;
    host.ui.reportPage = 1;
    host.render();
    return true;
  }

  root.PharmaReportPages = {
    page: page,
    handleClick: handleClick,
    handleChange: handleChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
