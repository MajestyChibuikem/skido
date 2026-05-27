"""
Downloads the CattleLameness dataset from shivanandpal91/CattleLameness on GitHub.
Run from the project root:  python download_dataset.py
Creates: ./dataset/Lame/*.mp4 and ./dataset/Normal/*.mp4
"""

import os
import urllib.request
import urllib.parse

BASE = "https://raw.githubusercontent.com/shivanandpal91/CattleLameness/main/Data"

LAME_FILES = [
    "InShot_20260512_165137429.mp4",
    "InShot_20260512_165219490.mp4",
    "InShot_20260512_165428683.mp4",
    "InShot_20260512_165631890.mp4",
    "InShot_20260512_165854203.mp4",
    "InShot_20260512_170230011.mp4",
    "InShot_20260512_170347082.mp4",
    "L (1).mp4",  "L (2).mp4",  "L (3).mp4",  "L (4).mp4",  "L (5).mp4",
    "L (6).mp4",  "L (7).mp4",  "L (8).mp4",  "L (9).mp4",  "L (10).mp4",
    "L (11).mp4", "L (12).mp4", "L (13).mp4", "L (14).mp4", "L (15).mp4",
    "L (16).mp4", "L (17).mp4", "L (18).mp4", "L (19).mp4", "L (20).mp4",
    "L (21).mp4", "L (22).mp4", "L (23).mp4", "L (24).mp4", "L (25).mp4",
]

NORMAL_FILES = [
    "Cow_Walking_Peacefully_in_Village_Fields_\U0001f404___Relaxing_Nature_Scene___AI_Cinematic_Animal_Video_4K(360p).mp4",
    "InShot_20260512_174912661.mp4",
    "InShot_20260512_175615521.mp4",
    "InShot_20260512_180314415.mp4",
    "N (1).mp4",  "N (2).mp4",  "N (3).mp4",  "N (4).mp4",  "N (5).mp4",
    "N (6).mp4",  "N (7).mp4",  "N (8).mp4",  "N (9).mp4",  "N (10).mp4",
    "N (11).mp4", "N (12).mp4", "N (13).mp4", "N (14).mp4", "N (15).mp4",
    "N (16).mp4", "N (17).mp4", "N (18).mp4", "N (19).mp4", "N (20).mp4",
    "N (21).mp4", "N (22).mp4", "N (23).mp4", "N (24).mp4", "N (25).mp4",
]


def download(label, filenames, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    for name in filenames:
        dest = os.path.join(dest_dir, name)
        if os.path.exists(dest):
            print(f"  [skip] {name}")
            continue
        url = f"{BASE}/{label}/{urllib.parse.quote(name)}"
        print(f"  {name} ...", end=" ", flush=True)
        try:
            urllib.request.urlretrieve(url, dest)
            size_kb = os.path.getsize(dest) // 1024
            print(f"{size_kb} KB")
        except Exception as e:
            print(f"FAILED: {e}")


if __name__ == "__main__":
    root = os.path.dirname(os.path.abspath(__file__))
    lame_dir   = os.path.join(root, "dataset", "Lame")
    normal_dir = os.path.join(root, "dataset", "Normal")

    print(f"Downloading {len(LAME_FILES)} Lame videos...")
    download("Lame", LAME_FILES, lame_dir)

    print(f"\nDownloading {len(NORMAL_FILES)} Normal videos...")
    download("Normal", NORMAL_FILES, normal_dir)

    lame_count   = len([f for f in os.listdir(lame_dir)   if f.endswith(".mp4")])
    normal_count = len([f for f in os.listdir(normal_dir) if f.endswith(".mp4")])
    print(f"\nDone. Lame: {lame_count} videos, Normal: {normal_count} videos")
    print(f"Dataset at: {os.path.join(root, 'dataset')}")
