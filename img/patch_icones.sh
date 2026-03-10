#!/usr/bin/env bash
# Patch: troca ícones nas páginas das trilhas e na home
# Execute na RAIZ do repositório: bash patch_icones.sh
set -e

echo "Atualizando páginas das trilhas (trilha-icone-grande)..."

# As 11 trilhas sem imagem — substitui o div vazio pelo img
for trilha in batedor especialista arcanista xama sacerdote mestre-das-feras lorde-runico bardo alquimista defensor troca-peles; do
  nome=$(echo "$trilha" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2); print}')
  sed -i "s|<div class=\"trilha-icone-grande\"></div>|<img src=\"../img/${trilha}.svg\" alt=\"${nome}\" class=\"trilha-icone-grande\" style=\"object-fit:contain;padding:8px;\">|g" \
    "trilhas/${trilha}.html" && echo "  ✓ trilhas/${trilha}.html"
done

echo ""
echo "Atualizando combatente.html (trocando img png por svg)..."
sed -i 's|<img src="../img/combatente.png" alt="Combatente" class="trilha-img">|<img src="../img/combatente.svg" alt="Combatente" class="trilha-icone-grande" style="object-fit:contain;padding:8px;">|g' \
  trilhas/combatente.html && echo "  ✓ trilhas/combatente.html"

echo ""
echo "Atualizando index.html..."
python3 << 'PYEOF'
import re

with open('index.html', 'r') as f:
    html = f.read()

# Combatente already uses <img class="trilha-card-img"> — swap src
html = html.replace(
    'src="img/combatente.png"',
    'src="img/combatente.svg"'
)

# The other 11 trails use <div class="trilha-icone"></div> — replace in order
nomes = [
    ("batedor",          "Batedor"),
    ("especialista",     "Especialista"),
    ("arcanista",        "Arcanista"),
    ("xama",             "Xamã"),
    ("sacerdote",        "Sacerdote"),
    ("mestre-das-feras", "Mestre das Feras"),
    ("lorde-runico",     "Lorde Rúnico"),
    ("bardo",            "Bardo"),
    ("alquimista",       "Alquimista"),
    ("defensor",         "Defensor"),
    ("troca-peles",      "Troca-peles"),
]

old = '<div class="trilha-icone"></div>'
def replacer(m):
    if not nomes: return m.group(0)
    svg, alt = nomes.pop(0)
    return f'<img src="img/{svg}.svg" alt="{alt}" class="trilha-icone" style="object-fit:contain;padding:4px;">'

html = re.sub(re.escape(old), lambda m: replacer(m), html)

with open('index.html', 'w') as f:
    f.write(html)
print('  ✓ index.html')
PYEOF

echo ""
echo "Pronto! Lembre de copiar os SVGs para img/ antes de rodar."
