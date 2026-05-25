# PayPal JavaScript SDK v6 — 全決済手段デモ

PayPal JS SDK v6 の全決済手段を実装したデモアプリです。GitHub にプッシュして Render に直接デプロイできます。

## 対応決済手段

| 決済手段 | コンポーネント | 説明 |
|---|---|---|
| PayPal | `paypal-payments` | 標準 PayPal チェックアウト |
| Pay Later | `paypal-payments` | 後払い / 分割払い |
| PayPal Credit | `paypal-payments` | PayPal クレジット |
| Card Fields | `card-fields` | インラインカード入力フォーム |
| Google Pay | `googlepay-payments` | Google Pay（Android Chrome 等） |
| Apple Pay | `applepay-payments` | Apple Pay（Safari + Apple デバイス） |
| Fastlane | `fastlane` | ゲスト高速チェックアウト |

## ローカル起動

```bash
# 1. リポジトリをクローン
git clone https://github.com/YOUR_USERNAME/paypal-sdk-v6-demo.git
cd paypal-sdk-v6-demo

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定
cp .env.example .env
# .env を開き PAYPAL_CLIENT_ID と PAYPAL_CLIENT_SECRET を入力

# 4. 起動
npm start
# → http://localhost:3000
```

## Render デプロイ手順

1. このリポジトリを GitHub に push する
2. [render.com](https://render.com) にログイン
3. **New → Web Service → Connect Repository** でこのリポジトリを選択
4. **render.yaml** が自動検出され、設定が読み込まれる
5. ダッシュボードの **Environment** から以下の環境変数を設定：
   - `PAYPAL_CLIENT_ID` — サンドボックスのクライアントID
   - `PAYPAL_CLIENT_SECRET` — サンドボックスのシークレット
6. **Deploy** を実行

## Client ID の設定

`public/index.html` の meta タグを自分のサンドボックス Client ID に書き換えてください：

```html
<meta name="paypal-client-id" content="YOUR_SANDBOX_CLIENT_ID" />
```

または、サーバーサイドレンダリングでクライアントIDを動的に埋め込む場合は `server.js` を修正してください。

## ファイル構成

```
paypal-sdk-v6-demo/
├── server.js                 # Express サーバー（API エンドポイント）
├── package.json
├── render.yaml               # Render デプロイ設定
├── .env.example              # 環境変数テンプレート
└── public/
    ├── index.html            # チェックアウトページ
    ├── success.html          # 決済完了ページ
    ├── css/
    │   └── style.css
    └── js/
        ├── config.js         # アプリ設定
        ├── api.js            # サーバー API 通信
        ├── ui.js             # UI ヘルパー
        ├── app.js            # エントリーポイント（SDK 初期化）
        ├── paypal-buttons.js # PayPal / Pay Later / Credit
        ├── card-fields.js    # Card Fields
        ├── google-pay.js     # Google Pay
        ├── apple-pay.js      # Apple Pay
        └── fastlane.js       # Fastlane
```

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/paypal-api/auth/browser-safe-client-token` | Fastlane 用クライアントトークン |
| POST | `/paypal-api/checkout/orders/create` | 注文作成 |
| POST | `/paypal-api/checkout/orders/:orderId/capture` | 注文キャプチャ |
| GET | `/paypal-api/health` | ヘルスチェック |

## 注意事項

- **Apple Pay** は HTTPS + Apple Pay マーチャント登録 + ドメイン検証が必要です
- **Fastlane** はサンドボックスでは制限があります。詳細は PayPal 開発者ドキュメントを参照してください
- 本番環境への切り替えは `PAYPAL_ENV=live` の設定と `sandbox.paypal.com` → `paypal.com` の URL 変更が必要です

## 参考リンク

- [PayPal JS SDK v6 公式ドキュメント](https://docs.paypal.ai/developer/how-to/sdk/js/v6/configuration)
- [PayPal 開発者ポータル](https://developer.paypal.com)
- [Render デプロイドキュメント](https://render.com/docs/deploy-node-express-app)
