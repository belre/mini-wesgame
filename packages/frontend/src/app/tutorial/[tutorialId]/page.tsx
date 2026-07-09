import { notFound } from "next/navigation";
import { TUTORIALS } from "@parle-stroika/core-engine";
import TutorialMatchView from "@/components/TutorialMatchViewLazy";

// チュートリアルはローカル完結(APIなし・保存なし)なのでログイン不要。
// シナリオデータはcore-engineにバンドルされたJSONをそのままClient Componentへ渡す
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
