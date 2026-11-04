-- Truy vấn báo cáo (task 282–291).
-- Hóa đơn đã hủy và phiếu nhập chưa xác nhận không tính vào tổng.
-- Khớp với js/reports.js.

-- 282. Doanh thu một ngày.
SELECT
  code,
  customer_name,
  cashier_name,
  branch_id,
  sold_at,
  total_amount
FROM v_paid_invoices
WHERE CAST(sold_at AS DATE) = :sold_on
  AND (:branch_id = 'all' OR branch_id = :branch_id)
ORDER BY sold_at DESC;

SELECT
  COUNT(*) AS orders,
  COALESCE(SUM(total_amount), 0) AS revenue
FROM v_paid_invoices
WHERE CAST(sold_at AS DATE) = :sold_on
  AND (:branch_id = 'all' OR branch_id = :branch_id);

-- 283. Doanh thu từng ngày trong tháng, dùng cho biểu đồ và bảng.
SELECT
  CAST(sold_at AS DATE) AS sold_on,
  COUNT(*) AS orders,
  COALESCE(SUM(total_amount), 0) AS revenue,
  COALESCE(SUM(discount_amount), 0) AS discount_amount
FROM v_paid_invoices
WHERE STRFTIME('%Y-%m', sold_at) = :year_month
  AND (:branch_id = 'all' OR branch_id = :branch_id)
GROUP BY CAST(sold_at AS DATE)
ORDER BY sold_on;

-- Lợi nhuận gộp của tháng: mỗi hóa đơn tính một lần, trừ đúng khoản giảm giá của hóa đơn đó.
SELECT COALESCE(SUM(profit), 0) AS gross_profit
FROM (
  SELECT
    i.id,
    COALESCE(SUM((l.unit_price - l.cost_price) * l.qty), 0) - i.discount_amount AS profit
  FROM v_paid_invoices i
  LEFT JOIN invoice_lines l ON l.invoice_id = i.id
  WHERE STRFTIME('%Y-%m', i.sold_at) = :year_month
    AND (:branch_id = 'all' OR i.branch_id = :branch_id)
  GROUP BY i.id, i.discount_amount
) AS invoice_profit;

-- 284. Doanh thu theo chi nhánh để so sánh trong một tháng.
SELECT
  b.id,
  b.short_name,
  COUNT(i.id) AS orders,
  COALESCE(SUM(i.total_amount), 0) AS revenue
FROM branches b
LEFT JOIN v_paid_invoices i
  ON i.branch_id = b.id
 AND STRFTIME('%Y-%m', i.sold_at) = :year_month
WHERE :branch_id = 'all' OR b.id = :branch_id
GROUP BY b.id, b.short_name
ORDER BY revenue DESC, b.short_name;

-- 285. Doanh thu theo nhân viên (tên thu ngân trên hóa đơn).
SELECT
  cashier_name,
  branch_id,
  COUNT(*) AS orders,
  COALESCE(SUM(total_amount), 0) AS revenue
FROM v_paid_invoices
WHERE STRFTIME('%Y-%m', sold_at) = :year_month
  AND (:branch_id = 'all' OR branch_id = :branch_id)
  AND (:cashier_name = '' OR cashier_name = :cashier_name)
GROUP BY cashier_name, branch_id
ORDER BY revenue DESC, cashier_name;

-- 286. Số lượng thuốc bán ra, gom theo thuốc.
SELECT
  m.id,
  m.name,
  COALESCE(SUM(l.qty), 0) AS qty,
  COALESCE(SUM(l.amount), 0) AS line_amount
FROM v_paid_invoice_lines l
JOIN medicines m ON m.id = l.medicine_id
WHERE STRFTIME('%Y-%m', l.sold_at) = :year_month
  AND (:branch_id = 'all' OR l.branch_id = :branch_id)
GROUP BY m.id, m.name
ORDER BY m.name;

-- 287. Thuốc bán chạy theo số lượng.
SELECT
  m.id,
  m.name,
  COALESCE(SUM(l.qty), 0) AS qty,
  COALESCE(SUM(l.amount), 0) AS line_amount
FROM v_paid_invoice_lines l
JOIN medicines m ON m.id = l.medicine_id
WHERE STRFTIME('%Y-%m', l.sold_at) = :year_month
  AND (:branch_id = 'all' OR l.branch_id = :branch_id)
GROUP BY m.id, m.name
ORDER BY qty DESC, m.name
LIMIT :limit_rows;

-- 287. Cùng danh sách, sắp theo doanh thu dòng hàng.
SELECT
  m.id,
  m.name,
  COALESCE(SUM(l.qty), 0) AS qty,
  COALESCE(SUM(l.amount), 0) AS line_amount
FROM v_paid_invoice_lines l
JOIN medicines m ON m.id = l.medicine_id
WHERE STRFTIME('%Y-%m', l.sold_at) = :year_month
  AND (:branch_id = 'all' OR l.branch_id = :branch_id)
GROUP BY m.id, m.name
ORDER BY line_amount DESC, m.name
LIMIT :limit_rows;

-- 288. Phiếu nhập đã xác nhận và tổng tiền nhập.
SELECT
  r.code,
  s.name AS supplier_name,
  r.branch_id,
  r.confirmed_at,
  r.total_amount
FROM v_confirmed_receipts r
LEFT JOIN suppliers s ON s.id = r.supplier_id
WHERE STRFTIME('%Y-%m', COALESCE(r.confirmed_at, r.created_at)) = :year_month
  AND (:branch_id = 'all' OR r.branch_id = :branch_id)
ORDER BY r.confirmed_at DESC;

SELECT COALESCE(SUM(total_amount), 0) AS purchase_total, COUNT(*) AS receipt_count
FROM v_confirmed_receipts
WHERE STRFTIME('%Y-%m', COALESCE(confirmed_at, created_at)) = :year_month
  AND (:branch_id = 'all' OR branch_id = :branch_id);

-- 289. Tồn kho phân theo chi nhánh.
SELECT
  b.id,
  b.short_name,
  COUNT(m.id) AS sku_count,
  COALESCE(SUM(m.stock), 0) AS stock_qty,
  COALESCE(SUM(m.stock * m.cost_price), 0) AS stock_value
FROM branches b
LEFT JOIN medicines m ON m.branch_id = b.id
WHERE :branch_id = 'all' OR b.id = :branch_id
GROUP BY b.id, b.short_name
ORDER BY b.short_name;

-- 290. Lô sắp hết hạn hoặc đã hết hạn, sắp theo ngày hết hạn.
-- :warn_until = ngày đối chiếu cộng số ngày cảnh báo.
SELECT
  m.name,
  l.batch_no,
  m.branch_id,
  l.expiry,
  l.qty
FROM medicine_lots l
JOIN medicines m ON m.id = l.medicine_id
WHERE l.expiry <= :warn_until
  AND (:branch_id = 'all' OR m.branch_id = :branch_id)
ORDER BY l.expiry, m.name;

-- 291. Thuốc còn tồn dưới mức tối thiểu.
SELECT
  id,
  name,
  branch_id,
  stock,
  min_stock,
  (min_stock - stock) AS shortage
FROM medicines
WHERE min_stock > 0
  AND stock < min_stock
  AND (:branch_id = 'all' OR branch_id = :branch_id)
ORDER BY shortage DESC, name;
