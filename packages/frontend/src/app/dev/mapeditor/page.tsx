import MapEditor from "@/components/MapEditor";

// 簡易マップエディタ(開発用)。クリックで塗り、JSONで入出力。
// 保存物は core-engine/src/data/maps/ に置いて maps.ts で登録すると本番マップになる
export default function MapEditorPage() {
  return <MapEditor />;
}
