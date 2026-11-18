import { lerBalancete, conferir } from "./parser.mjs";
import { renderExecutivo } from "./executivo.mjs";
import { renderMes, renderProjecao, renderFornecedor, mapaCalor, SITUACOES, chaveAlerta, chaveAntiga } from "./gestao.mjs";
import { comboMensal, saude, treemapCategorias, listaTendencia, multiplos } from "./graficos.mjs";
import { AC, PERFIS, podeEditar, ehAdmin, normUsuario, validarSenha, mensagemErro, carregarFirebase, existeAdministrador, entrar, sair, aoMudarSessao,
  lerPerfil, registrarAcesso, trocarSenha, criarPrimeiroAdmin, criarAcesso, novaSenhaProvisoria, atualizarAcesso, listarAcessos,
  lerDados, gravarMeses, gravarAnalise, gravarAcomp, ouvirAcomp, gravarOrcamento, nomeUsuario, REGRAS } from "./acesso.mjs";
import { rotuloMes, r2, lancamentos, resumoMensal, porCategoria, porFornecedor, parcelas, indicadores, alertas } from "./analise.mjs";

const $ = (s) => document.querySelector(s);
const brl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => (v * 100).toFixed(1).replace(".", ",") + "%";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LS_ORC = "farol.orcamento.v1", LS_ORD = "farol.ordem.v1", LS_ACOMP = "farol.acompanhamento.v1", LS_MESES = "farol.balancetes.locais.v1", LS_GH = "farol.github.v1", LS_PER = "farol.periodo.v1";
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4200); }

const S = { base: {}, locais: {}, todos: [], meses: [], sev: new Set(["alta", "media", "baixa", "info"]), ids: null, limite: 300 };

// ---------------------------------------------------------------- dados
async function carregarBase(protegido) {
  if (protegido) {
    S.base = protegido.meses; S.acompBase = {};
    S.locais = ls.get(LS_MESES, {}); S.ordem = ls.get(LS_ORD, {});
    S.acompRemoto = JSON.parse(JSON.stringify(protegido.acompanhamento));
    S.acomp = mesclarAcomp(S.acompRemoto, ls.get(LS_ACOMP, {}));
    ls.set(LS_ACOMP, S.acomp);
    $("#analiseCurada").innerHTML = protegido.analise || "";
    S.orc = protegido.orcamento || [];
    juntar(); return;
  }
  try { const r = await fetch("data/analise.html", { cache: "no-store" }); if (r.ok) $("#analiseCurada").innerHTML = await r.text(); } catch {}
  S.orc = ls.get(LS_ORC, []);
  try {
    const r = await fetch("data/balancetes.json", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.base = j.meses || {};
    S.acompBase = j.acompanhamento || {};
  } catch { S.base = (window.__BASE_BALANCETES__ && window.__BASE_BALANCETES__.meses) || {}; S.acompBase = (window.__BASE_BALANCETES__ && window.__BASE_BALANCETES__.acompanhamento) || {}; }
  let remoto = {};
  try { const r = await fetch("data/acompanhamento.json", { cache: "no-store" }); if (r.ok) remoto = (await r.json()).itens || {}; } catch {}
  S.locais = ls.get(LS_MESES, {});
  S.ordem = ls.get(LS_ORD, {});
  S.acomp = mesclarAcomp(mesclarAcomp(S.acompBase, remoto), ls.get(LS_ACOMP, {}));
  S.acompRemoto = mesclarAcomp(S.acompBase, remoto);
  ls.set(LS_ACOMP, S.acomp);
  juntar();
}
function juntar() {
  const m = { ...S.base };
  for (const [k, b] of Object.entries(S.locais)) m[k] = { ...b, origem: "local" };
  S.todos = Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes));
  const nb = Object.keys(S.base).length, nl = Object.keys(S.locais).length;
  $("#statusBase").textContent = S.todos.length
    ? `${S.todos.length} meses (${rotuloMes(S.todos[0].mes)} a ${rotuloMes(S.todos.at(-1).mes)})${nl ? ` · ${nl} não publicado${nl > 1 ? "s" : ""}` : ""}`
    : "nenhum balancete";
  if (S.todos[0]?.condominio) $("#nomeCond").textContent = S.todos.at(-1).condominio;
  montarPeriodo();
}
function montarPeriodo() {
  const ops = S.todos.map((b) => `<option value="${b.mes}">${rotuloMes(b.mes)}</option>`).join("");
  const per = ls.get(LS_PER, null);
  const de = $("#de"), ate = $("#ate");
  de.innerHTML = ops; ate.innerHTML = ops;
  if (!S.todos.length) return;
  const temDe = per && S.todos.some((b) => b.mes === per.de);
  de.value = temDe ? per.de : S.todos[0].mes;
  // o "até" acompanha automaticamente o último mês carregado, a não ser que tenha sido fixado antes do fim
  ate.value = per && per.fixo && S.todos.some((b) => b.mes === per.ate) ? per.ate : S.todos.at(-1).mes;
}
function periodo() {
  let de = $("#de").value, ate = $("#ate").value;
  if (de > ate) [de, ate] = [ate, de];
  S.meses = S.todos.filter((b) => b.mes >= de && b.mes <= ate);
}

// ---------------------------------------------------------------- render geral
function render() {
  periodo();
  const A = alertas(S.meses);
  S.alertas = A;
  if (!S.meses.length) {
    for (const id of ["#kpis", "#grafMensal", "#leitura", "#miniCats", "#tabMensal"]) $(id).innerHTML = "";
    $("#kpis").innerHTML = `<div class="vazio card">Nenhum balancete carregado. Importe os PDFs na aba <a href="#dados">Importar PDF</a>.</div>`;
  } else {
    prepararAlertas(A);
    const n = A.filter((a) => a.sev === "alta" && ativo(a)).length;
    $("#cntAlertas").textContent = n || ""; $("#cntAlertas").hidden = !n;
    S.alertasTodos = alertas(S.todos); prepararAlertas(S.alertasTodos);
    S.novidades = novidades();
    painel(); acompanhamento(); renderExecutivo(S.meses, $("#secAnalises")); categorias(); fornecedores(); listaAlertas(); tabParcelas(); notas(); conselho();
    renderMes(S.todos, S.mesSel || S.meses.at(-1).mes, alertas(S.todos), $("#secMes"));
    renderProjecao(S.todos, $("#secProjecao"));
    resumoMes(); orcamentoTab(); prepararDoc();
  }
  lancTab(); dadosTab();
}



// ---------------------------------------------------------------- ordenação das tabelas (clique no título da coluna)
// A ordem escolhida fica guardada neste navegador e é reaplicada sempre que a tabela é redesenhada.
const ORD_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function valorOrd(txt) {
  const t = (txt || "").replace(/\s+/g, " ").trim();
  if (!t || t === "—" || t === "–" || t === "-") return null;
  let m = t.match(/^([a-zç]{3})\/(\d{4})/i);
  if (m && ORD_MES.includes(m[1].toLowerCase())) return +m[2] * 100 + ORD_MES.indexOf(m[1].toLowerCase()) + 1;
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return +(m[3] + m[2] + m[1]);
  m = t.match(/^(\d{2})\/(\d{4})$/); if (m) return +m[2] * 100 + +m[1];
  m = t.match(/^([−-])?\s*(?:R\$\s*)?([−-])?\s*(\d[\d.]*(?:,\d+)?)\s*(%|×|x|dia\(s\)|dias?)?$/i);
  if (m) return (m[1] || m[2] ? -1 : 1) * parseFloat(m[3].replace(/\./g, "").replace(",", "."));
  return t.toLocaleLowerCase("pt-BR");
}
function compara(a, b) {
  if (a === null && b === null) return 0; if (a === null) return 1; if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}
function chaveTab(t) {
  if (t.id) return t.id;
  const sec = t.closest("section[data-aba]");
  return `${sec ? sec.dataset.aba : "x"}:${[...(sec || document).querySelectorAll("table")].indexOf(t)}`;
}
function marcarCabecalho(t, o) {
  const ths = t.tHead ? [...t.tHead.rows[0].cells] : [];
  ths.forEach((th, i) => {
    th.classList.add("ordenavel"); th.tabIndex = 0;
    th.classList.toggle("ord-asc", !!o && o.col === i && o.dir === 1);
    th.classList.toggle("ord-desc", !!o && o.col === i && o.dir === -1);
    th.setAttribute("aria-sort", o && o.col === i ? (o.dir === 1 ? "ascending" : "descending") : "none");
    th.title = "Clique para ordenar";
  });
}
function ordenarDOM(t) {
  const o = S.ordem[chaveTab(t)];
  marcarCabecalho(t, o);
  const tb = t.tBodies[0]; if (!tb || t.id === "tabLanc") { if (tb) tb.dataset.ordenada = "1"; return; }
  const nCol = t.tHead ? t.tHead.rows[0].cells.length : 0;
  const grupos = [], fim = [];
  [...tb.rows].forEach((r, i) => {
    if (r.dataset.i === undefined) r.dataset.i = i;
    if (r.classList.contains("total")) { fim.push(r); return; }
    if (r.cells.length === nCol && !r.querySelector("[colspan]")) grupos.push([r]);
    else if (grupos.length) grupos.at(-1).push(r); else fim.push(r);
  });
  if (o) grupos.sort((x, y) => {
    const c = compara(valorOrd(x[0].cells[o.col]?.innerText), valorOrd(y[0].cells[o.col]?.innerText));
    return c ? c * o.dir : +x[0].dataset.i - +y[0].dataset.i;
  });
  else grupos.sort((x, y) => +x[0].dataset.i - +y[0].dataset.i);
  for (const g of grupos) for (const r of g) tb.appendChild(r);
  for (const r of fim) tb.appendChild(r);
  tb.dataset.ordenada = "1";
}
function aplicarOrdens() {
  document.querySelectorAll("main table").forEach((t) => {
    if (!t.tHead || !t.tHead.rows.length) return;
    const tb = t.tBodies[0];
    if (tb && tb.dataset.ordenada === "1" && t.tHead.rows[0].cells[0]?.classList.contains("ordenavel")) return;
    ordenarDOM(t);
  });
}
function clicarCabecalho(th) {
  const t = th.closest("table"), k = chaveTab(t), col = th.cellIndex, o = S.ordem[k];
  // 1º clique: crescente · 2º: decrescente · 3º: ordem original
  if (!o || o.col !== col) S.ordem[k] = { col, dir: 1 };
  else if (o.dir === 1) S.ordem[k] = { col, dir: -1 };
  else delete S.ordem[k];
  ls.set(LS_ORD, S.ordem);
  if (t.id === "tabLanc") { lancTab(); return; }
  ordenarDOM(t);
}
// lançamentos são paginados: a ordem é aplicada aos dados, antes de cortar a página
const LANC_ORD = [(d) => d.mes, (d) => d.cat, (d) => d.forn, (d) => valorOrd(d.ref), (d) => valorOrd(d.baixa), (d) => d.tipo, (d) => valorOrd(d.nf) ?? d.nf, (d) => d.v];

