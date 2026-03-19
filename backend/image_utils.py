import imagehash
from PIL import Image


def compute_phash(filepath: str) -> str:
    img = Image.open(filepath).convert("RGB")
    return str(imagehash.phash(img))


def hamming_distance(hash1: str, hash2: str) -> int:
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    return h1 - h2


def similarity_score(distance: int) -> int:
    return max(0, int((1 - distance / 64) * 100))
