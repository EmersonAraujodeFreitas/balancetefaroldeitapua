import { lerBalancete, conferir } from "./parser.mjs";
import { rotuloMes, r2, lancamentos, resumoMensal, porCategoria, porFornecedor, parcelas, indicadores, alertas } from "./analise.mjs";

const $ = (s) => document.querySelector(s);
const brl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => (v * 100).toFixed(1).replace(".", ",") + "%";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LS_MESES = "farol.balancetes.locais.v1", LS_GH = "farol.github.v1", LS_PER = "farol.periodo.v1";
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4200); }

const S = { base: {}, locais: {}, todos: [], meses: [], sev: new Set(["alta", "media", "baixa", "info"]), ids: null, limite: 300 };

// ---------------------------------------------------------------- dados
async function carregarBase() {
  try {
    const r = await fetch("data/balancetes.json", { cache: "no-store" });
    const j = await r.json();
    S.base = j.meses || {};
  } catch { S.base = {}; }
  S.locais = ls.get(LS_MESES, {});
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
  const n = A.filter((a) => a.sev === "alta").length;
  $("#cntAlertas").textContent = n || ""; $("#cntAlertas").hidden = !n;
  if (!S.meses.length) {
    for (const id of ["#kpis", "#grafMensal", "#leitura", "#miniCats", "#tabMensal"]) $(id).innerHTML = "";
    $("#kpis").innerHTML = `<div class="vazio card">Nenhum balancete carregado. Importe os PDFs na aba <a href="#dados">Importar PDF</a>.</div>`;
  } else {
    painel(); categorias(); fornecedores(); listaAlertas(); tabParcelas(); notas(); conselho();
  }
  lancTab(); dadosTab();
}

