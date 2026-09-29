"""Generate PWA icons (blue rounded square + staggered white lines = diff metaphor)."""
from PIL import Image, ImageDraw

BLUE = (0, 113, 227, 255)   # #0071e3
WHITE = (255, 255, 255, 255)


def draw_mark(size, maskable=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    scale = size / 64.0

    if maskable:
        d.rectangle([0, 0, size, size], fill=BLUE)
    else:
        d.rounded_rectangle([0, 0, size, size], radius=15 * scale, fill=BLUE)

    line_w = int(5.5 * scale)
    pad = 17 * scale
    y1 = 25 * scale
    y2 = 39 * scale
    for x1, x2, y in [(pad, size - pad, y1), (pad + 8 * scale, size - pad + 8 * scale, y2)]:
        d.line([x1, y, x2, y], fill=WHITE, width=line_w)
        r = line_w / 2
        for cx in (x1, x2):
            d.ellipse([cx - r, y - r, cx + r, y + r], fill=WHITE)

    return img


import os
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(out, exist_ok=True)
draw_mark(192).save(os.path.join(out, 'icon-192.png'))
draw_mark(512).save(os.path.join(out, 'icon-512.png'))
draw_mark(512, maskable=True).save(os.path.join(out, 'icon-maskable-512.png'))
print('icons written')
