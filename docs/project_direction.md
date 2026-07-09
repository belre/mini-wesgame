# Parle-Stroika(旧称: Web版Wesnoth) 計画書

プロジェクト名: **Parle-Stroika**(`Parle`=交渉・応酬のターン制を示唆。商用ラインを見据え、Wesnothの名は製品名には含めない。ライセンスはGPLv3を採用、詳細はセクション7参照)

## 1. プロジェクト概要

- 元ネタ: [wangyenshu/wesnoth-in-browser](https://github.com/wangyenshu/wesnoth-in-browser)。ただしこれはv86(x86エミュレータ)でDebian+本家Wesnothバイナリを丸ごとブラウザで動かすハック的アプローチであり、Web向け設計ではない。
- 方針: ゼロから完全に作り直す。ゲームルール・アセットの互換性は本家に寄せるが、実装は独自。
- コンセプトの核: **非同期マルチプレイ**。「自分のターンだけ操作して送信、相手は後で確認」という形式にすることで、
  - リアルタイム同期の問題(WebSocket常時接続、tick制シミュレーション)が丸ごと消える
  - 「試合待ち」という概念がなくなり、息の長いゲームプレイが可能になる
  - モバイルとの相性が良い(通信将棋・correspondence chessに近いジャンル)

## 2. スコープ / フェーズ分け

最終ビジョンは本家同様「複数種族・AI対戦・キャンペーン」までの本格実装。ただし1週間(Fable 5利用可能期間)で到達できる範囲ではないため、段階的に進める。

### フェーズ1(今回のスコープ: アーキテクチャ設計+コア実装)
- コアエンジン(移動判定・戦闘解決・地形効果、AI実装を見据えた純粋関数として抽象化)
- 2陣営分のユニットデータ(忠誠軍 Loyalists vs アンデッド Undead。スキーマ・データ自体は6陣営分揃える)
- 非同期マルチのバックエンド一式(Lambda + DynamoDB)
- 最小限のクライアント(1マップで対戦可能なレベル)
- **優先順位**: 非同期PvP対戦の完成を最優先とする。AI実装まで手を回す時間はFable 5利用期間内では確保できない前提

### フェーズ2以降(将来)
- 陣営の追加
- CPU AI対戦
- キャンペーン(シナリオ進行・セーブデータ)
- レベルアップ・装備システム
- 霧(fog of war)、忍び(ambush)などの高度なルール
- 放置対策(タイムアウト・自動スキップ・代打AI)

## 3. アーキテクチャ

### 3.1 全体構成
- **フロントエンド**: Next.js + React。Vercel(無料枠)でホスティングし、GitHub経由で気軽にテストプレイできるようにする。
- **バックエンド**: AWS Lambda + API Gateway(**REST/HTTPのみ、WebSocket不要**)。非同期ターン制のため常時接続が不要になった。
- **データストア**: DynamoDB。ControlPlane/DataPlaneの2テーブル構成(詳細はセクション5)。
- **通知**: 「あなたの番です」はWeb Push API / FCM等、ゲームアクションのAPIとは別チャンネルで扱う。
- **IaC**: AWS CDK(TypeScript統一のため、CloudFormationの直書きは避ける)。

### 3.2 共有コアエンジン(重要な設計判断)
ゲームルール(移動判定・戦闘解決・地形/種族データ)をTypeScriptの共有ライブラリとして実装し、クライアントとサーバーの両方から利用する。

- **クライアント側**: 見えている範囲でのプレビュー(移動範囲ハイライト、被ダメージ予測などUX向上目的)
- **サーバー側(Lambda)**: 実際のアクションを同じロジックで再検証・確定させる権威役

この二段構えにより、二重実装を避けつつチートも防止できる。霧(fog of war)を将来実装した際も、サーバー側の再検証構造を維持すれば破綻しない設計になっている。

### 3.3 Next.js/Reactの共有アーキテクチャ
初期アーキテクチャの決定は後から変更するコストが高いため、Fable 5に本実装を渡す前にここで設計を固めておく。

- **Server/Client Componentの境界線**
  - ロビー画面(「自分の進行中マッチ一覧」の表示のみ): Server Component。サーバー側フェッチを済ませてから返す
  - 対戦盤面(ヘックスグリッド描画・ドラッグ操作・リアルタイムプレビュー): `"use client"`のClient Component
- **共有コアエンジンの実行場所**: Client Component内でブラウザに直接importして実行する。移動範囲ハイライトや期待値計算などのプレビューは、APIコールを一切介さず同じJSバンドル内の関数呼び出しとして完結させる。後から「プレビューのたびにAPIを叩く」設計に引きずられないよう、最初から決めておく。
- **APIクライアント層**: dev(Next.js API Routes経由でLambdaハンドラを直接importするプロキシ)/prod(API Gateway直叩き)の切り替えを、`apiClient.submitMove(...)`のような薄い層に閉じ込める。対戦盤面のコード自体はdev/prodを意識しない。
- **状態管理**: 「確定済み状態」と「下書き状態」を明確に分離する。
  - 確定済みの盤面(サーバーからの応答): **TanStack Query**でキャッシュ・再検証(TanStack Tableの利用実績があり解析しやすいため採用)
  - まだ送信していない下書き状態(移動先候補など、自分だけのローカルな選択): `useState`
  ```typescript
  // サーバーから取得した「確定済み」の盤面
  const { data: confirmedBoard } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => apiClient.getMatch(matchId),
  });

  // まだ送信していない、自分だけのローカルな選択状態
  const [draftMove, setDraftMove] = useState<HexCoord | null>(null);
  ```

### 3.4 UI/UX方針(モバイル対応)
ヘックスグリッド操作領域がモバイルでは狭帯域になる点への対応。

- **パン&ズームを標準操作とし、画面の向きは固定しない**: タップ精度を確保できる最小サイズ(44〜48pt四方)を1ヘックスに割り当てると、縦持ちでも横持ちでもWesnothの対人戦マップ(横幅20〜40マス台)を一望できる密度にはならない。横向き固定はズーム量を減らす程度の効果しかなく、非同期マルチ(サッと開いて確認する使い方)とも相性が悪いため、パン&ズーム(ピンチイン/アウト+ドラッグ)を標準の操作体系とし、向きは自由にする。
- **雇用(recruit)UIはヘックス空間から切り離す**: 「配置先の選択(ヘックスをタップ)」と「どのユニットを雇うか選ぶ(リスト)」を分離し、後者はボトムシート/モーダル等、ヘックスグリッドの制約を受けない通常サイズのリストUIにする。
- **アクションメニューは2種類に分ける**: 「ターン終了」のような単独ボタンをマップ操作エリア付近に常設すると、パン&ズーム操作の指の動線と衝突し誤爆の原因になる。用途が異なる2系統に分離する。
  1. **汎用アクションメニュー(FAB)**: `⋯`アイコンのFABを常時表示し、単体では何も実行しない。タップして展開したポップオーバーに「ターン終了・降参・設定」等を並べ、そこで選択して初めて実行される。この「開く→選ぶ」の2タップ構造自体が誤操作防止として機能する。未行動ユニットが残っている状態でターン終了を選んだ場合のみ、軽い確認トースト(「2ユニットが未行動です。終了しますか?」)を出す条件付き確認を追加する。
  2. **雇用フロー(段階モーダル)**: 汎用アクションメニューには含めない。ヘックス単体のタップだけでは「どのユニットを、どこに配置するか」を表現しきれないため、専用の段階的フローにする。
     - Stage 1: 主城(keep)のヘックスをタップして雇用モードに入る
     - Stage 2: ボトムシートでユニット一覧から雇用するユニットを選ぶ(前項の分離済みリストUI)
     - Stage 3: 隣接する配置可能な空きヘックスがハイライトされる(移動範囲計算で使うハイライト描画をそのまま流用できる)
     - Stage 4: ハイライトされたヘックスをタップして配置を確定

- **描画方式はSVG**: ヘックスごとに`<polygon>`を配置し、Reactの宣言的な状態管理(移動範囲ハイライト等)をそのままDOM差分に乗せる。ドット絵スプライトは各ヘックス上に`<image>`要素として重ねる。Canvasは当たり判定を自前で書く必要があり、このプロジェクトの規模(数十〜100マス、60fps不要)には過剰。
- **パン&ズームライブラリ: react-zoom-pan-pinch**を採用。マウス(開発確認用)とタッチ(ピンチ/パン)の両方に対応し、特定ヘックスへのプログラム的センタリング(相手のターン後、戦闘のあったマスへ自動ズーム等)もAPIとして用意されている。d3-zoomはより低レベルで強力だが、Reactの宣言的レンダリングサイクル外でDOM変換を行うため配線が煩雑になる。将来ミニマップ連動等が必要になった場合の代替候補として保留。
  - 実装注意: ラップする範囲はヘックスグリッドSVGのみに限定し、ユニット情報パネル等のUIオーバーレイは対象外にする
  - 実装注意: タッチ操作をピンチズームに使う場合、コンテナに`touch-action: none`を指定し、ブラウザ標準のページズームとの競合を避ける

## 4. 技術判断まとめ

| 項目 | 判断 |
|---|---|
| マルチプレイ方式 | 非同期(交互ターン制)。同時書き込み競合はほぼ発生しない前提 |
| 戦闘解決の乱数 | サーバー(Lambda)側でcrypto randomを使用して確定。クライアントには渡さない |
| ZOC/移動範囲計算 | ダイクストラ法の変種(地形コスト+ZOC進入時に展開打ち切り)。クライアントはプレビュー用、サーバーは確定用として同じアルゴリズムを実行 |
| 二重送信対策 | クライアントがアクションごとにUUID(冪等性キー)を発行し、Lambda側で処理済みかチェック |
| 状態競合対策 | DynamoDBの`ConditionExpression`による楽観的ロック(バージョン番号一致時のみ書き込み) |
| API形式 | REST(API Gateway HTTP API)で十分。WebSocket/gRPCは不要 |
| 移動確定のAPI設計 | クライアントは`target hex`のみ送信。`path`はサーバー側で再計算し、到達可能集合に含まれるかを検証 |
| フロントエンドの状態管理 | 確定済み状態はTanStack Query、下書き状態(移動先候補等)は`useState`で分離 |

## 5. DynamoDBテーブル設計

以下の記事のパターン([DynamoDBは結局この2テーブルあればいい](https://qiita.com/belre/items/290c848155c161ecbb40))を参考に採用。全データを「低頻度更新・参照中心」と「高頻度書き込み・時系列」の2テーブルに分ける設計で、Wesnothの非同期マルチと相性が良い。

### 5.1 ControlPlaneTable(低頻度更新・参照中心)

| データ | resource_key (PK) | event_key (SK) |
|---|---|---|
| ユーザープロフィール | `profile#userId` | `config#latest` |
| マッチのメタ情報(参加者・使用マップ・陣営) | `match#matchId` | `config#meta` |
| 盤面の最新状態(ユニット配置・HP・ターン数) | `match#matchId` | `config#latest` |
| ターン履歴(リプレイ用、`version#`書き込みだけで自動蓄積) | `match#matchId` | `version#{turnNumber}` |
| ユニット/種族マスターデータ | `unitdef#raceId#unitId` | `config#latest` |

- `config#latest`(盤面の最新状態)には`turnVersion`のような数値属性を持たせ、DynamoDBの`ConditionExpression`による楽観的ロックにそのまま使う。
- `version#{turnNumber}`への書き込みは上書きされないため、明示的な設計なしにターンごとのリプレイ/監査ログが蓄積される。

### 5.2 DataPlaneTable(高頻度書き込み・時系列)

| データ | publisher_resource_key |
|---|---|
| マッチメンバーシップ(「自分の進行中マッチ一覧」を直近アクティビティ順に取得するために使用) | `matches#{userId}` |
| ターンごとの行動ログ(移動・攻撃の生ログ) | `turn_actions#{matchId}` |
| 冪等性キー(TTLで自動削除) | `idempotency#{actionId}` |

- `index_publisher_resource_key`(GSI)だけで、非同期マルチのホーム画面(「自分の進行中マッチ一覧」)に必要なクエリが完結する。
- 冪等性キーは記事のTTL属性の使い方をそのまま流用し、処理済みリクエストIDを一定時間保持後に自動削除する。

### 5.3 見送ったGSI(不採用)

| GSI | 見送り理由 |
|---|---|
| `index_dependency_ancestor` (ControlPlane) | ユニット/種族マスターデータ間に複雑な依存関係の逆引きが発生しない |
| `index_ancestor_event_key` 系統 (DataPlane) | publisherの粒度と集約したい粒度が最初から一致しているため不要(`turn_actions#{matchId}`のmatchId自体がpublisher、`matches#{userId}`のuserId自体がpublisher)。ウォーゲームには「返信への返信」のような多段スレッド構造が存在しないため、そもそも出番がない |
| `index_unified_timeline` (DataPlane) | 管理者向けモニタリング用途以外に使い道がなく、MVPでは不要。必要になれば後付け可能 |

### 5.4 補足: マニュアル・ドキュメント類

種族/ユニットの説明文やゲームルールのマニュアル文書は、多重ツリー構造やDB管理が必要なデータではないため、DynamoDBに含めずS3 + Markdownで十分。

### 5.5 ホットパーティションについて

人気マッチ(観戦者が多い等)で`match#matchId`への読み取りが集中するリスクはあるが、ターン制ゲームの読み書き頻度では当面問題にならない想定。詰まった場合は元記事同様、`event_key_sharded`にシャードIDを導入して分散する。

## 6. ゲームデータスキーマ(ユニット/陣営/時刻)

### 6.1 描画方針
SVG/ドット絵の描画は完全にクライアント側の責務。サーバー(Lambda)・共有コアエンジンは「どのユニットがどこにいるか」という状態のみを扱い、描画ロジックを一切持たない。

### 6.2 陣営データの配布方針
フェーズ1で実装するのは2陣営(忠誠軍 vs アンデッド)だが、**スキーマとデータ自体は6陣営基本パック分を最初から揃えておく**。アセット(スプライト画像)はモバイル向けに遅延ダウンロードできる形にし、データ(JSON)自体は先に6陣営分揃えてしまうことで、後から一番面倒な「陣営追加によるスキーマ変更」を先に潰しておく。

### 6.3 ユニット/陣営スキーマ(基礎属性のみ)

```typescript
// 陣営(6パック分の1つ)
interface Faction {
  id: string;              // "loyalists" | "undead" | ...
  name: string;
  units: UnitDef[];
  assetPackUrl: string;    // モバイル向け遅延ダウンロード先(スプライト一式)
}

// ユニット定義(基礎属性のみ。特技・トレイト・状態異常は将来対応)
interface UnitDef {
  id: string;               // "spearman"
  name: string;
  level: number;            // 1〜3(昇格は将来対応、定義だけ先に持たせる)
  hp: number;
  movement: {
    type: "walk" | "fly" | "swim";
    points: number;         // 1ターンの移動力
  };
  attacks: AttackDef[];
  resistances: Partial<Record<DamageType, number>>; // 未指定は0%扱い
  alignment: "lawful" | "neutral" | "chaotic"; // 時間帯ダメージ補正に使用
  cost: number;              // 雇用コスト
  spriteKey: string;         // アセットパック内の画像参照キー
}

interface AttackDef {
  name: string;             // "spear"
  damage: number;
  count: number;            // 攻撃回数
  type: DamageType;         // "blade" | "pierce" | "impact" | "fire" | "cold" | "arcane"
  range: "melee" | "ranged";
}

// 地形ごとの防御率(基礎属性のみ、地形の特殊効果(回復等)は将来対応)
interface TerrainDef {
  id: string;                // "forest"
  moveCost: number;          // 移動コスト
  defenseBonus: number;      // 防御率(%) ※ユニットの移動タイプごとに変える場合は拡張が必要
}
```

### 6.4 昼夜サイクルのスキーマ
「周期定義(使い回し可能)」と「シナリオ固有の開始位置・長さ」を分離する設計。時刻は状態として保存せず、ターン数から決定的に算出する(現実時刻は使わない — 非同期マルチではプレイヤーごとにターン完了までの実時間が大きく異なるため)。

```typescript
type TimeOfDayId = "dawn" | "morning" | "afternoon" | "dusk" | "first_watch" | "second_watch";

interface TimeOfDayDef {
  id: TimeOfDayId;
  alignmentModifier: Partial<Record<Alignment, number>>; // lawful: +25%, chaotic: -25% など
}

// 昼夜サイクルの定義(使い回し可能。標準サイクル/地下用サイクルなど)
interface TimeOfDaySchedule {
  id: string;                    // "standard_cycle" | "underground_dim" など
  phases: {
    timeOfDay: TimeOfDayId;
    turns: number;                // 何ターン続くか(1以上)
  }[];
}

// シナリオ側(キャンペーンの各マップが持つ)
interface Scenario {
  id: string;
  mapId: string;
  scheduleId: string;             // どのTimeOfDayScheduleを使うか
  startIndex: number;             // 展開後の配列でどこから開始するか(0 = 通常の朝スタート、夜スタートならnight_watchのindexを指定)
}

// ロード時に一度だけ展開しておく(毎回計算し直さない)
function expandSchedule(schedule: TimeOfDaySchedule): TimeOfDayId[] {
  return schedule.phases.flatMap(p => Array(p.turns).fill(p.timeOfDay));
}

// 共有コアエンジンの純粋関数(クライアント・サーバー共通、状態は持たない)
function getCurrentTimeOfDay(expandedSchedule: TimeOfDayId[], startIndex: number, turnNumber: number): TimeOfDayId {
  const index = (startIndex + turnNumber) % expandedSchedule.length;
  return expandedSchedule[index];
}
```

これにより、DynamoDBの`match#matchId / config#latest`には`turnNumber`だけ持たせればよく、時刻自体を別途保存・同期する必要がない(保存すると「ターン数と時刻が矛盾した状態」というバグの温床になる)。フェーズ1では標準サイクル1種類のみ用意すれば十分だが、この形にしておけばキャンペーン追加時にスキーマ変更が不要になる。

### 6.5 期待値計算関数(共有コアエンジン)

```typescript
// クライアント: プレビュー表示に呼ぶ
// サーバー: 実際の乱数確定前に、送られてきたactionの妥当性検証にも使う
function predictCombat(
  attacker: UnitState,
  defender: UnitState,
  terrain: TerrainDef,
  timeOfDay: TimeOfDayDef
): { hitChance: number; expectedDamageDealt: number; expectedDamageTaken: number }
```

### 6.6 AI対応への布石
フェーズ1ではAI実装まで手が回らない前提だが、移動ロジック(移動範囲計算・期待値計算)を共有コアエンジンの純粋関数として抽象化しておくことで、将来的にAIプレイヤーを「同じ関数群を呼んで意思決定するだけの追加クライアント」として実装できる形にしておく。AI固有の実装(評価関数・探索)は後回しにしつつ、土台の抽象化だけは今のうちに済ませておく方針。

## 7. アセット・ライセンス

- 本家Wesnothのドット絵を使用予定(`wesnoth/wesnoth` 公式リポジトリの `data/core/images` 等から取得)。
- Wesnothの素材はライセンスが混在している(旧素材: GPLv2 or later、2017年7月30日以降の新素材: CC BY-SA 4.0)。
- **プロジェクト全体のライセンスはGPLv3(または GPLv3-or-later)を採用する。** 理由:
  - GPLv2+素材は"or later"条項によりGPLv3として扱える
  - CC BY-SA 4.0は2015年にGPLv3との一方向互換性が公式に成立している(CC BY-SA 4.0 → GPLv3への改変・再公開が可能。逆方向は不可)
  - GPLv2のままだとCC BY-SA 4.0の新素材とライセンスが衝突するため、GPLv3採用でこの問題を回避する
- **商用利用について**: GPL/CC BY-SAはいずれも商用利用を禁止しない。Wesnothの素材を使ったスマートフォンアプリを商品化している実例も存在するため、商用ライン自体は一般的な選択肢として現実的。ただし配布するクライアントコード・素材はGPLv3として公開義務を負う点は前提として認識しておく(収益源はコード独占ではなく、ホスティング・コスメティック課金・サポート等に置く設計になる)。
- 各素材の実際のライセンスは、素材フォルダ内の`.license`ファイル等で個別に確認すること。

## 8. リポジトリ構造 / ローカル開発環境

### 8.1 モノレポ構成

```
parle-stroika/
├── packages/
│   ├── core-engine/       # 純粋関数のみ。AWS依存なし。vitest --watchで即フィードバック
│   ├── backend/           # Lambdaハンドラ。core-engineをimportして権威検証に使う
│   └── frontend/          # Next.js。core-engineをimportしてプレビューに使う
├── infra/                 # CDKスタック定義
├── docker-compose.yml     # lambda-rie, dynamodb-local, keycloak
└── package.json           # workspaces設定
```

### 8.2 開発ループは2段階に分ける
コアエンジンはAWSに一切依存しない純粋関数の集まりのため、Dockerなしで最速のフィードバックループが組める。Dockerが必要になるのは、Lambdaハンドラに繋いでDynamoDBとやり取りする統合段階から。

| 段階 | 対象 | 環境 |
|---|---|---|
| コアエンジン単体 | 移動判定・戦闘解決・時刻計算などの純粋関数 | `vitest --watch`のみ。Docker不要、保存のたびに数百msでフィードバック |
| Lambda統合層 | ハンドラ経由でDynamoDBとやり取りする部分 | docker-compose(RIE + DynamoDB Local + Keycloak) |

### 8.3 docker-compose(統合層向け)

```yaml
services:
  lambda-rie:
    # 各Lambda関数をRIE(Runtime Interface Emulator)でラップ
    # 注意: RIEはハンドラ実行のみカバーし、API Gatewayの挙動(ルーティング/認証/CORS)は再現しない
    # → Next.js API RoutesからLambdaハンドラを直接importして呼ぶ薄いプロキシ層で代替する案が有力
  dynamodb-local:
    image: amazon/dynamodb-local
    ports: ["8000:8000"]
  keycloak:
    image: quay.io/keycloak/keycloak
    ports: ["8080:8080"]
    # ローカルでのユーザー認証。本番はCognito/GitHub OAuth/Firebase等に差し替え予定
    # 3者ともOIDC準拠のため、issuer/jwks URLを環境変数化しておけば差し替えコストは小さい想定
```

- **Vercel × AWSの接続**: API Gateway側でCORSの`Access-Control-Allow-Origin`をVercelドメインに許可する設定を忘れずに行う。
- **初期構築自体をFable 5タスクとする**: モノレポ構成・CDKスタック・docker-composeの各サービス・TypeScriptのパス解決を矛盾なく繋ぎ合わせる「配線」の量が多く、知的難易度は低いが手数と一貫性が要るタイプの作業のため、Claude Code + Fable 5に向いている。

## 9. 未決事項 / 次のステップ

- [x] フェーズ1の対戦陣営を確定 → 忠誠軍 vs アンデッド(6陣営分のスキーマ・データは先に揃える、セクション6参照)
- [x] DynamoDBのテーブル設計 → セクション5参照
- [x] ユニット/陣営/昼夜サイクルのデータスキーマ → セクション6参照
- [x] リポジトリ構造とdocker-compose一式の初期構築 → セクション8参照
- [x] コアエンジンの最初の実装対象を決定 → 移動範囲計算(ZOC込みダイクストラ変種)。依存の少なさ・不確実性の高さ・共有コアエンジン設計の検証・戦闘解決の前提になる、の4条件を満たすため
- [ ] 本実装フェーズはClaude Code + Fable 5で自律的に進める想定

### フェーズ1の優先順位についての方針
非同期PvP対戦が最も実装コストが低いと判断し、フェーズ1はPvP対戦の完成を最優先とする。AI実装まで手を回す時間はFable 5利用期間内では確保できない前提だが、移動ロジック・期待値計算を共有コアエンジンの純粋関数として抽象化しておくことで、AI実装が必要になった際にゼロから作り直さずに済む土台だけは今のうちに整えておく(セクション6.6)。

## 10. 検討時の参考メモ

- 非同期マルチのジャンルとしての先例: 通信将棋、correspondence chess、Words With Friends、CivilizationのPlay By Emailなど。「相手を待たせている感覚がなく自分のペースで進められる」のが共通点。
- 非同期化によりゲーム性が変化する点: 相手の動きを見ながら調整できなくなるため、ZOCや視界の駆け引きの緊張感が本家と変わる。これは仕様として受け入れる前提。
- DynamoDBテーブル設計は[こちらの記事](https://qiita.com/belre/items/290c848155c161ecbb40)のパターンを参考にした。
- 過去に生成AIを活用した株投資壁打ちアプリをFable 5で開発した経験があり、それと比べると本プロジェクトはロジック(ルール計算)中心で生成AI呼び出しを含まないため、素直に組める見込み。
- プロジェクト名は「Parle-Stroika」に決定。`Parle`(交渉・応酬)がターン制の核を示唆しつつ、ハイフンを挟むことで元ネタ(ペレストロイカ)への連想を一段階弱めている。商用ラインを見据え、「Wesnoth」の名は製品名には含めない方針(GPLでコード・アセットを使うこと自体は問題ないが、コミュニティブランドとの混同を避けるため)。
