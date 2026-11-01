#!/usr/bin/env python3
"""ppt-slides.md 를 파싱해 js/slides-data.js 를 생성합니다.

문구는 한 글자도 바꾸지 않습니다. 파싱 결과로 md 를 다시 조립해
원본과 줄 단위로 같은지 확인하고, 다르면 실패합니다.

사용법: python3 tools/build-slides.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ppt-slides.md"
OUT = ROOT / "js" / "slides-data.js"


def parse(text):
    doc = {"title": "", "note": "", "slides": []}
    slide = sec = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("# "):
            doc["title"] = line[2:]
        elif line.startswith("## "):
            slide = {"title": line[3:], "sections": []}
            doc["slides"].append(slide)
        elif line.startswith("### "):
            sec = {"title": line[4:], "items": []}
            slide["sections"].append(sec)
        elif line.startswith("- "):
            sec["items"].append(line[2:])
        elif slide is None:
            doc["note"] = line
        else:
            raise SystemExit(f"알 수 없는 줄: {line!r}")
    return doc


def rebuild(doc):
    out = ["# " + doc["title"], doc["note"]]
    for s in doc["slides"]:
        out.append("## " + s["title"])
        for sec in s["sections"]:
            out.append("### " + sec["title"])
            out += ["- " + i for i in sec["items"]]
    return out


def main():
    text = SRC.read_text(encoding="utf-8")
    doc = parse(text)
    original = [l.rstrip() for l in text.splitlines() if l.strip()]
    if rebuild(doc) != original:
        raise SystemExit("원문과 파싱 결과가 다릅니다. 변환을 중단합니다.")
    payload = json.dumps(doc, ensure_ascii=False, indent=1)
    OUT.write_text(
        "// 자동 생성 파일 — tools/build-slides.py 로 다시 만드세요. 직접 수정하지 마세요.\n"
        f"window.SLIDES_DATA = {payload};\n",
        encoding="utf-8",
    )
    n = sum(len(sec["items"]) for s in doc["slides"] for sec in s["sections"])
    print(f"{len(doc['slides'])}장, bullet {n}개 (원문 일치 확인) → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
