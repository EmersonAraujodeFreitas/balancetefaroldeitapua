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
const ALIASES_V1 = [
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
// nome padronizado: razão social por extenso, sem LTDA/ME/S.A., com acentos e sem apelidos entre parênteses
const ALIASES = [
  [/SECRETARIA DA RECEITA|RECEITA FEDERAL/i, "Receita Federal"],
  [/LOGOSERV/i, "Logoserv Recursos Humanos"],
  [/LOGO GER[EÊ]NCIA/i, "Logo Gerência de Cobranças"],
  [/QUALYSERVICE/i, "Qualyservice Gestão e Serviços"],
  [/AMPER/i, "Amper Tecnologia e Segurança Eletrônica"],
  [/PINHEIRO BRITO/i, "Pinheiro Brito Sociedade Individual de Advocacia"],
  [/HEBERT GOMES/i, "Hebert Gomes Dias"],
  [/\bDR3\b/i, "DR3 Manutenção e Serviços"],
  [/COELBA/i, "Coelba"],
  [/EMBASA/i, "Embasa"],
  [/SICOOB/i, "Sicoob"],
  [/BRADESCO/i, "Bradesco"],
  [/DUOS? S[IÍ]NDICOS?/i, "Duos Síndicos 360"],
  [/DIEGO CONCEI/i, "Diego Conceição Pereira"],
  [/ANDRADE E MUNIZ/i, "Andrade e Muniz Comércio e Serviços"],
  [/NIL MATERIAIS/i, "Nil Materiais de Construção"],
  [/C[EÉ]LIA XISTO/i, "Célia Xisto Lima Publicidade"],
  [/PAULO S[EÉ]RGIO/i, "Paulo Sérgio dos Santos Maurício"],
  [/TRACCK/i, "Tracck Tecnologia"],
  [/HORTO R\.?F/i, "Horto R.F Tudo para Jardins"],
  [/LOMES/i, "Lomes Multi Distribuidora"],
  [/LEROY/i, "Leroy Merlin"],
  [/JCM NITER[OÓ]I/i, "JCM Niterói Refrigeração"],
  [/FRIGELAR/i, "Frigelar Comércio e Indústria"],
  [/\bTIM S\.?A\b|^TIM\b/i, "TIM"],
  [/MATHEUS DA SILVA/i, "Matheus da Silva Dias dos Santos"],
  [/NEIDE LIMA/i, "Neide Lima Pereira Alves de Oliveira"],
  [/CAIO OLIVEIRA/i, "Caio Oliveira Santa Ana"],
  [/FERREIRA COSTA/i, "Ferreira Costa e Cia"],
  [/SAPUCA[UÚ]NA/i, "Sapucaúna Locação de Equipamentos"],
  [/ENTERPRISE/i, "Enterprise Smart Connect"],
  [/MAGAZINE LUIZA|MAGALU/i, "Magazine Luiza"],
  [/EBAZAR/i, "Ebazar.com.br"],
  [/LIMEIRA/i, "André Nascimento Limeira"],
  [/PASSARINHO/i, "M.F. Passarinho Artigos Eletrônicos"],
  [/RBMX/i, "RBMX Imunização e Manutenção"],
  [/INGRID PIMENTEL/i, "Ingrid Pimentel Silva Gabriel"],
  [/\bNILDO\b/i, "José Nildo Ferreira dos Santos"],
  [/MERCADO\s?PAGO/i, "Mercado Pago"],
  [/ALLIANZ/i, "Allianz Seguros"],
  [/MATEUS SANTIAGO/i, "Mateus Santiago Oliveira"],
  [/OP[CÇ][AÃ]O\s?ARTEFATOS/i, "Opção Artefatos"],
  [/PODER JUDICI[AÁ]RIO/i, "Poder Judiciário do Estado da Bahia"],
  [/ANDERSON FIGUEIREDO/i, "Anderson Figueiredo do Nascimento"],
  [/\bAF INSTALA/i, "AF Instalação, Manutenção e Construção"],
  [/FERIMPORT/i, "Ferimport Comércio, Representação e Importação"],
  [/VIP CASA DECOR/i, "VIP Casa Decor Comércio"],
];
// acentos e palavras cortadas no PDF
const ACENTOS = Object.fromEntries(("instalacao:instalação manutencao:manutenção construcao:construção construcoes:construções comercio:comércio servicos:serviços servico:serviço " +
  "solucao:solução solucoes:soluções irrigacao:irrigação refrigeracao:refrigeração importacao:importação comunicacao:comunicação locacao:locação seguranca:segurança " +
  "eletronica:eletrônica eletronico:eletrônico eletronicos:eletrônicos eletrico:elétrico eletricos:elétricos eletrica:elétrica eletricas:elétricas distribuicao:distribuição " +
  "imunizacao:imunização sonorizacao:sonorização acrilicos:acrílicos metalurgica:metalúrgica petroleo:petróleo industria:indústria moveis:móveis escritorio:escritório " +
  "vestuario:vestuário vestuari:vestuário decoracao:decoração decora:decoração palacio:palácio irmaos:irmãos opcao:opção judiciario:judiciário atlantida:atlântida " +
  "representacoes:representações representacao:representação repr:representação sao:são joao:joão jose:josé andre:andré sergio:sérgio mauricio:maurício celia:célia " +
  "niteroi:niterói gerencia:gerência cobrancas:cobranças sindicos:síndicos conceicao:conceição lucia:lúcia brandao:brandão gestao:gestão impor:importação nascim:nascimento " +
  "tecnicos:técnicos tecnica:técnica hidraulica:hidráulica hidraulicos:hidráulicos ferragens:ferragens papelaria:papelaria grafica:gráfica optica:óptica farmacia:farmácia " +
  "agua:água energia:energia veiculos:veículos acessorios:acessórios informatica:informática musica:música musicais:musicais otica:ótica").split(" ").map((x) => x.split(":")));
const ABREV = [[/\bSoc\.?\s+Ind\.?\s+de\b/gi, "Sociedade Individual de"], [/\bCom\.\s/gi, "Comércio "], [/\bArt\.\s/gi, "Artigos "], [/\bSeg\.\s/gi, "Segurança "]];
const SIGLA = /^(?:[A-Z]\.){1,3}[A-Z]?\.?$|^[B-DF-HJ-NP-TV-Z0-9]{2,4}$|^[A-Z]\d|^\d[A-Z]/;
function padronizarNome(t) {
  let s = String(t || "").replace(/\s+\d{6,}\.?$/, "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/[,\s]+(LTDA|ME|EPP|EIRELI|S\/A|S\.A\.?|SA)\.?(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  for (const [re, v] of ABREV) s = s.replace(re, v);
  return s.split(" ").map((w, i) => {
    const up = w.toUpperCase();
    if (SIGLA.test(up) && w === up) return up;
    let lw = w.toLowerCase();
    const base = lw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), m = /^([a-z]+)([^a-z]*)$/.exec(base);
    if (m && ACENTOS[m[1]] && lw.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === lw) lw = ACENTOS[m[1]] + m[2];
    if (i && MINUSC.has(lw)) return lw;
    return lw.charAt(0).toUpperCase() + lw.slice(1);
  }).join(" ");
}
// nome canônico de um fornecedor a partir do texto do balancete ou de um nome já exibido antes
function nomeFornecedor(bruto, desc = "") {
  const a = ALIASES.find(([re]) => re.test(bruto)) || (desc ? ALIASES.find(([re]) => re.test(desc)) : null);
  return a ? a[1] : padronizarNome(bruto);
}
// nome usado pelas versões anteriores (para reencontrar anotações gravadas com ele)
function nomeAntigo(bruto, desc = "") {
  const a = ALIASES_V1.find(([re]) => re.test(bruto)) || (desc ? ALIASES_V1.find(([re]) => re.test(desc)) : null);
  return a ? a[1] : titulo(bruto.replace(/\s+\d{6,}\.?$/, "").replace(/\s+(LTDA|ME|EIRELI|S\/A|SA)\.?$/i, "").trim());
}

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
  const bruto = forn;
  forn = nomeFornecedor(bruto, desc);
  return { forn, fornV1: nomeAntigo(bruto, desc), item: item.trim(), det: det.trim() };
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

// datas impossíveis nas notas da administradora (ex.: 20/0/2026) e a data provável, deduzida dos lançamentos do mês
const fmtV = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function datasErradasNota(texto, b, meses = []) {
  const out = [], forn = identificarFornecedor(texto);
  const validas = [...texto.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)].filter((m) => +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31);
  for (const m of texto.matchAll(/\b(\d{1,2})\/(\d{0,2})\/(\d{4})\b/g)) {
    const [orig, dd, mm, aa] = m;
    if (mm.length === 2 && +mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31 && dd.length === 2) continue;
    const res = { orig, sug: "", motivo: "", ids: [] };
    const doForn = forn ? b.despesas.map((d, i) => ({ ...d, id: `${b.mes}#${i}` })).filter((d) => d.forn === forn) : [];
    const citados = new Set(validas.map((v) => `${v[2]}/${v[3]}`));
    const cands = [...new Set(doForn.map((d) => d.ref).filter((r) => /^\d{2}\/\d{4}$/.test(r || "") && r.endsWith(aa) && !citados.has(r) && r.startsWith(mm.length ? mm : "")))];
    if (cands.length === 1 && dd.length === 2) {
      res.sug = `${dd}/${cands[0]}`;
      const ls = doForn.filter((d) => d.ref === cands[0] || citados.has(d.ref));
      res.ids = ls.map((d) => d.id);
      res.motivo = `No mesmo balancete, ${forn} tem ${ls.length} pagamento(s) com as competências ${ls.map((d) => `${d.ref} (${fmtV(d.v)}, pago em ${d.baixa})`).join(" e ")}; a nota já cita ${[...citados].map((c) => `${dd}/${c}`).join(", ") || "outra data"}, então a data incompleta é a da competência ${cands[0]}.`;
      const tot = /(?:valor total|no valor) de R\$\s*([\d.]+,\d{2})/i.exec(texto);
      if (tot) {
        const vals = meses.flatMap((x) => x.despesas.filter((d) => d.forn === forn).map((d) => d.v)), freq = {};
        for (const v of vals) freq[v] = (freq[v] || 0) + 1;
        const base = +Object.entries(freq).sort((a, b2) => b2[1] - a[1])[0]?.[0];
        const exc = ls.map((d) => Math.round((d.v - base) * 100) / 100), alvo = +tot[1].replace(/\./g, "").replace(",", ".");
        if (base && exc.every((e) => e > 0) && Math.abs(exc.reduce((a, e) => a + e, 0) - alvo) < 0.015) res.motivo += ` Os encargos também conferem: ${exc.map(fmtV).join(" + ")} acima do valor normal de ${fmtV(base)} = ${fmtV(alvo)}.`;
      }
    }
    out.push(res);
  }
  return out;
}
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
      `As faturas ${g.map((d) => d.nf).join(" e ")} da UC ${u} são a mesma conta paga duas vezes? Se sim, a Coelba creditou a diferença?`, g.map((d) => d.id), g.at(-1).mes, "Coelba");
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
    for (const x of datasErradasNota(t, b, meses)) add("baixa", "Nota explicativa", `${rotuloMes(b.mes)}: data incompleta na nota da administradora (${x.orig})`,
      `${t}\n\n${x.sug ? `Provável data correta: ${x.sug}. ${x.motivo}` : "Não foi possível deduzir a data pelos lançamentos do mês."}`,
      `Pedir à administradora corrigir a data "${x.orig}" na nota do balancete de ${rotuloMes(b.mes)}${x.sug ? ` (deve ser ${x.sug})` : ""}.`, x.ids, b.mes, forn);
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
      if (/sicoob|bradesco|banco|receita federal/i.test(f.forn)) continue;
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
      add(atual > ant ? "baixa" : "info", "Contrato", `${g[0].forn}${g[0].forn.toLowerCase().includes(`(${g[0].item.toLowerCase()})`) ? "" : ` (${g[0].item.toLowerCase()})`}: valor ${atual > ant ? "subiu" : "caiu"} de ${fmt(ant)} para ${fmt(atual)}`,
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
      pergunta: [...new Set(as.map((a) => a.pergunta).filter(Boolean))].join(" "),
      partes: as.map((a) => ({ tipo: a.tipo, forn: a.forn, titulo: a.titulo })) });
  }
  return saida.sort((a, b) => SEVN[a.sev] - SEVN[b.sev] || (b.mes || "").localeCompare(a.mes || ""));
}

