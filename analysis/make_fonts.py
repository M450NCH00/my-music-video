"""Fonts for the renderer -> app/public/fonts/

The Chinese fonts are subsets.  A full CJK font is 17-28 MB; a subset holds only the
characters the video can show (CHARS below: the lyrics, the title, punctuation, digits,
Latin letters and EXTRA) and is about 100 KB.

  LXGWWenKai-{300,400,500}.ttf   LXGW WenKai (霞鹜文楷) Light / Regular / Medium   F.hand()
  NotoSansSC-{400,500,700}.ttf   Noto Sans SC, instances of its variable font       F.sans()

The full fonts are downloaded once into analysis/.cache/fonts/ (not in the repo).

A character that is in none of CHARS shows in a fallback font (the renderer warns in
the console): add it to EXTRA and run this again.

Run:  uv run python make_fonts.py            # the Chinese subsets
      uv run python make_fonts.py --latin    # the static Archivo / Cormorant instances
"""
import common
import io
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = common.PROJECT / "app" / "public" / "fonts"
SRC = common.CACHE / "fonts"

TITLE = "《下课再见》"
# Chinese and Western punctuation, then everything on a keyboard (digits, Latin letters, signs).
PUNCT = "，。、；：？！…—·～“”‘’（）《》〈〉「」『』【】" + "".join(chr(c) for c in range(0x20, 0x7F))
# Signs for what gets written on the blackboard and doodled in the air.
SIGNS = "×÷±≠≈≤≥√²³π∞°△∠♪♡♥★☆→←↑↓"
# Characters that are in neither the lyrics nor the title but are written somewhere on screen.
# (The date on the blackboard and the pages of the wall calendar: 年 月 日 星期 一..六.)
EXTRA = "年月日星期二三四五六"

WENKAI = "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-{}.ttf"
FONTS = {
    "LXGWWenKai-Light.ttf": WENKAI.format("Light"),
    "LXGWWenKai-Regular.ttf": WENKAI.format("Regular"),
    "LXGWWenKai-Medium.ttf": WENKAI.format("Medium"),
    "NotoSansSC[wght].ttf": "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
}
LICENSES = {
    "OFL-LXGWWenKai.txt": "https://raw.githubusercontent.com/lxgw/LxgwWenKai/v1.522/OFL.txt",
    "OFL-NotoSansSC.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt",
}


def lyric_chars():
    return "".join(t for _, _, t in common.load_lyrics_src())


def chars():
    """Every character of the subsets, sorted."""
    return "".join(sorted(set(lyric_chars() + TITLE + PUNCT + SIGNS + EXTRA)))


def fetch(url, path):
    if path.exists() and path.stat().st_size > 0:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    print("downloading", url)
    req = urllib.request.Request(url, headers={"User-Agent": "make_fonts.py"})
    with urllib.request.urlopen(req) as r:
        data = r.read()
    path.write_bytes(data)
    return path


def subset_font(font, text):
    """`font` reduced to the characters of `text` (in place)."""
    o = subset.Options()
    o.name_IDs = ["*"]          # keep the names: they carry the copyright and the licence
    o.hinting = False           # (hints do nothing at the sizes the video draws at)
    o.notdef_outline = True
    s = subset.Subsetter(o)
    s.populate(text=text)
    s.subset(font)
    return font


def missing(font, text):
    cmap = font.getBestCmap()
    return "".join(c for c in text if ord(c) not in cmap)


def cjk():
    text = chars()
    need = "".join(sorted(set(lyric_chars() + TITLE + EXTRA)))  # these must be in every font
    SRC.mkdir(parents=True, exist_ok=True)
    for name, url in FONTS.items():
        fetch(url, SRC / name)
    for name, url in LICENSES.items():
        fetch(url, OUT / name)

    made = []
    for weight, style in ((300, "Light"), (400, "Regular"), (500, "Medium")):
        f = subset_font(TTFont(SRC / f"LXGWWenKai-{style}.ttf"), text)
        made.append((f"LXGWWenKai-{weight}.ttf", f))
    # Noto: subset the variable font first, then cut each weight out of the small one
    buf = io.BytesIO()
    subset_font(TTFont(SRC / "NotoSansSC[wght].ttf"), text).save(buf)
    for weight in (400, 500, 700):
        buf.seek(0)
        f = instancer.instantiateVariableFont(TTFont(buf), {"wght": weight}, updateFontNames=True)
        made.append((f"NotoSansSC-{weight}.ttf", f))

    print(f"{len(text)} characters ({len(set(lyric_chars()) - {' '})} from the lyrics)")
    ok = True
    for name, f in made:
        f.save(OUT / name)
        gone, bad = missing(f, text), missing(f, need)
        print(f"  {name:22s} {(OUT / name).stat().st_size / 1024:6.0f} KB" + (f"   not in this font: {gone}" if gone else ""))
        if bad:
            ok = False
            print(f"    MISSING characters of the lyrics / title / EXTRA: {bad}")
    if not ok:
        raise SystemExit("some characters the video needs are missing from a font")


def latin():
    """Static instances of the variable Latin fonts in app/public/fonts/src (canvas and opentype.js need static outlines)."""
    src = OUT / "src"
    jobs = []
    for wd in [62, 75, 87.5, 100, 112.5, 125]:
        for wt in [300, 500, 700, 900]:
            jobs.append(("Archivo[wdth,wght].ttf", {"wdth": wd, "wght": wt}, f"Archivo-w{int(wd*10)}-{wt}.ttf"))
    for wd in [75, 100]:
        for wt in [400, 800]:
            jobs.append(("Archivo-Italic[wdth,wght].ttf", {"wdth": wd, "wght": wt}, f"ArchivoItalic-w{int(wd*10)}-{wt}.ttf"))
    for wt in [400, 600]:
        jobs.append(("CormorantGaramond[wght].ttf", {"wght": wt}, f"Cormorant-{wt}.ttf"))
        jobs.append(("CormorantGaramond-Italic[wght].ttf", {"wght": wt}, f"CormorantItalic-{wt}.ttf"))
    for s, loc, name in jobs:
        inst = instancer.instantiateVariableFont(TTFont(src / s), loc, updateFontNames=False)
        inst.save(OUT / name)
    print(len(jobs), "instances")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    latin() if "--latin" in sys.argv else cjk()
