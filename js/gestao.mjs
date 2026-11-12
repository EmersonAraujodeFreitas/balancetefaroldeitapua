// Módulos de gestão: relatório do mês, projeção de caixa, detalhe de fornecedor,
// mapa de calor de categorias e acompanhamento dos alertas. Tudo derivado dos meses carregados.
import { rotuloMes, porCategoria, porFornecedor, parcelas, lancamentos } from "./analise.mjs";

const gBrl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const gPct = (v, d = 1) => (v * 100).toFixed(d).replace(".", ",") + "%";
const gEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const gCurto = (v) => { const a = Math.abs(v), s = v < 0 ? "−" : ""; return a >= 1e6 ? s + (a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : a >= 1000 ? s + (a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil" : s + Math.round(a).toLocaleString("pt-BR"); };
const gMesCurto = (k) => rotuloMes(k).replace("/20", "/");
const G_INVEST = /obras|imobilizado/i;
const G_PARC = /Parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;
function gEscala(min, max, n = 5) {
  const span = max - min || 1, p0 = span / n, p10 = 10 ** Math.floor(Math.log10(p0));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= p0);
  const lo = Math.floor(min / passo) * passo, hi = Math.ceil(max / passo) * passo, t = [];
  for (let v = lo; v <= hi + 1e-9; v += passo) t.push(Math.round(v * 100) / 100);
  return { lo, hi, t };
}
const gGrade = (W, ml, mr, y, t) => t.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "var(--line-2)" : "var(--line)"}"/><text x="${ml - 8}" y="${y(v) + 4}" text-anchor="end">${gCurto(v)}</text>`).join("");
const proxMes = (k, n = 1) => { let [a, m] = k.split("-").map(Number); m += n; while (m > 12) { m -= 12; a++; } while (m < 1) { m += 12; a--; } return `${a}-${String(m).padStart(2, "0")}`; };
function variacao(atual, ref, menorMelhor) {
  if (ref === null || ref === undefined || !isFinite(ref) || Math.abs(ref) < 0.01) return `<span class="delta neutro">–</span>`;
  const v = (atual - ref) / Math.abs(ref), bom = menorMelhor ? v < 0 : v > 0;
  return `<span class="delta ${Math.abs(v) < 0.005 ? "neutro" : bom ? "bom" : "ruim"}">${v > 0 ? "▲" : v < 0 ? "▼" : "■"} ${gPct(Math.abs(v))}</span>`;
}

// ------------------------------------------------------------------ relatório do mês
function cascata(b) {
  const cats = porCategoria([b]);
  const passos = [{ nome: "Saldo anterior", v: b.totais.saldoAnterior ?? 0, tipo: "base" }, { nome: "Receitas", v: b.totais.receitas, tipo: "mais" },
    ...cats.map((c) => ({ nome: c.cat, v: -c.total, tipo: "menos" })), { nome: "Saldo final", v: b.totais.saldoAtual, tipo: "base" }];
  let acc = 0; const barras = [];
  for (const p of passos) {
    if (p.tipo === "base") { barras.push({ ...p, de: 0, ate: p.v }); acc = p.v; }
    else { barras.push({ ...p, de: acc, ate: acc + p.v }); acc += p.v; }
  }
  const W = 1040, H = 380, ml = 66, mr = 12, mt = 26, mb = 92;
  const vals = barras.flatMap((x) => [x.de, x.ate, 0]);
  const { lo, hi, t } = gEscala(Math.min(...vals), Math.max(...vals));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / barras.length, w = Math.min(54, bw * 0.62);
  let g = gGrade(W, ml, mr, y, t);
  barras.forEach((x, i) => {
    const cx = ml + i * bw + bw / 2, x0 = cx - w / 2, top = Math.min(y(x.de), y(x.ate)), h = Math.max(1, Math.abs(y(x.de) - y(x.ate)));
    const cor = x.tipo === "base" ? (x.ate < 0 ? "var(--crit)" : "var(--brand)") : x.tipo === "mais" ? "#2a9d8f" : "#d9663a";
    g += `<rect x="${x0}" y="${top}" width="${w}" height="${h}" rx="3" fill="${cor}" data-tip="${gEsc(`${x.nome}: ${gBrl(x.v)}`)}"/>`;
    if (i < barras.length - 1) { const yy = y(x.ate); g += `<line x1="${x0 + w}" x2="${x0 + bw}" y1="${yy}" y2="${yy}" stroke="var(--line-2)" stroke-dasharray="3 3"/>`; }
    g += `<text x="${cx}" y="${top - 6}" text-anchor="middle" class="anot" style="font-size:12px">${gCurto(x.v)}</text>`;
    const nome = x.nome.replace(" e encargos bancários", " bancárias").replace("Consumo (água e energia)", "Água e energia").replace("Prestação de serviços", "Serviços").replace("Locação de equipamentos", "Locação").replace("Impostos e tributos", "Impostos");
    g += `<text transform="translate(${cx} ${H - mb + 14}) rotate(-35)" text-anchor="end" class="cat" style="font-size:12.5px">${gEsc(nome)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Do saldo anterior ao saldo final do mês">${g}</svg>`;
}

export function renderMes(todos, mes, alertas, el) {
  if (!todos.length) { el.innerHTML = `<div class="vazio card">Nenhum balancete carregado.</div>`; return; }
  if (!todos.some((b) => b.mes === mes)) mes = todos.at(-1).mes;
  const i = todos.findIndex((b) => b.mes === mes), b = todos[i], ant = todos[i - 1];
  const hist = todos.slice(Math.max(0, i - 6), i);
  const med = (f) => hist.length ? hist.reduce((s, x) => s + f(x), 0) / hist.length : null;
  const inv = (x) => x.despesas.filter((d) => G_INVEST.test(d.cat)).reduce((s, d) => s + d.v, 0);
  const t = b.totais;
  const tiles = [
    ["Receita", t.receitas, ant?.totais.receitas, med((x) => x.totais.receitas), false],
    ["Despesa", t.despesas, ant?.totais.despesas, med((x) => x.totais.despesas), true],
    ["Resultado", t.receitas - t.despesas, ant ? ant.totais.receitas - ant.totais.despesas : null, med((x) => x.totais.receitas - x.totais.despesas), false],
    ["Saldo final", t.saldoAtual, ant?.totais.saldoAtual, null, false],
    ["Investimentos", inv(b), ant ? inv(ant) : null, med(inv), true],
  ];
  const catsMes = porCategoria([b]), catsAnt = ant ? porCategoria([ant]) : [], catsHist = porCategoria(hist);
  const linhasCat = catsMes.map((c) => {
    const a = catsAnt.find((x) => x.cat === c.cat)?.total ?? 0, m = hist.length ? (catsHist.find((x) => x.cat === c.cat)?.total ?? 0) / hist.length : null;
    return `<tr><td>${gEsc(c.cat)}</td><td class="n"><b>${gBrl(c.total)}</b></td><td class="n">${ant ? gBrl(a) : "–"}</td><td class="n">${ant ? variacao(c.total, a, true) : "–"}</td><td class="n">${m !== null ? gBrl(m) : "–"}</td><td class="n">${m !== null ? variacao(c.total, m, true) : "–"}</td><td class="n mini">${gPct(c.total / t.despesas)}</td></tr>`;
  }).join("");
  const top = [...b.despesas].sort((x, y) => y.v - x.v).slice(0, 12);
  const alertasMes = alertas.filter((a) => a.mes === mes || a.ids.some((id) => typeof id === "string" && id.startsWith(mes + "#")));
  const notas = (b.notas || []).filter((n) => n.grupo === "específica");
  const recRows = b.receitas.map((r) => `<tr><td>${gEsc(r.desc)}</td><td class="n ${r.v < 0 ? "neg" : ""}">${gBrl(r.v)}</td></tr>`).join("");
  const opts = todos.map((x) => `<option value="${x.mes}" ${x.mes === mes ? "selected" : ""}>${rotuloMes(x.mes)}</option>`).join("");
  el.innerHTML = `
  <div class="card barra-mes">
    <div class="cab-secao"><span class="eyebrow">Relatório mensal</span><h2>${rotuloMes(mes).replace("/", " de ")}</h2>
      <span class="small muted">Período ${gEsc(b.periodo || "")} · emitido em ${gEsc(b.emissao)} · ${b.despesas.length} lançamentos</span></div>
    <div class="acoes"><button class="btn sec" type="button" data-mes="${ant?.mes || ""}" ${ant ? "" : "disabled"}>◀ Anterior</button>
      <select id="selMes" aria-label="Mês">${opts}</select>
      <button class="btn sec" type="button" data-mes="${todos[i + 1]?.mes || ""}" ${todos[i + 1] ? "" : "disabled"}>Próximo ▶</button></div>
  </div>
  <div class="comp-tiles">${tiles.map(([n, v, a, m, mm]) => `<div class="comp"><span class="eyebrow">${n}</span><b style="${v < 0 ? "color:var(--crit)" : ""}">${gBrl(v)}</b>
    <span class="det">${a !== undefined && a !== null ? `${variacao(v, a, mm)} <span class="muted">vs mês anterior</span>` : `<span class="muted">primeiro mês</span>`}</span>
    ${m !== null ? `<span class="det">${variacao(v, m, mm)} <span class="muted">vs média de ${hist.length} meses</span></span>` : ""}</div>`).join("")}</div>
  <div class="card chart"><div class="cab"><div class="cab-secao"><span class="eyebrow">Ponte do caixa</span><h2>Do saldo anterior ao saldo final</h2></div>
    <div class="legenda"><span><i style="background:var(--brand)"></i>Saldo</span><span><i style="background:#2a9d8f"></i>Entradas</span><span><i style="background:#d9663a"></i>Saídas por categoria</span></div></div>
    <div style="margin-top:10px">${cascata(b)}</div></div>
  <div class="card"><div class="cab-secao"><span class="eyebrow">Despesas do mês</span><h2>Por categoria, comparadas</h2></div>
      <div class="tabela" style="margin-top:12px"><table><thead><tr><th>Categoria</th><th class="n">Mês</th><th class="n">Anterior</th><th class="n">Var.</th><th class="n">Média</th><th class="n">Var.</th><th class="n">%</th></tr></thead><tbody>${linhasCat}
      <tr class="total"><td>Total</td><td class="n">${gBrl(t.despesas)}</td><td class="n">${ant ? gBrl(ant.totais.despesas) : "–"}</td><td class="n">${ant ? variacao(t.despesas, ant.totais.despesas, true) : ""}</td><td class="n">${hist.length ? gBrl(med((x) => x.totais.despesas)) : "–"}</td><td></td><td></td></tr></tbody></table></div></div>
  <div class="card"><div class="cab"><div class="cab-secao"><span class="eyebrow">Maiores saídas</span><h2>12 maiores lançamentos do mês</h2></div><a href="#lancamentos" class="small" data-filtra-mes="${mes}">Ver todos os lançamentos do mês</a></div>
    <div class="tabela" style="margin-top:12px"><table><thead><tr><th>Fornecedor</th><th>Histórico</th><th>Baixa</th><th>NF</th><th class="n">Valor</th><th class="n">% do mês</th></tr></thead><tbody>
    ${top.map((d) => `<tr><td><button class="link" type="button" data-detalhe-forn="${gEsc(d.forn)}">${gEsc(d.forn)}</button>${d.semDoc ? ' <span class="pill media">sem doc.</span>' : ""}</td><td class="mini">${gEsc(d.desc)}</td><td>${gEsc(d.baixa)}</td><td>${gEsc(d.nf)}</td><td class="n"><b>${gBrl(d.v)}</b></td><td class="n mini">${gPct(d.v / t.despesas)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="grid2">
    <div class="card"><div class="cab-secao"><span class="eyebrow">Fiscalização</span><h2>Alertas ligados a este mês (${alertasMes.length})</h2></div>
      <div class="toplista" style="margin-top:10px">${alertasMes.length ? alertasMes.map((a) => `<a href="#alertas"><span class="pill ${a.sev}">${a.sev === "media" ? "média" : a.sev}</span><span class="t">${gEsc(a.titulo)}</span></a>`).join("") : `<p class="muted">Nenhum alerta neste mês.</p>`}</div></div>
<div class="card"><div class="cab-secao"><span class="eyebrow">Entradas do mês</span><h2>Composição da receita</h2></div>
      <div class="tabela" style="margin-top:12px"><table><thead><tr><th>Item</th><th class="n">Valor</th></tr></thead><tbody>${recRows}<tr class="total"><td>Total</td><td class="n">${gBrl(t.receitas)}</td></tr></tbody></table></div>
      <p class="small muted" style="margin-top:10px">Valores negativos são descontos feitos na arrecadação (taxa da administradora e tarifas de cobrança).</p></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="cab-secao"><span class="eyebrow">Administradora</span><h2>Notas explicativas do mês</h2></div>
      <div style="margin-top:10px;display:grid;gap:10px">${notas.length ? notas.map((n) => `<p class="nota">${gEsc(n.texto)}</p>`).join("") : `<p class="muted">Sem notas específicas neste mês.</p>`}</div></div>
  </div>`;
}

// ------------------------------------------------------------------ projeção de caixa
export function projecao(todos, horizonte = 6) {
  const n = todos.length; if (n < 3) return null;
  const ult = todos.at(-1);
  // gasto corrente = tudo menos obras/bens e menos parcelas de compras (a folha parcelada continua contando)
  const correntesSemParcela = (b) => b.despesas.filter((d) => !G_INVEST.test(d.cat) && !(G_PARC.test(d.desc) && !/pessoal/i.test(d.cat))).reduce((s, d) => s + d.v, 0);
  const ult3 = todos.slice(-3), ult6 = todos.slice(-6);
  const recBase = todos.slice(-2).reduce((s, b) => s + b.totais.receitas, 0) / Math.min(2, n);
  const corr = ult3.reduce((s, b) => s + correntesSemParcela(b), 0) / ult3.length;
  const serie6 = ult6.map(correntesSemParcela), m6 = serie6.reduce((a, b) => a + b, 0) / serie6.length;
  const dp = Math.sqrt(serie6.reduce((a, b) => a + (b - m6) ** 2, 0) / serie6.length);
  const ps = parcelas(todos);
  const compra = (p) => !/LOGOSERV|LOGO /i.test(p.forn) || !/SAL[ÁA]RIO/i.test(p.item);
  const vigentes = ps.filter((p) => p.aPagar > 0 && !p.interrompida && compra(p)), paradas = ps.filter((p) => p.interrompida && compra(p));
  const atraso = paradas.reduce((s, p) => s + p.aPagar, 0);
  const meses = [];
  let sb = ult.totais.saldoAtual, so = sb, sp = sb;
  for (let k = 1; k <= horizonte; k++) {
    const mes = proxMes(ult.mes, k);
    const parc = vigentes.reduce((s, p) => s + (k <= p.restantes ? p.valorParcela : 0), 0);
    const base = recBase - corr - parc;
    sb += base; so += base + dp; sp += base - dp - (k === 1 ? atraso : 0);
    meses.push({ mes, receita: recBase, correntes: corr, parcelas: parc, resultado: base, saldo: sb, otimista: so, pessimista: sp });
  }
  return { ult, recBase, corr, dp, atraso, paradas, vigentes, meses };
}

export function renderProjecao(todos, el) {
  const p = projecao(todos);
  if (!p) { el.innerHTML = `<div class="vazio card">São necessários pelo menos 3 meses de balancetes para projetar o caixa.</div>`; return; }
  const W = 1040, H = 340, ml = 70, mr = 20, mt = 20, mb = 36;
  const hist = todos.slice(-6).map((b) => ({ mes: b.mes, saldo: b.totais.saldoAtual }));
  const pts = [...hist, ...p.meses];
  const vals = [...hist.map((h) => h.saldo), ...p.meses.flatMap((m) => [m.otimista, m.pessimista]), 0];
  const { lo, hi, t } = gEscala(Math.min(...vals), Math.max(...vals));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const x = (i) => ml + (i / (pts.length - 1)) * (W - ml - mr);
  let g = gGrade(W, ml, mr, y, t);
  if (lo < 0) g += `<rect x="${ml}" y="${y(0)}" width="${W - ml - mr}" height="${y(lo) - y(0)}" fill="var(--crit-soft)" opacity=".6"/>`;
  const i0 = hist.length - 1;
  g += `<line x1="${x(i0)}" x2="${x(i0)}" y1="${mt}" y2="${H - mb}" stroke="var(--line-2)" stroke-dasharray="4 4"/><text x="${x(i0) + 6}" y="${mt + 12}">projeção ▶</text>`;
  const banda = [[x(i0), y(hist.at(-1).saldo)], ...p.meses.map((m, k) => [x(i0 + k + 1), y(m.otimista)])];
  const banda2 = [...p.meses.map((m, k) => [x(i0 + k + 1), y(m.pessimista)])].reverse();
  g += `<path d="M${[...banda, ...banda2].map((q) => q.join(",")).join(" L")} Z" fill="var(--gold)" opacity=".18"/>`;
  g += `<polyline points="${hist.map((h, i) => `${x(i)},${y(h.saldo)}`).join(" ")}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>`;
  g += `<polyline points="${[[x(i0), y(hist.at(-1).saldo)], ...p.meses.map((m, k) => [x(i0 + k + 1), y(m.saldo)])].map((q) => q.join(",")).join(" ")}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-dasharray="6 4"/>`;
  pts.forEach((q, i) => {
    const v = q.saldo, real = i <= i0;
    g += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${v < 0 ? "var(--crit)" : real ? "var(--brand)" : "var(--gold)"}" stroke="var(--surface)" stroke-width="1.5" data-tip="${gEsc(`${rotuloMes(q.mes)} · ${real ? "saldo real" : "saldo projetado"} ${gBrl(v)}${real ? "" : ` (faixa ${gBrl(q.pessimista)} a ${gBrl(q.otimista)})`}`)}"/>`;
    g += `<text x="${x(i)}" y="${H - mb + 18}" text-anchor="middle" style="${real ? "" : "font-style:italic"}">${gMesCurto(q.mes)}</text>`;
  });
  const fim = p.meses.at(-1), minP = p.meses.reduce((a, m) => (m.pessimista < a.pessimista ? m : a));
  const despMedia = p.corr + (p.meses[0]?.parcelas || 0);
  const reservaMeta = despMedia; const sobra = p.meses[0].resultado;
  el.innerHTML = `
  <div class="card"><div class="cab-secao"><span class="eyebrow">Leitura da projeção</span><h2>Próximos ${p.meses.length} meses</h2></div>
    <ul class="conclusoes">
      <li>Mantido o ritmo atual, o saldo vai de ${gBrl(p.ult.totais.saldoAtual)} (${rotuloMes(p.ult.mes)}) para cerca de <b>${gBrl(fim.saldo)}</b> em ${rotuloMes(fim.mes)}.</li>
      <li>Sobra mensal prevista de ${gBrl(sobra)}: receita de ${gBrl(p.recBase)} menos ${gBrl(p.corr)} de gastos correntes e ${gBrl(p.meses[0].parcelas)} de parcelas já assumidas.
        Para comparar, a sobra real dos últimos meses foi de ${todos.slice(-3).map((b) => `${gBrl(b.totais.receitas - b.totais.despesas)} (${gMesCurto(b.mes)})`).join(", ")}; a diferença vem de obras e compras novas, que a projeção não supõe.</li>
      <li>${minP.pessimista < 0 ? `No cenário pessimista o caixa fica negativo (${gBrl(minP.pessimista)} em ${rotuloMes(minP.mes)}).` : `Mesmo no cenário pessimista o caixa se mantém positivo (mínimo de ${gBrl(minP.pessimista)}).`}${p.atraso ? ` O pessimista considera ${gBrl(p.atraso)} de parcelamentos parados cobrados de uma vez.` : ""}</li>
      <li>Uma reserva de um mês de despesa (${gBrl(reservaMeta)}) ${sobra > 0 ? `levaria cerca de ${Math.max(0, Math.ceil((reservaMeta - p.ult.totais.saldoAtual) / sobra))} meses para ser formada com a sobra atual` : "não se forma com o resultado atual"}.</li>
    </ul></div>
  <div class="card chart"><div class="cab"><div class="cab-secao"><span class="eyebrow">Saldo de caixa</span><h2>Realizado e projetado</h2></div>
    <div class="legenda"><span><i class="linha" style="background:var(--brand)"></i>Realizado</span><span><i class="linha" style="background:var(--gold)"></i>Projeção</span><span><i style="background:var(--gold);opacity:.35"></i>Faixa otimista–pessimista</span></div></div>
    <div style="margin-top:10px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo realizado e projetado">${g}</svg></div></div>
  <div class="tabela"><table><thead><tr><th>Mês</th><th class="n">Receita prevista</th><th class="n">Gastos correntes</th><th class="n">Parcelas assumidas</th><th class="n">Resultado</th><th class="n">Saldo projetado</th><th class="n">Pessimista</th><th class="n">Otimista</th></tr></thead><tbody>
    ${p.meses.map((m) => `<tr><td>${rotuloMes(m.mes)}</td><td class="n">${gBrl(m.receita)}</td><td class="n">${gBrl(m.correntes)}</td><td class="n">${gBrl(m.parcelas)}</td><td class="n ${m.resultado < 0 ? "neg" : ""}">${gBrl(m.resultado)}</td><td class="n ${m.saldo < 0 ? "neg" : ""}"><b>${gBrl(m.saldo)}</b></td><td class="n ${m.pessimista < 0 ? "neg" : ""}">${gBrl(m.pessimista)}</td><td class="n">${gBrl(m.otimista)}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="card texto" style="max-width:none"><h3>Como a projeção é calculada</h3>
    <ul><li>Receita: média dos 2 últimos meses (captura reajustes recentes da cota).</li>
    <li>Gastos correntes: média dos 3 últimos meses de todas as despesas, menos obras, compras de bens e parcelas de compras (a folha de pessoal entra integralmente).</li>
    <li>Parcelas assumidas: o valor de cada parcelamento em dia até a última parcela.</li>
    <li>Faixa: ± o desvio-padrão dos gastos correntes dos 6 últimos meses (${gBrl(p.dp)}); o pessimista inclui ainda os parcelamentos parados no primeiro mês.</li>
    <li>Não inclui obras novas, rateios extras nem inadimplência acima da atual.</li></ul></div>`;
}

// ------------------------------------------------------------------ detalhe de fornecedor
export function renderFornecedor(meses, forn, alertas, el) {
  const fs = porFornecedor(meses), f = fs.find((x) => x.forn === forn) || fs[0];
  if (!f) { el.innerHTML = ""; return; }
  const L = lancamentos(meses).filter((d) => d.forn === f.forn);
  const tot = fs.reduce((s, x) => s + x.total, 0);
  const porMes = meses.map((b) => ({ mes: b.mes, v: L.filter((d) => d.mes === b.mes).reduce((s, d) => s + d.v, 0) }));
  const W = 1040, H = 220, ml = 62, mr = 12, mt = 14, mb = 30;
  const { lo, hi, t } = gEscala(0, Math.max(...porMes.map((m) => m.v), 1), 4);
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / porMes.length, w = Math.min(36, bw * 0.6);
  let g = gGrade(W, ml, mr, y, t);
  porMes.forEach((m, i) => {
    const x0 = ml + i * bw + (bw - w) / 2;
    if (m.v > 0) g += `<rect x="${x0}" y="${y(m.v)}" width="${w}" height="${y(0) - y(m.v)}" rx="3" fill="var(--accent)" data-tip="${gEsc(`${rotuloMes(m.mes)} · ${gBrl(m.v)}`)}"/>`;
    g += `<text x="${x0 + w / 2}" y="${H - mb + 18}" text-anchor="middle">${porMes.length > 14 && i % 2 ? "" : gMesCurto(m.mes)}</text>`;
  });
  const rel = alertas.filter((a) => a.forn === f.forn || a.titulo.includes(f.forn));
  const nfs = [...new Set(L.map((d) => d.nf).filter((n) => n && !/RECIBO|BOLETO|DARF|FATURA|COMPROVAN/i.test(n)))];
  const semNf = L.filter((d) => /RECIBO|COMPROVAN/i.test(d.nf)).length;
  const opts = fs.map((x) => `<option ${x.forn === f.forn ? "selected" : ""}>${gEsc(x.forn)}</option>`).join("");
  el.innerHTML = `
  <div class="card">
    <div class="cab"><div class="cab-secao"><span class="eyebrow">Ficha do fornecedor</span><h2>${gEsc(f.forn)}</h2>
      <span class="small muted">${gEsc([...f.cats].join(" · "))}</span></div>
      <select id="selForn" aria-label="Escolher fornecedor" style="max-width:340px">${opts}</select></div>
    <div class="comp-tiles" style="margin-top:14px">
      <div class="comp"><span class="eyebrow">Total pago</span><b>${gBrl(f.total)}</b><span class="det muted">${gPct(f.total / tot)} de todas as despesas</span></div>
      <div class="comp"><span class="eyebrow">Lançamentos</span><b>${f.n}</b><span class="det muted">em ${f.meses.size} de ${meses.length} meses</span></div>
      <div class="comp"><span class="eyebrow">Média por mês pago</span><b>${gBrl(f.total / f.meses.size)}</b><span class="det muted">${rotuloMes(f.primeiro)} a ${rotuloMes(f.ultimo)}</span></div>
      <div class="comp"><span class="eyebrow">Documentação</span><b>${nfs.length} NFs</b><span class="det ${semNf ? "" : "muted"}" style="${semNf ? "color:var(--warn);font-weight:600" : ""}">${semNf ? `${semNf} pagamento(s) só com recibo` : "todos com documento"}</span></div>
    </div>
    <div class="chart" style="margin-top:16px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pagamentos por mês">${g}</svg></div>
    ${rel.length ? `<div style="margin-top:14px"><span class="eyebrow">Alertas deste fornecedor</span><div class="toplista" style="margin-top:6px">${rel.map((a) => `<a href="#alertas"><span class="pill ${a.sev}">${a.sev === "media" ? "média" : a.sev}</span><span class="t">${gEsc(a.titulo)}</span></a>`).join("")}</div></div>` : ""}
    <div class="tabela" style="margin-top:14px;max-height:420px;overflow:auto"><table><thead><tr><th>Mês</th><th>Histórico</th><th>Ref.</th><th>Baixa</th><th>NF</th><th class="n">Valor</th></tr></thead><tbody>
      ${[...L].reverse().map((d) => `<tr><td>${rotuloMes(d.mes)}</td><td class="mini">${gEsc(d.desc)}</td><td>${gEsc(d.ref)}</td><td>${gEsc(d.baixa)}</td><td>${gEsc(d.nf)}</td><td class="n">${gBrl(d.v)}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

// ------------------------------------------------------------------ mapa de calor
export function mapaCalor(meses) {
  const cats = porCategoria(meses), ms = meses.map((b) => b.mes);
  const max = Math.max(...cats.flatMap((c) => ms.map((m) => c.porMes[m] || 0)), 1);
  const cor = (v) => { if (!v) return ""; const a = Math.max(0.06, Math.sqrt(v / max)); return `background:rgba(11,90,140,${a.toFixed(2)});color:${a > 0.55 ? "#fff" : "var(--ink)"};${a > 0.55 ? "font-weight:600;" : ""}`; };
  const totMes = Object.fromEntries(meses.map((b) => [b.mes, b.totais.despesas]));
  const tot = cats.reduce((s, c) => s + c.total, 0);
  return `<thead><tr><th>Categoria</th>${ms.map((m) => `<th class="n">${gMesCurto(m)}</th>`).join("")}<th class="n">Total</th><th class="n">%</th></tr></thead><tbody>
    ${cats.map((c) => `<tr><td>${gEsc(c.cat)}</td>${ms.map((m) => { const v = c.porMes[m] || 0; return `<td class="n calor" style="${cor(v)}" data-tip="${gEsc(`${c.cat} · ${rotuloMes(m)} · ${gBrl(v)}`)}">${v ? gCurto(v) : "–"}</td>`; }).join("")}<td class="n"><b>${gBrl(c.total)}</b></td><td class="n mini">${gPct(c.total / tot)}</td></tr>`).join("")}
    <tr class="total"><td>Total</td>${ms.map((m) => `<td class="n">${gCurto(totMes[m])}</td>`).join("")}<td class="n">${gBrl(tot)}</td><td></td></tr></tbody>`;
}

// ------------------------------------------------------------------ acompanhamento dos alertas
export const SITUACOES = { pendente: "Pendente", questionado: "Questionado", respondido: "Respondido", resolvido: "Resolvido", descartado: "Não procede" };
export function chaveAlerta(a) {
  const base = `${a.tipo}|${a.forn || ""}|${a.titulo.replace(/R\$\s?[−-]?[\d.,]+/g, "").replace(/\d+ (pontos|lançamento\(s\)|pagamento\(s\)|meses|mês)/g, "")}`;
  let h = 0; for (const c of base) h = (h * 31 + c.charCodeAt(0)) | 0;
  return "a" + (h >>> 0).toString(36);
}
