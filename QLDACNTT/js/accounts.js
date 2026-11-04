/* Đăng ký, đăng nhập, khóa, mật khẩu và hồ sơ (task 121–130). */
(function (root) {
  function emailOf(value) {
    return String(value || "").trim().toLowerCase();
  }

  function findByEmail(users, email) {
    const key = emailOf(email);
    return (users || []).find((user) => emailOf(user.email) === key) || null;
  }

  function upgradePasswords(db) {
    let changed = false;
    (db.users || []).forEach((user) => {
      if (user.password && !root.PharmaPassword.isHashed(user.password)) {
        user.password = root.PharmaPassword.hash(user.password);
        changed = true;
      }
    });
    return changed;
  }

  function validateRegister(users, branches, data) {
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const phone = String(data.phone || "").trim();
    const branchId = String(data.branchId || "");
    const role = data.role === "cashier" ? "cashier" : "pharmacist";
    if (name.length < 2) return { ok: false, message: "Họ tên cần ít nhất 2 ký tự." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Email chưa đúng định dạng." };
    if (!phone) return { ok: false, message: "Cần số điện thoại." };
    if (!(branches || []).some((branch) => branch.id === branchId)) return { ok: false, message: "Chi nhánh không hợp lệ." };
    if (findByEmail(users, email)) return { ok: false, message: "Email này đã được dùng." };
    const policy = root.PharmaPassword.check(data.password);
    if (!policy.ok) return { ok: false, message: policy.message };
    return {
      ok: true,
      user: {
        id: "u" + Date.now(),
        name,
        email,
        phone,
        password: root.PharmaPassword.hash(data.password),
        role,
        branchId,
        title: role === "cashier" ? "Thu ngân" : "Dược sĩ",
        status: "active",
      },
    };
  }

  function authenticate(users, email, password) {
    const user = findByEmail(users, email);
    if (!user) return { ok: false, code: "unknown", message: "Không tìm thấy tài khoản này." };
    if (!root.PharmaPassword.verify(password, user.password)) {
      return { ok: false, code: "bad_password", message: "Mật khẩu chưa đúng." };
    }
    if (user.status !== "active") {
      return { ok: false, code: "locked", message: "Tài khoản đang bị khóa. Liên hệ quản trị." };
    }
    return { ok: true, code: "ok", message: "Đăng nhập thành công.", user };
  }

  function setLock(user, locked) {
    if (!user) return { ok: false, message: "Không tìm thấy tài khoản." };
    user.status = locked ? "inactive" : "active";
    return { ok: true, message: locked ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.", status: user.status };
  }

  function changePassword(user, oldPlain, nextPlain) {
    if (!user) return { ok: false, message: "Chưa đăng nhập." };
    if (!root.PharmaPassword.verify(oldPlain, user.password)) {
      return { ok: false, message: "Mật khẩu hiện tại chưa đúng." };
    }
    const policy = root.PharmaPassword.check(nextPlain);
    if (!policy.ok) return { ok: false, message: policy.message };
    if (root.PharmaPassword.verify(nextPlain, user.password)) {
      return { ok: false, message: "Mật khẩu mới phải khác mật khẩu hiện tại." };
    }
    user.password = root.PharmaPassword.hash(nextPlain);
    return { ok: true, message: "Đã đổi mật khẩu." };
  }

  function resetPassword(users, email, nextPlain) {
    const user = findByEmail(users, email);
    if (!user) return { ok: false, message: "Không tìm thấy email trong hệ thống." };
    if (user.status !== "active") return { ok: false, message: "Tài khoản đang bị khóa. Liên hệ quản trị." };
    const policy = root.PharmaPassword.check(nextPlain);
    if (!policy.ok) return { ok: false, message: policy.message };
    user.password = root.PharmaPassword.hash(nextPlain);
    return { ok: true, message: "Đã đặt lại mật khẩu.", user };
  }

  function updateProfile(users, user, data) {
    if (!user) return { ok: false, message: "Chưa đăng nhập." };
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const phone = String(data.phone || "").trim();
    const title = String(data.title || "").trim();
    if (name.length < 2) return { ok: false, message: "Họ tên cần ít nhất 2 ký tự." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Email chưa đúng định dạng." };
    if (findByEmail(users, email) && emailOf(findByEmail(users, email).email) === emailOf(email) && findByEmail(users, email).id !== user.id) {
      return { ok: false, message: "Email đã được dùng." };
    }
    user.name = name;
    user.email = email;
    user.phone = phone;
    if (title) user.title = title;
    return { ok: true, message: "Đã lưu thông tin cá nhân." };
  }

  function applyPassword(plain) {
    const policy = root.PharmaPassword.check(plain);
    if (!policy.ok) return policy;
    return { ok: true, password: root.PharmaPassword.hash(plain), message: "" };
  }

  root.PharmaAccounts = {
    findByEmail,
    upgradePasswords,
    validateRegister,
    authenticate,
    setLock,
    changePassword,
    resetPassword,
    updateProfile,
    applyPassword,
  };
})(typeof window !== "undefined" ? window : globalThis);
