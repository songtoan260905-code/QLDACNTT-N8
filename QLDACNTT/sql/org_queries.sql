-- Truy vấn danh sách, tìm kiếm, lọc và phân trang chi nhánh / nhân sự.
-- Khớp với js/branches.js và js/staff.js.

-- Danh sách chi nhánh, lọc trạng thái và từ khóa.
SELECT id, name, short_name, address, phone, hours, status
FROM branches
WHERE (:status = 'all' OR status = :status)
  AND (
    :keyword = ''
    OR LOWER(name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(address) LIKE '%' || LOWER(:keyword) || '%'
    OR phone LIKE '%' || :keyword || '%'
  )
ORDER BY name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Ràng buộc trước khi xóa chi nhánh.
SELECT
  (SELECT COUNT(*) FROM medicines WHERE branch_id = :branch_id) AS medicines,
  (SELECT COUNT(*) FROM sales WHERE branch_id = :branch_id) AS sales,
  (SELECT COUNT(*) FROM users WHERE branch_id = :branch_id AND role_id <> 'admin') AS staff;

-- Nhân sự theo chi nhánh và vai trò.
SELECT id, name, email, phone, role_id, branch_id, status
FROM users
WHERE (:branch_id = 'all' OR branch_id = :branch_id)
  AND (:role_id = 'all' OR role_id = :role_id)
  AND (
    :keyword = ''
    OR LOWER(name) LIKE '%' || LOWER(:keyword) || '%'
    OR LOWER(email) LIKE '%' || LOWER(:keyword) || '%'
    OR phone LIKE '%' || :keyword || '%'
  )
ORDER BY name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- Lịch sử phân công và điều chuyển.
SELECT id, user_id, from_branch, to_branch, kind, at
FROM staff_transfers
WHERE user_id = :user_id
ORDER BY at DESC;
