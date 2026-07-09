# ローカル開発・検証手順書

対象: Windows 11 + WSL2(Docker は WSL 側で動かす)構成での Parle-Stroika のローカル検証と、AWS/Vercel へのデプロイ手順。設計の背景は [project_direction.md](project_direction.md) を参照。

> **Ubuntu / Linux で動かす場合**(こちらの方がシンプル):
> WSLの二段構えが不要で、セクション2〜3は以下に読み替える。
> ```bash
> # 前提: Node 20以上(aptの標準は古いことが多い。nvm か NodeSource で導入)
> npm install
> docker compose up -d dynamodb-local   # ネイティブDockerでそのまま
> npm run dev:db:init
> npm run dev                           # http://localhost:3010
> ```
> PowerShellのAPI確認コマンドはcurlで代用:
> `curl -s -X POST localhost:3010/api/matches -H 'x-user-id: alice' -H 'content-type: application/json' -d '{"factionId":"loyalists"}'`
> DynamoDB Localはin-memoryのため、他環境のマッチデータは引き継がれない。

## 0. 前提条件

| 必要なもの | 場所 | 備考 |
|---|---|---|
| Node.js 20以上 / npm | Windows側 | 確認済み: Node v22 |
| Docker | **WSL側** | Docker Desktop でも WSL 内ネイティブ Docker でも可 |
| AWSアカウント + 認証情報 | デプロイ時のみ | `cdk bootstrap` 済みであること |

リポジトリは Windows 側(`D:\github\belre\parle-stroika`)にある前提。WSL からは `/mnt/d/github/belre/parle-stroika` で見える。

```powershell
# 初回のみ(Windows側)
npm install
```

## 1. 開発ループは2段階(計画書8.2)

### 1-A. コアエンジン単体(Docker不要)

移動判定・戦闘解決・時刻計算などの純粋関数は Docker なしで最速のフィードバックループが組める。

```powershell
npm run test -w @parle-stroika/core-engine          # 一発実行(現在49テスト)
npm run test:watch -w @parle-stroika/core-engine    # 保存のたびに数百msでフィードバック
```

### 1-B. 統合層(Lambdaハンドラ + DynamoDB Local)

ここから Docker(WSL)が必要。手順は次のセクション。

## 2. WSL側: DynamoDB Local の起動

WSL のターミナルで、どちらかの方法で起動する。

**方法1: docker compose(推奨。リポジトリの定義を使う)**

```bash
cd /mnt/d/github/belre/parle-stroika
docker compose up -d dynamodb-local
```

**方法2: 単発の docker run(composeを使わない場合)**

```bash
docker run -d --name parle-dynamodb -p 8000:8000 amazon/dynamodb-local \
  -jar DynamoDBLocal.jar -sharedDb -inMemory
```

確認:

```bash
curl -s http://localhost:8000   # 何かしらHTTPレスポンスが返ればOK(400でも可)
```

> **WSL2のポートについて**: WSL2 には localhost フォワーディングがあり、WSL 側で `-p 8000:8000` で公開したポートは Windows 側から `http://localhost:8000` でそのままアクセスできる。つながらない場合はセクション6のトラブルシューティングを参照。
>
> **`-inMemory` 起動のため、コンテナを再起動するとデータは消える**。テーブル作成(次のステップ)からやり直すこと。

## 3. Windows側: テーブル作成と devサーバー起動

```powershell
# 2テーブル + GSI + TTL を作成(接続先: localhost:8000)
npm run dev:db:init

# Next.js devサーバー起動
npm run dev
```

- `dev:db:init` は既存テーブルがあれば `table already exists` と表示してスキップする(冪等)。
- devサーバーの URL は**起動ログに表示されたポートを使う**こと。ポート3000が別プロジェクト(例: simple-fortress-service)に使われていると自動で3001等へ退避する。アプリはどのポートでも動くように作ってある。
- dev では Next.js API Routes(`/api/*`)が Lambda ハンドラを直接 import して実行し、DynamoDB エンドポイントは自動で `http://localhost:8000` にフォールバックする。**環境変数の設定は不要**。

### APIレベルの疎通確認(任意)

```powershell
# ヘルスチェック(DB不要)
Invoke-RestMethod http://localhost:3000/api/health

# マッチ作成 → 一覧取得(DB必要。ポートは起動ログに合わせる)
$H = @{ "x-user-id" = "alice"; "content-type" = "application/json" }
Invoke-RestMethod http://localhost:3000/api/matches -Method Post -Headers $H -Body '{"factionId":"loyalists"}'
Invoke-RestMethod http://localhost:3000/api/me/matches -Headers $H
```

## 4. E2E検証手順(ブラウザでの対戦フロー)

通常ウィンドウとシークレットウィンドウ(または別ブラウザ)で2プレイヤーを演じる。

