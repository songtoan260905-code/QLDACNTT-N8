# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc nhà cung cấp và phiếu nhập.

Chạy: python python/supply_check.py
Cùng quy tắc với js/suppliers.js và js/receipts.js.
"""

import re
import sys


PAGE_SIZE = 6


def text(value):
    return str("" if value is None else value).strip()


def digits(value):
    if isinstance(value, bool):
        return text(value)
    if isinstance(value, int) and value >= 0:
        return str(value)
    return text(value)


def phone_ok(value):
    raw = re.sub(r"[\s.+()-]", "", text(value))
    return bool(re.fullmatch(r"0\d{8,10}", raw) or re.fullmatch(r"84\d{8,10}", raw))


def email_ok(value):
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", text(value)))


def tax_ok(value):
    return bool(re.fullmatch(r"\d{10}", text(value)) or re.fullmatch(r"\d{13}", text(value)))


def money_ok(value):
    raw = digits(value)
    return bool(re.fullmatch(r"\d+", raw)) and int(raw) < 10**12


def qty_ok(value):
    raw = digits(value)
    if not re.fullmatch(r"\d+", raw):
        return False
    number = int(raw)
    return 0 < number < 1000000


def date_ok(value):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text(value))
    if not match:
        return False
    y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if m < 1 or m > 12 or d < 1 or d > 31:
        return False
    month_len = [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return d <= month_len[m - 1]


def batch_ok(value):
    return bool(re.fullmatch(r"[A-Z0-9][A-Z0-9./-]{1,29}", text(value).upper()))


def keyword_hit(blob, query):
    parts = [part for part in text(query).lower().split() if part]
    hay = str(blob or "").lower()
    return all(part in hay for part in parts)


def clamp(rows, page, page_size):
    size = page_size if page_size and page_size > 0 else 6
    total = len(rows)
    pages = max(1, (total + size - 1) // size)
    current = min(max(1, int(page or 1)), pages)
    start = (current - 1) * size
    return {"rows": rows[start:start + size], "total": total, "page": current, "pages": pages}


def validate_supplier(data, suppliers):
    name = text(data.get("name"))
    phone = text(data.get("phone"))
    email = text(data.get("email"))
    address = text(data.get("address"))
    tax = text(data.get("taxCode"))
    note = text(data.get("note"))
    contact = text(data.get("contact"))
    status = "inactive" if data.get("status") == "inactive" else "active"
    same = any(item["id"] != text(data.get("id")) and item["name"].strip().lower() == name.lower() for item in suppliers)
    if len(name) < 2:
        return False, "Tên nhà cung cấp cần ít nhất 2 ký tự."
    if same:
        return False, "Tên nhà cung cấp đã tồn tại."
    if not phone_ok(phone):
        return False, "Số điện thoại chưa hợp lệ."
    if email and not email_ok(email):
        return False, "Email chưa hợp lệ."
    if len(address) < 5:
        return False, "Địa chỉ cần ít nhất 5 ký tự."
    if tax and not tax_ok(tax):
        return False, "Mã số thuế cần 10 hoặc 13 chữ số."
    if len(contact) > 80:
        return False, "Người liên hệ quá dài."
    if len(note) > 300:
        return False, "Ghi chú quá dài."
    return True, {"name": name, "phone": phone, "email": email, "address": address, "status": status, "taxCode": tax}


def apply_contact(supplier, data):
    phone = text(data.get("phone"))
    email = text(data.get("email"))
    address = text(data.get("address"))
    if not phone_ok(phone):
        return False, "Số điện thoại chưa hợp lệ."
    if email and not email_ok(email):
        return False, "Email chưa hợp lệ."
    if len(address) < 5:
        return False, "Địa chỉ cần ít nhất 5 ký tự."
    supplier["phone"] = phone
    supplier["email"] = email
    supplier["address"] = address
    return True, "Đã cập nhật thông tin liên hệ."


def set_status(supplier, status):
    if status not in ("active", "inactive"):
        return False, "Trạng thái không hợp lệ."
    supplier["status"] = status
    return True, status


def remove_supplier(db, supplier_id):
    used = [item for item in db["receipts"] if item["supplierId"] == supplier_id]
    if used:
        return False, "không xóa được"
    db["suppliers"] = [item for item in db["suppliers"] if item["id"] != supplier_id]
    return True, "Đã xóa nhà cung cấp."


def query_suppliers(rows, opts):
    status = opts.get("status") or "all"
    found = []
    for item in rows:
        if status != "all" and item.get("status", "active") != status:
            continue
        blob = " ".join([item.get("name", ""), item.get("code", ""), item.get("phone", ""), item.get("email", ""), item.get("address", "")])
        if keyword_hit(blob, opts.get("q")):
            found.append(item)
    found.sort(key=lambda item: item.get("name", ""))
    return clamp(found, opts.get("page") or 1, opts.get("pageSize") or PAGE_SIZE)


def amount_of(line):
    if not qty_ok(line.get("qty")) or not money_ok(line.get("cost")):
        return None
    return int(digits(line["qty"])) * int(digits(line["cost"]))


def total_of(lines):
    amounts = [amount_of(line) for line in lines]
    if any(amount is None for amount in amounts):
        return False, sum(amount or 0 for amount in amounts)
    return True, sum(amounts)


def validate_receipt(draft, ctx):
    supplier = next((item for item in ctx["suppliers"] if item["id"] == text(draft.get("supplierId"))), None)
    branch = next((item for item in ctx["branches"] if item["id"] == text(draft.get("branchId"))), None)
    if not text(draft.get("supplierId")):
        return False, "Cần chọn nhà cung cấp."
    if not supplier:
        return False, "Không tìm thấy nhà cung cấp."
    if supplier.get("status", "active") != "active":
        return False, "Nhà cung cấp đang ngừng hợp tác."
    if not branch or branch.get("status") != "open":
        return False, "Chi nhánh chưa đang mở cửa, không lập phiếu nhập."
    lines = draft.get("lines") or []
    if not lines:
        return False, "Phiếu nhập cần ít nhất một dòng thuốc."
    values = []
    seen = set()
    for line in lines:
        med = next((item for item in ctx["medicines"] if item["id"] == line.get("medicineId")), None)
        if not med:
            return False, "Không tìm thấy thuốc trong phiếu nhập."
        if med["branchId"] != branch["id"]:
            return False, "không thuộc chi nhánh"
        if not qty_ok(line.get("qty")):
            return False, "Số lượng"
        if not money_ok(line.get("cost")):
            return False, "Giá nhập"
        batch = text(line.get("batch")).upper()
        expiry = text(line.get("expiry"))
        if not batch_ok(batch):
            return False, "Số lô"
        if not date_ok(expiry):
            return False, "Hạn sử dụng"
        if ctx.get("today") and expiry < ctx["today"]:
            return False, "Hạn sử dụng phải từ hôm nay trở đi."
        key = med["id"] + "|" + batch
        if key in seen:
            return False, "bị trùng trong phiếu nhập"
        seen.add(key)
        qty = int(digits(line["qty"]))
        cost = int(digits(line["cost"]))
        values.append({"medicineId": med["id"], "name": med["name"], "qty": qty, "cost": cost, "batch": batch, "expiry": expiry, "amount": qty * cost})
    return True, {"lines": values, "total": sum(item["amount"] for item in values), "supplierId": supplier["id"], "branchId": branch["id"]}


def existing_lot(med, batch):
    key = text(batch).upper()
    for lot in med.get("lots") or []:
        if text(lot.get("batch")).upper() == key:
            return lot
    if not med.get("lots") and text(med.get("batch")).upper() == key:
        return {"batch": key, "expiry": med.get("expiry") or "", "qty": int(med.get("stock") or 0), "virtual": True}
    return None


def add_stock(med, line):
    before = int(med.get("stock") or 0)
    lots = med.setdefault("lots", [])
    if not lots and text(med.get("batch")):
        lots.append({"batch": text(med.get("batch")).upper(), "expiry": med.get("expiry") or "", "qty": before})
    key = text(line["batch"]).upper()
    found = next((lot for lot in lots if text(lot.get("batch")).upper() == key), None)
    if found and found.get("expiry") and found["expiry"] != line["expiry"]:
        return False, "đã có hạn sử dụng khác", before
    if found:
        found["qty"] = int(found["qty"]) + line["qty"]
        found["expiry"] = line["expiry"]
    else:
        lots.insert(0, {"batch": key, "expiry": line["expiry"], "qty": line["qty"]})
    med["stock"] = before + line["qty"]
    live = [lot for lot in lots if int(lot["qty"]) > 0 and lot.get("expiry")]
    live.sort(key=lambda lot: lot["expiry"])
    if live:
        med["batch"] = live[0]["batch"]
        med["expiry"] = live[0]["expiry"]
    return True, "cộng tồn", med["stock"]


def confirm_receipt(db, receipt, today):
    if receipt["status"] != "draft":
        return False, "không xác nhận"
    ok, value = validate_receipt(receipt, {
        "suppliers": db["suppliers"],
        "branches": db["branches"],
        "medicines": db["medicines"],
        "today": today,
    })
    if not ok:
        return False, value
    for line in value["lines"]:
        med = next(item for item in db["medicines"] if item["id"] == line["medicineId"])
        found = existing_lot(med, line["batch"])
        if found and found.get("expiry") and found["expiry"] != line["expiry"]:
            return False, "đã có hạn sử dụng khác"
    checks = []
    for line in value["lines"]:
        med = next(item for item in db["medicines"] if item["id"] == line["medicineId"])
        applied, _message, after = add_stock(med, line)
        if not applied:
            return False, _message
        checks.append(after)
    receipt["status"] = "confirmed"
    receipt["lines"] = value["lines"]
    receipt["total"] = value["total"]
    return True, checks


def sample():
    return {
        "suppliers": [{"id": "ncc1", "name": "Dược Hậu Giang", "status": "active"}],
        "branches": [{"id": "b1", "name": "Quận 1", "status": "open"}],
        "medicines": [{
            "id": "m1", "name": "Paracetamol", "branchId": "b1", "stock": 10,
            "batch": "L001", "expiry": "2027-01-01", "lots": [], "cost": 8000,
        }],
        "receipts": [],
    }


def line(**extra):
    base = {"medicineId": "m1", "qty": "5", "cost": "8000", "batch": "L002", "expiry": "2027-06-01"}
    base.update(extra)
    return base


def draft(**extra):
    base = {"supplierId": "ncc1", "branchId": "b1", "note": "", "lines": [line()]}
    base.update(extra)
    return base


def expect(ok, label, detail):
    if ok:
        print("OK  ", label)
        return 0
    print("FAIL", label, "—", detail)
    return 1


def main():
    failed = 0
    good, value = validate_supplier({
        "name": "Dược Hậu Giang", "phone": "0901234567", "email": "mua@dhg.vn",
        "address": "288 Bis Nguyễn Văn Cừ", "taxCode": "1800123456", "status": "active",
    }, [])
    failed += expect(good and value["status"] == "active", "Thêm nhà cung cấp hợp lệ", value)

    bad_phone, phone_msg = validate_supplier({"name": "Stada", "phone": "123", "address": "Quận 1"}, [])
    failed += expect(not bad_phone and "điện thoại" in phone_msg.lower(), "Chặn điện thoại sai", phone_msg)

    dup, dup_msg = validate_supplier({"name": "dược hậu giang", "phone": "0901234567", "address": "Quận 1"}, [{"id": "ncc1", "name": "Dược Hậu Giang"}])
    failed += expect(not dup and "tồn tại" in dup_msg, "Chặn tên nhà cung cấp trùng", dup_msg)

    supplier = {"id": "ncc1", "phone": "", "email": "", "address": "", "status": "active"}
    contact_ok, contact_msg = apply_contact(supplier, {"phone": "028 3836 1234", "email": "a@b.vn", "address": "288 Bis Nguyễn Văn Cừ"})
    failed += expect(contact_ok and supplier["email"] == "a@b.vn", "Cập nhật liên hệ", contact_msg)
    status_ok, status = set_status(supplier, "inactive")
    failed += expect(status_ok and status == "inactive" and supplier["status"] == "inactive", "Đổi trạng thái", status)

    db = sample()
    db["receipts"].append({"supplierId": "ncc1"})
    blocked, blocked_msg = remove_supplier(db, "ncc1")
    failed += expect(not blocked and "không xóa" in blocked_msg, "Không xóa nhà cung cấp còn phiếu", blocked_msg)
    db["receipts"] = []
    removed, _ = remove_supplier(db, "ncc1")
    failed += expect(removed and db["suppliers"] == [], "Xóa nhà cung cấp chưa có phiếu", db["suppliers"])

    rows = [{"id": "s" + str(i), "name": "Nhà " + str(i), "code": "NCC%04d" % i, "phone": "090000000" + str(i % 10), "email": "", "address": "Quận 1" if i < 4 else "Hà Nội", "status": "inactive" if i == 7 else "active"} for i in range(8)]
    listed = query_suppliers(rows, {"q": "nhà hà nội", "page": 1})
    failed += expect(listed["total"] == 4, "Tìm nhà cung cấp theo từ khóa", listed["total"])
    page2 = query_suppliers(rows, {"page": 2})
    failed += expect(page2["page"] == 2 and page2["total"] == 8 and len(page2["rows"]) == 2, "Phân trang nhà cung cấp", page2)
    stopped = query_suppliers(rows, {"status": "inactive"})
    failed += expect(stopped["total"] == 1, "Lọc trạng thái nhà cung cấp", stopped["total"])

    ready, amount = total_of([line(), line(medicineId="m2", batch="L009", qty="2", cost="1500")])
    failed += expect(ready and amount == 5 * 8000 + 2 * 1500, "Cộng tổng tiền phiếu", amount)
    bad_qty, qty_msg = validate_receipt(draft(lines=[line(qty="0")]), sample())
    failed += expect(not bad_qty and "Số lượng" in qty_msg, "Chặn số lượng bằng 0", qty_msg)
    bad_cost, cost_msg = validate_receipt(draft(lines=[line(cost="-5")]), sample())
    failed += expect(not bad_cost and "Giá nhập" in cost_msg, "Chặn giá âm", cost_msg)
    bad_batch, batch_msg = validate_receipt(draft(lines=[line(batch="!")]), sample())
    failed += expect(not bad_batch and "Số lô" in batch_msg, "Chặn số lô sai", batch_msg)
    bad_date, date_msg = validate_receipt(draft(lines=[line(expiry="2020-01-01")]), dict(sample(), today="2026-10-09"))
    failed += expect(not bad_date and "Hạn sử dụng" in date_msg, "Chặn hạn dùng quá khứ", date_msg)

    db = sample()
    db["today"] = "2026-10-09"
    ok_receipt, stored = validate_receipt(draft(), {"suppliers": db["suppliers"], "branches": db["branches"], "medicines": db["medicines"], "today": "2026-10-09"})
    failed += expect(ok_receipt and stored["total"] == 40000, "Lưu phiếu hợp lệ", stored)
    receipt = {"id": "pn1", "status": "draft", "supplierId": "ncc1", "branchId": "b1", "lines": [line()]}
    confirmed, checks = confirm_receipt(db, receipt, "2026-10-09")
    failed += expect(confirmed and db["medicines"][0]["stock"] == 15 and checks == [15], "Cộng tồn kho sau xác nhận", (db["medicines"][0]["stock"], checks))
    failed += expect(db["medicines"][0]["expiry"] == "2027-01-01", "Hạn gần nhất vẫn là lô cũ", db["medicines"][0]["expiry"])

    clash = sample()
    clash_receipt = {"status": "draft", "supplierId": "ncc1", "branchId": "b1", "lines": [line(batch="L001", expiry="2028-01-01")]}
    clash_ok, clash_msg = confirm_receipt(clash, clash_receipt, "2026-10-09")
    failed += expect(not clash_ok and "hạn" in clash_msg, "Chặn cùng số lô khác hạn", clash_msg)
    failed += expect(clash["medicines"][0]["stock"] == 10, "Tồn không đổi khi từ chối", clash["medicines"][0]["stock"])

    inactive = sample()
    inactive["suppliers"][0]["status"] = "inactive"
    closed, closed_msg = validate_receipt(draft(), {"suppliers": inactive["suppliers"], "branches": inactive["branches"], "medicines": inactive["medicines"], "today": "2026-10-09"})
    failed += expect(not closed and "ngừng hợp tác" in closed_msg, "Không nhập từ nhà cung cấp ngừng hợp tác", closed_msg)

    if failed:
        print("Có", failed, "lỗi")
        return 1
    print("Đạt toàn bộ kiểm tra nhà cung cấp và phiếu nhập")
    return 0


if __name__ == "__main__":
    sys.exit(main())
