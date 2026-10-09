"""Word-level lyric alignment -> data/lyrics.json

Pipeline
  1. separate.py       : Demucs stems of the gapless decode of the mp3.
  2. ctc_emissions.py  : frame-wise CTC log-probs of the vocal stem (mono sum,
                         left and right channel) from MMS_FA.
  3. vocal_feats.py    : vocal-stem RMS / pitch / onset features (5 ms hop).
  4. this script       : one global constrained CTC Viterbi pass over the whole
                         song on the fused emissions (garbage "star" token
                         between lines), every Chinese character aligned as its
                         toneless pinyin, then signal-based refinement of the
                         character starts/ends, confidence scoring, QA plots.

A "word" below is one display token: one Chinese character (see pron.py).

Run:  uv run python align.py [--plots]
"""
import common
import json
import re
import sys

import numpy as np

from ctcalign import FRAME, align, emissions, word_table
from pron import line_prons, tokenize

# Primary emission set: mixture of the CTC emissions of the demucs vocal stem's
# mono sum, left and right channel (double-tracked vocals are panned L/R).
PRIMARY = "fused3"
# The single sources, used for agreement-based confidence.
ALTS = ("mms", "mms_vocL", "mms_vocR")

# Per-line time windows (seconds) where the automatic path is ambiguous.
LINE_WINDOWS = {}

# ---------------------------------------------------------------------------
# Manual anchors (seconds) for the CTC path, established by inspecting the QA
# plots (spectrogram / pitch / envelopes).  Key: (line, token, subword) ->
# (earliest allowed start, latest allowed end) of that subword's chars.
ANCHORS = {}

# Final manual corrections of word boundaries after refinement, only where the
# plots clearly show the automatic result is wrong.  (line, token) ->
# dict(start=..., end=...)
FIX = {}

# ---------------------------------------------------------------------------


def load_feats():
    f = dict(np.load(common.WORK / "vocal_feats.npz"))
    f["hop"] = float(f.pop("hop_s"))
    return f


def activity(f, rel_db=22.0, abs_db=-48.0, win_s=1.5):
    """Vocal activity mask: RMS above an absolute floor and within rel_db of the
    local (±win) maximum."""
    from scipy.ndimage import maximum_filter1d, median_filter
    r = median_filter(f["rms_db"], 5)
    loc = maximum_filter1d(r, int(win_s / f["hop"]))
    return (r > abs_db) & (r > loc - rel_db), r


def runs(mask):
    """Return list of (start_idx, end_idx_exclusive) runs where mask is True."""
    m = np.concatenate([[False], mask, [False]]).astype(np.int8)
    d = np.diff(m)
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


# pinyin initials with frication: s sh c ch z zh x q j f h
FRIC_START = re.compile(r"(s|c|z|x|q|j|f|h)")


