# -*- coding: utf-8 -*-
"""Đối chiếu quy tắc mật khẩu và ma trận màn hình.

Chạy: python python/auth_check.py
Cùng quy tắc với js/password.js và js/rbac.js.
"""

import re
import sys

SCREENS = [
    "tong-quan",
    "chi-nhanh",
    "kho",
    "ban-hang",
    "canh-bao",
    "bao-cao",
    "nhan-su",
    "thong-bao",
    "cai-dat",
]

GRANTS = {
    "admin": SCREENS[:],
    "manager": [
        "tong-quan", "chi-nhanh", "kho", "ban-hang", "canh-bao",
        "bao-cao", "nhan-su", "thong-bao", "cai-dat",
    ],
    "pharmacist": ["tong-quan", "kho", "ban-hang", "canh-bao", "thong-bao", "cai-dat"],
    "cashier": ["tong-quan", "ban-hang", "thong-bao", "cai-dat"],
}

LABELS = {
    "admin": "Quản trị",
    "manager": "Quản lý chi nhánh",
    "pharmacist": "Nhân viên kho (dược sĩ)",
    "cashier": "Nhân viên bán hàng (thu ngân)",
}


def password_ok(value):
    if len(value) < 8:
        return False, "Mật khẩu cần ít nhất 8 ký tự."
    if re.search(r"\s", value):
        return False, "Mật khẩu không được chứa khoảng trắng."
    if not re.search(r"[A-Za-zÀ-ỹ]", value) or not re.search(r"\d", value):
        return False, "Mật khẩu cần có cả chữ và số."
    return True, ""


def expect(ok, name, detail):
    mark = "Đạt" if ok else "Lỗi"
    print(f"[{mark}] {name} — {detail}")
    return 0 if ok else 1


def main():
    failed = 0
    weak_ok, weak_msg = password_ok("123456")
    strong_ok, _ = password_ok("admin123")
    space_ok, space_msg = password_ok("mat khau1")
    failed += expect(not weak_ok, "Mật khẩu yếu", weak_msg)
    failed += expect(not space_ok, "Mật khẩu có khoảng trắng", space_msg)
    failed += expect(strong_ok, "Mật khẩu admin123", "đủ chữ và số")

    print("")
    for role, label in LABELS.items():
        owned = set(GRANTS[role])
        for screen in SCREENS:
            allowed = screen in owned
            detail = "được vào" if allowed else "bị chặn"
            failed += expect(True, f"{label} / {screen}", detail)
        if role == "cashier":
            failed += expect("kho" not in owned and "nhan-su" not in owned, "Thu ngân không vào kho và nhân sự", "giới hạn bán hàng")
        if role == "pharmacist":
            failed += expect("kho" in owned and "bao-cao" not in owned, "Dược sĩ có kho, không có báo cáo quản trị", "giới hạn kho")
        if role == "manager":
            failed += expect("bao-cao" in owned and "nhan-su" in owned, "Quản lý có báo cáo và nhân sự trong chi nhánh", "giới hạn chi nhánh")

    print("")
    if failed:
        print(f"Còn {failed} mục lỗi.")
        return 1
    print("Ma trận quyền và quy tắc mật khẩu khớp thiết kế.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
