/* AEGO Burguer — pedidos on-line (cardápio, item, sacola, checkout, acompanhamento) */
(function () {
  'use strict';
  var DB = window.AEGO_DB, U = window.AEGO_U, d = document, w = window;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var esc = U.esc, brl = U.brl;

  var LS = w.localStorage;
  function ler(k, p) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : p; } catch (e) { return p; } }
  function gravar(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var loja = null, cardapio = { categorias: [], itens: [] };
  var sacola = ler('ab_sacola', []);
  var cliente = ler('ab_cliente', { nome: '', telefone: '', rua: '', numero: '', complemento: '', bairro: '' });
  var meus = ler('ab_meus_pedidos', []);
  var pararAcomp = null;

  var IC = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    voltar: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    moto: '<svg viewBox="0 0 24 24"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h5l3-6h-4l-2-3H8M14 11l4 6M6 14l3-4"/></svg>',
    sacola: '<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13.5H7z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>',
    fogo: '<svg viewBox="0 0 24 24"><path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.4 2.6-5.3 3.8-8.4.9 1.6 1.4 2.8 2.7 3.6.3-2.5 1.4-4.6 3.5-6.6.2 3.3 4 6.2 4 11.3 0 3.9-3.1 6.7-7 6.7z"/><path d="M12 21c-1.7 0-3-1.3-3-3 0-2 1.6-2.8 2.2-4.6 1.6 1.2 3.8 2.4 3.8 4.6 0 1.7-1.3 3-3 3z"/></svg>',
    recebido: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    feito: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16.2 9.6"/></svg>',
    cancel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    zap: '<svg viewBox="0 0 24 24"><path d="M4.5 19.5l1.2-3.8A8 8 0 1 1 8.6 18.6z"/><path d="M9.2 8.6c.2 2.9 2.4 5.6 5.6 6.3l1-1.3-1.8-.9-.8.8c-1-.4-1.9-1.3-2.4-2.3l.8-.8-.8-1.8z"/></svg>',
    pix: '<svg viewBox="0 0 24 24"><path d="M12 3l9 9-9 9-9-9z"/><path d="M8 8l4 4 4-4M8 16l4-4 4 4"/></svg>',
    cartao: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/></svg>',
    dinheiro: '<svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="18" height="11" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    loja: '<svg viewBox="0 0 24 24"><path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M4 9.5c0 1.7 1.3 3 3 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.3 3s2.3-1.3 2.3-3c0 1.7 1.3 3 3 3s2.7-1.3 2.7-3M5.5 12.3V20h13v-7.7"/></svg>'
  };

  /* ---------------- utilidades ---------------- */
  var tToast;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tToast); tToast = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function itemPorId(id) { return cardapio.itens.filter(function (i) { return i.id === id; })[0]; }
  function bairroDe(nome) { return (loja.bairros || []).filter(function (b) { return b.nome === nome; })[0]; }
  function mascTel(v) {
    var n = String(v).replace(/\D/g, '').slice(0, 11);
    if (n.length <= 2) return n ? '(' + n : '';
    if (n.length <= 6) return '(' + n.slice(0, 2) + ') ' + n.slice(2);
    if (n.length <= 10) return '(' + n.slice(0, 2) + ') ' + n.slice(2, 6) + '-' + n.slice(6);
    return '(' + n.slice(0, 2) + ') ' + n.slice(2, 7) + '-' + n.slice(7);
  }
  function precoHtml(i) {
    var pm = U.precoMenu;
    if (i.precoAntigo && i.precoAntigo > i.preco) return '<span class="preco"><span class="promo">' + pm(i.preco) + '</span><s>' + pm(i.precoAntigo) + '</s><em class="off">-' + Math.round((1 - i.preco / i.precoAntigo) * 100) + '%</em></span>';
    return '<span class="preco">' + pm(i.preco) + '</span>';
  }

  /* ---------------- cabeçalho da loja ---------------- */
  function pintarLoja() {
    $('#logoRedondo').innerHTML = U.monograma();
    $('#barraLogo').innerHTML = U.monograma();
    $('#nomeLoja').innerHTML = esc(loja.nome) + ' - <span>' + esc(loja.slogan) + '</span>';
    $('#cidade').textContent = loja.cidade;
    var st = DB.statusLoja(loja), el = $('#statusLoja');
    el.textContent = st.texto; el.className = 'status-loja ' + (st.aberta ? 'aberta' : 'fechada');
    pintarTaxa();
    $('#perfilBairro').innerHTML = '<option value="">Selecione…</option>' + loja.bairros.map(function (b) { return '<option' + (b.nome === cliente.bairro ? ' selected' : '') + '>' + esc(b.nome) + '</option>'; }).join('');
  }
  function pintarTaxa() {
    var b = cliente.bairro && bairroDe(cliente.bairro);
    $('#taxaTxt').innerHTML = b ? 'Entrega em ' + esc(b.nome) + '<small>Taxa ' + brl(b.taxa) + ' · ' + esc(b.tempo) + '</small>' : 'Calcular taxa e tempo de entrega';
  }

  /* ---------------- cardápio ---------------- */
  function cardItem(i) {
    var es = !i.disponivel;
    return '<button type="button" class="item rv' + (es ? ' esgotado' : '') + (vistos[i.id] ? ' visto' : '') + '" data-item="' + esc(i.id) + '" id="item-' + esc(i.id) + '">' +
      '<span class="item-t"><b>' + esc(i.nome) + '</b><p>' + esc(i.desc) + '</p>' +
      (i.id === 'combo-casal' ? '<span class="tag">' + IC.loja.replace('<svg', '<svg width="15" height="15" style="fill:none;stroke:currentColor;stroke-width:1.8"') + ' Serve 2 pessoas</span>' : '') +
      precoHtml(i) + '</span>' +
      '<span class="item-f"><img src="' + esc(i.foto) + '" alt="" width="104" height="104" loading="lazy" decoding="async"></span></button>';
  }
  function pintarCardapio() {
    var dest = cardapio.itens.filter(function (i) { return i.destaque && i.disponivel; });
    $('#destaques').innerHTML = dest.map(function (i) {
      return '<button type="button" class="dest rv' + (vistos['d-' + i.id] ? ' visto' : '') + '" data-item="' + esc(i.id) + '"><img src="' + esc(i.foto) + '" alt="" width="156" height="156" loading="lazy" decoding="async"><b>' + esc(i.nome) + '</b>' + precoHtml(i) + '</button>';
    }).join('');
    $('#blocoDest').hidden = !dest.length;
    $('#secoes').innerHTML = cardapio.categorias.map(function (c) {
      var its = cardapio.itens.filter(function (i) { return i.cat === c.id; });
      if (!its.length) return '';
      return '<section class="secao" id="cat-' + esc(c.id) + '" data-cat="' + esc(c.nome) + '"><h2 class="titulo-sec">' + esc(c.nome) + '</h2>' + its.map(cardItem).join('') + '</section>';
    }).join('');
    $('#listaPromos').innerHTML = cardapio.itens.filter(function (i) { return i.precoAntigo > i.preco; }).map(cardItem).join('') || '<p class="vazio">Nenhuma promoção hoje.</p>';
    espiar();
    filtrar();
    revelar();
  }

  /* ---------------- movimento: entrada ao rolar, pausa de loops ---------------- */
  var reduz = w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, vistos = {};
  var ioRv = 'IntersectionObserver' in w && !reduz ? new IntersectionObserver(function (es) {
    var k = 0;
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; ioRv.unobserve(el);
      vistos[(el.classList.contains('dest') ? 'd-' : '') + el.getAttribute('data-item')] = 1;
      el.style.setProperty('--rd', Math.min(k++, 5) * 60 + 'ms'); el.classList.add('visto');
    });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  if (ioRv) d.documentElement.classList.add('js-mov');
  function revelar() { if (ioRv) $$('.rv:not(.visto)').forEach(function (el) { ioRv.observe(el); }); }
  d.addEventListener('visibilitychange', function () { d.documentElement.classList.toggle('oculto', d.hidden); });
  if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { $('#capa').classList.toggle('parado', !es[0].isIntersecting); }).observe($('#capa'));
  // item "voa" da foto do modal até a sacola; contador dá um pulo ao chegar
  function voarParaSacola(foto, ate) {
    var bar = $('#sacolaBar'), q = $('#sacQtd');
    function pulo() { q.classList.remove('pop'); void q.offsetWidth; q.classList.add('pop'); }
    if (reduz || !foto || !foto.getBoundingClientRect || !bar.animate) { pulo(); return; }
    var r = foto.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    var x1 = bar.offsetLeft + q.offsetLeft + q.offsetWidth / 2, y1 = bar.offsetTop + bar.offsetHeight / 2;
    var v = d.createElement('div'); v.className = 'voa'; v.style.backgroundImage = 'url("' + ate + '")'; d.body.appendChild(v);
    var a = v.animate([
      { transform: 'translate3d(' + x0 + 'px,' + y0 + 'px,0) scale(1.6)', opacity: 0 },
      { transform: 'translate3d(' + x0 + 'px,' + y0 + 'px,0) scale(1.3)', opacity: 1, offset: .12 },
      { transform: 'translate3d(' + (x0 + (x1 - x0) * .55) + 'px,' + (Math.min(y0, y1) - 60) + 'px,0) scale(.85)', opacity: 1, offset: .55 },
      { transform: 'translate3d(' + x1 + 'px,' + y1 + 'px,0) scale(.32)', opacity: .9 }
    ], { duration: 720, easing: 'cubic-bezier(.45,0,.3,1)' });
    a.onfinish = function () { v.remove(); pulo(); };
    setTimeout(function () { if (v.parentNode) { v.remove(); } }, 1400);
  }

  // categoria atual na barra conforme rola
  var ioCat = null;
  function espiar() {
    if (ioCat) ioCat.disconnect();
    if (!('IntersectionObserver' in w)) return;
    ioCat = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) $('#catAtual').textContent = e.target.getAttribute('data-cat'); });
    }, { rootMargin: '-70px 0px -75% 0px' });
    $$('.secao').forEach(function (s) { ioCat.observe(s); });
  }
  // barra presa
  if ('IntersectionObserver' in w) {
    new IntersectionObserver(function (es) {
      var presa = !es[0].isIntersecting && es[0].boundingClientRect.top < 0;
      $('#barra').classList.toggle('presa', presa);
      if (!presa) $('#catAtual').textContent = 'Lista de categorias';
    }).observe($('#btnTaxa'));
  }

  function filtrar() {
    var q = ($('#q').value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    $('#blocoDest').hidden = !!q || !$('#destaques').children.length;
    $$('#secoes .secao').forEach(function (s) {
      var vis = 0;
      $$('.item', s).forEach(function (b) {
        var i = itemPorId(b.getAttribute('data-item'));
        var txt = (i.nome + ' ' + i.desc).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        var ok = !q || txt.indexOf(q) >= 0; b.hidden = !ok; if (ok) vis++;
      });
      s.hidden = !vis;
    });
    var nada = $('#nadaAchado');
    if (q && !$$('#secoes .secao:not([hidden])').length) {
      if (!nada) { nada = d.createElement('p'); nada.id = 'nadaAchado'; nada.className = 'vazio'; $('#secoes').appendChild(nada); }
      nada.textContent = 'Nada encontrado para “' + $('#q').value + '”.';
    } else if (nada) nada.remove();
  }

  /* ---------------- folha (sheet) ---------------- */
  var folha = $('#folha'), veu = $('#veu'), aoFechar = null;
  function abrir(html, o) {
    o = o || {};
    if (aoFechar) { var f = aoFechar; aoFechar = null; f(); }
    var jaAberta = !folha.hidden && folha.classList.contains('on');
    folha.innerHTML = html; folha.onchange = null;
    folha.className = 'folha' + (o.cheia ? ' cheia' : '') + (jaAberta ? ' on troca' : '');
    folha.hidden = false; veu.hidden = false;
    d.body.classList.add('travado');
    aoFechar = o.aoFechar || null;
    requestAnimationFrame(function () { requestAnimationFrame(function () { folha.classList.add('on'); veu.classList.add('on'); }); });
    var c = $('.folha-corpo', folha); if (c) c.scrollTop = 0;
    return folha;
  }
  function fechar() {
    if (folha.hidden) return;
    folha.classList.remove('on'); veu.classList.remove('on');
    d.body.classList.remove('travado');
    if (aoFechar) { var f = aoFechar; aoFechar = null; f(); }
    setTimeout(function () { if (!folha.classList.contains('on')) { folha.hidden = true; veu.hidden = true; folha.innerHTML = ''; } }, 360);
  }
  veu.addEventListener('click', fechar);
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
  function cab(titulo, voltar) {
    return '<div class="folha-cab">' + (voltar ? '<button class="voltar" type="button" data-acao="' + voltar + '" aria-label="Voltar">' + IC.voltar + '</button>' : '') +
      '<h2>' + titulo + '</h2><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">' + IC.x + '</button></div>';
  }

  /* ---------------- modal do item ---------------- */
  function abrirItem(id) {
    var i = itemPorId(id); if (!i) return;
    var extras = i.extras === 'burger' ? loja.extras : i.extras === 'porcao' ? loja.extrasPorcao : [];
    var temPonto = i.extras === 'burger' && !i.semPonto;
    var h = '<div class="folha-corpo"><div class="mi-foto"><img src="' + esc(i.foto) + '" alt="' + esc(i.nome) + '" width="900" height="900"><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">' + IC.x + '</button></div>' +
      '<div class="mi-info"><h2>' + esc(i.nome) + '</h2><p>' + esc(i.desc) + '</p>' + precoHtml(i) + '</div>';
    if (extras.length) h += '<div class="grupo"><div class="grupo-cab"><div><b>Adicionais</b><small>Escolha quantos quiser</small></div><span class="selo opc">Opcional</span></div>' +
      extras.map(function (e) { return '<label class="opc-l"><span>' + esc(e.nome) + '</span><em>+ ' + brl(e.preco) + '</em><input type="checkbox" name="extra" value="' + esc(e.id) + '"></label>'; }).join('') + '</div>';
    if (temPonto) h += '<div class="grupo"><div class="grupo-cab"><div><b>Ponto da carne</b><small>Escolha 1 opção</small></div><span class="selo">Obrigatório</span></div>' +
      loja.pontos.map(function (p, k) { return '<label class="opc-l"><span>' + esc(p) + '</span><input type="radio" name="ponto" value="' + esc(p) + '"' + (k === 0 ? ' checked' : '') + '></label>'; }).join('') + '</div>';
    if ((i.retirar || []).length) h += '<div class="grupo"><div class="grupo-cab"><div><b>Retirar ingredientes</b><small>Marque o que não quer</small></div><span class="selo opc">Opcional</span></div>' +
      i.retirar.map(function (r) { return '<label class="opc-l"><span>Sem ' + esc(r.toLowerCase()) + '</span><input type="checkbox" name="retirar" value="' + esc(r) + '"></label>'; }).join('') + '</div>';
    h += '<div class="grupo"><div class="grupo-cab"><div><b>Alguma observação?</b><small>Ex.: maionese à parte</small></div></div><div class="obs"><textarea id="miObs" maxlength="140" placeholder="Escreva aqui (opcional)"></textarea></div></div></div>';
    h += '<div class="folha-pe">' + (i.disponivel ? '<div class="pe-linha"><div class="qtd-ctl"><button type="button" id="miMenos" aria-label="Menos" disabled>−</button><b id="miQtd">1</b><button type="button" id="miMais" aria-label="Mais">+</button></div>' +
      '<button class="btn-prim" type="button" id="miAdd"><span>Adicionar</span><span id="miTot">' + brl(i.preco) + '</span></button></div>' :
      '<button class="btn-prim centro" type="button" disabled style="width:100%">Esgotado no momento</button>') + '</div>';
    abrir(h);
    if (!i.disponivel) return;
    var qtd = 1;
    function calc() {
      var ex = $$('input[name=extra]:checked', folha).map(function (c) { return extras.filter(function (e) { return e.id === c.value; })[0]; });
      var unit = i.preco + ex.reduce(function (s, e) { return s + e.preco; }, 0);
      $('#miTot').textContent = brl(unit * qtd); $('#miQtd').textContent = qtd; $('#miMenos').disabled = qtd <= 1;
      return { ex: ex, unit: unit };
    }
    folha.onchange = calc;
    $('#miMais').onclick = function () { qtd = Math.min(20, qtd + 1); calc(); popQ(); };
    $('#miMenos').onclick = function () { qtd = Math.max(1, qtd - 1); calc(); popQ(); };
    function popQ() { var b = $('#miQtd'); if (!b) return; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    $('#miAdd').onclick = function () {
      var c = calc(), pt = $('input[name=ponto]:checked', folha);
      var linha = { key: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), itemId: i.id, nome: i.nome, foto: i.foto, qtd: qtd, precoUnit: +c.unit.toFixed(2),
        extras: c.ex.map(function (e) { return { nome: e.nome, preco: e.preco }; }), ponto: pt ? pt.value : '',
        retirar: $$('input[name=retirar]:checked', folha).map(function (x) { return x.value; }), obs: $('#miObs').value.trim() };
      var igual = sacola.filter(function (s) { return s.itemId === linha.itemId && U.detalheItem(s) === U.detalheItem(linha); })[0];
      if (igual) igual.qtd += qtd; else sacola.push(linha);
      var fotoEl = $('.mi-foto img', folha);
      salvarSacola(); voarParaSacola(fotoEl, i.foto); fechar(); toast(qtd + '× ' + i.nome + ' na sacola');
      var bar = $('#sacolaBar'); bar.classList.remove('pulo'); void bar.offsetWidth; bar.classList.add('pulo');
    };
  }

  /* ---------------- sacola ---------------- */
  function subtotal() { return +sacola.reduce(function (s, x) { return s + x.precoUnit * x.qtd; }, 0).toFixed(2); }
  function salvarSacola() {
    gravar('ab_sacola', sacola);
    var n = sacola.reduce(function (s, x) { return s + x.qtd; }, 0);
    $('#sacQtd').textContent = n; $('#sacTot').textContent = brl(subtotal());
    $('#sacolaBar').classList.toggle('on', n > 0 && !vistaAcomp());
    d.body.classList.toggle('tem-sacola', n > 0);
  }
  function vistaAcomp() { return folha.classList.contains('on') && folha.querySelector('.acomp'); }
  function abrirSacola() {
    if (!sacola.length) { fechar(); toast('Sua sacola está vazia'); return; }
    var h = cab('Sua sacola') + '<div class="folha-corpo">' + sacola.map(function (x) {
      return '<div class="sac-item" data-key="' + x.key + '"><img src="' + esc(x.foto) + '" alt="" width="58" height="58"><div class="t"><b>' + esc(x.nome) + '</b><small>' + esc(U.detalheItem(x) || '—') + '</small>' +
        '<div class="qtd-ctl"><button type="button" data-q="-1" aria-label="Menos">' + (x.qtd === 1 ? '<svg viewBox="0 0 24 24" width="16" height="16" style="fill:none;stroke:#f0715f;stroke-width:2"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>' : '−') + '</button><b>' + x.qtd + '</b><button type="button" data-q="1" aria-label="Mais">+</button></div></div>' +
        '<span class="v">' + brl(x.precoUnit * x.qtd) + '</span></div>';
    }).join('') + '<button class="add-mais" type="button" data-acao="fechar">+ Adicionar mais itens</button>' +
      '<div class="resumo"><div class="tot"><span>Subtotal</span><span>' + brl(subtotal()) + '</span></div><div><span>Taxa de entrega</span><span>calculada no próximo passo</span></div></div></div>' +
      '<div class="folha-pe"><button class="btn-prim" type="button" data-acao="checkout"><span>Continuar</span><span>' + brl(subtotal()) + '</span></button></div>';
    abrir(h);
    $$('[data-q]', folha).forEach(function (b) {
      b.onclick = function () {
        var k = b.closest('.sac-item').getAttribute('data-key'), x = sacola.filter(function (s) { return s.key === k; })[0];
        x.qtd += +b.getAttribute('data-q'); if (x.qtd <= 0) sacola = sacola.filter(function (s) { return s !== x; });
        salvarSacola(); abrirSacola();
      };
    });
  }

  /* ---------------- checkout ---------------- */
  var tipo = ler('ab_tipo', 'entrega'), forma = 'pix';
  function abrirCheckout() {
    if (!sacola.length) return abrirSacola();
    var st = DB.statusLoja(loja);
    var h = cab('Finalizar pedido', 'sacola') + '<form class="folha-corpo" id="ck" novalidate><div class="ck">' +
      '<h3>Seus dados</h3>' +
      '<label class="campo" data-c="nome"><span>Nome</span><input name="nome" autocomplete="name" value="' + esc(cliente.nome) + '" placeholder="Como podemos te chamar?"></label>' +
      '<label class="campo" data-c="telefone"><span>Telefone (WhatsApp)</span><input name="telefone" inputmode="tel" autocomplete="tel" value="' + esc(cliente.telefone) + '" placeholder="(71) 90000-0000"></label>' +
      '<h3>Como quer receber?</h3><div class="seg">' +
      '<label><input type="radio" name="tipo" value="entrega"' + (tipo === 'entrega' ? ' checked' : '') + '><span>' + IC.moto + 'Entrega<small id="ckTempoE"></small></span></label>' +
      '<label><input type="radio" name="tipo" value="retirada"' + (tipo === 'retirada' ? ' checked' : '') + '><span>' + IC.loja + 'Retirada<small>' + esc(loja.tempoRetirada) + ' · grátis</small></span></label></div>' +
      '<div id="ckEnd"><h3>Endereço de entrega</h3>' +
      '<label class="campo" data-c="bairro"><span>Bairro</span><select name="bairro"><option value="">Selecione o bairro…</option>' + loja.bairros.map(function (b) { return '<option value="' + esc(b.nome) + '"' + (b.nome === cliente.bairro ? ' selected' : '') + '>' + esc(b.nome) + ' — ' + brl(b.taxa) + '</option>'; }).join('') + '</select></label>' +
      '<div class="dupla"><label class="campo" data-c="rua"><span>Rua</span><input name="rua" autocomplete="address-line1" value="' + esc(cliente.rua) + '" placeholder="Rua / Avenida"></label>' +
      '<label class="campo" data-c="numero"><span>Número</span><input name="numero" inputmode="numeric" value="' + esc(cliente.numero) + '"></label></div>' +
      '<label class="campo"><span>Complemento <small style="font-weight:500;color:var(--mut)">(opcional)</small></span><input name="complemento" value="' + esc(cliente.complemento) + '" placeholder="Apto, bloco, referência"></label></div>' +
      '<p class="aviso" id="ckRet" hidden>Retire no balcão: ' + esc(loja.endereco) + '</p>' +
      '<h3>Pagamento</h3><div class="seg tres">' +
      '<label><input type="radio" name="forma" value="pix"' + (forma === 'pix' ? ' checked' : '') + '><span>' + IC.pix + 'Pix</span></label>' +
      '<label><input type="radio" name="forma" value="cartao"' + (forma === 'cartao' ? ' checked' : '') + '><span>' + IC.cartao + 'Cartão<small>na entrega</small></span></label>' +
      '<label><input type="radio" name="forma" value="dinheiro"' + (forma === 'dinheiro' ? ' checked' : '') + '><span>' + IC.dinheiro + 'Dinheiro</span></label></div>' +
      '<label class="campo" id="ckTroco" data-c="troco" style="margin-top:10px" hidden><span>Troco para quanto?</span><input name="troco" inputmode="decimal" placeholder="Ex.: 100 (deixe vazio se não precisar)"></label>' +
      '<p class="aviso" id="ckPix" hidden>A chave Pix aparece na confirmação e também vai no resumo pelo WhatsApp.</p>' +
      '<label class="campo" style="margin-top:12px"><span>Observação do pedido <small style="font-weight:500;color:var(--mut)">(opcional)</small></span><input name="obs" maxlength="140" placeholder="Ex.: interfone com defeito"></label>' +
      '<h3>Resumo</h3><div class="caixa" style="margin-top:0">' + sacola.map(function (x) { return '<div class="li"><span>' + x.qtd + '× ' + esc(x.nome) + (U.detalheItem(x) ? '<small>' + esc(U.detalheItem(x)) + '</small>' : '') + '</span><span>' + brl(x.precoUnit * x.qtd) + '</span></div>'; }).join('') +
      '</div><div class="resumo" style="padding:10px 0 0"><div><span>Subtotal</span><span>' + brl(subtotal()) + '</span></div><div><span>Taxa de entrega</span><span id="ckTaxa">—</span></div><div class="tot"><span>Total</span><span id="ckTotal">' + brl(subtotal()) + '</span></div></div>' +
      (!st.aberta ? '<p class="aviso ruim">' + esc(st.texto) + '. Você pode montar a sacola, mas o envio fica liberado quando a loja abrir.</p>' : '') +
      (subtotal() < (loja.pedidoMinimo || 0) ? '<p class="aviso ruim">Pedido mínimo de ' + brl(loja.pedidoMinimo) + '.</p>' : '') +
      '</div></form><div class="folha-pe"><button class="btn-prim" type="button" id="ckEnviar"' + (!st.aberta || subtotal() < (loja.pedidoMinimo || 0) ? ' disabled' : '') + '><span>Enviar pedido</span><span id="ckBtnTot">' + brl(subtotal()) + '</span></button></div>';
    abrir(h, { cheia: true });
    var f = $('#ck'), tel = f.telefone;
    tel.addEventListener('input', function () { tel.value = mascTel(tel.value); });
    f.addEventListener('input', function (e) { var c = e.target.closest('.campo.erro'); if (c) { c.classList.remove('erro'); var m = $('.erro-msg', c); if (m) m.remove(); } });
    f.addEventListener('change', function (e) { var c = e.target.closest('.campo.erro'); if (c) { c.classList.remove('erro'); var m = $('.erro-msg', c); if (m) m.remove(); } });
    function total() {
      tipo = f.tipo.value; forma = f.forma.value;
      var b = bairroDe(f.bairro.value), taxa = tipo === 'entrega' && b ? b.taxa : 0;
      $('#ckEnd').hidden = tipo !== 'entrega'; $('#ckRet').hidden = tipo !== 'retirada';
      $('#ckTroco').hidden = forma !== 'dinheiro'; $('#ckPix').hidden = forma !== 'pix';
      $('#ckTempoE').textContent = b ? b.tempo + ' · ' + brl(b.taxa) : 'escolha o bairro';
      $('#ckTaxa').textContent = tipo === 'retirada' ? 'Grátis' : b ? brl(taxa) : 'escolha o bairro';
      var t = +(subtotal() + taxa).toFixed(2);
      $('#ckTotal').textContent = brl(t); $('#ckBtnTot').textContent = brl(t);
      return { taxa: taxa, total: t, bairro: b };
    }
    f.addEventListener('change', total); total();
    $('#ckEnviar').onclick = function () { enviar(f, total()); };
  }
  function erro(f, campo, msg) {
    var c = $('[data-c=' + campo + ']', f); if (!c) return;
    c.classList.add('erro');
    var p = d.createElement('span'); p.className = 'erro-msg'; p.textContent = msg; c.appendChild(p);
  }
  function enviar(f, t) {
    $$('.erro-msg', f).forEach(function (e) { e.remove(); }); $$('.campo.erro', f).forEach(function (e) { e.classList.remove('erro'); });
    var v = { nome: f.nome.value.trim(), telefone: f.telefone.value.trim(), rua: f.rua.value.trim(), numero: f.numero.value.trim(), complemento: f.complemento.value.trim(), bairro: f.bairro.value };
    var ok = true;
    if (v.nome.length < 2) { erro(f, 'nome', 'Informe seu nome.'); ok = false; }
    if (v.telefone.replace(/\D/g, '').length < 10) { erro(f, 'telefone', 'Telefone com DDD, por favor.'); ok = false; }
    if (tipo === 'entrega') {
      if (!v.bairro) { erro(f, 'bairro', 'Escolha o bairro de entrega.'); ok = false; }
      if (!v.rua) { erro(f, 'rua', 'Informe a rua.'); ok = false; }
      if (!v.numero) { erro(f, 'numero', 'Nº'); ok = false; }
    }
    var troco = 0;
    if (forma === 'dinheiro' && f.troco.value.trim()) {
      troco = parseFloat(f.troco.value.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
      if (troco && troco < t.total) { erro(f, 'troco', 'O valor precisa ser maior que o total (' + brl(t.total) + ').'); ok = false; }
    }
    if (!ok) { var e1 = $('.campo.erro', f); if (e1) e1.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    cliente = v; gravar('ab_cliente', cliente); gravar('ab_tipo', tipo);
    var btn = $('#ckEnviar'); btn.disabled = true; btn.firstChild.textContent = 'Enviando…';
    DB.criarPedido({
      cliente: { nome: v.nome, telefone: v.telefone }, tipo: tipo,
      endereco: tipo === 'entrega' ? { rua: v.rua, numero: v.numero, complemento: v.complemento, bairro: v.bairro } : null,
      itens: sacola.map(function (x) { return { itemId: x.itemId, nome: x.nome, qtd: x.qtd, precoUnit: x.precoUnit, extras: x.extras, ponto: x.ponto, retirar: x.retirar, obs: x.obs, total: +(x.precoUnit * x.qtd).toFixed(2) }; }),
      subtotal: subtotal(), taxa: t.taxa, total: t.total,
      pagamento: { forma: forma, trocoPara: troco }, obs: f.obs.value.trim(),
      previsao: tipo === 'entrega' ? (t.bairro && t.bairro.tempo) : loja.tempoRetirada
    }).then(function (p) {
      meus.unshift(p.id); gravar('ab_meus_pedidos', meus.slice(0, 30));
      sacola = []; salvarSacola(); pintarBolha();
      abrirAcomp(p.id, true);
    }).catch(function (e) { btn.disabled = false; btn.firstChild.textContent = 'Enviar pedido'; toast('Não foi possível enviar: ' + e.message); });
  }

  /* ---------------- acompanhamento ---------------- */
  function textoZap(p) {
    var l = ['*Pedido #' + p.numero + ' — ' + loja.nome + '*', ''];
    p.itens.forEach(function (x) { l.push(x.qtd + '× ' + x.nome + (U.detalheItem(x) ? ' (' + U.detalheItem(x) + ')' : '') + ' — ' + brl(x.total)); });
    l.push('', 'Subtotal: ' + brl(p.subtotal));
    if (p.tipo === 'entrega') l.push('Entrega: ' + brl(p.taxa));
    l.push('*Total: ' + brl(p.total) + '*', '');
    l.push(p.tipo === 'entrega' ? 'Entregar em: ' + p.endereco.rua + ', ' + p.endereco.numero + (p.endereco.complemento ? ' — ' + p.endereco.complemento : '') + ' · ' + p.endereco.bairro : 'Vou retirar no balcão');
    l.push('Pagamento: ' + U.pagamento(p.pagamento));
    if (p.obs) l.push('Obs.: ' + p.obs);
    l.push('Cliente: ' + p.cliente.nome + ' · ' + p.cliente.telefone);
    l.push('', 'Acompanhar: ' + location.href.split('#')[0] + '#pedido-' + p.id);
    return l.join('\n');
  }
  function abrirAcomp(id, novo) {
    if (pararAcomp) { pararAcomp(); pararAcomp = null; }
    abrir(cab('Acompanhar pedido') + '<div class="folha-corpo"><div class="acomp" id="acomp"><p class="vazio">Carregando…</p></div></div>', {
      cheia: true, aoFechar: function () { if (pararAcomp) { pararAcomp(); pararAcomp = null; } if (/^#pedido-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); salvarSacola(); pintarPedidos(); }
    });
    $('#sacolaBar').classList.remove('on');
    if (location.hash !== '#pedido-' + id) history.replaceState(null, '', '#pedido-' + id);
    var anterior = null;
    pararAcomp = DB.ouvirPedido(id, function (p) {
      var el = $('#acomp'); if (!el) return;
      if (!p) { el.innerHTML = '<p class="vazio">Pedido não encontrado neste aparelho.</p>'; return; }
      if (anterior && anterior !== p.status) toast('Pedido #' + p.numero + ': ' + U.rotuloStatus(p.status, p.tipo));
      anterior = p.status;
      pintarAcomp(el, p, novo); novo = false; pintarBolha();
    });
  }
  function pintarAcomp(el, p, novo) {
    var ordem = ['novo', 'preparo', 'saiu', 'concluido'], idx = ordem.indexOf(p.status), canc = p.status === 'cancelado';
    var quando = {}; p.historico.forEach(function (h) { quando[h.status] = h.em; });
    var nomes = { novo: 'Pedido recebido', preparo: 'Em preparo', saiu: U.rotuloStatus('saiu', p.tipo), concluido: U.rotuloStatus('concluido', p.tipo) };
    var dicas = { novo: 'A loja está conferindo seu pedido', preparo: 'Seu burger está na chapa', saiu: p.tipo === 'retirada' ? 'Pode vir buscar no balcão' : 'O entregador está a caminho', concluido: 'Bom apetite!' };
    var ic = canc ? IC.cancel : { novo: IC.recebido, preparo: IC.fogo, saiu: p.tipo === 'retirada' ? IC.sacola : IC.moto, concluido: IC.feito }[p.status];
    var h = '<div class="ac-topo"><div class="ac-icone' + (!canc && idx < 3 ? ' vivo' : '') + '">' + ic + '</div><div class="ac-num">PEDIDO #' + p.numero + '</div>' +
      '<h2 class="ac-status">' + (canc ? 'Pedido cancelado' : esc(nomes[p.status])) + '</h2>' +
      '<div class="ac-prev">' + (canc ? 'Fale com a loja pelo WhatsApp se tiver dúvidas.' : idx < 3 ? esc(dicas[p.status]) + (p.previsao ? ' · previsão ' + esc(p.previsao) : '') : esc(dicas.concluido)) + '</div></div>';
    if (novo) h += '<p class="aviso" style="margin:0 0 16px">Pedido enviado! A loja já recebeu e esta tela atualiza sozinha a cada etapa.</p>';
    if (!canc) h += '<ol class="etapas">' + ordem.map(function (s, k) {
      var cls = k < idx || (k === idx && s === 'concluido') ? 'feita' : k === idx ? 'atual' : '';
      return '<li class="etapa ' + cls + '"><span class="barra-v"></span><span class="bol">' + IC.check + '</span><span class="et-t"><b>' + esc(nomes[s]) + '</b><small>' + (quando[s] ? U.hora(quando[s]) : k === idx + 1 ? 'a seguir' : '') + '</small></span></li>';
    }).join('') + '</ol>';
    h += '<div class="caixa"><h4>' + (p.tipo === 'entrega' ? 'Entrega' : 'Retirada') + '</h4><div class="li"><span>' + (p.tipo === 'entrega' ? esc(p.endereco.rua + ', ' + p.endereco.numero + (p.endereco.complemento ? ' — ' + p.endereco.complemento : '')) + '<small>' + esc(p.endereco.bairro) + '</small>' : esc(loja.endereco)) + '</span></div></div>';
    h += '<div class="caixa"><h4>Itens</h4>' + p.itens.map(function (x) { return '<div class="li"><span>' + x.qtd + '× ' + esc(x.nome) + (U.detalheItem(x) ? '<small>' + esc(U.detalheItem(x)) + '</small>' : '') + '</span><span>' + brl(x.total) + '</span></div>'; }).join('') +
      '<div class="li" style="border-top:1px dashed rgba(244,237,226,.2);margin-top:6px;padding-top:9px"><span>Taxa de entrega</span><span>' + (p.taxa ? brl(p.taxa) : 'Grátis') + '</span></div>' +
      '<div class="li"><b>Total</b><b>' + brl(p.total) + '</b></div><div class="li"><span>Pagamento</span><span>' + esc(U.pagamento(p.pagamento)) + '</span></div></div>';
    if (p.pagamento.forma === 'pix' && idx < 3 && !canc) h += '<div class="caixa"><h4>Pix</h4><div class="li"><span>Chave (telefone)<small>' + esc(loja.telefone) + ' · ' + esc(loja.nome) + '</small></span><button class="btn-sec" type="button" data-copiar="' + esc(loja.telefone.replace(/\D/g, '')) + '" style="height:38px">Copiar</button></div></div>';
    h += '<div class="ac-acoes"><a class="btn-sec btn-zap" target="_blank" rel="noopener" href="https://wa.me/' + esc(loja.whatsapp) + '?text=' + encodeURIComponent(textoZap(p)) + '">' + IC.zap + 'Enviar resumo pelo WhatsApp</a>' +
      '<button class="btn-sec" type="button" data-acao="fechar">Voltar ao cardápio</button></div>';
    el.innerHTML = h;
  }

  /* ---------------- vistas: pedidos, perfil ---------------- */
  function pintarPedidos() {
    if (!meus.length) { $('#listaPedidos').innerHTML = '<p class="vazio">Você ainda não fez pedidos por aqui.</p>'; return; }
    Promise.all(meus.map(function (id) { return DB.pedido(id); })).then(function (ps) {
      ps = ps.filter(Boolean);
      $('#listaPedidos').innerHTML = ps.map(function (p) {
        return '<button type="button" class="ped-li" data-ped="' + p.id + '"><span class="n">#' + p.numero + '</span><span class="t"><b>' + p.itens.reduce(function (s, x) { return s + x.qtd; }, 0) + ' itens · ' + brl(p.total) + '</b><small>' + new Date(p.criadoEm).toLocaleDateString('pt-BR') + ' às ' + U.hora(p.criadoEm) + '</small></span><span class="pill ' + p.status + '">' + esc(U.rotuloStatus(p.status, p.tipo)) + '</span></button>';
      }).join('') || '<p class="vazio">Nenhum pedido encontrado.</p>';
    });
  }
  function pintarBolha() {
    Promise.all(meus.slice(0, 10).map(function (id) { return DB.pedido(id); })).then(function (ps) {
      var n = ps.filter(function (p) { return p && ['novo', 'preparo', 'saiu'].indexOf(p.status) >= 0; }).length;
      $('#bolhaPed').hidden = !n; $('#bolhaPed').textContent = n;
    });
  }
  function vista(v) {
    ['inicio', 'promos', 'pedidos', 'perfil'].forEach(function (x) { $('#v-' + x).hidden = x !== v; });
    $$('#nav button').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-v') === v); });
    if (v === 'pedidos') pintarPedidos();
    if (v === 'perfil') { var f = $('#formPerfil'); ['nome', 'telefone', 'rua', 'numero', 'complemento'].forEach(function (k) { f[k].value = cliente[k] || ''; }); f.bairro.value = cliente.bairro || ''; }
    w.scrollTo(0, 0);
  }
  $('#formPerfil').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target;
    ['nome', 'telefone', 'rua', 'numero', 'complemento', 'bairro'].forEach(function (k) { cliente[k] = f[k].value.trim(); });
    gravar('ab_cliente', cliente); pintarTaxa(); toast('Dados salvos');
  });
  $('#formPerfil').telefone.addEventListener('input', function (e) { e.target.value = mascTel(e.target.value); });

  /* ---------------- folhas informativas ---------------- */
  function abrirInfo() {
    abrir(cab(esc(loja.nome)) + '<div class="folha-corpo">' +
      '<div class="info-l"><b>Endereço</b>' + esc(loja.endereco) + ' · <a href="' + esc(loja.mapa) + '" target="_blank" rel="noopener">ver no mapa</a></div>' +
      '<div class="info-l"><b>Horário</b>Todos os dias, das ' + esc(loja.abre) + ' às ' + esc(loja.fecha) + ' · <span style="color:' + (DB.statusLoja(loja).aberta ? '#5cc98a' : '#f0715f') + ';font-weight:700">' + esc(DB.statusLoja(loja).texto) + '</span></div>' +
      '<div class="info-l"><b>Contato</b><a href="https://wa.me/' + esc(loja.whatsapp) + '" target="_blank" rel="noopener">' + esc(loja.telefone) + ' (WhatsApp)</a></div>' +
      '<div class="info-l"><b>Pagamento</b>Pix, cartão na entrega (crédito/débito) e dinheiro</div>' +
      '<div class="info-l"><b>Pedido mínimo</b>' + brl(loja.pedidoMinimo) + ' · retirada em ' + esc(loja.tempoRetirada) + '</div>' +
      '<div class="info-l"><b>Taxas de entrega</b>' + loja.bairros.map(function (b) { return '<div class="bairro-li"><span>' + esc(b.nome) + '</span><span>' + brl(b.taxa) + ' · ' + esc(b.tempo) + '</span></div>'; }).join('') + '</div></div>');
  }
  function abrirTaxa() {
    abrir(cab('Taxa e tempo de entrega') + '<div class="folha-corpo">' + loja.bairros.map(function (b) {
      return '<label class="opc-l"><span><b style="font-size:15px">' + esc(b.nome) + '</b><br><em>' + esc(b.tempo) + '</em></span><em>' + brl(b.taxa) + '</em><input type="radio" name="bx" value="' + esc(b.nome) + '"' + (b.nome === cliente.bairro ? ' checked' : '') + '></label>';
    }).join('') + '<p class="rod-mini">Retirada no balcão é grátis · ' + esc(loja.tempoRetirada) + '</p></div>');
    folha.onchange = function (e) { if (e.target.name === 'bx') { cliente.bairro = e.target.value; gravar('ab_cliente', cliente); pintarTaxa(); setTimeout(fechar, 180); } };
  }
  function abrirCategorias() {
    abrir(cab('Categorias') + '<div class="folha-corpo">' + cardapio.categorias.filter(function (c) { return cardapio.itens.some(function (i) { return i.cat === c.id; }); }).map(function (c) {
      var n = cardapio.itens.filter(function (i) { return i.cat === c.id; }).length;
      return '<button type="button" class="opc-l" data-ircat="' + esc(c.id) + '" style="width:100%;border:0;border-bottom:1px solid rgba(244,237,226,.1);background:none;text-align:left;font-weight:700"><span>' + esc(c.nome) + '</span><em>' + n + ' itens</em></button>';
    }).join('') + '</div>');
  }

  /* ---------------- eventos ---------------- */
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-item],[data-acao],[data-ped],[data-ircat],[data-copiar]');
    if (!t) return;
    if (t.hasAttribute('data-item')) abrirItem(t.getAttribute('data-item'));
    else if (t.hasAttribute('data-ped')) abrirAcomp(t.getAttribute('data-ped'));
    else if (t.hasAttribute('data-ircat')) { var id = t.getAttribute('data-ircat'); fechar(); vista('inicio'); setTimeout(function () { var s = $('#cat-' + id); if (s) s.scrollIntoView({ behavior: 'smooth' }); }, 60); }
    else if (t.hasAttribute('data-copiar')) { var v = t.getAttribute('data-copiar'); (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { toast('Chave Pix copiada'); }, function () { toast('Chave: ' + v); }); }
    else {
      var a = t.getAttribute('data-acao');
      if (a === 'fechar') fechar(); else if (a === 'checkout') abrirCheckout(); else if (a === 'sacola') abrirSacola();
    }
  });
  $('#sacolaBar').onclick = abrirSacola;
  $('#maisInfo').onclick = abrirInfo;
  $('#btnTaxa').onclick = abrirTaxa;
  $('#selCat').onclick = abrirCategorias;
  $('#btnBusca').onclick = function () {
    var b = $('#barra'), on = !b.classList.contains('buscando');
    b.classList.toggle('buscando', on);
    if (on) { $('#q').focus(); } else { $('#q').value = ''; filtrar(); }
  };
  $('#q').addEventListener('input', filtrar);
  $$('#nav button').forEach(function (b) { b.onclick = function () { fechar(); vista(b.getAttribute('data-v')); }; });

  function rota() {
    var h = location.hash;
    var m = /^#pedido-(\w+)/.exec(h); if (m) return abrirAcomp(m[1]);
    m = /^#item-([\w-]+)/.exec(h); if (m && itemPorId(m[1])) { history.replaceState(null, '', location.pathname); abrirItem(m[1]); }
  }
  w.addEventListener('hashchange', rota);

  /* ---------------- início ---------------- */
  Promise.all([DB.loja(), DB.cardapio()]).then(function (r) {
    loja = r[0]; cardapio = r[1];
    pintarLoja(); pintarCardapio(); salvarSacola(); pintarBolha(); rota();
  });
  DB.ouvirLoja(function () { DB.loja().then(function (l) { loja = l; pintarLoja(); }); });
  DB.ouvirCardapio(function () { DB.cardapio().then(function (c) { cardapio = c; pintarCardapio(); }); });
  setInterval(function () { if (loja) { var st = DB.statusLoja(loja), el = $('#statusLoja'); el.textContent = st.texto; el.className = 'status-loja ' + (st.aberta ? 'aberta' : 'fechada'); } }, 60000);
  U.pwa();
})();
