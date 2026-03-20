import imagehash
from PIL import Image


def compute_phash(filepath: str) -> str:
      img = Image.open(filepath).convert("RGB")
      return str(imagehash.phash(img))


def hamming_distance(hash1: str, hash2: str) -> int:
      if not hash1 or not hash2:
          return 64
      hash1 = hash1.strip().lower()
      hash2 = hash2.strip().lower()
      if len(hash1) != len(hash2):
          return 64
      try:
          n1 = int(hash1, 16)
          n2 = int(hash2, 16)
          return bin(n1 ^ n2).count('1')
      except ValueError:
          return 64


def similarity_score(distance: int) -> int:
      return max(0, int((1 - distance / 64) * 100))