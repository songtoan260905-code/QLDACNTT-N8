-- Truy vấn thuốc, danh mục, nhà sản xuất và lô.
-- Khớp với js/medicines.js và js/catalog.js.

-- Danh sách thuốc: từ khóa, danh mục, nhà sản xuất, trạng thái, phân trang.
SELECT
  m.id, m.code, m.name, m.active_ingredient, m.strength, m.stock, m.min_stock,
  m.cost_price, m.sale_price, m.status, m.branch_id,
  c.name AS category_name,
  p.name AS manufacturer_name,
  u.name AS unit_name,
  f.name AS dosage_form
FROM medicines m
JOIN drug_categories c ON c.id = m.category_id
JOIN manufacturers p ON p.id = m.manufacturer_id
JOIN measure_units u ON u.id = m.unit_id
JOIN dosage_forms f ON f.id = m.dosage_form_id
WHERE (
    :keyword = ''
    OR LOWER(m.name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(m.code) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(m.active_ingredient) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(m.strength) LIKE '%' || LOWER(:keyword) || '%'
  )
  AND (:category_id = 'all' OR m.category_id = :category_id)
  AND (:manufacturer_id = 'all' OR m.manufacturer_id = :manufacturer_id)
  AND (:status = 'all' OR m.status = :status)
  AND (:branch_id = 'all' OR m.branch_id = :branch_id)
ORDER BY m.name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Lô của một thuốc.
SELECT id, batch_no, expiry, qty
FROM medicine_lots
WHERE medicine_id = :medicine_id
ORDER BY expiry;

-- Hóa đơn đang gắn thuốc, chặn xóa.
SELECT COUNT(*) AS sales
FROM sale_lines
WHERE medicine_id = :medicine_id;

-- Danh mục và số thuốc, có tìm kiếm.
SELECT c.id, c.name, COUNT(m.id) AS medicines
FROM drug_categories c
LEFT JOIN medicines m ON m.category_id = c.id
WHERE :keyword = '' OR LOWER(c.name) LIKE '%' || LOWER(:keyword) || '%'
GROUP BY c.id, c.name
ORDER BY c.name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Nhà sản xuất theo trạng thái.
SELECT p.id, p.name, p.phone, p.country, p.status, COUNT(m.id) AS medicines
FROM manufacturers p
LEFT JOIN medicines m ON m.manufacturer_id = p.id
WHERE (:status = 'all' OR p.status = :status)
  AND (
    :keyword = ''
    OR LOWER(p.name) LIKE '%' || LOWER(:keyword) || '%'
    OR p.phone LIKE '%' || :keyword || '%'
  )
GROUP BY p.id, p.name, p.phone, p.country, p.status
ORDER BY p.name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Đơn vị tính đang được gán.
SELECT u.id, u.name, u.builtin, COUNT(m.id) AS medicines
FROM measure_units u
LEFT JOIN medicines m ON m.unit_id = u.id
GROUP BY u.id, u.name, u.builtin
ORDER BY u.name;

-- Thuốc ngừng kinh doanh không được đưa vào quầy bán.
SELECT id, code, name, sale_price, stock
FROM medicines
WHERE status = 'active'
  AND stock > 0
  AND branch_id = :branch_id;
