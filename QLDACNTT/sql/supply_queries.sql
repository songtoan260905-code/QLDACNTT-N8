-- Truy vấn nhà cung cấp và phiếu nhập.
-- Khớp với js/suppliers.js và js/receipts.js.

-- Danh sách nhà cung cấp: từ khóa, trạng thái, phân trang.
SELECT id, code, name, phone, email, address, contact, status
FROM suppliers
WHERE (:status = 'all' OR status = :status)
  AND (
    :keyword = ''
    OR LOWER(name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(code) LIKE '%' || LOWER(:keyword) || '%'
    OR phone LIKE '%' || :keyword || '%'
    OR LOWER(email) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(address) LIKE '%' || LOWER(:keyword) || '%'
  )
ORDER BY name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Chi tiết một nhà cung cấp.
SELECT id, code, name, phone, email, address, contact, tax_code, note, status, created_at
FROM suppliers
WHERE id = :supplier_id;

-- Lịch sử nhập hàng của nhà cung cấp.
SELECT r.id, r.code, r.status, r.total_amount, r.created_at, b.name AS branch_name
FROM goods_receipts r
JOIN branches b ON b.id = r.branch_id
WHERE r.supplier_id = :supplier_id
ORDER BY r.created_at DESC;

-- Chặn xóa nhà cung cấp khi còn phiếu nhập.
SELECT COUNT(*) AS receipts
FROM goods_receipts
WHERE supplier_id = :supplier_id;

-- Danh sách phiếu nhập: từ khóa, trạng thái, chi nhánh, phân trang.
SELECT
  r.id, r.code, r.status, r.total_amount, r.created_at,
  s.name AS supplier_name,
  b.name AS branch_name,
  (SELECT COUNT(*) FROM goods_receipt_lines l WHERE l.receipt_id = r.id) AS line_count
FROM goods_receipts r
JOIN suppliers s ON s.id = r.supplier_id
JOIN branches b ON b.id = r.branch_id
WHERE (:status = 'all' OR r.status = :status)
  AND (:branch_id = 'all' OR r.branch_id = :branch_id)
  AND (
    :keyword = ''
    OR LOWER(r.code) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(s.name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(r.note) LIKE '%' || LOWER(:keyword) || '%'
  )
ORDER BY r.created_at DESC
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Chi tiết phiếu và các dòng thuốc.
SELECT
  l.medicine_id, m.name, m.unit, l.qty, l.cost_price, l.amount,
  l.batch_no, l.expiry, l.stock_before, l.stock_after
FROM goods_receipt_lines l
JOIN medicines m ON m.id = l.medicine_id
WHERE l.receipt_id = :receipt_id
ORDER BY m.name;

-- Xác nhận nhập hàng.
UPDATE goods_receipts
SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
WHERE id = :receipt_id AND status = 'draft';

-- Hủy phiếu nhập.
UPDATE goods_receipts
SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
WHERE id = :receipt_id AND status IN ('draft', 'confirmed');

-- Cộng tồn kho sau khi xác nhận.
UPDATE medicines
SET stock = stock + :qty
WHERE id = :medicine_id AND branch_id = :branch_id;

-- Ghi hoặc cộng số lượng vào lô.
INSERT INTO medicine_lots (id, medicine_id, batch_no, expiry, qty)
VALUES (:lot_id, :medicine_id, :batch_no, :expiry, :qty)
ON CONFLICT (medicine_id, batch_no)
DO UPDATE SET qty = medicine_lots.qty + excluded.qty
WHERE medicine_lots.expiry = excluded.expiry;
