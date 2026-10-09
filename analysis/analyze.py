"""Music analysis -> data/audio.json

  * constant-tempo beat grid (the drums' pulse fitted to drum / mix onsets, tempo
    and phase refined on kick attacks, every second beat kept for a song in half
    time), downbeats (bar phase from the kick pattern and the bass / chord
    changes), sections from the aligned lyrics,
  * 100 fps normalized envelopes (mix rms / low / mid / high, stem rms),
  * kick / snare / hat onsets from the drums stem, vocal note onsets.

All times are in the gapless-mp3 timeline (see common.py).  Needs
data/lyrics.json (align.py) for the sections.

Run:  uv run python analyze.py [--plots]
"""
import common
import json
import math
import sys

import numpy as np
import librosa
from scipy.ndimage import maximum_filter1d, median_filter, uniform_filter1d
from scipy.signal import butter, find_peaks, sosfiltfilt

SR = 44100
FPS = 100

# Tempo search range (BPM); None = +-8 % around librosa's estimate.
BPM_RANGE = None
# The fit locks onto the fastest steady pulse of the drums.  This song is in half time: the kick
# and the snare alternate on every second beat of that pulse (one snare per four of its beats), so
# the beat one taps along to, and the one docs/TREATMENT.md counts in ("two steps per beat"), is
# half as fast.  True = the grid keeps every second beat of the fit, the ones the kick and the
# snare fall on.
HALF_TIME = True
# Which beat of the grid (0..3) is a downbeat; None = pick it from the kick and bass.
BAR_PHASE = None

# Sections of the song, in order: (name, rule, lyric line, which occurrence of it).
#   "line":  the section starts with that line: on the downbeat of the bar in
#            which the line starts, or on the next downbeat when the line starts
#            with a pickup (less than 1.5 beats before it);
#   "after": the section is instrumental and follows that line: it starts on
#            the first beat at or after the line's end.
# "intro" (0 -> the first section) is added in front.
SECTIONS = [
    ("verse1", "line", "教室钟慢半拍", 0),
    ("chorus1", "line", "等你下课一起走好不好", 0),
    ("interlude", "after", "把喜欢藏在书包拉链口", 0),
    ("verse2", "line", "走廊风吹得好吵", 0),
    ("chorus2", "line", "等你下课一起走好不好", 1),
    ("bridge", "line", "哪天如果我们", 0),
    ("final", "line", "等你下课一起走好不好", 2),
    ("outro", "after", "把喜欢一点一点说出口", 0),
]


# ---------------------------------------------------------------------------
def band_sos(lo, hi, sr):
    if lo and hi:
        return butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    if hi:
        return butter(4, hi, btype="low", fs=sr, output="sos")
    return butter(4, lo, btype="high", fs=sr, output="sos")


