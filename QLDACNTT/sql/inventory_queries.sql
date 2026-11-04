-- Truy vấn tồn kho, lô, hạn dùng, kiểm kê, chuyển kho và cảnh báo.
-- Khớp với js/inventory.js.

-- Tồn kho: tìm theo mã hoặc tên, lọc chi nhánh và danh mục.
SELECT m.id, m.code, m.name, m.category_id, m.branch_id, m.stock, m.min_stock, u.name AS unit_name
FROM medicines m
JOIN measure_units u ON u.id = m.unit_id
WHERE (:keyword = ''
    OR LOWER(m.name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(m.code) LIKE '%' || LOWER(:keyword) || '%')
  AND (:branch_id = 'all' OR m.branch_id = :branch_id)
  AND (:category_id = 'all' OR m.category_id = :category_id)
ORDER BY m.name;

-- Đối chiếu số lượng tồn với tổng các lô.
SELECT m.id, m.name, m.stock,
       COALESCE(SUM(l.qty), 0) AS lot_sum
FROM medicines m
LEFT JOIN medicine_lots l ON l.medicine_id = m.id
WHERE m.id = :medicine_id
GROUP BY m.id, m.name, m.stock;

-- Danh sách lô và số lượng từng lô.
SELECT m.id, m.code, m.name, m.branch_id, l.batch_no, l.expiry, l.qty,
       m.strength, u.name AS unit_name, k.name AS manufacturer_name
FROM medicines m
JOIN medicine_lots l ON l.medicine_id = m.id
JOIN measure_units u ON u.id = m.unit_id
JOIN manufacturers k ON k.id = m.manufacturer_id
WHERE (:branch_id = 'all' OR m.branch_id = :branch_id)
  AND (:category_id = 'all' OR m.category_id = :category_id)
  AND (:keyword = ''
    OR LOWER(m.name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(m.code) LIKE '%' || LOWER(:keyword) || '%')
ORDER BY m.name, l.expiry;

-- Hạn dùng sắp xếp tăng dần, đánh dấu lô trong khoảng cảnh báo.
SELECT m.id, m.name, m.code, l.batch_no, l.expiry, l.qty,
       (l.expiry - :today) AS days_left
FROM medicines m
JOIN medicine_lots l ON l.medicine_id = m.id
WHERE l.expiry IS NOT NULL
ORDER BY l.expiry;

-- Mốc cảnh báo hạn dùng.
SELECT expiry_warn_days
FROM alert_policy
WHERE id = 'default';

UPDATE alert_policy
SET expiry_warn_days = :days
WHERE id = 'default'
  AND :days BETWEEN 1 AND 365;

-- Tạo phiếu kiểm kê và chụp số lượng hệ thống.
INSERT INTO stocktakes (id, code, branch_id, note, status, created_by, created_at)
VALUES (:id, :code, :branch_id, :note, 'draft', :created_by, :created_at);

INSERT INTO stocktake_lines (id, stocktake_id, medicine_id, system_qty)
SELECT :line_id, :stocktake_id, id, stock
FROM medicines
WHERE branch_id = :branch_id;

-- Nhập số lượng thực tế và tính chênh lệch.
UPDATE stocktake_lines
SET actual_qty = :actual_qty,
    variance_qty = :actual_qty - system_qty
WHERE stocktake_id = :stocktake_id
  AND medicine_id = :medicine_id;

UPDATE stocktakes
SET status = 'counted'
WHERE id = :stocktake_id
  AND status IN ('draft', 'counted')
  AND NOT EXISTS (
    SELECT 1 FROM stocktake_lines
    WHERE stocktake_id = :stocktake_id AND actual_qty IS NULL
  );

-- Ghi nhận nguyên nhân cho dòng lệch và lưu biên bản.
UPDATE stocktake_lines
SET reason_code = :reason_code
WHERE stocktake_id = :stocktake_id
  AND medicine_id = :medicine_id
  AND variance_qty <> 0;

UPDATE stocktakes
SET minute = :minute,
    status = 'minuted'
WHERE id = :stocktake_id
  AND status = 'counted';

-- Cập nhật tồn sau khi xác nhận kiểm kê.
UPDATE medicines
SET stock = stocktake_lines.actual_qty
FROM stocktake_lines
WHERE stocktake_lines.stocktake_id = :stocktake_id
  AND medicines.id = stocktake_lines.medicine_id;

UPDATE stocktakes
SET status = 'posted',
    posted_at = :posted_at
WHERE id = :stocktake_id
  AND status = 'minuted';

-- Phiếu chuyển giữa hai chi nhánh.
INSERT INTO transfers (id, code, from_branch_id, to_branch_id, note, status, created_by, created_at)
VALUES (:id, :code, :from_branch_id, :to_branch_id, :note, 'draft', :created_by, :created_at);

INSERT INTO transfer_lines (id, transfer_id, medicine_id, batch_no, qty)
VALUES (:id, :transfer_id, :medicine_id, :batch_no, :qty);

-- Xác nhận chuyển: trừ nơi gửi, cộng nơi nhận.
UPDATE medicines
SET stock = stock - :qty
WHERE id = :source_medicine_id
  AND branch_id = :from_branch_id
  AND stock >= :qty;

UPDATE medicines
SET stock = stock + :qty
WHERE id = :dest_medicine_id
  AND branch_id = :to_branch_id;

UPDATE transfers
SET status = 'confirmed',
    confirmed_at = :confirmed_at
WHERE id = :transfer_id
  AND status = 'draft';

-- Cảnh báo sắp hết, dưới tối thiểu và sắp hết hạn.
SELECT id, name, branch_id, stock, min_stock, 'low' AS alert_code
FROM medicines
WHERE stock > 0 AND min_stock > 0 AND stock = min_stock
UNION ALL
SELECT id, name, branch_id, stock, min_stock, 'under'
FROM medicines
WHERE stock > 0 AND min_stock > 0 AND stock < min_stock
UNION ALL
SELECT id, name, branch_id, stock, min_stock, 'out'
FROM medicines
WHERE stock <= 0
UNION ALL
SELECT m.id, m.name, m.branch_id, m.stock, m.min_stock,
       CASE WHEN MIN(l.expiry) < :today THEN 'expired' ELSE 'soon' END
FROM medicines m
JOIN medicine_lots l ON l.medicine_id = m.id
GROUP BY m.id, m.name, m.branch_id, m.stock, m.min_stock
HAVING MIN(l.expiry) <= :warn_until;
