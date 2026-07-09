#!/usr/bin/env python3
"""
scan_sprite_licenses.py

sprites/ 以下(サブフォルダ含む)のPNG/WEBP/JPEG画像を再帰的に走査し、
EXIFの Artist / Copyright / UserComment タグを抽出して、
ライセンス判定つきのCSVレポートを出力するスクリプト。

Wesnothプロジェクトは各画像のEXIFタグに以下を埋め込む方式に移行済み:
  - Artist       : 作者名 (旧 copyrights.csv の "Author" 相当)
  - Copyright    : ライセンス ("GNU GPL v2+" または "CC BY-SA 4.0")
  - UserComment  : 備考 (旧 copyrights.csv の "Notes" 相当)

使い方:
    python3 scan_sprite_licenses.py [対象ディレクトリ] [出力CSVパス]

    # 例: wesnothリポジトリをクローンした上で
    python3 scan_sprite_licenses.py /path/to/wesnoth/data/core/images/units report.csv

必要なもの:
    exiftool が PATH 上にあること
        Ubuntu/Debian : sudo apt-get install libimage-exiftool-perl
        macOS (brew)  : brew install exiftool
        Windows       : https://exiftool.org/ からダウンロード
"""

import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path

# Wesnothプロジェクトが公式に受け入れているライセンス表記
# (Issue #8863 でのCI実装の記述に基づく)
ACCEPTED_LICENSES = [
    "GNU GPL v2+",
    "GNU GPL v2 or later",
    "GPL v2+",
    "GPLv2+",
    "CC BY-SA 4.0",
    "CC-BY-SA 4.0",
    "Creative Commons Attribution-ShareAlike 4.0",
]

IMAGE_EXTENSIONS = {".png", ".webp", ".jpg", ".jpeg"}


def check_exiftool() -> None:
    if shutil.which("exiftool") is None:
        sys.exit(
            "エラー: exiftool が見つかりません。先にインストールしてください。\n"
            "  Ubuntu/Debian : sudo apt-get install libimage-exiftool-perl\n"
            "  macOS (brew)  : brew install exiftool\n"
            "  Windows       : https://exiftool.org/"
        )


def find_images(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*") if p.suffix.lower() in IMAGE_EXTENSIONS)


def read_metadata_batch(paths: list[Path], batch_size: int = 200) -> dict[str, dict]:
    """exiftoolをバッチ実行してJSONでメタデータを取得する。
    (コマンドライン長制限を避けるため一定件数ごとに分割)
    """
    results: dict[str, dict] = {}
    total = len(paths)
    for i in range(0, total, batch_size):
        batch = paths[i : i + batch_size]
        cmd = [
            "exiftool",
            "-j",  # JSON出力
            "-Artist",
            "-Copyright",
            "-UserComment",
            "-charset", "utf8",
        ] + [str(p) for p in batch]

        try:
            out = subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            print(f"[警告] exiftool実行失敗 (先頭: {batch[0]}): {e.stderr}", file=sys.stderr)
            continue

        try:
            entries = json.loads(out.stdout)
        except json.JSONDecodeError:
            print(f"[警告] JSON解析失敗 (先頭: {batch[0]})", file=sys.stderr)
            continue

        for entry in entries:
            src = entry.get("SourceFile")
            if src:
                results[src] = entry

        print(f"  ...{min(i + batch_size, total)}/{total} 件処理済み", file=sys.stderr)

    return results


def classify_license(copyright_value: str) -> str:
    if not copyright_value:
        return "MISSING"
    low = copyright_value.lower()
    for accepted in ACCEPTED_LICENSES:
        if accepted.lower() in low:
            return "OK"
    return "UNRECOGNIZED"


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("sprites")
    out_csv = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("sprite_license_report.csv")

    if not root.exists():
        sys.exit(f"エラー: ディレクトリが見つかりません: {root}")

    check_exiftool()

    images = find_images(root)
    print(f"{root} 以下で {len(images)} 件の画像ファイルを検出しました。", file=sys.stderr)

    if not images:
        sys.exit("対象画像が見つかりませんでした。パスを確認してください。")

    metadata = read_metadata_batch(images)

    rows = []
    counts = {"OK": 0, "MISSING": 0, "UNRECOGNIZED": 0}

    for img in images:
        entry = metadata.get(str(img), {})
        artist = entry.get("Artist", "")
        copyright_ = entry.get("Copyright", "")
        comment = entry.get("UserComment", "")
        status = classify_license(copyright_)
        counts[status] += 1

        rows.append(
            {
                "path": str(img.relative_to(root)),
                "artist": artist,
                "copyright": copyright_,
                "comment": comment,
                "status": status,
            }
        )

    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["path", "artist", "copyright", "comment", "status"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print("\n=== サマリー ===")
    print(f"画像総数           : {len(rows)}")
    print(f"  ライセンスOK      : {counts['OK']}")
    print(f"  メタデータ欠落    : {counts['MISSING']}  <- 要目視確認(旧GPLv2素材の可能性大)")
    print(f"  未知のライセンス値 : {counts['UNRECOGNIZED']}  <- 要目視確認")
    print(f"\nレポート出力先: {out_csv}")

    if counts["MISSING"] or counts["UNRECOGNIZED"]:
        print(
            "\n⚠ MISSING/UNRECOGNIZED の画像はEXIFに手がかりがないため、"
            "コミット履歴 (git log --follow) や旧 copyrights.csv、"
            "フォーラムの Art Contributions での一次情報確認が必要です。"
        )


if __name__ == "__main__":
    main()