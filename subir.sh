#!/bin/bash
# Script para subir cambios en SIGGAN
# Repositorio: https://github.com/David-Martinez-Mercado/SIGGAN.git
# Rama: main

# Pedir mensaje de commit
if [ -z "$1" ]; then
  read -p "Mensaje de commit: " COMMIT_MSG
else
  COMMIT_MSG="$1"
fi

if [ -z "$COMMIT_MSG" ]; then
  echo "Error: El mensaje de commit no puede estar vacío."
  exit 1
fi

echo ""
echo "=== Estado actual ==="
git status --short

echo ""
echo "=== Archivos que se van a subir ==="
git status --short

echo ""
read -p "¿Continuar con el commit y push? [s/N]: " CONFIRMAR
if [[ "$CONFIRMAR" != "s" && "$CONFIRMAR" != "S" ]]; then
  echo "Cancelado. Puedes modificar lo que necesites y volver a ejecutar el script."
  exit 0
fi

echo ""
echo "=== Agregando todos los cambios ==="
git add -A

echo ""
echo "=== Creando commit: '$COMMIT_MSG' ==="
git commit -m "$COMMIT_MSG"

echo ""
echo "=== Subiendo a GitHub (main) ==="
git push origin main

echo ""
echo "=== Todo listo. Último commit: ==="
git log --oneline -1