// ---------------------------------------------------------------- acompanhamento: gravação, sincronização e migração
const SYNC_ARQ = "data/acompanhamento.json";
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso || "");
const horaBR = (ts) => { try { return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
// registros antigos só tinham a data dd/mm/aaaa; convertida para comparar com os novos
const tsDe = (e) => e?.ts || (/(\d{2})\/(\d{2})\/(\d{4})/.test(e?.data || "") ? e.data.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1T00:00:00") : "");
function mesclarAcomp(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) if (!out[k] || tsDe(v) >= tsDe(out[k])) out[k] = v;
  return out;
}
const SIT_ABERTA = (s) => s !== "resolvido" && s !== "descartado";
// alerta que ainda pede ação: não foi respondido, resolvido nem descartado
const ativo = (a) => a.sit === "pendente" || a.sit === "questionado";
function registroDe(a) {
  // procura a anotação pela chave atual; se não achar, pela chave antiga ou pelos pontos que foram agrupados neste alerta
  if (S.acomp[a.chave]) return S.acomp[a.chave];
  const cands = [chaveAntiga(a), ...(a.partes || []).flatMap((p) => [chaveAlerta(p), chaveAntiga(p)])];
  const achados = cands.map((c) => [c, S.acomp[c]]).filter(([, e]) => e && !e.migradoPara).sort((x, y) => tsDe(y[1]).localeCompare(tsDe(x[1])));
  if (!achados.length) return null;
  const [velha, e] = achados[0];
  S.acomp[a.chave] = { ...e, hist: [...(e.hist || []), { ts: new Date().toISOString(), txt: "anotação trazida do alerta anterior" }] };
  if (!(a.partes || []).length) S.acomp[velha] = { ...e, migradoPara: a.chave, ts: new Date().toISOString() };
  S.acompMigrou = true;
  return S.acomp[a.chave];
}
function prepararAlertas(A) {
  for (const a of A) {
    a.chave = chaveAlerta(a);
    const e = registroDe(a) || {};
    a.sit = e.status || "pendente"; a.reg = e;
  }
  if (S.acompMigrou) { ls.set(LS_ACOMP, S.acomp); S.acompMigrou = false; agendarSync(); }
}
function salvarAcomp(chave, campos, nota) {
  const a = (S.alertasTodos || []).find((x) => x.chave === chave) || (S.alertas || []).find((x) => x.chave === chave);
  const atual = S.acomp[chave] || {};
  const agora = new Date().toISOString();
  const quem = nomeUsuario();
  const novo = { ...atual, ...campos, ts: agora, data: new Date().toLocaleDateString("pt-BR"), por: quem };
  if (a) novo.snap = { sev: a.sev, tipo: a.tipo, titulo: a.titulo, pergunta: a.pergunta || "", mes: a.mes || "" };
  if (nota) novo.hist = [...(atual.hist || []), { ts: agora, txt: nota, por: quem }].slice(-60);
  S.acomp[chave] = novo;
  const ok = ls.set(LS_ACOMP, S.acomp);
  if (!ok) toast("O navegador bloqueou a gravação. Desative o modo anônimo ou libere o armazenamento do site.");
  marcarSalvo(chave, ok);
  agendarSync();
  return novo;
}
function marcarSalvo(chave, ok) {
  document.querySelectorAll(`[data-salvo="${chave}"]`).forEach((el) => {
    el.textContent = ok ? `Salvo ${horaBR(new Date().toISOString())}${nomeUsuario() ? ` por ${nomeUsuario()}` : ""}` : "Não foi possível salvar";
    el.className = `salvo ${ok ? "ok" : "erro"}`;
  });
}
function mudarSituacao(chave, status) {
  const atual = S.acomp[chave] || {}, hoje = hojeISO(), campos = { status };
  if (status === "questionado" && !atual.enviado) { campos.enviado = hoje; if (!atual.prazo) campos.prazo = somaDias(hoje, +($("#prazoDias")?.value || 15)); }
  if (status === "respondido" && !atual.respondidoEm) campos.respondidoEm = hoje;
  if ((status === "resolvido" || status === "descartado") && !atual.encerradoEm) campos.encerradoEm = hoje;
  salvarAcomp(chave, campos, `marcou como ${SITUACOES[status]} (antes: ${SITUACOES[atual.status || "pendente"]})`);
}
// ---- sincronização automática com o GitHub (quando há token configurado na aba Importar PDF)
const podeSync = () => { if (AC.ligado) return podeEditar() ? { fb: true } : null; const g = ls.get(LS_GH, {}); return window.self === window.top && g.owner && g.repo && g.token ? g : null; };
function estadoSync(txt, cls) { S.syncTxt = txt; S.syncCls = cls; document.querySelectorAll(".sync-estado").forEach((el) => { el.textContent = txt; el.className = `sync-estado ${cls}`; }); }
function pendentesPublicar() {
  const r = S.acompRemoto || {};
  return Object.keys(S.acomp).filter((k) => JSON.stringify(S.acomp[k]) !== JSON.stringify(r[k])).length;
}
function descreverSync() {
  const n = pendentesPublicar();
  document.querySelectorAll("#btnSyncAgora").forEach((b) => { b.textContent = podeSync() ? "Enviar agora" : "Configurar compartilhamento"; b.hidden = !n && !!podeSync(); });
  if (!n) return estadoSync("Anotações em dia com o site publicado", "ok");
  if (AC.ligado && !podeEditar()) return estadoSync("Perfil de visualização: as anotações não podem ser alteradas", "ok");
  if (podeSync()) return estadoSync(`${n} anotação(ões) aguardando envio${AC.ligado ? "" : " ao GitHub"}`, "aguarda");
  estadoSync(`${n} anotação(ões) salvas só neste navegador. Configure o GitHub na aba Importar PDF para compartilhar com o conselho.`, "local");
}
function agendarSync() {
  clearTimeout(agendarSync.t);
  descreverSync();
  if (podeSync()) agendarSync.t = setTimeout(sincronizar, AC.ligado ? 1200 : 2500);
}
async function sincronizar() {
  const cfg = podeSync(); if (!cfg) return descreverSync();
  if (cfg.fb) {
    if (sincronizar.rodando) return agendarSync();
    sincronizar.rodando = true; estadoSync("Gravando…", "aguarda");
    const r = S.acompRemoto || {}, mud = {};
    for (const k of Object.keys(S.acomp)) if (JSON.stringify(S.acomp[k]) !== JSON.stringify(r[k])) mud[k] = S.acomp[k];
    try {
      if (Object.keys(mud).length) await gravarAcomp(mud);
      Object.assign(r, JSON.parse(JSON.stringify(mud))); S.acompRemoto = r;
      estadoSync(`Compartilhado com o conselho às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, "ok");
    } catch (e) { estadoSync(`Salvo neste navegador, mas não foi possível gravar na base (${mensagemErro(e)}).`, "erro"); }
    sincronizar.rodando = false; return;
  }
  if (sincronizar.rodando) return agendarSync();
  sincronizar.rodando = true; estadoSync("Enviando anotações ao GitHub…", "aguarda");
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${SYNC_ARQ}`;
  const hdr = { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" };
  try {
    let sha, remoto = {};
    const g = await fetch(`${url}?ref=${encodeURIComponent(cfg.branch || "main")}`, { headers: hdr, cache: "no-store" });
    if (g.ok) { const j = await g.json(); sha = j.sha; try { remoto = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)))).itens || {}; } catch {} }
    else if (g.status !== 404) throw new Error(`GitHub respondeu ${g.status}`);
    // junta o que outro conselheiro gravou nesse meio-tempo, ficando com a versão mais recente de cada item
    const final = mesclarAcomp(remoto, S.acomp);
    const p = await fetch(url, { method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Acompanhamento do conselho fiscal", branch: cfg.branch || "main", sha,
        content: b64(JSON.stringify({ atualizado: new Date().toISOString(), itens: final }, null, 1)) }) });
    if (!p.ok) throw new Error(`GitHub recusou (${p.status})`);
    S.acomp = final; S.acompRemoto = JSON.parse(JSON.stringify(final)); ls.set(LS_ACOMP, S.acomp);
    estadoSync(`Compartilhado com o conselho às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, "ok");
  } catch (e) { estadoSync(`Salvo neste navegador, mas o envio ao GitHub falhou (${e.message}). Nova tentativa na próxima alteração.`, "erro"); }
  sincronizar.rodando = false;
}

// ---------------------------------------------------------------- acompanhamento: tela
function novidades() {
  if (S.todos.length < 2) return null;
  const ult = S.todos.at(-1), ant = S.todos.at(-2);
  const antes = alertas(S.todos.slice(0, -1)).map(chaveAlerta), setA = new Set(antes);
  const agora = S.alertasTodos;
  const conhecida = (a) => setA.has(a.chave) || (a.partes || []).some((p) => setA.has(chaveAlerta(p)));
  const novos = agora.filter((a) => !conhecida(a) && a.sev !== "info");
  novos.forEach((a) => (a.novo = true)); S.novosSet = new Set(novos.map((a) => a.chave));
  const setN = new Set(agora.flatMap((a) => [a.chave, ...(a.partes || []).map(chaveAlerta)]));
  const sumiram = alertas(S.todos.slice(0, -1)).filter((a) => !setN.has(chaveAlerta(a)) && a.sev !== "info");
  const fAnt = new Set(porFornecedor(S.todos.slice(0, -1)).map((f) => f.forn));
  const fNovos = porFornecedor([ult]).filter((f) => !fAnt.has(f.forn));
  return { ult, ant, novos, sumiram, fNovos };
}
function linhaAging(e, sit) {
  const hoje = hojeISO();
  if (!SIT_ABERTA(sit)) return e.encerradoEm ? `<span class="aging ok">encerrado em ${dataBR(e.encerradoEm)}</span>` : "";
  if (sit === "questionado" && e.prazo) {
    const d = diasEntre(hoje, e.prazo);
    return d < 0 ? `<span class="aging venc">prazo vencido há ${-d} dia(s)</span>` : `<span class="aging">${d === 0 ? "vence hoje" : `vence em ${d} dia(s)`}</span>`;
  }
  if (sit === "respondido") return `<span class="aging resp">resposta a analisar${e.respondidoEm ? ` desde ${dataBR(e.respondidoEm)}` : ""}</span>`;
  if (e.enviado) return `<span class="aging">enviado há ${diasEntre(e.enviado, hoje)} dia(s)</span>`;
  return "";
}
// "Maria Silva marcou como Respondido em 16/11/2026, 16:30"
function linhaHist(h) {
  return `<li>${h.por ? `<b>${esc(h.por)}</b> ` : ""}${esc(h.txt)} <span class="mini">em ${horaBR(h.ts)}</span></li>`;
}
function editorAcomp(a) {
  const e = S.acomp[a.chave] || {};
  if (!podeEditar()) return `<div class="acomp somente-leitura"><div class="acomp-rodape"><span class="sit ${a.sit}">${SITUACOES[a.sit]}</span>${e.enviado ? `<span class="mini">enviado em ${dataBR(e.enviado)}</span>` : ""}${e.prazo ? `<span class="mini">prazo ${dataBR(e.prazo)}</span>` : ""}${linhaAging(e, a.sit)}</div>${e.resposta ? `<div class="orfa-txt">${esc(e.resposta)}</div>` : ""}</div>`;
  return `<div class="acomp">
    <div class="acomp-campos">
      <label>Situação<select data-acomp="${a.chave}">${Object.entries(SITUACOES).map(([k, t]) => `<option value="${k}" ${a.sit === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label>Enviado em<input type="date" data-campo="enviado" data-chave="${a.chave}" value="${esc(e.enviado || "")}"></label>
      <label>Prazo de resposta<input type="date" data-campo="prazo" data-chave="${a.chave}" value="${esc(e.prazo || "")}"></label>
      <label>Aguardando resposta de<input data-campo="responsavel" data-chave="${a.chave}" list="listaResp" value="${esc(e.responsavel || "")}" placeholder="Síndico" autocomplete="off"></label>
    </div>
    <label class="acomp-resp">Resposta da administradora / anotação do conselho
      <textarea data-resp="${a.chave}" rows="3" placeholder="Registre a resposta recebida ou a providência combinada. Grava sozinho enquanto você digita.">${esc(e.resposta || "")}</textarea></label>
    <div class="acomp-rodape"><span data-salvo="${a.chave}" class="salvo">${e.ts ? `Salvo ${horaBR(e.ts)}${e.por ? ` por ${esc(e.por)}` : ""}` : e.data ? `Salvo em ${esc(e.data)}` : ""}</span>${linhaAging(e, a.sit)}
      ${(e.hist || []).length ? `<details class="hist"><summary>Histórico (${e.hist.length})</summary><ul>${[...e.hist].reverse().map(linhaHist).join("")}</ul></details>` : ""}
    </div>
  </div>`;
}
// pontos que importam ao conselho: prioridade alta/média ou já acompanhados
const relevantesTodos = () => (S.alertasTodos || []).filter((a) => a.sev === "alta" || a.sev === "media" || S.acomp[a.chave]);
const aguardandoResposta = () => relevantesTodos().filter((a) => a.sit === "questionado");
// a quem a pergunta foi feita: campo "Responsável" do alerta; sem preenchimento, o síndico
const DESTINO = { "Síndico": "do síndico", "Administradora": "da administradora", "Conselho fiscal": "do conselho fiscal", "Assembleia": "da assembleia" };
const destinoDe = (a) => ((S.acomp[a.chave] && S.acomp[a.chave].responsavel) || "").trim() || "Síndico";
const preposicao = (d) => DESTINO[d] || DESTINO[Object.keys(DESTINO).find((k) => k.toLowerCase() === d.toLowerCase())] || `de ${d}`;
function gruposAguard(lista) {
  const g = new Map(); for (const a of lista) { const d = destinoDe(a); if (!g.has(d)) g.set(d, []); g.get(d).push(a); }
  return [...g.entries()].map(([d, itens]) => ({ d, rot: `Aguardando resposta ${preposicao(d)}`, itens }));
}
const rotAguard = (lista) => { const g = gruposAguard(lista); return g.length === 1 ? g[0].rot : "Aguardando resposta"; };
const PARECERES = {
  validado: { rot: "Validado", icone: "✅", cls: "ok" },
  ressalvas: { rot: "Validado com ressalvas", icone: "⚠️", cls: "atencao" },
  analise: { rot: "Em análise", icone: "🔎", cls: "analise" },
  nao: { rot: "Não validado", icone: "❌", cls: "critico" },
};
// automático: não validado se os totais não fecham; validado quando o mês foi marcado "Aprovado"
// (com ressalvas se houver pergunta aguardando resposta); senão, em análise
function parecerDe(b, forcado = "auto") {
  const confere = (b.conferencia || conferir(b)).ok, aprovado = !!(S.acomp[`chk:${b.mes}`] || {}).aprovado, aguard = aguardandoResposta();
  const cod = forcado !== "auto" ? forcado : !confere ? "nao" : aprovado ? (aguard.length ? "ressalvas" : "validado") : "analise";
  return { cod, ...PARECERES[cod], confere, aprovado, aguard };
}
const MESES_EXT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesExtenso = (k) => `${MESES_EXT[+k.slice(5, 7) - 1]} de ${k.slice(0, 4)}`;
// texto curto e neutro para moradores; o conselho revisa antes de enviar
function gerarWhats() {
  const ctx = S.whatsCtx; if (!ctx || !S.todos.length) return;
  const b = S.todos.at(-1), t = b.totais, res = t.receitas - t.despesas;
  const ehResp = (a) => a.sit === "respondido", ehResolv = (a) => a.sit === "resolvido";
  const comResp = ctx.relevantes.filter((a) => (ehResp(a) || ehResolv(a)) && (S.acomp[a.chave]?.resposta || "").trim())
    .sort((x, y) => tsDe(S.acomp[y.chave]).localeCompare(tsDe(S.acomp[x.chave]))).slice(0, 5);
  // parecer: escolhido pelo conselho ou deduzido da conferência e da etapa "Aprovado"
  const pd = parecerDe(b, $("#whatsParecer")?.value || "auto"), par = pd.cod, confere = pd.confere, aguard = pd.aguard;
  const mesC = rotuloMes(b.mes);
  const parecer = {
    validado: `✅ *Balancete de ${mesC}: validado.*`,
    ressalvas: `⚠️ *Balancete de ${mesC}: validado com ressalvas.*`,
    analise: `🔎 *Balancete de ${mesC}: em análise.*`,
    nao: `❌ *Balancete de ${mesC}: não validado.*${confere ? "" : " Os totais não fecham."}`,
  }[par];
  const curto = (txt) => txt.replace(/\s*\(R\$[^)]*em aberto\)/, "").replace(/\s+/g, " ").trim();
  // versão enxuta: parecer, quatro números e pendências
  const linhas = [
    `*Conselho Fiscal · ${(b.condominio || "Condomínio").replace(/^Condom[ií]nio\s+/i, "")}*`,
    parecer,
    "",
    `Receitas ${brl(t.receitas)} · Despesas ${brl(t.despesas)}`,
    `${res >= 0 ? "Sobra" : "Falta"} no mês ${brl(Math.abs(res))} · Saldo em caixa ${brl(t.saldoAtual)}`,
  ];
  for (const gr of gruposAguard(aguard)) linhas.push("", `📌 ${gr.rot}:`, ...gr.itens.slice(0, 3).map((a) => `• ${curto(a.titulo).replace(": ", " – ")}`), ...(gr.itens.length > 3 ? [`• e mais ${gr.itens.length - 3}`] : []));
  if ($("#whatsResp")?.checked && comResp.length) linhas.push("", ...comResp.slice(0, 3).map((a) => `• ${curto(a.titulo)}: ${S.acomp[a.chave].resposta.trim().replace(/\s+/g, " ")}`));
  if ($("#whatsLink")?.checked && /github\.io$/.test(location.hostname)) linhas.push("", `Detalhes: ${location.origin}${location.pathname}`);
  linhas.push("", "Dúvidas: fale com o Conselho Fiscal.");
  $("#whatsTexto").value = linhas.join("\n");
  S.whatsEditado = false; atualizarWhats();
}
function atualizarWhats() {
  const v = $("#whatsTexto").value;
  $("#abrirWhats").href = "https://wa.me/?text=" + encodeURIComponent(v);
  $("#whatsInfo").textContent = `${v.length.toLocaleString("pt-BR")} caracteres${S.whatsEditado ? " · editado por você (clique em Gerar novamente para recalcular)" : " · gerado do último balancete"}`;
}
function acompanhamento() {
  const A = S.alertasTodos || [], hoje = hojeISO();
  const relevantes = A.filter((a) => a.sev === "alta" || a.sev === "media" || S.acomp[a.chave]);
  const reg = (a) => S.acomp[a.chave] || {};
  const abertos = relevantes.filter((a) => SIT_ABERTA(a.sit));
  const venc = abertos.filter((a) => a.sit === "questionado" && reg(a).prazo && reg(a).prazo < hoje);
  const aguard = abertos.filter((a) => a.sit === "questionado");
  S.vencidos = venc;
  const tempos = Object.values(S.acomp).filter((e) => e.enviado && e.respondidoEm).map((e) => diasEntre(e.enviado, e.respondidoEm));
  const medio = tempos.length ? Math.round(tempos.reduce((x, y) => x + y, 0) / tempos.length) : null;
  const encerr = relevantes.filter((a) => !SIT_ABERTA(a.sit)).length;
  $("#kpisPauta").innerHTML = [
    ["Em aberto", abertos.length, "prioridade alta e média", abertos.length ? "neg" : "pos"],
    ["Aguardando resposta", aguard.length, "perguntas já enviadas", ""],
    ["Prazos vencidos", venc.length, venc.length ? "cobrar resposta" : "nenhum atraso", venc.length ? "neg" : "pos"],
    ["Tempo médio de resposta", medio === null ? "—" : `${medio} dia(s)`, tempos.length ? `${tempos.length} resposta(s) registradas` : "registre envio e resposta", ""],
    ["Encerrados", encerr, "resolvidos ou sem procedência", "pos"],
  ].map(([t, v, d, c]) => `<div class="kpi ${c}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span></div>`).join("");

  // novidades do último balancete
  const nv = S.novidades;
  $("#novidades").innerHTML = !nv ? `<p class="muted small">Importe ao menos dois balancetes para comparar.</p>` : (() => {
    const r = nv.ult.totais, p = nv.ant.totais, dr = r.receitas - p.receitas, dd = r.despesas - p.despesas;
    const seta = (v, inv) => `<span class="delta ${v === 0 ? "neutro" : (v > 0) !== inv ? "bom" : "ruim"}">${v > 0 ? "▲" : v < 0 ? "▼" : "■"} ${brl(Math.abs(v))}</span>`;
    return `<div class="nov-grid">
      <div class="nov-num"><span class="eyebrow">Receita</span><b>${brl(r.receitas)}</b>${seta(dr, false)}</div>
      <div class="nov-num"><span class="eyebrow">Despesa</span><b>${brl(r.despesas)}</b>${seta(dd, true)}</div>
      <div class="nov-num"><span class="eyebrow">Resultado</span><b class="${r.receitas - r.despesas < 0 ? "neg" : ""}">${brl(r.receitas - r.despesas)}</b><span class="mini">mês anterior: ${brl(p.receitas - p.despesas)}</span></div>
      <div class="nov-num"><span class="eyebrow">Saldo final</span><b class="${r.saldoAtual < 0 ? "neg" : ""}">${brl(r.saldoAtual)}</b>${seta(r.saldoAtual - p.saldoAtual, false)}</div>
    </div>
    <div class="nov-listas">
      <div><h4>Alertas novos <span class="cnt-n">${nv.novos.length}</span></h4>${nv.novos.length ? `<ul>${nv.novos.map((a) => `<li><span class="pill ${a.sev}">${SEV[a.sev]}</span> <a href="#alertas" data-ir-alerta="${a.chave}">${esc(a.titulo)}</a></li>`).join("")}</ul>` : `<p class="muted small">Nenhum alerta novo.</p>`}</div>
      <div><h4>Deixaram de aparecer <span class="cnt-n">${nv.sumiram.length}</span></h4>${nv.sumiram.length ? `<ul>${nv.sumiram.map((a) => `<li class="muted">${esc(a.titulo)}</li>`).join("")}</ul><p class="mini">Em geral a despesa voltou a ser paga ou a situação se normalizou. Confira antes de encerrar.</p>` : `<p class="muted small">Nada saiu da lista.</p>`}</div>
      <div><h4>Fornecedores novos <span class="cnt-n">${nv.fNovos.length}</span></h4>${nv.fNovos.length ? `<ul>${nv.fNovos.map((f) => `<li>${esc(f.forn)} · ${brl(f.total)}</li>`).join("")}</ul>` : `<p class="muted small">Nenhum fornecedor novo.</p>`}</div>
    </div>`;
  })();
  $("#tituloNovidades").textContent = nv ? `O que mudou em ${rotuloMes(nv.ult.mes)}` : "O que mudou no último balancete";

  // pauta de pendências
  const ordemSit = { questionado: 0, respondido: 1, pendente: 2, resolvido: 3, descartado: 4 }, SEVN = { alta: 0, media: 1, baixa: 2, info: 3 };
  const pauta = [...abertos].sort((x, y) => (venc.includes(y) - venc.includes(x)) || ordemSit[x.sit] - ordemSit[y.sit] || SEVN[x.sev] - SEVN[y.sev]);
  $("#pauta").innerHTML = pauta.length ? `<thead><tr><th>Prioridade</th><th>Assunto</th><th>Situação</th><th>Enviado</th><th>Prazo</th><th>Andamento</th><th>Resposta de</th><th>Última anotação</th></tr></thead><tbody>${pauta.map((a) => { const e = reg(a); return `<tr class="${venc.includes(a) ? "linha-venc" : ""}">
    <td><span class="pill ${a.sev}">${SEV[a.sev]}</span>${a.novo ? ' <span class="pill novo">novo</span>' : ""}</td>
    <td><a href="#alertas" data-ir-alerta="${a.chave}">${esc(a.titulo)}</a></td><td><span class="sit ${a.sit}">${SITUACOES[a.sit]}</span></td>
    <td class="num">${dataBR(e.enviado) || "—"}</td><td class="num">${dataBR(e.prazo) || "—"}</td><td>${linhaAging(e, a.sit) || '<span class="mini">não enviado</span>'}</td>
    <td>${esc(e.responsavel || "—")}</td><td class="mini" style="max-width:280px">${esc((e.resposta || "").slice(0, 140))}${(e.resposta || "").length > 140 ? "…" : ""}</td></tr>`; }).join("")}</tbody>` : `<tbody><tr><td class="muted">Nenhuma pendência em aberto.</td></tr></tbody>`;

  // ofício com o que ainda não foi enviado
  const naoEnviados = abertos.filter((a) => a.sit === "pendente" && a.pergunta);
  S.oficio = naoEnviados;
  const dias = +($("#prazoDias").value || 15);
  $("#oficio").textContent = naoEnviados.length ? `À Logo Gestão Condominial
Ref.: ${S.todos.at(-1)?.condominio || "Condomínio"} · esclarecimentos sobre os demonstrativos de ${rotuloMes(S.todos[0].mes)} a ${rotuloMes(S.todos.at(-1).mes)}

O Conselho Fiscal solicita, no prazo de ${dias} dias (até ${dataBR(somaDias(hoje, dias))}), os esclarecimentos e documentos abaixo:

${naoEnviados.map((a, i) => `${i + 1}. ${a.pergunta}`).join("\n\n")}

Salvador, ${dataBR(hoje)}.

Conselho Fiscal` : "Todas as perguntas de prioridade alta e média já foram enviadas ou encerradas.";
  $("#nOficio").textContent = naoEnviados.length ? `${naoEnviados.length} pergunta(s) ainda não enviadas` : "nada a enviar";
  $("#marcarEnviados").disabled = !naoEnviados.length;

  // mensagem para o grupo de avisos do WhatsApp
  S.whatsCtx = { relevantes, abertos, aguard };
  if (!S.whatsEditado) gerarWhats();

  // conferência mensal
  const ETAPAS = [["confere", "Balancete fecha", true], ["extrato", "Extrato conferido"], ["nf", "NFs conferidas"], ["notas", "Notas explicativas lidas"], ["alertas", "Alertas tratados", true], ["aprovado", "Aprovado"]];
  $("#checklist").innerHTML = `<thead><tr><th>Mês</th>${ETAPAS.map(([, t]) => `<th class="c">${t}</th>`).join("")}<th class="c">Progresso</th></tr></thead><tbody>${[...S.todos].reverse().map((b) => {
    const ch = S.acomp[`chk:${b.mes}`] || {};
    const pend = A.filter((a) => a.mes === b.mes && (a.sev === "alta" || a.sev === "media") && a.sit === "pendente").length;
    let ok = 0;
    const cel = ETAPAS.map(([k]) => {
      if (k === "confere") { const c = (b.conferencia || conferir(b)).ok; ok += c; return `<td class="c">${c ? '<span class="ck on" title="Totais conferidos automaticamente">✓</span>' : '<span class="ck x">diverge</span>'}</td>`; }
      if (k === "alertas") { ok += !pend; return `<td class="c">${pend ? `<a href="#acompanhamento" class="ck x" title="Alertas pendentes deste mês">${pend} pendente(s)</a>` : '<span class="ck on">✓</span>'}</td>`; }
      ok += !!ch[k];
      return `<td class="c"><button type="button" class="ck ${ch[k] ? "on" : ""}" ${podeEditar() ? "" : "disabled"} data-chk="${b.mes}" data-etapa="${k}" aria-pressed="${!!ch[k]}" title="${ch[k] ? `Marcado em ${esc(ch[k])}` : "Marcar como feito"}">${ch[k] ? "✓" : ""}</button></td>`;
    }).join("");
    return `<tr><td><b>${rotuloMes(b.mes)}</b></td>${cel}<td class="c"><div class="prog"><span style="width:${(ok / ETAPAS.length) * 100}%"></span></div><span class="mini">${ok}/${ETAPAS.length}</span></td></tr>`;
  }).join("")}</tbody>`;

  // anotações que não batem com nenhum alerta atual
  const usadas = new Set(A.map((a) => a.chave));
  const orfas = Object.entries(S.acomp).filter(([k, e]) => !k.startsWith("chk:") && !e.migradoPara && !usadas.has(k) && (e.resposta || (e.status && e.status !== "pendente")));
  $("#orfas").hidden = !orfas.length;
  $("#listaOrfas").innerHTML = orfas.map(([k, e]) => `<li><div><b>${esc(e.snap?.titulo || "Alerta que não aparece mais nos dados")}</b> <span class="sit ${e.status || "pendente"}">${SITUACOES[e.status || "pendente"]}</span></div>${e.resposta ? `<div class="orfa-txt">${esc(e.resposta)}</div>` : ""}<div class="mini">Última alteração: ${e.ts ? horaBR(e.ts) : esc(e.data || "—")}</div></li>`).join("");
  $("#cntVenc").textContent = venc.length || ""; $("#cntVenc").hidden = !venc.length;
  // faixa no resumo executivo
  const nNov = S.novidades ? S.novidades.novos.length : 0;
  $("#faixaAcomp").innerHTML = `<a href="#acompanhamento" class="faixa-acomp ${venc.length ? "venc" : ""}">
    <span class="fa-tit">Acompanhamento do conselho</span>
    <span><b>${abertos.length}</b> em aberto</span><span><b>${aguard.length}</b> aguardando resposta</span>
    <span class="${venc.length ? "fa-venc" : ""}"><b>${venc.length}</b> prazo(s) vencido(s)</span>
    ${S.novidades ? `<span><b>${nNov}</b> alerta(s) novo(s) em ${rotuloMes(S.novidades.ult.mes)}</span>` : ""}
    <span class="sync-estado"></span><span class="fa-ir">Abrir →</span></a>`;
  descreverSync();
}

// ---------------------------------------------------------------- painel
function spark(vals, cor, zero = false) {
  if (vals.length < 2) return "";
  const W = 200, H = 34, lo = Math.min(...vals, zero ? 0 : Infinity), hi = Math.max(...vals, zero ? 0 : -Infinity), sp = hi - lo || 1;
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 6) + 3, H - 4 - ((v - lo) / sp) * (H - 8)]);
  const z = H - 4 - ((0 - lo) / sp) * (H - 8);
  const area = `M${xy[0][0]},${H} L${xy.map((p) => p.join(",")).join(" L")} L${xy.at(-1)[0]},${H} Z`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${zero && lo < 0 ? `<line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="var(--line-2)" stroke-dasharray="3 3"/>` : ""}
    <path d="${area}" fill="${cor}" opacity=".12"/><polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${cor}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <circle cx="${xy.at(-1)[0]}" cy="${xy.at(-1)[1]}" r="3" fill="${cor}"/></svg>`;
}
function situacao(ind) {
  const rm = ind.rm, ult3 = rm.slice(-3);
  const negRecente = ult3.some((m) => m.saldo < 0);
  const res3 = ult3.reduce((s, m) => s + m.resultado, 0);
  const altas = S.alertas.filter((a) => a.sev === "alta" && ativo(a)).length;
  const ult = rm.at(-1);
  const folgaMes = ult.saldo / (ult3.reduce((s, m) => s + m.despesa, 0) / ult3.length || 1);
  if (negRecente || ult.saldo < 0) return { cls: "critico", rotulo: "Crítica", titulo: "Caixa no limite",
    texto: `O saldo ficou negativo nos últimos meses e o condomínio depende do limite bancário. Há ${altas} ponto(s) de prioridade alta para esclarecer com a administradora.` };
  if (res3 < 0 || folgaMes < 0.25 || altas) return { cls: "atencao", rotulo: "Atenção", titulo: res3 < 0 ? "Despesas acima da arrecadação" : "Caixa positivo, mas sem reserva",
    texto: `Saldo de ${brl(ult.saldo)} em ${rotuloMes(ult.mes)}, equivalente a ${(folgaMes * 30).toFixed(0)} dias de despesa média. ${altas ? `${altas} ponto(s) de prioridade alta ainda precisam de esclarecimento.` : ""}` };
  return { cls: "estavel", rotulo: "Estável", titulo: "Contas equilibradas", texto: `Resultado positivo nos últimos três meses e saldo de ${brl(ult.saldo)} em ${rotuloMes(ult.mes)}.` };
}
function painel() {
  const ind = indicadores(S.meses);
  S.ind = ind;
  const rm = ind.rm, ult = rm.at(-1);
  const st = situacao(ind);
  $("#statusCard").className = `card status ${st.cls}`;
  $("#statusPill").className = `pill ${st.cls}`; $("#statusPill").textContent = st.rotulo;
  $("#statusTitulo").textContent = st.titulo;
  $("#statusTexto").textContent = st.texto;
  const ult3 = rm.slice(-3);
  const med3r = ult3.reduce((s, m) => s + m.receita, 0) / ult3.length, med3d = ult3.reduce((s, m) => s + m.despesa, 0) / ult3.length;
  $("#statusFatos").innerHTML = [
    ["Saldo em " + rotuloMes(ult.mes), brl(ult.saldo), ult.saldo < 0],
    ["Menor saldo do período", `${brl(ind.menor.saldo)} (${rotuloMes(ind.menor.mes)})`, ind.menor.saldo < 0],
    ["Média dos 3 últimos meses", `${brl(med3r - med3d)}/mês`, med3r - med3d < 0],
    ["Meses com déficit", `${rm.filter((m) => m.resultado < 0).length} de ${rm.length}`, false],
  ].map(([t, v, neg]) => `<li><span class="muted">${t}</span><b style="${neg ? "color:var(--crit)" : ""}">${v}</b></li>`).join("");

  const kp = [
    ["Receita acumulada", brl(ind.receita), `${rm.length} meses · média ${brl(ind.receita / rm.length)}/mês`, "", spark(rm.map((m) => m.receita), "var(--accent)")],
    ["Despesa acumulada", brl(ind.despesa), `${pct(ind.receita ? ind.despesa / ind.receita : 0)} da receita`, "", spark(rm.map((m) => m.despesa), "var(--desp)")],
    ["Resultado do período", brl(ind.resultado), ind.resultado < 0 ? "gastou mais do que arrecadou" : "sobra acumulada", ind.resultado < 0 ? "neg" : "pos", spark(rm.map((m) => m.resultado), ind.resultado < 0 ? "var(--crit)" : "var(--ok)", true)],
    [`Saldo de caixa · ${rotuloMes(ult.mes)}`, brl(ind.saldoFinal), `início do período: ${brl(S.meses[0].totais.saldoAnterior ?? 0)}`, ind.saldoFinal < 0 ? "neg" : "", spark(rm.map((m) => m.saldo), "var(--gold)", true)],
  ];
  $("#kpis").innerHTML = kp.map(([t, v, d, c, g]) => `<div class="kpi ${c}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span>${g}</div>`).join("");
  const k2 = [
    ["Juros, IOF e multas", brl(ind.fin.total), "custo de atraso e saldo negativo", ind.fin.total > 0 ? "neg" : ""],
    ["Parcelas a vencer", brl(ind.compromissos), "compras já parceladas", ""],
    ["Pessoal / receita", pct(ind.pessoalPct), "folha, RH terceirizado e tributos", ""],
    ["Alertas de prioridade alta", String(S.alertas.filter((a) => a.sev === "alta" && ativo(a)).length), `${S.alertas.filter((a) => a.sev === "media" && ativo(a)).length} de prioridade média · sem resposta`, S.alertas.some((a) => a.sev === "alta" && ativo(a)) ? "neg" : "pos"],
  ];
  $("#kpis2").innerHTML = k2.map(([t, v, d, c]) => `<div class="kpi ${c}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span></div>`).join("");
  $("#grafMensal").innerHTML = comboMensal(rm);
  const sd = saude(S.meses, S.alertas);
  $("#saude").innerHTML = sd.html;

  const L = [];
  const def = rm.filter((m) => m.resultado < 0);
  L.push([def.length > rm.length / 3 ? "alta" : "", `Despesa maior que a receita em <b>${def.length} de ${rm.length}</b> meses.`]);
  const neg = rm.filter((m) => m.saldo < 0);
  if (neg.length) L.push(["alta", `Saldo negativo em ${neg.map((m) => rotuloMes(m.mes)).join(", ")}.`]);
  else L.push(["ok", "Nenhum mês fechou com saldo negativo."]);
  if (ult3.length === 3) L.push([med3d > med3r ? "media" : "ok", `Últimos 3 meses: receita média de ${brl(med3r)} e despesa média de ${brl(med3d)}.`]);
  const topCat = ind.cats[0];
  if (topCat) L.push(["", `${topCat.cat} é a maior despesa: ${brl(topCat.total)} (${pct(topCat.total / ind.despesa)} do total).`]);
  const topF = porFornecedor(S.meses)[0];
  if (topF) L.push(["", `Maior fornecedor: ${esc(topF.forn)}, com ${brl(topF.total)} (${pct(topF.total / ind.despesa)}).`]);
  if (ind.fin.total) L.push(["media", `Juros, IOF e multas por atraso somam ${brl(ind.fin.total)}.`]);
  $("#leitura").innerHTML = L.map(([c, t]) => `<li class="${c}"><span>${t}</span></li>`).join("");

  const top = S.alertas.filter((a) => a.sev === "alta" && ativo(a)).slice(0, 6);
  $("#topAlertas").innerHTML = top.length ? top.map((a) => `<a href="#alertas"><span class="pill alta">${esc(a.tipo)}</span><span class="t">${esc(a.titulo)}</span></a>`).join("")
    : `<p class="muted small">Nenhum alerta de prioridade alta sem resposta no período.</p>`;

  $("#treemap").innerHTML = treemapCategorias(S.meses);
  $("#miniCats").innerHTML = listaTendencia(S.meses);

  const linhas = rm.map((m) => `<tr><td>${rotuloMes(m.mes)}${S.meses.find((b) => b.mes === m.mes).origem === "local" ? ' <span class="pill local">não publicado</span>' : ""}</td>
    <td class="n">${brl(m.receita)}</td><td class="n">${brl(m.despesa)}</td><td class="n ${m.resultado < 0 ? "neg" : ""}">${brl(m.resultado)}</td>
    <td class="n ${m.saldo < 0 ? "neg" : ""}">${brl(m.saldo)}</td><td class="n">${pct(m.receita ? m.despesa / m.receita : 0)}</td></tr>`).join("");
  $("#tabMensal").innerHTML = `<thead><tr><th>Mês</th><th class="n">Receita</th><th class="n">Despesa</th><th class="n">Resultado</th><th class="n">Saldo final</th><th class="n">Despesa/receita</th></tr></thead>
    <tbody>${linhas}<tr class="total"><td>Total</td><td class="n">${brl(ind.receita)}</td><td class="n">${brl(ind.despesa)}</td><td class="n ${ind.resultado < 0 ? "neg" : ""}">${brl(ind.resultado)}</td><td class="n">${brl(ind.saldoFinal)}</td><td class="n">${pct(ind.receita ? ind.despesa / ind.receita : 0)}</td></tr></tbody>`;
}

