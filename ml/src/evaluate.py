import json
import os

import torch
import torch.nn as nn

from model import ScamClassifier
from train import ARTIFACTS_DIR, DEVICE, make_loader, evaluate


def main():
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

    test_loader = make_loader("test", shuffle=False)
    criterion = nn.BCEWithLogitsLoss()
    loss, precision, recall, f1, auc = evaluate(model, test_loader, criterion)
    print(f"TEST: loss={loss:.4f} precision={precision:.3f} recall={recall:.3f} f1={f1:.3f} auc={auc:.3f}")


if __name__ == "__main__":
    main()
