// 時間帯の見た目(skybox選択+盤面のfilter/色被せ)。
// 本番盤面(BoardScreen)と検収ページ(/dev/terrain)が同じ値を共有する —
// 検収ページに古い値が残ると「検収と本番で見え方が違う」事故になるため一元化
// (2026-07-08リファクタ。それまでdemo側に旧値=夜brightness0.62が残っていた)
//
// 明るさの方針(2026-07-08): 「夜が暗すぎる」— 盤面は常にプレイに支障のない
// 明るさを保ち、時間帯はskyboxの絵と色被せ(overlay)で語る。
// 夜の明るさは旧昼(≒無加工)近くまで持ち上げ、青被せ主体で夜と分からせる。
// 朝・昼にも薄い暖色を入れ、1日の巡りが地面の色温度でも読めるようにする。
// 未定義の時間帯=昼(skybox: day・無加工)
export interface TimeOfDayFx {
  skybox: "day" | "dusk" | "night";
  filter?: string;
  overlay?: string;
}

export const TOD_FX: Record<string, TimeOfDayFx> = {
  dawn: { skybox: "dusk", overlay: "rgba(224,140,60,0.08)" },
  morning: { skybox: "day", overlay: "rgba(255,214,140,0.05)" },
  afternoon: { skybox: "day", overlay: "rgba(255,190,110,0.07)" },
  dusk: { skybox: "dusk", filter: "brightness(0.97)", overlay: "rgba(224,140,60,0.16)" },
  first_watch: { skybox: "night", filter: "brightness(0.92) saturate(0.9)", overlay: "rgba(50,70,140,0.2)" },
  second_watch: { skybox: "night", filter: "brightness(0.88) saturate(0.85)", overlay: "rgba(50,70,140,0.24)" },
};
