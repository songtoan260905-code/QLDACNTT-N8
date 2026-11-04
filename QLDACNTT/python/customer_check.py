# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc khách hàng và vai trò.

Chạy: python python/customer_check.py
Cùng quy tắc với js/customers.js.
"""

import math
import re
import sys


PAGE_SIZE = 6
DEFAULT_ROLES = [
    {"id": "retail", "name": "Khách lẻ", "description": "Mua tại quầy, không tích điểm và không giảm theo vai trò.", "pointRate": 0, "discountPercent": 0, "minSpend": 0, "builtin": True, "status": "active"},
    {"id": "member", "name": "Thành viên", "description": "Có hồ sơ và số điện thoại, tích 1 điểm cho mỗi 10.000đ.", "pointRate": 1, "discountPercent": 0, "minSpend": 0, "builtin": True, "status": "active"},
    {"id": "loyal", "name": "Thân thiết", "description": "Khách chi từ 500.000đ, giảm 5% và tích điểm cao hơn.", "pointRate": 2, "discountPercent": 5, "minSpend": 500000, "builtin": True, "status": "active"},
    {"id": "wholesale", "name": "Khách sỉ", "description": "Mua số lượng cho quầy thuốc, giảm 8% theo vai trò.", "pointRate": 1, "discountPercent": 8, "minSpend": 0, "builtin": True, "status": "active"},
]


def text(value):
    return str("" if value is None else value).strip()


def digits(value):
    if isinstance(value, bool):
        return text(value)
    if isinstance(value, int) and value >= 0:
        return str(value)
    return text(value)


def int_field(value, low, high, empty_as=None):
    if text(value) == "" and empty_as is not None:
        return empty_as
    raw = digits(value)
    if not re.fullmatch(r"\d+", raw):
        return None
    number = int(raw)
    if number < low or number > high:
        return None
    return number


def date_ok(value):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text(value))
    if not match:
        return False
    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if month < 1 or month > 12 or day < 1 or day > 31:
        return False
    month_len = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return day <= month_len[month - 1]


def normalize_phone(value):
    raw = re.sub(r"[\s.+()-]", "", text(value))
    if re.fullmatch(r"84\d{8,10}", raw):
        raw = "0" + raw[2:]
    return raw


def phone_ok(value):
    return bool(re.fullmatch(r"0\d{8,10}", normalize_phone(value)))


def email_ok(value):
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", text(value)))


def keyword_hit(blob, query):
    parts = [part for part in text(query).lower().split() if part]
    if not parts:
        return True
    hay = str(blob or "").lower()
    return all(part in hay for part in parts)


def clamp(rows, page, page_size=PAGE_SIZE):
    size = page_size if page_size and page_size > 0 else 6
    total = len(rows)
    pages = max(1, math.ceil(total / size)) if size else 1
    current = min(max(1, int(page or 1)), pages)
    start = (current - 1) * size
    return {"rows": rows[start:start + size], "total": total, "page": current, "pages": pages}


def role_by_id(db, role_id):
    for role in db.get("customerRoles") or []:
        if role.get("id") == role_id:
            return role
    return None


def by_id(db, customer_id):
    for item in db.get("customers") or []:
        if item.get("id") == customer_id:
            return item
    return None


def find_by_phone(db, phone):
    key = normalize_phone(phone)
    if not key:
        return None
    for item in db.get("customers") or []:
        if normalize_phone(item.get("phone")) == key:
            return item
    return None


def default_role_id(db):
    member = role_by_id(db, "member")
    if member and member.get("status") == "active":
        return member["id"]
    for role in db.get("customerRoles") or []:
        if role.get("status") == "active":
            return role["id"]
    return ""


def ensure(db):
    if not isinstance(db.get("customerRoles"), list):
        db["customerRoles"] = []
    have = {role.get("id") for role in db["customerRoles"]}
    for role in DEFAULT_ROLES:
        if role["id"] not in have:
            db["customerRoles"].append(dict(role))
    if not isinstance(db.get("customers"), list):
        db["customers"] = []


def fresh():
    db = {"customerRoles": [], "customers": [], "sales": []}
    ensure(db)
    return db


def same_role_name(roles, name, role_id):
    key = text(name).lower()
    return any(item.get("id") != role_id and text(item.get("name")).lower() == key for item in roles or [])


def validate_role(data, roles):
    role_id = text(data.get("id"))
    name = text(data.get("name"))
    description = text(data.get("description"))
    point_rate = int_field(data.get("pointRate"), 0, 20)
    discount = int_field(data.get("discountPercent"), 0, 30)
    min_spend = int_field(data.get("minSpend"), 0, 999999999999, 0)
    status = "inactive" if data.get("status") == "inactive" else "active"
    if len(name) < 2:
        return {"ok": False, "message": "Tên vai trò cần ít nhất 2 ký tự."}
    if len(name) > 80:
        return {"ok": False, "message": "Tên vai trò quá dài."}
    if same_role_name(roles, name, role_id):
        return {"ok": False, "message": "Tên vai trò đã tồn tại."}
    if len(description) > 200:
        return {"ok": False, "message": "Mô tả vai trò quá dài."}
    if point_rate is None:
        return {"ok": False, "message": "Mức tích điểm phải là số nguyên từ 0 đến 20."}
    if discount is None:
        return {"ok": False, "message": "Mức giảm phải là số nguyên từ 0 đến 30."}
    if min_spend is None:
        return {"ok": False, "message": "Mức chi để xét vai trò phải là số nguyên không âm."}
    return {"ok": True, "value": {
        "name": name, "description": description, "pointRate": point_rate,
        "discountPercent": discount, "minSpend": min_spend, "status": status,
    }}


def save_role(db, data):
    ensure(db)
    existing = role_by_id(db, data.get("id")) if text(data.get("id")) else None
    if text(data.get("id")) and not existing:
        return {"ok": False, "message": "Không tìm thấy vai trò khách hàng."}
    check = validate_role(data, db["customerRoles"])
    if not check["ok"]:
        return check
    if existing:
        existing.update(check["value"])
        return {"ok": True, "message": "Đã lưu vai trò khách hàng.", "role": existing}
    row = {"id": "crole-test", "builtin": False}
    row.update(check["value"])
    db["customerRoles"].append(row)
    return {"ok": True, "message": "Đã thêm vai trò khách hàng.", "role": row}


def customer_count(db, role_id):
    return sum(1 for item in db.get("customers") or [] if item.get("roleId") == role_id)


def delete_role(db, role_id):
    ensure(db)
    role = role_by_id(db, role_id)
    if not role:
        return {"ok": False, "message": "Không tìm thấy vai trò khách hàng."}
    if role.get("builtin"):
        return {"ok": False, "message": "Không xóa vai trò khách hàng mặc định."}
    used = customer_count(db, role_id)
    if used:
        return {"ok": False, "message": "Còn " + str(used) + " khách đang dùng vai trò này."}
    db["customerRoles"] = [item for item in db["customerRoles"] if item.get("id") != role_id]
    return {"ok": True, "message": "Đã xóa vai trò khách hàng."}


def validate_customer(data, customers, db, opts=None):
    opts = opts or {}
    customer_id = text(data.get("id"))
    existing = next((item for item in customers or [] if item.get("id") == customer_id), None) if customer_id else None
    name = text(data.get("name"))
    phone = normalize_phone(data.get("phone"))
    email = text(data.get("email"))
    address = text(data.get("address"))
    birthday = text(data.get("birthday"))
    note = text(data.get("note"))
    status = "inactive" if data.get("status") == "inactive" else "active"
    role_id = text(data.get("roleId"))
    if not opts.get("canAssign"):
        role_id = existing.get("roleId") if existing else default_role_id(db)
    if len(name) < 2:
        return {"ok": False, "message": "Tên khách hàng cần ít nhất 2 ký tự."}
    if len(name) > 80:
        return {"ok": False, "message": "Tên khách hàng quá dài."}
    if not phone_ok(phone):
        return {"ok": False, "message": "Số điện thoại khách hàng chưa đúng."}
    if any(item.get("id") != customer_id and normalize_phone(item.get("phone")) == phone for item in customers or []):
        return {"ok": False, "message": "Số điện thoại đã có trong hồ sơ khách."}
    if email and not email_ok(email):
        return {"ok": False, "message": "Email chưa hợp lệ."}
    if address and len(address) < 5:
        return {"ok": False, "message": "Địa chỉ cần ít nhất 5 ký tự."}
    if len(address) > 200:
        return {"ok": False, "message": "Địa chỉ quá dài."}
    if birthday:
        if not date_ok(birthday):
            return {"ok": False, "message": "Ngày sinh chưa đúng."}
        if opts.get("today") and birthday > opts["today"]:
            return {"ok": False, "message": "Ngày sinh không được ở tương lai."}
    if len(note) > 300:
        return {"ok": False, "message": "Ghi chú quá dài."}
    role = role_by_id(db, role_id)
    if not role:
        return {"ok": False, "message": "Chưa có vai trò khách hàng đang bật."}
    if role.get("status") != "active" and (not existing or existing.get("roleId") != role.get("id")):
        return {"ok": False, "message": "Vai trò đang tắt, không gán được."}
    return {"ok": True, "value": {
        "name": name, "phone": phone, "email": email, "address": address,
        "birthday": birthday, "note": note, "status": status, "roleId": role["id"],
    }}


def save_customer(db, data, opts=None):
    ensure(db)
    opts = opts or {}
    existing = by_id(db, data.get("id")) if text(data.get("id")) else None
    if text(data.get("id")) and not existing:
        return {"ok": False, "message": "Không tìm thấy khách hàng."}
    if existing and opts.get("actor"):
        gate = can_edit_customer(db, opts["actor"], existing)
        if not gate["ok"]:
            return gate
    check = validate_customer(data, db["customers"], db, opts)
    if not check["ok"]:
        return check
    placed = place_branch(db, data, existing, opts)
    if not placed["ok"]:
        return placed
    if placed.get("branchId"):
        check["value"]["branchId"] = placed["branchId"]
    if existing:
        existing.update(check["value"])
        return {"ok": True, "customer": existing}
    row = {"id": "kh-new", "code": "KH0099", "points": 0, "totalSpend": 0}
    row.update(check["value"])
    db["customers"].append(row)
    return {"ok": True, "customer": row}


def sale_count(db, customer):
    if not customer:
        return 0
    phone = normalize_phone(customer.get("phone"))
    return sum(1 for sale in db.get("sales") or [] if sale.get("customerId") == customer.get("id") or (phone and normalize_phone(sale.get("customerPhone")) == phone))


def remove_customer(db, customer_id):
    customer = by_id(db, customer_id)
    if not customer:
        return {"ok": False, "message": "Không tìm thấy khách hàng."}
    count = sale_count(db, customer)
    if count:
        return {"ok": False, "message": "Khách đang có " + str(count) + " hóa đơn, không xóa được."}
    db["customers"] = [item for item in db["customers"] if item.get("id") != customer_id]
    return {"ok": True, "message": "Đã xóa khách hàng."}


def account_of(db, customer):
    if not customer:
        return None
    for user in db.get("users") or []:
        if user.get("customerId") == customer.get("id") or user.get("id") == customer.get("accountUserId"):
            return user
    return None


def home_branch(db, customer):
    if not customer:
        return ""
    own = text(customer.get("branchId"))
    if own and own != "all":
        return own
    account = account_of(db, customer)
    if account and text(account.get("branchId")) and account.get("branchId") != "all":
        return account["branchId"]
    return ""


def can_edit_customer(db, actor, customer):
    if not customer:
        return {"ok": False, "message": "Không tìm thấy khách hàng."}
    if not actor or actor.get("role") == "admin":
        return {"ok": True}
    if home_branch(db, customer) != actor.get("branchId"):
        return {"ok": False, "message": "Khách hàng không thuộc chi nhánh của bạn."}
    return {"ok": True}


def govern_customer(db, actor, customer):
    if not customer:
        return {"ok": False, "message": "Không tìm thấy khách hàng."}
    if not actor or actor.get("role") not in ("admin", "manager"):
        return {"ok": False, "message": "Không có quyền khóa hoặc xóa tài khoản khách."}
    if actor.get("role") == "manager" and home_branch(db, customer) != actor.get("branchId"):
        return {"ok": False, "message": "Khách hàng không thuộc chi nhánh của bạn."}
    return {"ok": True}


def place_branch(db, data, existing, opts):
    actor = (opts or {}).get("actor")
    if actor and actor.get("role") != "admin":
        if existing:
            gate = can_edit_customer(db, actor, existing)
            if not gate["ok"]:
                return gate
        if not actor.get("branchId") or actor.get("branchId") == "all":
            return {"ok": False, "message": "Tài khoản chưa gắn chi nhánh."}
        return {"ok": True, "branchId": actor["branchId"]}
    if actor and actor.get("role") == "admin":
        branch_id = text(data.get("branchId")) or (home_branch(db, existing) if existing else "")
        if not any(item.get("id") == branch_id for item in db.get("branches") or []):
            return {"ok": False, "message": "Chọn chi nhánh của khách hàng."}
        return {"ok": True, "branchId": branch_id}
    kept = text(data.get("branchId")) or (text(existing.get("branchId")) if existing else "")
    return {"ok": True, "branchId": kept}


def lock_account(db, actor, customer_id):
    customer = by_id(db, customer_id)
    gate = govern_customer(db, actor, customer)
    if not gate["ok"]:
        return gate
    account = account_of(db, customer)
    if not account or account.get("role") != "customer":
        return {"ok": False, "message": "Khách chưa có tài khoản đăng nhập."}
    locking = account.get("status") == "active"
    account["status"] = "inactive" if locking else "active"
    return {"ok": True, "message": "Đã khóa tài khoản." if locking else "Đã mở khóa tài khoản.", "status": account["status"]}


def remove_account(db, actor, customer_id):
    customer = by_id(db, customer_id)
    gate = govern_customer(db, actor, customer)
    if not gate["ok"]:
        return gate
    account = account_of(db, customer)
    if not account or account.get("role") != "customer":
        return {"ok": False, "message": "Khách chưa có tài khoản đăng nhập."}
    db["users"] = [user for user in db.get("users") or [] if user.get("id") != account.get("id")]
    if customer.get("accountUserId") == account.get("id"):
        customer["accountUserId"] = ""
    return {"ok": True, "message": "Đã xóa tài khoản khách hàng. Hồ sơ và hóa đơn vẫn được giữ.", "customer": customer}


def query_customers(rows, db, opts=None):
    opts = opts or {}
    status = opts.get("status") or "all"
    role_id = opts.get("roleId") or "all"
    viewer = opts.get("viewer")
    branch_id = opts.get("branchId") or "all"
    scope_branch = viewer and viewer.get("role") != "admin"
    found = []
    for item in rows or []:
        if scope_branch and home_branch(db, item) != viewer.get("branchId"):
            continue
        if not scope_branch and branch_id != "all" and home_branch(db, item) != branch_id:
            continue
        if status != "all" and (item.get("status") or "active") != status:
            continue
        if role_id != "all" and item.get("roleId") != role_id:
            continue
        role = role_by_id(db, item.get("roleId"))
        blob = " ".join([text(item.get("name")), text(item.get("code")), text(item.get("phone")), text(item.get("email")), text(item.get("address")), text(role.get("name") if role else "")])
        if keyword_hit(blob, opts.get("q")):
            found.append(item)
    found.sort(key=lambda item: text(item.get("name")).lower())
    return clamp(found, opts.get("page"))


def points_for(total, rate):
    amount = int(total or 0)
    point_rate = int(rate or 0)
    if amount <= 0 or point_rate <= 0:
        return 0
    return math.floor(amount / 10000) * point_rate


def suggest(db, customer):
    if not customer or customer.get("status") != "active":
        return None
    current = role_by_id(db, customer.get("roleId"))
    spend = int(customer.get("totalSpend") or 0)
    best = None
    for role in db.get("customerRoles") or []:
        if role.get("status") != "active" or role.get("id") == customer.get("roleId"):
            continue
        min_spend = int(role.get("minSpend") or 0)
        if min_spend <= 0 or spend < min_spend:
            continue
        if best is None or min_spend > int(best.get("minSpend") or 0):
            best = role
    if not best or not current:
        return None
    discount = int(best.get("discountPercent") or 0)
    points = int(best.get("pointRate") or 0)
    current_discount = int(current.get("discountPercent") or 0)
    current_points = int(current.get("pointRate") or 0)
    if discount < current_discount or points < current_points:
        return None
    if discount == current_discount and points == current_points:
        return None
    return {"role": best, "message": "Khách đã đạt mức chi của vai trò " + best["name"] + "."}


def apply_sale(db, sale):
    ensure(db)
    if not sale or sale.get("spendCounted"):
        return {"ok": True, "linked": bool(sale and sale.get("customerId")), "earned": int((sale or {}).get("pointsEarned") or 0)}
    phone = normalize_phone(sale.get("customerPhone"))
    if not phone:
        return {"ok": True, "linked": False, "earned": 0}
    customer = find_by_phone(db, phone)
    if not customer:
        return {"ok": True, "linked": False, "earned": 0}
    role = role_by_id(db, customer.get("roleId"))
    sale["customerId"] = customer["id"]
    sale["customerRoleId"] = role["id"] if role else customer.get("roleId")
    active = customer.get("status") == "active" and role and role.get("status") == "active"
    earned = points_for(sale.get("total"), role.get("pointRate") if role else 0) if active else 0
    sale["pointsEarned"] = earned
    if active:
        customer["points"] = int(customer.get("points") or 0) + earned
        customer["totalSpend"] = int(customer.get("totalSpend") or 0) + int(sale.get("total") or 0)
        sale["spendCounted"] = True
    return {"ok": True, "linked": True, "earned": earned, "customer": customer}


def reverse_sale(db, sale):
    if not sale or not sale.get("spendCounted") or sale.get("pointsReversed"):
        return {"ok": True}
    customer = by_id(db, sale.get("customerId")) or find_by_phone(db, sale.get("customerPhone"))
    if customer:
        customer["points"] = max(0, int(customer.get("points") or 0) - int(sale.get("pointsEarned") or 0))
        customer["totalSpend"] = max(0, int(customer.get("totalSpend") or 0) - int(sale.get("total") or 0))
    sale["pointsReversed"] = True
    return {"ok": True}


def expect(ok, label, detail):
    if ok:
        print("OK  " + label)
        return 0
    print("FAIL " + label + " — " + str(detail))
    return 1


def person(name="Nguyễn An", phone="0901234567", role_id="member", **extra):
    data = {"name": name, "phone": phone, "email": "", "address": "", "birthday": "", "note": "", "status": "active", "roleId": role_id}
    data.update(extra)
    return data


def main():
    failed = 0
    db = fresh()
    failed += expect(len(db["customerRoles"]) == 4 and role_by_id(db, "wholesale")["discountPercent"] == 8, "Bốn vai trò mặc định", [role["id"] for role in db["customerRoles"]])

    added = save_role(db, {"name": "Ưu đãi nội bộ", "description": "Nhân viên nhà thuốc", "pointRate": 3, "discountPercent": 10, "minSpend": 0, "status": "active"})
    failed += expect(added["ok"] and added["role"]["pointRate"] == 3, "Thêm vai trò tùy chỉnh", added.get("message"))

    dup = save_role(db, {"name": " thành viên ", "pointRate": 1, "discountPercent": 0, "minSpend": ""})
    failed += expect(not dup["ok"] and "tồn tại" in dup["message"], "Chặn tên vai trò trùng", dup.get("message"))

    high = save_role(db, {"name": "Quá tay", "pointRate": 21, "discountPercent": 5, "minSpend": 0})
    failed += expect(not high["ok"] and "tích điểm" in high["message"], "Chặn mức điểm trên 20", high.get("message"))

    percent = save_role(db, {"name": "Giảm sâu", "pointRate": 1, "discountPercent": 31, "minSpend": 0})
    failed += expect(not percent["ok"] and "Giảm" in percent["message"], "Chặn giảm trên 30%", percent.get("message"))

    blocked = delete_role(db, "loyal")
    failed += expect(not blocked["ok"] and "mặc định" in blocked["message"], "Không xóa vai trò mặc định", blocked.get("message"))

    saved = save_customer(db, person(), {"canAssign": True, "today": "2026-10-12"})
    failed += expect(saved["ok"] and saved["customer"]["phone"] == "0901234567" and saved["customer"]["roleId"] == "member", "Lưu khách hợp lệ", saved.get("message", saved))

    normalized = save_customer(db, person(name="Trần Bé", phone="+84 91 222 3344", role_id="loyal"), {"canAssign": True, "today": "2026-10-12"})
    failed += expect(normalized["ok"] and normalized["customer"]["phone"] == "0912223344", "Chuẩn hóa đầu số 84", normalized.get("customer"))

    bad_phone = save_customer(db, person(phone="12345"), {"canAssign": True, "today": "2026-10-12"})
    failed += expect(not bad_phone["ok"] and "điện thoại" in bad_phone["message"], "Chặn điện thoại sai", bad_phone.get("message"))

    again = save_customer(db, person(name="Người khác", phone="0901 234 567"), {"canAssign": True, "today": "2026-10-12"})
    failed += expect(not again["ok"] and "đã có" in again["message"], "Chặn số điện thoại trùng", again.get("message"))

    future = save_customer(db, person(name="Mai Sau", phone="0901000001", birthday="2027-01-01"), {"canAssign": True, "today": "2026-10-12"})
    failed += expect(not future["ok"] and "tương lai" in future["message"], "Chặn ngày sinh tương lai", future.get("message"))

    locked = save_customer(db, person(name="Thu ngân thêm", phone="0901000002", roleId="wholesale"), {"canAssign": False, "today": "2026-10-12"})
    failed += expect(locked["ok"] and locked["customer"]["roleId"] == "member", "Không được gán vai trò thì về Thành viên", locked.get("customer"))

    kept = save_customer(db, {"id": "kh-new", "name": "Nguyễn An", "phone": "0901234567", "roleId": "wholesale", "status": "active"}, {"canAssign": False, "today": "2026-10-12"})
    failed += expect(kept["ok"] and kept["customer"]["roleId"] == "member", "Sửa hồ sơ không đổi vai trò khi thiếu quyền", kept["customer"]["roleId"])

    role_by_id(db, "wholesale")["status"] = "inactive"
    closed = save_customer(db, person(name="Bị chặn", phone="0901000003", role_id="wholesale"), {"canAssign": True, "today": "2026-10-12"})
    failed += expect(not closed["ok"] and "tắt" in closed["message"], "Không gán vai trò đang tắt", closed.get("message"))
    role_by_id(db, "wholesale")["status"] = "active"

    db["customers"].append({"id": "kh-use", "name": "Người dùng vai", "phone": "0901000099", "roleId": "crole-test", "status": "active", "points": 0, "totalSpend": 0})
    used = delete_role(db, "crole-test")
    failed += expect(not used["ok"] and "đang dùng" in used["message"], "Không xóa vai trò còn khách", used.get("message"))
    db["customers"] = [item for item in db["customers"] if item["id"] != "kh-use"]
    gone = delete_role(db, "crole-test")
    failed += expect(gone["ok"] and role_by_id(db, "crole-test") is None, "Xóa vai trò chưa có khách", gone.get("message"))

    listed = query_customers(db["customers"], db, {"q": "an", "status": "active", "roleId": "member", "page": 1})
    failed += expect(listed["total"] >= 1 and listed["rows"][0]["name"] == "Nguyễn An", "Lọc khách theo tên và vai trò", listed["total"])

    loyal = role_by_id(db, "loyal")
    buyer = by_id(db, "kh-new")
    buyer["totalSpend"] = 620000
    hint = suggest(db, buyer)
    failed += expect(hint and hint["role"]["id"] == "loyal" and loyal["minSpend"] == 500000, "Gợi ý lên Thân thiết khi đủ mức chi", hint)

    sale = {"id": "s-new", "customerPhone": "0901234567", "total": 25000, "status": "paid"}
    linked = apply_sale(db, sale)
    failed += expect(linked["earned"] == 2 and buyer["points"] == 2 and sale["customerRoleId"] == "member" and buyer["totalSpend"] == 645000, "Tích 2 điểm cho đơn 25.000đ", (linked["earned"], buyer["points"], buyer["totalSpend"]))

    quiet = {"id": "s-small", "customerPhone": "0901234567", "total": 9000, "status": "paid"}
    small = apply_sale(db, quiet)
    failed += expect(small["earned"] == 0 and buyer["points"] == 2 and buyer["totalSpend"] == 654000, "Đơn dưới 10.000đ không cộng điểm", (small["earned"], buyer["totalSpend"]))

    guest = apply_sale(db, {"id": "s-guest", "customerPhone": "", "customer": "Khách lẻ", "total": 50000})
    failed += expect(guest["linked"] is False and guest["earned"] == 0, "Khách lẻ không gắn hồ sơ", guest)

    stopped = save_customer(db, person(name="Ngừng", phone="0901666777", status="inactive"), {"canAssign": True, "today": "2026-10-12"})
    paused = apply_sale(db, {"id": "s-off", "customerPhone": "0901666777", "total": 40000})
    failed += expect(paused["earned"] == 0 and stopped["customer"]["points"] == 0 and paused.get("customer", stopped["customer"]).get("totalSpend") == 0, "Khách ngừng không tích điểm", paused)

    reverse_sale(db, sale)
    failed += expect(sale.get("pointsReversed") and buyer["points"] == 0 and buyer["totalSpend"] == 629000, "Hủy hóa đơn trừ điểm và tổng chi", (buyer["points"], buyer["totalSpend"]))

    db["sales"] = [{"id": "s-new", "customerId": "kh-new", "customerPhone": "0901234567"}]
    blocked_delete = remove_customer(db, "kh-new")
    failed += expect(not blocked_delete["ok"] and "hóa đơn" in blocked_delete["message"], "Không xóa khách còn hóa đơn", blocked_delete.get("message"))
    db["sales"] = []
    removed = remove_customer(db, "kh-new")
    failed += expect(removed["ok"] and by_id(db, "kh-new") is None, "Xóa khách chưa có hóa đơn", removed.get("message"))

    shop = fresh()
    shop["branches"] = [
        {"id": "br-q1", "name": "Quận 1", "status": "open"},
        {"id": "br-td", "name": "Thủ Đức", "status": "open"},
    ]
    shop["users"] = []
    admin = {"id": "u-admin", "role": "admin", "branchId": "all", "status": "active"}
    manager = {"id": "u-q1", "role": "manager", "branchId": "br-q1", "status": "active"}
    pharmacist = {"id": "u-rx", "role": "pharmacist", "branchId": "br-q1", "status": "active"}
    nam = save_customer(shop, person(name="Nguyễn Văn Nam", phone="0988123456", branchId="br-q1"), {"canAssign": True, "today": "2026-10-12", "actor": admin})
    bao = save_customer(shop, person(name="Trần Quốc Bảo", phone="0912345678", role_id="loyal", branchId="br-td"), {"canAssign": True, "today": "2026-10-12", "actor": admin})
    missing_branch = save_customer(shop, person(name="Thiếu chi nhánh", phone="0901777888"), {"canAssign": True, "today": "2026-10-12", "actor": admin})
    failed += expect(nam["ok"] and nam["customer"]["branchId"] == "br-q1" and bao["customer"]["branchId"] == "br-td", "Quản trị gắn khách vào chi nhánh", (nam.get("customer"), bao.get("customer")))
    failed += expect(not missing_branch["ok"] and "chi nhánh" in missing_branch["message"], "Quản trị phải chọn chi nhánh khi thêm khách", missing_branch.get("message"))
    nam["customer"]["id"] = "kh-nam"
    bao["customer"]["id"] = "kh-bao"

    shop["users"].append({"id": "u-nam", "role": "customer", "branchId": "br-q1", "status": "active", "customerId": nam["customer"]["id"]})
    shop["users"].append({"id": "u-bao", "role": "customer", "branchId": "br-td", "status": "active", "customerId": bao["customer"]["id"]})
    nam["customer"]["accountUserId"] = "u-nam"
    bao["customer"]["accountUserId"] = "u-bao"

    every = query_customers(shop["customers"], shop, {"viewer": admin, "branchId": "all", "page": 1})
    only_td = query_customers(shop["customers"], shop, {"viewer": admin, "branchId": "br-td", "page": 1})
    own = query_customers(shop["customers"], shop, {"viewer": manager, "branchId": "br-td", "page": 1})
    failed += expect(every["total"] == 2 and only_td["total"] == 1 and only_td["rows"][0]["name"] == "Trần Quốc Bảo", "Quản trị xem danh sách từng chi nhánh", (every["total"], only_td["total"]))
    failed += expect(own["total"] == 1 and own["rows"][0]["branchId"] == "br-q1", "Quản lý chỉ thấy khách chi nhánh mình", [row.get("name") for row in own["rows"]])

    helped = save_customer(shop, {"id": nam["customer"]["id"], "name": "Nam đã sửa", "phone": "0988123456", "roleId": "member", "status": "active"}, {"canAssign": True, "today": "2026-10-12", "actor": manager})
    blocked_edit = save_customer(shop, {"id": bao["customer"]["id"], "name": "Bảo bị sửa", "phone": "0912345678", "roleId": "loyal", "status": "active"}, {"canAssign": True, "today": "2026-10-12", "actor": manager})
    failed += expect(helped["ok"] and helped["customer"]["name"] == "Nam đã sửa" and helped["customer"]["branchId"] == "br-q1", "Quản lý sửa giúp khách chi nhánh mình", helped.get("customer"))
    failed += expect(not blocked_edit["ok"] and "chi nhánh" in blocked_edit["message"] and bao["customer"]["name"] == "Trần Quốc Bảo", "Quản lý không sửa khách chi nhánh khác", blocked_edit.get("message"))

    denied_role = lock_account(shop, pharmacist, nam["customer"]["id"])
    denied_branch = lock_account(shop, manager, bao["customer"]["id"])
    denied_delete = remove_account(shop, manager, bao["customer"]["id"])
    locked = lock_account(shop, manager, nam["customer"]["id"])
    opened_lock = lock_account(shop, admin, nam["customer"]["id"])
    failed += expect(not denied_role["ok"] and "quyền" in denied_role["message"], "Dược sĩ không khóa tài khoản khách", denied_role.get("message"))
    failed += expect(not denied_branch["ok"] and "chi nhánh" in denied_branch["message"], "Quản lý không khóa khách chi nhánh khác", denied_branch.get("message"))
    failed += expect(not denied_delete["ok"] and "chi nhánh" in denied_delete["message"], "Quản lý không xóa tài khoản chi nhánh khác", denied_delete.get("message"))
    failed += expect(locked["ok"] and account_of(shop, nam["customer"])["status"] == "inactive", "Quản lý khóa tài khoản khách chi nhánh mình", locked.get("message"))
    failed += expect(opened_lock["ok"] and account_of(shop, nam["customer"])["status"] == "active", "Quản trị mở lại tài khoản khách", opened_lock.get("message"))

    kept_profile = remove_account(shop, admin, bao["customer"]["id"])
    failed += expect(
        kept_profile["ok"] and by_id(shop, bao["customer"]["id"]) and account_of(shop, bao["customer"]) is None and bao["customer"].get("accountUserId") == "",
        "Xóa tài khoản vẫn giữ hồ sơ khách",
        kept_profile.get("message"),
    )

    if failed:
        print(str(failed) + " kiểm tra thất bại")
        return 1
    print("Khách hàng và vai trò khớp quy tắc.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
