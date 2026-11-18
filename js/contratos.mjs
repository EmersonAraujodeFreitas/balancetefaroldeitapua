// Leitura de contratos em PDF: texto do PDF (PDF.js) ou, se for digitalizado, reconhecimento óptico (Tesseract.js)
// e extração dos campos principais por regras de texto. Tudo roda no navegador; o PDF não é enviado a nenhum servidor
// (exceto o download do Tesseract e do dicionário de português, quando o PDF é uma imagem).
const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const MESES_N = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
export const ctNorm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ctIso = (d, m, a) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// "2.000,00", "2000,00" ou, quando o OCR troca a vírgula, "25.00"
export const ctNum = (s) => { const x = String(s).replace(/\s/g, ""), m = /^(.*)[.,](\d{2})$/.exec(x); return m ? parseFloat(m[1].replace(/[.,]/g, "") + "." + m[2]) : parseFloat(x.replace(/[.,]/g, "")); };

function carregarScript(url) {
  return new Promise((ok, erro) => {
    if (window.Tesseract) return ok();
    const s = document.createElement("script"); s.src = url; s.onload = () => ok(); s.onerror = () => erro(new Error("Não foi possível carregar o leitor de imagem (sem internet?)."));
    document.head.appendChild(s);
  });
}

// texto de todas as páginas; se quase não houver texto, o PDF é imagem e passa pelo OCR
export async function textoDoPdf(pdfjs, dados, progresso = () => {}) {
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

// fornecedor dos balancetes com mais palavras em comum com o nome do contratado
const VAZIAS = new Set(["sociedade", "individual", "ltda", "eireli", "servicos", "servico", "de", "da", "do", "das", "dos", "e", "me", "epp", "sa", "s/a", "comercio", "empresa", "cia", "companhia", "advogados", "associados"]);
export function casarFornecedor(nome, forns) {
  const tk = (s) => ctNorm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !VAZIAS.has(w));
  const a = new Set(tk(nome)); let melhor = null, nota = 0;
  for (const f of forns) { const b = tk(f.replace(/\(.*?\)/g, "")); const n = b.filter((w) => a.has(w)).length / Math.max(1, b.length); if (n > nota) { nota = n; melhor = f; } }
  return nota >= 0.5 ? melhor : null;
}

// trechos mostrados na revisão nunca exibem CPF ou RG das partes
const ocultar = (x) => x.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "•••").replace(/(RG|identidade)[^,;]{0,40}?\d[\d.\-]{5,}/gi, "$1 •••").replace(/\b\d{8,11}\b/g, "•••");
const trecho = (txt, i, len = 0, raio = 90) => ocultar(txt.slice(Math.max(0, i - raio), i + len + raio).replace(/\s+/g, " ").trim());

