# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc tồn kho, kiểm kê, chuyển kho và cảnh báo.

Chạy: python python/inventory_check.py
Cùng quy tắc với js/inventory.js.
"""

import re


PAGE_SIZE = 8
REASONS = ["count", "damage", "expiry", "loss", "found", "other"]


def text(value):
    return str("" if value is None else value).strip()


def digits(value):
    if isinstance(value, bool):
        return text(value)
    if isinstance(value, int) and value >= 0:
        return str(value)
    return text(value)


def parse_qty(value, allow_zero):
    raw = digits(value)
    if not re.fullmatch(r"\d+", raw):
        return None
    number = int(raw)
    if number >= 1000000:
        return None
    if not allow_zero and number < 1:
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


def days_until(iso, today):
    if not date_ok(iso) or not date_ok(today):
        return None
    from datetime import date
    return (date.fromisoformat(iso) - date.fromisoformat(today)).days


def warn_days(settings):
    number = settings.get("expiryWarnDays") if settings else None
    if not isinstance(number, int) or isinstance(number, bool) or number < 1 or number > 365:
        return 45
    return number


def set_warn_days(settings, value):
    number = parse_qty(value, False)
    if number is None or number > 365:
        return {"ok": False, "message": "Khoảng cảnh báo hạn dùng từ 1 đến 365 ngày."}
    settings["expiryWarnDays"] = number
    return {"ok": True, "days": number}


def keyword_hit(med, query):
    parts = [part for part in text(query).lower().split() if part]
    if not parts:
        return True
    hay = (text(med.get("code")) + " " + text(med.get("sku")) + " " + text(med.get("name"))).lower()
    return all(part in hay for part in parts)


def filter_meds(rows, opts):
    opts = opts or {}
    branch_id = opts.get("branchId") or "all"
    category_id = opts.get("categoryId") or "all"
    found = []
    for med in rows or []:
        if not keyword_hit(med, opts.get("q")):
            continue
        if branch_id != "all" and med.get("branchId") != branch_id:
            continue
        if category_id != "all" and med.get("categoryId") != category_id:
            continue
        found.append(med)
    return found


def query_stock(rows, opts):
    found = filter_meds(rows, opts)
    found.sort(key=lambda med: text(med.get("name")).lower())
    return found


def list_lots(rows, opts):
    items = []
    for med in filter_meds(rows, opts):
        lots = med.get("lots") or []
        if not lots and (med.get("batch") or med.get("expiry")):
            lots = [{"batch": med.get("batch") or "", "expiry": med.get("expiry") or "", "qty": med.get("stock") or 0}]
        for lot in lots:
            items.append({"name": med.get("name"), "batch": lot.get("batch") or "", "qty": int(lot.get("qty") or 0), "expiry": lot.get("expiry") or ""})
    return items


def expiry_board(rows, opts):
    window = warn_days(opts.get("settings"))
    items = []
    for med in filter_meds(rows, opts):
        lots = med.get("lots") or [{"batch": med.get("batch") or "", "expiry": med.get("expiry") or "", "qty": med.get("stock") or 0}]
        for lot in lots:
            left = days_until(lot.get("expiry") or "", opts.get("today"))
            items.append({"name": med.get("name"), "expiry": lot.get("expiry") or "", "left": left, "near": left is not None and left <= window})
    items.sort(key=lambda item: item["expiry"] or "9999-12-31")
    if opts.get("nearOnly"):
        items = [item for item in items if item["near"]]
    return items


def push_alert(alerts, med, code, kind):
    alerts.append({
        "id": str(med.get("id") or "") + "-" + code,
        "code": code,
        "kind": kind,
        "name": med.get("name"),
    })


def collect(rows, opts):
    settings = opts.get("settings") or {}
    window = warn_days(settings)
    stock_on = settings.get("stockAlert") is not False
    expiry_on = settings.get("expiryAlert") is not False
    alerts = []
    for med in rows or []:
        stock = int(med.get("stock") or 0)
        minimum = int(med.get("minStock") or 0)
        if stock_on:
            if stock <= 0:
                push_alert(alerts, med, "out", "stock")
            elif minimum > 0 and stock < minimum:
                push_alert(alerts, med, "under", "stock")
            elif minimum > 0 and stock == minimum:
                push_alert(alerts, med, "low", "stock")
        if expiry_on:
            left = days_until(med.get("expiry") or "", opts.get("today"))
            lots = med.get("lots") or []
            for lot in lots:
                lot_left = days_until(lot.get("expiry") or "", opts.get("today"))
                if lot_left is not None and (left is None or lot_left < left):
                    left = lot_left
            if left is None:
                continue
            if left < 0:
                push_alert(alerts, med, "expired", "expiry")
            elif left <= window:
                push_alert(alerts, med, "soon", "expiry")
    return alerts


def open_alerts(rows, opts):
    db = opts.get("db")
    inbox = {}
    if db is not None:
        ensure(db)
        inbox = db["alertInbox"]
    opened = []
    for row in collect(rows, opts):
        entry = inbox.get(row["id"]) or {}
        if entry.get("dismissed"):
            continue
        row["read"] = bool(entry.get("read"))
        opened.append(row)
    return opened


def mark_alert_read(db, alert_id):
    ensure(db)
    if not alert_id:
        return {"ok": False, "message": "Không tìm thấy cảnh báo."}
    entry = db["alertInbox"].get(alert_id) or {"read": False, "dismissed": False}
    if entry.get("dismissed"):
        return {"ok": False, "message": "Cảnh báo đã được xóa."}
    if entry.get("read"):
        return {"ok": True, "already": True}
    entry["read"] = True
    db["alertInbox"][alert_id] = entry
    return {"ok": True, "already": False}


def dismiss_alert(db, alert_id):
    ensure(db)
    entry = db["alertInbox"].get(alert_id)
    if not entry or not entry.get("read"):
        return {"ok": False, "message": "Hãy đọc cảnh báo trước khi xóa."}
    entry["dismissed"] = True
    db["alertInbox"][alert_id] = entry
    return {"ok": True, "message": "Đã xóa cảnh báo."}


def ensure(db):
    db.setdefault("settings", {})
    db["settings"].setdefault("stockAlert", True)
    db["settings"].setdefault("expiryAlert", True)
    db["settings"].setdefault("expiryWarnDays", 45)
    db.setdefault("stocktakes", [])
    db.setdefault("transfers", [])
    db.setdefault("medicines", [])
    db.setdefault("branches", [])
    db.setdefault("notifications", [])
    if not isinstance(db.get("alertInbox"), dict):
        db["alertInbox"] = {}


def find_by_id(rows, row_id):
    for row in rows or []:
        if row.get("id") == row_id:
            return row
    return None


def sum_lots(med):
    return sum(int(lot.get("qty") or 0) for lot in med.get("lots") or [])


def sync_primary(med):
    alive = [lot for lot in med.get("lots") or [] if int(lot.get("qty") or 0) > 0 and lot.get("expiry")]
    alive.sort(key=lambda lot: lot.get("expiry") or "")
    if not alive:
        if not any(int(lot.get("qty") or 0) > 0 for lot in med.get("lots") or []):
            med["batch"] = ""
            med["expiry"] = ""
        return
    med["batch"] = alive[0].get("batch") or ""
    med["expiry"] = alive[0].get("expiry") or ""


def set_absolute(med, actual):
    target = int(actual or 0)
    med.setdefault("lots", [])
    if not med["lots"] and text(med.get("batch")):
        med["lots"].append({"batch": text(med.get("batch")).upper(), "expiry": med.get("expiry") or "", "qty": int(med.get("stock") or 0)})
    if not med["lots"]:
        med["stock"] = target
        return True
    delta = target - sum_lots(med)
    if delta > 0:
        newest = sorted(med["lots"], key=lambda lot: lot.get("expiry") or "")[-1]
        newest["qty"] = int(newest.get("qty") or 0) + delta
    elif delta < 0:
        need = -delta
        for lot in sorted(med["lots"], key=lambda item: item.get("expiry") or ""):
            if need <= 0:
                break
            have = int(lot.get("qty") or 0)
            take = min(have, need)
            lot["qty"] = have - take
            need -= take
        med["lots"] = [lot for lot in med["lots"] if int(lot.get("qty") or 0) > 0]
    if sum_lots(med) != target:
        med["lots"] = [] if target == 0 else [{"batch": text(med.get("batch")).upper() or "KK", "expiry": med.get("expiry") or "", "qty": target}]
    med["stock"] = target
    sync_primary(med)
    return med["stock"] == target and (not med["lots"] or sum_lots(med) == target)


def create_stocktake(db, branch_id):
    ensure(db)
    branch = find_by_id(db["branches"], branch_id)
    if not branch:
        return {"ok": False, "message": "Cần chọn chi nhánh."}
    if branch.get("status") != "open":
        return {"ok": False, "message": "Chi nhánh đang ngừng hoạt động, chưa lập phiếu kiểm kê."}
    meds = [med for med in db["medicines"] if med.get("branchId") == branch["id"]]
    if not meds:
        return {"ok": False, "message": "Chi nhánh chưa có thuốc để kiểm kê."}
    sheet = {
        "id": "kk1",
        "code": "KK20261011-001",
        "branchId": branch["id"],
        "status": "draft",
        "minute": "",
        "lines": [{
            "medicineId": med["id"],
            "name": med["name"],
            "systemQty": int(med.get("stock") or 0),
            "actualQty": None,
            "reason": "",
        } for med in meds],
    }
    db["stocktakes"].insert(0, sheet)
    return {"ok": True, "sheet": sheet}


def save_counts(sheet, values):
    if not sheet:
        return {"ok": False, "message": "Không tìm thấy phiếu kiểm kê."}
    if sheet["status"] in ("posted", "cancelled", "minuted"):
        return {"ok": False, "message": "Không sửa số lượng ở trạng thái này."}
    parsed = []
    for line in sheet["lines"]:
        raw = values.get(line["medicineId"])
        if raw is None or text(raw) == "":
            return {"ok": False, "message": "Cần nhập số lượng thực tế cho mọi thuốc."}
        qty = parse_qty(raw, True)
        if qty is None:
            return {"ok": False, "message": "Số lượng thực tế phải là số nguyên không âm."}
        parsed.append((line, qty))
    for line, qty in parsed:
        line["actualQty"] = qty
        line["variance"] = qty - int(line["systemQty"])
    sheet["status"] = "counted"
    return {"ok": True}


def record_minute(sheet, minute, reasons):
    if sheet["status"] != "counted":
        return {"ok": False, "message": "Nhập và lưu số lượng thực tế trước khi ghi biên bản."}
    if len(text(minute)) < 5:
        return {"ok": False, "message": "Biên bản kiểm kê cần ít nhất 5 ký tự."}
    for line in sheet["lines"]:
        variance = int(line["actualQty"]) - int(line["systemQty"])
        if variance == 0:
            line["reason"] = ""
            continue
        reason = text(reasons.get(line["medicineId"]))
        if reason not in REASONS:
            return {"ok": False, "message": "Chọn nguyên nhân cho " + line["name"] + "."}
        line["reason"] = reason
    sheet["minute"] = text(minute)
    sheet["status"] = "minuted"
    return {"ok": True}


def post_stocktake(db, sheet_id):
    sheet = find_by_id(db["stocktakes"], sheet_id)
    if not sheet:
        return {"ok": False, "message": "Không tìm thấy phiếu kiểm kê."}
    if sheet["status"] == "posted":
        return {"ok": False, "message": "Phiếu đã cập nhật tồn."}
    if sheet["status"] != "minuted":
        return {"ok": False, "message": "Cần ghi nhận biên bản trước khi cập nhật tồn."}
    checks = []
    for line in sheet["lines"]:
        med = find_by_id(db["medicines"], line["medicineId"])
        if not med:
            return {"ok": False, "message": "Không còn thuốc để cập nhật."}
        if not set_absolute(med, line["actualQty"]):
            return {"ok": False, "message": "Không cập nhật được tồn."}
        checks.append({"name": med["name"], "stock": med["stock"], "expected": line["actualQty"], "ok": med["stock"] == line["actualQty"]})
    sheet["status"] = "posted"
    sheet["checks"] = checks
    return {"ok": True, "checks": checks}


def lot_state(med):
    lots = []
    if med.get("lots"):
        for lot in med["lots"]:
            lots.append({"batch": text(lot.get("batch")).upper(), "expiry": lot.get("expiry") or "", "qty": int(lot.get("qty") or 0)})
    elif text(med.get("batch")):
        lots.append({"batch": text(med.get("batch")).upper(), "expiry": med.get("expiry") or "", "qty": int(med.get("stock") or 0)})
    return {"stock": int(med.get("stock") or 0), "lots": lots}


def plan_take(state, qty, batch):
    if state["stock"] < qty:
        return {"ok": False, "message": "Tồn kho không đủ để chuyển."}
    if not state["lots"]:
        state["stock"] -= qty
        return {"ok": True, "portions": [{"batch": text(batch).upper() or "CK", "expiry": "", "qty": qty}]}
    pool = [lot for lot in state["lots"] if lot["qty"] > 0]
    if text(batch):
        key = text(batch).upper()
        pool = [lot for lot in pool if lot["batch"] == key]
        if sum(lot["qty"] for lot in pool) < qty:
            return {"ok": False, "message": "Lô không đủ số lượng."}
    pool = sorted(pool, key=lambda lot: lot["expiry"])
    need = qty
    portions = []
    for lot in pool:
        if need <= 0:
            break
        take = min(lot["qty"], need)
        lot["qty"] -= take
        need -= take
        portions.append({"batch": lot["batch"], "expiry": lot["expiry"], "qty": take})
    if need > 0:
        return {"ok": False, "message": "Không trừ đủ số lượng từ các lô."}
    state["stock"] -= qty
    return {"ok": True, "portions": portions}


def apply_take(med, portions):
    med.setdefault("lots", [])
    qty = sum(portion["qty"] for portion in portions)
    if int(med.get("stock") or 0) < qty:
        return False
    if not med["lots"] and text(med.get("batch")):
        med["lots"].append({"batch": text(med.get("batch")).upper(), "expiry": med.get("expiry") or "", "qty": int(med.get("stock") or 0)})
    if not med["lots"]:
        med["stock"] = int(med["stock"]) - qty
        return True
    for portion in portions:
        found = None
        for lot in med["lots"]:
            if text(lot.get("batch")).upper() == portion["batch"] and (lot.get("expiry") or "") == (portion["expiry"] or ""):
                found = lot
                break
        if not found or int(found.get("qty") or 0) < portion["qty"]:
            return False
        found["qty"] = int(found["qty"]) - portion["qty"]
    med["lots"] = [lot for lot in med["lots"] if int(lot.get("qty") or 0) > 0]
    med["stock"] = int(med["stock"]) - qty
    sync_primary(med)
    return True


def apply_give(med, portions):
    med.setdefault("lots", [])
    for portion in portions:
        found = None
        for lot in med["lots"]:
            if text(lot.get("batch")).upper() == portion["batch"]:
                found = lot
        if found and found.get("expiry") and portion.get("expiry") and found["expiry"] != portion["expiry"]:
            return False
        if found:
            found["qty"] = int(found.get("qty") or 0) + portion["qty"]
            if not found.get("expiry"):
                found["expiry"] = portion.get("expiry") or ""
        else:
            med["lots"].append({"batch": portion["batch"], "expiry": portion.get("expiry") or "", "qty": portion["qty"]})
        med["stock"] = int(med.get("stock") or 0) + portion["qty"]
    sync_primary(med)
    return True


def find_dest(medicines, source, branch_id):
    for med in medicines:
        if med.get("branchId") == branch_id and text(med.get("name")).lower() == text(source.get("name")).lower() and text(med.get("strength")).lower() == text(source.get("strength")).lower():
            return med
    return None


def next_code(medicines):
    maximum = 0
    for med in medicines:
        match = re.fullmatch(r"T(\d+)", text(med.get("code")).upper())
        if match:
            maximum = max(maximum, int(match.group(1)))
    return "T" + str(maximum + 1).zfill(4)


def confirm_transfer(db, transfer):
    if transfer.get("fromBranchId") and transfer.get("fromBranchId") == transfer.get("toBranchId"):
        return {"ok": False, "message": "Chi nhánh gửi và chi nhánh nhận phải khác nhau."}
    if transfer.get("status") != "draft":
        return {"ok": False, "message": "Chỉ xác nhận phiếu đang nháp."}
    source = find_by_id(db["medicines"], transfer["lines"][0]["medicineId"])
    qty = int(transfer["lines"][0]["qty"])
    batch = transfer["lines"][0].get("batch") or ""
    state = lot_state(source)
    taken = plan_take(state, qty, batch)
    if not taken["ok"]:
        return taken
    if not apply_take(source, taken["portions"]):
        return {"ok": False, "message": "Không trừ được tồn nơi gửi."}
    dest = find_dest(db["medicines"], source, transfer["toBranchId"])
    created = False
    if not dest:
        dest = {
            "id": "m-new",
            "name": source["name"],
            "code": next_code(db["medicines"]),
            "strength": source.get("strength") or "",
            "branchId": transfer["toBranchId"],
            "stock": 0,
            "lots": [],
            "batch": "",
            "expiry": "",
        }
        db["medicines"].append(dest)
        created = True
    if not apply_give(dest, taken["portions"]):
        return {"ok": False, "message": "Không cộng được tồn nơi nhận."}
    transfer["status"] = "confirmed"
    return {"ok": True, "created": created, "source": source, "dest": dest, "portions": taken["portions"]}


def sample():
    return {
        "settings": {"stockAlert": True, "expiryAlert": True, "expiryWarnDays": 30},
        "branches": [
            {"id": "b1", "name": "Quận 1", "status": "open"},
            {"id": "b2", "name": "Quận 3", "status": "open"},
            {"id": "b3", "name": "Đóng cửa", "status": "closed"},
        ],
        "medicines": [
            {"id": "m1", "name": "Paracetamol", "code": "T0001", "sku": "T0001", "categoryId": "c1", "branchId": "b1", "strength": "500mg", "stock": 10, "minStock": 4, "batch": "L1", "expiry": "2026-10-20", "lots": [{"batch": "L1", "expiry": "2026-10-20", "qty": 4}, {"batch": "L2", "expiry": "2027-01-01", "qty": 6}]},
            {"id": "m2", "name": "Vitamin C", "code": "T0002", "sku": "T0002", "categoryId": "c2", "branchId": "b1", "strength": "1000mg", "stock": 2, "minStock": 5, "batch": "V1", "expiry": "2026-12-01", "lots": [{"batch": "V1", "expiry": "2026-12-01", "qty": 2}]},
            {"id": "m3", "name": "Amoxicillin", "code": "T0003", "sku": "T0003", "categoryId": "c1", "branchId": "b2", "strength": "250mg", "stock": 3, "minStock": 3, "batch": "A1", "expiry": "2020-01-01", "lots": [{"batch": "A1", "expiry": "2020-01-01", "qty": 3}]},
        ],
        "stocktakes": [],
        "transfers": [],
        "notifications": [],
    }


def expect(condition, label, detail=None):
    if condition:
        return 0
    print("Lỗi:", label, "" if detail is None else detail)
    return 1


def main():
    failed = 0
    db = sample()
    today = "2026-10-11"
    by_code = query_stock(db["medicines"], {"q": "T0002"})
    failed += expect(len(by_code) == 1 and by_code[0]["id"] == "m2", "Tìm tồn theo mã", by_code)
    by_name = query_stock(db["medicines"], {"q": "para"})
    failed += expect(len(by_name) == 1 and by_name[0]["name"] == "Paracetamol", "Tìm tồn theo tên", by_name)
    missed = query_stock(db["medicines"], {"q": "hoạt chất ẩn"})
    failed += expect(missed == [], "Không tìm theo hoạt chất", missed)
    branch = query_stock(db["medicines"], {"branchId": "b2"})
    failed += expect(len(branch) == 1 and branch[0]["id"] == "m3", "Lọc tồn theo chi nhánh", branch)
    category = query_stock(db["medicines"], {"categoryId": "c1"})
    failed += expect(sorted(row["id"] for row in category) == ["m1", "m3"], "Lọc tồn theo danh mục", category)
    failed += expect(query_stock(db["medicines"], {})[0]["stock"] == 3, "Danh sách có số lượng tồn", query_stock(db["medicines"], {})[0]["stock"])
    lots = list_lots(db["medicines"], {"q": "Paracetamol"})
    failed += expect(len(lots) == 2 and lots[0]["qty"] == 4 and lots[1]["qty"] == 6, "Danh sách lô và số lượng", lots)
    board = expiry_board(db["medicines"], {"today": today, "settings": db["settings"]})
    failed += expect([item["expiry"] for item in board] == ["2020-01-01", "2026-10-20", "2026-12-01", "2027-01-01"], "Sắp hạn dùng tăng dần", board)
    near = [item for item in board if item["near"]]
    failed += expect(len(near) == 2 and near[0]["expiry"] == "2020-01-01", "Lô gần hoặc đã hết hạn trong 30 ngày", near)

    alerts = collect(db["medicines"], {"today": today, "settings": db["settings"]})
    codes = sorted(row["code"] + ":" + row["name"] for row in alerts)
    failed += expect(codes == ["expired:Amoxicillin", "low:Amoxicillin", "soon:Paracetamol", "under:Vitamin C"], "Phân loại cảnh báo", codes)
    inbox_db = sample()
    opened = open_alerts(inbox_db["medicines"], {"today": today, "settings": inbox_db["settings"], "db": inbox_db})
    unread = [row for row in opened if not row["read"]]
    failed += expect(len(opened) == 4 and len(unread) == 4, "Cảnh báo mới đều chưa đọc", len(unread))
    target = next(row for row in opened if row["name"] == "Vitamin C")
    blocked_delete = dismiss_alert(inbox_db, target["id"])
    failed += expect(not blocked_delete["ok"], "Chưa đọc thì không xóa", blocked_delete)
    marked = mark_alert_read(inbox_db, target["id"])
    failed += expect(marked["ok"] and not marked["already"], "Đọc cảnh báo", marked)
    after_read = open_alerts(inbox_db["medicines"], {"today": today, "settings": inbox_db["settings"], "db": inbox_db})
    failed += expect(sum(1 for row in after_read if not row["read"]) == 3, "Số chưa đọc giảm sau khi bấm", after_read)
    removed = dismiss_alert(inbox_db, target["id"])
    failed += expect(removed["ok"], "Xóa sau khi đọc", removed)
    left = open_alerts(inbox_db["medicines"], {"today": today, "settings": inbox_db["settings"], "db": inbox_db})
    failed += expect(len(left) == 3 and all(row["id"] != target["id"] for row in left), "Đã xóa khỏi danh sách", left)
    bad_days = set_warn_days(db["settings"], "0")
    failed += expect(not bad_days["ok"], "Chặn mốc cảnh báo bằng 0", bad_days)
    ok_days = set_warn_days(db["settings"], "5")
    failed += expect(ok_days["ok"] and db["settings"]["expiryWarnDays"] == 5, "Lưu mốc 5 ngày", ok_days)
    short_window = collect(db["medicines"], {"today": today, "settings": db["settings"]})
    failed += expect(not any(row["code"] == "soon" and row["name"] == "Paracetamol" for row in short_window), "Paracetamol ra khỏi mốc 5 ngày", short_window)
    db["settings"]["expiryWarnDays"] = 30

    empty = create_stocktake({"branches": db["branches"], "medicines": [], "stocktakes": []}, "b1")
    failed += expect(not empty["ok"] and "chưa có thuốc" in empty["message"], "Không lập phiếu khi chưa có thuốc", empty)
    closed = create_stocktake(sample(), "b3")
    failed += expect(not closed["ok"] and "ngừng" in closed["message"], "Không kiểm kê chi nhánh đóng", closed)
    created = create_stocktake(db, "b1")
    failed += expect(created["ok"] and created["sheet"]["code"] == "KK20261011-001" and len(created["sheet"]["lines"]) == 2, "Lưu phiếu kiểm kê", created["sheet"]["code"])
    sheet = created["sheet"]
    missing = save_counts(sheet, {"m1": "8"})
    failed += expect(not missing["ok"] and "mọi thuốc" in missing["message"], "Bắt nhập đủ số lượng thực tế", missing)
    counted = save_counts(sheet, {"m1": "8", "m2": "2"})
    failed += expect(counted["ok"] and sheet["lines"][0]["variance"] == -2 and sheet["lines"][1]["variance"] == 0, "Tính chênh lệch", sheet["lines"])
    no_reason = record_minute(sheet, "Lệch khi đếm kệ", {})
    failed += expect(not no_reason["ok"] and "nguyên nhân" in no_reason["message"], "Bắt nguyên nhân khi lệch", no_reason)
    early = {"ok": False}
    draft_only = create_stocktake(sample(), "b1")["sheet"]
    early = record_minute(draft_only, "chưa đếm xong", {})
    failed += expect(not early["ok"] and "thực tế" in early["message"], "Chưa ghi biên bản khi còn nháp", early)
    minuted = record_minute(sheet, "Lệch khi đếm kệ A", {"m1": "loss"})
    failed += expect(minuted["ok"] and sheet["status"] == "minuted", "Lưu biên bản kiểm kê", sheet["status"])
    blocked = post_stocktake(db, "missing")
    failed += expect(not blocked["ok"], "Không chốt phiếu không tồn tại", blocked)
    posted = post_stocktake(db, sheet["id"])
    failed += expect(posted["ok"] and find_by_id(db["medicines"], "m1")["stock"] == 8, "Cập nhật tồn sau kiểm kê", find_by_id(db["medicines"], "m1")["stock"])
    failed += expect(sum_lots(find_by_id(db["medicines"], "m1")) == 8 and all(row["ok"] for row in posted["checks"]), "Đối chiếu lô sau cập nhật", find_by_id(db["medicines"], "m1")["lots"])
    again = post_stocktake(db, sheet["id"])
    failed += expect(not again["ok"] and "đã cập nhật" in again["message"], "Không chốt phiếu lần hai", again)

    move_db = sample()
    short = confirm_transfer(move_db, {"status": "draft", "toBranchId": "b2", "lines": [{"medicineId": "m1", "qty": 50, "batch": ""}]})
    failed += expect(not short["ok"] and "không đủ" in short["message"] and move_db["medicines"][0]["stock"] == 10, "Chặn chuyển vượt tồn", short)
    same = confirm_transfer(sample(), {"status": "draft", "fromBranchId": "b1", "toBranchId": "b1", "lines": [{"medicineId": "m1", "qty": 1, "batch": ""}]})
    failed += expect(not same["ok"] and "khác nhau" in same["message"], "Chặn chuyển cùng chi nhánh", same)
    moved = confirm_transfer(move_db, {"status": "draft", "toBranchId": "b2", "lines": [{"medicineId": "m1", "qty": 5, "batch": ""}]})
    failed += expect(moved["ok"] and moved["source"]["stock"] == 5 and moved["created"] and moved["dest"]["stock"] == 5, "Trừ nơi gửi và tạo thuốc nơi nhận", (moved["source"]["stock"], moved["dest"]["code"], moved["dest"]["stock"]))
    failed += expect(moved["source"]["lots"][0]["batch"] == "L2" and sum_lots(moved["dest"]) == 5, "Trừ lô hạn gần và cộng lô nơi nhận", moved["dest"]["lots"])
    second = confirm_transfer(move_db, {"status": "draft", "toBranchId": "b2", "lines": [{"medicineId": "m1", "qty": 1, "batch": "L2"}]})
    failed += expect(second["ok"] and not second["created"] and second["dest"]["stock"] == 6 and second["source"]["stock"] == 4, "Cộng vào thuốc đã có ở chi nhánh nhận", second["dest"]["stock"])
    repeat = confirm_transfer(move_db, {"status": "confirmed", "toBranchId": "b2", "lines": [{"medicineId": "m1", "qty": 1, "batch": ""}]})
    failed += expect(not repeat["ok"] and "nháp" in repeat["message"], "Không xác nhận phiếu đã chuyển", repeat)

    if failed:
        print("Có", failed, "lỗi")
        return 1
    print("Đạt toàn bộ kiểm tra tồn kho và cảnh báo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