def refine(words, f, fix=None):
    """Signal-based refinement of CTC boundaries, per sub-word unit (the pinyin
    syllable of a character, or one part of a Latin token).

    1. rest-onset : a rest (>=50 ms silence) precedes the unit and the voice
                    re-enters >40 ms before the first CTC char -> start there
                    (CTC fires late on held vowels).
    2. onset-snap : otherwise snap to the strongest vocal onset (spectral flux)
                    in a window just before the CTC start (legato word starts
                    with glottal/vowel onsets that CTC places late).
    3. fricative  : for s/sh/c/ch/z/zh/x/q/j/f/h-initial units, CTC emits the consonant
                    at the END of the frication; move start back to where the
                    4-10 kHz noise begins.
    end: next unit's start when the voice continues (legato), else the moment
         the voice stops (RMS >15 dB below the word's level for >=60 ms).
    """
    from scipy.ndimage import uniform_filter1d
    from scipy.signal import find_peaks
    hop = f["hop"]
    act, r = activity(f, rel_db=27.0)
    n = len(r)
    sil = ~act
    sib = uniform_filter1d(f["sib_ratio"], 3)
    on = f["onset"]
    on_thr = 0.3 * np.percentile(on, 99)
    pk_idx, _ = find_peaks(on, height=on_thr, distance=int(0.04 / hop))
    units = []
    for k, w in enumerate(words):
        w["ctc_start"], w["ctc_end"] = w["start"], w["end"]
        w["ctc_subs"] = [tuple(x) for x in w["subs"]]
        for j, (a, b) in enumerate(w["subs"]):
            units.append(dict(k=k, j=j, text=w["pron"][j], cs=a, ce=b, s=a, rule="ctc"))
    fix = fix or {}
    for u_i, u in enumerate(units):
        w = words[u["k"]]
        fx = fix.get((w["li"], w["ti"]))
        if fx is not None:
            starts = [fx.get("start")] + list(fx.get("syl", []))
            if u["j"] < len(starts) and starts[u["j"]] is not None:
                u["s"], u["rule"] = starts[u["j"]], "manual"
                continue
        pu = units[u_i - 1] if u_i else None
        prev_ce = pu["ce"] if pu else 0.0
        prev_cs = pu["cs"] if pu else 0.0
        s = u["cs"]
        # 1. rest-onset
        i0, i1 = int(prev_ce / hop), int(s / hop)
        done = False
        if i1 - i0 > int(0.05 / hop):
            rs = [(a, b) for a, b in runs(sil[i0:i1]) if (b - a) * hop >= 0.05]
            if rs:
                onset = (i0 + rs[-1][1]) * hop
                if s - onset > 0.04:
                    u["s"], u["rule"] = onset, "rest-onset"
                done = True
        # 2. onset snap
        if not done:
            vowel_init = u["text"][0] in "aeiou"
            lo = max(prev_ce - 0.06, prev_cs + 0.08, s - (0.25 if vowel_init else 0.12))
            hi = s + 0.04
            # ignore onsets that are followed by frication
            cand = [p for p in pk_idx if lo <= p * hop <= hi
                    and np.median(sib[p:p + int(0.06 / hop)]) < -5]
            best, bsc = None, 0.0
            for p in cand:
                dt = s - p * hop
                wgt = 1.0 if dt < 0.06 else max(0.4, 1 - (dt - 0.06) / 0.4)
                if on[p] * wgt > bsc:
                    best, bsc = p, on[p] * wgt
            if best is not None:
                t = best * hop - 0.01
                if abs(t - s) > 0.02:
                    u["s"], u["rule"] = t, "onset-snap"
        # 3. fricative
        if FRIC_START.match(u["text"]):
            lo_t = prev_ce - 0.10
            if pu is not None:
                lo_t = max(lo_t, pu["s"] + 0.10)
            lo = int(max(lo_t, s - 0.30, 0) / hop)
            a, b = max(int((s - 0.15) / hop), lo), int((s + 0.06) / hop)
            if b > a:
                pk = a + int(np.argmax(sib[a:b]))
                base = np.percentile(sib[max(0, lo - int(0.4 / hop)):lo + 1], 25) if lo > 0 else -40
                if sib[pk] >= base + 8:
                    thr = 0.5 * (base + sib[pk])
                    j = pk
                    while j - 1 >= lo and sib[j - 1] > thr:
                        j -= 1
                    if j * hop < u["s"] - 0.02:
                        u["s"], u["rule"] = j * hop, "fricative"
    # monotonic unit starts
    for u_i in range(1, len(units)):
        units[u_i]["s"] = max(units[u_i]["s"], units[u_i - 1]["s"] + 0.03)
    for k, w in enumerate(words):
        us = [u for u in units if u["k"] == k]
        w["start"] = us[0]["s"]
        w["start_rule"] = us[0]["rule"]
        w["unit_starts"] = [u["s"] for u in us]
    for k, w in enumerate(words):
        nxt = words[k + 1]["start"] if k + 1 < len(words) else len(r) * hop
        e = max(w["ctc_end"], w["start"] + 0.08)
        j0 = int(w["start"] / hop)
        j1 = int(e / hop)
        level = np.percentile(r[j0:max(j1, j0 + 1)], 90)
        jn = int(nxt / hop)
        low = r < level - 15.0
        q = None
        j = j1
        need = int(0.06 / hop)
        # (the CTC end can run on into silence, as on the last word of the song: back to where the voice stopped)
        while j > j0 + int(0.08 / hop) and low[j - 1]:
            j -= 1
        while j < min(jn, n - need):
            if low[j] and low[j:j + need].all():
                q = j * hop
                break
            j += 1
        end = min(q, nxt) if q is not None else nxt
        end = max(end, w["start"] + 0.04)
        if nxt - end < 0.03:
            end = nxt
        w["end"] = end
        fx = fix.get((w["li"], w["ti"]))
        if fx is not None:
            w["manual"] = True
            if "end" in fx:
                end = fx["end"]
        w["end"] = end
        us = w["unit_starts"]
        w["subs"] = [(us[i], us[i + 1] if i + 1 < len(us) else end) for i in range(len(us))]
    return words


EXTRA_DESC = [
    # (t0, t1, description) of vocals that are not lyric words, identified from the QA plots
]


def detect_extras(words, f):
    """Vocal activity (vocal stem) not covered by any lyric word."""
    hop = f["hop"]
    r = median_filter_1d(f["rms_db"], 9)
    loc = np.maximum.accumulate(r)  # unused guard
    act = r > -36
    cover = np.zeros_like(act)
    for w in words:
        cover[int((w["start"] - 0.1) / hop):int((w["end"] + 0.1) / hop)] = True
    m = act & ~cover
    out = []
    for a, b in runs(m):
        if out and a * hop - out[-1][1] < 0.4:
            out[-1][1] = b * hop
        else:
            out.append([a * hop, b * hop])
    out = [x for x in out if x[1] - x[0] >= 0.5]
    ext = []
    for a, b in out:
        desc = next((d for (t0, t1, d) in EXTRA_DESC if a < t1 and b > t0), None)
        ext.append(dict(start=round(a, 2), end=round(b, 2),
                        desc=desc or "unlisted vocal (backing vocal / ad-lib / breath)"))
    # also list known extras that overlap lyric words (e.g. backing pads)
    for (t0, t1, d) in EXTRA_DESC:
        if not any(e["desc"] == d for e in ext):
            ext.append(dict(start=t0, end=t1, desc=d))
    ext.sort(key=lambda e: e["start"])
    return ext


