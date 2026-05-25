// ============================================================
// card-fields.js — インライン カード入力フィールド（Card Fields）
// ============================================================

/**
 * Card Fields コンポーネントを初期化する
 * インラインの番号・有効期限・CVV・名義人フィールドをレンダリングする
 * @param {object} sdkInstance - window.paypal.createInstance() の戻り値
 * @param {object} paymentMethods - findEligibleMethods() の戻り値
 */
window.initCardFields = async function (sdkInstance, paymentMethods) {
  if (!paymentMethods.isEligible("card")) {
    UI.setStatus("card", "ng");
    document.getElementById("card-not-eligible").removeAttribute("hidden");
    document.getElementById("section-card").classList.add("section-disabled");
    return;
  }

  UI.setStatus("card", "ok");

  const submitBtn = document.getElementById("card-submit-btn");
  const cardForm = document.getElementById("card-form");
  const errorMsg = document.getElementById("card-error-msg");

  // ---- Card Fields セッション作成 ----
  let cardFields;
  try {
    cardFields = sdkInstance.createCardFields({
      // スタイル：Card Fields の各フィールドに適用されるインラインCSS
      style: {
        input: {
          "font-size": "15px",
          "font-family": "Arial, sans-serif",
          color: "#1c1c1e",
          padding: "0 12px",
        },
        ":focus": {
          color: "#003087",
        },
        ".invalid": {
          color: "#c0392b",
        },
      },

      // 入力値が変更されたとき
      onChange(data) {
        // 全フィールドが有効になったときにボタンを有効化
        submitBtn.disabled = !data.isFormValid;
        // エラーメッセージのリセット
        if (data.isFormValid) {
          errorMsg.setAttribute("hidden", "");
        }
      },

      // フォームが有効な状態で submit されたとき（onApprove の前に呼ばれる）
      async onApprove(data) {
        try {
          UI.showProcessing("カード決済を確定しています…");
          const result = await PayPalAPI.captureOrder(data.orderId);
          UI.hideProcessing();
          if (result.success) {
            UI.redirectSuccess(result);
          } else {
            throw new Error("決済の確定に失敗しました");
          }
        } catch (err) {
          UI.hideProcessing();
          showCardError(err.message);
        }
      },

      onError(err) {
        UI.hideProcessing();
        showCardError(err.message);
        console.error("Card Fields エラー:", err);
      },
    });
  } catch (err) {
    UI.setStatus("card", "ng");
    showCardError(`Card Fields の初期化に失敗: ${err.message}`);
    return;
  }

  // ---- 各フィールドをレンダリング ----
  try {
    const numberField = cardFields.NumberField({
      placeholder: "4111 1111 1111 1111",
    });
    await numberField.render("#card-number-field");

    const expiryField = cardFields.ExpiryField({
      placeholder: "MM / YY",
    });
    await expiryField.render("#card-expiry-field");

    const cvvField = cardFields.CVVField({
      placeholder: "CVV",
    });
    await cvvField.render("#card-cvv-field");

    const nameField = cardFields.NameField({
      placeholder: "TARO YAMADA",
    });
    await nameField.render("#card-name-field");
  } catch (err) {
    showCardError(`フィールドのレンダリングに失敗: ${err.message}`);
    console.error("Card Fields レンダリングエラー:", err);
    return;
  }

  // ---- フォーム送信 ----
  cardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "処理中…";
      UI.showProcessing("カード情報を検証しています…");

      // カード情報を送信し、注文IDを渡す
      await cardFields.submit({
        // 3DS（SCA）を有効にする場合
        // contingencies: ["SCA_WHEN_REQUIRED"],
        createOrder: () => PayPalAPI.createOrder(),
      });
    } catch (err) {
      UI.hideProcessing();
      submitBtn.disabled = false;
      submitBtn.textContent = "カードで支払う — $25.00";

      // フィールドレベルのバリデーションエラーは onChange で処理されるため、
      // ここではネットワーク / 3DS エラーのみ表示
      if (err.code !== "CARD_FIELDS_VALIDATION_ERROR") {
        showCardError(err.message || "カード決済に失敗しました");
      }
      console.error("カード送信エラー:", err);
    }
  });

  // ---- ヘルパー ----
  function showCardError(msg) {
    errorMsg.textContent = msg;
    errorMsg.removeAttribute("hidden");
  }
};
