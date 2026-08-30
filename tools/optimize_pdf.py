from pathlib import Path
import subprocess

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Biografia Renata Fonseca.pdf"
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
OUTPUT = OUTPUT_DIR / "biografia-renata-fonseca-web.pdf"
PDFTOPPM = Path(
    r"C:\Users\ezequ\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe"
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

prefix = TMP_DIR / "renata-web"
subprocess.run(
    [
        str(PDFTOPPM),
        "-jpeg",
        "-r",
        "150",
        "-jpegopt",
        "quality=84,progressive=y,optimize=y",
        str(SOURCE),
        str(prefix),
    ],
    check=True,
)

page_paths = sorted(TMP_DIR.glob("renata-web-*.jpg"))
if not page_paths:
    raise RuntimeError("Nenhuma pagina foi renderizada.")

pages = [Image.open(path).convert("RGB") for path in page_paths]
pages[0].save(
    OUTPUT,
    "PDF",
    resolution=150,
    save_all=True,
    append_images=pages[1:],
    title="Renata Fonseca - Minha Historia",
    author="Renata Fonseca",
    subject="Biografia e trajetoria publica",
)

for page in pages:
    page.close()

print(OUTPUT)
