"""Lyric line -> display tokens and the pronunciation spelling used for CTC alignment.

A line is split into display tokens: every Chinese character is one token
(punctuation stays attached to the character next to it), and a run of Latin
letters / digits is one token.  Each token maps to one or more pronunciation
sub-words made of plain letters: toneless pinyin for a character (read in the
context of its line, so 还 is "hai" or "huan" as needed), the lowercased
letters for a Latin word.
"""
import re

from pypinyin import Style, lazy_pinyin

# (line text, token index) -> pinyin, where the dictionary reading is not the sung one
PRON = {
    ("你问我怎么还不还", 5): "hai",
    ("你问我怎么还不还", 7): "huan",
}

CJK = re.compile(r"[㐀-鿿]")
OPENERS = "“‘「『（(《"


def tokenize(text: str) -> list[str]:
    """Display tokens of a line; joined (plus the spaces of the source) they give the line back."""
    out: list[str] = []
    pre = ""
    for part in text.split():
        buf = ""  # a Latin run in progress
        for ch in part:
            if CJK.match(ch):
                if buf:
                    out.append(buf)
                    buf = ""
                out.append(pre + ch)
                pre = ""
            elif ch.isalnum() or (buf and ch in "'’-"):
                buf += ch
            elif ch in OPENERS:
                if buf:
                    out.append(buf)
                    buf = ""
                pre += ch
            elif buf:
                buf += ch
            elif out:
                out[-1] += ch
            else:
                pre += ch
        if buf:
            out.append(pre + buf)
            pre = ""
    return out


def line_prons(text: str) -> list[list[str]]:
    """Pronunciation sub-words of every token of a line."""
    toks = tokenize(text)
    chars = [c for c in text if CJK.match(c)]
    py = lazy_pinyin("".join(chars), style=Style.NORMAL, v_to_u=False)
    assert len(py) == len(chars), text
    out, k = [], 0
    for ti, tok in enumerate(toks):
        if CJK.search(tok):
            p = PRON.get((text, ti), py[k])
            k += 1
            out.append([re.sub(r"[^a-z]", "", p.replace("ü", "u").replace("v", "u"))])
        else:
            w = re.sub(r"[^a-z' ]", " ", tok.lower().replace("’", "'")).strip("' ")
            out.append([p.strip("'") for p in w.split() if p.strip("'")])
    return out


if __name__ == "__main__":
    import sys
    import common
    sys.stdout.reconfigure(encoding="utf-8")
    for i, (_, _, t) in enumerate(common.load_lyrics_src()):
        print(i, " ".join(tokenize(t)), "->", " ".join(" ".join(p) for p in line_prons(t)))
