// Motor de análise: tudo é derivado dos meses carregados, sem regras presas a um período.
// Um mês, categoria ou fornecedor novo entra automaticamente em todos os cálculos e alertas.

export const MES_ABR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const rotuloMes = (k) => { const [a, m] = k.split("-"); return `${MES_ABR[+m - 1]}/${a}`; };
export const r2 = (x) => Math.round(x * 100) / 100;
const NF_GENERICA = /^(RECIBO|BOLETO|DARF|FATURA|FATURAMEN.*|COMPROVAN.*|AP[ÓO]LICE|DAJE|diversas)?$/i;
const PARC = /Parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;
const soma = (arr, f = (x) => x) => r2(arr.reduce((s, x) => s + f(x), 0));
const mediana = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

export function lancamentos(meses) {
  const out = [];
  for (const b of meses) b.despesas.forEach((d, i) => out.push({ ...d, mes: b.mes, id: `${b.mes}#${i}` }));
  return out;
}

export function resumoMensal(meses) {
  return meses.map((b) => {
    const t = b.totais;
    return {
      mes: b.mes, receita: t.receitas, despesa: t.despesas, resultado: r2(t.receitas - t.despesas),
      saldoAnterior: t.saldoAnterior, saldo: t.saldoAtual,
      cota: Math.max(0, ...b.receitas.map((r) => r.v)),
    };
  });
}

export function porCategoria(meses) {
  const cats = new Map();
  for (const b of meses) for (const d of b.despesas) {
    if (!cats.has(d.cat)) cats.set(d.cat, {});
    const c = cats.get(d.cat); c[b.mes] = r2((c[b.mes] || 0) + d.v);
  }
  return [...cats.entries()].map(([cat, pm]) => ({ cat, porMes: pm, total: soma(Object.values(pm)) }))
    .sort((a, b) => b.total - a.total);
}

