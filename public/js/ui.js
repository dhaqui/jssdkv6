// ============================================================
// ui.js — UI ヘルパー（ローディング・トースト・バッジ）
// ============================================================

window.UI = {
  // ---------- ローディングオーバーレイ ----------
  showLoading(msg = "読み込み中…") {
    const el = document.getElementById("loading-overlay");
    if (el) { el.querySelector("p").textContent = msg; el.style.display = "flex"; }
  },
  hideLoading() {
    const el = document.getElementById("loading-overlay");
    if (el) el.style.display = "none";
  },

  // ---------- 処理中オーバーレイ ----------
  showProcessing(msg = "決済を処理しています…") {
    const el = document.getElementById("processing-overlay");
    const msgEl = document.getElementById("processing-msg");
    if (msgEl) msgEl.textContent = msg;
    if (el) el.removeAttribute("hidden");
  },
  hideProcessing() {
    const el = document.getElementById("processing-overlay");
    if (el) el.setAttribute("hidden", "");
  },

  // ---------- トースト通知 ----------
  toast(msg, type = "error", duration = 5000) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast-${type}`;
    el.removeAttribute("hidden");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.setAttribute("hidden", ""), duration);
  },

  // ---------- SDK ステータスバッジ ----------
  setStatus(key, status) {
    const el = document.getElementById(`status-${key}`);
    if (!el) return;
    const map = {
      ok:       { text: "✓ 利用可",   cls: "badge-ok" },
      ng:       { text: "✗ 非対応",   cls: "badge-ng" },
      loading:  { text: "…",          cls: "badge-loading" },
      pending:  { text: "—",          cls: "badge-pending" },
    };
    const s = map[status] || map.pending;
    el.textContent = s.text;
    el.className = `badge ${s.cls}`;
  },

  // ---------- 成功ページへリダイレクト ----------
  redirectSuccess(data) {
    const params = new URLSearchParams({
      orderId:    data.orderId    || "",
      captureId:  data.captureId  || "",
      amount:     data.amount?.value || APP_CONFIG.ORDER_AMOUNT,
      currency:   data.amount?.currency_code || APP_CONFIG.ORDER_CURRENCY,
      payerName:  data.payerName  || "",
      payerEmail: data.payerEmail || "",
    });
    window.location.href = `/success.html?${params}`;
  },
};
