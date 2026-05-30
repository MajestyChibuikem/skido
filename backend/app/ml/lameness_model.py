"""
LamenessSeverityModel — causal Transformer for cattle lameness detection.

Architecture:
  Multi-modal fusion (pose + flow + optional VideoMAE)
  → domain normalization → causal Transformer encoder
  → MIL attention pooling → severity regression (0-3 scale)

To use:
  1. Train via CowLameness/Colab_Notebook/Cow_Lameness_Analysis_v33.ipynb
  2. Export: torch.save(trainer.model.state_dict(), 'best_model.pt')
  3. Drop best_model.pt into backend/app/ml/models/
  4. transformer_analyzer.py auto-loads it on first call.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple


class MultiModalFusion(nn.Module):
    def __init__(self, pose_dim=16, flow_dim=3, video_dim=128,
                 use_pose=True, use_flow=True, use_videomae=True):
        super().__init__()
        self.use_pose = use_pose
        self.use_flow = use_flow
        self.use_videomae = use_videomae

        self.pose_encoder = nn.Sequential(
            nn.Linear(pose_dim, 128), nn.ReLU(), nn.LayerNorm(128), nn.Dropout(0.1)
        ) if use_pose else None

        self.flow_encoder = nn.Sequential(
            nn.Linear(flow_dim, 64), nn.ReLU(), nn.LayerNorm(64), nn.Dropout(0.1)
        ) if use_flow else None

        self.video_encoder = nn.Sequential(
            nn.Linear(video_dim, 128), nn.ReLU(), nn.LayerNorm(128), nn.Dropout(0.1)
        ) if use_videomae else None

        self.total_dim = (128 if use_pose else 0) + (64 if use_flow else 0) + (128 if use_videomae else 0)

    def forward(self, pose=None, flow=None, video=None):
        features = []
        if self.use_pose and pose is not None:
            if pose.dim() == 4:
                pose = pose.mean(dim=2)
            features.append(self.pose_encoder(pose))
        if self.use_flow and flow is not None:
            features.append(self.flow_encoder(flow))
        if self.use_videomae and video is not None:
            features.append(self.video_encoder(video))
        if not features:
            raise ValueError("At least one modality must be provided.")
        return torch.cat(features, dim=-1)


class LamenessSeverityModel(nn.Module):
    def __init__(self, config: dict, mode: str = "regression"):
        super().__init__()
        self.config = config
        self.mode = mode

        self.fusion = MultiModalFusion(
            pose_dim=config.get("POSE_DIM", 16),
            flow_dim=config.get("FLOW_DIM", 3),
            video_dim=config.get("VIDEO_DIM", 128),
            use_pose=config.get("USE_POSE", True),
            use_flow=config.get("USE_FLOW", True),
            use_videomae=config.get("USE_VIDEOMAE", False),
        )
        total_dim = self.fusion.total_dim

        self.domain_norm = nn.LayerNorm(total_dim)
        self.pos_encoding = self._make_pe(total_dim)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=total_dim, nhead=config.get("NUM_HEADS", 8),
            dim_feedforward=total_dim * 4, dropout=0.1, batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=config.get("NUM_LAYERS", 4))

        self.attention = nn.Sequential(nn.Linear(total_dim, 64), nn.Tanh(), nn.Linear(64, 1))

        self.head = nn.Sequential(
            nn.Linear(total_dim, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 1), nn.Sigmoid(),
        )
        self._causal_mask = None

    def _make_pe(self, d_model: int, max_len: int = 500):
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        return nn.Parameter(pe.unsqueeze(0), requires_grad=False)

    def _causal(self, n: int, device) -> torch.Tensor:
        if self._causal_mask is None or self._causal_mask.size(0) != n:
            self._causal_mask = torch.triu(torch.ones(n, n, device=device), diagonal=1).bool()
        return self._causal_mask

    def forward(self, pose=None, flow=None, video=None,
                use_causal=True) -> Tuple[torch.Tensor, torch.Tensor]:
        x = self.fusion(pose, flow, video)
        B, N, D = x.shape
        x = self.domain_norm(x)
        x = x + self.pos_encoding[:, :N, :]
        mask = self._causal(N, x.device) if use_causal else None
        x = self.transformer(x, mask=mask)
        attn_w = F.softmax(self.attention(x).squeeze(-1), dim=1)
        bag = (x * attn_w.unsqueeze(-1)).sum(dim=1)
        pred = self.head(bag).squeeze(-1)
        if self.mode == "regression":
            pred = pred * 3.0
        return pred, attn_w
