// js/magias.js
// Lê data/magias.json e preenche:
// - a página Magias & Poderes (lista completa + filtros)
// - as seções de magias em cada Trilha (div.lista-magias-trilha[data-trilha])

let TODAS_MAGIAS = [];

// Descobre o caminho base para chegar em /data/magias.json
function getBasePath() {
  const path = window.location.pathname;

  // Páginas em subpastas usam "../"
  if (
    path.includes("/trilhas/") ||
    path.includes("/regras/") ||
    path.includes("/magias/")
  ) {
    return "../";
  }

  // Páginas na raiz (index.html, sobre.html, etc.)
  return "";
}

function criarCardMagia(magia) {
  const artigo = document.createElement("article");
  artigo.className = "magia-card";

  const circulo =
    magia.circulo_ou_grau !== undefined && magia.circulo_ou_grau !== null
      ? magia.circulo_ou_grau
      : "?";

  artigo.innerHTML = `
    <h3 class="magia-titulo">${magia.nome}</h3>
    <p class="magia-meta">
      <span class="magia-trilha">${magia.trilha || ""}</span>
      &bull;
      <span class="magia-tipo">${magia.tipo || ""}</span>
      &bull;
      <span class="magia-circulo">Círculo/Grau ${circulo}</span>
    </p>
    ${
      magia.resumo
        ? `<p class="magia-resumo">${magia.resumo}</p>`
        : ""
    }
    <details class="magia-detalhes">
      <summary>Detalhes</summary>
      <p><strong>Tradição:</strong> ${magia.tradicao || "-"}</p>
      <p><strong>Alcance:</strong> ${magia.alcance || "-"}</p>
      <p><strong>Duração:</strong> ${magia.duracao || "-"}</p>
      <p><strong>Alvo:</strong> ${magia.alvo || "-"}</p>
      ${
        magia.descricao
          ? `<p class="magia-descricao">${magia.descricao}</p>`
          : ""
      }
    </details>
  `;

  return artigo;
}

// Página de Magias & Poderes (lista geral + filtros)
function popularPaginaMagias() {
  const lista = document.getElementById("lista-magias");
  if (!lista) return; // não estamos em magias/index.html

  const buscaInput = document.getElementById("busca-magia");
  const trilhaSelect = document.getElementById("filtro-trilha");

  function aplicaFiltros() {
    const termo = (buscaInput && buscaInput.value
      ? buscaInput.value.toLowerCase()
      : ""
    ).trim();

    const trilhaFiltro =
      trilhaSelect && trilhaSelect.value
        ? trilhaSelect.value
        : "todas";

    lista.innerHTML = "";

    let filtradas = TODAS_MAGIAS.slice();

    if (trilhaFiltro !== "todas") {
      filtradas = filtradas.filter(
        (m) => (m.trilha || "").toLowerCase() === trilhaFiltro.toLowerCase()
      );
    }

    if (termo) {
      filtradas = filtradas.filter((m) => {
        const nome = (m.nome || "").toLowerCase();
        const resumo = (m.resumo || "").toLowerCase();
        const tipo = (m.tipo || "").toLowerCase();
        return (
          nome.includes(termo) ||
          resumo.includes(termo) ||
          tipo.includes(termo)
        );
      });
    }

    // Ordena por trilha, círculo e nome
    filtradas.sort((a, b) => {
      const trilhaA = (a.trilha || "").localeCompare(b.trilha || "");
      if (trilhaA !== 0) return trilhaA;

      const circA = a.circulo_ou_grau || 0;
      const circB = b.circulo_ou_grau || 0;
      if (circA !== circB) return circA - circB;

      return (a.nome || "").localeCompare(b.nome || "");
    });

    if (filtradas.length === 0) {
      const vazio = document.createElement("p");
      vazio.className = "magia-vazia";
      vazio.textContent = "Nenhuma magia encontrada com esses filtros.";
      lista.appendChild(vazio);
      return;
    }

    filtradas.forEach((magia) => {
      lista.appendChild(criarCardMagia(magia));
    });
  }

  if (buscaInput) {
    buscaInput.addEventListener("input", aplicaFiltros);
  }
  if (trilhaSelect) {
    trilhaSelect.addEventListener("change", aplicaFiltros);
  }

  aplicaFiltros();
}

// Seções de magias em cada página de Trilha
function popularListasPorTrilha() {
  const containers = document.querySelectorAll(
    ".lista-magias-trilha[data-trilha]"
  );
  if (!containers.length) return;

  containers.forEach((container) => {
    const trilha = container.getAttribute("data-trilha");
    if (!trilha) return;

    let magiasTrilha = TODAS_MAGIAS.filter(
      (m) => (m.trilha || "").toLowerCase() === trilha.toLowerCase()
    );

    // Ordena cronologicamente por círculo e depois por nome
    magiasTrilha.sort((a, b) => {
      const circA = a.circulo_ou_grau || 0;
      const circB = b.circulo_ou_grau || 0;
      if (circA !== circB) return circA - circB;
      return (a.nome || "").localeCompare(b.nome || "");
    });

    container.innerHTML = "";

    if (!magiasTrilha.length) {
      const vazio = document.createElement("p");
      vazio.className = "magia-vazia";
      vazio.textContent =
        "Nenhuma magia cadastrada ainda para esta trilha.";
      container.appendChild(vazio);
      return;
    }

    magiasTrilha.forEach((magia) => {
      container.appendChild(criarCardMagia(magia));
    });
  });
}

// Carregamento inicial
document.addEventListener("DOMContentLoaded", function () {
  const basePath = getBasePath();
  const url = basePath + "data/magias.json";

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Erro ao carregar magias.json: " + response.status);
      }
      return response.json();
    })
    .then((dados) => {
      if (!Array.isArray(dados)) {
        throw new Error("Formato inválido de magias.json (esperado array).");
      }
      TODAS_MAGIAS = dados;

      popularPaginaMagias();
      popularListasPorTrilha();
    })
    .catch((erro) => {
      console.error(erro);
    });
});
