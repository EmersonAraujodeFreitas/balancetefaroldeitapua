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
export async function textoDoArquivo(pdfjs, arquivo, progresso = () => {}) {
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
export function casarFornecedor(nome, forns) {
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

export function lerContrato(textoBruto, forns = []) {
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
  for (const x of todos(/multa/g)) { const f2 = frase(x.index), fn = ctNorm(f2); if (/rescis|rescind|cancelament|rompiment|resili|infrac|infrator|descumpr|fidelidade/.test(fn) && !/atraso no (pagamento|recebimento)|juros/.test(fn) && f2.length < 470) { C.multaRescisoria = f2.replace(/^[a-z]\)\s*/i, "").replace(/^[a-zà-ú][^:;.]{0,90}[:;]\s*(?=(?:na hip[oó]tese|em caso|caso|havendo|o descumprimento|se ))/, "").replace(/^./, (x) => x.toUpperCase()); break; } }
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

  // securitização / garantia de receita (ex.: Cerus Bank): a empresa antecipa as taxas condominiais e desconta a remuneração
  if (/securitiza/.test(n) && /taxas? condominia/.test(n)) {
    C.natureza = "receita"; C.tipo = "Securitização das taxas condominiais (receita garantida)"; C.modalidade = "mensal"; C.valor = 0; C.valorTotal = null; C.parcelas = null;
    const pct = /percentual de (\d{1,2}(?:,\d+)?)\s*%[^.]{0,90}?valor liquido/.exec(n), tit = /r\$\s?(\d{1,3},\d{2})\s*\([^)]*\)\s*por cada titulo/.exec(n), desc = /desconto de (\d{1,2})\s*%/.exec(n);
    C.securitizacao = { pct: pct ? +pct[1].replace(",", ".") : null, porTitulo: tit ? +tit[1].replace(",", ".") : null, desconto: desc ? +desc[1] : null };
    C.valorRegra = `taxas condominiais garantidas todo mês, descontados ${pct ? pct[1] + "%" : "a remuneração"} do valor líquido${tit ? ` + R$ ${tit[1]} por boleto` : ""}`;
    const emp = /([A-ZÀ-Ú]{3,} SECURITIZADORA[A-ZÀ-Ú ]{0,40}?S\.?\s?\/?A)\b/.exec(t);
    C.contratado = emp ? emp[1].trim().replace(/\s+/g, " ") : C.contratado;
    const cn = /SECURITIZADORA[\s\S]{0,400}?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.exec(t); if (cn) C.cnpj = cn[1];
    if (/cerusbank|cerus/i.test(t)) C.marca = "Cerus Bank";
    C.objeto = "securitização (antecipação garantida) das taxas condominiais, fundo de reserva e cotas de água";
    const ini = /a partir da competencia (\d{1,2}) de ([a-zç]+) de (\d{4})/.exec(n);
    if (ini && MESES_N[ini[2]]) C.inicio = `${ini[3]}-${String(MESES_N[ini[2]]).padStart(2, "0")}-${ini[1].padStart(2, "0")}`;
    const val = /validade inicial de (\d{1,3})\s*(?:\([^)]*\)\s*)?meses/.exec(n); if (val) C.prazoMeses = +val[1];
    if (/renovado de maneira automatica por tempo indeterminado|renovacao automatica/.test(n)) { C.renovacaoAuto = true; C.indeterminado = false; }
    const av = /antecedencia minima de (\d{1,3})\s*(?:\([^)]*\)\s*)?dias,?\s*a titulo de aviso/.exec(n) || /rescisao[^.]{0,160}?antecedencia minima de (\d{1,3})/.exec(n); if (av) C.avisoDias = +av[1];
    const asss = [...t.matchAll(/\b([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)?)\s*(?:\/[A-Z]{2})?,\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/g)], ass = asss.at(-1);
    if (ass && MESES_N[ctNorm(ass[3])]) C.assinatura = `${ass[4]}-${String(MESES_N[ctNorm(ass[3])]).padStart(2, "0")}-${ass[2].padStart(2, "0")}`;
    delete C.numero; delete C.multaRescisoria; if (C.reajuste === "Reajuste") delete C.reajuste;
    const sec = /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ]{3,60}?LTDA)(?:(?!LTDA)[\s\S]){0,500}?doravante denominad[ao] apenas SECURITIZAD[AO]/.exec(t);
    C.info = [];
    if (C.securitizacao.pct) info("Remuneração", `${String(C.securitizacao.pct).replace(".", ",")}% sobre o valor líquido das taxas${tit ? ` + R$ ${tit[1]} por boleto` : ""}, descontados do repasse; tarifas de transferência reembolsadas`);
    if (desc) info("Desconto obrigatório", `${desc[1]}% para quem paga antes do vencimento; sem esse desconto aprovado em assembleia em 12 meses, a taxa sobe 1 ponto`);
    if (/15%[^.]{0,80}11/.test(n) || /quinze por cento/.test(n)) info("Cobrança dos inadimplentes", "multa, juros e encargos ficam com a securitizadora; cobrança administrativa +15% (11º ao 30º dia) e +20% a partir do 31º dia ou na via judicial, pagos pelo condômino devedor");
    info("Repasse", "1 dia útil após o vencimento do boleto, mesmo que o condômino não pague; outras cotas no mesmo boleto vão no 5º dia útil do mês seguinte; prestação de contas em até 15 dias");
    const agi = /assembleia geral ordinaria de instalacao realizada no dia (\d{1,2}) de ([a-zç]+) de (\d{4})/.exec(n);
    if (agi && MESES_N[agi[2]]) info("Assembleia de instalação", `${agi[1].padStart(2, "0")}/${String(MESES_N[agi[2]]).padStart(2, "0")}/${agi[3]}`);
    info("O que não entra", "taxas extraordinárias, vouchers de restaurante e taxas de manutenção das unidades (precisam de aditivo)");
    const tc = (x) => x.replace(/\s+/g, " ").trim().toLowerCase().replace(/(^|\s)(\S)/g, (m0, a2, b2) => a2 + b2.toUpperCase()).replace(/\bLtda\b/, "Ltda").replace(/\bSindicos\b/, "Síndicos");
    if (sec) info("Quem assina", `${tc(sec[1])} assina como securitizada; o condomínio aparece só como interveniente/anuente, representado pelo síndico. A cláusula 11ª pede assembleia para aprovar a securitização.`);
    info("Rescisão", "aviso de 60 dias; na saída, o condomínio devolve em 10 dias os valores antecipados e ainda não recuperados (ou desconto nos repasses, ou confissão de dívida em até 6 parcelas)");
  } else
  // contrato de receita: o condomínio cede ou aluga um espaço e recebe (loja, mercadinho, antena, publicidade)
  if (/cessao de (?:direito de )?uso|locacao de espaco|loja de conveniencia|cessao onerosa|permissao de uso/.test(n) && /condomini\w*[^.]{0,80}(?:-\s*)?\b(?:cedente|locador|permitente)\b|\b(?:cedente|locador|permitente)\b[^.]{0,40}condomini/.test(n)) {
    C.natureza = "receita"; C.tipo = "Cessão de espaço (receita)"; C.modalidade = "mensal";
    const q = /(\d+)\s*(?:\([^)]*\)\s*)?(?:taxas? condominia(?:l|is)|cotas? condominia(?:l|is))/.exec(n), q2 = /superar\s+(\d+)\s*%[^.]{0,160}?(\d+)\s*(?:\([^)]*\)\s*)?taxas? condominia/.exec(n);
    const fixo = /(?:repasse|remunera\w*|aluguel|valor mensal)[^.]{0,120}?r\$\s?(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(n);
    if (q) { C.valorRegra = `${q[1]} ${+q[1] === 1 ? "taxa condominial" : "taxas condominiais"} por mês${q2 ? ` (${q2[2]} se a ocupação do condomínio passar de ${q2[1]}%)` : ""}`; C.valor = 0; C.valorTotal = null; C.parcelas = null; }
    else if (fixo) C.valor = +fixo[1].replace(/\./g, "").replace(",", ".");
    else C.valor = 0;
    const ces = /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .&]{2,60}?(?:LTDA|S\/A|S\.A\.|EIRELI|ME)\.?)\s*[-–]\s*(?:CESSION[AÁ]RI[OA]|LOCAT[AÁ]RI[OA]|PERMISSION[AÁ]RI[OA])/.exec(t);
    if (ces) C.contratado = ces[1].trim().replace(/^\d+\s+/, "");
    const cnpjC = /(?:CESSION[AÁ]RI[OA]|LOCAT[AÁ]RI[OA])[^0-9]{0,40}(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.exec(t); if (cnpjC) C.cnpj = cnpjC[1];
    const ob = /(?:instala\w*|explora\w*)\s+de\s+(?:uma\s+)?([^.;]{6,120}?)\s+para\s+a\s+explora/.exec(n) || /loja de conveniencia/.exec(n);
    C.objeto = `cessão de uso de espaço${/m²|m2|metros quadrados/.test(t) ? ` (${(/(\d+)\s*m[²2]/.exec(t) || [])[1] || ""} m²)` : ""} para ${ob && ob[1] ? t.substr(ob.index + ob[0].indexOf(ob[1]), ob[1].length) : "loja de conveniência"}`.replace(" ( m²)", "");
    C.multaRescisoria = (/multa compensatoria[^.]{0,200}?r\$\s?([\d.]+,\d{2})/.exec(n) ? `Rescisão antecipada sem motivo: multa até o valor investido pelo cessionário, limitada a R$ ${/multa compensatoria[^.]{0,200}?r\$\s?([\d.]+,\d{2})/.exec(n)[1]}${/reduzida progressivamente[^.]{0,40}?(\d+)\s*%/.test(n) ? `, reduzida ${/reduzida progressivamente[^.]{0,40}?(\d+)\s*%/.exec(n)[1]}% por ano cumprido` : ""}.` : C.multaRescisoria);
    if (/energia|agua|internet/.test(n) && /reembols|medidor/.test(n)) info("Consumo", "Energia, água e internet do espaço são do cessionário, com medidor próprio e reembolso ao condomínio.");
    if (/seguro/.test(n) && /cessionari/.test(n)) info("Seguro", "O cessionário deve manter seguro (incêndio, danos estruturais e responsabilidade civil) e apresentar a apólice quando pedido.");
    const hor = /(\d{2})\s*\(vinte e quatro\)\s*horas|24\s*horas/.exec(n); if (hor) info("Funcionamento", "autoatendimento 24 horas, 7 dias por semana");
    C.info = C.info.filter((x) => !["Quantidades e horários", "Incluído"].includes(x.rot));
    const ass = /([a-zà-ú]+)\/?[a-z]{0,2},\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(t.slice(-3000));
    if (ass && MESES_N[ctNorm(ass[3])]) { const iso = `${ass[4]}-${String(MESES_N[ctNorm(ass[3])]).padStart(2, "0")}-${ass[2].padStart(2, "0")}`; C.assinatura = C.assinatura || iso; C.inicio = C.inicio || iso; }
    if (/a contar do ato de assinatura|a partir da assinatura/.test(n) && C.assinatura) C.inicio = C.assinatura;
    if (/prorrogad\w* automaticamente, mediante termo aditivo/.test(n)) C.renovacaoAuto = false;
  }
  if (C.info.some((x) => x.rot === "Planilha de custos")) {
    const k = C.info.findIndex((x) => x.rot === "Retenções"); C.info = C.info.filter((x, i) => x.rot !== "Retenções" || i === k);
    if (!C.tipo || /Seguro|Assessoria/.test(C.tipo)) { C.tipo = "Mão de obra terceirizada"; const qf = /total de funcionarios\s*(\d{1,3})/.exec(n); if (!C.objeto || /seguro/i.test(C.objeto)) C.objeto = `terceirização de mão de obra${qf ? ` (${qf[1]} funcionários)` : ""}`; }
  }
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
