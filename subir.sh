#!/bin/bash
# Script para subir cambios en SIGGAN con submódulos
# Repositorio principal: https://github.com/David-Martinez-Mercado/SIGGAN
# Rama: main

# Mensaje de commit
COMMIT_MSG="Día 4: Frontend React, cuentas por propietario, folios automáticos, búsqueda historial"

echo "=== Subiendo cambios en Backend ==="
cd Backend || exit
git add .
git commit -m "$COMMIT_MSG"
git push origin main

echo "=== Subiendo cambios en Frontend/siggan-web ==="
cd ../Frontend/siggan-web || exit
git add .
git commit -m "$COMMIT_MSG"
git push origin main

echo "=== Actualizando repo principal ==="
cd ../..
git add Backend Frontend/siggan-web
git commit -m "$COMMIT_MSG"
git push origin main

echo "=== Todo listo 🚀 ==="
