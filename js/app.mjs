import { lerBalancete, conferir, separarFornecedor, nomeFornecedor } from "./parser.mjs";
import { renderExecutivo } from "./executivo.mjs";
import { renderMes, renderProjecao, renderFornecedor, mapaCalor, SITUACOES, chaveAlerta, chaveAntiga } from "./gestao.mjs";
import { comboMensal, saude, treemapCategorias, listaTendencia, multiplos } from "./graficos.mjs";
import { textoDoArquivo, lerContrato, fimVigente, casarFornecedor } from "./contratos.mjs";
import { AC, PERFIS, podeEditar, ehAdmin, normUsuario, validarSenha, mensagemErro, carregarFirebase, existeAdministrador, entrar, sair, aoMudarSessao,
  lerPerfil, registrarAcesso, trocarSenha, criarPrimeiroAdmin, criarAcesso, novaSenhaProvisoria, atualizarAcesso, listarAcessos,
  lerDados, gravarMeses, gravarAnalise, gravarAcomp, ouvirAcomp, gravarOrcamento, nomeUsuario, gravarContratos, gravarFundo, registrar, lerRegistros, REGRAS } from "./acesso.mjs";
import { rotuloMes, r2, lancamentos, resumoMensal, porCategoria, porFornecedor, parcelas, indicadores, alertas, datasErradasNota } from "./analise.mjs";

const $ = (s) => document.querySelector(s);
const brl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => (v * 100).toFixed(1).replace(".", ",") + "%";
const pct2 = (v) => (v * 100).toFixed(2).replace(".", ",") + "%";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LS_CT = "farol.contratos.v1", LS_FUNDO = "farol.fundo.v1", LS_ATA = "farol.ata.v1", LS_VISTO = "farol.ultimoMesVisto", LS_ORC = "farol.orcamento.v1", LS_ORD = "farol.ordem.v1", LS_ACOMP = "farol.acompanhamento.v1", LS_MESES = "farol.balancetes.locais.v1", LS_GH = "farol.github.v1", LS_PER = "farol.periodo.v1";
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4200); }

const S = { base: {}, locais: {}, todos: [], meses: [], sev: new Set(["alta", "media", "baixa", "info"]), ids: null, limite: 300 };

// ---------------------------------------------------------------- atualização enviada por link (#atualizar=...)
// os dados viajam só no link (nunca no código publicado) e são gravados na base protegida por um administrador
async function lerPacote(cod) {
  const b64 = cod.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((cod.length + 3) % 4);
  const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const txt = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  return JSON.parse(txt);
}
if (/^#atualizar=/.test(location.hash)) {
  const cod = location.hash.slice(11);
  try { sessionStorage.setItem("farol.pacote", cod); } catch {}
  history.replaceState(null, "", location.pathname + location.search + "#contratos");
}
S.pacoteCod = (() => { try { return sessionStorage.getItem("farol.pacote") || ""; } catch { return ""; } })();
async function mostrarPacote() {
  if (!S.pacoteCod || S.pacoteMostrado) return;
  const el = $("#bannerPacote"); if (!el) return;
  if (AC.ligado && !ehAdmin()) { el.hidden = false; $("#bannerPacoteTxt").textContent = "Há uma atualização de contratos e da análise para gravar. Entre com um usuário administrador para aplicá-la."; $("#pacoteAplicar").hidden = true; return; }
  try { S.pacote = await lerPacote(S.pacoteCod); } catch { el.hidden = false; $("#bannerPacoteTxt").textContent = "O link de atualização está incompleto ou corrompido."; $("#pacoteAplicar").hidden = true; return; }
  S.pacoteMostrado = true; $("#pacoteAplicar").hidden = false;
  const pc = S.pacote, ex = (pc.contratos || []).filter((x) => (S.contratos || []).some((c) => doContrato(c, x.forn))).length;
  $("#bannerPacoteTxt").textContent = `Atualização preparada em ${dataBR(pc.gerado)}: ${pc.contratos.length} contrato(s) (${ex} já cadastrado(s) serão atualizados, ${pc.contratos.length - ex} novo(s)) e ${pc.analise.length} trecho(s) da análise. Nada muda até você clicar em aplicar.`;
  el.hidden = false;
}
async function aplicarPacote() {
  const pc = S.pacote; if (!pc) return;
  if (AC.ligado && !ehAdmin()) return;
  const msg = (t) => ($("#bannerPacoteTxt").textContent = t);
  const antes = S.contratos, mud = [];
  let lista = [...(S.contratos || [])];
  for (const x of pc.contratos || []) {
    const i = lista.findIndex((c) => doContrato(c, x.forn));
    if (i >= 0) { lista[i] = { ...lista[i], ...x.set, forn: x.forn, id: lista[i].id, link: lista[i].link || x.set.link || "", por: nomeUsuario(), ts: new Date().toISOString() }; mud.push(`${x.forn} (atualizado)`); }
    else { lista.push({ ...x.set, forn: x.forn, id: novoId(), por: nomeUsuario(), ts: new Date().toISOString() }); mud.push(`${x.forn} (novo)`); }
  }
  S.contratos = lista.sort((a, b) => a.forn.localeCompare(b.forn, "pt-BR"));
  let html = $("#analiseCurada").innerHTML, trocas = 0;
  for (const a of pc.analise || []) {
    const re = new RegExp(`<li>(?:(?!</li>)[\\s\\S])*?${a.chave.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[\\s\\S]*?</li>`);
    if (re.test(html)) { html = html.replace(re, a.html); trocas++; }
    else if (a.html) { html += `\n<h3>Revisão de ${dataBR(pc.gerado)}</h3>\n<ul>\n        ${a.html}\n</ul>`; trocas++; }
  }
  msg("Gravando…");
  try {
    await salvarConteudo("contratos");
    if (trocas) { if (AC.ligado) await gravarAnalise(html); $("#analiseCurada").innerHTML = html; }
    registrar("Aplicou atualização", `Contratos: ${mud.join(", ")}; análise: ${trocas} trecho(s)`);
    try { sessionStorage.removeItem("farol.pacote"); } catch {}
    S.pacoteCod = ""; S.pacote = null; $("#bannerPacote").hidden = true;
    render(); toast(`Atualização aplicada: ${mud.length} contrato(s) e ${trocas} trecho(s) da análise.`);
  } catch (err) { S.contratos = antes; msg(mensagemErro(err)); }
}

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
    S.contratos = protegido.contratos || []; S.fundo = protegido.fundo || null;
    juntar(); return;
  }
  try { const r = await fetch("data/analise.html", { cache: "no-store" }); if (r.ok) $("#analiseCurada").innerHTML = await r.text(); } catch {}
  S.orc = ls.get(LS_ORC, []); S.contratos = ls.get(LS_CT, []); S.fundo = ls.get(LS_FUNDO, null);
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
  padronizarFornecedores();
  const nb = Object.keys(S.base).length, nl = Object.keys(S.locais).length;
  $("#statusBase").textContent = S.todos.length
    ? `${S.todos.length} meses (${rotuloMes(S.todos[0].mes)} a ${rotuloMes(S.todos.at(-1).mes)})${nl ? ` · ${nl} não publicado${nl > 1 ? "s" : ""}` : ""}`
    : "nenhum balancete";
  if (S.todos[0]?.condominio) $("#nomeCond").textContent = S.todos.at(-1).condominio;
  montarPeriodo();
}
// nomes de fornecedores padronizados em todos os balancetes, inclusive os gravados antes da padronização,
// guardando o nome antigo para reencontrar anotações e contratos cadastrados com ele
function padronizarFornecedores() {
  S.nomeV1 = {};
  for (const b of S.todos) for (const d of b.despesas || []) {
    const r = separarFornecedor(d.desc || "", d.cat);
    d.forn = r.forn; S.nomeV1[r.forn] = r.fornV1;
  }
  const lista = S.contratos || []; let mudou = false;
  for (const c of lista) {
    if (!c.forn || S.nomeV1[c.forn]) continue;
    const cands = Object.keys(S.nomeV1).filter((k) => S.nomeV1[k] === c.forn);
    const ref = `${c.contratado || ""} ${c.objeto || ""}`;
    const novo = cands.length === 1 ? cands[0] : cands.find((k) => nomeFornecedor(ref) === k) || cands[0] || nomeFornecedor(c.forn);
    if (novo && novo !== c.forn) { c.fornAntes = c.forn; c.forn = novo; mudou = true; }
  }
  if (mudou) { S.contratos = [...lista].sort((a, b) => a.forn.localeCompare(b.forn, "pt-BR")); S.ctRenomear = true; }
}
// versão do alerta com os nomes de fornecedores usados antes da padronização
function comNomesAntigos(a) {
  const mp = S.nomeV1 || {}; let titulo = a.titulo || "", forn = a.forn;
  for (const [n, v] of Object.entries(mp)) if (n !== v && titulo.includes(n)) titulo = titulo.split(n).join(v);
  if (forn && mp[forn]) forn = mp[forn];
  return titulo === a.titulo && forn === a.forn ? null : { ...a, titulo, forn };
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
    S.alertasTodos = alertas(S.todos); prepararAlertas(S.alertasTodos);
    const ctA = alertasContratos(S.alertasTodos); S.alertasTodos.push(...ctA);
    const de0 = S.meses[0].mes, ate0 = S.meses.at(-1).mes;
    A.push(...ctA.filter((a) => !a.mes || (a.mes >= de0 && a.mes <= ate0)).map((a) => ({ ...a })));
    prepararAlertas(S.alertasTodos); prepararAlertas(A);
    const n = A.filter((a) => a.sev === "alta" && ativo(a)).length;
    $("#cntAlertas").textContent = n || ""; $("#cntAlertas").hidden = !n;
    S.novidades = novidades();
    if (S.ctRenomear && (!AC.ligado || ehAdmin())) { S.ctRenomear = false; salvarConteudo("contratos").then(() => registrar("Padronizou nomes", "Fornecedores dos contratos")).catch(() => { S.ctRenomear = true; }); }
    if (S.pacoteCod) mostrarPacote();
    painel(); acompanhamento(); renderExecutivo(S.meses, $("#secAnalises")); categorias(); fornecedores(); listaAlertas(); tabParcelas(); notas(); conselho();
    renderMes(S.todos, S.mesSel || S.meses.at(-1).mes, alertas(S.todos), $("#secMes"));
    renderProjecao(S.todos, $("#secProjecao"));
    resumoMes(); orcamentoTab(); orcExtras(); prepararDoc(); prepararAta(); agendaTab(); contratosTab(); avisoNovo();
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
  const v1 = comNomesAntigos(a), pv1 = (a.partes || []).map(comNomesAntigos).filter(Boolean);
  const cands = [...(v1 ? [chaveAlerta(v1), chaveAntiga(v1)] : []), chaveAntiga(a), ...(a.partes || []).flatMap((p) => [chaveAlerta(p), chaveAntiga(p)]), ...pv1.flatMap((p) => [chaveAlerta(p), chaveAntiga(p)])];
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
  if (nota) { novo.hist = [...(atual.hist || []), { ts: agora, txt: nota, por: quem }].slice(-60); registrar("Alterou alerta", `${(a ? a.titulo : chave).slice(0, 120)}: ${nota}`); }
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
  const agora = S.alertasTodos.filter((a) => !a.ct);
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
  if (!podeEditar()) return `<div class="acomp somente-leitura"><div class="acomp-rodape"><span class="sit ${a.sit}">${SITUACOES[a.sit]}</span>${e.enviado ? `<span class="mini">enviado em ${dataBR(e.enviado)}</span>` : ""}${e.prazo ? `<span class="mini">prazo ${dataBR(e.prazo)}</span>` : ""}${linhaAging(e, a.sit)}</div>${e.resposta ? `<div class="orfa-txt">${esc(e.resposta)}</div>` : ""}${blocoLinks(a, e, false)}</div>`;
  return `<div class="acomp">
    <div class="acomp-campos">
      <label>Situação<select data-acomp="${a.chave}">${Object.entries(SITUACOES).map(([k, t]) => `<option value="${k}" ${a.sit === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label>Enviado em<input type="date" data-campo="enviado" data-chave="${a.chave}" value="${esc(e.enviado || "")}"></label>
      <label>Prazo de resposta<input type="date" data-campo="prazo" data-chave="${a.chave}" value="${esc(e.prazo || "")}"></label>
      <label>Aguardando resposta de<input data-campo="responsavel" data-chave="${a.chave}" list="listaResp" value="${esc(e.responsavel || "")}" placeholder="Síndico" autocomplete="off"></label>
    </div>
    <label class="acomp-resp">Resposta da administradora / anotação do conselho
      <textarea data-resp="${a.chave}" rows="3" placeholder="Registre a resposta recebida ou a providência combinada. Grava sozinho enquanto você digita.">${esc(e.resposta || "")}</textarea></label>
    ${blocoLinks(a, e, true)}
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
  const orfas = Object.entries(S.acomp).filter(([k, e]) => !k.startsWith("chk:") && !k.startsWith("ctm:") && !e.migradoPara && !usadas.has(k) && (e.resposta || (e.status && e.status !== "pendente")));
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
    <pre>${b.notas.filter((n) => n.grupo === "específica").map((n) => { let h = esc(n.texto); for (const x of datasErradasNota(n.texto, b, S.todos)) h = h.split(esc(x.orig)).join(`<mark class="data-err" data-tip="${esc(`Data incompleta no balancete.${x.sug ? ` Provável: ${x.sug}. ${x.motivo}` : ""}`)}">${esc(x.orig)}</mark>${x.sug ? ` <span class="data-sug">[provável ${esc(x.sug)}]</span>` : ""}`); return h; }).join("\n\n")}</pre></article>`).join("")
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
    try { await gravarMeses(S.locais); registrar("Publicou balancetes", Object.keys(S.locais).map(rotuloMes).join(", ")); S.base = { ...S.base, ...S.locais }; S.locais = {}; ls.del(LS_MESES); juntar(); render(); toast("Balancetes gravados na base protegida."); }
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
const ABAS_VIS = ["resumo", "painel", "analises", "mes", "orcamento", "agenda"];
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
  ${(() => { const pc = proximosCompromissos(30).slice(0, 4); return pc.length ? `<div class="card"><div class="cab-secao"><span class="eyebrow">Agenda</span><h2>Próximos compromissos</h2></div><ul class="agenda">${pc.map((x) => `<li class="ag ${x.tipo}"><div class="ag-data"><b>${x.data.slice(8, 10)}</b><span>${MESES_EXT[+x.data.slice(5, 7) - 1].slice(0, 3)}</span></div><div class="ag-txt"><b>${esc(x.titulo)}</b><span class="mini">${TIPOS_AG[x.tipo] || ""}${x.hora ? ` · ${esc(x.hora)}` : ""}${x.local ? ` · ${esc(x.local)}` : ""}</span></div></li>`).join("")}</ul></div>` : ""; })()}
  <p class="small muted">${pd.confere ? "✓ Os totais do demonstrativo conferem com a soma dos lançamentos." : "✗ Os totais do demonstrativo não conferem com a soma dos lançamentos."} Demonstrativo emitido pela Logo Gestão Condominial em ${esc(b.emissao)}.</p>`;
}

// ---------------------------------------------------------------- aviso de prazo vencido (ao entrar)
function avisoVencidos() {
  if (!podeEditar()) return;
  const v = S.vencidos || [], hoje = hojeISO();
  const ultMes = S.todos.at(-1)?.mes;
  const cts = (S.contratos || []).map((c) => ({ c, ...analisarContrato(c) }));
  const ctDiv = cts.filter((x) => x.ult && x.ult.mes === ultMes && x.ult.st !== "ok");
  const ctVenc = cts.filter((x) => x.venceEm !== null && x.venceEm >= 0 && x.venceEm <= 30);
  const comp = proximosCompromissos(3).filter((x) => !x.auto);
  const assinatura = [v.length, ctDiv.length, ctVenc.length, comp.length].join("-");
  let visto = false; try { visto = sessionStorage.getItem("farol.avisoVenc") === assinatura; } catch {}
  if ((!v.length && !ctDiv.length && !ctVenc.length && !comp.length) || visto) return;
  S.assinaturaAviso = assinatura;
  const li = (t, d) => `<li><b>${t}</b><span class="mini">${d}</span></li>`;
  let h = "";
  if (v.length) h += `<li class="grupo-av">Prazo de resposta vencido</li>` + v.map((a) => { const e = S.acomp[a.chave] || {}; return li(esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, "")), `aguardando ${esc(destinoDe(a).toLowerCase())} · prazo ${dataBR(e.prazo)} · vencido há ${diasEntre(e.prazo, hoje)} dia(s)`); }).join("");
  if (ctDiv.length) h += `<li class="grupo-av">Contratos com pagamento diferente em ${rotuloMes(ultMes)}</li>` + ctDiv.map((x) => li(esc(x.c.forn), x.ult.st === "ausente" ? `sem pagamento · contratado ${brl(x.c.valor)}` : `pago ${brl(x.ult.p)} · contratado ${brl(x.c.valor)}`)).join("");
  if (ctVenc.length) h += `<li class="grupo-av">Contratos vencendo em até 30 dias</li>` + ctVenc.map((x) => li(esc(x.c.forn), `vence em ${dataBR(x.c.fim)} (${x.venceEm} dia(s))`)).join("");
  if (comp.length) h += `<li class="grupo-av">Compromissos nos próximos 3 dias</li>` + comp.map((x) => li(esc(x.titulo), `${dataBR(x.data)}${x.hora ? ` às ${esc(x.hora)}` : ""}${x.local ? ` · ${esc(x.local)}` : ""}`)).join("");
  $("#avisoLista").innerHTML = h;
  $("#avisoTitulo").textContent = v.length ? `${v.length} pergunta(s) com prazo de resposta vencido` : "Pontos de atenção";
  $("#avisoEyebrow").textContent = v.length ? "Prazo vencido" : "Atenção";
  $("#avisoSub").textContent = v.length ? "O destinatário não respondeu no prazo combinado. Vale cobrar a resposta." : "Itens que pedem a atenção do conselho.";
  $("#avisoIr").hidden = !v.length;
  $("#avisoVenc").hidden = false;
}
function fecharAviso() { $("#avisoVenc").hidden = true; try { sessionStorage.setItem("farol.avisoVenc", S.assinaturaAviso || ""); } catch {} }

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
  abrirDoc("Parecer do Conselho Fiscal", `Parecer-Conselho-Fiscal-${b.mes}.doc`);
  registrar("Gerou documento", `Parecer de ${rotuloMes(b.mes)}`);
}
function abrirDoc(titulo, arquivo) {
  $("#docTitulo").textContent = titulo; S.docArquivo = arquivo;
  $("#docParecer").hidden = false; document.body.classList.add("com-doc");
  $("#folha").focus();
}
function baixarWord() {
  const css = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111}h1{font-size:14pt;text-align:center}h2{font-size:12pt;color:#054166;margin-top:14pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 6px}th{background:#e3eef6}.n{text-align:right}.sub td{font-weight:bold;background:#f3f6f9}.doc-cab img{display:none}.assinaturas div{margin-top:36pt;border-top:1px solid #333;width:45%;padding-top:4pt}`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css}</style></head><body>${$("#folha").innerHTML}</body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
  a.download = S.docArquivo || `Parecer-Conselho-Fiscal-${$("#docMes").value}.doc`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}


// ================================================================ melhorias do conselho
const pode = () => podeEditar();
const salvarConteudo = async (qual) => {
  if (qual === "contratos") { if (AC.ligado) await gravarContratos(S.contratos); else ls.set(LS_CT, S.contratos); }
  if (qual === "fundo") { if (AC.ligado) await gravarFundo(S.fundo); else ls.set(LS_FUNDO, S.fundo); }
};
const cabDoc = (cond) => `<header class="doc-cab"><img src="img/logo-farol.png" alt="" width="70"><div><b>${esc(cond.toUpperCase())}</b><span>Conselho Fiscal</span></div></header>`;
const urlValida = (u) => /^https?:\/\/[^\s]+$/i.test(u);

// ---------------------------------------------------------------- aviso de balancete novo (por navegador)
function avisoNovo() {
  const ult = S.todos.at(-1)?.mes; if (!ult) return;
  const visto = ls.get(LS_VISTO, null);
  if (!visto) { ls.set(LS_VISTO, ult); return; }
  const novos = S.todos.filter((b) => b.mes > visto);
  $("#bannerNovo").hidden = !novos.length;
  if (novos.length) $("#bannerNovoTxt").innerHTML = `Novo balancete disponível: <b>${novos.map((b) => rotuloMes(b.mes)).join(", ")}</b>.`;
}
function marcarVisto() { ls.set(LS_VISTO, S.todos.at(-1)?.mes); $("#bannerNovo").hidden = true; }

