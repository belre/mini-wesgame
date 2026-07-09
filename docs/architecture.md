# Parle-Stroika アーキテクチャ・設計思想(実装引き継ぎ資料)

このドキュメントは、フェーズ1実装(2026-07)を **人間・AIを問わず後続の開発者が引き継ぐため** の資料。
「何を作るか・なぜ作るか」は [project_direction.md](project_direction.md)(計画書)、「動かし方」は [local_dev_guide.md](local_dev_guide.md)(手順書)にあり、本書は「**どう作ってあるか・なぜそう作ったか・どこを触ればいいか**」を扱う。

---

## 1. 一枚絵

```
┌─ ブラウザ (Client Component) ─────────────────────────────┐
│  対戦盤面 MatchView                                        │
│   ・確定済み盤面: TanStack Query キャッシュ                  │
│   ・下書き(未送信の選択): useState (UiMode)                │
│   ・移動範囲/戦闘予測: core-engine を直接関数呼び出し ◄──┐   │
└──────────────┬────────────────────────────────────────│───┘
               │ REST (target hexのみ送信 / actionId=冪等性キー)
               ▼                                          │
┌─ サーバー ────────────────────────────────────────────│───┐
│  dev : Next.js API Routes が Lambda ハンドラを直接 import │   │
│  prod: API Gateway HTTP API → Lambda                    │   │
│    handler.ts(ルーター) → repo.ts(DynamoDB)            │   │
│    applyAction() で再検証・確定(乱数はここで注入)◄────┴─ 同じ共有コアエンジン
│                                                  packages/core-engine
│  DynamoDB: ControlPlane(状態) / DataPlane(時系列)       │
└────────────────────────────────────────────────────────────┘
```

**最重要の設計判断**: ゲームルールはすべて `packages/core-engine` の**純粋関数**にあり、
クライアントは「プレビュー」、サーバーは「権威(確定)」として**同じ関数**を実行する。
二重実装を避けつつチートを防ぐ。この構造を壊す変更(クライアントだけにルールを足す、
サーバーだけに補正を入れる等)は行わないこと。

## 2. 設計原則(変更時に守ること)

1. **core-engine はAWS・React・描画に依存しない**。入出力はプレーンなデータのみ。
   `spriteKey` / `assetPackUrl` は参照キーの予約であって、描画ロジックはフロント側の責務。
2. **決定論**: 状態から導出できるものは保存しない。
   - 昼夜(時刻)は `turnNumber` から純粋関数で算出(保存すると矛盾バグの温床。計画書6.4)
   - 乱数は `Rng = () => number` として**引数注入**。サーバーは crypto、テストは固定値。
     クライアントに乱数は渡さない
3. **サーバー権威**: クライアントは移動の `target` ヘックスだけ送る。経路・妥当性はサーバーが
   `computeReachable` で再計算して検証する。「クライアントが計算した結果を信じる」APIを作らない
4. **アクションはデータ**(`Action` 判別共用体)。新ルールは「新しいアクション型 + `applyAction` の
   caseを追加」が基本形。`applyAction` は `structuredClone` でイミュータブルに適用し、
   検証失敗は `EngineError(code, message)` を投げる(HTTPでは400に写像)
5. **書き込みは1トランザクション**: 盤面更新は「冪等性キーPut + 楽観的ロックUpdate + 履歴Put +
   行動ログPut + メンバーシップUpdate×2」を単一 `TransactWriteCommand` で行う。部分適用状態を作らない

## 3. コードマップ

```
packages/core-engine/src/
  types.ts        # 全型定義。スキーマ変更はまずここ(計画書6と対応)
  hex.ts          # odd-qオフセット座標(フラットトップ)。距離・隣接・cube変換・hexOpposite(奇襲判定)
  movement.ts     # computeReachable: ZOC込みダイクストラ変種。canMoveTo/reconstructPath
  combat.ts       # predictCombat/resolveCombat(交互打撃・反撃選択・攻撃特性9種の解決)
  traits.ts       # 特性13種: 付与(assignTraits)とステータス補正。TRAIT_NAMES/SPECIAL_NAMES(表示名)
  timeOfDay.ts    # expandSchedule/getCurrentTimeOfDay + 標準サイクル定義
  engine.ts       # createInitialState/applyAction(権威リデューサ)。村・収入・回復・疫病もここ
  ai.ts           # CPU思考ルーチン(chooseCpuAction)。1手ずつ返す純粋関数。CPU練習モードが駆動
  tutorial.ts     # チュートリアルのガイド発火判定(guideTriggered/firedGuides。純粋関数)
  data/terrain.ts # 地形定義 + マップ文字→地形の対応表(TERRAIN_BY_CHAR)
  data/maps.ts    # マップ(文字列grid)。keep/castleはタイル走査で自動導出(mapMeta)
  data/factions/  # 6陣営のユニットデータ。traitPresets.ts=種族別特性プール。index.tsでID重複検査
  data/tutorials/ # チュートリアルのシナリオJSON(ガイド文言+トリガー)。tutorials.tsで検証ロード
packages/core-engine/test/   # vitest。ルール変更時はここに必ずテストを足す

packages/backend/src/
  handler.ts      # APIGW HTTP API(payload v2)のルーター。エラー→HTTPコード写像
  repo.ts         # DynamoDBアクセスの全て。キー設計・トランザクション・冪等性はここに集約
  auth.ts         # 認証。現状は x-user-id スタブ。OIDC差し替えはこのファイルだけで済む設計
  rng.ts          # crypto乱数 [0,1)。randomIntのrange上限(2^48-1)に注意(超えると実行時例外)
  env.ts / dynamo.ts  # env遅延読み(※重要: Nextプロキシがimport後にenvを注入するため)
packages/backend/scripts/create-local-tables.ts  # ローカル用テーブル定義(CDKと一致必須)

packages/frontend/src/
  app/page.tsx            # ロビー(Server Component。表示のみなのでRSC)
  app/actions.ts          # Server Actions(ログイン/作成/参加)
  app/match/[matchId]/    # 対戦ページ(RSC殻→MatchViewへ委譲)
  app/api/[[...route]]/route.ts  # dev用プロキシ: NextRequest→APIGWイベント変換→handler直呼び
  lib/apiClient.ts        # クライアント用API層(NEXT_PUBLIC_API_BASE or /api)
  lib/anim/               # アニメーションモデル層(React/DOM非依存の純粋関数。描画の"エンジン")
                          #   model.ts=型+SpriteRegistryインターフェース / resolve.ts=時間解決
                          #   combatTimeline.ts=戦闘再生コンパイラ(座標・定義表は注入依存) / assets.ts=画像ロード
  lib/content/            # スプライト定義表(コンテンツ。陣営別ファイル+shared.ts)。SPRITE_REGISTRYを提供
                          #   プロジェクト/バージョンごとに差し替える層。整合性テスト: test/spriteAssets.test.ts
  lib/sprites.ts          # ランタイム層: プリロード+再生フック(useUnitSprite等)。モデル/コンテンツの再輸出
  lib/assets/matchAssets.ts  # 対戦アセット計画(純関数): 「この対戦に何をDLすべきか」を定義表から導出。
                          #   CDNの物理配置(個別PNG/将来のシート化)に非依存 = Loading画面と配信層の抽象境界
  hooks/useMatchAssets.ts # 計画の実行+進捗/失敗集計+リトライ(LoadingScreenのデータ源)
  lib/serverApi.ts        # RSC/Action用API層(API_BASE_URL or hostヘッダから自ポート導出)
  components/MatchView.tsx        # リモート対戦コンテナ(Query/送信/待機画面。盤面UIはBoardScreenへ)
  components/BoardScreen.tsx      # 盤面UI本体(UiModeステートマシン)。submitを注入して共用
  components/CpuMatchView.tsx     # CPU練習モード(参加待ちの間。対局駆動はuseLocalCpuGame)
  components/TutorialMatchView.tsx # チュートリアル(CPU対局+ガイドカード表示。/tutorial/[id])
  hooks/useLocalCpuGame.ts        # ローカルCPU対局の共通フック(APIなし。applyAction+chooseCpuAction)
  components/HexGrid.tsx          # SVG描画(純粋表示。イベントはonHexClickだけ上に返す)
  components/LoadingScreen.tsx    # 対戦開始時のアセットLoading画面(board-wrap内オーバーレイ。失敗時リトライ/このまま開始)
  components/RecruitSheet.tsx     # 雇用Stage2ボトムシート
  components/CombatPreviewPanel.tsx  # 戦闘予測(core-engineをブラウザで直接実行)

infra/lib/parle-stroika-stack.ts  # CDK。テーブル定義はcreate-local-tables.tsと一致必須
```

