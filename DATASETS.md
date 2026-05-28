# Dataset Notes

This project now has a small local test pack for quick uploads:

```text
test_videos/
  labels.csv
  normal/
    normal_N_9.mp4
    normal_N_21.mp4
  lame/
    lame_L_1.mp4
    lame_L_18.mp4
```

Use these first to test the deployed frontend/backend.

## Recommended External Datasets

### 1. CBVD-5 Cow Behavior Video Dataset

Best for group cow surveillance videos.

- Source: Kaggle
- Labels: bounding boxes and behavior labels
- Behaviors: standing, lying down, feeding, drinking, rumination
- Limitation: not labeled as lame/normal

Download with Kaggle CLI after setting up `kaggle.json`:

```powershell
kaggle datasets download -d fandaoerji/cbvd-5cow-behavior-video-dataset -p external_datasets/cbvd5 --unzip
```

### 2. CowScreeningDB

Best public benchmark for true cow lameness labels.

- Source: GitHub / research repositories
- Labels: healthy/lame lameness scores
- Limitation: sensor data, not RGB video

```powershell
git clone https://github.com/Shahid-Ismail/CowScreeningDB-A-public-database-for-lameness-detection external_datasets/CowScreeningDB
```

### 3. Internet-Sourced Lameness Video Dataset

A 2025 arXiv paper describes a balanced 50-video dataset of cattle clips labeled lame/non-lame. It is suitable for video-based lameness classification if the authors' released media can be accessed.

- Labels: lame and non-lame
- Limitation: small dataset and not necessarily group/herd surveillance video

Paper: `Direct Video-Based Spatiotemporal Deep Learning for Cattle Lameness Detection`

## Practical Recommendation

For this current app:

1. Use `test_videos/lame/lame_L_1.mp4` to test suspected/lame output.
2. Use `test_videos/normal/normal_N_9.mp4` to test normal output.
3. Use CBVD-5 if you need group cow videos for detection/tracking UI demos.
4. Use CowScreeningDB or the 50-video lameness paper if you need real lameness research labels.
