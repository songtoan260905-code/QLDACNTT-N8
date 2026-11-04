# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc chi nhánh và nhân sự.

Chạy: python python/org_check.py
Cùng quy tắc với js/branches.js, js/staff.js và js/pager.js.
"""

import math
import re
import sys

PAGE_BRANCH = 4
PAGE_STAFF = 6
STATUSES = ("open", "maintenance", "closed")


def text(value):
    return str(value or "").strip()


def phone_ok(value):
    raw = re.sub(r"[\s.+()-]", "", text(value))
    return bool(re.fullmatch(r"0\d{8,10}", raw) or re.fullmatch(r"84\d{8,10}", raw))


def email_ok(value):
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", text(value)))


def validate_branch(data, branches):
    name = text(data.get("name"))
    address = text(data.get("address"))
    phone = text(data.get("phone"))
    email = text(data.get("email"))
    contact = text(data.get("contact"))
    status = data.get("status") if data.get("status") in STATUSES else "open"
    branch_id = text(data.get("id"))
    if len(name) < 2:
        return False, "Tên chi nhánh cần ít nhất 2 ký tự."
    if not address:
        return False, "Cần địa chỉ chi nhánh."
    if not phone_ok(phone):
        return False, "Số điện thoại chi nhánh chưa hợp lệ."
    if email and not email_ok(email):
        return False, "Email liên hệ chưa đúng định dạng."
    if contact and len(contact) < 2:
        return False, "Người liên hệ cần ít nhất 2 ký tự."
    for branch in branches:
        if branch["id"] != branch_id and text(branch["name"]).lower() == name.lower():
            return False, "Tên chi nhánh đã tồn tại."
    return True, {"name": name, "address": address, "phone": phone, "status": status, "email": email}


def validate_contact(data):
    phone = text(data.get("phone"))
    email = text(data.get("email"))
    address = text(data.get("address"))
    contact = text(data.get("contact"))
    if not phone_ok(phone):
        return False, "Số điện thoại liên hệ chưa hợp lệ."
    if email and not email_ok(email):
        return False, "Email liên hệ chưa đúng định dạng."
    if contact and len(contact) < 2:
        return False, "Người liên hệ cần ít nhất 2 ký tự."
    if not address:
        return False, "Cần địa chỉ liên hệ."
    return True, {"phone": phone, "email": email, "address": address, "contact": contact}


def paginate(rows, page, page_size):
    total = len(rows)
    pages = max(1, math.ceil(total / page_size)) if page_size else 1
    current = min(max(1, int(page or 1)), pages)
    start = (current - 1) * page_size
    return rows[start:start + page_size], total, current, pages


def query_branches(branches, viewer, keyword="", status="all", page=1):
    key = text(keyword).lower()
    picked = []
    for branch in branches:
        if viewer["role"] != "admin" and branch["id"] != viewer.get("branchId"):
            continue
        if status != "all" and branch["status"] != status:
            continue
        blob = " ".join([
            branch.get("name", ""), branch.get("address", ""), branch.get("phone", ""), branch.get("email", ""),
        ]).lower()
        if key and key not in blob:
            continue
        picked.append(branch)
    return paginate(picked, page, PAGE_BRANCH)


def inspect_branch(branch):
    missing = []
    if branch is None:
        return False, ["chi nhánh"]
    if len(text(branch.get("name"))) < 2:
        missing.append("tên")
    if not text(branch.get("address")):
        missing.append("địa chỉ")
    if not phone_ok(branch.get("phone")):
        missing.append("điện thoại")
    if not text(branch.get("hours")):
        missing.append("giờ mở cửa")
    return not missing, missing


def constraints(db, branch_id):
    medicines = sum(1 for item in db["medicines"] if item["branchId"] == branch_id)
    sales = sum(1 for item in db["sales"] if item["branchId"] == branch_id)
    staff = sum(1 for item in db["users"] if item["branchId"] == branch_id and item["role"] != "admin")
    return {"medicines": medicines, "sales": sales, "staff": staff, "blocked": medicines + sales + staff > 0}


def set_status(branch, nxt, actor):
    if not actor or actor.get("role") != "admin":
        return False, "Chỉ quản trị được đổi trạng thái hoạt động của chi nhánh."
    if nxt == "open":
        ok, missing = inspect_branch(branch)
        if not ok:
            return False, "Chưa đủ dữ liệu để mở cửa: " + ", ".join(missing) + "."
        branch["status"] = "open"
        return True, "Đã kích hoạt chi nhánh."
    if nxt == "closed":
        branch["status"] = "closed"
        return True, "Đã ngừng hoạt động chi nhánh."
    return False, "Trạng thái không hợp lệ."


def query_staff(users, viewer, keyword="", branch_id="all", role="all", page=1):
    key = text(keyword).lower()
    picked = []
    for user in users:
        if viewer["role"] != "admin" and user["branchId"] != viewer.get("branchId"):
            continue
        if viewer["role"] == "admin" and branch_id != "all" and user["branchId"] != branch_id:
            continue
        if role != "all" and user["role"] != role:
            continue
        blob = " ".join([user.get("name", ""), user.get("email", ""), user.get("phone", "")]).lower()
        if key and key not in blob:
            continue
        picked.append(user)
    picked.sort(key=lambda item: text(item.get("name")).lower())
    return paginate(picked, page, PAGE_STAFF)


def place(user, branch_id, branches, actor, mode):
    if not actor or actor.get("id") == user.get("id") or user.get("role") == "admin" or actor.get("role") != "admin":
        return False, "Không có quyền phân công nhân viên này."
    branch = next((item for item in branches if item["id"] == branch_id), None)
    if branch is None:
        return False, "Chi nhánh không hợp lệ."
    if branch["status"] == "closed":
        return False, "Không phân công vào chi nhánh đã ngừng hoạt động."
    if user["branchId"] == branch["id"]:
        return False, "Nhân viên đang ở chi nhánh này."
    previous = user["branchId"]
    user["branchId"] = branch["id"]
    user.setdefault("transfers", []).insert(0, {"from": previous, "to": branch["id"], "kind": mode})
    return True, "Đã phân công." if mode == "assign" else "Đã điều chuyển."


def expect(ok, name, detail):
    print(f"[{'Đạt' if ok else 'Lỗi'}] {name} — {detail}")
    return 0 if ok else 1


def main():
    failed = 0
    branches = [
        {"id": "b1", "name": "Nhà thuốc Quận 1", "address": "12 Nguyễn Huệ", "phone": "0901234567", "email": "q1@pharmacare.vn", "hours": "08:00 – 21:00", "status": "open"},
        {"id": "b2", "name": "Nhà thuốc Quận 3", "address": "88 Võ Văn Tần", "phone": "0902223344", "email": "", "hours": "08:00 – 21:00", "status": "maintenance"},
        {"id": "b3", "name": "Nhà thuốc Thủ Đức", "address": "15 Võ Văn Ngân", "phone": "0905556677", "email": "", "hours": "08:00 – 21:00", "status": "closed"},
        {"id": "b4", "name": "Nhà thuốc Bình Thạnh", "address": "20 Xô Viết", "phone": "0908889900", "email": "", "hours": "08:00 – 21:00", "status": "open"},
        {"id": "b5", "name": "Nhà thuốc Tân Bình", "address": "5 Cộng Hòa", "phone": "0901112233", "email": "", "hours": "08:00 – 21:00", "status": "open"},
    ]
    users = [
        {"id": "u1", "name": "Nguyễn Minh Anh", "email": "admin@pharmacare.vn", "phone": "0900000001", "role": "admin", "branchId": "all"},
        {"id": "u2", "name": "Trần Quản Lý", "email": "ql@pharmacare.vn", "phone": "0900000002", "role": "manager", "branchId": "b1"},
        {"id": "u3", "name": "Lê Dược Sĩ", "email": "ds@pharmacare.vn", "phone": "0900000003", "role": "pharmacist", "branchId": "b1"},
        {"id": "u4", "name": "Phạm Thu Ngân", "email": "tn@pharmacare.vn", "phone": "0900000004", "role": "cashier", "branchId": "b2"},
    ]
    admin = users[0]
    manager = users[1]
    db = {"medicines": [{"branchId": "b1"}], "sales": [{"branchId": "b1"}, {"branchId": "b1"}], "users": users}

    bad_name, _ = validate_branch({"name": "A", "address": "1 Lê Lợi", "phone": "0901234567"}, branches)
    bad_phone, phone_msg = validate_branch({"name": "Nhà thuốc mới", "address": "1 Lê Lợi", "phone": "123"}, branches)
    dup, dup_msg = validate_branch({"name": "nhà thuốc quận 1", "address": "1 Lê Lợi", "phone": "0901234567"}, branches)
    good, _ = validate_branch({"name": "Nhà thuốc Phú Nhuận", "address": "9 Phan Xích Long", "phone": "0283999888", "email": "pn@pharmacare.vn"}, branches)
    bad_mail, _ = validate_contact({"phone": "0901234567", "email": "sai", "address": "12 Nguyễn Huệ", "contact": "Lan"})
    good_contact, _ = validate_contact({"phone": "0901234567", "email": "q1@pharmacare.vn", "address": "12 Nguyễn Huệ", "contact": "Lan"})

    failed += expect(not bad_name, "Tên chi nhánh quá ngắn", "bị từ chối")
    failed += expect(not bad_phone, "Điện thoại chi nhánh", phone_msg)
    failed += expect(not dup, "Tên chi nhánh trùng", dup_msg)
    failed += expect(good, "Chi nhánh hợp lệ", "đủ tên, địa chỉ, điện thoại")
    failed += expect(not bad_mail, "Email liên hệ sai", "bị từ chối")
    failed += expect(good_contact, "Liên hệ hợp lệ", "điện thoại, email, địa chỉ")

    found, total, page, pages = query_branches(branches, admin, keyword="nguyễn huệ")
    failed += expect(total == 1 and found[0]["id"] == "b1", "Tìm chi nhánh theo địa chỉ", f"{total} kết quả")
    opened, open_total, _, _ = query_branches(branches, admin, status="open")
    failed += expect(open_total == 3, "Lọc chi nhánh đang mở", f"{open_total} chi nhánh")
    _, page_total, page_no, page_count = query_branches(branches, admin, page=2)
    failed += expect(page_total == 5 and page_no == 2 and page_count == 2, "Phân trang chi nhánh", f"trang {page_no}/{page_count}")
    scoped, scoped_total, _, _ = query_branches(branches, manager)
    failed += expect(scoped_total == 1 and scoped[0]["id"] == "b1", "Quản lý chỉ thấy chi nhánh mình", scoped[0]["name"])

    ready, missing = inspect_branch(branches[0])
    thin, thin_missing = inspect_branch({"name": "Mới", "address": "", "phone": "", "hours": ""})
    failed += expect(ready and not missing, "Dữ liệu chi tiết đủ", "không thiếu mục")
    failed += expect(not thin and "điện thoại" in thin_missing, "Dữ liệu chi tiết thiếu", ", ".join(thin_missing))

    bound = constraints(db, "b1")
    failed += expect(bound["medicines"] == 1 and bound["sales"] == 2 and bound["staff"] == 2 and bound["blocked"], "Ràng buộc trước khi xóa", "có thuốc, hóa đơn, nhân sự")

    bare = {"name": "Thiếu", "address": "", "phone": "", "hours": "", "status": "closed"}
    act_bad, act_msg = set_status(bare, "open", admin)
    act_ok, _ = set_status(dict(branches[2]), "open", admin)
    deny, deny_msg = set_status(dict(branches[0]), "closed", manager)
    closed_ok, _ = set_status(dict(branches[0]), "closed", admin)
    failed += expect(not act_bad, "Kích hoạt khi thiếu dữ liệu", act_msg)
    failed += expect(act_ok, "Kích hoạt chi nhánh đủ dữ liệu", "đang mở")
    failed += expect(not deny, "Quản lý không được ngừng chi nhánh", deny_msg)
    failed += expect(closed_ok, "Quản trị ngừng hoạt động", "đã đóng")

    by_branch, branch_total, _, _ = query_staff(users, admin, branch_id="b1")
    by_role, role_total, _, _ = query_staff(users, admin, role="cashier")
    by_word, word_total, _, _ = query_staff(users, admin, keyword="dược")
    failed += expect(branch_total == 2, "Lọc nhân viên theo chi nhánh", f"{branch_total} người")
    failed += expect(role_total == 1 and by_role[0]["role"] == "cashier", "Lọc nhân viên theo vai trò", by_role[0]["name"])
    failed += expect(word_total == 1, "Tìm nhân viên theo từ khóa", by_word[0]["name"] if by_word else "trống")

    same, same_msg = place(dict(users[2]), "b1", branches, admin, "assign")
    moved_user = dict(users[2])
    moved, move_msg = place(moved_user, "b2", branches, admin, "transfer")
    blocked, blocked_msg = place(dict(users[3]), "b3", branches, admin, "assign")
    outsider, _ = place(dict(users[2]), "b2", branches, manager, "transfer")
    failed += expect(not same, "Phân công trùng chi nhánh", same_msg)
    failed += expect(moved and moved_user["branchId"] == "b2", "Điều chuyển sang chi nhánh mới", move_msg)
    failed += expect(not blocked, "Không phân công vào chi nhánh đóng", blocked_msg)
    failed += expect(not outsider, "Quản lý không điều chuyển", "bị từ chối")

    print("")
    if failed:
        print(f"Còn {failed} mục lỗi.")
        return 1
    print("Quy tắc chi nhánh và nhân sự khớp thiết kế.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
