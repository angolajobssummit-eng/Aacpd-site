/* AACPD — portal da associação (público, área do membro, administração). */
(function () {
  "use strict";
  var SB_URL = "https://wabzbkcgrrrseeaebsmh.supabase.co";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYnpia2NncnJyc2VlYWVic21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1NTQyMTcsImV4cCI6MjExMTEzMDIxN30.5Aj_OwB8889LfkaV6pt1wxJRhnWK38V_XBLpoGli5WQ";
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var main = document.getElementById("main"), modal = document.getElementById("modal"), mBody = document.getElementById("mBody");
  var S = { user: null, perfil: null, membro: null, defs: { planos: [], pagamento: {}, site: {} } };
  var C = {}, PEND = {};

  var TIPOS = ["Criador de Conteúdo", "Influenciador Digital", "Canal / Plataforma Digital", "Empresa / Agência", "Estudante"];
  var AREAS = ["Entretenimento", "Notícias e informação", "Tecnologia", "Educação", "Desporto", "Música", "Moda e beleza", "Humor", "Negócios e empreendedorismo", "Gastronomia", "Viagens", "Religião", "Outro"];
  var PROVINCIAS = ["Bengo", "Benguela", "Bié", "Cabinda", "Cuando", "Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla", "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Moxico Leste", "Namibe", "Uíge", "Zaire", "Diáspora"];
  var REDES = ["YouTube", "Instagram", "TikTok", "Facebook", "X / Twitter", "Kwai", "LinkedIn", "Site / Blog", "Podcast", "Outra"];
  var CATS = ["Notícia", "Nota de imprensa", "Comunicado", "Evento"];

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function kz(v) { return new Intl.NumberFormat("pt-PT").format(v || 0) + " Kz"; }
  var fData = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  var fCurta = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
  function data(s) { return s ? fData.format(new Date(s)) : ""; }
  function curta(s) { return s ? fCurta.format(new Date(s)) : ""; }
  function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "artigo"; }
  function qsParse(s) { var o = {}; (s || "").split("&").forEach(function (kv) { if (!kv) return; var p = kv.split("="); o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); }); return o; }
  function toast(t, mau) { var el = document.createElement("div"); el.className = "toast" + (mau ? " toast--mau" : ""); el.setAttribute("role", "status"); el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, mau ? 4500 : 2600); }
  function ok(r) { if (r.error) throw traduz(r.error); return r.data; }
  function traduz(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    var T = { "Invalid login credentials": "Email ou palavra-passe incorrectos.", "User already registered": "Já existe uma conta com este email. Use «Entrar».", "Email not confirmed": "Ainda não confirmou o email. Veja a caixa de entrada e o spam.", "Password should be at least 6 characters": "A palavra-passe deve ter pelo menos 6 caracteres.", "duplicate key": "Já existe um registo igual.", "row-level security": "Sem permissão para esta acção.", "Failed to fetch": "Sem ligação à internet. Tente de novo." };
    for (var k in T) if (m.indexOf(k) >= 0) return new Error(T[k]);
    if (/rate limit/i.test(m)) return new Error("Demasiadas tentativas. Aguarde um minuto.");
    return new Error(m);
  }
  function iniciais(n) { var p = String(n || "?").trim().split(/\s+/); return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase(); }
  function carregando() { return '<div class="loading"><span></span>A carregar…</div>'; }
  function falhou(v) { return v && v.erro ? '<div class="empty">' + esc(v.erro) + "</div>" : ""; }
  function isAdmin() { return !!(S.perfil && S.perfil.papel === "admin"); }
  function emDia(m) { return !!(m && m.estado === "activo" && m.quota_ate && new Date(m.quota_ate + "T23:59:59") >= new Date()); }
  function plano(id) { return S.defs.planos.filter(function (p) { return p.id === id; })[0] || null; }
  function pubUrl(path) { if (!path) return ""; if (/^(https?:|img\/)/.test(path)) return path; return sb.storage.from("publico").getPublicUrl(path).data.publicUrl; }
  function wa(num, msg) { return "https://wa.me/" + String(num || "").replace(/\D/g, "") + (msg ? "?text=" + encodeURIComponent(msg) : ""); }
  function csv(linhas, nome) {
    var t = linhas.map(function (l) { return l.map(function (c) { c = String(c == null ? "" : c); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + t], { type: "text/csv;charset=utf-8" })); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  }

  function need(key, fn) {
    if (Object.prototype.hasOwnProperty.call(C, key)) return C[key];
    if (!PEND[key]) { PEND[key] = 1; var rota = location.hash; fn().then(function (v) { C[key] = v; }, function (e) { C[key] = { erro: traduz(e).message }; }).then(function () { delete PEND[key]; if (location.hash === rota && modal.hidden) render(); }); }
    return undefined;
  }
  function limpar(p) { Object.keys(C).forEach(function (k) { if (!p || k.indexOf(p) === 0) delete C[k]; }); }
  async function acao(fn, msg, prefs) {
    document.body.classList.add("busy");
    try { var r = await fn(); (prefs || []).forEach(limpar); if (msg) toast(msg); await carregarConta(); render(); return r; }
    catch (e) { toast(traduz(e).message, true); throw e; }
    finally { document.body.classList.remove("busy"); }
  }

  /* ---------- dados base ---------- */
  async function carregarDefs() {
    var r = await sb.from("definicoes").select("chave,valor");
    (r.data || []).forEach(function (d) { S.defs[d.chave] = d.valor; });
    if (!Array.isArray(S.defs.planos)) S.defs.planos = [];
  }
  async function carregarConta() {
    var s = (await sb.auth.getSession()).data.session;
    S.user = s ? s.user : null; S.perfil = null; S.membro = null;
    if (!S.user) return;
    var r = await Promise.all([sb.from("perfis").select("*").eq("id", S.user.id).maybeSingle(), sb.from("membros").select("*").eq("perfil_id", S.user.id).maybeSingle()]);
    S.perfil = r[0].data; S.membro = r[1].data;
    var meta = S.user.user_metadata || {};
    if (!S.membro && meta.adesao && !meta.adesao_criada) {
      try {
        var ins = await sb.from("membros").insert(meta.adesao).select().single();
        if (!ins.error) { S.membro = ins.data; await sb.auth.updateUser({ data: { adesao_criada: true } }); toast("Pedido de adesão enviado à associação."); }
      } catch (x) {}
    }
  }

  /* ---------- cabeçalho e rodapé ---------- */
  function desenharTopo() {
    var n = document.getElementById("navConta");
    if (S.user) n.innerHTML = (isAdmin() ? '<a href="#/admin" data-nav="admin">Administração</a>' : "") + '<a href="#/conta" data-nav="conta">A minha área</a><a href="#" data-act="sair">Sair</a>';
    else n.innerHTML = '<a href="#" data-act="entrar">Entrar</a><a class="btn" href="#/adesao">Aderir</a>';
    var site = S.defs.site || {};
    document.getElementById("fMissao").textContent = site.missao || "";
    document.getElementById("fAno").textContent = new Date().getFullYear();
    document.getElementById("fContactos").innerHTML = [site.email ? '<a href="mailto:' + esc(site.email) + '">' + esc(site.email) + "</a>" : "", site.telefone ? '<a href="tel:' + esc(site.telefone) + '">' + esc(site.telefone) + "</a>" : "",
      site.morada ? "<span>" + esc(site.morada) + "</span>" : "", site.site ? '<a href="' + esc(site.site) + '" target="_blank" rel="noopener">' + esc(site.site.replace(/^https?:\/\//, "")) + "</a>" : "",
      site.facebook ? '<a href="' + esc(site.facebook) + '" target="_blank" rel="noopener">Facebook</a>' : "", site.instagram ? '<a href="' + esc(site.instagram) + '" target="_blank" rel="noopener">Instagram</a>' : "", site.x ? '<a href="' + esc(site.x) + '" target="_blank" rel="noopener">X</a>' : ""].join("");
  }

  /* ---------- componentes ---------- */
  function cardNoticia(n) {
    return '<a class="ncard" href="#/noticias/' + esc(n.slug) + '"><div class="ncard__img">' + (n.imagem ? '<img src="' + esc(pubUrl(n.imagem)) + '" alt="" loading="lazy">' : '<div class="ph">AACPD</div>') + '</div><div class="ncard__body"><div class="ncard__meta"><span class="badge badge--red">' + esc(n.categoria) + "</span>" + esc(data(n.publicado_em)) + "</div><h3>" + esc(n.titulo) + '</h3><p class="small" style="margin:0">' + esc(n.resumo) + "</p></div></a>";
  }
  function cardMembroDir(m) {
    var pl = Array.isArray(m.plataformas) ? m.plataformas : [];
    return '<div class="card dcard"><div class="av">' + esc(iniciais(m.nome)) + '</div><div><b style="color:var(--ink)">' + esc(m.nome) + '</b><div class="small">' + esc([m.tipo, m.area, m.provincia].filter(Boolean).join(" · ")) + "</div>" +
      (m.bio ? '<p class="small" style="margin:6px 0 0">' + esc(m.bio) + "</p>" : "") + '<div class="plats">' + pl.filter(function (p) { return p.link; }).map(function (p) { return '<a href="' + esc(/^https?:/.test(p.link) ? p.link : "https://" + p.link) + '" target="_blank" rel="noopener nofollow">' + esc(p.rede) + (p.seguidores ? " · " + esc(p.seguidores) : "") + "</a>"; }).join("") + "</div></div></div>";
  }
  function cartaoMembro(m) {
    var url = location.origin + location.pathname + "#/verificar/" + (m.numero || "");
    return '<div class="cartao" role="img" aria-label="Cartão de membro AACPD de ' + esc(m.nome) + '"><div class="cartao__top"><b>AACPD</b><span>Associação Angolana dos<br>Canais e Plataformas Digitais</span></div>' +
      '<div class="cartao__mid"><div><div class="cartao__nome">' + esc(m.nome) + '</div><div class="cartao__tipo">' + esc(m.tipo) + "</div></div>" + (m.numero ? '<div class="qr" data-qr="' + esc(url) + '"></div>' : "") + "</div>" +
      '<div class="cartao__foot"><span>Nº <b>' + esc(m.numero || "—") + "</b></span><span>Válido até " + esc(m.quota_ate ? curta(m.quota_ate) : "—") + "</span></div></div>";
  }
  function desenharQRs(root) { root.querySelectorAll("[data-qr]").forEach(function (el) { try { var q = window.qrcode(0, "M"); q.addData(el.dataset.qr); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); } catch (x) {} }); }
  function precoPlano(p) { return '<span class="preco">' + (p.valor ? esc(kz(p.valor)) : "Gratuito") + ' <small>/ ' + (p.periodo === "mensal" ? "mês" : "ano") + "</small></span>"; }

  /* ---------- páginas públicas ---------- */
  function pgInicio() {
    var N = need("pub:noticias", function () { return sb.from("noticias").select("*").eq("publicado", true).order("destaque", { ascending: false }).order("publicado_em", { ascending: false }).limit(4).then(ok); });
    var Dd = need("pub:direccao", function () { return sb.from("direccao").select("*").order("ordem").then(ok); });
    var Nums = need("pub:nums", function () {
      return Promise.all([sb.from("v_directorio").select("numero", { count: "exact", head: true }), sb.from("noticias").select("id", { count: "exact", head: true }).eq("publicado", true), sb.from("v_beneficios").select("id", { count: "exact", head: true })])
        .then(function (r) { return { membros: r[0].count || 0, noticias: r[1].count || 0, beneficios: r[2].count || 0 }; });
    });
    var site = S.defs.site || {}, D = Array.isArray(Dd) ? Dd : [], nums = Nums && !Nums.erro ? Nums : { membros: 0, noticias: 0, beneficios: 0 };
    var redes = ["YouTube", "TikTok", "Instagram", "Facebook", "X", "Kwai", "LinkedIn", "Podcasts", "Blogs", "Portais", "Twitch", "WhatsApp Channels"];
    var noticias = Array.isArray(N) ? N : [];
    main.innerHTML =
      '<section class="hx"><div class="hx__dots" aria-hidden="true"></div><div class="wrap hx__in"><div class="hx__txt">' +
        '<div class="kicker kicker--light"><span class="dots"><i></i><i></i><i></i></span>Associação Angolana dos Canais e Plataformas Digitais</div>' +
        '<h1>A casa dos <span class="rot" aria-live="off"><span>criadores de conteúdo</span><span>canais digitais</span><span>influenciadores</span><span>podcasters</span><span>plataformas digitais</span></span><br>de Angola.</h1>' +
        '<p class="hx__lead">' + esc(site.missao || "") + "</p>" +
        '<div class="btns"><a class="btn btn--glow" href="#/adesao">Tornar-me membro</a><a class="btn btn--ghost" href="#/beneficios">Ver benefícios</a></div>' +
        '<div class="hx__trust"><span class="stack">' + D.slice(0, 4).map(function (d) { return '<img src="' + esc(pubUrl(d.foto)) + '" alt="">'; }).join("") + '</span><span>Uma direcção de profissionais do digital angolano</span></div>' +
      '</div><div class="hx__mosaic" aria-hidden="true">' + D.slice(0, 5).map(function (d, i) { return '<figure class="tile tile--' + i + '"><img src="' + esc(pubUrl(d.foto)) + '" alt=""><figcaption>' + esc(d.nome) + "</figcaption></figure>"; }).join("") + "</div></div>" +
      '<div class="marquee" aria-hidden="true"><div class="marquee__in">' + redes.concat(redes).map(function (r) { return "<span>" + esc(r) + "</span>"; }).join("") + "</div></div></section>" +
      (function () {
        var cs = [[nums.membros, "membros no directório"], [PROVINCIAS.length, "províncias e diáspora"], [nums.beneficios, "benefícios para membros"], [nums.noticias, "notícias e comunicados"], [TIPOS.length, "tipos de membro"]].filter(function (c) { return c[0] > 0; }).slice(0, 4);
        return '<section class="sec"><div class="wrap"><div class="counters reveal" style="grid-template-columns:repeat(' + cs.length + ',1fr)">' + cs.map(function (c) { return '<div class="counter"><b data-count="' + c[0] + '">0</b><span>' + c[1] + "</span></div>"; }).join("") + "</div></div></section>";
      })() +
      '<section class="sec sec--soft"><div class="wrap"><div class="head reveal"><div class="kicker">Porquê aderir</div><h2>Mais força para quem cria no digital</h2></div><div class="grid4">' +
        [["🎙️", "Representação", "Uma voz forte junto de instituições, marcas e parceiros."], ["🎁", "Benefícios exclusivos", "Descontos e vantagens de parceiros para membros com quota em dia."], ["🪪", "Cartão digital com QR", "Identificação verificável, reconhecida pelos parceiros."], ["🚀", "Rede e visibilidade", "Directório público, formação, eventos e projectos."]]
          .map(function (x, i) { return '<div class="card feat reveal" style="--d:' + i * 90 + 'ms"><span class="feat__ic">' + x[0] + "</span><h3>" + x[1] + '</h3><p class="small" style="margin:0">' + x[2] + "</p></div>"; }).join("") +
      "</div></div></section>" +
      (noticias.length ? '<section class="sec"><div class="wrap"><div class="sec__head reveal"><div><div class="kicker">Notícias e imprensa</div><h2>Últimas da AACPD</h2></div><a class="btn btn--line btn--sm" href="#/noticias">Todas as notícias</a></div><div class="news reveal">' +
        '<a class="news__main" href="#/noticias/' + esc(noticias[0].slug) + '"><div class="news__img">' + (noticias[0].imagem ? '<img src="' + esc(pubUrl(noticias[0].imagem)) + '" alt="">' : '<div class="ph">AACPD</div>') + '</div><div class="news__body"><span class="badge badge--red">' + esc(noticias[0].categoria) + "</span><h3>" + esc(noticias[0].titulo) + "</h3><p>" + esc(noticias[0].resumo) + '</p><span class="small">' + esc(data(noticias[0].publicado_em)) + "</span></div></a>" +
        '<div class="news__side">' + (noticias.length > 1 ? noticias.slice(1).map(function (n) { return '<a class="news__item" href="#/noticias/' + esc(n.slug) + '"><span class="badge badge--red">' + esc(n.categoria) + "</span><b>" + esc(n.titulo) + '</b><span class="small">' + esc(data(n.publicado_em)) + "</span></a>"; }).join("") : '<div class="news__item"><b>Mais notícias em breve</b><span class="small">Acompanhe também @assodigital nas redes sociais.</span></div>') + "</div></div></div></section>" : "") +
      (S.defs.planos.length ? '<section class="sec sec--soft"><div class="wrap"><div class="sec__head reveal"><div><div class="kicker">Quotas</div><h2>Planos de adesão</h2></div></div><div class="grid4">' +
        S.defs.planos.map(function (p, i) { return '<div class="card plan reveal' + (i === 1 ? " plan--top" : "") + '" style="--d:' + i * 90 + 'ms">' + (i === 1 ? '<span class="badge badge--red" style="align-self:flex-start">Mais escolhido</span>' : "") + "<h3>" + esc(p.nome) + '</h3><p class="small">' + esc(p.descricao || "") + "</p>" + precoPlano(p) + '<a class="btn btn--sm" href="#/adesao?plano=' + esc(p.id) + '" style="margin-top:12px">Escolher</a></div>'; }).join("") + "</div></div></section>" : "") +
      '<section class="sec"><div class="wrap"><div class="sec__head reveal"><div><div class="kicker">Órgãos sociais</div><h2>Direcção</h2></div><a class="btn btn--line btn--sm" href="#/sobre">Sobre a AACPD</a></div>' +
        (Dd === undefined ? carregando() : falhou(Dd) || '<div class="team">' + D.map(function (d, i) { return pessoa(d).replace('<figure class="member"', '<figure class="member reveal" style="--d:' + i * 80 + 'ms"'); }).join("") + "</div>") + "</div></section>" +
      '<section class="cta"><div class="wrap cta__in reveal"><div><h2>Faça parte da AACPD</h2><p>Adesão online em 3 minutos. Cartão de membro digital no telemóvel.</p></div><a class="btn btn--white" href="#/adesao">Aderir agora</a></div></section>';
    animar();
  }
  function animar() {
    var reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var els = main.querySelectorAll(".reveal");
    if (reduz || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); main.querySelectorAll("[data-count]").forEach(function (e) { e.textContent = e.dataset.count; }); return; }
    var io = new IntersectionObserver(function (ent) { ent.forEach(function (x) { if (!x.isIntersecting) return; x.target.classList.add("in"); io.unobserve(x.target);
      x.target.querySelectorAll("[data-count]").forEach(function (c) { var alvo = Number(c.dataset.count) || 0, t0 = performance.now(); (function passo(t) { var k = Math.min(1, (t - t0) / 1200); c.textContent = Math.round(alvo * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(passo); })(t0); }); }); }, { threshold: .15 });
    els.forEach(function (e) { io.observe(e); });
  }
  function pessoa(d) { return '<figure class="member"><img src="' + esc(pubUrl(d.foto) || "img/logo-aacpd.jpg") + '" alt="' + esc(d.nome) + '" loading="lazy"><figcaption><b>' + esc(d.nome) + "</b><span>" + esc(d.cargo) + "</span></figcaption></figure>"; }

  function pgSobre() {
    var Dd = need("pub:direccao", function () { return sb.from("direccao").select("*").order("ordem").then(ok); });
    var site = S.defs.site || {};
    main.innerHTML = '<div class="wrap page-head"><div class="kicker">Sobre</div><h1>Sobre a AACPD</h1></div>' +
      '<section class="sec" style="padding-top:10px"><div class="wrap grid3">' +
        '<div class="card"><h3>Missão</h3><p style="margin:0">' + esc(site.missao || "") + '</p></div><div class="card"><h3>Visão</h3><p style="margin:0">' + esc(site.visao || "") + '</p></div><div class="card"><h3>Valores</h3><p style="margin:0">' + esc(site.valores || "") + "</p></div></div></section>" +
      '<section class="sec sec--soft"><div class="wrap"><div class="head"><div class="kicker">Órgãos sociais</div><h2>Direcção</h2></div>' + (Dd === undefined ? carregando() : falhou(Dd) || '<div class="team">' + Dd.map(pessoa).join("") + "</div>") + "</div></section>";
  }

  function pgNoticias(q) {
    var N = need("pub:todas", function () { return sb.from("noticias").select("*").eq("publicado", true).order("publicado_em", { ascending: false }).limit(200).then(ok); });
    var L = Array.isArray(N) ? N.filter(function (n) { return !q.cat || n.categoria === q.cat; }) : [];
    main.innerHTML = '<div class="wrap page-head"><div class="kicker">Imprensa</div><h1>Notícias e notas de imprensa</h1></div><div class="wrap" style="padding-bottom:60px">' +
      '<div class="chips"><a class="chip' + (!q.cat ? " on" : "") + '" href="#/noticias">Todas</a>' + CATS.map(function (c) { return '<a class="chip' + (q.cat === c ? " on" : "") + '" href="#/noticias?cat=' + encodeURIComponent(c) + '">' + esc(c) + "</a>"; }).join("") + "</div>" +
      (N === undefined ? carregando() : falhou(N) || (L.length ? '<div class="grid3">' + L.map(cardNoticia).join("") + "</div>" : '<div class="empty">Sem publicações nesta categoria.</div>')) + "</div>";
  }
  function pgArtigo(s) {
    var A = need("pub:art:" + s, function () { return sb.from("noticias").select("*").eq("slug", s).maybeSingle().then(ok); });
    if (A === undefined) { main.innerHTML = '<div class="wrap page-head">' + carregando() + "</div>"; return; }
    if (!A || A.erro) return pgNada();
    var url = location.href;
    main.innerHTML = '<article class="wrap page-head artigo" style="padding-bottom:60px"><p class="small"><a class="linkbtn" href="#/noticias">← Notícias</a></p><div class="ncard__meta" style="margin-bottom:10px"><span class="badge badge--red">' + esc(A.categoria) + "</span>" + esc(data(A.publicado_em)) + "</div>" +
      "<h1>" + esc(A.titulo) + '</h1><p class="lead muted" style="font-size:1.15rem">' + esc(A.resumo) + "</p>" + (A.imagem ? '<div class="artigo__img"><img src="' + esc(pubUrl(A.imagem)) + '" alt=""></div>' : "") +
      '<div class="corpo">' + esc(A.corpo) + "</div>" +
      '<div class="btns" style="margin-top:28px"><a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(A.titulo + " — " + url) + '">Partilhar no WhatsApp</a><a class="btn btn--line btn--sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">Facebook</a><a class="btn btn--line btn--sm" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(A.titulo) + "&url=" + encodeURIComponent(url) + '">X</a></div></article>';
  }

  function pgBeneficios() {
    var B = need("pub:benef", function () { return sb.from("v_beneficios").select("*").order("ordem").then(ok); });
    var dia = emDia(S.membro);
    main.innerHTML = '<div class="wrap page-head"><div class="kicker">Membros</div><h1>Benefícios para membros</h1><p class="muted" style="max-width:640px">Vantagens e descontos de parceiros, exclusivos para membros com a quota em dia. Os parceiros validam o cartão de membro em <a class="linkbtn" href="#/verificar">Verificar cartão</a>.</p>' +
      (dia ? '<p><a class="btn" href="#/conta?tab=beneficios">Ver os meus códigos</a></p>' : '<p><a class="btn" href="#/adesao">Aderir para ter acesso</a></p>') + "</div>" +
      '<div class="wrap" style="padding-bottom:60px">' + (B === undefined ? carregando() : falhou(B) || (B.length ? '<div class="grid3">' + B.map(function (b) {
        return '<div class="card bcard">' + (b.imagem ? '<img src="' + esc(pubUrl(b.imagem)) + '" alt="" style="border-radius:10px;aspect-ratio:16/9;object-fit:cover">' : "") + (b.desconto ? '<span class="desc">' + esc(b.desconto) + "</span>" : "") + "<h3 style=\"margin:0\">" + esc(b.titulo) + '</h3><div class="small">' + esc(b.parceiro) + "</div><p class=\"small\" style=\"margin:0\">" + esc(b.descricao) + "</p>" + (dia ? '<a class="linkbtn" href="#/conta?tab=beneficios">Ver código</a>' : '<div class="lock">🔒 Disponível para membros com quota em dia</div>') + "</div>";
      }).join("") + "</div>" : '<div class="empty">Os primeiros benefícios estão a ser negociados com parceiros. Em breve.</div>')) + "</div>";
  }

  function pgMembros(q) {
    var M = need("pub:dir", function () { return sb.from("v_directorio").select("*").order("nome").limit(1000).then(ok); });
    var f = (q.q || "").toLowerCase();
    var L = Array.isArray(M) ? M.filter(function (m) { return (!q.tipo || m.tipo === q.tipo) && (!q.prov || m.provincia === q.prov) && (!f || (m.nome + " " + m.area + " " + m.bio).toLowerCase().indexOf(f) >= 0); }) : [];
    main.innerHTML = '<div class="wrap page-head"><div class="kicker">Comunidade</div><h1>Directório de membros</h1><p class="muted">Criadores, canais e plataformas digitais membros da AACPD.</p></div><div class="wrap" style="padding-bottom:60px">' +
      '<form class="filters" id="fDir"><input type="search" name="q" placeholder="Procurar por nome ou tema" value="' + esc(q.q || "") + '" aria-label="Procurar"><select name="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>' + TIPOS.map(function (t) { return "<option" + (q.tipo === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + '</select><select name="prov" aria-label="Província"><option value="">Todas as províncias</option>' + PROVINCIAS.map(function (t) { return "<option" + (q.prov === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + '</select><button class="btn btn--sm" type="submit">Filtrar</button></form>' +
      (M === undefined ? carregando() : falhou(M) || (L.length ? '<p class="small">' + L.length + ' membros</p><div class="dir">' + L.map(cardMembroDir).join("") + "</div>" : '<div class="empty">Ainda sem membros com estes filtros.</div>')) + "</div>";
    document.getElementById("fDir").addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(this); location.hash = "#/membros?" + ["q", "tipo", "prov"].map(function (k) { return k + "=" + encodeURIComponent(d.get(k) || ""); }).join("&"); });
  }

  function pgVerificar(num) {
    main.innerHTML = '<div class="wrap--n page-head" style="padding-bottom:60px"><div class="kicker">Parceiros</div><h1>Verificar cartão de membro</h1><p class="muted">Introduza o número do cartão (por exemplo AACPD-0001) ou leia o código QR.</p>' +
      '<form class="filters" id="fVer"><input name="n" type="search" required placeholder="AACPD-0001" value="' + esc(num || "") + '" aria-label="Número do cartão" style="text-transform:uppercase"><button class="btn btn--sm" type="submit">Verificar</button></form><div id="vRes"></div></div>';
    document.getElementById("fVer").addEventListener("submit", function (e) { e.preventDefault(); location.hash = "#/verificar/" + encodeURIComponent(new FormData(this).get("n").trim().toUpperCase()); });
    if (num) sb.rpc("verificar_membro", { p_numero: num }).then(function (r) {
      var v = r.data || {}, el = document.getElementById("vRes"); if (!el) return;
      el.innerHTML = !v.ok ? '<div class="status status--red"><div><b>Cartão não encontrado</b>Confirme o número.</div></div>'
        : v.em_dia ? '<div class="status status--ok"><div><b>✓ Membro válido — quota em dia</b>' + esc(v.nome) + " · " + esc(v.tipo) + " · Nº " + esc(v.numero) + " · válido até " + esc(curta(v.quota_ate)) + "</div></div>"
        : '<div class="status status--warn"><div><b>Membro sem quota em dia</b>' + esc(v.nome) + " · Nº " + esc(v.numero) + " · estado: " + esc(v.estado) + "</div></div>";
    });
  }

  function pgContacto() {
    var site = S.defs.site || {};
    main.innerHTML = '<div class="wrap page-head"><div class="kicker">Contacto</div><h1>Fale connosco</h1><p class="muted">Parcerias, imprensa, adesão ou outras questões.</p></div><div class="wrap split" style="padding-bottom:60px"><div class="card">' +
      (site.email ? '<p><b>Email</b><br><a class="linkbtn" href="mailto:' + esc(site.email) + '">' + esc(site.email) + "</a></p>" : "") + (site.telefone ? '<p><b>Telefone / WhatsApp</b><br><a class="linkbtn" href="' + esc(wa(site.telefone)) + '" target="_blank" rel="noopener">' + esc(site.telefone) + "</a></p>" : "") +
      (site.morada ? "<p><b>Morada</b><br>" + esc(site.morada) + "</p>" : "") + "<p><b>Redes sociais</b><br>@assodigital</p></div>" +
      '<form class="form card" id="fCont"><div class="two"><label>Nome<input name="nome" required minlength="2" maxlength="120" autocomplete="name"></label><label>Email<input name="email" type="email" required maxlength="160" autocomplete="email"></label></div><div class="two"><label>Telefone / WhatsApp<input name="telefone" maxlength="40" autocomplete="tel"></label><label>Assunto<select name="assunto"><option>Adesão</option><option>Parceria / patrocínio</option><option>Imprensa</option><option>Benefícios</option><option>Outro</option></select></label></div><label>Mensagem<textarea name="mensagem" required minlength="5" maxlength="3000"></textarea></label><label class="hp" aria-hidden="true">Não preencher<input name="site" tabindex="-1" autocomplete="off"></label><div><button class="btn" type="submit">Enviar mensagem</button></div><div id="cMsg" aria-live="polite"></div></form></div>';
    document.getElementById("fCont").addEventListener("submit", async function (e) {
      e.preventDefault(); var d = new FormData(this), f = this, v = function (k) { return String(d.get(k) || "").trim(); }, out = document.getElementById("cMsg");
      if (v("site")) return; var b = f.querySelector("button"); b.disabled = true;
      var r = await sb.from("mensagens").insert({ nome: v("nome"), email: v("email"), telefone: v("telefone"), assunto: v("assunto"), mensagem: v("mensagem") });
      b.disabled = false;
      out.innerHTML = r.error ? '<div class="msg msg--mau">Não foi possível enviar. Verifique os campos e tente de novo.</div>' : '<div class="msg msg--ok">Mensagem enviada. Obrigado! Responderemos em breve.</div>';
      if (!r.error) f.reset();
    });
  }

  /* ---------- adesão ---------- */
  function camposAdesao(m, q) {
    m = m || {}; var pl = Array.isArray(m.plataformas) && m.plataformas.length ? m.plataformas : [{ rede: "Instagram", link: "", seguidores: "" }];
    var escolhido = m.plano || q.plano || (S.defs.planos[1] || S.defs.planos[0] || {}).id;
    return '<fieldset class="fs"><legend>Membro</legend><div class="two"><label>Nome (pessoa ou entidade)<input name="m_nome" required maxlength="120" value="' + esc(m.nome || (S.perfil && S.perfil.nome) || "") + '"></label><label>Tipo de membro<select name="tipo" required>' + TIPOS.map(function (t) { return "<option" + (m.tipo === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="three"><label>Área / tema principal<select name="area">' + AREAS.map(function (t) { return "<option" + (m.area === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + '</select></label><label>Província<select name="provincia">' + PROVINCIAS.map(function (t) { return "<option" + ((m.provincia || "Luanda") === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + '</select></label><label>BI ou NIF<input name="documento" maxlength="40" value="' + esc(m.documento || "") + '"></label></div>' +
      '<label>Apresentação curta<textarea name="bio" maxlength="400" placeholder="O que cria, para quem, em que plataformas">' + esc(m.bio || "") + "</textarea></label></fieldset>" +
      '<fieldset class="fs"><legend>Canais e plataformas</legend><div id="platRows">' + pl.map(linhaPlat).join("") + '</div><div><button class="btn btn--line btn--sm" type="button" data-act="plat-add">+ Adicionar plataforma</button></div></fieldset>' +
      (!m.id || m.estado === "pendente" ? '<fieldset class="fs"><legend>Plano de quota</legend><div class="planpick">' + S.defs.planos.map(function (p) { return '<label><input type="radio" name="plano" value="' + esc(p.id) + '"' + (p.id === escolhido ? " checked" : "") + ' required><span><b>' + esc(p.nome) + '</b><br><span class="small">' + esc(p.descricao || "") + "</span></span>" + precoPlano(p) + "</label>"; }).join("") + "</div></fieldset>" : "") +
      '<label class="check"><input type="checkbox" name="publico"' + (m.publico === false ? "" : " checked") + "> Aparecer no directório público de membros</label>";
  }
  function linhaPlat(p) { p = p || {}; return '<div class="platrow"><label>Rede<select name="p_rede">' + REDES.map(function (r) { return "<option" + (p.rede === r ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("") + '</select></label><label>Link ou @<input name="p_link" maxlength="200" value="' + esc(p.link || "") + '" placeholder="instagram.com/..."></label><label>Seguidores<input name="p_seg" maxlength="20" value="' + esc(p.seguidores || "") + '" placeholder="Ex.: 25 mil"></label><button class="btn btn--line btn--sm" type="button" data-act="plat-del" aria-label="Remover">×</button></div>'; }
  function lerAdesao(d) {
    var r = d.getAll("p_rede"), l = d.getAll("p_link"), s = d.getAll("p_seg"), pl = [];
    l.forEach(function (x, i) { x = String(x).trim(); if (x) pl.push({ rede: r[i], link: x, seguidores: String(s[i] || "").trim() }); });
    var o = { nome: String(d.get("m_nome") || "").trim(), tipo: d.get("tipo"), area: d.get("area"), provincia: d.get("provincia"), documento: String(d.get("documento") || "").trim(), bio: String(d.get("bio") || "").trim(), plataformas: pl, publico: !!d.get("publico") };
    if (d.get("plano")) o.plano = d.get("plano");
    return o;
  }
  function pgAdesao(q) {
    if (S.membro) { location.hash = "#/conta"; return; }
    var conta = S.user ? '<p class="note">Sessão iniciada como <b>' + esc(S.user.email) + "</b>.</p>"
      : '<fieldset class="fs"><legend>Conta</legend><div class="two"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Telefone / WhatsApp<input name="telefone" type="tel" required autocomplete="tel" placeholder="+244 9xx xxx xxx"></label></div><label>Palavra-passe<input name="pw" type="password" minlength="6" required autocomplete="new-password"><span class="hint">Mínimo 6 caracteres. Já tem conta? <button class="linkbtn" type="button" data-act="entrar">Entrar</button></span></label></fieldset>';
    main.innerHTML = '<div class="wrap--n page-head" style="padding-bottom:60px"><div class="kicker">Adesão</div><h1>Pedido de adesão</h1><p class="muted">Preencha o formulário. A direcção analisa o pedido e, depois da aprovação e do pagamento da quota, recebe o número e o cartão de membro digital.</p>' +
      '<form class="form" id="fAdesao">' + conta + camposAdesao(null, q) + '<label class="check"><input type="checkbox" required> Declaro que os dados são verdadeiros e aceito os estatutos e o regulamento da AACPD.</label><div><button class="btn" type="submit">Enviar pedido de adesão</button></div><div id="aMsg" aria-live="polite"></div></form></div>';
    document.getElementById("fAdesao").addEventListener("submit", async function (e) {
      e.preventDefault(); var f = this, d = new FormData(f), out = document.getElementById("aMsg"), b = f.querySelector("[type=submit]");
      var ad = lerAdesao(d); if (!ad.plano) { out.innerHTML = '<div class="msg msg--mau">Escolha um plano de quota.</div>'; return; }
      b.disabled = true;
      try {
        if (S.user) {
          ad.telefone = (S.perfil && S.perfil.telefone) || ""; ok(await sb.from("membros").insert(ad));
          await carregarConta(); desenharTopo(); toast("Pedido de adesão enviado."); location.hash = "#/conta";
        } else {
          ad.telefone = String(d.get("telefone") || "").trim();
          var r = await sb.auth.signUp({ email: String(d.get("email")).trim(), password: d.get("pw"), options: { data: { nome: ad.nome, telefone: ad.telefone, adesao: ad }, emailRedirectTo: location.origin + location.pathname + "#/conta" } });
          var dd = ok(r);
          if (dd.session) { await carregarConta(); desenharTopo(); location.hash = "#/conta"; }
          else out.innerHTML = '<div class="msg msg--ok"><b>Quase lá!</b> Enviámos um email para <b>' + esc(d.get("email")) + "</b>. Abra o link para confirmar a conta. O pedido de adesão fica registado no primeiro acesso.</div>";
        }
      } catch (x) { out.innerHTML = '<div class="msg msg--mau">' + esc(traduz(x).message) + "</div>"; }
      finally { b.disabled = false; }
    });
  }

  /* ---------- área do membro ---------- */
  function pgConta(q) {
    if (!S.user) { main.innerHTML = '<div class="wrap--n page-head" style="padding-bottom:60px"><h1>Área do membro</h1><p class="muted">Entre para ver o seu cartão, as quotas e os benefícios.</p><div class="btns"><button class="btn" type="button" data-act="entrar">Entrar</button><a class="btn btn--line" href="#/adesao">Aderir</a></div></div>'; return; }
    var m = S.membro, tab = q.tab || "inicio";
    if (!m) { main.innerHTML = '<div class="wrap--n page-head" style="padding-bottom:60px"><h1>Olá, ' + esc((S.perfil && S.perfil.nome) || "") + '</h1><p class="muted">Ainda não fez o pedido de adesão.</p><a class="btn" href="#/adesao">Fazer pedido de adesão</a></div>'; return; }
    var corpo = "";
    var estadoBox = m.estado === "pendente" ? '<div class="status status--warn"><div><b>Pedido em análise</b>A direcção vai analisar o seu pedido. Pode já pagar a quota para acelerar a activação.</div></div>'
      : m.estado === "rejeitado" ? '<div class="status status--red"><div><b>Pedido não aprovado</b>' + esc(m.nota_admin || "Contacte a associação para mais informações.") + "</div></div>"
      : m.estado === "suspenso" ? '<div class="status status--red"><div><b>Inscrição suspensa</b>' + esc(m.nota_admin || "Contacte a associação.") + "</div></div>"
      : emDia(m) ? '<div class="status status--ok"><div><b>Membro activo · quota em dia</b>Nº ' + esc(m.numero) + " · válida até " + esc(curta(m.quota_ate)) + "</div></div>"
      : '<div class="status status--warn"><div><b>Membro activo · quota por pagar</b>Pague a quota para manter o cartão e os benefícios activos.</div></div>';
    if (tab === "quotas") {
      var Q = need("conta:quotas", function () { return sb.from("quotas").select("*").eq("membro_id", m.id).order("criado_em", { ascending: false }).then(ok); });
      var pend = Array.isArray(Q) ? Q.filter(function (x) { return x.estado === "pendente"; })[0] : null;
      corpo = (pend ? blocoPagar(pend) : (m.estado === "rejeitado" || m.estado === "suspenso" ? "" : '<div class="box"><h3>Pagar quota</h3><p class="small">' + esc((plano(m.plano) || {}).nome || m.plano) + " · " + esc(kz((plano(m.plano) || {}).valor)) + '</p><button class="btn" type="button" data-act="pedir-quota">Gerar pagamento da quota</button></div>')) +
        '<h2 style="margin-top:26px;font-size:1.3rem">Histórico</h2>' + (Q === undefined ? carregando() : falhou(Q) || (Q.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th>Data</th><th>Referência</th><th>Descrição</th><th>Valor</th><th>Estado</th></tr></thead><tbody>' + Q.map(function (x) { return "<tr><td>" + esc(curta(x.criado_em)) + '</td><td class="num">' + esc(x.referencia) + "</td><td>" + esc(x.descricao) + '</td><td class="num">' + esc(kz(x.valor)) + "</td><td>" + (x.estado === "pago" ? '<span class="badge badge--ok">Pago ' + esc(curta(x.pago_em)) + "</span>" : x.estado === "pendente" ? '<span class="badge badge--warn">' + (x.comprovativo ? "Comprovativo enviado" : "Por pagar") + "</span>" : '<span class="badge">Anulado</span>') + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">Ainda sem quotas.</div>'));
    } else if (tab === "beneficios") {
      var B = emDia(m) ? need("conta:benef", function () { return sb.rpc("meus_beneficios").then(ok); }) : [];
      corpo = !emDia(m) ? '<div class="empty">Os códigos dos benefícios ficam disponíveis com a adesão activa e a quota em dia. <a class="linkbtn" href="#/conta?tab=quotas">Pagar quota</a></div>'
        : B === undefined ? carregando() : falhou(B) || (B.length ? '<div class="grid3">' + B.map(function (b) { return '<div class="card bcard">' + (b.desconto ? '<span class="desc">' + esc(b.desconto) + "</span>" : "") + '<h3 style="margin:0">' + esc(b.titulo) + '</h3><div class="small">' + esc(b.parceiro) + '</div><p class="small" style="margin:0">' + esc(b.descricao) + "</p>" + (b.codigo ? '<div><span class="small">Código</span><br><span class="codigo">' + esc(b.codigo) + "</span></div>" : "") + (b.como_usar ? '<p class="small" style="margin:0"><b>Como usar:</b> ' + esc(b.como_usar) + "</p>" : "") + (b.link ? '<a class="linkbtn" href="' + esc(b.link) + '" target="_blank" rel="noopener">Site do parceiro</a>' : "") + "</div>"; }).join("") + "</div>" : '<div class="empty">Ainda sem benefícios activos. Em breve.</div>');
    } else if (tab === "perfil") {
      corpo = '<form class="form" id="fPerfil">' + camposAdesao(m, {}) + '<div class="two"><label>Nome da conta<input name="pnome" value="' + esc((S.perfil && S.perfil.nome) || "") + '"></label><label>Telefone / WhatsApp<input name="ptel" value="' + esc((S.perfil && S.perfil.telefone) || "") + '"></label></div><div><button class="btn" type="submit">Guardar alterações</button></div></form>' +
        '<h2 style="margin-top:30px;font-size:1.3rem">Alterar palavra-passe</h2><form class="form" id="fPw"><label>Nova palavra-passe<input name="pw" type="password" minlength="6" required autocomplete="new-password"></label><div><button class="btn btn--line" type="submit">Alterar</button></div></form>';
    } else {
      corpo = '<div class="split"><div>' + (m.numero ? cartaoMembro(m) + '<p class="small" style="margin-top:10px">Mostre o QR aos parceiros para validar os benefícios.</p>' : '<div class="empty">O cartão de membro fica disponível depois da aprovação.</div>') + "</div>" +
        '<div class="box"><h3>Resumo</h3><p class="small" style="margin:0 0 4px">Plano: <b>' + esc((plano(m.plano) || {}).nome || m.plano) + '</b></p><p class="small" style="margin:0 0 4px">Tipo: <b>' + esc(m.tipo) + '</b></p><p class="small" style="margin:0 0 4px">Membro desde: <b>' + esc(m.aprovado_em ? curta(m.aprovado_em) : "—") + '</b></p><p class="small">Quota válida até: <b>' + esc(m.quota_ate ? curta(m.quota_ate) : "—") + '</b></p><div class="btns"><a class="btn btn--sm" href="#/conta?tab=quotas">Quotas</a><a class="btn btn--line btn--sm" href="#/conta?tab=beneficios">Benefícios</a></div></div></div>';
    }
    main.innerHTML = '<div class="wrap page-head"><div class="kicker">Área do membro</div><h1>' + esc(m.nome) + "</h1>" + estadoBox +
      '<div class="tabs">' + [["inicio", "Cartão"], ["quotas", "Quotas"], ["beneficios", "Benefícios"], ["perfil", "Perfil"]].map(function (t) { return '<a href="#/conta?tab=' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + t[1] + "</a>"; }).join("") + '</div><div style="padding-bottom:60px">' + corpo + "</div></div>";
    desenharQRs(main);
    var fp = document.getElementById("fPerfil");
    if (fp) fp.addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(fp), o = lerAdesao(d); o.telefone = String(d.get("ptel") || "").trim();
      acao(async function () { ok(await sb.from("membros").update(o).eq("id", m.id)); ok(await sb.from("perfis").update({ nome: String(d.get("pnome") || "").trim(), telefone: o.telefone }).eq("id", S.user.id)); }, "Perfil guardado").catch(function () {}); });
    var fw = document.getElementById("fPw");
    if (fw) fw.addEventListener("submit", function (e) { e.preventDefault(); acao(async function () { ok(await sb.auth.updateUser({ password: new FormData(fw).get("pw") })); }, "Palavra-passe alterada").catch(function () {}); });
    var fc = document.getElementById("fComp");
    if (fc) fc.addEventListener("submit", async function (e) {
      e.preventDefault(); var file = fc.querySelector("input[type=file]").files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast("O ficheiro tem mais de 5 MB.", true); return; }
      var ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, ""), caminho = m.id + "/" + fc.dataset.id + "-" + Date.now() + "." + ext;
      acao(async function () { ok(await sb.storage.from("comprovativos").upload(caminho, file, { upsert: false, contentType: file.type || undefined })); ok(await sb.rpc("anexar_comprovativo", { p_quota: fc.dataset.id, p_caminho: caminho })); }, "Comprovativo enviado. A associação vai confirmar o pagamento.", ["conta:quotas"]).catch(function () {});
    });
  }
  function blocoPagar(qt) {
    var P = S.defs.pagamento || {}, msg = "Quota AACPD\nMembro: " + (S.membro ? S.membro.nome : "") + "\nReferência: " + qt.referencia + "\nValor: " + kz(qt.valor);
    return '<div class="box"><h3>Pagamento da quota</h3><div class="paybox"><div><span>Valor</span><b>' + esc(kz(qt.valor)) + '</b></div><div><span>Referência</span><b>' + esc(qt.referencia) + '</b></div><div><span>Período</span><b>' + (qt.meses === 1 ? "1 mês" : qt.meses + " meses") + "</b></div></div>" +
      (P.mcx ? "<p><b>Multicaixa Express:</b> " + esc(P.mcx) + (P.titular ? " (" + esc(P.titular) + ")" : "") + "</p>" : "") + (P.iban ? "<p><b>Transferência:</b> IBAN " + esc(P.iban) + (P.banco ? " · " + esc(P.banco) : "") + (P.titular ? " · Titular: " + esc(P.titular) : "") + "</p>" : "") +
      (!P.mcx && !P.iban ? '<p class="note">A associação envia-lhe os dados de pagamento. ' + (P.whatsapp ? "Contacte-nos por WhatsApp." : "") + "</p>" : '<p class="small">Use a referência <b>' + esc(qt.referencia) + "</b> como descritivo.</p>") +
      (P.instrucoes ? '<p class="small">' + esc(P.instrucoes) + "</p>" : "") +
      (qt.comprovativo ? '<div class="status status--ok"><div><b>Comprovativo recebido</b>A associação vai confirmar o pagamento em breve.</div></div>' : "") +
      '<form class="form" id="fComp" data-id="' + esc(qt.id) + '"><label>Anexar comprovativo (PDF ou imagem, até 5 MB)<input type="file" accept="image/*,application/pdf" required></label><div class="btns"><button class="btn" type="submit">' + (qt.comprovativo ? "Substituir comprovativo" : "Enviar comprovativo") + "</button>" + (P.whatsapp ? '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(wa(P.whatsapp, msg)) + '">Enviar por WhatsApp</a>' : "") + "</div></form></div>";
  }

  /* ---------- administração ---------- */
  var ATABS = [["", "Painel"], ["membros", "Membros"], ["quotas", "Quotas"], ["noticias", "Notícias"], ["beneficios", "Benefícios"], ["direccao", "Direcção"], ["mensagens", "Mensagens"], ["definicoes", "Definições"]];
  function pgAdmin(sub, q) {
    if (!S.user) { main.innerHTML = '<div class="wrap--n page-head"><h1>Administração</h1><button class="btn" type="button" data-act="entrar">Entrar</button></div>'; return; }
    if (!isAdmin()) { main.innerHTML = '<div class="wrap--n page-head"><h1>Sem acesso</h1><p class="muted">Esta área é só para a administração da AACPD.</p></div>'; return; }
    var corpo = "", fn = { "": admPainel, membros: admMembros, quotas: admQuotas, noticias: admNoticias, beneficios: admBeneficios, direccao: admDireccao, mensagens: admMensagens, definicoes: admDefinicoes }[sub];
    if (!fn) return pgNada();
    corpo = fn(q);
    main.innerHTML = '<div class="adminhead"><div class="wrap"><div class="adminhead__t">Administração AACPD</div><div class="tabs">' + ATABS.map(function (t) { return '<a href="#/admin' + (t[0] ? "/" + t[0] : "") + '" class="' + (sub === t[0] ? "on" : "") + '">' + t[1] + "</a>"; }).join("") + '</div></div></div><div class="wrap" style="padding:24px 0 60px">' + corpo + "</div>";
    ligarAdmin(sub, q);
  }
  function admPainel() {
    var R = need("adm:resumo", function () { return sb.rpc("admin_resumo").then(ok); });
    if (R === undefined) return carregando(); if (R.erro) return falhou(R);
    return '<div class="stats">' + [["activos", "membros activos", ""], ["em_dia", "com quota em dia", "ok"], ["pendentes", "pedidos de adesão por aprovar", "warn"], ["quotas_pendentes", "quotas por confirmar", "warn"], ["mensagens_novas", "mensagens novas", "red"]].map(function (k) { return '<div class="stat stat--' + k[2] + '"><b>' + (R[k[0]] || 0) + "</b><span>" + k[1] + "</span></div>"; }).join("") +
      '<div class="stat stat--ok"><b>' + esc(kz(R.receita_ano)) + '</b><span>quotas recebidas este ano</span></div><div class="stat stat--warn"><b>' + esc(kz(R.por_receber)) + "</b><span>por receber</span></div></div>" +
      '<div class="split" style="margin-top:20px"><div class="box"><h3>Receita de quotas · últimos 12 meses</h3>' + grafico(R.por_mes || []) + '</div><div class="box"><h3>Membros activos por tipo</h3>' + ((R.por_tipo || []).length ? '<div class="tablewrap"><table class="tbl"><tbody>' + R.por_tipo.map(function (x) { return "<tr><td>" + esc(x.tipo) + '</td><td class="num">' + x.n + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">Ainda sem membros activos.</div>') +
      '<div class="btns" style="margin-top:14px"><a class="btn btn--sm" href="#/admin/membros?e=pendente">Aprovar adesões (' + (R.pendentes || 0) + ')</a><a class="btn btn--line btn--sm" href="#/admin/quotas?e=pendente">Confirmar quotas (' + (R.quotas_pendentes || 0) + ")</a></div></div></div>";
  }
  function grafico(meses) {
    if (!meses.some(function (m) { return m.receita > 0; })) return '<div class="empty">Ainda sem quotas pagas.</div>';
    var W = 560, H = 200, pl = 54, pb = 24, pt = 10, n = meses.length, max = Math.max.apply(null, meses.map(function (m) { return m.receita; })), pot = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / pot) * pot, iw = W - pl - 6, ih = H - pt - pb, bw = iw / n, base = pt + ih;
    var nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    var s = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Receita de quotas por mês">';
    [0, .5, 1].forEach(function (f) { var y = base - ih * f; s += '<line class="chart__grid" x1="' + pl + '" x2="' + (W - 6) + '" y1="' + y + '" y2="' + y + '"/><text class="chart__lab" x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (top * f >= 1000 ? Math.round(top * f / 1000) + " mil" : top * f) + "</text>"; });
    meses.forEach(function (m, i) { var x = pl + i * bw + 2, w = bw - 4, h = m.receita ? Math.max(3, ih * m.receita / top) : 0, y = base - h, r = Math.min(4, w / 2, h), tip = m.mes + " · " + kz(m.receita) + " · " + m.adesoes + " adesões";
      s += '<g class="chart__col"><rect class="chart__hit" x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '"/>' + (h ? '<path class="chart__bar" d="M' + x + "," + base + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + base + 'Z"/>' : "") + "<title>" + esc(tip) + "</title></g>" +
        '<text class="chart__lab" x="' + (pl + i * bw + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + nomes[Number(m.mes.slice(5)) - 1] + "</text>"; });
    return s + "</svg>";
  }
  function admMembros(q) {
    var M = need("adm:membros", function () { return sb.rpc("admin_membros").then(ok); });
    if (M === undefined) return carregando(); if (M.erro) return falhou(M);
    var f = (q.f || "").toLowerCase(), L = M.filter(function (m) { return (!q.e || m.estado === q.e) && (!f || (m.nome + " " + m.email + " " + (m.numero || "") + " " + m.telefone).toLowerCase().indexOf(f) >= 0); });
    var cont = { pendente: 0, activo: 0, suspenso: 0, rejeitado: 0 }; M.forEach(function (m) { cont[m.estado]++; });
    return '<form class="filters" id="aFil" data-sub="membros"><input type="search" name="f" placeholder="Procurar nome, email, nº" value="' + esc(q.f || "") + '"><select name="e"><option value="">Todos (' + M.length + ")</option>" + [["pendente", "Por aprovar"], ["activo", "Activos"], ["suspenso", "Suspensos"], ["rejeitado", "Rejeitados"]].map(function (o) { return '<option value="' + o[0] + '"' + (q.e === o[0] ? " selected" : "") + ">" + o[1] + " (" + cont[o[0]] + ")</option>"; }).join("") + '</select><button class="btn btn--sm" type="submit">Filtrar</button><button class="btn btn--line btn--sm" type="button" data-act="csv-membros">Exportar CSV</button></form>' +
      (L.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th>Membro</th><th>Contacto</th><th class="hide-s">Tipo / plano</th><th>Estado</th><th>Quota</th><th>Acções</th></tr></thead><tbody>' + L.map(function (m) {
        return "<tr><td><b>" + esc(m.nome) + '</b><div class="small">' + esc(m.numero || "sem nº") + " · " + esc(m.provincia) + '</div></td><td class="small">' + esc(m.email) + "<br>" + esc(m.telefone) + '</td><td class="hide-s small">' + esc(m.tipo) + "<br>" + esc((plano(m.plano) || {}).nome || m.plano) + "</td><td>" + badgeEstado(m.estado) + "</td><td>" + (m.quota_ate ? (emDia(m) ? '<span class="badge badge--ok">até ' + esc(curta(m.quota_ate)) + "</span>" : '<span class="badge badge--red">expirou ' + esc(curta(m.quota_ate)) + "</span>") : '<span class="badge">nunca paga</span>') + (m.quota_pendente ? '<div class="small" style="margin-top:4px">' + (m.comprovativo ? "📎 comprovativo" : "pagamento pendente") + "</div>" : "") + '</td><td><div class="acts">' +
          (m.estado !== "activo" ? '<button class="btn btn--sm btn--ok" type="button" data-act="m-estado" data-id="' + m.id + '" data-v="activo">Aprovar</button>' : "") + '<button class="btn btn--line btn--sm" type="button" data-act="m-ficha" data-id="' + m.id + '">Ficha</button></div></td></tr>';
      }).join("") + "</tbody></table></div>" : '<div class="empty">Sem membros com estes filtros.</div>');
  }
  function badgeEstado(e) { return { pendente: '<span class="badge badge--warn">Por aprovar</span>', activo: '<span class="badge badge--ok">Activo</span>', suspenso: '<span class="badge badge--red">Suspenso</span>', rejeitado: '<span class="badge">Rejeitado</span>' }[e] || esc(e); }
  function admQuotas(q) {
    var Q = need("adm:quotas", function () { return sb.rpc("admin_quotas").then(ok); });
    if (Q === undefined) return carregando(); if (Q.erro) return falhou(Q);
    var L = Q.filter(function (x) { return !q.e || x.estado === q.e; });
    var pago = Q.filter(function (x) { return x.estado === "pago"; }).reduce(function (a, x) { return a + x.valor; }, 0), pend = Q.filter(function (x) { return x.estado === "pendente"; }).reduce(function (a, x) { return a + x.valor; }, 0);
    return '<div class="stats" style="margin-bottom:16px"><div class="stat stat--ok"><b>' + esc(kz(pago)) + '</b><span>total recebido</span></div><div class="stat stat--warn"><b>' + esc(kz(pend)) + "</b><span>por confirmar</span></div></div>" +
      '<form class="filters" id="aFil" data-sub="quotas"><select name="e"><option value="">Todas</option><option value="pendente"' + (q.e === "pendente" ? " selected" : "") + '>Por confirmar</option><option value="pago"' + (q.e === "pago" ? " selected" : "") + '>Pagas</option><option value="anulado"' + (q.e === "anulado" ? " selected" : "") + '>Anuladas</option></select><button class="btn btn--sm" type="submit">Filtrar</button><button class="btn btn--line btn--sm" type="button" data-act="csv-quotas">Exportar CSV</button></form>' +
      (L.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th>Data</th><th>Membro</th><th>Referência</th><th>Valor</th><th>Estado</th><th>Acções</th></tr></thead><tbody>' + L.map(function (x) {
        return "<tr><td>" + esc(curta(x.criado_em)) + "</td><td><b>" + esc(x.membro) + '</b><div class="small">' + esc(x.numero || "") + " " + esc(x.email) + '</div></td><td class="num">' + esc(x.referencia) + '<div class="small">' + esc(x.descricao) + '</div></td><td class="num">' + esc(kz(x.valor)) + "</td><td>" + (x.estado === "pago" ? '<span class="badge badge--ok">Pago</span><div class="small">' + esc(x.metodo) + " · " + esc(curta(x.pago_em)) + "</div>" : x.estado === "pendente" ? '<span class="badge badge--warn">Por confirmar</span>' : '<span class="badge">Anulada</span>') + '</td><td><div class="acts">' +
          (x.comprovativo ? '<button class="btn btn--line btn--sm" type="button" data-act="ver-comp" data-path="' + esc(x.comprovativo) + '">📎 Comprovativo</button>' : "") +
          (x.estado === "pendente" ? '<button class="btn btn--sm btn--ok" type="button" data-act="q-confirmar" data-id="' + x.id + '" data-valor="' + x.valor + '" data-nome="' + esc(x.membro) + '">Confirmar</button><button class="btn btn--line btn--sm" type="button" data-act="q-anular" data-id="' + x.id + '">Anular</button>' : "") + "</div></td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="empty">Sem quotas.</div>');
  }
  function admNoticias() {
    var N = need("adm:noticias", function () { return sb.from("noticias").select("*").order("publicado_em", { ascending: false }).then(ok); });
    if (N === undefined) return carregando(); if (N.erro) return falhou(N);
    return '<div class="sec__head"><h2 style="font-size:1.4rem">Notícias e notas de imprensa</h2><button class="btn btn--sm" type="button" data-act="n-editar">+ Nova publicação</button></div>' +
      (N.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>Título</th><th>Categoria</th><th>Data</th><th>Estado</th><th></th></tr></thead><tbody>' + N.map(function (n) { return "<tr><td>" + (n.imagem ? '<img class="thumb" src="' + esc(pubUrl(n.imagem)) + '" alt="">' : "") + "</td><td><b>" + esc(n.titulo) + "</b>" + (n.destaque ? ' <span class="badge badge--red">Destaque</span>' : "") + "</td><td>" + esc(n.categoria) + "</td><td>" + esc(curta(n.publicado_em)) + "</td><td>" + (n.publicado ? '<span class="badge badge--ok">Publicado</span>' : '<span class="badge">Rascunho</span>') + '</td><td><div class="acts"><button class="btn btn--line btn--sm" type="button" data-act="n-editar" data-id="' + n.id + '">Editar</button>' + (n.publicado ? '<a class="btn btn--line btn--sm" href="#/noticias/' + esc(n.slug) + '">Ver</a>' : "") + "</div></td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">Ainda sem publicações.</div>');
  }
  function admBeneficios() {
    var B = need("adm:benef", function () { return sb.from("beneficios").select("*").order("ordem").then(ok); });
    if (B === undefined) return carregando(); if (B.erro) return falhou(B);
    return '<div class="sec__head"><h2 style="font-size:1.4rem">Benefícios para membros</h2><button class="btn btn--sm" type="button" data-act="b-editar">+ Novo benefício</button></div>' +
      (B.length ? '<div class="tablewrap"><table class="tbl"><thead><tr><th>Benefício</th><th>Parceiro</th><th>Desconto</th><th>Código</th><th>Estado</th><th></th></tr></thead><tbody>' + B.map(function (b) { return "<tr><td><b>" + esc(b.titulo) + "</b></td><td>" + esc(b.parceiro) + "</td><td>" + esc(b.desconto) + '</td><td class="num">' + esc(b.codigo || "—") + "</td><td>" + (b.activo ? '<span class="badge badge--ok">Activo</span>' : '<span class="badge">Inactivo</span>') + '</td><td><button class="btn btn--line btn--sm" type="button" data-act="b-editar" data-id="' + b.id + '">Editar</button></td></tr>'; }).join("") + "</tbody></table></div>" : '<div class="empty">Ainda sem benefícios. Crie o primeiro para dar mais valor à quota.</div>');
  }
  function admDireccao() {
    var D = need("pub:direccao", function () { return sb.from("direccao").select("*").order("ordem").then(ok); });
    if (D === undefined) return carregando(); if (D.erro) return falhou(D);
    return '<div class="sec__head"><h2 style="font-size:1.4rem">Direcção e órgãos sociais</h2><button class="btn btn--sm" type="button" data-act="d-editar">+ Adicionar pessoa</button></div><div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>Nome</th><th>Cargo</th><th>Ordem</th><th></th></tr></thead><tbody>' + D.map(function (d) { return '<tr><td><img class="thumb" src="' + esc(pubUrl(d.foto) || "img/logo-aacpd.jpg") + '" alt=""></td><td><b>' + esc(d.nome) + "</b></td><td>" + esc(d.cargo) + "</td><td>" + d.ordem + '</td><td><button class="btn btn--line btn--sm" type="button" data-act="d-editar" data-id="' + d.id + '">Editar</button></td></tr>'; }).join("") + "</tbody></table></div>";
  }
  function admMensagens() {
    var M = need("adm:msgs", function () { return sb.from("mensagens").select("*").order("criado_em", { ascending: false }).limit(500).then(ok); });
    if (M === undefined) return carregando(); if (M.erro) return falhou(M);
    return M.length ? M.map(function (m) { return '<div class="box"' + (m.lida ? "" : ' style="border-left:4px solid var(--red)"') + '><div class="sec__head" style="margin-bottom:6px"><div><b style="color:var(--ink)">' + esc(m.nome) + '</b> <span class="small">' + esc(m.assunto) + " · " + esc(curta(m.criado_em)) + "</span>" + (m.lida ? "" : ' <span class="badge badge--red">Nova</span>') + '</div><div class="acts"><a class="btn btn--line btn--sm" href="mailto:' + esc(m.email) + "?subject=" + encodeURIComponent("AACPD — " + (m.assunto || "")) + '">Responder por email</a>' + (m.telefone ? '<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="' + esc(wa(m.telefone)) + '">WhatsApp</a>' : "") + (m.lida ? "" : '<button class="btn btn--line btn--sm" type="button" data-act="msg-lida" data-id="' + m.id + '">Marcar lida</button>') + '<button class="btn btn--line btn--sm" type="button" data-act="msg-apagar" data-id="' + m.id + '">Apagar</button></div></div><p class="small" style="margin:0 0 6px">' + esc(m.email) + (m.telefone ? " · " + esc(m.telefone) : "") + '</p><p style="margin:0;white-space:pre-line">' + esc(m.mensagem) + "</p></div>"; }).join("") : '<div class="empty">Sem mensagens.</div>';
  }
  function admDefinicoes() {
    var A = need("adm:admins", function () { return sb.rpc("admin_lista_admins").then(ok); });
    var P = S.defs.pagamento || {}, Si = S.defs.site || {};
    return '<div class="split"><form class="form box" id="fPlanos"><h3>Planos de quota</h3><p class="small">Os valores aparecem na adesão e geram o valor de cada quota.</p><div id="planRows">' + S.defs.planos.map(linhaPlano).join("") + '</div><div class="btns"><button class="btn btn--line btn--sm" type="button" data-act="plano-add">+ Plano</button><button class="btn btn--sm" type="submit">Guardar planos</button></div></form>' +
      '<form class="form box" id="fPag"><h3>Dados de pagamento</h3><label>Titular<input name="titular" value="' + esc(P.titular || "") + '"></label><div class="two"><label>Banco<input name="banco" value="' + esc(P.banco || "") + '"></label><label>IBAN<input name="iban" value="' + esc(P.iban || "") + '"></label></div><div class="two"><label>Multicaixa Express<input name="mcx" value="' + esc(P.mcx || "") + '"></label><label>WhatsApp para comprovativos<input name="whatsapp" value="' + esc(P.whatsapp || "") + '"></label></div><label>Instruções<textarea name="instrucoes">' + esc(P.instrucoes || "") + '</textarea></label><div><button class="btn btn--sm" type="submit">Guardar pagamento</button></div></form></div>' +
      '<div class="split" style="margin-top:18px"><form class="form box" id="fSite"><h3>Textos e contactos do site</h3><label>Missão<textarea name="missao">' + esc(Si.missao || "") + '</textarea></label><label>Visão<textarea name="visao" style="min-height:70px">' + esc(Si.visao || "") + '</textarea></label><label>Valores<input name="valores" value="' + esc(Si.valores || "") + '"></label><div class="two"><label>Email<input name="email" type="email" value="' + esc(Si.email || "") + '"></label><label>Telefone / WhatsApp<input name="telefone" value="' + esc(Si.telefone || "") + '"></label></div><label>Morada<input name="morada" value="' + esc(Si.morada || "") + '"></label><div class="two"><label>Site<input name="site" value="' + esc(Si.site || "") + '"></label><label>Facebook<input name="facebook" value="' + esc(Si.facebook || "") + '"></label></div><div class="two"><label>Instagram<input name="instagram" value="' + esc(Si.instagram || "") + '"></label><label>X<input name="x" value="' + esc(Si.x || "") + '"></label></div><div><button class="btn btn--sm" type="submit">Guardar textos</button></div></form>' +
      '<div class="box"><h3>Administradores</h3>' + (A === undefined ? carregando() : falhou(A) || '<ul style="padding-left:18px">' + A.map(function (a) { return "<li>" + esc(a.nome || "") + ' <span class="small">' + esc(a.email) + '</span> <button class="linkbtn small" type="button" data-act="adm-remover" data-email="' + esc(a.email) + '">remover</button></li>'; }).join("") + "</ul>") +
      '<form class="form" id="fAdm"><label>Dar acesso de administrador (email de uma conta existente)<input name="email" type="email" required></label><div><button class="btn btn--sm" type="submit">Adicionar administrador</button></div></form></div></div>';
  }
  function linhaPlano(p) { p = p || {}; return '<div class="fs" style="margin-bottom:10px"><input type="hidden" name="pl_id" value="' + esc(p.id || "") + '"><div class="two"><label>Nome<input name="pl_nome" required value="' + esc(p.nome || "") + '"></label><label>Valor (Kz)<input name="pl_valor" type="number" min="0" step="100" required value="' + (p.valor == null ? "" : p.valor) + '"></label></div><div class="two"><label>Período<select name="pl_periodo"><option value="anual"' + (p.periodo !== "mensal" ? " selected" : "") + '>Anual</option><option value="mensal"' + (p.periodo === "mensal" ? " selected" : "") + '>Mensal</option></select></label><label>Descrição<input name="pl_desc" value="' + esc(p.descricao || "") + '"></label></div><div><button class="linkbtn small" type="button" data-act="plano-del">Remover plano</button></div></div>'; }

  function ligarAdmin(sub, q) {
    var af = document.getElementById("aFil");
    if (af) af.addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(af); location.hash = "#/admin/" + af.dataset.sub + "?" + ["f", "e"].map(function (k) { return k + "=" + encodeURIComponent(d.get(k) || ""); }).join("&"); });
    var fp = document.getElementById("fPlanos");
    if (fp) fp.addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(fp), ids = d.getAll("pl_id"), no = d.getAll("pl_nome"), va = d.getAll("pl_valor"), pe = d.getAll("pl_periodo"), de = d.getAll("pl_desc"), usados = {};
      var arr = no.map(function (n, i) { var id = ids[i] || slug(n), k = 2, b = id; while (usados[id]) id = b + "-" + k++; usados[id] = 1; return { id: id, nome: String(n).trim(), valor: Math.max(0, Number(va[i]) || 0), periodo: pe[i], descricao: String(de[i] || "").trim() }; }).filter(function (p) { return p.nome; });
      guardarDef("planos", arr); });
    var fg = document.getElementById("fPag");
    if (fg) fg.addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(fg), o = {}; ["titular", "banco", "iban", "mcx", "whatsapp", "instrucoes"].forEach(function (k) { o[k] = String(d.get(k) || "").trim(); }); guardarDef("pagamento", o); });
    var fs = document.getElementById("fSite");
    if (fs) fs.addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(fs), o = {}; ["missao", "visao", "valores", "email", "telefone", "morada", "site", "facebook", "instagram", "x"].forEach(function (k) { o[k] = String(d.get(k) || "").trim(); }); guardarDef("site", o); });
    var fa = document.getElementById("fAdm");
    if (fa) fa.addEventListener("submit", function (e) { e.preventDefault(); var em = new FormData(fa).get("email"); acao(async function () { ok(await sb.rpc("admin_definir_papel", { p_email: em, p_papel: "admin" })); }, "Administrador adicionado", ["adm:admins"]).catch(function () {}); });
  }
  function guardarDef(chave, valor) { acao(async function () { ok(await sb.from("definicoes").upsert({ chave: chave, valor: valor, actualizado_em: new Date().toISOString() })); S.defs[chave] = valor; desenharTopo(); }, "Guardado").catch(function () {}); }

  /* ---------- modais de edição ---------- */
  function abrir(html) { mBody.innerHTML = html; modal.hidden = false; var f = mBody.querySelector("input:not([type=hidden]),select,textarea,button:not([data-close])"); if (f) f.focus(); }
  function fechar() { modal.hidden = true; mBody.innerHTML = ""; }
  async function upload(file, pasta) {
    if (!file || !file.size) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error("A imagem tem mais de 5 MB.");
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, ""), caminho = pasta + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
    ok(await sb.storage.from("publico").upload(caminho, file, { contentType: file.type || undefined }));
    return caminho;
  }
  function editarNoticia(id) {
    var n = id ? (C["adm:noticias"] || []).filter(function (x) { return x.id === id; })[0] : { categoria: "Notícia", publicado: true, publicado_em: new Date().toISOString() };
    abrir('<h2 id="mTitle">' + (id ? "Editar publicação" : "Nova publicação") + '</h2><form class="form" id="fEd"><label>Título<input name="titulo" required maxlength="200" value="' + esc(n.titulo || "") + '"></label><div class="two"><label>Categoria<select name="categoria">' + CATS.map(function (c) { return "<option" + (n.categoria === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + '</select></label><label>Data<input name="data" type="date" value="' + esc((n.publicado_em || "").slice(0, 10)) + '"></label></div>' +
      '<label>Resumo<textarea name="resumo" maxlength="400" style="min-height:70px">' + esc(n.resumo || "") + '</textarea></label><label>Texto<textarea name="corpo" style="min-height:220px">' + esc(n.corpo || "") + '</textarea><span class="hint">Separe os parágrafos com uma linha em branco.</span></label><label>Imagem de capa' + (n.imagem ? ' (actual: mantém-se se não escolher outra)' : "") + '<input name="img" type="file" accept="image/*"></label>' +
      '<label class="check"><input type="checkbox" name="publicado"' + (n.publicado ? " checked" : "") + '> Publicado (visível no site)</label><label class="check"><input type="checkbox" name="destaque"' + (n.destaque ? " checked" : "") + '> Destaque na página inicial</label><div class="btns"><button class="btn" type="submit">Guardar</button>' + (id ? '<button class="btn btn--line" type="button" data-act="n-apagar" data-id="' + id + '">Apagar</button>' : "") + "</div></form>");
    document.getElementById("fEd").addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(this);
      acao(async function () {
        var img = await upload(d.get("img"), "noticias");
        var o = { titulo: String(d.get("titulo")).trim(), categoria: d.get("categoria"), resumo: String(d.get("resumo") || "").trim(), corpo: String(d.get("corpo") || "").trim(), publicado: !!d.get("publicado"), destaque: !!d.get("destaque"), publicado_em: d.get("data") ? new Date(d.get("data") + "T12:00").toISOString() : new Date().toISOString() };
        if (img) o.imagem = img;
        if (id) ok(await sb.from("noticias").update(o).eq("id", id)); else { o.slug = slug(o.titulo) + "-" + Date.now().toString(36).slice(-4); ok(await sb.from("noticias").insert(o)); }
        fechar();
      }, "Publicação guardada", ["adm:noticias", "pub:"]).catch(function () {}); });
  }
  function editarBeneficio(id) {
    var b = id ? (C["adm:benef"] || []).filter(function (x) { return x.id === id; })[0] : { activo: true, ordem: 0 };
    abrir('<h2 id="mTitle">' + (id ? "Editar benefício" : "Novo benefício") + '</h2><form class="form" id="fEd"><div class="two"><label>Título<input name="titulo" required value="' + esc(b.titulo || "") + '"></label><label>Parceiro<input name="parceiro" value="' + esc(b.parceiro || "") + '"></label></div><div class="two"><label>Desconto / vantagem<input name="desconto" value="' + esc(b.desconto || "") + '" placeholder="Ex.: 20% de desconto"></label><label>Código (só para membros)<input name="codigo" value="' + esc(b.codigo || "") + '"></label></div>' +
      '<label>Descrição<textarea name="descricao" style="min-height:80px">' + esc(b.descricao || "") + '</textarea></label><label>Como usar<input name="como_usar" value="' + esc(b.como_usar || "") + '" placeholder="Ex.: mostrar o cartão de membro na loja"></label><div class="two"><label>Link<input name="link" type="url" value="' + esc(b.link || "") + '"></label><label>Ordem<input name="ordem" type="number" value="' + (b.ordem || 0) + '"></label></div><label>Imagem<input name="img" type="file" accept="image/*"></label><label class="check"><input type="checkbox" name="activo"' + (b.activo ? " checked" : "") + '> Activo</label>' +
      '<div class="btns"><button class="btn" type="submit">Guardar</button>' + (id ? '<button class="btn btn--line" type="button" data-act="b-apagar" data-id="' + id + '">Apagar</button>' : "") + "</div></form>");
    document.getElementById("fEd").addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(this);
      acao(async function () { var img = await upload(d.get("img"), "beneficios"), o = {}; ["titulo", "parceiro", "desconto", "codigo", "descricao", "como_usar", "link"].forEach(function (k) { o[k] = String(d.get(k) || "").trim(); }); o.ordem = Number(d.get("ordem")) || 0; o.activo = !!d.get("activo"); if (img) o.imagem = img;
        if (id) ok(await sb.from("beneficios").update(o).eq("id", id)); else ok(await sb.from("beneficios").insert(o)); fechar(); }, "Benefício guardado", ["adm:benef", "pub:benef"]).catch(function () {}); });
  }
  function editarDireccao(id) {
    var p = id ? (C["pub:direccao"] || []).filter(function (x) { return x.id === id; })[0] : { ordem: 10 };
    abrir('<h2 id="mTitle">' + (id ? "Editar" : "Adicionar pessoa") + '</h2><form class="form" id="fEd"><label>Nome<input name="nome" required value="' + esc(p.nome || "") + '"></label><label>Cargo<input name="cargo" required value="' + esc(p.cargo || "") + '"></label><div class="two"><label>Ordem<input name="ordem" type="number" value="' + (p.ordem || 0) + '"></label><label>Fotografia<input name="img" type="file" accept="image/*"></label></div><div class="btns"><button class="btn" type="submit">Guardar</button>' + (id ? '<button class="btn btn--line" type="button" data-act="d-apagar" data-id="' + id + '">Remover</button>' : "") + "</div></form>");
    document.getElementById("fEd").addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(this);
      acao(async function () { var img = await upload(d.get("img"), "direccao"), o = { nome: String(d.get("nome")).trim(), cargo: String(d.get("cargo")).trim(), ordem: Number(d.get("ordem")) || 0 }; if (img) o.foto = img;
        if (id) ok(await sb.from("direccao").update(o).eq("id", id)); else ok(await sb.from("direccao").insert(o)); fechar(); }, "Guardado", ["pub:direccao"]).catch(function () {}); });
  }
  function fichaMembro(id) {
    var m = (C["adm:membros"] || []).filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var pl = Array.isArray(m.plataformas) ? m.plataformas : [];
    abrir('<h2 id="mTitle">' + esc(m.nome) + '</h2><p>' + badgeEstado(m.estado) + " " + esc(m.numero || "") + '</p><div class="tablewrap"><table class="tbl"><tbody>' +
      [["Email", m.email], ["Telefone", m.telefone], ["Tipo", m.tipo], ["Plano", (plano(m.plano) || {}).nome || m.plano], ["Área", m.area], ["Província", m.provincia], ["BI / NIF", m.documento], ["Pedido em", curta(m.criado_em)], ["Aprovado em", curta(m.aprovado_em)], ["Quota válida até", curta(m.quota_ate)], ["Directório público", m.publico ? "Sim" : "Não"]].map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + esc(r[1] || "—") + "</td></tr>"; }).join("") +
      "<tr><th>Plataformas</th><td>" + (pl.length ? pl.map(function (p) { return '<a class="linkbtn" target="_blank" rel="noopener nofollow" href="' + esc(/^https?:/.test(p.link) ? p.link : "https://" + p.link) + '">' + esc(p.rede) + "</a> " + esc(p.seguidores || ""); }).join("<br>") : "—") + "</td></tr><tr><th>Apresentação</th><td>" + esc(m.bio || "—") + "</td></tr></tbody></table></div>" +
      '<form class="form" id="fNota" style="margin-top:14px"><label>Nota (visível ao membro em caso de rejeição ou suspensão)<input name="nota" value="' + esc(m.nota_admin || "") + '"></label></form>' +
      '<div class="btns" style="margin-top:14px">' + (m.estado !== "activo" ? '<button class="btn btn--ok btn--sm" type="button" data-act="m-estado" data-id="' + m.id + '" data-v="activo">Aprovar</button>' : "") + (m.estado === "pendente" ? '<button class="btn btn--line btn--sm" type="button" data-act="m-estado" data-id="' + m.id + '" data-v="rejeitado">Rejeitar</button>' : "") + (m.estado === "activo" ? '<button class="btn btn--line btn--sm" type="button" data-act="m-estado" data-id="' + m.id + '" data-v="suspenso">Suspender</button>' : "") +
      (m.comprovativo ? '<button class="btn btn--line btn--sm" type="button" data-act="ver-comp" data-path="' + esc(m.comprovativo) + '">📎 Comprovativo</button>' : "") + (m.quota_pendente ? '<button class="btn btn--sm" type="button" data-act="q-confirmar" data-id="' + m.quota_pendente + '" data-nome="' + esc(m.nome) + '" data-valor="' + ((plano(m.plano) || {}).valor || "") + '">Confirmar quota</button>' : '<button class="btn btn--line btn--sm" type="button" data-act="q-manual" data-id="' + m.id + '">Registar pagamento</button>') +
      (m.telefone ? '<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="' + esc(wa(m.telefone)) + '">WhatsApp</a>' : "") + "</div>");
  }

  /* ---------- cliques ---------- */
  document.addEventListener("click", async function (ev) {
    var t = ev.target.closest("[data-act],[data-close]");
    if (!t) { if (ev.target === modal) fechar(); return; }
    if (t.hasAttribute("data-close")) return fechar();
    var a = t.dataset.act, id = t.dataset.id;
    if (t.tagName === "A") ev.preventDefault();
    if (a === "entrar" || a === "registar" || a === "recuperar") return abrirConta(a);
    if (a === "sair") { await sb.auth.signOut(); limpar(); await carregarConta(); desenharTopo(); location.hash = "#/"; render(); toast("Sessão terminada"); return; }
    if (a === "plat-add") { document.getElementById("platRows").insertAdjacentHTML("beforeend", linhaPlat({})); return; }
    if (a === "plat-del") { var r = t.closest(".platrow"); if (r && document.querySelectorAll(".platrow").length > 1) r.remove(); return; }
    if (a === "plano-add") { document.getElementById("planRows").insertAdjacentHTML("beforeend", linhaPlano({})); return; }
    if (a === "plano-del") { var pr = t.closest(".fs"); if (pr) pr.remove(); return; }
    if (a === "pedir-quota") { acao(async function () { ok(await sb.rpc("pedir_quota")); }, "Pagamento gerado", ["conta:quotas"]).catch(function () {}); return; }
    if (a === "m-estado") { var v = t.dataset.v, nota = (document.querySelector("#fNota input") || {}).value || "";
      if (v !== "activo" && !confirm(v === "rejeitado" ? "Rejeitar este pedido de adesão?" : "Suspender este membro?")) return;
      fechar(); acao(async function () { ok(await sb.from("membros").update({ estado: v, nota_admin: nota }).eq("id", id)); }, v === "activo" ? "Membro aprovado" : "Estado actualizado", ["adm:", "pub:dir"]).catch(function () {}); return; }
    if (a === "m-ficha") return fichaMembro(id);
    if (a === "q-confirmar") { abrir('<h2 id="mTitle">Confirmar pagamento</h2><p class="small">' + esc(t.dataset.nome || "") + '</p><form class="form" id="fConf"><label>Método<select name="metodo"><option>Multicaixa Express</option><option>Transferência bancária</option><option>Numerário</option><option>Outro</option></select></label><label>Valor recebido (Kz)<input name="valor" type="number" min="0" step="100" required value="' + esc(t.dataset.valor || "") + '"></label><p class="note">Confirme só depois de ver o dinheiro na conta. A quota do membro é prolongada automaticamente.</p><button class="btn btn--ok btn--block" type="submit">Confirmar pagamento</button></form>');
      document.getElementById("fConf").addEventListener("submit", function (e) { e.preventDefault(); var d = new FormData(this); fechar(); acao(async function () { ok(await sb.rpc("confirmar_quota", { p_quota: id, p_metodo: d.get("metodo"), p_valor: Number(d.get("valor")) })); }, "Pagamento confirmado", ["adm:"]).catch(function () {}); }); return; }
    if (a === "q-manual") { var mm = (C["adm:membros"] || []).filter(function (x) { return x.id === id; })[0], pp = plano(mm.plano) || { nome: mm.plano, valor: 0, periodo: "anual" };
      if (!confirm("Registar um pagamento de " + kz(pp.valor) + " (" + pp.nome + ") para " + mm.nome + "? Poderá ajustar o valor no passo seguinte.")) return;
      acao(async function () { var ins = ok(await sb.from("quotas").insert({ membro_id: id, referencia: "M-" + Date.now().toString(36).toUpperCase(), plano: pp.nome, descricao: "Quota " + pp.nome + " (registo manual)", valor: pp.valor || 0, meses: pp.periodo === "mensal" ? 1 : 12 }).select().single()); fechar(); setTimeout(function () { var b = document.createElement("button"); b.dataset.act = "q-confirmar"; b.dataset.id = ins.id; b.dataset.nome = mm.nome; b.dataset.valor = pp.valor || 0; document.body.appendChild(b); b.click(); b.remove(); }, 200); }, null, ["adm:"]).catch(function () {}); return; }
    if (a === "q-anular") { if (!confirm("Anular esta quota?")) return; acao(async function () { ok(await sb.from("quotas").update({ estado: "anulado" }).eq("id", id)); }, "Quota anulada", ["adm:"]).catch(function () {}); return; }
    if (a === "ver-comp") { try { var u = ok(await sb.storage.from("comprovativos").createSignedUrl(t.dataset.path, 600)); window.open(u.signedUrl, "_blank", "noopener"); } catch (e) { toast(traduz(e).message, true); } return; }
    if (a === "n-editar") return editarNoticia(id);
    if (a === "b-editar") return editarBeneficio(id);
    if (a === "d-editar") return editarDireccao(id);
    if (a === "n-apagar" || a === "b-apagar" || a === "d-apagar") { if (!confirm("Apagar definitivamente?")) return; var tab = { "n-apagar": "noticias", "b-apagar": "beneficios", "d-apagar": "direccao" }[a]; fechar(); acao(async function () { ok(await sb.from(tab).delete().eq("id", id)); }, "Apagado", ["adm:", "pub:"]).catch(function () {}); return; }
    if (a === "msg-lida") { acao(async function () { ok(await sb.from("mensagens").update({ lida: true }).eq("id", id)); }, null, ["adm:"]).catch(function () {}); return; }
    if (a === "msg-apagar") { if (!confirm("Apagar esta mensagem?")) return; acao(async function () { ok(await sb.from("mensagens").delete().eq("id", id)); }, "Mensagem apagada", ["adm:"]).catch(function () {}); return; }
    if (a === "adm-remover") { if (!confirm("Retirar o acesso de administrador a " + t.dataset.email + "?")) return; acao(async function () { ok(await sb.rpc("admin_definir_papel", { p_email: t.dataset.email, p_papel: "membro" })); }, "Acesso retirado", ["adm:admins"]).catch(function () {}); return; }
    if (a === "csv-membros") { var M = C["adm:membros"] || []; csv([["Número", "Nome", "Email", "Telefone", "Tipo", "Plano", "Área", "Província", "BI/NIF", "Estado", "Quota até", "Pedido em"]].concat(M.map(function (m) { return [m.numero, m.nome, m.email, m.telefone, m.tipo, (plano(m.plano) || {}).nome || m.plano, m.area, m.provincia, m.documento, m.estado, m.quota_ate, curta(m.criado_em)]; })), "membros-aacpd.csv"); return; }
    if (a === "csv-quotas") { var Q = C["adm:quotas"] || []; csv([["Data", "Membro", "Número", "Email", "Referência", "Descrição", "Valor (Kz)", "Estado", "Método", "Pago em"]].concat(Q.map(function (x) { return [curta(x.criado_em), x.membro, x.numero, x.email, x.referencia, x.descricao, x.valor, x.estado, x.metodo, curta(x.pago_em)]; })), "quotas-aacpd.csv"); return; }
  });

  /* ---------- conta (entrar / registar / recuperar) ---------- */
  function abrirConta(modo) {
    if (modo === "registar") { fechar(); location.hash = "#/adesao"; return; }
    if (modo === "recuperar") {
      abrir('<h2 id="mTitle">Recuperar palavra-passe</h2><form class="form" id="fRec"><label>Email<input name="email" type="email" required autocomplete="email"></label><button class="btn btn--block" type="submit">Enviar link</button><p class="small" style="text-align:center;margin:0"><button class="linkbtn" type="button" data-act="entrar">Voltar</button></p></form>');
      document.getElementById("fRec").addEventListener("submit", async function (e) { e.preventDefault(); var em = new FormData(this).get("email"); await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname + "#/nova-password" }); abrir('<h2 id="mTitle">Verifique o seu email</h2><p class="muted">Se existir uma conta com <b>' + esc(em) + "</b>, recebe um link para definir uma nova palavra-passe.</p>"); });
      return;
    }
    abrir('<h2 id="mTitle">Entrar</h2><form class="form" id="fLog"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Palavra-passe<input name="pw" type="password" required autocomplete="current-password"></label><button class="btn btn--block" type="submit">Entrar</button><p class="small" style="text-align:center;margin:0"><button class="linkbtn" type="button" data-act="recuperar">Esqueci-me da palavra-passe</button> · <a class="linkbtn" href="#/adesao" data-close>Aderir</a></p></form>');
    document.getElementById("fLog").addEventListener("submit", async function (e) {
      e.preventDefault(); var d = new FormData(this), b = this.querySelector("button"); b.disabled = true;
      try { ok(await sb.auth.signInWithPassword({ email: String(d.get("email")).trim(), password: d.get("pw") })); limpar(); await carregarConta(); desenharTopo(); fechar(); toast("Sessão iniciada"); if (!/^#\/(conta|admin)/.test(location.hash)) location.hash = isAdmin() ? "#/admin" : "#/conta"; else render(); }
      catch (x) { toast(traduz(x).message, true); } finally { b.disabled = false; }
    });
  }
  function pgNovaPw() {
    main.innerHTML = '<div class="wrap--n page-head" style="padding-bottom:60px;max-width:480px"><h1>Nova palavra-passe</h1><form class="form" id="fNp"><label>Nova palavra-passe<input name="pw" type="password" minlength="6" required autocomplete="new-password"></label><button class="btn" type="submit">Guardar</button></form></div>';
    document.getElementById("fNp").addEventListener("submit", function (e) { e.preventDefault(); var pw = new FormData(this).get("pw"); acao(async function () { ok(await sb.auth.updateUser({ password: pw })); }, "Palavra-passe alterada").then(function () { location.hash = "#/conta"; }).catch(function () {}); });
  }
  function pgNada() { main.innerHTML = '<div class="wrap--n page-head" style="padding-bottom:60px"><h1>Página não encontrada</h1><a class="linkbtn" href="#/">Voltar ao início</a></div>'; }

  /* ---------- router ---------- */
  function render() {
    var h = location.hash.replace(/^#\/?/, ""), parts = h.split("?"), seg = parts[0].split("/"), q = qsParse(parts[1]);
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.dataset.nav === seg[0]); });
    switch (seg[0]) {
      case "": pgInicio(); break;
      case "sobre": pgSobre(); break;
      case "noticias": if (seg[1]) pgArtigo(decodeURIComponent(seg[1])); else pgNoticias(q); break;
      case "beneficios": pgBeneficios(); break;
      case "membros": pgMembros(q); break;
      case "verificar": pgVerificar(seg[1] ? decodeURIComponent(seg[1]) : ""); break;
      case "contacto": pgContacto(); break;
      case "adesao": pgAdesao(q); break;
      case "conta": pgConta(q); break;
      case "admin": pgAdmin(seg[1] || "", q); break;
      case "nova-password": pgNovaPw(); break;
      default: pgNada();
    }
  }
  /* tema claro / escuro / automático */
  var TEMAS = { auto: ["Automático", "M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18"], light: ["Claro", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"], dark: ["Escuro", "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"] };
  function temaActual() { try { return localStorage.getItem("aacpd-tema") || "auto"; } catch (e) { return "auto"; } }
  function aplicarTema(t) {
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("aacpd-tema", t); } catch (e) {}
    var b = document.getElementById("temaBtn"), x = TEMAS[t];
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + x[1] + '"/></svg><span>' + x[0] + "</span>";
    b.setAttribute("aria-label", "Tema: " + x[0] + ". Clique para mudar.");
    var escuro = t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", escuro ? "#0c1013" : "#d71920");
  }
  document.getElementById("temaBtn").addEventListener("click", function () { var o = ["auto", "light", "dark"], t = o[(o.indexOf(temaActual()) + 1) % 3]; aplicarTema(t); toast("Tema: " + TEMAS[t][0]); });
  aplicarTema(temaActual());

  var nav = document.getElementById("nav"), mb = document.querySelector(".menu-btn");
  mb.addEventListener("click", function () { var on = nav.classList.toggle("on"); mb.setAttribute("aria-expanded", on); });
  window.addEventListener("hashchange", function () { nav.classList.remove("on"); fechar(); render(); window.scrollTo(0, 0); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) fechar(); });
  sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") location.hash = "#/nova-password"; });

  main.innerHTML = '<div class="wrap page-head">' + carregando() + "</div>";
  Promise.all([carregarDefs(), carregarConta()]).then(function () { desenharTopo(); render(); }, function () { desenharTopo(); render(); });
})();
