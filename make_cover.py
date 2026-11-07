# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont

W, H = 640, 360
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

for y in range(H):
    t = y / (H - 1)
    r = int(26 + (10 - 26) * t)
    g = int(26 + (22 - 26) * t)
    b = int(46 + (60 - 46) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

for cx, cy, rad, col in [(80, 60, 120, (108, 92, 231, 60)),
                         (560, 300, 140, (0, 184, 148, 50)),
                         (320, 180, 200, (253, 203, 110, 30))]:
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

def font(name, size):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/" + name, size)
    except Exception:
        return ImageFont.load_default()

f_title = font("segoeuib.ttf", 46)
f_sub = font("segoeui.ttf", 22)
f_small = font("segoeui.ttf", 16)
f_emoji = font("seguiemj.ttf", 34)

emojis = ["\U0001F577", "\U0001F987", "\U0001F3AC", "\U0001F338", "\U0001F365", "\U0001F3F4\u200D\u2620\uFE0F", "\u2694", "\U0001F5E1", "\U0001F409", "\U0001F576"]
x = 30
for e in emojis:
    draw.text((x, 20), e, font=f_emoji, fill=(255, 255, 255))
    x += 58

draw.text((40, 85), "Quiz Universe", font=f_title, fill=(255, 255, 255))
draw.text((40, 145), "20 квизов по вселенным", font=f_sub, fill=(180, 180, 220))

draw.line([(40, 180), (600, 180)], fill=(108, 92, 231), width=2)

cats = [
    ("Marvel", "\U0001F577"),
    ("DC Comics", "\U0001F987"),
    ("Anime", "\U0001F338"),
    ("Naruto", "\U0001F365"),
    ("One Piece", "\U0001F3F4\u200D\u2620\uFE0F"),
    ("AOT", "\u2694"),
]
cols = 3
cell_w = (W - 80) // cols
for i, (name, em) in enumerate(cats):
    cx = 40 + (i % cols) * cell_w
    cy = 200 + (i // cols) * 52
    draw.rounded_rectangle([cx, cy, cx + cell_w - 12, cy + 42], radius=10, fill=(35, 35, 65))
    draw.text((cx + 12, cy + 6), em, font=f_emoji, fill=(255, 255, 255))
    draw.text((cx + 52, cy + 12), name, font=f_small, fill=(220, 220, 240))

draw.text((40, 318), "Rating  Stats  Mini App", font=f_small, fill=(150, 150, 190))

out = "assets/bot-cover-640x360.png"
img.save(out, "PNG", optimize=True)
print("saved", out, img.size)