// ---------------------------------------------------------------- categorias
function categorias() {
  const cats = porCategoria(S.meses);
  const ms = S.meses.map((b) => b.mes);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length ? (s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2) : 0; };
  const totMes = Object.fromEntries(ms.map((m) => [m, S.meses.find((b) => b.mes === m).totais.despesas]));
  $("#tabCats").innerHTML = mapaCalor(S.meses);
  $("#grafCats").innerHTML = multiplos(S.meses);
}

// ---------------------------------------------------------------- fornecedores
function fornecedores() {
  const q = $("#buscaForn").value.trim().toLowerCase();
  const fs = porFornecedor(S.meses), tot = fs.reduce((s, f) => s + f.total, 0), nm = S.meses.length;
  const lin = fs.filter((f) => !q || f.forn.toLowerCase().includes(q)).map((f, i) => `<tr>
    <td class="n mini">${i + 1}</td><td><button class="link" data-detalhe-forn="${esc(f.forn)}">${esc(f.forn)}</button> <button class="link mini" data-forn="${esc(f.forn)}">lançamentos</button><div class="mini">${esc([...f.cats].join(" · "))}</div></td>
    <td class="n">${brl(f.total)}</td><td class="n mini">${pct(f.total / tot)}</td><td class="n">${f.n}</td><td class="n">${f.meses.size}/${nm}</td>
    <td class="n">${brl(f.total / f.meses.size)}</td><td class="n mini">${rotuloMes(f.primeiro)} – ${rotuloMes(f.ultimo)}</td></tr>`).join("");
  renderFornecedor(S.meses, S.fornSel, S.alertas, $("#fichaForn"));
  $("#tabForn").innerHTML = `<thead><tr><th class="n">#</th><th>Fornecedor</th><th class="n">Total</th><th class="n">%</th><th class="n">Lanç.</th><th class="n">Meses</th><th class="n">Média/mês pago</th><th class="n">Período</th></tr></thead><tbody>${lin}</tbody>`;
}

