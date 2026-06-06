from rembg import remove
from PIL import Image

def process(input_path, output_path):
    print(f"Processing {input_path}...")
    input_image = Image.open(input_path)
    output_image = remove(input_image)
    output_image.save(output_path)
    print(f"Saved {output_path}")

process('./public/hero-service-1.png', './public/hero-service-1.png')
process('./public/hero-service-2.png', './public/hero-service-2.png')
process('./public/hero-service-3.png', './public/hero-service-3.png')
process('./public/hero-service-4.png', './public/hero-service-4.png')
print("Done!")