def frame_rms(x, sr, fps=FPS, win=2048):
    hop = sr / fps
    n = int(math.ceil(len(x) / sr * fps))
    pad = np.pad(x, (win // 2, win // 2 + int(hop) + 2))
    idx = (np.arange(n) * hop).astype(int)
    c = np.concatenate([[0.0], np.cumsum(pad.astype(np.float64) ** 2)])
    e = (c[idx + win] - c[idx]) / win
    return np.sqrt(np.maximum(e, 0))


def smooth_env(x, fps=FPS, attack=0.010, release=0.090):
    """One-pole follower: fast attack, slower release (visual friendly)."""
    aa = math.exp(-1 / (attack * fps))
    ar = math.exp(-1 / (release * fps))
    y = np.empty_like(x)
    s = 0.0
    for i, v in enumerate(x):
        a = aa if v > s else ar
        s = a * s + (1 - a) * v
        y[i] = s
    return y


def norm01(x, pct=99.0):
    ref = np.percentile(x, pct)
    return np.clip(x / (ref + 1e-12), 0, 1)


# ---------------------------------------------------------------------------
def fit_grid(drums, mix, sr, duration):
    """Constant-tempo grid: coarse tempo/phase search on spectral-flux onset
    envelopes, then phase refinement on kick attack times."""
    hop = 64
    fps = sr / hop
    od = librosa.onset.onset_strength(y=librosa.resample(drums, orig_sr=sr, target_sr=22050),
                                      sr=22050, hop_length=hop // 2, lag=1, max_size=1)
    om = librosa.onset.onset_strength(y=librosa.resample(mix, orig_sr=sr, target_sr=22050),
                                      sr=22050, hop_length=hop // 2, lag=1, max_size=1)
    o = od / (np.percentile(od, 99) + 1e-9) + om / (np.percentile(om, 99) + 1e-9)
    ofps = 22050 / (hop // 2)

    def score(P, off):
        ts = off + P * np.arange(int(duration / P) + 1)
        idx = np.round(ts * ofps).astype(int)
        idx = idx[(idx > 2) & (idx < len(o) - 2)]
        return np.maximum.reduce([o[idx - 1], o[idx], o[idx + 1]]).mean()

    lo_hi = BPM_RANGE
    if lo_hi is None:
        # (a coarse estimate is enough to place the search: it is taken from the envelope pooled to
        # 43 frames/s; at the envelope's own 689 frames/s librosa's tempogram takes several GB)
        k = 16
        pooled = o[: len(o) // k * k].reshape(-1, k).max(axis=1)
        est = float(np.atleast_1d(librosa.feature.tempo(onset_envelope=pooled, sr=22050, hop_length=(hop // 2) * k))[0])
        lo_hi = (est * 0.92, est * 1.08)
        print(f"librosa tempo estimate {est:.2f} BPM -> search {lo_hi[0]:.1f}..{lo_hi[1]:.1f}")
    best = (0, None, None)
    for bpm in np.arange(lo_hi[0], lo_hi[1], 0.02):
        P = 60 / bpm
        for off in np.arange(0, P, 0.004):
            s = score(P, off)
            if s > best[0]:
                best = (s, bpm, off)
    _, bpm, off = best
    for b2 in np.arange(bpm - 0.02, bpm + 0.02, 0.001):  # fine
        P = 60 / b2
        for o2 in np.arange(off - 0.01, off + 0.01, 0.001):
            s = score(P, o2)
            if s > best[0]:
                best = (s, b2, o2)
    _, bpm, off = best
    P = 60 / bpm
    # refine tempo and phase on kick attacks (steepest rise of low-band log energy): the line through
    # the attack times of the kicks that fall on a beat, against their beat index. (The search above
    # is only as fine as its steps and the envelope's frames; over a whole song the kicks pin the
    # period down to a few microseconds, whatever range the search started from.)
    kick_t, _ = band_onsets(drums, sr, None, 120, win=0.012, min_gap=0.2, rel_db=12)

    def on_beat(tol):
        n = np.round((kick_t - off) / P)
        r = kick_t - (off + n * P)
        ok = np.abs(r) < tol
        return n[ok], kick_t[ok], r[ok]

    for tol in (0.06, 0.03):
        n, kt, _ = on_beat(tol)
        if len(n) < 8:
            break
        P, off = (float(x) for x in np.polyfit(n, kt, 1))
    bpm = 60 / P
    res = on_beat(0.06)[2]
    # first beat >= 0
    off = off - P * math.floor(off / P)
    return bpm, P, off, res


def band_onsets(x, sr, lo, hi, win=0.010, hop_s=0.002, min_gap=0.08, rel_db=10.0,
                decay_win=None):
    """Onsets in a frequency band: steepest rise of the band's log-energy
    envelope; strength = peak dB rise.  Returns (times, rise_db[, decay_db])."""
    xb = sosfiltfilt(band_sos(lo, hi, sr), x)
    h = int(hop_s * sr)
    w = int(win * sr)
    e = np.convolve(xb.astype(np.float64) ** 2, np.ones(w) / w, mode="same")[::h]
    db = 10 * np.log10(e + 1e-10)
    fps = sr / h  # exact frame rate (h is an integer number of samples)
    d = np.diff(db, prepend=db[0])
    d = uniform_filter1d(d, 3)
    # rise over ~20 ms
    lag = int(0.02 * fps)
    rise = db - np.concatenate([np.full(lag, db[0]), db[:-lag]])
    floor = median_filter(db, int(1.0 * fps) | 1)
    pk, _ = find_peaks(rise, height=rel_db, distance=int(min_gap * fps))
    times, strength = [], []
    for p in pk:
        a = max(0, p - lag)
        # attack time: steepest slope within the rise window
        q = a + int(np.argmax(d[a:p + 1]))
        peak_db = db[p:p + int(0.03 * fps)].max()
        if peak_db < floor[p] + 3:
            continue
        times.append(q / fps)
        strength.append(peak_db)
    return np.array(times), np.array(strength)


def drum_onsets(d, sr, grid_P, grid_off):
    """Kick / snare / hat onsets from the drums stem."""
    # KICK: <120 Hz
    kt, kdb = band_onsets(d, sr, None, 120, win=0.012, min_gap=0.15, rel_db=12)
    # SNARE (and the clap-like snare of the quiet chorus): candidates are
    # 1.5-5 kHz attacks; a snare has a long noisy 0.5-5 kHz tail 40-120 ms after
    # the attack.  Keep candidates whose tail is within 8 dB of the loudest tail
    # in +-2.5 s and within 25 dB of the song-wide level (rejects stem bleed).
    # Kick-only beats / hats have tails 12-30 dB lower.
    st, sdb = band_onsets(d, sr, 1500, 5000, win=0.010, min_gap=0.15, rel_db=10)
    xb = sosfiltfilt(band_sos(500, 5000, sr), d)
    e = np.sqrt(np.convolve(xb.astype(np.float64) ** 2, np.ones(441) / 441, mode="same"))
    tail = np.array([20 * np.log10(e[int((t + 0.04) * sr):int((t + 0.12) * sr)].mean() + 1e-9) for t in st])
    rel = np.array([tail[i] - tail[np.abs(st - st[i]) < 2.5].max() for i in range(len(st))])
    thr = np.percentile(tail, 95) - 25
    keep = (rel > -8) & (tail > thr)
    st, sdb, stail = st[keep], sdb[keep], tail[keep]
    # HAT: >7 kHz, short; drop those coinciding with snares (snare noise also
    # reaches 7k+)
    ht, hdb = band_onsets(d, sr, 7000, None, win=0.006, min_gap=0.06, rel_db=9)
    # (and those within 30 ms of a kick: the kick's beater click reaches 10 kHz)
    for other, gap in ((st, 0.04), (kt, 0.03)):
        if len(other) and len(ht):
            dist = np.min(np.abs(ht[:, None] - other[None, :]), axis=1)
            keep = dist > gap
            ht, hdb = ht[keep], hdb[keep]
    return (kt, kdb), (st, stail), (ht, hdb), thr


def bar_phase(beats, drums, bass, sr):
    """Which of the 4 beat positions is the downbeat: the one where the kick is
    loudest and the bass note / chord changes most often (chroma novelty of the
    bass stem between the half-beat before and the half-beat after)."""
    P = float(np.median(np.diff(beats)))
    kick = np.abs(sosfiltfilt(band_sos(None, 120, sr), drums))
    chroma = librosa.feature.chroma_cqt(y=bass, sr=sr, hop_length=512, fmin=librosa.note_to_hz("C1"), n_octaves=4)
    cf = sr / 512
    kscore, cscore = np.zeros(4), np.zeros(4)
    for i, b in enumerate(beats):
        a0, a1 = int(b * sr), int((b + 0.08) * sr)
        if a1 < len(kick):
            kscore[i % 4] += kick[a0:a1].max()
        i0, i1, i2 = int((b - P * 0.9) * cf), int(b * cf), int((b + P * 0.9) * cf)
        if i0 >= 0 and i2 < chroma.shape[1] and i1 > i0 and i2 > i1:
            u, v = chroma[:, i0:i1].mean(1), chroma[:, i1:i2].mean(1)
            cscore[i % 4] += 1 - float(u @ v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9)
    kscore, cscore = kscore / (kscore.max() + 1e-9), cscore / (cscore.max() + 1e-9)
    print("bar phase evidence  kick:", np.round(kscore, 2), " bass change:", np.round(cscore, 2))
    return int(np.argmax(kscore + 2 * cscore)), kscore, cscore


def strength01(db_vals, lo_pct=5, hi_pct=95):
    if len(db_vals) == 0:
        return db_vals
    lo, hi = np.percentile(db_vals, lo_pct), np.percentile(db_vals, hi_pct)
    return np.clip((db_vals - lo) / (hi - lo + 1e-9) * 0.8 + 0.2, 0, 1)


def vocal_onsets(v, sr):
    """Vocal note onsets: log-mel spectral flux peaks (5 ms hop) plus pitch
    jumps > 0.8 semitone while voiced, restricted to active vocal frames."""
    f = dict(np.load(common.WORK / "vocal_feats.npz"))
    hop = float(f["hop_s"])
    on = f["onset"]
    rms = f["rms_db"]
    loc = maximum_filter1d(rms, int(2.0 / hop))
    active = (rms > -45) & (rms > loc - 25)
    thr = uniform_filter1d(on, int(0.4 / hop)) * 1.5 + 0.15 * np.percentile(on, 99)
    pk, _ = find_peaks(on, height=0, distance=int(0.09 / hop))
    pk = [p for p in pk if on[p] > thr[p] and active[min(len(active) - 1, p + int(0.03 / hop))]]
    t_flux = np.array(pk) * hop
    s_flux = np.array([on[p] for p in pk])
    # pitch jumps (legato note changes that have little spectral flux)
    f0 = f["f0"]
    midi = librosa.hz_to_midi(np.where(f["voiced"] > 0, f0, np.nan))
    med = median_filter(np.nan_to_num(midi, nan=0), 9)
    jumps = []
    w = int(0.04 / hop)
    for i in range(w, len(med) - w):
        a, b = med[i - w], med[i + w]
        if a > 0 and b > 0 and abs(b - a) > 0.8 and active[i]:
            jumps.append(i)
    # collapse runs
    t_pitch, last = [], -1e9
    for i in jumps:
        if i - last > int(0.1 / hop):
            t_pitch.append(i * hop)
        last = i
    t_pitch = np.array(t_pitch)
    ts = list(zip(t_flux, s_flux / (np.percentile(s_flux, 95) + 1e-9)))
    for t in t_pitch:
        if len(t_flux) == 0 or np.min(np.abs(t_flux - t)) > 0.08:
            ts.append((t, 0.35))
    ts.sort()
    return [(float(t), float(min(1.0, max(0.1, s)))) for t, s in ts]


# ---------------------------------------------------------------------------
def main(plots=False):
    mix, _ = common.load_mix(SR)
    duration = len(mix) / SR
    stems = {n: common.load_stem(n, sr=SR)[0][: len(mix)] for n in ("vocals", "drums", "bass", "other")}
    for n in stems:
        if len(stems[n]) < len(mix):
            stems[n] = np.pad(stems[n], (0, len(mix) - len(stems[n])))

    bpm, P, off, kick_res = fit_grid(stems["drums"], mix, SR, duration)
    print(f"tempo {bpm:.3f} BPM  period {P:.5f}s  first beat {off:.4f}s  kick residual sd {kick_res.std()*1000:.1f} ms")
    beats = off + P * np.arange(int((duration - off) / P) + 1)
    (kt, kdb), (st, sdb), (ht, hdb), sn_thr = drum_onsets(stems["drums"], SR, P, off)
    if HALF_TIME:
        # of the two interleaved halves of the fitted pulse, the one the kick and the snare fall on
        hits = np.concatenate([kt, st])
        on = [int((np.abs(hits[:, None] - beats[None, p::2]).min(axis=1) < 0.05).sum()) for p in (0, 1)]
        p = int(np.argmax(on))
        print(f"half time: kick and snare hits on the even / odd beats of the fit: {on[0]} / {on[1]} -> the grid keeps the {('even', 'odd')[p]} ones")
        beats = beats[p::2]
        bpm, P, off = bpm / 2, P * 2, float(beats[0])
        print(f"grid  {bpm:.3f} BPM  period {P:.5f}s  first beat {off:.4f}s")
    phase = BAR_PHASE
    if phase is None:
        phase, _, _ = bar_phase(beats, stems["drums"], stems["bass"], SR)
    print("downbeat = beat index", phase, "mod 4")
    downbeats = beats[phase::4]

    # envelopes -------------------------------------------------------------
    n = int(math.ceil(duration * FPS))
    env = {}
    env["rms"] = frame_rms(mix, SR)[:n]
    for name, (lo, hi) in {"low": (None, 150), "mid": (150, 2000), "high": (4000, None)}.items():
        env[name] = frame_rms(sosfiltfilt(band_sos(lo, hi, SR), mix), SR)[:n]
    for s in ("vocal", "drums", "bass", "other"):
        env[s] = frame_rms(stems["vocals" if s == "vocal" else s], SR)[:n]
    for k in env:
        e = smooth_env(env[k])
        env[k] = [round(float(x), 3) for x in norm01(e)]
        assert len(env[k]) == n

    # onsets -------------------------------------------------------------------
    onsets = {
        "kick": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(kt, strength01(kdb))],
        "snare": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(st, strength01(sdb))],
        "hat": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(ht, strength01(hdb))],
        "vocal": [[round(t, 3), round(s, 3)] for t, s in vocal_onsets(stems["vocals"], SR)],
    }
    # snare / kick position statistics -> bar phase evidence
    def pos_hist(ts):
        ph = np.round((np.asarray(ts) - downbeats[0]) / (P / 2)).astype(int) % 8
        return np.bincount(ph, minlength=8).tolist()
    print("kick   8th-positions in bar:", pos_hist(kt))
    print("snare  8th-positions in bar:", pos_hist(st))
    print("hat    8th-positions in bar:", pos_hist(ht))

    # sections -------------------------------------------------------------------
    ly = json.loads((common.DATA / "lyrics.json").read_text(encoding="utf-8"))["lines"]

    def line(text, nth):
        hits = [l for l in ly if l["text"] == text]
        if nth >= len(hits):
            raise SystemExit(f"SECTIONS: line {text!r} (occurrence {nth}) is not in data/lyrics.json")
        return hits[nth]

    def bar_of(t):
        k = int(np.searchsorted(downbeats, t, side="right")) - 1
        if k + 1 < len(downbeats) and downbeats[k + 1] - t < 1.5 * P:
            k += 1
        return float(downbeats[max(k, 0)])

    def beat_after(t):
        # (a held last note may end a little past the beat: a quarter of a beat is allowed)
        k = int(np.searchsorted(beats, t - 0.25 * P, side="left"))
        return float(beats[min(k, len(beats) - 1)])

    marks = [(name, bar_of(line(text, nth)["start"]) if rule == "line" else beat_after(line(text, nth)["end"]))
             for name, rule, text, nth in SECTIONS]
    assert all(a[1] < b[1] for a, b in zip(marks, marks[1:])), marks
    if marks[0][1] > 0:
        marks.insert(0, ("intro", 0.0))
    sections = [dict(name=n, start=round(a, 3), end=round(marks[i + 1][1] if i + 1 < len(marks) else duration, 3))
                for i, (n, a) in enumerate(marks)]
    for x in sections:
        print(f"  {x['name']:9s} {x['start']:7.2f} - {x['end']:7.2f}")

    doc = dict(
        duration=round(duration, 3),
        bpm=round(bpm, 3),
        beat_period=round(P, 5),
        time_signature=4,
        beats=[round(float(t), 3) for t in beats],
        downbeats=[round(float(t), 3) for t in downbeats],
        sections=sections,
        fps=FPS,
        **env,
        onsets=onsets,
        notes=NOTES.format(bpm=bpm, off=off, P=P, first_db=float(downbeats[0]),
                           sd=float(kick_res.std() * 1000) if len(kick_res) else 0.0,
                           sn=len(st), kk=len(kt), hh=len(ht)),
    )
    (common.DATA / "audio.json").write_text(json.dumps(doc, separators=(",", ":")))
    print("wrote", common.DATA / "audio.json", f"{len(beats)} beats, {len(downbeats)} downbeats, "
          f"{len(kt)} kicks, {len(st)} snares, {len(ht)} hats, {len(onsets['vocal'])} vocal onsets")
    if plots:
        make_plots(doc, stems)
    return doc


NOTES = (
    "Timeline = gapless mp3 decode (ffmpeg/libsndfile/browsers); the Demucs stems are separated "
    "from that decode. Tempo is taken as constant: {bpm:.3f} BPM (period {P:.5f} s). The pulse of the "
    "drums is fitted over the whole song on drum+mix onset envelopes, then tempo and phase are "
    "refined by a line through the kick attack times (residual sd {sd:.1f} ms). The song is in half "
    "time (kick on beats 1 and 3, snare on 2 and 4 of a slow bar), so the grid keeps every second "
    "beat of that pulse: `beats` are the beats one taps along to, and the faster pulse is their "
    "halves. First beat {off:.3f} s. The grid is extrapolated through passages without drums. "
    "Bar phase (4/4): the beat position where the kick is loudest and the bass note / chord changes "
    "most often; first downbeat {first_db:.3f} s. Sections start on downbeats and follow the lyrics "
    "(analyze.py SECTIONS): a section that starts with a line starts on the downbeat of the bar in "
    "which that line starts, or on the next one when the line starts with a pickup shorter than "
    "1.5 beats; an instrumental section (interlude, outro) starts on the first beat after the "
    "line before it. "
    "Envelopes: 100 fps, frame i centred at i/100 s, 46 ms RMS window, one-pole smoothing "
    "(10 ms attack / 90 ms release), each divided by its own 99th percentile and clipped "
    "to 0..1 (linear amplitude). low <150 Hz, mid 150-2000 Hz, high >4 kHz of the full mix; "
    "vocal/drums/bass/other = stem RMS. "
    "Onsets [time, strength 0-1] from the drums stem: kick = attack (steepest rise) of the "
    "<120 Hz band ({kk}); snare = 1.5-5 kHz attacks whose 0.5-5 kHz noise tail 40-120 ms later is in the "
    "loudest local class ({sn}); hat = >7 kHz attacks not within 40 ms of a snare or 30 ms of a kick ({hh}). vocal = note "
    "onsets from the vocal stem (log-mel flux peaks + legato pitch jumps > 0.8 semitone), "
    "including backing vocals / ad-libs."
)


def make_plots(doc, stems):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    wins = [(max(0.0, x["start"] - 4), min(doc["duration"], x["start"] + 8)) for x in doc["sections"]]
    t = np.arange(len(doc["rms"])) / FPS
    for (t0, t1) in wins:
        fig, ax = plt.subplots(3, 1, figsize=(22, 11), sharex=True,
                               gridspec_kw=dict(height_ratios=[2, 1.6, 1.4]))
        d = stems["drums"][int(t0 * SR):int(t1 * SR)]
        S = librosa.amplitude_to_db(np.abs(librosa.stft(d, n_fft=1024, hop_length=128)), ref=np.max)
        ax[0].imshow(S, origin="lower", aspect="auto", cmap="magma", vmin=-60, vmax=0,
                     extent=[t0, t0 + S.shape[1] * 128 / SR, 0, SR / 2])
        ax[0].set_ylim(0, 12000)
        ax[0].set_ylabel("drums stem")
        m = (t >= t0) & (t <= t1)
        for k, c in [("rms", "k"), ("low", "tab:red"), ("mid", "tab:green"), ("high", "tab:blue")]:
            ax[1].plot(t[m], np.array(doc[k])[m], color=c, lw=1, label=k)
        ax[1].legend(loc="upper left", fontsize=8)
        for k, c in [("vocal", "tab:purple"), ("drums", "tab:orange"), ("bass", "tab:brown"), ("other", "tab:olive")]:
            ax[2].plot(t[m], np.array(doc[k])[m], color=c, lw=1, label=k)
        ax[2].legend(loc="upper left", fontsize=8)
        for b in doc["beats"]:
            if t0 <= b <= t1:
                for a_ in ax:
                    a_.axvline(b, color="gray", lw=0.6, alpha=0.6)
        for b in doc["downbeats"]:
            if t0 <= b <= t1:
                for a_ in ax:
                    a_.axvline(b, color="c" if a_ is ax[0] else "k", lw=1.8)
        for name, y, c in [("kick", 1500, "tab:red"), ("snare", 5000, "w"), ("hat", 9500, "yellow")]:
            for (ot, s) in doc["onsets"][name]:
                if t0 <= ot <= t1:
                    ax[0].plot([ot], [y], marker="v", color=c, ms=4 + 8 * s)
        for (ot, s) in doc["onsets"]["vocal"]:
            if t0 <= ot <= t1:
                ax[2].plot([ot], [1.02], marker="v", color="tab:purple", ms=3 + 6 * s)
        for s in doc["sections"]:
            if t0 <= s["start"] <= t1:
                ax[1].text(s["start"], 1.02, s["name"], fontsize=14, color="tab:red")
                for a_ in ax:
                    a_.axvline(s["start"], color="tab:red", lw=2.5)
        ax[2].set_xlim(t0, t1)
        ax[2].set_xticks(np.arange(np.ceil(t0), t1, 0.5))
        fig.tight_layout()
        fig.savefig(common.QA / f"audio_{int(t0):03d}.png", dpi=65)
        plt.close(fig)
    # overview
    fig, ax = plt.subplots(2, 1, figsize=(24, 7), sharex=True)
    for k, c in [("rms", "k"), ("low", "tab:red"), ("high", "tab:blue")]:
        ax[0].plot(t, doc[k], color=c, lw=0.6, label=k)
    for k, c in [("vocal", "tab:purple"), ("drums", "tab:orange"), ("bass", "tab:brown"), ("other", "tab:olive")]:
        ax[1].plot(t, doc[k], color=c, lw=0.6, label=k)
    for s in doc["sections"]:
        for a_ in ax:
            a_.axvline(s["start"], color="tab:red", lw=1.5)
        ax[0].text(s["start"] + 0.2, 1.03, s["name"], fontsize=10, color="tab:red")
    for a_ in ax:
        a_.legend(loc="upper right", fontsize=8)
    ax[1].set_xticks(np.arange(0, doc["duration"], 5))
    fig.tight_layout()
    fig.savefig(common.QA / "audio_overview.png", dpi=65)
    plt.close(fig)


if __name__ == "__main__":
    main(plots="--plots" in sys.argv)
