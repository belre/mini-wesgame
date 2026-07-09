# アセット・アニメ定義監査レポート(2026-07-06 夜間バッチ)

機械監査(FACTIONS×UNIT_SPRITESの突き合わせ / fetch対象×定義参照の突き合わせ)の結果。
補完済みの項目はコミット c4a8b83 参照。ここには「残った項目と、その理由・推奨」を記録する。

## 攻撃アニメ: 残存項目(いずれも本家に素材が無く、対応不能または現状が正)

| 項目 | 状態 | 理由 |
|---|---|---|
| drake_buster spear | 未定義(汎用ランジで再生) | spriteKey=drake_arbiterにspear系フレームが存在しない |
| merman_triton sword/trident | 基本画像のみ | 本家tritonに攻撃フレームなし |
| rogue dagger/thrown_knife | 基本画像のみ | 本家rogueに専用フレームなし(WMLも基本画像) |
| elvish_outrider bow | 基本画像のみ | 本家に弓フレームなし(WMLも基本画像) |
| elvish_sylph staff/magic | 基本画像のみ | 本家faerie touchはsylph.png:400のみ |
| sylph/vampire_bat/bloodbat/ghost defend | 被弾リアクションなし | 本家にdefend画像なし |

## fetch済みだが未参照のファイル(23件)

**削除候補(完全に死んでいる):**
- `deathknight/` 一式 — ロースターに存在しないユニット(過去の取得残り)
- `vampire_bat/bat-ne-*` `dread_bat/dreadbat-ne-*` — se版に置き換え済み。
  方向系は不採用方針(2026-07-05)のためne版は使い道がない

**保持推奨(将来使う可能性・セット完全性):**
- 各種defendバリアント(spearman-defend, fencer-defend-1-2, *-bow-defend等)
  — 第2リアクションや構え別リアクションを導入するとき用
- `halo/holy-halo2/4` — halo1〜6セットのうちWMLが[6,1,3,5,6]しか使わない分
- `orcish_crossbow/xbowman-melee.png` `xbowman-defend.png` — 近接構え・遠隔被弾の代替

## 使い方

再監査はこのパターンで実行できる(恒久スクリプト化はしていない):
FACTIONSの全unit.attacks[].idについて `UNIT_SPRITES[spriteKey].attacks[id]` の
有無・フレーム内容を検査する一時テストを test/ に置いて `npm run test -w frontend`。
参照整合(定義→fetch方向)は test/spriteAssets.test.ts が常時CIで保証している。
