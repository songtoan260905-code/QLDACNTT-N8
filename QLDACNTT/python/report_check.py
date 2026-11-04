# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc báo cáo doanh thu, bán hàng, nhập và tồn.

Chạy: python python/report_check.py
Cùng quy tắc với js/reports.js.
"""

import math


def text(value):
    return str("" if value is None else value).strip()


def date_ok(value):
    match = __import__("re").fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text(value))
    if not match:
        return False
    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if month < 1 or month > 12 or day < 1:
        return False
    length = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return day <= length[month - 1]


def month_ok(value):
    match = __import__("re").fullmatch(r"(\d{4})-(\d{2})", text(value))
    if not match:
        return False
    return 1 <= int(match.group(2)) <= 12


def days_in_month(month):
    import calendar
    year = int(month[0:4])
    index = int(month[5:7])
    return calendar.monthrange(year, index)[1]


def day_of(iso):
    return text(iso)[:10]


def days_until(iso, today):
    if not date_ok(iso) or not date_ok(today):
        return None
    from datetime import date
    return (date.fromisoformat(iso) - date.fromisoformat(today)).days


def int_in(value, low, high):
    raw = text(value)
    if not __import__("re").fullmatch(r"\d+", raw):
        return None
    number = int(raw)
    if number < low or number > high:
        return None
    return number


def cmp_text(left, right):
    a = text(left).lower()
    b = text(right).lower()
    return (a > b) - (a < b)


def half_up(value):
    if value >= 0:
        return int(math.floor(value + 0.5))
    return int(math.ceil(value - 0.5))


def share_of(part, total):
    if not total:
        return 0
    return half_up((part / total) * 1000) / 10


def revenue_of(sale):
    if not sale or (sale.get("status") or "paid") == "cancelled":
        return 0
    total = sale.get("total")
    if isinstance(total, (int, float)) and not isinstance(total, bool):
        return total
    amount = 0
    for line in sale.get("lines") or []:
        if isinstance(line.get("amount"), (int, float)) and not isinstance(line.get("amount"), bool):
            amount += line["amount"]
        else:
            amount += (line.get("price") or 0) * (line.get("qty") or 0)
    return amount


def profit_of(sale):
    if not sale or (sale.get("status") or "paid") == "cancelled":
        return 0
    gross = 0
    for line in sale.get("lines") or []:
        gross += ((line.get("price") or 0) - (line.get("cost") or 0)) * (line.get("qty") or 0)
    return gross - (sale.get("discountAmount") or 0)


def line_amount(line):
    amount = line.get("amount")
    if isinstance(amount, (int, float)) and not isinstance(amount, bool):
        return amount
    return (line.get("price") or 0) * (line.get("qty") or 0)


def scope_of(viewer, requested):
    if not viewer or viewer.get("status") == "inactive":
        return {"ok": False, "message": "Cần đăng nhập để xem báo cáo."}
    if viewer.get("role") not in ("admin", "manager"):
        return {"ok": False, "message": "Bạn không có quyền xem báo cáo."}
    if viewer.get("role") != "admin":
        return {"ok": True, "branchId": text(viewer.get("branchId"))}
    return {"ok": True, "branchId": text(requested) or "all"}


def sales_in(db, opts):
    scope = scope_of(opts.get("viewer"), opts.get("branchId"))
    if not scope["ok"]:
        return scope
    date = text(opts.get("date"))
    month = text(opts.get("month"))
    rows = []
    for sale in db.get("sales") or []:
        if (sale.get("status") or "paid") == "cancelled":
            continue
        if scope["branchId"] != "all" and sale.get("branchId") != scope["branchId"]:
            continue
        day = day_of(sale.get("at"))
        if date and day != date:
            continue
        if month and day[:7] != month:
            continue
        rows.append(sale)
    return {"ok": True, "branchId": scope["branchId"], "rows": rows}


def invoice_of(sale):
    return {
        "id": sale.get("id"),
        "code": sale.get("code") or "",
        "at": sale.get("at") or "",
        "customer": sale.get("customer") or "",
        "cashier": text(sale.get("cashier")) or "Thu ngân",
        "branchId": sale.get("branchId") or "",
        "revenue": revenue_of(sale),
        "profit": profit_of(sale),
    }


def totals(rows):
    return {
        "orders": len(rows),
        "revenue": sum(revenue_of(sale) for sale in rows),
        "profit": sum(profit_of(sale) for sale in rows),
    }


def paid_lines(sale):
    if (sale.get("status") or "paid") == "cancelled":
        return []
    lines = sale.get("lines") or []
    if not lines:
        return []
    subtotal = sum(line_amount(line) for line in lines)
    total = revenue_of(sale)
    left = total
    out = []
    for index, line in enumerate(lines):
        raw = line_amount(line)
        share = left if index == len(lines) - 1 else (half_up((raw * total) / subtotal) if subtotal else 0)
        left -= share
        out.append({
            "medicineId": line.get("medicineId") or "",
            "name": text(line.get("name")) or "Thuốc",
            "qty": line.get("qty") or 0,
            "revenue": share,
        })
    return out


def medicine_groups(rows):
    found = {}
    order = []
    for sale in rows:
        for line in paid_lines(sale):
            key = line["medicineId"] or ("name:" + line["name"].lower())
            if key not in found:
                found[key] = {"medicineId": line["medicineId"], "name": line["name"], "qty": 0, "revenue": 0}
                order.append(found[key])
            found[key]["qty"] += line["qty"]
            found[key]["revenue"] += line["revenue"]
    return order


def daily(db, opts):
    if not date_ok(opts.get("date")):
        return {"ok": False, "message": "Ngày báo cáo không hợp lệ."}
    found = sales_in(db, {"viewer": opts.get("viewer"), "branchId": opts.get("branchId"), "date": opts.get("date")})
    if not found["ok"]:
        return found
    sum_row = totals(found["rows"])
    invoices = sorted((invoice_of(sale) for sale in found["rows"]), key=lambda row: text(row["at"]), reverse=True)
    return {
        "ok": True,
        "date": text(opts.get("date")),
        "branchId": found["branchId"],
        "orders": sum_row["orders"],
        "revenue": sum_row["revenue"],
        "profit": sum_row["profit"],
        "invoices": invoices,
    }


def monthly(db, opts):
    if not month_ok(opts.get("month")):
        return {"ok": False, "message": "Tháng báo cáo không hợp lệ."}
    found = sales_in(db, {"viewer": opts.get("viewer"), "branchId": opts.get("branchId"), "month": opts.get("month")})
    if not found["ok"]:
        return found
    month = text(opts.get("month"))
    bucket = {}
    for sale in found["rows"]:
        bucket.setdefault(day_of(sale.get("at")), []).append(sale)
    series = []
    for number in range(1, days_in_month(month) + 1):
        day = month + "-" + str(number).zfill(2)
        listed = bucket.get(day) or []
        sum_row = totals(listed)
        series.append({
            "day": day,
            "label": str(number) + "/" + str(int(month[5:7])),
            "orders": sum_row["orders"],
            "revenue": sum_row["revenue"],
            "profit": sum_row["profit"],
        })
    sum_all = totals(found["rows"])
    return {
        "ok": True,
        "month": month,
        "orders": sum_all["orders"],
        "revenue": sum_all["revenue"],
        "profit": sum_all["profit"],
        "series": series,
    }


def by_branch(db, opts):
    if not month_ok(opts.get("month")):
        return {"ok": False, "message": "Tháng báo cáo không hợp lệ."}
    scope = scope_of(opts.get("viewer"), "all")
    if not scope["ok"]:
        return scope
    found = sales_in(db, {"viewer": opts.get("viewer"), "branchId": "all", "month": opts.get("month")})
    if not found["ok"]:
        return found
    focus = scope["branchId"] if scope["branchId"] != "all" else (text(opts.get("branchId")) or "all")
    branches = [branch for branch in db.get("branches") or [] if scope["branchId"] == "all" or branch["id"] == scope["branchId"]]
    rows = []
    for branch in branches:
        listed = [sale for sale in found["rows"] if sale.get("branchId") == branch["id"]]
        sum_row = totals(listed)
        rows.append({
            "branchId": branch["id"],
            "name": branch.get("short") or branch.get("name") or branch["id"],
            "orders": sum_row["orders"],
            "revenue": sum_row["revenue"],
            "profit": sum_row["profit"],
        })
    revenue = sum(row["revenue"] for row in rows)
    for row in rows:
        row["share"] = share_of(row["revenue"], revenue)
    rows.sort(key=lambda row: (-row["revenue"], text(row["name"]).lower()))
    chosen = next((row for row in rows if row["branchId"] == focus), {"orders": 0, "revenue": 0, "profit": 0})
    every = focus == "all"
    return {
        "ok": True,
        "focus": focus,
        "orders": sum(row["orders"] for row in rows) if every else chosen["orders"],
        "revenue": revenue if every else chosen["revenue"],
        "profit": sum(row["profit"] for row in rows) if every else chosen["profit"],
        "rows": rows,
    }


def by_staff(db, opts):
    if not month_ok(opts.get("month")):
        return {"ok": False, "message": "Tháng báo cáo không hợp lệ."}
    found = sales_in(db, {"viewer": opts.get("viewer"), "branchId": opts.get("branchId"), "month": opts.get("month")})
    if not found["ok"]:
        return found
    staff_id = text(opts.get("staffId")) or "all"
    if staff_id != "all":
        user = next((item for item in db.get("users") or [] if item.get("id") == staff_id), None)
        if not user:
            return {"ok": False, "message": "Không tìm thấy nhân viên."}
        if found["branchId"] != "all" and user.get("branchId") != found["branchId"]:
            return {"ok": False, "message": "Nhân viên không thuộc phạm vi báo cáo."}
        name = text(user.get("name"))
        own = [sale for sale in found["rows"] if text(sale.get("cashier")) == name]
        sum_row = totals(own)
        return {
            "ok": True,
            "mode": "one",
            "staffName": name,
            "orders": sum_row["orders"],
            "revenue": sum_row["revenue"],
            "profit": sum_row["profit"],
            "invoices": sorted((invoice_of(sale) for sale in own), key=lambda row: text(row["at"]), reverse=True),
        }
    ranked = {}
    order = []
    for sale in found["rows"]:
        key = (sale.get("branchId") or "") + "\n" + (text(sale.get("cashier")) or "Thu ngân")
        if key not in ranked:
            ranked[key] = {
                "cashier": text(sale.get("cashier")) or "Thu ngân",
                "branchId": sale.get("branchId") or "",
                "orders": 0,
                "revenue": 0,
                "profit": 0,
            }
            order.append(ranked[key])
        ranked[key]["orders"] += 1
        ranked[key]["revenue"] += revenue_of(sale)
        ranked[key]["profit"] += profit_of(sale)
    order.sort(key=lambda row: (-row["revenue"], text(row["cashier"]).lower()))
    sum_all = totals(found["rows"])
    return {"ok": True, "mode": "all", "orders": sum_all["orders"], "revenue": sum_all["revenue"], "rows": order}


def qty_sold(db, opts):
    if not month_ok(opts.get("month")):
        return {"ok": False, "message": "Tháng báo cáo không hợp lệ."}
    found = sales_in(db, {"viewer": opts.get("viewer"), "branchId": opts.get("branchId"), "month": opts.get("month")})
    if not found["ok"]:
        return found
    rows = medicine_groups(found["rows"])
    qty = sum(row["qty"] for row in rows)
    for row in rows:
        row["share"] = share_of(row["qty"], qty)
    rows.sort(key=lambda row: text(row["name"]).lower())
    return {"ok": True, "qty": qty, "revenue": sum(row["revenue"] for row in rows), "rows": rows}


def bestsellers(db, opts):
    if not month_ok(opts.get("month")):
        return {"ok": False, "message": "Tháng báo cáo không hợp lệ."}
    criterion = text(opts.get("criterion")) or "qty"
    if criterion not in ("qty", "revenue"):
        return {"ok": False, "message": "Tiêu chí bán chạy chưa hợp lệ."}
    found = sales_in(db, {"viewer": opts.get("viewer"), "branchId": opts.get("branchId"), "month": opts.get("month")})
    if not found["ok"]:
        return found
    rows = medicine_groups(found["rows"])
    rows.sort(key=lambda row: (-row[criterion], text(row["name"]).lower()))
    limit = text(opts.get("limit")) or "all"
    if limit != "all":
        size = int_in(limit, 1, 100)
        if size is None:
            return {"ok": False, "message": "Số dòng bán chạy chưa hợp lệ."}
        rows = rows[:size]
    for index, row in enumerate(rows):
        row["rank"] = index + 1
    return {"ok": True, "criterion": criterion, "rows": rows}


def purchases(db, opts):
    if not month_ok(opts.get("month")):
        return {"ok": False, "message": "Tháng báo cáo không hợp lệ."}
    scope = scope_of(opts.get("viewer"), opts.get("branchId"))
    if not scope["ok"]:
        return scope
    month = text(opts.get("month"))
    rows = []
    skipped = 0
    for receipt in db.get("receipts") or []:
        day = day_of(receipt.get("confirmedAt") or receipt.get("at"))
        if day[:7] != month:
            continue
        if scope["branchId"] != "all" and receipt.get("branchId") != scope["branchId"]:
            continue
        if receipt.get("status") != "confirmed":
            skipped += 1
            continue
        supplier = next((item for item in db.get("suppliers") or [] if item.get("id") == receipt.get("supplierId")), None)
        rows.append({
            "code": receipt.get("code") or "",
            "supplier": supplier["name"] if supplier else "",
            "total": receipt.get("total") or 0,
        })
    rows.sort(key=lambda row: row["code"])
    return {
        "ok": True,
        "count": len(rows),
        "skipped": skipped,
        "total": sum(row["total"] for row in rows),
        "rows": rows,
    }


def stock_report(db, opts):
    scope = scope_of(opts.get("viewer"), opts.get("branchId"))
    if not scope["ok"]:
        return scope
    meds = [med for med in db.get("medicines") or [] if scope["branchId"] == "all" or med.get("branchId") == scope["branchId"]]
    branches = [branch for branch in db.get("branches") or [] if scope["branchId"] == "all" or branch["id"] == scope["branchId"]]
    groups = []
    for branch in branches:
        listed = [med for med in meds if med.get("branchId") == branch["id"]]
        groups.append({
            "branchId": branch["id"],
            "name": branch.get("short") or branch.get("name") or branch["id"],
            "sku": len(listed),
            "qty": sum((med.get("stock") or 0) for med in listed),
            "value": sum((med.get("stock") or 0) * (med.get("cost") or 0) for med in listed),
        })
    groups.sort(key=lambda row: text(row["name"]).lower())
    return {
        "ok": True,
        "sku": len(meds),
        "qty": sum(row["qty"] for row in groups),
        "value": sum(row["value"] for row in groups),
        "groups": groups,
    }


def lots_of(med):
    if med.get("lots"):
        return med["lots"]
    if not med.get("batch") and not med.get("expiry"):
        return []
    return [{"batch": med.get("batch") or "", "expiry": med.get("expiry") or "", "qty": med.get("stock") or 0}]


def expiry_report(db, opts):
    scope = scope_of(opts.get("viewer"), opts.get("branchId"))
    if not scope["ok"]:
        return scope
    if not date_ok(opts.get("today")):
        return {"ok": False, "message": "Thiếu ngày đối chiếu hạn dùng."}
    window = int_in(opts.get("days"), 1, 365)
    if window is None:
        return {"ok": False, "message": "Số ngày cảnh báo hạn dùng từ 1 đến 365."}
    rows = []
    for med in db.get("medicines") or []:
        if scope["branchId"] != "all" and med.get("branchId") != scope["branchId"]:
            continue
        for lot in lots_of(med):
            expiry = text(lot.get("expiry"))
            left = days_until(expiry, opts.get("today"))
            if left is None or left > window:
                continue
            rows.append({
                "name": med.get("name") or "",
                "expiry": expiry,
                "left": left,
                "expired": left < 0,
            })
    rows.sort(key=lambda row: (row["expiry"], text(row["name"]).lower()))
    return {
        "ok": True,
        "expired": sum(1 for row in rows if row["expired"]),
        "soon": sum(1 for row in rows if not row["expired"]),
        "rows": rows,
    }


def low_stock(db, opts):
    scope = scope_of(opts.get("viewer"), opts.get("branchId"))
    if not scope["ok"]:
        return scope
    rows = []
    for med in db.get("medicines") or []:
        if scope["branchId"] != "all" and med.get("branchId") != scope["branchId"]:
            continue
        stock = med.get("stock") or 0
        minimum = med.get("minStock") or 0
        if not (minimum > 0 and stock < minimum):
            continue
        rows.append({"name": med.get("name") or "", "shortage": minimum - stock})
    rows.sort(key=lambda row: (-row["shortage"], text(row["name"]).lower()))
    return {"ok": True, "count": len(rows), "shortage": sum(row["shortage"] for row in rows), "rows": rows}


def sample():
    return {
        "branches": [
            {"id": "b1", "name": "Quận 1", "short": "Quận 1"},
            {"id": "b2", "name": "Quận 3", "short": "Quận 3"},
        ],
        "users": [
            {"id": "u2", "name": "Lan", "role": "cashier", "branchId": "b1", "status": "active"},
            {"id": "u3", "name": "Minh", "role": "cashier", "branchId": "b2", "status": "active"},
        ],
        "suppliers": [{"id": "n1", "name": "Dược Hậu Giang"}],
        "medicines": [
            {"id": "m1", "name": "Para", "branchId": "b1", "stock": 2, "minStock": 5, "cost": 30000, "lots": [{"batch": "L1", "expiry": "2026-10-20", "qty": 2}]},
            {"id": "m2", "name": "C", "branchId": "b2", "stock": 10, "minStock": 4, "cost": 10000, "lots": [{"batch": "C1", "expiry": "2027-01-01", "qty": 10}]},
            {"id": "m3", "name": "Old", "branchId": "b1", "stock": 1, "minStock": 0, "cost": 1000, "lots": [{"batch": "O1", "expiry": "2020-01-01", "qty": 1}]},
        ],
        "sales": [
            {
                "id": "s1", "code": "HD1", "branchId": "b1", "cashier": " Lan ", "customer": "An",
                "status": "paid", "at": "2026-10-11T08:00:00", "total": 100000, "discountAmount": 0,
                "lines": [{"medicineId": "m1", "name": "Para", "qty": 2, "price": 50000, "cost": 30000, "amount": 100000}],
            },
            {
                "id": "s2", "code": "HD2", "branchId": "b1", "cashier": "Lan", "status": "cancelled",
                "at": "2026-10-11T09:00:00", "total": 50000,
                "lines": [{"medicineId": "m1", "name": "Para", "qty": 1, "price": 50000, "cost": 30000, "amount": 50000}],
            },
            {
                "id": "s3", "code": "HD3", "branchId": "b2", "cashier": "Minh", "status": "paid",
                "at": "2026-10-02T10:00:00", "total": 80000, "discountAmount": 0,
                "lines": [{"medicineId": "m2", "name": "C", "qty": 4, "price": 20000, "cost": 10000, "amount": 80000}],
            },
            {
                "id": "s4", "code": "HD4", "branchId": "b1", "cashier": "Lan", "status": "paid",
                "at": "2026-09-30T10:00:00", "total": 10000, "discountAmount": 0,
                "lines": [{"medicineId": "m1", "name": "Para", "qty": 1, "price": 10000, "cost": 5000, "amount": 10000}],
            },
        ],
        "receipts": [
            {"id": "p1", "code": "PN1", "branchId": "b1", "supplierId": "n1", "status": "confirmed", "total": 200000, "at": "2026-10-05T08:00:00", "lines": [{}, {}]},
            {"id": "p2", "code": "PN2", "branchId": "b1", "status": "draft", "total": 999, "at": "2026-10-06T08:00:00"},
            {"id": "p3", "code": "PN3", "branchId": "b2", "status": "cancelled", "total": 50, "at": "2026-10-06T08:00:00"},
            {"id": "p4", "code": "PN4", "branchId": "b1", "supplierId": "n1", "status": "confirmed", "total": 5000, "at": "2026-09-01T08:00:00"},
        ],
    }


def expect(condition, label, detail=None):
    if condition:
        return 0
    print("Lỗi:", label, "" if detail is None else detail)
    return 1


def main():
    failed = 0
    db = sample()
    admin = {"id": "u1", "role": "admin", "branchId": "all", "status": "active"}
    manager = {"id": "u9", "role": "manager", "branchId": "b1", "status": "active"}
    cashier = {"id": "u8", "role": "cashier", "branchId": "b1", "status": "active"}

    day = daily(db, {"viewer": admin, "date": "2026-10-11", "branchId": "all"})
    failed += expect(day["ok"] and day["revenue"] == 100000 and day["orders"] == 1 and day["profit"] == 40000, "Doanh thu một ngày, bỏ hóa đơn hủy", (day.get("revenue"), day.get("orders"), day.get("profit")))
    failed += expect(day["invoices"][0]["cashier"] == "Lan", "Tên nhân viên được cắt khoảng trắng", day["invoices"])
    blocked_day = daily(db, {"viewer": admin, "date": "2026-02-31"})
    failed += expect(not blocked_day["ok"] and "không hợp lệ" in blocked_day["message"], "Chặn ngày không tồn tại", blocked_day)
    own = daily(db, {"viewer": manager, "date": "2026-10-11", "branchId": "b2"})
    failed += expect(own["ok"] and own["branchId"] == "b1" and own["revenue"] == 100000, "Quản lý chỉ xem doanh thu chi nhánh mình", own)
    other = daily(db, {"viewer": {"role": "manager", "branchId": "b2", "status": "active"}, "date": "2026-10-11"})
    failed += expect(other["ok"] and other["revenue"] == 0, "Chi nhánh kia không thấy doanh thu ngày 11", other)
    denied = daily(db, {"viewer": cashier, "date": "2026-10-11"})
    failed += expect(not denied["ok"] and "quyền" in denied["message"], "Thu ngân không xem báo cáo", denied)

    month = monthly(db, {"viewer": admin, "month": "2026-10", "branchId": "all"})
    failed += expect(month["ok"] and len(month["series"]) == 31 and month["revenue"] == 180000 and month["profit"] == 80000, "Tổng hợp cả tháng và đủ số ngày", (month.get("revenue"), month.get("profit"), len(month.get("series") or [])))
    failed += expect(month["series"][1]["revenue"] == 80000 and month["series"][10]["revenue"] == 100000, "Biểu đồ đúng ngày 2 và ngày 11", (month["series"][1], month["series"][10]))
    short = monthly(db, {"viewer": admin, "month": "2026-02"})
    failed += expect(short["ok"] and len(short["series"]) == 28 and short["revenue"] == 0, "Tháng hai đủ 28 cột", len(short.get("series") or []))
    bad_month = monthly(db, {"viewer": admin, "month": "2026-13"})
    failed += expect(not bad_month["ok"], "Chặn tháng 13", bad_month)

    compared = by_branch(db, {"viewer": admin, "month": "2026-10", "branchId": "b1"})
    failed += expect(compared["revenue"] == 100000 and [row["branchId"] for row in compared["rows"]] == ["b1", "b2"], "Chọn một chi nhánh và vẫn so sánh các chi nhánh", compared)
    failed += expect(compared["rows"][0]["share"] == 55.6 and compared["rows"][1]["share"] == 44.4, "Tỷ trọng doanh thu", [row["share"] for row in compared["rows"]])
    missing = by_branch(db, {"viewer": admin, "month": "2026-10", "branchId": "b9"})
    failed += expect(missing["revenue"] == 0 and len(missing["rows"]) == 2, "Chi nhánh không tồn tại có doanh thu bằng 0", missing["revenue"])
    narrowed = by_branch(db, {"viewer": manager, "month": "2026-10", "branchId": "b2"})
    failed += expect(len(narrowed["rows"]) == 1 and narrowed["rows"][0]["branchId"] == "b1", "Quản lý không so sánh chi nhánh khác", narrowed["rows"])

    people = by_staff(db, {"viewer": admin, "month": "2026-10", "branchId": "all", "staffId": "all"})
    failed += expect(people["mode"] == "all" and [row["cashier"] for row in people["rows"]] == ["Lan", "Minh"] and people["revenue"] == 180000, "Xếp doanh thu theo nhân viên", people["rows"])
    one = by_staff(db, {"viewer": admin, "month": "2026-10", "staffId": "u2"})
    failed += expect(one["mode"] == "one" and one["revenue"] == 100000 and one["orders"] == 1, "Chọn một nhân viên", one)
    outside = by_staff(db, {"viewer": manager, "month": "2026-10", "staffId": "u3"})
    failed += expect(not outside["ok"] and "phạm vi" in outside["message"], "Không xem nhân viên chi nhánh khác", outside)

    sold = qty_sold(db, {"viewer": admin, "month": "2026-10"})
    failed += expect([row["name"] for row in sold["rows"]] == ["C", "Para"] and sold["rows"][0]["qty"] == 4 and sold["qty"] == 6, "Phân loại số lượng theo thuốc", sold["rows"])
    hot_qty = bestsellers(db, {"viewer": admin, "month": "2026-10", "criterion": "qty", "limit": "1"})
    hot_money = bestsellers(db, {"viewer": admin, "month": "2026-10", "criterion": "revenue", "limit": "10"})
    failed += expect(hot_qty["rows"][0]["name"] == "C" and hot_qty["rows"][0]["rank"] == 1 and len(hot_qty["rows"]) == 1, "Bán chạy theo số lượng", hot_qty["rows"])
    failed += expect([row["name"] for row in hot_money["rows"]] == ["Para", "C"], "Bán chạy theo doanh thu", hot_money["rows"])
    bad_rule = bestsellers(db, {"viewer": admin, "month": "2026-10", "criterion": "margin"})
    failed += expect(not bad_rule["ok"], "Chặn tiêu chí lạ", bad_rule)

    bought = purchases(db, {"viewer": admin, "month": "2026-10"})
    failed += expect(bought["total"] == 200000 and bought["count"] == 1 and bought["skipped"] == 2 and bought["rows"][0]["supplier"] == "Dược Hậu Giang", "Chỉ cộng phiếu nhập đã xác nhận", bought)
    september = purchases(db, {"viewer": admin, "month": "2026-09"})
    failed += expect(september["total"] == 5000 and september["count"] == 1, "Phiếu nhập tháng khác không lẫn", september)

    stock = stock_report(db, {"viewer": admin, "branchId": "all"})
    failed += expect(stock["qty"] == 13 and stock["value"] == 161000 and [row["branchId"] for row in stock["groups"]] == ["b1", "b2"], "Tồn kho tách theo chi nhánh", stock)
    aged = expiry_report(db, {"viewer": admin, "days": "30", "today": "2026-10-11"})
    failed += expect([row["name"] for row in aged["rows"]] == ["Old", "Para"] and aged["expired"] == 1 and aged["soon"] == 1, "Lọc và sắp lô gần hết hạn", aged)
    bad_window = expiry_report(db, {"viewer": admin, "days": "0", "today": "2026-10-11"})
    failed += expect(not bad_window["ok"], "Chặn mốc hạn bằng 0", bad_window)
    low = low_stock(db, {"viewer": admin})
    failed += expect(low["count"] == 1 and low["rows"][0]["name"] == "Para" and low["shortage"] == 3, "Lọc thuốc dưới mức tối thiểu", low)
    quiet = low_stock(db, {"viewer": {"role": "manager", "branchId": "b2", "status": "active"}})
    failed += expect(quiet["count"] == 0, "Chi nhánh đủ tồn không bị liệt kê", quiet)

    discounted = {
        "sales": [{
            "status": "paid", "branchId": "b1", "at": "2026-10-03T08:00:00", "total": 90000, "discountAmount": 10000,
            "lines": [
                {"medicineId": "m1", "name": "Para", "qty": 1, "price": 60000, "cost": 40000, "amount": 60000},
                {"medicineId": "m2", "name": "C", "qty": 1, "price": 40000, "cost": 20000, "amount": 40000},
            ],
        }],
    }
    shared = qty_sold(discounted, {"viewer": admin, "month": "2026-10"})
    failed += expect(shared["revenue"] == 90000 and shared["rows"][1]["revenue"] == 54000 and shared["rows"][0]["revenue"] == 36000, "Phân bổ giảm giá vào từng thuốc", shared["rows"])

    if failed:
        print("Có", failed, "lỗi")
        return 1
    print("Đạt toàn bộ kiểm tra báo cáo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
