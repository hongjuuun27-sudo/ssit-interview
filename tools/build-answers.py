#!/usr/bin/env python3
"""ppt-answers.md 를 파싱해 js/answers-data.js 를 생성합니다.

문구는 한 글자도 바꾸지 않습니다. 파싱 결과로 md 를 다시 조립해
원본과 바이트 단위로 같은지 확인하고, 다르면 실패합니다.
답변 수는 ppt-slides.md 의 장 수와 같아야 합니다 (N번 질문: ↔ N장).

사용법: python3 tools/build-answers.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ppt-answers.md"
SLIDES = ROOT / "ppt-slides.md"
OUT = ROOT / "js" / "answers-data.js"


def parse(text):
    doc = {"title": "", "answers": []}
    ans = None
    for line in text.split("\n"):
        if not line:
            continue
        if line.startswith("# "):
            doc["title"] = line[2:]
        elif line.startswith("## "):
            ans = {"title": line[3:], "paragraphs": []}
            doc["answers"].append(ans)
        elif ans is not None:
            ans["paragraphs"].append(line)
        else:
            raise SystemExit(f"알 수 없는 줄: {line!r}")
    return doc


def rebuild(doc):
    parts = ["# " + doc["title"]]
    for a in doc["answers"]:
        parts.append("\n".join(["## " + a["title"]] + a["paragraphs"]))
    return "\n\n".join(parts) + "\n"


def main():
    text = SRC.read_text(encoding="utf-8")
    doc = parse(text)
    if rebuild(doc) != text:
        raise SystemExit("원문과 파싱 결과가 다릅니다. 변환을 중단합니다.")
    for i, a in enumerate(doc["answers"], 1):
        if not a["title"].startswith(f"{i}번 질문:"):
            raise SystemExit(f"{i}번째 제목이 '{i}번 질문:'으로 시작하지 않습니다: {a['title']!r}")
    n_slides = len(re.findall(r"^## ", SLIDES.read_text(encoding="utf-8"), re.M))
    if len(doc["answers"]) != n_slides:
        raise SystemExit(f"답변 {len(doc['answers'])}개 ≠ 슬라이드 {n_slides}장")
    payload = json.dumps(doc, ensure_ascii=False, indent=1)
    OUT.write_text(
        "// 자동 생성 파일 — tools/build-answers.py 로 다시 만드세요. 직접 수정하지 마세요.\n"
        f"window.ANSWERS_DATA = {payload};\n",
        encoding="utf-8",
    )
    print(f"답변 {len(doc['answers'])}개 (원문 일치 확인) → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
