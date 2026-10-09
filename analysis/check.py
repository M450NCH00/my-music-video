"""Sanity report on data/lyrics.json: line windows, confidence, character pace,
vocals not covered by any lyric, and how well repeated lines agree in rhythm.

Run:  uv run python check.py
"""
import common
import json
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
doc = json.loads((common.DATA / "lyrics.json").read_text(encoding="utf-8"))
L = doc["lines"]
print(" #    start     end   gap  conf  min  s/char  text")
for i, l in enumerate(L):
    ws = l["words"]
    gap = l["start"] - L[i - 1]["end"] if i else l["start"]
    conf = [w["conf"] for w in ws]
    pace = (ws[-1]["start"] - ws[0]["start"]) / max(1, len(ws) - 1)
    flag = "  <-- low" if np.mean(conf) < 0.6 else ""
    print(f"{i:2d}  {l['start']:7.2f} {l['end']:7.2f} {gap:5.2f}  {np.mean(conf):.2f} {min(conf):.2f}  {pace:5.2f}  {l['text']}{flag}")

print("\nrepeated lines: character onsets relative to the line start (s)")
seen = {}
for i, l in enumerate(L):
    seen.setdefault(l["text"], []).append(i)
for text, ids in seen.items():
    if len(ids) < 2:
        continue
    rel = np.array([[w["start"] - L[i]["words"][0]["start"] for w in L[i]["words"]] for i in ids])
    dev = np.abs(rel - np.median(rel, axis=0)).max()
    print(f"  {text}  lines {ids}  max deviation {dev * 1000:.0f} ms" + ("  <-- check" if dev > 0.25 else ""))
    if dev > 0.25:
        for i, r in zip(ids, rel):
            print("     ", i, " ".join(f"{x:.2f}" for x in r))

print("\nvocals outside the lyric lines:")
for e in doc["extras"]:
    print(f"  {e['start']:7.2f} - {e['end']:7.2f}  {e['desc']}")