| # | 操作 | 期待結果 |
|---|---|---|
| 1 | ブラウザAでトップページを開き、名前 `alice` で「はじめる」 | ロビーが表示される(マッチ0件) |
| 2 | 陣営「忠誠軍」で「作成」 | 「対戦相手の参加を待っています」画面。マッチIDをコピー |
| 3 | シークレットウィンドウで `bob` としてログイン →「マッチIDで参加」(アンデッド) | 盤面が表示される。aliceの画面もリロード/自動更新で盤面になる |
| 4 | alice: 盤面をピンチ/ホイールでズーム、ドラッグでパン | 盤面のみが動き、上部バー・FABは固定のまま |
| 5 | alice: リーダー(★)をタップ | 移動範囲が青くハイライト。下部にユニット情報+「雇用」ボタン |
| 6 | alice: リーダーを再タップ(主城🏰の上) | 雇用ボトムシートが開く(Stage 2) |
| 7 | 槍兵(14G)を選択 | 自陣の城ヘックスが金色にハイライト(Stage 3) |
| 8 | 城ヘックスをタップ | 槍兵が配置され、所持金が 100→86G に減る(Stage 4)。雇用直後は行動不可(半透明) |
| 9 | alice: リーダーをタップ→青ヘックスをタップ→「移動」 | 移動が確定し、残り移動力が減る |
| 10 | alice: FAB(⋯)→「ターン終了」 | 未行動ユニットがいれば確認トースト。終了後「bobの番」表示 |
| 11 | bob側: 10秒以内に自動更新 | 「あなたの番です」バッジ。ロビー一覧にも同バッジ |
| 12 | bob: 雇用・移動を行いターン終了 → 数ターン進めて両軍を接敵させる | 敵に隣接した自ユニット選択で敵ヘックスが赤枠に |
| 13 | 赤枠の敵をタップ | 戦闘プレビュー(武器ごとの命中率・期待与/被ダメージ・反撃有無) |
| 14 | 攻撃を選択 | HPバーが減る。乱数はサーバー確定なのでリロードしても結果が変わらない |
| 15 | どちらかのリーダーを撃破(または FAB→降参) | 「🎉 勝利!/敗北...」バナー。ロビーで「終了」バッジ |

**検証ポイント(ルール面)**

- 森・丘は移動コストが高い(草原1 / 森・丘2 / 山3)。飛行ユニット(コウモリ等)は地形無視
- 敵の隣(ZOC)に入るとそのターンはそれ以上移動できない
- 相手のターン中は自分のユニットを動かせない(400エラーのトーストが出る)
- 手番でない画面で同時に操作しても盤面が壊れない(楽観的ロックにより409→自動リフレッシュ)

## 5. AWSデプロイ + Vercel接続

```powershell
# 初回のみ: CDKブートストラップ(対象アカウント/リージョンで)
npx cdk bootstrap

# デプロイ(CORS許可オリジンにVercelのドメインを指定)
npm run cdk:deploy -- -c allowedOrigins=https://<your-app>.vercel.app,http://localhost:3000
```

出力 `ParleStroika.ApiUrl` を控えて、Vercel のプロジェクト環境変数に設定:

| 変数 | 値 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | ApiUrl | ブラウザ→API Gateway 直叩き |
| `API_BASE_URL` | ApiUrl | Server Component / Server Action 用 |

Vercel 側は Root Directory を `packages/frontend` に設定してデプロイする(モノレポ)。

**片付け**: 検証後に消す場合は `npx cdk destroy`(テーブルは `RemovalPolicy.DESTROY` のため一緒に消える。本運用に入る際は RETAIN + PITR に変更すること)。

## 6. トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `dev:db:init` が `ECONNREFUSED localhost:8000` | WSL側でコンテナが動いているか `docker ps` で確認。動いているのに繋がらない場合は WSL の localhost フォワーディング問題 → `wsl --shutdown` 後にやり直すか、`%UserProfile%\.wslconfig` に `[wsl2]` `localhostForwarding=true` を設定 |
| ポート8000が既に使用中 | 別のDynamoDB Local等が動いていないか確認。ポートを変える場合は WSL側 `-p 8001:8000` + Windows側 `$env:DYNAMODB_ENDPOINT="http://localhost:8001"` を `npm run dev:db:init` と `npm run dev` の両方に設定 |
| ロビーで「マッチを取得できません」/500 | DynamoDB Local 未起動 or テーブル未作成(`-inMemory` のため**コンテナ再起動でテーブルは消える**)→ セクション2〜3をやり直す |
| devサーバーが3000以外で起動した | そのポートをそのまま使えばよい(コードはポート非依存)。API疎通確認のURLだけ読み替える |
| `cdk synth/deploy` が esbuild エラー | `npm install` をルートでやり直す(infraの devDependencies に esbuild が必要) |
| 401 `x-user-id ヘッダが必要です` | 未ログイン(cookie `ps_user` なし)。トップページで名前を入力する。curl の場合はヘッダを付ける |
| 相手の盤面が更新されない | ポーリング間隔は10秒。即時反映が必要ならリロード(Web Push はフェーズ2) |

## 7. 今後の検証TODO(フェーズ1残り)

- [ ] WSL Docker での上記セクション2〜4の実施(初回E2E)
- [ ] Keycloak を使った OIDC 認証への差し替え(`packages/backend/src/auth.ts` に集約済み。`docker compose up -d keycloak` → realm/client 作成 → JWT検証実装)
- [ ] AWSへの初回デプロイと Vercel 接続(セクション5)
- [ ] 冪等性の再現テスト(同じ `actionId` を2回POSTして `duplicate: true` が返ること)
- [ ] 「あなたの番です」Web Push 通知(フェーズ2)
