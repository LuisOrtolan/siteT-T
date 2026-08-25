// Inclui header e footer reutilizáveis em todas as páginas
function loadPartial(targetId, filePath, basePath) {
  return fetch(filePath)
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

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function loadAuthWidget(basePath, headerReady) {
  var scriptsReady = loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js")
    .then(function () { return loadScript(basePath + "js/supabase-config.js"); })
    .then(function () { return loadScript(basePath + "js/auth.js"); });

  Promise.all([scriptsReady, headerReady])
    .then(function () {
      if (window.TT_AUTH) window.TT_AUTH.mountWidget("#tt-auth");
    })
    .catch(function (err) { console.error("Erro ao carregar autenticação:", err); });
}

function loadLayout(basePath) {
  var headerReady = loadPartial("header", basePath + "partials/header.html", basePath);
  loadPartial("footer", basePath + "partials/footer.html", basePath);
  loadAuthWidget(basePath, headerReady);
}
