from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp" / "pdfs"
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)


def save_web(image: Image.Image, name: str, quality: int = 90) -> None:
    image = image.convert("RGB")
    image.save(ASSETS / name, "WEBP", quality=quality, method=6)


def split_trifold(path: Path, prefix: str) -> None:
    image = Image.open(path).convert("RGB")
    width, height = image.size
    cuts = (0, round(width / 3), round(2 * width / 3), width)
    for index in range(3):
        panel = image.crop((cuts[index], 0, cuts[index + 1], height))
        save_web(panel, f"{prefix}-{index + 1}.webp", 92)


split_trifold(TMP / "bio-1.png", "folder-frente")
split_trifold(TMP / "bio-2.png", "folder-verso")

print("Assets preparados em", ASSETS)
