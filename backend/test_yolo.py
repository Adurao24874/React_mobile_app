import os
import sys
from ultralytics import YOLO
from PIL import Image

def test():
    garbage_model_path = r'C:\Users\adars\OneDrive\Desktop\roadcrack\garbage.pt'
    pothole_model_path = r'C:\Users\adars\OneDrive\Desktop\roadcrack\pothole.pt'
    img_path = r'C:\Users\adars\OneDrive\Desktop\Mobapp\backend\uploads\images\report_034bbd9b-2fa5-41c3-afe9-571b68391875.jpg'
    
    print(f'Testing image: {img_path}')
    pil_img = Image.open(img_path).convert('RGB')
    
    try:
        garbage_model = YOLO(garbage_model_path)
        print('\n--- Garbage Model (conf=0.1) ---')
        res_g = garbage_model.predict(source=pil_img, conf=0.1, save=False)
        for r in res_g:
            if len(r.boxes) == 0:
                print('No garbage detected.')
            for box in r.boxes:
                print(f'Detected: {r.names[int(box.cls[0])]} | conf: {float(box.conf[0]):.3f}')
    except Exception as e:
        print('Failed to load garbage model:', e)
        
    try:
        pothole_model = YOLO(pothole_model_path)
        print('\n--- Pothole Model (conf=0.1) ---')
        res_p = pothole_model.predict(source=pil_img, conf=0.1, save=False)
        for r in res_p:
            if len(r.boxes) == 0:
                print('No pothole detected.')
            for box in r.boxes:
                print(f'Detected: {r.names[int(box.cls[0])]} | conf: {float(box.conf[0]):.3f}')
    except Exception as e:
        print('Failed to load pothole model:', e)

if __name__ == "__main__":
    test()
