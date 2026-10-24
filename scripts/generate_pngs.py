import os
import subprocess
import time
from pathlib import Path
from PIL import Image

EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

edge_exe = next((p for p in EDGE_PATHS if os.path.exists(p)), None)
if not edge_exe:
    raise RuntimeError("Edge executable not found")

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
STATIC.mkdir(exist_ok=True)
SCRIPTS = ROOT / "scripts"

def render_svg_to_png(svg_path: Path, output_png_path: Path, width: int, height: int, bg_color: str = "transparent"):
    svg_content = svg_path.read_text(encoding="utf-8")
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  html, body {{
    margin: 0;
    padding: 0;
    width: {width}px;
    height: {height}px;
    background: {bg_color};
    overflow: hidden;
  }}
  svg {{
    width: {width}px;
    height: {height}px;
    display: block;
  }}
</style>
</head>
<body>
{svg_content}
</body>
</html>"""
    temp_html = SCRIPTS / f"temp_{output_png_path.stem}.html"
    temp_html.write_text(html_content, encoding="utf-8")
    
    if output_png_path.exists():
        output_png_path.unlink()

    cmd = [
        edge_exe,
        "--headless=new",
        f"--screenshot={output_png_path.resolve()}",
        f"--window-size={width},{height}",
        "--default-background-color=00000000",
        "--hide-scrollbars",
        "--disable-gpu",
        temp_html.resolve().as_uri()
    ]
    
    subprocess.run(cmd, check=True)
    
    waited = 0.0
    while not output_png_path.exists() and waited < 6.0:
        time.sleep(0.2)
        waited += 0.2
        
    temp_html.unlink(missing_ok=True)
    
    if not output_png_path.exists():
        raise RuntimeError(f"Failed to generate {output_png_path}")

    # Give OS a moment to release file lock if needed
    time.sleep(0.3)
    with Image.open(output_png_path) as im:
        if im.size != (width, height):
            cropped = im.crop((0, 0, width, height))
            cropped.save(output_png_path)
    print(f"Generated: {output_png_path} ({width}x{height})")

def main():
    # 1. logo-mark: 512x512
    mark_svg = STATIC / "logo-mark.svg"
    render_svg_to_png(mark_svg, STATIC / "logo-mark.png", 512, 512)
    
    # 2. logo-mark-192: 192x192
    time.sleep(0.2)
    with Image.open(STATIC / "logo-mark.png") as im:
        im.resize((192, 192), Image.Resampling.LANCZOS).save(STATIC / "logo-mark-192.png")
        print(f"Generated: {STATIC / 'logo-mark-192.png'} (192x192)")

    # 3. logo horizontal: 1024x258 (approx 4:1)
    logo_svg = STATIC / "logo.svg"
    render_svg_to_png(logo_svg, STATIC / "logo.png", 1024, 258)

    # 4. logo-light horizontal: 1024x258
    logo_light_svg = STATIC / "logo-light.svg"
    render_svg_to_png(logo_light_svg, STATIC / "logo-light.png", 1024, 258)

    # 5. Favicon renders (32x32, 16x16)
    fav_svg = STATIC / "favicon.svg"
    render_svg_to_png(fav_svg, STATIC / "favicon-32x32.png", 32, 32)
    render_svg_to_png(fav_svg, STATIC / "favicon.png", 32, 32)
    render_svg_to_png(fav_svg, STATIC / "favicon-16x16.png", 16, 16)

    # 6. Apple touch icon: 180x180 with sleek dark background
    render_svg_to_png(mark_svg, STATIC / "apple-touch-icon.png", 180, 180, bg_color="#0b0f19")

    print("All PNG assets successfully generated.")

if __name__ == "__main__":
    main()
