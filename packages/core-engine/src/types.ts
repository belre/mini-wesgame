// 共有コアエンジンの型定義。
// クライアント(プレビュー)とサーバー(権威検証)の両方から利用される。
// 描画に関する情報は spriteKey / assetPackUrl の参照キーのみで、描画ロジックは一切持たない。

export type DamageType = "blade" | "pierce" | "impact" | "fire" | "cold" | "arcane";
export type Alignment = "lawful" | "neutral" | "chaotic";
export type MovementType = "walk" | "fly" | "swim";
// 地形の防御率決定に使うタイプ。移動タイプと別に指定できる(例: 騎馬は walk で移動するが防御は cavalry で参照)。
// lightfoot(軽装。本家elusivefoot準拠 2026-07-08): 沼地・浅瀬・洞窟等が速く、大半の地形で歩兵より堅い。
// 岩場(mountains)も進入できる(walk型は不可の壁だが、軽装ユニットは例外的に越えられる)
export type DefenseType = MovementType | "cavalry" | "lightfoot";
export type TimeOfDayId =
  | "dawn"
  | "morning"
  | "afternoon"
  | "dusk"
  | "first_watch"
  | "second_watch";

// odd-q オフセット座標(フラットトップのヘックスを列単位で下にずらす配置)
export interface HexCoord {
  x: number; // 列
  y: number; // 行
}

// 特性(個性系)。雇用時にランダム付与され、ユニット個体に固定される
export type TraitId =
  | "strong" // 強力: 近接ダメージ+1、最大HP+1
  | "intelligent" // 知的: 必要XP-20%(レベルアップ実装後に効果発現)
  | "quick" // 敏捷: 移動力+1、最大HP-5%
  | "resilient" // 頑強: 最大HP+4+レベル
  | "dextrous" // 器用: 遠隔ダメージ+1(反乱軍のエルフのみ)
  | "fearless" // 勇敢: 不利な時間帯のダメージ補正を受けない(グール・トロルのみ)
  | "dim" // 凡愚: 必要XP+20%(ゴブリンのみ。レベルアップ実装後に効果発現)
  | "slow" // 鈍重: 移動力-1、最大HP+5%(ゴブリンのみ)
  | "weak" // 非力: 近接ダメージ-1、最大HP-1(ゴブリンのみ)
  | "undead" // アンデッド: 毒・疫病・生命吸収を無効化(アンデッドのみ)
  | "healthy" // 壮健: 最大HP+2、移動しても休息回復、毒ダメージ半減(ドワーフのみ)
  | "feral" // 野生: 村での防御率が50%に制限される
  | "no_zoc"; // 小物: ZOCを発しない(敵の移動を隣接で打ち切らない)。保存されず、レベル0ユニットに暗黙付与(traits.tsのeffectiveTraits)

// 能力(ユニット定義に付く常時能力。特性と違いランダムではない)
export type UnitAbility =
  | "ambush" // 伏兵: 森にいる間、敵から見えない(隣接されるか、攻撃すると見える)
  | "submerge" // 潜水: 深海にいる間、敵から見えない(同上)
  | "cures" // 治癒: ターン開始時、隣接する味方の毒を治療する
  | "heals4" // 回復+4: ターン開始時、隣接する味方を4回復する
  | "heals8" // 回復+8: ターン開始時、隣接する味方を8回復する
  | "leadership" // 統率: 隣接する味方の与えるダメージ+25%
  | "regenerates" // 再生: 毎ターン開始時に8回復(毒なら治療)
  | "skirmisher" // すり抜け(2026-07-08改名。旧「散兵」): 敵のZOCを無視して移動できる
  | "steadfast"; // 装甲: 防御時、自身の耐性(正の値のみ)が2倍(上限50%)

// 攻撃特性
export type AttackSpecial =
  | "backstab" // 奇襲: 対象を挟んで反対側に対象の敵がいるときダメージ2倍
  | "berserk" // 狂戦: どちらかが倒れるまで最大30ラウンド戦闘を続ける
  | "charge" // 突撃: 攻撃時、与ダメージも被ダメージも2倍
  | "drain" // 生命吸収: 与ダメージの半分だけ自分が回復(アンデッド特性には無効)
  | "firststrike" // 先制: 防御時でも先に攻撃する
  | "magical" // 魔法: 命中率が常に70%
  | "marksman" // 精密: 攻撃時の命中率が最低60%
  | "plague" // 疫病: 倒した相手を歩く死体として自軍に加える(アンデッド特性には無効)
  | "poison" // 毒: 命中した相手を毒状態にする(毎ターン開始時8ダメージ、村で治療)
  | "poison_sting" // 毒針: 精密+毒の複合(表示を1語にするための包装。combat.tsのhasSpecialが展開する)
  | "slow"; // 遅化: 命中した相手を鈍化状態にする(自分の攻撃ダメージ半減・移動コスト2倍。次の自ターン開始で自動解除)

