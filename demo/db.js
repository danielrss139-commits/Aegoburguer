/* =====================================================================
   AEGO Burguer — camada de dados ÚNICA (site, pedir e painel)
   Modo atual: DEMO (localStorage do navegador).

   Todas as funções devolvem Promise, então trocar por Firebase/Firestore
   é reescrever só este arquivo mantendo os mesmos nomes:

     DB.loja()                       -> Promise<loja>
     DB.salvarLoja(parcial)          -> Promise<loja>
     DB.cardapio()                   -> Promise<{categorias, itens}>
     DB.salvarItem(item)             -> Promise<item>      (cria se não tiver id)
     DB.removerItem(id)              -> Promise<void>
     DB.salvarCategorias(lista)      -> Promise<lista>
     DB.criarPedido(dados)           -> Promise<pedido>    (número sequencial, status "novo")
     DB.pedido(id)                   -> Promise<pedido|null>
     DB.pedidos({desde})             -> Promise<pedido[]>  (mais novo primeiro)
     DB.mudarStatus(id, status)      -> Promise<pedido>
     DB.ouvirPedidos(cb)             -> função para parar  (Firestore: onSnapshot da coleção)
     DB.ouvirPedido(id, cb)          -> função para parar  (Firestore: onSnapshot do doc)
     DB.ouvirLoja(cb)                -> função para parar
     DB.entrar(email, senha)         -> Promise<usuario>   (Firebase Auth)
     DB.sair() / DB.usuario()
     DB.restaurarDemo()              -> apaga e recria os dados de exemplo

   Status do pedido: novo -> preparo -> saiu -> concluido   (ou cancelado)
   "saiu" = "Saiu para entrega" (entrega) ou "Pronto para retirada" (retirada).
   ===================================================================== */