export function porFornecedor(meses) {
  const m = new Map();
  for (const b of meses) for (const d of b.despesas) {
    const f = m.get(d.forn) || { forn: d.forn, total: 0, n: 0, meses: new Set(), cats: new Set(), primeiro: b.mes, ultimo: b.mes };
    f.total = r2(f.total + d.v); f.n++; f.meses.add(b.mes); f.cats.add(d.cat);
    if (b.mes < f.primeiro) f.primeiro = b.mes; if (b.mes > f.ultimo) f.ultimo = b.mes;
    m.set(d.forn, f);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

// Séries de parcelas ("Parcela 03/10"). A administradora às vezes troca a NF ou a descrição
// entre parcelas, então a série é reconhecida por fornecedor + item + nº total + valor da parcela.
export function parcelas(meses) {
  if (!meses.length) return [];
  const ordem = meses.map((b) => b.mes);
  const series = new Map();
  for (const d of lancamentos(meses)) {
    const p = d.desc.match(PARC); if (!p) continue;
    const chave = `${d.forn}|${p[2]}|${Math.round(d.v)}`;
    const s = series.get(chave) || { grupo: `${d.forn}|${d.item}|${p[2]}`, forn: d.forn, item: d.item, nf: d.nf,
      desc: d.det.replace(PARC, "").replace(/^[\s\-–.]+/, "") || d.item, de: +p[2], pagamentos: [] };
    s.pagamentos.push({ mes: d.mes, n: +p[1], v: d.v, id: d.id, nf: d.nf });
    series.set(chave, s);
  }
  const lista = [...series.values()];
  // continuação do mesmo item com outro valor (ex.: parcela 01 de um valor e 02–04 de outro)
  const continuacoes = {};
  for (const s of lista) {
    const ini = s.pagamentos.reduce((a, b) => (b.mes < a.mes ? b : a));
    const minN = Math.min(...s.pagamentos.map((p) => p.n));
    if (minN > 1) (continuacoes[s.grupo] ||= []).push(ini.mes);
  }
  const ultimoMes = ordem[ordem.length - 1];
  return lista.map((s) => {
    s.pagamentos.sort((a, b) => a.mes.localeCompare(b.mes) || a.n - b.n);
    const ult = s.pagamentos[s.pagamentos.length - 1];
    const maxN = Math.max(...s.pagamentos.map((p) => p.n));
    const restantes = Math.max(0, s.de - maxN);
    const nums = s.pagamentos.map((p) => p.n);
    const repetidas = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];
    const substituida = (continuacoes[s.grupo] || []).some((m) => m > ult.mes) ||
      lista.some((o) => o !== s && o.grupo === s.grupo && Math.max(...o.pagamentos.map((p) => p.n)) > maxN);
    const mesesSemPagar = ordem.length - 1 - ordem.indexOf(ult.mes);
    const vigente = restantes > 0 && !substituida;
    return { ...s, ultimaParcela: maxN, restantes, valorParcela: ult.v, ultimoMes: ult.mes, repetidas, substituida,
      aPagar: vigente ? r2(restantes * ult.v) : 0,
      interrompida: vigente && mesesSemPagar >= 2, ativa: vigente && ult.mes === ultimoMes };
  }).sort((a, b) => b.aPagar - a.aPagar);
}

function custosFinanceiros(meses) {
  const juros = [], iof = [], jurosCartao = [];
  for (const b of meses) for (const d of b.despesas) {
    if (/^JUROS/i.test(d.desc)) (/Cart/i.test(d.tipo) ? jurosCartao : juros).push({ ...d, mes: b.mes });
    else if (/^IOF/i.test(d.desc)) iof.push({ ...d, mes: b.mes });
  }
  const multas = [];
  for (const b of meses) for (const n of b.notas || []) {
    if (!/juros|multa|encargo|acr[ée]scimo/i.test(n.texto)) continue;
    const vals = [...n.texto.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((m) => +m[1].replace(/\./g, "").replace(",", "."));
    // usa o valor dos encargos (o menor citado, já que a nota às vezes cita também o valor do boleto)
    const enc = n.texto.match(/(?:encargos?|acr[ée]scimo|juros\/multa)[^R]*R\$\s*([\d.]+,\d{2})/i);
    const v = enc ? +enc[1].replace(/\./g, "").replace(",", ".") : (vals.length ? Math.min(...vals) : 0);
    if (v > 0) multas.push({ mes: b.mes, v, texto: n.texto });
  }
  return { juros, iof, jurosCartao, multas,
    total: r2(soma(juros, (x) => x.v) + soma(iof, (x) => x.v) + soma(jurosCartao, (x) => x.v) + soma(multas, (x) => x.v)) };
}

export function indicadores(meses) {
  const rm = resumoMensal(meses);
  const fin = custosFinanceiros(meses);
  const receita = soma(rm, (x) => x.receita), despesa = soma(rm, (x) => x.despesa);
  const menor = rm.reduce((a, b) => (b.saldo < a.saldo ? b : a), rm[0] || { saldo: 0 });
  const cats = porCategoria(meses);
  const pessoal = cats.find((c) => /pessoal/i.test(c.cat));
  const parc = parcelas(meses);
  return { rm, receita, despesa, resultado: r2(receita - despesa), saldoFinal: rm.length ? rm[rm.length - 1].saldo : 0,
    menor, fin, cats, pessoalPct: pessoal && receita ? pessoal.total / receita : 0,
    compromissos: soma(parc.filter((p) => !p.interrompida), (p) => p.aPagar), parc };
}

// ------------------------------------------------------------------ alertas
const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function alertas(meses) {
  const A = [];
  const add = (sev, tipo, titulo, detalhe, pergunta, ids = [], mes = null) => A.push({ sev, tipo, titulo, detalhe, pergunta, ids, mes });
  if (!meses.length) return A;
  const ordem = meses.map((b) => b.mes);
  const L = lancamentos(meses);
  const ult = ordem[ordem.length - 1];

  // 1. saldo negativo / déficit
  const neg = meses.filter((b) => b.totais.saldoAtual < 0);
  if (neg.length) add("alta", "Liquidez", `Saldo negativo em ${neg.length} ${neg.length > 1 ? "meses" : "mês"}`,
    `Fechamentos negativos: ${neg.map((b) => `${rotuloMes(b.mes)} (${fmt(b.totais.saldoAtual)})`).join("; ")}. Saldo negativo gera juros e IOF de cheque especial e atraso de fornecedores.`,
    "Qual o plano para recompor o caixa e evitar uso do limite da conta?", [], neg[neg.length - 1].mes);
  const def = meses.filter((b) => b.totais.despesas > b.totais.receitas * 1.0001);
  if (def.length) add(def.length >= 3 ? "alta" : "media", "Liquidez", `Despesa maior que a receita em ${def.length} de ${meses.length} meses`,
    def.map((b) => `${rotuloMes(b.mes)}: déficit de ${fmt(b.totais.despesas - b.totais.receitas)}`).join("; "),
    "Quais despesas extraordinárias explicam os déficits e com que aprovação foram feitas?");

  // 2. pagamentos possivelmente duplicados (mesmo fornecedor, mesma NF, mesmo valor)
  const grupos = new Map();
  for (const d of L) {
    if (/tarifa|banc/i.test(d.cat)) continue;
    const nfOk = !NF_GENERICA.test(d.nf);
    const k = nfOk ? `${d.forn}|${d.nf}|${d.v}` : `${d.forn}|${d.desc}|${d.v}|${d.baixa}`;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(d);
  }
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    const ps = g.map((d) => (d.desc.match(PARC) || [])[1]);
    const com = ps.filter(Boolean);
    if (com.length === ps.length) continue; // só parcelas: a regra de parcelamento trata repetições
    if (com.length >= 1 && ps.length - com.length <= 1 && new Set(com).size === com.length && !com.includes("01") && !com.includes("1")) continue; // 1ª parcela lançada sem número
    const d0 = g[0];
    add("alta", "Possível duplicidade", `${d0.forn}: ${g.length} pagamentos de ${fmt(d0.v)} com a mesma NF ${d0.nf || ""}`.trim(),
      g.map((d) => `${rotuloMes(d.mes)} – baixa ${d.baixa} – ${d.desc}`).join("\n"),
      `Os pagamentos de ${fmt(d0.v)} a ${d0.forn} (NF ${d0.nf}) são serviços distintos? Se duplicados, onde está o comprovante de devolução?`,
      g.map((d) => d.id), g[g.length - 1].mes);
  }
  // 2b. energia: mesma unidade consumidora e mesmo mês de referência pagos mais de uma vez
  const uc = new Map();
  for (const d of L) {
    const m = d.desc.match(/(?:COELBA|ENERGIA).*?(\d{10})\.?\s*$/i); if (!m || d.v < 5) continue;
    const k = `${m[1]}|${d.ref}`; (uc.get(k) || uc.set(k, []).get(k)).push(d);
  }
  for (const [k, g] of uc) if (g.length > 1) {
    const [u, ref] = k.split("|");
    add("media", "Possível duplicidade", `Energia: UC ${u}, referência ${ref}, paga ${g.length} vezes`,
      g.map((d) => `${rotuloMes(d.mes)} – baixa ${d.baixa} – NF ${d.nf} – ${fmt(d.v)}`).join("\n"),
      `As faturas da UC ${u} referentes a ${ref} são de períodos diferentes (refaturamento) ou houve pagamento em dobro?`,
      g.map((d) => d.id), g[g.length - 1].mes);
  }

  // 3. mesma NF usada em meses diferentes para o mesmo serviço (sem parcela)
  const nfs = new Map();
  for (const d of L) {
    if (NF_GENERICA.test(d.nf) || PARC.test(d.desc) || /consumo/i.test(d.cat)) continue;
    const k = `${d.forn}|${d.nf}|${d.item}`; (nfs.get(k) || nfs.set(k, []).get(k)).push(d);
  }
  for (const g of nfs.values()) {
    const ms = new Set(g.map((d) => d.mes)); if (ms.size < 2) continue;
    if (new Set(g.map((d) => d.v)).size === 1 && g.length === 2 && grupos.has(`${g[0].forn}|${g[0].nf}|${g[0].v}`)) continue; // já apontado como duplicidade
    add("media", "Documento fiscal", `${g[0].forn}: NF ${g[0].nf} usada em ${ms.size} meses diferentes`,
      g.map((d) => `${rotuloMes(d.mes)} – ref. ${d.ref} – ${fmt(d.v)} – ${d.item}`).join("\n"),
      `Apresentar as notas fiscais de cada mês pago a ${g[0].forn}; a NF ${g[0].nf} cobre mais de um mês?`, g.map((d) => d.id), g[g.length - 1].mes);
  }

  // 4. parcelas com numeração repetida ou interrompidas (um alerta por fornecedor)
  const parc = parcelas(meses);
  for (const p of parc) if (p.repetidas.length)
    add("media", "Parcelamento", `${p.forn}: parcela ${p.repetidas.join(", ")}/${p.de} lançada mais de uma vez`,
      p.pagamentos.map((x) => `${rotuloMes(x.mes)} – parcela ${x.n}/${p.de} – ${fmt(x.v)}`).join("\n"),
      `Qual o valor total contratado com ${p.forn} e quantas parcelas já foram pagas?`, p.pagamentos.map((x) => x.id), p.ultimoMes);
  const paradas = new Map();
  for (const p of parc.filter((x) => x.interrompida)) (paradas.get(p.forn) || paradas.set(p.forn, []).get(p.forn)).push(p);
  for (const [forn, ps] of paradas) {
    const tot = soma(ps, (x) => x.aPagar);
    add(tot > 2000 ? "media" : "baixa", "Parcelamento", `${forn}: ${ps.length > 1 ? ps.length + " parcelamentos parados" : `parcelamento parado em ${ps[0].ultimaParcela}/${ps[0].de}`} (${fmt(tot)} em aberto)`,
      ps.map((p) => `${p.desc || p.item} – última parcela ${p.ultimaParcela}/${p.de} em ${rotuloMes(p.ultimoMes)}, faltam ${p.restantes} × ${fmt(p.valorParcela)}`).join("\n"),
      `As parcelas restantes com ${forn} foram quitadas por outro meio, renegociadas ou estão em atraso?`,
      ps.flatMap((p) => p.pagamentos.map((x) => x.id)), ps[0].ultimoMes);
  }

  // 5. custos financeiros
  const fin = custosFinanceiros(meses);
  if (fin.jurosCartao.length) add("alta", "Custo financeiro", `Juros de cartão de crédito: ${fmt(soma(fin.jurosCartao, (x) => x.v))}`,
    fin.jurosCartao.map((d) => `${rotuloMes(d.mes)}: ${fmt(d.v)}`).join("; ") + ". Juros de cartão indicam fatura paga parcialmente (rotativo).",
    "Por que a fatura do cartão do condomínio não foi paga integralmente? Quem autoriza compras parceladas no cartão?", fin.jurosCartao.map((d) => d.id));
  if (fin.juros.length || fin.iof.length) {
    const j = soma(fin.juros, (x) => x.v), i = soma(fin.iof, (x) => x.v);
    add(j + i > 500 ? "media" : "baixa", "Custo financeiro", `Juros e IOF bancários: ${fmt(j + i)}`,
      `Juros de conta ${fmt(j)} e IOF ${fmt(i)} no período, concentrados nos meses de saldo negativo.`,
      "O condomínio usa o limite de cheque especial? Qual a taxa contratada?", [...fin.juros, ...fin.iof].map((d) => d.id));
  }
  if (fin.multas.length) add("media", "Custo financeiro", `Multas e juros por pagamento em atraso: ${fmt(soma(fin.multas, (x) => x.v))}`,
    fin.multas.map((m) => `${rotuloMes(m.mes)}: ${m.texto}`).join("\n"),
    "Os encargos por atraso serão absorvidos pelo condomínio ou cobrados de quem deu causa?");

  // 6. notas explicativas que pedem atenção
  for (const b of meses) for (const n of b.notas || []) {
    if (/duplicidade|devolvid/i.test(n.texto)) add("alta", "Nota explicativa", `${rotuloMes(b.mes)}: administradora informa pagamento em duplicidade`, n.texto,
      "O valor pago em duplicidade já foi devolvido? Em que data e para qual conta?", [], b.mes);
    else if (/apesar da NF|diferen[çc]a|n[ãa]o foram encaminhados/i.test(n.texto)) add("media", "Nota explicativa", `${rotuloMes(b.mes)}: diferença entre pagamento e documento`, n.texto,
      "Qual a justificativa e o documento que comprova o valor efetivamente pago?", [], b.mes);
  }

  // 7. lançamentos sem documento digitalizado (fora tarifas) e pagos só com recibo
  const semDoc = L.filter((d) => d.semDoc && !/tarifa|banc/i.test(d.cat));
  if (semDoc.length) add("media", "Documentação", `${semDoc.length} lançamento(s) sem documento digitalizado (${fmt(soma(semDoc, (d) => d.v))})`,
    semDoc.map((d) => `${rotuloMes(d.mes)} – ${d.forn} – ${fmt(d.v)}`).join("\n"),
    "Solicitar à administradora a nota fiscal ou recibo de cada um desses lançamentos.", semDoc.map((d) => d.id));
  const recibo = L.filter((d) => /^(RECIBO|COMPROVAN)/i.test(d.nf) && d.v >= 500);
  if (recibo.length) add("baixa", "Documentação", `${recibo.length} pagamento(s) acima de R$ 500 sem nota fiscal (${fmt(soma(recibo, (d) => d.v))})`,
    recibo.map((d) => `${rotuloMes(d.mes)} – ${d.forn} – ${fmt(d.v)} – ${d.nf}`).join("\n"),
    "Por que esses fornecedores não emitiram nota fiscal? Houve retenção de impostos quando devida?", recibo.map((d) => d.id));

  // 8. despesa recorrente que deixou de aparecer
  if (ordem.length >= 4) {
    const ultimos2 = new Set(ordem.slice(-2)), janela = new Set(ordem.slice(-8, -2));
    for (const f of porFornecedor(meses)) {
      if (/banco|receita federal/i.test(f.forn)) continue;
      const naJanela = [...f.meses].filter((m) => janela.has(m)).length;
      if (L.filter((d) => d.forn === f.forn && janela.has(d.mes)).every((d) => PARC.test(d.desc))) continue;
      const recente = [...f.meses].some((m) => ultimos2.has(m));
      if (naJanela >= 3 && !recente) add("media", "Despesa ausente", `${f.forn}: pago em ${naJanela} dos meses anteriores, sem pagamento nos 2 últimos`,
        `Último pagamento em ${rotuloMes(f.ultimo)}. Pode ser conta em atraso, contrato encerrado ou pagamento por fora da administradora.`,
        `A despesa com ${f.forn} foi encerrada ou está em aberto?`, [], ult);
    }
  }

  // 9. valor de contrato recorrente que mudou
  const rec = new Map();
  for (const d of L) { const k = `${d.forn}|${d.item}`; (rec.get(k) || rec.set(k, []).get(k)).push(d); }
  for (const g of rec.values()) {
    const porMes = new Map(); g.forEach((d) => porMes.set(d.mes, d.v)); // um valor por mês
    if (porMes.size < 4 || /consumo|tarifa|banc|pessoal|impost/i.test(g[0].cat) || PARC.test(g[0].desc)) continue;
    const vs = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((x) => x[1]);
    const prev = vs.slice(0, -1), ant = mediana(prev), atual = vs[vs.length - 1];
    const media = prev.reduce((a, b) => a + b, 0) / prev.length;
    const cv = Math.sqrt(prev.reduce((a, b) => a + (b - media) ** 2, 0) / prev.length) / media;
    if (cv > 0.04) continue; // valor nunca foi estável: não é contrato fixo
    if (ant > 300 && Math.abs(atual - ant) / ant > 0.03 && Math.abs(atual - ant) > 50 && [...porMes.keys()].includes(ult))
      add("baixa", "Contrato", `${g[0].forn} (${g[0].item.toLowerCase()}): valor mudou de ${fmt(ant)} para ${fmt(atual)}`,
        `Variação de ${((atual / ant - 1) * 100).toFixed(1).replace(".", ",")}% no último mês em relação ao valor habitual.`,
        `Há aditivo ou reajuste contratual que justifique o novo valor pago a ${g[0].forn}?`, g.map((d) => d.id), ult);
  }

  // 10. categoria fora do padrão no mês
  const recMed = mediana(meses.map((b) => b.totais.receitas));
  const mesesCheios = meses.filter((b) => b.totais.receitas > recMed * 0.7);
  for (const c of porCategoria(mesesCheios)) {
    const vals = mesesCheios.map((b) => c.porMes[b.mes] || 0);
    const med = mediana(vals);
    const picos = mesesCheios.map((b, i) => ({ mes: b.mes, v: vals[i] })).filter((x) => med > 1000 && x.v > med * 1.8 && x.v - med > 5000);
    if (picos.length) add(picos.length >= 3 ? "media" : "baixa", "Fora do padrão",
      `${c.cat}: ${picos.length} ${picos.length > 1 ? "meses" : "mês"} muito acima do habitual (${fmt(med)}/mês)`,
      picos.map((x) => `${rotuloMes(x.mes)}: ${fmt(x.v)} (${(x.v / med).toFixed(1).replace(".", ",")}× o habitual)`).join("\n"),
      `O que explica os gastos de ${c.cat.toLowerCase()} nesses meses? Foram aprovados em assembleia e com orçamentos?`, [], picos[picos.length - 1].mes);
  }

  // 11. novos fornecedores de valor alto
  if (ordem.length > 1) for (const f of porFornecedor(meses))
    if (f.primeiro === ult && f.total >= 3000) add("baixa", "Novo fornecedor", `${f.forn} aparece pela primeira vez com ${fmt(f.total)}`,
      "Fornecedor novo no último mês carregado.", `Como ${f.forn} foi contratado (orçamentos, contrato, aprovação)?`, [], ult);

  // 12. estrutura de receita
  const cotas = meses.map((b) => ({ mes: b.mes, v: Math.max(0, ...b.receitas.map((r) => r.v)) }));
  for (let i = 1; i < cotas.length; i++) {
    const a = cotas[i - 1].v, c = cotas[i].v;
    if (a > 0 && Math.abs(c / a - 1) > 0.05 && cotas[i - 1].mes !== ordem[0])
      add("info", "Receita", `Arrecadação principal mudou em ${rotuloMes(cotas[i].mes)}: ${fmt(a)} → ${fmt(c)}`,
        `Variação de ${((c / a - 1) * 100).toFixed(1).replace(".", ",")}%.`, "A mudança corresponde ao reajuste aprovado em assembleia (ata e data de vigência)?", [], cotas[i].mes);
  }
  const temReserva = meses.some((b) => b.receitas.some((r) => /RESERVA/i.test(r.desc)));
  if (!temReserva) add("media", "Receita", "Nenhuma arrecadação de fundo de reserva no período",
    "Os balancetes não mostram receita de fundo de reserva nem de taxa extra; investimentos e obras foram pagos com a taxa ordinária.",
    "A convenção prevê fundo de reserva? Por que não está sendo arrecadado/segregado?");

  // 13. concentração e peso de pessoal
  const ind = indicadores(meses);
  if (ind.pessoalPct > 0.45) add("info", "Estrutura de custos", `Pessoal consome ${(ind.pessoalPct * 100).toFixed(1).replace(".", ",")}% da receita`,
    "Inclui folha terceirizada, taxa de administração de RH e tributos retidos.", "Há estudo de dimensionamento do quadro e cotação de outras prestadoras?");
  const top = porFornecedor(meses)[0];
  if (top && ind.despesa && top.total / ind.despesa > 0.25) add("info", "Estrutura de custos", `${top.forn} concentra ${(top.total / ind.despesa * 100).toFixed(1).replace(".", ",")}% das despesas`,
    `${fmt(top.total)} em ${top.n} lançamentos.`, `O contrato com ${top.forn} foi renovado com cotação de mercado?`);

  const ordemSev = { alta: 0, media: 1, baixa: 2, info: 3 };
  return A.sort((a, b) => ordemSev[a.sev] - ordemSev[b.sev] || (b.mes || "").localeCompare(a.mes || ""));
}
