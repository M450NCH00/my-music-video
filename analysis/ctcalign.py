"""CTC forced alignment of the full lyric text against the vocal stem.

* Emissions: the char-level CTC model MMS_FA (multilingual, romanized text, so
  Chinese is aligned as toneless pinyin) mapped to the alphabet (blank, a-z, ').
  The vocal stem's mono sum, left and right channel can be used individually or
  fused (probability mixture) for a more robust single path.
* All lines are aligned in ONE Viterbi pass over the whole song.  A "garbage"
  star token sits between lines (and at both ends); its per-frame score is
  (best token log-prob - margin), so it absorbs ad-libs / backing vocals /
  outro that are not in the lyric text, while lyric words still win wherever
  they really match.
* Optional per-subword time windows ("anchors") constrain the path; used for
  manually verified hard spots.
"""
import common  # noqa: F401
import numpy as np
import numba
import torchaudio

FRAME = 0.02  # s per emission frame
ALPHA = ["-"] + list("abcdefghijklmnopqrstuvwxyz'")
AIDX = {c: i for i, c in enumerate(ALPHA)}


def _common_logp(model):
    em = np.load(common.WORK / f"emission_{model}.npy").astype(np.float64)
    labs = list(torchaudio.pipelines.MMS_FA.get_labels(star=None))
    out = np.full((em.shape[0], len(ALPHA)), -1e4)
    blank_cols = [labs.index("-")] + ([labs.index("|")] if "|" in labs else [])
    out[:, 0] = np.logaddexp.reduce(em[:, blank_cols], axis=1)
    for i, c in enumerate(labs):
        k = c.lower()
        if k in AIDX and k != "-":
            out[:, AIDX[k]] = em[:, i]
    out -= np.logaddexp.reduce(out, axis=1, keepdims=True)
    return out


def emissions(kind):
    """kind: 'mms[_<source>]' with source in ''(demucs mono)|vocL|vocR; or
    'fused3' = mixture of the mono, left and right channels."""
    if kind == "fused3":
        es = [_common_logp("mms" + s) for s in ("", "_vocL", "_vocR")]
        n = min(len(e) for e in es)
        return np.logaddexp.reduce(np.stack([e[:n] for e in es]), axis=0) - np.log(len(es))
    return _common_logp(kind)


@numba.njit(cache=True)
def _viterbi(E, tgt, lo, hi):
    T = E.shape[0]
    L = len(tgt)
    S = 2 * L + 1
    NEG = -1e18
    prev = np.full(S, NEG)
    cur = np.full(S, NEG)
    bp = np.zeros((T, S), np.int8)  # 0 stay, 1 from s-1, 2 from s-2
    # t = 0
    prev[0] = E[0, 0]
    if lo[0] <= 0 <= hi[0]:
        prev[1] = E[0, tgt[0]]
    for t in range(1, T):
        for s in range(S):
            if s % 2 == 1:
                j = (s - 1) // 2
                if t < lo[j] or t > hi[j]:
                    cur[s] = NEG
                    continue
                e = E[t, tgt[j]]
            else:
                e = E[t, 0]
            best = prev[s]
            arg = 0
            if s >= 1 and prev[s - 1] > best:
                best = prev[s - 1]
                arg = 1
            if s >= 2 and s % 2 == 1:
                j = (s - 1) // 2
                if tgt[j] != tgt[j - 1] and prev[s - 2] > best:
                    best = prev[s - 2]
                    arg = 2
            cur[s] = best + e
            bp[t, s] = arg
        for s in range(S):
            prev[s] = cur[s]
    # end in last token or final blank
    if prev[S - 1] >= prev[S - 2]:
        s = S - 1
    else:
        s = S - 2
    score = prev[s]
    path = np.zeros(T, np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        a = bp[t, s]
        s -= a
    return path, score


def build_targets(lines_prons):
    """Returns (tgt ids, index list, star id). index: (li, ti, si, pos_a, pos_b)."""
    star = len(ALPHA)
    tgt, index = [star], []
    for li, toks in enumerate(lines_prons):
        for ti, subs in enumerate(toks):
            for si, sw in enumerate(subs):
                a = len(tgt)
                tgt.extend(AIDX[c] for c in sw)
                index.append((li, ti, si, a, len(tgt)))
        tgt.append(star)
    return tgt, index, star


def align(E, lines_prons, margin=1.5, anchors=None, line_windows=None):
    """Global alignment.

    lines_prons: per line, per token, its pronunciation sub-words (pron.line_prons).
    anchors: {(li, ti, si): (t_lo, t_hi)} seconds window for the subword's
             first char (t_lo) / last char (t_hi) occupancy.
    line_windows: {li: (t_lo, t_hi)} every token of the line must lie inside.
    Returns spans {(li, ti): [(start, end, meanprob, char_frames), ...]} per subword.
    """
    T = E.shape[0]
    star_col = E.max(axis=1, keepdims=True) - margin
    Ex = np.concatenate([E, star_col], axis=1)
    tgt, index, star = build_targets(lines_prons)
    tgt = np.array(tgt, np.int64)
    lo = np.zeros(len(tgt), np.int64)
    hi = np.full(len(tgt), T - 1, np.int64)
    for (li, ti, si, a, b) in index:
        if line_windows and li in line_windows:
            wl, wh = line_windows[li]
            lo[a:b] = np.maximum(lo[a:b], int(wl / FRAME))
            hi[a:b] = np.minimum(hi[a:b], int(wh / FRAME))
        if anchors and (li, ti, si) in anchors:
            wl, wh = anchors[(li, ti, si)]
            if wl is not None:
                lo[a:b] = np.maximum(lo[a:b], int(round(wl / FRAME)))
            if wh is not None:
                hi[a:b] = np.minimum(hi[a:b], int(round(wh / FRAME)))
    path, score = _viterbi(Ex, tgt, lo, hi)
    tokpos = np.where(path % 2 == 1, (path - 1) // 2, -1)
    P = np.exp(Ex[np.arange(T), np.where(tokpos >= 0, tgt[np.maximum(tokpos, 0)], 0)])
    spans = {}
    for (li, ti, si, a, b) in index:
        fr = np.where((tokpos >= a) & (tokpos < b))[0]
        chars = [np.where(tokpos == p)[0] for p in range(a, b)]
        spans.setdefault((li, ti), []).append(
            (fr.min() * FRAME, (fr.max() + 1) * FRAME, float(P[fr].mean()),
             [(c.min() * FRAME, (c.max() + 1) * FRAME) for c in chars]))
    return spans, float(score), path, tgt


def word_table(spans, lines_tokens, lines_prons):
    out = []
    for li, toks in enumerate(lines_tokens):
        for ti, tok in enumerate(toks):
            sp = spans[(li, ti)]
            out.append(dict(li=li, ti=ti, w=tok, pron=lines_prons[li][ti], start=sp[0][0], end=sp[-1][1],
                            conf=float(np.mean([s[2] for s in sp])),
                            subs=[(s[0], s[1]) for s in sp]))
    return out
