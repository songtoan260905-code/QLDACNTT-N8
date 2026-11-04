-- Truy vấn bán hàng và hóa đơn.
-- Khớp với js/sales.js.

-- Tìm thuốc khi bán: mã, tên hoặc hoạt chất, trong một chi nhánh.
SELECT id, code, name, price, stock, expiry, status, batch_no
FROM medicines
WHERE branch_id = :branch_id
  AND (
    :keyword = ''
    OR LOWER(name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(code) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(active_ingredient) LIKE '%' || LOWER(:keyword) || '%'
  )
ORDER BY name;

-- Thuốc còn bán được: đang kinh doanh, chưa hết hạn, còn tồn.
SELECT id, name, stock, expiry
FROM medicines
WHERE id = :medicine_id
  AND status = 'active'
  AND expiry >= :today
  AND stock > 0;

-- Đối chiếu số lượng bán với tồn kho.
SELECT stock
FROM medicines
WHERE id = :medicine_id
  AND stock >= :qty;

-- Mã giảm giá còn hiệu lực và đủ điều kiện đơn.
SELECT id, code, discount_type, value, min_subtotal, max_discount, note
FROM discount_codes
WHERE UPPER(code) = UPPER(:code)
  AND status = 'active'
  AND (start_on IS NULL OR start_on <= :today)
  AND (end_on IS NULL OR end_on >= :today)
  AND min_subtotal <= :subtotal;

-- Tạo hóa đơn và chi tiết.
INSERT INTO invoices (
  id, code, branch_id, customer_name, customer_phone, cashier_name,
  pay_method, pay_status, status, sold_at, subtotal, discount_mode,
  discount_code, discount_amount, total_amount, tendered, change_amount,
  transfer_ref, bank_name, bank_account, bank_owner
) VALUES (
  :id, :code, :branch_id, :customer_name, :customer_phone, :cashier_name,
  :pay_method, 'received', 'paid', :sold_at, :subtotal, :discount_mode,
  :discount_code, :discount_amount, :total_amount, :tendered, :change_amount,
  :transfer_ref, :bank_name, :bank_account, :bank_owner
);

INSERT INTO invoice_lines (
  id, invoice_id, medicine_id, qty, unit_price, cost_price, amount, batch_no, stock_before, stock_after
) VALUES (
  :line_id, :invoice_id, :medicine_id, :qty, :unit_price, :cost_price, :amount, :batch_no, :stock_before, :stock_after
);

-- Trừ tồn sau khi bán, chỉ khi còn đủ số lượng.
UPDATE medicines
SET stock = stock - :qty
WHERE id = :medicine_id
  AND stock >= :qty;

-- Kiểm tra tồn mới sau khi bán.
SELECT id, name, stock, min_stock
FROM medicines
WHERE id = :medicine_id;

-- Danh sách hóa đơn: mã, khoảng ngày, trạng thái, phân trang.
SELECT
  id, code, customer_name, cashier_name, pay_method, status, sold_at, total_amount
FROM invoices
WHERE branch_id = :branch_id
  AND (:status = 'all' OR status = :status)
  AND (:keyword = '' OR LOWER(code) LIKE '%' || LOWER(:keyword) || '%')
  AND (:date_from IS NULL OR CAST(sold_at AS DATE) >= :date_from)
  AND (:date_to IS NULL OR CAST(sold_at AS DATE) <= :date_to)
ORDER BY sold_at DESC
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Chi tiết hóa đơn và dòng hàng.
SELECT
  id, code, customer_name, customer_phone, cashier_name, pay_method, pay_status,
  status, sold_at, subtotal, discount_code, discount_amount, total_amount,
  tendered, change_amount, transfer_ref, bank_name, bank_account, bank_owner, cancelled_at
FROM invoices
WHERE id = :invoice_id;

SELECT medicine_id, qty, unit_price, amount, batch_no, stock_before, stock_after
FROM invoice_lines
WHERE invoice_id = :invoice_id
ORDER BY id;

-- Hủy hóa đơn.
UPDATE invoices
SET status = 'cancelled', cancelled_at = :cancelled_at
WHERE id = :invoice_id
  AND status = 'paid';

-- Hoàn tồn khi hủy.
UPDATE medicines
SET stock = stock + :qty
WHERE id = :medicine_id;
