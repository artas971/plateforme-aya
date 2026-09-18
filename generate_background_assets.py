import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = Path("c:/Users/artas/Desktop/aya/public/assets/backgrounds")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

WIDTH = 1080
HEIGHT = 1920

def create_bg_dark():
    """bg_dark.jpg : Fond Noir profond avec de légers accents gris géométriques."""
    img = Image.new("RGB", (WIDTH, HEIGHT), (10, 13, 20))
    draw = ImageDraw.Draw(img)

    # Dégradé vertical subtil
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(12 * (1 - ratio) + 5 * ratio)
        g = int(16 * (1 - ratio) + 8 * ratio)
        b = int(24 * (1 - ratio) + 14 * ratio)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # Lignes et formes géométriques abstraites sombres
    for i in range(-5, 15):
        y_pos = i * 180
        draw.line([(0, y_pos), (WIDTH, y_pos + 700)], fill=(25, 32, 48), width=2)
        draw.line([(WIDTH, y_pos), (0, y_pos + 700)], fill=(20, 26, 38), width=1)

    # Polygones d'accent gris profond
    draw.polygon([(0, 400), (WIDTH, 1200), (WIDTH, 1400), (0, 600)], fill=(16, 22, 33))
    draw.polygon([(0, 1500), (WIDTH, 900), (WIDTH, 1050), (0, 1650)], fill=(14, 19, 30))

    # Cadre intérieur fin moderne
    draw.rectangle([(50, 60), (WIDTH - 50, HEIGHT - 60)], outline=(40, 50, 70), width=2)
    draw.rectangle([(56, 66), (WIDTH - 56, HEIGHT - 66)], outline=(22, 28, 40), width=1)

    # Vignetage sombre
    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    for i in range(120):
        alpha = int((120 - i) * 1.5)
        v_draw.rectangle([i, i, WIDTH - i, HEIGHT - i], outline=(0, 0, 0, min(255, alpha)))
    
    img = Image.alpha_composite(img.convert("RGBA"), vignette).convert("RGB")
    target = OUTPUT_DIR / "bg_dark.jpg"
    img.save(target, "JPEG", quality=95)
    print(f"Créé : {target} ({target.stat().st_size} octets)")

def create_bg_palestine():
    """bg_palestine.jpg : Abstrait avec les couleurs Noir, Blanc, Vert, Rouge."""
    img = Image.new("RGB", (WIDTH, HEIGHT), (8, 12, 18))
    draw = ImageDraw.Draw(img)

    # Dégradé de fond sombre
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(10 * (1 - ratio) + 4 * ratio)
        g = int(14 * (1 - ratio) + 7 * ratio)
        b = int(22 * (1 - ratio) + 12 * ratio)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # Bandes angulaires dynamiques (Couleurs du drapeau palestinien)
    # 1. Vert Palestine (#007A3D)
    green_color = (0, 122, 61)
    draw.polygon([(0, 200), (WIDTH, 600), (WIDTH, 680), (0, 280)], fill=green_color)
    draw.polygon([(0, 1600), (WIDTH, 1200), (WIDTH, 1270), (0, 1670)], fill=(0, 95, 48))

    # 2. Blanc Pur (#FFFFFF)
    draw.polygon([(0, 280), (WIDTH, 680), (WIDTH, 730), (0, 330)], fill=(240, 245, 250))
    draw.polygon([(0, 1670), (WIDTH, 1270), (WIDTH, 1315), (0, 1715)], fill=(220, 225, 230))

    # 3. Rouge Palestine (#CE1126)
    red_color = (206, 17, 38)
    draw.polygon([(0, 330), (WIDTH, 730), (WIDTH, 820), (0, 420)], fill=red_color)
    draw.polygon([(0, 1715), (WIDTH, 1315), (WIDTH, 1395), (0, 1795)], fill=(175, 14, 32))

    # Triangle abstrait rouge en tête
    draw.polygon([(0, 0), (450, 0), (0, 350)], fill=(180, 15, 33))
    draw.line([(0, 350), (450, 0)], fill=(255, 255, 255), width=3)

    # Triangle abstrait vert en pied
    draw.polygon([(WIDTH, HEIGHT), (WIDTH - 450, HEIGHT), (WIDTH, HEIGHT - 350)], fill=(0, 100, 50))
    draw.line([(WIDTH - 450, HEIGHT), (WIDTH, HEIGHT - 350)], fill=(255, 255, 255), width=3)

    # Cadre interne géométrique
    draw.rectangle([(45, 55), (WIDTH - 45, HEIGHT - 55)], outline=(255, 255, 255, 60), width=2)

    # Assombrissement central pour optimiser la lecture des sous-titres
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(overlay)
    o_draw.rectangle([(0, 800), (WIDTH, 1150)], fill=(5, 8, 12, 140))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    target = OUTPUT_DIR / "bg_palestine.jpg"
    img.save(target, "JPEG", quality=95)
    print(f"Créé : {target} ({target.stat().st_size} octets)")

