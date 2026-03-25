const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Histórico em memória (pode evoluir para banco depois)
let historico = [];

// 📤 Upload de PDF
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const dataBuffer = fs.readFileSync(req.file.path);
        const data = await pdfParse(dataBuffer);

        const resultado = analisarBalancete(data.text);

        const registro = {
            id: uuidv4(),
            nome: req.file.originalname,
            data: new Date(),
            resultado
        };

        historico.push(registro);

        fs.unlinkSync(req.file.path);

        res.json(registro);

    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro ao processar PDF" });
    }
});

// 📜 Histórico
app.get("/historico", (req, res) => {
    res.json(historico);
});

// 🔍 Função de análise
function analisarBalancete(texto) {
    const linhas = texto.split("\n");

    let comprasAltas = [];
    let parcelas = {};

    linhas.forEach(linha => {
        const valores = linha.match(/(\d{1,3}(\.\d{3})*,\d{2})/g);

        if (valores) {
            valores.forEach(valor => {
                const num = parseFloat(valor.replace(/\./g, "").replace(",", "."));

                if (num > 10000) {
                    comprasAltas.push({
                        descricao: linha.trim(),
                        valor: num
                    });
                }
            });
        }

        const parcelaMatch = linha.match(/(\d+)\/(\d+)/);

        if (parcelaMatch) {
            const chave = linha.replace(/\d+\/\d+/, "").trim();

            if (!parcelas[chave]) {
                parcelas[chave] = [];
            }

            const valorMatch = linha.match(/(\d{1,3}(\.\d{3})*,\d{2})/);

            if (valorMatch) {
                const valor = parseFloat(valorMatch[0].replace(/\./g, "").replace(",", "."));
                parcelas[chave].push(valor);
            }
        }
    });

    let inconsistencias = [];

    Object.keys(parcelas).forEach(item => {
        const valores = parcelas[item];
        const base = valores[0];

        if (valores.some(v => v !== base)) {
            inconsistencias.push({
                item,
                valores
            });
        }
    });

    return {
        comprasAltas,
        inconsistencias,
        diagnostico: gerarDiagnostico(comprasAltas, inconsistencias)
    };
}

// 🧠 Diagnóstico final
function gerarDiagnostico(comprasAltas, inconsistencias) {
    let texto = "📊 Diagnóstico financeiro:\n\n";

    if (comprasAltas.length > 0) {
        texto += `⚠️ ${comprasAltas.length} compras acima de R$ 10.000 detectadas.\n`;
    } else {
        texto += "✅ Nenhuma compra acima de R$ 10.000.\n";
    }

    if (inconsistencias.length > 0) {
        texto += `⚠️ Parcelas com valores inconsistentes encontradas.\n`;
    } else {
        texto += "✅ Parcelas consistentes.\n";
    }

    if (comprasAltas.length === 0 && inconsistencias.length === 0) {
        texto += "\n💰 Situação saudável.";
    } else {
        texto += "\n🚨 Recomenda-se auditoria detalhada.";
    }

    return texto;
}

// 🚀 Start
app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});