// ---------------------------------------------------------------- painel
function painel() {
  const ind = indicadores(S.meses);
  S.ind = ind;
  const ult = ind.rm.at(-1);
  const k = [
    ["Receitas no período", brl(ind.receita), `${ind.rm.length} meses · média ${brl(ind.receita / ind.rm.length)}`],
    ["Despesas no período", brl(ind.despesa), `${pct(ind.receita ? ind.despesa / ind.receita : 0)} da receita`],
    ["Resultado", brl(ind.resultado), ind.resultado < 0 ? "gastou mais do que arrecadou" : "sobra no período", ind.resultado < 0 ? "neg" : "pos"],
    [`Saldo em ${rotuloMes(ult.mes)}`, brl(ind.saldoFinal), `variação no período ${brl(ind.saldoFinal - (S.meses[0].totais.saldoAnterior ?? 0))}`, ind.saldoFinal < 0 ? "neg" : ""],
    ["Menor saldo", brl(ind.menor.saldo), `no fim de ${rotuloMes(ind.menor.mes)}`, ind.menor.saldo < 0 ? "neg" : ""],
    ["Juros, IOF e multas", brl(ind.fin.total), "custo de atraso e de saldo negativo", ind.fin.total > 0 ? "neg" : ""],
    ["Parcelas a vencer", brl(ind.compromissos), "compras já parceladas", ""],
  ];
  $("#kpis").innerHTML = k.map(([t, v, d, c]) => `<div class="kpi ${c || ""}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span></div>`).join("");
  $("#grafMensal").innerHTML = graficoMensal(ind.rm);

  // leitura automática
  const L = [];
  const def = ind.rm.filter((m) => m.resultado < 0);
  L.push([def.length > ind.rm.length / 3 ? "alta" : "", `Despesa maior que a receita em ${def.length} de ${ind.rm.length} meses.`]);
  const neg = ind.rm.filter((m) => m.saldo < 0);
  if (neg.length) L.push(["alta", `Saldo negativo em ${neg.map((m) => rotuloMes(m.mes)).join(", ")}.`]);
  else L.push(["ok", "Nenhum mês fechou com saldo negativo."]);
  const ult3 = ind.rm.slice(-3);
  if (ult3.length === 3) {
    const r = ult3.reduce((s, x) => s + x.receita, 0) / 3, d = ult3.reduce((s, x) => s + x.despesa, 0) / 3;
    L.push([d > r ? "media" : "ok", `Últimos 3 meses: receita média ${brl(r)} e despesa média ${brl(d)} (folga de ${brl(r - d)}/mês).`]);
  }
  const topCat = ind.cats[0];
  if (topCat) L.push(["", `${topCat.cat} é a maior despesa: ${brl(topCat.total)} (${pct(topCat.total / ind.despesa)}).`]);
  const pes = ind.cats.find((c) => /pessoal/i.test(c.cat));
  if (pes) L.push([ind.pessoalPct > 0.5 ? "media" : "", `Pessoal consome ${pct(ind.pessoalPct)} da receita.`]);
  const altas = S.alertas.filter((a) => a.sev === "alta").length, medias = S.alertas.filter((a) => a.sev === "media").length;
  L.push([altas ? "alta" : "ok", `${altas} alerta(s) de prioridade alta e ${medias} de média. <a href="#alertas">Ver alertas</a>`]);
  if (ind.fin.total) L.push(["media", `Juros, IOF e multas somam ${brl(ind.fin.total)} no período.`]);
  $("#leitura").innerHTML = L.map(([c, t]) => `<li class="${c}"><span>${t}</span></li>`).join("");

  const max = ind.cats[0]?.total || 1;
  $("#miniCats").innerHTML = `<table><tbody>${ind.cats.map((c) => `<tr><td>${esc(c.cat)}</td><td style="width:38%"><div class="barra"><span style="width:${(c.total / max) * 100}%"></span></div></td><td class="n">${brl(c.total)}</td><td class="n mini">${pct(c.total / ind.despesa)}</td></tr>`).join("")}</tbody></table>`;

  const linhas = ind.rm.map((m) => `<tr><td>${rotuloMes(m.mes)}${S.meses.find((b) => b.mes === m.mes).origem === "local" ? ' <span class="pill local">não publicado</span>' : ""}</td>
    <td class="n">${brl(m.receita)}</td><td class="n">${brl(m.despesa)}</td><td class="n ${m.resultado < 0 ? "neg" : ""}">${brl(m.resultado)}</td>
    <td class="n ${m.saldo < 0 ? "neg" : ""}">${brl(m.saldo)}</td><td class="n">${pct(m.receita ? m.despesa / m.receita : 0)}</td></tr>`).join("");
  $("#tabMensal").innerHTML = `<thead><tr><th>Mês</th><th class="n">Receita</th><th class="n">Despesa</th><th class="n">Resultado</th><th class="n">Saldo final</th><th class="n">Despesa/receita</th></tr></thead>
    <tbody>${linhas}<tr class="total"><td>Total</td><td class="n">${brl(ind.receita)}</td><td class="n">${brl(ind.despesa)}</td><td class="n ${ind.resultado < 0 ? "neg" : ""}">${brl(ind.resultado)}</td><td class="n">${brl(ind.saldoFinal)}</td><td class="n">${pct(ind.receita ? ind.despesa / ind.receita : 0)}</td></tr></tbody>`;
}

function escalaBonita(min, max, n = 5) {
  const span = max - min || 1;
  const passo0 = span / n, p10 = 10 ** Math.floor(Math.log10(passo0));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= passo0);
  const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo;
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += passo) ticks.push(r2(v));
  return { lo, hi, ticks };
}
const curto = (v) => Math.abs(v) >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil" : v.toLocaleString("pt-BR");

