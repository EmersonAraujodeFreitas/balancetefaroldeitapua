// Análises executivas: comparativos e gráficos. Tudo derivado dos meses carregados.
import { rotuloMes, porCategoria, porFornecedor, indicadores } from "./analise.mjs";

const xBrl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const xPct = (v, d = 1) => (v * 100).toFixed(d).replace(".", ",") + "%";
const xEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const xCurto = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : Math.abs(v) >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil" : Math.round(v).toLocaleString("pt-BR");
const xMesCurto = (k) => rotuloMes(k).replace("/20", "/");

// paleta categórica validada (ordem fixa) + neutro para "Demais"
export const CORES = ["#0b5a8c", "#c98a00", "#2a9d8f", "#7b5ea7", "#d9663a"];
const DEMAIS = "#b8c2cc";
const INVEST = /obras|imobilizado/i;

function xEscala(min, max, n = 5) {
  const span = max - min || 1, p0 = span / n, p10 = 10 ** Math.floor(Math.log10(p0));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= p0);
  const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo, t = [];
  for (let v = lo; v <= hi + 1e-9; v += passo) t.push(Math.round(v * 100) / 100);
  return { lo, hi, t };
}
// barra com cantos de 4px só na ponta de dado (base reta no eixo)
function barra(x, y0, y1, w, cor, tip) {
  const top = Math.min(y0, y1), h = Math.abs(y1 - y0); if (h < 0.5) return "";
  const r = Math.min(4, w / 2, h), up = y1 < y0;
  const d = up
    ? `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y0} Z`
    : `M${x},${y0} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + w - r} Q${x + w},${top + h} ${x + w},${top + h - r} V${y0} Z`;
  return `<path d="${d}" fill="${cor}" data-tip="${xEsc(tip)}"/>`;
}
const grade = (W, ml, mr, y, t) => t.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "var(--line-2)" : "var(--line)"}"/><text x="${ml - 8}" y="${y(v) + 4}" text-anchor="end">${xCurto(v)}</text>`).join("");

function topCategorias(meses, n = 5) {
  const cats = porCategoria(meses);
  return { top: cats.slice(0, n), resto: cats.slice(n) };
}

