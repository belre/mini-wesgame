"use client";

// TutorialMatchView(ひいてはuseLocalCpuGame)は雇用・盤面ともに毎回ランダム(id発行・
// 特性抽選)な初期状態をuseStateの遅延初期化で1度だけ作る想定だが、Next.jsのSSRはこの
// 初期化をサーバー側でも1回実行してHTMLに焼き込む。クライアントのhydrationで同じ
// コンポーネントがもう一度マウントされると初期化がもう一度走り、サーバーとは別の
// 乱数(ユニットid等)になってReactのhydration mismatchを起こす(2026-07-08発覚)。
// チュートリアルはAPIなし・保存なしのその場限りの対局でSSRの恩恵(SEO等)が無いため、
// このコンポーネントだけSSRを止めてクライアント専用マウントにする(dynamic importは
// ssr:falseをServer Componentから直接使えないため、この薄いClient Componentを挟む)
import dynamic from "next/dynamic";

const TutorialMatchView = dynamic(() => import("./TutorialMatchView"), {
  ssr: false,
});

export default TutorialMatchView;
