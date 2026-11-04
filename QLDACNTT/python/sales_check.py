# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc bán hàng và hóa đơn.

Chạy: python python/sales_check.py
Cùng quy tắc với js/sales.js.
"""

import math
import re


PAGE_SIZE = 6
PAY = {"cash": "Tiền mặt", "transfer": "Chuyển khoản", "card": "Thẻ"}


def text(value):
    return str("" if value is None else value).strip()


def digits(value):
    if isinstance(value, bool):
        return text(value)
    if isinstance(value, int) and value >= 0:
        return str(value)
    return text(value)


def money_ok(value):
    raw = digits(value)
    return bool(re.fullmatch(r"\d+", raw)) and int(raw) < 10**12


def qty_ok(value):
    raw = digits(value)
    if not re.fullmatch(r"\d+", raw):
        return False
    number = int(raw)
    return 1 <= number < 1000000


def date_ok(value):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text(value))
    if not match:
        return False
    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if month < 1 or month > 12 or day < 1 or day > 31:
        return False
    month_len = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return day <= month_len[month - 1]


def days_until(iso, today):
    if not date_ok(iso) or not date_ok(today):
        return -99999
    from datetime import date
    left = date.fromisoformat(today)
    right = date.fromisoformat(iso)
    return (right - left).days


def phone_ok(value):
    raw = re.sub(r"[\s.+()-]", "", text(value))
    return bool(re.fullmatch(r"0\d{8,10}", raw) or re.fullmatch(r"84\d{8,10}", raw))


def default_discounts():
    return [
        {"id": "dc1", "code": "GIAM10", "type": "percent", "value": 10, "minSubtotal": 100000, "maxDiscount": 50000, "start": "", "end": "", "status": "active"},
        {"id": "dc2", "code": "GIAM50", "type": "amount", "value": 50000, "minSubtotal": 300000, "maxDiscount": 50000, "start": "", "end": "", "status": "active"},
    ]


def search_medicines(rows, opts=None):
    opts = opts or {}
    keyword = text(opts.get("q")).lower()
    branch_id = opts.get("branchId")
    found = []
    for med in rows or []:
        if branch_id and branch_id != "all" and med.get("branchId") != branch_id:
            continue
        blob = " ".join([text(med.get("name")), text(med.get("code")), text(med.get("sku")), text(med.get("activeIngredient"))]).lower()
        if keyword and keyword not in blob:
            continue
        found.append(med)
    return found


def gate(med, qty, today):
    if not med:
        return {"ok": False, "message": "Không tìm thấy thuốc."}
    if (med.get("status") or "active") != "active":
        return {"ok": False, "message": "Thuốc đang ngừng kinh doanh, không bán được."}
    if days_until(med.get("expiry"), today) < 0:
        return {"ok": False, "message": "Thuốc đã hết hạn, không bán được.", "expired": True}
    stock = int(med.get("stock") or 0)
    if stock <= 0:
        return {"ok": False, "message": "Thuốc đã hết hàng.", "stock": stock}
    if not qty_ok(qty):
        return {"ok": False, "message": "Số lượng bán phải là số nguyên lớn hơn 0."}
    if int(digits(qty)) > stock:
        return {"ok": False, "message": "Số lượng bán vượt tồn kho (còn %s)." % stock, "stock": stock}
    return {"ok": True, "stock": stock, "qty": int(digits(qty))}


def line_amount(price, qty):
    return (int(price) if price else 0) * (int(qty) if qty else 0)


def discount_of(rule, subtotal):
    raw = math.floor(subtotal * int(rule["value"]) / 100) if rule["type"] == "percent" else int(rule.get("value") or 0)
    if rule.get("maxDiscount"):
        raw = min(raw, int(rule["maxDiscount"]))
    return min(raw, subtotal)


def apply_discount(subtotal, payload, codes, today):
    payload = payload or {}
    mode = payload.get("mode") or "none"
    if mode == "none":
        return {"ok": True, "mode": "none", "amount": 0, "code": "", "label": ""}
    if subtotal <= 0:
        return {"ok": False, "message": "Đơn hàng chưa có tiền để giảm."}
    if mode == "code":
        code = text(payload.get("code") or payload.get("value")).upper()
        if not code:
            return {"ok": False, "message": "Nhập mã giảm giá."}
        rule = next((item for item in codes or [] if text(item.get("code")).upper() == code), None)
        if not rule or rule.get("status") == "inactive":
            return {"ok": False, "message": "Mã giảm giá không hợp lệ."}
        if rule.get("start") and today and today < rule["start"]:
            return {"ok": False, "message": "Mã giảm giá chưa đến ngày áp dụng."}
        if rule.get("end") and today and today > rule["end"]:
            return {"ok": False, "message": "Mã giảm giá đã hết hạn."}
        if subtotal < int(rule.get("minSubtotal") or 0):
            return {"ok": False, "message": "Đơn chưa đạt mức tối thiểu của mã giảm."}
        amount = discount_of(rule, subtotal)
        if amount <= 0:
            return {"ok": False, "message": "Mã giảm không áp dụng được cho đơn này."}
        return {"ok": True, "mode": "code", "amount": amount, "code": rule["code"], "label": rule.get("note") or rule["code"]}
    if mode == "percent":
        raw = digits(payload.get("value"))
        if not re.fullmatch(r"\d+", raw):
            return {"ok": False, "message": "Mức giảm phần trăm phải là số nguyên."}
        percent = int(raw)
        if percent < 1 or percent > 50:
            return {"ok": False, "message": "Chỉ giảm từ 1% đến 50%."}
        amount = math.floor(subtotal * percent / 100)
        if amount <= 0:
            return {"ok": False, "message": "Mức giảm quá nhỏ so với đơn hàng."}
        return {"ok": True, "mode": "percent", "amount": amount, "code": "", "label": "Giảm %s%%" % percent}
    if mode == "amount":
        if not money_ok(payload.get("value")):
            return {"ok": False, "message": "Số tiền giảm phải là số nguyên không âm."}
        amount = int(digits(payload.get("value")))
        if amount <= 0:
            return {"ok": False, "message": "Số tiền giảm phải lớn hơn 0."}
        if amount > subtotal:
            return {"ok": False, "message": "Số tiền giảm không được vượt quá tổng đơn."}
        return {"ok": True, "mode": "amount", "amount": amount, "code": "", "label": "Giảm tiền"}
    return {"ok": False, "message": "Hình thức giảm giá không hợp lệ."}


def validate_customer(data):
    data = data or {}
    name = text(data.get("customer") if "customer" in data else data.get("name"))
    phone = text(data.get("phone") if "phone" in data else data.get("customerPhone"))
    if not name:
        name = "Khách lẻ"
    if len(name) < 2:
        return {"ok": False, "message": "Tên khách hàng cần ít nhất 2 ký tự."}
    if len(name) > 80:
        return {"ok": False, "message": "Tên khách hàng quá dài."}
    if phone:
        if not phone_ok(phone):
            return {"ok": False, "message": "Số điện thoại khách hàng chưa đúng."}
        phone = re.sub(r"[\s.+()-]", "", phone)
        if phone.startswith("84"):
            phone = "0" + phone[2:]
    return {"ok": True, "name": name, "phone": phone}


def cash_settlement(total, tendered):
    if tendered is None or text(tendered) == "":
        return {"ok": False, "message": "Nhập số tiền khách đưa."}
    if not money_ok(tendered):
        return {"ok": False, "message": "Số tiền khách đưa phải là số nguyên không âm."}
    paid = int(digits(tendered))
    due = int(total or 0)
    if paid < due:
        return {"ok": False, "message": "Khách đưa chưa đủ. Còn thiếu %s." % (due - paid), "tendered": paid, "change": 0}
    return {"ok": True, "tendered": paid, "change": paid - due}


def transfer_check(draft, settings):
    draft = draft or {}
    settings = settings or {}
    if not draft.get("transferConfirmed"):
        return {"ok": False, "message": "Chưa xác nhận đã nhận chuyển khoản."}
    ref = text(draft.get("transferRef"))
    if ref and (len(ref) < 4 or len(ref) > 40):
        return {"ok": False, "message": "Mã giao dịch cần từ 4 đến 40 ký tự, hoặc để trống."}
    if not text(settings.get("bankAccount")):
        return {"ok": False, "message": "Chưa có số tài khoản nhận tiền."}
    return {"ok": True, "ref": ref, "bankName": text(settings.get("bankName")), "bankAccount": text(settings.get("bankAccount")), "bankOwner": text(settings.get("bankOwner"))}


def next_code(sales, today):
    prefix = "HD" + text(today).replace("-", "") + "-"
    highest = 0
    for sale in sales or []:
        code = text(sale.get("code"))
        if not code.startswith(prefix):
            continue
        try:
            highest = max(highest, int(code[len(prefix):]))
        except ValueError:
            continue
    return prefix + str(highest + 1).zfill(3)


def matching_lot(med):
    lots = med.get("lots") or []
    key = text(med.get("batch")).upper()
    for lot in lots:
        if text(lot.get("batch")).upper() == key:
            return lot
    live = [lot for lot in lots if int(lot.get("qty") or 0) > 0]
    live.sort(key=lambda lot: text(lot.get("expiry")))
    return live[0] if live else None


def deduct(med, qty):
    before = int(med.get("stock") or 0)
    med["stock"] = before - qty
    lot = matching_lot(med)
    batch = text(lot.get("batch")).upper() if lot else text(med.get("batch")).upper()
    if lot:
        lot["qty"] = max(0, int(lot.get("qty") or 0) - qty)
    return {"before": before, "after": med["stock"], "batch": batch}


def restore(med, line):
    med["stock"] = int(med.get("stock") or 0) + int(line.get("qty") or 0)
    key = text(line.get("batch")).upper()
    if not key:
        return
    for lot in med.get("lots") or []:
        if text(lot.get("batch")).upper() == key:
            lot["qty"] = int(lot.get("qty") or 0) + int(line.get("qty") or 0)
            return


def build(db, draft, ctx):
    ctx = ctx or {}
    draft = draft or {}
    branch_id = text(draft.get("branchId"))
    if not branch_id or branch_id == "all":
        return {"ok": False, "message": "Chọn một chi nhánh trước khi lập hóa đơn."}
    if not ctx.get("branchOpen"):
        return {"ok": False, "message": "Chi nhánh đang ngừng hoạt động, không lập được hóa đơn."}
    if not ctx.get("today") or not date_ok(ctx.get("today")):
        return {"ok": False, "message": "Thiếu ngày bán."}
    cart = draft.get("cart") or []
    if not cart:
        return {"ok": False, "message": "Chưa có thuốc trong giỏ."}
    customer = validate_customer(draft)
    if not customer["ok"]:
        return customer
    lines = []
    plans = []
    seen = set()
    for item in cart:
        if item["id"] in seen:
            return {"ok": False, "message": "Giỏ hàng đang có thuốc trùng."}
        seen.add(item["id"])
        med = next((row for row in db.get("medicines") or [] if row["id"] == item["id"]), None)
        if not med:
            return {"ok": False, "message": "Không tìm thấy thuốc trong giỏ."}
        if med.get("branchId") != branch_id:
            return {"ok": False, "message": med["name"] + " không thuộc chi nhánh đang bán."}
        check = gate(med, item.get("qty"), ctx["today"])
        if not check["ok"]:
            return {"ok": False, "message": med["name"] + ": " + check["message"]}
        lines.append({
            "medicineId": med["id"], "name": med["name"], "qty": check["qty"],
            "price": int(med.get("price") or 0), "cost": int(med.get("cost") or 0),
            "amount": line_amount(med.get("price"), check["qty"]),
            "batch": "", "stockBefore": None, "stockAfter": None,
        })
        plans.append({"med": med, "qty": check["qty"]})
    subtotal = sum(line["amount"] for line in lines)
    discount = apply_discount(subtotal, draft.get("discount") or {"mode": "none"}, db.get("discounts") or [], ctx["today"])
    if not discount["ok"]:
        return discount
    total = subtotal - discount["amount"]
    pay = text(draft.get("pay") or "cash")
    if pay not in PAY:
        return {"ok": False, "message": "Phương thức thanh toán không hợp lệ."}
    tendered = None
    change_amount = None
    transfer_ref = ""
    bank_name = bank_account = bank_owner = ""
    if pay == "cash":
        cash = cash_settlement(total, draft.get("tendered"))
        if not cash["ok"]:
            return cash
        tendered = cash["tendered"]
        change_amount = cash["change"]
    elif pay == "transfer":
        transfer = transfer_check(draft, db.get("settings") or {})
        if not transfer["ok"]:
            return transfer
        transfer_ref = transfer["ref"]
        bank_name = transfer["bankName"]
        bank_account = transfer["bankAccount"]
        bank_owner = transfer["bankOwner"]
    return {
        "ok": True,
        "plans": plans,
        "sale": {
            "id": ctx.get("id") or "s-generated",
            "code": next_code(db.get("sales"), ctx["today"]),
            "branchId": branch_id,
            "customer": customer["name"],
            "customerPhone": customer["phone"],
            "cashier": text(draft.get("cashier")) or "Thu ngân",
            "pay": pay,
            "payStatus": "received",
            "status": "paid",
            "at": ctx.get("now") or "2026-10-09T03:00:00.000Z",
            "lines": lines,
            "subtotal": subtotal,
            "discountMode": discount["mode"],
            "discountCode": discount.get("code") or "",
            "discountAmount": discount["amount"],
            "total": total,
            "tendered": tendered,
            "changeAmount": change_amount,
            "transferRef": transfer_ref,
            "bankName": bank_name,
            "bankAccount": bank_account,
            "bankOwner": bank_owner,
        },
    }


def stock_warning(med, after):
    if after <= 0:
        return med["name"] + " đã hết hàng sau khi bán."
    minimum = int(med.get("minStock") or 0)
    if after <= minimum:
        return "%s còn %s, dưới mức tối thiểu %s." % (med["name"], after, minimum)
    return ""


def checkout(db, draft, ctx):
    built = build(db, draft, ctx)
    if not built["ok"]:
        return built
    warnings = []
    for index, plan in enumerate(built["plans"]):
        moved = deduct(plan["med"], plan["qty"])
        line = built["sale"]["lines"][index]
        line["batch"] = moved["batch"]
        line["stockBefore"] = moved["before"]
        line["stockAfter"] = moved["after"]
        warning = stock_warning(plan["med"], moved["after"])
        if warning:
            warnings.append(warning)
    db.setdefault("sales", []).append(built["sale"])
    if warnings:
        notes = db.setdefault("notifications", [])
        for body in warnings:
            notes.insert(0, {"type": "stock", "title": "Tồn kho sau bán hàng", "body": body})
    message = "Đã thanh toán hóa đơn %s." % built["sale"]["code"]
    if warnings:
        message += " " + " ".join(warnings)
    return {"ok": True, "sale": built["sale"], "warnings": warnings, "message": message}


def date_span(start, end):
    start = text(start)
    end = text(end)
    if start and not date_ok(start):
        return {"ok": False, "message": "Ngày bắt đầu chưa đúng."}
    if end and not date_ok(end):
        return {"ok": False, "message": "Ngày kết thúc chưa đúng."}
    if start and end and start > end:
        return {"ok": False, "message": "Ngày bắt đầu không được sau ngày kết thúc."}
    return {"ok": True}


def clamp(rows, page, page_size):
    size = page_size if page_size and page_size > 0 else PAGE_SIZE
    total = len(rows)
    pages = max(1, math.ceil(total / size))
    current = min(max(1, int(page or 1)), pages)
    start = (current - 1) * size
    return {"rows": rows[start:start + size], "total": total, "page": current, "pages": pages}


def query(rows, opts=None):
    opts = opts or {}
    keyword = text(opts.get("q")).lower()
    start = text(opts.get("from"))
    end = text(opts.get("to"))
    status = opts.get("status") or "all"
    matched = []
    for sale in rows or []:
        day = text(sale.get("at"))[:10]
        if start and day < start:
            continue
        if end and day > end:
            continue
        current = sale.get("status") or "paid"
        if status != "all" and current != status:
            continue
        if keyword and keyword not in text(sale.get("code")).lower():
            continue
        matched.append(sale)
    matched.sort(key=lambda sale: text(sale.get("at")), reverse=True)
    return clamp(matched, opts.get("page"), opts.get("pageSize") or PAGE_SIZE)


def cancel(db, sale_id, now):
    sale = next((item for item in db.get("sales") or [] if item["id"] == sale_id), None)
    if not sale:
        return {"ok": False, "message": "Không tìm thấy hóa đơn."}
    if (sale.get("status") or "paid") == "cancelled":
        return {"ok": False, "message": "Hóa đơn đã hủy."}
    if (sale.get("status") or "paid") != "paid":
        return {"ok": False, "message": "Chỉ hủy hóa đơn đã thanh toán."}
    medicines = db.get("medicines") or []
    if any(not any(med["id"] == line["medicineId"] for med in medicines) for line in sale.get("lines") or []):
        return {"ok": False, "message": "Không hoàn tồn được vì thiếu thuốc trên hóa đơn."}
    for line in sale.get("lines") or []:
        med = next(item for item in medicines if item["id"] == line["medicineId"])
        restore(med, line)
    sale["status"] = "cancelled"
    sale["cancelledAt"] = now
    return {"ok": True, "message": "Đã hủy hóa đơn %s." % sale["code"], "sale": sale}


def amount(sale):
    if not sale:
        return 0
    if isinstance(sale.get("total"), int):
        return sale["total"]
    total = 0
    for line in sale.get("lines") or []:
        total += line["amount"] if isinstance(line.get("amount"), int) else line_amount(line.get("price"), line.get("qty"))
    return total


def revenue_of(sale):
    if not sale or (sale.get("status") or "paid") == "cancelled":
        return 0
    return amount(sale)


def sample_med(**extra):
    med = {
        "id": "m1", "name": "Paracetamol", "code": "T0001", "sku": "T0001",
        "activeIngredient": "paracetamol", "price": 5000, "cost": 3000,
        "stock": 10, "minStock": 3, "expiry": "2027-01-01", "batch": "L001",
        "status": "active", "branchId": "b1",
        "lots": [{"batch": "L001", "expiry": "2027-01-01", "qty": 10}],
    }
    med.update(extra)
    return med


def sample_db():
    return {
        "medicines": [sample_med(), sample_med(id="m2", name="Vitamin C", code="T0002", sku="T0002", price=8000, cost=4000, stock=4, minStock=2, batch="L002", lots=[{"batch": "L002", "expiry": "2027-01-01", "qty": 4}])],
        "sales": [],
        "discounts": default_discounts(),
        "settings": {"bankName": "Vietcombank", "bankAccount": "012345678901", "bankOwner": "CONG TY PHARMACARE"},
        "notifications": [],
    }


def draft(**extra):
    base = {
        "branchId": "b1",
        "cart": [{"id": "m1", "qty": 2}],
        "customer": "Nguyễn An",
        "phone": "0901234567",
        "discount": {"mode": "none"},
        "pay": "cash",
        "tendered": "20000",
        "cashier": "Thu ngân",
    }
    base.update(extra)
    return base


def ctx(**extra):
    base = {"today": "2026-10-09", "branchOpen": True, "id": "s1", "now": "2026-10-09T03:00:00.000Z"}
    base.update(extra)
    return base


def expect(ok, label, detail=""):
    if ok:
        print("OK  ", label)
        return 0
    print("FAIL", label, "—", detail)
    return 1


def main():
    failed = 0
    rows = [sample_med(), sample_med(id="m9", name="Amoxicillin", code="T0099", activeIngredient="amoxicillin")]
    by_code = search_medicines(rows, {"q": "t0001"})
    by_name = search_medicines(rows, {"q": "amoxicillin"})
    failed += expect(len(by_code) == 1 and by_code[0]["id"] == "m1", "Tìm thuốc theo mã", by_code)
    failed += expect(len(by_name) == 1 and by_name[0]["id"] == "m9", "Tìm thuốc theo tên", by_name)

    blocked_expired = gate(sample_med(expiry="2020-01-01"), 1, "2026-10-09")
    failed += expect(not blocked_expired["ok"] and blocked_expired.get("expired"), "Chặn bán thuốc hết hạn", blocked_expired)
    blocked_status = gate(sample_med(status="discontinued"), 1, "2026-10-09")
    failed += expect(not blocked_status["ok"] and "ngừng" in blocked_status["message"], "Chặn thuốc ngừng kinh doanh", blocked_status)
    blocked_qty = gate(sample_med(stock=2), 3, "2026-10-09")
    failed += expect(not blocked_qty["ok"] and "tồn" in blocked_qty["message"], "Cảnh báo vượt tồn kho", blocked_qty)
    failed += expect(line_amount(5000, 3) == 15000, "Thành tiền một dòng", line_amount(5000, 3))

    low_code = apply_discount(90000, {"mode": "code", "code": "GIAM10"}, default_discounts(), "2026-10-09")
    failed += expect(not low_code["ok"] and "tối thiểu" in low_code["message"], "Mã giảm chưa đủ điều kiện", low_code)
    capped = apply_discount(1000000, {"mode": "code", "code": "GIAM10"}, default_discounts(), "2026-10-09")
    failed += expect(capped["ok"] and capped["amount"] == 50000, "Mã giảm bị trần 50.000đ", capped)
    percent = apply_discount(200000, {"mode": "percent", "value": "10"}, [], "2026-10-09")
    failed += expect(percent["ok"] and percent["amount"] == 20000, "Giảm 10%", percent)
    too_much = apply_discount(10000, {"mode": "amount", "value": "20000"}, [], "2026-10-09")
    failed += expect(not too_much["ok"] and "vượt" in too_much["message"], "Chặn giảm quá tổng đơn", too_much)
    expired_code = apply_discount(200000, {"mode": "code", "code": "CU"}, [{"code": "CU", "type": "amount", "value": 1000, "minSubtotal": 0, "status": "active", "end": "2020-01-01"}], "2026-10-09")
    failed += expect(not expired_code["ok"] and "hết hạn" in expired_code["message"], "Chặn mã giảm hết hạn", expired_code)

    guest = validate_customer({"customer": "", "phone": ""})
    failed += expect(guest["ok"] and guest["name"] == "Khách lẻ", "Khách để trống thành khách lẻ", guest)
    bad_phone = validate_customer({"customer": "An", "phone": "123"})
    failed += expect(not bad_phone["ok"] and "điện thoại" in bad_phone["message"], "Chặn số điện thoại sai", bad_phone)

    short_cash = cash_settlement(20000, "10000")
    failed += expect(not short_cash["ok"] and "chưa đủ" in short_cash["message"], "Tiền mặt chưa đủ", short_cash)
    change = cash_settlement(20000, "50000")
    failed += expect(change["ok"] and change["change"] == 30000, "Tính tiền thừa", change)
    pending = transfer_check({"transferConfirmed": False}, {"bankAccount": "0123"})
    failed += expect(not pending["ok"] and "xác nhận" in pending["message"], "Chưa xác nhận chuyển khoản", pending)

    db = sample_db()
    missed = checkout(db, draft(cart=[{"id": "m1", "qty": 20}], tendered="999999"), ctx())
    failed += expect(not missed["ok"] and db["medicines"][0]["stock"] == 10, "Không trừ tồn khi bán quá kho", missed)

    sold = checkout(db, draft(discount={"mode": "percent", "value": "10"}, tendered="20000"), ctx())
    failed += expect(sold["ok"] and sold["sale"]["total"] == 9000 and sold["sale"]["code"] == "HD20261009-001", "Lưu hóa đơn đã giảm", sold.get("sale"))
    failed += expect(db["medicines"][0]["stock"] == 8 and sold["sale"]["lines"][0]["stockAfter"] == 8, "Trừ tồn và ghi tồn mới", db["medicines"][0]["stock"])
    failed += expect(sold["sale"]["status"] == "paid" and sold["sale"]["lines"][0]["amount"] == 10000, "Trạng thái đơn và thành tiền dòng", sold["sale"]["status"])

    low = checkout(db, draft(cart=[{"id": "m2", "qty": 3}], tendered="30000", customer="Lan", phone=""), ctx(id="s2", now="2026-10-08T03:00:00.000Z"))
    failed += expect(low["ok"] and low["warnings"] and db["medicines"][1]["stock"] == 1, "Cảnh báo tồn sau bán dưới tối thiểu", low.get("warnings"))
    failed += expect(db["notifications"] and "tối thiểu" in db["notifications"][0]["body"], "Ghi thông báo tồn kho mới", db["notifications"])

    closed = checkout(sample_db(), draft(), ctx(branchOpen=False, id="sx"))
    failed += expect(not closed["ok"] and "ngừng" in closed["message"], "Không bán khi chi nhánh đóng", closed)

    listed = query(db["sales"], {"q": "HD20261009-001"})
    failed += expect(listed["total"] == 1 and listed["rows"][0]["id"] == "s1", "Tìm hóa đơn theo mã", listed)
    ranged = query(db["sales"], {"from": "2026-10-09", "to": "2026-10-09"})
    failed += expect(ranged["total"] == 1 and ranged["rows"][0]["id"] == "s1", "Lọc hóa đơn theo ngày", [row["id"] for row in ranged["rows"]])
    bad_span = date_span("2026-10-10", "2026-10-01")
    failed += expect(not bad_span["ok"] and "sau" in bad_span["message"], "Chặn khoảng ngày ngược", bad_span)
    pages = query([{"id": "i%s" % i, "code": "HD%s" % i, "at": "2026-10-%02dT00:00:00.000Z" % (i + 1), "status": "paid"} for i in range(8)], {"page": 2})
    failed += expect(pages["page"] == 2 and pages["total"] == 8 and len(pages["rows"]) == 2, "Phân trang hóa đơn", pages)

    undone = cancel(db, "s1", "2026-10-09T04:00:00.000Z")
    failed += expect(undone["ok"] and db["sales"][0]["status"] == "cancelled" and db["medicines"][0]["stock"] == 10, "Hủy hóa đơn và hoàn tồn", (db["sales"][0]["status"], db["medicines"][0]["stock"]))
    failed += expect(db["medicines"][0]["lots"][0]["qty"] == 10, "Hoàn số lượng lô đã bán", db["medicines"][0]["lots"][0]["qty"])
    again = cancel(db, "s1", "2026-10-09T05:00:00.000Z")
    failed += expect(not again["ok"] and "đã hủy" in again["message"], "Không hủy lần hai", again)
    failed += expect(revenue_of(db["sales"][0]) == 0 and amount(db["sales"][0]) == 9000, "Hóa đơn hủy không tính doanh thu", (revenue_of(db["sales"][0]), amount(db["sales"][0])))

    if failed:
        print("Có", failed, "lỗi")
        return 1
    print("Đạt toàn bộ kiểm tra bán hàng và hóa đơn")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
