/* AEGO Burguer — painel da loja: pedidos ao vivo, cardápio, financeiro, ajustes */
(function () {
  'use strict';
  var DB = window.AEGO_DB, U = window.AEGO_U, d = document, w = window;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var esc = U.esc, brl = U.brl, LS = w.localStorage;

  var loja = null, cardapio = { categorias: [], itens: [] }, pedidos = [], conhecidos = null, abaAtual = 'pedidos', periodo = 'hoje', catFiltro = '';
  var somOn = LS.getItem('ab_som') !== '0';
  var FOTOS = ['aego', 'salad', 'crispy', 'smash', 'triplo', 'duplo', 'melt', 'frango', 'combo1', 'combo2', 'batata', 'batatacb', 'onion', 'nuggets', 'refri', 'guarana', 'limonada', 'shake', 'brownie', 'petit'];
  var TITULOS = { pedidos: 'Pedidos', concluidos: 'Concluídos', cardapio: 'Cardápio', financeiro: 'Financeiro', ajustes: 'Ajustes' };

  /* ---------- utilidades ---------- */
  var tT;
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function hoje0() { var x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); }
  function aplicarTema(t) { d.documentElement.setAttribute('data-tema', t); LS.setItem('ab_tema', t); $('meta[name=theme-color]').content = t === 'claro' ? '#f4f1ec' : '#120e0b'; }

  // som: Web Audio (liberado no 1º toque do usuário)
  var ac = null;
  function liberarAudio() { try { if (!ac) ac = new (w.AudioContext || w.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
  ['pointerdown', 'keydown'].forEach(function (ev) { d.addEventListener(ev, liberarAudio, { passive: true }); });
  function tocar() {
    if (!somOn || !ac) return;
    try {
      var t0 = ac.currentTime;
      [[880, 0], [1175, .16], [1568, .32]].forEach(function (n) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0, t0 + n[1]); g.gain.linearRampToValueAtTime(.22, t0 + n[1] + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + n[1] + .45);
        o.connect(g); g.connect(ac.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + .5);
      });
    } catch (e) {}
    if (navigator.vibrate) try { navigator.vibrate([120, 60, 120]); } catch (e) {}
  }
  function pintarSom() { $('#btnSom').classList.toggle('off', !somOn); $('#btnSom').setAttribute('aria-pressed', somOn); $('#chSom').checked = somOn; }

  /* ---------- folha ---------- */
  var folha = $('#folha'), veu = $('#veu');
  function abrir(titulo, corpo, pe, manter) {
    if (!manter && titulo.indexOf('Pedido #') !== 0) fichaAberta = null;
    var jaAberta = folha.classList.contains('on');
    folha.innerHTML = '<div class="folha-cab"><h2>' + titulo + '</h2><button class="btn-ic" type="button" data-fechar aria-label="Fechar"><svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="folha-corpo">' + corpo + '</div>' + (pe ? '<div class="folha-pe">' + pe + '</div>' : '');
    folha.hidden = false; veu.hidden = false;
    if (jaAberta) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { folha.classList.add('on'); veu.classList.add('on'); }); });
  }
  function fechar() { fichaAberta = null; folha.classList.remove('on'); veu.classList.remove('on'); setTimeout(function () { if (!folha.classList.contains('on')) { folha.hidden = true; veu.hidden = true; } }, 340); }
  veu.onclick = fechar;
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && folha.classList.contains('on')) fechar(); });
  folha.addEventListener('click', function (e) { if (e.target.closest('[data-fechar]')) fechar(); });
  function confirmar(titulo, texto, botao, cb) {
    abrir(titulo, '<p style="margin:0;color:var(--mut)">' + texto + '</p>', '<button class="btn" type="button" data-fechar>Voltar</button><button class="btn btn-amb" type="button" id="cfOk">' + botao + '</button>');
    $('#cfOk').onclick = function () { fechar(); cb(); };
  }

  /* ---------- login ---------- */
  function iniciar() {
    $('#loginMono').innerHTML = U.monograma();
    $('#ladoMono').innerHTML = U.monograma(); $('#topoMono').innerHTML = U.monograma();
    if (DB.usuario()) entrarApp(); else { $('#login').hidden = false; }
  }
  $('#formLogin').addEventListener('submit', function (e) {
    e.preventDefault(); liberarAudio();
    DB.entrar(e.target.email.value, e.target.senha.value).then(entrarApp, function (er) { $('#loginErro').textContent = er.message; });
  });
  function entrarApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    Promise.all([DB.loja(), DB.cardapio(), DB.pedidos({ desde: hoje0() - 60 * 864e5 })]).then(function (r) {
      loja = r[0]; cardapio = r[1]; pedidos = r[2];
      conhecidos = {}; pedidos.forEach(function (p) { conhecidos[p.id] = 1; });
      pintarLoja(); pintarPedidos(); pintarSom();
      var a = (location.hash || '').replace('#', ''); if (TITULOS[a]) aba(a);
    });
    DB.ouvirPedidos(function () {
      DB.pedidos({ desde: hoje0() - 60 * 864e5 }).then(function (lista) {
        var novos = lista.filter(function (p) { return !conhecidos[p.id]; });
        pedidos = lista; lista.forEach(function (p) { conhecidos[p.id] = 1; });
        pintarPedidos(novos.map(function (p) { return p.id; }));
        if (abaAtual === 'concluidos') pintarConcluidos();
        if (fichaAberta && acharPedido(fichaAberta)) abrirPedido(fichaAberta, true);
        if (abaAtual === 'financeiro') pintarFinanceiro();
        novos.filter(function (p) { return p.status === 'novo'; }).forEach(avisarNovo);
      });
    });
    DB.ouvirCardapio(function () { DB.cardapio().then(function (c) { cardapio = c; if (abaAtual === 'cardapio') pintarCardapio(); }); });
    DB.ouvirLoja(function () { DB.loja().then(function (l) { loja = l; pintarLoja(); }); });
    setInterval(function () { if (abaAtual === 'pedidos') atualizarTempos(); pintarLoja(); }, 30000);
  }

  /* ---------- topo / loja ---------- */
  function pintarLoja() {
    var st = DB.statusLoja(loja), p = $('#pillLoja');
    p.classList.toggle('aberta', st.aberta);
    p.querySelector('span').textContent = st.aberta ? 'Aberta' : 'Fechada';
    p.title = st.texto + (loja.modo === 'auto' ? ' (automático)' : ' (manual)') + ' — toque para ' + (st.aberta ? 'fechar' : 'abrir') + ' agora';
  }
  $('#pillLoja').onclick = function () {
    var st = DB.statusLoja(loja), novo = st.aberta ? 'fechada' : 'aberta';
    DB.salvarLoja({ modo: novo }).then(function (l) { loja = l; pintarLoja(); toast(novo === 'aberta' ? 'Loja aberta para pedidos' : 'Loja fechada: o cardápio não aceita envios'); });
  };
  $('#btnSom').onclick = function () { somOn = !somOn; LS.setItem('ab_som', somOn ? '1' : '0'); pintarSom(); liberarAudio(); if (somOn) tocar(); toast(somOn ? 'Aviso sonoro ligado' : 'Aviso sonoro desligado'); };

  /* ---------- abas ---------- */
  function aba(a) {
    abaAtual = a;
    Object.keys(TITULOS).forEach(function (k) { $('#aba-' + k).hidden = k !== a; });
    $$('#lado button').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-aba') === a); });
    $('#tituloAba').textContent = TITULOS[a];
    history.replaceState(null, '', '#' + a);
    if (a === 'pedidos') pintarPedidos(); if (a === 'concluidos') pintarConcluidos(); if (a === 'cardapio') pintarCardapio(); if (a === 'financeiro') pintarFinanceiro(); if (a === 'ajustes') pintarAjustes();
    w.scrollTo(0, 0);
  }
  $$('#lado button').forEach(function (b) { b.onclick = function () { aba(b.getAttribute('data-aba')); }; });

  /* ---------- pedidos (cozinha) ---------- */
  var COLS = [
    { id: 'novo', nome: 'Novos', st: ['novo'] },
    { id: 'preparo', nome: 'Em preparo', st: ['preparo'] },
    { id: 'saiu', nome: 'Saiu / Pronto p/ retirada', curto: 'Saiu / Pronto', st: ['saiu'] }
  ];
  var ATIVOS = ['novo', 'preparo', 'saiu'];
  function digitos(t) { return String(t || '').replace(/\D/g, ''); }
  function linkZap(tel, msg) { var n = digitos(tel); if (n.length <= 11) n = '55' + n; return 'https://wa.me/' + n + (msg ? '?text=' + encodeURIComponent(msg) : ''); }
  function linkTel(tel) { return 'tel:+55' + digitos(tel); }
  function primeiroNome(n) { return String(n || '').split(' ')[0]; }
  function endLinha(e) { return e ? e.rua + ', ' + e.numero + (e.complemento ? ' — ' + e.complemento : '') : ''; }
  function linkMapa(e) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.rua + ', ' + e.numero + ' - ' + e.bairro + ', ' + (loja.cidade || '')); }
  function qtdItens(p) { return p.itens.reduce(function (s, x) { return s + x.qtd; }, 0); }
  function resumoItens(p, max) {
    var t = p.itens.slice(0, max).map(function (x) { return x.qtd + '× ' + x.nome; }).join(', ');
    return t + (p.itens.length > max ? ' +' + (p.itens.length - max) : '');
  }
  function dataCurta(t) {
    var h0 = hoje0();
    if (t >= h0) return 'hoje, ' + U.hora(t);
    if (t >= h0 - 864e5) return 'ontem, ' + U.hora(t);
    var x = new Date(t); return (x.getDate() < 10 ? '0' : '') + x.getDate() + '/' + (x.getMonth() < 9 ? '0' : '') + (x.getMonth() + 1) + ', ' + U.hora(t);
  }
  function msgCliente(p) {
    var n = primeiroNome(p.cliente.nome), loj = loja.nome || 'AEGO Burguer';
    var m = {
      novo: 'Olá, ' + n + '! Recebemos seu pedido #' + p.numero + ' na ' + loj + '. Já vamos começar a preparar.',
      preparo: 'Olá, ' + n + '! Seu pedido #' + p.numero + ' já está em preparo na ' + loj + '. 🍔',
      saiu: p.tipo === 'entrega' ? 'Olá, ' + n + '! Seu pedido #' + p.numero + ' saiu para entrega e chega em instantes. 🛵' : 'Olá, ' + n + '! Seu pedido #' + p.numero + ' está pronto para retirada no balcão. 🍔',
      concluido: 'Olá, ' + n + '! Obrigado por pedir na ' + loj + '. Esperamos que tenha curtido! Volte sempre. 🧡',
      cancelado: 'Olá, ' + n + '. Sobre o seu pedido #' + p.numero + ' na ' + loj + ': '
    };
    return m[p.status] || '';
  }
  function rotuloAvancar(p) {
    if (p.status === 'novo') return 'Aceitar';
    if (p.status === 'preparo') return p.tipo === 'entrega' ? 'Saiu p/ entrega' : 'Pronto p/ retirada';
    if (p.status === 'saiu') return p.tipo === 'entrega' ? 'Entregue' : 'Retirado';
    return '';
  }
  var PROX = { novo: 'preparo', preparo: 'saiu', saiu: 'concluido' };
  var ICO_ZAP = '<svg class="zap-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  var ICO_TEL = '<svg class="ico" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
  var ICO_PIN = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  var ICO_PRINT = '<svg class="ico" viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>';

  function cartaoPedido(p, chegou) {
    var min = (Date.now() - p.criadoEm) / 60000, atraso = (p.status === 'novo' && min > 5) || min > 40;
    var h = '<article class="ped' + (chegou ? ' chegou' : '') + '" data-abrir="' + p.id + '" tabindex="0" role="button" aria-label="Abrir pedido ' + p.numero + '">' +
      '<div class="ped-cab"><span class="ped-num">#' + p.numero + '</span><span class="etq ' + p.tipo + '">' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</span>' +
      '<span class="ped-tempo' + (atraso ? ' atraso' : '') + '" data-t="' + p.criadoEm + '">' + U.tempoDesde(p.criadoEm) + '</span></div>' +
      '<div class="ped-cli">' + esc(p.cliente.nome) + '</div>' +
      '<div class="ped-res"><b>' + qtdItens(p) + ' ' + (qtdItens(p) === 1 ? 'item' : 'itens') + '</b> · ' + esc(resumoItens(p, 2)) + '</div>' +
      (p.obs ? '<div class="ped-flag">⚠ Tem observação</div>' : '') +
      '<div class="ped-rod"><span class="ped-val">' + brl(p.total) + '</span><span class="ped-meta">' + esc(U.pagamento(p.pagamento).split(' · ')[0]) + (p.tipo === 'entrega' && p.endereco ? ' · ' + esc(p.endereco.bairro) : '') + '</span></div>' +
      '<div class="ped-acoes">' + (p.status === 'novo' ? '<button class="btn btn-p" type="button" data-cancelar="' + p.id + '">Recusar</button>' : '<button class="btn btn-p" type="button" data-ver="' + p.id + '">Detalhes</button>') +
      '<button class="btn btn-p btn-amb" type="button" data-avancar="' + p.id + '">' + rotuloAvancar(p) + ' →</button></div>';
    return h + '</article>';
  }
  function pintarPedidos(chegaram) {
    chegaram = chegaram || [];
    var ativos = pedidos.filter(function (p) { return ATIVOS.indexOf(p.status) >= 0; });
    var cont = {};
    $('#quadro').innerHTML = COLS.map(function (c) {
      var ps = ativos.filter(function (p) { return c.st.indexOf(p.status) >= 0; }).sort(function (a, b) { return a.criadoEm - b.criadoEm; });
      cont[c.id] = ps.length;
      return '<section class="coluna col-' + c.id + '" id="col-' + c.id + '"><div class="col-cab"><i></i><h2>' + c.nome + '</h2><span class="n">' + ps.length + '</span></div>' +
        (ps.length ? ps.map(function (p) { return cartaoPedido(p, chegaram.indexOf(p.id) >= 0); }).join('') : '<div class="col-vazia">' + (c.id === 'novo' ? 'Nenhum pedido esperando. Os novos aparecem aqui na hora.' : 'Nada por aqui.') + '</div>') + '</section>';
    }).join('');
    var h0 = hoje0(), fimHoje = pedidos.filter(function (p) { return p.status === 'concluido' && p.criadoEm >= h0; }).length;
    $('#atalhos').innerHTML = COLS.map(function (c) { return '<button type="button" class="atalho c-' + c.id + '" data-col="' + c.id + '">' + (c.curto || c.nome) + ' <b>' + cont[c.id] + '</b></button>'; }).join('') +
      '<button type="button" class="atalho c-fim" data-ir="concluidos">Concluídos hoje <b>' + fimHoje + '</b></button>';
    var n = cont.novo; $('#contNovos').hidden = !n; $('#contNovos').textContent = n;
    d.title = (n ? '(' + n + ') ' : '') + 'Painel · AEGO Burguer';
  }
  function atualizarTempos() { $$('#quadro .ped-tempo').forEach(function (el) { el.textContent = U.tempoDesde(+el.getAttribute('data-t')); }); }
  function acharPedido(id) { return pedidos.filter(function (x) { return x.id === String(id); })[0]; }
  function trocarPedido(p) { pedidos = pedidos.map(function (x) { return x.id === p.id ? p : x; }); }
  function repintar() { pintarPedidos(); if (abaAtual === 'concluidos') pintarConcluidos(); }
  function avancar(id, btn) {
    var p = acharPedido(id); if (!p || !PROX[p.status]) return;
    if (btn) btn.disabled = true;
    DB.mudarStatus(id, PROX[p.status]).then(function (np) {
      trocarPedido(np); repintar();
      if (fichaAberta === np.id) abrirPedido(np.id, true);
      toast('#' + np.numero + ' → ' + U.rotuloStatus(np.status, np.tipo) + (np.status === 'concluido' ? ' · foi para Concluídos' : ''));
    });
  }
  function cancelar(id) {
    var p = acharPedido(id); if (!p) return;
    confirmar((p.status === 'novo' ? 'Recusar' : 'Cancelar') + ' pedido #' + p.numero + '?', 'O cliente vê o cancelamento na tela de acompanhamento. Avise pelo WhatsApp se precisar.', p.status === 'novo' ? 'Recusar pedido' : 'Cancelar pedido', function () {
      DB.mudarStatus(id, 'cancelado').then(function (np) { trocarPedido(np); repintar(); toast('#' + np.numero + ' cancelado'); });
    });
  }
  function cliqueLista(e) {
    var av = e.target.closest('[data-avancar]'), ca = e.target.closest('[data-cancelar]'), ab = e.target.closest('[data-abrir],[data-ver]');
    if (av) { e.stopPropagation(); avancar(av.getAttribute('data-avancar'), av); }
    else if (ca) { e.stopPropagation(); cancelar(ca.getAttribute('data-cancelar')); }
    else if (ab) abrirPedido(ab.getAttribute('data-abrir') || ab.getAttribute('data-ver'));
  }
  $('#quadro').addEventListener('click', cliqueLista);
  $('#quadro').addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-abrir]')) { e.preventDefault(); abrirPedido(e.target.getAttribute('data-abrir')); } });
  $('#atalhos').addEventListener('click', function (e) {
    var ir = e.target.closest('[data-ir]'); if (ir) { aba(ir.getAttribute('data-ir')); return; }
    var b = e.target.closest('[data-col]'); if (!b) return;
    var col = $('#col-' + b.getAttribute('data-col')), q = $('#quadro');
    if (q.scrollWidth > q.clientWidth) q.scrollTo({ left: col.offsetLeft - q.offsetLeft - 14, behavior: 'smooth' }); else col.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- ficha do pedido ---------- */
  var fichaAberta = null;
  function linhaTempo(p) {
    var passos = [['novo', 'Recebido'], ['preparo', 'Em preparo'], ['saiu', p.tipo === 'entrega' ? 'Saiu p/ entrega' : 'Pronto p/ retirada'], ['concluido', p.tipo === 'entrega' ? 'Entregue' : 'Retirado']];
    var em = {}; (p.historico || []).forEach(function (h) { em[h.status] = h.em; });
    if (p.status === 'cancelado') return '<div class="tl-cancel">Pedido cancelado' + (em.cancelado ? ' às ' + U.hora(em.cancelado) : '') + '</div>';
    var idx = ['novo', 'preparo', 'saiu', 'concluido'].indexOf(p.status);
    return '<ol class="tl">' + passos.map(function (s, k) { return '<li class="' + (k < idx ? 'feito' : k === idx ? 'atual' : '') + '"><i></i><span>' + s[1] + '</span><small>' + (em[s[0]] ? U.hora(em[s[0]]) : '—') + '</small></li>'; }).join('') + '</ol>';
  }
  function blocoPagamento(p) {
    var pg = p.pagamento || {}, h = '<div class="fx-li"><span>Forma</span><b>' + esc({ pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' }[pg.forma] || pg.forma) + '</b></div>';
    if (pg.forma === 'dinheiro') h += pg.trocoPara ? '<div class="fx-li"><span>Troco para</span><b>' + brl(pg.trocoPara) + '</b></div><div class="fx-li destaque"><span>Levar de troco</span><b>' + brl(pg.trocoPara - p.total) + '</b></div>' : '<div class="fx-li"><span>Troco</span><b>Não precisa</b></div>';
    return h;
  }
  function abrirPedido(id, manter) {
    var p = acharPedido(id); if (!p) return;
    fichaAberta = p.id;
    var ativo = ATIVOS.indexOf(p.status) >= 0, rotSt = U.rotuloStatus(p.status, p.tipo);
    var c = '<div class="fx-topo"><span class="etq ' + p.tipo + '">' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</span><span class="fx-st st-' + p.status + '">' + esc(rotSt) + '</span><span class="fx-hora">' + dataCurta(p.criadoEm) + '</span></div>' +
      linhaTempo(p) +
      '<section class="fx-sec"><h3>Cliente</h3><div class="fx-cli"><span class="av">' + esc(iniciais(p.cliente.nome)) + '</span><div><b>' + esc(p.cliente.nome) + '</b><small>' + esc(p.cliente.telefone) + '</small></div>' +
      '<button class="btn btn-p" type="button" data-cliente="' + esc(chaveCliente(p)) + '">Ver cliente</button></div>' +
      '<div class="fx-bts"><a class="btn btn-zap" href="' + linkZap(p.cliente.telefone, msgCliente(p)) + '" target="_blank" rel="noopener">' + ICO_ZAP + 'WhatsApp</a><a class="btn" href="' + linkTel(p.cliente.telefone) + '">' + ICO_TEL + 'Ligar</a></div></section>' +
      '<section class="fx-sec"><h3>' + (p.tipo === 'entrega' ? 'Endereço de entrega' : 'Retirada') + '</h3>' +
      (p.tipo === 'entrega' && p.endereco ? '<p class="fx-end"><b>' + esc(endLinha(p.endereco)) + '</b><br>' + esc(p.endereco.bairro) + (loja.cidade ? ' · ' + esc(loja.cidade) : '') + (p.taxa ? '<br><small>Taxa de entrega ' + brl(p.taxa) + '</small>' : '') + '</p><a class="btn btn-p" href="' + linkMapa(p.endereco) + '" target="_blank" rel="noopener">' + ICO_PIN + 'Abrir no mapa</a>'
        : '<p class="fx-end">O cliente busca no balcão' + (loja.tempoRetirada ? ' · ' + esc(loja.tempoRetirada) : '') + '.</p>') + '</section>' +
      '<section class="fx-sec"><h3>O que preparar <small>' + qtdItens(p) + ' ' + (qtdItens(p) === 1 ? 'item' : 'itens') + '</small></h3><ul class="fx-itens">' +
      p.itens.map(function (x) {
        var sub = [];
        if (x.ponto) sub.push('<span class="tag">' + esc(x.ponto) + '</span>');
        (x.extras || []).forEach(function (e) { sub.push('<span class="tag mais">+ ' + esc(e.nome) + '</span>'); });
        (x.retirar || []).forEach(function (r) { sub.push('<span class="tag menos">sem ' + esc(String(r).toLowerCase()) + '</span>'); });
        return '<li><span class="q">' + x.qtd + '×</span><div><b>' + esc(x.nome) + '</b>' + (sub.length ? '<div class="tags">' + sub.join('') + '</div>' : '') + (x.obs ? '<em>“' + esc(x.obs) + '”</em>' : '') + '</div><span class="v">' + brl(x.total) + '</span></li>';
      }).join('') + '</ul>' + (p.obs ? '<div class="fx-obs"><b>Observação do pedido</b>' + esc(p.obs) + '</div>' : '') + '</section>' +
      '<section class="fx-sec"><h3>Pagamento</h3>' + blocoPagamento(p) +
      '<div class="fx-li"><span>Subtotal</span><b>' + brl(p.subtotal != null ? p.subtotal : p.total - (p.taxa || 0)) + '</b></div>' + (p.tipo === 'entrega' ? '<div class="fx-li"><span>Entrega</span><b>' + (p.taxa ? brl(p.taxa) : 'Grátis') + '</b></div>' : '') +
      '<div class="fx-li fx-tot"><span>Total</span><b>' + brl(p.total) + '</b></div></section>';
    var pe = '<button class="btn" type="button" id="fxImp" aria-label="Imprimir comanda">' + ICO_PRINT + '<span class="so-largo">Comanda</span></button>' +
      (ativo ? '<button class="btn" type="button" id="fxCanc">' + (p.status === 'novo' ? 'Recusar' : 'Cancelar') + '</button><button class="btn btn-amb" type="button" id="fxAv">' + rotuloAvancar(p) + ' →</button>'
        : '<a class="btn btn-amb" href="' + linkZap(p.cliente.telefone, msgCliente(p)) + '" target="_blank" rel="noopener">' + ICO_ZAP + 'Falar com o cliente</a>');
    abrir('Pedido #' + p.numero, c, pe, manter);
    $('#fxImp').onclick = function () { imprimir(p); };
    if (ativo) { $('#fxAv').onclick = function () { avancar(p.id, this); }; $('#fxCanc').onclick = function () { cancelar(p.id); }; }
  }
  function imprimir(p) {
    var c = $('#comanda');
    c.innerHTML = '<h1>' + esc(loja.nome || 'AEGO Burguer') + '</h1><p>Pedido <b>#' + p.numero + '</b> · ' + dataCurta(p.criadoEm) + '</p><p><b>' + (p.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA') + '</b></p><hr>' +
      '<p>' + esc(p.cliente.nome) + '<br>' + esc(p.cliente.telefone) + (p.endereco ? '<br>' + esc(endLinha(p.endereco)) + '<br>' + esc(p.endereco.bairro) : '') + '</p><hr>' +
      p.itens.map(function (x) { var dt = U.detalheItem(x); return '<p><b>' + x.qtd + 'x ' + esc(x.nome) + '</b>' + (dt ? '<br>  ' + esc(dt) : '') + '<span style="float:right">' + brl(x.total) + '</span></p>'; }).join('') +
      (p.obs ? '<hr><p><b>OBS:</b> ' + esc(p.obs) + '</p>' : '') + '<hr><p>Subtotal <span style="float:right">' + brl(p.subtotal || p.total - (p.taxa || 0)) + '</span><br>Entrega <span style="float:right">' + brl(p.taxa || 0) + '</span><br><b>TOTAL <span style="float:right">' + brl(p.total) + '</span></b></p>' +
      '<p>' + esc(U.pagamento(p.pagamento)) + '</p>';
    try { w.print(); } catch (e) {}
  }

  /* ---------- concluídos + clientes ---------- */
  var cncVista = 'pedidos', cncPer = 'hoje', cncBusca = '';
  function iniciais(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '')[0] + ((p[1] || '')[0] || '')).toUpperCase(); }
  function chaveCliente(p) { return digitos(p.cliente.telefone) || String(p.cliente.nome).toLowerCase(); }
  function clientes() {
    var m = {};
    pedidos.forEach(function (p) {
      var k = chaveCliente(p), c = m[k] || (m[k] = { chave: k, nome: p.cliente.nome, telefone: p.cliente.telefone, pedidos: [], gasto: 0, ultimo: 0, primeiro: Infinity, ends: {}, itens: {} });
      c.pedidos.push(p);
      if (p.criadoEm > c.ultimo) { c.ultimo = p.criadoEm; c.nome = p.cliente.nome; }
      c.primeiro = Math.min(c.primeiro, p.criadoEm);
      if (p.status !== 'cancelado') { c.gasto += p.total; p.itens.forEach(function (x) { c.itens[x.nome] = (c.itens[x.nome] || 0) + x.qtd; }); }
      if (p.endereco) { var e = endLinha(p.endereco) + ' · ' + p.endereco.bairro; c.ends[e] = p.endereco; }
    });
    return Object.keys(m).map(function (k) { var c = m[k]; c.validos = c.pedidos.filter(function (p) { return p.status !== 'cancelado'; }).length; return c; });
  }
  function bate(txt) { if (!cncBusca) return true; var b = cncBusca.toLowerCase(), bd = digitos(cncBusca); return txt.toLowerCase().indexOf(b) >= 0 || (bd && digitos(txt).indexOf(bd) >= 0); }
  function pintarConcluidos() {
    $$('#cncVista button').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-v') === cncVista); });
    $$('#cncPer button').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-p') === cncPer); });
    $('#cncPer').hidden = cncVista !== 'pedidos';
    $('#cncBusca').placeholder = cncVista === 'pedidos' ? 'Buscar por nome, telefone ou nº do pedido' : 'Buscar cliente por nome ou telefone';
    var alvo = $('#cncLista');
    if (cncVista === 'pedidos') {
      var desde = cncPer === 'hoje' ? hoje0() : hoje0() - 6 * 864e5;
      var ps = pedidos.filter(function (p) { return (p.status === 'concluido' || p.status === 'cancelado') && p.criadoEm >= desde && bate(p.cliente.nome + ' ' + p.cliente.telefone + ' #' + p.numero + ' ' + p.numero); })
        .sort(function (a, b) { return b.criadoEm - a.criadoEm; });
      var ok = ps.filter(function (p) { return p.status === 'concluido'; }), fat = ok.reduce(function (s, p) { return s + p.total; }, 0);
      $('#cncResumo').innerHTML = '<div><b>' + ok.length + '</b><small>concluído' + (ok.length === 1 ? '' : 's') + '</small></div><div><b>' + brl(fat) + '</b><small>faturado</small></div><div><b>' + (ps.length - ok.length) + '</b><small>cancelado' + (ps.length - ok.length === 1 ? '' : 's') + '</small></div>';
      alvo.innerHTML = ps.map(function (p) {
        return '<button type="button" class="lin-ped" data-abrir="' + p.id + '"><span class="num">#' + p.numero + '</span><span class="t"><b>' + esc(p.cliente.nome) + '</b><small>' + dataCurta(p.criadoEm) + ' · ' + qtdItens(p) + ' ' + (qtdItens(p) === 1 ? 'item' : 'itens') + ' · ' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</small></span>' +
          '<span class="d"><b>' + brl(p.total) + '</b><span class="fx-st st-' + p.status + '">' + esc(U.rotuloStatus(p.status, p.tipo)) + '</span></span></button>';
      }).join('') || '<p class="col-vazia">' + (cncBusca ? 'Nada encontrado.' : 'Nenhum pedido concluído ' + (cncPer === 'hoje' ? 'hoje' : 'nos últimos 7 dias') + ' ainda.') + '</p>';
    } else {
      var cs = clientes().filter(function (c) { return bate(c.nome + ' ' + c.telefone); }).sort(function (a, b) { return b.ultimo - a.ultimo; });
      var rec = cs.filter(function (c) { return c.validos > 1; }).length;
      $('#cncResumo').innerHTML = '<div><b>' + cs.length + '</b><small>clientes</small></div><div><b>' + rec + '</b><small>voltaram a pedir</small></div><div><b>' + brl(cs.length ? Math.round(cs.reduce(function (s, c) { return s + c.gasto; }, 0) / cs.length) : 0) + '</b><small>gasto médio</small></div>';
      alvo.innerHTML = cs.map(function (c) {
        return '<button type="button" class="lin-cli" data-cliente="' + esc(c.chave) + '"><span class="av">' + esc(iniciais(c.nome)) + '</span><span class="t"><b>' + esc(c.nome) + (c.validos >= 5 ? ' <span class="selo">Fiel</span>' : '') + '</b><small>' + esc(c.telefone) + ' · último ' + dataCurta(c.ultimo) + '</small></span>' +
          '<span class="d"><b>' + brl(c.gasto) + '</b><small>' + c.pedidos.length + ' pedido' + (c.pedidos.length === 1 ? '' : 's') + '</small></span></button>';
      }).join('') || '<p class="col-vazia">' + (cncBusca ? 'Nenhum cliente encontrado.' : 'Os clientes aparecem aqui a partir do primeiro pedido.') + '</p>';
    }
  }
  function abrirCliente(chave) {
    var c = clientes().filter(function (x) { return x.chave === chave; })[0]; if (!c) return;
    fichaAberta = null;
    var ps = c.pedidos.slice().sort(function (a, b) { return b.criadoEm - a.criadoEm; });
    var fav = Object.keys(c.itens).sort(function (a, b) { return c.itens[b] - c.itens[a]; })[0];
    var ends = Object.keys(c.ends);
    var corpo = '<div class="cli-cab"><span class="av av-g">' + esc(iniciais(c.nome)) + '</span><div><b>' + esc(c.nome) + '</b><small>' + esc(c.telefone) + '</small>' + (c.validos >= 5 ? '<span class="selo">Cliente fiel</span>' : c.validos <= 1 ? '<span class="selo novo">Cliente novo</span>' : '') + '</div></div>' +
      '<div class="fx-bts"><a class="btn btn-zap" href="' + linkZap(c.telefone, 'Olá, ' + primeiroNome(c.nome) + '! Aqui é da ' + (loja.nome || 'AEGO Burguer') + '. ') + '" target="_blank" rel="noopener">' + ICO_ZAP + 'WhatsApp</a><a class="btn" href="' + linkTel(c.telefone) + '">' + ICO_TEL + 'Ligar</a></div>' +
      '<div class="cli-kpis"><div><b>' + c.validos + '</b><small>pedidos</small></div><div><b>' + brl(c.gasto) + '</b><small>total gasto</small></div><div><b>' + brl(c.validos ? Math.round(c.gasto / c.validos) : 0) + '</b><small>ticket médio</small></div></div>' +
      '<section class="fx-sec"><h3>Informações</h3>' +
      '<div class="fx-li"><span>Nome</span><b>' + esc(c.nome) + '</b></div>' +
      '<div class="fx-li"><span>Telefone / WhatsApp</span><b>' + esc(c.telefone) + '</b></div>' +
      '<div class="fx-li"><span>Cliente desde</span><b>' + dataCurta(c.primeiro) + '</b></div>' +
      '<div class="fx-li"><span>Último pedido</span><b>#' + ps[0].numero + ' · ' + dataCurta(c.ultimo) + '</b></div>' +
      (fav ? '<div class="fx-li"><span>Mais pede</span><b>' + esc(fav) + ' (' + c.itens[fav] + '×)</b></div>' : '') + '</section>' +
      '<section class="fx-sec"><h3>Endereço' + (ends.length > 1 ? 's' : '') + '</h3>' +
      (ends.length ? ends.map(function (e) { var en = c.ends[e]; return '<div class="cli-end">' + ICO_PIN + '<span>' + esc(endLinha(en)) + '<small>' + esc(en.bairro) + (loja.cidade ? ' · ' + esc(loja.cidade) : '') + '</small></span><a class="btn btn-p" href="' + linkMapa(en) + '" target="_blank" rel="noopener">Mapa</a></div>'; }).join('') : '<p class="fx-end">Só fez pedidos para retirada.</p>') + '</section>' +
      '<section class="fx-sec"><h3>Pedidos <small>' + ps.length + '</small></h3><div class="cli-peds">' +
      ps.map(function (p) { return '<button type="button" class="lin-ped" data-abrir="' + p.id + '"><span class="num">#' + p.numero + '</span><span class="t"><b>' + esc(resumoItens(p, 2)) + '</b><small>' + dataCurta(p.criadoEm) + ' · ' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</small></span><span class="d"><b>' + brl(p.total) + '</b><span class="fx-st st-' + p.status + '">' + esc(U.rotuloStatus(p.status, p.tipo)) + '</span></span></button>'; }).join('') + '</div></section>';
    abrir(esc(c.nome), corpo, null);
  }
  folha.addEventListener('click', function (e) {
    var cl = e.target.closest('[data-cliente]'), pd = e.target.closest('.lin-ped[data-abrir]');
    if (cl) abrirCliente(cl.getAttribute('data-cliente'));
    else if (pd) abrirPedido(pd.getAttribute('data-abrir'), true);
  });
  $('#cncLista').addEventListener('click', function (e) {
    var cl = e.target.closest('[data-cliente]'), pd = e.target.closest('[data-abrir]');
    if (cl) abrirCliente(cl.getAttribute('data-cliente')); else if (pd) abrirPedido(pd.getAttribute('data-abrir'));
  });
  $('#cncVista').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) { cncVista = b.getAttribute('data-v'); pintarConcluidos(); } });
  $('#cncPer').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) { cncPer = b.getAttribute('data-p'); pintarConcluidos(); } });
  $('#cncBusca').addEventListener('input', function (e) { cncBusca = e.target.value.trim(); pintarConcluidos(); });

  var tAlerta;
  var ultimoNovo = null;
  function avisarNovo(p) {
    ultimoNovo = p.id; tocar();
    $('#alertaT').textContent = 'Novo pedido #' + p.numero;
    $('#alertaS').textContent = p.cliente.nome + ' · ' + brl(p.total) + ' · ' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada');
    var a = $('#alerta'); a.classList.remove('on'); void a.offsetWidth; a.classList.add('on');
    clearTimeout(tAlerta); tAlerta = setTimeout(function () { a.classList.remove('on'); }, 7000);
  }
  $('#alertaVer').onclick = function () { $('#alerta').classList.remove('on'); aba('pedidos'); var c = $('#col-novo'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); if (ultimoNovo && acharPedido(ultimoNovo)) abrirPedido(ultimoNovo); };

  /* ---------- cardápio ---------- */
  function nomeCat(id) { var c = cardapio.categorias.filter(function (x) { return x.id === id; })[0]; return c ? c.nome : '—'; }
  function pintarCardapio() {
    $('#chipsCat').innerHTML = '<button type="button" class="chip' + (!catFiltro ? ' ativo' : '') + '" data-cat="">Todos (' + cardapio.itens.length + ')</button>' +
      cardapio.categorias.map(function (c) { return '<button type="button" class="chip' + (catFiltro === c.id ? ' ativo' : '') + '" data-cat="' + esc(c.id) + '">' + esc(c.nome) + '</button>'; }).join('');
    var its = cardapio.itens.filter(function (i) { return !catFiltro || i.cat === catFiltro; });
    $('#listaItens').innerHTML = its.map(function (i) {
      return '<div class="linha-it' + (i.disponivel ? '' : ' off') + '"><img src="' + esc(i.foto) + '" alt="" width="56" height="56" loading="lazy" decoding="async">' +
        '<div class="t" data-ed="' + esc(i.id) + '"><b>' + esc(i.nome) + '</b><small>' + esc(nomeCat(i.cat)) + ' · <span class="pr">' + brl(i.preco) + '</span>' + (i.precoAntigo > i.preco ? ' <s>' + brl(i.precoAntigo) + '</s>' : '') + (i.destaque ? ' · ★ destaque' : '') + (i.disponivel ? '' : ' · <b style="display:inline;color:var(--erro)">Esgotado</b>') + '</small></div>' +
        '<label class="chave" title="Disponível"><input type="checkbox" data-disp="' + esc(i.id) + '"' + (i.disponivel ? ' checked' : '') + ' aria-label="Disponível: ' + esc(i.nome) + '"><span></span></label></div>';
    }).join('') || '<p class="col-vazia">Nenhum item nesta categoria.</p>';
  }
  $('#chipsCat').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) { catFiltro = b.getAttribute('data-cat'); pintarCardapio(); } });
  $('#listaItens').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-disp'); if (!id) return;
    var i = cardapio.itens.filter(function (x) { return x.id === id; })[0]; i.disponivel = e.target.checked;
    DB.salvarItem(i).then(function () { pintarCardapio(); toast(i.nome + (i.disponivel ? ' disponível' : ' marcado como esgotado')); });
  });
  $('#listaItens').addEventListener('click', function (e) { var t = e.target.closest('[data-ed]'); if (t) editarItem(t.getAttribute('data-ed')); });
  $('#novoItem').onclick = function () { editarItem(null); };
  function editarItem(id) {
    var i = id ? JSON.parse(JSON.stringify(cardapio.itens.filter(function (x) { return x.id === id; })[0])) :
      { id: '', cat: catFiltro || (cardapio.categorias[0] || {}).id, nome: '', desc: '', preco: 0, precoAntigo: 0, foto: 'img/aego.webp', disponivel: true, destaque: false, extras: 'burger', retirar: [] };
    var corpo = '<form id="fItem">' +
      '<label class="campo"><span>Nome</span><input name="nome" required value="' + esc(i.nome) + '"></label>' +
      '<label class="campo"><span>Descrição</span><textarea name="desc" rows="3">' + esc(i.desc) + '</textarea></label>' +
      '<div class="grade2"><label class="campo"><span>Preço (R$)</span><input name="preco" type="number" step="0.10" min="0" value="' + (i.preco || '') + '"></label><label class="campo"><span>Preço “de” (promoção)</span><input name="precoAntigo" type="number" step="0.10" min="0" value="' + (i.precoAntigo || '') + '" placeholder="opcional"></label></div>' +
      '<div class="grade2"><label class="campo"><span>Categoria</span><select name="cat">' + cardapio.categorias.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === i.cat ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>Adicionais</span><select name="extras"><option value="burger"' + (i.extras === 'burger' ? ' selected' : '') + '>De burger (+ ponto)</option><option value="porcao"' + (i.extras === 'porcao' ? ' selected' : '') + '>De porção</option><option value=""' + (!i.extras ? ' selected' : '') + '>Nenhum</option></select></label></div>' +
      '<label class="campo"><span>Ingredientes que podem ser retirados (separe por vírgula)</span><input name="retirar" value="' + esc((i.retirar || []).join(', ')) + '"></label>' +
      '<div class="chave-l"><span><b>Disponível</b><small>Desligue quando acabar</small></span><label class="chave"><input type="checkbox" name="disponivel"' + (i.disponivel ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="chave-l"><span><b>Destaque</b><small>Aparece no topo do cardápio</small></span><label class="chave"><input type="checkbox" name="destaque"' + (i.destaque ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="campo"><span>Foto</span><div class="fotos-esc">' + FOTOS.map(function (f) { var src = 'img/' + f + '.webp'; return '<label><input type="radio" name="foto" value="' + src + '"' + (src === i.foto ? ' checked' : '') + '><img src="' + src + '" alt="' + f + '" loading="lazy" width="90" height="90"></label>'; }).join('') + '</div></div>' +
      '<p class="erro-t" id="itemErro"></p></form>';
    abrir(id ? 'Editar item' : 'Novo item', corpo, (id ? '<button class="btn btn-perigo" type="button" id="exItem">Excluir</button>' : '') + '<button class="btn btn-amb" type="button" id="svItem">Salvar</button>');
    $('#svItem').onclick = function () {
      var f = $('#fItem');
      var preco = parseFloat(f.preco.value);
      if (!f.nome.value.trim()) { $('#itemErro').textContent = 'Dê um nome ao item.'; return; }
      if (!(preco > 0)) { $('#itemErro').textContent = 'Informe o preço.'; return; }
      i.nome = f.nome.value.trim(); i.desc = f.desc.value.trim(); i.preco = +preco.toFixed(2); i.precoAntigo = +(parseFloat(f.precoAntigo.value) || 0).toFixed(2);
      i.cat = f.cat.value; i.extras = f.extras.value; i.retirar = f.retirar.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      i.disponivel = f.disponivel.checked; i.destaque = f.destaque.checked; i.foto = (f.querySelector('[name=foto]:checked') || {}).value || i.foto;
      DB.salvarItem(i).then(function () { return DB.cardapio(); }).then(function (c) { cardapio = c; pintarCardapio(); fechar(); toast('Item salvo — já aparece no cardápio on-line'); });
    };
    if (id) $('#exItem').onclick = function () { confirmar('Excluir ' + esc(i.nome) + '?', 'O item sai do cardápio on-line. Pedidos antigos não mudam.', 'Excluir', function () { DB.removerItem(id).then(function () { return DB.cardapio(); }).then(function (c) { cardapio = c; pintarCardapio(); toast('Item excluído'); }); }); };
  }
  $('#edCats').onclick = function () {
    var cats = JSON.parse(JSON.stringify(cardapio.categorias));
    function linhas() {
      $('#catsL').innerHTML = cats.map(function (c, k) {
        var n = cardapio.itens.filter(function (i) { return i.cat === c.id; }).length;
        return '<div class="cat-ed"><input value="' + esc(c.nome) + '" data-k="' + k + '" aria-label="Nome da categoria"><button type="button" data-up="' + k + '" aria-label="Subir"' + (k ? '' : ' disabled') + '>↑</button><button type="button" data-rm="' + k + '" aria-label="Remover"' + (n ? ' disabled title="Tem ' + n + ' itens"' : '') + '>✕</button></div>';
      }).join('');
    }
    abrir('Categorias', '<div id="catsL"></div><button class="btn btn-p" type="button" id="addCat" style="margin-top:6px">+ Categoria</button><p style="color:var(--mut);font-size:13px">A ordem aqui é a ordem do cardápio on-line. Só dá para remover categorias vazias.</p>', '<button class="btn btn-amb" type="button" id="svCats">Salvar</button>');
    linhas();
    $('#catsL').addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (k != null) cats[k].nome = e.target.value; });
    $('#catsL').addEventListener('click', function (e) {
      var up = e.target.getAttribute('data-up'), rm = e.target.getAttribute('data-rm');
      if (up) { up = +up; var t = cats[up - 1]; cats[up - 1] = cats[up]; cats[up] = t; linhas(); }
      if (rm) { cats.splice(+rm, 1); linhas(); }
    });
    $('#addCat').onclick = function () { cats.push({ id: 'c' + Date.now().toString(36), nome: 'Nova categoria' }); linhas(); };
    $('#svCats').onclick = function () { DB.salvarCategorias(cats.filter(function (c) { return c.nome.trim(); })).then(function () { return DB.cardapio(); }).then(function (c) { cardapio = c; pintarCardapio(); fechar(); toast('Categorias salvas'); }); };
  };

  /* ---------- financeiro ---------- */
  function pintarFinanceiro() {
    var h0 = hoje0(), desde = periodo === 'hoje' ? h0 : h0 - 6 * 864e5;
    var doPer = pedidos.filter(function (p) { return p.criadoEm >= desde; });
    var validos = doPer.filter(function (p) { return p.status !== 'cancelado'; });
    var fat = validos.reduce(function (s, p) { return s + p.total; }, 0), canc = doPer.length - validos.length;
    var ticket = validos.length ? Math.round(fat / validos.length) : 0;
    var entregas = validos.filter(function (p) { return p.tipo === 'entrega'; }).length;
    $('#kpis').innerHTML =
      '<div class="kpi dest"><small>Faturamento</small><b>' + brl(fat) + '</b><em>' + (periodo === 'hoje' ? 'hoje' : 'últimos 7 dias') + '</em></div>' +
      '<div class="kpi"><small>Pedidos</small><b>' + validos.length + '</b><em>' + canc + ' cancelado' + (canc === 1 ? '' : 's') + '</em></div>' +
      '<div class="kpi"><small>Ticket médio</small><b>' + brl(ticket) + '</b><em>por pedido</em></div>' +
      '<div class="kpi"><small>Entregas</small><b>' + (validos.length ? Math.round(entregas / validos.length * 100) : 0) + '%</b><em>' + (validos.length - entregas) + ' retiradas</em></div>';
    // pedidos por hora (11h → 01h)
    var horas = []; for (var hh = 11; hh <= 25; hh++) horas.push(hh % 24);
    var porH = {}; validos.forEach(function (p) { var x = new Date(p.criadoEm).getHours(); porH[x] = (porH[x] || 0) + 1; });
    var maxH = Math.max.apply(null, horas.map(function (x) { return porH[x] || 0; }).concat([1]));
    $('#tituloHoras').innerHTML = 'Pedidos por hora <small>' + (periodo === 'hoje' ? 'hoje' : 'soma de 7 dias') + '</small>';
    $('#grafHoras').innerHTML = horas.map(function (x, k) { var v = porH[x] || 0; return '<div class="b" title="' + x + 'h: ' + v + ' pedidos"><i class="' + (v ? '' : 'zero') + '" style="height:' + Math.max(2, v / maxH * 100) + '%;animation-delay:' + k * 25 + 'ms"></i><span>' + (k % 2 ? '' : x + 'h') + '</span></div>'; }).join('');
    // por dia
    var dias = []; for (var k = 6; k >= 0; k--) dias.push(h0 - k * 864e5);
    var porD = dias.map(function (t0) { return pedidos.filter(function (p) { return p.status !== 'cancelado' && p.criadoEm >= t0 && p.criadoEm < t0 + 864e5; }).reduce(function (s, p) { return s + p.total; }, 0); });
    var maxD = Math.max.apply(null, porD.concat([1])), sem = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    $('#grafDias').innerHTML = dias.map(function (t0, k) { return '<div class="b" title="' + brl(porD[k]) + '"><i style="height:' + Math.max(2, porD[k] / maxD * 100) + '%;animation-delay:' + k * 40 + 'ms"></i><span>' + (k === 6 ? 'hoje' : sem[new Date(t0).getDay()]) + '</span></div>'; }).join('');
    // mais vendidos
    var cont = {};
    validos.forEach(function (p) { p.itens.forEach(function (x) { var c = cont[x.itemId] || (cont[x.itemId] = { nome: x.nome, q: 0, v: 0, id: x.itemId }); c.q += x.qtd; c.v += x.total; }); });
    var top = Object.keys(cont).map(function (k) { return cont[k]; }).sort(function (a, b) { return b.q - a.q; }).slice(0, 5), maxQ = top.length ? top[0].q : 1;
    $('#topVendas').innerHTML = top.map(function (t) {
      var it = cardapio.itens.filter(function (i) { return i.id === t.id; })[0];
      return '<div class="top-li"><img src="' + esc(it ? it.foto : 'img/aego.webp') + '" alt="" width="36" height="36" loading="lazy"><div class="t"><b>' + esc(t.nome) + '</b><div class="bar"><i style="width:' + (t.q / maxQ * 100) + '%"></i></div></div><span class="q">' + t.q + '×</span></div>';
    }).join('') || '<p class="col-vazia">Sem vendas no período.</p>';
    var pg = { pix: 0, cartao: 0, dinheiro: 0 };
    validos.forEach(function (p) { pg[p.pagamento.forma] = (pg[p.pagamento.forma] || 0) + p.total; });
    $('#pagamentos').innerHTML = [['pix', 'Pix'], ['cartao', 'Cartão na entrega'], ['dinheiro', 'Dinheiro']].map(function (x) { return '<div class="pag-li"><span>' + x[1] + '</span><b>' + brl(pg[x[0]]) + ' <span style="color:var(--mut);font-weight:600">· ' + (fat ? Math.round(pg[x[0]] / fat * 100) : 0) + '%</span></b></div>'; }).join('');
  }
  $('#segPeriodo').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; periodo = b.getAttribute('data-p'); $$('#segPeriodo button').forEach(function (x) { x.classList.toggle('ativo', x === b); }); pintarFinanceiro(); });

  /* ---------- ajustes ---------- */
  function preencher(f, campos) { campos.forEach(function (k) { f[k].value = loja[k] == null ? '' : loja[k]; }); }
  function salvo(f) { var s = $('.salvo', f); s.classList.add('on'); setTimeout(function () { s.classList.remove('on'); }, 1800); }
  function linhasBairros(lista) {
    $('#listaBairros').innerHTML = lista.map(function (b, k) {
      return '<div class="bairro-ed"><input value="' + esc(b.nome) + '" data-b="nome" aria-label="Bairro"><input value="' + b.taxa + '" data-b="taxa" type="number" step="0.5" min="0" aria-label="Taxa"><input value="' + esc(b.tempo) + '" data-b="tempo" aria-label="Tempo"><button type="button" data-rmb="' + k + '" aria-label="Remover">×</button></div>';
    }).join('');
  }
  function lerBairros() { return $$('#listaBairros .bairro-ed').map(function (r) { return { nome: $('[data-b=nome]', r).value.trim(), taxa: +(parseFloat($('[data-b=taxa]', r).value) || 0), tempo: $('[data-b=tempo]', r).value.trim() }; }); }
  function pintarAjustes() {
    preencher($('#fLoja'), ['nome', 'slogan', 'bairro', 'cidade', 'endereco', 'telefone', 'whatsapp']);
    preencher($('#fHorario'), ['abre', 'fecha', 'modo', 'pedidoMinimo', 'tempoRetirada']);
    linhasBairros(loja.bairros);
    $('#chTema').checked = d.documentElement.getAttribute('data-tema') !== 'claro';
    pintarSom();
  }
  $('#fLoja').addEventListener('submit', function (e) { e.preventDefault(); var f = e.target, o = {}; ['nome', 'slogan', 'bairro', 'cidade', 'endereco', 'telefone', 'whatsapp'].forEach(function (k) { o[k] = f[k].value.trim(); }); o.whatsapp = o.whatsapp.replace(/\D/g, ''); DB.salvarLoja(o).then(function (l) { loja = l; salvo(f); }); });
  $('#fHorario').addEventListener('submit', function (e) { e.preventDefault(); var f = e.target; DB.salvarLoja({ abre: f.abre.value, fecha: f.fecha.value, modo: f.modo.value, pedidoMinimo: +f.pedidoMinimo.value || 0, tempoRetirada: f.tempoRetirada.value.trim() }).then(function (l) { loja = l; pintarLoja(); salvo(f); }); });
  $('#fBairros').addEventListener('submit', function (e) { e.preventDefault(); DB.salvarLoja({ bairros: lerBairros().filter(function (b) { return b.nome; }) }).then(function (l) { loja = l; linhasBairros(l.bairros); salvo(e.target); }); });
  $('#addBairro').onclick = function () { var l = lerBairros(); l.push({ nome: '', taxa: 0, tempo: '40–50 min' }); linhasBairros(l); $$('#listaBairros [data-b=nome]').pop().focus(); };
  $('#listaBairros').addEventListener('click', function (e) { var k = e.target.getAttribute('data-rmb'); if (k != null) { var l = lerBairros(); l.splice(+k, 1); linhasBairros(l); } });
  $('#chTema').onchange = function (e) { aplicarTema(e.target.checked ? 'escuro' : 'claro'); };
  $('#chSom').onchange = function (e) { somOn = e.target.checked; LS.setItem('ab_som', somOn ? '1' : '0'); pintarSom(); };
  $('#testarSom').onclick = function () { liberarAudio(); var s = somOn; somOn = true; avisarNovo({ numero: '0000', cliente: { nome: 'Teste' }, total: 0, tipo: 'retirada' }); somOn = s; };
  $('#restaurar').onclick = function () { confirmar('Restaurar demonstração?', 'Apaga pedidos, cardápio e ajustes deste navegador e volta aos dados de exemplo.', 'Restaurar', function () { DB.restaurarDemo().then(function () { location.reload(); }); }); };
  $('#sair').onclick = function () { DB.sair().then(function () { location.reload(); }); };

  /* ---------- início ---------- */
  U.abertura('ab_intro_painel');
  iniciar();
  U.pwa();
})();
