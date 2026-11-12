"""Dependency-free text embeddings for retrieval.

A signed feature-hashing embedding over word unigrams + bigrams + domain-term boosts
(sublinear TF, L2-normalized). It is deterministic, offline and fast, and it fits in a pgvector
`vector(384)` column. Swap `embed()` for a hosted embedding model if you have one; the rest of
the pipeline (pgvector schema, cosine search) is unchanged.
"""
from __future__ import annotations

import math
import re
import zlib

DIM = 384
_STOP = set("""a an the of and or in on at to for from by with without is are was were be been this that these those it its as
into than then there their which who whom what when where how why can could may might will would should do does did not no
also such very more most less least over under between within about after before during each other any all some""".split())
_SYN = {"o₂": "o2", "oxygen": "o2", "co₂": "co2", "μg": "microgravity", "ug": "microgravity", "zerog": "microgravity",
        "lunar": "moon", "extinguish": "extinction", "extinguishment": "extinction", "suppressant": "suppression",
        "detector": "detection", "smoke": "smoke", "flammable": "flammability", "spread": "spread"}


def tokens(text: str) -> list[str]:
    t = text.lower().replace("₂", "2")
    words = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", t)
    out = []
    for w in words:
        w = _SYN.get(w, w)
        if w in _STOP or len(w) < 2:
            continue
        if len(w) > 5 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def _h(s: str) -> tuple[int, float]:
    v = zlib.crc32(s.encode())
    return v % DIM, (1.0 if (v >> 16) & 1 else -1.0)


def embed(text: str) -> list[float]:
    toks = tokens(text)
    feats: dict[str, float] = {}
    for t in toks:
        feats[t] = feats.get(t, 0) + 1
    for a, b in zip(toks, toks[1:]):
        k = f"{a}_{b}"
        feats[k] = feats.get(k, 0) + 0.7
    vec = [0.0] * DIM
    for f, c in feats.items():
        i, s = _h(f)
        vec[i] += s * (1 + math.log(c)) if c >= 1 else s * c
    n = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / n for x in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
