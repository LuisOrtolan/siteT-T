#!/usr/bin/env bash
# Patch: adiciona ícones SVG pixel art nas páginas de trilha e na home
# Execute na raiz do repositório: bash patch_icones.sh
set -e

echo 'Atualizando páginas das trilhas...'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/batedor.svg" alt="Batedor" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/batedor.html && echo '  ✓ trilhas/batedor.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/especialista.svg" alt="Especialista" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/especialista.html && echo '  ✓ trilhas/especialista.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/arcanista.svg" alt="Arcanista" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/arcanista.html && echo '  ✓ trilhas/arcanista.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/xama.svg" alt="Xamã" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/xama.html && echo '  ✓ trilhas/xama.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/sacerdote.svg" alt="Sacerdote" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/sacerdote.html && echo '  ✓ trilhas/sacerdote.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/mestre-das-feras.svg" alt="Mestre das Feras" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/mestre-das-feras.html && echo '  ✓ trilhas/mestre-das-feras.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/lorde-runico.svg" alt="Lorde Rúnico" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/lorde-runico.html && echo '  ✓ trilhas/lorde-runico.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/bardo.svg" alt="Bardo" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/bardo.html && echo '  ✓ trilhas/bardo.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/alquimista.svg" alt="Alquimista" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/alquimista.html && echo '  ✓ trilhas/alquimista.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/defensor.svg" alt="Defensor" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/defensor.html && echo '  ✓ trilhas/defensor.html'
sed -i 's|<div class="trilha-icone-grande"></div>|<img src="../img/troca-peles.svg" alt="Troca-peles" class="trilha-icone-grande" style="object-fit:contain;padding:8px;image-rendering:pixelated;">|g' trilhas/troca-peles.html && echo '  ✓ trilhas/troca-peles.html'

echo 'Atualizando index.html...'
python3 << 'PYEOF'
import re
with open('index.html', 'r') as f:
    html = f.read()

nomes = [
    ("batedor", "Batedor"),
    ("especialista", "Especialista"),
    ("arcanista", "Arcanista"),
    ("xama", "Xamã"),
    ("sacerdote", "Sacerdote"),
    ("mestre-das-feras", "Mestre das Feras"),
    ("lorde-runico", "Lorde Rúnico"),
    ("bardo", "Bardo"),
    ("alquimista", "Alquimista"),
    ("defensor", "Defensor"),
    ("troca-peles", "Troca-peles"),
]

old = '<div class="trilha-icone"></div>'
def replacer(m):
    if not nomes: return m.group(0)
    svg, alt = nomes.pop(0)
    return f'<img src="img/{svg}.svg" alt="{alt}" class="trilha-icone" style="object-fit:contain;padding:4px;image-rendering:pixelated;">'

html = re.sub(re.escape(old), lambda m: replacer(m), html)
with open('index.html', 'w') as f:
    f.write(html)
print('  ✓ index.html')
PYEOF

echo 'Pronto!'