function graficoMensal(rm) {
  const W = 760, H = 290, ml = 64, mr = 14, mt = 14, mb = 34;
  const vals = rm.flatMap((m) => [m.receita, m.despesa, m.saldo, 0]);
  const { lo, hi, ticks } = escalaBonita(Math.min(...vals), Math.max(...vals));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / rm.length, gap = Math.max(2, bw * 0.16), b = (bw - gap * 2) / 2;
  let g = "";
  for (const t of ticks) g += `<line x1="${ml}" x2="${W - mr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="${t === 0 ? 1.4 : 1}"/><text x="${ml - 8}" y="${y(t) + 4}" text-anchor="end">${curto(t)}</text>`;
  rm.forEach((m, i) => {
    const x0 = ml + i * bw + gap;
    g += `<rect x="${x0}" y="${Math.min(y(m.receita), y(0))}" width="${b}" height="${Math.abs(y(0) - y(m.receita))}" fill="var(--accent)" rx="2"><title>${rotuloMes(m.mes)} · receita ${brl(m.receita)}</title></rect>`;
    g += `<rect x="${x0 + b}" y="${Math.min(y(m.despesa), y(0))}" width="${b}" height="${Math.abs(y(0) - y(m.despesa))}" fill="var(--muted)" opacity=".55" rx="2"><title>${rotuloMes(m.mes)} · despesa ${brl(m.despesa)}</title></rect>`;
    const lab = rm.length > 16 && i % 2 ? "" : rotuloMes(m.mes).replace("/20", "/");
    g += `<text x="${x0 + b}" y="${H - mb + 16}" text-anchor="middle">${lab}</text>`;
  });
  const pts = rm.map((m, i) => [ml + i * bw + bw / 2, y(m.saldo)]);
  g += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--beam)" stroke-width="2.5" stroke-linejoin="round"/>`;
  pts.forEach((p, i) => g += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3.2}" fill="${rm[i].saldo < 0 ? "var(--crit)" : "var(--beam)"}" stroke="var(--surface)" stroke-width="1.5"><title>${rotuloMes(rm[i].mes)} · saldo ${brl(rm[i].saldo)}</title></circle>`);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas, despesas e saldo por mês">${g}</svg>`;
}

// ---------------------------------------------------------------- categorias
function categorias() {
  const cats = porCategoria(S.meses);
  const ms = S.meses.map((b) => b.mes);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length ? (s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2) : 0; };
  const totMes = Object.fromEntries(ms.map((m) => [m, S.meses.find((b) => b.mes === m).totais.despesas]));
  let h = `<thead><tr><th>Categoria</th>${ms.map((m) => `<th class="n">${rotuloMes(m)}</th>`).join("")}<th class="n">Total</th><th class="n">%</th></tr></thead><tbody>`;
  const totalGeral = cats.reduce((s, c) => s + c.total, 0);
  for (const c of cats) {
    const vals = ms.map((m) => c.porMes[m] || 0), md = med(vals.filter(Boolean));
    h += `<tr><td>${esc(c.cat)}</td>${vals.map((v) => {
      const alto = md > 1000 && v > md * 1.8 && v - md > 5000;
      return `<td class="n" style="${alto ? "background:var(--warn-soft);color:var(--warn);font-weight:600" : ""}">${v ? brl(v).replace("R$", "").trim() : "–"}</td>`;
    }).join("")}<td class="n"><b>${brl(c.total)}</b></td><td class="n mini">${pct(totalGeral ? c.total / totalGeral : 0)}</td></tr>`;
  }
  h += `<tr class="total"><td>Total</td>${ms.map((m) => `<td class="n">${brl(totMes[m]).replace("R$", "").trim()}</td>`).join("")}<td class="n">${brl(totalGeral)}</td><td></td></tr></tbody>`;
  $("#tabCats").innerHTML = h;
  // barras horizontais
  const W = 760, lh = 30, ml = 210, H = cats.length * lh + 10, max = cats[0]?.total || 1;
  let g = "";
  cats.forEach((c, i) => {
    const w = (W - ml - 120) * (c.total / max);
    g += `<text x="${ml - 10}" y="${i * lh + 19}" text-anchor="end">${esc(c.cat)}</text><rect x="${ml}" y="${i * lh + 6}" width="${Math.max(1, w)}" height="18" rx="3" fill="var(--accent)" opacity="${1 - i * 0.05}"/><text x="${ml + w + 8}" y="${i * lh + 19}">${brl(c.total)}</text>`;
  });
  $("#grafCats").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Despesa total por categoria">${g}</svg>`;
}

