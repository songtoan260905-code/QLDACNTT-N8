-- Truy vấn khách hàng và vai trò (task 292–306).
-- Khớp với js/customers.js.

-- Danh sách vai trò: từ khóa và trạng thái.
SELECT id, name, description, point_rate, discount_percent, min_spend, builtin, status
FROM customer_roles
WHERE (:status = 'all' OR status = :status)
  AND (
    :keyword = ''
    OR LOWER(name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(description) LIKE '%' || LOWER(:keyword) || '%'
  )
ORDER BY builtin DESC, name;

-- Danh sách khách theo chi nhánh.
-- Quản trị truyền 'all' hoặc mã một chi nhánh.
-- Quản lý chỉ truyền mã chi nhánh của chính mình.
SELECT c.id, c.code, c.name, c.phone, c.email, c.address, c.branch_id,
       c.points, c.total_spend, c.status, r.name AS role_name,
       u.id AS account_id, u.status AS account_status
FROM customers c
JOIN customer_roles r ON r.id = c.role_id
LEFT JOIN users u ON u.customer_id = c.id AND u.role_id = 'customer'
WHERE (:branch_id = 'all' OR c.branch_id = :branch_id)
  AND (:status = 'all' OR c.status = :status)
  AND (:role_id = 'all' OR c.role_id = :role_id)
  AND (
    :keyword = ''
    OR LOWER(c.name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(c.code) LIKE '%' || LOWER(:keyword) || '%'
    OR c.phone LIKE '%' || :keyword || '%'
    OR LOWER(c.email) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(r.name) LIKE '%' || LOWER(:keyword) || '%'
  )
ORDER BY c.name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Chi tiết một khách.
SELECT c.id, c.code, c.name, c.phone, c.email, c.address, c.birthday, c.branch_id,
       c.role_id, r.name AS role_name, r.point_rate, r.discount_percent,
       c.points, c.total_spend, c.status, c.note, c.created_at
FROM customers c
JOIN customer_roles r ON r.id = c.role_id
WHERE c.id = :customer_id;

-- Hóa đơn của khách theo hồ sơ hoặc số điện thoại.
SELECT id, code, branch_id, status, sold_at, total_amount, points_earned, spend_counted
FROM invoices
WHERE customer_id = :customer_id
   OR customer_phone = :phone
ORDER BY sold_at DESC;

-- Điểm tích trên một hóa đơn: mỗi 10.000đ nhân mức điểm của vai trò.
-- floor(total_amount / 10000) * point_rate, chỉ khi khách và vai trò đang bật.
