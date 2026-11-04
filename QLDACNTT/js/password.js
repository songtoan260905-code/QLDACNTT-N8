/* Quy tắc và băm mật khẩu (task 149). Mật khẩu không lưu dạng đọc được. */
(function (root) {
  function utf8(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return binary;
  }

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256(text) {
    const ascii = utf8(text);
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    let padded = ascii + "\x80";
    while ((padded.length % 64) - 56) padded += "\x00";
    for (let i = 0; i < padded.length; i++) {
      words[i >> 2] |= padded.charCodeAt(i) << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];
        const temp1 = (hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ (~e & hash[6]))
          + k[i]
          + (w[i] = i < 16
            ? w[i]
            : (w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0)) | 0;
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash.unshift((temp1 + temp2) | 0);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    let result = "";
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  function salt() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function same(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function isHashed(value) {
    return /^h1\.[0-9a-f]{16}\.[0-9a-f]{64}$/.test(String(value || ""));
  }

  function hash(plain) {
    const piece = salt();
    return `h1.${piece}.${sha256(piece + ":" + String(plain))}`;
  }

  function verify(plain, stored) {
    const value = String(stored || "");
    if (!isHashed(value)) return value !== "" && value === String(plain);
    const parts = value.split(".");
    return same(sha256(parts[1] + ":" + String(plain)), parts[2]);
  }

  function check(plain) {
    const value = String(plain || "");
    if (value.length < 8) return { ok: false, message: "Mật khẩu cần ít nhất 8 ký tự." };
    if (/\s/.test(value)) return { ok: false, message: "Mật khẩu không được chứa khoảng trắng." };
    if (!/[A-Za-zÀ-ỹ]/.test(value) || !/[0-9]/.test(value)) {
      return { ok: false, message: "Mật khẩu cần có cả chữ và số." };
    }
    return { ok: true, message: "" };
  }

  root.PharmaPassword = { hash, verify, check, isHashed, sha256 };
})(typeof window !== "undefined" ? window : globalThis);
