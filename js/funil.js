// js/funil.js
// Forja do Funil (Nível 0) — geração com seed por sessão (destino).
// Tabelas vêm de data/funil/*.json (extraídas do documento de Criação de personagem).

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    seedValue: $("#seed-value"),
    btnLight: $("#btn-light"),
    btnRoll: $("#btn-roll"),
    btnNewSeed: $("#btn-new-seed"),
    cards: $("#cards"),
    overlay: $("#board-overlay"),
    pressagio: $("#pressagio"),
    toggleRolls: $("#toggle-rolls"),
    toggleSound: $("#toggle-sound"),
    qtyButtons: $$(".qty-btn"),
    btnExport: $("#btn-export"),
  };

  if (!els.cards) return;

  // ---------- RNG (seeded) ----------
  // xmur3 string hash -> 32-bit seed
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  // Mulberry32 PRNG
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedStr) {
    const seedFn = xmur3(seedStr);
    return mulberry32(seedFn());
  }

  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  // ---------- Sounds (WebAudio) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!els.toggleSound.checked) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function ping(type = "tick") {
    if (!els.toggleSound.checked) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "whoosh") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
      return;
    }

    if (type === "stamp") {
      osc.type = "square";
      osc.frequency.setValueAtTime(90, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    // tick
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // ---------- Data ----------
  const basePath = "../";
  const DATA = {
    mods: basePath + "data/funil/modificadores_atributos.json",
    racas: basePath + "data/funil/racas_3d6.json",
    ocup: basePath + "data/funil/ocupacoes_d66.json",
    fort: basePath + "data/funil/fortuna_1d20.json",
    equip: basePath + "data/funil/equipamentos_1d20.json",
    equipG: basePath + "data/funil/equipamentos_gerais_d66.json",
  };

  async function loadJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao carregar: " + url);
    return await res.json();
  }

  let tables = null;

  // ---------- Seed handling ----------
  const STORAGE_KEY = "tt_funil_seed_v1";
  function makeSeed() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp =
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes());
    const extra = Math.floor(Math.random() * 1e6).toString(16).padStart(5, "0");
    return "S-" + stamp + "-" + extra;
  }

  function getSeed() {
    const s = localStorage.getItem(STORAGE_KEY);
    return s || null;
  }

  function setSeed(seed) {
    localStorage.setItem(STORAGE_KEY, seed);
    els.seedValue.textContent = seed;
  }

  // ---------- Helpers ----------
  function parseSignedInt(str) {
    const s = String(str).trim().replace("−", "-");
    if (s === "") return 0;
    return parseInt(s, 10);
  }


  function stripStars(str) {
    return String(str || "").replace(/\*+/g, "").trim();
  }

  function normKey(str) {
    return stripStars(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const OCC_SUBTYPES = {
    "academico": {
      die: 4,
      results: {
        1: "Astrônomo",
        2: "Escriba",
        3: "Arquiteto",
        4: "Cartógrafo",
      },
    },
    "artesao": {
      die: 10,
      results: {
        1: "Carpinteiro",
        2: "Moleiro",
        3: "Joalheiro",
        4: "Sapateiro",
        5: "Peleteiro",
        6: "Oleiro",
        7: "Boticário",
        8: "Tecelão",
        9: "Tanoeiro",
        10: "Canoeiro",
      },
    },
    "fora de lei": {
      die: 6,
      results: {
        1: "Bandido de estrada",
        2: "Punguista",
        3: "Contrabandista",
        4: "Pirata",
        5: "Vigarista",
        6: "Cobrador de agiota",
      },
    },
    "cuidador de animais": {
      die: 6,
      results: {
        1: "Pastor",
        2: "Veterinário",
        3: "Apicultor",
        4: "Cavalariço",
        5: "Adestrador",
        6: "Falcoeiro",
      },
    },
    "artista": {
      die: 6,
      results: {
        1: "Bobo da corte/cidade",
        2: "Menestrel",
        3: "Poeta/Escritor",
        4: "Pintor/Escultor",
        5: "Artista de circo",
        6: "Bonequeiro",
      },
    },
  };

  function rollNdM(rng, n, m) {
    const dice = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = randInt(rng, 1, m);
      dice.push(d);
      sum += d;
    }
    return { dice, sum };
  }

  function rollD66(rng) {
    const dezena = randInt(rng, 1, 6);
    const unidade = randInt(rng, 1, 6);
    return { dezena, unidade, valor: dezena * 10 + unidade };
  }

  function getMod(score) {
    const m = tables.mods.mapa[String(score)];
    return parseSignedInt(m);
  }

  const PRESSAGIOS = [
    "O vento sopra do norte.",
    "A sorte cobra juros.",
    "A tinta escurece no papel.",
    "Nem toda luz guia.",
    "A estrada lembra o sangue.",
    "O ferro canta baixo.",
    "Uma vela nunca arde por acaso.",
    "O destino não pede licença.",
    "A pedra guarda segredos.",
    "O silêncio tem dentes.",
    "A noite escreve nomes.",
    "O mundo observa.",
    "A poeira tem memória.",
    "Um passo em falso vira história.",
    "O presságio chega antes do perigo.",
    "O azar é apenas um tipo de guia.",
    "O medo é um conselheiro antigo.",
    "O couro range quando mentem.",
    "A madeira guarda marcas.",
    "O eco responde em voz baixa."
  ];

  function pickPressagio(rng) {
    return PRESSAGIOS[randInt(rng, 0, PRESSAGIOS.length - 1)];
  }

  function fmtDice(dice) {
    return dice.join(" + ");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Character generation ----------
  function gerarPersonagem(rng) {
    // atributos 3d6 em ordem
    const attrKeys = ["FOR", "DES", "CON", "INT", "VON", "CAR"];
    const atributos = {};
    const rolagensAtributos = {};
    const mods = {};
    for (const k of attrKeys) {
      const r = rollNdM(rng, 3, 6);
      atributos[k] = r.sum;
      rolagensAtributos[k] = r;
      mods[k] = getMod(r.sum);
    }

    // raça 3d6
    const rRace = rollNdM(rng, 3, 6);
    const raceName = tables.racas.mapa[String(rRace.sum)] || "—";

    // jotunir extra (o doc marca com *)
    let jotunirTipo = null;
    let jotunirRoll = null;
    if (raceName.toLowerCase().startsWith("jotunir")) {
      jotunirRoll = randInt(rng, 1, 6);
      jotunirTipo = (jotunirRoll % 2 === 1) ? "Glaciais" : "Dunas";
    }

    // ocupação d66
    const rOcc = rollD66(rng);
    const occObj = tables.ocup.mapa[String(rOcc.valor)] || { ocupacao: "—", arma_inicial: "—" };

    // subocupações (conforme o doc): Acadêmico*, Artesão**, Fora de lei***, Cuidador de animais****, Artista*****
    const occBase = stripStars(occObj.ocupacao);
    const occKey = normKey(occObj.ocupacao);
    let occSub = null;
    let occNomeFinal = occBase;

    if (OCC_SUBTYPES[occKey]) {
      const cfg = OCC_SUBTYPES[occKey];
      const subRoll = randInt(rng, 1, cfg.die);
      const subNome = cfg.results[subRoll] || "—";
      occSub = { die: cfg.die, roll: subRoll, nome: subNome };
      occNomeFinal = `${occBase} - ${subNome}`;
    }


    // fortuna 1d20
    const rFort = randInt(rng, 1, 20);
    const fortObj = tables.fort.mapa[String(rFort)] || { fortuna: "—", explicacao: "—" };

    // Sorte de Principiante (3d6) — nível 0
    const rSorte = rollNdM(rng, 3, 6);
    const sorte = rSorte.sum;

    // Salvamentos — nível 0
    const SF_BASE = 18;
    const SM_BASE = 18;


    // PV (1d4 + mod CON), exceção: Fortuna 2 "Sobrevivente" => 1d6 (doc)
    const pvDie = (rFort === 2) ? 6 : 4;
    const rPV = randInt(rng, 1, pvDie);
    const pvTotal = Math.max(1, rPV + mods.CON);

    // CA base (10 + mod DES). (Bônus extras ficam na explicação da Fortuna/Raça/Itens)
    const caBase = 10 + mods.DES;

    // Equipamentos: 2x 1d20 + 1x d66
    const eq1 = randInt(rng, 1, 20);
    const eq2 = randInt(rng, 1, 20);
    const rEqG = rollD66(rng);

    const eqItem1 = tables.equip.mapa[String(eq1)] || "—";
    const eqItem2 = tables.equip.mapa[String(eq2)] || "—";
    const eqItemG = tables.equipG.mapa[String(rEqG.valor)] || "—";

    // Munição: regra... (sem adivinhar demais, mostramos como nota se for arma de projétil/arremesso)
    const armaTxt = String(occObj.arma_inicial || "");
    const podeTerMunicao = /(arco|besta|funda|dardo|azagaia|flecha|virote)/i.test(armaTxt);

    return {
      atributos,
      rolagensAtributos,
      mods,
      rRace,
      raceName,
      jotunirTipo,
      jotunirRoll,
      rOcc,
      occObj,
      occBase,
      occSub,
      occNomeFinal,
      rFort,
      fortObj,
      rSorte,
      sorte,
      SF_BASE,
      SM_BASE,
      pvDie,
      rPV,
      pvTotal,
      caBase,
      eq1,
      eq2,
      rEqG,
      eqItem1,
      eqItem2,
      eqItemG,
      podeTerMunicao
    };
  }

  // ---------- Rendering ----------
  function createCardShell(index) {
    const card = document.createElement("article");
    card.className = "funil-card is-pending";
    card.innerHTML = `
      <div class="card-burn"></div>
      <header class="funil-card-header">
        <div class="card-mark">#${index + 1}</div>
        <div class="card-title">
          <h3>—</h3>
          <p class="muted">—</p>
        </div>
        <div class="card-stats">
          <div class="stat"><span class="stat-label">PV</span><span class="stat-value">—</span></div>
          <div class="stat"><span class="stat-label">CA</span><span class="stat-value">—</span></div>
        </div>
      </header>

      <div class="card-body">
        <section class="card-block block-atributos" data-stage="0">
          <h4>Ossos</h4>
          <div class="attrs"></div>
        </section>

        <section class="card-block block-origem" data-stage="1">
          <h4>Origem</h4>
          <div class="lines"></div>
        </section>

        <section class="card-block block-trabalho" data-stage="2">
          <h4>Trabalho</h4>
          <div class="lines"></div>
        </section>

        <section class="card-block block-destino" data-stage="3">
          <h4>Destino</h4>
          <div class="lines"></div>
        </section>

        <section class="card-block block-mochila" data-stage="4">
          <h4>Mochila</h4>
          <div class="lines"></div>
        </section>
      </div>
    `;
    return card;
  }

  function renderAttrs(p, showRolls) {
    const rows = ["FOR","DES","CON","INT","VON","CAR"].map(k => {
      const val = p.atributos[k];
      const mod = p.mods[k];
      if (!showRolls) {
        return `<div class="attr-row"><span class="attr-k">${k}</span><span class="attr-v">${val} <span class="attr-mod">(${mod >= 0 ? "+"+mod : mod})</span></span></div>`;
      }
      const r = p.rolagensAtributos[k];
      return `<div class="attr-row"><span class="attr-k">${k}</span><span class="attr-v">${val} <span class="attr-mod">(${mod >= 0 ? "+"+mod : mod})</span></span><span class="attr-roll">3d6 → ${fmtDice(r.dice)} = ${r.sum}</span></div>`;
    }).join("");
    return rows;
  }

  function revealStage(card, stage, contentFn, delayMs) {
    setTimeout(() => {
      const block = card.querySelector(`[data-stage="${stage}"]`);
      if (!block) return;
      block.classList.add("is-revealed");
      contentFn(block);
      ping(stage === 4 ? "stamp" : "tick");
    }, delayMs);
  }

  function fillCard(card, p, showRolls) {
    const h3 = card.querySelector(".card-title h3");
    const subtitle = card.querySelector(".card-title p");
    const pvEl = card.querySelector(".card-stats .stat:nth-child(1) .stat-value");
    const caEl = card.querySelector(".card-stats .stat:nth-child(2) .stat-value");

    const arma = escapeHtml(p.occObj.arma_inicial || "—");
    const occ = escapeHtml(p.occNomeFinal || p.occObj.ocupacao || "—");
    const race = escapeHtml(p.raceName || "—");

    h3.textContent = `${race} — ${occ}`;
    subtitle.textContent = `Arma inicial: ${p.occObj.arma_inicial || "—"}`;

    pvEl.textContent = String(p.pvTotal);
    caEl.textContent = String(p.caBase);

    const attrsBox = card.querySelector(".block-atributos .attrs");
    attrsBox.innerHTML = renderAttrs(p, showRolls);

    // "Ossos" deve aparecer imediatamente (não ficar apagado)
    const ossosBlock = card.querySelector('.block-atributos');
    if (ossosBlock) ossosBlock.classList.add('is-revealed');

    // Origem
    revealStage(card, 1, (block) => {
      const lines = block.querySelector(".lines");
      const raceRoll = showRolls ? `3d6 → ${fmtDice(p.rRace.dice)} = ${p.rRace.sum}` : `${p.rRace.sum}`;
      let extra = "";
      if (p.jotunirTipo) {
        extra = `<div class="line"><span class="label">Etnia:</span> ${escapeHtml(p.jotunirTipo)} ${showRolls ? `(1d6 → ${p.jotunirRoll})` : ""}</div>`;
      }
      lines.innerHTML = `
        <div class="line"><span class="label">Raça:</span> ${race} <span class="muted">(${raceRoll})</span></div>
        ${extra}
      `;
    }, 220);

    // Trabalho
    revealStage(card, 2, (block) => {
      const lines = block.querySelector(".lines");
      const d66 = p.rOcc;
      const d66Line = showRolls
        ? `<div class="line d66"><span class="label">d66:</span> dezena 1d6 → <strong>${d66.dezena}</strong>, unidade 1d6 → <strong>${d66.unidade}</strong> <span class="muted">(= ${d66.valor})</span></div>`
        : `<div class="line"><span class="label">d66:</span> <span class="muted">${d66.valor}</span></div>`;
      lines.innerHTML = `
        <div class="line"><span class="label">Ocupação:</span> ${occ} ${p.occSub && showRolls ? `<span class="muted">(1d${p.occSub.die} → ${p.occSub.roll})</span>` : ``}</div>
        ${d66Line}
        <div class="line"><span class="label">Arma:</span> ${arma}</div>
        ${p.podeTerMunicao ? `<div class="line"><span class="label">Munição:</span> 2d10 (se aplicável)</div>` : ``}
      `;
    }, 420);

    // Destino
    revealStage(card, 3, (block) => {
      const lines = block.querySelector(".lines");
      const fortTitle = escapeHtml(p.fortObj.fortuna || "—");
      const fortText = escapeHtml(p.fortObj.explicacao || "—");
      const fortRoll = showRolls ? `1d20 → ${p.rFort}` : String(p.rFort);
      const pvRollInfo = showRolls
        ? `(${p.pvDie === 6 ? "1d6" : "1d4"} → ${p.rPV} + mod CON (${p.mods.CON >= 0 ? "+" + p.mods.CON : p.mods.CON}))`
        : ``;
      lines.innerHTML = `
        <div class="line"><span class="label">Fortuna:</span> ${fortTitle} <span class="muted">(${fortRoll})</span></div>
        <div class="line"><span class="label">PV:</span> ${p.pvTotal} ${pvRollInfo ? `<span class="muted">${pvRollInfo}</span>` : ``}</div>
      
        <div class="line"><span class="label">Salvamentos:</span> SF ${p.SF_BASE} • SM ${p.SM_BASE}</div>
        <div class="line"><span class="label">Sorte:</span> ${p.sorte} ${showRolls ? `<span class="muted">(3d6 → ${fmtDice(p.rSorte.dice)} = ${p.rSorte.sum})</span>` : ``}</div>
`;
    }, 650);

    // Mochila
    revealStage(card, 4, (block) => {
      const lines = block.querySelector(".lines");
      const e1 = escapeHtml(p.eqItem1);
      const e2 = escapeHtml(p.eqItem2);
      const eg = escapeHtml(p.eqItemG);
      const eq1Roll = showRolls ? `1d20 → ${p.eq1}` : String(p.eq1);
      const eq2Roll = showRolls ? `1d20 → ${p.eq2}` : String(p.eq2);
      const d66 = p.rEqG;
      const eqGMeta = showRolls
        ? `(d66: dezena ${d66.dezena} / unidade ${d66.unidade} = ${d66.valor})`
        : `(${d66.valor})`;
      lines.innerHTML = `
        <div class="line"><span class="label">Equipamentos:</span></div>
        <ul class="items">
          <li><span class="muted">(${eq1Roll})</span> ${e1}</li>
          <li><span class="muted">(${eq2Roll})</span> ${e2}</li>
          <li><span class="muted">${eqGMeta}</span> ${eg}</li>
        </ul>
      `;
    }, 900);

    setTimeout(() => {
      card.classList.remove("is-pending");
      card.classList.add("is-ready");
    }, 980);
  }

  // ---------- UX wiring ----------
  let qty = 4;
  let lastPersons = null;
  let lastQty = 4;

  // Re-render using the already generated characters (no reroll).
  // Used when toggling "Mostrar rolagens" or changing quantity after rolling.
  function renderFromLast({ animate } = { animate: false }) {
    if (!lastPersons || !lastPersons.length) return;
    const showRolls = !!els.toggleRolls.checked;

    els.cards.innerHTML = "";

    for (let i = 0; i < qty; i++) {
      const card = createCardShell(i);
      els.cards.appendChild(card);

      if (animate) {
        // keep the original staged reveal
        setTimeout(() => {
          ping("tick");
          fillCard(card, lastPersons[i], showRolls);
        }, i * 180);
      } else {
        // instant fill (no delays/sounds)
        fillCardInstant(card, lastPersons[i], showRolls);
      }
    }
  }

  // Instant fill version of fillCard, used for re-rendering when UI toggles change.
  function fillCardInstant(card, p, showRolls) {
    // Use the same content as fillCard, but render everything immediately.
    const h3 = card.querySelector(".card-title h3");
    const subtitle = card.querySelector(".card-title p");
    const pvEl = card.querySelector(".card-stats .stat:nth-child(1) .stat-value");
    const caEl = card.querySelector(".card-stats .stat:nth-child(2) .stat-value");

    const arma = escapeHtml(p.occObj.arma_inicial || "—");
    const occ = escapeHtml(p.occNomeFinal || p.occObj.ocupacao || "—");
    const race = escapeHtml(p.raceName || "—");

    h3.textContent = `${race} — ${occ}`;
    subtitle.textContent = `Arma inicial: ${p.occObj.arma_inicial || "—"}`;
    pvEl.textContent = String(p.pvTotal);
    caEl.textContent = String(p.caBase);

    // Ossos
    const attrsBlock = card.querySelector(".block-atributos");
    if (attrsBlock) {
      attrsBlock.classList.add("is-revealed");
      const attrsBox = attrsBlock.querySelector(".attrs");
      if (attrsBox) attrsBox.innerHTML = renderAttrs(p, showRolls);
    }

    // Origem
    const origemBlock = card.querySelector(".block-origem");
    if (origemBlock) {
      origemBlock.classList.add("is-revealed");
      const lines = origemBlock.querySelector(".lines");
      const raceRoll = showRolls ? `3d6 → ${fmtDice(p.rRace.dice)} = ${p.rRace.sum}` : `${p.rRace.sum}`;
      let extra = "";
      if (p.jotunirTipo) {
        extra = `<div class="line"><span class="label">Etnia:</span> ${escapeHtml(p.jotunirTipo)} ${showRolls ? `(1d6 → ${p.jotunirRoll})` : ""}</div>`;
      }
      if (lines) {
        lines.innerHTML = `
          <div class="line"><span class="label">Raça:</span> ${race} <span class="muted">(${raceRoll})</span></div>
          ${extra}
        `;
      }
    }

    // Trabalho
    const trabalhoBlock = card.querySelector(".block-trabalho");
    if (trabalhoBlock) {
      trabalhoBlock.classList.add("is-revealed");
      const lines = trabalhoBlock.querySelector(".lines");
      const d66 = p.rOcc;
      const d66Line = showRolls
        ? `<div class="line d66"><span class="label">d66:</span> dezena 1d6 → <strong>${d66.dezena}</strong>, unidade 1d6 → <strong>${d66.unidade}</strong> <span class="muted">(= ${d66.valor})</span></div>`
        : `<div class="line"><span class="label">d66:</span> <span class="muted">${d66.valor}</span></div>`;
      if (lines) {
        lines.innerHTML = `
          <div class="line"><span class="label">Ocupação:</span> ${occ} ${p.occSub && showRolls ? `<span class="muted">(1d${p.occSub.die} → ${p.occSub.roll})</span>` : ``}</div>
          ${d66Line}
          <div class="line"><span class="label">Arma:</span> ${arma}</div>
          ${p.podeTerMunicao ? `<div class="line"><span class="label">Munição:</span> 2d10 (se aplicável)</div>` : ``}
        `;
      }
    }

    // Destino
    const destinoBlock = card.querySelector(".block-destino");
    if (destinoBlock) {
      destinoBlock.classList.add("is-revealed");
      const lines = destinoBlock.querySelector(".lines");
      const fortTitle = escapeHtml(p.fortObj.fortuna || "—");
      const fortRoll = showRolls ? `1d20 → ${p.rFort}` : String(p.rFort);
      const pvRollInfo = showRolls
        ? `(${p.pvDie === 6 ? "1d6" : "1d4"} → ${p.rPV} + mod CON (${p.mods.CON >= 0 ? "+" + p.mods.CON : p.mods.CON}))`
        : ``;
      if (lines) {
        lines.innerHTML = `
          <div class="line"><span class="label">Fortuna:</span> ${fortTitle} <span class="muted">(${fortRoll})</span></div>
          <div class="line"><span class="label">PV:</span> ${p.pvTotal} ${pvRollInfo ? `<span class="muted">${pvRollInfo}</span>` : ``}</div>
        
        <div class="line"><span class="label">Salvamentos:</span> SF ${p.SF_BASE} • SM ${p.SM_BASE}</div>
        <div class="line"><span class="label">Sorte:</span> ${p.sorte} ${showRolls ? `<span class="muted">(3d6 → ${fmtDice(p.rSorte.dice)} = ${p.rSorte.sum})</span>` : ``}</div>
`;
      }
    }

    // Mochila
    const mochilaBlock = card.querySelector(".block-mochila");
    if (mochilaBlock) {
      mochilaBlock.classList.add("is-revealed");
      const lines = mochilaBlock.querySelector(".lines");
      const e1 = escapeHtml(p.eqItem1);
      const e2 = escapeHtml(p.eqItem2);
      const eg = escapeHtml(p.eqItemG);
      const eq1Roll = showRolls ? `1d20 → ${p.eq1}` : String(p.eq1);
      const eq2Roll = showRolls ? `1d20 → ${p.eq2}` : String(p.eq2);
      const d66 = p.rEqG;
      const eqGMeta = showRolls
        ? `(d66: dezena ${d66.dezena} / unidade ${d66.unidade} = ${d66.valor})`
        : `(${d66.valor})`;
      if (lines) {
        lines.innerHTML = `
          <div class="line"><span class="label">Equipamentos:</span></div>
          <ul class="items">
            <li><span class="muted">(${eq1Roll})</span> ${e1}</li>
            <li><span class="muted">(${eq2Roll})</span> ${e2}</li>
            <li><span class="muted">${eqGMeta}</span> ${eg}</li>
          </ul>
        `;
      }
    }

    card.classList.remove("is-pending");
    card.classList.add("is-ready");
  }
  function setQty(n) {
    qty = n;
    els.qtyButtons.forEach((b) => b.classList.toggle("is-active", Number(b.dataset.qty) === n));

    // If we already rolled, update the view immediately.
    renderFromLast({ animate: false });
  }

  els.qtyButtons.forEach((b) => {
    b.addEventListener("click", () => {
      setQty(Number(b.dataset.qty));
      ping("tick");
    });
  });

  els.btnNewSeed.addEventListener("click", () => {
    setSeed(makeSeed());
    ping("whoosh");
    if (els.btnRoll.disabled === false) {
      els.pressagio.textContent = "O destino mudou. Role novamente quando quiser.";
    } else {
      els.pressagio.textContent = "O destino mudou. Acenda a vela.";
    }
  });

  els.btnLight.addEventListener("click", () => {
    ensureAudio();
    els.overlay.hidden = false;
    els.overlay.classList.remove("is-hide");
    els.overlay.classList.add("is-show");
    ping("whoosh");

    setTimeout(() => {
      els.overlay.classList.add("is-hide");
      els.btnRoll.disabled = false;
      els.btnLight.disabled = true;
      setTimeout(() => {
        els.overlay.hidden = true;
      }, 260);
    }, 900);
  });

  els.btnRoll.addEventListener("click", async () => {
    try {
      els.cards.innerHTML = "";
      const seed = els.seedValue.textContent.trim();
      const rng = makeRng(seed);
      els.pressagio.textContent = pickPressagio(rng);

      // gera até 6 sempre, pra seed manter consistência
      const persons = [];
      for (let i = 0; i < 6; i++) {
        persons.push(gerarPersonagem(rng));
      }

      const showRolls = !!els.toggleRolls.checked;

      lastPersons = persons;
      lastQty = qty;
      if (els.btnExport) els.btnExport.disabled = false;

      renderFromLast({ animate: true });
    } catch (err) {
      console.error(err);
      els.cards.innerHTML = `<div class="section-card"><p>Erro ao gerar o funil. Veja o console.</p></div>`;
    }
  });

  // Toggle "Mostrar rolagens" should update the current view without rerolling.
  els.toggleRolls.addEventListener("change", () => {
    renderFromLast({ animate: false });
    ping("tick");
  });

  function exportarTxt() {
    if (!lastPersons || !lastPersons.length) return;
    const seed = els.seedValue.textContent.trim();

    const linhas = [];
    linhas.push('Trilhas & Tesouros — Forja do Funil (Nível 0)');
    linhas.push('Selo do Destino: ' + seed);
    linhas.push('');

    for (let i = 0; i < lastQty; i++) {
      const p = lastPersons[i];
      linhas.push(`=== Personagem #${i + 1} ===`);
      linhas.push(`Raça: ${p.raceName}${p.jotunirTipo ? ' (' + p.jotunirTipo + ')' : ''}`);
      linhas.push(`Ocupação (d66): ${p.occNomeFinal || p.occObj.ocupacao} (${p.rOcc.valor}${p.occSub ? '; 1d' + p.occSub.die + ' → ' + p.occSub.roll : ''})`);
      linhas.push(`Arma inicial: ${p.occObj.arma_inicial}`);
      linhas.push(`PV: ${p.pvTotal}`);
      linhas.push(`CA (base): ${p.caBase}`);
      linhas.push(`Salvamentos: SF ${p.SF_BASE} / SM ${p.SM_BASE}`);
      linhas.push(`Sorte (3d6): ${p.sorte} (${p.rSorte.dice.join('+')} = ${p.rSorte.sum})`);
      linhas.push('');

      linhas.push('Atributos:');
      const order = ['FOR','DES','CON','INT','VON','CAR'];
      order.forEach((k) => {
        const val = p.atributos[k];
        const mod = p.mods[k];
        linhas.push(`- ${k}: ${val} (${mod >= 0 ? '+' + mod : mod})`);
      });
      linhas.push('');

      linhas.push(`Fortuna (1d20): ${p.fortObj.fortuna} (${p.rFort})`);
      linhas.push('');

      linhas.push('Equipamentos:');
      linhas.push(`- (${p.eq1}) ${p.eqItem1}`);
      linhas.push(`- (${p.eq2}) ${p.eqItem2}`);
      linhas.push(`- (d66 ${p.rEqG.valor}) ${p.eqItemG}`);
      if (p.podeTerMunicao) linhas.push(`- Munição: 2d10 (se aplicável)`);
      linhas.push('');
    }

    const texto = linhas.join('\n');
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const fileSafeSeed = seed.replaceAll(':', '').replaceAll('/', '-');
    a.download = `tt-funil-${fileSafeSeed}.txt`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    ping('stamp');
  }

  if (els.btnExport) {
    els.btnExport.addEventListener('click', exportarTxt);
  }

  // ---------- Init ----------
  async function init() {
    try {
      const seed = getSeed() || makeSeed();
      setSeed(seed);

      const [mods, racas, ocup, fort, equip, equipG] = await Promise.all([
        loadJson(DATA.mods),
        loadJson(DATA.racas),
        loadJson(DATA.ocup),
        loadJson(DATA.fort),
        loadJson(DATA.equip),
        loadJson(DATA.equipG),
      ]);
      tables = { mods, racas, ocup, fort, equip, equipG };
    } catch (err) {
      console.error(err);
      els.pressagio.textContent = "Não foi possível carregar as tabelas do funil.";
    }
  }

  init();
})();