## 4. コアエンジンの不変条件(ルール仕様)

### 座標系
- **odd-q オフセット**(`{x=列, y=行}`、フラットトップ六角形、奇数列が下にずれる)。
  隣接・距離は必ず `hex.ts` の関数を使う。生の±1計算を書かない(列の偶奇で隣接が違う)

### 移動(movement.ts)
- コストは地形×移動タイプ(`walk/fly/swim`)。`99 = IMPASSABLE`
- 敵ユニットのヘックスは進入不可。味方は**通過可・停止不可**(`canStop: false`)
- **ZOC**: 敵の隣接6ヘックスのどれかに「進入した時点」で残り移動力が0になる
  (打ち切り。ZOCから出る分には制限なし)。このため探索は「コスト最小化」ではなく
  「**残り移動力の最大化**」で行う(同じヘックスでもZOC経由と迂回で残量が違う)

### 戦闘(combat.ts)
- 命中率 = `100 - 防御側地形のdefenseBonus`(%)。攻撃側の地形は自分の被弾時のみ影響
- 1打ダメージ = `round(基礎値 × 時間帯補正(攻撃側alignment) × (100-耐性)/100)`、最低1
- 時間帯補正: lawful 昼+25%/夜-25%、chaotic 逆、neutral 無補正(dawn/duskは無補正)
- 打撃は攻→防→攻→防…と交互。どちらかHP0で即終了。反撃は**同レンジ**の攻撃のうち
  期待ダメージ最大のものを防御側が自動選択(遠隔攻撃に近接しか持たない相手は反撃不可)
- `predictCombat`(期待値)と `resolveCombat`(乱数確定)は同じ計算式を共有

### ターン・経済・村(engine.ts)
- `turnNumber` は1始まり。**両者が endTurn して +1**(時刻計算の入力)
- 攻撃したユニットは移動力0(移動→攻撃の順はOK、攻撃→移動は不可)
- 雇用: リーダーが自軍keepにいる時のみ、自軍castleヘックス(mapMetaが最寄りkeepで自動帰属)
  の空きに配置。雇用ターンは行動不可。初期所持金100G
- **村の占領**: 自軍領有でない村に止まると領有(`villageOwners[hexKey]`)+ そのユニットの移動終了。
  領有はユニットが離れても維持される
- **収入**(ターン開始時): `基本2 + 村数×2 − max(0, 維持費 − 村数)`。
  維持費 = 非リーダーユニットのレベル合計(リーダーは維持費なし)。内訳は `computeIncome()` で
  取得でき、UIも同じ関数を表示に使う
- **ターン開始時の処理順序**(endTurnケース内。手番が回ってきた側にのみ適用):
  1. 毒: 8ダメージ(壮健は4、HPは1未満にならない)。村の上なら毒が治る(そのターン回復なし)
  2. 回復: 村の上なら8。行動しなかったユニット(移動力とattacksLeftが満タン)は休息回復2。
     壮健は行動していても休息回復する
  3. リフレッシュ: movesLeft=maxMoves / attacksLeft=1(**回復判定より後**。順序を崩すと休息判定が壊れる)
  4. 収入加算
- 勝利条件: 相手リーダー撃破 or 相手の降参

### 特性(traits.ts)— 雇用時にランダム付与され個体に固定
`UnitDef.traitConfig`(forced+pool+picks)から `assignTraits(def, rng)` で決定。
結果の `traits` / `maxHp` / `maxMoves` は `UnitState` に**焼き込む**(毎回再計算しない)。
旧レコードは `normalizeState` がデフォルト値を埋める。

