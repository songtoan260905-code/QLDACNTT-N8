/* Phiên đăng nhập: tạo, ghi nhớ, hết hạn, xóa (task 124, 147). */
(function (root) {
  const SHORT_MS = 8 * 60 * 60 * 1000;
  const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;

  function token() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function create(userId, remember, now) {
    const at = now || Date.now();
    const keep = !!remember;
    return {
      userId,
      token: token(),
      issuedAt: at,
      expiresAt: at + (keep ? REMEMBER_MS : SHORT_MS),
      remember: keep,
    };
  }

  function normalize(raw, now) {
    if (!raw) return null;
    if (typeof raw === "string") {
      const at = now || Date.now();
      return { userId: raw, token: "legacy", issuedAt: at, expiresAt: at + REMEMBER_MS, remember: true };
    }
    if (!raw.userId || !raw.expiresAt) return null;
    return raw;
  }

  function status(raw, now) {
    const at = now || Date.now();
    const session = normalize(raw, at);
    if (!session) return { ok: false, reason: "missing", session: null };
    if (at > session.expiresAt) return { ok: false, reason: "expired", session };
    return { ok: true, reason: "valid", session };
  }

  root.PharmaSession = { create, normalize, status, SHORT_MS, REMEMBER_MS };
})(typeof window !== "undefined" ? window : globalThis);