// ---------------------------------------------------------------- alertas
const SEV = { alta: "Alta", media: "Média", baixa: "Baixa", info: "Informativo" };
function listaAlertas() {
  const A = S.alertas;
  S.sit ||= new Set(Object.keys(SITUACOES));
  $("#filtroSev").innerHTML = Object.entries(SEV).map(([k, t]) => `<button type="button" class="chip" data-sev="${k}" aria-pressed="${S.sev.has(k)}">${t} · ${A.filter((a) => a.sev === k).length}</button>`).join("");
  $("#filtroSit").innerHTML = Object.entries(SITUACOES).map(([k, t]) => `<button type="button" class="chip" data-sit="${k}" aria-pressed="${S.sit.has(k)}">${t} · ${A.filter((a) => a.sit === k).length}</button>`).join("");
  $("#sevbar").innerHTML = A.length ? Object.keys(SEV).map((k) => { const n = A.filter((a) => a.sev === k).length; return n ? `<span class="${k}" style="width:${(n / A.length) * 100}%" title="${SEV[k]}: ${n}"></span>` : ""; }).join("") : "";
  const cont = (k) => A.filter((a) => a.sit === k).length;
  const abertos = A.filter((a) => (a.sev === "alta" || a.sev === "media") && (a.sit === "pendente" || a.sit === "questionado")).length;
  $("#kpisAcomp").innerHTML = [
    ["Em aberto (alta e média)", abertos, "pendentes ou aguardando resposta", abertos ? "neg" : "pos"],
    ["Questionados", cont("questionado"), "enviados à administradora", ""],
    ["Respondidos", cont("respondido"), "aguardando análise do conselho", ""],
    ["Resolvidos ou sem procedência", cont("resolvido") + cont("descartado"), `de ${A.length} alertas`, "pos"],
  ].map(([t, v, d, c]) => `<div class="kpi ${c}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span></div>`).join("");
  const vis = A.filter((a) => S.sev.has(a.sev) && S.sit.has(a.sit));
  $("#listaAlertas").innerHTML = vis.length ? vis.map((a) => {
    return `<article class="alerta ${a.sev} ${ativo(a) ? "" : "tratado"}" id="al-${a.chave}">
    <div class="linha1"><span class="pill ${a.sev}">${SEV[a.sev]}</span>${S.novosSet?.has(a.chave) ? '<span class="pill novo">novo neste balancete</span>' : ""}<span class="eyebrow">${esc(a.tipo)}</span>${a.mes ? `<span class="mini">${rotuloMes(a.mes)}</span>` : ""}<span class="sit ${a.sit}" style="margin-left:auto">${SITUACOES[a.sit]}</span></div>
    <div class="tit">${esc(a.titulo)}</div>
    ${a.detalhe ? `<pre>${esc(a.detalhe)}</pre>` : ""}
    ${a.pergunta ? `<div class="perg">${esc(a.pergunta)}</div>` : ""}
    ${a.ids.length ? `<div><button type="button" class="link" data-alerta="${A.indexOf(a)}">Ver ${a.ids.length} lançamento(s)</button></div>` : ""}
    ${editorAcomp(a)}
  </article>`; }).join("") : `<div class="vazio card">Nenhum alerta com os filtros escolhidos.</div>`;
}
function csvAlertas() {
  const c = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [["Prioridade", "Tipo", "Mês", "Alerta", "Detalhe", "Pergunta", "Situação", "Enviado em", "Prazo", "Respondido em", "Responsável", "Resposta/anotação", "Atualizado em"].map(c).join(";")];
  for (const a of S.alertas) { const ac = S.acomp[a.chave] || {}; linhas.push([SEV[a.sev], a.tipo, a.mes ? rotuloMes(a.mes) : "", a.titulo, a.detalhe, a.pergunta, SITUACOES[a.sit], dataBR(ac.enviado), dataBR(ac.prazo), dataBR(ac.respondidoEm), ac.responsavel || "", ac.resposta || "", ac.ts ? horaBR(ac.ts) : ac.data || ""].map(c).join(";")); }
  baixar("alertas-conselho-fiscal.csv", "﻿" + linhas.join("\r\n"), "text/csv;charset=utf-8");
}

// ---------------------------------------------------------------- parcelas
function tabParcelas() {
  const ps = parcelas(S.meses);
  const ativas = ps.filter((p) => p.aPagar > 0);
  const tot = ativas.reduce((s, p) => s + p.aPagar, 0);
  const emDia = ativas.filter((p) => !p.interrompida), paradas = ativas.filter((p) => p.interrompida);
  const mensal = emDia.filter((p) => p.ativa).reduce((s, p) => s + p.valorParcela, 0);
  $("#kpisParc").innerHTML = [
    ["Saldo a pagar em parcelas", brl(tot), `${ativas.length} parcelamentos em aberto`],
    ["Peso mensal das parcelas", brl(mensal), "parcelas pagas no último mês"],
    ["Parcelamentos parados", brl(paradas.reduce((s, p) => s + p.aPagar, 0)), `${paradas.length} sem pagamento há 2+ meses`, paradas.length ? "neg" : ""],
  ].map(([t, v, d, c]) => `<div class="kpi ${c || ""}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span></div>`).join("");
  $("#tabParc").innerHTML = `<thead><tr><th>Fornecedor</th><th>Objeto</th><th class="n">Parcela</th><th class="n">Valor</th><th class="n">Faltam</th><th class="n">A pagar</th><th>Último pagto.</th><th>Situação</th></tr></thead><tbody>${
    ativas.map((p) => `<tr><td>${esc(p.forn)}</td><td class="small">${esc(p.desc)}</td><td class="n">${p.ultimaParcela}/${p.de}</td><td class="n">${brl(p.valorParcela)}</td><td class="n">${p.restantes}</td><td class="n"><b>${brl(p.aPagar)}</b></td><td>${rotuloMes(p.ultimoMes)}</td>
    <td>${p.interrompida ? '<span class="pill alta">parado</span>' : p.ativa ? '<span class="pill ok">em dia</span>' : '<span class="pill media">pular mês</span>'}${p.repetidas.length ? ' <span class="pill media">parcela repetida</span>' : ""}</td></tr>`).join("")
  }<tr class="total"><td colspan="5">Total</td><td class="n">${brl(tot)}</td><td colspan="2"></td></tr></tbody>`;
}

