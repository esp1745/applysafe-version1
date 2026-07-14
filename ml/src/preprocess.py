"""
Prepares the Kaggle fake_job_postings.csv dataset for training:
- merges text fields, tokenizes, builds a vocab from the train split only
- label-encodes categorical fields, keeps binary flags
- stratified train/val/test split (80/10/10)
- saves tensors + vocab/category maps to ml/artifacts/
"""
import json
import re
import os

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "fake_job_postings.csv")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")

TEXT_COLS = ["title", "company_profile", "description", "requirements", "benefits"]
CAT_COLS = ["employment_type", "required_experience", "required_education", "industry", "function"]
MAX_LEN = 400
VOCAB_SIZE = 20000
MIN_FREQ = 2

PAD, UNK, CLS = "<pad>", "<unk>", "<cls>"

TOKEN_RE = re.compile(r"[a-z0-9']+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


def build_vocab(texts):
    freq = {}
    for text in texts:
        for tok in tokenize(text):
            freq[tok] = freq.get(tok, 0) + 1
    kept = [tok for tok, count in sorted(freq.items(), key=lambda x: -x[1]) if count >= MIN_FREQ]
    kept = kept[: VOCAB_SIZE - 3]
    vocab = {PAD: 0, UNK: 1, CLS: 2}
    for tok in kept:
        vocab[tok] = len(vocab)
    return vocab


def encode_text(text, vocab, max_len=MAX_LEN):
    ids = [vocab[CLS]] + [vocab.get(tok, vocab[UNK]) for tok in tokenize(text)]
    ids = ids[:max_len]
    attn = [1] * len(ids)
    pad_len = max_len - len(ids)
    ids += [vocab[PAD]] * pad_len
    attn += [0] * pad_len
    return ids, attn


def main():
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    df = pd.read_csv(DATA_PATH)

    df["full_text"] = df[TEXT_COLS].fillna("").agg(" ".join, axis=1)
    df["has_salary"] = df["salary_range"].notna().astype(int)
    for col in CAT_COLS:
        df[col] = df[col].fillna("__missing__")

    labels = df["fraudulent"].values
    idx = np.arange(len(df))

    train_idx, temp_idx = train_test_split(idx, test_size=0.2, stratify=labels, random_state=42)
    val_idx, test_idx = train_test_split(
        temp_idx, test_size=0.5, stratify=labels[temp_idx], random_state=42
    )

    print(f"train={len(train_idx)} val={len(val_idx)} test={len(test_idx)}")

    vocab = build_vocab(df.iloc[train_idx]["full_text"])
    print(f"vocab size: {len(vocab)}")

    cat_maps = {}
    for col in CAT_COLS:
        cats = sorted(df.iloc[train_idx][col].unique())
        cat_maps[col] = {"__unk__": 0, **{c: i + 1 for i, c in enumerate(cats)}}

    with open(os.path.join(ARTIFACTS_DIR, "vocab.json"), "w") as f:
        json.dump(vocab, f)
    with open(os.path.join(ARTIFACTS_DIR, "cat_maps.json"), "w") as f:
        json.dump(cat_maps, f)
    with open(os.path.join(ARTIFACTS_DIR, "config.json"), "w") as f:
        json.dump({"max_len": MAX_LEN, "cat_cols": CAT_COLS}, f)

    def build_split(split_idx, name):
        sub = df.iloc[split_idx]
        input_ids = torch.zeros((len(sub), MAX_LEN), dtype=torch.long)
        attn_mask = torch.zeros((len(sub), MAX_LEN), dtype=torch.long)
        for i, text in enumerate(sub["full_text"]):
            ids, attn = encode_text(text, vocab)
            input_ids[i] = torch.tensor(ids)
            attn_mask[i] = torch.tensor(attn)

        cat_ids = torch.zeros((len(sub), len(CAT_COLS)), dtype=torch.long)
        for j, col in enumerate(CAT_COLS):
            cat_ids[:, j] = torch.tensor(
                [cat_maps[col].get(v, 0) for v in sub[col]], dtype=torch.long
            )

        bin_features = torch.tensor(
            sub[["telecommuting", "has_company_logo", "has_questions", "has_salary"]].values,
            dtype=torch.float,
        )
        y = torch.tensor(sub["fraudulent"].values, dtype=torch.float)

        torch.save(
            {
                "input_ids": input_ids,
                "attn_mask": attn_mask,
                "cat_ids": cat_ids,
                "bin_features": bin_features,
                "labels": y,
            },
            os.path.join(ARTIFACTS_DIR, f"{name}.pt"),
        )
        print(f"saved {name}.pt: {len(sub)} rows, {int(y.sum())} positive")

    build_split(train_idx, "train")
    build_split(val_idx, "val")
    build_split(test_idx, "test")


if __name__ == "__main__":
    main()