export interface AttackDef {
  id: string; // 英語の安定した内部キー(スプライトアニメ選択等に使う)。表示は name を使う
  name: string; // 表示名(ローカライズ対象。現状は日本語)
  damage: number;
  count: number; // 攻撃回数
  type: DamageType;
  range: "melee" | "ranged";
  specials?: AttackSpecial[];
}

// 特性の付与ルール(ユニット定義ごと)
export interface TraitConfig {
  forced?: TraitId[]; // 必ず付く特性(例: アンデッド、野生)
  pool?: TraitId[]; // ランダム候補
  picks?: number; // poolから何個引くか(重複なし)
}

// ユニット定義(基礎属性のみ。特技・トレイト・状態異常は将来対応)
export interface UnitDef {
  id: string; // "spearman"
  name: string;
  level: number; // 1〜3(昇格は将来対応、定義だけ先に持たせる)
  hp: number;
  movement: {
    type: MovementType;
    points: number; // 1ターンの移動力
    // 地形ごとの移動コスト上書き(例: スケルトンは深海に潜れる)。99 = 進入不可
    terrainOverrides?: Record<string, number>;
  };
  abilities?: UnitAbility[]; // 常時能力(伏兵・回復・統率など)
  attacks: AttackDef[];
  resistances: Partial<Record<DamageType, number>>; // 未指定は0%扱い(正=耐性、負=弱点)
  alignment: Alignment; // 時間帯ダメージ補正に使用
  cost: number; // 雇用コスト
  spriteKey: string; // アセットパック内の画像参照キー
  traitConfig?: TraitConfig; // 未指定は特性なし(ウーズ等)
  // 必要経験値。未指定はデフォルト(レベル0: 30 / それ以外: レベル×40)。
  // 知的(-20%)・凡愚(+20%)の特性補正は maxXpFor() で適用される
  maxXp?: number;
  // レベルアップ時の昇格先ユニットID一覧。1つなら自動昇格、2つ以上はプレイヤーが選択。未指定はAMLA(最大HP+3と全回復)
  advancesTo?: string[];
  // 地形防御率の参照タイプ。未指定は movement.type を使用(騎馬ユニットは "cavalry" を指定)
  defenseType?: DefenseType;
  // 地形ごとの防御率(%)個別上書き。未指定は defenseType 経由の地形表(terrain.defenseBonus)を使う。
  // movement.terrainOverrides(移動コスト側)と対になる仕組み
  defenseOverrides?: Record<string, number>;
}

// 陣営(6パック分の1つ)
export interface Faction {
  id: string; // "loyalists" | "undead" | ...
  name: string;
  defaultLeaderUnitId: string; // マッチ開始時にkeepへ配置されるデフォルトのリーダーユニット
  availableLeaderUnitIds: string[]    // リーダーユニットで可能なユニットの一覧
  recruitableUnitIds: string[]   // 雇用可能なユニットの一覧(人間プレイヤー向け)
  // CPU操作時の雇用候補(未指定はrecruitableUnitIdsをそのまま使う)。
  // 宣伝デモとして「プレイヤーが選んだ側だけ選択肢を広く見せ、相手側(CPU)は
  // 常に同じ基本パターンで安定させる」ための絞り込み(2026-07-10)
  cpuRecruitableUnitIds?: string[]
  units: UnitDef[];
  assetPackUrl: string; // モバイル向け遅延ダウンロード先(スプライト一式)
  // 疫病(plague)でこの陣営のユニットが倒されたときに変化する死体のunitDefId。
  // 未指定は"walking_corpse"(人間の歩く死体)にフォールバックする。
  // 本家Wesnothは種族ごとに死体の見た目が変わる(オークの死体・ドレークの死体等)が、
  // 現状はそれらのユニット定義が未実装のため、対応する陣営が増えるまでは未指定のままでよい
  plagueCorpseUnitId?: string;
}

// 地形ごとの防御率・移動コスト
// 移動タイプごとのコスト差(飛行は森を無視する等)が必須だったため、
// 計画書のスキーマから moveCost を Record<MovementType, number> に拡張している。
// 2026-07-08: 騎馬(cavalry)は防御だけでなく移動コストも歩兵と異なる(本家mounted準拠。
// 森・沼地・洞窟等で歩兵より重い)ため、moveCostもDefenseType単位に拡張した
export interface TerrainDef {
  id: string; // "forest"
  name: string;
  moveCost: Record<DefenseType, number>; // 99 = 進入不可
  defenseBonus: Record<DefenseType, number>; // 移動タイプ別の防御率(%)
}

export interface TimeOfDayDef {
  id: TimeOfDayId;
  alignmentModifier: Partial<Record<Alignment, number>>; // lawful: +25, chaotic: -25 など
}

// 昼夜サイクルの定義(使い回し可能。標準サイクル/地下用サイクルなど)
export interface TimeOfDaySchedule {
  id: string; // "standard_cycle" など
  phases: {
    timeOfDay: TimeOfDayId;
    turns: number; // 何ターン続くか(1以上)
  }[];
}