// ---------------------------------------------------------------- lançamentos
function lancTab() {
  const L = lancamentos(S.meses);
  const cats = [...new Set(L.map((d) => d.cat))].sort(), forns = [...new Set(L.map((d) => d.forn))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const fc = $("#fCat"), ff = $("#fForn"), vc = fc.value, vf = ff.value;
  fc.innerHTML = `<option value="">Todas as categorias</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join("");
  ff.innerHTML = `<option value="">Todos os fornecedores</option>` + forns.map((c) => `<option>${esc(c)}</option>`).join("");
  fc.value = cats.includes(vc) ? vc : ""; ff.value = forns.includes(vf) ? vf : "";
  const q = $("#buscaLanc").value.trim().toLowerCase(), so = $("#fSemDoc").checked;
  let F = L.filter((d) => (!fc.value || d.cat === fc.value) && (!ff.value || d.forn === ff.value) && (!so || d.semDoc) &&
    (!q || `${d.desc} ${d.nf} ${d.forn} ${d.ref} ${d.baixa}`.toLowerCase().includes(q)));
  if (S.ids) { const set = new Set(S.ids); F = F.filter((d) => set.has(d.id)); }
  $("#filtroIds").hidden = !S.ids;
  $("#filtroIds").innerHTML = S.ids ? `Mostrando uma seleção de lançamentos. <button class="link" type="button" id="limparIds">Mostrar todos</button>` : "";
  const oL = S.ordem.tabLanc;
  if (oL && LANC_ORD[oL.col]) F = F.map((d, i) => [d, i]).sort((x, y) => compara(LANC_ORD[oL.col](x[0]), LANC_ORD[oL.col](y[0])) * oL.dir || x[1] - y[1]).map((x) => x[0]);
  S.filtrados = F;
  $("#resumoLanc").textContent = `${F.length} lançamentos · ${brl(F.reduce((s, d) => s + d.v, 0))}`;
  const vis = F.slice(0, S.limite);
  $("#tabLanc").innerHTML = `<thead><tr><th>Mês</th><th>Categoria</th><th>Fornecedor / histórico</th><th>Ref.</th><th>Baixa</th><th>Tipo</th><th>NF</th><th class="n">Valor</th></tr></thead><tbody>${
    vis.map((d) => `<tr><td>${rotuloMes(d.mes)}</td><td class="mini">${esc(d.cat)}</td><td><b style="font-weight:600">${esc(d.forn)}</b>${d.semDoc ? ' <span class="pill media" title="Conta sem documento digitalizado">sem doc.</span>' : ""}<div class="mini">${esc(d.desc)}</div></td>
      <td class="num">${esc(d.ref)}</td><td class="num">${esc(d.baixa)}</td><td>${esc(d.tipo)}</td><td class="num">${esc(d.nf)}</td><td class="n">${brl(d.v)}</td></tr>`).join("") || `<tr><td colspan="8" class="vazio">Nenhum lançamento com esses filtros.</td></tr>`
  }</tbody>`;
  $("#maisLanc").hidden = F.length <= S.limite;
  marcarCabecalho($("#tabLanc"), oL);
}
function baixar(nome, texto, tipo) {
  const blob = new Blob([texto], { type: tipo }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csv() {
  const c = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [["Mês", "Categoria", "Fornecedor", "Histórico", "Mês ref.", "Baixa", "Tipo", "NF", "Valor", "Sem documento"].map(c).join(";")];
  for (const d of S.filtrados || []) linhas.push([rotuloMes(d.mes), d.cat, d.forn, d.desc, d.ref, d.baixa, d.tipo, d.nf, d.v.toFixed(2).replace(".", ","), d.semDoc ? "sim" : ""].map(c).join(";"));
  baixar("lancamentos-farol.csv", "﻿" + linhas.join("\r\n"), "text/csv;charset=utf-8");
}

// ---------------------------------------------------------------- notas
function notas() {
  const ms = [...S.meses].reverse().filter((b) => (b.notas || []).some((n) => n.grupo === "específica"));
  $("#listaNotas").innerHTML = ms.length ? ms.map((b) => `<article class="alerta ${b.notas.some((n) => /duplicidade|falta de saldo/i.test(n.texto)) ? "media" : ""}">
    <div class="linha1"><span class="eyebrow">${rotuloMes(b.mes)}</span><span class="mini">emitido em ${esc(b.emissao)}</span></div>
    <pre>${esc(b.notas.filter((n) => n.grupo === "específica").map((n) => n.texto).join("\n\n"))}</pre></article>`).join("")
    : `<div class="vazio card">Sem notas específicas no período.</div>`;
}

// ---------------------------------------------------------------- conselho fiscal
function conselho() {
  const ind = S.ind, A = S.alertas, de = S.meses[0].mes, ate = S.meses.at(-1).mes;
  const per = `${rotuloMes(de)} a ${rotuloMes(ate)}`;
  $("#periodoConselho").textContent = `Período: ${per}`;
  const abertos = A.filter((a) => (a.sev === "alta" || a.sev === "media") && a.pergunta && a.sit !== "resolvido" && a.sit !== "descartado");
  $("#roteiro").innerHTML = abertos.map((a) => `<li>${esc(a.pergunta)} <span class="sit ${a.sit}">${SITUACOES[a.sit]}</span>${(S.acomp[a.chave] || {}).resposta ? `<div class="mini">Resposta: ${esc(S.acomp[a.chave].resposta)}</div>` : ""}</li>`).join("") || "<li>Nenhuma pergunta em aberto.</li>";
  const docs = new Set([
    "Extratos bancários de todas as contas (corrente, conta capital e aplicação) de cada mês, para conferir os saldos do balancete.",
    "Notas fiscais e comprovantes de pagamento dos maiores fornecedores do período.",
    "Contratos vigentes (administradora, RH terceirizado, portaria/limpeza, jardinagem, segurança eletrônica, assessoria jurídica, síndico profissional).",
    "Relatório de inadimplência por unidade e acordos firmados.",
    "Apólice do seguro obrigatório do condomínio e comprovantes de pagamento.",
    "Atas das assembleias que aprovaram obras, compras de bens e reajustes da cota.",
  ]);
  if (A.some((a) => a.tipo === "Pagamento em duplicidade")) docs.add("Comprovantes de devolução dos pagamentos em duplicidade.");
  if (A.some((a) => a.tipo === "Documentação")) docs.add("Documentos fiscais dos lançamentos sem documento digitalizado e dos pagamentos feitos só com recibo.");
  if (A.some((a) => /cart[ãa]o/i.test(a.titulo))) docs.add("Faturas do cartão de crédito do condomínio e lista de quem pode usá-lo.");
  if (S.meses.some((b) => b.despesas.some((d) => /DARF|RETEN|IMPOSTO RETIDO/i.test(d.desc + d.nf)))) docs.add("Guias de retenção de tributos (DARF/INSS) de cada nota fiscal de serviços com retenção.");
  $("#docs").innerHTML = [...docs].map((d) => `<li>${esc(d)}</li>`).join("");
  const altas = A.filter((a) => a.sev === "alta"), medias = A.filter((a) => a.sev === "media");
  const neg = ind.rm.filter((m) => m.saldo < 0);
  const hoje = new Date().toLocaleDateString("pt-BR");
  $("#minuta").textContent =
`PARECER DO CONSELHO FISCAL
${S.meses.at(-1).condominio || "Condomínio"}
Período examinado: ${per}

O Conselho Fiscal examinou os demonstrativos de receitas e despesas elaborados pela Logo Gestão Condominial referentes a ${S.meses.length} mês(es), de ${rotuloMes(de)} a ${rotuloMes(ate)}.

No período, as receitas somaram ${brl(ind.receita)} e as despesas ${brl(ind.despesa)}, com resultado de ${brl(ind.resultado)}. O saldo passou de ${brl(S.meses[0].totais.saldoAnterior ?? 0)} para ${brl(ind.saldoFinal)}${neg.length ? `, tendo ficado negativo em ${neg.map((m) => rotuloMes(m.mes)).join(", ")} (mínimo de ${brl(ind.menor.saldo)})` : ""}. Os encargos de juros, IOF e multas por atraso somaram ${brl(ind.fin.total)}.

A análise identificou ${altas.length} ponto(s) de prioridade alta e ${medias.length} de prioridade média, entre eles:
${altas.slice(0, 8).map((a) => `- ${a.titulo}`).join("\n") || "- nenhum ponto de prioridade alta"}

Diante do exposto, o Conselho Fiscal [aprova / aprova com ressalvas / recomenda a rejeição de] as contas do período, condicionando [o acolhimento das ressalvas] à apresentação, pela administradora e pelo síndico, dos esclarecimentos e documentos listados no anexo, no prazo de [__] dias.

Recomenda ainda: (a) formação de fundo de reserva segregado; (b) aprovação prévia em assembleia para obras e compras de bens; (c) pagamento das contas em dia para evitar multas e juros; (d) nota fiscal em nome do condomínio para toda despesa.

Salvador, ${hoje}.

______________________________      ______________________________      ______________________________
Conselheiro(a)                                    Conselheiro(a)                                    Conselheiro(a)`;
}

// ---------------------------------------------------------------- importação
let pdfjs = null;
async function carregarPdfjs() {
  if (pdfjs) return pdfjs;
  if (location.protocol === "file:") throw new Error("Para importar PDF, abra o site publicado (GitHub Pages). Aberto direto do computador, o navegador bloqueia o leitor de PDF.");
  pdfjs = await import(new URL("js/vendor/pdf.min.mjs", document.baseURI).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("js/vendor/pdf.worker.min.mjs", document.baseURI).href;
  return pdfjs;
}
async function importar(files) {
  const log = $("#log");
  let lib;
  try { lib = await carregarPdfjs(); } catch (e) { const d = document.createElement("div"); d.className = "erro"; d.textContent = e.message; log.prepend(d); return; }
  for (const f of files) {
    const linha = document.createElement("div"); linha.textContent = `Lendo ${f.name}…`; log.prepend(linha);
    try {
      const b = await lerBalancete(lib, new Uint8Array(await f.arrayBuffer()), f.name);
      const ja = S.todos.find((x) => x.mes === b.mes);
      b.importadoEm = new Date().toLocaleDateString("pt-BR");
      S.locais[b.mes] = b;
      if (!ls.set(LS_MESES, S.locais)) throw new Error("O navegador não deixou guardar os dados (armazenamento bloqueado ou cheio).");
      linha.className = b.conferencia.ok ? "ok" : "erro";
      linha.innerHTML = `<b>${rotuloMes(b.mes)}</b> · ${b.despesas.length} despesas, ${b.receitas.length} receitas · receitas ${brl(b.totais.receitas)}, despesas ${brl(b.totais.despesas)}, saldo ${brl(b.totais.saldoAtual)}`
        + (b.conferencia.ok ? " · conferido com os totais do PDF" : ` · <b>atenção:</b> ${esc(b.conferencia.problemas.join(" "))}`)
        + (ja ? ` · substituiu a versão emitida em ${esc(ja.emissao)}` : " · mês novo");
    } catch (e) {
      linha.className = "erro"; linha.textContent = `${f.name}: ${e.message}`;
    }
  }
  juntar(); render();
  toast("Importação concluída. Os meses novos já entraram em todas as análises.");
}

function dadosTab() {
  const nl = Object.keys(S.locais).length;
  const ultB = S.todos.at(-1);
  $("#rodapeBase").textContent = ultB ? `Último balancete: ${rotuloMes(ultB.mes)}, emitido em ${ultB.emissao}.` : "";
  $("#resumoBase").textContent = `${S.todos.length} meses · ${Object.keys(S.base).length} publicados · ${nl} só neste navegador`;
  $("#tabMeses").innerHTML = `<thead><tr><th>Mês</th><th>Emissão</th><th>Arquivo</th><th class="n">Receitas</th><th class="n">Despesas</th><th class="n">Saldo</th><th>Conferência</th><th>Origem</th><th></th></tr></thead><tbody>${
    [...S.todos].reverse().map((b) => {
      const c = b.conferencia || conferir(b);
      return `<tr><td>${rotuloMes(b.mes)}</td><td class="num">${esc(b.emissao)}</td><td class="mini">${esc(b.arquivo)}</td><td class="n">${brl(b.totais.receitas)}</td><td class="n">${brl(b.totais.despesas)}</td><td class="n ${b.totais.saldoAtual < 0 ? "neg" : ""}">${brl(b.totais.saldoAtual)}</td>
      <td>${c.ok ? '<span class="pill ok">fecha</span>' : `<span class="pill alta" title="${esc(c.problemas.join(" "))}">diverge</span>`}</td>
      <td>${b.origem === "local" ? '<span class="pill local">neste navegador</span>' : '<span class="pill info">publicado</span>'}</td>
      <td>${b.origem === "local" ? `<button class="link" type="button" data-remover="${b.mes}">remover</button>` : ""}</td></tr>`;
    }).join("")}</tbody>`;
  const gh = ls.get(LS_GH, {});
  const guess = location.hostname.endsWith("github.io") ? { owner: location.hostname.split(".")[0], repo: location.pathname.split("/").filter(Boolean)[0] || "" } : {};
  for (const [id, k, d] of [["#ghOwner", "owner", guess.owner], ["#ghRepo", "repo", guess.repo], ["#ghBranch", "branch", "main"], ["#ghToken", "token", ""]])
    if (!$(id).value) $(id).value = gh[k] || d || "";
  $("#btnLimpar").disabled = !nl;
}

function baseCompleta() {
  const meses = {};
  for (const b of S.todos) { const c = { ...b }; c.origem = "base"; meses[b.mes] = c; }
  return { versao: 1, atualizado: new Date().toLocaleDateString("pt-BR"), meses, acompanhamento: S.acomp || {} };
}
const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
async function publicar() {
  if (AC.ligado) {
    if (!ehAdmin()) return toast("Só o administrador publica balancetes.");
    if (!Object.keys(S.locais).length) return toast("Nenhum mês novo para publicar.");
    const btn = $("#btnPublicar"); btn.disabled = true; btn.textContent = "Publicando…";
    try { await gravarMeses(S.locais); S.base = { ...S.base, ...S.locais }; S.locais = {}; ls.del(LS_MESES); juntar(); render(); toast("Balancetes gravados na base protegida."); }
    catch (e) { toast(mensagemErro(e)); }
    btn.disabled = false; btn.textContent = "Publicar balancetes"; return;
  }
  const cfg = { owner: $("#ghOwner").value.trim(), repo: $("#ghRepo").value.trim(), branch: $("#ghBranch").value.trim() || "main", token: $("#ghToken").value.trim() };
  if (!cfg.owner || !cfg.repo || !cfg.token) return toast("Preencha usuário, repositório e token para publicar.");
  ls.set(LS_GH, cfg);
  agendarSync();
  const btn = $("#btnPublicar"); btn.disabled = true; btn.textContent = "Publicando…";
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/data/balancetes.json`;
  const hdr = { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" };
  try {
    let sha;
    const g = await fetch(`${url}?ref=${encodeURIComponent(cfg.branch)}`, { headers: hdr, cache: "no-store" });
    if (g.ok) sha = (await g.json()).sha; else if (g.status !== 404) throw new Error(`GitHub respondeu ${g.status} ao ler a base. Confira repositório, branch e token.`);
    const nomes = Object.keys(S.locais).map(rotuloMes).join(", ") || "atualização";
    const p = await fetch(url, { method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Balancetes: ${nomes}`, content: b64(JSON.stringify(baseCompleta())), branch: cfg.branch, sha }) });
    if (!p.ok) { const e = await p.json().catch(() => ({})); throw new Error(`GitHub recusou a publicação (${p.status}): ${e.message || "sem detalhes"}.`); }
    S.base = baseCompleta().meses; S.acompRemoto = JSON.parse(JSON.stringify(S.acomp)); S.locais = {}; ls.del(LS_MESES); juntar(); render();
    toast("Base publicada. O site atualiza para todos em 1 a 2 minutos.");
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = "Publicar base no GitHub";
}



// ---------------------------------------------------------------- Resumo do mês (tela simples, padrão do perfil Visualização)
const ABAS_VIS = ["resumo", "painel", "analises", "mes", "orcamento"];
function resumoMes() {
  const sel = $("#resumoMesSel");
  const ops = [...S.todos].reverse().map((b) => `<option value="${b.mes}">${rotuloMes(b.mes)}</option>`).join("");
  if (sel.dataset.ops !== ops) { sel.innerHTML = ops; sel.dataset.ops = ops; }
  if (!S.todos.some((b) => b.mes === S.resumoMes)) S.resumoMes = S.todos.at(-1).mes;
  sel.value = S.resumoMes;
  const i = S.todos.findIndex((b) => b.mes === S.resumoMes), b = S.todos[i], ant = S.todos[i - 1];
  const pd = parecerDe(b), t = b.totais, res = t.receitas - t.despesas;
  const expl = {
    validado: "O conselho conferiu o demonstrativo e aprovou as contas do mês.",
    ressalvas: `As contas foram aprovadas, mas há ${pd.aguard.length} pergunta(s) ${rotAguard(pd.aguard).toLowerCase()}.`,
    analise: "Os totais do demonstrativo conferem. O conselho ainda está analisando os lançamentos do mês.",
    nao: pd.confere ? "O conselho não aprovou as contas do mês. Veja as pendências abaixo." : "Os totais do demonstrativo não fecham: o conselho pediu a correção à administradora.",
  }[pd.cod];
  const dif = (v, a, menor) => a === undefined ? "" : (() => { const d = v - a; return `<span class="delta ${Math.abs(d) < 0.01 ? "neutro" : (d > 0) !== menor ? "bom" : "ruim"}">${d > 0 ? "▲" : d < 0 ? "▼" : "■"} ${brl(Math.abs(d))} <span class="muted">vs ${rotuloMes(ant.mes)}</span></span>`; })();
  const cats = porCategoria([b]), maxC = cats[0]?.total || 1;
  const prev = previsaoDoMes(b.mes);
  const resp = relevantesTodos().filter((a) => (a.sit === "respondido" || a.sit === "resolvido") && (S.acomp[a.chave]?.resposta || "").trim())
    .sort((x, y) => tsDe(S.acomp[y.chave]).localeCompare(tsDe(S.acomp[x.chave]))).slice(0, 5);
  const hoje = hojeISO();
  $("#secResumo").innerHTML = `
  <div class="parecer-card ${pd.cls}"><span class="pc-ic" aria-hidden="true">${pd.icone}</span><div><span class="eyebrow">Parecer do Conselho Fiscal</span>
    <h2>Balancete de ${mesExtenso(b.mes)}: ${pd.rot.toLowerCase()}</h2><p>${expl}</p></div></div>
  <div class="resumo-nums">
    <div class="rn"><span class="eyebrow">Receitas</span><b>${brl(t.receitas)}</b>${dif(t.receitas, ant?.totais.receitas, false)}</div>
    <div class="rn"><span class="eyebrow">Despesas</span><b>${brl(t.despesas)}</b>${dif(t.despesas, ant?.totais.despesas, true)}</div>
    <div class="rn"><span class="eyebrow">${res >= 0 ? "Sobra do mês" : "Falta do mês"}</span><b class="${res < 0 ? "neg" : "pos"}">${brl(Math.abs(res))}</b>${ant ? `<span class="mini">mês anterior: ${brl(ant.totais.receitas - ant.totais.despesas)}</span>` : ""}</div>
    <div class="rn"><span class="eyebrow">Saldo em caixa</span><b class="${t.saldoAtual < 0 ? "neg" : ""}">${brl(t.saldoAtual)}</b>${dif(t.saldoAtual, ant?.totais.saldoAtual, false)}</div>
  </div>
  <div class="grid2">
    <div class="card"><div class="cab-secao"><span class="eyebrow">Despesas</span><h2>Para onde foi o dinheiro</h2></div>
      <ul class="barras-simples">${cats.slice(0, 7).map((c) => { const o = prev ? prev.cats[c.cat] || 0 : 0; return `<li><div class="bs-top"><span>${esc(c.cat)}</span><b>${brl(c.total)}</b></div>
        <div class="bs-trilho"><span style="width:${(c.total / maxC) * 100}%" class="${o && c.total > o * 1.1 ? "acima" : ""}"></span>${o ? `<i style="left:${Math.min(100, (o / maxC) * 100)}%" title="Previsto: ${brl(o)}"></i>` : ""}</div>
        <span class="mini">${pct(c.total / (t.despesas || 1))} das despesas${o ? ` · previsto ${brl(o)}${c.total > o * 1.1 ? " · <b class='neg'>acima do previsto</b>" : ""}` : ""}</span></li>`; }).join("")}</ul>
      ${prev ? `<p class="mini">A marca vertical indica o valor previsto no orçamento "${esc(prev.nome)}".</p>` : ""}</div>
    <div class="card"><div class="cab-secao"><span class="eyebrow">Acompanhamento</span><h2>${rotAguard(pd.aguard)}</h2></div>
      ${pd.aguard.length ? `<ul class="lista-pend">${pd.aguard.map((a) => { const e = S.acomp[a.chave] || {}; const v = e.prazo && e.prazo < hoje; return `<li class="${v ? "venc" : ""}"><b>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}</b><span class="mini">${gruposAguard(pd.aguard).length > 1 ? `para: ${destinoDe(a)} · ` : ""}${e.enviado ? `enviado em ${dataBR(e.enviado)}` : ""}${e.prazo ? ` · prazo ${dataBR(e.prazo)}` : ""}${v ? " · <b class='neg'>prazo vencido</b>" : ""}</span></li>`; }).join("")}</ul>` : `<p class="muted">Nenhuma pergunta aguardando resposta.</p>`}
      <div class="cab-secao" style="margin-top:18px"><span class="eyebrow">Respostas recebidas</span></div>
      ${resp.length ? `<ul class="lista-pend">${resp.map((a) => { const e = S.acomp[a.chave]; return `<li><b>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}</b><span>${esc(e.resposta)}</span><span class="mini">${SITUACOES[a.sit]}${e.por ? ` · registrado por ${esc(e.por)}` : ""}${e.ts ? ` em ${horaBR(e.ts)}` : ""}</span></li>`; }).join("")}</ul>` : `<p class="muted">Nenhuma resposta registrada ainda.</p>`}
    </div>
  </div>
  <p class="small muted">${pd.confere ? "✓ Os totais do demonstrativo conferem com a soma dos lançamentos." : "✗ Os totais do demonstrativo não conferem com a soma dos lançamentos."} Demonstrativo emitido pela Logo Gestão Condominial em ${esc(b.emissao)}.</p>`;
}

// ---------------------------------------------------------------- aviso de prazo vencido (ao entrar)
function avisoVencidos() {
  if (!podeEditar()) return;
  const v = S.vencidos || [];
  let visto = false; try { visto = sessionStorage.getItem("farol.avisoVenc") === String(v.length); } catch {}
  if (!v.length || visto) return;
  const hoje = hojeISO();
  $("#avisoLista").innerHTML = v.map((a) => { const e = S.acomp[a.chave] || {}; return `<li><b>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}</b><span class="mini">enviado em ${dataBR(e.enviado) || "—"} · prazo ${dataBR(e.prazo)} · vencido há ${diasEntre(e.prazo, hoje)} dia(s)${e.responsavel ? ` · responsável: ${esc(e.responsavel)}` : ""}</span></li>`; }).join("");
  $("#avisoTitulo").textContent = `${v.length} pergunta(s) com prazo de resposta vencido`;
  $("#avisoVenc").hidden = false;
}
function fecharAviso() { $("#avisoVenc").hidden = true; try { sessionStorage.setItem("farol.avisoVenc", String((S.vencidos || []).length)); } catch {} }

// ---------------------------------------------------------------- orçado x realizado
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function parseValor(v) {
  const t = String(v ?? "").replace(/[R$\s]/g, ""); if (!t) return 0;
  const n = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
const fmtValor = (n) => (n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
function previsaoDoMes(mes) { return (S.orc || []).find((p) => p.de <= mes && mes <= p.ate) || null; }
async function salvarOrc() {
  if (AC.ligado) await gravarOrcamento(S.orc); else ls.set(LS_ORC, S.orc);
}
function orcamentoTab() {
  const el = $("#secOrcamento"); if (!el) return;
  const prevs = S.orc || [];
  if (!prevs.some((p) => p.id === S.orcSel)) S.orcSel = (previsaoDoMes(S.todos.at(-1)?.mes || "") || prevs.at(-1) || {}).id;
  const p = prevs.find((x) => x.id === S.orcSel);
  const podeAdm = ehAdmin();
  const topo = `<div class="cab"><div class="cab-secao"><span class="eyebrow">Previsão orçamentária</span><h2>Orçado x realizado</h2></div>
    <div class="acoes">${prevs.length > 1 ? `<label class="small">Previsão <select id="orcSel">${prevs.map((x) => `<option value="${x.id}" ${x.id === S.orcSel ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></label>` : ""}
    ${podeAdm ? `${p ? `<button class="btn sec" type="button" data-orc-editar="${p.id}">Editar previsão</button>` : ""}<button class="btn" type="button" data-orc-editar="">Nova previsão</button>` : ""}</div></div>`;
  if (S.orcEditando !== undefined && podeAdm) { el.innerHTML = topo + editorOrc(prevs.find((x) => x.id === S.orcEditando)); return; }
  if (!p) { el.innerHTML = topo + `<div class="vazio card">Nenhuma previsão orçamentária cadastrada.${podeAdm ? " Clique em <b>Nova previsão</b> e informe o valor mensal aprovado em assembleia para cada categoria." : " O administrador ainda não cadastrou a previsão aprovada em assembleia."}</div>`; return; }
  const ms = S.todos.filter((b) => b.mes >= p.de && b.mes <= p.ate);
  if (!ms.length) { el.innerHTML = topo + `<div class="vazio card">A previsão "${esc(p.nome)}" vale de ${rotuloMes(p.de)} a ${rotuloMes(p.ate)}, mas ainda não há balancete nesse período.</div>`; return; }
  const catsOrc = Object.entries(p.cats || {}).filter(([, v]) => v > 0).map(([c]) => c);
  const real = Object.fromEntries(ms.map((b) => [b.mes, Object.fromEntries(porCategoria([b]).map((c) => [c.cat, c.total]))]));
  const todasCats = [...new Set([...catsOrc, ...ms.flatMap((b) => Object.keys(real[b.mes]))])];
  const orcMes = catsOrc.reduce((s2, c) => s2 + p.cats[c], 0), n = ms.length;
  const totReal = ms.reduce((s2, b) => s2 + b.totais.despesas, 0), totOrc = orcMes * n;
  const recReal = ms.reduce((s2, b) => s2 + b.totais.receitas, 0), recOrc = (p.receita || 0) * n;
  const linhas = todasCats.map((c) => {
    const o = (p.cats[c] || 0) * n, r = ms.reduce((s2, b) => s2 + (real[b.mes][c] || 0), 0);
    return { c, o, r, d: r - o, ex: o ? r / o : null };
  }).sort((x, y) => (y.d) - (x.d));
  const status = (ex, o, r) => !o ? (r ? `<span class="sit questionado">Sem previsão</span>` : "") : ex > 1.1 ? `<span class="sit pendente">Acima do previsto</span>` : ex > 1 ? `<span class="sit questionado">No limite</span>` : `<span class="sit resolvido">Dentro do previsto</span>`;
  const estouros = [];
  for (const b of ms) for (const c of catsOrc) { const r = real[b.mes][c] || 0, o = p.cats[c]; if (r > o * 1.1 && r - o >= 50) estouros.push({ mes: b.mes, c, r, o, ex: r - o }); }
  estouros.sort((a, b2) => b2.ex - a.ex);
  // gráfico: realizado por mês (barras) contra o orçado mensal (linha tracejada)
  const W = 1040, H = 300, ml = 70, mr = 16, mt = 20, mb = 34, mx = Math.max(orcMes, ...ms.map((b) => b.totais.despesas)) * 1.12;
  const y = (v) => mt + (H - mt - mb) * (1 - v / mx), bw = (W - ml - mr) / n, w = Math.min(46, bw * 0.55);
  let g = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${ml}" x2="${W - mr}" y1="${y(mx * f)}" y2="${y(mx * f)}" stroke="#e3e9ef"/><text x="${ml - 8}" y="${y(mx * f) + 4}" text-anchor="end">${(mx * f / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil</text>`).join("");
  ms.forEach((b, i) => {
    const cx = ml + i * bw + bw / 2, v = b.totais.despesas, acima = v > orcMes * 1.1, lim = v > orcMes;
    g += `<rect x="${cx - w / 2}" y="${y(v)}" width="${w}" height="${y(0) - y(v)}" rx="4" fill="${acima ? "#d9663a" : lim ? "#e0a100" : "#2a9d8f"}" data-tip="${esc(`${rotuloMes(b.mes)}\nRealizado: ${brl(v)}\nPrevisto: ${brl(orcMes)}\nDiferença: ${brl(v - orcMes)}`)}"/>`;
    g += `<text x="${cx}" y="${H - 12}" text-anchor="middle" class="eixo-x">${rotuloMes(b.mes).replace("/20", "/")}</text>`;
  });
  g += `<line x1="${ml}" x2="${W - mr}" y1="${y(orcMes)}" y2="${y(orcMes)}" stroke="#054166" stroke-width="2.5" stroke-dasharray="7 5"/><text x="${W - mr}" y="${y(orcMes) - 7}" text-anchor="end" style="font-weight:700;fill:#054166">previsto ${brl(orcMes)}/mês</text>`;
  const corPct = (x) => x === null ? "" : x > 1.1 ? "q-alto" : x > 1 ? "q-medio" : "q-ok";
  el.innerHTML = topo + `
  <p class="small muted">"${esc(p.nome)}" · vigência ${rotuloMes(p.de)} a ${rotuloMes(p.ate)} · ${n} mês(es) com balancete${p.por ? ` · cadastrada por ${esc(p.por)}` : ""}</p>
  <div class="kpis-sec">
    <div class="kpi"><span class="eyebrow">Despesa prevista</span><b>${brl(totOrc)}</b><span class="det">${brl(orcMes)} por mês</span></div>
    <div class="kpi ${totReal > totOrc ? "neg" : "pos"}"><span class="eyebrow">Despesa realizada</span><b>${brl(totReal)}</b><span class="det">${pct(totOrc ? totReal / totOrc : 0)} do previsto</span></div>
    <div class="kpi ${totReal > totOrc ? "neg" : "pos"}"><span class="eyebrow">${totReal > totOrc ? "Gasto acima do previsto" : "Economia sobre o previsto"}</span><b>${brl(Math.abs(totReal - totOrc))}</b><span class="det">no período</span></div>
    ${recOrc ? `<div class="kpi ${recReal < recOrc ? "neg" : "pos"}"><span class="eyebrow">Receita realizada</span><b>${brl(recReal)}</b><span class="det">prevista ${brl(recOrc)} (${pct(recReal / recOrc)})</span></div>` : ""}
  </div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Mês a mês</span><h2>Despesa realizada x prevista</h2></div>
    <div class="legenda" style="margin:10px 0 4px"><span><i style="background:#2a9d8f"></i>Dentro do previsto</span><span><i style="background:#e0a100"></i>Até 10% acima</span><span><i style="background:#d9663a"></i>Mais de 10% acima</span><span><i class="linha" style="background:#054166"></i>Previsto</span></div>
    <div class="grafico-largo"><svg class="g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Despesa realizada e prevista por mês">${g}</svg></div></div>
  <div class="cab-secao"><span class="eyebrow">Por categoria</span><h2>Previsto x realizado no período</h2></div>
  <div class="tabela"><table><thead><tr><th>Categoria</th><th class="n">Previsto</th><th class="n">Realizado</th><th class="n">Diferença</th><th class="n">Execução</th><th>Situação</th></tr></thead><tbody>
    ${linhas.map((l) => `<tr><td>${esc(l.c)}</td><td class="n">${l.o ? brl(l.o) : "—"}</td><td class="n">${brl(l.r)}</td><td class="n ${l.d > 0 ? "neg" : "pos"}">${l.o ? (l.d > 0 ? "+" : "") + brl(l.d) : "—"}</td>
      <td class="n">${l.ex === null ? "—" : `<div class="exec-bar"><span class="${corPct(l.ex)}" style="width:${Math.min(100, l.ex * 100 / 1.5)}%"></span><i style="left:${100 / 1.5}%"></i></div>${pct(l.ex)}`}</td><td>${status(l.ex, l.o, l.r)}</td></tr>`).join("")}
    <tr class="total"><td>Total</td><td class="n">${brl(totOrc)}</td><td class="n">${brl(totReal)}</td><td class="n">${(totReal - totOrc > 0 ? "+" : "") + brl(totReal - totOrc)}</td><td class="n">${pct(totOrc ? totReal / totOrc : 0)}</td><td></td></tr>
  </tbody></table></div>
  <div class="grid2">
    <div class="card"><div class="cab-secao"><span class="eyebrow">Atenção</span><h2>Onde passou do previsto</h2></div>
      ${estouros.length ? `<ul class="lista-pend">${estouros.slice(0, 10).map((e) => `<li><b>${esc(e.c)} · ${rotuloMes(e.mes)}</b><span class="mini">realizado ${brl(e.r)} · previsto ${brl(e.o)} · <b class="neg">${brl(e.ex)} acima (${pct(e.r / e.o - 1)})</b></span></li>`).join("")}</ul>` : `<p class="muted">Nenhum mês ficou mais de 10% acima do previsto em alguma categoria.</p>`}</div>
    <div class="card"><div class="cab-secao"><span class="eyebrow">Mapa</span><h2>% do previsto por mês</h2></div>
      <div style="overflow-x:auto;margin-top:10px"><table class="mapa-orc"><thead><tr><th>Categoria</th>${ms.map((b) => `<th class="c">${rotuloMes(b.mes).replace("/20", "/")}</th>`).join("")}</tr></thead><tbody>
      ${catsOrc.map((c) => `<tr><td>${esc(c)}</td>${ms.map((b) => { const x = (real[b.mes][c] || 0) / p.cats[c]; return `<td class="c ${corPct(x)}" data-tip="${esc(`${c} · ${rotuloMes(b.mes)}\nRealizado: ${brl(real[b.mes][c] || 0)}\nPrevisto: ${brl(p.cats[c])}`)}">${Math.round(x * 100)}%</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div></div>
  </div>`;
}
function editorOrc(p) {
  const base = S.todos.slice(-12), cats = porCategoria(base);
  const media = Object.fromEntries(cats.map((c) => [c.cat, c.total / base.length]));
  const nomes = [...new Set([...cats.map((c) => c.cat), ...Object.keys(p?.cats || {})])];
  const ano = (S.todos.at(-1)?.mes || "2026-01").slice(0, 4);
  const recMedia = base.reduce((s2, b) => s2 + b.totais.receitas, 0) / (base.length || 1);
  return `<form class="card" id="fOrc" data-id="${p?.id || ""}">
    <div class="cab-secao"><span class="eyebrow">${p ? "Editar" : "Nova"} previsão</span><h2>Valores mensais aprovados</h2></div>
    <div class="form" style="margin-top:12px">
      <label>Nome<input id="orcNome" required value="${esc(p?.nome || `Previsão orçamentária ${ano}`)}" placeholder="ex.: Previsão 2026 (AGO de 15/01/2026)"></label>
      <label>Vale de<input id="orcDe" type="month" required value="${p?.de || `${ano}-01`}"></label>
      <label>Até<input id="orcAte" type="month" required value="${p?.ate || `${ano}-12`}"></label>
      <label>Receita mensal prevista (R$)<input id="orcRec" inputmode="decimal" value="${fmtValor(p?.receita || 0)}" placeholder="opcional"></label>
    </div>
    <p class="small muted" style="margin:12px 0 6px">Informe o valor <b>mensal</b> previsto para cada categoria. A coluna de referência mostra a média real dos últimos ${base.length} meses, só para ajudar.</p>
    <div class="acoes" style="margin-bottom:8px"><button class="btn sec" type="button" id="orcMedia">Preencher com a média dos últimos ${base.length} meses</button></div>
    <div class="tabela"><table><thead><tr><th>Categoria</th><th class="n">Média real/mês (referência)</th><th class="n">Previsto por mês (R$)</th></tr></thead><tbody>
      ${nomes.map((c) => `<tr><td>${esc(c)}</td><td class="n muted">${brl(media[c] || 0)}</td><td class="n"><input class="orc-v" data-cat="${esc(c)}" data-media="${(media[c] || 0).toFixed(2)}" inputmode="decimal" value="${fmtValor(p?.cats?.[c] || 0)}"></td></tr>`).join("")}
      <tr class="total"><td>Total mensal previsto</td><td class="n">${brl(nomes.reduce((s2, c) => s2 + (media[c] || 0), 0))}</td><td class="n" id="orcTotal"></td></tr>
    </tbody></table></div>
    <div class="acoes" style="margin-top:12px"><button class="btn" type="submit">Salvar previsão</button><button class="btn sec" type="button" id="orcCancelar">Cancelar</button>
      ${p ? `<button class="btn perigo" type="button" id="orcExcluir">Excluir previsão</button>` : ""}<span class="small muted" id="orcMsg"></span></div>
    <input type="hidden" id="orcRecMedia" value="${recMedia.toFixed(2)}">
  </form>`;
}
function totalOrcEditor() { const t = [...document.querySelectorAll(".orc-v")].reduce((s2, i) => s2 + parseValor(i.value), 0); if ($("#orcTotal")) $("#orcTotal").textContent = brl(t); }

// ---------------------------------------------------------------- parecer do mês em documento
function prepararDoc() {
  const sel = $("#docMes"); if (!sel) return;
  const ops = [...S.todos].reverse().map((b) => `<option value="${b.mes}">${rotuloMes(b.mes)}</option>`).join("");
  if (sel.dataset.ops !== ops) { const v = sel.value; sel.innerHTML = ops; sel.dataset.ops = ops; sel.value = S.todos.some((b) => b.mes === v) ? v : S.todos.at(-1).mes; }
}
function dataExtenso(iso) { const d = new Date(iso + "T12:00:00"); return `${d.getDate()} de ${MESES_EXT[d.getMonth()]} de ${d.getFullYear()}`; }
function gerarDocParecer() {
  const mes = $("#docMes").value, i = S.todos.findIndex((b) => b.mes === mes), b = S.todos[i], ant = S.todos[i - 1];
  const pd = parecerDe(b, $("#docParecerSel").value), t = b.totais, res = t.receitas - t.despesas;
  const cats = porCategoria([b]), prev = previsaoDoMes(b.mes), cond = b.condominio || "Condomínio";
  const resp = relevantesTodos().filter((a) => (a.sit === "respondido" || a.sit === "resolvido") && (S.acomp[a.chave]?.resposta || "").trim());
  const linha = (r, v, cls = "") => `<tr class="${cls}"><td>${r}</td><td class="n">${brl(v)}</td></tr>`;
  const conclusao = {
    validado: `Diante do exposto, o Conselho Fiscal é de parecer <b>FAVORÁVEL</b> à aprovação das contas referentes a ${mesExtenso(b.mes)}.`,
    ressalvas: `Diante do exposto, o Conselho Fiscal é de parecer <b>FAVORÁVEL COM RESSALVAS</b> à aprovação das contas referentes a ${mesExtenso(b.mes)}, condicionado aos esclarecimentos relacionados no item 4.`,
    analise: `O Conselho Fiscal informa que a análise das contas referentes a ${mesExtenso(b.mes)} <b>ENCONTRA-SE EM ANDAMENTO</b>. O parecer será emitido após a conclusão dos esclarecimentos relacionados no item 4.`,
    nao: `Diante do exposto, o Conselho Fiscal é de parecer <b>DESFAVORÁVEL</b> à aprovação das contas referentes a ${mesExtenso(b.mes)}${pd.confere ? ", em razão das pendências relacionadas no item 4" : ", uma vez que os totais do demonstrativo não conferem com a soma dos lançamentos"}.`,
  }[pd.cod];
  $("#folha").innerHTML = `
  <header class="doc-cab"><img src="img/logo-farol.png" alt="" width="70"><div><b>${esc(cond.toUpperCase())}</b><span>Conselho Fiscal</span></div></header>
  <h1>PARECER DO CONSELHO FISCAL Nº ____/${b.mes.slice(0, 4)}</h1>
  <p class="doc-ref">Referência: Demonstrativo de Receitas e Despesas de ${mesExtenso(b.mes)}, emitido pela Logo Gestão Condominial em ${esc(b.emissao)}.</p>
  <h2>1. Objeto</h2>
  <p>O Conselho Fiscal do ${esc(cond)}, no exercício de suas atribuições, examinou o demonstrativo de receitas e despesas do mês de ${mesExtenso(b.mes)}, conferindo os totais apresentados com a soma dos lançamentos e comparando os valores com os meses anteriores${prev ? " e com a previsão orçamentária aprovada" : ""}.</p>
  <h2>2. Demonstrativo do mês</h2>
  <table class="doc-tab"><tbody>
    ${linha("Saldo do mês anterior", t.saldoAnterior ?? 0)}${linha("(+) Receitas", t.receitas)}${linha("(−) Despesas", t.despesas)}
    ${linha(`(=) Resultado do mês (${res >= 0 ? "sobra" : "falta"})`, res, "sub")}${linha("Saldo final em caixa", t.saldoAtual, "sub")}
  </tbody></table>
  <p>${pd.confere ? "Os totais do demonstrativo <b>conferem</b> com a soma dos lançamentos." : "Os totais do demonstrativo <b>não conferem</b> com a soma dos lançamentos."}${ant ? ` Em relação a ${mesExtenso(ant.mes)}, as receitas ${t.receitas >= ant.totais.receitas ? "aumentaram" : "diminuíram"} ${brl(Math.abs(t.receitas - ant.totais.receitas))} e as despesas ${t.despesas >= ant.totais.despesas ? "aumentaram" : "diminuíram"} ${brl(Math.abs(t.despesas - ant.totais.despesas))}.` : ""}</p>
  <h2>3. Despesas por categoria</h2>
  <table class="doc-tab"><thead><tr><th>Categoria</th><th class="n">Realizado</th><th class="n">% do total</th>${prev ? '<th class="n">Previsto</th><th class="n">Diferença</th>' : ""}</tr></thead><tbody>
    ${cats.map((c) => { const o = prev ? prev.cats[c.cat] || 0 : 0; return `<tr><td>${esc(c.cat)}</td><td class="n">${brl(c.total)}</td><td class="n">${pct(c.total / (t.despesas || 1))}</td>${prev ? `<td class="n">${o ? brl(o) : "—"}</td><td class="n">${o ? (c.total - o > 0 ? "+" : "") + brl(c.total - o) : "—"}</td>` : ""}</tr>`; }).join("")}
    <tr class="sub"><td>Total</td><td class="n">${brl(t.despesas)}</td><td class="n">100,0%</td>${prev ? `<td class="n">${brl(Object.values(prev.cats).reduce((s2, v) => s2 + v, 0))}</td><td></td>` : ""}</tr>
  </tbody></table>
  <h2>4. Pontos de atenção</h2>
  ${pd.aguard.length ? gruposAguard(pd.aguard).map((gr) => `<p>${gr.rot}:</p><ol>${gr.itens.map((a) => { const e = S.acomp[a.chave] || {}; return `<li>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}${e.enviado ? ` (questionado em ${dataBR(e.enviado)}${e.prazo ? `, prazo ${dataBR(e.prazo)}` : ""})` : ""}.</li>`; }).join("")}</ol>`).join("") : "<p>Não há perguntas aguardando resposta.</p>"}
  ${resp.length ? `<p>Esclarecimentos recebidos:</p><ol>${resp.map((a) => `<li>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}: ${esc(S.acomp[a.chave].resposta.trim())}${a.sit === "resolvido" ? " (resolvido)" : ""}</li>`).join("")}</ol>` : ""}
  <h2>5. Conclusão</h2>
  <p>${conclusao}</p>
  <p class="doc-data">Salvador, ${dataExtenso(hojeISO())}.</p>
  <div class="assinaturas"><div><span></span>Conselheiro(a) Fiscal</div><div><span></span>Conselheiro(a) Fiscal</div><div><span></span>Conselheiro(a) Fiscal</div></div>`;
  $("#docParecer").hidden = false; document.body.classList.add("com-doc");
  $("#folha").focus();
}
function baixarWord() {
  const css = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111}h1{font-size:14pt;text-align:center}h2{font-size:12pt;color:#054166;margin-top:14pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 6px}th{background:#e3eef6}.n{text-align:right}.sub td{font-weight:bold;background:#f3f6f9}.doc-cab img{display:none}.assinaturas div{margin-top:36pt;border-top:1px solid #333;width:45%;padding-top:4pt}`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css}</style></head><body>${$("#folha").innerHTML}</body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
  a.download = `Parecer-Conselho-Fiscal-${$("#docMes").value}.doc`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------------- acesso com usuário e senha
function telaAcesso(qual, msg, ok) {
  const t = $("#telaAcesso");
  t.hidden = !qual; document.body.classList.toggle("travado", !!qual);
  for (const id of ["fLogin", "fTroca", "fPrimeiro"]) $("#" + id).hidden = id !== qual;
  $("#acessoCarregando").hidden = qual !== "carregando";
  const m = $("#acessoMsg"); m.hidden = !msg; m.textContent = msg || ""; m.className = `acesso-msg ${ok ? "ok" : ""}`;
  const foco = { fLogin: "#lgUsuario", fTroca: "#trNova", fPrimeiro: "#paNome" }[qual];
  if (foco) setTimeout(() => $(foco)?.focus(), 30);
}
function aplicarPerfil() {
  document.body.dataset.perfil = AC.ligado ? AC.perfil || "" : "admin";
  $("#usuarioBox").hidden = !AC.ligado || !AC.reg;
  if (AC.reg) { $("#ubNome").textContent = AC.reg.nome || AC.reg.usuario; $("#ubPerfil").textContent = `${AC.reg.usuario} · ${PERFIS[AC.perfil] || ""}`; }
  // perfil Visualização: só as telas de leitura simples
  const vis = AC.ligado && AC.perfil === "visualizacao";
  let grupo = null, visiveis = 0;
  const fechaGrupo = () => { if (grupo) grupo.hidden = !visiveis; };
  for (const el of document.querySelectorAll(".menu > *")) {
    if (el.classList.contains("grupo")) { fechaGrupo(); grupo = el; visiveis = 0; continue; }
    const aba = (el.getAttribute("href") || "").slice(1);
    el.hidden = (vis && !ABAS_VIS.includes(aba)) || (AC.ligado && !ehAdmin() && (aba === "administracao" || aba === "dados"));
    if (!el.hidden) visiveis++;
  }
  fechaGrupo();
  $("#marcarEnviados").classList.add("so-editor");
  $("#btnPublicar").textContent = AC.ligado ? "Publicar balancetes" : "Publicar base no GitHub";
  $("#cfgGithub").querySelectorAll(".form, .passo-token, #btnExportar, label[for=importJson]").forEach((el) => (el.hidden = AC.ligado));
}
async function iniciarAcesso(cfg) {
  telaAcesso("carregando");
  try { await carregarFirebase(cfg); }
  catch { telaAcesso("carregando", "Não foi possível carregar o serviço de acesso. Verifique a internet e recarregue a página."); return; }
  let sessaoIniciada = false;
  aoMudarSessao(async (user) => {
    if (!user) {
      AC.user = AC.reg = AC.perfil = null; aplicarPerfil();
      let temAdmin = true, aviso = S.msgSaida;
      try { temAdmin = await existeAdministrador(); }
      catch (e) { aviso = /permission|insufficient/.test(e.code || "") ? "O banco do Firebase recusou o acesso: as regras ainda não foram publicadas no Firestore (aba Regras). Publique as regras e recarregue a página." : `Não foi possível ler o banco do Firebase (${e.code || e.message}). Confira se o Firestore foi criado.`; }
      telaAcesso(temAdmin ? "fLogin" : "fPrimeiro", aviso); S.msgSaida = ""; return;
    }
    telaAcesso("carregando");
    try {
      const reg = await lerPerfil(user);
      if (!reg || reg.ativo !== true) { S.msgSaida = "Seu acesso está desativado ou foi substituído. Fale com o administrador."; await sair(); return; }
      if (reg.trocarSenha) { telaAcesso("fTroca"); return; }
      registrarAcesso();
      const dados = await lerDados();
      await carregarBase(dados);
      aplicarPerfil(); rota(); telaAcesso(null); render(); prepararAdmin(); avisoVencidos();
      if (!sessaoIniciada) {
        sessaoIniciada = true;
        // anotações de outros conselheiros chegam sem recarregar a página
        ouvirAcomp((itens) => {
          S.acompRemoto = mesclarAcomp(S.acompRemoto, itens);
          const antes = JSON.stringify(S.acomp);
          S.acomp = mesclarAcomp(S.acomp, itens);
          if (JSON.stringify(S.acomp) !== antes && !/TEXTAREA|INPUT|SELECT/.test(document.activeElement?.tagName || "")) { ls.set(LS_ACOMP, S.acomp); const y = scrollY; render(); scrollTo(0, y); }
          descreverSync();
        });
        if (podeEditar() && pendentesPublicar()) agendarSync();
      }
    } catch (e) { telaAcesso("fLogin", mensagemErro(e)); }
  });
}
$("#fLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.submitter || $("#fLogin button"); b.disabled = true;
  S.senhaLogin = $("#lgSenha").value; // só para impedir que a provisória seja reaproveitada como senha nova
  try { await entrar($("#lgUsuario").value, $("#lgSenha").value); $("#lgSenha").value = ""; }
  catch (err) { telaAcesso("fLogin", mensagemErro(err)); }
  b.disabled = false;
});
$("#fTroca").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nova = $("#trNova").value, rep = $("#trRepete").value;
  if (nova !== rep) return telaAcesso("fTroca", "As duas senhas não são iguais.");
  const v = validarSenha(nova, S.senhaLogin); if (v) return telaAcesso("fTroca", v);
  try {
    await trocarSenha(nova); S.senhaLogin = "";
    $("#trNova").value = $("#trRepete").value = "";
    telaAcesso("carregando", "Senha criada. Entrando…", true);
    const dados = await lerDados(); await carregarBase(dados);
    registrarAcesso(); aplicarPerfil(); rota(); telaAcesso(null); render(); prepararAdmin(); avisoVencidos();
    toast("Senha alterada. Use-a nos próximos acessos.");
  } catch (err) { telaAcesso("fTroca", mensagemErro(err)); }
});
$("#fPrimeiro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senha = $("#paSenha").value;
  if (senha !== $("#paRepete").value) return telaAcesso("fPrimeiro", "As duas senhas não são iguais.");
  const v = validarSenha(senha); if (v) return telaAcesso("fPrimeiro", v);
  if (!normUsuario($("#paUsuario").value)) return telaAcesso("fPrimeiro", "Informe um usuário com letras ou números.");
  try { telaAcesso("carregando"); await criarPrimeiroAdmin($("#paNome").value.trim(), $("#paUsuario").value, senha); }
  catch (err) { telaAcesso("fPrimeiro", mensagemErro(err)); }
});
document.addEventListener("click", async (e) => {
  if (e.target.closest("[data-sair]")) { S.msgSaida = ""; ls.del(LS_ACOMP); ls.del(LS_MESES); await sair(); return; }
  if (e.target.closest("#btnMinhaSenha")) { $("#trocaPropria").hidden = false; $("#tpAtual").focus(); }
});

$("#resumoMesSel").addEventListener("change", (e) => { S.resumoMes = e.target.value; resumoMes(); });
$("#avisoFechar").addEventListener("click", fecharAviso);
$("#avisoIr").addEventListener("click", () => { fecharAviso(); location.hash = "#acompanhamento"; });
$("#btnGerarDoc").addEventListener("click", gerarDocParecer);
$("#docFechar").addEventListener("click", () => { $("#docParecer").hidden = true; document.body.classList.remove("com-doc"); });
$("#docImprimir").addEventListener("click", () => { if (window.self !== window.top) return toast("Na prévia não é possível imprimir. Use o site publicado ou Baixar Word."); window.print(); });
$("#docWord").addEventListener("click", baixarWord);
document.addEventListener("input", (e) => { if (e.target.classList && e.target.classList.contains("orc-v")) totalOrcEditor(); });
document.addEventListener("change", (e) => { if (e.target.id === "orcSel") { S.orcSel = e.target.value; orcamentoTab(); } });
document.addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-orc-editar]");
  if (ed) { S.orcEditando = ed.dataset.orcEditar; orcamentoTab(); totalOrcEditor(); return; }
  if (e.target.closest("#orcCancelar")) { S.orcEditando = undefined; orcamentoTab(); return; }
  if (e.target.closest("#orcMedia")) { document.querySelectorAll(".orc-v").forEach((i) => (i.value = fmtValor(Math.round(+i.dataset.media * 100) / 100))); if (!parseValor($("#orcRec").value)) $("#orcRec").value = fmtValor(+$("#orcRecMedia").value); totalOrcEditor(); return; }
  const ex = e.target.closest("#orcExcluir");
  if (ex) {
    if (ex.dataset.conf !== "1") { ex.dataset.conf = "1"; ex.textContent = "Confirmar exclusão?"; return; }
    S.orc = S.orc.filter((x) => x.id !== $("#fOrc").dataset.id); S.orcEditando = undefined;
    try { await salvarOrc(); toast("Previsão excluída."); } catch (err) { toast(mensagemErro(err)); }
    render(); return;
  }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "fOrc") return;
  e.preventDefault();
  const de = $("#orcDe").value, ate = $("#orcAte").value;
  if (!de || !ate || de > ate) return ($("#orcMsg").textContent = "Confira a vigência: o início deve ser antes do fim.");
  const id = e.target.dataset.id || novoId();
  const outra = S.orc.find((x) => x.id !== id && !(ate < x.de || de > x.ate));
  if (outra) return ($("#orcMsg").textContent = `A vigência se sobrepõe à previsão "${outra.nome}". Ajuste as datas.`);
  const cats = {}; document.querySelectorAll(".orc-v").forEach((i) => { const v = parseValor(i.value); if (v) cats[i.dataset.cat] = v; });
  if (!Object.keys(cats).length) return ($("#orcMsg").textContent = "Informe o valor previsto de pelo menos uma categoria.");
  const prev = { id, nome: $("#orcNome").value.trim(), de, ate, receita: parseValor($("#orcRec").value), cats, por: nomeUsuario(), ts: new Date().toISOString() };
  const antes = S.orc; S.orc = [...S.orc.filter((x) => x.id !== id), prev].sort((a, b) => a.de.localeCompare(b.de));
  $("#orcMsg").textContent = "Salvando…";
  try { await salvarOrc(); S.orcEditando = undefined; S.orcSel = id; render(); toast("Previsão orçamentária salva."); }
  catch (err) { S.orc = antes; $("#orcMsg").textContent = mensagemErro(err); }
});
$("#tpCancelar").addEventListener("click", () => ($("#trocaPropria").hidden = true));
$("#fTrocaPropria").addEventListener("submit", async (e) => {
  e.preventDefault();
  const m = $("#tpMsg"), nova = $("#tpNova").value;
  const erro = (t) => { m.hidden = false; m.className = "acesso-msg"; m.textContent = t; };
  if (nova !== $("#tpRepete").value) return erro("As duas senhas não são iguais.");
  const v = validarSenha(nova, $("#tpAtual").value); if (v) return erro(v);
  try { await trocarSenha(nova, $("#tpAtual").value); $("#trocaPropria").hidden = true; ["#tpAtual", "#tpNova", "#tpRepete"].forEach((i) => ($(i).value = "")); m.hidden = true; toast("Senha alterada."); }
  catch (err) { erro(mensagemErro(err)); }
});

