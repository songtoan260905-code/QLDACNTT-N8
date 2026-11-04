-- Khung xem báo cáo. Chạy sau các sơ đồ bán hàng, nhập hàng và thuốc.
-- Bản chạy trên trình duyệt tính trên JSON; các view này mô tả cùng quy tắc.

CREATE VIEW v_paid_invoices AS
SELECT
  id,
  code,
  branch_id,
  customer_name,
  cashier_name,
  status,
  sold_at,
  discount_amount,
  total_amount
FROM invoices
WHERE status = 'paid';

CREATE VIEW v_paid_invoice_lines AS
SELECT
  l.invoice_id,
  l.medicine_id,
  l.qty,
  l.unit_price,
  l.cost_price,
  l.amount,
  i.branch_id,
  i.cashier_name,
  i.sold_at,
  i.discount_amount,
  i.total_amount
FROM invoice_lines l
JOIN invoices i ON i.id = l.invoice_id
WHERE i.status = 'paid';

CREATE VIEW v_confirmed_receipts AS
SELECT
  id,
  code,
  supplier_id,
  branch_id,
  status,
  total_amount,
  created_at,
  confirmed_at
FROM goods_receipts
WHERE status = 'confirmed';