// ===== graficos.mjs
// Biblioteca de gráficos do painel (SVG próprio, sem dependências).
// Todos os gráficos são derivados dos meses carregados e se adaptam a meses, categorias e fornecedores novos.

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
function comboMensal(rm) {
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
function saude(meses, alertas) {
  const rm = meses.map((b) => ({ mes: b.mes, r: b.totais.receitas, d: b.totais.despesas, s: b.totais.saldoAtual }));
  const u3 = rm.slice(-3), u6 = rm.slice(-6);
  const cob = u3.reduce((a, m) => a + m.r, 0) / (u3.reduce((a, m) => a + m.d, 0) || 1);
  const despMed = u3.reduce((a, m) => a + m.d, 0) / u3.length;
  const reserva = (rm.at(-1)?.s ?? 0) / (despMed || 1);
  const negs = u6.filter((m) => m.s < 0).length;
  const fin = indicadores(meses.slice(-6)).fin.total / (u6.reduce((a, m) => a + m.r, 0) || 1);
  const altas = alertas.filter((a) => a.sev === "alta" && (a.sit === "pendente" || a.sit === "questionado")).length;
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
function treemapCategorias(meses) {
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
function listaTendencia(meses) {
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
function fluxo(meses) {
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
function pontePeriodo(meses) {
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
    g += `<text x="${cx}" y="${top - 7}" text-anchor="middle" class="val" style="font-size:10.5px">${(b.v < 0 ? "−" : "") + Math.abs(b.v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</text>`;
    g += `<text transform="translate(${cx} ${H - mb + 16}) rotate(-35)" text-anchor="end" class="eixo-cat">${kEsc(b.nome)}</text>`;
  });
  return kSvg(W, H, "Do saldo inicial ao saldo final do período", g) + gMemoria(ini, rec, cats, fim, `Saldo inicial (antes de ${rotuloMes(meses[0].mes)})`, `Saldo final informado no balancete de ${rotuloMes(meses.at(-1).mes)}`);
}

// ------------------------------------------------------------------ tendência por categoria (pequenos múltiplos)
function multiplos(meses) {
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
function pareto(meses, n = 15) {
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
function formasPagamento(meses) {
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

function renderExecutivo(meses, el) {
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

// valor exato sem o prefixo R$, para caber sobre a barra
const gExato = (v) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// memória de cálculo da ponte: cada passo com valor exato, saldo acumulado e conferência com o saldo impresso
function gMemoria(ini, rec, cats, fimInformado, rotIni, rotFim) {
  let acc = ini;
  const tot = cats.reduce((s, c) => s + c.total, 0);
  const lin = [`<tr><td>${rotIni}</td><td class="n"></td><td class="n">${gBrl(ini)}</td><td class="n"></td><td class="n"><b>${gBrl(ini)}</b></td></tr>`];
  acc += rec;
  lin.push(`<tr><td>(+) Receitas</td><td class="n pos">${gBrl(rec)}</td><td class="n"></td><td class="n mini">100,0%</td><td class="n"><b>${gBrl(acc)}</b></td></tr>`);
  for (const c of cats) { acc = Math.round((acc - c.total) * 100) / 100; lin.push(`<tr><td>(−) ${gEsc(c.cat)}</td><td class="n neg">−${gBrl(c.total).replace("R$", "R$")}</td><td class="n"></td><td class="n mini">${rec ? gPct(c.total / rec) : "–"}</td><td class="n ${acc < 0 ? "neg" : ""}"><b>${gBrl(acc)}</b></td></tr>`); }
  const calc = Math.round((ini + rec - tot) * 100) / 100, dif = Math.round((fimInformado - calc) * 100) / 100;
  return `<details class="memoria" open><summary>Memória de cálculo (valores exatos)</summary><div class="tabela" style="margin-top:8px"><table>
    <thead><tr><th>Passo</th><th class="n">Movimento</th><th class="n">Saldo de partida</th><th class="n">% da receita</th><th class="n">Saldo acumulado</th></tr></thead>
    <tbody>${lin.join("")}
    <tr class="total"><td>(=) Total das despesas</td><td class="n neg">−${gBrl(tot)}</td><td class="n"></td><td class="n mini">${rec ? gPct(tot / rec) : "–"}</td><td class="n"></td></tr>
    <tr class="total"><td>(=) Saldo calculado: ${gBrl(ini)} + ${gBrl(rec)} − ${gBrl(tot)}</td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n"><b>${gBrl(calc)}</b></td></tr>
    <tr><td>${rotFim}</td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n"><b>${gBrl(fimInformado)}</b></td></tr>
    <tr><td>Diferença</td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n">${Math.abs(dif) < 0.01 ? '<span class="pill ok">R$ 0,00 · confere</span>' : `<span class="pill alta">${gBrl(dif)} · não confere</span>`}</td></tr>
    </tbody></table></div></details>`;
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
  const W = 1200, H = 400, ml = 66, mr = 12, mt = 30, mb = 92;
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
    g += `<text x="${cx}" y="${top - 6}" text-anchor="middle" class="anot" style="font-size:11px">${gExato(x.v)}</text>`;
    const nome = x.nome.replace(" e encargos bancários", " bancárias").replace("Consumo (água e energia)", "Água e energia").replace("Prestação de serviços", "Serviços").replace("Locação de equipamentos", "Locação").replace("Impostos e tributos", "Impostos");
    g += `<text transform="translate(${cx} ${H - mb + 14}) rotate(-35)" text-anchor="end" class="cat" style="font-size:12.5px">${gEsc(nome)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Do saldo anterior ao saldo final do mês">${g}</svg>
  ${gMemoria(b.totais.saldoAnterior ?? 0, b.totais.receitas, cats, b.totais.saldoAtual, "Saldo anterior", `Saldo final informado no balancete de ${rotuloMes(b.mes)}`)}`;
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
const hashTxt = (t) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
// chave antiga (mantida só para recuperar anotações gravadas antes da mudança)
function chaveAntiga(a) {
  return "a" + hashTxt(`${a.tipo}|${a.forn || ""}|${a.titulo.replace(/R\$\s?[−-]?[\d.,]+/g, "").replace(/\d+ (pontos|lançamento\(s\)|pagamento\(s\)|meses|mês)/g, "")}`);
}
// chave estável: ignora valores, percentuais, contagens e meses que mudam a cada balancete;
// preserva números de NF e UC, que identificam o assunto
function chaveAlerta(a) {
  const t = a.titulo
    .replace(/\b(NF|UC|nota fiscal)\s*(\d[\d./-]*)/gi, (_, k, n) => `${k.toUpperCase()}#${n.replace(/\D/g, "")}`)
    .replace(/R\$\s?[−-]?[\d.,]+/g, "")
    .replace(/\b[a-zç]{3}\/\d{4}\b/gi, "")
    .replace(/(?<![#\d])\d[\d.,]*\s*%?/g, "")
    .replace(/\bmeses\b/g, "mês").replace(/\s+/g, " ").trim();
  return "b" + hashTxt(`${a.tipo}|${a.forn || ""}|${t}`);
}

// ===== acesso.mjs
// Controle de acesso com Firebase (Authentication + Firestore).
// Só entra em ação quando js/firebase-config.js define window.__FIREBASE__.
// Usuário e senha: o "usuário" vira um e-mail técnico (usuario@DOMINIO_ACESSO), que ninguém precisa conhecer.
const FB_VER = "10.12.2";
const fbUrl = (m) => `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}.js`;
const DOMINIO_ACESSO = "acesso.farol-itapua.app";
const PERFIS = { admin: "Administrador", conselheiro: "Conselheiro", visualizacao: "Visualização" };
const PERFIS_DESC = {
  admin: "Vê tudo, edita anotações, importa balancetes e cria acessos",
  conselheiro: "Vê tudo e registra respostas e anotações",
  visualizacao: "Só consulta: não altera nada",
};
const AC = { ligado: false, fb: null, user: null, reg: null, perfil: null };
const podeEditar = () => !AC.ligado || AC.perfil === "admin" || AC.perfil === "conselheiro";
const ehAdmin = () => !AC.ligado || AC.perfil === "admin";

function normUsuario(u) {
  return String(u || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._-]/g, "");
}
const emailDe = (usuario, sufixo = "") => `${normUsuario(usuario)}${sufixo}@${DOMINIO_ACESSO}`;
function senhaProvisoria() {
  // sem caracteres que confundem (0/O, 1/l/I)
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", N = "23456789", T = L + N;
  const r = new Uint32Array(10); crypto.getRandomValues(r);
  let s = L[r[0] % L.length] + N[r[1] % N.length];
  for (let i = 2; i < 10; i++) s += T[r[i] % T.length];
  return s.split("").sort(() => (crypto.getRandomValues(new Uint8Array(1))[0] & 1) - 0.5).join("");
}
function validarSenha(s, antiga) {
  if (s.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Use letras e números.";
  if (antiga && s === antiga) return "A nova senha precisa ser diferente da provisória.";
  return "";
}
function mensagemErro(e) {
  const c = (e && e.code) || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return "Usuário ou senha incorretos.";
  if (/too-many-requests/.test(c)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/network/.test(c)) return "Sem conexão com o serviço de acesso. Verifique a internet.";
  if (/email-already-in-use/.test(c)) return "Esse usuário já existe.";
  if (/weak-password/.test(c)) return "Senha fraca: use pelo menos 8 caracteres, com letras e números.";
  if (/requires-recent-login/.test(c)) return "Por segurança, saia e entre de novo antes de trocar a senha.";
  if (/permission-denied|insufficient/.test(c)) return "Permissão negada. Confira as regras do Firestore (aba Administração).";
  if (/unauthorized-domain|operation-not-allowed/.test(c)) return "O Firebase ainda não está liberado para este endereço. Confira o passo a passo na aba Administração.";
  return (e && e.message) || "Erro inesperado.";
}

async function carregarFirebase(cfg) {
  const [app, auth, fs] = await Promise.all([import(fbUrl("app")), import(fbUrl("auth")), import(fbUrl("firestore"))]);
  const a = app.initializeApp(cfg);
  AC.fb = { app, auth, fs, a, au: auth.getAuth(a), db: fs.getFirestore(a), cfg };
  AC.ligado = true;
  return AC.fb;
}
const ref = (...p) => AC.fb.fs.doc(AC.fb.db, ...p);
const agora = () => AC.fb.fs.serverTimestamp();

async function existeAdministrador() {
  const d = await AC.fb.fs.getDoc(ref("config", "inicial"));
  return d.exists();
}
async function entrar(usuario, senha) {
  const { auth, fs, au } = AC.fb;
  const u = normUsuario(usuario);
  let email = usuario.includes("@") ? usuario.trim() : emailDe(u);
  if (!usuario.includes("@")) { const l = await fs.getDoc(ref("logins", u)); if (l.exists() && l.data().email) email = l.data().email; }
  return auth.signInWithEmailAndPassword(au, email, senha);
}
const sair = () => AC.fb.auth.signOut(AC.fb.au);
const aoMudarSessao = (cb) => AC.fb.auth.onAuthStateChanged(AC.fb.au, cb);

async function lerPerfil(user) {
  const d = await AC.fb.fs.getDoc(ref("usuarios", user.uid));
  AC.user = user; AC.reg = d.exists() ? d.data() : null; AC.perfil = AC.reg && AC.reg.ativo ? AC.reg.perfil : null;
  return AC.reg;
}
async function registrarAcesso() {
  try { await AC.fb.fs.updateDoc(ref("usuarios", AC.user.uid), { ultimoAcesso: agora() }); } catch {}
}
async function trocarSenha(nova, atual) {
  const { auth, fs, au } = AC.fb;
  if (atual) await auth.reauthenticateWithCredential(au.currentUser, auth.EmailAuthProvider.credential(au.currentUser.email, atual));
  await auth.updatePassword(au.currentUser, nova);
  await fs.updateDoc(ref("usuarios", au.currentUser.uid), { trocarSenha: false, senhaAlteradaEm: agora() });
  if (AC.reg) AC.reg.trocarSenha = false;
}

// primeiro administrador: só funciona enquanto config/inicial não existir (garantido pelas regras)
async function criarPrimeiroAdmin(nome, usuario, senha) {
  const { auth, fs, au, db } = AC.fb;
  const u = normUsuario(usuario), email = emailDe(u);
  let cred;
  // se uma tentativa anterior criou a conta mas não conseguiu gravar no banco, aproveita a conta
  try { cred = await auth.createUserWithEmailAndPassword(au, email, senha); }
  catch (e) { if (!/email-already-in-use/.test(e.code || "")) throw e; cred = await auth.signInWithEmailAndPassword(au, email, senha); }
  const b = fs.writeBatch(db), uid = cred.user.uid;
  b.set(ref("config", "inicial"), { admin: uid, criadoEm: agora() });
  b.set(ref("usuarios", uid), { usuario: u, nome, perfil: "admin", ativo: true, trocarSenha: false, criadoEm: agora(), criadoPor: uid });
  b.set(ref("logins", u), { email, uid });
  await b.commit();
  return cred.user;
}
// conta nova numa instância separada, para não derrubar a sessão do administrador
async function criarConta(email, senha) {
  const { app, auth, cfg } = AC.fb;
  const sec = app.initializeApp(cfg, "cadastro-" + Date.now());
  try {
    const sa = auth.initializeAuth(sec, { persistence: auth.inMemoryPersistence });
    const cred = await auth.createUserWithEmailAndPassword(sa, email, senha);
    await auth.signOut(sa);
    return cred.user.uid;
  } finally { try { await app.deleteApp(sec); } catch {} }
}
async function criarAcesso({ nome, usuario, perfil }) {
  const { fs, db } = AC.fb;
  const u = normUsuario(usuario);
  if (!u) throw new Error("Informe um usuário com letras ou números.");
  if ((await fs.getDoc(ref("logins", u))).exists()) throw Object.assign(new Error("Esse usuário já existe."), { code: "email-already-in-use" });
  const senha = senhaProvisoria(), email = emailDe(u);
  const uid = await criarConta(email, senha);
  const b = fs.writeBatch(db);
  b.set(ref("usuarios", uid), { usuario: u, nome, perfil, ativo: true, trocarSenha: true, criadoEm: agora(), criadoPor: AC.user.uid });
  b.set(ref("logins", u), { email, uid });
  await b.commit();
  return { usuario: u, senha };
}
// o navegador não pode trocar a senha de outra pessoa; por isso a conta é refeita com senha provisória nova
async function novaSenhaProvisoria(uidAntigo) {
  const { fs, db } = AC.fb;
  const antigo = (await fs.getDoc(ref("usuarios", uidAntigo))).data();
  const senha = senhaProvisoria(), email = emailDe(antigo.usuario, ".r" + Date.now().toString(36));
  const uid = await criarConta(email, senha);
  const b = fs.writeBatch(db);
  b.set(ref("usuarios", uid), { usuario: antigo.usuario, nome: antigo.nome, perfil: antigo.perfil, ativo: antigo.ativo !== false, trocarSenha: true, criadoEm: agora(), criadoPor: AC.user.uid, substitui: uidAntigo });
  b.update(ref("usuarios", uidAntigo), { ativo: false, substituidoPor: uid });
  b.set(ref("logins", antigo.usuario), { email, uid });
  await b.commit();
  return { usuario: antigo.usuario, senha };
}
const atualizarAcesso = (uid, campos) => AC.fb.fs.updateDoc(ref("usuarios", uid), campos);
async function listarAcessos() {
  const q = await AC.fb.fs.getDocs(AC.fb.fs.collection(AC.fb.db, "usuarios"));
  return q.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => !u.substituidoPor);
}

// ---------------------------------------------------------------- dados protegidos
async function lerDados() {
  const { fs, db } = AC.fb;
  const [q, ac, an, orc, ct, fu] = await Promise.all([fs.getDocs(fs.collection(db, "balancetes")), fs.getDoc(ref("acompanhamento", "geral")), fs.getDoc(ref("conteudo", "analise")), fs.getDoc(ref("conteudo", "orcamento")), fs.getDoc(ref("conteudo", "contratos")), fs.getDoc(ref("conteudo", "fundo"))]);
  const meses = {};
  q.docs.forEach((d) => (meses[d.id] = d.data()));
  return { meses, acompanhamento: ac.exists() ? ac.data().itens || {} : {}, analise: an.exists() ? an.data().html || "" : "",
    orcamento: orc.exists() ? orc.data().previsoes || [] : [],
    contratos: ct.exists() ? ct.data().lista || [] : [], fundo: fu.exists() ? fu.data().config || null : null };
}
async function gravarMeses(meses) {
  const { fs, db } = AC.fb;
  const lista = Object.values(meses);
  for (let i = 0; i < lista.length; i += 400) {
    const b = fs.writeBatch(db);
    for (const m of lista.slice(i, i + 400)) b.set(ref("balancetes", m.mes), JSON.parse(JSON.stringify(m)));
    await b.commit();
  }
}
const gravarOrcamento = (previsoes) => AC.fb.fs.setDoc(ref("conteudo", "orcamento"), { previsoes: JSON.parse(JSON.stringify(previsoes)), atualizado: agora() });
const gravarContratos = (lista) => AC.fb.fs.setDoc(ref("conteudo", "contratos"), { lista: JSON.parse(JSON.stringify(lista)), atualizado: agora() });
const gravarFundo = (config) => AC.fb.fs.setDoc(ref("conteudo", "fundo"), { config: JSON.parse(JSON.stringify(config)), atualizado: agora() });
// registro de acessos e alterações (só o administrador lê; ninguém altera ou apaga)
async function registrar(acao, detalhe = "") {
  if (!AC.ligado || !AC.user) return;
  try {
    await AC.fb.fs.addDoc(AC.fb.fs.collection(AC.fb.db, "registros"), { uid: AC.user.uid, nome: nomeUsuario(), usuario: AC.reg?.usuario || "", acao, detalhe: String(detalhe).slice(0, 300), ts: agora() });
  } catch {}
}
async function lerRegistros(n = 300) {
  const { fs, db } = AC.fb;
  const q = await fs.getDocs(fs.query(fs.collection(db, "registros"), fs.orderBy("ts", "desc"), fs.limit(n)));
  return q.docs.map((d) => d.data());
}
const nomeUsuario = () => (AC.reg ? AC.reg.nome || AC.reg.usuario : "");
const gravarAnalise = (html) => AC.fb.fs.setDoc(ref("conteudo", "analise"), { html, atualizado: agora() });
// grava só os itens alterados; merge preserva o que outros conselheiros gravaram
const gravarAcomp = (itens) => AC.fb.fs.setDoc(ref("acompanhamento", "geral"), { itens: JSON.parse(JSON.stringify(itens)), atualizado: agora() }, { merge: true });
const ouvirAcomp = (cb) => AC.fb.fs.onSnapshot(ref("acompanhamento", "geral"), (d) => cb(d.exists() ? d.data().itens || {} : {}), () => {});

const REGRAS = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function logado() { return request.auth != null; }
    function reg() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data; }
    function ativo() { return logado() && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && reg().ativo == true; }
    function admin() { return ativo() && reg().perfil == 'admin'; }
    function editor() { return ativo() && (reg().perfil == 'admin' || reg().perfil == 'conselheiro'); }
    function inicial() {
      return !exists(/databases/$(database)/documents/config/inicial)
        && existsAfter(/databases/$(database)/documents/config/inicial);
    }
    match /config/inicial {
      allow read: if true;
      allow create: if logado() && !exists(/databases/$(database)/documents/config/inicial)
        && request.resource.data.admin == request.auth.uid;
    }
    match /logins/{usuario} {
      allow read: if true;
      allow write: if admin() || (inicial() && request.resource.data.uid == request.auth.uid);
    }
    match /usuarios/{uid} {
      allow read: if admin() || (logado() && request.auth.uid == uid);
      allow create: if admin() || (inicial() && uid == request.auth.uid && request.resource.data.perfil == 'admin');
      allow update: if admin() || (logado() && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['trocarSenha', 'senhaAlteradaEm', 'ultimoAcesso'])
        && request.resource.data.get('trocarSenha', false) == false);
      allow delete: if false;
    }
    match /balancetes/{mes} { allow read: if ativo(); allow write: if admin(); }
    match /conteudo/{doc} { allow read: if ativo(); allow write: if admin(); }
    match /acompanhamento/{doc} { allow read: if ativo(); allow write: if editor(); }
    match /registros/{id} {
      allow read: if admin();
      allow create: if ativo() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }
  }
}`;

// ===== contratos.mjs
// Leitura de contratos em PDF: texto do PDF (PDF.js) ou, se for digitalizado, reconhecimento óptico (Tesseract.js)
// e extração dos campos principais por regras de texto. Tudo roda no navegador; o PDF não é enviado a nenhum servidor
// (exceto o download do Tesseract e do dicionário de português, quando o PDF é uma imagem).
const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const MESES_N = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const ctNorm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ctIso = (d, m, a) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// "2.000,00", "2000,00" ou, quando o OCR troca a vírgula, "25.00"
const ctNum = (s) => { const x = String(s).replace(/\s/g, ""), m = /^(.*)[.,](\d{2})$/.exec(x); return m ? parseFloat(m[1].replace(/[.,]/g, "") + "." + m[2]) : parseFloat(x.replace(/[.,]/g, "")); };

function carregarScript(url) {
  return new Promise((ok, erro) => {
    if (window.Tesseract) return ok();
    const s = document.createElement("script"); s.src = url; s.onload = () => ok(); s.onerror = () => erro(new Error("Não foi possível carregar o leitor de imagem (sem internet?)."));
    document.head.appendChild(s);
  });
}

// texto de todas as páginas; se quase não houver texto, o PDF é imagem e passa pelo OCR
async function textoDoPdf(pdfjs, dados, progresso = () => {}) {
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i), c = await p.getTextContent();
    let ult = null, linha = "";
    for (const it of c.items) {
      const y = Math.round(it.transform[5]);
      if (ult !== null && Math.abs(y - ult) > 3) { texto += linha + "\n"; linha = ""; }
      linha += (linha && !linha.endsWith(" ") ? " " : "") + it.str; ult = y;
    }
    texto += linha + "\n\n";
    progresso(`Lendo texto: página ${i} de ${doc.numPages}`);
  }
  if (texto.replace(/\s/g, "").length > doc.numPages * 150) return { texto, ocr: false, paginas: doc.numPages };
  // PDF digitalizado: renderiza cada página e reconhece o texto
  progresso("O PDF é uma imagem digitalizada. Carregando o leitor de texto (pode levar um minuto)…");
  await carregarScript(TESS_URL);
  const worker = await window.Tesseract.createWorker("por", 1, { logger: (m) => { if (m.status === "recognizing text") progresso(`Reconhecendo texto: ${Math.round(m.progress * 100)}%`); } });
  texto = "";
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      progresso(`Reconhecendo página ${i} de ${doc.numPages}…`);
      const p = await doc.getPage(i), vp = p.getViewport({ scale: 2 });
      const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
      await p.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      const r = await worker.recognize(cv);
      texto += r.data.text + "\n\n";
    }
  } finally { await worker.terminate(); }
  return { texto, ocr: true, paginas: doc.numPages };
}

// ---------------------------------------------------------------- qualquer arquivo: PDF, Word (.docx), imagem ou texto
// prints e fotos pequenas são ampliados (até ~2400 px de largura) e passados para tons de cinza: o OCR erra muito menos
async function ampliar(fonte) {
  if (!(fonte instanceof Blob) || typeof createImageBitmap !== "function") return fonte;
  try {
    const img = await createImageBitmap(fonte), k = Math.min(4, Math.max(1, 2400 / img.width));
    if (k <= 1.05) return fonte;
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.filter = "grayscale(1) contrast(1.15)"; g.drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  } catch { return fonte; }
}
async function ocrImagens(fontes, progresso) {
  progresso("Carregando o leitor de texto de imagens (pode levar um minuto)…");
  await carregarScript(TESS_URL);
  const worker = await window.Tesseract.createWorker("por", 1, { logger: (m) => { if (m.status === "recognizing text") progresso(`Reconhecendo texto: ${Math.round(m.progress * 100)}%`); } });
  let texto = "";
  try { for (let i = 0; i < fontes.length; i++) { progresso(`Reconhecendo imagem ${i + 1} de ${fontes.length}…`); texto += (await worker.recognize(await ampliar(fontes[i]))).data.text + "\n\n"; } }
  finally { await worker.terminate(); }
  return texto;
}
// .docx é um zip: lê word/document.xml com o descompactador do próprio navegador
async function textoDocx(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Arquivo Word inválido.");
  let p = dv.getUint32(eocd + 16, true); const nArq = dv.getUint16(eocd + 10, true), dec = new TextDecoder();
  for (let k = 0; k < nArq; k++) {
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    if (nome === "word/document.xml") {
      const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), dados = u8.subarray(ini, ini + tam);
      const xml = metodo === 0 ? dec.decode(dados) : await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      return xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error("Não encontrei o texto dentro do arquivo Word.");
}
async function textoDoArquivo(pdfjs, arquivo, progresso = () => {}) {
  const nome = arquivo.name.toLowerCase(), tipo = arquivo.type || "";
  if (nome.endsWith(".pdf") || tipo === "application/pdf") return textoDoPdf(await pdfjs(), new Uint8Array(await arquivo.arrayBuffer()), progresso);
  if (nome.endsWith(".docx")) { progresso("Lendo o documento do Word…"); return { texto: await textoDocx(await arquivo.arrayBuffer()), ocr: false, paginas: 1 }; }
  if (nome.endsWith(".txt") || tipo.startsWith("text/")) return { texto: await arquivo.text(), ocr: false, paginas: 1 };
  if (tipo.startsWith("image/") || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/.test(nome)) return { texto: await ocrImagens([arquivo], progresso), ocr: true, paginas: 1 };
  if (nome.endsWith(".doc")) throw new Error("Arquivos .doc antigos não podem ser lidos. Salve como .docx ou PDF no Word e importe de novo.");
  throw new Error("Formato não suportado. Use PDF, Word (.docx), imagem (JPG/PNG) ou texto.");
}

// fornecedor dos balancetes com mais palavras em comum com o nome do contratado
const VAZIAS = new Set(["sociedade", "individual", "ltda", "eireli", "servicos", "servico", "de", "da", "do", "das", "dos", "e", "me", "epp", "sa", "s/a", "comercio", "empresa", "cia", "companhia", "advogados", "associados",
  "tecnologia", "seguranca", "eletronica", "eletrica", "solucoes", "gestao", "engenharia", "construcoes", "construtora", "manutencao", "industria", "telecom", "telecomunicacoes", "sistemas", "brasil", "bahia", "grupo", "geral", "gerais"]);
function casarFornecedor(nome, forns) {
  const tk = (s) => ctNorm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !VAZIAS.has(w));
  // nota: palavras distintivas em comum (desempate pela proporção do nome do fornecedor)
  const a = new Set(tk(nome)); let melhor = null, nota = 0;
  for (const f of forns) { const b = tk(f.replace(/\(.*?\)/g, "")); if (!b.length) continue; const k = b.filter((w) => a.has(w)).length, r = k / b.length; if (r >= 0.5 && k + r > nota) { nota = k + r; melhor = f; } }
  return melhor;
}

// trechos mostrados na revisão nunca exibem CPF ou RG das partes
const ocultar = (x) => x.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "•••").replace(/(RG|identidade)[^,;]{0,40}?\d[\d.\-]{5,}/gi, "$1 •••").replace(/\b\d{8,11}\b/g, "•••");
const trecho = (txt, i, len = 0, raio = 90) => ocultar(txt.slice(Math.max(0, i - raio), i + len + raio).replace(/\s+/g, " ").trim());

// ---------------------------------------------------------------- leitura dos campos
const EXT = "(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|e|\\s|-)+";
const NUM = `(\\d{1,4})\\s*(?:\\(${EXT}\\))?`;
const DATA_RE = "(\\d{1,2}[\\/.]\\d{1,2}[\\/.]\\d{2,4}|\\d{1,2}[ºo°]?\\s+de\\s+[a-zç]+\\s+de\\s+\\d{4})";
function lerData(x) {
  if (!x) return "";
  let m = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/.exec(x);
  if (m) { const a = m[3].length === 2 ? "20" + m[3] : m[3]; return ctIso(m[1], m[2], a); }
  m = /(\d{1,2})[ºo°]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/.exec(ctNorm(x));
  return m && MESES_N[m[2]] ? ctIso(m[1], MESES_N[m[2]], m[3]) : "";
}
const somaMeses = (iso, n, menosUmDia = true) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); if (menosUmDia) d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const somaDiasIso = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const PAPEL_CONTRATADO = "contratad[oa]|prestador[a]?|locador[a]?|seguradora|fornecedor[a]?|empreiteir[oa]|vendedor[a]?|outorgad[oa]";
const PAPEL_CONTRATANTE = "contratante|locatari[oa]|segurado|assinante|tomador[a]?|comprador[a]?|outorgante";
const SUFIXO_EMP = /\b(ltda|s\.?\s?a\.?|eireli|me|epp|s\/s|sociedade|advocacia|advogados|seguros|servicos|telecom\w*|engenharia|construc\w+)\b/i;
const TIPOS_CT = [
  [/portaria|controle de acesso|vigilancia|seguranca patrimonial/, "Portaria e segurança"], [/elevador/, "Manutenção de elevadores"],
  [/seguranca eletronica|eletrica|eletronic|cftv|camera|interfon|portao|alarme|cerca eletrica/, "Manutenção elétrica e eletrônica"], [/limpeza|asseio/, "Limpeza e conservação"],
  [/elevador/, "Manutenção de elevadores"], [/apolice|seguro|segurad/, "Seguro"], [/internet|banda larga|comunicacao multimidia|fibra|telefon/, "Internet e telefonia"],
  [/empreitada|reforma|obra|fachada|pintura|impermeabiliza/, "Obra e reforma"], [/assessoria juridica|advocac|honorarios advocaticios/, "Assessoria jurídica"],
  [/administracao condominial|gestao condominial|administradora/, "Administração condominial"], [/bomba|piscina|jardin|dedetiza|portao|cftv|camera|interfon|gerador|incendio/, "Manutenção predial"],
  [/locacao|aluguel/, "Locação"], [/terceirizacao de mao de obra|mao de obra/, "Mão de obra terceirizada"],
];

function lerContrato(textoBruto, forns = []) {
  const t = String(textoBruto).normalize("NFC").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/-\n(?=[a-zà-ú])/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ");
  const n = ctNorm(t);
  const C = { adicionais: [], info: [] }, T = {};
  const um = (re, alvo = n) => { re.lastIndex = 0; return re.exec(alvo); };
  const todos = (re, alvo = n) => [...alvo.matchAll(re)];
  // frase em volta de i (limitada, porque o OCR às vezes não tem pontos)
  const frase = (i) => { let a = n.lastIndexOf(". ", i), b = n.indexOf(". ", i); a = Math.max(a < 0 ? 0 : a + 2, i - 200); b = Math.min(b < 0 ? n.length : b + 1, i + 260); const sep = n.slice(a, i).search(/(?:paragrafo \w+|clausula \w+|[a-z]\))\s/); return ocultar(t.slice(sep > 0 ? a + sep : a, b).trim()); };
  const info = (rot, txt, i) => { txt = txt && ocultar(txt); if (txt && !C.info.some((x) => x.rot === rot && x.txt === txt)) C.info.push({ rot, txt: txt.length > 300 ? txt.slice(0, 297) + "…" : txt }); if (i !== undefined && !T[rot]) T[rot] = trecho(t, i, 0, 100); };

  // ---- tipo do contrato (pelo título e pelo objeto)
  for (const trecho0 of [n.slice(0, 400), n.slice(0, 1800)]) { for (const [re, nome] of TIPOS_CT) if (re.test(trecho0)) { C.tipo = nome; break; } if (C.tipo) break; }

  // ---- número
  const ehDoc = (i) => /(cnpj|cpf|rg|oab|cep|inscri|identidade|lei|decreto|artigo|art\.|resolucao|norma|nbr)[^\d]{0,25}$/.test(n.slice(Math.max(0, i - 40), i)) || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}/.test(n.slice(i));
  let m = [...n.matchAll(/(?:contrato|apolice|proposta|termo|ordem de servico)[^.]{0,40}?\bn[ºo°.]*\s*:?\s*(\d[\d./-]*\d|\d)/gi), ...n.matchAll(/\bn[ºo°]\s*:?\s*(\d[\d./-]{2,}\d)/g)].find((x) => !ehDoc(x.index + x[0].length - x[1].length));
  if (m) { C.numero = t.slice(m.index, m.index + m[0].length).match(/(\d[\d./-]*\d|\d)\s*$/)[1]; T.numero = trecho(t, m.index, m[0].length, 40); }

  // ---- partes
  const nomeLimpo = (x) => x.replace(/^(a|o|as|os)\s+(empresa\s+)?/i, "").replace(/^empresa\s+/i, "").replace(/\s*[-–]\s*(cnpj|inscrit).*$/i, "").replace(/\s+(cnpj|inscrit[ao]|pessoa juridica|com sede|sediad[ao]|estabelecid[ao]).*$/i, "").replace(/[\s,.;:-]+$/, "").trim();
  const candidatos = [];
  // "CONTRATADA: NOME, ..."
  for (const x of todos(new RegExp(`\\b(${PAPEL_CONTRATADO})\\s*:\\s*([^;]{3,160}?)(?=,|;|\\s-\\s|\\s+cnpj|\\s+inscrit|\\s+com sede|$)`, "gi"), t)) candidatos.push({ nome: nomeLimpo(x[2]), i: x.index, peso: 3 });
  // "NOME, ... doravante denominada CONTRATADA"
  for (const x of todos(new RegExp(`(?:doravante|adiante|simplesmente)\\s+(?:simplesmente\\s+)?(?:denominad[oa]s?|designad[oa]s?|chamad[oa]s?)?\\s*(?:simplesmente\\s+)?(?:a|o)?\\s*(?:${PAPEL_CONTRATADO})\\b`, "gi"))) {
    const antes = t.slice(Math.max(0, x.index - 520), x.index);
    const emp = [...antes.matchAll(/(?:a empresa|empresa|o escrit[oó]rio)\s+([^,;]{3,120})/gi)].at(-1) || [...antes.matchAll(/([A-ZÀ-Ú][A-Za-zÀ-ú0-9&.\- ]{2,90}?\b(?:LTDA|Ltda|S\.?\s?A\.?|EIRELI|Eireli|EPP)\b\.?)/g)].at(-1);
    if (emp && !/condom/i.test(emp[1])) { candidatos.push({ nome: nomeLimpo(emp[1]), i: x.index, peso: 2.5 }); continue; }
    const corte = Math.max(antes.search(/de outro lado,?|do outro lado,?|por outro lado,?|e,? de outro,?|e de outro lado,?|e a empresa|e o escritorio|outro lado,? a empresa/i) >= 0 ? antes.toLowerCase().lastIndexOf("outro") : -1, antes.lastIndexOf(" e a "), antes.lastIndexOf("CONTRATANTE"));
    const seg = antes.slice(corte >= 0 ? corte : 0).replace(/^(outro|contratante)[^,a-z]*,?\s*(de outro lado,?|lado,?)?\s*/i, "").replace(/^(a empresa|o escrit[oó]rio|a|o)\s+/i, "");
    const nm = nomeLimpo(seg.split(",")[0]);
    if (nm.length > 3) candidatos.push({ nome: nm, i: x.index, peso: 2 });
  }
  // cabeçalho de apólice/termo: primeira razão social que não é o condomínio
  for (const x of todos(/([A-ZÀ-Ú][A-Za-zÀ-ú0-9&.\- ]{2,80}?\b(?:LTDA|Ltda|S\.?\s?A\.?|EIRELI|Eireli|ME|EPP|SEGUROS|Seguros)\b\.?)/g, t)) {
    const nm = nomeLimpo(x[1].split(/\s[-–]\s/).at(-1));
    if (!/condom|corretor/i.test(nm)) candidatos.push({ nome: nm, i: x.index, peso: 1 });
  }
  const validos = candidatos.filter((c) => c.nome && !/condom[ií]nio|^contratante|^segurado|^assinante|^sr\.?\s|^sra\.?\s|^neste ato|^representad/i.test(c.nome) && c.nome.length <= 120);
  validos.sort((a, b) => b.peso - a.peso || a.i - b.i);
  if (validos[0]) { C.contratado = validos[0].nome.replace(/\s+/g, " "); T.contratado = trecho(t, validos[0].i, 0, 80); C._iContratado = validos[0].i; }
  m = um(new RegExp(`\\b(?:${PAPEL_CONTRATANTE})\\s*:\\s*([^,;]{3,120})`, "i"), t); if (m) C.contratante = nomeLimpo(m[1].split(/\.\s|\s+(?:vig[eê]ncia|plano|contratad|cnpj|cpf|endere)/i)[0]);
  // CNPJ do contratado: o mais próximo do nome que não seja o do condomínio
  const cnpjs = todos(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g, t).map((x) => ({ v: x[1], i: x.index, condo: /condom/i.test(t.slice(Math.max(0, x.index - 200), x.index)) && !(C._iContratado && x.index > C._iContratado && x.index - C._iContratado < 250) }));
  const cnpjC = cnpjs.filter((x) => !x.condo).sort((a, b) => Math.abs(a.i - (C._iContratado ?? 0)) - Math.abs(b.i - (C._iContratado ?? 0)))[0];
  if (cnpjC) C.cnpj = cnpjC.v;
  delete C._iContratado;
  if (C.contratado) C.forn = casarFornecedor(C.contratado, forns);
  if (!C.forn) for (const f of forns) if (casarFornecedor(f, [C.contratado || ""]) || (n.slice(0, 2500).includes(ctNorm(f).replace(/\s*\(.*\)/, "")) && f.length > 6)) { C.forn = f; break; }

  // ---- objeto
  m = um(/tem\s+(?:por|como)\s+objet(?:o|ivo)\s+(?:a\s+|o\s+)?(.{12,300}?)(?:\.\s|;|$)/) || um(/(?:se compromete|se obriga)\s+a\s+(?:executar|prestar|realizar|fornecer)\s+(?:os\s+)?(.{12,260}?)(?:,?\s*objeto deste|\.\s|;|$)/) || um(/\bobjeto\s*[:.\-–]\s*(?:\d+(?:\.\d+)*\.?\s*)?(?:o presente contrato tem por objeto\s*)?(.{12,300}?)(?:\.\s|;|$)/) || um(/\bplano\s*:\s*(.{5,160}?)(?:\s+mensalidade|\.\s|;|$)/) || um(/fornecera\s+(.{12,240}?)(?:\.\s|;|$)/);
  if (m) { C.objeto = t.substr(m.index + m[0].indexOf(m[1]), m[1].length).trim(); T.objeto = trecho(t, m.index, m[0].length, 10); }
  else { m = um(/(?:contrato|apolice|termo de adesao)[^.]{0,30}?\bde\s+(.{10,140}?)(?=\s+(?:n[ºo°]|contratante|contratad|pelo presente|que entre si|de um lado|segurado|cl[aá]usula|\d+\.|$))/); if (m) C.objeto = t.substr(m.index + m[0].indexOf(m[1]), m[1].length).trim(); }
  if (C.tipo === "Seguro" && (!C.objeto || /ltda|s\.a|seguros/i.test(C.objeto))) C.objeto = `Seguro do condomínio${C.numero ? ` (apólice ${C.numero})` : ""}`;
  if (C.objeto) { C.objeto = C.objeto.replace(/\s+pelo (?:o )?presente.*$/i, "").replace(/^(?:a|o)\s+(?:contratad[oa]|prestador[a]?|empresa)\s+(?:fornecer[aá]|prestar[aá]|executar[aá]|realizar[aá]|disponibilizar[aá])\s+/i, "").replace(/,\s*(conforme|o qual|nos termos).*$/i, "").replace(/^(a|o)\s+(prestacao|prestação)/i, "Prestação"); if (C.objeto.length > 160) C.objeto = C.objeto.slice(0, 157).replace(/\s\S*$/, "") + "…"; }
  if (!C.tipo && C.objeto) for (const [re, nome] of TIPOS_CT) if (re.test(ctNorm(C.objeto))) { C.tipo = nome; break; }

  // ---- valores
  const valores = todos(/R\$\s?(\d[\d.,]*[.,]\d{2}|\d+)(?!\d)(?![.,]\d)/g, t).map((x) => {
    const antes = n.slice(Math.max(0, x.index - 140), x.index), depois = n.slice(x.index + x[0].length, x.index + x[0].length + 170);
    return { v: ctNum(x[1]), i: x.index, len: x[0].length, antes, depois, ctx: antes + " # " + depois };
  }).filter((x) => x.v > 0);
  const ehLimite = (x) => /lmi|limite maximo|cobertura|franquia|importancia segurada|capital segurado|limitad[ao] a|teto/.test(x.antes.slice(-60) + x.depois.slice(0, 40));
  const ehAvulso = (x) => /^\s*(?:\([^)]*\)\s*)?(?:por|cada)\s+(hora|visita|certidao|consulta|audiencia|chamado|atendimento|unidade|ato|metro|m2|km|diaria|pagina)/.test(x.depois) || /hora tecnica|preposto|taxa de (instalacao|visita|deslocamento)|por chamado/.test(x.antes.slice(-50)) || /^\s*(?:\([^)]*\)\s*)?para (?:o )?fornecimento do preposto|por audiencia/.test(x.depois.slice(0, 70));
  const ehMulta = (x) => /multa|penalidade|juros|caucao|retenc/.test(x.antes.slice(-50));
  let principal = null;
  const parc = valores.find((x) => !ehLimite(x) && /(\d{1,3})\s*(?:\([^)]*\))?\s*(?:parcelas|prestacoes|vezes)[^#]{0,40}?(?:mensais|iguais|de)?[^#]{0,12}$/.test(x.antes));
  const mensal = valores.find((x) => !ehLimite(x) && !ehAvulso(x) && !ehMulta(x) && x !== parc && (/(mensal|mensais|mensalidade|por mes|ao mes|cada mes|mensalmente)\b/.test(x.antes.slice(-70)) || /^\s*(?:\([^)]*\)\s*)?,?\s*(?:a ser\s+|que sera\s+)?(?:pag[oa]s?|devid[oa]s?|cobrad[oa]s?|faturad[oa]s?)?\s*(?:mensais|mensal|por mes|ao mes|mensalmente)/.test(x.depois)));
  const glob = valores.find((x) => !ehLimite(x) && /(valor|preco|importancia|premio)\s+(global|total)|valor do contrato|valor da obra|total de\s*$|premio\s*(liquido)?\s*:?\s*$/.test(x.antes.slice(-60)));
  const anual = valores.find((x) => !ehLimite(x) && (/\banual\b|por ano|ao ano/.test(x.antes.slice(-50)) || /^\s*(?:\([^)]*\)\s*)?(?:anuais|por ano|ao ano)/.test(x.depois)));
  if (mensal) { C.modalidade = "mensal"; C.valor = mensal.v; principal = mensal; }
  else if (parc) { const k = +/(\d{1,3})\s*(?:\([^)]*\))?\s*(?:parcelas|prestacoes|vezes)/.exec(parc.antes)[1]; C.modalidade = "parcelado"; C.parcelas = k; C.valor = parc.v; C.valorTotal = glob ? glob.v : Math.round(parc.v * k * 100) / 100; principal = parc; }
  else if (glob) { C.modalidade = "global"; C.valorTotal = glob.v; C.valor = glob.v; principal = glob; m = /(\d{1,3})\s*(?:\([^)]*\))?\s*(?:parcelas|prestacoes)/.exec(glob.depois); if (m) { C.parcelas = +m[1]; C.modalidade = "parcelado"; C.valor = Math.round(glob.v / C.parcelas * 100) / 100; } }
  else if (anual) { C.modalidade = "anual"; C.valorTotal = anual.v; C.valor = Math.round(anual.v / 12 * 100) / 100; principal = anual; }
  else { const x = valores.find((y) => !ehLimite(y) && !ehAvulso(y) && !ehMulta(y) && /pagara|valor|honorario|preco|remunera|importancia/.test(y.antes.slice(-120))); if (x) { C.modalidade = "mensal"; C.valor = x.v; principal = x; } }
  // planilha de custos de terceirização: total mensal da prestação (bruto) e total após as retenções (líquido)
  { const V = "(?:r\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2})", vNum = (x) => +x.replace(/\./g, "").replace(",", ".");
    const br = um(new RegExp(`total da prestacao (?:dos|de) servicos\\s*:?\\s*${V}`)), liq = um(new RegExp(`total (?:dos|de) servicos\\s*(?:liquido)?\\s*:?\\s*${V}`));
    if (br) {
      C.modalidade = "mensal"; C.valor = vNum(br[1]); principal = null; T.valor = trecho(t, br.index, br[0].length);
      if (liq && liq.index > br.index) C.valorLiquido = vNum(liq[1]);
      const qf = /total de funcionarios\s*(\d{1,3})/.exec(n), sal = um(new RegExp(`total dos salarios mais adicionais\\s*${V}`)), enc = /encargos trabalh\w*[^%]{0,40}?(\d{2,3})\s*%/.exec(n), imp = /impostos? s\w+ (?:a )?nota fiscal\s*(\d{1,2},\d{1,2})\s*%/.exec(n);
      info("Planilha de custos", [`total mensal ${"R$ " + br[1]}${C.valorLiquido ? `, líquido após retenções R$ ${liq[1]}` : ""}`, qf ? `${qf[1]} funcionários` : "", sal ? `salários e adicionais R$ ${sal[1]}` : "", enc ? `encargos ${enc[1]}%` : "", imp ? `impostos sobre a nota ${imp[1]}%` : ""].filter(Boolean).join("; "), br.index);
      const loc = /ta[xz]a de locacao\s*\(?\s*cortesia\s*(\d+)\s*mes/.exec(n); if (loc) info("Taxa de locação", `cortesia nos ${loc[1]} primeiros meses; depois, valor não informado na planilha`);
      const pl = (m) => (m && numPct(m[1]) > 0 && numPct(m[1]) <= 15 ? m : null), numPct = (x) => +x.replace(",", ".");
      const rI = pl(/retencao inss[^%]{0,40}?(\d{1,2}(?:,\d+)?)\s*%/.exec(n)), rP = pl(/retencao pis[^%]{0,40}?(\d{1,2}(?:,\d+)?)\s*%/.exec(n));
      if (rI || rP || /retencao (?:inss|pis)/.test(n)) info("Retenções", [rI ? `INSS ${rI[1]}%` : /retencao inss/.test(n) ? "INSS" : "", rP ? `PIS/COFINS/CSLL ${rP[1]}%` : /retencao pis/.test(n) ? "PIS/COFINS/CSLL" : ""].filter(Boolean).join("; ") + " (pagas pelo condomínio à Receita Federal, descontadas da nota)");
      if (!C.tipo || C.tipo === "Assessoria jurídica") C.tipo = "Mão de obra terceirizada";
    } }
  if (principal) T.valor = trecho(t, principal.i, principal.len);
  if (parc && C.modalidade === "parcelado" && !C.parcelas) { const k = /(\d{1,3})\s*(?:\([^)]*\))?\s*parcelas/.exec(parc.antes); if (k) C.parcelas = +k[1]; }
  for (const x of valores) {
    if (x === principal || x === glob || x === parc) continue;
    if (ehAvulso(x)) { const p = /(?:por|cada)\s+([a-z0-9 ]{3,30}?)(?=[,.;]|\s+e\s|\s+mais|$)/.exec(x.depois) || /(hora tecnica|preposto|taxa de [a-z]+)/.exec(x.antes.slice(-50)); C.adicionais.push({ valor: x.v, desc: /preposto/.test(x.depois.slice(0, 80) + x.antes.slice(-50)) ? "preposto por audiência" : p ? (x.depois.match(/^\s*(?:\([^)]*\)\s*)?(por|cada)/) ? "por " : "") + p[1].trim() : "valor avulso" }); }
  }
  // valores avulsos fixados em percentual do salário mínimo (ex.: assembleias, atas)
  for (const x of todos(/(?:custo|valor|importancia|honorarios?)\s+(?:de\s+)?(\d{1,3})\s*%\s*(?:\([^)]*\)\s*)?d[oe]\s+salario[- ]minimo/g)) {
    const i0 = Math.max(0, x.index - 260); let ctx = n.slice(i0, x.index + 220);
    const al = [...ctx.slice(0, x.index - i0).matchAll(/(?:^|[\s;:])[a-z]\)\s/g)].at(-1), base = i0 + (al ? al.index : 0); if (al) ctx = ctx.slice(al.index);
    const fim = ctx.search(/;\s*[a-z]\)\s|:\s*[a-z]\)\s/); if (fim > 0) ctx = ctx.slice(0, fim);
    const desc = /assembl/.test(ctx) && /acompanha|presenc|particip/.test(ctx) ? "acompanhamento em assembleia" : /\bata/.test(ctx) ? "elaboração de ata" : /audienc/.test(ctx) ? "audiência" : /notifica/.test(ctx) ? "notificação" : "serviço avulso";
    const salvo = /(?:salvo|exceto|ressalvad[oa]s?)\s+([^:;]{4,120}?)(?=,?\s*face|[:;]|$)/.exec(ctx);
    C.adicionais.push({ valor: 0, pctSM: +x[1], desc: desc + (salvo ? `, exceto ${(n.length === t.length ? t.substr(base + salvo.index + salvo[0].indexOf(salvo[1]), salvo[1].length) : salvo[1]).trim()}` : "") });
  }
  C.adicionais = C.adicionais.filter((x, i, a) => a.findIndex((y) => y.valor === x.valor && y.desc === x.desc && y.pctSM === x.pctSM) === i);
  // seguro: coberturas e franquias
  const cobs = todos(/([a-zà-ú ,/]{4,60}?)\s*[-–:]\s*(?:lmi|limite maximo de indenizacao|importancia segurada)\s*:?\s*r\$\s?([\d.,]+)/g).map((x) => `${t.substr(x.index, x[1].length).trim()}: R$ ${t.substr(x.index + x[0].length - x[2].length, x[2].length)}`);
  if (cobs.length) info("Coberturas", cobs.join("; "));
  m = um(/franquia(?:[^.]|\.(?=\d)){0,140}/); if (m) info("Franquia", t.substr(m.index, m[0].length).replace(/^franquia\s*:?\s*/i, "").trim());
  m = um(/corretor[a]?\s*(?:de seguros)?\s*:\s*([^.;]{3,80})/); if (m) info("Corretora", t.substr(m.index + m[0].indexOf(m[1]), m[1].length).trim());

  // ---- pagamento
  const formas = [];
  for (const [re, nome] of [[/boleto/, "boleto"], [/\bpix\b/, "PIX"], [/deposito|transferencia bancaria|ted\b/, "depósito/transferência"], [/cartao de credito/, "cartão de crédito"], [/debito automatico/, "débito automático"]]) if (re.test(n)) formas.push(nome);
  if (formas.length) C.formaPagamento = formas.join(", ");
  m = um(/vencimento\s*(?:escolhid[oa])?\s*(?:em|no|:|todo)?\s*(?:o\s+)?dia\s+(\d{1,2})/) || um(/(?:todo|ate o)\s+dia\s+(\d{1,2})\s*(?:\([a-z ]+\))?\s*(?:de cada mes|do mes)/) || um(/data de vencimento[^.]{0,20}?dia\s+(\d{1,2})/);
  if (m) C.diaVenc = +m[1];
  m = um(/ate o\s+(\d{1,2})[ºo°]?\s*(?:\([a-z ]+\))?\s*dia util[^.]{0,80}/) || um(/em ate\s+(\d{1,3})\s*(?:\([a-z ]+\))?\s*dias[^.]{0,30}?(?:apos|contados)[^.]{0,80}?(?:nota|fatura|medicao|emissao)[^.]{0,30}/);
  if (m) info("Prazo de pagamento", t.substr(m.index, m[0].length).trim());
  if (/mediante medicao|conforme medicao|por medicao/.test(n)) info("Pagamento por medição", "Os pagamentos dependem de medição dos serviços executados.");

  // ---- vigência
  m = um(new RegExp(`(?:a contar de|a partir de|com inicio em|inicio em|iniciando em|inicio previst[oa] para|prevista para|das 24h de|das 24 horas de|desde|ativacao em|vigencia[^.]{0,20}?(?:de|em))\\s*:?\\s*${DATA_RE}`));
  if (m) { C.inicio = lerData(m[1]); T.inicio = trecho(t, m.index, m[0].length, 40); }
  m = um(new RegExp(`(?:\\ba\\b|\\bate\\b|\\bas 24h de|\\bas 24 horas de|termino em|encerrando-se em|com termino em)\\s+(?:o dia\\s+)?${DATA_RE}`));
  if (m && /vigen|vigor|prazo|termino|24h|24 horas|periodo/.test(n.slice(Math.max(0, m.index - 140), m.index + 20))) { C.fim = lerData(m[1]); T.fim = trecho(t, m.index, m[0].length, 60); }
  // prazo de vigência (ignora prazos de garantia, pagamento e atendimento)
  m = todos(new RegExp(`(?:vigorara|vigera|vigorar|vigencia|vigente|prazo de vigencia|prazo inicial|prazo determinado|pelo prazo de|pelo periodo de|periodo de|permanencia minima|fidelidade|contrato tera (?:o seu |um )?prazo de|seu prazo de|prazo contratual de)[^.]{0,50}?(?:de|por|em)?\\s*${NUM}\\s*(meses|mes|anos?|dias)\\b`, "g"))
    .find((x) => !/garant|pagamento|atendiment|reparo|aviso|antecedencia|apos|solicitac|chamado|uteis|interregno|repactua/.test(n.slice(Math.max(0, x.index - 90), x.index + x[0].length)));
  if (m) { const q = +m[1], u = m[2]; C.prazoMeses = /ano/.test(u) ? q * 12 : /dia/.test(u) ? null : q; if (/dia/.test(u)) C.prazoDias = q; T.prazo = trecho(t, m.index, m[0].length, 40); }
  m = um(new RegExp(`(?:concluid[oa]s?|executad[oa]s?|entregue|prazo de execucao|prazo para conclusao)[^.]{0,40}?(?:em|de)\\s+${NUM}\\s*(dias|meses)`));
  if (m) { info("Prazo de execução", `${m[1]} ${m[2]}${/corrid/.test(n.slice(m.index, m.index + m[0].length + 20)) ? " corridos" : ""}`, m.index); if (!C.prazoMeses && !C.prazoDias) { if (/dia/.test(m[2])) C.prazoDias = +m[1]; else C.prazoMeses = +m[1]; } }
  const assinRe = /[a-z]{3,},\s*(\d{1,2})[ºo°]?\s+de\s+([a-zç]+)\s*[—–-]?\s*de\s+(\d{4})/g;
  if (!C.inicio) { const as = todos(assinRe).filter((x) => MESES_N[x[2]]); const a = as.at(-1); if (a) { C.inicio = ctIso(a[1], MESES_N[a[2]], a[3]); T.inicio = trecho(t, a.index, a[0].length, 30) + " (data de assinatura)"; } }
  if (!C.fim && C.inicio && C.prazoDias) C.fim = somaDiasIso(C.inicio, C.prazoDias);
  C.indeterminado = /prazo indeterminado|tempo indeterminado/.test(n);
  C.renovacaoAuto = /renova(?:ndo|-se|do|da|cao|ra)?[^.]{0,30}automatica|renovacao automatica|prorroga(?:ndo|-se|do|da|cao)?[^.]{0,30}automatica|automaticamente (?:renovad|prorrogad)/.test(n);
  m = um(new RegExp(`(?:fidelidade|permanencia minima)[^.]{0,40}?${NUM}\\s*(meses|anos?)`)); if (m) info("Fidelidade", `${m[1]} ${m[2]}`, m.index);
  m = um(/assinatura[^.]{0,30}?(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/); const assin = m ? lerData(m[1]) : (() => { const as = todos(assinRe).filter((x) => MESES_N[x[2]]); const a = as.at(-1); return a ? ctIso(a[1], MESES_N[a[2]], a[3]) : ""; })();
  if (assin) C.assinatura = assin;

  // ---- rescisão, aviso prévio e multas
  const avisos = [...todos(new RegExp(`(?:aviso previo|antecedencia(?: minima)?|antecedente|comunicacao previa|denunciad[oa][^.]{0,40}?com)[^.]{0,40}?${NUM}\\s*dias`, "g")), ...todos(new RegExp(`${NUM}\\s*dias(?: corridos)? de antecedencia`, "g"))]
    .filter((x) => !/uteis|nota fiscal|pagamento|fatura|emissao/.test(n.slice(Math.max(0, x.index - 60), x.index + x[0].length + 40)));
  m = avisos.find((x) => /aviso previo|rescis|resili|renova|denunc|nao mais contratar/.test(n.slice(Math.max(0, x.index - 160), x.index + 80))) || avisos[0];
  if (m) { C.avisoDias = +m[1]; T.aviso = trecho(t, m.index, m[0].length, 50); }
  const F = "(?:[^.]|\\.(?=\\d))*";
  for (const x of todos(/multa/g)) { const f2 = frase(x.index), fn = ctNorm(f2); if (/rescis|rescind|cancelament|rompiment|resili|infrac|infrator|descumpr|fidelidade/.test(fn) && !/atraso no (pagamento|recebimento)|juros/.test(fn) && f2.length < 470) { C.multaRescisoria = f2.replace(/^[a-z]\)\s*/i, ""); break; } }
  m = um(/atraso no (?:pagamento|recebimento)[^.]{0,160}?multa\s+(?:moratoria\s+)?(?:de\s+)?(\d{1,2}(?:,\d+)?)\s*%/) || todos(/multa\s+(?:moratoria\s+)?(?:de\s+)?(\d{1,2}(?:,\d+)?)\s*%[^.]{0,80}?(?:atraso|inadimpl|vencimento)/g).find((x) => !/por dia de atraso|entrega|execucao|conclusao/.test(x[0])) || um(/(?:nao cumprimento|inadimplemento)[^.]{0,120}?multa\s+de\s+(\d{1,2}(?:,\d+)?)\s*%/);
  if (m) { const j = /juros\s+(?:de\s+)?(\d{1,2}(?:,\d+)?)\s*%/.exec(n.slice(m.index, m.index + 220)); C.multa = `${m[1]}%${j ? ` + juros de ${j[1]}% ao mês` : ""}`; }
  if (!C.multa) { m = um(/vencimentos?\.?\s+importara\s+em\s+multa\s+(?:de\s+)?(\d{1,2}(?:,\d+)?)\s*%/); if (m) { const j = /juros\s+(?:de\s+)?(\d{1,2}(?:,\d+)?)\s*%/.exec(n.slice(m.index, m.index + 220)); C.multa = `${m[1]}%${j ? ` + juros de ${j[1]}% ao mês` : ""}`; } }
  // honorários de êxito e quem paga
  { const ocs = todos(/ad exitum|a titulos? (?:de )?exito|exito nas (?:demandas|recuperac)|honorarios[^.]{0,40}exito/g);
    const qt = (y) => (n.slice(Math.max(0, y.index - 350), y.index + 150).match(/\d{1,2}\s*%/g) || []).length;
    const x = [...ocs].sort((a, b) => qt(b) - qt(a))[0];
    if (x) { const win = n.slice(Math.max(0, x.index - 350), x.index + 150); const pcts = [...win.matchAll(/(\d{1,2})\s*%\s*(?:\([^)]*\))?,?\s*(?:este |esta )?(na via administrativa|independente de intervencao judicial|judicia\w*)?/g)].map((y) => `${y[1]}%${y[2] ? (/administrativa/.test(y[2]) ? " na via administrativa" : " na via judicial") : ""}`);
      info("Honorários de êxito", pcts.length ? `${[...new Set(pcts)].join("; ")}, sobre o valor que o condomínio efetivamente receber` : frase(x.index), x.index); } }
  m = um(/repasses?\s+e\s+nao\s+despesas?\s+d[oa]\s+contratante|pagos?\s+pelos?\s+inadimplentes|(?:custas|honorarios)[^.]{0,80}(?:repassad|revertid|revestid)[oa]s?\s+a[oa]?s?\s+(?:proprio\s+)?(?:condomino\s+)?inadimplente/);
  if (m) info("Quem paga o êxito", "O contrato diz que os honorários de êxito são pagos pelos inadimplentes (repasse), não são despesa do condomínio.", m.index);
  m = um(/(?:custas|emolumentos|despesas)[^.]{0,200}?(?:deverao ser restituid|serao reembolsad|devem ser reembolsad|deverao ser reembolsad|restituidos pel)/);
  if (m) info("Reembolso de despesas", "Custas, emolumentos e taxas pagos pelo contratado são reembolsados pelo condomínio, mediante comprovação.", m.index);
  m = um(/multa\s+de\s+(\d{1,2}(?:,\d+)?)\s*%[^.]{0,40}?por dia de atraso[^.]*/); if (m) info("Multa por atraso na execução", t.substr(m.index, m[0].length).trim(), m.index);

  // ---- reajuste
  const ocRe = todos(/reajust|corrigid[oa]|atualizad[oa] (?:anualmente|monetariamente)|correcao monetaria/g).map((x) => x.index);
  const ri = ocRe.find((i) => /igp|ipca|inpc|ipc-|salario.minimo|convencao coletiva|dissidio/.test(n.slice(Math.max(0, i - 200), i + 260)) && !/atraso|mora\b|juros/.test(n.slice(Math.max(0, i - 120), i + 60))) ?? (ocRe[0] ?? -1);
  if (ri >= 0) {
    const jan = n.slice(Math.max(0, ri - 200), ri + 260), idx = [];
    for (const [re, nome] of [[/igp-?\s?m/, "IGP-M"], [/ipca/, "IPCA"], [/inpc/, "INPC"], [/igp-?\s?di/, "IGP-DI"], [/ipc-?\s?fipe/, "IPC-Fipe"], [/salario[- ]minimo/, "salário mínimo"], [/convencao coletiva|dissidio|acordo coletivo/, "convenção coletiva"]]) if (re.test(jan)) idx.push(nome);
    const per = /anual|anualmente|a cada 12|a cada doze|periodicidade anual/.test(jan) ? "Anual" : /semestral/.test(jan) ? "Semestral" : "Reajuste";
    const mesBase = /mes de ([a-zç]+)/.exec(jan), aniv = /aniversario/.test(jan);
    C.reajuste = `${per}${idx.length ? ": " + idx.join(" + ") : ""}${mesBase && MESES_N[mesBase[1]] ? ` em ${mesBase[1]}` : aniv ? " no aniversário do contrato" : ""}`;
    T.reajuste = trecho(t, ri, 0, 140);
  }

  // ---- outras condições
  m = um(new RegExp(`garant\\w*[^.]{0,90}?(?:prazo de|por|pelo prazo de|durante)\\s*${NUM}\\s*(anos?|meses|dias)`)); if (m) info("Garantia", `${m[1]} ${m[2]}`, m.index);
  const ret = []; for (const x of todos(new RegExp(`${F}\\b(?:retenc\\w*|retid[oa])${F}\\.`, "g"))) { const f2 = ctNorm(x[0]); const p = /(\d{1,2}(?:,\d+)?)\s*%/.exec(f2); const imp = ["inss", "iss", "irrf", "ir ", "pis", "cofins", "csll", "caucao"].filter((k) => f2.includes(k)).map((k) => k.trim().toUpperCase().replace("CAUCAO", "caução")); if (p || imp.length) ret.push(`${p ? p[1] + "% " : ""}${imp.join(", ")}`.trim()); }
  if (ret.length) info("Retenções", [...new Set(ret)].join("; "));
  const sla = []; for (const x of todos(new RegExp(`((?:chamados?|atendiment\\w*|atendid\\w*|reparo|substitu\\w*|reposicao|emergenc\\w*)[^.]{0,70}?em ate\\s+${NUM}\\s*(horas?|minutos|dias))`, "g"))) sla.push(t.substr(x.index, x[1].length).trim());
  for (const x of todos(new RegExp(`((?:prazo para atendimento|natureza (?:nao[- ])?emergencial|servicos? emergencia\\w*)[^.]{0,90}?(?:em|de|no prazo de) ate\\s+${NUM}\\s*(horas?|minutos|dias)(?: uteis| corridos)?)`, "g"))) { const f2 = t.substr(x.index, x[1].length).trim(); if (!sla.includes(f2)) sla.push(f2); }
  if (sla.length) info("Prazos de atendimento", sla.slice(0, 4).join("; "));
  m = um(/visitas?\s+(mensa(?:l|is)|semana(?:l|is)|quinzena(?:l|is)|bimestra(?:l|is)|trimestra(?:l|is)|diarias?)[^.]{0,80}/); if (m) info("Visitas", t.substr(m.index, m[0].length).trim());
  const qt = [];
  for (const x of todos(new RegExp(`${NUM}\\s*(postos? de trabalho|postos?|auxiliares?[a-z ]{0,20}|porteiros?|vigilantes?|zeladores?|funcionarios?|empregados?|colaboradores?|elevadores?|bombas?|portoes|cameras?|jardineiros?)`, "g"))) qt.push(`${x[1]} ${t.substr(x.index + x[0].length - x[2].length, x[2].length).trim()}`);
  const esc = /(\d{1,2}\s?x\s?\d{2})/.exec(n); if (esc) qt.push(`escala ${esc[1].replace(/\s/g, "")}`);
  const hor = /das\s+(\d{1,2}h\d{0,2})\s+as\s+(\d{1,2}h\d{0,2})/.exec(n); if (hor) qt.push(`das ${hor[1]} às ${hor[2]}`);
  const dias = /de segunda a (sexta|sabado|domingo)/.exec(n); if (dias) qt.push(`de segunda a ${dias[1].replace("sabado", "sábado")}`);
  if (/portaria 24|24 horas por dia|24h por dia|vinte e quatro\) horas por dia|ininterrupt/.test(n)) qt.push("24 horas por dia");
  if (qt.length) info("Quantidades e horários", [...new Set(qt)].join("; "));
  const exc = []; for (const x of todos(/nao (?:estao |esta )?inclu\w*|nao inclui|por conta d[oa] contratante|correm por conta d[oa] contratante|orcad[oa]s? a parte|cobrad[oa]s? a parte|nao estao inclusos/g)) { const f2 = frase(x.index); if (f2.length <= 420 && !exc.includes(f2)) exc.push(f2.replace(/^par[aá]grafo \w+\s*/i, "")); }
  if (exc.length) info("Não incluído / por conta do condomínio", exc.slice(0, 3).join(" "));
  const incl = /incluindo ([^.;]{4,120})/.exec(n); if (incl) info("Incluído", t.substr(incl.index + 10, incl[1].length).trim());
  if (/encargos trabalhistas|obrigacoes trabalhistas/.test(n)) info("Encargos trabalhistas", "Responsabilidade da contratada, conforme o contrato.");
  m = um(/\b(art|anotacao de responsabilidade tecnica|rrt)\b/); if (m && /responsab|art\s*\(/.test(n.slice(m.index, m.index + 80))) info("Documentos exigidos", "ART/RRT do responsável técnico");
  if (/certid(?:ao|oes) negativ/.test(n)) info("Documentos exigidos", "Certidões negativas de débito");
  m = um(/foro\s+(?:da\s+)?comarca\s+de\s+([a-zà-ú\s/-]{3,40}?)(?=[,.;]|\s+para|\s+com)/); if (m) info("Foro", t.substr(m.index + m[0].indexOf(m[1]), m[1].length).trim());
  m = um(/(?:preco|valor)[^.]{0,30}(?:inclui|engloba|contempla)[^.]*\./); if (m) info("O preço inclui", t.substr(m.index, m[0].length).trim());

  // ---- cláusulas (índice do contrato)
  C.clausulas = todos(/\b(cl[áa]usula\s+(?:\d+[ªaº]?|(?:d[ée]cima|vig[ée]sima)\s+[a-zçãéêíóú]+|[a-zçãéêíóú]+))\s*[-–—]+\s*((?:d[aoe]s?\s+)?[a-zà-ú ,/]{3,60}?)(?=\s*[:.\-–]|\s+\d+\.\d|\s+o\s|\s+a\s|\s+os\s|\s+as\s|\s+pelo|\s+fica|\s+resta|\s+qualquer)/gi, t)
    .map((x) => `${x[1].trim()} – ${x[2].trim()}`).filter((x, i, a) => a.indexOf(x) === i).slice(0, 30);
  if (!C.clausulas.length) C.clausulas = todos(/(?:^|\s)(\d{1,2})\.\s+([A-ZÀ-Ú][A-ZÀ-Ú ]{3,40}?)\s*:/g, t).map((x) => `${x[1]}. ${x[2].trim()}`).slice(0, 30);

  if (C.info.some((x) => x.rot === "Planilha de custos")) {
    const k = C.info.findIndex((x) => x.rot === "Retenções"); C.info = C.info.filter((x, i) => x.rot !== "Retenções" || i === k);
    if (!C.tipo || /Seguro|Assessoria/.test(C.tipo)) { C.tipo = "Mão de obra terceirizada"; const qf = /total de funcionarios\s*(\d{1,3})/.exec(n); if (!C.objeto || /seguro/i.test(C.objeto)) C.objeto = `terceirização de mão de obra${qf ? ` (${qf[1]} funcionários)` : ""}`; }
  }
  return { campos: C, trechos: T, caracteres: t.length };
}

// fim do período atual: início + prazo; com renovação automática, avança até o período vigente
function fimVigente(inicio, prazoMeses, renova, hoje) {
  if (!inicio || !prazoMeses) return null;
  const d = new Date(inicio + "T12:00:00");
  const fimDe = (k) => { const f = new Date(d); f.setMonth(f.getMonth() + prazoMeses * k); f.setDate(f.getDate() - 1); return f.toISOString().slice(0, 10); };
  let k = 1, f = fimDe(1);
  if (renova) while (f < hoje && k < 50) f = fimDe(++k);
  return { fim: f, renovacoes: k - 1 };
}

// ===== app.mjs

const $ = (s) => document.querySelector(s);
const brl = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => (v * 100).toFixed(1).replace(".", ",") + "%";
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
  const venc = an.filter((x) => x.venceEm !== null && x.venceEm <= 60), excesso = an.reduce((s2, x) => s2 + Math.max(0, x.dif), 0);
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
  <p class="mini">Na faixa de meses de cada cartão, cada quadradinho é um mês pela data do pagamento: verde conforme, amarelo valor diferente do devido, vermelho sem pagamento, cinza sem cobrança. O primeiro e o último mês são proporcionais aos dias de vigência.</p>` : `<div class="vazio card">Nenhum contrato cadastrado.${adm ? " Importe o PDF do contrato, use o formulário abaixo ou as sugestões." : ""}</div>`}
  <div id="ctFicha">${S.ctFicha && lista.find((c) => c.id === S.ctFicha) ? fichaContrato(lista.find((c) => c.id === S.ctFicha)) : ""}</div>
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
  const est = ult && ult.st === "ausente" ? ["critico", `Sem pagamento em ${rotuloMes(ult.mes)}`]
    : ult && ult.st === "dif" ? ["atencao", `${rotuloMes(ult.mes)}: ${ult.p > ult.dev ? "+" : ""}${brl(ult.p - ult.dev)}`]
    : dif > tolV ? ["atencao", `${brl(dif)} pagos acima`]
    : dif < -tolV && !(ehCumulativo(c) && venceEm !== null && venceEm > 0) ? ["atencao", `${brl(-dif)} a menos que o devido`]
    : divs ? ["atencao", `${divs} mês(es) com diferença`] : ["ok", "Pagamentos em dia"];
  return `<article class="ct-card ${est[0]} ${S.ctFicha === c.id ? "ativo" : ""}">
    <div class="ct-topo"><span class="eyebrow">${esc(c.tipo || "Contrato")}${c.numero ? ` · nº ${esc(c.numero)}` : ""}</span><span class="ct-est ${est[0]}">${esc(est[1])}</span></div>
    <h3>${esc(c.forn)}</h3>
    <p class="ct-obj">${esc(c.objeto || "")}</p>
    <div class="ct-valor"><b>${c.modalidade && c.modalidade !== "mensal" ? esc(descreverValor(c)) : brl(c.valor)}</b>${!c.modalidade || c.modalidade === "mensal" ? "<span>/mês</span>" : ""}${c.diaVenc ? `<span class="mini"> · vence dia ${c.diaVenc}</span>` : ""}</div>
    <div class="ct-vig"><div class="ct-vig-txt"><span>${ini ? dataBR(ini) : "início não informado"}</span><span>${fim ? dataBR(fim) : c.indeterminado ? "prazo indeterminado" : "sem fim"}</span></div>
      ${prog !== null ? `<div class="ct-barra"><span style="width:${prog * 100}%"></span></div>` : ""}
      <span class="mini ${venceEm !== null && venceEm <= 60 ? "neg" : ""}">${venceEm === null ? (c.renovacaoAuto ? "renovação automática" : "") : venceEm < 0 ? `vencido há ${-venceEm} dia(s)` : `vence em ${venceEm} dia(s)${c.renovacaoAuto ? " · renova automaticamente" : ""}`}</span></div>
    <div class="ct-nums"><div><span>${ehCumulativo(c) ? "Valor do contrato" : "Devido"}</span><b>${brl(totDev)}</b></div><div><span>Pago</span><b>${brl(totPago)}</b></div><div><span>Diferença</span><b class="${dif > 0.01 ? "neg" : dif < -0.01 ? "pos" : ""}">${dif > 0 ? "+" : ""}${brl(dif)}</b></div></div>
    <div class="ct-meses" aria-label="Pagamentos por mês">${meses.map((m) => `<i class="mchip ${m.st}" data-tip="${esc(`${rotuloMes(m.mes)}\nPago: ${brl(m.p)}\nDevido: ${brl(m.dev)}`)}"></i>`).join("")}<span class="mini">${divs} de ${meses.length} mês(es) com diferença</span></div>
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
  let seq = null;
  if (!ehCumulativo(c) && unicas.length >= 3 && comDev.length && unicas.length <= comDev.length + 1) {
    const atr = unicas.map((d, i) => [d, mesMais(comDev[0], i)]), resto = mens.filter((d) => !unicas.includes(d)).map((d) => [d, d.compBal]);
    if (atr.every(([d, m]) => Math.abs(difMeses(d.compBal, m)) <= 2) && atr.some(([d, m]) => d.compBal !== m) && problemas([...atr, ...resto]) < problemas(mens.map((d) => [d, d.compBal]))) seq = new Map(atr);
  }
  const modo = seq && S.ctModoComp !== "bal" ? "nf" : "bal";
  const compDe = (d) => (d.alvo ? compDe(d.alvo) : modo === "nf" && seq.has(d) ? seq.get(d) : d.compBal);
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
    alvos.forEach((nf, k) => { const alvo = porBase[nf].find((y) => ehMensal(c, y)) || porBase[nf][0], v = alvos.length > 1 ? r2(d.v * liq(nf) / totL) : d.v;
      rets.push({ ...d, v, vTotal: d.v, id: `${b.mes}#${i}`, mesBal: b.mes, compBal: alvo.compBal, alvo, nfAlvo: nf, ret: true, cit: alvos }); });
  });
  for (const r of rets) (ehMensal(c, r.alvo) ? mens : avs).push(r);
  const multaP = /(\d+(?:[.,]\d+)?)\s*%/.exec(c.multa || ""), jurosP = /juros de (\d+(?:[.,]\d+)?)\s*%/.exec(c.multa || "");
  const aniv = ini ? mesMais(ini, 12) : "", porSM = /sal[aá]rio/i.test(c.reajuste || "");
  const fatorSM = (mes) => { const k = Math.floor(difMeses(ini, mes) / 12); return k >= 1 ? salMin(+mesMais(ini, 12 * k).slice(0, 4)) / salMin(+ini.slice(0, 4)) : 1; };
  const atrasos = [];
  const linhas = an.meses.map((m) => {
    const P = mens.filter((d) => compDe(d) === m.mes), A = avs.filter((d) => (setM.has(d.compBal) ? d.compBal : d.mesBal) === m.mes);
    const pc = r2(P.reduce((s2, d) => s2 + d.v, 0)), pa = r2(A.reduce((s2, d) => s2 + d.v, 0)), dif = r2(pc - m.dev), tolV = Math.max(1, m.dev * tolP);
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
      if (porSM) { const f = fatorSM(m.mes), esp = r2(m.dev * f); if (Math.abs(pc - esp) <= Math.max(1, esp * 0.01)) add("ok", `Reajuste no aniversário do contrato pelo salário mínimo (${brl(salMin(+ini.slice(0, 4)))} → ${brl(salMin(+mesMais(ini, 12).slice(0, 4)))}): ${brl(esp)}.`, r2(esp - m.dev)); else add("info", `Com o reajuste previsto (${c.reajuste}), a mensalidade seria cerca de ${brl(esp)}.`); }
      else if (dif > 0 && dif / m.dev <= 0.12) add("prov", `Compatível com um reajuste anual de ${pct(dif / m.dev)}${c.reajuste ? ` (${c.reajuste})` : ""}; confirme o índice aplicado.`, dif);
    }
    for (const alvo of new Set([...P, ...A].filter((d) => d.ret).map((d) => d.alvo))) {
      const rs = [...P, ...A].filter((d) => d.ret && d.alvo === alvo), sr = r2(rs.reduce((s2, d) => s2 + d.v, 0)), liqNF = r2((porBase[nfBase(alvo.nf)] || [alvo]).reduce((s2, y) => s2 + y.v, 0)), bruto = r2(liqNF + sr);
      const pis = rs.find((d) => /pis|cofins|csll/i.test(`${d.item} ${d.desc}`) && d.cit.length === 1), confere = pis && Math.abs(pis.v / 0.0465 - bruto) <= 2;
      add(confere ? "ok" : "info", `Nota ${nfBase(alvo.nf)}: líquido pago ao fornecedor ${brl(liqNF)} + retenções recolhidas à Receita ${brl(sr)} (${rs.map((d) => `${(d.item || "").toLowerCase()} ${brl(d.v)}`).join("; ")}) = valor bruto ${brl(bruto)}.${confere ? " As retenções conferem com a nota (PIS/COFINS/CSLL = 4,65% do bruto)." : ""}${rs.some((d) => d.cit.length > 1) ? ` O DARF de ${brl(rs.find((d) => d.cit.length > 1).vTotal)} recolhe as notas ${rs.find((d) => d.cit.length > 1).cit.join(", ")} juntas; a parte desta nota foi rateada pelo valor líquido de cada uma.` : ""}`);
    }
    if (c.valorLiquido && P.length) { const liq = r2(P.filter((d) => !d.ret).reduce((s2, d) => s2 + d.v, 0)); if (Math.abs(liq - c.valorLiquido) > c.valorLiquido * tolP) add("info", `Líquido pago ${brl(liq)} contra ${brl(c.valorLiquido)} líquidos da planilha de custos (${liq > c.valorLiquido ? "+" : ""}${brl(liq - c.valorLiquido)}).`); }
    // competência informada no balancete diferente da ordem das notas
    for (const d of P) if (modo === "nf" && seq.has(d) && seq.get(d) !== d.compBal) add("info", `O balancete informa a NF ${d.nf} como competência ${rotCurto(d.compBal)}; pela ordem de emissão das notas, ela é a mensalidade de ${rotCurto(seq.get(d))}.`);
    // pagamento após o vencimento
    for (const d of P) {
      const pg = isoBR(d.baixa); if (!c.diaVenc || !pg) continue;
      const venc = `${mesMais(compDe(d), 1)}-${String(Math.min(c.diaVenc, 28)).padStart(2, "0")}`, at = diasEntre(venc, pg);
      if (at <= 5) continue;
      atrasos.push({ d, at, mesBal: d.mesBal });
      const lim = multaP ? m.dev * (numBR(multaP[1]) + (jurosP ? numBR(jurosP[1]) * Math.ceil(at / 30) : 0)) / 100 : 0, sobra = r2(dif - expl);
      if (sobra > 0.01 && sobra <= lim + 0.5) add("ok", `Pago ${at} dias após o vencimento (${dataBR(venc)}): a diferença cabe na multa e nos juros do contrato (${c.multa}).`, sobra);
      else add("info", `Paga em ${d.baixa.slice(0, 5)}, ${at} dias após o vencimento (${dataBR(venc).slice(0, 5)}).`);
    }
    // mesma nota paga mais de uma vez
    for (const d of [...P, ...A]) { const g = porNF[String(d.nf || "").trim()]; if (g && g.includes(d) && g.length > 1) add("alerta", `A NF ${d.nf} também foi paga em ${g.filter((y) => y !== d).map((y) => `${y.baixa} (${brl(y.v)}, balancete ${rotCurto(y.mesBal)})`).join(", ")}: possível pagamento em duplicidade.`); }
    if (!P.length && m.dev > 0) add(m.mes === ultBal ? "info" : "alerta", m.mes === ultBal ? "Competência do último balancete: costuma ser paga no balancete seguinte." : "Nenhum pagamento da mensalidade identificado para esta competência.");
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
      else { aSem = r2(aSem + d.v); const pl = (c.info || []).find((x) => x.rot === "Planilha de custos"), loc = (c.info || []).find((x) => x.rot === "Taxa de locação"); add("alerta", `Avulso de ${brl(d.v)}: ${nome}. ${pl ? `Não consta na planilha de custos do contrato${/administra/i.test(d.item || "") ? ", que não tem taxa de administração" : ""}${loc && /administra|loca/i.test(d.item || "") ? ` (só taxa de locação: ${loc.txt})` : ""}.` : "Sem previsão nos dados do contrato cadastrado."}`); }
    }
    const resto = r2(dif - expl);
    if (P.length && resto > tolV) add("alerta", `${brl(resto)} acima da mensalidade sem justificativa nas notas, alertas ou respostas registradas.`);
    else if (P.length && resto < -tolV) add("alerta", `${brl(-resto)} abaixo da mensalidade.`);
    // o que os balancetes dizem: notas da administradora, alertas e respostas
    const ds = [...P, ...A], ids = new Set(ds.map((d) => d.id));
    for (const mb of new Set(ds.map((d) => d.mesBal))) for (const n of S.todos.find((x) => x.mes === mb)?.notas || []) if (citaFornecedor(n.texto, c, ds.filter((d) => d.mesBal === mb))) add("fonte", `Nota da administradora no balancete de ${rotCurto(mb)}: ${n.texto.replace(/^\d+\)\s*/, "")}`);
    for (const a of S.alertasTodos || []) if (!a.ct && (a.ids || []).some((i) => ids.has(i)) && !ex.some((x) => x.txt.includes(a.titulo))) { const r = S.acomp[a.chave] || {}; add("fonte", `Alerta: ${a.titulo}${r.resposta ? ` — resposta registrada${r.respondidoEm ? ` em ${dataBR(r.respondidoEm)}` : ""}: “${r.resposta.trim()}”` : ` — ${SITUACOES[a.sit] || "Pendente"}, sem resposta registrada`}`); }
    const st = !P.length && m.dev > 0 ? (m.mes === ultBal ? "aguarda" : "ausente") : Math.abs(dif) <= tolV ? "ok" : Math.abs(resto) <= tolV ? "explicado" : expl ? "parcial" : "sem";
    return { ...m, P, A, pc, pa, dif, expl, resto: Math.abs(resto) <= tolV ? 0 : resto, ex, st, aPrev, aSem, aParc };
  });
  // ---- conclusões do período
  const ach = [], soma = (k, f = () => true) => r2(linhas.filter(f).reduce((s2, l) => s2 + l[k], 0));
  const totP = soma("pc"), totA = soma("pa"), semExpl = r2(linhas.reduce((s2, l) => s2 + Math.max(0, l.resto), 0));
  const acimaExpl = r2(linhas.reduce((s2, l) => s2 + (l.dif > 0 ? Math.max(0, Math.min(l.dif, l.expl)) : 0), 0));
  const base = r2(totP - linhas.reduce((s2, l) => s2 + Math.max(0, l.dif), 0)), aPrev = soma("aPrev"), aSem = soma("aSem"), aParc = soma("aParc");
  const prop = linhas.flatMap((l) => l.ex).find((x) => x.tipo === "ok" && x.txt.startsWith("Mês proporcional"));
  if (prop) ach.push(["confirmado", "Primeiro mês proporcional", prop.txt]);
  if (seq) {
    const erradas = [...seq].filter(([d, m]) => d.compBal !== m);
    ach.push([modo === "nf" ? "confirmado" : "provavel", "Competências informadas fora de ordem", `As ${unicas.length} notas da mensalidade, em ordem de emissão (NF ${unicas[0].nf} a ${unicas.at(-1).nf}), cobrem uma competência por mês, de ${rotCurto(comDev[0])} a ${rotCurto(mesMais(comDev[0], unicas.length - 1))}, sem falta nem duplicidade. Os meses “sem pagamento” e “pagos duas vezes” vêm de ${erradas.length} nota(s) com a competência informada errada no balancete: ${erradas.map(([d, m]) => `NF ${d.nf} (informada ${rotCurto(d.compBal)}, é ${rotCurto(m)})`).join("; ")}.`]);
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
    txt += temFonte ? " Veja nas linhas da tabela as notas e alertas ligados a esses pagamentos." : " Nenhuma nota da administradora, alerta respondido ou cláusula cadastrada explica a diferença.";
    if (cents.length >= 2) txt += ` Os valores variam e têm centavos (${cents.slice(0, 3).map((l) => brl(l.pc)).join(", ")}…), sinal de que cada nota soma itens diferentes: peça a composição de cada nota.`;
    if (exito) txt += ` O contrato prevê honorários de êxito (${exito.txt})${quem ? ", mas diz que eles são pagos pelos inadimplentes (repasse) e não são despesa do condomínio. Se o excedente for êxito, ele não deveria sair do caixa do condomínio" : ""}.`;
    else if (!(c.info || []).length && !(c.adicionais || []).length && c.origem === "") txt += " Importe o PDF do contrato para cruzar com as cláusulas.";
    ach.push(["sem", "Valor acima do contrato", txt]);
  }
  if (!c.filtro && !ehCumulativo(c) && c.valor) {
    const rec = itensRecorrentes(c.forn), perto = L.filter((d) => !ehParcela(d) && Math.abs(d.v - c.valor) <= c.valor * 0.15).length >= 2;
    if (rec.length && !perto) ach.unshift(["sem", "Valor cadastrado não confere com os pagamentos", `Nenhum pagamento que se repete todo mês a ${c.forn} fica perto de ${brl(c.valor)}. Os recorrentes são: ${rec.slice(0, 4).map((x) => `${x.item.toLowerCase()} (cerca de ${brl(x.med)} em ${x.n} meses)`).join("; ")}. A comparação usa “${(c.itemAuto || "").toLowerCase()}”, o mais próximo; confira o valor do contrato ou informe no cadastro qual histórico é a mensalidade.`]);
  }
  const aus = linhas.filter((l) => l.st === "ausente");
  if (aus.length) ach.push(["sem", "Competências sem pagamento", `Nenhuma mensalidade identificada para ${aus.map((l) => rotCurto(l.mes)).join(", ")}${seq && modo === "bal" ? ". Pela ordem das notas, não há falta (escolha “Pela ordem das notas” acima da tabela)" : ""}.`]);
  if (nfRep.length) ach.push(["sem", "Mesma nota paga mais de uma vez", nfRep.map((g) => `NF ${g[0].nf}: ${g.map((d) => `${d.baixa} (${brl(d.v)})`).join(" e ")}`).join("; ") + ". Peça a nota fiscal de cada pagamento ou o comprovante de devolução."]);
  if (avs.length) {
    const grupos = {}; for (const d of avs) { const pv = ehParcela(d) ? null : previsaoAvulso(c, d), k = ehParcela(d) ? "compras parceladas" : pv ? pv.nome : (d.item || "outros").toLowerCase(); (grupos[k] ||= []).push(d); }
    const exc = avs.filter((d) => !ehParcela(d)).map((d) => previsaoAvulso(c, d)).find((p) => p && p.excecao);
    ach.push([aSem > 0 ? "sem" : "provavel", "Pagamentos fora da mensalidade", `${brl(totA)} em ${avs.length} pagamento(s): ${Object.entries(grupos).map(([k, v]) => `${k} ${brl(v.reduce((s2, d) => s2 + d.v, 0))} (${v.length})`).join("; ")}. ${[aPrev ? `${brl(aPrev)} têm previsão no contrato` : "", aParc ? `${brl(aParc)} são parcelas de compras` : "", aSem ? `${brl(aSem)} sem previsão nos dados cadastrados` : ""].filter(Boolean).join("; ")}.${exc ? ` O contrato prevê ${exc.excecao}: confira se as cobranças estão entre elas.` : ""}`]);
  }
  if (atrasos.length) {
    const fs = new Set(atrasos.map((x) => x.mesBal)), saldo = [...fs].some((mb) => (S.todos.find((b) => b.mes === mb)?.notas || []).some((n) => /falta de saldo/i.test(n.texto)));
    ach.push(["info", "Pagamentos após o vencimento", `${atrasos.length} pagamento(s) mais de 5 dias depois do dia ${c.diaVenc} (maior atraso: ${Math.max(...atrasos.map((x) => x.at))} dias)${c.multa ? `; o contrato prevê ${c.multa} por atraso` : ""}.${saldo ? " Nos mesmos balancetes, a administradora informa pagamentos atrasados por falta de saldo do condomínio." : ""}`]);
  }
  return { c, an, linhas, ach, seq, modo, comp: { base, acimaExpl, semExpl, aPrev, aSem, aParc, totP, totA }, mens, avs };
}
const ST_CT = { ok: ["Conforme", "ok"], explicado: ["Explicado", "expl"], parcial: ["Explicado em parte", "parc"], sem: ["Sem explicação", "sem"], ausente: ["Sem pagamento", "aus"], aguarda: ["Aguardando", "agu"], nada: ["—", "agu"], pago: ["Pago", "ok"], dif: ["Diferença", "sem"] };
const NIVEL = { confirmado: ["Confirmado pelos dados", "ok"], provavel: ["Provável", "expl"], sem: ["Sem explicação", "sem"], info: ["Para saber", "agu"] };
// conclusões de cada contrato viram alertas: entram em Alertas, Acompanhamento, Resumo, WhatsApp, parecer e ata
function alertasContratos(existentes) {
  const out = [];
  for (const c of S.contratos || []) {
    let E; try { E = explicarContrato(c); } catch { continue; }
    const ids = (f) => E.linhas.filter(f).flatMap((l) => [...l.P, ...l.A].map((d) => d.id));
    const ultMes = (f) => (E.linhas.filter(f).at(-1) || E.linhas.at(-1) || {}).mes || null;
    const add = (sev, nome, detalhe, pergunta, idsA, mes) => out.push({ sev, tipo: "Contrato", titulo: `Contrato de ${c.forn}: ${nome}`, detalhe, pergunta, ids: idsA, mes, forn: c.forn, ct: c.id });
    for (const [nv, tit, txt] of E.ach) {
      if (tit === "Valor acima do contrato") add("alta", "mensalidade paga acima do contrato", txt, (S.ctPerguntasDe?.(E) || [])[0] || `Qual o documento que autoriza pagar ${brl(E.comp.semExpl)} acima da mensalidade de ${brl(c.valor)} a ${c.forn}?`, ids((l) => l.resto > 0), ultMes((l) => l.resto > 0));
      else if (tit === "Competências sem pagamento") add("media", "competências sem pagamento", txt, `As competências ${E.linhas.filter((l) => l.st === "ausente").map((l) => rotCurto(l.mes)).join(", ")} de ${c.forn} estão quitadas? Em qual nota?`, [], ultMes((l) => l.st === "ausente"));
      else if (tit === "Mesma nota paga mais de uma vez") { const idsD = ids((l) => l.ex.some((x) => /duplicidade/.test(x.txt))); if (!existentes.some((a) => (a.ids || []).some((i) => idsD.includes(i)) && /duplicidade|Documento fiscal/i.test(a.tipo))) add("alta", "mesma nota paga mais de uma vez", txt, `Apresentar a nota fiscal de cada pagamento a ${c.forn} ou o comprovante de devolução do valor pago em duplicidade.`, idsD, ultMes(() => true)); }
      else if (tit === "Pagamentos fora da mensalidade" && (E.comp.aSem > 0 || /exceto|salvo/.test(txt))) add(E.comp.aSem > 0 ? "media" : "baixa", "pagamentos fora da mensalidade", txt, `Quais documentos autorizam os pagamentos a ${c.forn} fora da mensalidade${E.comp.aSem ? ` (${brl(E.comp.aSem)} sem previsão no contrato)` : ""}?`, ids((l) => l.A.length > 0), ultMes((l) => l.A.length > 0));
      else if (tit === "Competências informadas fora de ordem") add("baixa", "competência informada fora de ordem nos balancetes", txt, `Pedir à administradora corrigir a competência informada das notas de ${c.forn}.`, [], ultMes(() => true));
      else if (tit === "Valor cadastrado não confere com os pagamentos") add("media", "valor cadastrado não confere com os pagamentos", txt, `Qual o valor mensal contratado com ${c.forn} e qual lançamento do balancete corresponde a ele?`, [], ultMes(() => true));
    }
  }
  return out;
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
  if (E.seq && E.modo === "nf") perguntas.push(`Pedimos à administradora corrigir a competência informada das notas ${[...E.seq].filter(([d, m]) => d.compBal !== m).map(([d]) => d.nf).join(", ")}, que estão fora da ordem de emissão.`);
  S.ctPerguntas = perguntas;
  // gráfico: mensalidade (cor da situação) + avulsos empilhados, com o devido tracejado
  const W = 1040, H = 250, ml = 92, mr = 16, mt = 16, mb = 30, mx = Math.max(...linhas.map((l) => Math.max(l.pc + l.pa, l.dev)), 1) * 1.12;
  const y = (v) => mt + (H - mt - mb) * (1 - v / mx), bw = (W - ml - mr) / Math.max(1, linhas.length), w = Math.min(40, bw * 0.55);
  const COR = { ok: "#2a9d8f", explicado: "#5b9bd5", parcial: "#e0a100", sem: "#d9663a", ausente: "#b4231a", aguarda: "#9aa7b3", pago: "#2a9d8f", nada: "#9aa7b3", dif: "#d9663a" };
  let g = [0, 0.5, 1].map((f) => `<line x1="${ml}" x2="${W - mr}" y1="${y(mx * f)}" y2="${y(mx * f)}" stroke="var(--grade, #e3e9ef)"/><text x="${ml - 8}" y="${y(mx * f) + 4}" text-anchor="end">${brl(mx * f).replace(",00", "")}</text>`).join("");
  linhas.forEach((l, i) => {
    const cx = ml + i * bw + bw / 2;
    if (l.pc) g += `<rect x="${cx - w / 2}" y="${y(l.pc)}" width="${w}" height="${y(0) - y(l.pc)}" rx="4" fill="${COR[l.st]}" data-tip="${esc(`Competência ${rotuloMes(l.mes)}\nMensalidade: ${brl(l.pc)}\nDevido: ${brl(l.dev)}\n${ST_CT[l.st][0]}`)}"/>`;
    if (l.pa) g += `<rect x="${cx - w / 2}" y="${y(l.pc + l.pa) + (l.pc ? 0 : 0)}" width="${w}" height="${Math.max(2, y(l.pc) - y(l.pc + l.pa) - 2)}" rx="4" fill="#8e7cc3" opacity=".75" data-tip="${esc(`Avulsos em ${rotuloMes(l.mes)}: ${brl(l.pa)}\n${l.A.map((d) => `${d.item} ${brl(d.v)}`).join("\n")}`)}"/>`;
    if (!l.pc && !l.pa && l.dev) g += `<text x="${cx}" y="${y(0) - 6}" text-anchor="middle" style="fill:#b4231a;font-weight:700">0</text>`;
    g += `<line x1="${cx - bw / 2 + 4}" x2="${cx + bw / 2 - 4}" y1="${y(l.dev)}" y2="${y(l.dev)}" stroke="#054166" stroke-width="2.5" stroke-dasharray="5 4"/>`;
    g += `<text x="${cx}" y="${H - 9}" text-anchor="middle" class="eixo-x">${rotCurto(l.mes)}</text>`;
  });
  // barra de composição do que foi pago
  const partes = [["Mensalidade dentro do contrato", cp.base, "#2a9d8f"], ["Acima, explicado", cp.acimaExpl, "#5b9bd5"], ["Acima, sem explicação", cp.semExpl, "#d9663a"], ["Avulsos previstos", cp.aPrev, "#8e7cc3"], ["Compras parceladas", cp.aParc, "#7aa6c2"], ["Avulsos sem previsão", cp.aSem, "#c2185b"]].filter((p) => p[1] > 0.009);
  const totComp = partes.reduce((s2, p) => s2 + p[1], 0) || 1;
  const tagRet = (d) => `<span class="nf-tag ret" title="${esc(d.desc)}">retenção ${esc((d.item || "").toLowerCase())} · ${brl(d.v)}${d.cit.length > 1 ? " (rateio)" : ""} · NF ${esc(d.nfAlvo)}</span>`;
  const tags = (l) => [...l.P.filter((d) => d.ret).map(tagRet), ...l.A.filter((d) => d.ret).map(tagRet), ...l.P.filter((d) => !d.ret).map((d) => `<span class="nf-tag" title="${esc(d.desc)}">${/^\d/.test(d.nf || "") ? "NF " + esc(d.nf) : esc(d.nf || "s/n")} · ${brl(d.v)} · baixa ${esc(String(d.baixa).slice(0, 5))}${E.modo === "nf" && E.seq?.get(d) && E.seq.get(d) !== d.compBal ? ` <i>informada ${rotCurto(d.compBal)}</i>` : ""}</span>`),
    ...l.A.filter((d) => !d.ret).map((d) => `<span class="nf-tag av" title="${esc(d.desc)}">${esc((d.item || "Avulso").toLowerCase())} · ${brl(d.v)} · ${esc(d.nf || "s/n")}</span>`)].join("");
  const mostrar = linhas.filter((l) => !S.ctSoDif || l.st !== "ok" || l.A.length);
  const nAten = linhas.filter((l) => !["ok", "explicado", "aguarda", "nada"].includes(l.st)).length;
  return `<div class="card ficha-ct">
    <div class="cab"><div class="cab-secao"><span class="eyebrow">Ficha do contrato</span><h2>${esc(c.forn)}</h2></div><button type="button" class="link-x" data-ct-ficha="${c.id}" aria-label="Fechar">×</button></div>
    <dl class="ficha-dados">
      ${c.numero ? `<div><dt>Contrato</dt><dd>nº ${esc(c.numero)}</dd></div>` : ""}${c.cnpj ? `<div><dt>CNPJ</dt><dd>${esc(c.cnpj)}</dd></div>` : ""}
      <div><dt>Objeto</dt><dd>${esc(c.objeto || "—")}</dd></div>
      ${c.tipo ? `<div><dt>Tipo</dt><dd>${esc(c.tipo)}</dd></div>` : ""}
      <div><dt>Valor</dt><dd>${descreverValor(c)}${c.diaVenc ? ` · vence dia ${c.diaVenc}` : ""}${c.formaPagamento ? ` · ${esc(c.formaPagamento)}` : ""}</dd></div>
      ${c.contratado && c.contratado !== c.forn ? `<div><dt>Razão social</dt><dd>${esc(c.contratado)}</dd></div>` : ""}
      ${c.assinatura ? `<div><dt>Assinado em</dt><dd>${dataBR(c.assinatura)}</dd></div>` : ""}
      <div><dt>Vigência</dt><dd>${c.inicio ? (c.inicio.length === 10 ? dataBR(c.inicio) : rotuloMes(c.inicio)) : "—"} a ${fim ? dataBR(fim) : "indeterminado"}${c.prazoMeses ? ` · períodos de ${c.prazoMeses} meses` : ""}${c.renovacaoAuto ? " · renovação automática" : ""}</dd></div>
      ${avisoData ? `<div><dt>Aviso para não renovar</dt><dd>até ${dataBR(avisoData)} (${c.avisoDias} dias antes)</dd></div>` : ""}
      ${c.reajuste ? `<div><dt>Reajuste</dt><dd>${esc(c.reajuste)}</dd></div>` : ""}
      ${(c.adicionais || []).length ? `<div><dt>Valores avulsos previstos</dt><dd>${c.adicionais.map((x) => esc(txtAdic(x))).join(" · ")}</dd></div>` : ""}
      ${c.multa ? `<div><dt>Multa por atraso</dt><dd>${esc(c.multa)}</dd></div>` : ""}
      ${c.multaRescisoria ? `<div><dt>Rescisão</dt><dd>${esc(c.multaRescisoria)}</dd></div>` : ""}
      ${(c.info || []).map((x) => `<div><dt>${esc(x.rot)}</dt><dd>${esc(x.txt)}</dd></div>`).join("")}
      <div><dt>Mensalidade nos balancetes</dt><dd>${c.filtro ? `lançamentos com “${esc(c.filtro)}”` : c.itemAuto ? `histórico “${esc(c.itemAuto)}” (identificado pelo valor); os demais pagamentos ao fornecedor são tratados como avulsos` : "todos os pagamentos ao fornecedor"}${grupoForn(c.forn) !== c.forn ? `; inclui as empresas do mesmo grupo (${[...new Set(S.todos.flatMap((b) => b.despesas.map((d) => d.forn)))].filter((f) => grupoForn(f) === grupoForn(c.forn)).join(" e ")})` : ""}</dd></div>
    </dl>
    ${(c.clausulas || []).length ? `<details class="clausulas-ct"><summary>Cláusulas do contrato (${c.clausulas.length})</summary><ol>${c.clausulas.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></details>` : ""}
    ${ehAdmin() ? `<div class="acoes" style="margin-top:8px"><label class="btn sec"><input type="file" data-ct-reler="${c.id}" accept="application/pdf,.pdf,.docx,.txt,image/*" hidden>Atualizar com o PDF do contrato</label><span class="mini" id="ctRelerMsg">Relê o contrato e completa cláusulas, avulsos previstos, honorários e multas, sem mudar valor nem datas.</span></div>` : ""}

    <section class="diag-ct">
      <div class="cab-secao"><span class="eyebrow">Diagnóstico</span><h3>O que explica cada real pago</h3></div>
      <p class="diag-tot">Pagos <b>${brl(cp.totP + cp.totA)}</b> ao fornecedor de ${linhas[0] ? rotCurto(linhas[0].mes) : "—"} a ${linhas.at(-1) ? rotCurto(linhas.at(-1).mes) : "—"}, contra <b>${brl(an.totDev)}</b> de mensalidades devidas. ${nAten ? `${nAten} competência(s) pedem atenção.` : "Todas as competências estão conformes ou explicadas."}</p>
      <div class="comp-barra" role="img" aria-label="Composição do valor pago">${partes.map((p) => `<span style="flex:${p[1] / totComp};background:${p[2]}" data-tip="${esc(`${p[0]}: ${brl(p[1])} (${pct(p[1] / totComp)})`)}"></span>`).join("")}</div>
      <div class="legenda comp-leg">${partes.map((p) => `<span><i style="background:${p[2]}"></i>${p[0]} <b>${brl(p[1])}</b></span>`).join("")}</div>
      ${E.ach.length ? `<ul class="achados">${E.ach.map(([nv, tit, txt]) => `<li class="${NIVEL[nv][1]}"><span class="st-ct ${NIVEL[nv][1]}">${NIVEL[nv][0]}</span><b>${esc(tit)}.</b> ${esc(txt)}</li>`).join("")}</ul>` : '<p class="muted">Pagamentos conferem com o contrato.</p>'}
    </section>

    <div class="cab-secao" style="margin-top:16px"><span class="eyebrow">Por competência</span><h3>Mensalidade e avulsos em cada mês de serviço</h3></div>
    <div class="legenda" style="margin:6px 0">${[["ok", "Conforme"], ["explicado", "Diferença explicada"], ["parcial", "Explicada em parte"], ["sem", "Sem explicação"]].map(([k, t2]) => `<span><i style="background:${COR[k]}"></i>${t2}</span>`).join("")}<span><i style="background:#8e7cc3"></i>Avulsos</span><span><i class="linha" style="background:#054166"></i>Devido</span></div>
    <div class="grafico-largo"><svg class="g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mensalidade e avulsos por competência">${g}</svg></div>
    <div class="ct-tab-ctl">
      ${E.seq ? `<div class="chips" role="group" aria-label="Competência"><span class="mini">Competência:</span><button type="button" class="chip" data-ct-modo="nf" aria-pressed="${E.modo === "nf"}">Pela ordem das notas</button><button type="button" class="chip" data-ct-modo="bal" aria-pressed="${E.modo === "bal"}">Como informada no balancete</button></div>` : "<span></span>"}
      <label class="check mini"><input type="checkbox" id="ctSoDif" ${S.ctSoDif ? "checked" : ""}> Só meses com diferença ou avulsos</label>
    </div>
    <div class="tabela ficha-tab"><table><colgroup><col style="width:11%"><col style="width:14%"><col style="width:15%"><col style="width:14%"><col style="width:15%"><col style="width:31%"></colgroup>
      <thead><tr><th>Mês</th><th class="n">Devido</th><th class="n">Mensalidade</th><th class="n">Avulsos</th><th class="n">Diferença</th><th>Situação</th></tr></thead><tbody>
      ${mostrar.map((l) => `<tr class="ct-lin ${ST_CT[l.st][1]}"><td><b>${rotCurto(l.mes)}</b></td><td class="n">${brl(l.dev)}</td><td class="n">${brl(l.pc)}</td><td class="n">${l.pa ? brl(l.pa) : "—"}</td><td class="n ${l.dif > 0.01 ? "neg" : l.dif < -0.01 ? "pos" : ""}">${l.dif > 0 ? "+" : ""}${brl(l.dif)}</td><td><span class="st-ct ${ST_CT[l.st][1]}">${ST_CT[l.st][0]}</span>${l.resto > 0 && l.st === "parcial" ? ` <span class="mini neg">${brl(l.resto)} sem explicação</span>` : ""}</td></tr>
        ${l.P.length || l.A.length || l.ex.length ? `<tr class="ct-det ${ST_CT[l.st][1]}"><td colspan="6"><div class="ct-det-in"><div class="ct-det-nfs">${tags(l) || '<span class="mini">nenhum pagamento</span>'}</div>${l.ex.length ? `<ul class="expl">${l.ex.map((x) => `<li class="e-${x.tipo}">${esc(x.txt)}</li>`).join("")}</ul>` : ""}</div></td></tr>` : ""}`).join("")}
      <tr class="total"><td>Total</td><td class="n">${brl(an.totDev)}</td><td class="n">${brl(cp.totP)}</td><td class="n">${brl(cp.totA)}</td><td class="n">${brl(r2(cp.totP - an.totDev))}</td><td>${cp.semExpl ? `<span class="mini neg">${brl(cp.semExpl)} sem explicação</span>` : ""}</td></tr>
    </tbody></table></div>
    <div class="cab-secao" style="margin-top:16px"><span class="eyebrow">Para questionar</span><h3>Perguntas ao síndico e à administradora</h3></div>
    ${perguntas.length ? `<ol class="perguntas-ct">${perguntas.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>
      <div class="acoes"><button class="btn sec" type="button" id="ctCopiarPerg">Copiar perguntas</button>${avisoData && pode() ? `<button class="btn sec" type="button" data-ct-agenda="${c.id}">Pôr o prazo de aviso na agenda</button>` : ""}</div>`
      : `<p class="muted">Nada a questionar: os pagamentos conferem ou estão explicados.</p>${avisoData && pode() ? `<div class="acoes"><button class="btn sec" type="button" data-ct-agenda="${c.id}">Pôr o prazo de aviso na agenda</button></div>` : ""}`}
  </div>`;
}
function formContrato(c) {
  const forns = porFornecedor(S.todos).map((f) => f.forn);
  const ad = (c?.adicionais || []).map((x) => x.pctSM ? `${x.pctSM}% SM ${x.desc}` : `${fmtValor(x.valor)} ${x.desc}`).join("; ");
  return `<div class="cab-secao"><span class="eyebrow">${c && c.id ? "Editar" : "Novo"} contrato</span><h2>${c && c.id ? esc(c.forn) : c && c.forn ? "Conferir dados lidos do PDF" : "Cadastrar contrato"}</h2></div>
    ${c && c.origem ? `<p class="small muted">Lido de "${esc(c.origem)}". Confira cada campo antes de salvar.</p>` : ""}
    <div class="form" style="margin-top:12px">
      <label>Fornecedor (como aparece nos balancetes)<input id="ctForn" list="listaForn" required value="${esc(c?.forn || "")}"></label>
      <label>Nº do contrato<input id="ctNum" value="${esc(c?.numero || "")}"></label>
      <label>CNPJ<input id="ctCnpj" value="${esc(c?.cnpj || "")}"></label>
      <label>Objeto<input id="ctObj" value="${esc(c?.objeto || "")}" placeholder="ex.: portaria 24h"></label>
      <label>Tipo<input id="ctTipo" list="listaTiposCt" value="${esc(c?.tipo || "")}" placeholder="ex.: Limpeza e conservação"></label>
      <label>Modalidade de pagamento<select id="ctModal">${[["mensal", "Mensal"], ["parcelado", "Parcelado"], ["global", "Valor global (por medição/avulso)"], ["anual", "Anual"]].map(([k, t2]) => `<option value="${k}" ${(c?.modalidade || "mensal") === k ? "selected" : ""}>${t2}</option>`).join("")}</select></label>
      <label>Valor mensal ou da parcela (R$)<input id="ctValor" inputmode="decimal" required value="${fmtValor(c?.valor || 0)}"></label>
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
    S.ctLido = { ...C, forn: C.forn || C.contratado || "", tol: 2, origem: f.name, fim: C.fim || "", filtro: "", lidoEm: new Date().toISOString() };
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
      ${linha("Fornecedor nos balancetes", C.forn ? `<b>${esc(C.forn)}</b>` : '<span class="neg">nenhum fornecedor parecido nos balancetes</span>')}
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
  if (!c || (!c.valor && !c.valorTotal)) return "";
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
    filtro: $("#ctFiltro").value.trim(), link: urlValida($("#ctLink").value.trim()) ? $("#ctLink").value.trim() : "" };
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
    for (const k of ["multa", "reajuste", "multaRescisoria", "numero", "cnpj", "contratado", "assinatura", "objeto", "tipo", "formaPagamento", "diaVenc", "avisoDias"]) if (!c[k] && C[k]) { novo[k] = C[k]; mud.push(k); }
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
  if (t.closest("#pacoteCancelar")) { try { sessionStorage.removeItem("farol.pacote"); } catch {} S.pacoteCod = ""; $("#bannerPacote").hidden = true; return; }
  const cmo = t.closest("[data-ct-modo]"); if (cmo) { S.ctModoComp = cmo.dataset.ctModo; contratosTab(); $("#ctFicha .ct-tab-ctl")?.scrollIntoView({ block: "center" }); return; }
  const cfl = t.closest("[data-ct-filtro]"); if (cfl) { S.ctFiltro = cfl.dataset.ctFiltro; contratosTab(); return; }
  if (t.closest("#ctCancelar")) { S.ctEditando = ""; S.ctRascunho = null; contratosTab(); return; }
  const cf = t.closest("[data-ct-ficha]"); if (cf) { S.ctFicha = S.ctFicha === cf.dataset.ctFicha ? "" : cf.dataset.ctFicha; contratosTab(); if (S.ctFicha) $("#ctFicha").scrollIntoView({ block: "start" }); return; }
  if (t.closest("#ctUsarLido")) { S.ctEditando = ""; S.ctRascunho = S.ctLido; const rev = $("#ctRevisao").innerHTML; contratosTab(); $("#fContrato").scrollIntoView({ block: "start" }); return; }
  if (t.closest("#ctCopiarPerg")) { const txt = (S.ctPerguntas || []).map((q, i) => `${i + 1}. ${q}`).join("\n\n"); navigator.clipboard.writeText(txt).then(() => toast("Perguntas copiadas."), () => toast("Não foi possível copiar; selecione o texto.")); return; }
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
    if (dados.forn && !forns.includes(dados.forn)) { const pad = nomeFornecedor(dados.forn); dados.forn = forns.includes(pad) ? pad : casarFornecedor(dados.forn, forns) || pad; }
    if (!dados.forn || !dados.valor) return ($("#ctMsg").textContent = "Informe o fornecedor e o valor mensal.");
    const id = f.dataset.id || novoId();
    const lido = S.ctRascunho || {};
    const c = { ...(S.contratos.find((x) => x.id === id) || {}), ...(lido.info ? { info: lido.info, clausulas: lido.clausulas || [], assinatura: lido.assinatura || "", prazoDias: lido.prazoDias || null, contratado: lido.contratado || "" } : {}), ...dados, id, origem: S.ctRascunho?.origem || S.contratos.find((x) => x.id === id)?.origem || "", por: nomeUsuario(), ts: new Date().toISOString() };
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

})();