// ---------------------------------------------------------------- aba Administração
function prepararAdmin() {
  $("#admSemFirebase").hidden = AC.ligado;
  $("#admComFirebase").hidden = !AC.ligado;
  $("#txtRegras").textContent = REGRAS;
  if (AC.ligado && ehAdmin()) { listarUsuarios(); infoMigracao(); }
}
const dataHora = (t) => { try { return t && t.toDate ? t.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; } catch { return "—"; } };
async function listarUsuarios() {
  try {
    const us = (await listarAcessos()).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    $("#tabAcessos").innerHTML = `<thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Situação</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>${us.map((u) => {
      const eu = u.uid === AC.user?.uid;
      return `<tr><td><b style="font-weight:600">${esc(u.nome || "")}</b>${eu ? ' <span class="mini">(você)</span>' : ""}</td><td>${esc(u.usuario)}</td>
      <td><select data-perfil-uid="${u.uid}" ${eu ? "disabled" : ""}>${Object.entries(PERFIS).map(([k, t]) => `<option value="${k}" ${u.perfil === k ? "selected" : ""}>${t}</option>`).join("")}</select></td>
      <td>${u.ativo ? (u.trocarSenha ? '<span class="sit questionado">Aguardando 1º acesso</span>' : '<span class="sit resolvido">Ativo</span>') : '<span class="sit descartado">Desativado</span>'}</td>
      <td class="num">${dataHora(u.ultimoAcesso)}</td>
      <td><div class="acoes-lin">${eu ? "" : `<button type="button" data-reset="${u.uid}">Nova senha provisória</button><button type="button" class="${u.ativo ? "perigo" : ""}" data-ativo="${u.uid}" data-v="${u.ativo ? 0 : 1}">${u.ativo ? "Desativar" : "Reativar"}</button>`}</div></td></tr>`;
    }).join("")}</tbody>`;
  } catch (e) { $("#tabAcessos").innerHTML = `<tbody><tr><td class="muted">${esc(mensagemErro(e))}</td></tr></tbody>`; }
}
function mostrarCredencial(c, titulo) {
  const end = location.origin + location.pathname;
  const txt = `Acesso ao painel do Conselho Fiscal\nEndereço: ${end}\nUsuário: ${c.usuario}\nSenha provisória: ${c.senha}\n\nNo primeiro acesso o sistema pede para você criar a sua própria senha.`;
  $("#credencial").hidden = false;
  $("#credencial").innerHTML = `<b>${esc(titulo)}</b><span class="small">Copie e envie à pessoa. Esta senha não será mostrada de novo.</span><pre id="credTxt">${esc(txt)}</pre><div class="acoes"><button class="btn sec" type="button" id="copiarCred">Copiar</button></div>`;
  $("#credencial").scrollIntoView({ block: "center" });
}
$("#fNovoAcesso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.submitter || $("#fNovoAcesso button"); b.disabled = true; b.textContent = "Criando…";
  try {
    const c = await criarAcesso({ nome: $("#naNome").value.trim(), usuario: $("#naUsuario").value, perfil: $("#naPerfil").value });
    mostrarCredencial(c, `Acesso criado: ${$("#naNome").value.trim()}`);
    $("#naNome").value = $("#naUsuario").value = ""; listarUsuarios();
  } catch (err) { toast(mensagemErro(err)); }
  b.disabled = false; b.textContent = "Criar acesso com senha provisória";
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.perfilUid) { try { await atualizarAcesso(t.dataset.perfilUid, { perfil: t.value }); toast("Perfil alterado."); } catch (err) { toast(mensagemErro(err)); listarUsuarios(); } }
});
document.addEventListener("click", async (e) => {
  const r = e.target.closest("[data-reset]");
  if (r) {
    if (r.dataset.conf !== "1") { r.dataset.conf = "1"; r.textContent = "Confirmar nova senha?"; setTimeout(() => { r.dataset.conf = ""; r.textContent = "Nova senha provisória"; }, 4000); return; }
    r.disabled = true;
    try { const c = await novaSenhaProvisoria(r.dataset.reset); mostrarCredencial(c, `Nova senha provisória para ${c.usuario}`); listarUsuarios(); }
    catch (err) { toast(mensagemErro(err)); r.disabled = false; }
    return;
  }
  const at = e.target.closest("[data-ativo]");
  if (at) { try { await atualizarAcesso(at.dataset.ativo, { ativo: at.dataset.v === "1" }); toast(at.dataset.v === "1" ? "Acesso reativado." : "Acesso desativado."); listarUsuarios(); } catch (err) { toast(mensagemErro(err)); } return; }
  if (e.target.closest("#copiarCred")) { navigator.clipboard.writeText($("#credTxt").innerText).then(() => toast("Copiado."), () => { const g = document.createRange(); g.selectNodeContents($("#credTxt")); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(g); toast("Selecionado. Use Ctrl+C."); }); return; }
  if (e.target.closest("#copiarRegras")) { navigator.clipboard.writeText(REGRAS).then(() => toast("Regras copiadas."), () => { const g = document.createRange(); g.selectNodeContents($("#txtRegras")); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(g); toast("Selecionado. Use Ctrl+C."); }); return; }
  if (e.target.closest("#btnAtivarLogin")) { ativarLogin(); return; }
  if (e.target.closest("#btnMigrar")) { migrar(); return; }
  if (e.target.closest("#btnRemoverPublicos")) { $("#confirmaRemover").hidden = false; return; }
  if (e.target.closest("#naoRemover")) { $("#confirmaRemover").hidden = true; return; }
  if (e.target.closest("#simRemover")) { $("#confirmaRemover").hidden = true; removerPublicos(); return; }
});
// lê o bloco firebaseConfig colado do console do Firebase
function lerConfig(txt) {
  const c = {};
  for (const k of ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]) {
    const m = txt.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`)); if (m) c[k] = m[1];
  }
  return c.apiKey && c.projectId && c.appId ? c : null;
}
async function githubPut(caminho, conteudo, mensagem) {
  const g = ls.get(LS_GH, {});
  if (!g.owner || !g.repo || !g.token) throw new Error("Configure antes o token do GitHub em Importar balancetes.");
  const url = `https://api.github.com/repos/${g.owner}/${g.repo}/contents/${caminho}`, hdr = { Authorization: `Bearer ${g.token}`, Accept: "application/vnd.github+json" };
  let sha; const r = await fetch(`${url}?ref=${g.branch || "main"}`, { headers: hdr, cache: "no-store" }); if (r.ok) sha = (await r.json()).sha;
  const p = await fetch(url, { method: conteudo === null ? "DELETE" : "PUT", headers: { ...hdr, "Content-Type": "application/json" },
    body: JSON.stringify(conteudo === null ? { message: mensagem, sha, branch: g.branch || "main" } : { message: mensagem, content: b64(conteudo), sha, branch: g.branch || "main" }) });
  if (!p.ok && !(conteudo === null && p.status === 404)) throw new Error(`GitHub recusou (${p.status}).`);
}
async function ativarLogin() {
  const c = lerConfig($("#txtConfig").value);
  if (!c) return ($("#cfgMsg").textContent = "Não reconheci a configuração. Cole o bloco inteiro, com apiKey, projectId e appId.");
  $("#cfgMsg").textContent = "Publicando…";
  try {
    await githubPut("js/firebase-config.js", `window.__FIREBASE__ = ${JSON.stringify(c, null, 2)};\n`, "Ativa o login (Firebase)");
    $("#cfgMsg").textContent = "Pronto. Em 1 a 2 minutos recarregue a página: aparecerá a tela para criar o administrador.";
  } catch (e) { $("#cfgMsg").textContent = e.message; }
}
async function infoMigracao() {
  const n = Object.keys(S.base).length;
  let publicos = false; try { publicos = (await fetch("data/balancetes.json", { method: "HEAD", cache: "no-store" })).ok; } catch {}
  $("#migraInfo").textContent = `A base protegida tem ${n} balancete(s).` + (publicos ? " Ainda existem arquivos públicos com dados no GitHub." : " Não há mais arquivos públicos com dados no site.");
  $("#btnMigrar").hidden = !publicos && n > 0;
  $("#btnRemoverPublicos").hidden = !(publicos && n > 0);
}
async function migrar() {
  const msg = $("#migraMsg"); msg.textContent = "Lendo os dados atuais…";
  try {
    let meses = {}, acomp = {}, analise = "";
    try { const r = await fetch("data/balancetes.json", { cache: "no-store" }); if (r.ok) { const j = await r.json(); meses = j.meses || {}; acomp = j.acompanhamento || {}; } } catch {}
    if (!Object.keys(meses).length && window.__BASE_BALANCETES__) meses = window.__BASE_BALANCETES__.meses || {};
    try { const r = await fetch("data/acompanhamento.json", { cache: "no-store" }); if (r.ok) acomp = mesclarAcomp(acomp, (await r.json()).itens || {}); } catch {}
    try { const r = await fetch("data/analise.html", { cache: "no-store" }); if (r.ok) analise = await r.text(); } catch {}
    meses = { ...meses, ...S.locais }; acomp = mesclarAcomp(acomp, S.acomp);
    msg.textContent = `Gravando ${Object.keys(meses).length} balancete(s)…`;
    await gravarMeses(meses);
    await gravarAcomp(acomp);
    if (analise) await gravarAnalise(analise);
    const d = await lerDados(); await carregarBase(d); S.locais = {}; ls.del(LS_MESES); juntar(); render();
    msg.textContent = `Pronto: ${Object.keys(d.meses).length} balancete(s) e ${Object.keys(d.acompanhamento).length} anotação(ões) na base protegida.`;
    infoMigracao();
  } catch (e) { msg.textContent = mensagemErro(e); }
}
async function removerPublicos() {
  const msg = $("#migraMsg"); msg.textContent = "Removendo arquivos públicos…";
  try {
    for (const f of ["data/balancetes.json", "data/acompanhamento.json", "data/analise.html"]) await githubPut(f, null, "Remove dados públicos (agora na base protegida)");
    await githubPut("js/base.js", "window.__BASE_BALANCETES__ = null;\n", "Base pública desativada");
    msg.textContent = "Arquivos públicos removidos. O site continua igual para quem tem acesso.";
    infoMigracao();
  } catch (e) { msg.textContent = e.message; }
}

