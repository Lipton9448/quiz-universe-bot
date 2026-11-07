# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont

# Аватар бота 512x512
W, H = 512, 512
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

for y in range(H):
    t = y / (H - 1)
    r = int(26 + (10 - 26) * t)
    g = int(26 + (22 - 26) * t)
    b = int(46 + (60 - 46) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

for cx, cy, rad, col in [(120, 100, 180, (108, 92, 231, 80)),
                         (400, 420, 200, (0, 184, 148, 60)),
                         (256, 256, 260, (253, 203, 110, 40))]:
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

f_big = font("segoeuib.ttf", 96)
f_med = font("segoeui.ttf", 28)
f_emoji = font("seguiemj.ttf", 64)

# Центральный большой эмодзи
draw.text((256 - 32, 120), "\U0001F9E0", font=f_emoji, fill=(255, 255, 255), anchor="mm")
# Заголовок
draw.text((256, 260), "Quiz", font=f_big, fill=(255, 255, 255), anchor="mm")
draw.text((256, 340), "Universe", font=f_big, fill=(180, 180, 220), anchor="mm")
# Подпись
draw.text((256, 430), "20 квизов • Marvel • DC • Anime", font=f_med, fill=(150, 150, 190), anchor="mm")

# Рамка
draw.rounded_rectangle([8, 8, W - 8, H - 8], radius=40, outline=(108, 92, 231), width=3)

img.save("assets/bot-avatar-512x512.png", "PNG", optimize=True)
print("saved avatar 512x512")

# Обложка Mini App 1024x512
W2, H2 = 1024, 512
img2 = Image.new('RGB', (W2, H2))
draw2 = ImageDraw.Draw(img2)

for y in range(H2):
    t = y / (H2 - 1)
    r = int(15 + (8 - 15) * t)
    g = int(15 + (18 - 15) * t)
    b = int(35 + (55 - 35) * t)
    draw2.line([(0, y), (W2, y)], fill=(r, g, b))

for cx, cy, rad, col in [(150, 120, 200, (108, 92, 231, 70)),
                          (870, 400, 220, (0, 184, 148, 60)),
                          (512, 256, 300, (253, 203, 110, 35))]:
    overlay = Image.new('RGBA', (W2, H2), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)
    img2 = Image.alpha_composite(img2.convert('RGBA'), overlay).convert('RGB')
    draw2 = ImageDraw.Draw(img2)

f_t = font("segoeuib.ttf", 72)
f_s = font("segoeui.ttf", 28)
f_e = font("seguiemj.ttf", 48)

emojis = ["\U0001F577", "\U0001F987", "\U0001F3AC", "\U0001F338", "\U0001F365", "\U0001F3F4\u200D\u2620\uFE0F", "\u2694", "\U0001F5E1", "\U0001F409", "\U0001F576"]
x = 60
for e in emojis:
    draw2.text((x, 40), e, font=f_e, fill=(255, 255, 255))
    x += 96

draw2.text((80, 130), "Quiz Universe", font=f_t, fill=(255, 255, 255))
draw2.text((80, 210), "20 квизов по вселенным Marvel, DC и Аниме", font=f_s, fill=(180, 180, 220))

draw2.line([(80, 260), (940, 260)], fill=(108, 92, 231), width=2)

cats = ["Marvel", "DC Comics", "Anime", "Naruto", "One Piece", "AOT", "Demon Slayer", "Dragon Ball"]
cx = 80
for c in cats:
    draw2.rounded_rectangle([cx, 290, cx + 105, 335], radius=8, fill=(35, 35, 65))
    draw2.text((cx + 52, 312), c, font=font("segoeui.ttf", 14), fill=(220, 220, 240), anchor="mm")
    cx += 118

draw2.text((80, 400), "Rating  •  Stats  •  Mini App  •  Share", font=f_s, fill=(150, 150, 190))

img2.save("assets/miniapp-cover-1024x512.png", "PNG", optimize=True)
print("saved miniapp cover 1024x512")
