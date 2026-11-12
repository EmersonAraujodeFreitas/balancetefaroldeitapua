// Leitor de balancetes "Demonstrativo de Receitas e Despesas" da Logo Gestão Condominial.
// Funciona no navegador (pdf.js) e no Node (testes). Recebe o objeto pdfjsLib.

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export function parseNum(s) {
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
export function nomeCategoria(h) {
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
  [/DUOS SINDICOS/i, "Duos Síndicos 360"],
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
export function mascarar(s) {
  return s
    .replace(/\(\d{2}\)\s*\d{4,5}-\d{4}/g, "(**) *****-****")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\s+/g, "")
    .replace(/(\b[A-ZÀ-Ú]{2,}(?:\s+[A-ZÀ-Ú]{2,})+)\s+\d{9,11}\b/g, "$1");
}

const MINUSC = new Set(["de","da","do","das","dos","e","em","para","com"]);
export function titulo(t) {
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(/\s+/).map((w, i) => (i && MINUSC.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function separarFornecedor(desc, categoria) {
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

export async function lerBalancete(pdfjsLib, data, nomeArquivo = "") {
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

export function conferir(b) {
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