export function lerContrato(textoBruto, forns = []) {
  const t = textoBruto.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/-\n/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ");
  const n = ctNorm(t); // mesmo tamanho de t (só remove acentos de letras já decompostas)
  const C = {}, T = {};
  const achar = (re, alvo = n) => { re.lastIndex = 0; const m = re.exec(alvo); return m; };

  let m = achar(/contrato\s+n[ºo°.]*\s*:?\s*(\d[\d./-]*\d)/i, t); if (m) { C.numero = m[1]; T.numero = trecho(t, m.index, m[0].length, 40); }
  m = achar(/contratad[oa]\s*:\s*([^,;]{3,120})/i, t);
  if (m) {
    C.contratado = m[1].trim().replace(/\s+/g, " "); T.contratado = trecho(t, m.index, m[0].length, 60);
    const seg = t.slice(m.index, m.index + 400), cn = /CNPJ[^\d]{0,25}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i.exec(seg); if (cn) C.cnpj = cn[1];
  }
  m = achar(/contratante\s*:\s*([^,;]{3,120})/i, t); if (m) C.contratante = m[1].trim();
  if (C.contratado) C.forn = casarFornecedor(C.contratado, forns);

  m = achar(/tem\s+(?:como|por)\s+objeto\s+(?:a\s+|o\s+)?(.{15,260}?)[.;]/i, t);
  if (m) { C.objeto = m[1].replace(/,\s*o qual.*$/i, "").trim(); T.objeto = trecho(t, m.index, m[0].length, 10); }
  else { m = achar(/contrato\s+de\s+([a-zà-ú\s,]{10,120}?)(?=\s+contrato|\s+contratante|\s+clausula|\s+i\b|$)/i, t); if (m) C.objeto = m[1].trim(); }
  if (C.objeto && C.objeto.length > 140) C.objeto = C.objeto.slice(0, 137).replace(/\s\S*$/, "") + "…";

  // valor mensal: R$ seguido (ou precedido) de "mensal/mensais/por mês"
  const valores = [...t.matchAll(/R\$\s?(\d[\d.,]*[.,]\d{2})(?!\d)/g)].map((x) => ({ v: ctNum(x[1]), i: x.index, txt: x[0] }));
  const mensal = valores.find((x) => /mensa|por mes|ao mes|mensalmente/.test(n.slice(x.i, x.i + 140)) || /mensa|por mes/.test(n.slice(Math.max(0, x.i - 80), x.i)));
  const escolhido = mensal || valores.find((x) => /pagara|valor|honorario|preco|remunera/.test(n.slice(Math.max(0, x.i - 120), x.i)) && x.v >= 100);
  if (escolhido) { C.valor = escolhido.v; T.valor = trecho(t, escolhido.i, escolhido.txt.length); }
  // valores avulsos previstos ("R$ 50,00 por certidão")
  C.adicionais = valores.filter((x) => x !== escolhido).map((x) => {
    const depois = t.slice(x.i, x.i + 160), por = /\bpor\s+(certid[aã]o|consulta|audi[eê]ncia|visita|hora|dia|unidade|chamado|atendimento|processo|ato)\b/i.exec(depois);
    const prep = /preposto/i.test(t.slice(Math.max(0, x.i - 120), x.i + 160));
    return por || prep ? { valor: x.v, desc: por ? `por ${por[1].toLowerCase()}` : "preposto por audiência" } : null;
  }).filter(Boolean).filter((x, i, arr) => arr.findIndex((y) => y.valor === x.valor && y.desc === x.desc) === i);

  // início, prazo e fim
  m = achar(/(?:inicio|vigencia)[^.]{0,40}?(?:em|a partir de|de)\s+(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i) || achar(/(?:inicio|vigencia)[^.]{0,40}?(?:em|a partir de|de)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (m) { const mes = MESES_N[m[2]] || +m[2]; if (mes) { C.inicio = ctIso(m[1], mes, m[3]); T.inicio = trecho(t, m.index, m[0].length, 30); } }
  m = achar(/prazo\s+(?:inicial\s+|determinado\s+|de\s+vigencia\s+)?(?:de\s+)?(\d{1,3})\s*(?:\([a-z\s]+\))?\s*(meses|mes|anos?)\b/i);
  if (m) { C.prazoMeses = +m[1] * (/ano/.test(m[2]) ? 12 : 1); T.prazo = trecho(t, m.index, m[0].length, 40); }
  m = achar(/(?:termino|vigencia ate|ate o dia|encerrando-se em)\s+(?:em\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})/i); if (m) C.fim = ctIso(m[1], m[2], m[3]);
  if (!C.inicio) { const as = [...n.matchAll(/,\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/g)].filter((x) => MESES_N[x[2]]); const a = as[0]; if (a) { C.inicio = ctIso(a[1], MESES_N[a[2]], a[3]); T.inicio = trecho(t, a.index, a[0].length, 30) + " (data de assinatura)"; } }
  C.renovacaoAuto = /renovad[oa]\s+automaticamente|renovacao\s+automatica|prorrogad[oa]\s+automaticamente/.test(n);
  m = achar(/(?:antecedencia|antecedente|aviso previo)[^.]{0,60}?(\d{1,3})\s*(?:\([a-z\s]+\))?\s*dias/i); if (m) { C.avisoDias = +m[1]; T.aviso = trecho(t, m.index, m[0].length, 40); }
  m = achar(/vencimento\s+(?:no\s+|todo\s+)?dia\s+(\d{1,2})/i) || achar(/todo\s+dia\s+(\d{1,2})\s+de\s+cada\s+mes/i); if (m) C.diaVenc = +m[1];

  // reajuste: índices citados perto de "reajuste/corrigido"
  const ri = n.search(/reajust|corrigid[oa]|atualizad[oa] anualmente|correcao monetaria/);
  if (ri >= 0) {
    const jan = n.slice(Math.max(0, ri - 250), ri + 300), idx = [];
    for (const [re, nome] of [[/igp-?\s?m/, "IGP-M"], [/ipca/, "IPCA"], [/inpc/, "INPC"], [/igp-?\s?di/, "IGP-DI"], [/salario[- ]minimo/, "salário mínimo"], [/convencao coletiva|dissidio/, "convenção coletiva"]]) if (re.test(jan)) idx.push(nome);
    C.reajuste = `${/anual|anualmente|12 \(doze\) meses/.test(jan) ? "Anual" : "Reajuste"}${idx.length ? ": " + idx.join(" + ") : ""}${C.diaVenc ? ` · vencimento dia ${C.diaVenc}` : ""}`;
    T.reajuste = trecho(t, ri, 0, 150);
  }
  m = achar(/multa[^.]{0,80}?(\d{1,2}(?:,\d+)?)\s*%/i); if (m) C.multa = m[1] + "%";
  return { campos: C, trechos: T, caracteres: t.length };
}

// fim do período atual: início + prazo; com renovação automática, avança até o período vigente
export function fimVigente(inicio, prazoMeses, renova, hoje) {
  if (!inicio || !prazoMeses) return null;
  const d = new Date(inicio + "T12:00:00");
  const fimDe = (k) => { const f = new Date(d); f.setMonth(f.getMonth() + prazoMeses * k); f.setDate(f.getDate() - 1); return f.toISOString().slice(0, 10); };
  let k = 1, f = fimDe(1);
  if (renova) while (f < hoje && k < 50) f = fimDe(++k);
  return { fim: f, renovacoes: k - 1 };
}