// -------------------------------------------------- comparativo entre janelas
function janela(meses) {
  const r = meses.reduce((s, b) => s + b.totais.receitas, 0), d = meses.reduce((s, b) => s + b.totais.despesas, 0);
  const inv = meses.reduce((s, b) => s + b.despesas.filter((x) => INVEST.test(x.cat)).reduce((a, x) => a + x.v, 0), 0);
  const fin = meses.reduce((s, b) => s + b.despesas.filter((x) => /^(JUROS|IOF)/i.test(x.desc)).reduce((a, x) => a + x.v, 0), 0);
  return { n: meses.length, r, d, res: r - d, inv, corr: d - inv, fin, saldo: meses.at(-1)?.totais.saldoAtual ?? 0,
    rotulo: meses.length ? `${xMesCurto(meses[0].mes)} a ${xMesCurto(meses.at(-1).mes)}` : "" };
}
function delta(atual, ant, menorMelhor) {
  if (!ant) return `<span class="delta neutro">–</span>`;
  const v = (atual - ant) / Math.abs(ant);
  const bom = menorMelhor ? v < 0 : v > 0;
  const cls = Math.abs(v) < 0.005 ? "neutro" : bom ? "bom" : "ruim";
  return `<span class="delta ${cls}">${v > 0 ? "▲" : v < 0 ? "▼" : "■"} ${xPct(Math.abs(v))}</span>`;
}
function comparativo(meses) {
  const k = Math.min(3, Math.floor(meses.length / 2));
  if (k < 1) return `<p class="muted">Carregue ao menos dois meses para comparar.</p>`;
  const A = janela(meses.slice(-k)), B = janela(meses.slice(-2 * k, -k));
  const linhas = [
    ["Receita", A.r, B.r, false], ["Despesa total", A.d, B.d, true], ["Gastos correntes", A.corr, B.corr, true],
    ["Investimentos (obras e bens)", A.inv, B.inv, true], ["Resultado", A.res, B.res, false], ["Juros e IOF", A.fin, B.fin, true],
  ];
  const tiles = [["Receita", A.r, B.r, false], ["Despesa", A.d, B.d, true], ["Resultado", A.res, B.res, false], ["Saldo final", A.saldo, B.saldo, false]];
  return `<div class="comp-tiles">${tiles.map(([t, a, b, m]) => `<div class="comp"><span class="eyebrow">${t}</span><b style="${a < 0 ? "color:var(--crit)" : ""}">${xBrl(a)}</b>
      <span class="det">${delta(a, b, m)} <span class="muted">vs ${xBrl(b)}</span></span></div>`).join("")}</div>
    <div class="tabela" style="margin-top:14px"><table><thead><tr><th>Indicador</th><th class="n">${B.rotulo}</th><th class="n">${A.rotulo}</th><th class="n">Variação</th></tr></thead><tbody>
    ${linhas.map(([t, a, b, m]) => `<tr><td>${t}</td><td class="n">${xBrl(b)}</td><td class="n"><b>${xBrl(a)}</b></td><td class="n">${delta(a, b, m)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

// -------------------------------------------------- correntes x investimentos (barras empilhadas + linha de receita)
function correntesInvest(meses) {
  const W = 540, H = 330, ml = 54, mr = 16, mt = 20, mb = 34;
  const dados = meses.map((b) => {
    const inv = b.despesas.filter((x) => INVEST.test(x.cat)).reduce((a, x) => a + x.v, 0);
    return { mes: b.mes, inv, corr: b.totais.despesas - inv, rec: b.totais.receitas };
  });
  const { lo, hi, t } = xEscala(0, Math.max(...dados.map((d) => Math.max(d.rec, d.inv + d.corr))));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / dados.length, w = Math.min(34, bw * 0.58);
  let g = grade(W, ml, mr, y, t);
  dados.forEach((d, i) => {
    const x = ml + i * bw + (bw - w) / 2;
    g += barra(x, y(0), y(d.corr), w, "var(--accent)", `${rotuloMes(d.mes)} · gastos correntes ${xBrl(d.corr)}`);
    if (d.inv > 0) g += barra(x, y(d.corr) - 2, y(d.corr + d.inv), w, "#c98a00", `${rotuloMes(d.mes)} · investimentos ${xBrl(d.inv)}`);
    g += `<text x="${x + w / 2}" y="${H - mb + 18}" text-anchor="middle">${dados.length > 9 && i % 2 ? "" : xMesCurto(d.mes)}</text>`;
  });
  const pts = dados.map((d, i) => [ml + i * bw + bw / 2, y(d.rec)]);
  g += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4"/>`;
  pts.forEach((p, i) => g += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--surface)" stroke="var(--ink)" stroke-width="2" data-tip="${rotuloMes(dados[i].mes)} · receita ${xBrl(dados[i].rec)}"/>`);
  const totInv = dados.reduce((s, d) => s + d.inv, 0), totD = dados.reduce((s, d) => s + d.inv + d.corr, 0);
  return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gastos correntes e investimentos por mês">${g}</svg>`, totInv, totD };
}

// -------------------------------------------------- composição (rosca)
function rosca(meses) {
  const { top, resto } = topCategorias(meses);
  const fatias = [...top.map((c, i) => ({ nome: c.cat, v: c.total, cor: CORES[i] })), ...(resto.length ? [{ nome: `Demais (${resto.length})`, v: resto.reduce((s, c) => s + c.total, 0), cor: DEMAIS, lista: resto.map((c) => c.cat).join(", ") }] : [])];
  const tot = fatias.reduce((s, f) => s + f.v, 0);
  const R = 92, r = 60, cx = 110, cy = 110; let a0 = -Math.PI / 2, g = "";
  const gapRad = 0.012;
  for (const f of fatias) {
    const ang = (f.v / tot) * Math.PI * 2, a1 = a0 + ang, s = a0 + gapRad, e = a1 - gapRad, lg = e - s > Math.PI ? 1 : 0;
    const P = (rad, rr) => `${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`;
    if (e > s) g += `<path d="M${P(s, R)} A${R},${R} 0 ${lg} 1 ${P(e, R)} L${P(e, r)} A${r},${r} 0 ${lg} 0 ${P(s, r)} Z" fill="${f.cor}" data-tip="${xEsc(f.nome)} · ${xBrl(f.v)} (${xPct(f.v / tot)})"/>`;
    a0 = a1;
  }
  g += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="centro-l">Despesa total</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" class="centro-v">${xCurto(tot)}</text>`;
  const leg = fatias.map((f) => `<li><i style="background:${f.cor}"></i><span class="nome" title="${xEsc(f.lista || "")}">${xEsc(f.nome)}</span><span class="v">${xBrl(f.v)}</span><span class="p">${xPct(f.v / tot)}</span></li>`).join("");
  return `<div class="rosca"><svg viewBox="0 0 220 220" role="img" aria-label="Composição das despesas">${g}</svg><ul class="leg-tab">${leg}</ul></div>`;
}

// -------------------------------------------------- composição mensal empilhada por categoria
function empilhado(meses) {
  const W = 1040, H = 360, ml = 64, mr = 16, mt = 16, mb = 34;
  const { top } = topCategorias(meses);
  const nomes = top.map((c) => c.cat);
  const dados = meses.map((b) => {
    const pc = nomes.map((n) => b.despesas.filter((x) => x.cat === n).reduce((a, x) => a + x.v, 0));
    return { mes: b.mes, pc, demais: b.totais.despesas - pc.reduce((a, v) => a + v, 0) };
  });
  const { lo, hi, t } = xEscala(0, Math.max(...meses.map((b) => b.totais.despesas)));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / dados.length, w = Math.min(34, bw * 0.58);
  let g = grade(W, ml, mr, y, t);
  dados.forEach((d, i) => {
    const x = ml + i * bw + (bw - w) / 2; let acc = 0;
    const segs = [...d.pc.map((v, k) => [v, CORES[k], nomes[k]]), [d.demais, DEMAIS, "Demais categorias"]];
    segs.forEach(([v, cor, nome], k) => {
      if (v <= 0) return;
      const y0 = y(acc) - (acc > 0 ? 2 : 0), y1 = y(acc + v);
      const ultimo = segs.slice(k + 1).every((s) => s[0] <= 0);
      g += ultimo ? barra(x, y0, y1, w, cor, `${rotuloMes(d.mes)} · ${nome} ${xBrl(v)}`)
        : (y0 - y1 > 0.5 ? `<rect x="${x}" y="${y1}" width="${w}" height="${y0 - y1}" fill="${cor}" data-tip="${xEsc(`${rotuloMes(d.mes)} · ${nome} ${xBrl(v)}`)}"/>` : "");
      acc += v;
    });
    g += `<text x="${x + w / 2}" y="${H - mb + 18}" text-anchor="middle">${dados.length > 16 && i % 2 ? "" : xMesCurto(d.mes)}</text>`;
  });
  const leg = [...nomes.map((n, k) => [n, CORES[k]]), ["Demais categorias", DEMAIS]].map(([n, c]) => `<span><i style="background:${c}"></i>${xEsc(n)}</span>`).join("");
  return `<div class="legenda" style="margin-bottom:8px">${leg}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Despesas por categoria em cada mês">${g}</svg>`;
}

// -------------------------------------------------- acumulado receita x despesa
function acumulado(meses) {
  const W = 540, H = 300, ml = 54, mr = 116, mt = 16, mb = 34;
  let ar = 0, ad = 0;
  const d = meses.map((b) => ({ mes: b.mes, r: (ar += b.totais.receitas), d: (ad += b.totais.despesas) }));
  const { lo, hi, t } = xEscala(0, Math.max(ar, ad));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const x = (i) => ml + (d.length === 1 ? (W - ml - mr) / 2 : (i / (d.length - 1)) * (W - ml - mr));
  let g = grade(W, ml, mr, y, t);
  const area = `M${x(0)},${y(d[0].r)} ${d.map((p, i) => `L${x(i)},${y(p.r)}`).join(" ")} ${[...d].reverse().map((p, i) => `L${x(d.length - 1 - i)},${y(p.d)}`).join(" ")} Z`;
  g += `<path d="${area}" fill="var(--accent)" opacity=".08"/>`;
  g += `<polyline points="${d.map((p, i) => `${x(i)},${y(p.r)}`).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;
  g += `<polyline points="${d.map((p, i) => `${x(i)},${y(p.d)}`).join(" ")}" fill="none" stroke="#d9663a" stroke-width="2.5"/>`;
  d.forEach((p, i) => {
    g += `<rect x="${x(i) - (W - ml - mr) / d.length / 2}" y="${mt}" width="${(W - ml - mr) / d.length}" height="${H - mt - mb}" fill="transparent" data-tip="${xEsc(`Até ${rotuloMes(p.mes)} · receita ${xBrl(p.r)} · despesa ${xBrl(p.d)} · diferença ${xBrl(p.r - p.d)}`)}"/>`;
    if (!(d.length > 9 && i % 2)) g += `<text x="${x(i)}" y="${H - mb + 18}" text-anchor="middle">${xMesCurto(p.mes)}</text>`;
  });
  const l = d.at(-1), xe = x(d.length - 1);
  let yr = y(l.r), yd = y(l.d);
  if (Math.abs(yr - yd) < 16) { const m = (yr + yd) / 2; yr = l.r >= l.d ? m - 9 : m + 9; yd = l.r >= l.d ? m + 9 : m - 9; }
  g += `<circle cx="${xe}" cy="${y(l.r)}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><circle cx="${xe}" cy="${y(l.d)}" r="4.5" fill="#d9663a" stroke="var(--surface)" stroke-width="2"/>`;
  g += `<text class="anot" x="${xe + 10}" y="${yr + 4}">Receita ${xCurto(l.r)}</text><text class="anot" x="${xe + 10}" y="${yd + 4}">Despesa ${xCurto(l.d)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receita e despesa acumuladas">${g}</svg>`;
}

// -------------------------------------------------- variação por categoria (divergente)
function variacaoCategorias(meses) {
  const k = Math.min(3, Math.floor(meses.length / 2));
  if (k < 1) return "";
  const A = meses.slice(-k), B = meses.slice(-2 * k, -k);
  const cats = porCategoria(meses).map((c) => {
    const a = A.reduce((s, b) => s + (c.porMes[b.mes] || 0), 0) / k, b = B.reduce((s, m) => s + (c.porMes[m.mes] || 0), 0) / k;
    return { cat: c.cat, a, b, dv: a - b };
  }).filter((c) => c.a || c.b).sort((x, y) => y.dv - x.dv);
  const W = 540, lh = 28, ml = 175, mr = 10, H = cats.length * lh + 26;
  const m = Math.max(...cats.map((c) => Math.abs(c.dv)), 1);
  const cx = ml + (W - ml - mr) / 2, esc = (W - ml - mr) / 2 - 48;
  let g = `<line x1="${cx}" x2="${cx}" y1="4" y2="${H - 18}" stroke="var(--line-2)"/>`;
  cats.forEach((c, i) => {
    const yy = 6 + i * lh, w = (Math.abs(c.dv) / m) * esc, cor = c.dv > 0 ? "#d9663a" : "var(--accent)";
    g += `<text x="${ml - 10}" y="${yy + 15}" text-anchor="end" class="cat">${xEsc(c.cat.length > 24 ? c.cat.replace(/ e encargos bancários/, " bancárias").slice(0, 26) : c.cat)}</text>`;
    if (w > 0.5) g += `<rect x="${c.dv > 0 ? cx : cx - w}" y="${yy + 4}" width="${w}" height="16" rx="3" fill="${cor}" data-tip="${xEsc(`${c.cat}: média de ${xBrl(c.b)}/mês → ${xBrl(c.a)}/mês`)}"/>`;
    const tx = c.dv > 0 ? cx + w + 6 : cx - w - 6;
    g += `<text x="${tx}" y="${yy + 16}" text-anchor="${c.dv > 0 ? "start" : "end"}">${c.dv > 0 ? "+" : "−"}${xCurto(Math.abs(c.dv))}</text>`;
  });
  g += `<text x="${cx - 8}" y="${H - 4}" text-anchor="end">◀ reduziu</text><text x="${cx + 8}" y="${H - 4}">aumentou ▶</text>`;
  return `<p class="small muted" style="margin:4px 0 10px">Média mensal de ${xMesCurto(A[0].mes)} a ${xMesCurto(A.at(-1).mes)} comparada com ${xMesCurto(B[0].mes)} a ${xMesCurto(B.at(-1).mes)}.</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Variação da despesa média mensal por categoria">${g}</svg>`;
}

// -------------------------------------------------- top fornecedores
function topFornecedores(meses, n = 10) {
  const fs = porFornecedor(meses), tot = fs.reduce((s, f) => s + f.total, 0), top = fs.slice(0, n);
  const W = 1040, lh = 38, ml = 300, mr = 170, H = top.length * lh + 6, m = top[0]?.total || 1;
  let g = "", acum = 0;
  top.forEach((f, i) => {
    acum += f.total;
    const yy = 4 + i * lh, w = (f.total / m) * (W - ml - mr);
    g += `<text x="${ml - 12}" y="${yy + 21}" text-anchor="end" class="cat">${xEsc(f.forn.length > 38 ? f.forn.slice(0, 36) + "…" : f.forn)}</text>`;
    g += `<rect x="${ml}" y="${yy + 6}" width="${W - ml - mr}" height="20" rx="4" fill="#e9eef4"/>`;
    g += `<rect x="${ml}" y="${yy + 6}" width="${Math.max(2, w)}" height="20" rx="4" fill="var(--accent)" data-tip="${xEsc(`${f.forn} · ${xBrl(f.total)} em ${f.n} lançamentos (${f.meses.size} meses)`)}"/>`;
    g += `<text x="${W - mr + 12}" y="${yy + 21}" class="anot">${xCurto(f.total)}</text><text x="${W - 8}" y="${yy + 21}" text-anchor="end">${xPct(f.total / tot)}</text>`;
  });
  return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Maiores fornecedores">${g}</svg>`, conc: acum / tot, n: top.length };
}

// -------------------------------------------------- indicadores por trimestre
function porTrimestre(meses) {
  const grupos = new Map();
  for (const b of meses) {
    const [a, m] = b.mes.split("-"); const q = `${Math.ceil(+m / 3)}º tri/${a}`;
    (grupos.get(q) || grupos.set(q, []).get(q)).push(b);
  }
  const cols = [...grupos.entries()].map(([q, ms]) => {
    const j = janela(ms), cats = porCategoria(ms);
    const cat = (re) => cats.filter((c) => re.test(c.cat)).reduce((s, c) => s + c.total, 0);
    return { q: q + (ms.length < 3 ? "*" : ""), j, pes: cat(/pessoal/i), cons: cat(/consumo/i), adm: cat(/administrativ/i) };
  });
  const L = [
    ["Receita média mensal", (c) => xBrl(c.j.r / c.j.n)],
    ["Despesa média mensal", (c) => xBrl(c.j.d / c.j.n)],
    ["Cobertura (receita ÷ despesa)", (c) => `<span style="${c.j.r < c.j.d ? "color:var(--crit);font-weight:600" : ""}">${(c.j.r / c.j.d).toFixed(2).replace(".", ",")}</span>`],
    ["Pessoal / receita", (c) => xPct(c.pes / c.j.r)],
    ["Água e energia / receita", (c) => xPct(c.cons / c.j.r)],
    ["Administrativas / receita", (c) => xPct(c.adm / c.j.r)],
    ["Investimentos / despesa", (c) => xPct(c.j.inv / c.j.d)],
    ["Juros e IOF", (c) => xBrl(c.j.fin)],
    ["Saldo no fim", (c) => `<span style="${c.j.saldo < 0 ? "color:var(--crit)" : ""}">${xBrl(c.j.saldo)}</span>`],
  ];
  return `<table><thead><tr><th>Indicador</th>${cols.map((c) => `<th class="n">${c.q}</th>`).join("")}</tr></thead><tbody>${L.map(([t, f]) => `<tr><td>${t}</td>${cols.map((c) => `<td class="n">${f(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    ${cols.some((c) => c.q.endsWith("*")) ? `<p class="small muted" style="padding:8px 12px">* trimestre incompleto no período selecionado.</p>` : ""}`;
}

// -------------------------------------------------- conclusões executivas automáticas
function conclusoes(meses, ci, tf) {
  const ind = indicadores(meses), out = [];
  const k = Math.min(3, Math.floor(meses.length / 2));
  if (k >= 1) {
    const A = janela(meses.slice(-k)), B = janela(meses.slice(-2 * k, -k));
    const vr = B.r ? (A.r - B.r) / B.r : 0, vd = B.d ? (A.d - B.d) / B.d : 0;
    out.push(`Nos últimos ${k} meses a receita ${vr >= 0 ? "subiu" : "caiu"} ${xPct(Math.abs(vr))} e a despesa ${vd >= 0 ? "subiu" : "caiu"} ${xPct(Math.abs(vd))} em relação aos ${k} meses anteriores; o resultado passou de ${xBrl(B.res)} para ${xBrl(A.res)}.`);
  }
  out.push(`Investimentos (obras e bens) somam ${xBrl(ci.totInv)}, ${xPct(ci.totD ? ci.totInv / ci.totD : 0)} da despesa do período${ci.totInv > 0 ? ", pagos com a receita ordinária" : ""}.`);
  out.push(`Os ${tf.n} maiores fornecedores concentram ${xPct(tf.conc)} de tudo o que foi pago.`);
  const cob = ind.receita / (ind.despesa || 1);
  out.push(`Cobertura do período: cada R$ 1,00 de despesa teve R$ ${cob.toFixed(2).replace(".", ",")} de receita.${cob < 1.03 ? " A margem é estreita para formar reserva." : ""}`);
  return out.map((t) => `<li>${t}</li>`).join("");
}

import { fluxo, pontePeriodo, pareto, formasPagamento } from "./graficos.mjs";
export function renderExecutivo(meses, el) {
  if (!meses.length) { el.innerHTML = `<div class="vazio card">Nenhum balancete no período.</div>`; return; }
  const ci = correntesInvest(meses), tf = topFornecedores(meses);
  const par = pareto(meses);
  el.innerHTML = `
  <div class="card"><div class="cab"><div class="cab-secao"><span class="eyebrow">Síntese</span><h2>Conclusões do período</h2></div></div>
    <ul class="conclusoes">${conclusoes(meses, ci, tf)}</ul></div>
  <div class="card"><div class="cab"><div class="cab-secao"><span class="eyebrow">Comparativo</span><h2>Últimos meses x período anterior</h2></div></div>
    <div style="margin-top:14px">${comparativo(meses)}</div></div>
  <div class="bloco-titulo"><span class="num">1</span><div><h2>Caixa</h2><p>De onde veio e para onde foi cada real</p></div></div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Fluxo do dinheiro</span><h2>Receitas distribuídas pelas categorias de despesa</h2></div>
    <p class="small muted" style="margin:6px 0 10px">A largura de cada faixa é proporcional ao valor. Passe o mouse sobre uma faixa para ver o valor.</p><div class="grafico-largo">${fluxo(meses)}</div></div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Ponte do período</span><h2>Do saldo inicial ao saldo final</h2></div>
    <div class="legenda" style="margin:10px 0 6px"><span><i style="background:#054166"></i>Saldo</span><span><i style="background:#2a9d8f"></i>Entradas</span><span><i style="background:#d9663a"></i>Saídas por categoria</span></div><div class="grafico-largo">${pontePeriodo(meses)}</div></div>
  <div class="grid2">
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Acumulado</span><h2>Receita x despesa acumuladas</h2></div>
      <div class="legenda" style="margin:10px 0 6px"><span><i class="linha" style="background:var(--accent)"></i>Receita acumulada</span><span><i class="linha" style="background:#d9663a"></i>Despesa acumulada</span></div>${acumulado(meses)}</div>
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Natureza do gasto</span><h2>Gastos correntes x investimentos</h2></div>
      <div class="legenda" style="margin:10px 0 6px"><span><i style="background:var(--accent)"></i>Gastos correntes</span><span><i style="background:#c98a00"></i>Obras e bens</span><span><i class="linha" style="background:var(--ink)"></i>Receita</span></div>${ci.svg}</div>
  </div>
  <div class="bloco-titulo"><span class="num">2</span><div><h2>Composição</h2><p>Como o gasto se divide e como mudou</p></div></div>
  <div class="grid2">
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Participação</span><h2>Despesas por categoria</h2></div><div style="margin-top:10px">${rosca(meses)}</div></div>
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Tendência</span><h2>O que aumentou e o que caiu</h2></div>${variacaoCategorias(meses)}</div>
  </div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Evolução da composição</span><h2>Despesa mensal por categoria</h2></div><div style="margin-top:10px">${empilhado(meses)}</div></div>
  <div class="bloco-titulo"><span class="num">3</span><div><h2>Fornecedores e pagamentos</h2><p>Quem recebe e como se paga</p></div></div>
  <div class="card chart"><div class="cab"><div class="cab-secao"><span class="eyebrow">Concentração (curva 80/20)</span><h2>Maiores fornecedores do período</h2></div><span class="small muted">${par.corte} de ${par.nForn} fornecedores concentram 80% dos pagamentos</span></div>
    <div class="grafico-largo" style="margin-top:12px">${par.svg}</div></div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Meios de pagamento</span><h2>Como as despesas foram pagas</h2></div><div style="margin-top:12px">${formasPagamento(meses)}</div></div>
  <div class="bloco-titulo"><span class="num">4</span><div><h2>Índices de gestão</h2><p>Indicadores por trimestre</p></div></div>
  <div class="tabela">${porTrimestre(meses)}</div>`;
}
