// ============================================================
// apple-pay.js — Apple Pay 統合
// 要件: HTTPS 環境 + Apple Pay マーチャント登録 + ドメイン検証
// ============================================================

/**
 * Apple Pay ボタンを初期化・レンダリングする
 * @param {object} sdkInstance - window.paypal.createInstance() の戻り値
 * @param {object} paymentMethods - findEligibleMethods() の戻り値
 */
window.initApplePay = async function (sdkInstance, paymentMethods) {
  const wrapper = document.getElementById("apple-pay-wrapper");

  // Apple Pay は Safari + Apple デバイス + HTTPS が必要
  const applePayAvailable =
    window.ApplePaySession &&
    ApplePaySession.canMakePayments() &&
    paymentMethods.isEligible("applepay");

  if (!applePayAvailable) {
    UI.setStatus("applepay", "ng");
    return;
  }

  try {
    // PayPal の Apple Pay インスタンスを作成
    const applePay = sdkInstance.createApplePay({
      onApprove: async (data) => {
        try {
          UI.showProcessing("Apple Pay 決済を確定しています…");
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
        UI.toast(`Apple Pay エラー: ${err.message}`);
        console.error("Apple Pay エラー:", err);
      },
      onCancel: () => {
        UI.toast("Apple Pay がキャンセルされました。", "info");
      },
    });

    // Apple Pay の設定情報を PayPal から取得
    const applePayConfig = await applePay.config();

    // ApplePaySession で canMakePaymentsWithActiveCard を確認
    const canMake = await ApplePaySession.canMakePaymentsWithActiveCard(
      applePayConfig.merchantIdentifier
    );
    if (!canMake) {
      UI.setStatus("applepay", "ng");
      return;
    }

    UI.setStatus("applepay", "ok");

    // Apple Pay ボタンを CSS で実装（Apple 推奨の方法）
    const applePayBtn = document.createElement("button");
    applePayBtn.className = "apple-pay-button apple-pay-button-buy";
    applePayBtn.setAttribute("aria-label", "Apple Pay で支払う");
    document.getElementById("apple-pay-button").appendChild(applePayBtn);
    wrapper.removeAttribute("hidden");

    applePayBtn.addEventListener("click", async () => {
      // Apple Pay セッションの支払いリクエスト
      const paymentRequest = {
        countryCode: applePayConfig.countryCode || "US",
        currencyCode: APP_CONFIG.ORDER_CURRENCY,
        merchantCapabilities: applePayConfig.merchantCapabilities,
        supportedNetworks: applePayConfig.supportedNetworks,
        total: {
          label: "PayPal SDK v6 デモ",
          type: "final",
          amount: APP_CONFIG.ORDER_AMOUNT,
        },
      };

      const session = new ApplePaySession(3, paymentRequest);

      // マーチャント検証
      session.onvalidatemerchant = async (event) => {
        try {
          const merchantSession = await applePay.validateMerchant({
            validationUrl: event.validationURL,
          });
          session.completeMerchantValidation(merchantSession);
        } catch (err) {
          console.error("マーチャント検証エラー:", err);
          session.abort();
        }
      };

      // 支払い承認
      session.onpaymentauthorized = async (event) => {
        try {
          // Apple Pay のトークンを PayPal に渡して注文を完了する
          await applePay.confirmOrder({
            applePayToken: event.payment.token,
            createOrder: () => PayPalAPI.createOrder(),
          });
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
        } catch (err) {
          console.error("Apple Pay 支払い承認エラー:", err);
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          UI.toast(`Apple Pay 処理エラー: ${err.message}`);
        }
      };

      session.oncancel = () => {
        UI.toast("Apple Pay がキャンセルされました。", "info");
      };

      session.begin();
    });

  } catch (err) {
    UI.setStatus("applepay", "ng");
    console.error("Apple Pay 初期化エラー:", err);
  }
};