// ---------------------------------------------------------------- links de documentos em cada alerta
function blocoLinks(a, e, edita) {
  const links = (e.links || []).filter((l) => l && l.url);
  const lista = links.map((l, i) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.nome || l.url.replace(/^https?:\/\//, "").slice(0, 60))}</a>${l.por ? `<span class="mini"> · ${esc(l.por)}</span>` : ""}${edita ? ` <button type="button" class="link-x" data-link-del="${a.chave}" data-i="${i}" aria-label="Remover link">×</button>` : ""}</li>`).join("");
  return `<div class="links-doc">${links.length ? `<span class="mini" style="font-weight:700">Documentos</span><ul>${lista}</ul>` : ""}
    ${edita ? `<div class="link-add"><input type="url" placeholder="Cole o link do documento (Google Drive, e-mail…)" data-link-url="${a.chave}"><input placeholder="Nome (opcional)" data-link-nome="${a.chave}"><button type="button" class="btn sec" data-link-add="${a.chave}">Anexar link</button></div>` : ""}</div>`;
}

// ---------------------------------------------------------------- agenda do conselho
const TIPOS_AG = { reuniao: "Reunião do conselho", assembleia: "Assembleia", prazo: "Prazo", outro: "Outro" };
function itensAgenda() {
  const man = Object.entries(S.acomp).filter(([k, v]) => k.startsWith("ag:") && v && !v.removido).map(([k, v]) => ({ ...v, id: k, manual: true }));
  const autos = [];
  for (const a of relevantesTodos().filter((x) => x.sit === "questionado")) { const e = S.acomp[a.chave] || {}; if (e.prazo) autos.push({ data: e.prazo, tipo: "prazo", titulo: `Prazo de resposta: ${a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, "")}`, obs: `Aguardando resposta ${preposicao(destinoDe(a))}`, auto: true }); }
  for (const c of S.contratos || []) if (c.fim) autos.push({ data: c.fim, tipo: "prazo", titulo: `Fim do contrato: ${c.forn}${c.objeto ? ` (${c.objeto})` : ""}`, obs: "Avaliar renovação ou nova cotação", auto: true });
  return [...man, ...autos].sort((x, y) => (x.data + (x.hora || "")).localeCompare(y.data + (y.hora || "")));
}
function agendaTab() {
  const el = $("#secAgenda"); if (!el) return;
  const hoje = hojeISO(), it = itensAgenda(), prox = it.filter((x) => x.data >= hoje), pass = it.filter((x) => x.data < hoje).reverse();
  const linha = (x) => { const d = diasEntre(hoje, x.data); return `<li class="ag ${x.tipo}"><div class="ag-data"><b>${x.data.slice(8, 10)}</b><span>${MESES_EXT[+x.data.slice(5, 7) - 1].slice(0, 3)}/${x.data.slice(2, 4)}</span></div>
    <div class="ag-txt"><b>${esc(x.titulo)}</b><span class="mini">${TIPOS_AG[x.tipo] || ""}${x.hora ? ` · ${esc(x.hora)}` : ""}${x.local ? ` · ${esc(x.local)}` : ""}${x.obs ? ` · ${esc(x.obs)}` : ""}${x.auto ? " · automático" : x.por ? ` · por ${esc(x.por)}` : ""}</span></div>
    <div class="ag-quando">${d === 0 ? "<b>hoje</b>" : d > 0 ? `em ${d} dia(s)` : `há ${-d} dia(s)`}${x.manual && pode() ? `<button type="button" class="link-x" data-ag-del="${x.id}" aria-label="Remover">×</button>` : ""}</div></li>`; };
  el.innerHTML = `
  ${pode() ? `<form class="card" id="fAgenda"><div class="cab-secao"><span class="eyebrow">Novo compromisso</span><h2>Adicionar à agenda</h2></div>
    <div class="form" style="margin-top:12px">
      <label>Data<input type="date" id="agData" required></label><label>Horário<input type="time" id="agHora"></label>
      <label>Tipo<select id="agTipo">${Object.entries(TIPOS_AG).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
      <label>Título<input id="agTitulo" required placeholder="ex.: Reunião mensal do conselho"></label>
      <label>Local<input id="agLocal" placeholder="opcional"></label><label>Observação<input id="agObs" placeholder="opcional"></label>
    </div><div class="acoes" style="margin-top:10px"><button class="btn" type="submit">Adicionar</button></div></form>` : ""}
  <div class="card"><div class="cab-secao"><span class="eyebrow">Próximos</span><h2>Compromissos e prazos</h2></div>
    <p class="small muted" style="margin:6px 0 0">Os prazos de resposta das perguntas enviadas e o fim dos contratos entram sozinhos.</p>
    ${prox.length ? `<ul class="agenda">${prox.map(linha).join("")}</ul>` : `<p class="muted">Nada agendado.</p>`}</div>
  ${pass.length ? `<details class="card"><summary><b>Passados (${pass.length})</b></summary><ul class="agenda">${pass.slice(0, 40).map(linha).join("")}</ul></details>` : ""}`;
}
function proximosCompromissos(dias) { const hoje = hojeISO(), lim = somaDias(hoje, dias); return itensAgenda().filter((x) => x.data >= hoje && x.data <= lim); }

// ---------------------------------------------------------------- ata da reunião
function gerarAta() {
  const f = { data: $("#ataData").value || hojeISO(), hora: $("#ataHora").value, local: $("#ataLocal").value.trim(), presentes: $("#ataPresentes").value.split(/\n+/).map((x) => x.trim()).filter(Boolean), delib: $("#ataDelib").value.split(/\n+/).map((x) => x.trim()).filter(Boolean), mes: $("#ataMes").value };
  ls.set(LS_ATA, { ...f, presentes: $("#ataPresentes").value, delib: $("#ataDelib").value });
  const b = S.todos.find((x) => x.mes === f.mes) || S.todos.at(-1), t = b.totais, res = t.receitas - t.despesas, pd = parecerDe(b), cond = b.condominio || "Condomínio";
  const resp = relevantesTodos().filter((a) => (a.sit === "respondido" || a.sit === "resolvido") && (S.acomp[a.chave]?.resposta || "").trim());
  const naoEnv = relevantesTodos().filter((a) => a.sit === "pendente" && a.pergunta && (a.sev === "alta" || a.sev === "media"));
  const proxReun = itensAgenda().find((x) => x.tipo === "reuniao" && x.data > f.data);
  const hora = f.hora ? `, às ${f.hora.replace(":", "h")}` : "";
  $("#folha").innerHTML = `${cabDoc(cond)}
  <h1>ATA DA REUNIÃO DO CONSELHO FISCAL</h1>
  <p>Aos ${dataExtenso(f.data)}${hora}${f.local ? `, em ${esc(f.local)}` : ""}, reuniram-se os membros do Conselho Fiscal do ${esc(cond)}${f.presentes.length ? `: ${f.presentes.map(esc).join(", ")}` : ""}, para tratar da seguinte pauta: (1) análise do demonstrativo de receitas e despesas de ${mesExtenso(b.mes)}; (2) acompanhamento das pendências junto ao síndico e à administradora; (3) assuntos gerais.</p>
  <h2>1. Demonstrativo de ${mesExtenso(b.mes)}</h2>
  <p>Foi analisado o demonstrativo emitido pela Logo Gestão Condominial em ${esc(b.emissao)}, que apresenta receitas de ${brl(t.receitas)}, despesas de ${brl(t.despesas)}, ${res >= 0 ? "sobra" : "falta"} de ${brl(Math.abs(res))} no mês e saldo final em caixa de ${brl(t.saldoAtual)}. ${pd.confere ? "Os totais conferem com a soma dos lançamentos." : "Os totais não conferem com a soma dos lançamentos."} Parecer do conselho para o mês: <b>${pd.rot.toLowerCase()}</b>.</p>
  <h2>2. Pendências</h2>
  ${pd.aguard.length ? gruposAguard(pd.aguard).map((gr) => `<p>${gr.rot}:</p><ol>${gr.itens.map((a) => { const e = S.acomp[a.chave] || {}; return `<li>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}${e.prazo ? ` (prazo ${dataBR(e.prazo)}${e.prazo < f.data ? ", vencido" : ""})` : ""}.</li>`; }).join("")}</ol>`).join("") : "<p>Não há perguntas aguardando resposta.</p>"}
  ${resp.length ? `<p>Esclarecimentos recebidos e registrados:</p><ol>${resp.map((a) => `<li>${esc(a.titulo.replace(/\s*\(R\$[^)]*em aberto\)/, ""))}: ${esc(S.acomp[a.chave].resposta.trim())}</li>`).join("")}</ol>` : ""}
  <h2>3. Deliberações</h2>
  ${f.delib.length ? `<ol>${f.delib.map((d) => `<li>${esc(d)}</li>`).join("")}</ol>` : "<p>(registrar as deliberações)</p>"}
  <h2>4. Encaminhamentos</h2>
  <ol>${naoEnv.length ? `<li>Encaminhar ao síndico e à administradora ofício com ${naoEnv.length} pergunta(s) ainda não enviada(s), com prazo de resposta de 15 dias.</li>` : ""}
    ${pd.aguard.filter((a) => (S.acomp[a.chave] || {}).prazo < f.data).length ? `<li>Cobrar as respostas com prazo vencido.</li>` : ""}
    <li>${proxReun ? `Próxima reunião em ${dataBR(proxReun.data)}${proxReun.hora ? ` às ${proxReun.hora.replace(":", "h")}` : ""}.` : "Próxima reunião: ____/____/______."}</li></ol>
  <p>Nada mais havendo a tratar, a reunião foi encerrada e lavrada a presente ata, que vai assinada pelos presentes.</p>
  <div class="assinaturas">${(f.presentes.length ? f.presentes : ["Conselheiro(a) Fiscal", "Conselheiro(a) Fiscal", "Conselheiro(a) Fiscal"]).map((n) => `<div><span></span>${esc(n)}</div>`).join("")}</div>`;
  abrirDoc("Ata da reunião do Conselho Fiscal", `Ata-Conselho-Fiscal-${f.data}.doc`);
  registrar("Gerou documento", `Ata de ${dataBR(f.data)}`);
}
function prepararAta() {
  const sel = $("#ataMes"); if (!sel) return;
  const ops = [...S.todos].reverse().map((b) => `<option value="${b.mes}">${rotuloMes(b.mes)}</option>`).join("");
  if (sel.dataset.ops !== ops) { sel.innerHTML = ops; sel.dataset.ops = ops; }
  if (!sel.dataset.ok) {
    const r = ls.get(LS_ATA, {}); sel.dataset.ok = "1";
    $("#ataData").value = hojeISO(); $("#ataHora").value = r.hora || ""; $("#ataLocal").value = r.local || "";
    $("#ataPresentes").value = r.presentes || (AC.reg ? AC.reg.nome || "" : ""); $("#ataDelib").value = "";
  }
}

// ---------------------------------------------------------------- contratos
// filtro opcional: só os lançamentos cujo histórico contém o texto (ex.: "ASSESSORIA"), para não misturar reembolsos
const normTxt = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// empresas do mesmo grupo que se revezam no faturamento do mesmo contrato
const grupoForn = (f) => (/^(Logoserv Recursos Humanos|Logo Gerência de Cobranças)$/.test(f || "") ? "Grupo Logo" : f);
const doContrato = (c, forn) => forn === c.forn || grupoForn(forn) === grupoForn(c.forn);
// lançamentos da mensalidade: pelo filtro de texto informado ou, sem filtro, pelo histórico que se repete com o valor do contrato
const ehMensal = (c, d) => c.filtro ? normTxt(d.desc).includes(normTxt(c.filtro).trim()) : c.itemAuto ? d.item === c.itemAuto : true;
const lancDoContrato = (c, b, dentro = true) => b.despesas.filter((d) => doContrato(c, d.forn) && ehMensal(c, d) === dentro);
const ehParcela = (d) => /parcela\s*\d+\s*\/\s*\d+/i.test(`${d.det} ${d.desc}`);
// histórico da mensalidade: o que se repete na maioria dos meses (parcelas de compras não contam), com valor mais perto do contrato
function itensRecorrentes(forn) {
  const por = {}, meses = new Set();
  for (const b of S.todos) for (const d of b.despesas) if (grupoForn(d.forn) === grupoForn(forn)) { meses.add(b.mes); if (ehParcela(d)) continue; const x = (por[d.item] ||= { item: d.item, meses: new Set(), vals: [] }); x.meses.add(b.mes); x.vals.push(d.v); }
  return Object.values(por).map((x) => { const v = [...x.vals].sort((a, b) => a - b); return { item: x.item, n: x.meses.size, med: v[Math.floor(v.length / 2)] }; }).filter((x) => x.n >= Math.max(2, meses.size * 0.4)).sort((a, b) => b.n - a.n);
}
function itemMensal(c) {
  if (c.filtro || !c.valor || c.modalidade === "global" || c.modalidade === "anual") return "";
  const todosItens = new Set(); for (const b of S.todos) for (const d of b.despesas) if (doContrato(c, d.forn)) todosItens.add(d.item);
  if (todosItens.size < 2) return "";
  const rec = itensRecorrentes(c.forn); if (!rec.length) return "";
  return [...rec].sort((a, b) => Math.abs(Math.log(a.med / c.valor)) - Math.abs(Math.log(b.med / c.valor)))[0].item;
}
const ctEf = (c) => { if (c.itemAuto !== undefined) return c; const it = itemMensal(c); return { ...c, itemAuto: it }; };
function pagoNoMes(forn, mes, filtro) { const b = S.todos.find((x) => x.mes === mes); return b ? lancDoContrato({ forn, filtro }, b).reduce((s2, d) => s2 + d.v, 0) : 0; }
const ctIniMes = (c) => (c.inicio || "").slice(0, 7);
const diasMes = (mes) => new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate();
// valor devido no mês, proporcional quando o contrato começa ou termina no meio do mês
const ehCumulativo = (c) => c.modalidade === "global" || c.modalidade === "anual";
function devidoNoMes(c, mes) {
  if (ehCumulativo(c)) return 0;
  if (c.modalidade === "parcelado" && c.parcelas) { const ini = ctIniMes(c) || mes, k = (+mes.slice(0, 4) - +ini.slice(0, 4)) * 12 + (+mes.slice(5, 7) - +ini.slice(5, 7)); return k >= 0 && k < c.parcelas ? c.valor : 0; }
  let fr = 1; const dm = diasMes(mes);
  if (c.inicio && c.inicio.length === 10 && c.inicio.slice(0, 7) === mes) fr -= (+c.inicio.slice(8) - 1) / dm;
  const fim = fimContrato(c);
  if (fim && fim.slice(0, 7) === mes) fr -= (dm - +fim.slice(8)) / dm;
  return r2(c.valor * Math.max(0, fr));
}
function fimContrato(c) { if (c.indeterminado) return ""; if (c.prazoMeses && c.inicio && c.inicio.length === 10) { const v = fimVigente(c.inicio, c.prazoMeses, c.renovacaoAuto, hojeISO()); if (v) return v.fim; } return c.fim || ""; }
const refIso = (ref) => { const m = /^(\d{2})\/(\d{4})$/.exec(String(ref || "").trim()); return m ? `${m[2]}-${m[1]}` : ""; };
function analisarContrato(c) {
  if (ehReceita(c)) return analisarReceita(c);
  c = ctEf(c);
  const hoje = hojeISO(), tol = (c.tol ?? 2) / 100, fim = fimContrato(c);
  const ms = S.todos.filter((b) => (!c.inicio || b.mes >= ctIniMes(c)) && (!fim || b.mes <= fim.slice(0, 7)));
  const meses = ms.map((b) => { const dev = devidoNoMes(c, b.mes), p = r2(lancDoContrato(c, b).reduce((s2, d) => s2 + d.v, 0)); const st = ehCumulativo(c) || (!dev && !p) ? (p ? "pago" : "nada") : !p ? "ausente" : Math.abs(p - dev) <= dev * tol ? "ok" : "dif"; return { mes: b.mes, p, dev, st }; });
  const ult = meses.at(-1), venceEm = fim ? diasEntre(hoje, fim) : null;
  const totPago = meses.reduce((s2, m) => s2 + m.p, 0);
  const totDev = ehCumulativo(c) ? (c.valorTotal || c.valor || 0) * (c.modalidade === "anual" ? Math.max(1, Math.ceil(meses.length / 12)) : 1) : meses.reduce((s2, m) => s2 + m.dev, 0);
  return { meses, ult, venceEm, fim, divs: meses.filter((m) => m.st === "dif" || m.st === "ausente").length, totDev: r2(totDev), totPago: r2(totPago), dif: r2(totPago - totDev) };
}
function sugestoesContrato() {
  const base = S.todos.slice(-12), ja = new Set((S.contratos || []).map((c) => c.forn));
  return porFornecedor(base).filter((f) => !ja.has(f.forn) && f.meses.size >= Math.min(8, base.length - 1)).map((f) => {
    const vals = base.map((b) => pagoNoMes(f.forn, b.mes)).filter((v) => v > 0).sort((a, b2) => a - b2);
    const med = vals[Math.floor(vals.length / 2)];
    const estavel = vals.filter((v) => Math.abs(v - med) <= med * 0.05).length / vals.length;
    return { forn: f.forn, valor: r2(med), meses: vals.length, estavel, cat: [...f.cats][0] };
  }).filter((x) => x.estavel >= 0.6 && !/Coelba|Embasa|energia|água/i.test(x.forn)).sort((a, b2) => b2.valor - a.valor).slice(0, 12);
}
function contratosTab() {
  const el = $("#secContratos"); if (!el) return;
  const adm = ehAdmin(), lista = S.contratos || [], an = lista.map((c) => ({ c, ...analisarContrato(c) }));
  const ultMes = S.todos.at(-1)?.mes, divUlt = an.filter((x) => x.ult && x.ult.mes === ultMes && x.ult.st !== "ok");
  const venc = an.filter((x) => x.venceEm !== null && x.venceEm <= 60), excesso = an.filter((x) => !ehReceita(x.c)).reduce((s2, x) => s2 + Math.max(0, x.dif), 0);
  const stTxt = (m) => !m ? "—" : m.st === "pago" ? `<span class="sit resolvido">Pago ${brl(m.p)}</span>` : m.st === "nada" ? `<span class="mini">sem cobrança</span>` : m.st === "ok" ? `<span class="sit resolvido">Conforme</span>` : m.st === "ausente" ? `<span class="sit pendente">Sem pagamento</span>` : `<span class="sit questionado">${m.p > m.dev ? "+" : ""}${brl(m.p - m.dev)}</span>`;
  const sug = adm ? sugestoesContrato() : [];
  el.innerHTML = `
  <div class="kpis-sec">
    <div class="kpi"><span class="eyebrow">Contratos cadastrados</span><b>${lista.length}</b><span class="det">${brl(lista.reduce((s2, c) => s2 + (c.valor || 0), 0))} por mês</span></div>
    <div class="kpi ${excesso > 0 ? "neg" : "pos"}"><span class="eyebrow">Pago acima do contratado</span><b>${brl(excesso)}</b><span class="det">soma de todos os contratos, desde o início</span></div>
    <div class="kpi ${divUlt.length ? "neg" : "pos"}"><span class="eyebrow">Diferenças em ${ultMes ? rotuloMes(ultMes) : "—"}</span><b>${divUlt.length}</b><span class="det">pagamento diferente do contratado ou ausente</span></div>
    <div class="kpi ${venc.length ? "neg" : ""}"><span class="eyebrow">Vencendo em 60 dias</span><b>${venc.length}</b><span class="det">avaliar renovação ou cotação</span></div>
  </div>
  ${adm ? `<div class="card importa-ct"><div class="cab"><div class="cab-secao"><span class="eyebrow">Importar</span><h2>Ler contrato</h2></div>
      <label class="btn"><input type="file" id="ctArquivo" accept="application/pdf,.pdf,.docx,.txt,image/*" hidden>Escolher arquivo do contrato</label></div>
    <p class="small muted" style="margin:6px 0 0">Aceita PDF, Word (.docx), foto ou imagem escaneada e texto. O site identifica o tipo de contrato (serviços, manutenção, obra, seguro, internet, locação…) e lê partes, CNPJ, número, objeto, valor (mensal, parcelado, global ou anual), forma e prazo de pagamento, vigência, renovação, aviso prévio, multas, reajuste, garantia, retenções, prazos de atendimento, quantidades e horários, o que está ou não incluído, coberturas e franquias de seguro, foro e o índice de cláusulas. Arquivos escaneados ou fotos passam por reconhecimento de texto, que leva cerca de 1 minuto. O arquivo não é enviado nem guardado: só os campos que você confirmar.</p>
    <div id="ctProgresso" class="small" hidden></div><div id="ctRevisao"></div></div>` : ""}
  ${lista.length ? `
  <div class="ct-filtros"><div class="chips" role="group" aria-label="Filtrar contratos">${[["todos", "Todos"], ["dif", "Com diferença"], ["venc", "Vencendo em 60 dias"], ["ok", "Em dia"]].map(([k, t2]) => `<button type="button" class="chip" data-ct-filtro="${k}" aria-pressed="${(S.ctFiltro || "todos") === k}">${t2}</button>`).join("")}</div>
    <input type="search" id="ctBusca" placeholder="Buscar fornecedor ou objeto" value="${esc(S.ctBusca || "")}"></div>
  <div class="ct-grid">${an.filter((x) => filtroCt(x)).map((x) => cartaoContrato(x, adm)).join("") || '<p class="muted">Nenhum contrato neste filtro.</p>'}</div>
  ${linhaDoTempo(an)}
  <p class="mini">Na faixa de meses de cada cartão, cada quadradinho é um mês pela data do pagamento: verde conforme, amarelo valor diferente do devido, branco sem pagamento, cinza sem cobrança. O primeiro e o último mês são proporcionais aos dias de vigência.</p>` : `<div class="vazio card">Nenhum contrato cadastrado.${adm ? " Importe o PDF do contrato, use o formulário abaixo ou as sugestões." : ""}</div>`}
  <div id="ctFicha">${S.ctFicha && lista.find((c) => c.id === S.ctFicha) ? (ehReceita(lista.find((c) => c.id === S.ctFicha)) ? fichaReceita : fichaContrato)(lista.find((c) => c.id === S.ctFicha)) : ""}</div>
  ${adm ? `<form class="card" id="fContrato" data-id="${S.ctEditando || ""}">${formContrato(lista.find((c) => c.id === S.ctEditando) || S.ctRascunho)}</form>
  ${sug.length ? `<div class="card"><div class="cab-secao"><span class="eyebrow">Sugestões</span><h2>Pagamentos que parecem contratos fixos</h2></div>
    <p class="small muted" style="margin:6px 0 10px">Fornecedores pagos quase todo mês com valor estável nos últimos 12 meses. Confira o valor no contrato antes de adicionar.</p>
    <div class="tabela"><table><thead><tr><th>Fornecedor</th><th>Categoria</th><th class="n">Valor típico</th><th class="n">Meses pagos</th><th></th></tr></thead><tbody>
    ${sug.map((x) => `<tr><td>${esc(x.forn)}</td><td>${esc(x.cat || "")}</td><td class="n">${brl(x.valor)}</td><td class="n">${x.meses}</td><td><div class="acoes-lin"><button type="button" data-ct-sug="${esc(x.forn)}" data-v="${x.valor}">Usar no cadastro</button></div></td></tr>`).join("")}
    </tbody></table></div></div>` : ""}` : ""}`;
}
// ficha do contrato: mês a mês, pela data de pagamento e pela competência informada na nota
// filtros e cartões da lista de contratos
function filtroCt(x) {
  const f = S.ctFiltro || "todos", b = normTxt(S.ctBusca || "").trim();
  if (b && !normTxt(`${x.c.forn} ${x.c.objeto || ""} ${x.c.tipo || ""} ${x.c.numero || ""}`).includes(b)) return false;
  if (f === "dif") return x.dif > 0.01 || (x.ult && (x.ult.st === "dif" || x.ult.st === "ausente"));
  if (f === "venc") return x.venceEm !== null && x.venceEm <= 60;
  if (f === "ok") return !(x.dif > 0.01) && !(x.ult && (x.ult.st === "dif" || x.ult.st === "ausente"));
  return true;
}
function cartaoContrato({ c, meses, ult, venceEm, fim, divs, totDev, totPago, dif }, adm) {
  const hoje = hojeISO(), ini = c.inicio ? (c.inicio.length === 10 ? c.inicio : c.inicio + "-01") : "";
  const prog = ini && fim ? Math.max(0, Math.min(1, diasEntre(ini, hoje) / Math.max(1, diasEntre(ini, fim)))) : null;
  const tolV = Math.max(1, totDev * ((c.tol ?? 2) / 100));
  const rec = ehReceita(c);
  const est = rec ? (ult && ult.st === "ausente" ? ["critico", `Repasse não identificado em ${rotuloMes(ult.mes)}`] : divs ? ["atencao", `${divs} mês(es) sem repasse identificado`] : ["ok", "Repasses recebidos"])
    : ult && ult.st === "ausente" ? ["critico", `Sem pagamento em ${rotuloMes(ult.mes)}`]
    : ult && ult.st === "dif" ? ["atencao", `${rotuloMes(ult.mes)}: ${ult.p > ult.dev ? "+" : ""}${brl(ult.p - ult.dev)}`]
    : dif > tolV ? ["atencao", `${brl(dif)} pagos acima`]
    : dif < -tolV && !(ehCumulativo(c) && venceEm !== null && venceEm > 0) ? ["atencao", `${brl(-dif)} a menos que o devido`]
    : divs ? ["atencao", `${divs} mês(es) com diferença`] : ["ok", "Pagamentos em dia"];
  return `<article class="ct-card ${est[0]} ${S.ctFicha === c.id ? "ativo" : ""}">
    <div class="ct-topo"><span class="eyebrow">${esc(c.tipo || "Contrato")}${c.numero ? ` · nº ${esc(c.numero)}` : ""}</span><span class="ct-est ${est[0]}">${esc(est[1])}</span></div>
    <h3>${esc(c.forn)}</h3>
    <p class="ct-obj">${esc(c.objeto || "")}</p>
    <div class="ct-valor"><b>${(c.modalidade && c.modalidade !== "mensal") || (!c.valor && c.valorRegra) ? esc(descreverValor(c)) : brl(c.valor)}</b>${(!c.modalidade || c.modalidade === "mensal") && (c.valor || !c.valorRegra) ? `<span>/mês${rec ? " a receber" : ""}</span>` : ""}${c.diaVenc ? `<span class="mini"> · vence dia ${c.diaVenc}</span>` : ""}</div>
    <div class="ct-vig"><div class="ct-vig-txt"><span>${ini ? dataBR(ini) : "início não informado"}</span><span>${fim ? dataBR(fim) : c.indeterminado ? "prazo indeterminado" : "sem fim"}</span></div>
      ${prog !== null ? `<div class="ct-barra"><span style="width:${prog * 100}%"></span></div>` : ""}
      <span class="mini ${venceEm !== null && venceEm <= 60 ? "neg" : ""}">${venceEm === null ? (c.renovacaoAuto ? "renovação automática" : "") : venceEm < 0 ? `vencido há ${-venceEm} dia(s)` : `vence em ${venceEm} dia(s)${c.renovacaoAuto ? " · renova automaticamente" : ""}`}</span></div>
    <div class="ct-nums"><div><span>${rec ? "Esperado" : ehCumulativo(c) ? "Valor do contrato" : "Devido"}</span><b>${rec && !totDev ? "—" : brl(totDev)}</b></div><div><span>${rec ? "Recebido" : "Pago"}</span><b>${brl(totPago)}</b></div><div><span>Diferença</span><b class="${dif > 0.01 ? "neg" : dif < -0.01 ? "pos" : ""}">${dif > 0 ? "+" : ""}${brl(dif)}</b></div></div>
    <div class="ct-meses" aria-label="Pagamentos por mês">${meses.map((m) => `<i class="mchip ${m.st}" data-tip="${esc(`${rotuloMes(m.mes)}\nPago: ${brl(m.p)}\nDevido: ${brl(m.dev)}`)}"></i>`).join("")}<span class="mini">${divs} de ${meses.length} mês(es) ${rec ? "sem repasse identificado" : "com diferença"}</span></div>
    ${c.filtro ? `<p class="mini">Conta só lançamentos com "${esc(c.filtro)}"</p>` : ""}
    <div class="acoes-lin"><button type="button" data-ct-ficha="${c.id}">${S.ctFicha === c.id ? "Fechar ficha" : "Ver ficha completa"}</button>${c.link ? `<a class="btn-link" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer">📎 PDF</a>` : ""}${adm ? `<button type="button" data-ct-edit="${c.id}">Editar</button><button type="button" class="perigo" data-ct-del="${c.id}">Excluir</button>` : ""}</div>
  </article>`;
}
// linha do tempo de todos os contratos, com o dia de hoje marcado
function linhaDoTempo(an) {
  const itens = an.map((x) => ({ c: x.c, ini: x.c.inicio ? (x.c.inicio.length === 10 ? x.c.inicio : x.c.inicio + "-01") : "", fim: x.fim })).filter((x) => x.ini);
  if (!itens.length) return "";
  const hoje = hojeISO(), a0 = itens.reduce((m, x) => (x.ini < m ? x.ini : m), hoje).slice(0, 7) + "-01";
  let a1 = itens.reduce((m, x) => ((x.fim || hoje) > m ? x.fim || hoje : m), hoje); a1 = somaDias(a1, 30);
  const W = 1040, lh = 34, ml = 230, mr = 20, H = itens.length * lh + 46, tot = Math.max(1, diasEntre(a0, a1));
  const x = (d) => ml + (W - ml - mr) * (diasEntre(a0, d) / tot);
  let g = "";
  for (let d = new Date(a0 + "T12:00:00"); d.toISOString().slice(0, 10) <= a1; d.setMonth(d.getMonth() + (tot > 900 ? 6 : 3))) { const iso = d.toISOString().slice(0, 10); g += `<line x1="${x(iso)}" x2="${x(iso)}" y1="18" y2="${H - 8}" stroke="#e3e9ef"/><text x="${x(iso)}" y="12" text-anchor="middle" class="eixo-x">${rotuloMes(iso.slice(0, 7)).replace("/20", "/")}</text>`; }
  itens.forEach((it, i) => {
    const y = 26 + i * lh, f = it.fim || a1, venc = it.fim && diasEntre(hoje, it.fim) <= 60;
    g += `<text x="${ml - 10}" y="${y + 15}" text-anchor="end" class="eixo-cat">${esc(it.c.forn.length > 30 ? it.c.forn.slice(0, 28) + "…" : it.c.forn)}</text>`;
    g += `<rect x="${x(it.ini)}" y="${y + 3}" width="${Math.max(4, x(f) - x(it.ini))}" height="18" rx="5" fill="${venc ? "#d9663a" : "#0b5a8c"}" opacity="${it.fim ? 1 : 0.45}" data-tip="${esc(`${it.c.forn}\n${dataBR(it.ini)} a ${it.fim ? dataBR(it.fim) : "indeterminado"}${it.c.renovacaoAuto ? "\nrenovação automática" : ""}`)}"/>`;
    if (it.c.avisoDias && it.fim) { const av = somaDias(it.fim, -it.c.avisoDias); g += `<line x1="${x(av)}" x2="${x(av)}" y1="${y}" y2="${y + 24}" stroke="#fbb812" stroke-width="3" data-tip="${esc(`Último dia para avisar a não renovação: ${dataBR(av)}`)}"/>`; }
  });
  g += `<line x1="${x(hoje)}" x2="${x(hoje)}" y1="16" y2="${H - 6}" stroke="#eb1a30" stroke-width="2" stroke-dasharray="4 3"/><text x="${x(hoje) + 4}" y="${H - 8}" style="fill:#eb1a30;font-weight:700;font-size:11px">hoje</text>`;
  return `<div class="card chart"><div class="cab-secao"><span class="eyebrow">Vigências</span><h2>Linha do tempo dos contratos</h2></div>
    <div class="legenda" style="margin:8px 0 4px"><span><i style="background:#0b5a8c"></i>Vigente</span><span><i style="background:#d9663a"></i>Vence em até 60 dias</span><span><i style="background:#fbb812"></i>Prazo para avisar a não renovação</span><span><i class="linha" style="background:#eb1a30"></i>Hoje</span></div>
    <div class="grafico-largo"><svg class="g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vigência de cada contrato">${g}</svg></div></div>`;
}
// ---- explicação das diferenças: cruza contrato, balancetes, notas da administradora, alertas e respostas registradas
const mesMais = (mes, k) => { const d = new Date(+mes.slice(0, 4), +mes.slice(5, 7) - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const difMeses = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
const isoBR = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const rotCurto = (mes) => rotuloMes(mes).replace("/20", "/");
const numBR = (x) => parseFloat(String(x).replace(",", "."));
const GRUPOS_AV = [
  ["cartório e custas", /cartor|registro|emolument|custas|\bdaj\b/, /cartor|registro|emolument|custas|reembols|restitu/],
  ["assembleia", /assembl/, /assembl/],
  ["ata", /\bata\b|\batas\b/, /\bata\b|\batas\b/],
  ["certidão", /certid/, /certid/],
  ["audiência", /audienc|preposto/, /audienc|preposto/],
  ["consulta", /serasa|consulta/, /serasa|consulta/],
  ["peças e materiais", /\bpeca|materia/, /\bpeca|materia|nao inclu|por conta/],
];
function previsaoAvulso(c, d) {
  const txt = normTxt(`${d.item} ${d.desc}`), g = GRUPOS_AV.filter(([, re]) => re.test(txt));
  if (!g.length) return null;
  const di = isoBR(d.det), ano = +(di ? di.slice(0, 4) : d.mesBal.slice(0, 4));
  for (const [nome, , reC] of g) {
    for (const a of c.adicionais || []) if (reC.test(normTxt(a.desc))) {
      const prev = a.pctSM ? r2(salMin(ano) * a.pctSM / 100) : a.valor, k = a.desc.search(/exceto|salvo/);
      return { nome, prev, txt: a.pctSM ? `${a.pctSM}% do salário mínimo de ${ano} (${brl(salMin(ano))}) = ${brl(prev)}` : `${brl(a.valor)} ${a.desc}`, excecao: k >= 0 ? a.desc.slice(k) : "" };
    }
    for (const i of c.info || []) if (reC.test(normTxt(i.rot + " " + i.txt))) return { nome, prev: null, txt: `Previsto no contrato (${i.rot.toLowerCase()}): ${i.txt}` };
  }
  return { nome: g[0][0], prev: null, txt: "" };
}
const PALAVRAS_GEN = new Set(["comercio", "servicos", "sociedade", "individual", "advocacia", "tecnologia", "seguranca", "eletronica", "gestao", "manutencao", "distribuidora", "materiais", "construcao"]);
function citaFornecedor(texto, c, ds) {
  const t = normTxt(texto), tok = normTxt(c.forn).split(/[^a-z0-9]+/).find((w) => w.length >= 4 && !PALAVRAS_GEN.has(w));
  if (tok && new RegExp(`\\b${tok}\\b`).test(t)) return true;
  return ds.some((d) => /^\d{3,}$/.test(String(d.nf || "")) && new RegExp(`\\b(?:nf|nota fiscal|nota)\\s*(?:n\\s*[°ºo.]*\\s*)?${d.nf}\\b`).test(t));
}
function explicarContrato(c0) {
  const c = ctEf(c0), an = analisarContrato(c0), tolP = (c.tol ?? 2) / 100, ini = ctIniMes(c), ultBal = S.todos.at(-1)?.mes;
  const meses = an.meses.map((m) => m.mes), setM = new Set(meses);
  const L = S.todos.flatMap((b) => b.despesas.map((d, i) => ({ ...d, id: `${b.mes}#${i}`, mesBal: b.mes, compBal: refIso(d.ref) || b.mes })).filter((d) => doContrato(c, d.forn)))
    .filter((d) => !ini || d.mesBal >= ini || d.compBal >= ini);
  const mens = L.filter((d) => ehMensal(c, d)), avs = L.filter((d) => !ehMensal(c, d));
  const porNF = {}; for (const d of L) if (/^\d{3,}(?:\/\d+)?$/.test(String(d.nf || "").trim())) (porNF[String(d.nf).trim()] ||= []).push(d);
  const faturas = {}; for (const d of L) { const k = String(d.nf || "").split("/")[0].trim(); if (/^\d{3,}$/.test(k)) (faturas[`${d.mesBal}|${k}`] ||= []).push(d); }
  // a mesma NF em parcelas diferentes (Parcela 01/05, 02/05…) não é duplicidade
  // só é duplicidade a mesma NF com o mesmo valor (uma fatura com vários itens ou parcelas diferentes não é)
  const parc = (d) => (/parcela\s*(\d+)\s*\/\s*\d+/i.exec(`${d.det} ${d.desc}`) || [])[1];
  for (const k of Object.keys(porNF)) {
    const g = porNF[k].filter((d) => porNF[k].some((y) => y !== d && Math.abs(y.v - d.v) < 0.02 && !(parc(d) && parc(y) && parc(d) !== parc(y))));
    if (g.length > 1) porNF[k] = g; else delete porNF[k];
  }
  const nfRep = Object.values(porNF).filter((v) => v.length > 1);
  // hipótese: a competência certa é a ordem de emissão das notas (uma nota por mês)
  const comDev = an.meses.filter((m) => m.dev > 0).map((m) => m.mes);
  const problemas = (atr) => { const k = {}; for (const [, m] of atr) k[m] = (k[m] || 0) + 1; return comDev.filter((m) => m !== ultBal && !k[m]).length + Object.values(k).reduce((s2, n) => s2 + Math.max(0, n - 1), 0); };
  const unicas = mens.filter((d) => /^\d+$/.test(String(d.nf || "").trim()) && (!porNF[String(d.nf).trim()] || porNF[String(d.nf).trim()][0] === d)).sort((a, b) => +a.nf - +b.nf);
  // três leituras da competência de cada pagamento: como o balancete informa, pela ordem de emissão das notas
  // e pelo mês do pagamento (a mensalidade de um mês é paga no mês seguinte); fica a que deixa menos falta e duplicidade
  const hip = { bal: { map: null, prob: problemas(mens.map((d) => [d, d.compBal])) } };
  if (!ehCumulativo(c) && unicas.length >= 3 && comDev.length && unicas.length <= comDev.length + 1) {
    const atr = unicas.map((d, i) => [d, mesMais(comDev[0], i)]), resto = mens.filter((d) => !unicas.includes(d)).map((d) => [d, d.compBal]);
    if (atr.every(([d, m]) => Math.abs(difMeses(d.compBal, m)) <= 2) && atr.some(([d, m]) => d.compBal !== m)) hip.nf = { map: new Map(atr), prob: problemas([...atr, ...resto]) };
  }
  if (!ehCumulativo(c) && mens.length >= 3) {
    const lags = {}; for (const d of mens) { const k = difMeses(d.compBal, d.mesBal); if (k >= 0 && k <= 2) lags[k] = (lags[k] || 0) + 1; }
    const lag = +(Object.entries(lags).sort((a, b) => b[1] - a[1])[0] || [NaN])[0];
    if (!isNaN(lag)) { const atr = mens.map((d) => [d, mesMais(d.mesBal, -lag)]).filter(([, m]) => !ini || m >= ini); if (atr.some(([d, m]) => d.compBal !== m)) hip.caixa = { map: new Map(atr), prob: problemas(atr), lag }; }
  }
  const melhor = Object.entries(hip).filter(([k, h]) => k === "bal" || h.prob < hip.bal.prob).sort((a, b) => a[1].prob - b[1].prob || (a[0] === "nf" ? -1 : 1))[0][0];
  const modos = Object.keys(hip).filter((k) => k === "bal" || hip[k].prob < hip.bal.prob);
  const modo = modos.includes(S.ctModoComp) && modos.length > 1 ? S.ctModoComp : melhor;
  const seq = modo !== "bal" ? hip[modo].map : null;
  const compDe = (d) => (d.alvo ? compDe(d.alvo) : seq && seq.has(d) ? seq.get(d) : d.compBal);
  // retenções (INSS, PIS/COFINS/CSLL) recolhidas à Receita Federal sobre as notas do fornecedor: fazem parte do valor bruto da nota
  const nfBase = (x) => String(x || "").split("/")[0].trim(), porBase = {};
  for (const d of L) if (/^\d{3,}$/.test(nfBase(d.nf))) (porBase[nfBase(d.nf)] ||= []).push(d);
  const tokF = normTxt(c.forn).split(/[^a-z0-9]+/).find((w) => w.length >= 4 && !PALAVRAS_GEN.has(w)) || "";
  const rets = [];
  for (const b of S.todos) b.despesas.forEach((d, i) => {
    if (doContrato(c, d.forn) || !/receita federal|darf|reten|imposto retido|inss|pis|cofins|csll|irrf/i.test(`${d.forn} ${d.desc} ${d.item}`)) return;
    const txt = `${d.desc} ${d.det}`, cit = [...new Set([...txt.matchAll(/\bnf\s*n?[º°o.]*\s*([\d][\d/]*)/gi)].flatMap((m) => m[1].split("/")).filter((x) => /^\d{3,}$/.test(x)))];
    const alvos = cit.filter((x) => porBase[x]); if (!alvos.length || (tokF && !normTxt(txt).includes(tokF) && alvos.length < cit.length)) return;
    // DARF de várias notas: rateado pelo valor líquido de cada nota
    const liq = (nf) => porBase[nf].reduce((s2, y) => s2 + y.v, 0), totL = alvos.reduce((s2, nf) => s2 + liq(nf), 0) || 1;
    alvos.forEach((nf) => {
      const vNF = alvos.length > 1 ? d.v * liq(nf) / totL : d.v, men = porBase[nf].filter((y) => ehMensal(c, y)), out = porBase[nf].filter((y) => !ehMensal(c, y));
      const sM = men.reduce((s2, y) => s2 + y.v, 0), sO = out.reduce((s2, y) => s2 + y.v, 0), tot = sM + sO || 1;
      for (const [grp, sv] of [[men, sM], [out, sO]]) { if (!grp.length || sv <= 0) continue; const v = r2(vNF * sv / tot), alvo = grp[0];
        rets.push({ ...d, v, vTotal: d.v, id: `${b.mes}#${i}`, mesBal: b.mes, compBal: alvo.compBal, alvo, nfAlvo: nf, ret: true, cit: alvos, rateio: alvos.length > 1 || (sM > 0 && sO > 0) }); }
    });
  });
  for (const r of rets) (ehMensal(c, r.alvo) ? mens : avs).push(r);
  const multaP = /(\d+(?:[.,]\d+)?)\s*%/.exec(c.multa || ""), jurosP = /juros de (\d+(?:[.,]\d+)?)\s*%/.exec(c.multa || "");
  const aniv = ini ? mesMais(ini, 12) : "", porSM = /sal[aá]rio/i.test(c.reajuste || "");
  const fatorSM = (mes) => { const k = Math.floor(difMeses(ini, mes) / 12); return k >= 1 ? salMin(+mesMais(ini, 12 * k).slice(0, 4)) / salMin(+ini.slice(0, 4)) : 1; };
  const atrasos = [];
  const linhas = an.meses.map((m) => {
    const P = mens.filter((d) => compDe(d) === m.mes), A = avs.filter((d) => (setM.has(d.compBal) ? d.compBal : d.mesBal) === m.mes);
    // sem guia de retenção ligada à nota, o que foi pago é o líquido: compara com o líquido da planilha
    const semRet = !!(c.valorLiquido && c.valor && !P.some((d) => d.ret)), dev = semRet ? r2(m.dev * c.valorLiquido / c.valor) : m.dev;
    const pc = r2(P.reduce((s2, d) => s2 + d.v, 0)), pa = r2(A.reduce((s2, d) => s2 + d.v, 0)), dif = r2(pc - dev), tolV = Math.max(1, dev * tolP);
    const ex = []; let expl = 0, aPrev = 0, aSem = 0, aParc = 0;
    const add = (tipo, txt, v = 0) => { if (!ex.some((x) => x.txt === txt)) ex.push({ tipo, txt }); expl = r2(expl + v); };
    // valor proporcional pelo período da nota
    for (const d of P) {
      const per = /per[ií]odo de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/i.exec(`${d.det} ${d.desc}`); if (!per || !c.valor) continue;
      const a = isoBR(per[1]), b = isoBR(per[2]), nd = diasEntre(a, b) + 1, v30 = r2(c.valor * Math.min(30, nd) / 30), vc = r2(c.valor * nd / diasMes(m.mes));
      const em30 = Math.abs(d.v - v30) <= 1;
      if (em30 || Math.abs(d.v - vc) <= 1) {
        add("ok", `Mês proporcional: ${nd} dias de serviço (${dataBR(a)} a ${dataBR(b)}), ${brl(c.valor)} × ${nd}/${em30 ? 30 : diasMes(m.mes)} = ${brl(d.v)}${em30 && Math.abs(d.v - vc) > 1 ? " (mês comercial de 30 dias)" : ""}.`, P.length === 1 ? dif : 0);
        const iniC = c.inicio ? (c.inicio.length === 10 ? c.inicio : c.inicio + "-01") : "";
        if (iniC !== a) add("info", `O período da nota começa em ${dataBR(a)}; o início cadastrado é ${iniC ? dataBR(iniC) : "não informado"}. Ajuste o início do contrato para o devido ficar exato.`);
      }
    }
    // reajuste
    if (aniv && m.mes >= aniv && pc && Math.abs(dif - expl) > tolV) {
      if (porSM) { const f = fatorSM(m.mes), esp = r2(dev * f); if (Math.abs(pc - esp) <= Math.max(1, esp * 0.01)) add("ok", `Reajuste no aniversário do contrato pelo salário mínimo (${brl(salMin(+ini.slice(0, 4)))} → ${brl(salMin(+mesMais(ini, 12).slice(0, 4)))}): ${brl(esp)}.`, r2(esp - dev)); else add("info", `Com o reajuste previsto (${c.reajuste}), a mensalidade seria cerca de ${brl(esp)}.`); }
      else if (dif > 0 && dif / dev <= 0.12) add("prov", `Compatível com um reajuste anual de ${pct(dif / dev)}${c.reajuste ? ` (${c.reajuste})` : ""}; confirme o índice aplicado.`, dif);
    }
    for (const alvo of new Set([...P, ...A].filter((d) => d.ret).map((d) => d.alvo))) {
      const rs = [...P, ...A].filter((d) => d.ret && d.alvo === alvo), sr = r2(rs.reduce((s2, d) => s2 + d.v, 0)), liqNF = r2((porBase[nfBase(alvo.nf)] || [alvo]).filter((y) => ehMensal(c, y) === ehMensal(c, alvo)).reduce((s2, y) => s2 + y.v, 0)), bruto = r2(liqNF + sr);
      const pis = rs.find((d) => /pis|cofins|csll/i.test(`${d.item} ${d.desc}`) && !d.rateio), confere = pis && Math.abs(pis.v / 0.0465 - bruto) <= 2;
      add(confere ? "ok" : "info", `Nota ${nfBase(alvo.nf)}: líquido pago ao fornecedor ${brl(liqNF)} + retenções recolhidas à Receita ${brl(sr)} (${rs.map((d) => `${(d.item || "").toLowerCase()} ${brl(d.v)}`).join("; ")}) = valor bruto ${brl(bruto)}.${confere ? " As retenções conferem com a nota (PIS/COFINS/CSLL = 4,65% do bruto)." : ""}${rs.some((d) => d.rateio) ? ` A guia de ${brl(rs.find((d) => d.rateio).vTotal)} ${rs.find((d) => d.rateio).cit.length > 1 ? `recolhe as notas ${rs.find((d) => d.rateio).cit.join(", ")} juntas` : "cobre itens diferentes da mesma nota"}; a parte de cada um foi rateada pelo valor líquido.` : ""}`);
    }
    if (semRet && !P.length) add("info", `Comparado com o valor líquido da planilha (${brl(dev)}); as retenções são pagas à parte, à Receita.`);
    else if (semRet) add("info", `Nenhuma guia de retenção (INSS, PIS/COFINS/CSLL) ligada a esta nota aparece nos balancetes, então o pago é o valor líquido: comparado com ${brl(dev)}, o líquido da planilha (${brl(c.valorLiquido)} por mês). Peça as guias de retenção desta nota.`);
    else if (c.valorLiquido && P.length) { const liq = r2(P.filter((d) => !d.ret).reduce((s2, d) => s2 + d.v, 0)); if (Math.abs(liq - c.valorLiquido) > c.valorLiquido * tolP) add("info", `Líquido pago ${brl(liq)} contra ${brl(c.valorLiquido)} líquidos da planilha de custos (${liq > c.valorLiquido ? "+" : ""}${brl(liq - c.valorLiquido)}).`); }
    // competência informada no balancete diferente da ordem das notas
    for (const d of P) if (seq && seq.has(d) && seq.get(d) !== d.compBal) add("info", modo === "nf" ? `O balancete informa a NF ${d.nf} como competência ${rotCurto(d.compBal)}; pela ordem de emissão das notas, ela é a mensalidade de ${rotCurto(seq.get(d))}.` : `A NF ${d.nf || "s/n"} foi paga em ${d.baixa} (balancete de ${rotCurto(d.mesBal)}) e informada como competência ${rotCurto(d.compBal)}; pelo mês do pagamento, ela é a mensalidade de ${rotCurto(seq.get(d))}.`);
    // pagamento após o vencimento
    for (const d of P) {
      const pg = isoBR(d.baixa); if (!c.diaVenc || !pg) continue;
      const venc = `${mesMais(compDe(d), 1)}-${String(Math.min(c.diaVenc, 28)).padStart(2, "0")}`, at = diasEntre(venc, pg);
      if (at <= 5) continue;
      atrasos.push({ d, at, mesBal: d.mesBal });
      const lim = multaP ? dev * (numBR(multaP[1]) + (jurosP ? numBR(jurosP[1]) * Math.ceil(at / 30) : 0)) / 100 : 0, sobra = r2(dif - expl);
      if (sobra > 0.01 && sobra <= lim + 0.5) add("ok", `Pago ${at} dias após o vencimento (${dataBR(venc)}): a diferença cabe na multa e nos juros do contrato (${c.multa}).`, sobra);
      else add("info", `Paga em ${d.baixa.slice(0, 5)}, ${at} dias após o vencimento (${dataBR(venc).slice(0, 5)}).`);
    }
    // mesma nota paga mais de uma vez
    for (const d of [...P, ...A]) { const g = porNF[String(d.nf || "").trim()]; if (g && g.includes(d) && g.length > 1) add("alerta", `A NF ${d.nf} também foi paga em ${g.filter((y) => y !== d).map((y) => `${y.baixa} (${brl(y.v)}, balancete ${rotCurto(y.mesBal)})`).join(", ")}: possível pagamento em duplicidade.`); }
    if (!P.length && dev > 0) add(m.mes === ultBal ? "info" : "alerta", m.mes === ultBal ? "Competência do último balancete: costuma ser paga no balancete seguinte." : "Nenhum pagamento da mensalidade identificado para esta competência.");
    // pagamentos fora da mensalidade
    for (const k of new Set([...P, ...A].map((d) => `${d.mesBal}|${String(d.nf || "").split("/")[0].trim()}`))) { const f = faturas[k]; if (f && f.length > 2) add("info", `A nota ${k.split("|")[1]} reúne ${f.length} lançamentos deste fornecedor (${brl(f.reduce((s2, d) => s2 + d.v, 0))}): ${[...new Set(f.map((d) => (d.item || "").toLowerCase()))].join(", ")}. É uma fatura com vários itens, não pagamento repetido.`); }
    for (const d of A.filter(ehParcela)) {
      const pm = /parcela\s*(\d+)\s*\/\s*(\d+)\s*(?:-\s*([^.]+))?/i.exec(`${d.det} ${d.desc}`), k = +pm[1], n = +pm[2], prod = (pm[3] || d.item || "").trim();
      const serie = L.filter((y) => y.item === d.item && ehParcela(y) && Math.abs(y.v - d.v) <= Math.max(0.05, d.v * 0.01) && new RegExp(`/\\s*0*${n}\\b`).test(`${y.det} ${y.desc}`));
      add("ok", `Parcela ${k} de ${n} de compra parcelada (${prod.toLowerCase()}): total previsto ${brl(d.v * n)}; ${serie.length} de ${n} parcela(s) aparecem nos balancetes.`);
      aParc = r2(aParc + d.v);
    }
    for (const d of A.filter((y) => !ehParcela(y))) {
      const pv = previsaoAvulso(c, d), nome = `${(d.item || "pagamento").toLowerCase()}${d.det ? ` (${d.det.replace(/\.$/, "")})` : ""}`;
      if (pv && pv.prev) { const okv = Math.abs(d.v - pv.prev) <= 1; aPrev = r2(aPrev + d.v); add(okv ? "ok" : "info", `Avulso de ${brl(d.v)}: ${nome}. Contrato: ${pv.txt}${okv ? "" : `; pago ${d.v > pv.prev ? "a mais" : "a menos"} ${brl(Math.abs(d.v - pv.prev))}`}.${pv.excecao ? ` O contrato prevê ${pv.excecao}: confira se esta cobrança está entre elas.` : ""}`); }
      else if (pv && pv.txt) { aPrev = r2(aPrev + d.v); add("info", `Avulso de ${brl(d.v)}: ${nome}. ${pv.txt}`); }
      else if (d.ret) { aPrev = r2(aPrev + d.v); }
      else { aSem = r2(aSem + d.v); const pl = (c.info || []).find((x) => x.rot === "Planilha de custos"), loc = (c.info || []).find((x) => x.rot === "Taxa de locação"); add("alerta", `Fora da mensalidade: ${brl(d.v)}, ${nome}. ${pl ? `Não consta na planilha de custos do contrato${/administra/i.test(d.item || "") ? ", que não tem taxa de administração" : ""}${loc && /administra|loca/i.test(d.item || "") ? ` (só taxa de locação: ${loc.txt})` : ""}.` : "O contrato cadastrado não prevê esse valor: é um serviço ou compra à parte, que precisa de orçamento e aprovação próprios."}`); }
    }
    const resto = r2(dif - expl);
    if (P.length && resto > tolV) add("alerta", `${brl(resto)} acima da mensalidade sem justificativa nas notas, alertas ou respostas registradas.`);
    else if (P.length && resto < -tolV) add("alerta", `${brl(-resto)} abaixo da mensalidade.`);
    // o que os balancetes dizem: notas da administradora, alertas e respostas
    const ds = [...P, ...A], ids = new Set(ds.map((d) => d.id));
    for (const mb of new Set(ds.map((d) => d.mesBal))) for (const n of S.todos.find((x) => x.mes === mb)?.notas || []) if (citaFornecedor(n.texto, c, ds.filter((d) => d.mesBal === mb))) add("fonte", `Nota da administradora no balancete de ${rotCurto(mb)}: ${n.texto.replace(/^\d+\)\s*/, "")}`);
    for (const a of S.alertasTodos || []) if (!a.ct && (a.ids || []).some((i) => ids.has(i)) && !ex.some((x) => x.txt.includes(a.titulo))) { const r = S.acomp[a.chave] || {}; add("fonte", `Alerta: ${a.titulo}${r.resposta ? ` — resposta registrada${r.respondidoEm ? ` em ${dataBR(r.respondidoEm)}` : ""}: “${r.resposta.trim()}”` : ` — ${SITUACOES[a.sit] || "Pendente"}, sem resposta registrada`}`); }
    // resposta registrada pelo conselho para esta competência
    const reg = S.acomp[`ctm:${c.id}:${m.mes}`] || null;
    if (reg && reg.resposta) add("resposta", `Resposta registrada${reg.respondidoEm ? ` em ${dataBR(reg.respondidoEm)}` : ""}${reg.por ? ` por ${reg.por}` : ""}: “${reg.resposta.trim()}”${reg.status === "aceito" ? " — aceita pelo conselho." : ""}`);
    let st = !P.length && dev > 0 ? (m.mes === ultBal ? "aguarda" : "ausente") : Math.abs(dif) <= tolV ? "ok" : Math.abs(resto) <= tolV ? "explicado" : expl ? "parcial" : "sem";
    let restoF = Math.abs(resto) <= tolV ? 0 : resto;
    if (reg && reg.status === "aceito" && st !== "ok") { st = "aceito"; expl = r2(expl + restoF); restoF = 0; }
    else if (reg && reg.resposta && ["sem", "parcial", "ausente"].includes(st)) st = "respondido";
    else if (reg && reg.status === "perguntado" && ["sem", "parcial", "ausente"].includes(st)) st = "perguntado";
    return { ...m, dev, devBruto: m.dev, semRet, P, A, pc, pa, dif, expl, resto: restoF, ex, st, aPrev, aSem, aParc, reg };
  });
  // ---- faturas parceladas: o que faltou nos meses parcelados foi pago depois, embutido em outras notas
  const parcGrupos = [];
  for (const d of mens) {
    const m2 = /faturas? (?:dos|de) meses (\d{2})(?:\/(\d{4}))?\s*e\s*(\d{2})(?:\/(\d{4}))?(?:\s*de\s*(\d{4}))?/i.exec(`${d.det} ${d.desc}`); if (!m2) continue;
    const ano = m2[2] || m2[4] || m2[5], ms = [`${ano}-${m2[1]}`, `${m2[4] || ano}-${m2[3]}`], k = ms.join("|");
    let g = parcGrupos.find((x) => x.k === k); if (!g) parcGrupos.push((g = { k, ms, pags: [] })); g.pags.push(d);
  }
  const reST = (l) => {
    l.ex = l.ex.filter((e) => !(e.tipo === "alerta" && /(acima|abaixo) da mensalidade/.test(e.txt)));
    if (l.resto > Math.max(1, l.dev * tolP)) l.ex.push({ tipo: "alerta", txt: `${brl(l.resto)} acima da mensalidade sem justificativa nas notas, alertas ou respostas registradas.` });
    else if (l.resto < -Math.max(1, l.dev * tolP)) l.ex.push({ tipo: "alerta", txt: `${brl(-l.resto)} abaixo da mensalidade.` });
    if (["aceito", "respondido", "perguntado", "aguarda"].includes(l.st)) return; const tolV = Math.max(1, l.dev * tolP); if (Math.abs(l.resto) <= tolV) { l.resto = 0; l.st = Math.abs(l.dif) <= tolV ? "ok" : "explicado"; } else l.st = l.expl ? "parcial" : l.P.length ? "sem" : "ausente"; };
  for (const g of parcGrupos) {
    const LM = linhas.filter((l) => g.ms.includes(l.mes)); if (!LM.length) continue;
    const falta0 = r2(LM.reduce((s2, l) => s2 + Math.max(0, l.dev - l.pc), 0));
    let falta = falta0, embut = 0;
    const LP = linhas.filter((l) => !g.ms.includes(l.mes) && l.P.some((d) => g.pags.includes(d)));
    for (const l of LP) { const x = r2(Math.min(Math.max(0, l.resto), falta)); if (x <= 0) continue; l.expl = r2(l.expl + x); l.resto = r2(l.resto - x); falta = r2(falta - x); embut = r2(embut + x);
      l.ex.unshift({ tipo: "prov", txt: `A nota diz que inclui o parcelamento das faturas de ${g.ms.map(rotCurto).join(" e ")}: ${brl(x)} do que veio a mais neste mês foram atribuídos a esse parcelamento.${l.resto > 0 ? ` Ainda sobram ${brl(l.resto)} acima sem explicação.` : ""}` }); reST(l); }
    let dist = embut;
    for (const l of LM) { const sh = r2(Math.max(0, -l.resto)); const x = r2(Math.min(sh, dist)); dist = r2(dist - x); if (x > 0) { l.expl = r2(l.expl - x); l.resto = r2(l.resto + x); }
      l.ex.unshift({ tipo: x > 0 ? "prov" : "info", txt: `Fatura parcelada por falta de caixa (faturas de ${g.ms.map(rotCurto).join(" e ")}). ${x > 0 ? `${brl(x)} do que faltou neste mês aparecem pagos depois, embutidos nas notas de ${LP.map((y) => rotCurto(y.mes)).join(" e ")}.` : ""}${l.resto < -0.009 ? ` Ainda faltam ${brl(-l.resto)} neste mês.` : ""}` }); reST(l); }
    g.falta0 = falta0; g.embut = embut; g.pagoNoMes = r2(LM.reduce((s2, l) => s2 + l.pc, 0)); g.resta = r2(falta0 - embut); g.LP = LP;
  }
  // ---- conclusões do período
  const ach = [], soma = (k, f = () => true) => r2(linhas.filter(f).reduce((s2, l) => s2 + l[k], 0));
  const totP = soma("pc"), totA = soma("pa"), semExpl = r2(linhas.reduce((s2, l) => s2 + Math.max(0, l.resto), 0));
  const acimaExpl = r2(linhas.reduce((s2, l) => s2 + (l.dif > 0 ? Math.max(0, Math.min(l.dif, l.expl)) : 0), 0));
  const base = r2(totP - linhas.reduce((s2, l) => s2 + Math.max(0, l.dif), 0)), aPrev = soma("aPrev"), aSem = soma("aSem"), aParc = soma("aParc");
  const prop = linhas.flatMap((l) => l.ex).find((x) => x.tipo === "ok" && x.txt.startsWith("Mês proporcional"));
  if (prop) ach.push(["confirmado", "Primeiro mês proporcional", prop.txt]);
  if (seq && modo === "caixa") {
    const erradas = [...seq].filter(([d, m]) => d.compBal !== m), faltam = linhas.filter((l) => l.st === "ausente").map((l) => rotCurto(l.mes));
    ach.push([hip.caixa.prob === 0 ? "confirmado" : "provavel", "Competências informadas erradas", `Contando pela data de pagamento (a mensalidade de cada mês é paga no mês seguinte), os ${seq.size} pagamentos da mensalidade cobrem uma competência por mês${faltam.length ? `, faltando só ${faltam.join(", ")}` : ", sem falta nem duplicidade"}. As faltas e duplicidades que aparecem pela competência informada vêm de ${erradas.length} lançamento(s) com a competência errada no balancete: ${erradas.slice(0, 8).map(([d, m]) => `NF ${d.nf || "s/n"} paga em ${d.baixa.slice(0, 5)} (informada ${rotCurto(d.compBal)}, é ${rotCurto(m)})`).join("; ")}${erradas.length > 8 ? "…" : ""}.`]);
  }
  if (seq && modo === "nf") {
    const erradas = [...seq].filter(([d, m]) => d.compBal !== m);
    ach.push(["confirmado", "Competências informadas erradas", `As ${unicas.length} notas da mensalidade, em ordem de emissão (NF ${unicas[0].nf} a ${unicas.at(-1).nf}), cobrem uma competência por mês, de ${rotCurto(comDev[0])} a ${rotCurto(mesMais(comDev[0], unicas.length - 1))}, sem falta nem duplicidade. Os meses “sem pagamento” e “pagos duas vezes” vêm de ${erradas.length} nota(s) com a competência informada errada no balancete: ${erradas.map(([d, m]) => `NF ${d.nf} (informada ${rotCurto(d.compBal)}, é ${rotCurto(m)})`).join("; ")}.`]);
  }
  const acima = linhas.filter((l) => l.resto > 0);
  if (acima.length) {
    const i0 = linhas.indexOf(acima[0]), depois = linhas.slice(i0).filter((l) => l.P.length), med = r2(acima.reduce((s2, l) => s2 + l.pc, 0) / acima.length);
    const cents = acima.filter((l) => Math.round(l.pc * 100) % 100 !== 0);
    const exito = (c.info || []).find((x) => x.rot === "Honorários de êxito"), quem = (c.info || []).find((x) => x.rot === "Quem paga o êxito");
    const temFonte = acima.some((l) => l.ex.some((x) => x.tipo === "fonte"));
    let txt = acima.length >= 3 && acima.length / depois.length >= 0.6
      ? `Desde ${rotCurto(acima[0].mes)}, a mensalidade paga ficou acima do contrato em ${acima.length} de ${depois.length} meses: em média ${brl(med)} contra ${brl(c.valor)} previstos (+${pct(med / c.valor - 1)}). No total, ${brl(semExpl)} sem justificativa.`
      : `${brl(semExpl)} pagos acima da mensalidade em ${acima.map((l) => rotCurto(l.mes)).join(", ")}, sem justificativa.`;
    if (aniv && acima[0].mes < aniv) txt += ` O reajuste anual só vale a partir de ${rotCurto(aniv)}${porSM ? ` e, pelo salário mínimo, levaria a mensalidade a cerca de ${brl(r2(c.valor * fatorSM(aniv)))}` : ""}: não explica esses valores.`;
    txt += temFonte ? " Veja na conciliação mês a mês as notas e alertas ligados a esses pagamentos." : " Nenhuma nota da administradora, alerta respondido ou cláusula cadastrada explica a diferença.";
    if (cents.length >= 2 && !c.valorLiquido) txt += ` Os valores variam e têm centavos (${cents.slice(0, 3).map((l) => brl(l.pc)).join(", ")}…), sinal de que cada nota soma itens diferentes: peça a composição de cada nota.`;
    if (exito) txt += ` O contrato prevê honorários de êxito (${exito.txt})${quem ? ", mas diz que eles são pagos pelos inadimplentes (repasse) e não são despesa do condomínio. Se o excedente for êxito, ele não deveria sair do caixa do condomínio" : ""}.`;
    else if (!(c.info || []).length && !(c.adicionais || []).length && c.origem === "") txt += " Importe o PDF do contrato para cruzar com as cláusulas.";
    ach.push(["sem", "Valor acima do contrato", txt]);
  }
  if (!c.filtro && !ehCumulativo(c) && c.valor) {
    const rec = itensRecorrentes(c.forn), perto = L.filter((d) => !ehParcela(d) && Math.abs(d.v - c.valor) <= c.valor * 0.15).length >= 2;
    if (rec.length && !perto) ach.unshift(["sem", "Valor cadastrado não confere com os pagamentos", `Nenhum pagamento que se repete todo mês a ${c.forn} fica perto de ${brl(c.valor)}. Os recorrentes são: ${rec.slice(0, 4).map((x) => `${x.item.toLowerCase()} (cerca de ${brl(x.med)} em ${x.n} meses)`).join("; ")}. A comparação usa “${(c.itemAuto || "").toLowerCase()}”, o mais próximo; confira o valor do contrato ou informe no cadastro qual histórico é a mensalidade.`]);
  }
  for (const g of parcGrupos.filter((x) => x.falta0 > 0)) ach.push([g.resta > 1 ? "sem" : "provavel", "Faturas parceladas", `As faturas de ${g.ms.map(rotCurto).join(" e ")} foram parceladas: nesses meses entraram ${brl(g.pagoNoMes)} e faltaram ${brl(g.falta0)} em relação ao contrato. As notas de ${g.LP.map((l) => rotCurto(l.mes)).join(" e ") || "meses seguintes"} dizem incluir o parcelamento, mas só ${brl(g.embut)} vieram acima do valor normal nelas. ${g.resta > 1 ? `Faltam ${brl(g.resta)} para quitar essas faturas: peça o extrato do parcelamento (valor total, parcelas pagas e a pagar).` : "O parcelamento parece quitado."}`]);
  const aus = linhas.filter((l) => l.st === "ausente");
  if (aus.length) ach.push(["sem", "Competências sem pagamento", `Nenhuma mensalidade identificada para ${aus.map((l) => rotCurto(l.mes)).join(", ")}${modo === "bal" && melhor !== "bal" ? `. Há uma leitura com menos faltas: escolha “${melhor === "nf" ? "Pela ordem das notas" : "Pelo mês do pagamento"}” na conciliação` : ""}.`]);
  if (nfRep.length) ach.push(["sem", "Mesma nota paga mais de uma vez", nfRep.map((g) => `NF ${g[0].nf}: ${g.map((d) => `${d.baixa} (${brl(d.v)})`).join(" e ")}`).join("; ") + ". Peça a nota fiscal de cada pagamento ou o comprovante de devolução."]);
  if (avs.length) {
    const grupos = {}; for (const d of avs) { const pv = ehParcela(d) ? null : previsaoAvulso(c, d), k = d.ret ? "retenções sobre esses itens" : ehParcela(d) ? "compras parceladas" : pv ? pv.nome : (d.item || "outros").toLowerCase(); (grupos[k] ||= []).push(d); }
    const exc = avs.filter((d) => !ehParcela(d)).map((d) => previsaoAvulso(c, d)).find((p) => p && p.excecao);
    ach.push([aSem > 0 ? "sem" : "provavel", "Pagamentos fora da mensalidade", `${brl(totA)} em ${avs.length} pagamento(s): ${Object.entries(grupos).map(([k, v]) => `${k} ${brl(v.reduce((s2, d) => s2 + d.v, 0))} (${v.length})`).join("; ")}. ${[aPrev ? `${brl(aPrev)} têm previsão no contrato` : "", aParc ? `${brl(aParc)} são parcelas de compras` : "", aSem ? `${brl(aSem)} sem previsão no contrato cadastrado (serviços e compras à parte, que precisam de orçamento e aprovação próprios)` : ""].filter(Boolean).join("; ")}.${exc ? ` O contrato prevê ${exc.excecao}: confira se as cobranças estão entre elas.` : ""}`]);
  }
  if (atrasos.length) {
    const fs = new Set(atrasos.map((x) => x.mesBal)), saldo = [...fs].some((mb) => (S.todos.find((b) => b.mes === mb)?.notas || []).some((n) => /falta de saldo/i.test(n.texto)));
    ach.push(["info", "Pagamentos após o vencimento", `${atrasos.length} pagamento(s) mais de 5 dias depois do dia ${c.diaVenc} (maior atraso: ${Math.max(...atrasos.map((x) => x.at))} dias)${c.multa ? `; o contrato prevê ${c.multa} por atraso` : ""}.${saldo ? " Nos mesmos balancetes, a administradora informa pagamentos atrasados por falta de saldo do condomínio." : ""}`]);
  }
  return { c, an, linhas, ach, seq, modo, modos, melhor, comp: { base, acimaExpl, semExpl, aPrev, aSem, aParc, totP, totA }, mens, avs };
}
const ST_CT = { aceito: ["Aceito pelo conselho", "expl"], respondido: ["Respondido", "resp"], perguntado: ["Perguntado", "perg"], ok: ["Conforme", "ok"], explicado: ["Explicado", "expl"], parcial: ["Explicado em parte", "parc"], sem: ["Sem explicação", "sem"], ausente: ["Sem pagamento", "aus"], aguarda: ["Aguardando", "agu"], nada: ["—", "agu"], pago: ["Pago", "ok"], dif: ["Diferença", "sem"] };
const NIVEL = { confirmado: ["Confirmado pelos dados", "ok"], provavel: ["Provável", "expl"], sem: ["Sem explicação", "sem"], info: ["Para saber", "agu"] };
// conclusões de cada contrato viram alertas: entram em Alertas, Acompanhamento, Resumo, WhatsApp, parecer e ata
// ---------------------------------------------------------------- contratos de receita (cessão de espaço, locação)
const ehReceita = (c) => c && c.natureza === "receita";
const RECEITA_PADRAO = /^(transf\. liquida - )?taxa condominial$|^taxa administracao$|^tarifas? (de cobranca|bancaria)$|^rendimento de aplicacao$|^cashback$/;
function recebimentosDe(c, b) {
  const toks = normTxt(`${c.forn} ${c.contratado || ""} ${c.filtro || ""}`).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !["ltda", "eireli", "comercio", "servicos", "condominio"].includes(w));
  return (b.receitas || []).filter((r) => { const t = normTxt(r.desc); return r.v > 0 && (toks.some((w) => t.includes(w)) || (c.filtro && t.includes(normTxt(c.filtro)))); });
}
const receitasAvulsas = (b) => (b.receitas || []).filter((r) => r.v > 0 && !RECEITA_PADRAO.test(normTxt(r.desc).trim()));
function analisarReceita(c) {
  if (c.securitizacao) {
    const ms = securMeses(c).map((m) => ({ ...m, dev: 0, st: m.st === "ok" || m.st === "explicado" ? "pago" : m.st === "ausente" ? "ausente" : "dif" })), fim = fimContrato(c);
    return { meses: ms, ult: ms.at(-1), venceEm: fim ? diasEntre(hojeISO(), fim) : null, fim, divs: ms.filter((m) => m.st !== "pago").length, totDev: 0, totPago: r2(ms.reduce((s2, m) => s2 + (m.p || 0), 0)), dif: 0, receita: true };
  }
  const hoje = hojeISO(), tol = (c.tol ?? 2) / 100, fim = fimContrato(c), ini = ctIniMes(c);
  const ms = S.todos.filter((b) => (!ini || b.mes >= ini) && (!fim || b.mes <= fim.slice(0, 7)));
  const meses = ms.map((b) => { const rs = recebimentosDe(c, b), p = r2(rs.reduce((s2, r) => s2 + r.v, 0)), dev = c.valor ? devidoNoMes(c, b.mes) : 0;
    const st = p ? (dev ? (Math.abs(p - dev) <= dev * tol ? "ok" : "dif") : "pago") : "ausente"; return { mes: b.mes, p, dev, st, rs, outras: receitasAvulsas(b).filter((r) => !rs.includes(r)) }; });
  const totPago = r2(meses.reduce((s2, m) => s2 + m.p, 0)), totDev = r2(meses.reduce((s2, m) => s2 + m.dev, 0));
  return { meses, ult: meses.at(-1), venceEm: fim ? diasEntre(hoje, fim) : null, fim, divs: meses.filter((m) => m.st === "ausente" || m.st === "dif").length, totDev, totPago, dif: r2(totPago - totDev), receita: true };
}
// ---- securitização das taxas (ex.: Cerus Bank): bruto garantido, remuneração e tarifa por boleto descontadas
function securMeses(c) {
  const pct = (c.securitizacao?.pct || 2.5) / 100, pt = c.securitizacao?.porTitulo || 3, fim = fimContrato(c), ini = ctIniMes(c);
  let prevGross = 0;
  return S.todos.filter((b) => (!ini || b.mes >= ini) && (!fim || b.mes <= fim.slice(0, 7))).map((b) => {
    const rs = b.receitas || [], taxas = rs.filter((r) => r.v > 0 && /taxa condominial/.test(normTxt(r.desc)));
    const princ = taxas.reduce((m, r) => (!m || r.v > m.v ? r : m), null), outras = taxas.filter((r) => r !== princ);
    const fee = rs.find((r) => r.v < 0 && /^taxa administracao/.test(normTxt(r.desc))), tars = rs.filter((r) => r.v < 0 && /tarifa/.test(normTxt(r.desc)) && Math.abs(r.v) >= 100);
    const tar = r2(-tars.reduce((s2, r) => s2 + r.v, 0));
    const m = { mes: b.mes, princ, outras, fee: fee ? -fee.v : 0, tar, tarDesc: tars.map((r) => r.desc).join(" + "), gross: 0, liquido: false, st: "ausente", boletos: 0, feeEsp: 0 };
    if (princ && fee) { m.gross = princ.v; m.feeEsp = r2(m.gross * pct); m.boletos = tar ? Math.round(tar / pt) : 0; m.st = Math.abs(m.fee - m.feeEsp) <= 0.05 ? "ok" : "sem"; m.p = r2(m.gross - m.fee - m.tar); }
    else if (princ && prevGross) {
      const t2 = r2(prevGross * (1 - pct) - princ.v), k = t2 / pt;
      if (t2 > 0 && Math.abs(k - Math.round(k)) < 0.01 && k >= 50 && k <= 3000) { m.liquido = true; m.gross = prevGross; m.feeEsp = r2(prevGross * pct); m.fee = m.feeEsp; m.tar = t2; m.boletos = Math.round(k); m.st = "explicado"; }
      else m.st = "sem";
      m.p = princ.v;
    } else if (princ) { m.st = "sem"; m.p = princ.v; }
    else m.p = 0;
    if (m.gross && !m.liquido) prevGross = m.gross;
    return m;
  });
}
function alertasSecur(c) {
  const ms = securMeses(c), out = [], nome = c.forn, quem = (c.info || []).find((x) => x.rot === "Quem assina");
  const add = (sev, t2, det, perg, mes) => out.push({ sev, tipo: "Contrato", titulo: `Contrato de ${nome}: ${t2}`, detalhe: det, pergunta: perg, ids: [], mes: mes || (ms.at(-1) || {}).mes || null, forn: nome, ct: c.id });
  if (quem) add("media", "assinado por empresa do síndico como securitizada", quem.txt, `Qual ata de assembleia aprovou a securitização das taxas condominiais com a ${nome} (cláusula 11ª do contrato)? Por que quem assina como securitizada é a ${/DUOS/i.test(quem.txt) ? "Duos Síndicos 360 Ltda" : "empresa indicada"}, e não o condomínio?`);
  const dif = ms.filter((m) => m.st === "sem" && m.princ && !m.liquido && m.fee);
  if (dif.length) add("alta", "taxa descontada diferente do contrato", `Nos meses ${dif.map((m) => `${rotCurto(m.mes)} (descontado ${brl(m.fee)}, pelo contrato ${brl(m.feeEsp)})`).join("; ")}, a remuneração descontada não confere com ${String(c.securitizacao?.pct || 2.5).replace(".", ",")}% do valor das taxas.`, `Pedimos a prestação de contas da ${nome} desses meses, com o cálculo da remuneração descontada.`);
  const liq = ms.filter((m) => m.liquido);
  if (liq.length) add("baixa", "receita lançada já líquida em alguns meses", `Em ${liq.map((m) => rotCurto(m.mes)).join(", ")}, o balancete lança só o valor líquido da ${nome}, sem mostrar a taxa e as tarifas descontadas. O cálculo bate com o contrato (${String(c.securitizacao?.pct || 2.5).replace(".", ",")}% + R$ ${String(c.securitizacao?.porTitulo || 3).replace(".", ",")} por boleto), mas o balancete deveria mostrar o bruto e os descontos.`, `A administradora pode lançar a receita da ${nome} pelo valor bruto, mostrando a remuneração e as tarifas descontadas, e corrigir os meses ${liq.map((m) => rotCurto(m.mes)).join(", ")}?`);
  const sem = ms.filter((m) => m.st === "ausente");
  if (sem.length) add("alta", "mês sem repasse das taxas", `Não há receita de taxa condominial nos balancetes de ${sem.map((m) => rotCurto(m.mes)).join(", ")}.`, `O repasse garantido da ${nome} desses meses foi feito? Em que data e valor?`);
  return out;
}
function fichaSecur(c) {
  const ms = securMeses(c), fim = fimContrato(c), pct = c.securitizacao?.pct || 2.5, pt = c.securitizacao?.porTitulo || 3;
  const regs = ms.map((m) => S.acomp[`ctm:${c.id}:${m.mes}`] || {});
  const sts = ms.map((m, i) => regs[i].status === "aceito" && m.st !== "ok" ? "aceito" : regs[i].resposta && m.st === "sem" ? "respondido" : m.st);
  const sel = ms.find((m) => m.mes === S.ctMesSel) || ms.find((m, i) => sts[i] === "sem") || ms.at(-1);
  const soma = (k) => r2(ms.reduce((s2, m) => s2 + (m[k] || 0), 0)), G = soma("gross"), F = soma("fee"), T = soma("tar");
  const alts = alertasSecur(c); S.ctPerguntas = alts.map((a) => a.pergunta);
  const chips = [["Empresa", `${c.forn}${c.contratado ? ` (${c.contratado})` : ""}`], ["Remuneração", `${String(pct).replace(".", ",")}% + R$ ${String(pt.toFixed(2)).replace(".", ",")} por boleto`], ["Início", c.inicio ? dataBR(c.inicio.length === 10 ? c.inicio : c.inicio + "-01") : "—"], ["Vigência", `${c.prazoMeses ? c.prazoMeses + " meses" : "—"}${c.renovacaoAuto ? ", depois renova por prazo indeterminado" : ""}`], c.avisoDias ? ["Aviso para sair", `${c.avisoDias} dias`] : null].filter(Boolean);
  const painel = (() => {
    if (!sel) return ""; const i = ms.indexOf(sel), ant = ms[i - 1], prox = ms[i + 1], st = sts[i], reg = regs[i], k = `ctm:${c.id}:${sel.mes}`;
    const ponte = sel.princ ? [
      ["Taxas condominiais garantidas (bruto)", brl(sel.gross || sel.princ.v), "base"],
      [`Remuneração da ${c.forn} (${String(pct).replace(".", ",")}%)`, sel.fee ? `−${brl(sel.fee)}` : "—", "expl"],
      [`Tarifas: ${sel.boletos || "?"} boleto(s) × ${brl(pt)}`, sel.tar ? `−${brl(sel.tar)}` : "—", "expl"],
      ["Creditado ao condomínio", brl(sel.liquido ? sel.princ.v : r2((sel.gross || 0) - sel.fee - sel.tar)), "tot"]] : [["Nenhuma receita de taxa condominial neste balancete", "—", "sem"]];
    return `<div class="mes-painel ${ST_CT[st][1]}" id="ctMesPainel">
      <div class="mp-cab"><button type="button" class="mp-nav" data-ct-mes="${ant ? ant.mes : ""}" ${ant ? "" : "disabled"} aria-label="Mês anterior">‹</button>
        <div><span class="eyebrow">Mês</span><h3>${rotuloMes(sel.mes)}</h3></div><span class="st-ct ${ST_CT[st][1]}">${st === "ok" ? "Desconto confere" : st === "explicado" ? "Lançado líquido, confere" : st === "ausente" ? "Sem repasse" : ST_CT[st][0]}</span>
        <button type="button" class="mp-nav" data-ct-mes="${prox ? prox.mes : ""}" ${prox ? "" : "disabled"} aria-label="Próximo mês">›</button></div>
      <div class="mp-grid"><div class="mp-col">
        <h4>Do bruto ao creditado</h4><ol class="ponte">${ponte.map(([t2, v, cl]) => `<li class="${cl}"><span>${t2}</span><b>${v}</b></li>`).join("")}</ol>
        ${sel.outras.length ? `<h4>Outras receitas de taxa no mês</h4><ul class="pg-lista">${sel.outras.map((r) => `<li class="pg-card"><div><b>${esc(r.desc)}</b><span>${brl(r.v)}</span></div><small>fora do repasse garantido (ex.: cotas atrasadas de antes do contrato, salão de festas, outras cotas no mesmo boleto)</small></li>`).join("")}</ul>` : ""}
      </div><div class="mp-col">
        <h4>O que os dados mostram</h4><ul class="expl">
          ${sel.princ && !sel.liquido && sel.fee ? `<li class="e-${st === "ok" ? "ok" : "alerta"}">Remuneração descontada ${brl(sel.fee)}; pelo contrato, ${String(pct).replace(".", ",")}% de ${brl(sel.gross)} = ${brl(sel.feeEsp)}${st === "ok" ? ": confere." : `: diferença de ${brl(r2(sel.fee - sel.feeEsp))}.`}</li>` : ""}
          ${sel.tar ? `<li class="e-ok">Tarifa de cobrança ${brl(sel.tar)}${sel.tarDesc ? ` (${esc(sel.tarDesc.toLowerCase())})` : ""} = ${sel.boletos} boleto(s) a ${brl(pt)}.</li>` : ""}
          ${sel.liquido ? `<li class="e-prov">O balancete lançou só o líquido (${brl(sel.princ.v)}). Recalculando com o bruto do mês anterior (${brl(sel.gross)}): − ${brl(sel.feeEsp)} de remuneração − ${brl(sel.tar)} de tarifas (${sel.boletos} boletos) = ${brl(sel.princ.v)}. Confere, mas o balancete deveria mostrar o bruto e os descontos.</li>` : ""}
          ${sel.princ && !sel.fee && !sel.liquido ? `<li class="e-alerta">A taxa da ${esc(c.forn)} não aparece neste mês e o valor não bate com o líquido esperado. Peça a prestação de contas do mês.</li>` : ""}
          ${!sel.princ ? `<li class="e-alerta">Nenhuma receita de taxa condominial: o repasse garantido não aparece.</li>` : ""}
          ${ant && ant.gross && sel.gross && Math.abs(sel.gross - ant.gross) > 1 && !sel.liquido ? `<li class="e-info">O valor garantido mudou de ${brl(ant.gross)} para ${brl(sel.gross)} (${sel.gross > ant.gross ? "+" : ""}${pct2(sel.gross / ant.gross - 1)}), por reajuste da taxa ou mudança no número de unidades cobradas.</li>` : ""}
          ${reg.resposta ? `<li class="e-resposta">Resposta registrada${reg.respondidoEm ? ` em ${dataBR(reg.respondidoEm)}` : ""}${reg.por ? ` por ${esc(reg.por)}` : ""}: “${esc(reg.resposta)}”</li>` : ""}
        </ul>
        ${pode() ? `<div class="mp-resp"><h4>Resposta do síndico, da administradora ou da ${esc(c.forn)}</h4><textarea id="ctmTxt" rows="3" placeholder="Registre a explicação recebida para este mês">${esc(reg.resposta || "")}</textarea>
          <div class="mp-resp-acoes"><select id="ctmSt">${[["", "Sem andamento"], ["perguntado", "Perguntado"], ["respondido", "Respondido"], ["aceito", "Resposta aceita"]].map(([v, t2]) => `<option value="${v}" ${(reg.status || "") === v ? "selected" : ""}>${t2}</option>`).join("")}</select><button type="button" class="btn" data-ctm-salvar="${k}">Salvar</button>${reg.ts ? `<span class="mini">salvo ${horaBR(reg.ts)}</span>` : ""}</div></div>` : ""}
      </div></div></div>`;
  })();
  return `<div class="card ficha-ct ficha2">
    <div class="cab"><div class="cab-secao"><span class="eyebrow">${esc(c.tipo || "Securitização")}</span><h2>${esc(c.forn)}</h2></div><button type="button" class="link-x" data-ct-ficha="${c.id}" aria-label="Fechar">×</button></div>
    <p class="ct-obj-l">${esc(c.objeto || "")} · <b>o condomínio recebe as taxas garantidas, com desconto</b></p>
    <div class="ct-chips">${chips.map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`).join("")}</div>
    <div class="placar">
      <div><small>Taxas garantidas (bruto)</small><b>${brl(G)}</b><span>${ms.filter((m) => m.princ).length} mês(es)</span></div>
      <div><small>Remuneração da ${esc(c.forn)}</small><b>${brl(F)}</b><span>${String(pct).replace(".", ",")}% do bruto</span></div>
      <div><small>Tarifas por boleto</small><b>${brl(T)}</b><span>${ms.reduce((s2, m) => s2 + (m.boletos || 0), 0)} boleto(s)</span></div>
      <div class="${G ? "" : "neg"}"><small>Custo total da garantia</small><b>${G ? pct2((F + T) / G) : "—"}</b><span>${brl(r2(F + T))} no período</span></div>
    </div>
    <section class="conc"><div class="conc-cab"><div class="cab-secao"><span class="eyebrow">Repasses</span><h3>Mês a mês: clique num mês para ver o cálculo</h3></div><span></span></div>
      <div class="trilha" role="list">${ms.map((m, i) => `<button type="button" role="listitem" class="tri ${ST_CT[sts[i]][1]} ${m === sel ? "sel" : ""}" data-ct-mes="${m.mes}" aria-pressed="${m === sel}"><span class="tri-bar"><i style="height:${m.princ ? Math.round(Math.min(1, (m.gross || m.princ.v) / Math.max(...ms.map((x) => x.gross || (x.princ ? x.princ.v : 0)), 1)) * 100) : 4}%;background:${COR_CT[sts[i]]}"></i></span><span class="tri-mes">${rotCurto(m.mes)}</span><span class="tri-dif ${sts[i] === "sem" ? "neg" : ""}">${m.st === "ok" ? "confere" : m.st === "explicado" ? "líquido" : m.st === "ausente" ? "sem repasse" : "conferir"}</span></button>`).join("")}</div>
      <div class="trilha-leg legenda">${[["ok", "Desconto confere"], ["explicado", "Lançado líquido (confere pelo cálculo)"], ["sem", "Não confere"], ["ausente", "Sem repasse"]].map(([k2, t2]) => `<span><i class="${k2 === "ausente" ? "branco" : ""}" style="background:${COR_CT[k2]}"></i>${t2}</span>`).join("")}</div>
      ${painel}</section>
    <section class="diag-ct"><div class="cab-secao"><span class="eyebrow">Conclusões</span><h3>O que os dados mostram</h3></div><ul class="achados">
      <li class="ok"><span class="st-ct ok">Contrato</span><b>Receita garantida.</b> ${esc(`A ${c.forn} paga ao condomínio as taxas condominiais, o fundo de reserva e as cotas de água todo mês, 1 dia útil após o vencimento, mesmo que o condômino não pague. Em troca, fica com ${String(pct).replace(".", ",")}% do valor, R$ ${String(pt.toFixed(2)).replace(".", ",")} por boleto e com as multas, juros e encargos de quem atrasa. No período: ${brl(F)} de remuneração e ${brl(T)} de tarifas, ${G ? pct2((F + T) / G) : "—"} do bruto.`)}</li>
      ${alts.map((a) => `<li class="${a.sev === "alta" ? "sem" : a.sev === "media" ? "sem" : "agu"}"><span class="st-ct ${a.sev === "baixa" ? "agu" : "sem"}">${a.sev === "baixa" ? "Para saber" : "Precisa de resposta"}</span><b>${esc(a.titulo.replace(`Contrato de ${c.forn}: `, "").replace(/^./, (x) => x.toUpperCase()))}.</b> ${esc(a.detalhe)}</li>`).join("")}
    </ul></section>
    ${blocoAssembleia(c)}
    <details class="ct-dados"><summary>Dados completos do contrato</summary><dl class="ficha-dados">
      ${c.contratado ? `<div><dt>Razão social</dt><dd>${esc(c.contratado)}</dd></div>` : ""}${c.cnpj ? `<div><dt>CNPJ</dt><dd>${esc(c.cnpj)}</dd></div>` : ""}${c.assinatura ? `<div><dt>Assinado em</dt><dd>${dataBR(c.assinatura)}</dd></div>` : ""}
      ${(c.info || []).map((x) => `<div><dt>${esc(x.rot)}</dt><dd>${esc(x.txt)}</dd></div>`).join("")}
    </dl>${ehAdmin() ? `<div class="acoes" style="margin-top:8px"><label class="btn sec"><input type="file" data-ct-reler="${c.id}" accept="application/pdf,.pdf,.docx,.txt,image/*" hidden>Atualizar com o PDF do contrato</label><span class="mini" id="ctRelerMsg"></span></div>` : ""}</details>
  </div>`;
}
function alertasReceita(c) {
  if (c.securitizacao) return alertasSecur(c);
  const an = analisarReceita(c), aus = an.meses.filter((m) => m.st === "ausente");
  if (!aus.length) return [];
  const regra = c.valor ? `${brl(c.valor)} por mês` : c.valorRegra || "o valor do contrato";
  return [{ sev: "media", tipo: "Contrato", titulo: `Contrato de ${c.forn}: repasse da ${(c.tipo || "cessão").toLowerCase().replace(" (receita)", "")} não aparece nas receitas`,
    detalhe: `O contrato prevê ${regra} a receber de ${c.contratado || c.forn} desde ${c.inicio ? dataBR(c.inicio.length === 10 ? c.inicio : c.inicio + "-01") : "o início"}, mas nenhuma receita com o nome do cessionário aparece nos balancetes de ${aus.map((m) => rotCurto(m.mes)).join(", ")}. As receitas do balancete vêm agrupadas (taxa condominial, rendimentos, cashback): se o repasse entrou junto com as taxas, ele não aparece separado.${(c.info || []).some((x) => x.rot === "Consumo") ? " Também não há reembolso de energia, água ou internet do espaço." : ""}`,
    pergunta: `Em que datas e valores ${c.contratado || c.forn} pagou o repasse previsto (${regra}) e os reembolsos de consumo do espaço? Pedimos os comprovantes e que esses valores sejam lançados no balancete com histórico próprio.${c.valor ? "" : " Qual o valor da taxa condominial usado no cálculo?"}`,
    ids: [], mes: aus.at(-1).mes, forn: c.forn, ct: c.id }];
}
function fichaReceita(c) {
  if (c.securitizacao) return fichaSecur(c);
  const an = analisarReceita(c), fim = an.fim, ls = an.meses, avisoData = fim && c.avisoDias ? somaDias(fim, -c.avisoDias) : "";
  const sel = ls.find((m) => m.mes === S.ctMesSel) || ls.find((m) => m.st === "ausente") || ls.at(-1);
  const regra = c.valor ? `${brl(c.valor)} por mês` : c.valorRegra || "valor não informado";
  const aus = ls.filter((m) => m.st === "ausente"), regs = ls.map((m) => S.acomp[`ctm:${c.id}:${m.mes}`] || {});
  const stM = (m, i) => regs[i].status === "aceito" ? "aceito" : regs[i].resposta ? "respondido" : regs[i].status === "perguntado" && m.st === "ausente" ? "perguntado" : m.st === "ausente" ? "ausente" : m.st === "dif" ? "sem" : "ok";
  const sts = ls.map(stM), nRec = ls.filter((m, i) => m.p || sts[i] === "aceito").length;
  const chips = [["Remuneração", regra], ["Pagador", c.contratado || c.forn], ["Vigência", `${c.inicio ? dataBR(c.inicio.length === 10 ? c.inicio : c.inicio + "-01") : "—"} a ${fim ? dataBR(fim) : "indeterminado"}`], c.avisoDias ? ["Aviso para encerrar", `${c.avisoDias} dias`] : null, avisoData ? ["Avisar até", dataBR(avisoData)] : null].filter(Boolean);
  const painel = (() => {
    if (!sel) return "";
    const i = ls.indexOf(sel), ant = ls[i - 1], prox = ls[i + 1], st = sts[i], reg = regs[i], k = `ctm:${c.id}:${sel.mes}`, b = S.todos.find((x) => x.mes === sel.mes);
    return `<div class="mes-painel ${ST_CT[st][1]}" id="ctMesPainel">
      <div class="mp-cab"><button type="button" class="mp-nav" data-ct-mes="${ant ? ant.mes : ""}" ${ant ? "" : "disabled"} aria-label="Mês anterior">‹</button>
        <div><span class="eyebrow">Mês</span><h3>${rotuloMes(sel.mes)}</h3></div><span class="st-ct ${ST_CT[st][1]}">${st === "ausente" ? "Repasse não identificado" : st === "ok" ? "Recebido" : ST_CT[st][0]}</span>
        <button type="button" class="mp-nav" data-ct-mes="${prox ? prox.mes : ""}" ${prox ? "" : "disabled"} aria-label="Próximo mês">›</button></div>
      <div class="mp-grid">
        <div class="mp-col">
          <h4>Esperado x recebido</h4>
          <ol class="ponte"><li class="base${sel.dev ? "" : " regra"}"><span>Esperado pelo contrato</span><b>${sel.dev ? brl(sel.dev) : esc(regra)}</b></li><li class="tot"><span>Recebido identificado</span><b>${brl(sel.p)}</b></li></ol>
          <h4>Receitas do balancete de ${rotCurto(sel.mes)}</h4>
          <ul class="pg-lista">${(b?.receitas || []).filter((r) => r.v > 0).map((r) => `<li class="pg-card${sel.rs.includes(r) ? "" : " ret"}"><div><b>${esc(r.desc)}</b><span>${brl(r.v)}</span></div><small>${sel.rs.includes(r) ? "identificada como repasse deste contrato" : RECEITA_PADRAO.test(normTxt(r.desc).trim()) ? "receita agrupada: não dá para saber se inclui o repasse" : "receita avulsa: confirme se é do cessionário"}</small></li>`).join("")}</ul>
        </div>
        <div class="mp-col">
          <h4>${st === "ausente" ? "O que precisa de resposta" : "O que os dados mostram"}</h4>
          <ul class="expl">
            ${sel.p ? `<li class="e-ok">Receita com o nome do cessionário: ${sel.rs.map((r) => `${esc(r.desc)} ${brl(r.v)}`).join("; ")}.</li>` : `<li class="e-alerta">Nenhuma receita com o nome de ${esc(c.contratado || c.forn)} neste balancete.</li>`}
            ${!sel.p ? `<li class="e-info">O balancete lança as receitas agrupadas (taxa condominial, rendimentos, cashback). Se o repasse entrou junto com as taxas, ele não aparece separado: peça o comprovante e que a administradora lance o repasse com histórico próprio.</li>` : ""}
            ${sel.outras.length && !sel.p ? `<li class="e-info">Receitas avulsas neste mês que podem ser do cessionário: ${sel.outras.map((r) => `${esc(r.desc)} ${brl(r.v)}`).join("; ")}. Confirme a origem.</li>` : ""}
            ${(c.info || []).some((x) => x.rot === "Consumo") ? `<li class="e-info">O contrato manda o cessionário reembolsar energia, água e internet do espaço${sel.outras.some((r) => /reembols/i.test(r.desc)) ? "; há um reembolso neste mês, confirme a origem" : "; nenhum reembolso aparece neste mês"}.</li>` : ""}
            ${!c.valor ? `<li class="e-info">O contrato não fixa o valor em reais (${esc(c.valorRegra || "regra não informada")}). Informe o valor no cadastro para conferir mês a mês.</li>` : ""}
            ${reg.resposta ? `<li class="e-resposta">Resposta registrada${reg.respondidoEm ? ` em ${dataBR(reg.respondidoEm)}` : ""}${reg.por ? ` por ${esc(reg.por)}` : ""}: “${esc(reg.resposta)}”${reg.status === "aceito" ? " — aceita pelo conselho." : ""}</li>` : ""}
          </ul>
          ${pode() ? `<div class="mp-resp"><h4>Resposta do síndico ou da administradora</h4>
            <textarea id="ctmTxt" rows="3" placeholder="Ex.: repasse de R$ … recebido em …/…/…, lançado junto com as taxas">${esc(reg.resposta || "")}</textarea>
            <div class="mp-resp-acoes"><select id="ctmSt">${[["", "Sem andamento"], ["perguntado", "Perguntado"], ["respondido", "Respondido"], ["aceito", "Recebimento confirmado"]].map(([v, t2]) => `<option value="${v}" ${(reg.status || "") === v ? "selected" : ""}>${t2}</option>`).join("")}</select>
            <button type="button" class="btn" data-ctm-salvar="${k}">Salvar</button>${reg.ts ? `<span class="mini">salvo ${horaBR(reg.ts)}${reg.por ? ` por ${esc(reg.por)}` : ""}</span>` : ""}</div></div>` : ""}
        </div></div></div>`;
  })();
  const pend = sts.filter((s2) => ["ausente", "perguntado", "respondido", "sem"].includes(s2)).length;
  const perguntas = alertasReceita(c).map((a) => a.pergunta);
  S.ctPerguntas = perguntas;
  return `<div class="card ficha-ct ficha2">
    <div class="cab"><div class="cab-secao"><span class="eyebrow">${esc(c.tipo || "Contrato de receita")}${c.numero ? ` · nº ${esc(c.numero)}` : ""}</span><h2>${esc(c.forn)}</h2></div><button type="button" class="link-x" data-ct-ficha="${c.id}" aria-label="Fechar">×</button></div>
    <p class="ct-obj-l">${esc(c.objeto || "")} · <b>o condomínio recebe</b></p>
    <div class="ct-chips">${chips.map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`).join("")}</div>
    <div class="placar">
      <div><small>Meses de contrato</small><b>${ls.length}</b><span>nos balancetes carregados</span></div>
      <div><small>Esperado</small><b>${an.totDev ? brl(an.totDev) : "—"}</b><span>${an.totDev ? "pelo valor cadastrado" : esc(c.valorRegra || "informe o valor no cadastro")}</span></div>
      <div class="${an.totPago ? "pos" : ""}"><small>Recebido identificado</small><b>${brl(an.totPago)}</b><span>${nRec} mês(es) com repasse identificado ou confirmado</span></div>
      <div class="${pend ? "neg" : "pos"}"><small>Sem repasse identificado</small><b>${pend}</b><span>mês(es) a confirmar com o síndico</span></div>
    </div>
    <section class="conc">
      <div class="conc-cab"><div class="cab-secao"><span class="eyebrow">Recebimentos</span><h3>Mês a mês: clique num mês para ver as receitas do balancete</h3></div><span></span></div>
      <div class="trilha" role="list">${ls.map((m, i) => `<button type="button" role="listitem" class="tri ${ST_CT[sts[i]][1]} ${m === sel ? "sel" : ""}" data-ct-mes="${m.mes}" aria-pressed="${m === sel}">
        <span class="tri-bar"><i style="height:${m.p || sts[i] === "aceito" ? 100 : 6}%;background:${COR_CT[sts[i]]}"></i></span><span class="tri-mes">${rotCurto(m.mes)}</span><span class="tri-dif">${m.p ? brl(m.p).replace(",00", "") : sts[i] === "aceito" ? "confirmado" : "não achado"}</span></button>`).join("")}</div>
      <div class="trilha-leg legenda">${[["ok", "Recebido"], ["explicado", "Confirmado pelo conselho"], ["perguntado", "Perguntado"], ["respondido", "Respondido"], ["ausente", "Não identificado"]].map(([k2, t2]) => `<span><i class="${k2 === "ausente" ? "branco" : ""}" style="background:${COR_CT[k2]}"></i>${t2}</span>`).join("")}</div>
      ${painel}
    </section>
    <section class="diag-ct"><div class="cab-secao"><span class="eyebrow">Conclusões</span><h3>O que os dados mostram</h3></div>
      <ul class="achados">
        <li class="ok"><span class="st-ct ok">Contrato</span><b>Contrato de receita.</b> ${esc(`O condomínio cede ${c.objeto ? c.objeto.replace(/^cessão de uso de /, "") : "um espaço"} a ${c.contratado || c.forn} e recebe ${regra}. O cessionário paga o próprio consumo e o seguro do espaço.`)}</li>
        ${aus.length ? `<li class="sem"><span class="st-ct sem">Sem explicação</span><b>Repasse não identificado.</b> ${esc(alertasReceita(c)[0]?.detalhe || "")}</li>` : `<li class="ok"><span class="st-ct ok">Confirmado pelos dados</span><b>Repasses identificados</b> em todos os meses.</li>`}
        ${c.multaRescisoria ? `<li class="agu"><span class="st-ct agu">Para saber</span><b>Rescisão.</b> ${esc(c.multaRescisoria)}${c.avisoDias ? ` Aviso prévio de ${c.avisoDias} dias.` : ""}</li>` : ""}
      </ul></section>
    ${blocoAssembleia(c)}
    <details class="ct-dados"><summary>Dados completos do contrato</summary><dl class="ficha-dados">
      ${c.cnpj ? `<div><dt>CNPJ do cessionário</dt><dd>${esc(c.cnpj)}</dd></div>` : ""}${c.assinatura ? `<div><dt>Assinado em</dt><dd>${dataBR(c.assinatura)}</dd></div>` : ""}
      <div><dt>Prazo</dt><dd>${c.prazoMeses ? `${c.prazoMeses} meses` : "—"}${c.renovacaoAuto ? " · renovação automática" : " · prorrogação só por termo aditivo"}</dd></div>
      ${(c.info || []).map((x) => `<div><dt>${esc(x.rot)}</dt><dd>${esc(x.txt)}</dd></div>`).join("")}
      <div><dt>Como o site acha o repasse</dt><dd>receitas do balancete com “${esc(normTxt(c.forn).split(/\s+/)[0])}”${c.filtro ? ` ou “${esc(c.filtro)}”` : ""} no histórico; use o campo “Contar só lançamentos com o texto” do cadastro se a administradora lançar com outro nome</dd></div>
    </dl>${ehAdmin() ? `<div class="acoes" style="margin-top:8px"><label class="btn sec"><input type="file" data-ct-reler="${c.id}" accept="application/pdf,.pdf,.docx,.txt,image/*" hidden>Atualizar com o PDF do contrato</label><span class="mini" id="ctRelerMsg"></span></div>` : ""}</details>
  </div>`;
}
// ---------------------------------------------------------------- cruzamento entre contratos e pauta para a assembleia
const ehCobrancaJuridica = (c) => c && !ehReceita(c) && ((c.info || []).some((x) => x.rot === "Honorários de êxito") || /inadimpl|recupera/i.test(`${c.objeto || ""} ${c.tipo || ""}`));
const dIni = (c) => (c && c.inicio ? (c.inicio.length === 10 ? c.inicio : c.inicio + "-01") : "");
// a empresa também é contratada de outra (ex.: escritório que cobra para a securitizadora), informado no cadastro
function trabalhaPara(c, outro) { if (!c || !outro || !c.trabalhaPara) return false; const a = normTxt(c.trabalhaPara), b = normTxt(outro.forn); return a.includes(b.split(/\s+/)[0]) || b.includes(a.split(/\s+/)[0]); }
// os valores pagos acima do contrato: quanto pode ter explicação e quanto não tem
function vereditoExcedente(c, E) {
  if (!E) return null;
  const acima = E.linhas.filter((l) => l.resto > 0), literal = r2(acima.reduce((s2, l) => s2 + l.resto, 0));
  const doisSM = (mes) => 2 * salMin(+mes.slice(0, 4));
  const favoravel = r2(acima.reduce((s2, l) => s2 + Math.max(0, l.pc - Math.max(l.dev, doisSM(l.mes))), 0));
  let multas = 0;
  for (const l of acima) for (const d of l.P) { const pg = isoBR(d.baixa); if (!c.diaVenc || !pg) continue; const venc = `${mesMais(l.mes, 1)}-${String(Math.min(c.diaVenc, 28)).padStart(2, "0")}`, at = diasEntre(venc, pg); if (at > 0) multas += l.dev * (0.02 + 0.01 * at / 30); }
  multas = r2(multas);
  const assIsentas = (c.adicionais || []).some((x) => /exceto|salvo/.test(x.desc)) ? r2(E.avs.filter((d) => /assembl/i.test(`${d.item} ${d.desc}`)).reduce((s2, d) => s2 + d.v, 0)) : 0;
  const cart = r2(E.avs.filter((d) => /cartor|registro|custas/.test(normTxt(`${d.item} ${d.desc}`))).reduce((s2, d) => s2 + d.v, 0));
  return { literal, favoravel, multas, assIsentas, cart, de: acima[0]?.mes, ate: acima.at(-1)?.mes, minInd: r2(Math.max(0, favoravel - multas) + assIsentas), maxInd: r2(literal + assIsentas) };
}
function cruzamentos(c) {
  const lista = S.contratos || [], out = [];
  const sec = lista.find((x) => x.securitizacao), jur = lista.find(ehCobrancaJuridica);
  if (sec && jur && (c.id === sec.id || c.id === jur.id)) {
    let Ej = null; try { Ej = explicarContrato(jur); } catch {}
    const acima = Ej ? Ej.linhas.filter((l) => l.resto > 0) : [], semE = Ej ? Ej.comp.semExpl : 0, med = acima.length ? r2(acima.reduce((s2, l) => s2 + l.pc, 0) / acima.length) : 0;
    const exito = (jur.info || []).find((x) => x.rot === "Honorários de êxito"), ms = securMeses(sec), F = r2(ms.reduce((s2, m) => s2 + (m.fee || 0) + (m.tar || 0), 0));
    const dupla = trabalhaPara(jur, sec);
    if (dupla) {
      const V = vereditoExcedente(jur, Ej);
      out.push({ outro: c.id === sec.id ? jur : sec, titulo: "Cobrança de inadimplentes paga duas vezes",
        txt: `O conselho registrou que a ${jur.forn} também é contratada da ${sec.forn} para cobrar os inadimplentes do condomínio${jur.trabalhaParaObs ? ` (${jur.trabalhaParaObs})` : ""}. Pelo contrato da ${sec.forn}, esse trabalho é pago com os encargos cobrados do devedor (15% do 11º ao 30º dia e 20% depois ou na via judicial), por meio de nota fiscal do escritório (cláusulas 2ª, §7º, e 5ª, §4º e §5º). O próprio contrato da ${jur.forn} diz que os honorários de êxito são "repasses e não despesas do contratante" (cláusula 7ª, §1º). Assim, o que o condomínio pagou à ${jur.forn} acima da mensalidade de ${brl(jur.valor)} (${brl(semE)} de ${acima.length ? rotCurto(acima[0].mes) : "—"} a ${acima.length ? rotCurto(acima.at(-1).mes) : "—"}) não tem base no contrato e, se for pela cobrança, é pagamento em duplicidade.`,
        veredito: V, jur,
        perguntas: [
          ...(semE > 0 ? [{ tema: "Valores", q: `A ${jur.forn} vai devolver ou descontar nas próximas notas os ${brl(semE)} pagos pelo condomínio acima da mensalidade, já que a cobrança dos inadimplentes é paga pela ${sec.forn}?`, porque: `De ${rotCurto(acima[0].mes)} a ${rotCurto(acima.at(-1).mes)} as notas ficaram entre ${brl(Math.min(...acima.map((l) => l.pc)))} e ${brl(Math.max(...acima.map((l) => l.pc)))}, contra ${brl(jur.valor)} do contrato, sem aditivo nem explicação nos balancetes.`, doc: `Composição de cada nota da ${jur.forn} desde ${rotCurto(acima[0].mes)} e proposta de devolução ou compensação.` }] : []),
          { tema: "Contratos", q: `Quanto a ${sec.forn} pagou à ${jur.forn} pela cobrança dos inadimplentes do condomínio desde ${rotuloMes(dIni(sec).slice(0, 7))}?`, porque: `Se o escritório recebe da ${sec.forn} e também do condomínio pela mesma cobrança, o condomínio está pagando em duplicidade.`, doc: `Contrato entre a ${sec.forn} e a ${jur.forn} e as notas fiscais emitidas para a ${sec.forn}.` },
          { tema: "Contratos", q: `Como o condomínio fica protegido se o mesmo escritório trabalha para a ${sec.forn}, dona da dívida dos inadimplentes, e para o condomínio?`, porque: `Há conflito de interesse: a ${jur.forn} assessora o condomínio e cobra em nome da ${sec.forn}, cujo contrato foi assinado pela empresa do síndico.`, doc: `Declaração da ${jur.forn} sobre os contratos que mantém com a ${sec.forn} e com a Duos Síndicos 360.` },
          { tema: "Contratos", q: `O contrato com a ${jur.forn} deve ser revisto em assembleia, tirando a "recuperação de inadimplência" e ajustando o valor, ou encerrado?`, porque: `Essa parte do contrato deixou de ter função com a securitização. Encerrar antes do prazo obriga a pagar honorários sobre os processos em andamento (15%) e encerrados com sentença ou acordo (20%).`, doc: `Lista dos processos em andamento patrocinados pela ${jur.forn} para o condomínio.` },
        ] });
    } else
    out.push({ outro: c.id === sec.id ? jur : sec, titulo: "Cobrança de inadimplentes contratada duas vezes",
      txt: `Desde ${dataBR(dIni(sec))}, a ${sec.forn} garante as taxas e ficou com a cobrança dos inadimplentes: ela paga o condomínio mesmo sem receber, e fica com multas, juros e encargos de quem atrasa (custo no período: ${brl(F)}). O contrato da ${jur.forn}, de ${dataBR(dIni(jur))}, também é de "recuperação de inadimplência"${exito ? `, com honorários de êxito (${exito.txt})` : ""}. Com a securitização, o crédito em atraso passa a ser da ${sec.forn}, então não deveria haver cobrança de inadimplência paga pelo condomínio.${med ? ` Mesmo assim, a mensalidade da ${jur.forn} passou de ${brl(jur.valor)} para, em média, ${brl(med)} desde ${rotCurto(acima[0].mes)} (${brl(semE)} acima do contrato).` : ""}`,
      perguntas: [
        { tema: "Contratos", q: `Se as taxas estão garantidas pela ${sec.forn} desde ${rotuloMes(dIni(sec).slice(0, 7))}, que serviço de recuperação de inadimplência a ${jur.forn} presta ao condomínio, e por que o condomínio paga por ele?`, porque: `Os dois contratos cobrem a cobrança dos inadimplentes: a ${sec.forn} assumiu esse crédito e a ${jur.forn} foi contratada também para recuperá-lo.`, doc: `Relatório mensal de processos e cobranças da ${jur.forn} (previsto no contrato dela) e relatório de inadimplência da ${sec.forn}.` },
        ...(semE > 0 ? [{ tema: "Valores", q: `Os ${brl(semE)} pagos à ${jur.forn} acima da mensalidade de ${brl(jur.valor)} são honorários de êxito? De quais cobranças, se o crédito em atraso pertence à ${sec.forn}?`, porque: `O contrato da ${jur.forn} diz que o êxito é pago pelos inadimplentes, não pelo condomínio, e as notas vêm de ${rotCurto(acima[0].mes)} a ${rotCurto(acima.at(-1).mes)} entre ${brl(Math.min(...acima.map((l) => l.pc)))} e ${brl(Math.max(...acima.map((l) => l.pc)))}.`, doc: `Composição de cada nota fiscal da ${jur.forn} desde ${rotCurto(acima[0].mes)}.` }] : []),
        { tema: "Contratos", q: `A ${jur.forn} cobra inadimplentes em nome da ${sec.forn}? Se sim, quem paga esse serviço?`, porque: `O contrato da ${sec.forn} permite que ela contrate escritórios de cobrança, pagos com os encargos cobrados do devedor.`, doc: `Declaração da ${sec.forn} sobre os escritórios que cobram os inadimplentes do condomínio.` },
      ] });
  }
  if (sec && (c.id === sec.id || (jur && c.id === jur.id))) {
    const quem = (sec.info || []).find((x) => x.rot === "Quem assina");
    const nomes = [jur, sec].filter(Boolean).map((x) => `${x.forn} (${dataBR(x.assinatura || dIni(x))})`).join(" e ");
    out.push({ outro: null, titulo: "Aprovação em assembleia", txt: `Os contratos ${nomes} foram assinados pelo síndico nas semanas seguintes à assembleia de instalação.${quem ? ` No da ${sec.forn}, quem assina como securitizada é a Duos Síndicos 360 Ltda, empresa do síndico, e o condomínio aparece só como interveniente.` : ""} O próprio contrato da ${sec.forn} pede assembleia para aprovar a securitização.`,
      perguntas: [
        { tema: "Aprovação", q: `Em qual assembleia foram aprovadas a contratação da ${jur ? jur.forn : "assessoria jurídica"} e a securitização das taxas com a ${sec.forn}?`, porque: `Os dois contratos comprometem o condomínio por prazo longo (renovação automática) e o da ${sec.forn} exige aprovação em assembleia (cláusula 11ª).`, doc: "Atas das assembleias e lista de presença." },
        ...(quem ? [{ tema: "Aprovação", q: `Por que quem assina o contrato da ${sec.forn} como securitizada é a Duos Síndicos 360 Ltda, e não o condomínio? A empresa do síndico recebe algum valor dessa operação?`, porque: "O crédito securitizado é do condomínio, mas a parte do contrato é a empresa do síndico; o condomínio só anui.", doc: `Contrato completo com a ${sec.forn}, anexos e eventuais aditivos, e declaração de que a Duos não recebe comissão.` }] : []),
      ] });
  }
  if (sec && c.id === sec.id && sec.securitizacao?.desconto) {
    const prazo = dIni(sec) ? somaDias(dIni(sec), 365) : "", ms = securMeses(sec).filter((m) => m.fee && m.gross && !m.liquido), ult = ms.at(-1);
    const pctAtual = ult ? ult.fee / ult.gross : null;
    out.push({ outro: null, titulo: "Desconto obrigatório para pagamento antecipado", txt: `O contrato exige que o condomínio aprove em assembleia um desconto de ${sec.securitizacao.desconto}% para quem paga antes do vencimento, em até 12 meses${prazo ? ` (até ${dataBR(prazo)})` : ""}; sem isso, a taxa da ${sec.forn} sobe 1 ponto.${pctAtual ? ` Em ${rotCurto(ult.mes)}, a taxa descontada ainda era ${pct2(pctAtual)}.` : ""}`,
      perguntas: [{ tema: "Valores", q: `O desconto de ${sec.securitizacao.desconto}% para pagamento antecipado exigido pela ${sec.forn} foi aprovado? Se não, a taxa da ${sec.forn} vai subir de ${String(sec.securitizacao.pct || 2.5).replace(".", ",")}% para ${String((sec.securitizacao.pct || 2.5) + 1).replace(".", ",")}%?`, porque: `O prazo de 12 meses do contrato terminou${prazo ? ` em ${dataBR(prazo)}` : ""}.`, doc: "Ata que aprovou o desconto ou comunicado da Cerus Bank sobre a nova taxa." }] });
  }
  return out;
}
// perguntas para a assembleia: pergunta direta, o porquê com os números e o documento a pedir
function pautaAssembleia(c) {
  const P = [], add = (tema, q, porque, doc) => P.push({ tema, q, porque, doc });
  if (c.securitizacao) {
    for (const a of alertasSecur(c)) if (!/assinado por empresa do síndico/.test(a.titulo)) add(/taxa descontada/.test(a.titulo) ? "Valores" : "Prestação de contas", a.pergunta, a.detalhe, `Prestação de contas mensal da ${c.forn}.`);
  } else if (ehReceita(c)) {
    for (const a of alertasReceita(c)) add("Receitas", a.pergunta, a.detalhe, `Comprovantes de depósito de ${c.contratado || c.forn} e extrato bancário do condomínio.`);
  } else {
    let E; try { E = explicarContrato(c); } catch { E = null; }
    if (E) {
      const ref = c.numero ? ` nº ${c.numero}` : "", L = E.linhas;
      for (const [nv, tit, txt] of E.ach) {
        if (tit === "Valor acima do contrato") { const ac = L.filter((l) => l.resto > 0), med = r2(ac.reduce((s2, l) => s2 + l.pc, 0) / ac.length);
          add("Valores", `Por que a ${c.forn} recebe, em média, ${brl(med)} por mês, se o contrato${ref} fixa ${brl(c.valor)}?`, `De ${rotCurto(ac[0].mes)} a ${rotCurto(ac.at(-1).mes)} foram pagos ${brl(E.comp.semExpl)} acima do contrato, sem aditivo, reajuste ou explicação nos balancetes.`, "Notas fiscais com a composição de cada valor e o aditivo ou a ata que autorizou o aumento."); }
        else if (tit === "Pagamentos fora da mensalidade" && (E.comp.aSem > 0 || /exceto|salvo/.test(txt))) {
          const ass = E.avs.filter((d) => /assembl/i.test(`${d.item} ${d.desc}`)).map((d) => (/(\d{2}\/\d{2}\/\d{4})/.exec(d.det || "") || [])[1]).filter(Boolean);
          if (ass.length && /exceto|salvo/.test(txt)) add("Valores", `As assembleias de ${[...new Set(ass)].join(" e ")}, cobradas pela ${c.forn}, estão entre as 3 primeiras após a instalação? Se estão, por que foram cobradas?`, `O contrato cobra 40% do salário mínimo por assembleia, mas isenta as 3 primeiras após a assembleia de instalação, e essas foram logo depois dela.`, "Lista das assembleias realizadas desde a instalação e os recibos cobrados.");
          if (E.comp.aSem > 0) add("Valores", `Quem autorizou os ${brl(E.comp.aSem)} pagos à ${c.forn} fora do contrato?`, txt, "Orçamentos, aprovação (ata ou autorização do síndico) e notas fiscais de cada serviço.");
        }
        else if (tit === "Competências sem pagamento") add("Prestação de contas", `As competências ${L.filter((l) => l.st === "ausente").map((l) => rotCurto(l.mes)).join(", ")} da ${c.forn} estão pagas? Em qual nota?`, txt, "Notas fiscais e comprovantes desses meses.");
        else if (tit === "Mesma nota paga mais de uma vez") add("Valores", `Por que a mesma nota fiscal da ${c.forn} foi paga mais de uma vez?`, txt.replace(/\. Peça.*$/, "."), "Nota fiscal de cada pagamento ou comprovante de devolução.");
        else if (tit === "Faturas parceladas") add("Valores", `Quanto falta pagar à ${c.forn} das faturas parceladas, e com quais encargos?`, txt, "Extrato do parcelamento: valor total, parcelas pagas e a pagar.");
        else if (tit === "Valor cadastrado não confere com os pagamentos") add("Contratos", `Qual é o valor mensal do contrato com a ${c.forn} e o que ele cobre?`, txt, "Contrato e planilha de custos vigentes.");
        else if (tit === "Competências informadas erradas") add("Prestação de contas", `A administradora pode corrigir no balancete a competência das notas da ${c.forn}?`, txt, "Balancete corrigido.");
      }
      if ((c.info || []).some((x) => x.rot === "Planilha de custos") && E.avs.some((d) => /administra/i.test(d.item || ""))) add("Valores", `Com base em que cláusula a ${c.forn} cobra taxa de administração, se a planilha de custos do contrato não tem esse item?`, `Foram pagos ${brl(r2(E.avs.filter((d) => /administra/i.test(d.item || "")).reduce((s2, d) => s2 + d.v, 0)))} com esse nome no período.`, "Cláusula do contrato ou aditivo que prevê a taxa.");
    }
  }
  const cruz = cruzamentos(c);
  for (const x of cruz) for (const p of x.perguntas) if (!P.some((y) => y.q === p.q)) P.push(p);
  // a pergunta do cruzamento sobre os honorários de êxito já cobre a do valor acima do contrato
  if (P.some((p) => /são honorários de êxito/.test(p.q))) { const i = P.findIndex((p) => /recebe, em média/.test(p.q)); if (i >= 0) { const g = P.splice(i, 1)[0]; const e = P.find((p) => /são honorários de êxito/.test(p.q)); e.porque = `${g.porque} ${e.porque}`; e.doc = g.doc; } }
  const ordem = ["Aprovação", "Contratos", "Valores", "Receitas", "Prestação de contas"];
  P.sort((a, b) => ordem.indexOf(a.tema) - ordem.indexOf(b.tema));
  S.ctPauta = P; S.ctPerguntas = P.map((p) => p.q);
  return { cruz, P };
}
function blocoAssembleia(c) {
  const { cruz, P } = pautaAssembleia(c);
  return `${cruz.length ? `<section class="cruz-ct"><div class="cab-secao"><span class="eyebrow">Cruzamento com outros contratos</span><h3>O que os contratos mostram juntos</h3></div>
      <ul class="achados">${cruz.map((x) => `<li class="sem"><span class="st-ct sem">Precisa de resposta</span><b>${esc(x.titulo)}.</b> ${esc(x.txt)}${x.outro ? ` <button type="button" class="link-btn" data-ct-ficha="${x.outro.id}">Ver ${esc(x.outro.forn)}</button>` : ""}</li>`).join("")}</ul>
      ${cruz.filter((x) => x.veredito).map((x) => { const V = x.veredito, j = x.jur || c; return `<div class="veredito"><h4>Os valores pagos a mais são devidos?</h4>
        <p class="vered-resp"><b>Pelos contratos e pelos balancetes, não.</b> Até a ${esc(j.forn)} comprovar a composição de cada nota e a cláusula que autoriza cada valor, o excedente deve ser tratado como indevido.</p>
        <table class="vered-tab"><tbody>
          <tr><td>Pago acima da mensalidade de ${brl(j.valor)} (${V.de ? rotCurto(V.de) : "—"} a ${V.ate ? rotCurto(V.ate) : "—"}), lendo o contrato ao pé da letra</td><td class="n neg">${brl(V.literal)}</td></tr>
          <tr><td>Mesmo na leitura mais favorável ao escritório (mensalidade = 2 salários mínimos do ano)</td><td class="n neg">${brl(V.favoravel)}</td></tr>
          ${V.assIsentas ? `<tr><td>Assembleias cobradas que podem estar entre as 3 isentas pelo contrato</td><td class="n neg">${brl(V.assIsentas)}</td></tr>` : ""}
          <tr><td>Única parte com explicação possível: multa e juros por atraso (2% + 1% ao mês)</td><td class="n">até ${brl(V.multas)}</td></tr>
          ${V.cart ? `<tr><td>Cartório e registro de atas: devidos se houver comprovante (reembolso previsto)</td><td class="n">${brl(V.cart)}</td></tr>` : ""}
          <tr class="total"><td>Possivelmente indevido</td><td class="n neg">${brl(V.minInd)} a ${brl(V.maxInd)}</td></tr>
        </tbody></table>
        <h4>Decisão sugerida</h4>
        <ol class="vered-passos"><li>Contestar por escrito já: pelo contrato do escritório, a prestação de contas sem resposta em 30 dias é dada como aceita.</li>
          <li>Pedir em até 15 dias a composição de cada nota e os relatórios mensais de processos, que o contrato obriga.</li>
          <li>Até a resposta, pagar só a mensalidade de ${brl(j.valor)}.</li>
          <li>Sem comprovação: pedir a devolução ou o desconto nas próximas notas e levar à assembleia a revisão ou o encerramento do contrato (antes, pedir a lista de processos em andamento).</li></ol>
        <p class="mini">Leitura dos documentos para apoiar a decisão do conselho; não substitui a orientação de um advogado.</p></div>`; }).join("")}
      </section>` : ""}
    <div class="cab-secao" style="margin-top:16px"><span class="eyebrow">Para a assembleia</span><h3>Perguntas ao síndico e à administradora</h3></div>
    ${P.length ? `<ol class="pauta-ct">${P.map((p) => `<li><span class="tema">${esc(p.tema)}</span><p class="q">${esc(p.q)}</p><p><b>Por quê:</b> ${esc(p.porque)}</p><p><b>Pedir:</b> ${esc(p.doc)}</p></li>`).join("")}</ol>
      <div class="acoes"><button class="btn sec" type="button" id="ctCopiarPerg">Copiar perguntas para a assembleia</button></div>` : '<p class="muted">Nada a questionar: os pagamentos conferem ou estão explicados.</p>'}`;
}
function alertasContratos(existentes) {
  const out = [];
  for (const c of S.contratos || []) {
    if (ehReceita(c)) { out.push(...alertasReceita(c)); continue; }
    const secC = (S.contratos || []).find((x) => x.securitizacao);
    if (secC && trabalhaPara(c, secC)) { let Ej = null; try { Ej = explicarContrato(c); } catch {} const V = vereditoExcedente(c, Ej);
      if (V && V.literal > 0) out.push({ sev: "alta", tipo: "Contrato", titulo: `Contrato de ${c.forn}: valores pagos a mais pela cobrança já paga pela ${secC.forn}`, detalhe: `A ${c.forn} também é contratada da ${secC.forn} para cobrar os inadimplentes, trabalho pago com os encargos do devedor. O condomínio pagou ${brl(V.literal)} acima da mensalidade de ${brl(c.valor)} (${rotCurto(V.de)} a ${rotCurto(V.ate)}); possivelmente indevido: ${brl(V.minInd)} a ${brl(V.maxInd)}.`, pergunta: `A ${c.forn} vai devolver ou descontar nas próximas notas os ${brl(V.literal)} pagos acima da mensalidade, já que a cobrança dos inadimplentes é paga pela ${secC.forn}?`, ids: [], mes: V.ate, forn: c.forn, ct: c.id }); }
    let E; try { E = explicarContrato(c); } catch { continue; }
    const ids = (f) => E.linhas.filter(f).flatMap((l) => [...l.P, ...l.A].map((d) => d.id));
    const ultMes = (f) => (E.linhas.filter(f).at(-1) || E.linhas.at(-1) || {}).mes || null;
    const add = (sev, nome, detalhe, pergunta, idsA, mes) => out.push({ sev, tipo: "Contrato", titulo: `Contrato de ${c.forn}: ${nome}`, detalhe, pergunta, ids: idsA, mes, forn: c.forn, ct: c.id });
    for (const [nv, tit, txt] of E.ach) {
      if (tit === "Valor acima do contrato" && secC && trabalhaPara(c, secC)) continue;
      if (tit === "Valor acima do contrato") add("alta", "mensalidade paga acima do contrato", txt, (S.ctPerguntasDe?.(E) || [])[0] || `Qual o documento que autoriza pagar ${brl(E.comp.semExpl)} acima da mensalidade de ${brl(c.valor)} a ${c.forn}?`, ids((l) => l.resto > 0), ultMes((l) => l.resto > 0));
      else if (tit === "Competências sem pagamento") add("media", "competências sem pagamento", txt, `As competências ${E.linhas.filter((l) => l.st === "ausente").map((l) => rotCurto(l.mes)).join(", ")} de ${c.forn} estão quitadas? Em qual nota?`, [], ultMes((l) => l.st === "ausente"));
      else if (tit === "Mesma nota paga mais de uma vez") { const idsD = ids((l) => l.ex.some((x) => /duplicidade/.test(x.txt))); if (!existentes.some((a) => (a.ids || []).some((i) => idsD.includes(i)) && /duplicidade|Documento fiscal/i.test(a.tipo))) add("alta", "mesma nota paga mais de uma vez", txt, `Apresentar a nota fiscal de cada pagamento a ${c.forn} ou o comprovante de devolução do valor pago em duplicidade.`, idsD, ultMes(() => true)); }
      else if (tit === "Pagamentos fora da mensalidade" && (E.comp.aSem > 0 || /exceto|salvo/.test(txt))) add(E.comp.aSem > 0 ? "media" : "baixa", "pagamentos fora da mensalidade", txt, `Quais documentos autorizam os pagamentos a ${c.forn} fora da mensalidade${E.comp.aSem ? ` (${brl(E.comp.aSem)} sem previsão no contrato)` : ""}?`, ids((l) => l.A.length > 0), ultMes((l) => l.A.length > 0));
      else if (tit === "Competências informadas erradas") add("baixa", "competência informada fora de ordem nos balancetes", txt, `Pedir à administradora corrigir a competência informada das notas de ${c.forn}.`, [], ultMes(() => true));
      else if (tit === "Valor cadastrado não confere com os pagamentos") add("media", "valor cadastrado não confere com os pagamentos", txt, `Qual o valor mensal contratado com ${c.forn} e qual lançamento do balancete corresponde a ele?`, [], ultMes(() => true));
    }
  }
  return out;
}
const COR_CT = { ok: "#2a9d8f", explicado: "#5b9bd5", aceito: "#5b9bd5", parcial: "#e0a100", respondido: "#7e6bc4", perguntado: "#c98a00", sem: "#d9663a", ausente: "#ffffff", aguarda: "#9aa7b3", pago: "#2a9d8f", nada: "#9aa7b3", dif: "#d9663a" };
const PEND_CT = new Set(["sem", "parcial", "ausente", "perguntado", "respondido"]);
const sinal = (v) => `${v > 0.004 ? "+" : v < -0.004 ? "−" : ""}${brl(Math.abs(v))}`;
// painel de um mês: ponte do devido até o pago, pagamentos, por quê, o que os balancetes dizem e a resposta do conselho
function painelMes(E, l) {
  const c = E.c, i = E.linhas.indexOf(l), ant = E.linhas[i - 1], prox = E.linhas[i + 1];
  const ajustes = l.ex.filter((x) => x.tipo === "ok" || x.tipo === "prov"), atencao = l.ex.filter((x) => x.tipo === "alerta"), info = l.ex.filter((x) => x.tipo === "info"), fontes = l.ex.filter((x) => x.tipo === "fonte" || x.tipo === "resposta");
  const explMes = r2(l.dif - l.resto), mens = l.P.filter((d) => !d.ret), rets = l.P.filter((d) => d.ret);
  const ponte = [
    ["Devido pelo contrato", brl(l.dev), "base"],
    ...(l.st === "aguarda" ? [["Ainda não pago (entra no balancete seguinte)", "—", "base"]] : []),
    ...(l.st !== "aguarda" && Math.abs(explMes) > 0.009 ? [[l.st === "aceito" ? "Diferença aceita pelo conselho" : "Diferença explicada", sinal(explMes), "expl"]] : []),
    ...(l.st !== "aguarda" && Math.abs(l.resto) > 0.009 ? [[l.resto > 0 ? "Acima, sem explicação" : l.st === "ausente" ? "Não pago" : "Abaixo do devido", sinal(l.resto), l.resto > 0 ? "sem" : "aus"]] : []),
    ["Mensalidade paga" + (rets.length ? " (líquido + retenções)" : ""), brl(l.pc), "tot"],
  ];
  const reg = l.reg || {}, k = `ctm:${c.id}:${l.mes}`;
  const nfCard = (d) => `<li class="pg-card${d.ret ? " ret" : ""}"><div><b>${d.ret ? `Retenção ${esc((d.item || "").toLowerCase())}` : /^\d/.test(d.nf || "") ? `NF ${esc(d.nf)}` : esc(d.nf || "s/n")}</b><span>${brl(d.v)}</span></div>
    <small>${d.ret ? `guia à Receita sobre a NF ${esc(d.nfAlvo)}${d.rateio ? ` (rateio de ${brl(d.vTotal)})` : ""}` : esc((d.item || "").toLowerCase())} · pago em ${esc(d.baixa)} · balancete ${rotCurto(d.mesBal)}${!d.ret && d.compBal !== l.mes ? ` · <i>informada ${rotCurto(d.compBal)}</i>` : ""}</small>${d.det && !d.ret ? `<small>${esc(d.det)}</small>` : ""}</li>`;
  const lista = (arr, cls) => arr.length ? `<ul class="expl ${cls || ""}">${arr.map((x) => `<li class="e-${x.tipo}">${esc(x.txt)}</li>`).join("")}</ul>` : "";
  return `<div class="mes-painel ${ST_CT[l.st][1]}" id="ctMesPainel">
    <div class="mp-cab"><button type="button" class="mp-nav" data-ct-mes="${ant ? ant.mes : ""}" ${ant ? "" : "disabled"} aria-label="Mês anterior">‹</button>
      <div><span class="eyebrow">Competência</span><h3>${rotuloMes(l.mes)}</h3></div><span class="st-ct ${ST_CT[l.st][1]}">${ST_CT[l.st][0]}</span>
      <button type="button" class="mp-nav" data-ct-mes="${prox ? prox.mes : ""}" ${prox ? "" : "disabled"} aria-label="Próximo mês">›</button></div>
    <div class="mp-grid">
      <div class="mp-col">
        <h4>Do devido ao pago</h4>
        <ol class="ponte">${ponte.map(([t2, v, cl]) => `<li class="${cl}"><span>${t2}</span><b>${v}</b></li>`).join("")}</ol>
        ${l.pa ? `<p class="mp-fora">Fora da mensalidade neste mês: <b>${brl(l.pa)}</b> em ${l.A.filter((d) => !d.ret).length} pagamento(s)</p>` : ""}
        <h4>Pagamentos da mensalidade</h4>
        ${mens.length || rets.length ? `<ul class="pg-lista">${[...mens, ...rets].map(nfCard).join("")}</ul>` : `<p class="muted small">${l.st === "aguarda" ? "Ainda não pago: costuma entrar no balancete seguinte." : "Nenhum pagamento da mensalidade para esta competência."}</p>`}
        ${l.A.filter((d) => !d.ret).length ? `<details class="mp-av"><summary>Pagamentos fora da mensalidade (${l.A.filter((d) => !d.ret).length})</summary><ul class="pg-lista">${l.A.map(nfCard).join("")}</ul></details>` : ""}
      </div>
      <div class="mp-col">
        ${ajustes.length ? `<h4>O que explica</h4>${lista(ajustes)}` : ""}
        ${atencao.length ? `<h4>O que precisa de resposta</h4>${lista(atencao)}` : ""}
        ${info.length ? `<h4>Para saber</h4>${lista(info)}` : ""}
        ${fontes.length ? `<h4>O que os balancetes e o conselho dizem</h4>${lista(fontes, "fontes")}` : ""}
        ${!l.ex.length ? '<p class="muted small">Pagamento igual ao contrato. Nada a explicar.</p>' : ""}
        ${pode() ? `<div class="mp-resp" data-ctm="${k}">
          <h4>Resposta do síndico ou da administradora</h4>
          <textarea id="ctmTxt" rows="3" placeholder="Registre aqui a explicação recebida para este mês">${esc(reg.resposta || "")}</textarea>
          <div class="mp-resp-acoes"><select id="ctmSt">${[["", "Sem andamento"], ["perguntado", "Perguntado"], ["respondido", "Respondido"], ["aceito", "Resposta aceita (explica a diferença)"]].map(([v, t2]) => `<option value="${v}" ${(reg.status || "") === v ? "selected" : ""}>${t2}</option>`).join("")}</select>
          <button type="button" class="btn" data-ctm-salvar="${k}">Salvar</button>${reg.ts ? `<span class="mini">salvo ${horaBR(reg.ts)}${reg.por ? ` por ${esc(reg.por)}` : ""}</span>` : ""}</div></div>`
          : reg.resposta ? "" : '<p class="mini">Sem resposta registrada.</p>'}
      </div>
    </div></div>`;
}
function fichaContrato(c0) {
  const E = explicarContrato(c0), c = E.c, an = E.an, fim = an.fim, linhas = E.linhas, cp = E.comp;
  const avisoData = fim && c.avisoDias ? somaDias(fim, -c.avisoDias) : "";
  // perguntas a partir do que ficou sem explicação
  const perguntas = [];
  const ref = c.numero ? ` nº ${c.numero}` : "";
  for (const [nv, tit, txt] of E.ach) {
    if (nv !== "sem" && !(nv === "provavel" && /fora da mensalidade/.test(tit))) continue;
    if (tit === "Valor acima do contrato") perguntas.push(`Pelo contrato${ref}, a mensalidade é de ${brl(c.valor)}, mas foram pagos ${brl(cp.semExpl)} acima disso em ${linhas.filter((l) => l.resto > 0).map((l) => rotCurto(l.mes)).join(", ")}. Pedimos a composição de cada nota fiscal e o documento (aditivo, aprovação em assembleia ou cláusula) que autoriza cada valor a mais.${(c.info || []).some((x) => x.rot === "Quem paga o êxito") ? " Se forem honorários de êxito, pedimos esclarecer por que foram pagos pelo condomínio, já que o contrato diz que são pagos pelos inadimplentes." : ""}`);
    else if (tit === "Competências sem pagamento") perguntas.push(`Não identificamos pagamento das competências ${linhas.filter((l) => l.st === "ausente").map((l) => rotCurto(l.mes)).join(", ")}. Pedimos confirmar se estão quitadas e em qual nota.`);
    else if (tit === "Mesma nota paga mais de uma vez") perguntas.push(`${txt.replace(/\. Peça.*$/, "")}. Pedimos a nota fiscal de cada pagamento ou o comprovante de devolução do valor pago em duplicidade.`);
    else if (tit === "Pagamentos fora da mensalidade") perguntas.push(`Além da mensalidade, foram pagos ${brl(cp.totA)} ao fornecedor (${E.avs.slice(0, 5).map((d) => `${(d.item || "").toLowerCase()} ${brl(d.v)}`).join("; ")}${E.avs.length > 5 ? "…" : ""}). Pedimos os comprovantes de cada despesa e a autorização dos valores sem previsão no contrato.${/exceto|salvo/.test(txt) ? " Pedimos também confirmar se as assembleias cobradas não estão entre as isentas pelo contrato." : ""}`);
  }
  if (E.seq && E.modo !== "bal") perguntas.push(`Pedimos à administradora corrigir a competência informada das notas ${[...E.seq].filter(([d, m]) => d.compBal !== m).map(([d]) => d.nf).join(", ")} de ${c.forn}, que não corresponde ao mês do serviço.`);
  S.ctPerguntas = perguntas;
  const pend = linhas.filter((l) => PEND_CT.has(l.st));
  const linhasAte = linhas.filter((l) => l.st !== "aguarda"), devAte = r2(linhasAte.reduce((s2, l) => s2 + l.dev, 0));
  const sel = linhas.find((l) => l.mes === S.ctMesSel) || pend[0] || linhas.at(-1);
  const alertasCt = (S.alertasTodos || []).filter((a) => a.ct === c.id);
  const partes = [["Mensalidade dentro do contrato", cp.base, "#2a9d8f"], ["Acima, explicado", cp.acimaExpl, "#5b9bd5"], ["Acima, sem explicação", cp.semExpl, "#d9663a"], ["Avulsos previstos e retenções", cp.aPrev, "#8e7cc3"], ["Compras parceladas", cp.aParc, "#7aa6c2"], ["Serviços fora do contrato", cp.aSem, "#c2185b"]].filter((p) => p[1] > 0.009);
  const totComp = partes.reduce((s2, p) => s2 + p[1], 0) || 1;
  const mx = Math.max(...linhas.map((l) => Math.max(l.pc, l.dev)), 1);
  const chips = [["Mensalidade", descreverValor(c)], c.diaVenc ? ["Vencimento", `dia ${c.diaVenc}`] : null, ["Vigência", `${c.inicio ? (c.inicio.length === 10 ? dataBR(c.inicio) : rotuloMes(c.inicio)) : "—"} a ${fim ? dataBR(fim) : "indeterminado"}`], c.reajuste ? ["Reajuste", c.reajuste] : null, c.multa ? ["Multa por atraso", c.multa] : null, avisoData ? ["Avisar até", dataBR(avisoData)] : null].filter(Boolean);
  const modos = E.modos.length > 1 ? `<div class="chips" role="group" aria-label="Como contar a competência"><span class="mini">Competência:</span>${E.modos.map((m) => `<button type="button" class="chip" data-ct-modo="${m}" aria-pressed="${E.modo === m}">${{ nf: "Pela ordem das notas", caixa: "Pelo mês do pagamento", bal: "Como informada no balancete" }[m]}${m === E.melhor ? " ✓" : ""}</button>`).join("")}</div>` : "<span></span>";
  return `<div class="card ficha-ct ficha2">
    <div class="cab"><div class="cab-secao"><span class="eyebrow">${esc(c.tipo || "Contrato")}${c.numero ? ` · nº ${esc(c.numero)}` : ""}</span><h2>${esc(c.forn)}</h2></div><button type="button" class="link-x" data-ct-ficha="${c.id}" aria-label="Fechar">×</button></div>
    <p class="ct-obj-l">${esc(c.objeto || "")}</p>
    <div class="ct-chips">${chips.map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`).join("")}</div>

    <div class="placar">
      <div><small>Devido pelo contrato</small><b>${brl(devAte)}</b><span>${linhasAte.length} competência(s)${linhasAte.length ? `, até ${rotCurto(linhasAte.at(-1).mes)}` : ""}</span></div>
      <div><small>Mensalidade paga</small><b>${brl(cp.totP)}</b><span>${sinal(r2(cp.totP - devAte))} sobre o devido</span></div>
      <div class="pos"><small>Diferença explicada</small><b>${brl(cp.acimaExpl)}</b><span>por proporcional, reajuste, multa ou resposta aceita</span></div>
      <div class="${cp.semExpl > 0.009 ? "neg" : "pos"}"><small>Sem explicação</small><b>${brl(cp.semExpl)}</b><span>${pend.length} mês(es) pendente(s)</span></div>
      <div><small>Fora da mensalidade</small><b>${brl(cp.totA)}</b><span>avulsos, parcelas e retenções</span></div>
    </div>
    <div class="comp-barra" role="img" aria-label="Composição do total pago">${partes.map((p) => `<span style="flex:${p[1] / totComp};background:${p[2]}" data-tip="${esc(`${p[0]}: ${brl(p[1])} (${pct(p[1] / totComp)})`)}"></span>`).join("")}</div>
    <div class="legenda comp-leg">${partes.map((p) => `<span><i style="background:${p[2]}"></i>${p[0]} <b>${brl(p[1])}</b></span>`).join("")}</div>

    <section class="conc">
      <div class="conc-cab"><div class="cab-secao"><span class="eyebrow">Conciliação</span><h3>Mês a mês: clique num mês para ver a explicação</h3></div>${modos}</div>
      <div class="trilha" role="list">${linhas.map((l) => `<button type="button" role="listitem" class="tri ${ST_CT[l.st][1]} ${l === sel ? "sel" : ""}" data-ct-mes="${l.mes}" aria-pressed="${l === sel}" title="${esc(`${rotuloMes(l.mes)}: ${ST_CT[l.st][0]}`)}">
        <span class="tri-bar"><i style="height:${Math.round(Math.min(1, l.pc / mx) * 100)}%;background:${COR_CT[l.st]}"></i><em style="bottom:${Math.round(Math.min(1, l.dev / mx) * 100)}%"></em></span>
        <span class="tri-mes">${rotCurto(l.mes)}</span><span class="tri-dif ${l.resto > 0.009 ? "neg" : ""}">${Math.abs(l.dif) < 0.01 ? "ok" : sinal(l.dif).replace(",00", "")}</span></button>`).join("")}</div>
      <div class="trilha-leg legenda">${[["ok", "Conforme"], ["explicado", "Explicado"], ["parcial", "Explicado em parte"], ["perguntado", "Perguntado"], ["respondido", "Respondido"], ["sem", "Sem explicação"], ["ausente", "Sem pagamento"]].map(([k2, t2]) => `<span><i class="${k2 === "ausente" ? "branco" : ""}" style="background:${COR_CT[k2]}"></i>${t2}</span>`).join("")}<span><i class="linha" style="background:#054166"></i>Devido</span></div>
      ${sel ? painelMes(E, sel) : ""}
    </section>

    <section class="diag-ct">
      <div class="cab-secao"><span class="eyebrow">Conclusões</span><h3>O que os dados mostram no período</h3></div>
      ${E.ach.length ? `<ul class="achados">${E.ach.map(([nv, tit, txt]) => `<li class="${NIVEL[nv][1]}"><span class="st-ct ${NIVEL[nv][1]}">${NIVEL[nv][0]}</span><b>${esc(tit)}.</b> ${esc(txt)}</li>`).join("")}</ul>` : '<p class="muted">Pagamentos conferem com o contrato.</p>'}
      ${alertasCt.length ? `<div class="ct-alertas"><h4>Andamento no Acompanhamento</h4><ul>${alertasCt.map((a) => { const r = S.acomp[a.chave] || {}; return `<li><span class="sit ${a.sit}">${SITUACOES[a.sit] || "Pendente"}</span> ${esc(a.titulo.replace(`Contrato de ${c.forn}: `, ""))}${r.resposta ? `<div class="mini">Resposta: ${esc(r.resposta)}</div>` : ""}</li>`; }).join("")}</ul><p class="mini">Esses pontos estão na aba Acompanhamento, com prazo, responsável e histórico.</p></div>` : ""}
    </section>

    ${blocoAssembleia(c)}
    ${avisoData && pode() ? `<div class="acoes"><button class="btn sec" type="button" data-ct-agenda="${c.id}">Pôr o prazo de aviso na agenda</button></div>` : ""}

    <details class="ct-dados"><summary>Dados completos do contrato</summary>
      <dl class="ficha-dados">
        ${c.numero ? `<div><dt>Contrato</dt><dd>nº ${esc(c.numero)}</dd></div>` : ""}${c.cnpj ? `<div><dt>CNPJ</dt><dd>${esc(c.cnpj)}</dd></div>` : ""}
        ${c.contratado && c.contratado !== c.forn ? `<div><dt>Razão social</dt><dd>${esc(c.contratado)}</dd></div>` : ""}
        ${c.assinatura ? `<div><dt>Assinado em</dt><dd>${dataBR(c.assinatura)}</dd></div>` : ""}
        <div><dt>Valor</dt><dd>${descreverValor(c)}${c.valorLiquido ? ` (líquido ${brl(c.valorLiquido)})` : ""}${c.formaPagamento ? ` · ${esc(c.formaPagamento)}` : ""}</dd></div>
        <div><dt>Vigência</dt><dd>${c.prazoMeses ? `períodos de ${c.prazoMeses} meses` : "—"}${c.renovacaoAuto ? " · renovação automática" : ""}${avisoData ? ` · avisar a não renovação até ${dataBR(avisoData)} (${c.avisoDias} dias antes)` : ""}</dd></div>
        ${(c.adicionais || []).length ? `<div><dt>Valores avulsos previstos</dt><dd>${c.adicionais.map((x) => esc(txtAdic(x))).join(" · ")}</dd></div>` : ""}
        ${c.multaRescisoria ? `<div><dt>Rescisão</dt><dd>${esc(c.multaRescisoria)}</dd></div>` : ""}
        ${(c.info || []).map((x) => `<div><dt>${esc(x.rot)}</dt><dd>${esc(x.txt)}</dd></div>`).join("")}
        <div><dt>Mensalidade nos balancetes</dt><dd>${c.filtro ? `lançamentos com “${esc(c.filtro)}”` : c.itemAuto ? `histórico “${esc(c.itemAuto)}” (identificado pelo valor e pela repetição); os demais pagamentos ao fornecedor são tratados como avulsos` : "todos os pagamentos ao fornecedor"}${grupoForn(c.forn) !== c.forn ? `; inclui as empresas do mesmo grupo (${[...new Set(S.todos.flatMap((b) => b.despesas.map((d) => d.forn)))].filter((f) => grupoForn(f) === grupoForn(c.forn)).join(" e ")})` : ""}</dd></div>
      </dl>
      ${(c.clausulas || []).length ? `<details class="clausulas-ct"><summary>Cláusulas do contrato (${c.clausulas.length})</summary><ol>${c.clausulas.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></details>` : ""}
      ${ehAdmin() ? `<div class="acoes" style="margin-top:8px"><label class="btn sec"><input type="file" data-ct-reler="${c.id}" accept="application/pdf,.pdf,.docx,.txt,image/*" hidden>Atualizar com o PDF do contrato</label><span class="mini" id="ctRelerMsg">Relê o contrato ou a planilha de custos e completa os dados.</span></div>` : ""}
    </details>
    <details class="ct-dados"><summary>Tabela completa por competência</summary>
      <div class="tabela ficha-tab"><table><thead><tr><th>Mês</th><th class="n">Devido</th><th class="n">Mensalidade</th><th class="n">Fora da mensalidade</th><th class="n">Diferença</th><th class="n">Sem explicação</th><th>Situação</th></tr></thead><tbody>
      ${linhas.map((l) => `<tr><td><b>${rotCurto(l.mes)}</b></td><td class="n">${brl(l.dev)}</td><td class="n">${brl(l.pc)}</td><td class="n">${l.pa ? brl(l.pa) : "—"}</td><td class="n ${l.dif > 0.01 ? "neg" : l.dif < -0.01 ? "pos" : ""}">${sinal(l.dif)}</td><td class="n ${l.resto > 0.009 ? "neg" : ""}">${l.resto ? sinal(l.resto) : "—"}</td><td><span class="st-ct ${ST_CT[l.st][1]}">${ST_CT[l.st][0]}</span></td></tr>`).join("")}
      <tr class="total"><td>Total</td><td class="n">${brl(an.totDev)}</td><td class="n">${brl(cp.totP)}</td><td class="n">${brl(cp.totA)}</td><td class="n">${sinal(r2(cp.totP - an.totDev))}</td><td class="n">${cp.semExpl ? brl(cp.semExpl) : "—"}</td><td></td></tr></tbody></table></div>
    </details>
  </div>`;
}
function formContrato(c) {
  const forns = porFornecedor(S.todos).map((f) => f.forn);
  const ad = (c?.adicionais || []).map((x) => x.pctSM ? `${x.pctSM}% SM ${x.desc}` : `${fmtValor(x.valor)} ${x.desc}`).join("; ");
  return `<div class="cab-secao"><span class="eyebrow">${c && c.id ? "Editar" : "Novo"} contrato</span><h2>${c && c.id ? esc(c.forn) : c && c.forn ? "Conferir dados lidos do PDF" : "Cadastrar contrato"}</h2></div>
    ${c && c.origem ? `<p class="small muted">Lido de "${esc(c.origem)}". Confira cada campo antes de salvar.</p>` : ""}
    <div class="form" style="margin-top:12px">
      <label>Fornecedor ou pagador (como aparece nos balancetes)<input id="ctForn" list="listaForn" required value="${esc(c?.forn || "")}"></label>
      <label>Nº do contrato<input id="ctNum" value="${esc(c?.numero || "")}"></label>
      <label>CNPJ<input id="ctCnpj" value="${esc(c?.cnpj || "")}"></label>
      <label>Objeto<input id="ctObj" value="${esc(c?.objeto || "")}" placeholder="ex.: portaria 24h"></label>
      <label>Tipo<input id="ctTipo" list="listaTiposCt" value="${esc(c?.tipo || "")}" placeholder="ex.: Limpeza e conservação"></label>
      <label>Modalidade de pagamento<select id="ctModal">${[["mensal", "Mensal"], ["parcelado", "Parcelado"], ["global", "Valor global (por medição/avulso)"], ["anual", "Anual"]].map(([k, t2]) => `<option value="${k}" ${(c?.modalidade || "mensal") === k ? "selected" : ""}>${t2}</option>`).join("")}</select></label>
      <label>Natureza<select id="ctNat"><option value="despesa" ${ehReceita(c) ? "" : "selected"}>Despesa (o condomínio paga)</option><option value="receita" ${ehReceita(c) ? "selected" : ""}>Receita (o condomínio recebe: cessão de espaço, aluguel)</option></select></label>
      <label>Valor mensal ou da parcela (R$)<input id="ctValor" inputmode="decimal" value="${fmtValor(c?.valor || 0)}" placeholder="deixe 0 se o contrato não fixa valor em reais"></label>
      <label>Regra do valor (quando não é fixo)<input id="ctRegra" value="${esc(c?.valorRegra || "")}" placeholder="ex.: 2 taxas condominiais por mês"></label>
      <label>Valor total (R$)<input id="ctTotal" inputmode="decimal" value="${fmtValor(c?.valorTotal || 0)}" placeholder="para global, anual ou parcelado"></label>
      <label>Nº de parcelas<input id="ctParc" inputmode="numeric" value="${c?.parcelas || ""}"></label>
      <label>Forma de pagamento<input id="ctFormaPg" value="${esc(c?.formaPagamento || "")}" placeholder="ex.: boleto"></label>
      <label>Vencimento (dia do mês)<input id="ctDia" inputmode="numeric" value="${c?.diaVenc || ""}"></label>
      <label>Início<input id="ctIni" type="date" value="${c?.inicio && c.inicio.length === 10 ? c.inicio : c?.inicio ? c.inicio + "-01" : ""}"></label>
      <label>Prazo (meses)<input id="ctPrazo" inputmode="numeric" value="${c?.prazoMeses || ""}" placeholder="ex.: 12"></label>
      <label class="check"><input type="checkbox" id="ctRenova" ${c?.renovacaoAuto ? "checked" : ""}> Renova automaticamente</label>
      <label class="check"><input type="checkbox" id="ctIndet" ${c?.indeterminado ? "checked" : ""}> Prazo indeterminado</label>
      <label>Fim (se não houver prazo)<input id="ctFim" type="date" value="${c?.fim || ""}"></label>
      <label>Aviso prévio para não renovar (dias)<input id="ctAviso" inputmode="numeric" value="${c?.avisoDias || ""}"></label>
      <label>Reajuste<input id="ctReaj" value="${esc(c?.reajuste || "")}" placeholder="ex.: IPCA em janeiro"></label>
      <label>Multa por atraso<input id="ctMulta" value="${esc(c?.multa || "")}" placeholder="ex.: 2%"></label>
      <label>Multa por rescisão<input id="ctMultaR" value="${esc(c?.multaRescisoria || "")}" placeholder="ex.: 1 mensalidade"></label>
      <label>Valores avulsos previstos<input id="ctAdic" value="${esc(ad)}" placeholder="ex.: 50,00 por certidão; 40% SM acompanhamento em assembleia"></label>
      <label>Tolerância (%)<input id="ctTol" inputmode="decimal" value="${String(c?.tol ?? 2).replace(".", ",")}"></label>
      <label>Também é contratada por (outra empresa)<input id="ctTrab" value="${esc(c?.trabalhaPara || "")}" placeholder="ex.: Cerus Bank"></label>
      <label>Observação sobre essa relação<input id="ctTrabObs" value="${esc(c?.trabalhaParaObs || "")}" placeholder="ex.: informado pelo conselho"></label>
      <label>Contar só lançamentos com o texto<input id="ctFiltro" value="${esc(c?.filtro || "")}" placeholder="ex.: ASSESSORIA (opcional)"></label>
      <label>Link do contrato<input id="ctLink" type="url" value="${esc(c?.link || "")}" placeholder="https:// (Google Drive, opcional)"></label>
    </div>
    <datalist id="listaTiposCt">${["Portaria e segurança", "Limpeza e conservação", "Manutenção de elevadores", "Manutenção predial", "Seguro", "Internet e telefonia", "Obra e reforma", "Assessoria jurídica", "Administração condominial", "Mão de obra terceirizada", "Locação"].map((x) => `<option value="${x}">`).join("")}</datalist>
    ${(c?.info || []).length ? `<p class="mini" style="margin-top:8px">Também serão guardadas ${c.info.length} informação(ões) lidas do contrato (${esc(c.info.map((x) => x.rot).join(", "))}), exibidas na ficha.</p>` : ""}
    <datalist id="listaForn">${forns.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
    <div class="acoes" style="margin-top:10px"><button class="btn" type="submit">${c && c.id ? "Salvar alterações" : "Cadastrar contrato"}</button>${c ? `<button class="btn sec" type="button" id="ctCancelar">Cancelar</button>` : ""}<span class="small muted" id="ctMsg"></span></div>`;
}
// importação: lê o PDF, extrai os campos e mostra para revisão antes de preencher o formulário
async function importarContrato(f) {
  const pr = $("#ctProgresso"), rv = $("#ctRevisao"); pr.hidden = false; rv.innerHTML = "";
  const msg = (t) => { pr.textContent = t; };
  try {
    const { texto, ocr, paginas } = await textoDoArquivo(carregarPdfjs, f, msg);
    const r = lerContrato(texto, porFornecedor(S.todos).map((x) => x.forn)), C = r.campos;
    if (!C.contratado && !C.valor && !C.objeto) { msg(`Não consegui identificar os dados em "${f.name}" (${paginas} página(s)${ocr ? ", lida por reconhecimento de texto" : ""}). Preencha o formulário manualmente.`); return; }
    msg(`"${f.name}" lido (${paginas} página(s)${ocr ? ", por reconhecimento de texto: confira com atenção" : ""}).`);
    const fv = C.inicio && C.prazoMeses ? fimVigente(C.inicio, C.prazoMeses, C.renovacaoAuto, hojeISO()) : null;
    S.ctLido = { ...C, forn: C.natureza === "receita" ? C.marca || nomeFornecedor(C.contratado || "") : C.forn || C.contratado || "", tol: 2, origem: f.name, fim: C.fim || "", filtro: "", lidoEm: new Date().toISOString() };
    // sugere o filtro quando o fornecedor também recebe reembolsos (palavra principal do histórico das mensalidades)
    if (S.ctLido.forn && C.valor) {
      const ls2 = S.todos.flatMap((b) => b.despesas.filter((d) => d.forn === S.ctLido.forn));
      const perto = ls2.filter((d) => Math.abs(d.v - C.valor) <= C.valor * 0.05), outros = ls2.filter((d) => !perto.includes(d));
      const pal = perto[0] ? (perto[0].item || perto[0].desc.split(" - ")[0]).split(/\s+/)[0] : "";
      if (pal && outros.some((d) => !normTxt(d.desc).includes(normTxt(pal)))) S.ctLido.filtro = pal;
    }
    const linha = (rot, v, tr) => `<tr><th>${rot}</th><td>${v || '<span class="muted">não encontrado</span>'}</td><td class="mini">${tr ? `“…${esc(tr)}…”` : ""}</td></tr>`;
    rv.innerHTML = `<div class="tabela" style="margin-top:12px"><table class="revisao-ct"><tbody>
      ${linha("Contratado", esc(C.contratado || ""), r.trechos.contratado)}
      ${C.natureza === "receita" ? linha("Natureza", "<b>Receita</b>: o condomínio recebe deste contrato") : linha("Fornecedor nos balancetes", C.forn ? `<b>${esc(C.forn)}</b>` : '<span class="neg">nenhum fornecedor parecido nos balancetes</span>')}
      ${linha("Nº do contrato", esc(C.numero || ""), r.trechos.numero)}${linha("CNPJ", esc(C.cnpj || ""))}
      ${linha("Objeto", esc(C.objeto || ""), r.trechos.objeto)}
      ${linha("Tipo de contrato", esc(C.tipo || ""))}
      ${linha("Valor", descreverValor(C), r.trechos.valor)}
      ${linha("Forma de pagamento", esc(C.formaPagamento || ""))}
      ${linha("Início", C.inicio ? dataBR(C.inicio) : "", r.trechos.inicio)}
      ${linha("Prazo", C.indeterminado ? "prazo indeterminado" : C.prazoMeses ? `${C.prazoMeses} meses${C.renovacaoAuto ? ", renovação automática" : ""}${fv ? ` · período atual até ${dataBR(fv.fim)}${fv.renovacoes ? ` (${fv.renovacoes} renovação(ões))` : ""}` : ""}` : C.prazoDias ? `${C.prazoDias} dias` : "", r.trechos.prazo)}
      ${linha("Fim", C.fim ? dataBR(C.fim) : "", r.trechos.fim)}
      ${linha("Assinatura", C.assinatura ? dataBR(C.assinatura) : "")}
      ${linha("Aviso prévio", C.avisoDias ? `${C.avisoDias} dias` : "", r.trechos.aviso)}
      ${linha("Vencimento", C.diaVenc ? `dia ${C.diaVenc}` : "")}
      ${linha("Reajuste", esc(C.reajuste || ""), r.trechos.reajuste)}
      ${linha("Valores avulsos", (C.adicionais || []).map((x) => esc(txtAdic(x))).join(" · "))}
      ${linha("Multa por atraso", esc(C.multa || ""))}
      ${linha("Rescisão", esc(C.multaRescisoria || ""))}
      ${(C.info || []).map((x) => linha(esc(x.rot), esc(x.txt), r.trechos[x.rot])).join("")}
      ${linha("Cláusulas encontradas", (C.clausulas || []).length ? `${C.clausulas.length}: ${esc(C.clausulas.slice(0, 12).join(" · "))}${C.clausulas.length > 12 ? "…" : ""}` : "")}
      ${linha("Filtro sugerido", S.ctLido.filtro ? `lançamentos com "${esc(S.ctLido.filtro)}" (o fornecedor também recebe outros pagamentos)` : "")}
    </tbody></table></div>
    <div class="acoes" style="margin-top:10px"><button class="btn" type="button" id="ctUsarLido">Preencher o cadastro com estes dados</button></div>`;
    registrar("Importou contrato", f.name);
  } catch (e) { msg(`Não foi possível ler "${f.name}": ${e.message}`); }
}
const SAL_MIN = { 2023: 1320, 2024: 1412, 2025: 1518, 2026: 1621 };
const salMin = (ano) => SAL_MIN[ano] || SAL_MIN[Math.max(...Object.keys(SAL_MIN).map(Number).filter((a) => a <= ano))] || SAL_MIN[2026];
const txtAdic = (x) => x.pctSM ? `${x.pctSM}% do salário mínimo ${x.desc.startsWith("por ") ? x.desc : "por " + x.desc}` : `${brl(x.valor)} ${x.desc}`;
function descreverValor(c) {
  if (c && !c.valor && c.valorRegra) return c.valorRegra + (ehReceita(c) ? " (a receber)" : "");
  if (!c || (!c.valor && !c.valorTotal)) return "";
  if (ehReceita(c)) return `${brl(c.valor)} por mês (a receber)`;
  if (c.modalidade === "parcelado") return `${c.valorTotal ? brl(c.valorTotal) + " em " : ""}${c.parcelas || "?"} parcela(s) de ${brl(c.valor)}`;
  if (c.modalidade === "global") return `${brl(c.valorTotal || c.valor)} (valor global)`;
  if (c.modalidade === "anual") return `${brl(c.valorTotal || c.valor * 12)} por ano (${brl(c.valor)}/mês)`;
  return `${brl(c.valor)} por mês`;
}
function lerFormContrato() {
  const adic = $("#ctAdic").value.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const sm = /^(\d{1,3})\s*%\s*(?:SM|do sal[aá]rio m[ií]nimo)\s*(?:por\s+)?(.*)$/i.exec(x); if (sm) return { valor: 0, pctSM: +sm[1], desc: sm[2] }; const m = /^([\d.,]+)\s*(.*)$/.exec(x); return m ? { valor: parseValor(m[1]), desc: m[2] } : { valor: 0, desc: x }; });
  return { forn: $("#ctForn").value.trim(), numero: $("#ctNum").value.trim(), cnpj: $("#ctCnpj").value.trim(), objeto: $("#ctObj").value.trim(), valor: parseValor($("#ctValor").value),
    tipo: $("#ctTipo").value.trim(), modalidade: $("#ctModal").value, valorTotal: parseValor($("#ctTotal").value) || null, parcelas: +$("#ctParc").value || null, formaPagamento: $("#ctFormaPg").value.trim(), multaRescisoria: $("#ctMultaR").value.trim(), indeterminado: $("#ctIndet").checked,
    diaVenc: +$("#ctDia").value || null, inicio: $("#ctIni").value, prazoMeses: +$("#ctPrazo").value || null, renovacaoAuto: $("#ctRenova").checked, fim: $("#ctFim").value,
    avisoDias: +$("#ctAviso").value || null, reajuste: $("#ctReaj").value.trim(), multa: $("#ctMulta").value.trim(), adicionais: adic, tol: parseValor($("#ctTol").value) || 2,
    natureza: $("#ctNat").value, valorRegra: $("#ctRegra").value.trim(), trabalhaPara: $("#ctTrab").value.trim(), trabalhaParaObs: $("#ctTrabObs").value.trim(), filtro: $("#ctFiltro").value.trim(), link: urlValida($("#ctLink").value.trim()) ? $("#ctLink").value.trim() : "" };
}

// ---------------------------------------------------------------- proposta de orçamento
function orcExtras() { const el = $("#secOrcExtra"); if (el) el.innerHTML = propostaHTML() + fundoHTML(); }
function propostaHTML() {
  const base = S.todos.slice(-12); if (!base.length) return "";
  const ano = +(S.todos.at(-1).mes.slice(0, 4)) + 1, r = S.propReaj ?? 5, inv = S.propInv ?? false;
  const INV = /obras|imobilizado/i;
  const cats = porCategoria(base).map((c) => ({ cat: c.cat, media: c.total / base.length })).filter((c) => inv || !INV.test(c.cat));
  const linhas = cats.map((c) => ({ ...c, prop: r2(c.media * (1 + r / 100)) }));
  const tot = linhas.reduce((s2, l) => s2 + l.prop, 0), recMed = base.reduce((s2, b) => s2 + b.totais.receitas, 0) / base.length;
  S.proposta = { ano, r, linhas, tot, recMed };
  return `<div class="card" id="cardProposta"><div class="cab"><div class="cab-secao"><span class="eyebrow">Planejamento</span><h2>Proposta de orçamento ${ano}</h2></div></div>
    <p class="small muted" style="margin:6px 0 12px">Base: média mensal real dos últimos ${base.length} meses (${rotuloMes(base[0].mes)} a ${rotuloMes(base.at(-1).mes)}) mais o reajuste escolhido. Os valores podem ser ajustados depois de salvar.</p>
    <div class="oficio-ctl"><label class="small">Reajuste geral (%) <input id="propReaj" inputmode="decimal" value="${String(r).replace(".", ",")}" style="width:70px"></label>
      <label class="small"><input type="checkbox" id="propInv" ${inv ? "checked" : ""}> Incluir obras e imobilizado</label>
      <button class="btn sec" type="button" id="propDoc">Gerar documento</button>${ehAdmin() ? `<button class="btn" type="button" id="propSalvar">Salvar como previsão ${ano}</button>` : ""}</div>
    <div class="tabela"><table><thead><tr><th>Categoria</th><th class="n">Média real/mês</th><th class="n">Proposta/mês</th><th class="n">Proposta/ano</th></tr></thead><tbody>
      ${linhas.map((l) => `<tr><td>${esc(l.cat)}</td><td class="n">${brl(l.media)}</td><td class="n"><b>${brl(l.prop)}</b></td><td class="n">${brl(l.prop * 12)}</td></tr>`).join("")}
      <tr class="total"><td>Total de despesas</td><td class="n">${brl(linhas.reduce((s2, l) => s2 + l.media, 0))}</td><td class="n">${brl(tot)}</td><td class="n">${brl(tot * 12)}</td></tr>
      <tr><td>Receita média atual</td><td class="n">${brl(recMed)}</td><td class="n" colspan="2">${tot > recMed ? `<b class="neg">faltariam ${brl(tot - recMed)}/mês (${pct(tot / recMed - 1)} de aumento na arrecadação)</b>` : `sobram ${brl(recMed - tot)}/mês`}</td></tr>
    </tbody></table></div></div>`;
}
function docProposta() {
  const p = S.proposta, b = S.todos.at(-1), cond = b.condominio || "Condomínio";
  $("#folha").innerHTML = `${cabDoc(cond)}<h1>PROPOSTA DE PREVISÃO ORÇAMENTÁRIA ${p.ano}</h1>
  <p class="doc-ref">Elaborada pelo Conselho Fiscal com base nos demonstrativos de ${rotuloMes(S.todos.slice(-12)[0].mes)} a ${rotuloMes(b.mes)}.</p>
  <h2>1. Critério</h2><p>Para cada categoria foi calculada a média mensal efetivamente gasta nos últimos 12 meses, acrescida de reajuste de ${String(p.r).replace(".", ",")}%.</p>
  <h2>2. Valores propostos</h2>
  <table class="doc-tab"><thead><tr><th>Categoria</th><th class="n">Média real/mês</th><th class="n">Proposta/mês</th><th class="n">Proposta/ano</th></tr></thead><tbody>
  ${p.linhas.map((l) => `<tr><td>${esc(l.cat)}</td><td class="n">${brl(l.media)}</td><td class="n">${brl(l.prop)}</td><td class="n">${brl(l.prop * 12)}</td></tr>`).join("")}
  <tr class="sub"><td>Total</td><td class="n">${brl(p.linhas.reduce((s2, l) => s2 + l.media, 0))}</td><td class="n">${brl(p.tot)}</td><td class="n">${brl(p.tot * 12)}</td></tr></tbody></table>
  <h2>3. Equilíbrio</h2><p>A receita média mensal dos últimos 12 meses foi de ${brl(p.recMed)}. ${p.tot > p.recMed ? `Para cobrir a proposta, a arrecadação mensal precisaria aumentar ${brl(p.tot - p.recMed)} (${pct(p.tot / p.recMed - 1)}).` : `A proposta cabe na arrecadação atual, com sobra de ${brl(p.recMed - p.tot)} por mês.`} Recomenda-se ainda prever a constituição de fundo de reserva.</p>
  <p class="doc-data">Salvador, ${dataExtenso(hojeISO())}.</p>
  <div class="assinaturas"><div><span></span>Conselheiro(a) Fiscal</div><div><span></span>Conselheiro(a) Fiscal</div><div><span></span>Conselheiro(a) Fiscal</div></div>`;
  abrirDoc(`Proposta de orçamento ${p.ano}`, `Proposta-Orcamento-${p.ano}.doc`);
}

// ---------------------------------------------------------------- fundo de reserva
const RX_FUNDO = /fundo\s+de\s+reserva|f\.\s?reserva|fdo\.?\s+reserva/i;
function fundoHTML() {
  const f = S.fundo || {}, adm = ehAdmin();
  const ms = S.todos.filter((b) => !f.inicio || b.mes >= f.inicio), perc = f.perc || 0;
  const lin = ms.map((b) => {
    const dev = r2(b.totais.receitas * perc / 100);
    const ident = r2(b.receitas.filter((x) => RX_FUNDO.test(x.desc)).reduce((s2, x) => s2 + x.v, 0) + b.despesas.filter((d) => RX_FUNDO.test(d.desc)).reduce((s2, d) => s2 + d.v, 0));
    return { mes: b.mes, rec: b.totais.receitas, dev, ident };
  });
  const totDev = lin.reduce((s2, l) => s2 + l.dev, 0), totId = lin.reduce((s2, l) => s2 + l.ident, 0);
  return `<div class="card" id="cardFundo"><div class="cab-secao"><span class="eyebrow">Reserva</span><h2>Fundo de reserva</h2></div>
    ${adm ? `<form class="form" id="fFundo" style="margin-top:12px">
      <label>Percentual sobre a receita (%)<input id="fdPerc" inputmode="decimal" value="${perc ? String(perc).replace(".", ",") : ""}" placeholder="conforme a convenção"></label>
      <label>Contar a partir de<input id="fdIni" type="month" value="${f.inicio || S.todos[0]?.mes || ""}"></label>
      <label>Saldo informado pela administradora (R$)<input id="fdSaldo" inputmode="decimal" value="${fmtValor(f.saldo || 0)}"></label>
      <label>Data do saldo informado<input id="fdData" type="date" value="${f.dataSaldo || ""}"></label>
      <div class="acoes" style="align-self:end"><button class="btn" type="submit">Salvar</button><span class="small muted" id="fdMsg"></span></div></form>` : ""}
    ${!perc ? `<p class="muted" style="margin-top:12px">${adm ? "Informe o percentual previsto na convenção do condomínio para calcular quanto deveria ter sido reservado." : "O administrador ainda não informou o percentual do fundo de reserva previsto na convenção."}</p>` : `
    <div class="kpis-sec" style="margin-top:14px">
      <div class="kpi"><span class="eyebrow">Deveria ter sido reservado</span><b>${brl(totDev)}</b><span class="det">${String(perc).replace(".", ",")}% de ${brl(lin.reduce((s2, l) => s2 + l.rec, 0))} em ${lin.length} mês(es)</span></div>
      <div class="kpi ${totId < totDev ? "neg" : "pos"}"><span class="eyebrow">Identificado nos balancetes</span><b>${brl(totId)}</b><span class="det">lançamentos com "fundo de reserva"</span></div>
      <div class="kpi ${(f.saldo || 0) < totDev ? "neg" : "pos"}"><span class="eyebrow">Saldo informado</span><b>${f.saldo ? brl(f.saldo) : "—"}</b><span class="det">${f.dataSaldo ? `em ${dataBR(f.dataSaldo)}` : "não informado"}</span></div>
    </div>
    <p class="small" style="margin-top:10px">${totId < totDev ? `<b class="neg">Faltam ${brl(totDev - totId)}</b> em relação ao que a convenção prevê, considerando só o que aparece nos demonstrativos. Vale pedir à administradora o extrato da conta do fundo.` : "O valor identificado cobre o previsto."}</p>`}
  </div>`;
}

// ---------------------------------------------------------------- cópia de segurança em Excel (.xlsx sem bibliotecas)
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipar(arquivos) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  for (const [nome, txt] of arquivos) {
    const n = enc.encode(nome), d = enc.encode(txt), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true);
    partes.push(new Uint8Array(h.buffer), n, d);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), n); off += 30 + n.length + d.length;
  }
  const tamC = central.reduce((s2, x) => s2 + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, arquivos.length, true); e.setUint16(10, arquivos.length, true); e.setUint32(12, tamC, true); e.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(e.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function xlsx(planilhas) {
  const x = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const col = (i) => { let s2 = ""; i++; while (i) { const m = (i - 1) % 26; s2 = String.fromCharCode(65 + m) + s2; i = Math.floor((i - 1) / 26); } return s2; };
  const folha = (linhas) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => { const ref = col(c) + (r + 1); return typeof v === "number" && isFinite(v) ? `<c r="${ref}"${r ? ' s="1"' : ""}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${r ? "" : ' s="2"'}><is><t xml:space="preserve">${x(v)}</t></is></c>`; }).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const nomes = planilhas.map((p) => p[0].replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  const arqs = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${nomes.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${x(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${nomes.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...planilhas.map((p, i) => [`xl/worksheets/sheet${i + 1}.xml`, folha(p[1])]),
  ];
  return zipar(arqs);
}
function baixarBackup() {
  const T = S.todos;
  const anot = Object.entries(S.acomp).filter(([k, e]) => !k.startsWith("chk:") && !k.startsWith("ag:") && !e.migradoPara && (e.resposta || e.status));
  const pl = [
    ["Resumo mensal", [["Mês", "Receitas", "Despesas", "Resultado", "Saldo anterior", "Saldo final", "Emitido em"], ...T.map((b) => [rotuloMes(b.mes), b.totais.receitas, b.totais.despesas, r2(b.totais.receitas - b.totais.despesas), b.totais.saldoAnterior ?? 0, b.totais.saldoAtual, b.emissao || ""])]],
    ["Receitas", [["Mês", "Descrição", "Valor"], ...T.flatMap((b) => b.receitas.map((r) => [rotuloMes(b.mes), r.desc, r.v]))]],
    ["Despesas", [["Mês", "Categoria", "Fornecedor", "Histórico", "Mês ref.", "Baixa", "Tipo", "NF", "Valor"], ...T.flatMap((b) => b.despesas.map((d) => [rotuloMes(b.mes), d.cat, d.forn, d.desc, d.ref, d.baixa, d.tipo, d.nf, d.v]))]],
    ["Anotações", [["Alerta", "Situação", "Aguardando resposta de", "Enviado em", "Prazo", "Resposta/anotação", "Links", "Última alteração", "Por"], ...anot.map(([k, e]) => [e.snap?.titulo || k, SITUACOES[e.status || "pendente"], e.responsavel || "", dataBR(e.enviado), dataBR(e.prazo), e.resposta || "", (e.links || []).map((l) => l.url).join(" "), e.ts ? horaBR(e.ts) : e.data || "", e.por || ""])]],
    ["Conferência mensal", [["Mês", "Extrato", "Notas fiscais", "Notas explicativas", "Aprovado"], ...T.map((b) => { const c = S.acomp[`chk:${b.mes}`] || {}; return [rotuloMes(b.mes), c.extrato || "", c.nf || "", c.notas || "", c.aprovado || ""]; })]],
    ["Previsões", [["Previsão", "De", "Até", "Categoria", "Valor mensal"], ...(S.orc || []).flatMap((p) => Object.entries(p.cats).map(([c, v]) => [p.nome, rotuloMes(p.de), rotuloMes(p.ate), c, v]))]],
    ["Contratos", [["Fornecedor", "Objeto", "Valor mensal", "Início", "Fim", "Reajuste"], ...(S.contratos || []).map((c) => [c.forn, c.objeto || "", c.valor, c.inicio ? rotuloMes(c.inicio) : "", dataBR(c.fim), c.reajuste || ""])]],
    ["Agenda", [["Data", "Hora", "Tipo", "Título", "Local", "Observação"], ...itensAgenda().map((a) => [dataBR(a.data), a.hora || "", TIPOS_AG[a.tipo] || "", a.titulo, a.local || "", a.obs || ""])]],
  ];
  const blob = xlsx(pl), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `Conselho-Fiscal-Farol-copia-${hojeISO()}.xlsx`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  registrar("Baixou cópia em Excel");
}

// ---------------------------------------------------------------- registro de acessos (administração)
async function listarRegistros() {
  const el = $("#tabRegistros"); if (!el || !AC.ligado || !ehAdmin()) return;
  el.innerHTML = `<tbody><tr><td class="muted">Carregando…</td></tr></tbody>`;
  try {
    const regs = await lerRegistros(400); S.registros = regs;
    const pessoas = [...new Set(regs.map((r) => r.nome || r.usuario))].sort();
    const f = $("#regPessoa"); const v = f.value; f.innerHTML = `<option value="">Todas as pessoas</option>${pessoas.map((p) => `<option ${p === v ? "selected" : ""}>${esc(p)}</option>`).join("")}`;
    pintarRegistros();
  } catch (e) { el.innerHTML = `<tbody><tr><td>${/permission|insufficient/.test(e.code || "") ? "Para ver o registro, atualize as regras do Firestore: clique em <b>Copiar regras</b> logo acima, cole na aba Regras do Firestore e publique." : esc(mensagemErro(e))}</td></tr></tbody>`; }
}
function pintarRegistros() {
  const p = $("#regPessoa").value, regs = (S.registros || []).filter((r) => !p || (r.nome || r.usuario) === p);
  const dt = (t) => { try { return t && t.toDate ? t.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; } catch { return "—"; } };
  $("#tabRegistros").innerHTML = regs.length ? `<thead><tr><th>Data e hora</th><th>Pessoa</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${regs.map((r) => `<tr><td class="num">${dt(r.ts)}</td><td>${esc(r.nome || r.usuario)}</td><td>${esc(r.acao)}</td><td class="mini">${esc(r.detalhe || "")}</td></tr>`).join("")}</tbody>` : `<tbody><tr><td class="muted">Nenhum registro ainda.</td></tr></tbody>`;
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
      registrarAcesso(); registrar("Entrou no site");
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
    await trocarSenha(nova); S.senhaLogin = ""; registrar("Criou a própria senha (1º acesso)");
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
  if (e.target.closest("[data-sair]")) { await registrar("Saiu do site"); S.msgSaida = ""; ls.del(LS_ACOMP); ls.del(LS_MESES); await sair(); return; }
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
  try { await salvarOrc(); registrar("Salvou previsão orçamentária", prev.nome); S.orcEditando = undefined; S.orcSel = id; render(); toast("Previsão orçamentária salva."); }
  catch (err) { S.orc = antes; $("#orcMsg").textContent = mensagemErro(err); }
});
$("#bannerNovoVer").addEventListener("click", () => { marcarVisto(); location.hash = "#resumo"; });
$("#bannerNovoFechar").addEventListener("click", marcarVisto);
$("#btnGerarAta").addEventListener("click", gerarAta);
document.addEventListener("input", (e) => { if (e.target.id === "ctBusca") { S.ctBusca = e.target.value; clearTimeout(S.tBusca); S.tBusca = setTimeout(() => { contratosTab(); const i = $("#ctBusca"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } });
document.addEventListener("change", (e) => {
  if (e.target.id === "ctArquivo" && e.target.files.length) { importarContrato(e.target.files[0]); e.target.value = ""; }
  if (e.target.id === "ctSoDif") { S.ctSoDif = e.target.checked; contratosTab(); $("#ctFicha .ct-tab-ctl")?.scrollIntoView({ block: "center" }); }
  if (e.target.dataset && e.target.dataset.ctReler && e.target.files.length) { relerContrato(e.target.dataset.ctReler, e.target.files[0]); e.target.value = ""; }
});
// relê o PDF de um contrato já cadastrado e completa o que faltava, sem mexer em valor, datas e fornecedor
async function relerContrato(id, f) {
  const c = S.contratos.find((x) => x.id === id), msg = (t) => { const el = $("#ctRelerMsg"); if (el) el.textContent = t; };
  if (!c || !ehAdmin()) return;
  try {
    const { texto } = await textoDoArquivo(carregarPdfjs, f, msg);
    const C = lerContrato(texto, porFornecedor(S.todos).map((x) => x.forn)).campos, mud = [];
    const novo = { ...c };
    if ((C.info || []).length) { novo.info = [...(C.info || []), ...(c.info || []).filter((x) => !(C.info || []).some((y) => y.rot === x.rot))]; mud.push("informações"); }
    if ((C.adicionais || []).length) { novo.adicionais = C.adicionais; mud.push("avulsos previstos"); }
    if ((C.clausulas || []).length) { novo.clausulas = C.clausulas; mud.push("cláusulas"); }
    for (const k of ["natureza", "valorRegra", "securitizacao", "marca", "multa", "reajuste", "multaRescisoria", "numero", "cnpj", "contratado", "assinatura", "objeto", "tipo", "formaPagamento", "diaVenc", "avisoDias"]) if (!c[k] && C[k]) { novo[k] = C[k]; mud.push(k); }
    if (C.valor && c.valor && Math.abs(C.valor - c.valor) > 0.01) mud.push(`atenção: o PDF diz ${brl(C.valor)}, o cadastro tem ${brl(c.valor)} (não alterado)`);
    novo.origem = f.name; novo.ts = new Date().toISOString(); novo.por = nomeUsuario();
    const antes = S.contratos; S.contratos = S.contratos.map((x) => (x.id === id ? novo : x));
    try { await salvarConteudo("contratos"); registrar("Atualizou contrato pelo PDF", `${c.forn}: ${mud.join(", ")}`); render(); toast(mud.length ? `Contrato atualizado: ${mud.join(", ")}.` : "Nada novo no PDF."); }
    catch (err) { S.contratos = antes; msg(mensagemErro(err)); }
  } catch (err) { msg(`Não consegui ler o arquivo: ${err.message || err}`); }
}
for (const id of ["#btnBackup", "#btnBackup2"]) $(id)?.addEventListener("click", baixarBackup);
$("#regPessoa").addEventListener("change", pintarRegistros);
$("#regAtualizar").addEventListener("click", listarRegistros);
$("#copiarRegras2").addEventListener("click", () => navigator.clipboard.writeText(REGRAS).then(() => toast("Regras copiadas."), () => toast("Selecione o texto das regras e copie com Ctrl+C.")));
document.addEventListener("input", (e) => {
  if (e.target.id === "propReaj") { const v = parseValor(e.target.value); if (v >= 0 && v <= 100) { S.propReaj = v; clearTimeout(S.tProp); S.tProp = setTimeout(() => { orcExtras(); const i = $("#propReaj"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 500); } }
});
document.addEventListener("change", (e) => { if (e.target.id === "propInv") { S.propInv = e.target.checked; orcExtras(); } });
document.addEventListener("click", async (e) => {
  const t = e.target;
  // links de documentos
  const la = t.closest("[data-link-add]");
  if (la) {
    if (!pode()) return;
    const ch = la.dataset.linkAdd, url = (document.querySelector(`[data-link-url="${ch}"]`).value || "").trim(), nome = (document.querySelector(`[data-link-nome="${ch}"]`).value || "").trim();
    if (!urlValida(url)) return toast("Cole um link completo, começando com https://");
    const e2 = S.acomp[ch] || {};
    salvarAcomp(ch, { links: [...(e2.links || []), { url, nome, por: nomeUsuario(), ts: new Date().toISOString() }] }, `anexou o link ${nome || url}`);
    const y = scrollY; render(); scrollTo(0, y); return;
  }
  const ld = t.closest("[data-link-del]");
  if (ld) {
    if (!pode()) return;
    const ch = ld.dataset.linkDel, e2 = S.acomp[ch] || {}, l = (e2.links || [])[+ld.dataset.i];
    salvarAcomp(ch, { links: (e2.links || []).filter((_, i) => i !== +ld.dataset.i) }, `removeu o link ${l ? l.nome || l.url : ""}`);
    const y = scrollY; render(); scrollTo(0, y); return;
  }
  // agenda
  const ad = t.closest("[data-ag-del]");
  if (ad && pode()) {
    const k = ad.dataset.agDel; S.acomp[k] = { ...S.acomp[k], removido: true, ts: new Date().toISOString(), por: nomeUsuario() };
    ls.set(LS_ACOMP, S.acomp); agendarSync(); registrar("Removeu compromisso", S.acomp[k].titulo); render(); return;
  }
  // contratos
  const ce = t.closest("[data-ct-edit]"); if (ce) { S.ctEditando = ce.dataset.ctEdit; S.ctRascunho = null; contratosTab(); $("#fContrato").scrollIntoView({ block: "center" }); return; }
  if (t.closest("#pacoteAplicar")) { aplicarPacote(); return; }
  if (t.closest("#pacoteLer")) {
    const v = ($("#pacoteCodigo").value || "").trim(), cod = v.includes("#atualizar=") ? v.split("#atualizar=")[1] : v;
    if (!cod) { $("#pacoteMsg").textContent = "Cole o link ou o código."; return; }
    S.pacoteCod = cod.replace(/\s+/g, ""); S.pacoteMostrado = false; try { sessionStorage.setItem("farol.pacote", S.pacoteCod); } catch {}
    mostrarPacote().then(() => { $("#pacoteMsg").textContent = S.pacote ? "Atualização lida: confira o aviso no topo da página e clique em Aplicar." : "Não consegui ler o código."; window.scrollTo(0, 0); });
    return;
  }
  if (t.closest("#pacoteCancelar")) { try { sessionStorage.removeItem("farol.pacote"); } catch {} S.pacoteCod = ""; $("#bannerPacote").hidden = true; return; }
  const cmo = t.closest("[data-ct-modo]"); if (cmo) { S.ctModoComp = cmo.dataset.ctModo; contratosTab(); $("#ctFicha .conc")?.scrollIntoView({ block: "start" }); return; }
  const cms = t.closest("[data-ct-mes]"); if (cms && cms.dataset.ctMes) { S.ctMesSel = cms.dataset.ctMes; const y0 = window.scrollY; contratosTab(); window.scrollTo(0, y0); $("#ctFicha .tri.sel")?.focus({ preventScroll: true }); return; }
  const cmsal = t.closest("[data-ctm-salvar]");
  if (cmsal && pode()) {
    const k = cmsal.dataset.ctmSalvar, txt = $("#ctmTxt").value.trim(), st = $("#ctmSt").value, ant = S.acomp[k] || {};
    const hist = [...(ant.hist || []), { ts: new Date().toISOString(), txt: `${st ? `Situação: ${st}` : "Sem andamento"}${txt !== (ant.resposta || "") ? " · resposta editada" : ""}`, por: nomeUsuario() }];
    S.acomp[k] = { ...ant, resposta: txt, status: st || (txt ? "respondido" : ""), respondidoEm: txt && !ant.respondidoEm ? hojeISO() : ant.respondidoEm || "", por: nomeUsuario(), ts: new Date().toISOString(), hist };
    ls.set(LS_ACOMP, S.acomp); agendarSync();
    const [, idc, mes] = k.split(":"), ct = (S.contratos || []).find((x) => x.id === idc);
    registrar("Registrou resposta de contrato", `${ct ? ct.forn : idc} · ${rotuloMes(mes)} · ${st || "sem andamento"}`);
    const y0 = window.scrollY; render(); window.scrollTo(0, y0); toast("Resposta salva e sincronizada."); return;
  }
  const cfl = t.closest("[data-ct-filtro]"); if (cfl) { S.ctFiltro = cfl.dataset.ctFiltro; contratosTab(); return; }
  if (t.closest("#ctCancelar")) { S.ctEditando = ""; S.ctRascunho = null; contratosTab(); return; }
  const cf = t.closest("[data-ct-ficha]"); if (cf) { S.ctFicha = S.ctFicha === cf.dataset.ctFicha ? "" : cf.dataset.ctFicha; contratosTab(); if (S.ctFicha) $("#ctFicha").scrollIntoView({ block: "start" }); return; }
  if (t.closest("#ctUsarLido")) { S.ctEditando = ""; S.ctRascunho = S.ctLido; const rev = $("#ctRevisao").innerHTML; contratosTab(); $("#fContrato").scrollIntoView({ block: "start" }); return; }
  if (t.closest("#ctCopiarPerg")) { const txt = (S.ctPauta && S.ctPauta.length ? S.ctPauta.map((p, i) => `${i + 1}. ${p.q}\n   Por quê: ${p.porque}\n   Pedir: ${p.doc}`) : (S.ctPerguntas || []).map((q, i) => `${i + 1}. ${q}`)).join("\n\n"); navigator.clipboard.writeText(txt).then(() => toast("Perguntas copiadas."), () => toast("Não foi possível copiar; selecione o texto.")); return; }
  const cag = t.closest("[data-ct-agenda]");
  if (cag && pode()) {
    const c = S.contratos.find((x) => x.id === cag.dataset.ctAgenda), fim = fimContrato(c), data = somaDias(fim, -(c.avisoDias || 30)), id = "ag:" + novoId();
    S.acomp[id] = { data, tipo: "prazo", titulo: `Último dia para avisar a não renovação: ${c.forn}`, obs: `contrato vence em ${dataBR(fim)}; aviso por escrito`, por: nomeUsuario(), ts: new Date().toISOString() };
    ls.set(LS_ACOMP, S.acomp); agendarSync(); registrar("Adicionou compromisso", S.acomp[id].titulo); toast(`Prazo de ${dataBR(data)} adicionado à agenda.`); render(); return;
  }
  const cs = t.closest("[data-ct-sug]"); if (cs) { S.ctEditando = ""; contratosTab(); $("#ctForn").value = cs.dataset.ctSug; $("#ctValor").value = fmtValor(+cs.dataset.v); $("#fContrato").scrollIntoView({ block: "center" }); $("#ctObj").focus(); return; }
  const cd = t.closest("[data-ct-del]");
  if (cd) {
    if (cd.dataset.conf !== "1") { cd.dataset.conf = "1"; cd.textContent = "Confirmar?"; setTimeout(() => { cd.dataset.conf = ""; cd.textContent = "Excluir"; }, 4000); return; }
    const c = S.contratos.find((x) => x.id === cd.dataset.ctDel); S.contratos = S.contratos.filter((x) => x.id !== cd.dataset.ctDel);
    try { await salvarConteudo("contratos"); registrar("Excluiu contrato", c?.forn); toast("Contrato excluído."); } catch (err) { toast(mensagemErro(err)); }
    render(); return;
  }
  // proposta de orçamento
  if (t.closest("#propDoc")) { docProposta(); return; }
  if (t.closest("#propSalvar")) {
    const p = S.proposta; if (!p) return;
    const de = `${p.ano}-01`, ate = `${p.ano}-12`;
    if (S.orc.some((x) => !(ate < x.de || de > x.ate))) return toast(`Já existe previsão cobrindo ${p.ano}. Edite-a em "Editar previsão".`);
    const prev = { id: novoId(), nome: `Previsão ${p.ano} (proposta com reajuste de ${String(p.r).replace(".", ",")}%)`, de, ate, receita: r2(p.tot), cats: Object.fromEntries(p.linhas.map((l) => [l.cat, l.prop])), por: nomeUsuario(), ts: new Date().toISOString() };
    S.orc = [...S.orc, prev].sort((a, b) => a.de.localeCompare(b.de));
    try { await salvarOrc(); registrar("Salvou previsão orçamentária", prev.nome); toast(`Previsão ${p.ano} salva. Ela passa a valer quando houver balancetes de ${p.ano}.`); } catch (err) { toast(mensagemErro(err)); }
    render(); return;
  }
});
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "fAgenda") {
    e.preventDefault(); if (!pode()) return;
    const id = "ag:" + novoId();
    S.acomp[id] = { data: $("#agData").value, hora: $("#agHora").value, tipo: $("#agTipo").value, titulo: $("#agTitulo").value.trim(), local: $("#agLocal").value.trim(), obs: $("#agObs").value.trim(), por: nomeUsuario(), ts: new Date().toISOString() };
    ls.set(LS_ACOMP, S.acomp); agendarSync(); registrar("Adicionou compromisso", `${dataBR(S.acomp[id].data)} · ${S.acomp[id].titulo}`); toast("Compromisso adicionado."); render(); return;
  }
  if (f.id === "fContrato") {
    e.preventDefault(); if (!ehAdmin()) return;
    const dados = lerFormContrato();
    // fornecedor sempre com o nome padronizado usado nos balancetes
    const forns = porFornecedor(S.todos).map((x) => x.forn);
    if (dados.forn && !forns.includes(dados.forn)) { const pad = nomeFornecedor(dados.forn); dados.forn = forns.includes(pad) || dados.natureza === "receita" ? pad : casarFornecedor(dados.forn, forns) || pad; }
    if (!dados.forn) return ($("#ctMsg").textContent = dados.natureza === "receita" ? "Informe quem paga ao condomínio." : "Informe o fornecedor.");
    if (!dados.valor && !dados.valorRegra && dados.natureza !== "receita" && !dados.valorTotal) return ($("#ctMsg").textContent = "Informe o valor mensal ou a regra do valor (ex.: 2 taxas condominiais).");
    const id = f.dataset.id || novoId();
    const lido = S.ctRascunho || {};
    const c = { ...(S.contratos.find((x) => x.id === id) || {}), ...(lido.info ? { info: lido.info, clausulas: lido.clausulas || [], assinatura: lido.assinatura || "", prazoDias: lido.prazoDias || null, contratado: lido.contratado || "", ...(lido.securitizacao ? { securitizacao: lido.securitizacao } : {}), ...(lido.marca ? { marca: lido.marca } : {}) } : {}), ...dados, id, origem: S.ctRascunho?.origem || S.contratos.find((x) => x.id === id)?.origem || "", por: nomeUsuario(), ts: new Date().toISOString() };
    const antes = S.contratos; S.contratos = [...S.contratos.filter((x) => x.id !== id), c].sort((a, b) => a.forn.localeCompare(b.forn, "pt-BR"));
    try { await salvarConteudo("contratos"); registrar(f.dataset.id ? "Alterou contrato" : "Cadastrou contrato", `${c.forn} · ${brl(c.valor)}`); S.ctEditando = ""; S.ctRascunho = null; S.ctFicha = id; toast("Contrato salvo."); render(); setTimeout(() => $("#ctFicha")?.scrollIntoView({ block: "start" }), 50); }
    catch (err) { S.contratos = antes; $("#ctMsg").textContent = mensagemErro(err); }
    return;
  }
  if (f.id === "fFundo") {
    e.preventDefault(); if (!ehAdmin()) return;
    const antes = S.fundo;
    S.fundo = { perc: parseValor($("#fdPerc").value), inicio: $("#fdIni").value, saldo: parseValor($("#fdSaldo").value), dataSaldo: $("#fdData").value, por: nomeUsuario(), ts: new Date().toISOString() };
    try { await salvarConteudo("fundo"); registrar("Atualizou fundo de reserva", `${S.fundo.perc}%`); toast("Fundo de reserva atualizado."); orcExtras(); }
    catch (err) { S.fundo = antes; $("#fdMsg").textContent = mensagemErro(err); }
  }
});
$("#tpCancelar").addEventListener("click", () => ($("#trocaPropria").hidden = true));
$("#fTrocaPropria").addEventListener("submit", async (e) => {
  e.preventDefault();
  const m = $("#tpMsg"), nova = $("#tpNova").value;
  const erro = (t) => { m.hidden = false; m.className = "acesso-msg"; m.textContent = t; };
  if (nova !== $("#tpRepete").value) return erro("As duas senhas não são iguais.");
  const v = validarSenha(nova, $("#tpAtual").value); if (v) return erro(v);
  try { await trocarSenha(nova, $("#tpAtual").value); registrar("Alterou a própria senha"); $("#trocaPropria").hidden = true; ["#tpAtual", "#tpNova", "#tpRepete"].forEach((i) => ($(i).value = "")); m.hidden = true; toast("Senha alterada."); }
  catch (err) { erro(mensagemErro(err)); }
});

// ---------------------------------------------------------------- aba Administração
function prepararAdmin() {
  $("#admSemFirebase").hidden = AC.ligado;
  $("#admComFirebase").hidden = !AC.ligado;
  $("#txtRegras").textContent = REGRAS;
  if (AC.ligado && ehAdmin()) { listarUsuarios(); infoMigracao(); listarRegistros(); }
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
    mostrarCredencial(c, `Acesso criado: ${$("#naNome").value.trim()}`); registrar("Criou acesso", `${c.usuario} (${PERFIS[$("#naPerfil").value]})`);
    $("#naNome").value = $("#naUsuario").value = ""; listarUsuarios();
  } catch (err) { toast(mensagemErro(err)); }
  b.disabled = false; b.textContent = "Criar acesso com senha provisória";
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.perfilUid) { try { await atualizarAcesso(t.dataset.perfilUid, { perfil: t.value }); toast("Perfil alterado."); registrar("Alterou perfil", `${t.closest("tr")?.cells[1]?.textContent || ""} → ${PERFIS[t.value]}`); } catch (err) { toast(mensagemErro(err)); listarUsuarios(); } }
});
document.addEventListener("click", async (e) => {
  const r = e.target.closest("[data-reset]");
  if (r) {
    if (r.dataset.conf !== "1") { r.dataset.conf = "1"; r.textContent = "Confirmar nova senha?"; setTimeout(() => { r.dataset.conf = ""; r.textContent = "Nova senha provisória"; }, 4000); return; }
    r.disabled = true;
    try { const c = await novaSenhaProvisoria(r.dataset.reset); mostrarCredencial(c, `Nova senha provisória para ${c.usuario}`); registrar("Gerou nova senha provisória", c.usuario); listarUsuarios(); }
    catch (err) { toast(mensagemErro(err)); r.disabled = false; }
    return;
  }
  const at = e.target.closest("[data-ativo]");
  if (at) { try { await atualizarAcesso(at.dataset.ativo, { ativo: at.dataset.v === "1" }); toast(at.dataset.v === "1" ? "Acesso reativado." : "Acesso desativado."); registrar(at.dataset.v === "1" ? "Reativou acesso" : "Desativou acesso", at.closest("tr")?.cells[1]?.textContent || ""); listarUsuarios(); } catch (err) { toast(mensagemErro(err)); } return; }
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
const ABAS = ["resumo", "orcamento", "agenda", "contratos", "painel", "analises", "mes", "projecao", "categorias", "fornecedores", "acompanhamento", "alertas", "parcelas", "lancamentos", "notas", "conselho", "administracao", "dados"];
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