// ---------------------------------------------------------------- navegação e eventos
const ABAS = ["resumo", "orcamento", "painel", "analises", "mes", "projecao", "categorias", "fornecedores", "acompanhamento", "alertas", "parcelas", "lancamentos", "notas", "conselho", "administracao", "dados"];
function rota() {
  const vis = AC.ligado && AC.perfil === "visualizacao";
  let a = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : vis ? "resumo" : "painel";
  if (AC.ligado && !ehAdmin() && (a === "administracao" || a === "dados")) a = "painel";
  if (vis && !ABAS_VIS.includes(a)) a = "resumo";
  document.querySelectorAll("section[data-aba]").forEach((s) => (s.hidden = s.dataset.aba !== a));
  let grupo = "";
  for (const el of document.querySelectorAll(".menu > *")) {
    if (el.classList.contains("grupo")) { grupo = el.textContent; continue; }
    const ativo = el.getAttribute("href") === `#${a}`;
    ativo ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current");
    if (ativo) { $("#tituloPagina").textContent = el.querySelector("span").textContent; $("#grupoPagina").textContent = grupo; }
  }
}
window.addEventListener("hashchange", () => { rota(); window.scrollTo(0, 0); });

for (const id of ["#de", "#ate"]) $(id).addEventListener("change", () => {
  ls.set(LS_PER, { de: $("#de").value, ate: $("#ate").value, fixo: $("#ate").value !== S.todos.at(-1)?.mes });
  S.ids = null; render();
});
$("#buscaForn").addEventListener("input", fornecedores);
for (const id of ["#buscaLanc", "#fCat", "#fForn", "#fSemDoc"]) $(id).addEventListener("input", () => { S.limite = 300; lancTab(); });
$("#maisLanc").addEventListener("click", () => { S.limite += 300; lancTab(); });
$("#btnCsv").addEventListener("click", csv);
document.addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.sit) { S.sit.has(t.dataset.sit) ? S.sit.delete(t.dataset.sit) : S.sit.add(t.dataset.sit); listaAlertas(); }
  if (t.dataset.mes !== undefined && t.dataset.mes) { S.mesSel = t.dataset.mes; renderMes(S.todos, S.mesSel, alertas(S.todos), $("#secMes")); window.scrollTo(0, 0); }
  if (t.dataset.detalheForn) { S.fornSel = t.dataset.detalheForn; fornecedores(); location.hash = "#fornecedores"; window.scrollTo(0, 0); }
  if (t.id === "btnCsvAlertas") csvAlertas();
  if (t.dataset.sev) { S.sev.has(t.dataset.sev) ? S.sev.delete(t.dataset.sev) : S.sev.add(t.dataset.sev); listaAlertas(); }
  if (t.dataset.alerta) { S.ids = S.alertas[+t.dataset.alerta].ids; $("#buscaLanc").value = ""; $("#fCat").value = ""; $("#fForn").value = ""; $("#fSemDoc").checked = false; lancTab(); location.hash = "#lancamentos"; }
  if (t.id === "limparIds") { S.ids = null; lancTab(); }
  if (t.dataset.forn) { S.ids = null; $("#buscaLanc").value = ""; lancTab(); $("#fForn").value = t.dataset.forn; lancTab(); location.hash = "#lancamentos"; }
  if (t.dataset.remover) { delete S.locais[t.dataset.remover]; ls.set(LS_MESES, S.locais); juntar(); render(); }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "selMes") { S.mesSel = t.value; renderMes(S.todos, S.mesSel, alertas(S.todos), $("#secMes")); }
  if (t.id === "selForn") { S.fornSel = t.value; renderFornecedor(S.meses, S.fornSel, S.alertas, $("#fichaForn")); }
  if ((t.dataset.acomp || t.dataset.resp || t.dataset.campo) && !podeEditar()) return;
  if (t.dataset.acomp) { mudarSituacao(t.dataset.acomp, t.value); const y = scrollY; render(); scrollTo(0, y); toast("Situação atualizada e gravada."); }
  if (t.dataset.resp) salvarAcomp(t.dataset.resp, { resposta: t.value }, "editou a resposta/anotação");
  if (t.dataset.campo) {
    const nomes = { enviado: "a data de envio", prazo: "o prazo", responsavel: "de quem aguarda resposta" };
    const v = t.value;
    salvarAcomp(t.dataset.chave, { [t.dataset.campo]: v }, `alterou ${nomes[t.dataset.campo]} para ${t.type === "date" ? dataBR(v) || "(vazio)" : v || "(vazio)"}`);
    { const y = scrollY; render(); scrollTo(0, y); }
  }
  if (t.id === "prazoDias") acompanhamento();
});
// grava a anotação a cada tecla: nada se perde se a página for fechada antes de sair do campo
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.resp && podeEditar()) salvarAcomp(t.dataset.resp, { resposta: t.value });
  if (t.id === "whatsTexto") { S.whatsEditado = true; atualizarWhats(); }
  if (t.id === "whatsResp" || t.id === "whatsLink" || t.id === "whatsParecer") gerarWhats();
});
window.addEventListener("pagehide", () => { if (podeSync() && pendentesPublicar()) sincronizar(); });
new MutationObserver(() => { cancelAnimationFrame(aplicarOrdens.f); aplicarOrdens.f = requestAnimationFrame(aplicarOrdens); })
  .observe(document.querySelector("main"), { childList: true, subtree: true });
