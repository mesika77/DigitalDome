import imagehash
from PIL import Image


def compute_phash(filepath: str) -> str:
    img = Image.open(filepath).convert("RGB")
    return str(imagehash.phash(img))


def hamming_distance(hash1: str, hash2: str) -> int:
    if not hash1 or not hash2:
        return 64
    try:
        # Clean the hash strings - remove any whitespace or unexpected chars
        hash1 = hash1.strip()
        hash2 = hash2.strip()
        h1 = imagehash.hex_to_hash(hash1)
        h2 = imagehash.hex_to_hash(hash2)
        return h1 - h2
    except Exception:
        # If hashes are incompatible lengths or formats, return max distance
        return 64


def similarity_score(distance: int) -> int:
    return max(0, int((1 - distance / 64) * 100))
