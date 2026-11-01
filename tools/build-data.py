#!/usr/bin/env python3
"""interview-qa.md 를 파싱해 js/data.js 를 생성합니다.

사용법: python3 tools/build-data.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "interview-qa.md"
OUT = ROOT / "js" / "data.js"

CH_RE = re.compile(r"^##\s+(\d+)\.\s+(.+?)\s*$")
Q_RE = re.compile(r"^\*\*Q\.\s*(.+?)\*\*\s*(.*)$")
CHECK = "[본인 확인]"


def parse(text):
    chapters = []
    cur_ch = None
    cur_q = None

    def flush():
        nonlocal cur_q
        if cur_q is not None:
            cur_q["a"] = "\n".join(cur_q.pop("_lines")).strip()
            cur_ch["questions"].append(cur_q)
            cur_q = None

    for raw in text.splitlines():
        line = raw.rstrip()
        m = CH_RE.match(line)
        if m:
            flush()
            cur_ch = {"no": int(m.group(1)), "title": m.group(2), "questions": []}
            chapters.append(cur_ch)
            continue
        m = Q_RE.match(line)
        if m and cur_ch is not None:
            flush()
            q, rest = m.group(1).strip(), m.group(2).strip()
            needs_check = CHECK in rest or CHECK in q
            q = q.replace(CHECK, "").strip()
            rest = rest.replace(CHECK, "").strip()
            # "**Q. ...** — 메모" 처럼 같은 줄에 붙은 메모는 답변으로 취급
            rest = re.sub(r"^[—–-]\s*", "", rest)
            idx = len(cur_ch["questions"]) + 1
            cur_q = {
                "id": f"{cur_ch['no']}-{idx}",
                "q": q,
                "check": needs_check,
                "_lines": [rest] if rest else [],
            }
            continue
        if line.strip() == "---":
            flush()
            continue
        if cur_q is not None:
            cur_q["_lines"].append(line)
    flush()
    return chapters


def main():
    chapters = parse(SRC.read_text(encoding="utf-8"))
    total = sum(len(c["questions"]) for c in chapters)
    checks = sum(q["check"] for c in chapters for q in c["questions"])
    payload = json.dumps({"chapters": chapters}, ensure_ascii=False, indent=1)
    OUT.write_text(
        "// 자동 생성 파일 — tools/build-data.py 로 다시 만드세요. 직접 수정하지 마세요.\n"
        f"window.QA_DATA = {payload};\n",
        encoding="utf-8",
    )
    print(f"{len(chapters)}개 장, {total}문항 (본인 확인 {checks}개) → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
