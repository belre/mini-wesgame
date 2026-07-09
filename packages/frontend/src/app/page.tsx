"use client";

// mini-wesgame: トップページ=即CPU戦(ロビー・ログインなし。2026-07-08 移植方針)。
// 対局の初期状態は乱数(特性抽選)を含むため、SSRするとサーバーとクライアントで
// 盤面が食い違いhydrationエラーになる → クライアント専用でマウントする
import dynamic from "next/dynamic";

const MiniGame = dynamic(() => import("@/components/MiniGame"), { ssr: false });

export default function HomePage() {
  return <MiniGame />;
}
