// アニメーションモデル層: Wesnoth AnimationWMLサブセットの「定義の形」。
//
// この層の規律(core-engineと同じ思想):
// - React/DOM/描画バックエンドに依存しない純粋な型と定数のみ
// - コンテンツ(UNIT_SPRITESなどの定義表)はこの型に従う「データ」であり、
//   プロジェクト・バージョンごとに差し替え可能(SpriteRegistryインターフェース経由で注入)
// - 時間解決(定義+時刻→表示状態)は resolve.ts、戦闘の再生は combatTimeline.ts

export interface WmlFrame {
  image: string;
  duration: number; // ms
  overlay?: string; // ~BLIT(...)相当: 同位置に重ね描きする画像(攻撃エフェクト等)
}

// 区間補間の1区間。攻撃の踏み込み(0=自ヘックス中心、1=相手ヘックス中心)や
// 飛び道具の進行・高さカーブに使う
export interface OffsetSeg {
  from: number;
  to: number;
  duration: number; // ms
}

// 飛び道具(遠隔攻撃の[missile_frame]サブセット)。
// startTime+durationが命中の瞬間(t=0)に一致するように定義する。
// - image: 静止画1枚(矢・槍など)。進行方向に回転して描画される
// - frames: アニメする飛び道具(魔法弾など)。ループ再生され、回転しない(imageと排他)
// - offset: 進行方向の位置カーブ(0=攻撃側→1=防御側)。省略時は0→1の直線移動。
//   負値=攻撃側の後方(魔法弾の「引き込み」の表現)も許す
// - offsetY: 高さカーブ(px。Wesnothの72pxヘックス=盤面のヘックス幅2Sと1:1。負=上)。省略時は0
// - size: 描画サイズ(px、同じく72pxヘックス基準)。省略時は72=原寸
//   (矢・槍・ナイフ等の標準投射は72x72キャンバスに描かれておりWesnothは原寸で描画する。
//   縮小すると矢先の炎などのディテールが潰れる)
// - rotate: 進行方向へ回転するか。省略時は image=回転(矢) / frames=無回転(光球)。
//   北向きに描かれた弾がframesを持つ場合(氷弾など)は明示的にtrueにする
export interface MissileDef {
  startTime: number;
  duration: number;
  image?: string;
  frames?: WmlFrame[];
  offset?: OffsetSeg[];
  offsetY?: OffsetSeg[];
  size?: number;
  rotate?: boolean;
}

export const MISSILE_DEFAULT_SIZE = 72;

// 並行再生トラック(WMLの[halo_frame]/[*_frame]相当)。
// ユニット本体のフレーム列・飛び道具と同時に、独立したstartTime・フレーム周期で
// 再生される追加レイヤー。詠唱halo・杖先フレア・多層の弾などを表現する。
// - anchor "unit": 行動ユニットの位置に重ねる(offsetX/offsetYはpx単位の位置カーブ)
// - anchor "path": 攻撃側→防御側の座標系(offsetは進行率カーブ。missileと同じ)
export interface AnimTrack {
  startTime: number;
  frames: WmlFrame[];
  loop?: boolean; // trueなら区間中フレームをループ(missileのframesと同じ挙動)
  duration?: number; // 再生区間の長さ(ms)。省略時はフレーム合計(loop時は指定推奨)
  anchor: "unit" | "path";
  offset?: OffsetSeg[]; // path: 進行率(0=攻撃側,1=防御側)。unit: 使わない
  offsetX?: OffsetSeg[]; // 横位置(px、72pxヘックス基準。正=進行方向/右)
  offsetY?: OffsetSeg[]; // 縦位置(px。負=上)
  size?: number; // 描画サイズ(px)。省略時は原寸キャッシュ(imageNaturalSize)に任せる
  rotate?: boolean; // pathのみ: 進行方向へ回転(既定false)
}

// 攻撃アニメ([attack_anim]サブセット)。時刻0=打撃の瞬間、startTimeは負値
// (打撃の何ms前から再生を始めるか)。検証は /dev/sprites 参照
export interface AttackAnimDef {
  startTime: number;
  offset?: OffsetSeg[]; // 踏み込み。省略時は攻撃側で解決(近接=汎用ランジ/遠隔=据え置き)
  frames: WmlFrame[];
  missile?: MissileDef; // 遠隔攻撃の飛び道具
  // 追加レイヤー(詠唱halo・杖先フレアなど)。frames/missileと同時に再生される
  extraTracks?: AnimTrack[];
}

// standingに重ねる常時ループのレイヤー(pillagerの松明の炎など)。
// 本体のstandingとは独立した周期で回る(フレーム境界が揃わなくてもよい)
export interface StandingOverlay {
  frames: WmlFrame[];
}

export interface UnitSpriteDef {
  base: string; // 静止画(アニメ停止時・フォールバック元)
  standing: WmlFrame[]; // 常時ループ
  standingOverlays?: StandingOverlay[]; // standingに重ねる独立周期のループレイヤー
  idle?: WmlFrame[]; // ランダム間隔で1回再生する仕草(省略可)
  // 攻撃id(UnitDefのAttackDef.id。例: "spear"/"javelin")ごとのアニメ定義。
  // 未登録の攻撃idは汎用ランジ(踏み込みのみ、飛び道具なし)にフォールバックする
  attacks?: Record<string, AttackAnimDef>;
  defend?: { reaction: string }; // 被弾の瞬間のリアクション。未定義はリアクションなし
}

