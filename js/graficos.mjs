// Biblioteca de gráficos do painel (SVG próprio, sem dependências).
// Todos os gráficos são derivados dos meses carregados e se adaptam a meses, categorias e fornecedores novos.
import { rotuloMes, porCategoria, porFornecedor, lancamentos, indicadores } from "./analise.mjs";

const kBrl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kPct = (v, d = 1) => (v * 100).toFixed(d).replace(".", ",") + "%";
const kEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kCurto = (v) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; return a >= 1e6 ? s + (a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi" : a >= 1000 ? s + (a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: a >= 1e5 ? 0 : 1 }) + " mil" : s + Math.round(a).toLocaleString("pt-BR"); };
const kMes = (k) => rotuloMes(k).replace("/20", "/");
const kCat = (c) => c.replace(" e encargos bancários", " bancárias").replace("Consumo (água e energia)", "Água e energia").replace("Prestação de serviços", "Serviços").replace("Locação de equipamentos", "Locação").replace("Impostos e tributos", "Impostos");
// paleta categórica validada (ordem fixa por categoria, não por posição)
const K_CORES = ["#0b5a8c", "#c98a00", "#2a9d8f", "#7b5ea7", "#d9663a"];
const K_NEUTRO = "#a9b6c3";
const K_POS = "#2a9d8f", K_NEG = "#d9663a";
function kEscala(min, max, n = 5) {
  const span = max - min || 1, p0 = span / n, p10 = 10 ** Math.floor(Math.log10(p0));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= p0);
  const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo, t = [];
  for (let v = lo; v <= hi + 1e-9; v += passo) t.push(Math.round(v * 100) / 100);
  return { lo, hi, t };
}
const kDefs = () => `<defs>
  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1673ad"/><stop offset="1" stop-color="#054166"/></linearGradient>
  <linearGradient id="gDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7b6c6"/><stop offset="1" stop-color="#7b8ea4"/></linearGradient>
  <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbb812" stop-opacity=".38"/><stop offset="1" stop-color="#fbb812" stop-opacity="0"/></linearGradient>
  <linearGradient id="gOuro" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbb812"/><stop offset="1" stop-color="#f29a00"/></linearGradient>
  <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#032f4a" flood-opacity=".25"/></filter>
</defs>`;
// barra com cantos de 4px na ponta do dado e base reta
function kBarra(x, y0, y1, w, fill, cls = "") {
  const top = Math.min(y0, y1), h = Math.abs(y1 - y0); if (h < 0.5) return "";
  const r = Math.min(4, w / 2, h), up = y1 < y0;
  const d = up ? `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y0} Z`
    : `M${x},${y0} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + w - r} Q${x + w},${top + h} ${x + w},${top + h - r} V${y0} Z`;
  return `<path class="${cls}" d="${d}" fill="${fill}"/>`;
}
const kGrade = (W, ml, mr, y, t, fmt = kCurto) => t.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#9fb0c2" : "#e3e9ef"}" stroke-width="${v === 0 ? 1.3 : 1}"/><text x="${ml - 10}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`).join("");
let kSeq = 0;
// ids de gradiente únicos por gráfico: um <defs> dentro de aba oculta não serve aos demais
const kSvg = (W, H, rotulo, corpo, cls = "") => { const p = "k" + (++kSeq) + "-"; return `<svg class="g ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kEsc(rotulo)}">${kDefs().replace(/id="/g, `id="${p}`).replace(/url\(#/g, `url(#${p}`)}${corpo.replace(/url\(#/g, `url(#${p}`)}</svg>`; };

// ------------------------------------------------------------------ evolução mensal (combo + faixa de resultado)
export function comboMensal(rm) {
  const W = 1200, H1 = 400, H2 = 120, H = H1 + H2 + 30, ml = 74, mr = 22, mt = 34, mb = 30;
  const vals = rm.flatMap((m) => [m.receita, m.despesa, m.saldo, 0]);
  const { lo, hi, t } = kEscala(Math.min(...vals), Math.max(...vals));
  const y = (v) => mt + (H1 - mt - mb) * (1 - (v - lo) / (hi - lo));
  const n = rm.length, bw = (W - ml - mr) / n, gap = Math.max(4, bw * 0.18), b = (bw - gap * 2 - 3) / 2;
  const cx = (i) => ml + i * bw + bw / 2;
  let g = kGrade(W, ml, mr, y, t);
  if (lo < 0) g += `<rect x="${ml}" y="${y(0)}" width="${W - ml - mr}" height="${y(lo) - y(0)}" fill="#fdecea" opacity=".75"/><text x="${W - mr - 6}" y="${y(lo) - 8}" text-anchor="end" class="zona">zona de saldo negativo</text>`;
  // colunas de interação (atrás das marcas)
  rm.forEach((m, i) => {
    const tip = `${rotuloMes(m.mes)}\nReceita: ${kBrl(m.receita)}\nDespesa: ${kBrl(m.despesa)}\nResultado: ${kBrl(m.resultado)}\nSaldo no fim do mês: ${kBrl(m.saldo)}`;
    g += `<rect class="col" x="${ml + i * bw}" y="${mt - 10}" width="${bw}" height="${H1 + H2 - mt}" data-tip="${kEsc(tip)}"/>`;
  });
  rm.forEach((m, i) => {
    const x0 = ml + i * bw + gap;
    g += kBarra(x0, y(0), y(m.receita), b, "url(#gRec)", "anim-bar");
    g += kBarra(x0 + b + 3, y(0), y(m.despesa), b, "url(#gDesp)", "anim-bar");
    g += `<text x="${cx(i)}" y="${H1 - mb + 20}" text-anchor="middle" class="eixo-x">${kMes(m.mes)}</text>`;
  });
  // área e linha do saldo
  const pts = rm.map((m, i) => [cx(i), y(m.saldo)]);
  const z = y(Math.max(0, lo));
  g += `<path d="M${pts[0][0]},${z} L${pts.map((p) => p.join(",")).join(" L")} L${pts.at(-1)[0]},${z} Z" fill="url(#gSaldo)"/>`;
  g += `<polyline class="anim-linha" pathLength="1" points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="url(#gOuro)" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" filter="url(#sombra)"/>`;
  pts.forEach((p, i) => g += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === n - 1 ? 6 : 4.2}" fill="${rm[i].saldo < 0 ? "#b4231a" : "#fbb812"}" stroke="#fff" stroke-width="2"/>`);
  // destaques automáticos
  const iMaxD = rm.reduce((a, m, i) => (m.despesa > rm[a].despesa ? i : a), 0);
  const iMin = rm.reduce((a, m, i) => (m.saldo < rm[a].saldo ? i : a), 0);
  const iMaxS = rm.reduce((a, m, i) => (m.saldo > rm[a].saldo ? i : a), 0);
  const nota = (x, yy, txt, cor = "#054166", acima = true) => {
    const w = txt.length * 6.6 + 16, xx = Math.min(W - mr - w, Math.max(ml, x - w / 2)), ty = acima ? yy - 34 : yy + 12;
    return `<g class="nota"><line x1="${x}" x2="${x}" y1="${acima ? ty + 22 : ty}" y2="${yy + (acima ? -4 : 4)}" stroke="${cor}" stroke-width="1.2"/><rect x="${xx}" y="${ty}" width="${w}" height="22" rx="11" fill="#fff" stroke="${cor}" stroke-width="1.2"/><text x="${xx + w / 2}" y="${ty + 15}" text-anchor="middle" fill="${cor}" style="font-weight:700;font-size:11.5px">${kEsc(txt)}</text></g>`;
  };
  g += nota(ml + iMaxD * bw + gap + b + 3 + b / 2, y(rm[iMaxD].despesa), `maior despesa ${kCurto(rm[iMaxD].despesa)}`, "#4b5f73");
  if (iMaxS !== iMaxD) g += nota(pts[iMaxS][0], pts[iMaxS][1], `maior saldo ${kCurto(rm[iMaxS].saldo)}`, "#a86f00");
  if (rm[iMin].saldo < 0) g += nota(pts[iMin][0], pts[iMin][1], `menor saldo ${kCurto(rm[iMin].saldo)}`, "#b4231a", false);
  // faixa de resultado
  const top2 = H1 + 26, mx = Math.max(...rm.map((m) => Math.abs(m.resultado)), 1);
  const y2 = (v) => top2 + H2 / 2 - (v / mx) * (H2 / 2 - 14);
  g += `<text x="${ml - 10}" y="${top2 - 6}" text-anchor="end" class="rot-faixa">Resultado</text><line x1="${ml}" x2="${W - mr}" y1="${y2(0)}" y2="${y2(0)}" stroke="#9fb0c2"/>`;
  rm.forEach((m, i) => {
    const w = Math.min(28, bw * 0.42), x0 = cx(i) - w / 2, pos = m.resultado >= 0;
    g += kBarra(x0, y2(0), y2(m.resultado), w, pos ? K_POS : K_NEG);
    g += `<text x="${cx(i)}" y="${pos ? y2(m.resultado) - 5 : y2(m.resultado) + 13}" text-anchor="middle" class="val" style="fill:${pos ? "#1d6b5f" : "#a3401b"}">${kCurto(m.resultado)}</text>`;
  });
  g += `<line class="guia" x1="0" x2="0" y1="${mt - 10}" y2="${H1 + H2}" stroke="#054166" stroke-dasharray="3 3" opacity="0"/>`;
  return kSvg(W, H, "Receitas, despesas, saldo e resultado por mês", g, "combo");
}

// ------------------------------------------------------------------ índice de saúde financeira
export function saude(meses, alertas) {
  const rm = meses.map((b) => ({ mes: b.mes, r: b.totais.receitas, d: b.totais.despesas, s: b.totais.saldoAtual }));
  const u3 = rm.slice(-3), u6 = rm.slice(-6);
  const cob = u3.reduce((a, m) => a + m.r, 0) / (u3.reduce((a, m) => a + m.d, 0) || 1);
  const despMed = u3.reduce((a, m) => a + m.d, 0) / u3.length;
  const reserva = (rm.at(-1)?.s ?? 0) / (despMed || 1);
  const negs = u6.filter((m) => m.s < 0).length;
  const fin = indicadores(meses.slice(-6)).fin.total / (u6.reduce((a, m) => a + m.r, 0) || 1);
  const altas = alertas.filter((a) => a.sev === "alta" && a.sit !== "resolvido" && a.sit !== "descartado").length;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const comp = [
    { nome: "Receita cobre a despesa (3 meses)", max: 25, pts: cl(((cob - 0.95) / 0.10) * 25, 0, 25), valor: `${cob.toFixed(2).replace(".", ",")}×` },
    { nome: "Reserva em caixa", max: 25, pts: cl(reserva * 25, 0, 25), valor: `${Math.max(0, reserva * 30).toFixed(0)} dias de despesa` },
    { nome: "Meses sem saldo negativo (6 meses)", max: 20, pts: cl(20 - negs * 5, 0, 20), valor: `${negs} negativo(s)` },
    { nome: "Custo de juros e multas", max: 15, pts: cl(15 - (fin / 0.005) * 15, 0, 15), valor: kPct(fin, 2) + " da receita" },
    { nome: "Alertas graves em aberto", max: 15, pts: cl(15 - altas * 4, 0, 15), valor: `${altas} em aberto` },
  ];
  const score = Math.round(comp.reduce((a, c) => a + c.pts, 0));
  const faixa = score >= 70 ? ["Boa", "#1d7a4b"] : score >= 40 ? ["Atenção", "#9a6200"] : ["Frágil", "#b4231a"];
  // medidor semicircular
  const W = 360, H = 210, cx = 180, cy = 180, R = 140, r = 104;
  const pol = (v, rr) => { const a = Math.PI * (1 - v / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arco = (a0, a1, cor) => { const [x0, y0] = pol(a0, R), [x1, y1] = pol(a1, R), [x2, y2] = pol(a1, r), [x3, y3] = pol(a0, r); return `<path d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 0 0 ${x3},${y3} Z" fill="${cor}"/>`; };
  let g = arco(0, 39.4, "#f6d3cd") + arco(40, 69.4, "#fbe7b8") + arco(70, 100, "#cfeadb");
  g += arco(0, Math.max(0.5, score), "none");
  const [nx, ny] = pol(score, R - 6);
  for (const v of [0, 40, 70, 100]) { const [tx, ty] = pol(v, R + 14); g += `<text x="${tx}" y="${ty + 4}" text-anchor="middle" class="eixo-x">${v}</text>`; }
  g += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#054166" stroke-width="5" stroke-linecap="round" class="ponteiro"/><circle cx="${cx}" cy="${cy}" r="11" fill="#054166"/><circle cx="${cx}" cy="${cy}" r="4" fill="#fbb812"/>`;
  g += `<text x="${cx}" y="${cy - 40}" text-anchor="middle" style="font-size:44px;font-weight:800;fill:${faixa[1]}">${score}</text>`;
  const barras = comp.map((c) => `<li><div class="sd-top"><span>${c.nome}</span><b>${Math.round(c.pts)}/${c.max}</b></div><div class="sd-barra"><span style="width:${(c.pts / c.max) * 100}%;background:${c.pts / c.max >= 0.7 ? "#2a9d8f" : c.pts / c.max >= 0.4 ? "#e0a100" : "#d9663a"}"></span></div><span class="mini">${c.valor}</span></li>`).join("");
  return { score, faixa, html: `<div class="saude"><div class="saude-g">${kSvg(W, H, `Índice de saúde financeira: ${score} de 100`, g)}<div class="saude-r" style="color:${faixa[1]}">${faixa[0]}</div></div><ul class="saude-l">${barras}</ul></div>` };
}

// ------------------------------------------------------------------ treemap de categorias
function squarify(itens, x, y, w, h) {
  const out = []; let rest = [...itens]; const total = rest.reduce((s, i) => s + i.v, 0); const k = (w * h) / total;
  let row = [], X = x, Y = y, W = w, Hh = h;
  const worst = (r, lado) => { const s = r.reduce((a, i) => a + i.v * k, 0), mx = Math.max(...r.map((i) => i.v * k)), mn = Math.min(...r.map((i) => i.v * k)); return Math.max((lado * lado * mx) / (s * s), (s * s) / (lado * lado * mn)); };
  const layout = (r) => {
    const s = r.reduce((a, i) => a + i.v * k, 0);
    if (W >= Hh) { const ww = s / Hh; let yy = Y; for (const i of r) { const hh = (i.v * k) / ww; out.push({ ...i, x: X, y: yy, w: ww, h: hh }); yy += hh; } X += ww; W -= ww; }
    else { const hh = s / W; let xx = X; for (const i of r) { const ww = (i.v * k) / hh; out.push({ ...i, x: xx, y: Y, w: ww, h: hh }); xx += ww; } Y += hh; Hh -= hh; }
  };
  while (rest.length) {
    const lado = Math.min(W, Hh), item = rest[0];
    if (!row.length || worst([...row, item], lado) <= worst(row, lado)) { row.push(item); rest.shift(); }
    else { layout(row); row = []; }
  }
  if (row.length) layout(row);
  return out;
}
export function treemapCategorias(meses) {
  const cats = porCategoria(meses), tot = cats.reduce((s, c) => s + c.total, 0);
  const W = 1200, H = 430;
  const itens = cats.map((c, i) => ({ nome: c.cat, v: c.total, i }));
  const rects = squarify(itens, 0, 0, W, H);
  let g = "";
  for (const r of rects) {
    const share = r.v / tot, a = 0.32 + 0.68 * Math.sqrt(share / (cats[0].total / tot));
    const fundo = `rgba(5,65,102,${a.toFixed(2)})`, claro = a > 0.55;
    const pad = 2;
    g += `<g class="tm" data-tip="${kEsc(`${r.nome}\n${kBrl(r.v)} · ${kPct(share)} das despesas`)}"><rect x="${r.x + pad}" y="${r.y + pad}" width="${Math.max(0, r.w - pad * 2)}" height="${Math.max(0, r.h - pad * 2)}" rx="8" fill="${fundo}"/>`;
    const cor = claro ? "#ffffff" : "#05314d";
    if (r.w > 120 && r.h > 70) {
      g += `<text x="${r.x + 16}" y="${r.y + 30}" style="fill:${cor};font-size:${r.w > 300 ? 17 : 14}px;font-weight:700">${kEsc(kCat(r.nome))}</text>`;
      g += `<text x="${r.x + 16}" y="${r.y + (r.w > 300 ? 62 : 52)}" style="fill:${cor};font-size:${r.w > 300 ? 26 : 18}px;font-weight:800">${kCurto(r.v)}</text>`;
      g += `<text x="${r.x + 16}" y="${r.y + (r.w > 300 ? 86 : 72)}" style="fill:${cor};font-size:13px;opacity:.9">${kPct(share)} do total</text>`;
    } else if (r.w > 60 && r.h > 34) {
      g += `<text x="${r.x + 10}" y="${r.y + 22}" style="fill:${cor};font-size:11.5px;font-weight:700">${kEsc(kCat(r.nome).slice(0, Math.floor(r.w / 7.2)))}</text><text x="${r.x + 10}" y="${r.y + 38}" style="fill:${cor};font-size:11px">${kPct(share)}</text>`;
    }
    g += `</g>`;
  }
  return kSvg(W, H, "Mapa de áreas das despesas por categoria", g, "treemap");
}

// lista de categorias com tendência (minigráfico + variação recente)
export function listaTendencia(meses) {
  const cats = porCategoria(meses), tot = cats.reduce((s, c) => s + c.total, 0), ms = meses.map((b) => b.mes);
  const k = Math.min(3, Math.floor(ms.length / 2));
  const linhas = cats.map((c) => {
    const vals = ms.map((m) => c.porMes[m] || 0), mx = Math.max(...vals, 1);
    const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * 116 + 2},${30 - (v / mx) * 26}`).join(" ");
    const a = k ? vals.slice(-k).reduce((s, v) => s + v, 0) / k : 0, b = k ? vals.slice(-2 * k, -k).reduce((s, v) => s + v, 0) / k : 0;
    const vr = b ? (a - b) / b : 0;
    const seta = k && !b && a ? `<span class="delta ruim">▲ novo gasto</span>` : !k || Math.abs(vr) < 0.03 ? `<span class="delta neutro">■ estável</span>` : `<span class="delta ${vr > 0 ? "ruim" : "bom"}">${vr > 0 ? "▲" : "▼"} ${kPct(Math.abs(vr), 0)}</span>`;
    return `<tr><td><b style="font-weight:600">${kEsc(c.cat)}</b></td>
      <td><svg viewBox="0 0 120 34" width="120" height="34" class="spark-cat" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#0b5a8c" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg></td>
      <td class="n">${seta}</td><td class="n"><b>${kBrl(c.total)}</b></td><td class="n"><div class="share"><span style="width:${(c.total / cats[0].total) * 100}%"></span></div><span class="mini">${kPct(c.total / tot)}</span></td></tr>`;
  }).join("");
  return `<table class="tend"><thead><tr><th>Categoria</th><th>Evolução mensal</th><th class="n">Últimos ${k} meses</th><th class="n">Total</th><th class="n" style="width:150px">Participação</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

// ------------------------------------------------------------------ fluxo do dinheiro (receitas → categorias)
export function fluxo(meses) {
  const cats = porCategoria(meses);
  const rec = meses.reduce((s, b) => s + b.totais.receitas, 0), desp = cats.reduce((s, c) => s + c.total, 0);
  const top = cats.slice(0, 7), resto = cats.slice(7);
  const destinos = [...top.map((c, i) => ({ nome: kCat(c.cat), v: c.total, cor: i < 5 ? K_CORES[i] : i === 5 ? "#4a7fb0" : "#8a6d3b" })), ...(resto.length ? [{ nome: `Demais (${resto.length})`, v: resto.reduce((s, c) => s + c.total, 0), cor: K_NEUTRO }] : [])];
  if (rec > desp) destinos.push({ nome: "Sobra para o caixa", v: rec - desp, cor: "#1d7a4b" });
  const origens = [{ nome: "Receitas do período", v: rec, cor: "#054166" }];
  if (desp > rec) origens.push({ nome: "Saldo anterior consumido", v: desp - rec, cor: "#b4231a" });
  const total = Math.max(rec, desp);
  const W = 1200, H = 470, mt = 12, gapN = 10, nodeW = 18, xL = 210, xR = W - 330;
  const alturaUtil = (lista) => H - mt * 2 - gapN * (lista.length - 1);
  const esc = Math.min(alturaUtil(origens), alturaUtil(destinos)) / total;
  let g = "";
  const posicao = (lista) => { let y = mt; return lista.map((n) => { const h = Math.max(2, n.v * esc), o = { ...n, y, h }; y += h + gapN; return o; }); };
  const L = posicao(origens), R = posicao(destinos);
  // bandas: cada origem distribui proporcionalmente para os destinos
  const offL = L.map((n) => n.y), offR = R.map((n) => n.y);
  L.forEach((o, i) => {
    R.forEach((d, j) => {
      const v = (o.v / total) * d.v; const h = v * esc; if (h < 0.3) return;
      const y0 = offL[i], y1 = offR[j]; offL[i] += h; offR[j] += h;
      const x0 = xL + nodeW, x1 = xR, mx = (x0 + x1) / 2;
      g += `<path class="banda" d="M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h} C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h} Z" fill="${d.cor}" opacity=".32" data-tip="${kEsc(`${o.nome} → ${d.nome}\n${kBrl(v)}`)}"/>`;
    });
  });
  L.forEach((n) => { g += `<rect x="${xL}" y="${n.y}" width="${nodeW}" height="${n.h}" rx="4" fill="${n.cor}"/><text x="${xL - 12}" y="${n.y + n.h / 2 - 4}" text-anchor="end" class="no-t">${kEsc(n.nome)}</text><text x="${xL - 12}" y="${n.y + n.h / 2 + 14}" text-anchor="end" class="no-v">${kBrl(n.v)}</text>`; });
  R.forEach((n) => { g += `<rect x="${xR}" y="${n.y}" width="${nodeW}" height="${n.h}" rx="4" fill="${n.cor}"/><text x="${xR + nodeW + 12}" y="${n.y + n.h / 2 + 5}" class="no-t">${kEsc(n.nome)} <tspan class="no-v">${kCurto(n.v)} · ${kPct(n.v / total)}</tspan></text>`; });
  return kSvg(W, H, "Fluxo das receitas para as categorias de despesa", g, "fluxo");
}

// ------------------------------------------------------------------ ponte do período (cascata)
export function pontePeriodo(meses) {
  const cats = porCategoria(meses);
  const ini = meses[0].totais.saldoAnterior ?? 0, rec = meses.reduce((s, b) => s + b.totais.receitas, 0), fim = meses.at(-1).totais.saldoAtual;
  const passos = [{ nome: "Saldo inicial", v: ini, tipo: "base" }, { nome: "Receitas", v: rec, tipo: "mais" }, ...cats.map((c) => ({ nome: kCat(c.cat), v: -c.total, tipo: "menos" })), { nome: "Saldo final", v: fim, tipo: "base" }];
  let acc = 0; const bs = passos.map((p) => { if (p.tipo === "base") { acc = p.v; return { ...p, de: 0, ate: p.v }; } const o = { ...p, de: acc, ate: acc + p.v }; acc += p.v; return o; });
  const W = 1200, H = 430, ml = 74, mr = 16, mt = 30, mb = 96;
  const { lo, hi, t } = kEscala(Math.min(...bs.flatMap((b) => [b.de, b.ate, 0])), Math.max(...bs.flatMap((b) => [b.de, b.ate])));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / bs.length, w = Math.min(62, bw * 0.64);
  let g = kGrade(W, ml, mr, y, t);
  bs.forEach((b, i) => {
    const cx = ml + i * bw + bw / 2, x0 = cx - w / 2, top = Math.min(y(b.de), y(b.ate)), h = Math.max(1.5, Math.abs(y(b.de) - y(b.ate)));
    const fill = b.tipo === "base" ? (b.ate < 0 ? "#b4231a" : "url(#gRec)") : b.tipo === "mais" ? K_POS : K_NEG;
    g += `<g data-tip="${kEsc(`${b.nome}\n${kBrl(b.v)}`)}"><rect x="${x0}" y="${top}" width="${w}" height="${h}" rx="4" fill="${fill}"/></g>`;
    if (i < bs.length - 1) g += `<line x1="${x0 + w}" x2="${x0 + bw}" y1="${y(b.ate)}" y2="${y(b.ate)}" stroke="#9fb0c2" stroke-dasharray="3 3"/>`;
    g += `<text x="${cx}" y="${top - 7}" text-anchor="middle" class="val">${kCurto(b.v)}</text>`;
    g += `<text transform="translate(${cx} ${H - mb + 16}) rotate(-35)" text-anchor="end" class="eixo-cat">${kEsc(b.nome)}</text>`;
  });
  return kSvg(W, H, "Do saldo inicial ao saldo final do período", g);
}

// ------------------------------------------------------------------ tendência por categoria (pequenos múltiplos)
export function multiplos(meses) {
  const cats = porCategoria(meses), ms = meses.map((b) => b.mes);
  return `<div class="mult">${cats.map((c) => {
    const vals = ms.map((m) => c.porMes[m] || 0), mx = Math.max(...vals, 1), med = vals.reduce((a, v) => a + v, 0) / vals.length;
    const W = 260, H = 90, x = (i) => 4 + (i / Math.max(1, vals.length - 1)) * (W - 8), y = (v) => H - 6 - (v / mx) * (H - 16);
    const iMax = vals.indexOf(Math.max(...vals));
    const area = `M${x(0)},${H - 6} ${vals.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(vals.length - 1)},${H - 6} Z`;
    const svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${area}" fill="#0b5a8c" opacity=".12"/><line x1="4" x2="${W - 4}" y1="${y(med)}" y2="${y(med)}" stroke="#c98a00" stroke-dasharray="4 3"/>
      <polyline points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="#0b5a8c" stroke-width="2" stroke-linejoin="round"/>
      ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === iMax || i === vals.length - 1 ? 3.6 : 0}" fill="${i === iMax ? "#d9663a" : "#054166"}"/><rect x="${x(i) - (W / vals.length) / 2}" y="0" width="${W / vals.length}" height="${H}" fill="transparent" data-tip="${kEsc(`${c.cat} · ${rotuloMes(ms[i])}\n${kBrl(v)}`)}"/>`).join("")}</svg>`;
    return `<div class="mult-c"><div class="mult-h"><span>${kEsc(kCat(c.cat))}</span><b>${kCurto(c.total)}</b></div>${svg}
      <div class="mult-p"><span>média ${kCurto(med)}/mês</span><span>pico ${kMes(ms[iMax])}: ${kCurto(vals[iMax])}</span></div></div>`;
  }).join("")}</div>`;
}

// ------------------------------------------------------------------ concentração de fornecedores (Pareto)
export function pareto(meses, n = 15) {
  const fs = porFornecedor(meses), tot = fs.reduce((s, f) => s + f.total, 0), top = fs.slice(0, n);
  let acc = 0; const corte = fs.findIndex((f) => (acc += f.total) / tot >= 0.8) + 1; acc = 0;
  const W = 1200, lh = 32, ml = 330, mr = 190, H = top.length * lh + 30, m = top[0]?.total || 1;
  let g = `<text x="${ml}" y="14" class="eixo-x">Valor pago no período</text><text x="${W - 8}" y="14" text-anchor="end" class="eixo-x">acumulado</text>`;
  top.forEach((f, i) => {
    acc += f.total; const yy = 24 + i * lh, w = (f.total / m) * (W - ml - mr), dentro = i < corte;
    g += `<g data-tip="${kEsc(`${f.forn}\n${kBrl(f.total)} · ${f.n} lançamentos em ${f.meses.size} meses\nAcumulado até aqui: ${kPct(acc / tot)}`)}">`;
    g += `<text x="${ml - 12}" y="${yy + 18}" text-anchor="end" class="eixo-cat">${kEsc(f.forn.length > 40 ? f.forn.slice(0, 38) + "…" : f.forn)}</text>`;
    g += `<rect x="${ml}" y="${yy + 5}" width="${W - ml - mr}" height="20" rx="5" fill="#eef3f7"/>`;
    g += `<rect x="${ml}" y="${yy + 5}" width="${Math.max(3, w)}" height="20" rx="5" fill="${dentro ? "url(#gRec)" : "#9fb4c7"}"/>`;
    g += `<text x="${W - mr + 12}" y="${yy + 19}" class="val" style="font-size:12.5px">${kCurto(f.total)}</text>`;
    g += `<text x="${W - 8}" y="${yy + 19}" text-anchor="end" class="val" style="fill:${dentro ? "#054166" : "#7d8ea0"}">${kPct(acc / tot, 0)}</text></g>`;
    if (i === corte - 1 && corte < top.length) g += `<line x1="${ml - 300}" x2="${W - 4}" y1="${yy + lh + 1}" y2="${yy + lh + 1}" stroke="#fbb812" stroke-width="2" stroke-dasharray="6 4"/><rect x="${W - mr - 170}" y="${yy + lh - 10}" width="160" height="22" rx="11" fill="#fff7e0" stroke="#fbb812"/><text x="${W - mr - 90}" y="${yy + lh + 5}" text-anchor="middle" style="fill:#8a5a00;font-weight:700;font-size:12px">↑ 80% dos pagamentos</text>`;
  });
  return { svg: kSvg(W, H, "Concentração de pagamentos por fornecedor", g), corte, nForn: fs.length };
}

// ------------------------------------------------------------------ formas de pagamento
export function formasPagamento(meses) {
  const L = lancamentos(meses).filter((d) => !/tarifa|banc/i.test(d.cat));
  const grupo = (t) => /pix/i.test(t) ? "Pix" : /cart/i.test(t) ? "Cartão de crédito" : /d[ée]bito/i.test(t) ? "Débito automático" : /internet|boleto/i.test(t) ? "Boleto / transferência" : "Outros";
  const m = new Map(); for (const d of L) { const k = grupo(d.tipo); const o = m.get(k) || { v: 0, n: 0 }; o.v += d.v; o.n++; m.set(k, o); }
  const ordem = ["Boleto / transferência", "Pix", "Cartão de crédito", "Débito automático", "Outros"];
  const itens = ordem.filter((k) => m.has(k)).map((k, i) => ({ nome: k, ...m.get(k), cor: K_CORES[i] || K_NEUTRO }));
  const tot = itens.reduce((s, i) => s + i.v, 0);
  const R = 96, r = 62, cx = 115, cy = 115; let a0 = -Math.PI / 2, g = "";
  for (const f of itens) {
    const ang = (f.v / tot) * Math.PI * 2, s = a0 + 0.015, e = a0 + ang - 0.015, lg = e - s > Math.PI ? 1 : 0;
    const P = (rad, rr) => `${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`;
    if (e > s) g += `<path d="M${P(s, R)} A${R},${R} 0 ${lg} 1 ${P(e, R)} L${P(e, r)} A${r},${r} 0 ${lg} 0 ${P(s, r)} Z" fill="${f.cor}" data-tip="${kEsc(`${f.nome}\n${kBrl(f.v)} · ${f.n} pagamentos`)}"/>`;
    a0 += ang;
  }
  g += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="centro-l">pagamentos</text><text x="${cx}" y="${cy + 20}" text-anchor="middle" class="centro-v">${L.length}</text>`;
  const cartao = m.get("Cartão de crédito");
  return `<div class="rosca">${kSvg(230, 230, "Formas de pagamento", g)}<ul class="leg-tab">${itens.map((f) => `<li><i style="background:${f.cor}"></i><span class="nome">${f.nome}</span><span class="v">${kBrl(f.v)}</span><span class="p">${kPct(f.v / tot)}</span></li>`).join("")}</ul></div>
  ${cartao ? `<p class="small muted" style="margin-top:10px">${cartao.n} compras no cartão de crédito (${kBrl(cartao.v)}), em geral parceladas. Juros na fatura indicam que ela não foi paga integralmente.</p>` : ""}`;
}
