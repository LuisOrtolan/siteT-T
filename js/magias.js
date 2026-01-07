/*
  Trilhas & Tesouros — Magias/Poderes

  Como usar:
  - Em páginas de lista (magias/*.html):
      <section id="lista-magias" data-magias="../data/magias_feiticos.json,..."></section>
    + inputs (opcionais):
      #busca-magia, #filtro-trilha, #filtro-tipo, #filtro-circulo

  - Em páginas de trilha (trilhas/*.html):
      <div class="lista-magias-trilha" data-trilha="Arcanista" data-magias="../data/magias_feiticos.json"></div>

  Obs.: O JSON deve ser um array de objetos com pelo menos:
    { nome, tipo, trilha, circulo_ou_grau, descricao }
*/

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function toNumberMaybe(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalize(str) {
    return (str || "").toString().trim();
  }

  function splitSources(value) {
    if (!value) return [];
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Falha ao carregar ${url}: ${res.status}`);
    }
    return res.json();
  }

  function sortEntries(a, b) {
    const ta = normalize(a.tipo);
    const tb = normalize(b.tipo);
    if (ta !== tb) return ta.localeCompare(tb, "pt-BR");

    const trA = normalize(a.trilha);
    const trB = normalize(b.trilha);
    if (trA !== trB) return trA.localeCompare(trB, "pt-BR");

    const ca = toNumberMaybe(a.circulo_ou_grau) ?? 0;
    const cb = toNumberMaybe(b.circulo_ou_grau) ?? 0;
    if (ca !== cb) return ca - cb;

    return normalize(a.nome).localeCompare(normalize(b.nome), "pt-BR");
  }

  function makeCard(entry) {
    const article = document.createElement("article");
    article.className = "magia-card";

    const header = document.createElement("div");
    header.className = "magia-header";

    const nome = document.createElement("div");
    nome.className = "magia-nome";
    nome.textContent = normalize(entry.nome);

    const tag = document.createElement("div");
    tag.className = "magia-trilha-tag";
    tag.textContent = normalize(entry.trilha || entry.subtipo || "");

    header.appendChild(nome);
    if (tag.textContent) header.appendChild(tag);

    const meta = document.createElement("div");
    meta.className = "magia-meta";

    const tipo = normalize(entry.tipo);
    const circ = entry.circulo_ou_grau !== undefined && entry.circulo_ou_grau !== null ? String(entry.circulo_ou_grau) : "";
    const parts = [];
    if (tipo) parts.push(`Tipo: ${tipo}`);
    if (circ) parts.push(`Círculo/Grau: ${circ}`);
    if (normalize(entry.raridade)) parts.push(`Raridade: ${normalize(entry.raridade)}`);
    if (normalize(entry.sigla)) parts.push(`Runa: ${normalize(entry.sigla)}`);
    meta.textContent = parts.join(" • ");

    const details = document.createElement("details");
    details.className = "magia-details";

    const summary = document.createElement("summary");
    summary.textContent = "Detalhes";

    const desc = document.createElement("div");
    desc.className = "magia-descricao";
    desc.textContent = normalize(entry.descricao);

    details.appendChild(summary);
    details.appendChild(desc);

    article.appendChild(header);
    if (meta.textContent) article.appendChild(meta);
    if (desc.textContent) article.appendChild(details);

    return article;
  }

  function renderList(container, items) {
    container.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "Nenhum resultado encontrado.";
      container.appendChild(empty);
      return;
    }
    items.forEach((m) => container.appendChild(makeCard(m)));
  }

  function populateCircles(select, items) {
    if (!select) return;
    const current = select.value;
    const circles = uniq(
      items
        .map((m) => m.circulo_ou_grau)
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
        .map((v) => String(v))
    ).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));

    // Keep the first option ("Todos") and rebuild the rest
    const first = select.querySelector("option");
    select.innerHTML = "";
    if (first) select.appendChild(first);
    circles.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    // restore selection if possible
    if (current && circles.includes(current)) select.value = current;
  }

  function applyFilters(allItems, controls) {
    const q = normalize(controls.q?.value).toLowerCase();
    const trilha = normalize(controls.trilha?.value);
    const tipo = normalize(controls.tipo?.value);
    const circulo = normalize(controls.circulo?.value);

    return allItems.filter((m) => {
      const nome = normalize(m.nome).toLowerCase();
      if (q && !nome.includes(q)) return false;
      if (trilha && normalize(m.trilha) !== trilha) return false;
      if (tipo && normalize(m.tipo) !== tipo) return false;
      if (circulo && String(m.circulo_ou_grau) !== circulo) return false;
      return true;
    });
  }

  async function loadAllMagiasFromPage() {
    // Collect every data-magias used on the page
    const sources = uniq(
      $$('[data-magias]')
        .flatMap((el) => splitSources(el.dataset.magias))
        .filter(Boolean)
    );

    // Backward-compatible default
    if (!sources.length) {
      const defaultEl = $("#lista-magias");
      if (defaultEl) sources.push("../data/magias.json");
    }

    const loaded = [];
    for (const url of sources) {
      try {
        const data = await fetchJson(url);
        if (Array.isArray(data)) {
          data.forEach((m) => loaded.push({ ...m, __source: url }));
        }
      } catch (err) {
        console.warn(err);
      }
    }

    return loaded.sort(sortEntries);
  }

  function renderMagiasPage(allItems) {
    const container = $("#lista-magias");
    if (!container) return;

    const controls = {
      q: $("#busca-magia"),
      trilha: $("#filtro-trilha"),
      tipo: $("#filtro-tipo"),
      circulo: $("#filtro-circulo"),
    };

    function update() {
      const filtered = applyFilters(allItems, controls).sort(sortEntries);
      // circle options depend on current trilha/tipo filters to stay relevant
      const subsetForCircles = applyFilters(allItems, { ...controls, q: { value: "" }, circulo: { value: "" } });
      populateCircles(controls.circulo, subsetForCircles);
      renderList(container, filtered);
    }

    [controls.q, controls.trilha, controls.tipo, controls.circulo].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });

    populateCircles(controls.circulo, allItems);
    update();
  }

  function renderTrilhaSections(allItems) {
    const containers = $$(".lista-magias-trilha");
    if (!containers.length) return;

    containers.forEach((el) => {
      const trilha = normalize(el.dataset.trilha);
      const sources = splitSources(el.dataset.magias);
      let items = allItems;
      if (sources.length) items = items.filter((m) => sources.includes(m.__source));
      if (trilha) items = items.filter((m) => normalize(m.trilha) === trilha);
      items = items.sort(sortEntries);
      renderList(el, items);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const allItems = await loadAllMagiasFromPage();
    if (!allItems.length) return;
    renderMagiasPage(allItems);
    renderTrilhaSections(allItems);
  });
})();
