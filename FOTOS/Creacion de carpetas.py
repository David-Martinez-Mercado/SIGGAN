import os

# Ruta donde se crearán las carpetas
BASE_DIR = r"C:\Users\usuario\OneDrive\unipoli\Union ganaderaa\FOTOS"

for i in range(13, 51):
    carpeta_vaca = os.path.join(BASE_DIR, f"vaca{i}")
    carpeta_ojo1 = os.path.join(carpeta_vaca, "ojo1")
    carpeta_ojo2 = os.path.join(carpeta_vaca, "ojo2")

    os.makedirs(carpeta_ojo1, exist_ok=True)
    os.makedirs(carpeta_ojo2, exist_ok=True)

    print(f"Creada: {carpeta_vaca}/ojo1 y ojo2")

print("\nListo! Se crearon las carpetas de vaca12 a vaca50.")