(function (w) {
  'use strict';
  var VERSAO = 7;
  var K = { versao: 'ab_versao', loja: 'ab_loja', cardapio: 'ab_cardapio', pedidos: 'ab_pedidos', seq: 'ab_seq', sessao: 'ab_sessao' };
  var LS = w.localStorage;

  function ler(k, padrao) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } }
  function gravar(k, v) { LS.setItem(k, JSON.stringify(v)); }
  function P(v) { return Promise.resolve(v); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- dados de exemplo ---------------- */
  var LOJA = {
    nome: 'AEGO Burguer',
    slogan: 'Sabor que vicia',
    bairro: 'Centro',
    cidade: 'Sua Cidade - UF',
    endereco: 'Rua Exemplo, 123 — Centro, Sua Cidade/UF',
    telefone: '(71) 98390-1535',
    whatsapp: '5571983901535',
    mapa: 'https://www.google.com/maps/search/?api=1&query=hamburgueria',
    instagram: 'aegoburguer',
    abre: '11:00',
    fecha: '01:00',
    modo: 'aberta',              // demo sempre aceita pedidos (no cliente real: 'auto' segue o horário) | aberta | fechada
    faixaPreco: 'R$40–60 por pessoa',
    tempoRetirada: '20–30 min',
    pedidoMinimo: 20,
    bairros: [
      { nome: 'Centro', taxa: 5, tempo: '30–40 min' },
      { nome: 'Jardim Europa', taxa: 6, tempo: '35–45 min' },
      { nome: 'Vila Nova', taxa: 6, tempo: '35–45 min' },
      { nome: 'Bela Vista', taxa: 7, tempo: '40–50 min' },
      { nome: 'Boa Vista', taxa: 8, tempo: '40–50 min' },
      { nome: 'Santa Cruz', taxa: 9, tempo: '45–55 min' },
      { nome: 'São José', taxa: 9, tempo: '45–55 min' }
    ],
    // adicionais oferecidos nos itens com "extras: 'burger'"
    extras: [
      { id: 'bacon', nome: 'Bacon extra', preco: 5 },
      { id: 'cheddar', nome: 'Cheddar extra', preco: 4 },
      { id: 'carne', nome: 'Carne extra 120g', preco: 9 },
      { id: 'cebola', nome: 'Cebola caramelizada', preco: 3 },
      { id: 'ovo', nome: 'Ovo', preco: 3 }
    ],
    extrasPorcao: [
      { id: 'molho', nome: 'Molho da casa extra', preco: 3 },
      { id: 'cheddarP', nome: 'Cheddar cremoso', preco: 5 }
    ],
    pontos: ['Ao ponto', 'Mal passado', 'Bem passado'],
    avaliacoes: [
      { nome: 'Mariana S.', nota: 5, texto: 'Melhor smash da região. Chegou quente e a batata crocante de verdade.' },
      { nome: 'Rafael T.', nota: 5, texto: 'O Melt é absurdo. Pedido rápido pelo site e acompanhei tudo até chegar.' },
      { nome: 'Juliana P.', nota: 5, texto: 'Atendimento ótimo, burger bem montado e preço justo. Virou o nosso de sexta.' }
    ],
    notaMedia: 4.9,
    totalAvaliacoes: 1280
  };

  var CATEGORIAS = [
    { id: 'combos', nome: 'Combos' },
    { id: 'smash', nome: 'Smash' },
    { id: 'burgers', nome: 'Burgers' },
    { id: 'duplos', nome: 'Duplos' },
    { id: 'porcoes', nome: 'Porções' },
    { id: 'bebidas', nome: 'Bebidas Geladinhas' },
    { id: 'sobremesas', nome: 'Sobremesas' }
  ];

  // informações extras de cada item: [linha de detalhes, selos]
  var INFO = {
    'combo-aego': ['Burger + batata + lata · serve 1', ['Mais pedido']],
    'combo-smash': ['Burger + batata + lata · serve 1', ['Economize']],
    'combo-casal': ['2 burgers + 2 porções · serve 2', ['Para dividir']],
    'fininho': ['Smash 90 g · serve 1 · pronto em ~12 min', ['Leve']],
    'smash-bacon': ['2 × smash 90 g · serve 1 · ~15 min', ['Mais pedido']],
    'triplo-smash': ['3 × smash 90 g · serve 1 · ~15 min', []],
    'aego-burguer': ['Blend 120 g · serve 1 · ~15 min', ['Clássico']],
    'aego-salad': ['Blend 120 g · com salada · ~15 min', []],
    'crispy': ['Blend 120 g · crocante · ~15 min', ['Novo']],
    'chicken': ['Frango empanado · serve 1 · ~18 min', []],
    'melt': ['2 × blend 120 g · serve 1 · ~18 min', ['Queridinho']],
    'duplo-bacon': ['2 × blend 120 g · serve 1 · ~18 min', ['Mais pedido']],
    'triplo-bacon': ['3 × blend 120 g · para muita fome · ~20 min', ['Gigante']],
    'batata': ['Porção média · serve 1 a 2', []],
    'batata-cb': ['Porção média · serve 2', ['Mais pedido']],
    'onion': ['16 anéis · serve 1 a 2', []],
    'nuggets': ['7 unidades + molho', []],
    'refri': ['Lata 350 ml', []], 'refri-zero': ['Lata 350 ml · zero açúcar', []], 'guarana': ['Lata 350 ml', []],
    'limonada': ['Copo 500 ml · feita na hora', []],
    'shake': ['Copo 400 ml', []],
    'brownie': ['Sobremesa individual', []],
    'petit': ['Sobremesa individual', []]
  };
  function it(id, cat, nome, desc, preco, foto, o) {
    var x = { id: id, cat: cat, nome: nome, desc: desc, preco: preco, foto: 'img/' + foto + '.webp', disponivel: true, destaque: false, precoAntigo: 0, extras: '', retirar: [] };
    for (var k in (o || {})) x[k] = o[k];
    // preços redondos, sem centavos (cardápio mostra só o número — estudo Cornell/CIA, 2009)
    x.preco = Math.floor(x.preco); if (x.precoAntigo) x.precoAntigo = Math.floor(x.precoAntigo);
    if (INFO[id]) { x.info = INFO[id][0]; if (INFO[id][1]) x.tags = INFO[id][1]; }
    return x;
  }
  var B = { extras: 'burger' };
  function ob(o) { var r = { extras: 'burger' }; for (var k in o) r[k] = o[k]; return r; }
  var ITENS = [
    it('combo-aego', 'combos', 'Combo AEGO', 'AEGO Burguer + batata frita média + refrigerante lata 350 ml. O clássico completo.', 39.9, 'combo1', ob({ destaque: true, retirar: ['Maionese verde', 'Cheddar'] })),
    it('combo-smash', 'combos', 'Combo Smash Bacon', 'Smash Bacon + batata frita média + refrigerante lata 350 ml.', 49.9, 'combo1', ob({ precoAntigo: 54.9, retirar: ['Bacon', 'Cebola'] })),
    it('combo-casal', 'combos', 'Combo Casal', '2 smash duplos, onion rings, batata com cheddar e bacon e 2 molhos da casa. Para dividir (ou não).', 99.9, 'combo2', { destaque: true }),
    it('fininho', 'smash', 'Fininho AEGO', 'Pão de brioche, smash de 90 g, american cheese (cheddar) e maionese verde.', 17.9, 'aego', ob({ retirar: ['Maionese verde', 'Cheddar'] })),
    it('smash-bacon', 'smash', 'Smash Bacon', 'Pão de brioche com gergelim, 2 smash de 90 g, american cheese, bacon em fatias e maionese da casa.', 27.9, 'smash', ob({ destaque: true, retirar: ['Bacon', 'Maionese da casa', 'Gergelim'] })),
    it('triplo-smash', 'smash', 'Triplo Smash', 'Pão de brioche com gergelim, 3 smash de 90 g, american cheese, alface picada, tomate e cebola roxa.', 38.9, 'triplo', ob({ retirar: ['Alface', 'Tomate', 'Cebola roxa'] })),
    it('aego-burguer', 'burgers', 'AEGO Burguer', 'Pão de brioche, burger de 120 g, american cheese (cheddar) e maionese verde.', 19.9, 'aego', ob({ destaque: true, retirar: ['Maionese verde', 'Cheddar'] })),
    it('aego-salad', 'burgers', 'AEGO Salad', 'Pão de brioche, burger de 120 g, american cheese, alface, cebola roxa, picles, tomate e maionese.', 23.9, 'salad', ob({ retirar: ['Alface', 'Cebola roxa', 'Picles', 'Tomate'] })),
    it('crispy', 'burgers', 'Crispy Burguer', 'Pão de brioche, burger de 120 g, american cheese, cebola crispy, bacon fatiado e nossa maionese defumada.', 27.9, 'crispy', ob({ destaque: true, retirar: ['Cebola crispy', 'Bacon', 'Maionese defumada'] })),
    it('chicken', 'burgers', 'Chicken Crispy', 'Pão de brioche, sobrecoxa empanada crocante, coleslaw, picles e molho cremoso.', 25.9, 'frango', { extras: 'burger', retirar: ['Coleslaw', 'Picles', 'Molho cremoso'], semPonto: true }),
    it('melt', 'duplos', 'AEGO Melt', 'Pão de brioche com gergelim, 2 burgers de 120 g, muito cheddar e cebola caramelizada.', 38.9, 'melt', ob({ destaque: true, retirar: ['Cebola caramelizada'] })),
    it('duplo-bacon', 'duplos', 'Duplo Bacon (O Preferido)', 'Pão brioche com gergelim, 2 blends artesanais de 120 g, american cheese, bacon, alface, tomate e molho da casa.', 39.9, 'duplo', ob({ retirar: ['Bacon', 'Alface', 'Tomate', 'Molho da casa'] })),
    it('triplo-bacon', 'duplos', 'Triplo Bacon AEGO', 'Para quem leva hambúrguer a sério! 3 carnes de 120 g, cheddar cremoso, muito bacon e alface picada.', 49.9, 'triplo', ob({ retirar: ['Bacon', 'Alface'] })),
    it('batata', 'porcoes', 'Batata frita média', 'Batatas crocantes por fora, macias por dentro e douradas no ponto certo.', 23.9, 'batata', { extras: 'porcao' }),
    it('batata-cb', 'porcoes', 'Batata com cheddar e bacon', 'Nossa batata média coberta com cheddar cremoso, bacon crocante e cebolinha.', 26.9, 'batatacb', { extras: 'porcao', destaque: true }),
    it('onion', 'porcoes', 'Onion rings média', '16 anéis de cebola empanados, dourados e sequinhos, com ketchup.', 23.9, 'onion', { extras: 'porcao' }),
    it('nuggets', 'porcoes', '7 Chicken nuggets + barbecue', 'Nuggets crocantes com molho barbecue defumado.', 21.9, 'nuggets', { extras: 'porcao', precoAntigo: 24.9 }),
    it('refri', 'bebidas', 'Refrigerante cola lata 350 ml', 'Lata de 350 ml bem gelada.', 8.9, 'refri'),
    it('refri-zero', 'bebidas', 'Refrigerante cola zero 350 ml', 'Lata de 350 ml zero açúcar, gelada.', 8.9, 'refri'),
    it('guarana', 'bebidas', 'Guaraná lata 350 ml', 'Lata de 350 ml bem gelada.', 8.9, 'guarana'),
    it('limonada', 'bebidas', 'Limonada suíça 500 ml', 'Limão, gelo e leite condensado batidos na hora.', 12.9, 'limonada'),
    it('shake', 'bebidas', 'Milkshake de chocolate', '400 ml, chantilly e calda de chocolate.', 18.9, 'shake', { precoAntigo: 21.9 }),
    it('brownie', 'sobremesas', 'Brownie com sorvete', 'Brownie quentinho, sorvete de creme e calda de chocolate.', 19.9, 'brownie'),
    it('petit', 'sobremesas', 'Petit gâteau', 'Bolinho de chocolate com recheio cremoso e sorvete de creme.', 22.9, 'petit', { disponivel: false })
  ];

  /* pedidos de exemplo (últimos 7 dias) */
  function rnd(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  // clientes fixos da demonstração (mesmo cliente volta e repete pedido)
  var CLIENTES = [
    ['Lucas Martins', '(71) 98812-4407', 'Rua das Acácias', '214', 'Apto 302', 0, 'Pouco gelo no refri'],
    ['Ana Paula Souza', '(71) 99137-2580', 'Av. Brasil', '1580', '', 1, ''],
    ['Bruno Carvalho', '(71) 98654-0913', 'Rua Sete de Setembro', '77', 'Casa 2', 2, ''],
    ['Camila Rocha', '(71) 99902-3346', 'Rua do Sol', '45', 'Bloco B, apto 104', 3, 'Interfone com defeito, ligar ao chegar'],
    ['Diego Ferreira', '(71) 98277-6158', 'Travessa Esperança', '12', '', 4, ''],
    ['Fernanda Lima', '(71) 99561-8824', 'Rua Bahia', '903', 'Apto 51', 0, 'Sem cebola em tudo'],
    ['Gabriel Santos', '(71) 98430-1172', 'Rua das Palmeiras', '330', '', 5, ''],
    ['Helena Teixeira', '(71) 99218-6045', 'Av. Central', '2201', 'Sala 8', 6, ''],
    ['Igor Nascimento', '(71) 98705-3391', 'Rua Rio Branco', '58', '', 1, ''],
    ['Julia Andrade', '(71) 99340-7716', 'Rua Esperança', '167', 'Fundos', 2, ''],
    ['Marcos Dias', '(71) 98123-9054', 'Rua Nova', '411', '', 3, ''],
    ['Natália Gomes', '(71) 99674-2238', 'Rua da Paz', '89', 'Apto 12', 0, ''],
    ['Rodrigo Esteves', '(71) 98946-5103', 'Av. das Flores', '760', '', 4, ''],
    ['Sofia Kato', '(71) 99485-0627', 'Rua Primavera', '28', 'Casa', 6, 'Troco em notas pequenas']
  ];
  function itemPedido(i, q, r) {
    var extras = [];
    if (i.extras === 'burger' && r() < .3) extras.push(LOJA.extras[Math.floor(r() * 3)]);
    var unit = i.preco + extras.reduce(function (s, e) { return s + e.preco; }, 0);
    return { itemId: i.id, nome: i.nome, qtd: q, precoUnit: +unit.toFixed(2), extras: extras.map(function (e) { return { nome: e.nome, preco: e.preco }; }),
      ponto: i.extras === 'burger' && !i.semPonto ? LOJA.pontos[r() < .75 ? 0 : (r() < .5 ? 1 : 2)] : '', retirar: [], obs: '', total: +(unit * q).toFixed(2) };
  }
  function gerarPedidos() {
    var r = rnd(42), agora = Date.now(), lista = [], seq = 1000;
    var vendaveis = ITENS.filter(function (i) { return i.disponivel; });
    var pesos = { 'smash-bacon': 5, 'aego-burguer': 4, 'melt': 4, 'combo-aego': 4, 'crispy': 3, 'batata': 4, 'batata-cb': 3, 'refri': 5, 'guarana': 3, 'duplo-bacon': 3, 'combo-casal': 2 };
    var saco = []; vendaveis.forEach(function (i) { for (var n = 0; n < (pesos[i.id] || 1); n++) saco.push(i); });
    function montar(t, status) {
      var n = 1 + Math.floor(r() * 3), itens = [];
      for (var k = 0; k < n; k++) { var i = saco[Math.floor(r() * saco.length)]; itens.push(itemPedido(i, r() < .2 ? 2 : 1, r)); }
      var cl = CLIENTES[Math.floor(Math.pow(r(), 1.6) * CLIENTES.length)];   // alguns clientes pedem bem mais que outros
      var entrega = r() < .68, b = LOJA.bairros[cl[5]];
      var sub = +itens.reduce(function (s, x) { return s + x.total; }, 0).toFixed(2), taxa = entrega ? b.taxa : 0;
      var formas = ['pix', 'pix', 'cartao', 'cartao', 'dinheiro'], f = formas[Math.floor(r() * formas.length)];
      var total = +(sub + taxa).toFixed(2);
      seq++;
      var p = { id: String(seq), numero: seq, criadoEm: t, cliente: { nome: cl[0], telefone: cl[1] },
        tipo: entrega ? 'entrega' : 'retirada', endereco: entrega ? { rua: cl[2], numero: cl[3], complemento: cl[4], bairro: b.nome } : null,
        itens: itens, subtotal: sub, taxa: taxa, total: total,
        pagamento: { forma: f, trocoPara: f === 'dinheiro' ? Math.ceil(total / 50) * 50 : 0 }, obs: r() < .35 ? cl[6] : '', status: status,
        historico: [{ status: 'novo', em: t }], demo: true };
      if (status !== 'novo') p.historico.push({ status: 'preparo', em: t + 3 * 60000 });
      if (status === 'saiu' || status === 'concluido') p.historico.push({ status: 'saiu', em: t + 22 * 60000 });
      if (status === 'concluido') p.historico.push({ status: 'concluido', em: t + 40 * 60000 });
      if (status === 'cancelado') p.historico.push({ status: 'cancelado', em: t + 5 * 60000 });
      lista.push(p);
    }
    var hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
    for (var d = 6; d >= 1; d--) {
      var base = hoje0.getTime() - d * 864e5, qtd = 9 + Math.floor(r() * 8);
      var horas = [];
      for (var q = 0; q < qtd; q++) {
        var h = r() < .25 ? 11.5 + r() * 3 : 18 + r() * 5.4;
        horas.push(base + h * 3600e3);
      }
      horas.sort().forEach(function (t) { montar(t, r() < .06 ? 'cancelado' : 'concluido'); });
    }
    // hoje: alguns concluídos nas últimas horas + pedidos em andamento
    var mins = [290, 250, 215, 180, 150, 120, 95, 70];
    mins.forEach(function (m) { montar(agora - m * 60000, 'concluido'); });
    montar(agora - 31 * 60000, 'saiu');
    montar(agora - 17 * 60000, 'preparo');
    montar(agora - 9 * 60000, 'preparo');
    montar(agora - 3 * 60000, 'novo');
    lista.sort(function (a, b) { return b.criadoEm - a.criadoEm; });
    return { lista: lista, seq: seq };
  }

  function semear(forcar) {
    if (!forcar && ler(K.versao, 0) === VERSAO) return;
    var g = gerarPedidos();
    gravar(K.loja, LOJA);
    gravar(K.cardapio, { categorias: CATEGORIAS, itens: ITENS });
    gravar(K.pedidos, g.lista);
    gravar(K.seq, g.seq);
    gravar(K.versao, VERSAO);
  }
  semear(false);

  /* ---------------- ouvintes (storage = outras abas; local = esta aba) ---------------- */
  var ouvintes = [];
  function avisar(chave) { ouvintes.forEach(function (o) { if (!o.chave || o.chave === chave) try { o.cb(); } catch (e) { console.warn(e); } }); }
  w.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('ab_') === 0) avisar(e.key); });
  function ouvir(chave, cb, intervalo) {
    var o = { chave: chave, cb: cb }, ultimo = LS.getItem(chave);
    ouvintes.push(o);
    // polling leve: cobre abas no mesmo app/PWA em que o evento storage não chega
    var t = setInterval(function () { var v = LS.getItem(chave); if (v !== ultimo) { ultimo = v; cb(); } }, intervalo || 4000);
    var cbOrig = o.cb; o.cb = function () { ultimo = LS.getItem(chave); cbOrig(); };
    return function () { clearInterval(t); ouvintes = ouvintes.filter(function (x) { return x !== o; }); };
  }

  /* ---------------- regras da loja ---------------- */
  function minutos(hhmm) { var p = String(hhmm || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function statusLoja(loja, quando) {
    var d = quando ? new Date(quando) : new Date(), agora = d.getHours() * 60 + d.getMinutes();
    var a = minutos(loja.abre), f = minutos(loja.fecha), dentro;
    if (loja.modo === 'aberta') return { aberta: true, texto: 'Aberto agora' };
    if (loja.modo === 'fechada') return { aberta: false, texto: 'Fechado no momento' };
    dentro = f > a ? (agora >= a && agora < f) : (agora >= a || agora < f);   // fecha depois da meia-noite
    function hx(m) { var h = Math.floor(m / 60) % 24, mm = m % 60; return (h < 10 ? '0' : '') + h + 'h' + (mm < 10 ? '0' : '') + mm; }
    return dentro ? { aberta: true, texto: 'Aberto · Fecha às ' + hx(f) } : { aberta: false, texto: 'Fechado · Abrimos às ' + hx(a) };
  }

  /* ---------------- API ---------------- */
  var DB = {
    modo: 'demo',
    loja: function () { return P(copia(ler(K.loja, LOJA))); },
    salvarLoja: function (parcial) { var l = ler(K.loja, LOJA); for (var k in parcial) l[k] = parcial[k]; gravar(K.loja, l); avisar(K.loja); return P(copia(l)); },
    statusLoja: statusLoja,

    cardapio: function () { return P(copia(ler(K.cardapio, { categorias: CATEGORIAS, itens: ITENS }))); },
    salvarItem: function (item) {
      var c = ler(K.cardapio, { categorias: CATEGORIAS, itens: ITENS });
      if (!item.id) item.id = 'i' + Date.now().toString(36);
      var i = c.itens.findIndex(function (x) { return x.id === item.id; });
      if (i >= 0) c.itens[i] = item; else c.itens.push(item);
      gravar(K.cardapio, c); avisar(K.cardapio); return P(copia(item));
    },
    removerItem: function (id) {
      var c = ler(K.cardapio, { categorias: CATEGORIAS, itens: ITENS });
      c.itens = c.itens.filter(function (x) { return x.id !== id; }); gravar(K.cardapio, c); avisar(K.cardapio); return P();
    },
    salvarCategorias: function (lista) { var c = ler(K.cardapio, { categorias: CATEGORIAS, itens: ITENS }); c.categorias = lista; gravar(K.cardapio, c); avisar(K.cardapio); return P(copia(lista)); },
    ouvirCardapio: function (cb) { return ouvir(K.cardapio, cb, 6000); },
    ouvirLoja: function (cb) { return ouvir(K.loja, cb, 6000); },

    criarPedido: function (d) {
      var lista = ler(K.pedidos, []), seq = ler(K.seq, 1000) + 1, agora = Date.now();
      gravar(K.seq, seq);
      var p = copia(d);
      p.id = String(seq); p.numero = seq; p.criadoEm = agora; p.status = 'novo'; p.historico = [{ status: 'novo', em: agora }];
      lista.unshift(p); gravar(K.pedidos, lista); avisar(K.pedidos);
      return P(copia(p));
    },
    pedido: function (id) { var p = ler(K.pedidos, []).filter(function (x) { return x.id === String(id); })[0]; return P(p ? copia(p) : null); },
    pedidos: function (o) {
      var desde = (o && o.desde) || 0;
      return P(ler(K.pedidos, []).filter(function (p) { return p.criadoEm >= desde; }));
    },
    mudarStatus: function (id, status) {
      var lista = ler(K.pedidos, []), p = lista.filter(function (x) { return x.id === String(id); })[0];
      if (!p) return Promise.reject(new Error('Pedido não encontrado'));
      p.status = status; p.historico.push({ status: status, em: Date.now() });
      gravar(K.pedidos, lista); avisar(K.pedidos); return P(copia(p));
    },
    ouvirPedidos: function (cb) { return ouvir(K.pedidos, cb, 3000); },
    ouvirPedido: function (id, cb) {
      var ultimo = '';
      function checar() { DB.pedido(id).then(function (p) { var s = JSON.stringify(p && [p.status, p.historico.length]); if (s !== ultimo) { ultimo = s; cb(p); } }); }
      checar();
      return ouvir(K.pedidos, checar, 2500);
    },

    entrar: function (email, senha) {
      if (String(email).trim().toLowerCase() === 'demo@burguer.app' && senha === 'demo1234') {
        var u = { email: 'demo@burguer.app', nome: 'Equipe AEGO' }; gravar(K.sessao, u); return P(u);
      }
      return Promise.reject(new Error('E-mail ou senha incorretos.'));
    },
    sair: function () { LS.removeItem(K.sessao); return P(); },
    usuario: function () { return ler(K.sessao, null); },
    restaurarDemo: function () { semear(true); avisar(K.pedidos); avisar(K.cardapio); avisar(K.loja); return P(); }
  };

  /* ---------------- utilidades comuns às 3 páginas ---------------- */
  var U = {
    precoMenu: function (v) { // "R$19": sem espaço e sem ",00" (centavos pequenos só se houver)
      v = Number(v) || 0; var i = Math.floor(v), c = Math.round((v - i) * 100);
      if (c === 100) { i++; c = 0; }
      var n = String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return '<span class="pm"><span class="rs">R$</span>' + n + (c ? '<small>,' + (c < 10 ? '0' : '') + c + '</small>' : '') + '</span>';
    },
    brl: function (v) { // R$19 quando é inteiro; R$19,50 só quando tem centavos
      v = Math.round((Number(v) || 0) * 100) / 100;
      var neg = v < 0; v = Math.abs(v);
      var i = Math.floor(v), c = Math.round((v - i) * 100);
      var n = String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return (neg ? '-' : '') + 'R$' + n + (c ? ',' + (c < 10 ? '0' : '') + c : '');
    },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    rotuloStatus: function (s, tipo) {
      return { novo: 'Recebido', preparo: 'Em preparo', saiu: tipo === 'retirada' ? 'Pronto para retirada' : 'Saiu para entrega', concluido: tipo === 'retirada' ? 'Retirado' : 'Entregue', cancelado: 'Cancelado' }[s] || s;
    },
    pagamento: function (pg) {
      if (!pg) return '';
      return { pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' + (pg.trocoPara ? ' · troco p/ ' + U.brl(pg.trocoPara) : ' · sem troco') }[pg.forma] || pg.forma;
    },
    detalheItem: function (x) {
      var d = [];
      (x.extras || []).forEach(function (e) { d.push('+ ' + e.nome); });
      if (x.ponto) d.push(x.ponto);
      (x.retirar || []).forEach(function (r) { d.push('sem ' + r.toLowerCase()); });
      if (x.obs) d.push('“' + x.obs + '”');
      return d.join(' · ');
    },
    /* monograma vetorial da marca (círculo escuro, anel âmbar, "A" + hambúrguer em traço) */
    monograma: function (cls) {
      return '<svg class="mono ' + (cls || '') + '" viewBox="0 0 120 120" role="img" aria-label="AEGO Burguer">' +
        '<circle cx="60" cy="60" r="60" fill="#17120f"/>' +
        '<circle class="mono-anel" cx="60" cy="60" r="53" fill="none" stroke="#e0a43a" stroke-width="1.6"/>' +
        '<circle cx="60" cy="60" r="47" fill="none" stroke="rgba(224,164,58,.28)" stroke-width="1"/>' +
        '<path d="M38 50c2-11 11-17 22-17s20 6 22 17z" fill="none" stroke="#f4ede2" stroke-width="3.2" stroke-linejoin="round"/>' +
        '<path d="M36 59.5h48" stroke="#e0a43a" stroke-width="4.4" stroke-linecap="round"/>' +
        '<path d="M37 68c4 3.2 8 3.2 11.5 0s7.5-3.2 11.5 0 8 3.2 11.5 0 7.5-3.2 11.5 0" fill="none" stroke="#f4ede2" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M38 76h44c0 6-5 10-11 10H49c-6 0-11-4-11-10z" fill="none" stroke="#f4ede2" stroke-width="3.2" stroke-linejoin="round"/>' +
        '<circle cx="52" cy="42" r="1.4" fill="#e0a43a"/><circle cx="61" cy="39.5" r="1.4" fill="#e0a43a"/><circle cx="69" cy="43" r="1.4" fill="#e0a43a"/>' +
        '</svg>';
    },
    marcaTexto: function () { return '<span class="wm"><b>AEGO</b><i>Burguer</i></span>'; },
    tempoDesde: function (t) {
      var m = Math.max(0, Math.round((Date.now() - t) / 60000));
      if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min';
      var h = Math.floor(m / 60); return 'há ' + h + 'h' + (m % 60 ? (m % 60 < 10 ? '0' : '') + (m % 60) : '');
    },
    hora: function (t) { var d = new Date(t); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); },
    /* abertura com monograma (1x por sessão). A página marca <html class="intro"> no <head>.
       Só transform/opacity; toque/tecla pula. */
    abertura: function (chave) {
      var html = document.documentElement, el = document.getElementById('intro');
      if (!el) return;
      if (!html.classList.contains('intro') || !el.animate) { el.remove(); html.classList.remove('intro'); return; }
      try { sessionStorage.setItem(chave || 'ab_intro', '1'); } catch (e) {}
      el.innerHTML = '<div class="intro-c"><div class="intro-m">' + U.monograma() + '</div>' + U.marcaTexto() + '</div>';
      var m = el.querySelector('.intro-m'), t = el.querySelector('.wm'), anel = el.querySelector('.mono-anel'), E = 'cubic-bezier(.2,.8,.2,1)', T = 1250, an = [];
      function A(a, k) { an.push(a.animate(k, { duration: T, fill: 'both' })); }
      A(m, [{ opacity: 0, transform: 'scale(.82)', easing: E }, { opacity: 1, transform: 'scale(1)', offset: .42 }, { opacity: 1, transform: 'scale(1)' }]);
      if (anel) { anel.style.transformOrigin = '60px 60px'; A(anel, [{ transform: 'rotate(-90deg) scale(.9)', opacity: 0, easing: E }, { transform: 'rotate(0) scale(1)', opacity: 1, offset: .5 }, { transform: 'none', opacity: 1 }]); }
      A(t, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 0, transform: 'translateY(8px)', offset: .25, easing: E }, { opacity: 1, transform: 'none', offset: .55 }, { opacity: 1, transform: 'none' }]);
      A(el, [{ opacity: 1 }, { opacity: 1, offset: .74, easing: 'ease' }, { opacity: 0 }]);
      var fim = function () { an.forEach(function (a) { try { a.cancel(); } catch (e) {} }); el.remove(); html.classList.remove('intro'); };
      an[an.length - 1].onfinish = fim;
      ['pointerdown', 'keydown'].forEach(function (ev) { w.addEventListener(ev, function f() { w.removeEventListener(ev, f, true); if (document.getElementById('intro')) fim(); }, true); });
    },
    /* registra o service worker (só em http/https) */
    pwa: function () {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        w.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
      }
    }
  };

  w.AEGO_DB = DB;
  w.AEGO_U = U;
})(window);
