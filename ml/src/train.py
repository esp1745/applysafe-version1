import json
import os

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score

from model import ScamClassifier

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")

BATCH_SIZE = 32
EPOCHS = 15
LR = 1e-4
PATIENCE = 3


def load_split(name):
    d = torch.load(os.path.join(ARTIFACTS_DIR, f"{name}.pt"))
    return TensorDataset(d["input_ids"], d["attn_mask"], d["cat_ids"], d["bin_features"], d["labels"])


def make_loader(name, shuffle):
    return DataLoader(load_split(name), batch_size=BATCH_SIZE, shuffle=shuffle)


def evaluate(model, loader, criterion):
    model.eval()
    total_loss = 0.0
    all_probs, all_labels = [], []
    with torch.no_grad():
        for input_ids, attn_mask, cat_ids, bin_features, labels in loader:
            input_ids, attn_mask = input_ids.to(DEVICE), attn_mask.to(DEVICE)
            cat_ids, bin_features, labels = cat_ids.to(DEVICE), bin_features.to(DEVICE), labels.to(DEVICE)

            logits = model(input_ids, attn_mask, cat_ids, bin_features)
            loss = criterion(logits, labels)
            total_loss += loss.item() * len(labels)

            all_probs.extend(torch.sigmoid(logits).cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    preds = [1 if p >= 0.5 else 0 for p in all_probs]
    precision, recall, f1, _ = precision_recall_fscore_support(
        all_labels, preds, average="binary", zero_division=0
    )
    auc = roc_auc_score(all_labels, all_probs)
    return total_loss / len(loader.dataset), precision, recall, f1, auc


def main():
    with open(os.path.join(ARTIFACTS_DIR, "vocab.json")) as f:
        vocab = json.load(f)
    with open(os.path.join(ARTIFACTS_DIR, "cat_maps.json")) as f:
        cat_maps = json.load(f)
    with open(os.path.join(ARTIFACTS_DIR, "config.json")) as f:
        config = json.load(f)

    cat_cardinalities = [len(cat_maps[col]) for col in config["cat_cols"]]

    train_loader = make_loader("train", shuffle=True)
    val_loader = make_loader("val", shuffle=False)

    model = ScamClassifier(
        vocab_size=len(vocab),
        max_len=config["max_len"],
        cat_cardinalities=cat_cardinalities,
        num_bin_features=4,
    ).to(DEVICE)

    train_labels = load_split("train").tensors[-1]
    n_pos = train_labels.sum().item()
    n_neg = len(train_labels) - n_pos
    pos_weight = torch.tensor([n_neg / n_pos]).to(DEVICE)
    print(f"pos_weight (class imbalance correction): {pos_weight.item():.2f}")

    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    best_f1 = 0.0
    epochs_no_improve = 0

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0.0
        for input_ids, attn_mask, cat_ids, bin_features, labels in train_loader:
            input_ids, attn_mask = input_ids.to(DEVICE), attn_mask.to(DEVICE)
            cat_ids, bin_features, labels = cat_ids.to(DEVICE), bin_features.to(DEVICE), labels.to(DEVICE)

            optimizer.zero_grad()
            logits = model(input_ids, attn_mask, cat_ids, bin_features)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(labels)

        train_loss = total_loss / len(train_loader.dataset)
        val_loss, precision, recall, f1, auc = evaluate(model, val_loader, criterion)
        print(
            f"epoch {epoch}: train_loss={train_loss:.4f} val_loss={val_loss:.4f} "
            f"precision={precision:.3f} recall={recall:.3f} f1={f1:.3f} auc={auc:.3f}"
        )

        if f1 > best_f1:
            best_f1 = f1
            epochs_no_improve = 0
            torch.save(model.state_dict(), os.path.join(ARTIFACTS_DIR, "best_model.pt"))
            print(f"  -> saved new best model (f1={f1:.3f})")
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= PATIENCE:
                print(f"early stopping at epoch {epoch}")
                break

    print(f"training done. best val f1={best_f1:.3f}")


if __name__ == "__main__":
    main()
