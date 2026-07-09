---
name: backend-data
description: バックエンド(非同期PvP)のデータ設計とアクセス手段。DynamoDBのテーブル構造・アクションAPI・ローカル検証(DynamoDB Local)・冪等性を触るときに使う
---

# バックエンドのデータとアクセス手段

最終更新: 2026-07-08。実装: packages/backend/src/(repo.ts が中心)、
インフラ: infra/lib/parle-stroika-stack.ts、手順: docs/local_dev_guide.md。

## 1. 構造の要点(30秒版)

- Lambda(handler.ts)は**エンジンを共有**する: クライアントと同じ
  `applyAction(state, action)` をサーバーでも実行して検証・確定する。
  サーバー独自のルール実装は存在しない(あったらバグ)
- 認証は auth.ts に集約(現状は開発用の簡易ログイン。Keycloak/OIDC差し替えがC項目)
- 乱数は rng.ts(サーバー側で確定した結果をイベントとして返す=クライアントは再現するだけ)

## 2. DynamoDB 2テーブル設計(repo.ts 冒頭のコメントが原典)

キーはどちらも resource_key(PK) / event_key(SK)。

**ControlPlaneTable**(低頻度・参照中心):

| resource_key | event_key | 中身 |
|---|---|---|
| match#{matchId} | config#meta | メタ(参加者・マップ・陣営・status: waiting/active/finished) |
| match#{matchId} | config#latest | 盤面の最新MatchState+turnVersion(**楽観的ロック**) |
| match#{matchId} | version#{n} | ターン履歴(8桁ゼロ埋め。上書きしない=自動でリプレイログ) |

**DataPlaneTable**(高頻度・時系列。GSI: index_publisher_resource_key):

| resource_key | publisher | 用途 |
|---|---|---|
| membership#{matchId}#{userId} | matches#{userId} | 「自分の進行中マッチ一覧」を直近アクティビティ順に |
| action#{matchId}#{actionId} | turn_actions#{matchId} | 行動の生ログ |
| idempotency#{actionId} | — | 冪等性キー(TTL 24hで自動削除) |

- **冪等性**: 同じactionIdの2回目POSTは `duplicate: true` を返す(再送安全)。
  書き込みは TransactWriteCommand で latest更新+履歴+冪等キーを原子化
- **絶対則**: テーブル定義を変えるときは infra/lib/parle-stroika-stack.ts と
  packages/backend/scripts/create-local-tables.ts の**2箇所を必ず同期**

## 3. APIのアクセス手段

- ルーティング: handler.ts(API Gateway v2 → 単一Lambda)。主な操作:
  createMatch / joinMatch / listMatches / getLatestState(+since差分) / submitAction
- フロントからは serverApi(lib/serverApi)経由。**盤面は
  `filterStateForViewer()` で閲覧者視点にフィルタしてから返す**(霧・伏兵の情報隠蔽。
  生のMatchStateをそのまま返さないこと)
- submitAction の失敗コード: RepoError(match_not_found / version_conflict 等)と
  EngineError(ルール違反)を区別してハンドリングする

## 4. ローカル検証

```bash
docker compose up -d dynamodb-local   # WSL構成のPCではWSL側で実行(CLAUDE.md)
npm run dev:db:init                   # テーブル作成(冪等。create-local-tables.ts)
npm run dev                           # ポート3010
```

- CPU戦(チュートリアル)は**この一切なしで動く**(ローカル完結)。DynamoDBが要るのは
  ロビー・非同期PvPだけ。ロビー(/)がDB未接続で500になるのは既知の挙動
- 冪等性の再現テスト(同actionId 2回POST)はC項目の検証TODO(未実施)

## 5. データを覗く・直すとき

```bash
# ローカルDynamoDBの中身確認(例)
aws dynamodb scan --endpoint-url http://localhost:8000 \
  --table-name ParleStroikaControlPlane --max-items 10
```

- 本番の盤面を手で直すのは最終手段。やるなら config#latest と version#{n} の
  整合(turnVersion)を壊さないこと。基本は「新しいアクションを流して直す」を選ぶ
- MatchStateのスキーマを変えるときは、**保存済みの旧stateが読めるか**を考える
  (マイグレーションか後方互換フィールドか)。type定義は core-engine/src/types.ts が原典
