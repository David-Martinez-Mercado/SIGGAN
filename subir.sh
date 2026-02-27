#!/bin/bash
# Script para subir cambios en SIGGAN
# Repositorio principal: https://github.com/David-Martinez-Mercado/SIGGAN
# Rama: main

# Mensaje de commit
COMMIT_MSG="Día 6"

echo "=== Agregando todos los cambios (incluyendo Backend y Frontend) ==="
git add -A

echo "=== Creando commit ==="
git commit -m "$COMMIT_MSG"

echo "=== Subiendo al repositorio principal ==="
git push origin main

echo "=== Todo listo 🚀 ==="
