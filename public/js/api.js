// ============================================================
// api.js — サーバー API との通信ヘルパー
// ============================================================

window.PayPalAPI = {
  /**
   * 注文を作成して orderId を返す
   * SDK の createOrder オプションから呼び出す
   */
  async createOrder() {
    const cfg = window.APP_CONFIG;
    const res = await fetch("/paypal-api/checkout/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: cfg.ORDER_AMOUNT,
        currency: cfg.ORDER_CURRENCY,
        items: [cfg.ORDER_ITEM],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "注文作成に失敗しました");
    // v6 SDK は { orderId: "..." } 形式を期待する
    return { orderId: data.id };
  },

  /**
   * 注文をキャプチャして決済を完了する
   */
  async captureOrder(orderId) {
    const res = await fetch(`/paypal-api/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "キャプチャに失敗しました");
    return data;
  },

  /**
   * ブラウザセーフなクライアントトークンを取得（Fastlane / カード保管用）
   */
  async getClientToken() {
    const res = await fetch("/paypal-api/auth/browser-safe-client-token");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "クライアントトークン取得失敗");
    return data.accessToken;
  },
};
