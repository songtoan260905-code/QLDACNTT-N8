/* Trang chủ công khai theo bố cục PharmaHub trên Figma Make. */
(function (root) {
  var FEATURES = [
    ["building", "Quản lý đa chi nhánh", "Theo dõi doanh thu, tồn kho và hiệu suất của mọi chi nhánh trên một màn hình duy nhất.", "chi-nhanh"],
    ["shield", "Phân quyền chặt chẽ", "Thiết lập quyền theo vai trò, chi nhánh và nghiệp vụ. Lưu vết toàn bộ thao tác quan trọng.", "nhan-su"],
    ["chart", "Báo cáo thời gian thực", "Hơn 40 mẫu báo cáo bán hàng, lợi nhuận, công nợ và hàng hóa được cập nhật liên tục.", "bao-cao"],
    ["layers", "Kho, lô & hạn dùng", "Quản lý chính xác theo số lô, hạn dùng; tự động cảnh báo hàng sắp hết hoặc sắp hết hạn.", "ton-kho"],
    ["cart", "Bán hàng nhanh chóng", "Quét mã, tra cứu thuốc, áp dụng khuyến mãi và hoàn tất đơn hàng chỉ trong vài thao tác.", "ban-hang"],
    ["users", "Khách hàng & nhà cung cấp", "Quản lý lịch sử mua, công nợ, đơn nhập và chương trình chăm sóc khách hàng tập trung.", "khach-hang"],
  ];

  var FEATURE_DETAIL = {
    "chi-nhanh": {
      lead: "Mỗi nhà thuốc trong chuỗi có hồ sơ riêng, nhưng ban điều hành vẫn nhìn được toàn bộ hoạt động trên một màn hình.",
      points: [
        "Xem địa chỉ, giờ mở cửa, điện thoại và người phụ trách của từng chi nhánh.",
        "So sánh doanh thu, số nhân sự và cảnh báo kho giữa các điểm bán.",
        "Biết chi nhánh nào đang mở, bảo trì hoặc ngừng hoạt động.",
        "Dữ liệu bán hàng và tồn kho được gắn với đúng chi nhánh phát sinh.",
      ],
    },
    "nhan-su": {
      lead: "Mỗi người chỉ vào đúng phần việc của mình. Quản trị thấy toàn chuỗi, quản lý thấy chi nhánh được giao, nhân viên thấy quầy và kho.",
      points: [
        "Bốn vai trò vận hành: quản trị, quản lý, dược sĩ và thu ngân.",
        "Quyền được chia theo màn hình và theo thao tác như sửa kho, lập hóa đơn, khóa tài khoản.",
        "Nhân viên gắn với một chi nhánh; quản trị không bị giới hạn chi nhánh.",
        "Thao tác quan trọng được ghi lại để truy vết khi cần.",
      ],
    },
    "bao-cao": {
      lead: "Số liệu bán hàng, lợi nhuận và hàng hóa được gom sẵn, không cần cộng tay từ nhiều file.",
      points: [
        "Xem doanh thu theo ngày, theo tháng và theo từng chi nhánh.",
        "Theo dõi lợi nhuận gộp từ giá bán và giá nhập trên từng dòng hóa đơn.",
        "Lọc thuốc bán chạy, công nợ và tình hình hàng hóa.",
        "Số trên trang giới thiệu chỉ là minh họa; số trong hệ thống lấy từ hóa đơn đã thanh toán.",
      ],
    },
    "ton-kho": {
      lead: "Tồn kho không chỉ là một con số. Mỗi thuốc được theo dõi theo lô, hạn dùng và chi nhánh đang giữ hàng.",
      points: [
        "Mỗi lô có số lô, hạn dùng và số lượng riêng.",
        "Hệ thống cảnh báo khi tồn xuống dưới mức tối thiểu hoặc lô sắp hết hạn.",
        "Kiểm kê ghi số đếm thực tế, chênh lệch và lý do trước khi cập nhật tồn.",
        "Điều chuyển hàng giữa hai chi nhánh bằng phiếu, có xác nhận trước khi trừ và cộng kho.",
      ],
    },
    "ban-hang": {
      lead: "Quầy bán tìm thuốc, chọn lô còn hạn, áp giảm giá rồi xuất hóa đơn trong vài bước.",
      points: [
        "Tra cứu theo tên thuốc, mã hoặc hoạt chất ngay tại chi nhánh đang bán.",
        "Không bán thuốc hết hàng, ngừng bán hoặc đã hết hạn.",
        "Thanh toán tiền mặt, chuyển khoản hoặc thẻ; tiền mặt có dòng tiền khách đưa và tiền thừa.",
        "Hóa đơn lưu từng dòng: số lượng, giá bán, giá vốn và tồn trước sau khi bán.",
      ],
    },
    "khach-hang": {
      lead: "Khách mua lẻ và nhà cung cấp được lưu riêng, để quầy bán và bộ phận nhập hàng cùng dùng một nguồn dữ liệu.",
      points: [
        "Hồ sơ khách có mã, điện thoại, điểm tích lũy và tổng chi tiêu.",
        "Vai trò khách quyết định mức giảm giá và cách cộng điểm.",
        "Nhà cung cấp lưu người liên hệ, mã số thuế và trạng thái còn hợp tác hay không.",
        "Phiếu nhập gắn nhà cung cấp, chi nhánh nhận hàng, số lô và hạn dùng của từng dòng.",
      ],
    },
  };

  var ROLES = [
    ["CH", "Chủ hệ thống", "Toàn bộ chuỗi"],
    ["QL", "Quản lý chi nhánh", "Chi nhánh được giao"],
    ["DS", "Dược sĩ / Thu ngân", "Bán hàng & khách hàng"],
    ["NK", "Nhân viên kho", "Nhập, xuất & kiểm kho"],
  ];

  var REPORTS = {
    "7": {
      stats: [["Tổng doanh thu", "892,6 tr", "+18.4%"], ["Lợi nhuận gộp", "224,1 tr", "+11.2%"], ["Giá trị đơn TB", "286.000đ", "+5.7%"]],
      bars: [["Nguyễn Trãi", "186,4 tr", 100], ["Hai Bà Trưng", "164,2 tr", 88], ["Phan Xích Long", "138,7 tr", 74], ["Quang Trung", "109,5 tr", 59]],
    },
    "30": {
      stats: [["Tổng doanh thu", "3,42 tỷ", "+14.1%"], ["Lợi nhuận gộp", "846 tr", "+9.4%"], ["Giá trị đơn TB", "271.000đ", "+3.2%"]],
      bars: [["Nguyễn Trãi", "742 tr", 100], ["Hai Bà Trưng", "681 tr", 92], ["Phan Xích Long", "540 tr", 73], ["Quang Trung", "418 tr", 56]],
    },
    quarter: {
      stats: [["Tổng doanh thu", "9,86 tỷ", "+11.8%"], ["Lợi nhuận gộp", "2,41 tỷ", "+8.6%"], ["Giá trị đơn TB", "264.000đ", "+2.1%"]],
      bars: [["Nguyễn Trãi", "2,21 tỷ", 100], ["Hai Bà Trưng", "1,94 tỷ", 88], ["Phan Xích Long", "1,52 tỷ", 69], ["Quang Trung", "1,18 tỷ", 53]],
    },
  };

  function svg(name) {
    var p = {
      building: '<path d="M4 21V5a2 2 0 0 1 2-2h6v18"/><path d="M12 7h6a2 2 0 0 1 2 2v12"/><path d="M8 8h.01M8 12h.01M8 16h.01M16 11h.01M16 15h.01"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
      chart: '<path d="M3 3v18h18"/><path d="M7 14v4"/><path d="M12 9v9"/><path d="M17 5v13"/>',
      layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
      cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H6"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close: '<path d="M18 6 6 18M6 6l12 12"/>',
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (p[name] || "") + "</svg>";
  }

  function mark() {
    return '<span class="ph-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor"/></svg></span>';
  }

  function wordmark() {
    return mark() + '<span class="ph-word">Mạch <span>Dược</span></span>';
  }

  function canSeeReport(host) {
    var role = host.user && host.user.role;
    return role === "admin" || role === "manager" || role === "pharmacist" || role === "cashier";
  }

  function jump(label, target, cls) {
    return '<button type="button" class="' + (cls || "") + '" data-action="home-jump" data-target="' + target + '">' + label + "</button>";
  }

  function openBtn(label, modal, cls) {
    return '<button type="button" class="' + cls + '" data-action="home-open" data-modal="' + modal + '">' + label + "</button>";
  }

  function header(host) {
    var links = [
      ["Giải pháp", "features"],
      ["Phân quyền", "permissions"],
      ["Báo cáo", "reports"],
      ["Bảng giá", "pricing"],
      ["Khách hàng", "customers"],
    ].filter(function (item) { return item[1] !== "reports" || canSeeReport(host); })
      .map(function (item) { return jump(item[0], item[1]); }).join("");
    var enter = host.user
      ? '<button type="button" class="ph-btn" data-action="go" data-path="' + (host.user.role === "customer" ? "cua-hang" : "tong-quan") + '">' + (host.user.role === "customer" ? "Vào cửa hàng" : "Vào hệ thống") + "</button>"
      : openBtn("Đăng nhập", "login", "ph-text") + '<button type="button" class="ph-btn" data-action="go" data-path="dang-ky">Đăng ký tài khoản</button>';
    var menu = host.ui.homeMenu
      ? '<div class="ph-drawer">' + links + enter + "</div>"
      : "";
    return '<div class="ph-announce"><span>Hỗ trợ chuyển đổi dữ liệu và triển khai miễn phí cho chuỗi nhà thuốc</span>' +
      jump("Tìm hiểu ngay " + svg("arrow"), "features", "ph-announce-btn") + "</div>" +
      '<header class="ph-bar"><div class="ph-bar-in"><button type="button" class="ph-brand" data-action="home-jump" data-target="dau-trang">' + wordmark() + "</button>" +
      '<nav class="ph-nav">' + links + "</nav><div class=\"ph-bar-actions\">" + enter + "</div>" +
      '<button type="button" class="ph-burger" data-action="home-menu" aria-label="Mở menu">' + svg(host.ui.homeMenu ? "close" : "menu") + "</button></div>" + menu + "</header>";
  }

  function hero() {
    var bars = [46, 62, 54, 78, 70, 88, 64, 92].map(function (h) {
      return '<i style="height:' + h + '%"></i>';
    }).join("");
    return '<section class="ph-hero"><div class="ph-hero-copy"><p class="ph-pill"><i></i>Nền tảng vận hành nhà thuốc toàn diện</p>' +
      "<h1>Quản lý chuỗi nhà thuốc <em>dễ dàng hơn.</em></h1>" +
      "<p>Đồng bộ bán hàng, kho thuốc, nhân sự và báo cáo trên một nền tảng. Nắm bắt toàn bộ hoạt động của mọi chi nhánh, mọi lúc, mọi nơi.</p>" +
      '<div class="ph-hero-cta">' + '<button type="button" class="ph-btn lg" data-action="go" data-path="dang-ky">Đăng ký tài khoản ' + svg("arrow") + "</button>" +
      jump("Khám phá tính năng", "features", "ph-btn ghost lg") + "</div>" +
      '<ul class="ph-checks"><li>' + svg("check") + "Không cần thẻ tín dụng</li><li>" + svg("check") + "Hỗ trợ thiết lập 1:1</li></ul></div>" +
      '<aside class="ph-board"><div class="ph-float"><b>Chi nhánh hoạt động</b><strong>12 / 12</strong><span>Ổn định</span></div>' +
      '<div class="ph-window"><div class="ph-window-top"><span></span><span></span><span></span><em>Tổng quan hệ thống · Hôm nay</em></div>' +
      '<div class="ph-window-body"><aside><b>MẠCH DƯỢC</b><i class="on">Tổng quan</i><i>Chi nhánh</i><i>Kho hàng</i><i>Nhân viên</i><i>Báo cáo</i></aside>' +
      '<div><div class="ph-hello"><span>Xin chào, Minh Anh</span><b>12 chi nhánh</b></div><p class="ph-k">Tổng quan kinh doanh</p>' +
      '<div class="ph-stats"><div><span>Doanh thu</span><b>128,4 tr</b><em>+12,5%</em></div><div><span>Đơn hàng</span><b>1.248</b><em>+8,2%</em></div>' +
      '<div><span>Lợi nhuận</span><b>31,6 tr</b><em>+9,8%</em></div><div class="warn"><span>Sắp hết hạn</span><b>24</b><em>Cần xử lý</em></div></div>' +
      '<div class="ph-chart"><div><b>Doanh thu theo ngày</b><span>Đơn vị: triệu đồng</span><div class="ph-bars">' + bars + "</div></div>" +
      '<div class="ph-alert"><b>Cảnh báo hạn dùng</b><strong>24 sản phẩm cần xử lý</strong><p>Amoxicillin · 18 ngày</p><p>Vitamin C · 27 ngày</p></div></div></div></div></div>' +
      '<p class="ph-note">Minh họa giao diện điều hành</p></aside></section>';
  }

  function logos() {
    return '<section class="ph-logos"><p>Đồng hành cùng hơn <b>2.500+</b> nhà thuốc trên toàn quốc</p><div><span>AN TÂM PHARMA</span><span>MINH CHÂU</span><span>PHÚC KHANG</span><span>HEALTH+</span><span>TÂM ĐỨC</span></div></section>';
  }

  function featureById(id) {
    for (var i = 0; i < FEATURES.length; i++) {
      if (FEATURES[i][3] === id) return FEATURES[i];
    }
    return null;
  }

  function features() {
    var cards = FEATURES.map(function (item) {
      return '<button type="button" class="ph-card" data-action="home-feature" data-path="' + item[3] + '"><span class="ph-ico">' + svg(item[0]) + "</span><h3>" + item[1] + "</h3><p>" + item[2] + "</p>" +
        '<span class="ph-more">Tìm hiểu thêm ' + svg("arrow") + "</span></button>";
    }).join("");
    return '<section class="ph-section" id="features"><div class="ph-center"><p class="ph-kicker">Một nền tảng, toàn bộ vận hành</p>' +
      "<h2>Mọi công cụ nhà thuốc cần để tăng trưởng</h2><p>Từ quầy bán hàng đến văn phòng điều hành, Mạch Dược giúp mọi bộ phận phối hợp chính xác và hiệu quả.</p></div>" +
      '<div class="ph-grid">' + cards + "</div></section>";
  }

  function permissions() {
    var rows = ROLES.map(function (role) {
      return '<div class="ph-role"><b>' + role[0] + "</b><div><strong>" + role[1] + "</strong><span>" + role[2] + "</span></div></div>";
    }).join("");
    return '<section class="ph-section tint" id="permissions"><div class="ph-split"><div><p class="ph-kicker">Phân quyền linh hoạt</p>' +
      "<h2>Đúng người, đúng quyền, đúng dữ liệu</h2>" +
      "<p>Chủ động thiết lập quyền truy cập theo vai trò và phạm vi chi nhánh. Dữ liệu nhạy cảm luôn được bảo vệ, trong khi nhân viên vẫn làm việc liền mạch.</p>" +
      '<ul class="ph-checks dark"><li>' + svg("check") + "Tùy chỉnh hơn 60 quyền thao tác chi tiết</li><li>" + svg("check") + "Giới hạn dữ liệu theo từng chi nhánh</li><li>" + svg("check") + "Nhật ký hoạt động minh bạch, dễ truy vết</li><li>" + svg("check") + "Xác thực hai lớp và sao lưu tự động</li></ul></div>" +
      '<div class="ph-panel"><p>Cấu hình hệ thống</p><h3>Vai trò & quyền hạn</h3><button type="button" class="ph-add" tabindex="-1">+ Thêm vai trò</button>' +
      rows + '<div class="ph-secure"><b>Dữ liệu được bảo vệ</b><span>Theo tiêu chuẩn ISO 27001</span></div></div></div></section>';
  }

  function reports(host) {
    var key = REPORTS[host.ui.homeRange] ? host.ui.homeRange : "7";
    var pack = REPORTS[key];
    var tabs = [["7", "7 ngày"], ["30", "30 ngày"], ["quarter", "Quý"]].map(function (item) {
      return '<button type="button" class="' + (key === item[0] ? "on" : "") + '" data-action="home-range" data-value="' + item[0] + '">' + item[1] + "</button>";
    }).join("");
    var stats = pack.stats.map(function (item) {
      return "<div><span>" + item[0] + "</span><b>" + item[1] + "</b><em>" + item[2] + "</em></div>";
    }).join("");
    var bars = pack.bars.map(function (item) {
      return '<div class="ph-hbar"><span>' + item[0] + "</span><i><b style=\"width:" + item[2] + '%"></b></i><em>' + item[1] + "</em></div>";
    }).join("");
    return '<section class="ph-section" id="reports"><div class="ph-split flip"><div class="ph-report"><div class="ph-report-head"><div><p>Báo cáo bán hàng</p><h3>Hiệu quả theo chi nhánh</h3></div><div class="ph-tabs">' + tabs + "</div></div>" +
      '<div class="ph-report-stats">' + stats + "</div>" + bars + '<p class="ph-note">Số liệu minh họa trên trang giới thiệu</p></div><div><p class="ph-kicker">Báo cáo thông minh</p>' +
      "<h2>Ra quyết định từ dữ liệu thực</h2><p>Không cần tổng hợp bảng tính thủ công. Mọi chỉ số quan trọng đều được trực quan hóa và cập nhật theo thời gian thực.</p>" +
      '<div class="ph-metrics"><div><b>40+</b><span>Mẫu báo cáo</span></div><div><b>100%</b><span>Dữ liệu đồng bộ</span></div><div><b>24/7</b><span>Theo dõi từ xa</span></div><div><b>1 chạm</b><span>Xuất Excel / PDF</span></div></div></div></div></section>';
  }

  function customers() {
    return '<section class="ph-band" id="customers"><div class="ph-split"><div><p class="ph-kicker light">Vận hành thực tế</p>' +
      "<h2>Đơn giản cho nhân viên.<br>Mạnh mẽ cho nhà quản lý.</h2>" +
      "<p>Giao diện trực quan giúp đội ngũ làm quen nhanh chóng. Đội ngũ Mạch Dược đồng hành từ lúc nhập dữ liệu đến khi vận hành ổn định.</p>" +
      '<div class="ph-metrics light"><div><b>98%</b><span>Hài lòng sau triển khai</span></div><div><b>&lt; 3 ngày</b><span>Đưa hệ thống vào sử dụng</span></div></div></div>' +
      '<blockquote><p>“Tôi có thể theo dõi tất cả 8 nhà thuốc chỉ trên điện thoại, kể cả khi không có mặt tại cửa hàng.”</p><footer>Dược sĩ Nguyễn Minh Anh · Hệ thống An Tâm Pharma</footer></blockquote></div></section>';
  }

  function pricing(host) {
    var branches = (host.db.branches || []).filter(function (branch) { return branch.phone; });
    var phones = branches.map(function (branch) {
      return host.esc(branch.short || branch.name) + ": " + host.esc(branch.phone);
    }).join(" · ");
    return '<section class="ph-cta" id="pricing"><p class="ph-kicker">Bắt đầu ngay hôm nay</p><h2>Sẵn sàng vận hành hiệu quả hơn?</h2>' +
      "<p>Tạo tài khoản khách hàng để mua thuốc, hoặc đăng nhập nếu bạn đã có tài khoản quản lý nhà thuốc.</p>" +
      '<div class="ph-hero-cta center">' +
      (host.user
        ? '<button type="button" class="ph-btn lg" data-action="go" data-path="' + (host.user.role === "customer" ? "cua-hang" : "tong-quan") + '">Vào hệ thống</button>'
        : '<button type="button" class="ph-btn lg" data-action="go" data-path="dang-ky">Đăng ký tài khoản</button>' + openBtn("Đăng nhập hệ thống", "login", "ph-btn ghost lg")) +
      "</div><p class=\"ph-fine\">Xem thử các mục trên trang chủ mà không cần đăng nhập.</p>" +
      (phones ? '<p class="ph-fine">Chi nhánh đang mở · ' + phones + "</p>" : "") + "</section>";
  }

  function footer(host) {
    var columns = [
      ["Sản phẩm", [["Tính năng", "features"], ["Bảng giá", "pricing"], ["Phân quyền", "permissions"]].concat(canSeeReport(host) ? [["Báo cáo", "reports"]] : [])],
      ["Tài nguyên", [["Trung tâm trợ giúp", "pricing"], ["Hướng dẫn sử dụng", "features"], ["Kiến thức nhà thuốc", "customers"], ["Liên hệ", "pricing"]]],
      ["Pháp lý", [["Điều khoản sử dụng", "pricing"], ["Chính sách bảo mật", "pricing"], ["Tiêu chuẩn bảo mật", "permissions"], ["Đối tác", "customers"]]],
    ].map(function (col) {
      return "<div><p>" + col[0] + "</p>" + col[1].map(function (link) { return jump(link[0], link[1]); }).join("") + "</div>";
    }).join("");
    var phone = ((host.db.branches || [])[0] || {}).phone || "1900 6868";
    return '<footer class="ph-foot"><div class="ph-foot-grid"><div class="ph-foot-brand"><div class="ph-brand">' + wordmark() + "</div>" +
      "<p>Nền tảng quản lý đa chi nhánh giúp nhà thuốc vận hành minh bạch, chính xác và tăng trưởng bền vững.</p>" +
      "<b>Hotline: " + host.esc(phone) + " · support@machduoc.vn</b></div>" + columns + "</div>" +
      '<div class="ph-foot-end"><span>© 2026 Mạch Dược. Mọi quyền được bảo lưu.</span><span>Được phát triển cho ngành dược Việt Nam.</span></div></footer>';
  }

  function field(label, name, type, placeholder) {
    return '<label class="ph-field"><span>' + label + '</span><input name="' + name + '" type="' + type + '" placeholder="' + placeholder + '" required /></label>';
  }

  function loginSheet(host) {
    return '<form class="ph-sheet" data-form="home-login"><button type="button" class="ph-x" data-action="home-close" aria-label="Đóng">' + svg("close") + "</button>" +
      "<h2>Đăng nhập Mạch Dược</h2><p>Truy cập không gian quản lý nhà thuốc của bạn</p>" +
      (host.ui.error ? '<p class="ph-error">' + host.esc(host.ui.error) + "</p>" : "") +
      field("Email hoặc số điện thoại", "email", "email", "admin@pharmacare.vn") +
      '<label class="ph-field"><span>Mật khẩu</span><span class="ph-secret"><input name="password" type="password" placeholder="Nhập mật khẩu" required autocomplete="current-password" /><button type="button" class="ph-eye" data-action="show-password" aria-label="Hiện mật khẩu">Hiện</button></span></label>' +
      '<div class="ph-row"><label><input type="checkbox" name="remember" checked /> Ghi nhớ đăng nhập</label><button type="button" class="ph-link" data-action="go" data-path="quen-mat-khau">Quên mật khẩu?</button></div>' +
      '<button class="ph-btn block" type="submit">Đăng nhập</button>' +
      '<p class="ph-fine">Chưa có tài khoản? <button type="button" class="ph-link" data-action="go" data-path="dang-ky">Đăng ký tài khoản</button></p></form>';
  }

  function consultSheet(host) {
    if (host.ui.homeConsultOk) {
      return '<div class="ph-sheet"><button type="button" class="ph-x" data-action="home-close" aria-label="Đóng">' + svg("close") + "</button>" +
        "<h2>Đã nhận thông tin</h2><p>Chuyên gia sẽ liên hệ trong vòng 30 phút làm việc. Bạn cũng có thể đăng nhập nếu đã có tài khoản.</p>" +
        openBtn("Đăng nhập hệ thống", "login", "ph-btn block") + "</div>";
    }
    return '<form class="ph-sheet" data-form="home-consult"><button type="button" class="ph-x" data-action="home-close" aria-label="Đóng">' + svg("close") + "</button>" +
      "<h2>Đăng ký tư vấn miễn phí</h2><p>Chuyên gia sẽ liên hệ với bạn trong vòng 30 phút làm việc</p>" +
      (host.ui.error ? '<p class="ph-error">' + host.esc(host.ui.error) + "</p>" : "") +
      field("Họ và tên", "name", "text", "Nguyễn Minh Anh") +
      field("Số điện thoại", "phone", "tel", "09xx xxx xxx") +
      field("Tên nhà thuốc / chuỗi", "shop", "text", "Nhà thuốc An Tâm") +
      '<label class="ph-field"><span>Quy mô hiện tại</span><select name="size"><option>1 chi nhánh</option><option>2 - 5 chi nhánh</option><option>6 - 20 chi nhánh</option><option>Trên 20 chi nhánh</option></select></label>' +
      '<button class="ph-btn block" type="submit">Nhận tư vấn ngay</button>' +
      '<p class="ph-fine">Bằng cách đăng ký, bạn đồng ý để Mạch Dược liên hệ tư vấn. Khách mua lẻ có thể <button type="button" class="ph-link" data-action="go" data-path="dang-ky">tạo tài khoản khách</button>.</p></form>';
  }

  function featureSheet(host) {
    var found = featureById(host.ui.homeFeature);
    if (!found) {
      return '<article class="ph-sheet wide"><button type="button" class="ph-x" data-action="home-close" aria-label="Đóng">' + svg("close") + "</button><h2>Nội dung</h2><p>Không tìm thấy phần giới thiệu này.</p></article>";
    }
    var detail = FEATURE_DETAIL[found[3]] || { lead: found[2], points: [] };
    var points = detail.points.map(function (line) {
      return "<li>" + svg("check") + "<span>" + host.esc(line) + "</span></li>";
    }).join("");
    return '<article class="ph-sheet wide"><button type="button" class="ph-x" data-action="home-close" aria-label="Đóng">' + svg("close") + "</button>" +
      '<span class="ph-ico">' + svg(found[0]) + "</span><h2>" + host.esc(found[1]) + "</h2><p>" + host.esc(detail.lead) + "</p>" +
      '<ul class="ph-points">' + points + "</ul></article>";
  }

  function modal(host) {
    if (!host.ui.homeModal) return "";
    var sheet = host.ui.homeModal === "login" ? loginSheet(host) : host.ui.homeModal === "feature" ? featureSheet(host) : consultSheet(host);
    return '<div class="ph-modal"><button type="button" class="ph-backdrop" data-action="home-close" aria-label="Đóng"></button>' + sheet + "</div>";
  }

  function page(host) {
    return '<div class="home ph-site" id="dau-trang">' + header(host) + "<main>" + hero() + logos() + features() + permissions() + (canSeeReport(host) ? reports(host) : "") + customers() + pricing(host) + "</main>" + footer(host) + modal(host) + "</div>";
  }

  function handleClick(action, el, host) {
    if (action === "show-password") {
      var wrap = el.closest(".ph-secret, .control");
      var input = wrap && wrap.querySelector("input");
      if (!input) return true;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      el.textContent = show ? "Ẩn" : "Hiện";
      el.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      input.focus();
      return true;
    }
    if (action === "home-menu") {
      var y = window.scrollY;
      host.ui.homeMenu = !host.ui.homeMenu;
      host.render();
      window.scrollTo(0, y);
      return true;
    }
    if (action === "home-feature") {
      var yFeature = window.scrollY;
      host.ui.homeFeature = el.dataset.path || "";
      host.ui.homeModal = "feature";
      host.ui.homeNext = "";
      host.ui.homeMenu = false;
      host.ui.error = "";
      host.render();
      window.scrollTo(0, yFeature);
      return true;
    }
    if (action === "home-open") {
      var yOpen = window.scrollY;
      host.ui.homeModal = el.dataset.modal || "login";
      host.ui.homeNext = "";
      host.ui.homeMenu = false;
      host.ui.error = "";
      if (host.ui.homeModal !== "consult") host.ui.homeConsultOk = false;
      host.render();
      window.scrollTo(0, yOpen);
      return true;
    }
    if (action === "home-close") {
      var yClose = window.scrollY;
      host.ui.homeModal = null;
      host.ui.homeFeature = "";
      host.ui.homeNext = "";
      host.ui.error = "";
      host.render();
      window.scrollTo(0, yClose);
      return true;
    }
    if (action === "home-range") {
      if (!canSeeReport(host)) return true;
      var yRange = window.scrollY;
      host.ui.homeRange = el.dataset.value || "7";
      host.render();
      window.scrollTo(0, yRange);
      return true;
    }
    if (action === "home-jump") {
      var menuWasOpen = host.ui.homeMenu;
      host.ui.homeMenu = false;
      if (menuWasOpen) host.render();
      var id = el.dataset.target || "";
      if (id === "reports" && !canSeeReport(host)) return true;
      if (!id || id === "dau-trang") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return true;
      }
      var node = document.getElementById(id);
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  }

  root.PharmaHome = { page: page, handleClick: handleClick };
})(typeof window !== "undefined" ? window : globalThis);