def create_bg_turquoise():
    """bg_turquoise.jpg : Utilisant la couleur marque #00bcd4 pour les messages d'espoir."""
    img = Image.new("RGB", (WIDTH, HEIGHT), (6, 18, 30))
    draw = ImageDraw.Draw(img)

    # Dégradé bleu pétrole / nuit
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(6 * (1 - ratio) + 4 * ratio)
        g = int(24 * (1 - ratio) + 12 * ratio)
        b = int(42 * (1 - ratio) + 26 * ratio)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # Ondes géométriques Turquoise (#00bcd4) et Cyan (#38bdf8)
    turquoise = (0, 188, 212)
    cyan_soft = (56, 189, 248)
    blue_deep = (11, 83, 148)

    # Faisceaux lumineux angulaires
    draw.polygon([(0, 100), (WIDTH, 750), (WIDTH, 860), (0, 210)], fill=(0, 70, 95))
    draw.polygon([(0, 210), (WIDTH, 860), (WIDTH, 900), (0, 250)], fill=cyan_soft)
    draw.polygon([(0, 250), (WIDTH, 900), (WIDTH, 980), (0, 330)], fill=turquoise)

    draw.polygon([(WIDTH, 1050), (0, 1600), (0, 1680), (WIDTH, 1130)], fill=blue_deep)
    draw.polygon([(WIDTH, 1130), (0, 1680), (0, 1720), (WIDTH, 1170)], fill=turquoise)

    # Cercles néon abstraits floutés
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_draw.ellipse([(WIDTH // 2 - 350, 450), (WIDTH // 2 + 350, 1150)], fill=(0, 188, 212, 35))
    g_draw.ellipse([(WIDTH // 2 - 200, 600), (WIDTH // 2 + 200, 1000)], fill=(56, 189, 248, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(40))

    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Liseré fin turquoise
    draw.rectangle([(45, 55), (WIDTH - 45, HEIGHT - 55)], outline=(0, 188, 212), width=2)
    draw.rectangle([(52, 62), (WIDTH - 52, HEIGHT - 62)], outline=(11, 83, 148), width=1)

    target = OUTPUT_DIR / "bg_turquoise.jpg"
    img.save(target, "JPEG", quality=95)
    print(f"Créé : {target} ({target.stat().st_size} octets)")

def create_bg_temoignage():
    """bg_temoignage.jpg : Minimaliste sobre et solennel."""
    img = Image.new("RGB", (WIDTH, HEIGHT), (12, 14, 18))
    draw = ImageDraw.Draw(img)

    for y in range(HEIGHT):
        ratio = y / HEIGHT
        val = int(14 * (1 - ratio) + 8 * ratio)
        draw.line([(0, y), (WIDTH, y)], fill=(val, val + 2, val + 5))

    # Grille texturée ultra-fine
    for x in range(0, WIDTH, 60):
        draw.line([(x, 0), (x, HEIGHT)], fill=(20, 23, 30), width=1)
    for y in range(0, HEIGHT, 60):
        draw.line([(0, y), (WIDTH, y)], fill=(20, 23, 30), width=1)

    # Cadre solennel
    draw.rectangle([(50, 60), (WIDTH - 50, HEIGHT - 60)], outline=(67, 67, 67), width=2)
    draw.rectangle([(58, 68), (WIDTH - 58, HEIGHT - 68)], outline=(153, 153, 153), width=1)

    target = OUTPUT_DIR / "bg_temoignage.jpg"
    img.save(target, "JPEG", quality=95)
    print(f"Créé : {target} ({target.stat().st_size} octets)")

if __name__ == "__main__":
    print("Génération des 4 fonds officiels 9:16 par l'Agent Lionel...")
    create_bg_dark()
    create_bg_palestine()
    create_bg_turquoise()
    create_bg_temoignage()
    print("Terminé avec succès !")
