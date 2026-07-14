"""
Custom job-scam classifier, trained from scratch (no pretrained weights):
- token + learned positional embeddings feed a small Transformer encoder
- the [CLS] token's output is pooled as the text representation
- categorical/binary posting metadata is embedded and concatenated in
- an MLP head produces a single fraud logit
"""
import torch
import torch.nn as nn


class ScamClassifier(nn.Module):
    def __init__(
        self,
        vocab_size,
        max_len,
        cat_cardinalities,  # list of vocab sizes for each categorical column
        num_bin_features,
        d_model=128,
        nhead=4,
        num_layers=4,
        dim_feedforward=256,
        cat_emb_dim=16,
        dropout=0.1,
    ):
        super().__init__()
        self.token_emb = nn.Embedding(vocab_size, d_model, padding_idx=0)
        self.pos_emb = nn.Embedding(max_len, d_model)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
        )
        # enable_nested_tensor=False: the nested-tensor fast path used during eval
        # isn't implemented on the MPS backend, so keep the plain codepath.
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers, enable_nested_tensor=False)
        self.text_dropout = nn.Dropout(dropout)

        self.cat_embs = nn.ModuleList(
            [nn.Embedding(card, cat_emb_dim, padding_idx=0) for card in cat_cardinalities]
        )
        struct_dim = cat_emb_dim * len(cat_cardinalities) + num_bin_features

        self.head = nn.Sequential(
            nn.Linear(d_model + struct_dim, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, 1),
        )

    def forward(self, input_ids, attn_mask, cat_ids, bin_features):
        positions = torch.arange(input_ids.size(1), device=input_ids.device).unsqueeze(0)
        x = self.token_emb(input_ids) + self.pos_emb(positions)

        padding_mask = attn_mask == 0  # True = position is padding, ignored by attention
        x = self.encoder(x, src_key_padding_mask=padding_mask)
        pooled_text = self.text_dropout(x[:, 0, :])  # [CLS] token representation

        cat_vecs = [emb(cat_ids[:, i]) for i, emb in enumerate(self.cat_embs)]
        struct = torch.cat(cat_vecs + [bin_features], dim=1)

        combined = torch.cat([pooled_text, struct], dim=1)
        return self.head(combined).squeeze(-1)  # raw logit
