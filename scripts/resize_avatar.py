import sys
import os
from PIL import Image, ImageOps

def process_avatar(input_path, output_path, size=256):
    try:
        with Image.open(input_path) as img:
            # Respect EXIF rotation (smartphones)
            img = ImageOps.exif_transpose(img)
            
            # Format RGBA or RGB
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGBA')
            
            # Smart Center Crop & Resize to exact square
            processed = ImageOps.fit(img, (size, size), Image.Resampling.LANCZOS)
            
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            processed.save(output_path, 'WEBP', quality=85, method=6)
            print("OK")
            return 0
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: py resize_avatar.py <input> <output> [size]", file=sys.stderr)
        sys.exit(1)
    
    inp = sys.argv[1]
    out = sys.argv[2]
    sz = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    sys.exit(process_avatar(inp, out, sz))
