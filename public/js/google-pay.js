// ============================================================
// google-pay.js — Google Pay 統合
// Google Pay API JS ライブラリと PayPal SDK v6 の googlepay-payments を組み合わせる
// ============================================================

/**
 * Google Pay ボタンを初期化・レンダリングする
 * @param {object} sdkInstance - window.paypal.createInstance() の戻り値
 * @param {object} paymentMethods - findEligibleMethods() の戻り値
 */
window.initGooglePay = async function (sdkInstance, paymentMethods) {
  const wrapper = document.getElementById("google-pay-wrapper");
  const container = document.getElementById("google-pay-button");

  // 適格性チェック
  if (!paymentMethods.isEligible("googlepay")) {
    UI.setStatus("gpay", "ng");
    checkWalletVisibility();
    return;
  }

  // Google Pay JS ライブラリが読み込まれているか確認
  if (typeof google === "undefined" || !google.payments?.api) {
    // Google Pay ライブラリを動的に読み込む
    try {
      await loadGooglePayScript();
    } catch (err) {
      UI.setStatus("gpay", "ng");
      console.warn("Google Pay スクリプト読み込み失敗:", err);
      checkWalletVisibility();
      return;
    }
  }

  try {
    // PayPal の Google Pay インスタンスを作成
    const googlePay = sdkInstance.createGooglePay({
      onApprove: async (data) => {
        try {
          UI.showProcessing("Google Pay 決済を確定しています…");
          const result = await PayPalAPI.captureOrder(data.orderId);
          UI.hideProcessing();
          if (result.success) UI.redirectSuccess(result);
          else throw new Error("決済の確定に失敗しました");
        } catch (err) {
          UI.hideProcessing();
          UI.toast(`エラー: ${err.message}`);
        }
      },
      onError: (err) => {
        UI.toast(`Google Pay エラー: ${err.message}`);
        console.error("Google Pay エラー:", err);
      },
      onCancel: () => {
        UI.toast("Google Pay がキャンセルされました。", "info");
      },
    });

    // Google Pay クライアントを初期化（TEST 環境）
    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: "TEST", // 本番時は "PRODUCTION" に変更
    });

    // PayPal が提供する Google Pay 設定をベースに支払いリクエストを作成
    const paymentDataRequest = await googlePay.createPaymentDataRequest({
      transactionInfo: {
        currencyCode: APP_CONFIG.ORDER_CURRENCY,
        totalPriceStatus: "FINAL",
        totalPrice: APP_CONFIG.ORDER_AMOUNT,
      },
    });

    // isReadyToPay で Google Pay が利用可能か確認
    const isReady = await paymentsClient.isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: paymentDataRequest.allowedPaymentMethods,
    });

    if (!isReady.result) {
      UI.setStatus("gpay", "ng");
      checkWalletVisibility();
      return;
    }

    UI.setStatus("gpay", "ok");

    // Google Pay ボタンを作成
    const gpayButton = paymentsClient.createButton({
      buttonType: "buy",
      buttonColor: "default",
      buttonSizeMode: "fill",
      onClick: async () => {
        try {
          const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
          // PayPal SDK に Google Pay のトークンを渡して処理
          await googlePay.processPayment({
            paymentData,
            createOrder: () => PayPalAPI.createOrder(),
          });
        } catch (err) {
          if (err.statusCode !== "CANCELED") {
            UI.toast(`Google Pay 処理エラー: ${err.message || err.statusMessage}`);
            console.error("Google Pay 処理エラー:", err);
          }
        }
      },
    });

    container.appendChild(gpayButton);
    wrapper.removeAttribute("hidden");

  } catch (err) {
    UI.setStatus("gpay", "ng");
    console.error("Google Pay 初期化エラー:", err);
  }

  checkWalletVisibility();
};

// Google Pay ライブラリを動的に読み込む
function loadGooglePayScript() {
  return new Promise((resolve, reject) => {
    if (document.getElementById("google-pay-script")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-pay-script";
    script.src = "https://pay.google.com/gp/p/js/pay.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Pay スクリプトの読み込みに失敗しました"));
    document.head.appendChild(script);
  });
}

// Google Pay も Apple Pay も非対応の場合、ウォレットセクション全体を隠す
function checkWalletVisibility() {
  const gpayOk  = document.getElementById("google-pay-wrapper")?.style.display !== "none"
                  && !document.getElementById("google-pay-wrapper")?.hasAttribute("hidden");
  const appleOk = document.getElementById("apple-pay-wrapper")?.style.display !== "none"
                  && !document.getElementById("apple-pay-wrapper")?.hasAttribute("hidden");

  if (!gpayOk && !appleOk) {
    // 両方非対応なら「利用不可」メッセージを表示
    // apple-pay.js でも同じ関数を呼ぶためタイミングを遅らせる
    setTimeout(() => {
      const gpayHidden  = document.getElementById("google-pay-wrapper")?.hasAttribute("hidden") ?? true;
      const appleHidden = document.getElementById("apple-pay-wrapper")?.hasAttribute("hidden") ?? true;
      if (gpayHidden && appleHidden) {
        document.getElementById("wallet-not-eligible")?.removeAttribute("hidden");
      }
    }, 500);
  }
}