def median_filter_1d(x, n):
    from scipy.ndimage import median_filter
    return median_filter(x, n)


def confidence(words, alt):
    for i, w in enumerate(words):
        ds = [abs(a[i]["start"] - w["ctc_start"]) for a in alt.values()]
        agree = np.mean([d <= 0.06 for d in ds])
        p = min(1.0, w["conf"] / 0.5)
        c = 0.35 + 0.4 * agree + 0.25 * p
        if w.get("manual"):
            fx = FIX.get((w["li"], w["ti"]), {})
            c = fx.get("conf", max(c, 0.8))
        w["conf_final"] = round(float(np.clip(c, 0, 1)), 2)
    return words


def main(plots=False):
    L = common.load_lyrics_src()
    toks = [tokenize(t) for _, _, t in L]
    prons = [line_prons(t) for _, _, t in L]
    E = emissions(PRIMARY)
    sp, score, _, _ = align(E, prons, anchors=ANCHORS, line_windows=LINE_WINDOWS)
    words = word_table(sp, toks, prons)
    alt = {}
    for k in ALTS:
        s2, _, _, _ = align(emissions(k), prons, anchors=ANCHORS, line_windows=LINE_WINDOWS)
        alt[k] = word_table(s2, toks, prons)
    f = load_feats()
    words = refine(words, f, FIX)
    # enforce monotonic / non-overlap
    for k in range(1, len(words)):
        if words[k]["start"] < words[k - 1]["start"] + 0.02:
            words[k]["start"] = words[k - 1]["start"] + 0.02
        if words[k - 1]["end"] > words[k]["start"]:
            words[k - 1]["end"] = words[k]["start"]
    words = confidence(words, alt)
    (common.WORK / "align_debug.json").write_text(
        json.dumps(dict(words=words, alt=alt), indent=1, default=float, ensure_ascii=False), encoding="utf-8")

    lines = []
    for li, (s0, e0, text) in enumerate(L):
        ws = [w for w in words if w["li"] == li]
        assert [w["w"] for w in ws] == toks[li]
        out = []
        for w in ws:
            d = dict(w=w["w"], start=round(w["start"], 3), end=round(w["end"], 3), conf=w["conf_final"])
            if len(w["subs"]) > 1:
                d["syl"] = [[round(a, 3), round(b, 3)] for a, b in w["subs"]]
            out.append(d)
        lines.append(dict(i=li, text=text, start=out[0]["start"], end=out[-1]["end"], words=out))
    doc = dict(lines=lines, extras=detect_extras(words, f), notes=NOTES)
    (common.DATA / "lyrics.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote", common.DATA / "lyrics.json", "score", score)
    if plots:
        make_plots(words, alt, L)
    return words, alt


def make_plots(words, alt, L):
    from qa_plot import plot
    for li, (s0, e0, text) in enumerate(L):
        ws = [w for w in words if w["li"] == li]
        t0 = min(ws[0]["start"], ws[0]["ctc_start"]) - 0.8
        t1 = max(ws[-1]["end"], ws[-1]["ctc_end"]) + 0.6
        t1 = min(t1, t0 + 7)
        tracks = [
            ("final", [(w["w"], w["start"], w["end"]) for w in words]),
            ("fused-ctc", [(w["w"], w["ctc_start"], w["ctc_end"]) for w in words]),
            ("pinyin", [(w["pron"][i], a, b) for w in words for i, (a, b) in enumerate(w["subs"])]),
            ("mms", [(w["w"], w["start"], w["end"]) for w in alt["mms"]]),
            ("mms L", [(w["w"], w["start"], w["end"]) for w in alt["mms_vocL"]]),
            ("mms R", [(w["w"], w["start"], w["end"]) for w in alt["mms_vocR"]]),
        ]
        plot(t0, t1, tracks, common.QA / f"line_{li:02d}.png", title=f"L{li}: {text}")


NOTES = (
    "Timeline = gapless mp3 decode (same as data/audio.json); the Demucs stems are separated "
    "from that decode. A 'word' is one Chinese character. Method: (1) CTC emissions (20 ms "
    "frames) of the Demucs vocal stem from torchaudio MMS_FA, on the mono sum and on the left "
    "and right channels, fused as a probability mixture; (2) one global constrained Viterbi "
    "forced alignment of all lines over the whole song with a garbage 'star' token between "
    "lines to absorb ad-libs, every character aligned as its toneless pinyin; (3) signal "
    "refinement per character on the vocal stem: start moved to the voice re-entry after a "
    "rest, snapped to the nearest spectral-flux onset, or moved back to the start of the "
    "frication of an s/sh/c/ch/z/zh/x/q/j/f/h initial; ends = next character start when "
    "legato, else when the voice drops 15 dB below the character's level (held notes keep "
    "their full length). conf: 0.35 + agreement of the mono / left / right alignments "
    "(<=60 ms) + CTC posterior; manual fixes (align.py FIX) carry their own conf."
)

if __name__ == "__main__":
    main(plots="--plots" in sys.argv)
