# レストラン地図メモ

機能:
- Google Maps 上でピンを立ててレストラン情報（名前・位置・感想・写真）を登録
- 写真は S3 に保存し、URL を MySQL に保存
- ピンの検索、詳細表示（モーダル）、削除
- XSS/CSRF 対策、ファイルサイズ/拡張子チェック

## セットアップ

1) 依存関係のインストール

```bash
cp .env.example .env
npm install
```

2) `.env` 設定
- `DATABASE_URL`: 例 `mysql://root:password@localhost:3306/restaurant_map`
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `GOOGLE_MAPS_API_KEY`: Google Maps JavaScript API キー

3) MySQL 準備
- 指定の `DATABASE_URL` に接続可能な MySQL を用意（DB が無ければ作成）
- サーバ起動時にテーブルは自動作成されます

4) 起動

```bash
npm start
```

`http://localhost:3000` を開く

## 備考
- S3 バケットは「公開読み取り」相当のポリシーが必要（`ACL` を使わずバケットポリシーで許可する構成を推奨）
- ファイル上限: 8MB/枚、拡張子: jpeg/png/webp/gif
- CSRF: ダブルサブミットトークンを使用（Cookie とヘッダの一致検証）
- XSS: DOM 挿入は textContent/エスケープを使用