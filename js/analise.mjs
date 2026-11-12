import { identificarFornecedor } from "./parser.mjs";

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

// Séries de parcelas ("Parcela 03/10"). A administradora às vezes troca a NF, o fornecedor ou a
// descrição entre parcelas; a série é reconhecida por fornecedor + nº total + valor e, depois,
// séries com a mesma NF e o mesmo valor são unidas (ex.: "Nil 01/05" que segue como "Frigelar 02/08").
const nfChave = (nf) => (NF_GENERICA.test(nf || "") ? "" : String(nf).split("/").pop());
export function parcelas(meses) {
  if (!meses.length) return [];
  const ordem = meses.map((b) => b.mes);
  const series = new Map();
  for (const d of lancamentos(meses)) {
    const p = d.desc.match(PARC); if (!p) continue;
    const chave = `${d.forn}|${p[2]}|${Math.round(d.v)}`;
    const s = series.get(chave) || { grupo: `${d.forn}|${d.item}|${p[2]}`, forn: d.forn, item: d.item, nf: d.nf,
      desc: d.det.replace(PARC, "").replace(/^[\s\-–.]+/, "") || d.item, de: +p[2], pagamentos: [], fornecedores: new Set(), totais: new Set() };
    s.pagamentos.push({ mes: d.mes, n: +p[1], v: d.v, id: d.id, nf: d.nf });
    s.fornecedores.add(d.forn); s.totais.add(+p[2]);
    series.set(chave, s);
  }
  // une séries com a mesma NF e mesmo valor quando as parcelas não se repetem
  let lista = [...series.values()];
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = lista[i], b = lista[j]; if (!a || !b) continue;
    const ka = nfChave(a.nf), kb = nfChave(b.nf);
    if (!ka || ka !== kb || Math.round(a.pagamentos[0].v) !== Math.round(b.pagamentos[0].v)) continue;
    const na = new Set(a.pagamentos.map((p) => p.n));
    if (b.pagamentos.some((p) => na.has(p.n))) continue;
    const [velha, nova] = a.pagamentos.at(-1).mes <= b.pagamentos.at(-1).mes ? [a, b] : [b, a];
    nova.pagamentos.push(...velha.pagamentos); velha.fornecedores.forEach((f) => nova.fornecedores.add(f)); velha.totais.forEach((t) => nova.totais.add(t));
    nova.de = Math.max(nova.de, velha.de);
    lista[lista.indexOf(velha)] = null;
  }
  lista = lista.filter(Boolean);
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
    return { ...s, fornecedores: [...s.fornecedores], totais: [...s.totais], ultimaParcela: maxN, restantes, valorParcela: ult.v, ultimoMes: ult.mes, repetidas, substituida,
      aPagar: vigente ? r2(restantes * ult.v) : 0,
      interrompida: vigente && mesesSemPagar >= 2, ativa: vigente && ult.mes === ultimoMes };
  }).sort((a, b) => b.aPagar - a.aPagar);
}

const num = (s) => +s.replace(/\./g, "").replace(",", ".");
function custosFinanceiros(meses) {
  const juros = [], iof = [], iofAplic = [], jurosCartao = [];
  for (const b of meses) {
    const temJuros = b.despesas.some((d) => /^JUROS/i.test(d.desc));
    b.despesas.forEach((d, i) => {
      const x = { ...d, mes: b.mes, id: `${b.mes}#${i}` };
      if (/^JUROS/i.test(d.desc)) (/Cart/i.test(d.tipo) ? jurosCartao : juros).push(x);
      // IOF num mês sem juros vem do resgate de aplicação, não de saldo negativo
      else if (/^IOF/i.test(d.desc)) (temJuros ? iof : iofAplic).push(x);
    });
  }
  const multas = [], futuras = [];
  for (const b of meses) for (const n of b.notas || []) {
    if (/virão em faturas posteriores|virao em faturas posteriores/i.test(n.texto)) futuras.push({ mes: b.mes, texto: n.texto });
    if (!/juros|multa|encargo|acr[ée]scimo/i.test(n.texto)) continue;
    const enc = n.texto.match(/(?:[Ee]ncargos?|[Aa]cr[ée]scimo|juros\/multa)[^R]*R\$\s*([\d.]+,\d{2})/) || n.texto.match(/R\$\s*([\d.]+,\d{2})\s*referente a (?:encargos|juros)/);
    if (enc) multas.push({ mes: b.mes, v: num(enc[1]), texto: n.texto, terceiro: /responsabilidade d[ae] (tenda|construtora)/i.test(n.texto) });
  }
  const proprio = multas.filter((m) => !m.terceiro);
  return { juros, iof, iofAplic, jurosCartao, multas, futuras,
    total: r2(soma(juros, (x) => x.v) + soma(iof, (x) => x.v) + soma(jurosCartao, (x) => x.v) + soma(proprio, (x) => x.v)) };
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
const mesDe = (dataBR) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dataBR || ""); return m ? `${m[3]}-${m[2]}` : null; };
const refChave = (ref) => { const m = /(\d{2})\/(\d{4})/.exec(ref || ""); return m ? `${m[2]}-${m[1]}` : null; };
const kwh = (desc) => { const m = /Consumo Ativo de\s*([\d.,]+)\s*kWh/i.exec(desc); return m ? Math.round(num(m[1].includes(",") ? m[1] : m[1] + ",00")) : null; };
const mesesEntre = (a, b) => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return (yb - ya) * 12 + (mb - ma) + 1; };

