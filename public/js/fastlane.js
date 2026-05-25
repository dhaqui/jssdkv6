// ============================================================
// fastlane.js — Fastlane ゲスト高速チェックアウト
// クライアントトークン認証が必要（Option B）
// ============================================================

/**
 * Fastlane を初期化する
 * クライアントトークンで SDK を再初期化した上で Fastlane セッションを作成する
 *
 * 【フロー】
 *  1. サーバーからクライアントトークンを取得
 *  2. clientToken で SDK インスタンスを作成（Fastlane 専用）
 *  3. createFastlane() で Fastlane セッションを取得
 *  4. Fastlane ウォーターマークを表示
 *  5. メール入力後 lookupCustomerByEmail() で顧客検索
 *  6. 認証成功 → 保存済みカード情報を表示
 *  7. 支払いボタン押下 → getPaymentToken() → captureOrder
 */
window.initFastlane = async function () {
  const container      = document.getElementById("fastlane-container");
  const notEligible    = document.getElementById("fastlane-not-eligible");
  const lookupBtn      = document.getElementById("fastlane-lookup-btn");
  const emailInput     = document.getElementById("fastlane-email");
  const profileDiv     = document.getElementById("fastlane-profile");
  const fastlaneNameEl = document.getElementById("fastlane-name");
  const fastlaneCardEl = document.getElementById("fastlane-card");
  const changeBtn      = document.getElementById("fastlane-change-btn");
  const payBtn         = document.getElementById("fastlane-pay-btn");
  const watermarkDiv   = document.getElementById("fastlane-watermark");

  let fastlane = null;
  let customerContextId = null;
  let selectedCard = null;

  try {
    UI.setStatus("fastlane", "loading");

    // ① クライアントトークンを取得（Fastlane は clientToken 必須）
    const clientToken = await PayPalAPI.getClientToken();

    // ② clientToken で Fastlane 専用の SDK インスタンスを作成
    const fastlaneSdk = await window.paypal.createInstance({
      clientToken,
      components: ["fastlane"],
    });

    // ③ Fastlane セッションを作成
    fastlane = await fastlaneSdk.createFastlane({
      // Fastlane の UI カスタマイズ（任意）
      styles: {
        root: {
          backgroundColor: "#ffffff",
          fontFamily: "Arial, sans-serif",
        },
        input: {
          borderRadius: "6px",
        },
      },
    });

    // ④ Fastlane ウォーターマーク（表示必須）
    const { FastlaneWatermarkComponent } = fastlane;
    await FastlaneWatermarkComponent({ includeAdditionalInfo: true }).render(watermarkDiv);

    UI.setStatus("fastlane", "ok");

  } catch (err) {
    UI.setStatus("fastlane", "ng");
    notEligible.removeAttribute("hidden");
    container.setAttribute("hidden", "");
    console.warn("Fastlane 初期化エラー:", err);
    return;
  }

  // ---- ⑤ メールルックアップ ----
  lookupBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      UI.toast("メールアドレスを入力してください。", "info");
      return;
    }

    lookupBtn.disabled = true;
    lookupBtn.textContent = "検索中…";

    try {
      const result = await fastlane.identity.lookupCustomerByEmail(email);
      customerContextId = result?.customerContextId;

      if (customerContextId) {
        // ⑥ 既存顧客 → 認証フローを起動
        const authResult = await fastlane.identity.triggerAuthenticationFlow(customerContextId);
        console.log("Fastlane 認証結果:", authResult);

        if (authResult.authenticationState === "succeeded") {
          // 保存済みの支払い情報を取得
          const profileData = await fastlane.profile.showShippingAddressSelector();
          selectedCard = authResult.profileData?.card;

          if (selectedCard) {
            fastlaneNameEl.textContent = `${selectedCard.paymentSource?.card?.name || email}`;
            fastlaneCardEl.textContent =
              `${selectedCard.paymentSource?.card?.brand} ****${selectedCard.paymentSource?.card?.lastDigits}`;
            profileDiv.removeAttribute("hidden");
            payBtn.removeAttribute("hidden");
          } else {
            showGuestCardSection();
          }
        } else {
          // 認証失敗 → ゲストとして続行
          showGuestCardSection();
        }
      } else {
        // 未登録ユーザー → ゲストカード入力
        showGuestCardSection();
      }
    } catch (err) {
      UI.toast(`メール確認エラー: ${err.message}`);
      console.error("Fastlane ルックアップエラー:", err);
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = "確認";
    }
  });

  // ---- カード変更ボタン ----
  changeBtn?.addEventListener("click", async () => {
    if (!fastlane || !customerContextId) return;
    try {
      const result = await fastlane.profile.showCardSelector();
      if (result.selectionChanged) {
        selectedCard = result.selectedCard;
        fastlaneCardEl.textContent =
          `${selectedCard.paymentSource?.card?.brand} ****${selectedCard.paymentSource?.card?.lastDigits}`;
      }
    } catch (err) {
      console.error("カード変更エラー:", err);
    }
  });

  // ---- ⑦ Fastlane 支払いボタン ----
  payBtn.addEventListener("click", async () => {
    try {
      payBtn.disabled = true;
      UI.showProcessing("Fastlane で決済処理中…");

      // 保存済みカードのトークンを取得
      const { id: paymentToken } = await fastlane.getPaymentToken({
        paymentMethodData: selectedCard,
      });

      // 注文作成（Fastlane の場合は payment_source に fastlane トークンを使う）
      const orderRes = await fetch("/paypal-api/checkout/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: APP_CONFIG.ORDER_AMOUNT,
          currency: APP_CONFIG.ORDER_CURRENCY,
          items: [APP_CONFIG.ORDER_ITEM],
          paymentToken, // Fastlane トークン
        }),
      });
      const order = await orderRes.json();

      const result = await PayPalAPI.captureOrder(order.id);
      UI.hideProcessing();

      if (result.success) {
        UI.redirectSuccess(result);
      } else {
        throw new Error("決済の確定に失敗しました");
      }
    } catch (err) {
      UI.hideProcessing();
      payBtn.disabled = false;
      UI.toast(`Fastlane 決済エラー: ${err.message}`);
      console.error("Fastlane 支払いエラー:", err);
    }
  });

  // ---- ゲストカード入力セクションを表示 ----
  function showGuestCardSection() {
    // ゲストの場合は Card Fields セクションへ誘導
    profileDiv.setAttribute("hidden", "");
    payBtn.setAttribute("hidden", "");

    const hint = document.createElement("p");
    hint.className = "fastlane-guest-hint";
    hint.textContent =
      "Fastlane アカウントが見つかりませんでした。下記の「カード払い」からお支払いください。";
    document.getElementById("fastlane-email").after(hint);

    // カードセクションをハイライト
    const cardSection = document.getElementById("section-card");
    if (cardSection) {
      cardSection.classList.add("section-highlight");
      setTimeout(() => cardSection.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }
};