// マップ定義。純粋なJSONシリアライズ可能な形を維持すること
// (将来S3等の外部ストレージへ移行する際、この形のままJSONとして配布できるようにする。
//  移行時はクライアント/サーバーのバージョン一致の保証が必要 → docs/architecture.md参照)
export interface GameMap {
  id: string;
  name: string;
  description?: string; // マッチ作成画面などに表示する補足説明
  width: number;
  height: number;
  // 1行=1文字列。文字→地形の対応は data/terrain.ts の TERRAIN_BY_CHAR 参照
  tiles: string[];
}

// ---- チュートリアル ----
// マップと同様に純粋なJSONシリアライズ可能な形を維持すること(data/tutorials/*.json)。
// ガイドの発火判定は tutorial.ts の純粋関数で行い、表示はクライアントが担う

// ガイドイベントの発火条件
export type GuideTrigger =
  | { type: "turn"; turnNumber: number } // 自分(人間側)の手番がこのターン番号以降に来たとき
  | { type: "hex"; hexes: HexCoord[] }; // 自軍ユニットがいずれかのヘックス上にいるとき

export interface TutorialGuide {
  id: string; // スクリプト内で一意。表示済み管理(一度だけ表示)に使う
  trigger: GuideTrigger;
  title?: string;
  text: string; // ガイド本文
  highlightHexes?: HexCoord[]; // ガイド表示中に盤面でハイライトするヘックス(任意)
}

// チュートリアルのシナリオ定義。対戦相手はCPU(ai.ts)で、進行はローカル完結(保存なし)
export interface TutorialScript {
  id: string;
  name: string;
  description?: string;
  mapId: string;
  playerFactionId: string; // 人間側(プレイヤーindex 0)
  playerLeaderUnitId?: string; // 未指定は陣営デフォルト
  cpuFactionId: string; // CPU側(プレイヤーindex 1)
  fog?: boolean;
  guides: TutorialGuide[];
}

// ---- マッチの実行時状態 ----

export interface UnitState {
  id: string; // uuid
  unitDefId: string;
  owner: number; // プレイヤーindex (0|1)
  pos: HexCoord;
  hp: number;
  maxHp: number; // 特性補正込みの最大HP(雇用時に確定)
  movesLeft: number;
  maxMoves: number; // 特性補正込みの移動力(雇用時に確定)
  attacksLeft: number;
  isLeader: boolean;
  traits: TraitId[]; // 雇用時にランダム付与
  poisoned: boolean;
  slowed?: boolean; // 遅化。次の自ターン開始で自動解除(既存データとの互換のためoptional)
  xp: number; // 経験値。maxXpFor(def, traits) に達するとレベルアップ
}

export interface PlayerState {
  userId: string;
  factionId: string;
  gold: number;
  // 雇用可能ユニットの上書き(任意)。未指定は陣営のrecruitableUnitIds(モード制限用)
  recruitUnitIds?: string[];
  // このターン中に雇用を行ったか(次の自ターン開始でfalseに戻る)。
  // 雇用はリーダーの移動力・攻撃回数を消費しないが、プレイヤーの意思決定としては
  // 「行動した」ことに変わりない。終了ターン確認の未行動判定で使う(2026-07-12)
  hasRecruitedThisTurn: boolean;
}

export type MatchStatus = "active" | "finished";

export interface MatchState {
  mapId: string;
  scheduleId: string;
  startIndex: number; // 昼夜サイクルの開始位置
  turnNumber: number; // 1始まり。両者が行動を終えると+1
  activePlayer: number; // 0|1
  players: PlayerState[];
  units: UnitState[];
  villageOwners: Record<string, number>; // hexKey -> 領有プレイヤーindex
  fogEnabled: boolean; // 霧(FOG): 自軍ユニットの視界外の敵情報を隠す
  pendingPromotion: Array<{ unitId: string; choices: string[] }>; // 昇格先選択待ち(2つ以上の選択肢がある場合)
  status: MatchStatus;
  winner?: number | null; // finished時のみ意味を持つ。nullは引き分け(maxTurns到達)
  turnVersion: number; // 楽観的ロック用。アクション適用ごとに+1
  maxTurns?: number; // 最長ターン数(任意)。turnNumberがこれを超えたら引き分けで終了
}

// ---- アクション ----
// 移動はクライアントから target hex のみ送信し、path はサーバー側で再計算・検証する

export type Action =
  | { type: "move"; unitId: string; target: HexCoord }
  | { type: "attack"; attackerId: string; defenderId: string; attackIndex: number }
  | { type: "recruit"; unitDefId: string; target: HexCoord }
  | { type: "chooseLevelUp"; unitId: string; targetDefId: string }
  | { type: "endTurn" }
  | { type: "surrender" };

// 乱数は注入可能にする(サーバーはcrypto、テストは固定値)
export type Rng = () => number; // [0, 1)
