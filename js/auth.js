// js/auth.js
// Login (magic link) via Supabase Auth, widget simples reaproveitável no header.
window.TT_AUTH = (function () {
  var client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.TT_SUPABASE_URL || window.TT_SUPABASE_URL.indexOf('COLE_AQUI') === 0) {
      return null;
    }
    client = window.supabase.createClient(window.TT_SUPABASE_URL, window.TT_SUPABASE_ANON_KEY);
    return client;
  }

  function getSession() {
    var c = getClient();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) { return r.data.session; });
  }

  function signInWithEmail(email) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase não configurado.'));
    return c.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: window.location.href }
    });
  }

  function signOut() {
    var c = getClient();
    if (!c) return Promise.resolve();
    return c.auth.signOut();
  }

  function onChange(cb) {
    var c = getClient();
    if (!c) return;
    c.auth.onAuthStateChange(function (_event, session) { cb(session); });
  }

  // Renderiza um widget de login/logout dentro do container informado.
  function mountWidget(containerSelector) {
    var el = document.querySelector(containerSelector);
    if (!el) return;
    var c = getClient();
    if (!c) {
      el.innerHTML = '';
      return;
    }

    function renderLoggedOut() {
      el.innerHTML =
        '<form class="tt-auth-form" id="tt-auth-form">' +
        '<input type="email" id="tt-auth-email" placeholder="seu@email.com" required />' +
        '<button type="submit" class="btn btn-secondary tt-auth-btn">Entrar</button>' +
        '</form>' +
        '<p class="tt-auth-msg" id="tt-auth-msg"></p>';

      var form = el.querySelector('#tt-auth-form');
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var email = el.querySelector('#tt-auth-email').value.trim();
        var msg = el.querySelector('#tt-auth-msg');
        if (!email) return;
        msg.textContent = 'Enviando link...';
        signInWithEmail(email).then(function (res) {
          if (res.error) {
            msg.textContent = 'Erro: ' + res.error.message;
          } else {
            msg.textContent = 'Link enviado! Confira seu email.';
          }
        });
      });
    }

    function renderLoggedIn(session) {
      var email = (session.user && session.user.email) || '';
      el.innerHTML =
        '<span class="tt-auth-email">' + email + '</span>' +
        '<button class="btn btn-secondary tt-auth-btn" id="tt-auth-logout">Sair</button>';
      el.querySelector('#tt-auth-logout').addEventListener('click', function () {
        signOut();
      });
    }

    getSession().then(function (session) {
      if (session) renderLoggedIn(session); else renderLoggedOut();
    });

    onChange(function (session) {
      if (session) renderLoggedIn(session); else renderLoggedOut();
    });
  }

  return { getClient: getClient, getSession: getSession, signInWithEmail: signInWithEmail, signOut: signOut, onChange: onChange, mountWidget: mountWidget };
})();
