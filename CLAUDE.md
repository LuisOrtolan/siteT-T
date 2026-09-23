# Trilhas & Tesouros

Site estático (HTML/CSS/JS puro, sem build step) do RPG de mesa **Trilhas &
Tesouros** — estilo OSR, em português. A maior parte do repositório é
conteúdo de regras pro jogador ler; uma parte pequena (`ferramentas/`) são
ferramentas interativas (ficha, funil de criação, mesa virtual) com backend
em Supabase.

Este arquivo cobre as **convenções do conteúdo de regras** (texto, estrutura
de página, dados de magias, bestiário). Não cobre a arquitetura técnica da
Mesa Virtual nem o schema do Supabase — isso fica documentado à parte,
perto do próprio código, quando existir.

## Estrutura do site

- `regras/*.html` — regras do sistema (atributos, combate, testes, criação
  de personagem, equipamentos, evoluindo, tabelas de dano/condições).
- `trilhas/*.html` — as 12 classes/trilhas (Combatente, Arcanista, etc.).
- `magias/*.html` + `data/magias*.json` — poderes místicos por categoria
  (Feitiços, Rituais, Milagres, Músicas, Runas, Alquimia & Venenos),
  renderizados via `js/magias.js` a partir de JSON — **não são HTML
  estático**, ver seção própria abaixo.
- `referencia/*.html` — bestiário e divindades, HTML escrito à mão (não
  vem de JSON).
- `partials/header.html` / `partials/footer.html` — navegação e rodapé,
  incluídos em toda página via `js/include.js` (`loadLayout(basePath)`).
- `ferramentas/` — fora do escopo deste arquivo.

## Esqueleto de toda página de conteúdo

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trilhas &amp; Tesouros - Nome da Página</title>
  <link rel="stylesheet" href="../css/style.css" />
</head>
<body>
  <div id="header"></div>
  <main class="container">
    <section class="section-card">
      <h1>Título</h1>
      <p>...</p>
    </section>
  </main>
  <div id="footer"></div>
  <script src="../js/include.js"></script>
  <script>
    loadLayout("../");
  </script>