// ---------------------------------------------------------------- fornecedores
function fornecedores() {
  const q = $("#buscaForn").value.trim().toLowerCase();
  const fs = porFornecedor(S.meses), tot = fs.reduce((s, f) => s + f.total, 0), nm = S.meses.length;
  const lin = fs.filter((f) => !q || f.forn.toLowerCase().includes(q)).map((f, i) => `<tr>
    <td class="n mini">${i + 1}</td><td><button class="link" data-forn="${esc(f.forn)}">${esc(f.forn)}</button><div class="mini">${esc([...f.cats].join(" · "))}</div></td>
    <td class="n">${brl(f.total)}</td><td class="n mini">${pct(f.total / tot)}</td><td class="n">${f.n}</td><td class="n">${f.meses.size}/${nm}</td>
    <td class="n">${brl(f.total / f.meses.size)}</td><td class="n mini">${rotuloMes(f.primeiro)} – ${rotuloMes(f.ultimo)}</td></tr>`).join("");
  $("#tabForn").innerHTML = `<thead><tr><th class="n">#</th><th>Fornecedor</th><th class="n">Total</th><th class="n">%</th><th class="n">Lanç.</th><th class="n">Meses</th><th class="n">Média/mês pago</th><th class="n">Período</th></tr></thead><tbody>${lin}</tbody>`;
}

