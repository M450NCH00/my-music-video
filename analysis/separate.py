"""Stem separation -> stems/htdemucs_ft/song/{vocals,drums,bass,other}.wav

The mp3 is first decoded with ffmpeg (gapless, 44.1 kHz stereo) to
work/mix.wav, which is the time reference for everything else; Demucs runs on
that file, so the stems are sample-aligned with it.

Run:  uv run python separate.py [model]
"""
import common
import subprocess
import sys

import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model


def main(name="htdemucs_ft"):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(common.AUDIO), "-vn", "-ar", "44100", "-ac", "2",
                    "-c:a", "pcm_s16le", str(common.MIX_WAV)], check=True)
    y, sr = sf.read(common.MIX_WAV, dtype="float32", always_2d=True)
    assert sr == 44100
    model = get_model(name)
    model.eval()
    wav = torch.from_numpy(y.T.copy())
    ref = wav.mean(0)
    x = (wav - ref.mean()) / ref.std()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    with torch.inference_mode():
        out = apply_model(model, x[None], device=device, shifts=1, split=True, overlap=0.25, progress=True)[0]
    out = out * ref.std() + ref.mean()
    common.STEMS.mkdir(parents=True, exist_ok=True)
    for src, stem in zip(out, model.sources):
        sf.write(common.STEMS / f"{stem}.wav", src.T.cpu().numpy(), sr, subtype="PCM_16")
        print("wrote", stem, tuple(src.shape))


if __name__ == "__main__":
    main(*sys.argv[1:2])
