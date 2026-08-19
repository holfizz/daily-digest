from PIL import Image, ImageDraw, ImageFont
import os

PAPER = (247, 243, 233)
INK   = (18, 16, 12)
ACCENT= (122, 21, 18)

def font(path_opts, size):
    for p in path_opts:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

SERIF_BOLD = ["C:/Windows/Fonts/timesbd.ttf", "C:/Windows/Fonts/georgiab.ttf"]
SANS       = ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]

def draw_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), PAPER)
    d = ImageDraw.Draw(img)
    # safe padding for maskable (icon content within inner 80%)
    pad = int(size * 0.14) if maskable else int(size * 0.06)
    # outer double border
    bw = max(2, size // 64)
    d.rectangle([pad, pad, size-pad-1, size-pad-1], outline=INK, width=bw)
    inset = pad + bw*3
    d.rectangle([inset, inset, size-inset-1, size-inset-1], outline=INK, width=max(1, bw//2))

    # top label "THE"
    top_f = font(SANS, int(size*0.075))
    label = "THE  ·  DAILY"
    tb = d.textbbox((0,0), label, font=top_f)
    d.text(((size-(tb[2]-tb[0]))/2, inset + size*0.05), label, font=top_f, fill=INK)

    # monogram "ST"
    mono_f = font(SERIF_BOLD, int(size*0.42))
    mono = "ST"
    mb = d.textbbox((0,0), mono, font=mono_f)
    mw, mh = mb[2]-mb[0], mb[3]-mb[1]
    d.text(((size-mw)/2 - mb[0], (size-mh)/2 - mb[1] - size*0.01),
           mono, font=mono_f, fill=INK)

    # accent rule under monogram
    ry = size*0.66
    d.rectangle([size*0.30, ry, size*0.70, ry+max(2,size//90)], fill=ACCENT)

    # bottom label
    bot_f = font(SANS, int(size*0.058))
    bl = "STARTUP TIMES"
    bb = d.textbbox((0,0), bl, font=bot_f)
    d.text(((size-(bb[2]-bb[0]))/2, size-inset-size*0.11), bl, font=bot_f, fill=INK)
    return img

os.makedirs("icons", exist_ok=True)
draw_icon(192).save("icons/icon-192.png")
draw_icon(512).save("icons/icon-512.png")
draw_icon(512, maskable=True).save("icons/icon-512-maskable.png")
draw_icon(180).save("icons/apple-touch-icon.png")
# favicon-ish
draw_icon(32).save("icons/favicon-32.png")
print("icons:", os.listdir("icons"))
