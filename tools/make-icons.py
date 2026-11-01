#!/usr/bin/env python3
"""의존성 없이 PWA 아이콘 PNG(192/512)를 생성합니다. 사용법: python3 tools/make-icons.py"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = (29, 78, 216)
FG = (255, 255, 255)


def pixel(x, y, n):
    # 파란 배경 위에 흰 말풍선(원 + 꼬리)
    cx, cy, r = n * 0.5, n * 0.46, n * 0.27
    dx, dy = x - cx, y - cy
    if dx * dx + dy * dy <= r * r:
        # 말풍선 안쪽에 파란 "?" 대신 점 세 개
        for k in (-1, 0, 1):
            px, py, pr = cx + k * r * 0.45, cy, r * 0.12
            if (x - px) ** 2 + (y - py) ** 2 <= pr * pr:
                return BG
        return FG
    # 꼬리 삼각형
    tx0, ty0 = cx - r * 0.55, cy + r * 0.6
    if ty0 <= y <= ty0 + r * 0.55 and tx0 <= x <= tx0 + (ty0 + r * 0.55 - y) * 0.9:
        return FG
    return BG


def png(n):
    rows = b"".join(b"\x00" + bytes(c for x in range(n) for c in pixel(x, y, n)) for y in range(n))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


for size in (192, 512):
    (OUT / f"icon-{size}.png").write_bytes(png(size))
    print(f"icons/icon-{size}.png")