// ---------------------------------------------------------------- alertas
const SEV = { alta: "Alta", media: "Média", baixa: "Baixa", info: "Informativo" };
function listaAlertas() {
  const A = S.alertas;
  $("#filtroSev").innerHTML = Object.entries(SEV).map(([k, t]) => `<button type="button" class="chip" data-sev="${k}" aria-pressed="${S.sev.has(k)}">${t} · ${A.filter((a) => a.sev === k).length}</button>`).join("");
  const vis = A.filter((a) => S.sev.has(a.sev));
  $("#listaAlertas").innerHTML = vis.length ? vis.map((a, i) => `<article class="alerta ${a.sev}">
    <div class="linha1"><span class="pill ${a.sev}">${SEV[a.sev]}</span><span class="eyebrow">${esc(a.tipo)}</span>${a.mes ? `<span class="mini">${rotuloMes(a.mes)}</span>` : ""}</div>
    <div class="tit">${esc(a.titulo)}</div>
    ${a.detalhe ? `<pre>${esc(a.detalhe)}</pre>` : ""}
    ${a.pergunta ? `<div class="perg">${esc(a.pergunta)}</div>` : ""}
    ${a.ids.length ? `<div><button type="button" class="link" data-alerta="${A.indexOf(a)}">Ver ${a.ids.length} lançamento(s)</button></div>` : ""}
  </article>`).join("") : `<div class="vazio card">Nenhum alerta com os filtros escolhidos.</div>`;
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
  $("#filtroIds").innerHTML = S.ids ? `Mostrando os lançamentos de um alerta. <button class="link" type="button" id="limparIds">Mostrar todos</button>` : "";
  S.filtrados = F;
  $("#resumoLanc").textContent = `${F.length} lançamentos · ${brl(F.reduce((s, d) => s + d.v, 0))}`;
  const vis = F.slice(0, S.limite);
  $("#tabLanc").innerHTML = `<thead><tr><th>Mês</th><th>Categoria</th><th>Fornecedor / histórico</th><th>Ref.</th><th>Baixa</th><th>Tipo</th><th>NF</th><th class="n">Valor</th></tr></thead><tbody>${
    vis.map((d) => `<tr><td>${rotuloMes(d.mes)}</td><td class="mini">${esc(d.cat)}</td><td><b style="font-weight:600">${esc(d.forn)}</b>${d.semDoc ? ' <span class="pill media" title="Conta sem documento digitalizado">sem doc.</span>' : ""}<div class="mini">${esc(d.desc)}</div></td>
      <td class="num">${esc(d.ref)}</td><td class="num">${esc(d.baixa)}</td><td>${esc(d.tipo)}</td><td class="num">${esc(d.nf)}</td><td class="n">${brl(d.v)}</td></tr>`).join("") || `<tr><td colspan="8" class="vazio">Nenhum lançamento com esses filtros.</td></tr>`
  }</tbody>`;
  $("#maisLanc").hidden = F.length <= S.limite;
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
  const perguntas = [...new Set(A.filter((a) => a.sev === "alta" || a.sev === "media").map((a) => a.pergunta).filter(Boolean))];
  $("#roteiro").innerHTML = perguntas.map((p) => `<li>${esc(p)}</li>`).join("");
  const docs = new Set([
    "Extratos bancários de todas as contas (corrente, conta capital e aplicação) de cada mês, para conferir os saldos do balancete.",
    "Notas fiscais e comprovantes de pagamento dos maiores fornecedores do período.",
    "Contratos vigentes (administradora, RH terceirizado, portaria/limpeza, jardinagem, segurança eletrônica, assessoria jurídica, síndico profissional).",
    "Relatório de inadimplência por unidade e acordos firmados.",
    "Apólice do seguro obrigatório do condomínio e comprovantes de pagamento.",
    "Atas das assembleias que aprovaram obras, compras de bens e reajustes da cota.",
  ]);
  if (A.some((a) => a.tipo === "Possível duplicidade")) docs.add("Comprovantes de devolução dos pagamentos em duplicidade.");
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
  pdfjs = await import("./vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
  return pdfjs;
}
async function importar(files) {
  const log = $("#log");
  const lib = await carregarPdfjs();
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
  return { versao: 1, atualizado: new Date().toLocaleDateString("pt-BR"), meses };
}
const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
async function publicar() {
  const cfg = { owner: $("#ghOwner").value.trim(), repo: $("#ghRepo").value.trim(), branch: $("#ghBranch").value.trim() || "main", token: $("#ghToken").value.trim() };
  if (!cfg.owner || !cfg.repo || !cfg.token) return toast("Preencha usuário, repositório e token para publicar.");
  ls.set(LS_GH, cfg);
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
    S.base = baseCompleta().meses; S.locais = {}; ls.del(LS_MESES); juntar(); render();
    toast("Base publicada. O site atualiza para todos em 1 a 2 minutos.");
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = "Publicar base no GitHub";
}

// ---------------------------------------------------------------- navegação e eventos
const ABAS = ["painel", "categorias", "fornecedores", "alertas", "parcelas", "lancamentos", "notas", "conselho", "dados"];
function rota() {
  const a = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "painel";
  document.querySelectorAll("section[data-aba]").forEach((s) => (s.hidden = s.dataset.aba !== a));
  document.querySelectorAll("nav.abas a").forEach((l) => l.getAttribute("href") === `#${a}` ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current"));
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
  if (t.dataset.sev) { S.sev.has(t.dataset.sev) ? S.sev.delete(t.dataset.sev) : S.sev.add(t.dataset.sev); listaAlertas(); }
  if (t.dataset.alerta) { S.ids = S.alertas[+t.dataset.alerta].ids; $("#buscaLanc").value = ""; $("#fCat").value = ""; $("#fForn").value = ""; $("#fSemDoc").checked = false; lancTab(); location.hash = "#lancamentos"; }
  if (t.id === "limparIds") { S.ids = null; lancTab(); }
  if (t.dataset.forn) { S.ids = null; $("#buscaLanc").value = ""; lancTab(); $("#fForn").value = t.dataset.forn; lancTab(); location.hash = "#lancamentos"; }
  if (t.dataset.remover) { delete S.locais[t.dataset.remover]; ls.set(LS_MESES, S.locais); juntar(); render(); }
});
$("#arquivos").addEventListener("change", (e) => { if (e.target.files.length) importar([...e.target.files]); e.target.value = ""; });
const drop = $("#drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = [...e.dataTransfer.files].filter((x) => /pdf$/i.test(x.name) || x.type === "application/pdf"); if (f.length) importar(f); });
$("#btnPublicar").addEventListener("click", publicar);
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

rota();
await carregarBase();
render();
