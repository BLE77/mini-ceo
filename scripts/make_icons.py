from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def make_icon(size: int):
    image = Image.new("RGB", (size, size), "#F3EEE4")
    draw = ImageDraw.Draw(image)
    inset = int(size * 0.10)
    radius = int(size * 0.22)
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=radius,
        fill="#172033",
    )
    accent_y = int(size * 0.71)
    draw.rounded_rectangle(
        (int(size * 0.29), accent_y, int(size * 0.71), int(size * 0.76)),
        radius=int(size * 0.018),
        fill="#CF6C45",
    )
    label = "MC"
    face = font(int(size * 0.23), bold=True)
    box = draw.textbbox((0, 0), label, font=face)
    width = box[2] - box[0]
    height = box[3] - box[1]
    draw.text(
        ((size - width) / 2, (size - height) / 2 - int(size * 0.055)),
        label,
        font=face,
        fill="#FFF8EC",
    )
    image.save(PUBLIC / f"icon-{size}.png", optimize=True)


for icon_size in (192, 512):
    make_icon(icon_size)