| 特性 | 効果 | 制限 |
|---|---|---|
| 強力 strong | 近接ダメージ+1、HP+1 | |
| 知的 intelligent | 必要XP-20%(`maxXpFor()`で適用) | |
| 敏捷 quick | 移動+1、HP-5% | |
| 頑強 resilient | HP+4+レベル | |
| 器用 dextrous | 遠隔ダメージ+1 | 反乱軍のエルフのみ |
| 勇敢 fearless | 不利な時間帯補正を無効化 | グール・トロルのみ |
| 凡愚 dim | 必要XP+20%(`maxXpFor()`で適用) | ゴブリンのみ |
| 鈍重 slow | 移動-1、HP+5% | ゴブリンのみ |
| 非力 weak | 近接ダメージ-1、HP-1 | ゴブリンのみ |
| アンデッド undead | 毒・疫病・生命吸収を無効化 | アンデッド陣営のみ |
| 壮健 healthy | HP+2、移動しても休息回復、毒半減 | ナルガン同盟のドワーフのみ |
| 野生 feral | 村の防御率が50%に制限 | **データでは未使用**(かつてコウモリにforcedだったが、flyの村防御率40%<50%で一度も発動しないno-opだったため撤去。ルールは残置) |
| 小物 no_zoc | ZOCを発しない(敵の移動を隣接で打ち切らない) | 唯一の**導出特性**: 保存されず、レベル0ユニットに参照時に暗黙付与(`effectiveTraits()`)。昇級でlv1になれば自然に外れる(本家の「レベル0はZOCなし」準拠)。ルール判定・UI表示とも`effectiveTraits`経由で参照すること |

### 攻撃特性(combat.ts)— `AttackDef.specials`
予測(predictCombat)と確定(resolveCombat)は内部の `buildPlans()` を共有しており、
**プレビューと実際の数値は必ず一致する**。特性を追加する場合も buildPlans に入れること。

| 特性 | 効果 | フェーズ1の担い手 |
|---|---|---|
| 奇襲 backstab | 対象を挟んで反対側に対象の敵がいればダメージ2倍(hexOppositeで判定) | 盗賊 |
| 狂戦 berserk | どちらかが倒れるまで最大30ラウンド | ドワーフの狂戦士 |
| 突撃 charge | 攻撃時、与ダメージ**も被ダメージも**2倍 | 騎兵 |
| 生命吸収 drain | 与ダメージの半分回復(アンデッド特性には無効) | ゴースト・吸血コウモリ |
| 先制 firststrike | 防御時でも先に打つ(両者持ちなら通常順) | 槍兵・ドレークの粉砕兵 |
| 魔法 magical | 命中率が常に70% | 魔術師・黒魔術師 |
| 精密 marksman | 攻撃時のみ命中率最低60% | **データでは未使用**(単体では分かりづらいため定義しない方針。ルールは毒針の構成要素として現役) |
| 疫病 plague | 倒した相手を歩く死体として自軍に追加(engine側で盤面操作)。相手が`undead`特性持ち、または村の上で倒れた場合は発動しない | 歩く死体 |
| 毒 poison | 命中で毒状態に。毎ターン開始時8ダメージ、村で治療、毒では死なない | グール |
| 毒針 poison_sting | **複合特性**: 精密+毒(combat.tsの`COMPOSITE_SPECIALS`で展開。表示は「毒針」の1語) | オークの暗殺者・スレイヤー・ナイトブレード(投げナイフ) |
| 遅化 slow | 命中で鈍化状態に。**この戦闘中は影響せず、次の戦闘から**自分の攻撃ダメージが半減(buildPlansの`attackerMult`/`defenderMult`に0.5倍を合成。四捨五入は他特性と同じ計算式を共有)。移動コストも2倍(`moveCostFor`)。治療手段は不要で、次の自ターン開始で必ず解除される(engine.tsの`endTurn`) | エルフの女呪術師(巻きつき) |

### 能力(`UnitDef.abilities`)— 定義固定の常時能力(特性と違いランダムでない)

| 能力 | 効果 | 主な担い手 |
|---|---|---|
| 伏兵 ambush | 森にいる間、敵から見えない | エルフのレンジャー |
| 潜水 submerge | 深海にいる間、敵から見えない | スケルトン系(terrainOverridesで深海進入可) |
| 治癒 cures | ターン開始時、隣接味方の毒を治療 | 白魔術師・エルフの女呪術師/ドルイド・トカゲの僧侶 |
| 回復+4 heals4 | ターン開始時、隣接味方を4回復 | エルフの女呪術師・トカゲの占い師/神官 |
| 回復+8 heals8 | ターン開始時、隣接味方を8回復 | 白魔術師・エルフのドルイド・トカゲの僧侶 |
| 統率 leadership | 隣接味方の与ダメージ+25%(buildPlansで解決、プレビュー一致) | 副官・エルフの隊長 |
| 再生 regenerates | 毎ターン8回復(毒なら治療) | トロル系 |
| すり抜け skirmisher(2026-07-08改名。旧「散兵」) | 敵ZOCを無視(computeReachableで解決) | リザードマン系・熟練盗賊 |
| 装甲 steadfast | 防御時のみ正の耐性2倍(上限50%、弱点は不変) | ドワーフの警護兵系 |

**可視性(霧・伏兵・潜水)のルール**(`visibility.ts`、状態を持たず都度計算):
- **霧(FOG)**: マッチ作成時のオプション(`MatchState.fogEnabled`、既存マッチはfalse扱い)。
  視界 = 自軍の各ユニットから**ヘックス距離 ≤ そのユニットのmaxMoves**(`computeVisionSet`)。
  地形コストを使わない距離ベースの簡易版で、隣接が必ず視界に入るため伏兵の
  「隣接で発覚」ルールと矛盾しない。視界外の敵ユニットに加えて**敵村の領有情報も隠す**
  (自軍の村は常に把握)。複数ユニットを判定するときはvisionSetを一度計算して使い回すこと
- **伏兵・潜水**: 能力と地形が一致 && 閲覧者側ユニットが隣接していない && `attacksLeft > 0`
  (攻撃すると露見、次の自ターン開始のリフレッシュで再び隠れる)。霧とは独立に効く
  (霧なしマッチでも森・深海には隠れられる)
- **サーバーがレスポンス時に `filterStateForViewer` で隠れユニットを盤面から除去する**(handler.tsの
  GET/join/actions全応答)。クライアントに隠れユニットの情報は一切渡らない(チート防止)

