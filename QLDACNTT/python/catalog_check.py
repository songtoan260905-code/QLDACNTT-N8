# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc thuốc, danh mục và nhà sản xuất.

Chạy: python python/catalog_check.py
Cùng quy tắc với js/medicines.js, js/catalog.js và js/pager.js.
"""

import math
import re
import sys

PAGE_MED = 6
PAGE_CAT = 5


def text(value):
    return str("" if value is None else value).strip()


def lower(value):
    return text(value).lower()


def digits(value):
    if isinstance(value, bool):
        return text(value)
    if isinstance(value, int) and value >= 0:
        return str(value)
    return text(value)


def money_ok(value):
    raw = digits(value)
    return bool(re.fullmatch(r"\d+", raw)) and int(raw) < 10**12


def int_ok(value):
    raw = digits(value)
    return bool(re.fullmatch(r"\d+", raw)) and int(raw) < 1000000


def date_ok(value):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text(value))
    if not match:
        return False
    y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if m < 1 or m > 12 or d < 1 or d > 31:
        return False
    month_len = [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return d <= month_len[m - 1]


def days_until(iso, today):
    if not date_ok(iso) or not date_ok(today):
        return -99999
    ay, am, ad = [int(p) for p in today.split("-")]
    by, bm, bd = [int(p) for p in iso.split("-")]
    from datetime import date
    return (date(by, bm, bd) - date(ay, am, ad)).days


def code_ok(value):
    return bool(re.fullmatch(r"[A-Z0-9][A-Z0-9-]{1,19}", text(value).upper()))


def strength_ok(value):
    return bool(re.fullmatch(r"\d+(?:[.,]\d+)?\s*(mg|g|mcg|µg|ml|l|iu|ui|%)", text(value), re.I))


def batch_ok(value):
    return bool(re.fullmatch(r"[A-Z0-9][A-Z0-9./-]{1,29}", text(value).upper()))


def phone_ok(value):
    raw = re.sub(r"[\s.+()-]", "", text(value))
    return bool(re.fullmatch(r"0\d{8,10}", raw) or re.fullmatch(r"84\d{8,10}", raw))


def clamp(rows, page, page_size):
    size = page_size if page_size and page_size > 0 else 6
    total = len(rows)
    pages = max(1, math.ceil(total / size)) if size else 1
    current = min(max(1, int(page or 1)), pages)
    start = (current - 1) * size
    return {"rows": rows[start:start + size], "total": total, "page": current, "pages": pages}


def next_code(medicines):
    max_n = 0
    for med in medicines or []:
        match = re.fullmatch(r"T(\d+)", text(med.get("code") or med.get("sku")).upper())
        if match:
            max_n = max(max_n, int(match.group(1)))
    return "T" + str(max_n + 1).zfill(4)


def validate_medicine(data, ctx):
    ctx = ctx or {}
    med_id = text(data.get("id"))
    name = text(data.get("name"))
    code = text(data.get("code")).upper()
    ingredient = text(data.get("activeIngredient"))
    strength = text(data.get("strength"))
    batch = text(data.get("batch")).upper()
    expiry = text(data.get("expiry"))
    branch_id = text(data.get("branchId"))
    status = "discontinued" if data.get("status") == "discontinued" else "active"
    category = next((item for item in ctx.get("categories") or [] if item["id"] == data.get("categoryId")), None)
    maker = next((item for item in ctx.get("manufacturers") or [] if item["id"] == data.get("manufacturerId")), None)
    unit = next((item for item in ctx.get("units") or [] if item["id"] == data.get("unitId")), None)
    form = next((item for item in ctx.get("forms") or [] if item["id"] == data.get("dosageFormId")), None)
    if len(name) < 2:
        return False, "Tên thuốc cần ít nhất 2 ký tự."
    if not code_ok(code):
        return False, "Mã thuốc cần 2–20 ký tự chữ, số hoặc gạch ngang."
    for med in ctx.get("medicines") or []:
        if med.get("id") == med_id:
            continue
        current = text(med.get("code") or med.get("sku")).upper()
        if current == code:
            return False, "Mã thuốc đã tồn tại."
    if len(ingredient) < 2:
        return False, "Cần nhập hoạt chất."
    if not strength_ok(strength):
        return False, "Hàm lượng cần dạng như 500mg, 5ml hoặc 10%."
    if not category:
        return False, "Cần chọn danh mục thuốc."
    if not maker:
        return False, "Cần chọn nhà sản xuất."
    if maker.get("status") == "inactive" and data.get("manufacturerId") != ctx.get("keepManufacturerId"):
        return False, "Nhà sản xuất đang ngừng hợp tác."
    if not unit:
        return False, "Cần chọn đơn vị tính."
    if not form:
        return False, "Cần chọn dạng bào chế."
    if not money_ok(data.get("cost")):
        return False, "Giá nhập phải là số nguyên không âm."
    if not money_ok(data.get("price")):
        return False, "Giá bán phải là số nguyên không âm."
    cost = int(digits(data.get("cost")))
    price = int(digits(data.get("price")))
    if price < cost:
        return False, "Giá bán không được thấp hơn giá nhập."
    if not int_ok(data.get("minStock")):
        return False, "Tồn tối thiểu phải là số nguyên không âm."
    if not ctx.get("editing") and not int_ok(data.get("stock")):
        return False, "Tồn đầu phải là số nguyên không âm."
    if not date_ok(expiry):
        return False, "Hạn sử dụng chưa đúng định dạng ngày (YYYY-MM-DD)."
    if not ctx.get("editing") and ctx.get("today") and expiry < ctx.get("today"):
        return False, "Hạn sử dụng phải từ hôm nay trở đi."
    if not batch_ok(batch):
        return False, "Số lô cần 2–30 ký tự chữ, số, dấu chấm, gạch hoặc gạch chéo."
    if not branch_id:
        return False, "Cần chọn chi nhánh."
    for med in ctx.get("medicines") or []:
        if med.get("id") == med_id:
            continue
        if med.get("branchId") == branch_id and lower(med.get("name")) == lower(name) and lower(med.get("strength")) == lower(strength):
            return False, "Thuốc cùng tên và hàm lượng đã có tại chi nhánh này."
    return True, {
        "code": code,
        "price": price,
        "cost": cost,
        "status": status,
        "batch": batch,
        "category": category["name"],
    }


def validate_category(data, categories):
    name = text(data.get("name"))
    cat_id = text(data.get("id"))
    if len(name) < 2:
        return False, "Tên danh mục cần ít nhất 2 ký tự."
    for item in categories or []:
        if item.get("id") != cat_id and lower(item.get("name")) == lower(name):
            return False, "Tên danh mục đã tồn tại."
    return True, {"name": name}


def validate_manufacturer(data, manufacturers):
    name = text(data.get("name"))
    maker_id = text(data.get("id"))
    phone = text(data.get("phone"))
    if len(name) < 2:
        return False, "Tên nhà sản xuất cần ít nhất 2 ký tự."
    if phone and not phone_ok(phone):
        return False, "Số điện thoại nhà sản xuất chưa hợp lệ."
    for item in manufacturers or []:
        if item.get("id") != maker_id and lower(item.get("name")) == lower(name):
            return False, "Nhà sản xuất đã tồn tại."
    status = "inactive" if data.get("status") == "inactive" else "active"
    return True, {"name": name, "phone": phone, "status": status}


def usage(medicines, key, item_id):
    count = sum(1 for med in medicines or [] if med.get(key) == item_id)
    return {"count": count, "blocked": count > 0}


def related_sales(sales, medicine_id):
    count = 0
    for sale in sales or []:
        for line in sale.get("lines") or []:
            if line.get("medicineId") == medicine_id:
                count += 1
    return {"count": count, "blocked": count > 0}


def sellable(med, today):
    if (med.get("status") or "active") != "active":
        return False, "Thuốc đang ngừng kinh doanh, không bán được."
    if days_until(med.get("expiry"), today) < 0:
        return False, "Thuốc đã hết hạn."
    if int(med.get("stock") or 0) <= 0:
        return False, "Thuốc đã hết hàng."
    return True, ""


def keyword_hit(blob, q):
    parts = [part for part in text(q).lower().split() if part]
    hay = str(blob or "").lower()
    return all(part in hay for part in parts)


def query_medicines(rows, opts):
    category_id = opts.get("categoryId") or "all"
    manufacturer_id = opts.get("manufacturerId") or "all"
    status = opts.get("status") or "all"
    selected = next((item for item in opts.get("categories") or [] if item["id"] == category_id), None)
    category_name = selected["name"] if selected else category_id
    found = []
    for med in rows:
        blob = " ".join([
            text(med.get("name")), text(med.get("code")), text(med.get("activeIngredient")), text(med.get("strength")),
        ])
        if not keyword_hit(blob, opts.get("q")):
            continue
        if category_id != "all" and med.get("categoryId") != category_id and lower(med.get("category")) != lower(category_name):
            continue
        if manufacturer_id != "all" and med.get("manufacturerId") != manufacturer_id:
            continue
        if status != "all" and (med.get("status") or "active") != status:
            continue
        found.append(med)
    return clamp(found, opts.get("page") or 1, opts.get("pageSize") or PAGE_MED)


def sample_medicine(**extra):
    data = {
        "name": "Paracetamol",
        "code": "T0001",
        "activeIngredient": "Paracetamol",
        "strength": "500mg",
        "categoryId": "c1",
        "manufacturerId": "p1",
        "unitId": "u-hop",
        "dosageFormId": "f-vien",
        "cost": "8000",
        "price": "15000",
        "minStock": "10",
        "stock": "20",
        "expiry": "2027-01-15",
        "batch": "L2601",
        "branchId": "b1",
        "status": "active",
    }
    data.update(extra)
    return data


def catalog():
    return {
        "categories": [{"id": "c1", "name": "Giảm đau"}],
        "manufacturers": [{"id": "p1", "name": "DHG", "status": "active"}],
        "units": [{"id": "u-hop", "name": "Hộp"}],
        "forms": [{"id": "f-vien", "name": "Viên nén"}],
        "medicines": [],
        "today": "2026-10-09",
    }


def expect(ok, label, detail):
    if ok:
        print("OK  ", label)
        return 0
    print("FAIL", label, "—", detail)
    return 1


def main():
    failed = 0
    ctx = catalog()
    good, value = validate_medicine(sample_medicine(), ctx)
    failed += expect(good and value["code"] == "T0001" and value["price"] == 15000, "Thêm thuốc hợp lệ", value)

    bad_code, code_msg = validate_medicine(sample_medicine(code="1"), ctx)
    failed += expect(not bad_code and "Mã thuốc" in code_msg, "Mã thuốc sai định dạng", code_msg)

    ctx["medicines"] = [{"id": "m1", "code": "T0001", "sku": "T0001", "branchId": "b1", "name": "Khác", "strength": "250mg"}]
    dup, dup_msg = validate_medicine(sample_medicine(), ctx)
    failed += expect(not dup and dup_msg == "Mã thuốc đã tồn tại.", "Chặn mã trùng", dup_msg)
    failed += expect(next_code(ctx["medicines"]) == "T0002", "Sinh mã kế tiếp", next_code(ctx["medicines"]))

    named, named_msg = validate_medicine(sample_medicine(code="T0009", name="Khác", strength="250mg"), ctx)
    failed += expect(not named and "hàm lượng" in named_msg, "Tên và hàm lượng trùng chi nhánh", named_msg)

    weak, weak_msg = validate_medicine(sample_medicine(code="T0003", strength="vừa"), ctx)
    failed += expect(not weak and "Hàm lượng" in weak_msg, "Hàm lượng sai định dạng", weak_msg)

    cheap, cheap_msg = validate_medicine(sample_medicine(code="T0003", price="1000", cost="8000"), ctx)
    failed += expect(not cheap and "Giá bán" in cheap_msg, "Giá bán thấp hơn giá nhập", cheap_msg)

    past, past_msg = validate_medicine(sample_medicine(code="T0003", expiry="2020-01-01"), ctx)
    failed += expect(not past and "Hạn sử dụng" in past_msg, "Hạn dùng trong quá khứ khi thêm", past_msg)

    edited, _ = validate_medicine(sample_medicine(id="m9", code="T0008", expiry="2020-01-01"), dict(ctx, editing=True))
    failed += expect(edited, "Sửa thuốc được giữ hạn đã qua", edited)

    bad_lot, lot_msg = validate_medicine(sample_medicine(code="T0003", batch="!"), ctx)
    failed += expect(not bad_lot and "Số lô" in lot_msg, "Số lô sai", lot_msg)

    cat_ok, _ = validate_category({"name": "Kháng sinh"}, [])
    cat_dup, cat_msg = validate_category({"name": "kháng sinh"}, [{"id": "c2", "name": "Kháng sinh"}])
    failed += expect(cat_ok and not cat_dup and "tồn tại" in cat_msg, "Danh mục: thêm và chặn trùng", cat_msg)

    maker_bad, maker_msg = validate_manufacturer({"name": "Stada", "phone": "123"}, [])
    maker_ok, maker_value = validate_manufacturer({"name": "Stada", "phone": "0901234567", "status": "inactive"}, [])
    failed += expect(not maker_bad and maker_ok and maker_value["status"] == "inactive", "Nhà sản xuất", maker_msg)

    bound = usage([{"categoryId": "c1"}, {"categoryId": "c1"}], "categoryId", "c1")
    failed += expect(bound["blocked"] and bound["count"] == 2, "Không xóa danh mục còn thuốc", bound)
    sales = related_sales([{"lines": [{"medicineId": "m1"}, {"medicineId": "m2"}]}], "m1")
    failed += expect(sales["blocked"] and sales["count"] == 1, "Không xóa thuốc đã bán", sales)

    stopped, stop_msg = sellable({"status": "discontinued", "expiry": "2027-01-01", "stock": 5}, "2026-10-09")
    open_sale, _ = sellable({"status": "active", "expiry": "2027-01-01", "stock": 5}, "2026-10-09")
    failed += expect((not stopped) and "ngừng kinh doanh" in stop_msg and open_sale, "Ngừng kinh doanh thì không bán", stop_msg)

    rows = []
    for i in range(8):
        rows.append({
            "id": "m" + str(i),
            "name": "Para " + str(i),
            "code": "T" + str(i),
            "activeIngredient": "Paracetamol" if i < 3 else "Vitamin",
            "strength": "500mg",
            "categoryId": "c1" if i % 2 == 0 else "c2",
            "category": "Giảm đau" if i % 2 == 0 else "Vitamin",
            "manufacturerId": "p1" if i < 4 else "p2",
            "status": "discontinued" if i == 7 else "active",
        })
    listed = query_medicines(rows, {"q": "para khongco", "page": 1, "categories": ctx["categories"]})
    failed += expect(listed["total"] == 0, "Từ khóa phải khớp mọi token", listed["total"])
    both = query_medicines(rows, {"q": "para vitamin", "page": 1})
    failed += expect(both["total"] == 5, "Khớp đồng thời tên và hoạt chất", both["total"])
    pain = query_medicines(rows, {"categoryId": "c1", "page": 1, "categories": ctx["categories"]})
    failed += expect(pain["total"] == 4 and pain["pages"] == 1, "Lọc theo danh mục", pain["total"])
    page2 = query_medicines(rows, {"q": "para", "page": 2, "pageSize": PAGE_MED})
    failed += expect(page2["page"] == 2 and page2["total"] == 8 and len(page2["rows"]) == 2, "Phân trang thuốc", page2)
    stopped_only = query_medicines(rows, {"status": "discontinued"})
    failed += expect(stopped_only["total"] == 1, "Lọc thuốc ngừng kinh doanh", stopped_only["total"])
    by_maker = query_medicines(rows, {"manufacturerId": "p2"})
    failed += expect(by_maker["total"] == 4, "Lọc theo nhà sản xuất", by_maker["total"])

    if failed:
        print("Có", failed, "lỗi")
        return 1
    print("Đạt toàn bộ kiểm tra thuốc và danh mục")
    return 0


if __name__ == "__main__":
    sys.exit(main())
