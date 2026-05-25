// ============================================================
// app.js — エントリーポイント
// PayPal SDK 読み込み完了後に呼び出される onPayPalWebSdkLoaded を実装
// ============================================================

/**
 * PayPal SDK v6 のスクリプトが読み込まれると自動的に呼ばれる
 * （script タグの読み込み完了 → window.paypal が利用可能になった状態）
 */
async function onPayPalWebSdkLoaded() {
  UI.showLoading("PayPal SDK を初期化しています…");
  UI.setStatus("init", "loading");

  let sdkInstance;

  try {
    // -------------------------------------------------------
    // SDK インスタンスを作成
    // 全コンポーネントを一括指定（Fastlane は clientToken が必要なため別途初期化）
    // -------------------------------------------------------
    sdkInstance = await window.paypal.createInstance({
      clientId: getClientIdFromMeta(),   // HTML の meta タグ or 環境変数から取得
      components: [
        "paypal-payments",       // PayPal / Pay Later / Credit ボタン
        "card-fields",           // インラインカードフォーム
        "googlepay-payments",    // Google Pay
        "applepay-payments",     // Apple Pay
        "paypal-messages",       // プロモーションメッセージ（オプション）
      ],
      pageType: "checkout",
      locale: "ja-JP",
      clientMetadataId: crypto.randomUUID(),
    });

    UI.setStatus("init", "ok");
    console.log("✅ PayPal SDK 初期化完了");

  } catch (err) {
    UI.setStatus("init", "ng");
    UI.hideLoading();
    UI.toast(`SDK の初期化に失敗しました: ${err.message}`);
    console.error("SDK 初期化エラー:", err);
    return;
  }

  // -------------------------------------------------------
  // 適格性チェック
  // -------------------------------------------------------
  let paymentMethods;
  try {
    paymentMethods = await sdkInstance.findEligibleMethods({
      currencyCode: APP_CONFIG.ORDER_CURRENCY,
    });
    console.log("適格性チェック完了:", paymentMethods);
  } catch (err) {
    UI.toast(`適格性チェックに失敗しました: ${err.message}`);
    console.error("findEligibleMethods エラー:", err);
    UI.hideLoading();
    return;
  }

  UI.hideLoading();

  // -------------------------------------------------------
  // 各決済手段を並列で初期化
  // -------------------------------------------------------
  await Promise.allSettled([
    // ① PayPal / Pay Later / Credit ボタン
    initPayPalButtons(sdkInstance, paymentMethods).catch(
      (err) => console.error("PayPal ボタン初期化エラー:", err)
    ),

    // ② Card Fields（インラインカードフォーム）
    initCardFields(sdkInstance, paymentMethods).catch(
      (err) => console.error("Card Fields 初期化エラー:", err)
    ),

    // ③ Google Pay
    initGooglePay(sdkInstance, paymentMethods).catch(
      (err) => console.error("Google Pay 初期化エラー:", err)
    ),

    // ④ Apple Pay
    initApplePay(sdkInstance, paymentMethods).catch(
      (err) => console.error("Apple Pay 初期化エラー:", err)
    ),
  ]);

  // ⑤ Fastlane（clientToken で別途初期化）
  initFastlane().catch(
    (err) => console.error("Fastlane 初期化エラー:", err)
  );

  console.log("🎉 全決済手段の初期化が完了しました");
}

// -------------------------------------------------------
// クライアントID を取得するヘルパー
// <meta name="paypal-client-id" content="..."> から読み込む
// または VITE_PAYPAL_CLIENT_ID 環境変数（ビルドツール使用時）
// -------------------------------------------------------
function getClientIdFromMeta() {
  // HTML meta タグから取得を試みる
  const meta = document.querySelector('meta[name="paypal-client-id"]');
  if (meta?.content && meta.content !== "YOUR_SANDBOX_CLIENT_ID") {
    return meta.content;
  }

  // 環境変数 (Vite 等のビルドツール使用時)
  if (typeof import_meta_env !== "undefined" && import_meta_env.VITE_PAYPAL_CLIENT_ID) {
    return import_meta_env.VITE_PAYPAL_CLIENT_ID;
  }

  // フォールバック：サーバーサイドレンダリングでスクリプトに埋め込む場合
  if (window.PAYPAL_CLIENT_ID) {
    return window.PAYPAL_CLIENT_ID;
  }

  console.warn(
    "⚠️  PayPal クライアントIDが設定されていません。" +
    "\n    index.html の <meta name='paypal-client-id'> を設定してください。"
  );
  return "";
}
