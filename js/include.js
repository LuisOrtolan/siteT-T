// Inclui header e footer reutilizáveis em todas as páginas
function loadPartial(targetId, filePath, basePath) {
  fetch(filePath)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Erro HTTP " + response.status);
      }
      return response.text();
    })
    .then(function (html) {
      var container = document.getElementById(targetId);
      if (!container) return;
      container.innerHTML = html;

      // Ajusta links com data-href usando o basePath
      var links = container.querySelectorAll("a[data-href]");
      links.forEach(function (link) {
        var rel = link.getAttribute("data-href");
        if (rel) {
          link.setAttribute("href", basePath + rel);
        }
      });
    })
    .catch(function (err) {
      console.error("Erro ao carregar include:", filePath, err);
    });
}

function loadLayout(basePath) {
  loadPartial("header", basePath + "partials/header.html", basePath);
  loadPartial("footer", basePath + "partials/footer.html", basePath);
}
