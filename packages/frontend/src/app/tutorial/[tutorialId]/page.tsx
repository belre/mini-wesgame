import { notFound } from "next/navigation";
import { TUTORIALS } from "@parle-stroika/core-engine";
import TutorialMatchView from "@/components/TutorialMatchViewLazy";

// チュートリアルはローカル完結(APIなし・保存なし)なのでログイン不要。
// シナリオデータはcore-engineにバンドルされたJSONをそのままClient Componentへ渡す

// output:"export"(itch.io配布用の静的書き出し)は動的ルートの全パスを
// ビルド時に列挙する必要がある。TUTORIALSはビルド時に確定した静的レジストリなので、
// ここで全キーを返すだけでよい
export function generateStaticParams() {
  return Object.keys(TUTORIALS).map((tutorialId) => ({ tutorialId }));
}

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  const { tutorialId } = await params;
  const tutorial = TUTORIALS[tutorialId];
  if (!tutorial) notFound();
  return <TutorialMatchView tutorial={tutorial} />;
}
