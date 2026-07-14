"""
Exports the trained PyTorch model to ONNX so the Node.js backend can run
inference via onnxruntime-node without needing PyTorch/Python in production.
"""
import json
import os

import torch

from model import ScamClassifier

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")


def main():
    with open(os.path.join(ARTIFACTS_DIR, "vocab.json")) as f:
        vocab = json.load(f)
    with open(os.path.join(ARTIFACTS_DIR, "cat_maps.json")) as f:
        cat_maps = json.load(f)
    with open(os.path.join(ARTIFACTS_DIR, "config.json")) as f:
        config = json.load(f)

    cat_cardinalities = [len(cat_maps[col]) for col in config["cat_cols"]]
    max_len = config["max_len"]

    model = ScamClassifier(
        vocab_size=len(vocab),
        max_len=max_len,
        cat_cardinalities=cat_cardinalities,
        num_bin_features=4,
    )
    model.load_state_dict(torch.load(os.path.join(ARTIFACTS_DIR, "best_model.pt"), map_location="cpu"))
    model.eval()

    dummy_input_ids = torch.zeros((1, max_len), dtype=torch.long)
    dummy_attn_mask = torch.ones((1, max_len), dtype=torch.long)
    dummy_cat_ids = torch.zeros((1, len(cat_cardinalities)), dtype=torch.long)
    dummy_bin_features = torch.zeros((1, 4), dtype=torch.float)

    onnx_path = os.path.join(ARTIFACTS_DIR, "model.onnx")
    torch.onnx.export(
        model,
        (dummy_input_ids, dummy_attn_mask, dummy_cat_ids, dummy_bin_features),
        onnx_path,
        input_names=["input_ids", "attn_mask", "cat_ids", "bin_features"],
        output_names=["logit"],
        dynamic_axes={
            "input_ids": {0: "batch"},
            "attn_mask": {0: "batch"},
            "cat_ids": {0: "batch"},
            "bin_features": {0: "batch"},
            "logit": {0: "batch"},
        },
        opset_version=14,
    )
    print(f"exported to {onnx_path}")

    # Sanity-check the export against the original PyTorch model
    import onnxruntime as ort
    import numpy as np

    session = ort.InferenceSession(onnx_path)
    torch_out = model(dummy_input_ids, dummy_attn_mask, dummy_cat_ids, dummy_bin_features)
    onnx_out = session.run(
        None,
        {
            "input_ids": dummy_input_ids.numpy(),
            "attn_mask": dummy_attn_mask.numpy(),
            "cat_ids": dummy_cat_ids.numpy(),
            "bin_features": dummy_bin_features.numpy(),
        },
    )
    diff = np.abs(torch_out.detach().numpy() - onnx_out[0]).max()
    print(f"max diff between torch and onnx output: {diff}")
    assert diff < 1e-4, "ONNX export mismatch!"
    print("ONNX export verified OK")


if __name__ == "__main__":
    main()