export function alertas(meses) {
  const A = [];
  const add = (sev, tipo, titulo, detalhe, pergunta, ids = [], mes = null, forn = null) => { const a = { sev, tipo, titulo, detalhe, pergunta, ids, mes, forn }; A.push(a); return a; };
  if (!meses.length) return A;
  const ordem = meses.map((b) => b.mes);
  const L = lancamentos(meses);
  const ult = ordem[ordem.length - 1];
  const reembolsos = meses.flatMap((b) => b.receitas.filter((r) => /REEMBOLSO/i.test(r.desc)).map((r) => ({ mes: b.mes, v: r.v })));
  const foiReembolsado = (d) => reembolsos.some((r) => Math.abs(r.v - d.v) < 0.01 && r.mes >= d.mes && mesesEntre(d.mes, r.mes) <= 2);

  // 1. caixa
  const neg = meses.filter((b) => b.totais.saldoAtual < 0);
  if (neg.length) add("alta", "Liquidez", `Saldo negativo em ${neg.length} ${neg.length > 1 ? "meses" : "mês"}`,
    `Fechamentos negativos: ${neg.map((b) => `${rotuloMes(b.mes)} (${fmt(b.totais.saldoAtual)})`).join("; ")}. Com saldo negativo o banco cobra juros e IOF e as contas passam a ser pagas com atraso.`,
    "Qual o plano para recompor o caixa e evitar uso do limite da conta?", [], neg[neg.length - 1].mes);
  const def = meses.filter((b) => b.totais.despesas > b.totais.receitas * 1.0001);
  if (def.length) add(def.length >= 3 ? "alta" : "media", "Liquidez", `Despesa maior que a receita em ${def.length} de ${meses.length} meses`,
    def.map((b) => `${rotuloMes(b.mes)}: déficit de ${fmt(b.totais.despesas - b.totais.receitas)}`).join("; "),
    "Quais despesas extraordinárias explicam os déficits e com que aprovação foram feitas?");

  // 2. pagamentos com a mesma NF e o mesmo valor
  const vistos = new Set();
  const grupos = new Map();
  for (const d of L) {
    if (/tarifa|banc|consumo/i.test(d.cat)) continue;
    const nfOk = !NF_GENERICA.test(d.nf);
    const k = nfOk ? `${d.forn}|${d.nf}|${d.v}` : `${d.forn}|${d.desc}|${d.v}|${d.baixa}`;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(d);
  }
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    const ps = g.map((d) => (d.desc.match(PARC) || [])[1]);
    const com = ps.filter(Boolean);
    if (com.length === ps.length) continue; // parcelas de uma mesma NF: tratado em parcelamento
    if (com.length >= 1 && ps.length - com.length <= 1 && new Set(com).size === com.length && !com.some((n) => +n === 1)) continue; // 1ª parcela lançada sem número
    const d0 = g[0];
    g.forEach((d) => vistos.add(`${d.forn}|${d.nf}`));
    const mesmoMes = new Set(g.map((d) => d.mes)).size === 1;
    const mesmaRef = new Set(g.map((d) => d.ref)).size === 1;
    // contexto: quantos pagamentos do mesmo serviço x quantos meses decorridos
    const serie = L.filter((d) => d.forn === d0.forn && d.item === d0.item);
    const meses1 = mesesEntre(serie[0].mes, serie.at(-1).mes);
    const contexto = serie.length > 2 ? `\nNo período: ${serie.length} pagamentos de "${d0.item.toLowerCase()}" em ${meses1} meses${serie.length <= meses1 ? " (a quantidade não indica pagamento a mais)" : " (mais pagamentos do que meses)"}.` : "";
    const linhas = g.map((d) => `${rotuloMes(d.mes)} – ref. ${d.ref} – baixa ${d.baixa} – ${fmt(d.v)}`).join("\n") + contexto;
    if (mesmoMes) add("alta", "Pagamento em duplicidade", `${d0.forn}: ${g.length} pagamentos de ${fmt(d0.v)} da NF ${d0.nf || "(sem NF)"} no mesmo mês`,
      linhas, `Comprovar a devolução dos ${fmt(d0.v * (g.length - 1))} pagos a mais a ${d0.forn} (data e conta de crédito).`, g.map((d) => d.id), d0.mes, d0.forn);
    else if (mesmaRef) add(serie.length > meses1 ? "alta" : "media", "Documento fiscal", `${d0.forn}: NF ${d0.nf} com a mesma referência ${d0.ref} paga em ${g.length} meses`,
      linhas, `A NF ${d0.nf} de ${d0.forn} foi paga duas vezes? Apresentar a nota fiscal de cada mês pago.`, g.map((d) => d.id), g.at(-1).mes, d0.forn);
    else add(serie.length > meses1 ? "alta" : "media", "Documento fiscal", `${d0.forn}: NF ${d0.nf} usada em pagamentos de ${g.length} meses diferentes`,
      linhas, `Apresentar a nota fiscal de cada mês pago a ${d0.forn}: a NF ${d0.nf} aparece em mais de um mês.`, g.map((d) => d.id), g.at(-1).mes, d0.forn);
  }

  // 3. mesma NF em meses diferentes (fora das parcelas normais de uma compra)
  const nfs = new Map();
  for (const d of L) {
    if (NF_GENERICA.test(d.nf) || /consumo|tarifa|banc/i.test(d.cat)) continue;
    const k = `${d.forn}|${String(d.nf).split("/")[0]}`; (nfs.get(k) || nfs.set(k, []).get(k)).push(d);
  }
  for (const g of nfs.values()) {
    if (new Set(g.map((d) => d.mes)).size < 2 || g.every((d) => vistos.has(`${d.forn}|${d.nf}`))) continue;
    const parc = g.filter((d) => PARC.test(d.desc)), soltos = g.filter((d) => !PARC.test(d.desc));
    const mesesParc = new Set(parc.map((d) => d.mes));
    const soltosFora = soltos.filter((d) => !mesesParc.has(d.mes)); // a mesma fatura pode cobrir salário e taxa no mesmo mês
    if (parc.length) {
      if (!soltosFora.length) continue; // só parcelas: tratado em parcelamento
      const nums = parc.map((d) => +d.desc.match(PARC)[1]);
      if (!nums.includes(1) && soltosFora.every((d) => parc.every((p) => d.mes < p.mes)) && soltosFora.length === 1) continue; // 1ª parcela lançada sem número
    }
    const porMes = new Set(g.map((d) => d.mes));
    const tot = soma(g, (d) => d.v);
    add("media", "Documento fiscal", `${g[0].forn}: NF ${String(g[0].nf).split("/")[0]} usada em ${porMes.size} meses diferentes (${fmt(tot)})`,
      g.map((d) => `${rotuloMes(d.mes)} – NF ${d.nf} – ref. ${d.ref} – ${fmt(d.v)} – ${d.desc}`).join("\n"),
      `A mesma nota fiscal de ${g[0].forn} cobre todos esses pagamentos? Qual o valor total da NF e do serviço contratado?`, g.map((d) => d.id), g.at(-1).mes, g[0].forn);
  }
  // 3b. mesma NF com dois parcelamentos de valores diferentes (parcelas com o mesmo número)
  const pnf = new Map();
  for (const d of L) {
    const m = d.desc.match(PARC); if (!m || NF_GENERICA.test(d.nf)) continue;
    const k = `${d.forn}|${d.nf}|${m[2]}|${d.item}`; (pnf.get(k) || pnf.set(k, []).get(k)).push({ ...d, n: +m[1] });
  }
  for (const g of pnf.values()) {
    const rep = [...new Set(g.map((d) => d.n))].filter((n) => new Set(g.filter((d) => d.n === n).map((d) => Math.round(d.v))).size > 1);
    if (!rep.length) continue;
    const tot = soma(g, (d) => d.v), de = g[0].desc.match(PARC)[2];
    const valores = [...new Set(g.map((d) => Math.round(d.v)))];
    const suspeitos = L.filter((x) => NF_GENERICA.test(x.nf) && x.forn !== g[0].forn && valores.some((v) => Math.abs(x.v - v) < 1) && g.some((d) => Math.abs(mesesEntre(x.mes, d.mes)) <= 2));
    add("media", "Parcelamento", `${g[0].forn}: NF ${g[0].nf} com dois parcelamentos de valores diferentes (${fmt(tot)} pagos)`,
      g.sort((a, b) => a.mes.localeCompare(b.mes)).map((d) => `${rotuloMes(d.mes)} – parcela ${d.n}/${de} – ${fmt(d.v)} – ${d.tipo}`).join("\n")
        + `\nAs parcelas ${rep.join(" e ")}/${de} aparecem com valores diferentes: parece haver duas formas de pagamento para a mesma nota.`
        + (suspeitos.length ? `\nPagamento de mesmo valor sem nota fiscal em período próximo: ${suspeitos.map((x) => `${x.forn}, ${fmt(x.v)}, ${x.baixa}`).join("; ")}. Pode ser a parcela 1 lançada com outro nome.` : ""),
      `Qual o valor total da NF ${g[0].nf} de ${g[0].forn} e por que há dois parcelamentos? O total pago (${fmt(tot)}) corresponde ao contrato?`,
      [...g.map((d) => d.id), ...suspeitos.map((x) => x.id)], g.at(-1).mes, g[0].forn);
  }

  // 4. energia: mesma unidade, mesma referência e mesmo consumo pagos mais de uma vez
  const uc = new Map(), refErradas = [];
  for (const d of L) {
    const r = refChave(d.ref), b = mesDe(d.baixa);
    if (r && b && r > b && !/tarifa|banc/i.test(d.cat)) refErradas.push(d);
    const m = d.desc.match(/(?:COELBA|ENERGIA).*?(\d{10})\.?\s*$/i); if (!m || d.v < 5) continue;
    if (r && b && r > b) continue; // referência digitada errada
    const k = `${m[1]}|${d.ref}|${kwh(d.desc)}`; (uc.get(k) || uc.set(k, []).get(k)).push(d);
  }
  for (const [k, g] of uc) if (g.length > 1) {
    const [u, ref, kw] = k.split("|");
    const igual = new Set(g.map((d) => d.v)).size === 1;
    add(igual ? "media" : "baixa", "Pagamento em duplicidade", `Energia: UC ${u}, referência ${ref}, ${kw} kWh, paga ${g.length} vezes`,
      g.map((d) => `${rotuloMes(d.mes)} – baixa ${d.baixa} – NF ${d.nf} – ${fmt(d.v)}`).join("\n") + "\nMesma unidade, mesmo mês e mesmo consumo, com notas fiscais diferentes.",
      `As faturas ${g.map((d) => d.nf).join(" e ")} da UC ${u} são a mesma conta paga duas vezes? Se sim, a Coelba creditou a diferença?`, g.map((d) => d.id), g.at(-1).mes, "Coelba (energia)");
  }
  if (refErradas.length) add("baixa", "Qualidade do balancete", `${refErradas.length} lançamento(s) com mês de referência posterior ao pagamento`,
    refErradas.map((d) => `${rotuloMes(d.mes)} – ${d.forn} – ref. ${d.ref}, pago em ${d.baixa} – ${fmt(d.v)}`).join("\n") + "\nProvável erro de digitação da administradora; dificulta conferir o que já foi pago.",
    "Pedir à administradora a correção do mês de referência desses lançamentos.", refErradas.map((d) => d.id));

  // 5. parcelamentos
  const parc = parcelas(meses);
  for (const p of parc) {
    const div = p.fornecedores.length > 1 || p.totais.length > 1;
    if (p.repetidas.length) {
      const confere = p.pagamentos.length <= p.de;
      add(confere ? "baixa" : "media", "Parcelamento", `${p.forn}: parcela ${p.repetidas.join(", ")}/${p.de} lançada mais de uma vez`,
        p.pagamentos.map((x) => `${rotuloMes(x.mes)} – parcela ${x.n}/${p.de} – ${fmt(x.v)}`).join("\n") + (confere ? `\n${p.pagamentos.length} pagamentos para ${p.de} parcelas: a quantidade confere, a numeração está errada.` : `\n${p.pagamentos.length} pagamentos para ${p.de} parcelas.`),
        confere ? `Pedir correção da numeração das parcelas de ${p.forn}.` : `Qual o valor total contratado com ${p.forn} e quantas parcelas já foram pagas?`, p.pagamentos.map((x) => x.id), p.ultimoMes, p.forn);
    }
    if (div) add("baixa", "Qualidade do balancete", `${p.fornecedores.join(" / ")}: mesma compra (NF ${p.nf}) lançada com fornecedor ou nº de parcelas diferentes`,
      p.pagamentos.map((x) => `${rotuloMes(x.mes)} – parcela ${x.n} – ${fmt(x.v)}`).join("\n") + `\nTotais de parcelas citados: ${p.totais.join(" e ")}.`,
      `Qual o fornecedor correto e em quantas parcelas foi feita a compra da NF ${p.nf}?`, p.pagamentos.map((x) => x.id), p.ultimoMes, p.forn);
  }
  const paradas = new Map();
  for (const p of parc.filter((x) => x.interrompida)) (paradas.get(p.forn) || paradas.set(p.forn, []).get(p.forn)).push(p);
  for (const [forn, ps] of paradas) {
    const tot = soma(ps, (x) => x.aPagar);
    const seguro = ps.some((p) => /SEGURO/i.test(p.item + " " + p.desc));
    add(seguro ? "alta" : tot > 2000 ? "media" : "baixa", "Parcelamento", `${forn}: ${ps.length > 1 ? ps.length + " parcelamentos parados" : `parcelamento parado em ${ps[0].ultimaParcela}/${ps[0].de}`} (${fmt(tot)} em aberto)`,
      ps.map((p) => `${p.desc || p.item} – última parcela ${p.ultimaParcela}/${p.de} em ${rotuloMes(p.ultimoMes)}, faltam ${p.restantes} × ${fmt(p.valorParcela)}`).join("\n")
        + (seguro ? "\nO seguro da edificação é obrigatório (Código Civil, art. 1.346). Sem as demais parcelas, a apólice pode ter sido cancelada." : ""),
      seguro ? "A apólice do seguro está vigente? Apresentar apólice e comprovantes das parcelas 2 em diante." : `As parcelas restantes com ${forn} foram quitadas por outro meio, renegociadas ou estão em atraso?`,
      ps.flatMap((p) => p.pagamentos.map((x) => x.id)), ps[0].ultimoMes, forn);
  }

  // 6. custos financeiros
  const fin = custosFinanceiros(meses);
  if (fin.jurosCartao.length) add("media", "Custo financeiro", `Juros na fatura do cartão de crédito: ${fmt(soma(fin.jurosCartao, (x) => x.v))}`,
    fin.jurosCartao.map((d) => `${rotuloMes(d.mes)}: ${fmt(d.v)} (lançado como "${d.desc}", pagamento via cartão)`).join("\n") + "\nJuros cobrados na fatura indicam que ela não foi paga integralmente (crédito rotativo) ou que houve parcelamento com juros.",
    "Por que houve juros na fatura do cartão do condomínio? Apresentar as faturas de mai e jun/2026 e dizer quem autoriza compras parceladas no cartão.", fin.jurosCartao.map((d) => d.id));
  if (fin.juros.length || fin.iof.length) {
    const j = soma(fin.juros, (x) => x.v), i = soma(fin.iof, (x) => x.v);
    add(j + i > 500 ? "media" : "baixa", "Custo financeiro", `Juros e IOF de conta negativa: ${fmt(j + i)}`,
      `Juros ${fmt(j)} e IOF ${fmt(i)}, nos meses em que a conta usou o limite (${[...new Set([...fin.juros, ...fin.iof].map((d) => rotuloMes(d.mes)))].join(", ")}).`
        + (fin.iofAplic.length ? `\nNão incluídos: ${fmt(soma(fin.iofAplic, (x) => x.v))} de IOF sobre resgate de aplicação (${[...new Set(fin.iofAplic.map((d) => rotuloMes(d.mes)))].join(", ")}).` : ""),
      "Qual a taxa do limite de cheque especial e por que o condomínio ficou dependente dele?", [...fin.juros, ...fin.iof].map((d) => d.id));
  }
  if (fin.multas.length) {
    const prop = fin.multas.filter((m) => !m.terceiro), terc = fin.multas.filter((m) => m.terceiro);
    add("media", "Custo financeiro", `Multas e juros por pagamento em atraso: ${fmt(soma(prop, (x) => x.v))}${terc.length ? ` (+ ${fmt(soma(terc, (x) => x.v))} atribuídos à construtora)` : ""}`,
      fin.multas.map((m) => `${rotuloMes(m.mes)} – ${fmt(m.v)}${m.terceiro ? " (construtora)" : ""}: ${m.texto.replace(/^\d{2}\)\s*/, "")}`).join("\n")
        + (fin.futuras.length ? `\n\nEncargos ainda não quantificados (a administradora informa que virão nas próximas faturas):\n${fin.futuras.map((f) => `${rotuloMes(f.mes)}: ${f.texto.replace(/^\d{2}\)\s*/, "")}`).join("\n")}` : ""),
      `Os encargos por atraso foram causados pela falta de caixa; quem arca com eles?${terc.length ? " Os encargos atribuídos à construtora já foram ressarcidos ao condomínio?" : ""}`);
  }

  // 7. notas explicativas que pedem atenção
  for (const b of meses) for (const n of b.notas || []) {
    const t = n.texto, forn = identificarFornecedor(t);
    if (/duplicidade/i.test(t)) {
      const nfN = (t.match(/(?:NF|nota fiscal)\s*(?:n[º°o]\s*)?(\d+)/i) || [])[1];
      const ja = A.find((a) => a.tipo === "Pagamento em duplicidade" && nfN && a.titulo.includes(`NF ${nfN}`));
      if (ja) { ja.detalhe += `\nNota da administradora: ${t.replace(/^\d{2}\)\s*/, "")}`; continue; }
      if (/desconto|abatid/i.test(t)) add("media", "Nota explicativa", `${rotuloMes(b.mes)}: contas pagas em duplicidade com crédito prometido nas faturas seguintes`, t,
        "O valor pago em duplicidade foi abatido nas faturas seguintes? Quanto e em quais meses?", [], b.mes, forn);
      else add("alta", "Nota explicativa", `${rotuloMes(b.mes)}: administradora informa pagamento em duplicidade`, t,
        "O valor pago em duplicidade já foi devolvido? Em que data e para qual conta?", [], b.mes, forn);
    } else if (/parcelamento das faturas|parcela .* do parcelamento/i.test(t)) {
      add("media", "Atraso de pagamento", `${rotuloMes(b.mes)}: faturas de ${forn || "fornecedor"} parceladas por falta de caixa`, t,
        `Quanto ainda falta pagar do parcelamento com ${forn || "o fornecedor"}, com quais encargos, e há risco para salários e encargos trabalhistas?`, [], b.mes, forn);
    } else if (/apesar da NF/i.test(t)) {
      const v = [...t.matchAll(/R\$\s*([\d.]+,\d{2})|(?:valor de|no valor de)\s*([\d.]+,\d{2})/gi)].map((m) => num(m[1] || m[2]));
      const pago = v[0], nf = v[v.length - 1];
      const acima = pago > nf;
      add(acima ? "media" : "baixa", "Nota explicativa", `${rotuloMes(b.mes)}: ${forn || "fornecedor"} recebeu ${acima ? "mais" : "menos"} do que o valor da NF (${fmt(pago)} x ${fmt(nf)})`, t,
        acima ? `Qual a base para pagar ${fmt(pago - nf)} acima da nota fiscal a ${forn || "fornecedor"}? Há aditivo ou reajuste aprovado?` : `A diferença de ${fmt(nf - pago)} a menor está em aberto com ${forn || "o fornecedor"}?`, [], b.mes, forn);
    } else if (/diferen[çc]a/i.test(t) && /desconto|frete/i.test(t)) {
      add("info", "Nota explicativa", `${rotuloMes(b.mes)}: pagamento menor que a NF, explicado pela administradora`, t, "", [], b.mes, forn);
    } else if (/n[ãa]o foram encaminhados/i.test(t)) {
      add("media", "Documentação", `${rotuloMes(b.mes)}: despesa paga sem nota fiscal ou recibo do fornecedor`, t,
        "Apresentar a nota fiscal da despesa e identificar o fornecedor e o serviço prestado.", [], b.mes, forn);
    }
  }

  // 8. documentação
  const semDoc = L.filter((d) => d.semDoc && !/tarifa|banc/i.test(d.cat));
  if (semDoc.length) add("media", "Documentação", `${semDoc.length} lançamento(s) sem documento digitalizado (${fmt(soma(semDoc, (d) => d.v))})`,
    semDoc.map((d) => `${rotuloMes(d.mes)} – ${d.forn} – ${fmt(d.v)} – ${d.desc}`).join("\n") + "\nMarcados com * no balancete: \"conta sem documento digitalizado\".",
    "Solicitar à administradora a nota fiscal ou recibo de cada um desses lançamentos.", semDoc.map((d) => d.id));
  const recibo = L.filter((d) => /^(RECIBO|COMPROVAN)/i.test(d.nf) && d.v >= 500 && !foiReembolsado(d));
  if (recibo.length) add("baixa", "Documentação", `${recibo.length} pagamento(s) acima de R$ 500 só com recibo ou comprovante (${fmt(soma(recibo, (d) => d.v))})`,
    recibo.map((d) => `${rotuloMes(d.mes)} – ${d.forn} – ${fmt(d.v)} – ${d.nf}`).join("\n") + "\nPagamentos a pessoa física exigem RPA com retenção de INSS e IR quando aplicável.",
    "Por que esses pagamentos não têm nota fiscal? Para pessoas físicas, houve RPA e recolhimento de INSS/IR?", recibo.map((d) => d.id));

  // 9. despesa recorrente que deixou de aparecer
  if (ordem.length >= 4) {
    const ultimos2 = new Set(ordem.slice(-2)), janela = new Set(ordem.slice(-8, -2));
    for (const f of porFornecedor(meses)) {
      if (/banco|receita federal/i.test(f.forn)) continue;
      const naJanela = [...f.meses].filter((m) => janela.has(m)).length;
      if (L.filter((d) => d.forn === f.forn && janela.has(d.mes)).every((d) => PARC.test(d.desc))) continue;
      const recente = [...f.meses].some((m) => ultimos2.has(m));
      if (naJanela >= 3 && !recente) {
        const refs = L.filter((d) => d.forn === f.forn).map((d) => d.ref);
        add("media", "Despesa ausente", `${f.forn}: sem pagamento nos 2 últimos meses`,
          `Pago em ${naJanela} dos 6 meses anteriores; última referência paga: ${refs.sort((a, b) => (refChave(a) || "").localeCompare(refChave(b) || "")).at(-1)} (baixa em ${rotuloMes(f.ultimo)}). Pode ser conta em atraso, contrato encerrado ou pagamento fora da administradora.`,
          `A despesa com ${f.forn} foi encerrada ou está em aberto? Há risco de corte do serviço?`, [], ult, f.forn);
      }
    }
  }

  // 10. valor de contrato recorrente que mudou
  const rec = new Map();
  for (const d of L) { const k = `${d.forn}|${d.item}`; (rec.get(k) || rec.set(k, []).get(k)).push(d); }
  for (const g of rec.values()) {
    const porMes = new Map(); g.forEach((d) => porMes.set(d.mes, d.v));
    if (porMes.size < 4 || /consumo|tarifa|banc|pessoal|impost/i.test(g[0].cat) || PARC.test(g[0].desc)) continue;
    const vs = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((x) => x[1]);
    const prev = vs.slice(0, -1), ant = mediana(prev), atual = vs[vs.length - 1];
    const media = prev.reduce((a, b) => a + b, 0) / prev.length;
    const cv = Math.sqrt(prev.reduce((a, b) => a + (b - media) ** 2, 0) / prev.length) / media;
    if (cv > 0.04) continue;
    if (ant > 300 && Math.abs(atual - ant) / ant > 0.03 && Math.abs(atual - ant) > 50 && [...porMes.keys()].includes(ult))
      add(atual > ant ? "baixa" : "info", "Contrato", `${g[0].forn} (${g[0].item.toLowerCase()}): valor ${atual > ant ? "subiu" : "caiu"} de ${fmt(ant)} para ${fmt(atual)}`,
        [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => `${rotuloMes(m)}: ${fmt(v)}`).join("; "),
        atual > ant ? `Há aditivo ou reajuste aprovado que justifique o novo valor pago a ${g[0].forn}?` : `A redução de ${g[0].forn} reflete mudança de escopo do contrato?`, g.map((d) => d.id), ult, g[0].forn);
  }

  // 11. categoria fora do padrão
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

  // 12. novos fornecedores de valor alto
  if (ordem.length > 1) for (const f of porFornecedor(meses))
    if (f.primeiro === ult && f.total >= 3000) add("baixa", "Novo fornecedor", `${f.forn} aparece pela primeira vez com ${fmt(f.total)}`,
      "Fornecedor novo no último mês carregado.", `Como ${f.forn} foi contratado (orçamentos, contrato, aprovação)?`, [], ult, f.forn);

  // 13. receita
  const cotas = meses.map((b) => ({ mes: b.mes, v: Math.max(0, ...b.receitas.map((r) => r.v)) }));
  for (let i = 1; i < cotas.length; i++) {
    const a = cotas[i - 1].v, c = cotas[i].v;
    if (a > 0 && Math.abs(c / a - 1) > 0.05 && cotas[i - 1].mes !== ordem[0])
      add("info", "Receita", `Arrecadação principal mudou em ${rotuloMes(cotas[i].mes)}: ${fmt(a)} → ${fmt(c)}`,
        `Variação de ${((c / a - 1) * 100).toFixed(1).replace(".", ",")}%.`, "A mudança corresponde ao reajuste aprovado em assembleia (ata e data de vigência)?", [], cotas[i].mes);
  }
  if (!meses.some((b) => b.receitas.some((r) => /RESERVA/i.test(r.desc))))
    add("media", "Receita", "Nenhuma arrecadação de fundo de reserva identificada",
      "Os balancetes não mostram receita de fundo de reserva nem de taxa extra; obras e compras de bens foram pagas com a taxa ordinária. A própria administradora recomenda, nas notas, separar o fundo de reserva.",
      "A convenção prevê fundo de reserva? Ele está embutido na cota sem segregação? Onde está aplicado?");

  // 14. estrutura de custos
  const ind = indicadores(meses);
  if (ind.pessoalPct > 0.45) add("info", "Estrutura de custos", `Pessoal consome ${(ind.pessoalPct * 100).toFixed(1).replace(".", ",")}% da receita`,
    "Inclui folha terceirizada, taxa de administração de RH e tributos retidos.", "Há estudo de dimensionamento do quadro e cotação de outras prestadoras?");
  const top = porFornecedor(meses)[0];
  if (top && ind.despesa && top.total / ind.despesa > 0.25) add("info", "Estrutura de custos", `${top.forn} concentra ${(top.total / ind.despesa * 100).toFixed(1).replace(".", ",")}% das despesas`,
    `${fmt(top.total)} em ${top.n} lançamentos.`, `O contrato com ${top.forn} foi renovado com cotação de mercado?`);

  // 15. consolida por fornecedor os pontos de documento, contrato e notas de pagamento
  const SEVN = { alta: 0, media: 1, baixa: 2, info: 3 };
  const juntaveis = (a) => a.forn && ["Documento fiscal", "Contrato", "Nota explicativa", "Parcelamento"].includes(a.tipo) && !/^Coelba/.test(a.forn);
  const porForn = new Map();
  for (const a of A) if (juntaveis(a)) (porForn.get(a.forn) || porForn.set(a.forn, []).get(a.forn)).push(a);
  const saida = A.filter((a) => !(juntaveis(a) && porForn.get(a.forn).length > 1));
  for (const [forn, as] of porForn) if (as.length > 1) {
    as.sort((x, y) => SEVN[x.sev] - SEVN[y.sev]);
    saida.push({ sev: as[0].sev, tipo: "Fornecedor", forn, mes: as.map((a) => a.mes).filter(Boolean).sort().at(-1) || null,
      titulo: `${forn}: ${as.length} pontos a esclarecer`, ids: as.flatMap((a) => a.ids),
      detalhe: as.map((a) => `• ${a.titulo}\n${a.detalhe}`).join("\n\n"),
      pergunta: [...new Set(as.map((a) => a.pergunta).filter(Boolean))].join(" ") });
  }
  return saida.sort((a, b) => SEVN[a.sev] - SEVN[b.sev] || (b.mes || "").localeCompare(a.mes || ""));
}
