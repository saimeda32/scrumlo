#!/usr/bin/env python3
"""
On-device retro clustering smoke test for EPHEM.

Mirrors the intended browser path: all-MiniLM-L6-v2 sentence embeddings
(384-d, L2-normalized) + agglomerative clustering with cosine distance and
a distance threshold (NO fixed k -- the room doesn't know how many themes
exist). This is the closest CPU/ONNX analog to transformers.js in-browser.

Tries, in order of preference (cheapest browser-faithful first):
  1. fastembed  (ONNX, no torch -- closest to transformers.js runtime)
  2. sentence-transformers/all-MiniLM-L6-v2 (torch)

Usage:
  python3 cluster_test.py [--threshold 0.45]
"""
import json, os, sys, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = json.load(open(os.path.join(HERE, "retro-sample.json")))

# Ground-truth intended themes (0-indexed into CARDS) for scoring.
INTENDED = {
    "CI/CD flakiness":            [0, 1, 2, 3],
    "unclear/shifting scope":     [4, 5, 6, 7],
    "too many meetings":          [8, 9, 10, 11],
    "wins/kudos":                 [12, 13, 14, 15, 20, 21],
    "environment/infra":          [16, 17, 18, 19],
    "estimation misses":          [22, 23],
}

def embed(cards):
    backend = None
    try:
        from fastembed import TextEmbedding
        import numpy as np
        model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
        embs = np.array(list(model.embed(cards)))
        backend = "fastembed/all-MiniLM-L6-v2"
        return embs, backend
    except Exception as e:
        sys.stderr.write(f"[fastembed unavailable: {e}]\n")
    from sentence_transformers import SentenceTransformer
    import numpy as np
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embs = model.encode(cards, normalize_embeddings=True)
    backend = "sentence-transformers/all-MiniLM-L6-v2"
    return np.array(embs), backend

def l2norm(x):
    import numpy as np
    n = np.linalg.norm(x, axis=1, keepdims=True)
    n[n == 0] = 1.0
    return x / n

def cluster(embs, threshold):
    from sklearn.cluster import AgglomerativeClustering
    embs = l2norm(embs)  # cosine distance == 1 - dot on unit vectors
    # average linkage tends to give cleaner thematic groups than single.
    model = AgglomerativeClustering(
        n_clusters=None, metric="cosine", linkage="average",
        distance_threshold=threshold,
    )
    return model.fit_predict(embs)

def score(labels):
    """Greedy best-match each predicted cluster to an intended theme; report
    precision/recall-ish coverage. Returns (pairs_correct_fraction)."""
    from collections import defaultdict
    pred = defaultdict(list)
    for i, l in enumerate(labels):
        pred[l].append(i)
    # pair-counting (cluster-agnostic): of all same-theme card pairs, how many
    # are placed in the same predicted cluster (recall); of all same-cluster
    # pairs, how many share a theme (precision).
    theme_of = {}
    for t, idxs in INTENDED.items():
        for i in idxs:
            theme_of[i] = t
    def pairs(groups):
        s = set()
        for g in groups.values():
            for a in range(len(g)):
                for b in range(a+1, len(g)):
                    s.add((g[a], g[b]))
        return s
    same_theme = pairs({t: idxs for t, idxs in INTENDED.items()})
    same_pred = pairs(pred)
    tp = len(same_theme & same_pred)
    prec = tp / len(same_pred) if same_pred else 1.0
    rec = tp / len(same_theme) if same_theme else 1.0
    f1 = 2*prec*rec/(prec+rec) if (prec+rec) else 0.0
    return prec, rec, f1, pred, theme_of

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.45)
    ap.add_argument("--sweep", action="store_true")
    args = ap.parse_args()

    embs, backend = embed(CARDS)
    print(f"backend: {backend}  shape: {embs.shape}")

    thresholds = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60] if args.sweep else [args.threshold]
    for th in thresholds:
        labels = cluster(embs, th)
        prec, rec, f1, pred, theme_of = score(labels)
        print(f"\n=== threshold={th}  clusters={len(set(labels))}  "
              f"precision={prec:.2f} recall={rec:.2f} f1={f1:.2f} ===")
        for cid in sorted(pred):
            members = pred[cid]
            themes = {theme_of[i] for i in members}
            tag = next(iter(themes)) if len(themes) == 1 else f"MIXED{sorted(themes)}"
            print(f"  cluster {cid} [{tag}]:")
            for i in members:
                print(f"      - {CARDS[i]!r}")

if __name__ == "__main__":
    main()
