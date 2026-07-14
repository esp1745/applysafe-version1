"""
Score a single job posting with the trained model.

Usage:
    python3 predict.py --title "..." --description "..." [--company_profile ...] [--requirements ...] \\
        [--benefits ...] [--employment_type "Full-time"] [--required_experience "Mid-Senior level"] \\
        [--required_education "Bachelor's Degree"] [--industry "..."] [--function "..."] \\
        [--telecommuting] [--has_company_logo] [--has_questions] [--has_salary]
"""
import argparse
import json
import os

import torch

from model import ScamClassifier
from preprocess import encode_text, CAT_COLS
from train import ARTIFACTS_DIR, DEVICE


def load_model():
    with open(os.path.join(ARTIFACTS_DIR, "vocab.json")) as f:
        vocab = json.load(f)
    with open(os.path.join(ARTIFACTS_DIR, "cat_maps.json")) as f:
        cat_maps = json.load(f)
    with open(os.path.join(ARTIFACTS_DIR, "config.json")) as f:
        config = json.load(f)

    cat_cardinalities = [len(cat_maps[col]) for col in config["cat_cols"]]
    model = ScamClassifier(
        vocab_size=len(vocab),
        max_len=config["max_len"],
        cat_cardinalities=cat_cardinalities,
        num_bin_features=4,
    ).to(DEVICE)
    model.load_state_dict(torch.load(os.path.join(ARTIFACTS_DIR, "best_model.pt"), map_location=DEVICE))
    model.eval()
    return model, vocab, cat_maps, config


def predict(model, vocab, cat_maps, config, posting):
    full_text = " ".join(
        posting.get(col, "") or "" for col in ["title", "company_profile", "description", "requirements", "benefits"]
    )
    ids, attn = encode_text(full_text, vocab, config["max_len"])
    input_ids = torch.tensor([ids]).to(DEVICE)
    attn_mask = torch.tensor([attn]).to(DEVICE)

    cat_ids = torch.tensor(
        [[cat_maps[col].get(posting.get(col, "__missing__"), 0) for col in CAT_COLS]]
    ).to(DEVICE)
    bin_features = torch.tensor(
        [[
            float(posting.get("telecommuting", False)),
            float(posting.get("has_company_logo", False)),
            float(posting.get("has_questions", False)),
            float(posting.get("has_salary", False)),
        ]]
    ).to(DEVICE)

    with torch.no_grad():
        logit = model(input_ids, attn_mask, cat_ids, bin_features)
        prob = torch.sigmoid(logit).item()
    return prob


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", default="")
    parser.add_argument("--company_profile", default="")
    parser.add_argument("--description", default="")
    parser.add_argument("--requirements", default="")
    parser.add_argument("--benefits", default="")
    parser.add_argument("--employment_type", default="__missing__")
    parser.add_argument("--required_experience", default="__missing__")
    parser.add_argument("--required_education", default="__missing__")
    parser.add_argument("--industry", default="__missing__")
    parser.add_argument("--function", default="__missing__")
    parser.add_argument("--telecommuting", action="store_true")
    parser.add_argument("--has_company_logo", action="store_true")
    parser.add_argument("--has_questions", action="store_true")
    parser.add_argument("--has_salary", action="store_true")
    args = parser.parse_args()

    model, vocab, cat_maps, config = load_model()
    prob = predict(model, vocab, cat_maps, config, vars(args))

    print(f"fraud probability: {prob:.4f}")
    print("verdict:", "LIKELY SCAM" if prob >= 0.5 else "likely legitimate")


if __name__ == "__main__":
    main()
