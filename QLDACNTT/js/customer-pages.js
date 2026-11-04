/* Màn hình khách hàng và vai trò khách. */
(function (root) {
  function statusPill(status) {
    if (status === "inactive") return '<span class="badge-pill neutral">Ngừng chăm sóc</span>';
    return '<span class="badge-pill ok">Đang chăm sóc</span>';
  }

  function rolePill(host, role) {
    if (!role) return '<span class="badge-pill neutral">Chưa có vai trò</span>';
    var name = host.esc(role.name);
    if (role.status === "inactive") return '<span class="badge-pill neutral">' + name + "</span>";
    return '<span class="badge-pill ok">' + name + "</span>";
  }

  function field(ctx, label, name, value, extra, type) {
    return '<div class="field ' + (extra || "") + '"><div class="field-head"><span>' + label + '</span></div><label class="control"><input name="' + name + '" type="' + ctx.esc(type || "text") + '" value="' + ctx.esc(value == null ? "" : value) + '" autocomplete="off" /></label></div>';
  }

  function guardEdit(host) {
    if (host.canEdit) return true;
    host.toast("Không có quyền sửa khách hàng.");
    return false;
  }

  function guardRole(host) {
    if (host.canRole) return true;
    host.toast("Không có quyền quản lý vai trò khách hàng.");
    return false;
  }

  function tabs(host) {
    var tab = host.ui.customerTab || "list";
    var items = [["list", "Hồ sơ khách"], ["roles", "Vai trò khách"]];
    return '<div class="catalog-tabs">' + items.map(function (pair) {
      return '<button type="button" class="chip ' + (tab === pair[0] ? "on" : "") + '" data-action="customer-tab" data-value="' + pair[0] + '">' + pair[1] + "</button>";
    }).join("") + "</div>";
  }

  function roleOptions(host, selected, includeInactive) {
    var html = "";
    (host.db.customerRoles || []).forEach(function (role) {
      if (role.status === "inactive" && role.id !== selected && !includeInactive) return;
      var mark = role.status === "inactive" ? " (đã tắt)" : "";
      html += '<option value="' + host.esc(role.id) + '" ' + (role.id === selected ? "selected" : "") + ">" + host.esc(role.name + mark) + "</option>";
    });
    return html;
  }

  function isAdmin(host) {
    return !!(host.user && host.user.role === "admin");
  }

  function seesAll(host) {
    return !!(host.user && (host.user.role === "admin" || host.user.preview));
  }

  function branchFilterId(host) {
    return seesAll(host) ? (host.ui.customerBranch || "all") : "all";
  }

  function scopeLine(host) {
    if (!seesAll(host)) {
      var own = host.user ? host.branchName(host.user.branchId) : "";
      return own ? "Chỉ khách của " + own : "Chỉ khách của chi nhánh đang quản lý";
    }
    var selected = branchFilterId(host);
    return selected === "all" ? "Mọi chi nhánh" : (host.branchName(selected) || "Chi nhánh đã chọn");
  }

  function branchSelect(host, selected) {
    var html = "";
    (host.db.branches || []).forEach(function (branch) {
      html += '<option value="' + host.esc(branch.id) + '"' + (branch.id === selected ? " selected" : "") + ">" + host.esc(branch.short || branch.name) + "</option>";
    });
    return html;
  }

  function accountText(host, customer) {
    var account = root.PharmaCustomers.accountOf(host.db, customer);
    if (!account) return "Chưa có";
    return account.status === "active" ? "Đang mở" : "Đang khóa";
  }

  function customerList(host) {
    var listed = root.PharmaCustomers.query(host.db.customers, host.db, {
      q: host.ui.qCustomer,
      status: host.ui.customerStatus,
      roleId: host.ui.customerRole || "all",
      branchId: branchFilterId(host),
      viewer: host.user,
      page: host.ui.customerPage,
    });
    host.ui.customerPage = listed.page;
    var filters = [["all", "Tất cả"], ["active", "Đang chăm sóc"], ["inactive", "Ngừng chăm sóc"]];
    var rows = listed.rows.map(function (item) {
      var role = root.PharmaCustomers.roleById(host.db, item.roleId);
      var account = root.PharmaCustomers.accountOf(host.db, item);
      var next = item.status === "inactive" ? "active" : "inactive";
      var branchId = root.PharmaCustomers.homeBranch(host.db, item);
      var actions = ['<button class="btn sm soft" data-action="open-customer" data-id="' + host.esc(item.id) + '">Chi tiết</button>'];
      if (host.canEdit) {
        actions.push('<button class="btn sm ghost" data-action="edit-customer" data-id="' + host.esc(item.id) + '">Sửa</button>');
        actions.push('<button class="btn sm ghost" data-action="customer-status" data-id="' + host.esc(item.id) + '" data-next="' + next + '">' + (next === "inactive" ? "Ngừng" : "Mở lại") + "</button>");
        actions.push('<button class="btn sm danger" data-action="delete-customer" data-id="' + host.esc(item.id) + '">Xóa hồ sơ</button>');
      }
      if (host.canLock && account) {
        actions.push('<button class="btn sm ghost" data-action="toggle-customer-account" data-id="' + host.esc(item.id) + '">' + (account.status === "active" ? "Khóa" : "Mở khóa") + "</button>");
      }
      if (host.canDelete && account) {
        actions.push('<button class="btn sm danger" data-action="delete-customer-account" data-id="' + host.esc(item.id) + '">Xóa tài khoản</button>');
      }
      return '<article class="med-row"><div class="med-main"><div class="med-head"><b>' + host.esc(item.name) + "</b>" + rolePill(host, role) + statusPill(item.status) +
        '</div><div class="tiny muted">' + host.esc(item.code) + " · " + host.esc(item.phone) + " · " + host.esc(host.branchName(branchId) || "Chưa gắn chi nhánh") +
        '</div><dl class="med-facts"><div><dt>Điểm</dt><dd>' + (Number(item.points) || 0) +
        '</dd></div><div><dt>Tổng chi</dt><dd>' + host.money(item.totalSpend || 0) + '</dd></div><div><dt>Tài khoản</dt><dd>' +
        accountText(host, item) + "</dd></div></dl></div><div class=\"action-row med-actions\" style=\"flex-wrap:wrap\">" + actions.join("") + "</div></article>";
    }).join("");
    var branchPicker = seesAll(host)
      ? '<select class="select" data-change="customer-branch"><option value="all"' + (branchFilterId(host) === "all" ? " selected" : "") + ">Mọi chi nhánh</option>" + branchSelect(host, branchFilterId(host)) + "</select>"
      : "";
    return '<div class="page-head"><div><h1>Khách hàng</h1><p>' + listed.total + " hồ sơ · " + host.esc(scopeLine(host)) + "</p></div>" +
      (host.canEdit ? '<button class="btn" data-action="edit-customer">' + host.icon("plus") + " Thêm khách</button>" : "") +
      "</div>" + tabs(host) +
      '<div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-customer" placeholder="Tên, mã, điện thoại, email hoặc vai trò" data-input="qCustomer" value="' + host.esc(host.ui.qCustomer || "") + '" /></label>' +
      branchPicker +
      '<label class="control"><select data-change="customer-role-filter"><option value="all"' + ((host.ui.customerRole || "all") === "all" ? " selected" : "") + ">Mọi vai trò</option>" + roleOptions(host, host.ui.customerRole, true) + "</select></label>" +
      '<div class="chips">' + filters.map(function (pair) {
        return '<button class="chip ' + (host.ui.customerStatus === pair[0] ? "on" : "") + '" data-action="customer-filter" data-value="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("") + "</div></div><div class=\"med-list\">" +
      (rows || '<div class="empty">Chưa có khách hàng khớp bộ lọc.</div>') +
      "</div>" + host.pagerBar(listed, "customer-page");
  }

  function roleList(host) {
    var listed = root.PharmaCustomers.queryRoles(host.db.customerRoles, {
      q: host.ui.qRole,
      status: host.ui.roleStatus || "all",
      page: host.ui.rolePage,
    });
    host.ui.rolePage = listed.page;
    var filters = [["all", "Tất cả"], ["active", "Đang bật"], ["inactive", "Đã tắt"]];
    var rows = listed.rows.map(function (role) {
      var next = role.status === "inactive" ? "active" : "inactive";
      var count = root.PharmaCustomers.customerCount(host.db, role.id);
      var actions = [];
      if (host.canRole) {
        actions.push('<button class="btn sm ghost" data-action="edit-customer-role" data-id="' + host.esc(role.id) + '">Sửa</button>');
        actions.push('<button class="btn sm ghost" data-action="customer-role-status" data-id="' + host.esc(role.id) + '" data-next="' + next + '">' + (next === "inactive" ? "Tắt" : "Bật") + "</button>");
        if (!role.builtin) actions.push('<button class="btn sm danger" data-action="delete-customer-role" data-id="' + host.esc(role.id) + '">Xóa</button>');
      }
      return '<article class="med-row"><div class="med-main"><div class="med-head"><b>' + host.esc(role.name) + "</b>" +
        (role.builtin ? '<span class="badge-pill neutral">Mặc định</span>' : '<span class="badge-pill warn">Tự thêm</span>') +
        (role.status === "inactive" ? '<span class="badge-pill neutral">Đã tắt</span>' : '<span class="badge-pill ok">Đang bật</span>') +
        '</div><div class="tiny muted">' + host.esc(role.description || "Chưa có mô tả") + '</div><dl class="med-facts"><div><dt>Tích điểm</dt><dd>' +
        (role.pointRate ? role.pointRate + " điểm / 10.000đ" : "Không") + '</dd></div><div><dt>Giảm giá</dt><dd>' +
        (role.discountPercent ? role.discountPercent + "%" : "Không") + '</dd></div><div><dt>Khách</dt><dd>' + count +
        "</dd></div></dl></div>" + (actions.length ? '<div class="action-row med-actions">' + actions.join("") + "</div>" : "") + "</article>";
    }).join("");
    return '<div class="page-head"><div><h1>Vai trò khách hàng</h1><p>Quyền lợi theo hạng: tích điểm và mức giảm khi bán hàng</p></div>' +
      (host.canRole ? '<button class="btn" data-action="edit-customer-role">' + host.icon("plus") + " Thêm vai trò</button>" : "") +
      "</div>" + tabs(host) +
      '<div class="toolbar"><label class="search">' + host.icon("search") +
      '<input id="q-role" placeholder="Tên hoặc mô tả vai trò" data-input="qRole" value="' + host.esc(host.ui.qRole || "") + '" /></label><div class="chips">' +
      filters.map(function (pair) {
        return '<button class="chip ' + ((host.ui.roleStatus || "all") === pair[0] ? "on" : "") + '" data-action="role-filter" data-value="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("") + '</div></div><div class="med-list">' +
      (rows || '<div class="empty">Chưa có vai trò khớp bộ lọc.</div>') +
      "</div>" + host.pagerBar(listed, "role-page");
  }

  function page(host) {
    root.PharmaCustomers.ensure(host.db);
    if ((host.ui.customerTab || "list") === "roles") return roleList(host);
    return customerList(host);
  }

  function inScope(host, customer) {
    return root.PharmaCustomers.visibleTo(host.db, host.user, customer);
  }

  function customerForm(host, modal) {
    var found = modal.id ? root.PharmaCustomers.byId(host.db, modal.id) : null;
    if (found && !inScope(host, found)) return "<h3>Sửa khách hàng</h3><p>Khách hàng không thuộc chi nhánh của bạn.</p>";
    var home = found ? root.PharmaCustomers.homeBranch(host.db, found) : "";
    var fallback = isAdmin(host)
      ? (branchFilterId(host) !== "all" ? branchFilterId(host) : ((host.db.branches || [])[0] || {}).id || "")
      : (host.user ? host.user.branchId : "");
    var draft = Object.assign({
      name: "", phone: "", email: "", address: "", birthday: "", note: "", status: "active",
      roleId: found ? found.roleId : "member",
      branchId: home || fallback,
    }, found || {}, modal.draft || {});
    if (!draft.branchId) draft.branchId = home || fallback;
    var shownRole = found ? root.PharmaCustomers.roleById(host.db, found.roleId) : root.PharmaCustomers.roleById(host.db, "member");
    var roleField = host.canAssign
      ? '<div class="field"><div class="field-head"><span>Vai trò</span></div><label class="control"><select name="roleId">' + roleOptions(host, draft.roleId, false) + "</select></label></div>"
      : '<div class="field"><div class="field-head"><span>Vai trò</span></div><p class="note">' + host.esc(shownRole ? shownRole.name : "Thành viên") + ". Chỉ quản lý đổi được vai trò.</p></div>";
    var branchField = isAdmin(host)
      ? '<div class="field"><div class="field-head"><span>Chi nhánh</span></div><label class="control"><select name="branchId">' + branchSelect(host, draft.branchId) + "</select></label></div>"
      : '<input type="hidden" name="branchId" value="' + host.esc(draft.branchId) + '" /><div class="field"><div class="field-head"><span>Chi nhánh</span></div><p class="note">' + host.esc(host.branchName(draft.branchId) || "Chi nhánh đang quản lý") + "</p></div>";
    return "<h3>" + (found ? "Sửa khách hàng" : "Thêm khách hàng") + '</h3><form data-form="customer"><input type="hidden" name="id" value="' + host.esc(modal.id || "") + '" /><div class="form-grid">' +
      field(host, "Họ và tên", "name", draft.name, "full") +
      field(host, "Điện thoại", "phone", draft.phone) +
      field(host, "Email", "email", draft.email, "", "email") +
      branchField +
      roleField +
      '<div class="field"><div class="field-head"><span>Trạng thái</span></div><label class="control"><select name="status"><option value="active" ' + (draft.status !== "inactive" ? "selected" : "") + '>Đang chăm sóc</option><option value="inactive" ' + (draft.status === "inactive" ? "selected" : "") + ">Ngừng chăm sóc</option></select></label></div>" +
      field(host, "Ngày sinh", "birthday", draft.birthday, "", "date") +
      field(host, "Địa chỉ", "address", draft.address, "full") +
      field(host, "Ghi chú", "note", draft.note, "full") +
      '</div><p class="tiny muted">Điện thoại dùng để nhận diện khách lúc bán hàng. Điểm và tổng chi do hóa đơn cộng vào.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu</button></div></form>';
  }

  function customerView(host, modal) {
    var customer = root.PharmaCustomers.byId(host.db, modal.id);
    if (!customer) return "<h3>Khách hàng</h3><p>Không tìm thấy khách hàng.</p>";
    if (!inScope(host, customer)) return "<h3>Khách hàng</h3><p>Khách hàng không thuộc chi nhánh của bạn.</p>";
    var role = root.PharmaCustomers.roleById(host.db, customer.roleId);
    var check = root.PharmaCustomers.inspect(host.db, customer);
    var hint = root.PharmaCustomers.suggest(host.db, customer);
    var rows = [
      ["Mã", customer.code],
      ["Chi nhánh", host.branchName(root.PharmaCustomers.homeBranch(host.db, customer)) || "—"],
      ["Điện thoại", customer.phone],
      ["Email", customer.email || "—"],
      ["Vai trò", role ? role.name : "—"],
      ["Quyền lợi", role ? root.PharmaCustomers.benefitText(role) : "—"],
      ["Điểm", String(Number(customer.points) || 0)],
      ["Tổng chi", host.money(customer.totalSpend || 0)],
      ["Ngày sinh", customer.birthday ? host.dateLabel(customer.birthday) : "—"],
      ["Địa chỉ", customer.address || "—"],
      ["Ghi chú", customer.note || "—"],
    ];
    var sales = root.PharmaCustomers.history(host.db, customer);
    var historyRows = sales.map(function (sale) {
      var points = sale.spendCounted && !sale.pointsReversed ? (Number(sale.pointsEarned) || 0) : 0;
      return "<tr><td><button class=\"linkish\" data-action=\"open-invoice\" data-id=\"" + host.esc(sale.id) + "\">" + host.esc(sale.code) + "</button></td><td>" +
        host.esc(host.timeLabel(sale.at)) + "</td><td>" + host.esc(host.branchName(sale.branchId) || "—") + "</td><td>" + host.money(sale.total || 0) +
        "</td><td>" + points + "</td><td>" + ((sale.status || "paid") === "cancelled" ? "Đã hủy" : "Đã thanh toán") + "</td></tr>";
    }).join("");
    var account = root.PharmaCustomers.accountOf(host.db, customer);
    var accountNote = account
      ? '<p class="note">Tài khoản cửa hàng: <b>' + host.esc(account.email) + "</b> · " + (account.status === "active" ? "đang đăng nhập được" : "đang khóa") + ".</p>"
      : '<p class="note">Khách chưa có tài khoản để đăng nhập cửa hàng.</p>';
    var accountButtons = "";
    if (host.canEdit && !account && customer.status === "active") {
      accountButtons += '<button class="btn ghost" data-action="open-customer-account" data-id="' + host.esc(customer.id) + '">Tạo tài khoản</button>';
    }
    if (host.canLock && account) {
      accountButtons += '<button class="btn ghost" data-action="toggle-customer-account" data-id="' + host.esc(customer.id) + '">' + (account.status === "active" ? "Khóa đăng nhập" : "Mở đăng nhập") + "</button>";
    }
    if (host.canDelete && account) {
      accountButtons += '<button class="btn danger" data-action="delete-customer-account" data-id="' + host.esc(customer.id) + '">Xóa tài khoản</button>';
    }
    return "<h3>" + host.esc(customer.name) + " " + rolePill(host, role) + " " + statusPill(customer.status) + '</h3><dl class="detail-grid">' +
      rows.map(function (pair) { return "<dt>" + pair[0] + "</dt><dd>" + host.esc(pair[1]) + "</dd>"; }).join("") +
      "</dl>" + accountNote + (check.ok ? '<p class="note">Hồ sơ đủ để nhận diện lúc bán hàng.</p>' : '<p class="note">Thiếu dữ liệu: ' + host.esc(check.missing.join(", ")) + ".</p>") +
      (hint ? '<p class="note">' + host.esc(hint.message) + "</p>" : "") +
      '<h3>Hóa đơn đã mua</h3><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Ngày</th><th>Chi nhánh</th><th>Tổng</th><th>Điểm</th><th>Trạng thái</th></tr></thead><tbody>' +
      (historyRows || '<tr><td colspan="6"><div class="empty">Chưa có hóa đơn.</div></td></tr>') +
      '</tbody></table></div><div class="action-row" style="margin-top:12px;justify-content:flex-end">' +
      accountButtons +
      (host.canEdit ? '<button class="btn ghost" data-action="edit-customer" data-id="' + host.esc(customer.id) + '">Sửa</button>' : "") +
      '<button class="btn" data-action="close">Đóng</button></div>';
  }

  function accountForm(host, modal) {
    var customer = root.PharmaCustomers.byId(host.db, modal.id);
    if (!customer) return "<h3>Tài khoản</h3><p>Không tìm thấy khách hàng.</p>";
    var draft = Object.assign({ email: customer.email || "", password: "", branchId: "" }, modal.draft || {});
    var branches = (host.db.branches || []).filter(function (branch) {
      if (branch.status !== "open") return false;
      if (!isAdmin(host)) return host.user && branch.id === host.user.branchId;
      return true;
    });
    var options = branches.map(function (branch) {
      return '<option value="' + host.esc(branch.id) + '"' + (draft.branchId === branch.id ? " selected" : "") + ">" + host.esc(branch.name) + "</option>";
    }).join("");
    return "<h3>Tài khoản cửa hàng</h3><p>Mở đăng nhập cho <b>" + host.esc(customer.name) + "</b>. Khách dùng email và mật khẩu này để vào cửa hàng.</p>" +
      '<form data-form="customer-account"><input type="hidden" name="customerId" value="' + host.esc(customer.id) + '" /><div class="form-grid">' +
      field(host, "Email đăng nhập", "email", draft.email, "full", "email") +
      field(host, "Mật khẩu tạm", "password", "", "full", "password") +
      '<div class="field"><div class="field-head"><span>Chi nhánh gần nhà</span></div><label class="control"><select name="branchId">' + options + "</select></label></div>" +
      '</div><p class="tiny muted">Mật khẩu ít nhất 8 ký tự, có cả chữ và số.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Mở tài khoản</button></div></form>';
  }

  function roleForm(host, modal) {
    var found = modal.id ? root.PharmaCustomers.roleById(host.db, modal.id) : null;
    var draft = Object.assign({
      name: "", description: "", pointRate: 1, discountPercent: 0, minSpend: 0, status: "active",
    }, found || {}, modal.draft || {});
    return "<h3>" + (found ? "Sửa vai trò" : "Thêm vai trò") + '</h3><form data-form="customer-role"><input type="hidden" name="id" value="' + host.esc(modal.id || "") + '" /><div class="form-grid">' +
      field(host, "Tên vai trò", "name", draft.name, "full") +
      field(host, "Điểm mỗi 10.000đ", "pointRate", draft.pointRate) +
      field(host, "Giảm giá (%)", "discountPercent", draft.discountPercent) +
      field(host, "Mức chi để xét (đ)", "minSpend", draft.minSpend) +
      '<div class="field"><div class="field-head"><span>Trạng thái</span></div><label class="control"><select name="status"><option value="active" ' + (draft.status !== "inactive" ? "selected" : "") + '>Đang bật</option><option value="inactive" ' + (draft.status === "inactive" ? "selected" : "") + ">Đã tắt</option></select></label></div>" +
      field(host, "Mô tả", "description", draft.description, "full") +
      '</div><p class="tiny muted">Điểm từ 0 đến 20. Giảm giá từ 0 đến 30%. Mức chi bằng 0 nghĩa là không tự xét lên vai trò này.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button><button class="btn" type="submit">Lưu</button></div></form>';
  }

  function modalBody(modal, host) {
    if (!modal) return null;
    if (modal.type === "customer") return customerForm(host, modal);
    if (modal.type === "customer-view") return customerView(host, modal);
    if (modal.type === "customer-account") return accountForm(host, modal);
    if (modal.type === "customer-role") return roleForm(host, modal);
    if (modal.type === "delete-customer-account") {
      var holder = root.PharmaCustomers.byId(host.db, modal.id);
      if (!holder) return "";
      if (!inScope(host, holder)) return "<h3>Xóa tài khoản</h3><p>Khách hàng không thuộc chi nhánh của bạn.</p>";
      var login = root.PharmaCustomers.accountOf(host.db, holder);
      if (!login) return "<h3>Xóa tài khoản</h3><p>" + host.esc(holder.name) + " chưa có tài khoản đăng nhập.</p>";
      return "<h3>Xóa tài khoản khách</h3><p>Xóa đăng nhập của <b>" + host.esc(holder.name) + "</b>? Hồ sơ khách và hóa đơn vẫn giữ. Khách sẽ không vào cửa hàng được nữa.</p>" +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>' +
        '<button type="button" class="btn danger" data-action="confirm-delete-customer-account" data-id="' + host.esc(holder.id) + '">Xóa tài khoản</button></div>';
    }
    if (modal.type === "delete-customer") {
      var customer = root.PharmaCustomers.byId(host.db, modal.id);
      if (!customer) return "";
      var count = root.PharmaCustomers.saleCount(host.db, customer);
      var extra = count ? "Đang có " + count + " hóa đơn nên chưa xóa được." : "Khách chưa phát sinh hóa đơn.";
      return "<h3>Xóa khách hàng</h3><p>Xóa <b>" + host.esc(customer.name) + "</b>? " + extra + '</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>' +
        (count ? "" : '<button type="button" class="btn danger" data-action="confirm-delete-customer" data-id="' + host.esc(customer.id) + '">Xóa khách</button>') + "</div>";
    }
    if (modal.type === "delete-customer-role") {
      var role = root.PharmaCustomers.roleById(host.db, modal.id);
      if (!role) return "";
      var used = root.PharmaCustomers.customerCount(host.db, role.id);
      var note = role.builtin ? "Đây là vai trò mặc định, chỉ tắt chứ không xóa." : (used ? "Còn " + used + " khách đang dùng." : "Chưa có khách nào dùng vai trò này.");
      return "<h3>Xóa vai trò</h3><p>Xóa <b>" + host.esc(role.name) + "</b>? " + note + '</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-action="close">Hủy</button>' +
        (!role.builtin && !used ? '<button type="button" class="btn danger" data-action="confirm-delete-customer-role" data-id="' + host.esc(role.id) + '">Xóa vai trò</button>' : "") + "</div>";
    }
    return null;
  }

  function handleClick(action, el, host) {
    if (action === "customer-tab") {
      host.ui.customerTab = el.dataset.value || "list";
      host.render();
      return true;
    }
    if (action === "customer-filter") {
      host.ui.customerStatus = el.dataset.value || "all";
      host.ui.customerPage = 1;
      host.render();
      return true;
    }
    if (action === "customer-page") {
      host.ui.customerPage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "role-filter") {
      host.ui.roleStatus = el.dataset.value || "all";
      host.ui.rolePage = 1;
      host.render();
      return true;
    }
    if (action === "role-page") {
      host.ui.rolePage += Number(el.dataset.dir || 0);
      host.render();
      return true;
    }
    if (action === "edit-customer") {
      if (!guardEdit(host)) return true;
      var editing = el.dataset.id ? root.PharmaCustomers.byId(host.db, el.dataset.id) : null;
      if (editing && !inScope(host, editing)) { host.toast("Khách hàng không thuộc chi nhánh của bạn."); return true; }
      host.ui.modal = { type: "customer", id: el.dataset.id || null };
      host.render();
      return true;
    }
    if (action === "open-customer") {
      var opened = root.PharmaCustomers.byId(host.db, el.dataset.id);
      if (opened && !inScope(host, opened)) { host.toast("Khách hàng không thuộc chi nhánh của bạn."); return true; }
      host.ui.modal = { type: "customer-view", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "delete-customer") {
      if (!guardEdit(host)) return true;
      var dropping = root.PharmaCustomers.byId(host.db, el.dataset.id);
      if (dropping && !inScope(host, dropping)) { host.toast("Khách hàng không thuộc chi nhánh của bạn."); return true; }
      host.ui.modal = { type: "delete-customer", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "confirm-delete-customer") {
      if (!guardEdit(host)) return true;
      var removed = root.PharmaCustomers.remove(host.db, el.dataset.id, host.user);
      if (!removed.ok) { host.toast(removed.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(removed.message);
      return true;
    }
    if (action === "customer-status") {
      if (!guardEdit(host)) return true;
      var changed = root.PharmaCustomers.setStatus(host.db, el.dataset.id, el.dataset.next, host.user);
      if (!changed.ok) { host.toast(changed.message); return true; }
      host.persist();
      host.toast(changed.message);
      return true;
    }
    if (action === "open-customer-account") {
      if (!guardEdit(host)) return true;
      host.ui.modal = { type: "customer-account", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "toggle-customer-account") {
      if (!host.canLock) { host.toast("Không có quyền khóa tài khoản."); return true; }
      var locked = root.PharmaCustomers.lockAccount(host.db, host.user, el.dataset.id);
      if (!locked.ok) { host.toast(locked.message); return true; }
      host.persist();
      host.toast(locked.message);
      return true;
    }
    if (action === "delete-customer-account") {
      if (!host.canDelete) { host.toast("Không có quyền xóa tài khoản khách."); return true; }
      host.ui.modal = { type: "delete-customer-account", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "confirm-delete-customer-account") {
      if (!host.canDelete) { host.toast("Không có quyền xóa tài khoản khách."); return true; }
      var dropped = root.PharmaCustomers.removeAccount(host.db, host.user, el.dataset.id);
      if (!dropped.ok) { host.toast(dropped.message); return true; }
      host.ui.modal = { type: "customer-view", id: el.dataset.id };
      host.persist();
      host.toast(dropped.message);
      return true;
    }
    if (action === "edit-customer-role") {
      if (!guardRole(host)) return true;
      host.ui.customerTab = "roles";
      host.ui.modal = { type: "customer-role", id: el.dataset.id || null };
      host.render();
      return true;
    }
    if (action === "delete-customer-role") {
      if (!guardRole(host)) return true;
      host.ui.modal = { type: "delete-customer-role", id: el.dataset.id };
      host.render();
      return true;
    }
    if (action === "confirm-delete-customer-role") {
      if (!guardRole(host)) return true;
      var deleted = root.PharmaCustomers.deleteRole(host.db, el.dataset.id);
      if (!deleted.ok) { host.toast(deleted.message); return true; }
      host.ui.modal = null;
      host.persist();
      host.toast(deleted.message);
      return true;
    }
    if (action === "customer-role-status") {
      if (!guardRole(host)) return true;
      var toggled = root.PharmaCustomers.setRoleStatus(host.db, el.dataset.id, el.dataset.next);
      if (!toggled.ok) { host.toast(toggled.message); return true; }
      host.persist();
      host.toast(toggled.message);
      return true;
    }
    return false;
  }

  function handleSubmit(kind, data, host) {
    if (kind === "customer") {
      if (!guardEdit(host)) return true;
      var saved = root.PharmaCustomers.save(host.db, data, { canAssign: host.canAssign, today: host.today, actor: host.user });
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
    if (kind === "customer-account") {
      if (!guardEdit(host)) return true;
      var opened = root.PharmaCustomers.openAccount(host.db, Object.assign({}, data, { actor: host.user }));
      if (!opened.ok) {
        if (host.ui.modal) host.ui.modal.draft = data;
        host.toast(opened.message);
        return true;
      }
      host.ui.modal = { type: "customer-view", id: opened.customer.id };
      host.persist();
      host.toast(opened.message);
      return true;
    }
    if (kind === "customer-role") {
      if (!guardRole(host)) return true;
      var stored = root.PharmaCustomers.saveRole(host.db, data);
      if (!stored.ok) {
        if (host.ui.modal) host.ui.modal.draft = data;
        host.toast(stored.message);
        return true;
      }
      host.ui.customerTab = "roles";
      host.ui.modal = null;
      host.persist();
      host.toast(stored.message);
      return true;
    }
    return false;
  }

  function handleChange(event, host) {
    var el = event.target.closest("[data-change]");
    if (!el) return false;
    if (el.dataset.change === "customer-role-filter") {
      host.ui.customerRole = el.value || "all";
      host.ui.customerPage = 1;
      host.render();
      return true;
    }
    if (el.dataset.change === "customer-branch") {
      if (!seesAll(host)) return true;
      host.ui.customerBranch = el.value || "all";
      host.ui.customerPage = 1;
      host.render();
      return true;
    }
    return false;
  }

  root.PharmaCustomerPages = {
    page: page,
    modalBody: modalBody,
    handleClick: handleClick,
    handleSubmit: handleSubmit,
    handleChange: handleChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
