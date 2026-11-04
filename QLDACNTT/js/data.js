/* Dữ liệu mẫu để chạy thử. Mật khẩu để dạng chữ; ứng dụng tự băm khi mở. */
(function () {
  function day(offset) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function hoursAgo(hours) {
    return new Date(Date.now() - hours * 3600000).toISOString();
  }

  function daysUntil(iso) {
    const start = new Date(day(0) + "T12:00:00");
    const end = new Date(String(iso || "") + "T12:00:00");
    return Math.round((end - start) / 86400000);
  }

  function sampleNotes(db) {
    db = db || {};
    const sale = (db.sales || [])[0] || {};
    const receipt = (db.receipts || [])[0] || {};
    const vitamin = (db.medicines || []).find((item) => item.id === "med-vitc") || {};
    const stamp = day(0).replace(/-/g, "");
    const saleCode = sale.code || ("HD" + stamp + "-001");
    const receiptCode = receipt.code || ("PN" + stamp + "-001");
    const expiry = vitamin.expiry || day(27);
    const left = daysUntil(expiry);
    const expiryTitle = left < 0 ? "Đã hết hạn" : "Sắp hết hạn";
    const expiryBody = left < 0
      ? "Vitamin C lô L26111 tại Thủ Đức đã hết hạn " + expiry + "."
      : "Vitamin C còn " + left + " ngày, hạn " + expiry + ", lô L26111 tại Thủ Đức.";
    return [
      {
        id: "note-exp-vitc",
        type: "expiry",
        title: expiryTitle,
        body: expiryBody,
        at: hoursAgo(0.5),
        read: false,
        priority: left < 0 ? "high" : "medium",
      },
      {
        id: "note-sale",
        type: "system",
        title: "Đã thanh toán hóa đơn",
        body: "Hóa đơn " + saleCode + " của Nguyễn Văn Nam, tiền mặt, tổng 4.950 đồng. Tồn sau bán vẫn trên mức tối thiểu.",
        at: sale.at || hoursAgo(1),
        read: false,
        priority: "low",
      },
      {
        id: "note-receipt",
        type: "stock",
        title: "Đã nhập kho",
        body: "Phiếu " + receiptCode + " đã cộng tồn: Paracetamol 8 → 58, Amoxicillin 40 → 60.",
        at: receipt.confirmedAt || hoursAgo(4),
        read: false,
        priority: "low",
      },
      {
        id: "note-low-para",
        type: "stock",
        title: "Tồn kho dưới mức tối thiểu",
        body: "Paracetamol còn 8, dưới mức tối thiểu 20. Đã được phiếu nhập xử lý.",
        at: hoursAgo(8),
        read: true,
        priority: "high",
      },
      {
        id: "note-transfer",
        type: "system",
        title: "Điều chuyển nhân viên",
        body: "Phạm Minh Khoa đã được điều chuyển từ Thủ Đức về Quận 1.",
        at: hoursAgo(20),
        read: true,
        priority: "low",
      },
    ];
  }

  function buildSeed() {
    const today = day(0).replace(/-/g, "");
    const near = day(27);
    const paraOld = day(200);
    const paraNew = day(384);
    const amoxOld = day(154);
    const amoxNew = day(220);
    return {
      branches: [
        {
          id: "br-q1",
          name: "PharmaCare Quận 1",
          short: "Quận 1",
          address: "12 Nguyễn Huệ, Quận 1, TP.HCM",
          phone: "0901234567",
          hours: "08:00 – 21:00",
          email: "q1@pharmacare.vn",
          contact: "Trần Thu Hà",
          manager: "Trần Thu Hà",
          status: "open",
        },
        {
          id: "br-td",
          name: "PharmaCare Thủ Đức",
          short: "Thủ Đức",
          address: "15 Võ Văn Ngân, TP. Thủ Đức",
          phone: "0905556677",
          hours: "07:30 – 22:00",
          email: "thuduc@pharmacare.vn",
          contact: "Lê Quốc Bảo",
          manager: "",
          status: "open",
        },
      ],
      categories: [
        { id: "cat-pain", name: "Giảm đau hạ sốt" },
        { id: "cat-abx", name: "Kháng sinh" },
        { id: "cat-vit", name: "Vitamin" },
      ],
      manufacturers: [
        { id: "mk-dhg", name: "Dược Hậu Giang", phone: "02923891433", country: "Việt Nam", status: "active" },
        { id: "mk-imx", name: "Imexpharm", phone: "02773851234", country: "Việt Nam", status: "active" },
      ],
      units: [],
      dosageForms: [],
      medicines: [
        {
          id: "med-para",
          name: "Paracetamol",
          code: "T0001",
          sku: "T0001",
          activeIngredient: "Paracetamol",
          strength: "500mg",
          dosageFormId: "f-vien",
          dosageForm: "Viên nén",
          categoryId: "cat-pain",
          category: "Giảm đau hạ sốt",
          unitId: "u-vien",
          unit: "Viên",
          manufacturerId: "mk-dhg",
          supplier: "Dược Hậu Giang",
          cost: 800,
          price: 1500,
          minStock: 20,
          stock: 56,
          expiry: paraOld,
          batch: "L26081",
          branchId: "br-q1",
          status: "active",
          lots: [
            { id: "lot-para-old", batch: "L26081", expiry: paraOld, qty: 6 },
            { id: "lot-para-new", batch: "L26101", expiry: paraNew, qty: 50 },
          ],
        },
        {
          id: "med-amox",
          name: "Amoxicillin",
          code: "T0002",
          sku: "T0002",
          activeIngredient: "Amoxicillin",
          strength: "500mg",
          dosageFormId: "f-nang",
          dosageForm: "Viên nang",
          categoryId: "cat-abx",
          category: "Kháng sinh",
          unitId: "u-vien",
          unit: "Viên",
          manufacturerId: "mk-imx",
          supplier: "Imexpharm",
          cost: 1200,
          price: 2500,
          minStock: 15,
          stock: 59,
          expiry: amoxOld,
          batch: "L26032",
          branchId: "br-q1",
          status: "active",
          lots: [
            { id: "lot-amox-old", batch: "L26032", expiry: amoxOld, qty: 39 },
            { id: "lot-amox-new", batch: "L26102", expiry: amoxNew, qty: 20 },
          ],
        },
        {
          id: "med-vitc",
          name: "Vitamin C",
          code: "T0003",
          sku: "T0003",
          activeIngredient: "Acid ascorbic",
          strength: "500mg",
          dosageFormId: "f-vien",
          dosageForm: "Viên nén",
          categoryId: "cat-vit",
          category: "Vitamin",
          unitId: "u-vien",
          unit: "Viên",
          manufacturerId: "mk-dhg",
          supplier: "Dược Hậu Giang",
          cost: 600,
          price: 1200,
          minStock: 10,
          stock: 30,
          expiry: near,
          batch: "L26111",
          branchId: "br-td",
          status: "active",
          lots: [
            { id: "lot-vitc", batch: "L26111", expiry: near, qty: 30 },
          ],
        },
      ],
      suppliers: [
        {
          id: "ncc-mn",
          code: "NCC0001",
          name: "Công ty Dược phẩm Miền Nam",
          contact: "Võ Anh Dũng",
          phone: "0909888777",
          email: "dung@duocmiennam.vn",
          taxCode: "0312345678",
          address: "88 Cộng Hòa, Tân Bình, TP.HCM",
          note: "Giao trong ngày",
          status: "active",
          createdAt: hoursAgo(6),
        },
      ],
      receipts: [
        {
          id: "pn-q1",
          code: "PN" + today + "-001",
          supplierId: "ncc-mn",
          branchId: "br-q1",
          note: "Nhập bổ sung tuần này",
          status: "confirmed",
          createdBy: "Nguyễn Minh Anh",
          at: hoursAgo(5),
          confirmedAt: hoursAgo(4),
          total: 64000,
          lines: [
            {
              key: "ln-para",
              medicineId: "med-para",
              name: "Paracetamol",
              unit: "Viên",
              qty: 50,
              cost: 800,
              batch: "L26101",
              expiry: paraNew,
              amount: 40000,
              stockBefore: 8,
              stockAfter: 58,
            },
            {
              key: "ln-amox",
              medicineId: "med-amox",
              name: "Amoxicillin",
              unit: "Viên",
              qty: 20,
              cost: 1200,
              batch: "L26102",
              expiry: amoxNew,
              amount: 24000,
              stockBefore: 40,
              stockAfter: 60,
            },
          ],
        },
      ],
      sales: [
        {
          id: "hd-q1",
          code: "HD" + today + "-001",
          branchId: "br-q1",
          customer: "Nguyễn Văn Nam",
          customerPhone: "0988123456",
          customerId: "kh-nam",
          customerRoleId: "member",
          pointsEarned: 0,
          spendCounted: true,
          cashier: "Phạm Minh Khoa",
          pay: "cash",
          payStatus: "received",
          status: "paid",
          at: hoursAgo(1),
          subtotal: 5500,
          discountMode: "percent",
          discountCode: "",
          discountLabel: "Giảm 10%",
          discountAmount: 550,
          total: 4950,
          tendered: 10000,
          changeAmount: 5050,
          transferRef: "",
          bankName: "",
          bankAccount: "",
          bankOwner: "",
          lines: [
            {
              medicineId: "med-para",
              name: "Paracetamol",
              qty: 2,
              price: 1500,
              cost: 800,
              amount: 3000,
              batch: "L26081",
              stockBefore: 58,
              stockAfter: 56,
            },
            {
              medicineId: "med-amox",
              name: "Amoxicillin",
              qty: 1,
              price: 2500,
              cost: 1200,
              amount: 2500,
              batch: "L26032",
              stockBefore: 60,
              stockAfter: 59,
            },
          ],
        },
      ],
      customers: [
        {
          id: "kh-nam",
          code: "KH0001",
          name: "Nguyễn Văn Nam",
          phone: "0988123456",
          email: "nam.nguyen@gmail.com",
          address: "15 Lê Lợi, Quận 1, TP.HCM",
          birthday: "",
          roleId: "member",
          branchId: "br-q1",
          points: 0,
          totalSpend: 4950,
          status: "active",
          note: "Mua thuốc cảm tại quầy",
          accountUserId: "u-nam",
          createdAt: hoursAgo(48),
        },
        {
          id: "kh-hoa",
          code: "KH0002",
          name: "Lê Thị Hoa",
          phone: "0909888777",
          email: "hoa.le@gmail.com",
          address: "88 Võ Văn Tần, Quận 3, TP.HCM",
          birthday: "",
          roleId: "wholesale",
          branchId: "br-q1",
          points: 40,
          totalSpend: 860000,
          status: "active",
          note: "Nhà thuốc tư nhân lấy sỉ",
          accountUserId: "u-hoa",
          createdAt: hoursAgo(72),
        },
        {
          id: "kh-bao",
          code: "KH0003",
          name: "Trần Quốc Bảo",
          phone: "0912345678",
          email: "bao.tran@gmail.com",
          address: "4 Kha Vạn Cân, Thủ Đức",
          birthday: "",
          roleId: "loyal",
          branchId: "br-td",
          points: 80,
          totalSpend: 620000,
          status: "active",
          note: "",
          accountUserId: "u-bao",
          createdAt: hoursAgo(120),
        },
        {
          id: "kh-lan",
          code: "KH0004",
          name: "Phạm Thị Lan",
          phone: "0933555666",
          email: "",
          address: "",
          birthday: "",
          roleId: "retail",
          branchId: "br-q1",
          points: 0,
          totalSpend: 0,
          status: "inactive",
          note: "Ngừng chăm sóc",
          createdAt: hoursAgo(200),
        },
      ],
      stocktakes: [],
      transfers: [],
      notifications: [],
      users: [
        {
          id: "u1",
          name: "Nguyễn Minh Anh",
          email: "admin@pharmacare.vn",
          password: "admin123",
          role: "admin",
          branchId: "all",
          phone: "",
          title: "Quản trị hệ thống",
          status: "active",
        },
        {
          id: "u-ha",
          name: "Trần Thu Hà",
          email: "ha.q1@pharmacare.vn",
          password: "Quanly123",
          role: "manager",
          branchId: "br-q1",
          phone: "0903111222",
          title: "Quản lý",
          status: "active",
        },
        {
          id: "u-khoa",
          name: "Phạm Minh Khoa",
          email: "khoa.q1@pharmacare.vn",
          password: "Duocsi123",
          role: "pharmacist",
          branchId: "br-q1",
          phone: "0918222333",
          title: "Dược sĩ",
          status: "active",
          transfers: [
            { at: hoursAgo(20), from: "br-td", to: "br-q1", by: "u1", kind: "transfer" },
            { at: hoursAgo(48), from: "br-q1", to: "br-td", by: "u1", kind: "transfer" },
          ],
        },
        {
          id: "u-tuyen",
          name: "Ngô Thanh Tuyền",
          email: "tuyen.td@pharmacare.vn",
          password: "Thungan123",
          role: "cashier",
          branchId: "br-td",
          phone: "0933444555",
          title: "Thu ngân",
          status: "active",
        },
        {
          id: "u-nam",
          name: "Nguyễn Văn Nam",
          email: "nam.nguyen@gmail.com",
          password: "Khach123",
          role: "customer",
          branchId: "br-q1",
          phone: "0988123456",
          title: "Khách hàng",
          status: "active",
          customerId: "kh-nam",
        },
        {
          id: "u-hoa",
          name: "Lê Thị Hoa",
          email: "hoa.le@gmail.com",
          password: "Khach123",
          role: "customer",
          branchId: "br-q1",
          phone: "0909888777",
          title: "Khách hàng",
          status: "active",
          customerId: "kh-hoa",
        },
        {
          id: "u-bao",
          name: "Trần Quốc Bảo",
          email: "bao.tran@gmail.com",
          password: "Khach123",
          role: "customer",
          branchId: "br-td",
          phone: "0912345678",
          title: "Khách hàng",
          status: "active",
          customerId: "kh-bao",
        },
      ],
      settings: { emailAlert: true, stockAlert: true, expiryAlert: true },
    };
  }

  function createSeed() {
    const db = buildSeed();
    db.notifications = sampleNotes(db);
    return db;
  }

  window.PharmaSeed = { createSeed, day, sampleNotes };
})();