</body>
</html>
```

Cada bloco de conteúdo é uma `<section class="section-card">` com `<h2>`
pros subtítulos. O argumento de `loadLayout(...)` é o caminho relativo até
a raiz do site a partir da página atual (`""` na raiz, `"../"` uma pasta
abaixo como `regras/` ou `magias/`) — os links `data-href` do menu são
resolvidos em cima desse valor, então usar o valor errado quebra a
navegação silenciosamente (os links do menu apontam pro lugar errado).

**Nova página = atualizar `partials/header.html`.** O menu é hardcoded
nesse arquivo, dividido em dropdowns (Regras, Trilhas, Poderes Místicos,
Referência, Ferramentas). Uma página nova sem entrada lá só é alcançável
por link direto.

## Tom e estilo do texto de regras

- Português direto, explicando a regra e seu efeito mecânico — não é
  redação literária, é manual de regras.
- Convenção recorrente: parágrafo explicando o conceito em prosa, seguido
  de `<strong>Uso mecânico:</strong>` isolando o que efetivamente afeta os
  números do jogo. Ver `regras/atributos.html` como referência de tom.
- Siglas de atributo são fixas: **FOR, DES, CON, INT, VON, CAR** (Força,
  Destreza, Constituição, Intelecto, Vontade, Carisma) — Vontade e não
  Sabedoria, Intelecto e não Inteligência.
- Termos de jogo em `<strong>`: nomes de mecânicas, atributos, siglas
  (CA, PV, HD, XP), classes/trilhas.
- Um toque ocasional de referência pop (ex.: comparação com "Toguro" ou
  Bruce Lee em `atributos.html`) é aceitável e já faz parte do tom do
  texto — não precisa neutralizar, mas também não force.

## Poderes místicos (magias/rituais/milagres/músicas/runas/alquimia)

Estas páginas **não têm o conteúdo no HTML** — o HTML só monta a UI de
busca/filtro (`js/magias.js`) apontando pro JSON via
`data-magias="../data/magias_X.json"` em `<section id="lista-magias">`.
Editar um poder é editar o JSON, não o HTML.

Cada item do array JSON:

```json
{
  "id": "feitico-1-dardo-arcano",
  "nome": "Dardo Arcano",
  "tipo": "Feitiço",
  "trilha": "Arcanista",
  "circulo_ou_grau": 1,
  "descricao": "Escola: Evocação\nConjuração: 1 ação\nAlcance: 100’\nDuração: instantânea\nAlvo/Área: 1 ou mais criaturas à escolha\nEfeito: ...\nEscalonamento:\n..."
}
```

- `id`: kebab-case, `<categoria>-<circulo/grau>-<slug-do-nome>` (ex.:
  `feitico-1-dardo-arcano`, `ritual-2-nome`). Precisa ser único dentro do
  arquivo.
- `tipo`: rótulo singular da categoria (`"Feitiço"`, `"Ritual"`,
  `"Milagre"`, `"Música"`, `"Runa"`, `"Alquimia"`/`"Veneno"`) — é o que
  aparece no card e no filtro.
- `trilha`: qual trilha concede aquele poder (ex.: `"Arcanista"`).
- `circulo_ou_grau`: número inteiro, usado pra ordenar e popular o filtro
  de círculo/grau — sempre número, nunca string tipo `"1º"`.
- `descricao`: **string única com `\n`** (não array), campos em ordem
  fixa e cada um em uma linha: `Escola:`, `Conjuração:`, `Alcance:`,
  `Duração:`, `Alvo/Área:`, `Efeito:`, e opcionalmente `Escalonamento:`
  seguido de mais linhas explicando o que melhora por círculo/rank. Nem
  todo tipo usa exatamente os mesmos campos (runas usam `sigla` e
  `raridade` como propriedades extras no objeto, não dentro da
  `descricao`) — olhe um item existente do mesmo arquivo antes de criar
  um novo, pra copiar o padrão exato daquela categoria.
- Sempre validar que o arquivo continua um **JSON válido** depois de
  editar (vírgula sobrando/faltando quebra a página inteira, não só o
  item).

## Bestiário (`referencia/bestiario.html`)

Ao contrário das magias, o bestiário é HTML escrito à mão — cada animal é
um `<div class="bestia-card" data-txt="palavras de busca">`:

```html
<div class="bestia-card" data-txt="camelo deserto xerófilo">
  <p class="bestia-nome">Camelo <span class="hd-badge hd-2">HD 2</span></p>
  <div class="bestia-stats">
    CA 12 · Atq: 1× pata +1 (1d4)<br>
    SF 15, SM 16 · Mov: 50' · Moral 7
  </div>
  <div class="bestia-habilidades"><em>Xerófilo:</em> sobrevive 2 semanas sem água.</div>
</div>
```

- `data-txt`: palavras-chave em minúsculo pra busca por texto (nome +
  sinônimos/traços relevantes) — sempre preencher, é o que a busca da
  página usa.
- Classe `hd-N` no badge (`hd-1` a `hd-4`) muda a cor conforme o HD —
  escolha pela faixa de HD do bicho, não pelo número exato (`HD 1+1`
  ainda é `hd-1`).
- Ordem fixa da linha de stats: `CA` · `Atq:` (com bônus e dano por
  ataque, `<em>ou</em>` entre opções de ataque) · depois `SF`, `SM` ·
  `Mov:` · `Moral`.
- `.bestia-habilidades` é opcional — só entra se o bicho tiver alguma
  habilidade especial (veneno, camuflagem, mergulho etc.), com o nome da
  habilidade em `<em>` seguido de dois pontos.

## O que este arquivo NÃO cobre

Mudanças em `ferramentas/mesa.html`, `js/sala-store.js`,
`supabase/*.sql`, ou qualquer coisa de tempo real/Supabase — isso é código
de aplicação, não conteúdo de regras, e segue convenções próprias
documentadas junto do código quando necessário.