document.addEventListener("keydown", (e) => { const th = e.target.closest && e.target.closest("th.ordenavel"); if (th && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); clicarCabecalho(th); } });
document.addEventListener("click", (e) => {
  const thO = e.target.closest("main thead th");
  if (thO && !e.target.closest("a, button, input, select")) { clicarCabecalho(thO); return; }
  const ir = e.target.closest("[data-ir-alerta]");
  if (ir) {
    e.preventDefault();
    const ch = ir.dataset.irAlerta;
    if (!S.alertas.some((a) => a.chave === ch)) { $("#de").value = S.todos[0].mes; $("#ate").value = S.todos.at(-1).mes; ls.set(LS_PER, { de: S.todos[0].mes, ate: S.todos.at(-1).mes, fixo: false }); render(); }
    S.sev = new Set(Object.keys(SEV)); S.sit = new Set(Object.keys(SITUACOES)); listaAlertas();
    location.hash = "#alertas";
    setTimeout(() => { const el = document.getElementById("al-" + ch); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("destaque"); setTimeout(() => el.classList.remove("destaque"), 2200); } }, 60);
    return;
  }
  const ck = e.target.closest("button[data-chk]");
  if (ck) {
    const k = `chk:${ck.dataset.chk}`, et = ck.dataset.etapa, atual = { ...(S.acomp[k] || {}) };
    if (!podeEditar()) return;
    atual[et] = atual[et] ? false : `${new Date().toLocaleDateString("pt-BR")}${nomeUsuario() ? ` por ${nomeUsuario()}` : ""}`; // false (e não apagar) para a base protegida também desmarcar
    S.acomp[k] = { ...atual, ts: new Date().toISOString() }; ls.set(LS_ACOMP, S.acomp); agendarSync(); acompanhamento();
    return;
  }
  if (e.target.closest("#marcarEnviados")) {
    if (!podeEditar()) return;
    const dias = +($("#prazoDias").value || 15), hoje = hojeISO();
    for (const a of S.oficio || []) salvarAcomp(a.chave, { status: "questionado", enviado: hoje, prazo: somaDias(hoje, dias) }, `enviou no ofício de ${dataBR(hoje)}, com prazo até ${dataBR(somaDias(hoje, dias))}`);
    render(); toast("Perguntas marcadas como questionadas, com prazo de resposta.");
    return;
  }
  if (e.target.closest("#copiarWhats")) {
    const ta = $("#whatsTexto");
    navigator.clipboard.writeText(ta.value).then(() => toast("Mensagem copiada. Cole no grupo de avisos."), () => { ta.select(); toast("Selecionado. Use Ctrl+C para copiar."); });
    return;
  }
  if (e.target.closest("#gerarWhats")) { gerarWhats(); toast("Mensagem atualizada com os dados atuais."); return; }
  if (e.target.closest("#copiarOficio")) {
    navigator.clipboard.writeText($("#oficio").innerText).then(() => toast("Ofício copiado."), () => { const r = document.createRange(); r.selectNodeContents($("#oficio")); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); toast("Selecionado. Use Ctrl+C para copiar."); });
    return;
  }
  if (e.target.closest("#btnSyncAgora")) {
    if (podeSync()) { sincronizar(); return; }
    location.hash = "#dados";
    setTimeout(() => { const c = $("#cfgGithub"); if (c) { c.scrollIntoView({ block: "start" }); c.classList.add("destaque"); setTimeout(() => c.classList.remove("destaque"), 2500); } ($("#ghToken").value ? $("#ghOwner") : $("#ghToken")).focus(); }, 80);
    if (window.self !== window.top) toast("Nesta prévia o envio ao GitHub não funciona. Use o site no GitHub Pages.");
    return;
  }
  const l = e.target.closest("a[data-filtra-mes]"); if (!l) return;
  S.ids = lancamentos(S.todos).filter((d) => d.mes === l.dataset.filtraMes).map((d) => d.id); lancTab();
});
$("#arquivos").addEventListener("change", (e) => { if (e.target.files.length) importar([...e.target.files]); e.target.value = ""; });
const drop = $("#drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = [...e.dataTransfer.files].filter((x) => /pdf$/i.test(x.name) || x.type === "application/pdf"); if (f.length) importar(f); });
$("#btnPublicar").addEventListener("click", publicar);
for (const id of ["#ghOwner", "#ghRepo", "#ghBranch", "#ghToken"]) $(id).addEventListener("change", () => {
  ls.set(LS_GH, { owner: $("#ghOwner").value.trim(), repo: $("#ghRepo").value.trim(), branch: $("#ghBranch").value.trim() || "main", token: $("#ghToken").value.trim() });
  agendarSync();
});
$("#btnExportar").addEventListener("click", () => baixar("balancetes.json", JSON.stringify(baseCompleta()), "application/json"));
$("#importJson").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const ms = j.meses || {}; let n = 0;
    for (const [k, b] of Object.entries(ms)) if (b && b.mes && Array.isArray(b.despesas)) { S.locais[k] = b; n++; }
    ls.set(LS_MESES, S.locais); juntar(); render(); toast(`${n} mês(es) carregados do arquivo.`);
  } catch { toast("Arquivo JSON inválido."); }
});
$("#btnLimpar").addEventListener("click", () => ($("#confirmaLimpar").hidden = false));
$("#naoLimpar").addEventListener("click", () => ($("#confirmaLimpar").hidden = true));
$("#simLimpar").addEventListener("click", () => { S.locais = {}; ls.del(LS_MESES); $("#confirmaLimpar").hidden = true; juntar(); render(); toast("Meses não publicados descartados."); });
$("#copiarMinuta").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#minuta").innerText); toast("Texto copiado."); }
  catch { const r = document.createRange(); r.selectNodeContents($("#minuta")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selecionado. Use Ctrl+C para copiar."); }
});

const tip = $("#tip");
document.addEventListener("mousemove", (e) => {
  const col = e.target.closest && e.target.closest("svg.combo .col");
  document.querySelectorAll("svg.combo .guia").forEach((l) => { if (col && l.ownerSVGElement === col.ownerSVGElement) { const x = +col.getAttribute("x") + +col.getAttribute("width") / 2; l.setAttribute("x1", x); l.setAttribute("x2", x); l.setAttribute("opacity", ".6"); } else l.setAttribute("opacity", "0"); });
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.getAttribute("data-tip"); tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(innerWidth - w - 12, e.clientX + 14) + "px";
  tip.style.top = (e.clientY - h - 12 < 8 ? e.clientY + 18 : e.clientY - h - 12) + "px";
});
if (window.self === window.top) { $("#btnImprimir").hidden = false; $("#btnImprimir").addEventListener("click", () => window.print()); }

const CFG_FB = window.__FIREBASE__;
if (CFG_FB && CFG_FB.apiKey && window.self === window.top) await iniciarAcesso(CFG_FB);
else { await carregarBase(); aplicarPerfil(); rota(); render(); prepararAdmin(); avisoVencidos(); }
