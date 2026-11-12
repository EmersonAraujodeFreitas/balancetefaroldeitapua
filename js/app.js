/* Gerado por build.py a partir de js/*.mjs — edite os .mjs */
(async () => {
"use strict";
// ===== parser.mjs
// Leitor de balancetes "Demonstrativo de Receitas e Despesas" da Logo Gestão Condominial.
// Funciona no navegador (pdf.js) e no Node (testes). Recebe o objeto pdfjsLib.

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function parseNum(s) {
  if (s == null) return NaN;
  let t = String(s).replace(/R\$\s*/g, "").trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith("-")) { neg = true; t = t.slice(1); }
  if (!/^[\d.]+,\d{2}$/.test(t)) return NaN;
  const v = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return neg ? -v : v;
}
const isNum = (s) => !isNaN(parseNum(s));

const CAT_NOMES = {
  "DESPESAS COM PESSOAL": "Pessoal",
  "PRESTAÇÃO DE SERVIÇOS": "Prestação de serviços",
  "LOCAÇÃO DE MÁQUINAS/EQUIPAMENTOS": "Locação de equipamentos",
  "DESPESAS CONSUMO": "Consumo (água e energia)",
  "MANUTENÇÃO": "Manutenção",
  "CONSERVAÇÃO": "Conservação",
  "OBRAS NO CONDOMÍNIO E MELHORIAS": "Obras e melhorias",
  "DESPESAS ADMINISTRATIVAS": "Administrativas",
  "IMOBILIZADO": "Imobilizado",
  "IMPOSTOS/TRIBUTOS/ENCARGOS": "Impostos e tributos",
  "TARIFAS BANCÁRIAS": "Tarifas e encargos bancários",
};
function nomeCategoria(h) {
  const k = h.trim().toUpperCase();
  if (CAT_NOMES[k]) return CAT_NOMES[k];
  const s = h.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fornecedores normalizados (o texto do balancete varia de mês a mês)
const ALIASES = [
  [/SECRETARIA DA RECEITA|RECEITA FEDERAL/i, "Receita Federal (tributos)"],
  [/LOGOSERV|LOGO GERENCIA/i, "Logoserv / Logo (RH terceirizado)"],
  [/QUALYSERVICE/i, "Qualyservice Gestão e Serviços"],
  [/AMPER/i, "Amper Tecnologia e Seg. Eletrônica"],
  [/PINHEIRO BRITO/i, "Pinheiro Brito Advocacia"],
  [/HEBERT GOMES/i, "Hebert Gomes Dias"],
  [/\bDR3\b/i, "DR3 Manutenção e Serviços"],
  [/COELBA/i, "Coelba (energia)"],
  [/EMBASA/i, "Embasa (água)"],
  [/SICOOB/i, "Sicoob (banco)"],
  [/BRADESCO/i, "Bradesco (banco)"],
  [/DUOS? SINDICOS?/i, "Duos Síndicos 360"],
  [/DIEGO CONCEI/i, "Diego Conceição Pereira (síndico)"],
  [/ANDRADE E MUNIZ/i, "Andrade e Muniz Comércio"],
  [/NIL MATERIAIS/i, "Nil Materiais de Construção"],
  [/CELIA XISTO/i, "Celia Xisto Lima Publicidade"],
  [/PAULO SERGIO/i, "Paulo Sérgio dos Santos Maurício (bombas)"],
  [/TRACCK/i, "Tracck Tecnologia (telemetria)"],
  [/HORTO R\.?F/i, "Horto R.F Tudo para Jardins"],
  [/LOMES/i, "Lomes Multi Distribuidora"],
  [/LEROY/i, "Leroy Merlin"],
  [/JCM NITEROI/i, "JCM Niterói Refrigeração"],
  [/FRIGELAR/i, "Frigelar"],
  [/TIM S\.?A/i, "TIM (recarga celular)"],
  [/MATHEUS DA SILVA/i, "Matheus da Silva Dias dos Santos (vistoria)"],
  [/NEIDE LIMA/i, "Neide Lima Pereira A. de Oliveira"],
  [/CAIO OLIVEIRA/i, "Caio Oliveira Santa Ana"],
  [/FERREIRA COSTA/i, "Ferreira Costa"],
  [/SAPUCAUNA/i, "Sapucaúna Locação de Equipamentos"],
  [/ENTERPRISE/i, "Enterprise Net (internet)"],
  [/MAGAZINE LUIZA|MAGALU/i, "Magazine Luiza / Magalu"],
  [/EBAZAR/i, "Ebazar (Mercado Livre)"],
  [/LIMEIRA/i, "André Nascimento Limeira"],
  [/PASSARINHO/i, "M.F. Passarinho"],
  [/RBMX/i, "RBMX Imunização"],
  [/INGRID PIMENTEL/i, "Ingrid Pimentel Silva Gabriel"],
  [/NILDO/i, "José Nildo Ferreira dos Santos"],
  [/MERCADOPAGO/i, "MercadoPago.com"],
  [/ALLIANZ/i, "Allianz Seguros"],
  [/MATEUS SANTIAGO/i, "Mateus Santiago Oliveira (extintores)"],
];

// remove CPF/RG/CNPJ de pessoa física e telefones do texto público
function mascarar(s) {
  return s
    .replace(/\(\d{2}\)\s*\d{4,5}-\d{4}/g, "(**) *****-****")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\s+/g, "")
    .replace(/(\b[A-ZÀ-Ú]{2,}(?:\s+[A-ZÀ-Ú]{2,})+)\s+\d{9,11}\b/g, "$1");
}

const MINUSC = new Set(["de","da","do","das","dos","e","em","para","com"]);
function titulo(t) {
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(/\s+/).map((w, i) => (i && MINUSC.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// fornecedor citado em um texto livre (ex.: notas explicativas)
function identificarFornecedor(texto) {
  const a = ALIASES.find(([re]) => re.test(texto));
  return a ? a[1] : null;
}

function separarFornecedor(desc, categoria) {
  const partes = desc.split(/\s+-\s+/);
  let forn = partes.length > 1 ? partes[1] : partes[0];
  let det = partes.length > 2 ? partes.slice(2).join(" - ") : "";
  const item = partes.length > 1 ? partes[0] : "";
  let achou = ALIASES.find(([re]) => re.test(forn)) || ALIASES.find(([re]) => re.test(desc));
  if (achou) forn = achou[1];
  else forn = titulo(forn.replace(/\s+\d{6,}\.?$/, "").replace(/\s+(LTDA|ME|EIRELI|S\/A|SA)\.?$/i, "").trim());
  return { forn, item: item.trim(), det: det.trim() };
}

async function linhasDoPdf(pdfjsLib, data) {
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
  const paginas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const tc = await pg.getTextContent();
    const its = tc.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
    paginas.push(its);
  }
  return paginas;
}

function agruparLinhas(itens, C) {
  // asteriscos (conta sem documento) ficam ~3pt abaixo da linha do valor
  const ast = itens.filter((i) => i.s === "*" && i.x > C.valor);
  const resto = itens.filter((i) => !(i.s === "*" && i.x > C.valor));
  resto.sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const it of resto) {
    const l = linhas.find((l) => Math.abs(l.y - it.y) <= 2);
    if (l) l.itens.push(it); else linhas.push({ y: it.y, itens: [it] });
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  for (const a of ast) {
    let melhor = null;
    for (const l of linhas) {
      const d = l.y - a.y;
      if (d >= 0 && d <= 5 && l.itens.some((i) => i.x > C.valor && isNum(i.s)) && (!melhor || d < melhor.y - a.y)) melhor = l;
    }
    if (melhor) melhor.ast = true;
  }
  linhas.sort((a, b) => b.y - a.y);
  return linhas;
}

async function lerBalancete(pdfjsLib, data, nomeArquivo = "") {
  const paginas = await linhasDoPdf(pdfjsLib, data);
  const todasTexto = paginas.flat().map((i) => i.s).join(" ");
  if (!/DEMONSTRATIVO DE RECEITAS E DESPESAS/i.test(todasTexto))
    throw new Error("O arquivo não parece ser um Demonstrativo de Receitas e Despesas da Logo Gestão.");

  const out = {
    mes: null, rotulo: "", condominio: "", emissao: "", arquivo: nomeArquivo,
    receitas: [], despesas: [], notas: [],
    totais: { receitas: null, despesas: null, saldoAnterior: null, saldoMes: null, saldoAtual: null },
  };
  const mPer = todasTexto.match(/([A-Za-zçÇ]+)\s*\/\s*(\d{4})\s*-\s*Período:\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
  if (!mPer) throw new Error("Não encontrei o período (mês/ano) no balancete.");
  const idx = MESES.indexOf(mPer[1].toLowerCase());
  out.mes = `${mPer[2]}-${String(idx + 1).padStart(2, "0")}`;
  out.rotulo = `${mPer[1]} / ${mPer[2]}`;
  out.periodo = `${mPer[3]} a ${mPer[4]}`;
  const mCond = todasTexto.match(/(Condom[ií]nio [^]+?)\s+(?:DEMONSTRATIVO|Clique|Pág)/);
  const p0 = paginas[0].find((i) => /Período:/.test(i.s));
  const cond = paginas[0].find((i) => /^Condom[ií]nio /.test(i.s) && !/Condom[ií]nio21/.test(i.s) && (!p0 || i.y > p0.y));
  out.condominio = cond ? cond.s : (mCond ? mCond[1] : "");
  const em = paginas[0].find((i) => /^\d{2}\/\d{2}\/\d{4}$/.test(i.s) && (!p0 || i.y > p0.y));
  out.emissao = em ? em.s : "";

  // Layout adaptativo: as colunas são lidas do cabeçalho da tabela de despesas
  // e cada página é alinhada pela linha do período (o PDF às vezes vem deslocado).
  const per = (its) => its.find((i) => /Período:/.test(i.s));
  let base = null;
  for (const its of paginas) {
    const h = (re) => its.find((i) => re.test(i.s));
    const ref = h(/^Mês Ref\.?$/i), bx = h(/^Baixa$/i), tp = h(/^Tipo Pgto/i), nf = h(/^Nota Fiscal$/i), vl = h(/^Valor$/i), p = per(its);
    if (ref && bx && tp && nf && vl && p) {
      base = { px: p.x, ref: ref.x - 10, baixa: (ref.x + bx.x) / 2, tipo: tp.x - 6, nf: nf.x - 8, valor: vl.x - 20 };
      break;
    }
  }
  if (!base) base = { px: 33.4, ref: 300, baixa: 334, tipo: 391, nf: 442, valor: 494 };

  let modo = "inicio", categoria = "", ultimo = null, anteriorFoiSub = true, notaAtual = null;
  for (const its of paginas) {
    const p = per(its);
    const dx = p ? p.x - base.px : 0;
    const C = { ref: base.ref + dx, baixa: base.baixa + dx, tipo: base.tipo + dx, nf: base.nf + dx, valor: base.valor + dx };
    const topo = p ? p.y - 2 : 740;
    const rod = its.filter((i) => /Condom[ií]nio21|Conta sem documento digitalizado/.test(i.s));
    const piso = rod.length ? Math.max(...rod.map((i) => i.y)) + 2 : 8;
    const corpo = its.filter((i) => i.y < topo && i.y > piso);
    for (const l of agruparLinhas(corpo, C)) {
      const txt = l.itens.map((i) => i.s).join(" ");
      const desc = l.itens.filter((i) => i.x < C.ref).map((i) => i.s).join(" ");
      const valItem = l.itens.filter((i) => i.x > C.valor && isNum(i.s)).pop();
      const val = valItem ? parseNum(valItem.s) : NaN;

      if (/^OUTRAS RECEITAS/.test(txt)) { modo = "rec"; continue; }
      if (/TOTAL DE RECEITAS:/.test(txt)) { out.totais.receitas = val; modo = "entre"; continue; }
      if (/DESPESAS\/HIST[ÓO]RICO/.test(txt)) { modo = "desp"; anteriorFoiSub = true; continue; }
      if (/TOTAL DE DESPESAS:/.test(txt)) { out.totais.despesas = val; modo = "resumo"; continue; }
      if (/^NOTA EXPLICATIVA$/.test(txt.trim())) { modo = "notas"; continue; }

      if (modo === "rec") {
        if (/^Receitas$|^Total:/.test(desc.trim()) || /Total:/.test(txt)) continue;
        if (desc && !isNaN(val)) out.receitas.push({ desc: desc.trim(), v: val });
        continue;
      }
      if (modo === "desp") {
        const ref = l.itens.find((i) => i.x >= C.ref && i.x < C.baixa && /^\d{2}\/\d{4}$/.test(i.s));
        if (ref && !isNaN(val)) {
          const baixa = l.itens.find((i) => i.x >= C.baixa && i.x < C.tipo);
          const tipo = l.itens.filter((i) => i.x >= C.tipo && i.x < C.nf).map((i) => i.s).join(" ");
          const nf = l.itens.filter((i) => i.x >= C.nf && i.x < C.valor).map((i) => i.s).join(" ");
          ultimo = { cat: categoria, desc: desc.trim(), ref: ref.s, baixa: baixa ? baixa.s : "", tipo, nf, v: val, semDoc: !!l.ast };
          out.despesas.push(ultimo);
          anteriorFoiSub = false;
        } else if (!desc && !isNaN(val)) {
          anteriorFoiSub = true; ultimo = null; // subtotal de categoria
        } else if (desc && isNaN(val)) {
          if (anteriorFoiSub || !ultimo) { categoria = nomeCategoria(desc); anteriorFoiSub = false; }
          else ultimo.desc += " " + desc.trim();
        }
        continue;
      }
      if (modo === "resumo") {
        const k = /^Saldo Anterior:/i.test(desc) ? "saldoAnterior" : /^Total de Receitas:/i.test(desc) ? "recResumo"
          : /^Total de Despesas:/i.test(desc) ? "despResumo" : /^Saldo do M[êe]s:/i.test(desc) ? "saldoMes" : /^SALDO ATUAL:/i.test(desc) ? "saldoAtual" : null;
        if (k && !isNaN(val)) out.totais[k] = val;
        continue;
      }
      if (modo === "notas") {
        const x0 = l.itens[0].x - dx;
        if (x0 > 60 || /Setor Financeiro|^S[íi]ndico$/.test(txt)) { modo = "fim"; continue; }
        if (/^NOTAS EXPLICATIVAS/i.test(txt)) { notaAtual = { grupo: /ESPEC/i.test(txt) ? "específica" : "geral", texto: "" }; continue; }
        if (/^\d{2}\)/.test(txt) || !notaAtual || notaAtual.texto === "" ) {
          if (/^\d{2}\)/.test(txt) || !out.notas.length) {
            notaAtual = { grupo: notaAtual ? notaAtual.grupo : "geral", texto: txt };
            out.notas.push(notaAtual);
            continue;
          }
        }
        const ultimaNota = out.notas[out.notas.length - 1];
        if (ultimaNota) ultimaNota.texto += (/^-/.test(txt) ? "\n" : " ") + txt;
      }
    }
  }
  // fornecedor e máscara de dados pessoais
  for (const d of out.despesas) {
    d.desc = mascarar(d.desc.replace(/\s+/g, " "));
    Object.assign(d, separarFornecedor(d.desc, d.cat));
  }
  for (const n of out.notas) n.texto = mascarar(n.texto.replace(/[ \t]+/g, " ").trim());
  out.conferencia = conferir(out);
  return out;
}

function conferir(b) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const somaD = r2(b.despesas.reduce((s, d) => s + d.v, 0));
  const somaR = r2(b.receitas.reduce((s, d) => s + d.v, 0));
  const t = b.totais;
  const problemas = [];
  if (t.despesas == null || Math.abs(somaD - t.despesas) > 0.02) problemas.push(`Soma das despesas lidas (${somaD}) difere do total do balancete (${t.despesas}).`);
  if (t.receitas == null || Math.abs(somaR - t.receitas) > 0.02) problemas.push(`Soma das receitas lidas (${somaR}) difere do total do balancete (${t.receitas}).`);
  if (t.saldoAnterior != null && t.saldoAtual != null && t.receitas != null && t.despesas != null &&
      Math.abs(r2(t.saldoAnterior + t.receitas - t.despesas) - t.saldoAtual) > 0.02)
    problemas.push("Saldo anterior + receitas − despesas não fecha com o saldo atual.");
  return { ok: problemas.length === 0, problemas, somaD, somaR };
}

// ===== analise.mjs

// Motor de análise: tudo é derivado dos meses carregados, sem regras presas a um período.
// Um mês, categoria ou fornecedor novo entra automaticamente em todos os cálculos e alertas.

const MES_ABR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const rotuloMes = (k) => { const [a, m] = k.split("-"); return `${MES_ABR[+m - 1]}/${a}`; };
const r2 = (x) => Math.round(x * 100) / 100;
const NF_GENERICA = /^(RECIBO|BOLETO|DARF|FATURA|FATURAMEN.*|COMPROVAN.*|AP[ÓO]LICE|DAJE|diversas)?$/i;
const PARC = /Parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;
const soma = (arr, f = (x) => x) => r2(arr.reduce((s, x) => s + f(x), 0));
const mediana = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

function lancamentos(meses) {
  const out = [];
  for (const b of meses) b.despesas.forEach((d, i) => out.push({ ...d, mes: b.mes, id: `${b.mes}#${i}` }));
  return out;
}

function resumoMensal(meses) {
  return meses.map((b) => {
    const t = b.totais;
    return {
      mes: b.mes, receita: t.receitas, despesa: t.despesas, resultado: r2(t.receitas - t.despesas),
      saldoAnterior: t.saldoAnterior, saldo: t.saldoAtual,
      cota: Math.max(0, ...b.receitas.map((r) => r.v)),
    };
  });
}

function porCategoria(meses) {
  const cats = new Map();
  for (const b of meses) for (const d of b.despesas) {
    if (!cats.has(d.cat)) cats.set(d.cat, {});
    const c = cats.get(d.cat); c[b.mes] = r2((c[b.mes] || 0) + d.v);
  }
  return [...cats.entries()].map(([cat, pm]) => ({ cat, porMes: pm, total: soma(Object.values(pm)) }))
    .sort((a, b) => b.total - a.total);
}

function porFornecedor(meses) {
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
function parcelas(meses) {
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

function indicadores(meses) {
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

function alertas(meses) {
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

// ===== executivo.mjs
// Análises executivas: comparativos e gráficos. Tudo derivado dos meses carregados.

const xBrl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const xPct = (v, d = 1) => (v * 100).toFixed(d).replace(".", ",") + "%";
const xEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const xCurto = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : Math.abs(v) >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil" : Math.round(v).toLocaleString("pt-BR");
const xMesCurto = (k) => rotuloMes(k).replace("/20", "/");

// paleta categórica validada (ordem fixa) + neutro para "Demais"
const CORES = ["#0b5a8c", "#c98a00", "#2a9d8f", "#7b5ea7", "#d9663a"];
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
  const W = 540, H = 300, ml = 54, mr = 96, mt = 16, mb = 34;
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

function renderExecutivo(meses, el) {
  if (!meses.length) { el.innerHTML = `<div class="vazio card">Nenhum balancete no período.</div>`; return; }
  const ci = correntesInvest(meses), tf = topFornecedores(meses);
  el.innerHTML = `
  <div class="card"><div class="cab"><div class="cab-secao"><span class="eyebrow">Síntese</span><h2>Conclusões do período</h2></div></div>
    <ul class="conclusoes">${conclusoes(meses, ci, tf)}</ul></div>
  <div class="card"><div class="cab"><div class="cab-secao"><span class="eyebrow">Comparativo</span><h2>Últimos meses x período anterior</h2></div></div>
    <div style="margin-top:14px">${comparativo(meses)}</div></div>
  <div class="grid2">
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Natureza do gasto</span><h2>Gastos correntes x investimentos</h2></div>
      <div class="legenda" style="margin:10px 0 6px"><span><i style="background:var(--accent)"></i>Gastos correntes</span><span><i style="background:#c98a00"></i>Obras e bens</span><span><i class="linha" style="background:var(--ink)"></i>Receita</span></div>${ci.svg}</div>
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Composição</span><h2>Despesas por categoria</h2></div><div style="margin-top:10px">${rosca(meses)}</div></div>
  </div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Evolução da composição</span><h2>Despesa mensal por categoria</h2></div><div style="margin-top:10px">${empilhado(meses)}</div></div>
  <div class="grid2">
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Acumulado</span><h2>Receita x despesa acumuladas</h2></div>
      <div class="legenda" style="margin:10px 0 6px"><span><i class="linha" style="background:var(--accent)"></i>Receita acumulada</span><span><i class="linha" style="background:#d9663a"></i>Despesa acumulada</span></div>${acumulado(meses)}</div>
    <div class="card chart"><div class="cab-secao"><span class="eyebrow">Tendência</span><h2>O que aumentou e o que caiu</h2></div>${variacaoCategorias(meses)}</div>
  </div>
  <div class="card chart"><div class="cab-secao"><span class="eyebrow">Concentração</span><h2>Maiores fornecedores do período</h2></div><div style="margin-top:12px">${tf.svg}</div></div>
  <div class="cab-secao"><span class="eyebrow">Índices de gestão</span><h2>Indicadores por trimestre</h2></div>
  <div class="tabela">${porTrimestre(meses)}</div>`;
}

// ===== gestao.mjs
// Módulos de gestão: relatório do mês, projeção de caixa, detalhe de fornecedor,
// mapa de calor de categorias e acompanhamento dos alertas. Tudo derivado dos meses carregados.

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

function renderMes(todos, mes, alertas, el) {
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
function projecao(todos, horizonte = 6) {
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

function renderProjecao(todos, el) {
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
function renderFornecedor(meses, forn, alertas, el) {
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
function mapaCalor(meses) {
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
const SITUACOES = { pendente: "Pendente", questionado: "Questionado", respondido: "Respondido", resolvido: "Resolvido", descartado: "Não procede" };
function chaveAlerta(a) {
  const base = `${a.tipo}|${a.forn || ""}|${a.titulo.replace(/R\$\s?[−-]?[\d.,]+/g, "").replace(/\d+ (pontos|lançamento\(s\)|pagamento\(s\)|meses|mês)/g, "")}`;
  let h = 0; for (const c of base) h = (h * 31 + c.charCodeAt(0)) | 0;
  return "a" + (h >>> 0).toString(36);
}

// ===== app.mjs

const $ = (s) => document.querySelector(s);
const brl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => (v * 100).toFixed(1).replace(".", ",") + "%";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LS_ACOMP = "farol.acompanhamento.v1", LS_MESES = "farol.balancetes.locais.v1", LS_GH = "farol.github.v1", LS_PER = "farol.periodo.v1";
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
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.base = j.meses || {};
    S.acompBase = j.acompanhamento || {};
  } catch { S.base = (window.__BASE_BALANCETES__ && window.__BASE_BALANCETES__.meses) || {}; }
  S.locais = ls.get(LS_MESES, {});
  S.acomp = { ...(S.acompBase || (window.__BASE_BALANCETES__ && window.__BASE_BALANCETES__.acompanhamento) || {}), ...ls.get(LS_ACOMP, {}) };
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
    A.forEach((a) => { a.chave = chaveAlerta(a); a.sit = (S.acomp[a.chave] || {}).status || "pendente"; });
    painel(); renderExecutivo(S.meses, $("#secAnalises")); categorias(); fornecedores(); listaAlertas(); tabParcelas(); notas(); conselho();
    renderMes(S.todos, S.mesSel || S.meses.at(-1).mes, alertas(S.todos), $("#secMes"));
    renderProjecao(S.todos, $("#secProjecao"));
  }
  lancTab(); dadosTab();
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
  const altas = S.alertas.filter((a) => a.sev === "alta").length;
  const ult = rm.at(-1);
  const folgaMes = ult.saldo / (ult3.reduce((s, m) => s + m.despesa, 0) / ult3.length || 1);
  if (negRecente || ult.saldo < 0) return { cls: "critico", rotulo: "Crítica", titulo: "Caixa no limite",
    texto: `O saldo ficou negativo nos últimos meses e o condomínio depende do limite bancário. Há ${altas} ponto(s) de prioridade alta para esclarecer com a administradora.` };
  if (res3 < 0 || folgaMes < 0.25 || altas) return { cls: "atencao", rotulo: "Atenção", titulo: res3 < 0 ? "Despesas acima da arrecadação" : "Caixa positivo, mas sem reserva",
    texto: `Saldo de ${brl(ult.saldo)} em ${rotuloMes(ult.mes)}, equivalente a ${(folgaMes * 30).toFixed(0)} dias de despesa média. ${altas ? `${altas} ponto(s) de prioridade alta precisam de resposta da administradora.` : ""}` };
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
    ["Alertas de prioridade alta", String(S.alertas.filter((a) => a.sev === "alta").length), `${S.alertas.filter((a) => a.sev === "media").length} de prioridade média`, S.alertas.some((a) => a.sev === "alta") ? "neg" : "pos"],
  ];
  $("#kpis2").innerHTML = k2.map(([t, v, d, c]) => `<div class="kpi ${c}"><span class="eyebrow">${t}</span><b>${v}</b><span class="det">${d}</span></div>`).join("");
  $("#grafMensal").innerHTML = graficoMensal(rm);

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

  const top = S.alertas.filter((a) => a.sev === "alta").slice(0, 6);
  $("#topAlertas").innerHTML = top.length ? top.map((a) => `<a href="#alertas"><span class="pill alta">${esc(a.tipo)}</span><span class="t">${esc(a.titulo)}</span></a>`).join("")
    : `<p class="muted small">Nenhum alerta de prioridade alta no período.</p>`;

  const max = ind.cats[0]?.total || 1;
  $("#miniCats").innerHTML = `<table><thead><tr><th>Categoria</th><th style="width:40%"></th><th class="n">Valor</th><th class="n">Participação</th></tr></thead><tbody>${ind.cats.map((c) => `<tr><td>${esc(c.cat)}</td><td><div class="barra"><span style="width:${(c.total / max) * 100}%"></span></div></td><td class="n">${brl(c.total)}</td><td class="n mini">${pct(c.total / ind.despesa)}</td></tr>`).join("")}</tbody></table>`;

  const linhas = rm.map((m) => `<tr><td>${rotuloMes(m.mes)}${S.meses.find((b) => b.mes === m.mes).origem === "local" ? ' <span class="pill local">não publicado</span>' : ""}</td>
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
  const W = 1040, H = 360, ml = 66, mr = 16, mt = 22, mb = 34;
  const vals = rm.flatMap((m) => [m.receita, m.despesa, m.saldo, 0]);
  const { lo, hi, ticks } = escalaBonita(Math.min(...vals), Math.max(...vals));
  const y = (v) => mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo));
  const bw = (W - ml - mr) / rm.length, gap = Math.max(3, bw * 0.2), b = (bw - gap * 2) / 2;
  let g = "";
  if (lo < 0) g += `<rect x="${ml}" y="${y(0)}" width="${W - ml - mr}" height="${y(lo) - y(0)}" fill="var(--crit-soft)" opacity=".7"/>`;
  for (const t of ticks) g += `<line x1="${ml}" x2="${W - mr}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? "var(--line-2)" : "var(--line)"}" stroke-width="1"/><text x="${ml - 8}" y="${y(t) + 4}" text-anchor="end">${curto(t)}</text>`;
  rm.forEach((m, i) => {
    const x0 = ml + i * bw + gap;
    g += `<rect x="${x0}" y="${Math.min(y(m.receita), y(0))}" width="${b - 1}" height="${Math.abs(y(0) - y(m.receita))}" fill="var(--accent)" data-tip="${rotuloMes(m.mes)} · receita ${brl(m.receita)}"/>`;
    g += `<rect x="${x0 + b}" y="${Math.min(y(m.despesa), y(0))}" width="${b - 1}" height="${Math.abs(y(0) - y(m.despesa))}" fill="var(--desp)" data-tip="${rotuloMes(m.mes)} · despesa ${brl(m.despesa)}"/>`;
    const lab = rm.length > 16 && i % 2 ? "" : rotuloMes(m.mes).replace("/20", "/");
    g += `<text x="${x0 + b}" y="${H - mb + 18}" text-anchor="middle">${lab}</text>`;
  });
  const pts = rm.map((m, i) => [ml + i * bw + bw / 2, y(m.saldo)]);
  g += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round"/>`;
  pts.forEach((p, i) => g += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3.2}" fill="${rm[i].saldo < 0 ? "var(--crit)" : "var(--gold)"}" stroke="var(--surface)" stroke-width="1.5" data-tip="${rotuloMes(rm[i].mes)} · saldo ${brl(rm[i].saldo)}"/>`);
  // anotações: menor saldo e saldo atual
  const iMin = rm.reduce((a, m, i) => (m.saldo < rm[a].saldo ? i : a), 0), iUlt = rm.length - 1;
  const anot = (i, txt, acima) => {
    const [x, yy] = pts[i], anc = x > W - 120 ? "end" : x < ml + 60 ? "start" : "middle";
    return `<text class="anot" x="${x}" y="${acima ? yy - 10 : yy + 18}" text-anchor="${anc}">${txt}</text>`;
  };
  if (rm[iMin].saldo < 0 && iMin !== iUlt) g += anot(iMin, `mínimo ${curto(Math.round(rm[iMin].saldo))}`, false);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas, despesas e saldo por mês">${g}</svg>`;
}

// ---------------------------------------------------------------- categorias
function categorias() {
  const cats = porCategoria(S.meses);
  const ms = S.meses.map((b) => b.mes);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length ? (s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2) : 0; };
  const totMes = Object.fromEntries(ms.map((m) => [m, S.meses.find((b) => b.mes === m).totais.despesas]));
  $("#tabCats").innerHTML = mapaCalor(S.meses);
  // barras horizontais
  const W = 1040, lh = 34, ml = 240, H = cats.length * lh + 10, max = cats[0]?.total || 1;
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
    const ac = S.acomp[a.chave] || {};
    return `<article class="alerta ${a.sev}">
    <div class="linha1"><span class="pill ${a.sev}">${SEV[a.sev]}</span><span class="eyebrow">${esc(a.tipo)}</span>${a.mes ? `<span class="mini">${rotuloMes(a.mes)}</span>` : ""}<span class="sit ${a.sit}" style="margin-left:auto">${SITUACOES[a.sit]}</span></div>
    <div class="tit">${esc(a.titulo)}</div>
    ${a.detalhe ? `<pre>${esc(a.detalhe)}</pre>` : ""}
    ${a.pergunta ? `<div class="perg">${esc(a.pergunta)}</div>` : ""}
    ${a.ids.length ? `<div><button type="button" class="link" data-alerta="${A.indexOf(a)}">Ver ${a.ids.length} lançamento(s)</button></div>` : ""}
    <div class="acomp">
      <label class="small" style="display:grid;gap:4px;font-weight:600">Situação
        <select data-acomp="${a.chave}" aria-label="Situação do alerta">${Object.entries(SITUACOES).map(([k, t]) => `<option value="${k}" ${a.sit === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="small" style="display:grid;gap:4px;font-weight:600">Resposta da administradora / anotação do conselho${ac.data ? ` <span class="mini" style="font-weight:400">atualizado em ${esc(ac.data)}</span>` : ""}
        <textarea data-resp="${a.chave}" rows="2" placeholder="Registre aqui a resposta recebida ou a providência combinada">${esc(ac.resposta || "")}</textarea></label>
    </div>
  </article>`; }).join("") : `<div class="vazio card">Nenhum alerta com os filtros escolhidos.</div>`;
}
function salvarAcomp(chave, campo, valor) {
  const atual = S.acomp[chave] || {};
  S.acomp[chave] = { ...atual, [campo]: valor, data: new Date().toLocaleDateString("pt-BR") };
  ls.set(LS_ACOMP, S.acomp);
}
function csvAlertas() {
  const c = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [["Prioridade", "Tipo", "Mês", "Alerta", "Detalhe", "Pergunta", "Situação", "Resposta/anotação", "Atualizado em"].map(c).join(";")];
  for (const a of S.alertas) { const ac = S.acomp[a.chave] || {}; linhas.push([SEV[a.sev], a.tipo, a.mes ? rotuloMes(a.mes) : "", a.titulo, a.detalhe, a.pergunta, SITUACOES[a.sit], ac.resposta || "", ac.data || ""].map(c).join(";")); }
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
const ABAS = ["painel", "analises", "mes", "projecao", "categorias", "fornecedores", "alertas", "parcelas", "lancamentos", "notas", "conselho", "dados"];
function rota() {
  const a = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "painel";
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
  if (t.dataset.acomp) { salvarAcomp(t.dataset.acomp, "status", t.value); render(); toast("Situação do alerta atualizada."); }
  if (t.dataset.resp) { salvarAcomp(t.dataset.resp, "resposta", t.value); toast("Anotação salva neste navegador. Publique a base para compartilhar."); }
});
document.addEventListener("click", (e) => {
  const l = e.target.closest("a[data-filtra-mes]"); if (!l) return;
  S.ids = lancamentos(S.todos).filter((d) => d.mes === l.dataset.filtraMes).map((d) => d.id); lancTab();
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

const tip = $("#tip");
document.addEventListener("mousemove", (e) => {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.getAttribute("data-tip"); tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(innerWidth - w - 12, e.clientX + 14) + "px";
  tip.style.top = (e.clientY - h - 12 < 8 ? e.clientY + 18 : e.clientY - h - 12) + "px";
});
if (window.self === window.top) { $("#btnImprimir").hidden = false; $("#btnImprimir").addEventListener("click", () => window.print()); }

rota();
await carregarBase();
render();

})();
