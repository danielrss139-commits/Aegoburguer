/* AEGO Burguer — site institucional */
(function () {
  'use strict';
  var DB = window.AEGO_DB, U = window.AEGO_U, d = document;
  d.documentElement.classList.add('js');
  U.abertura('ab_intro');

  // topo fica sólido depois do hero (rAF + passivo = rolagem leve)
  var topo = d.getElementById('topo'), pend = false;
  function topoSolido() { pend = false; topo.classList.toggle('solido', window.scrollY > 40); }
  window.addEventListener('scroll', function () { if (!pend) { pend = true; requestAnimationFrame(topoSolido); } }, { passive: true });
  topoSolido();

  // entradas ao rolar (uma vez, em cascata); depois da entrada a classe sai para o hover do cartão voltar a valer
  var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function limpar(el) { el.classList.remove('revela', 'visto'); el.style.removeProperty('--rd'); }
  var io = 'IntersectionObserver' in window && !reduz ? new IntersectionObserver(function (es) {
    var k = 0;
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      el.style.setProperty('--rd', Math.min(k++, 6) * 80 + 'ms');
      el.classList.add('visto');
      setTimeout(function () { limpar(el); }, 1300);
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function observar(root) { (root || d).querySelectorAll('.revela:not(.visto)').forEach(function (el) { if (io) io.observe(el); else limpar(el); }); }

  // loops só rodam visíveis: pausa fora da tela e com a aba oculta
  function vigiar(el, cb) {
    if (!el || !('IntersectionObserver' in window)) { if (cb) cb(true); return; }
    new IntersectionObserver(function (es) { var v = es[0].isIntersecting; el.classList.toggle('parado', !v); if (cb) cb(v); }, { rootMargin: '80px 0px' }).observe(el);
  }
  d.addEventListener('visibilitychange', function () { d.documentElement.classList.toggle('oculto', d.hidden); });
  // hero: a foto do fundo desce mais devagar que a página (parallax leve, só transform, só com o hero na tela)
  (function () {
    var fundo = d.getElementById('heroFundo'), visto = true, pend2 = false;
    vigiar(d.getElementById('inicio'), function (v) { visto = v; });
    if (!fundo || reduz) return;
    function quadro() { pend2 = false; if (!visto) return; var y = Math.min(window.scrollY, window.innerHeight * 1.2); fundo.style.transform = 'translate3d(0,' + (y * .32).toFixed(1) + 'px,0)'; }
    window.addEventListener('scroll', function () { if (!pend2 && visto) { pend2 = true; requestAnimationFrame(quadro); } }, { passive: true });
    quadro();
  })();

  // montagem: as camadas caem uma a uma (pão de baixo → pão de cima) conforme a seção sobe na tela
  (function () {
    var palco = d.getElementById('agPalco'); if (!palco) return;
    var cams = [].slice.call(palco.querySelectorAll('.ag-cam'));
    var itens = [].slice.call(d.querySelectorAll('.ag-lista li'));
    // posições montadas (px na escala da foto original, 416 px de largura)
    var MON = [0, 150, 232, 282, 372], ALT = [187, 143, 148, 171, 145];
    var ROT = [-14, 10, -8, 9, -6], DX = [-60, 70, -50, 60, -40];
    var topoPalco = 0, altPalco = 0, k = 1, vh = 0, ultimo = -1, vivo = false, raf = 0, montado = false;
    function medir() {
      var r = palco.getBoundingClientRect();
      topoPalco = r.top + window.scrollY; altPalco = palco.offsetHeight; vh = window.innerHeight;
      k = cams[0].offsetWidth / 418; ultimo = -1;
    }
    function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function volta(x) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); } // easeOutBack: assenta com um quique
    function quadro() {
      raf = 0; if (!vivo) return;
      var y = window.scrollY;
      if (y !== ultimo) {
        ultimo = y;
        // começa quando o palco entra por baixo; termina com o centro do palco a 55% da tela
        var t = reduz ? 1 : cl((y + vh - topoPalco) / (altPalco * .5 + vh * .45));
        var base = (altPalco - (MON[4] + ALT[4]) * k) / 2;
        for (var i = 0; i < cams.length; i++) {
          var c = +cams[i].getAttribute('data-c'), ordem = 4 - c;           // pão de baixo cai primeiro
          var p = cl((t - ordem * .14) / .44), e = volta(p), f = 1 - e;
          var py = base + MON[c] * k - f * (altPalco * .75 + 60);
          cams[i].style.transform = 'translate3d(' + (DX[c] * f).toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) rotate(' + (ROT[c] * f).toFixed(2) + 'deg)';
          cams[i].style.opacity = cl(p * 2.2).toFixed(2);
          if (itens[c]) itens[c].classList.toggle('ag-on', p > .9);
        }
        var ok = t >= .999;
        if (ok !== montado) { montado = ok; palco.classList.toggle('montado', ok); }
      }
      if (!reduz) raf = requestAnimationFrame(quadro);
    }
    function ligar(v) { vivo = v && !d.hidden; if (vivo && !raf) { ultimo = -1; raf = requestAnimationFrame(quadro); } }
    var visivel = false;
    vigiar(d.getElementById('camadas'), function (v) { visivel = v; ligar(v); });
    d.addEventListener('visibilitychange', function () { ligar(visivel); });
    window.addEventListener('resize', function () { medir(); ligar(visivel); }, { passive: true });
    window.addEventListener('load', function () { medir(); ligar(visivel); });
    medir(); vivo = true; quadro(); vivo = visivel;
  })();

  function aplicarLoja(l) {
    d.querySelectorAll('[data-loja]').forEach(function (el) { var v = l[el.getAttribute('data-loja')]; if (v) el.textContent = v; });
    var tel = '+55' + String(l.telefone).replace(/\D/g, '');
    d.getElementById('tel').href = 'tel:' + tel;
    d.getElementById('horario').textContent = 'Todos os dias, das ' + l.abre.replace(':', 'h') + ' às ' + l.fecha.replace(':', 'h');
    var min = Math.min.apply(null, l.bairros.map(function (b) { return b.taxa; }));
    d.getElementById('entrega').textContent = l.bairros.slice(0, 4).map(function (b) { return b.nome; }).join(', ') + ' e região · taxa a partir de ' + U.brl(min);
    d.getElementById('comoChegar').href = l.mapa; d.getElementById('mapa').href = l.mapa;
    var zap = 'https://wa.me/' + l.whatsapp + '?text=' + encodeURIComponent('Olá, AEGO Burguer! Vim pelo site.');
    d.getElementById('zap').href = zap; d.getElementById('zapFab').href = zap;
    d.getElementById('notaMedia').textContent = String(l.notaMedia).replace('.', ',');
    d.getElementById('notaTotal').textContent = '+' + l.totalAvaliacoes.toLocaleString('pt-BR') + ' avaliações';
    d.getElementById('avals').innerHTML = (l.avaliacoes || []).map(function (a) {
      return '<figure class="aval revela"><span class="estrelas" aria-label="' + a.nota + ' estrelas">' + '★★★★★'.slice(0, a.nota) + '</span><blockquote>' + U.esc(a.texto) + '</blockquote><figcaption>' + U.esc(a.nome) + '</figcaption></figure>';
    }).join('');
    d.getElementById('ano').textContent = new Date().getFullYear();
    observar(d.getElementById('avals'));
  }

  function aplicarCardapio(c) {
    var ids = ['aego-burguer', 'crispy', 'smash-bacon', 'melt', 'aego-salad', 'duplo-bacon'];
    var itens = c.itens.filter(function (i) { return i.disponivel && i.cat !== 'bebidas'; });
    var escolha = ids.map(function (id) { return itens.filter(function (i) { return i.id === id; })[0]; }).filter(Boolean);
    if (escolha.length < 6) itens.filter(function (i) { return i.destaque && escolha.indexOf(i) < 0; }).forEach(function (i) { if (escolha.length < 6) escolha.push(i); });
    d.getElementById('cards').innerHTML = escolha.map(function (i) {
      return '<a class="card revela" href="pedir.html#item-' + U.esc(i.id) + '"><div class="card-foto"><img src="' + U.esc(i.foto) + '" alt="' + U.esc(i.nome) + '" width="900" height="900" loading="lazy" decoding="async"></div>' +
        '<h3>' + U.esc(i.nome) + '</h3><p>' + U.esc(i.desc) + '</p><div class="card-preco">' + U.precoMenu(i.preco) + '<small>Pedir →</small></div></a>';
    }).join('');
    observar(d.getElementById('cards'));
  }

  (function () { // botão flutuante do WhatsApp aparece depois da entrada
    var fab = d.getElementById('zapFab'), hero = d.getElementById('inicio');
    if (!fab || !hero || !('IntersectionObserver' in window)) { if (fab) fab.classList.add('on'); return; }
    new IntersectionObserver(function (es) { fab.classList.toggle('on', !es[0].isIntersecting); }, { threshold: 0.15 }).observe(hero);
  })();

  DB.loja().then(aplicarLoja);
  DB.cardapio().then(aplicarCardapio);
  DB.ouvirLoja(function () { DB.loja().then(aplicarLoja); });
  DB.ouvirCardapio(function () { DB.cardapio().then(aplicarCardapio); });
  observar();
})();