**移動は「可視情報で計画、全情報で実行」**(engine.ts moveケース。変更時はこの分離を壊さないこと):
1. 経路計画は `isHiddenFrom` でフィルタした**可視ユニットだけ**で `computeReachable` する。
   全情報で計画すると、サーバーが隠れユニットを避ける迂回路を勝手に選んでしまい、
   伏兵の遮断が機能しなくなる(実際に起きたバグ)。クライアントのプレビューと同一入力=同一経路になる
2. 実行は全情報で経路を1ヘックスずつ進める:
   - 次のヘックスに隠れユニット本体がいる → その手前で停止
   - 隠れユニットのZOCヘックスに進入 → そこで移動終了(残り移動力0)
   - いずれも `moveInterrupted` イベントを発行(クライアントは「伏兵に阻まれた」トースト表示)。
     停止位置は隠れユニットに隣接するため、以後の閲覧で自然に発覚する
   - 停止ヘックスが占有済み(味方の通過中に停止した場合)は空くところまで手前に戻す
- 回復量は加算せず**最大値のみ**適用(村8/再生8/隣接ヒーラー8or4/休息2)

### 経験値とレベルアップ(engine.ts / traits.ts maxXpFor)
- 入手(攻撃側・防御側とも): 生存して戦闘を終える=相手のレベル分 / 撃破=`killXp`(レベル×8、レベル0は4)
- 必要XP: `UnitDef.maxXp`(未指定はレベル0: 30 / それ以外: レベル×40)。
  知的-20%・凡愚+20%は `maxXpFor(def, traits)` で適用(これで両特性が機能するようになった)
- レベルアップは戦闘直後にサーバー側で自動適用(`maybeLevelUp`、XPは繰り越し):
  - `advancesTo` があればそのユニットに変身。maxHp/maxMovesを新定義+既存特性で再計算し全回復・毒治療
  - なければ **AMLA**: 最大HP+3と全回復
  - `levelUp` イベント発行(UIがトースト表示)
- 昇格ラインは既存ユニットで繋がる11本(魔術師→白魔術師、エルフの戦士→隊長、射手→レンジャー、
  女呪術師→ドルイド、オークの戦士(2026-07-08改名。旧兵卒→熟練戦士)、トロルの子供→トロル、
  ドワーフの戦士→装甲兵、警護兵→熟練警護兵、盗賊→熟練盗賊、リザードマン(2026-07-08改名。
  旧トカゲの散兵→熟練散兵)、占い師→神官)。
  `advancesTo` の指し先はレジストリロード時に整合性チェックされる(typoは即throw)
- UI: HPバー下の紫バーがXP、ユニットパネルに `XP n/必要値(次: 昇格先)` 表示

### データ追加の作法
- 陣営追加: `data/factions/` にファイル追加 → `index.ts` の `FACTIONS` に登録(ユニットIDは
  全陣営でグローバルに一意。重複はロード時に throw)
- マップ追加: `data/maps.ts` に文字列グリッド追加。**keepはちょうど2個**(走査順=プレイヤー順)。
  castleは最寄りkeepに自動帰属するので手動リスト不要。`description` はマッチ作成画面に表示される
- 攻撃追加: `AttackDef` は `id`(英語の安定キー。フロントのスプライトアニメ選択が参照。
  `test/factions.test.ts`が書式・同一ユニット内の重複を検査)と `name`(表示名。日本語)を
  両方必須で持つ。`id`を省略/流用しない(表示名と混同しない)こと

### マップデータの置き場所(現状: JSON + S3配布、読み込みはバンドル)
- **単一の情報源**: `packages/core-engine/src/data/maps/*.json`(純粋なデータ)。
  `data/maps.ts` がロード時に検証(寸法・タイル文字)して `MAPS` レジストリに登録する
- **現段階の読み込みはビルド時バンドル**。共有コアエンジンは `mapById()` / `getUnitDef()` が
  **同期で返る**前提で組まれており(クライアントのプレビューとLambdaの権威検証が同じ関数を
  同期実行する構造)、バンドルなら両者のデータ一致が自動で保証されるため
- **デプロイ時に同じJSONがS3へアップロードされる**(CDKの `GameDataBucket` +
  BucketDeployment、`maps/` プレフィックス、公開読み取り+CORS。出力 `GameDataUrl`)。
  現時点では「配布の受け皿」であり、アプリはまだS3から読まない
- **S3からの動的ロードに切り替える条件と設計**(マップ量産・ユーザー作成マップの段階):
  S3のJSONを「Lambdaはコールドスタート時、クライアントは初回ロード時」にフェッチして
  レジストリへ登録する。`match#meta` にデータのバージョン(ハッシュ)を記録し、
  両者が同一バージョンを使っていることをアクション検証時に突き合わせる。
  この突き合わせなしに動的ロード化しないこと(プレビューと確定の不一致バグの温床)

### 画像アセット(スプライト)の配布(CloudFront経由、`GameDataBucket`を共用)
- 同じ `GameDataBucket` に `sprites/` プレフィックスで
  `packages/frontend/public/sprites/`(fetch-demo-sprites.mjsでローカル取得したもの)を
  そのままアップロードする(`SpriteDataDeployment`)。**ディレクトリが存在しない環境
  (未取得のclone直後・CI等)ではこのアップロードをスキップし、`cdk synth`/`deploy`自体は
  壊さない**(`fs.existsSync`でガード)。デプロイ後にスプライトを反映したい場合は
  ローカルで取得してから再デプロイする
- `GameDataBucket`全体(maps/ + sprites/)の前段に **CloudFrontディストリビューション**
  (`GameDataCdn`)を1つ用意し、出力 `AssetBaseUrl` を得る。バケットは元々
  `publicReadAccess: true` なのでOAI/OACなしの素のHTTPSオリジンとして使える。
  スプライトはファイル名が実質immutableな静的アセットなので `max-age=31536000, immutable`
  の長寿命キャッシュを設定済み
- フロント(`lib/sprites.ts`)は `NEXT_PUBLIC_ASSET_BASE`(`apiClient.ts`の
  `NEXT_PUBLIC_API_BASE`と同じ方針)で参照先を切り替える。未設定(dev既定)は相対パス
  `/sprites/...`(Next.jsの`public/`から配信)、設定時(prod)は`AssetBaseUrl`の値を
  そのまま前置してCDN経由になる。マップJSON(`GameDataUrl`)は当面S3直リンクのまま
  (動的ロード化していないため未使用。切り替える際はCDN経由に揃えてもよい)

