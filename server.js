// ============================================================
// PayPal JS SDK v6 デモサーバー
// Node.js 18+ / Express — fetch API をネイティブで使用
// ============================================================

require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 本番 / サンドボックス の切り替え
const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// ミドルウェア
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------------------------------------------
// 内部ヘルパー：PayPal アクセストークン取得
// -------------------------------------------------------
async function getAccessToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal 認証失敗: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// -------------------------------------------------------
// GET /paypal-api/auth/browser-safe-client-token
// ACDC・Fastlane 共用のクライアントトークンを返す
//
// 【取得方法】
//  1. まず /v1/identity/generate-token（標準。ACDC/card-fields に対応）を試みる
//  2. 失敗した場合は response_type=client_token（Fastlane 向け）にフォールバック
// -------------------------------------------------------
app.get("/paypal-api/auth/browser-safe-client-token", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    // ── 方法1: /v1/identity/generate-token（ACDC・一般用途）──
    const tokenRes = await fetch(`${PAYPAL_API_BASE}/v1/identity/generate-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept-Language": "en_US",
      },
    });

    if (tokenRes.ok) {
      const data = await tokenRes.json();
      return res.json({ accessToken: data.client_token, expiresIn: data.expires_in });
    }

    // ── 方法2: response_type=client_token（Fastlane 向けフォールバック）──
    console.warn("generate-token 失敗、Fastlane 方式にフォールバック");
    const credentials = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      response_type: "client_token",
    });
    const domain = process.env.APP_DOMAIN || req.hostname;
    body.append("domains[]", domain);

    const fallbackRes = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!fallbackRes.ok) {
      const err = await fallbackRes.text();
      throw new Error(`クライアントトークン取得失敗: ${fallbackRes.status} ${err}`);
    }

    const fallbackData = await fallbackRes.json();
    res.json({ accessToken: fallbackData.access_token, expiresIn: fallbackData.expires_in });

  } catch (err) {
    console.error("クライアントトークン取得エラー:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// POST /paypal-api/checkout/orders/create
// 注文を作成して order ID を返す
// Body: { amount, currency, items[] }
// -------------------------------------------------------
app.post("/paypal-api/checkout/orders/create", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const {
      amount = "25.00",
      currency = "USD",
      items = [
        {
          name: "PayPal SDK v6 デモ商品",
          quantity: "1",
          unit_amount: { currency_code: "USD", value: "25.00" },
          category: "PHYSICAL_GOODS",
        },
      ],
    } = req.body;

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `order-${Date.now()}`,
          description: "PayPal JS SDK v6 デモ注文",
          amount: {
            currency_code: currency,
            value: amount,
            breakdown: {
              item_total: { currency_code: currency, value: amount },
            },
          },
          items,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            user_action: "PAY_NOW",
            return_url: `${req.protocol}://${req.get("host")}/success.html`,
            cancel_url: `${req.protocol}://${req.get("host")}/`,
          },
        },
      },
    };

    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `create-${Date.now()}-${Math.random()}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      console.error("注文作成失敗:", order);
      return res.status(orderRes.status).json({ error: order });
    }

    res.json({ id: order.id, status: order.status });
  } catch (err) {
    console.error("注文作成エラー:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// POST /paypal-api/checkout/orders/:orderId/capture
// 承認済み注文をキャプチャ（売上確定）
// -------------------------------------------------------
app.post(
  "/paypal-api/checkout/orders/:orderId/capture",
  async (req, res) => {
    try {
      const accessToken = await getAccessToken();
      const { orderId } = req.params;

      const captureRes = await fetch(
        `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `capture-${Date.now()}-${Math.random()}`,
            Prefer: "return=representation",
          },
        }
      );

      const captureData = await captureRes.json();

      if (!captureRes.ok) {
        console.error("キャプチャ失敗:", captureData);
        return res.status(captureRes.status).json({ error: captureData });
      }

      const capture =
        captureData.purchase_units?.[0]?.payments?.captures?.[0];

      res.json({
        success: captureData.status === "COMPLETED",
        orderId: captureData.id,
        status: captureData.status,
        captureId: capture?.id,
        amount: capture?.amount,
        payerEmail: captureData.payer?.email_address,
        payerName: `${captureData.payer?.name?.given_name ?? ""} ${captureData.payer?.name?.surname ?? ""}`.trim(),
      });
    } catch (err) {
      console.error("キャプチャエラー:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// -------------------------------------------------------
// GET /paypal-api/health  — ヘルスチェック
// -------------------------------------------------------
app.get("/paypal-api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.PAYPAL_ENV || "sandbox",
    api: PAYPAL_API_BASE,
  });
});

// -------------------------------------------------------
// SPA fallback（404 時は index.html を返す）
// -------------------------------------------------------
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -------------------------------------------------------
// 起動
// -------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n🚀 サーバー起動: http://localhost:${PORT}`);
  console.log(`🌍 PayPal 環境: ${process.env.PAYPAL_ENV || "sandbox"}`);
  console.log(`🔗 API Base: ${PAYPAL_API_BASE}\n`);
});
