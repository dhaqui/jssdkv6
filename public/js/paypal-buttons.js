// ============================================================
// paypal-buttons.js — PayPal / Pay Later / Credit ボタン
// ============================================================

/**
 * PayPal, Pay Later, PayPal Credit の各ボタンを初期化する
 * @param {object} sdkInstance - window.paypal.createInstance() の戻り値
 * @param {object} paymentMethods - findEligibleMethods() の戻り値
 */
window.initPayPalButtons = async function (sdkInstance, paymentMethods) {
  // ---- 共通セッションオプション ----
  const sessionOptions = {
    async onApprove(data) {
      try {
        UI.showProcessing("決済を確定しています…");
        const result = await PayPalAPI.captureOrder(data.orderId);
        UI.hideProcessing();
        if (result.success) {
          UI.redirectSuccess(result);
        } else {
          UI.toast("決済の確定に失敗しました。もう一度お試しください。");
        }
      } catch (err) {
        UI.hideProcessing();
        UI.toast(`エラー: ${err.message}`);
        console.error("キャプチャエラー:", err);
      }
    },
    onCancel(data) {
      UI.toast("決済がキャンセルされました。", "info");
      console.log("キャンセル:", data);
    },
    onError(err) {
      UI.toast(`決済エラーが発生しました: ${err.message}`);
      console.error("セッションエラー:", err);
    },
  };

  let anyVisible = false;

  // ---- ① PayPal ボタン ----
  if (paymentMethods.isEligible("paypal")) {
    UI.setStatus("paypal", "ok");

    const session = sdkInstance.createPayPalOneTimePaymentSession(sessionOptions);
    const paypalButton = document.getElementById("paypal-button");
    const wrapper = document.getElementById("paypal-button-wrapper");

    paypalButton.removeAttribute("hidden");
    wrapper.removeAttribute("hidden");
    anyVisible = true;

    paypalButton.addEventListener("click", async () => {
      try {
        await session.start(
          { presentationMode: "auto" },
          PayPalAPI.createOrder()
        );
      } catch (err) {
        if (err.code !== "WINDOW_CLOSED") {
          UI.toast(`PayPal 起動エラー: ${err.message}`);
        }
      }
    });
  } else {
    UI.setStatus("paypal", "ng");
  }

  // ---- ② Pay Later ボタン ----
  if (paymentMethods.isEligible("paylater")) {
    UI.setStatus("paylater", "ok");

    const details = paymentMethods.getDetails("paylater");
    const session = sdkInstance.createPayLaterOneTimePaymentSession(sessionOptions);

    const payLaterButton = document.getElementById("pay-later-button");
    const wrapper = document.getElementById("paylater-button-wrapper");

    // Pay Later に必要なプロパティを設定
    payLaterButton.productCode = details.productCode;
    payLaterButton.countryCode = details.countryCode;
    payLaterButton.removeAttribute("hidden");
    wrapper.removeAttribute("hidden");
    anyVisible = true;

    payLaterButton.addEventListener("click", async () => {
      try {
        await session.start(
          { presentationMode: "auto" },
          PayPalAPI.createOrder()
        );
      } catch (err) {
        if (err.code !== "WINDOW_CLOSED") {
          UI.toast(`Pay Later 起動エラー: ${err.message}`);
        }
      }
    });
  } else {
    UI.setStatus("paylater", "ng");
  }

  // ---- ③ PayPal Credit ボタン ----
  if (paymentMethods.isEligible("credit")) {
    UI.setStatus("credit", "ok");

    const details = paymentMethods.getDetails("credit");
    const session = sdkInstance.createPayPalCreditOneTimePaymentSession(sessionOptions);

    const creditButton = document.getElementById("credit-button");
    const wrapper = document.getElementById("credit-button-wrapper");

    creditButton.countryCode = details.countryCode;
    creditButton.removeAttribute("hidden");
    wrapper.removeAttribute("hidden");
    anyVisible = true;

    creditButton.addEventListener("click", async () => {
      try {
        await session.start(
          { presentationMode: "auto" },
          PayPalAPI.createOrder()
        );
      } catch (err) {
        if (err.code !== "WINDOW_CLOSED") {
          UI.toast(`PayPal Credit 起動エラー: ${err.message}`);
        }
      }
    });
  } else {
    UI.setStatus("credit", "ng");
  }

  // いずれも非対応の場合
  if (!anyVisible) {
    document.getElementById("paypal-not-eligible").removeAttribute("hidden");
    document.getElementById("section-paypal").classList.add("section-disabled");
  }
};