## 5. DynamoDB設計(実装の実際)

計画書セクション5のパターンを実装に落としたもの。定義は
`infra/lib/parle-stroika-stack.ts`(本番)と `packages/backend/scripts/create-local-tables.ts`(ローカル)の**2箇所にあり、必ず同期させる**。

### ControlPlaneTable — `resource_key` / `event_key`

| item | resource_key | event_key | 備考 |
|---|---|---|---|
| マッチメタ | `match#{matchId}` | `config#meta` | players/mapId/status(waiting→active→finished) |
| 最新盤面 | `match#{matchId}` | `config#latest` | `state`(MatchState丸ごと)+ `turnVersion` |
| 履歴 | `match#{matchId}` | `version#{turnVersion 8桁0埋め}` | アクション毎スナップショット。上書きされないため自動でリプレイ/監査ログ |

- 楽観的ロック: `config#latest` の Update に `ConditionExpression: turnVersion = :prev`。
  失敗(誰かが先に書いた)は409 `version_conflict` → クライアントは自動リフェッチ
- ユニットマスターデータはDBに置かず core-engine にバンドル(計画書5.1の`unitdef#`行は
  フェーズ1では未使用。マスターデータの動的配信が必要になったら導入)
- `version#{n}` は `joinMatch` 時点(`turnVersion=0`)も含めて必ず1件書く(通常のアクション
  は`submitAction`が書くが、初期状態だけは他に書く場所がないため)。これにより
  「任意のバージョンnにおける確定盤面」が常に`version#{n}`から引けることが保証され、
  相手ターンログ(下記)の起点スナップショットとして使える

### 相手ターンログ(索敵・雇用・被攻撃・昇格・自軍の回復/毒) — GET `/matches/{id}/log?sinceVersion={n}`