// 地形の立体物(ジオラマPhase B。docs/design_diorama.md「森の中」の解)。
// 地面タイルに焼き込まず、ユニットと同じ深度ソートに参加するビルボードとして
// 描画することで本物の遮蔽(奥の木は背後、手前の木は足元を隠す)を作る
export interface TerrainObjectDef {
  // バリアント画像(2〜3枚。全ヘックス同じ絵になる単調さの回避)。
  // どれを使うかはヘックス座標から決定的に選ぶ(描画のたびに変わらない)
  srcs: readonly string[];
  // 占有ヘックスのユニットを隠すとき可読性フェード(60〜70%透過)の対象にするか。
  // 森=true(伏兵地形のフレーバーと噛み合う)、単なる装飾の小物は false
  occludes?: boolean;
  // ヘックス内の固定配置(ヘックス外接円半径Sを1とする単位。例: dx:-0.4=左寄せ)。
  // 複数エントリを別オフセットで並べると疎林・片寄せ・多体置きが組める。
  // 各エントリは独立に深度ソートへ参加する(奥の木は背後、手前の木は足元を隠す)
  offset?: { dx: number; dy: number };
  // ハッシュ駆動の位置ゆらぎ幅(同単位)。ヘックスごとに決定的にずれて整列感を消す
  jitter?: { dx: number; dy: number };
  // ヘックス座標ハッシュで左右反転する(1枚の素材から実質2バリアント。
  // 光源方向が水平反転しても違和感の少ない素材=茂み等に向く)
  mirror?: boolean;
  // 可読性フェードの発動条件(occludes=trueのとき有効。2026-07-07 実地検証):
  //  always(既定) = 常時。大きな塊はユニットが隠れ切るため
  //  never = フェードしない
  fadeMode?: "always" | "never";
  // 陣営でバリアントを選ぶ(2026-07-08 旗の色分け)。true のとき srcs は
  // [プレイヤー0用, プレイヤー1用] とみなし、座標ハッシュではなくヘックスの
  // 帰属(keepの走査順割当=エンジンの初期化規則と同一。レンダラー側で解決)で選ぶ
  ownerVariant?: boolean;
  // 同地形の隣接ヘックスの重心方向へ寄せる距離(S単位。2026-07-08 縁ロジック本番昇格)。
  // 森の端で木を森側へ「片寄せ」し、群れが繋がって見えるようにする。
  // 方向はレンダラーがマップから自動計算する(同地形の隣がなければ寄らない)
  clusterPull?: number;
}

// 地形スプライト定義: 地面(傾きに追従するタイル)と立体物(ビルボード)の分離。
// AI生成タイルセットの発注規約(design_diorama.md)と1:1で対応する
export interface TerrainSpriteDef {
  // 下から順に重ね描き。森=草原+下草 等。
  // 各レイヤーは単一URLか「バリアントURL配列」(ヘックス座標ハッシュで決定的に選択。
  // 丘のような起伏焼き込みタイルの繰り返し感を消すために使う)
  ground: readonly (string | readonly string[])[];
  // 立体物。既定は「境界ヘックス」用(同地形と異地形の両方に接するとき)。
  // interiorObjects があれば「内側(全隣接が同地形)」と「孤立(同地形の隣なし)」で
  // そちらを使う — 内側は密に、孤立は一目で地形と分かる強い絵に、境界は片寄せに、
  // という縁ロジック(2026-07-08 本番昇格。選択規則は lib/board/objects.ts pickTerrainObjects)
  objects?: readonly TerrainObjectDef[];
  interiorObjects?: readonly TerrainObjectDef[];
  // 地形遷移のくさびオーバーレイ(Wesnoth式の簡易版)。
  // 「隣接ヘックスがこの地形と異なる辺」にだけ、srcを60度回転で重ねる。
  // 例: 丘→縁が草へフェード(丘同士の辺は重ねない=高地が連続する)。
  // excludeNeighbors: この地形が隣でもくさびを塗らない(2026-07-08:
  // 浅瀬→深水の辺に砂浜くさびが回ると水の中に砂が出て不自然。
  // 深水側の浅瀬色くさびだけで境界を繋ぐ)。
  // byNeighbor: 隣接地形ごとにくさび素材を差し替える(2026-07-08:
  // 砂丘→浅瀬の辺が草色では不自然 → 浅瀬色のくさびに)
  edgeTransition?: {
    src: string;
    excludeNeighbors?: readonly string[];
    byNeighbor?: Readonly<Record<string, string>>;
  };
}

// スプライト定義の解決インターフェース。
// コンテンツパック(UNIT_SPRITES等の定義表)はこの形で提供され、
// 再生・描画側は具体的な定義表に依存しない(キャンペーン版・別バージョンで差し替え可能)
export interface SpriteRegistry {
  getUnitSprite(spriteKey: string): UnitSpriteDef | undefined;
  getTerrainSprite(terrainId: string): TerrainSpriteDef | undefined;
}
