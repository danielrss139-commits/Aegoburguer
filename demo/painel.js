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
  var TITULOS = { pedidos: 'Pedidos', cardapio: 'Cardápio', financeiro: 'Financeiro', ajustes: 'Ajustes' };

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
  function abrir(titulo, corpo, pe) {
    folha.innerHTML = '<div class="folha-cab"><h2>' + titulo + '</h2><button class="btn-ic" type="button" data-fechar aria-label="Fechar"><svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="folha-corpo">' + corpo + '</div>' + (pe ? '<div class="folha-pe">' + pe + '</div>' : '');
    folha.hidden = false; veu.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { folha.classList.add('on'); veu.classList.add('on'); }); });
  }
  function fechar() { folha.classList.remove('on'); veu.classList.remove('on'); setTimeout(function () { if (!folha.classList.contains('on')) { folha.hidden = true; veu.hidden = true; } }, 340); }
  veu.onclick = fechar;
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
    Promise.all([DB.loja(), DB.cardapio(), DB.pedidos({ desde: hoje0() - 7 * 864e5 })]).then(function (r) {
      loja = r[0]; cardapio = r[1]; pedidos = r[2];
      conhecidos = {}; pedidos.forEach(function (p) { conhecidos[p.id] = 1; });
      pintarLoja(); pintarPedidos(); pintarSom();
      var a = (location.hash || '').replace('#', ''); if (TITULOS[a]) aba(a);
    });
    DB.ouvirPedidos(function () {
      DB.pedidos({ desde: hoje0() - 7 * 864e5 }).then(function (lista) {
        var novos = lista.filter(function (p) { return !conhecidos[p.id]; });
        pedidos = lista; lista.forEach(function (p) { conhecidos[p.id] = 1; });
        pintarPedidos(novos.map(function (p) { return p.id; }));
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
    if (a === 'pedidos') pintarPedidos(); if (a === 'cardapio') pintarCardapio(); if (a === 'financeiro') pintarFinanceiro(); if (a === 'ajustes') pintarAjustes();
    w.scrollTo(0, 0);
  }
  $$('#lado button').forEach(function (b) { b.onclick = function () { aba(b.getAttribute('data-aba')); }; });

  /* ---------- pedidos ---------- */
  var COLS = [
    { id: 'novo', nome: 'Novos', st: ['novo'] },
    { id: 'preparo', nome: 'Em preparo', st: ['preparo'] },
    { id: 'saiu', nome: 'A caminho / Pronto', st: ['saiu'] },
    { id: 'fim', nome: 'Concluídos', st: ['concluido', 'cancelado'] }
  ];
  var PROX = { novo: ['preparo', 'Aceitar e preparar'], preparo: ['saiu', null], saiu: ['concluido', null] };
  function cartaoPedido(p, chegou) {
    var fim = p.status === 'concluido' || p.status === 'cancelado';
    var min = (Date.now() - p.criadoEm) / 60000, atraso = !fim && ((p.status === 'novo' && min > 5) || min > 40);
    var h = '<article class="ped' + (chegou ? ' chegou' : '') + (fim ? ' mini' : '') + '" data-id="' + p.id + '">' +
      '<div class="ped-cab"><span class="ped-num">#' + p.numero + '</span><span class="etq ' + (p.status === 'cancelado' ? 'cancelado' : p.tipo) + '">' + (p.status === 'cancelado' ? 'Cancelado' : p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</span>' +
      '<span class="ped-tempo' + (atraso ? ' atraso' : '') + '" data-t="' + p.criadoEm + '">' + (fim ? U.hora(p.criadoEm) : U.tempoDesde(p.criadoEm)) + '</span></div>' +
      '<div class="ped-cli">' + esc(p.cliente.nome) + (fim ? '' : ' <a href="https://wa.me/55' + esc(String(p.cliente.telefone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(p.cliente.telefone) + '</a>') + '</div>';
    if (fim) return h + '<div class="ped-tot"><b>' + brl(p.total) + '</b><span>' + p.itens.reduce(function (s, x) { return s + x.qtd; }, 0) + ' itens · ' + esc(U.pagamento(p.pagamento).split(' · ')[0]) + '</span></div></article>';
    if (p.tipo === 'entrega' && p.endereco) h += '<div class="ped-end">' + esc(p.endereco.rua + ', ' + p.endereco.numero + (p.endereco.complemento ? ' — ' + p.endereco.complemento : '') + ' · ' + p.endereco.bairro) + '</div>';
    h += '<ul class="ped-itens">' + p.itens.map(function (x) { var dt = U.detalheItem(x); return '<li><b>' + x.qtd + '×</b>' + esc(x.nome) + (dt ? '<small>' + esc(dt) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
    if (p.obs) h += '<div class="ped-obs">Obs.: ' + esc(p.obs) + '</div>';
    h += '<div class="ped-tot"><b>' + brl(p.total) + '</b><span>' + esc(U.pagamento(p.pagamento)) + (p.taxa ? '<br>inclui entrega ' + brl(p.taxa) : '') + '</span></div>';
    var px = PROX[p.status], rot = px[1] || (px[0] === 'saiu' ? (p.tipo === 'entrega' ? 'Saiu para entrega' : 'Pronto p/ retirada') : (p.tipo === 'entrega' ? 'Entregue' : 'Retirado'));
    h += '<div class="ped-acoes">' + (p.status === 'novo' ? '<button class="btn btn-p btn-perigo" type="button" data-cancelar="' + p.id + '">Recusar</button>' : '<button class="btn btn-p" type="button" data-cancelar="' + p.id + '">Cancelar</button>') +
      '<button class="btn btn-p btn-amb" type="button" data-avancar="' + p.id + '" data-para="' + px[0] + '">' + rot + ' →</button></div>';
    return h + '</article>';
  }
  function pintarPedidos(chegaram) {
    chegaram = chegaram || [];
    var h0 = hoje0(), doDia = pedidos.filter(function (p) { return p.criadoEm >= h0 || ['novo', 'preparo', 'saiu'].indexOf(p.status) >= 0; });
    var cont = {};
    $('#quadro').innerHTML = COLS.map(function (c) {
      var ps = doDia.filter(function (p) { return c.st.indexOf(p.status) >= 0; });
      ps.sort(function (a, b) { return c.id === 'fim' ? b.criadoEm - a.criadoEm : a.criadoEm - b.criadoEm; });
      cont[c.id] = ps.length;
      return '<section class="coluna col-' + c.id + '" id="col-' + c.id + '"><div class="col-cab"><i></i><h2>' + c.nome + '</h2><span class="n">' + ps.length + '</span></div>' +
        (ps.length ? ps.map(function (p) { return cartaoPedido(p, chegaram.indexOf(p.id) >= 0); }).join('') : '<div class="col-vazia">' + (c.id === 'novo' ? 'Nenhum pedido esperando. Os novos aparecem aqui na hora.' : 'Nada por aqui.') + '</div>') + '</section>';
    }).join('');
    $('#atalhos').innerHTML = COLS.map(function (c) { return '<button type="button" class="atalho c-' + c.id + '" data-col="' + c.id + '">' + c.nome + ' <b>' + cont[c.id] + '</b></button>'; }).join('');
    var n = cont.novo; $('#contNovos').hidden = !n; $('#contNovos').textContent = n;
    d.title = (n ? '(' + n + ') ' : '') + 'Painel · AEGO Burguer';
  }
  function atualizarTempos() { $$('.ped-tempo').forEach(function (el) { if (!el.closest('.mini')) el.textContent = U.tempoDesde(+el.getAttribute('data-t')); }); }
  $('#quadro').addEventListener('click', function (e) {
    var av = e.target.closest('[data-avancar]'), ca = e.target.closest('[data-cancelar]');
    if (av) {
      av.disabled = true;
      DB.mudarStatus(av.getAttribute('data-avancar'), av.getAttribute('data-para')).then(function (p) {
        pedidos = pedidos.map(function (x) { return x.id === p.id ? p : x; }); pintarPedidos();
        toast('#' + p.numero + ' → ' + U.rotuloStatus(p.status, p.tipo));
      });
    } else if (ca) {
      var id = ca.getAttribute('data-cancelar');
      confirmar('Cancelar pedido #' + id + '?', 'O cliente vê o cancelamento na tela de acompanhamento. Avise pelo WhatsApp se precisar.', 'Cancelar pedido', function () {
        DB.mudarStatus(id, 'cancelado').then(function (p) { pedidos = pedidos.map(function (x) { return x.id === p.id ? p : x; }); pintarPedidos(); toast('#' + p.numero + ' cancelado'); });
      });
    }
  });
  $('#atalhos').addEventListener('click', function (e) {
    var b = e.target.closest('[data-col]'); if (!b) return;
    var col = $('#col-' + b.getAttribute('data-col')), q = $('#quadro');
    if (q.scrollWidth > q.clientWidth) q.scrollTo({ left: col.offsetLeft - q.offsetLeft - 14, behavior: 'smooth' }); else col.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  var tAlerta;
  function avisarNovo(p) {
    tocar();
    $('#alertaT').textContent = 'Novo pedido #' + p.numero;
    $('#alertaS').textContent = p.cliente.nome + ' · ' + brl(p.total) + ' · ' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada');
    var a = $('#alerta'); a.classList.remove('on'); void a.offsetWidth; a.classList.add('on');
    clearTimeout(tAlerta); tAlerta = setTimeout(function () { a.classList.remove('on'); }, 7000);
  }
  $('#alertaVer').onclick = function () { $('#alerta').classList.remove('on'); aba('pedidos'); var c = $('#col-novo'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); };

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
    var ticket = validos.length ? fat / validos.length : 0;
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