非同期PvPでは相手の手番中の挙動を厳密にアニメ再現する優先度を下げた代わりに
([非同期PvPでの演出方針](#非同期pvpでの演出方針2026-07-03実機検証を踏まえた判断)参照)、
「相手が何をしたか」をテキストログとして自分のターンで確認できるようにしている。

- ロジック本体は `packages/core-engine/src/turnLog.ts` の `computeTurnLog`(純粋関数、
  core-engine配置。テストは `test/turnLog.test.ts`)。閲覧者が最後に確認した`turnVersion`
  (`sinceVersion`)時点の盤面(`beforeState`)と、それ以降の`version#{n}`群(1バージョン=
  1アクション)を発生順に渡すと、以下6種類の`TurnLogEntry`を生成する:
  - `spotted`: 直前ステップでは隠れていた(霧 or 伏兵/潜水)敵ユニットが、そのステップで
    見えるようになった瞬間。**1ステップずつ判定する**(最終状態だけの差分は取らない)。
    一瞬視界に入ってまた隠れた場合(索敵として重要な情報)も拾うための設計。
    同じユニットはその相手ターン内で初回のみ記録
  - `recruited`: `spotted`と同じ「隠れ→見える」判定に該当するが、直前の状態に存在しなかった
    ユニットかつ、そのステップの`events`に対応する`recruited`イベントがある場合はこちらに
    分類される(主塔での増援など、視界内で新規に雇用された場合の表現を「視界に入った」と
    区別するため)。疫病(`plagueSpawned`)による新規出現は現状スコープ外で`spotted`にフォールバック
  - `attacked`: 閲覧者のユニットが防御側になった`combat`イベント
  - `leveledUp`: 見えている敵ユニットの`levelUp`イベント(隠れている敵の昇格は情報漏洩に
    なるため記録しない)。`unitDefId`(≒最大HP)は特性による誤差はあるが昇格(レベルアップ)で
    別定義に丸ごと変わるほどの差は生まないという判断で、`attacked`エントリ自体には
    戦闘直前の実際のHP/maxHPを持たせていない。将来HPバー付きの演出に差し替える際は、
    「そのユニットが現在どの`unitDefId`か」を`spotted`→`leveledUp`の並びから追えば
    `getUnitDef(...).hp`で十分近い近似ができる、という設計判断(2026-07-04)
  - `healed` / `poisonDamage`: 他4種と逆に**閲覧者自身のユニット**のみ対象。相手が`endTurn`する
    ことで閲覧者のターンが開始し、その瞬間に自軍の回復(村8/再生8/隣接ヒーラー4or8/休息2。
    最大値のみ採用)・毒ダメージが発生する(`engine.ts`の`endTurn`処理)ため、相手ターンの
    出来事として一緒にログ化する。`healed`は採用された回復源(`source`)も持つ
  - どのエントリも発生ヘックス(`spotted.pos` / `attacked.attackerPos`・`defenderPos` /
    `leveledUp.pos` / `healed.pos` / `poisonDamage.pos`)を持つ。画面設計時に
    「このhexへジャンプ」を実装しやすくするため
  - 同じ相手ターン内で、`spotted`されたユニットが後に攻撃してきた場合、`spotted`エントリに
    `followedByAttackId`(対応する`attacked`エントリのid)を付ける。1行にまとめるかどうかは
    表示側の裁量(データとしては2エントリのまま保持する)
- バックエンド(`repo.ts` `getTurnLog`)は`version#{sinceVersion}`をGetで1件、
  `version#{sinceVersion+1}`〜`version#99999999`をQuery(BETWEEN、ゼロ埋めなので文字列
  比較で数値順になる)で取得し、`computeTurnLog`に渡すだけ
- `sinceVersion`はクライアントが持つ(自分の最後の行動直後の`turnVersion`、または
  ローカルストレージに保存した「前回自分のターンが終わった時点のturnVersion」)。
  サーバー側で「既読管理」は持たない

### DataPlaneTable — `resource_key` / `event_key` + GSI

GSI `index_publisher_resource_key`: HASH `publisher_resource_key` / RANGE `published_at`(ISO時刻)

| item | resource_key | publisher_resource_key | 用途 |
|---|---|---|---|
| メンバーシップ | `membership#{matchId}#{userId}` | `matches#{userId}` | ホーム画面の「進行中マッチ一覧」をGSIで直近アクティビティ順に1クエリ取得。アクション毎に`published_at`等を更新 |
| 行動ログ | `action#{matchId}#{actionId}` | `turn_actions#{matchId}` | 生ログ(時系列) |
| 冪等性キー | `idempotency#{actionId}` | (なし) | TTL属性`ttl`(24h)で自動削除 |

※ 計画書との差分: GSIのRANGEに`published_at`属性を採用した(メンバーシップは同一itemを
更新し続けるため、SKに時刻を入れると削除+再作成が必要になる。属性更新ならUpdate一発)。

### アクション適用フロー(repo.ts `submitAction`)— 変更時は順序に注意

1. メタ+最新盤面を読む
2. **冪等性の事前チェック**(`idempotency#{actionId}` をGet)。処理済みなら現在の盤面を
   `duplicate: true` で返す。
   ⚠️ **この順序が重要**: 事前チェックをエンジン検証の後に置くと、再送リクエストが
   「適用済み盤面に対する再適用」として検証エラー(400)になる実バグがあった(E2Eで検出・修正済み)
3. `applyAction`(エンジン検証。失敗→400)
4. `TransactWriteCommand` 一発: 冪等性Put(条件付き=同時二重送信の最終防衛)/ latest Update
   (turnVersion条件)/ version履歴Put / 行動ログPut / メンバーシップUpdate×2
5. TransactionCanceled の CancellationReasons を見て、[0]失敗=重複(duplicateで返す)、
   [1]失敗=409 conflict に振り分け

## 6. フロントエンドの設計

- **RSC/Client境界**: ロビー=Server Component(表示のみ)、盤面=Client Component。
  この境界は計画書3.3の決定事項。ロビーに対話機能を足すときも「一覧表示はRSC、対話部分は
  小さなClient Componentを埋め込む」方針を維持する(実例: `LobbyForms.tsx` —
  陣営→隊長候補の連動セレクトのみクライアント化し、送信はServer Actionのまま)
- **マッチ作成/参加のオプション**: 隊長はLv2以上の自陣営ユニットから選択可(`resolveLeaderDef`で
  サーバー検証、metaの`players[].leaderUnitId`に保存)。マップは作成時に`mapId`で選択
- **状態の二層分離**(混ぜないこと):
  - 確定済み盤面 = TanStack Query(`["match", matchId]`)。mutation成功時は
    `setQueryData` でサーバー応答をそのまま反映(手元でstateを再計算しない)
  - 下書き = `UiMode` 判別共用体ひとつに集約:
    `idle → unitSelected → moveDraft/attackDraft`、`recruitPick → recruitPlace`(雇用Stage2→3-4)。
    新しい操作モードを足すときは boolean を増やさず UiMode にケースを足す
- **API層は3つ**(いずれも薄い層。盤面コードはdev/prodを意識しない):
  1. `lib/apiClient.ts` … ブラウザ用。`NEXT_PUBLIC_API_BASE` 未設定なら `/api`
  2. `lib/serverApi.ts` … RSC/ServerAction用。`API_BASE_URL` 未設定なら **hostヘッダから
     自ポートを導出**(ポート3000が他プロジェクトに使われて3001に退避しても壊れない)
  3. `app/api/[[...route]]/route.ts` … devプロキシ。NextRequest→APIGWv2イベント変換して
     Lambdaハンドラを直接呼ぶ。lambda-rie不採用の代替(計画書8.3)
- **相手ターンログ**(`hooks/useOpponentTurnLog.ts` + `components/TurnLogPanel.tsx`。
  バックエンド側の詳細は5章参照): `isMyTurn`が`true→false`になった瞬間の`turnVersion`を
  `localStorage`(`ps_turnlog_since_{matchId}`キー)に保存しておき、次に`false→true`(または
  初回マウントで既に自分のターン)になった瞬間、保存しておいた値を`sinceVersion`にして
  `GET /matches/{id}/log`を叩く。サーバー側に既読管理は無く、クライアントの
  localStorageだけが状態を持つ(同じ端末の別タブ・別ブラウザでは既読が揃わないが、
  現状はシンプルさを優先)。表示は`BoardScreen`の`banner`スロットに文字列羅列で挿入
  (演出は将来対応。CPU練習モードには出さない — DynamoDBの履歴を前提とするため)
- **認証はスタブ**: cookie `ps_user`(httpOnlyでない=クライアントが読んで `x-user-id` ヘッダに載せる)。
  OIDC化する際は「cookie→Authorization: Bearer JWT」に置き換え、検証を `backend/src/auth.ts` に実装。
  フロントは apiClient/serverApi のヘッダ組み立てだけ触ればよい
- **描画**: SVG polygon + 記号表示。パン&ズームは react-zoom-pan-pinch で
  **SVGだけをラップ**(オーバーレイUIは対象外)。`touch-action: none` はboard-wrapに指定済み
- **スプライト描画**(段階導入中。検証ページ: `/dev/sprites`。
  **ユニットの追加手順は docs/sprite_guide.md** — WML記法の読み方・トラブルシュートもそちら):
  - `lib/content/` の `UNIT_SPRITES`(spriteKey→フレーム定義。陣営別ファイル)に登録したユニットだけ
    アニメーションスプライトで描画する。フォールバックは2段:
    アセット取得失敗 → **組み込み1枚絵**(base立ち絵。fetch-demo-sprites.mjsが
    `src/generated/`に生成し静的importでバンドルに同梱=CDN障害時もアプリ自身から配信できる。
    gitignore) → それも無い(定義なしspriteKey)場合のみ従来の円+頭文字
  - フレームモデルはWesnoth AnimationWMLのサブセット: 個別PNG+可変duration(ms)。
    standing=常時ループ、idle=3〜8秒おきに1回。再生は `useUnitSprite` フック
    (ユニット単位の再帰setTimeout。盤面全体は再レンダーしない)
  - 画像アセットはGPLのためリポジトリに含めない(`public/sprites/` はgitignore)。
    `node packages/frontend/scripts/fetch-demo-sprites.mjs` でWesnoth本家から取得する。
    **公開時はライセンス方針(GPL準拠 or 自作アセット差し替え)の決定が必要**
  - ヘックス頂点計算に Math.cos/sin を使わないこと(実装依存の丸めでSSRとhydration不一致になる。
    60度刻みなので ±1, ±0.5, ±√3/2 の定数で計算する。SpriteAnimDemo.tsx参照)
- **対戦アセットのLoading画面**(`lib/assets/matchAssets.ts` + `hooks/useMatchAssets.ts` +
  `components/LoadingScreen.tsx`。BoardScreen共通なので対戦・CPU・チュートリアル全部に効く):
  - 計画(何をDLすべきか)と実行(進捗・失敗集計)を分離。計画は「ユニット×チームカラー」
    「地形」の論理単位で、CDNの物理配置に依存しない — 配信形態を変える(backlog A-4の
    スプライトシート化等)ときは実行側だけ差し替え、計画・Loading画面は不変
  - 対戦開始時に**両陣営の全ユニット+マップ地形をまとめて**プリロード(2026-07-06決定)。
    霧から現れた敵・対戦中の雇用で「円→スプライトのポップ」が起きないようにするため
  - 完了条件はrequired(standing/idle)のみ。攻撃フレームは裏で継続ロード(既存挙動)
  - 失敗時は失敗項目を列挙して「リトライ」と「このまま開始」(円描画フォールバックで
    プレイ可能)を提示。失敗したプリロードはキャッシュに残さない(sprites.ts)ことで
    リトライが実際に再取得になる
- **CPUのペース調整**(`hooks/animationTiming.ts` + `useLocalCpuGame`):
  CPUの手番タイマーは固定間隔ではなく、前の手が生んだ演出(移動スライド・戦闘の打撃列)の
  再生時間ぶんだけ次の手を待たせる(`estimateEventsDurationMs`、最低`CPU_STEP_MS`=600ms)。
  固定間隔のままだと、演出に数秒かかる戦闘や長距離移動の最中に盤面(真の状態)が
  どんどん先へ進んでしまい、「演出前にユニットが(実際にはもう死んでいて)消える」
  「動きが速すぎて追えない」といった見た目の破綻が起きるため。
  `MOVE_MS_PER_HEX`/`STRIKE_WINDOW_MS`/`TAIL_MS`/`MAX_PLAYED_STRIKES`は
  useMoveAnimations/useCombatAnimationsと`animationTiming.ts`を唯一の定義元として共有する
  (演出のタイミングを調整したらCPUのペースも自動で追従する)
- **アニメ開始時のちらつき対策**(flicker): CPUの手で盤面(board)が更新されてから
  playMove/enqueueCombatが呼ばれるまでの間に一度でも「素の論理位置(=移動後の目標ヘックス・
  死亡済みで消えたユニット)」がペイントされると、ユニットが目標地点に一瞬だけ現れて
  消える/消えて見えるちらつきになる。対策は2段: (1) `useMoveAnimations.playMove`/
  `useCombatAnimations`の初回フレームは、次のrequestAnimationFrameを待たず**同期的に**
  開始位置/初期状態をstateへ反映する。(2) BoardScreenの盤面差分エフェクト(extraEvents/
  board diff)は`useEffect`ではなく`useLayoutEffect`(SSR環境向けに`useIsoLayoutEffect`で
  `useEffect`にフォールバック)にして、盤面更新と同じコミット内・ペイント前に(1)の
  同期反映を走らせる。CPU戦以外(自分の手をsubmitの`.then`で直接再生する経路)は
  この対策の対象外(未報告のため据え置き。同種の問題が出たら同じ手法を適用する)
- **移動アニメーション**(`hooks/useMoveAnimations.ts` + BoardScreen):
  - 演出層のみ。確定盤面(論理位置)は即時反映で、表示位置だけを1ヘックス200msで滑らせる。
    アニメ中も操作はブロックしない(クリック判定は論理位置)
  - 経路の入手: 自分の手とCPUの手は `moved` イベントの実経路(伏兵で中断された場合も
    サーバー確定の途中経路)。相手の手(ポーリングはstateのみ)は新旧盤面の位置差分から
    直線スライドにフォールバック。BoardScreenの盤面差分エフェクトが両者を一元処理する
  - CPUの手のイベントは `useLocalCpuGame` の `cpuEvents` → BoardScreenの `extraEvents` propで渡す
  - 相手の実経路も再生したくなったら、保存済みアクションログから差分イベントを返すAPI
    (`GET /matches/{id}?sinceVersion=n`)を足すのが本命(戦闘演出・リプレイの土台にもなる)。
    **ただし優先度は低い**(2026-07-03の実機検証で判断。下の「非同期PvPでの演出方針」参照)
- **戦闘アニメーション**(`hooks/useCombatAnimations.ts`。検証: `/dev/sprites`):
  - `combat` イベントの `result.strikes`(打撃ごとのactor/hit/damage/targetHpAfter列)を
    タイムライン化し、攻守交互に1打撃550ms(打撃時刻=325ms地点)で再生。複数戦闘はキュー
  - 打撃の瞬間に「HPバー減少・被弾リアクション・ダメージ数字」を同期。HPは演出中だけ
    打撃進行に合わせた表示に上書き(確定値は盤面stateに反映済み)。
    死亡ユニットは演出終了までゴースト描画(BoardScreenが戦闘前スナップショットを渡す)
  - スプライトに攻撃定義(`UNIT_SPRITES[].attacks`。**攻撃id(AttackDef.id。英語の安定キー)ごと**の
    マップ。**`name`(表示名。ローカライズ対象)ではなく`id`をキーにすること** — 例:
    spearmanは`spear`(近接・踏み込みあり)と`javelin`(遠隔・踏み込みなしで飛び道具
    `missile`が攻撃側→防御側へ直線移動し命中の瞬間に到達)の2つを持つ)があればWMLどおりの
    フレーム+踏み込み、なければ汎用ランジ・飛び道具なし(円ユニットにも演出が出る)。
    どちらの攻撃idを使うかはエンジンの`combat.attackerAttack.id`(攻撃側)と
    `combat.result.retaliationAttack?.id`(防御側の反撃。無ければundefined)から得る
  - 狂戦(berserk)対策の暫定上限 MAX_PLAYED_STRIKES=12。超過分は演出を省略して結果だけ反映
  - 相手の手(ポーリング)は戦闘イベントが取れないため演出なし(HPだけ即時更新)。
    対応するなら上記の差分イベントAPIが前提(ただし下記の理由で優先度は低い)

### 非同期PvPでの演出方針(2026-07-03、実機検証を踏まえた判断)
- **相手の手を「厳密なアニメーション」で再現することはやらない方針(優先度を下げる。
  完全に選択肢から外すわけではない)**。理由: 演出の意味があるのは「操作した本人が
  その瞬間を見ている」場合(自分の操作・CPU練習モード)だけで、非同期PvPで相手の手を
  確認するのは基本的に数分〜数時間後の「後追い確認」であり、その時点でアニメーションは
  ドラマ性を持たない。スマホ実機で試すと、移動の経路を丁寧に演出しても画面が小さく
  注意力も薄いため実質的に知覚できず、「盤面を開いたら結果が即座に見える」方が体験として勝る
  - 移動: 盤面差分(位置比較)による直線スライドのフォールバックは残す(実装コストが
    ほぼ無いため)。ただし専用の経路アニメ(実経路の再現)は不要
  - 戦闘: 演出なし(HPが即時更新されるだけ)のままでよい
  - この判断がある限り、差分イベントAPI(`?sinceVersion=n`)による相手の手のリプレイは
    後回しでよい(不要になったわけではないので、削除はしない)
  - **自分の手の演出は「送信前スナップショット」を使う**(BoardScreenのsubmit内、
    `submitImpl`呼び出し前に`board.units`をコピーして確保)。submitImpl(CPU戦は
    applyActionを同期実行)が内部で盤面stateを更新するため、以前は結果の`.then`で
    盤面差分(prevUnits)から攻撃前HP/位置を拾おうとしていたが、更新タイミング次第で
    盤面差分useEffectが先に走ってしまい「攻撃前の状態」が既に失われ、演出が次の
    盤面変化(CPUの次の手等)まで遅延する不具合があった。送信前に確保したスナップショット+
    `CombatResult.attackerDied/defenderDied`を使えば盤面の更新タイミングに依存しない
- **CPU練習モード**(参加待ちの間の暇つぶし。APIを一切使わない):
  - 盤面UIは `BoardScreen` に切り出し、`submit(action) => Promise<GameEvent[]>` を注入する構造。
    リモート対戦(MatchView: apiClient経由)とCPU戦(CpuMatchView: applyAction直接実行)で同じUIを共用
  - CPUの手は core-engine の `chooseCpuAction`(純粋関数)が1手ずつ決め、CpuMatchViewが
    setTimeout(600ms)で順に適用する。優先順: 昇格選択→攻撃(期待値採点)→雇用→移動(村占領・接近)→endTurn。
    移動はコスト>0の手しか返さないため必ず有限手数でターンが終わる(保険で150手超は強制endTurn)
  - 霧のマッチではCPUにも `filterStateForViewer` でフィルタした盤面を渡す(チート防止)。
    人間側の表示も同じ関数でフィルタし、リモート対戦と同じ見え方にする
  - 待機画面のポーリング(useQuery)はCPU戦中も継続し、相手が参加したらバナー→「対戦を開始」で
    本対戦へ切り替える。CPU戦の結果はどこにも保存されない
- **チュートリアルモード**(`/tutorial/[id]`。ログイン不要・ローカル完結):
  - 相手はCPU(`useLocalCpuGame` をCPU練習モードと共用)。シナリオは
    `core-engine/data/tutorials/*.json`(`TutorialScript` 型)にデータとして定義する
  - ガイドイベントのトリガーは2種: `{type:"turn", turnNumber}` =人間側の手番がそのターン以降に
    来たとき(>=判定で取りこぼし防止)、`{type:"hex", hexes:[...]}` =自軍ユニットが指定ヘックスに
    乗ったとき。発火判定は `tutorial.ts firedGuides`(純粋関数)、一度だけ表示(shownIds)と
    キュー(同時発火は1枚ずつOKで送る)はTutorialMatchViewが管理
  - ガイドは `highlightHexes` で盤面のヘックスを金色破線でハイライトできる
    (BoardScreen `guideHexes` → HexGrid)。ガイドカードはBoardScreenの `overlay` propで重ねる
  - シナリオ追加はJSONを書いて `data/tutorials.ts` の registry に登録するだけ
    (ロード時にマップ・陣営・ヘックス範囲を検証。ロビーの一覧は registry から自動生成)

## 7. ハマりどころ・既知の制約

| 事項 | 内容 |
|---|---|
| env は遅延読み | backendの`env.ts`/`dynamo.ts`は呼び出し時にprocess.envを読む。devプロキシがimport後に`DYNAMODB_ENDPOINT`を注入するため、モジュールトップで読むと壊れる |
| テーブル定義は2箇所 | CDKとcreate-local-tables.tsの乖離は実行時まで発覚しない。変更時は両方+READMEを更新 |
| DynamoDB Localは`-inMemory` | コンテナ再起動でテーブル消失。`dev:db:init`は冪等なので再実行すればよい |
| 相打ちは発生しない | resolveCombatはHP0で即終了するため、リーダー同士の相打ちによる勝者未定は構造上起きない |
| ポーリング10秒 | 「あなたの番です」通知はWeb Push未実装。MatchViewのrefetchIntervalが唯一の更新経路 |
| E2Eの数値検証は特性で揺れる | リーダー・雇用ユニットにはランダム特性が付くため、移動力・HPの固定値アサートは書けない。`maxMoves`/`maxHp`との相対値で検証する |
| 未実装のWesnothルール | 石化spec(能力は単純に保つ方針のため不採用の可能性が高い)、Web Push通知。データ型に入れる場合は`types.ts`→エンジン→(必要なら)UIの順で(レベルアップ・霧・散兵・伏兵・遅化は実装済み) |
| cSpell警告 | エディタの"Parle"/"Wesnoth"等のUnknown word警告はプロジェクト固有名詞。無害 |

## 8. 変更時の検証手順

```powershell
npm run test -w @parle-stroika/core-engine   # ルール変更: まずここ(93テスト)
npm run typecheck                            # 全ワークスペース
npm run build                                # フロント本番ビルド
npm run cdk:synth                            # インフラ変更時
# 統合E2E(DynamoDB Local必要): docs/local_dev_guide.md セクション2〜4
```

フェーズ1のE2E実績(2026-07-02): マッチ作成→参加→雇用→冪等性→移動→手番ガード→
ターン交代→認可→降参→終了ガードの15項目パス。UIはロビー/盤面SSRの疎通まで確認済み、
ブラウザ実操作での網羅チェックリストは手順書セクション4。
