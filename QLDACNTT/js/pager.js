/* Phân trang danh sách (task 152, 162). */
(function (root) {
  function clamp(list, page, pageSize) {
    var size = pageSize > 0 ? pageSize : 6;
    var rows = list || [];
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / size));
    var current = Math.min(Math.max(1, Number(page) || 1), pages);
    var start = (current - 1) * size;
    return {
      rows: rows.slice(start, start + size),
      total: total,
      page: current,
      pages: pages,
      pageSize: size,
    };
  }

  root.PharmaPager = { clamp: clamp };
})(typeof window !== "undefined" ? window : globalThis);
