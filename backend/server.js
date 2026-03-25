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

let historico = [];

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
        res.status(500).json({ erro: "Erro ao processar PDF" });
    }
});

app.get("/historico", (req, res) => {
    res.json(historico);
});

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
                    comprasAltas.push({ linha, valor: num });
                }
            });
        }

        const parcela = linha.match(/(\d+)\/(\d+)/);

        if (parcela) {
            const chave = linha.replace(/\d+\/\d+/, "").trim();

            if (!parcelas[chave]) parcelas[chave] = [];

            const valor = linha.match(/(\d{1,3}(\.\d{3})*,\d{2})/);
            if (valor) {
                parcelas[chave].push(
                    parseFloat(valor[0].replace(/\./g, "").replace(",", "."))
                );
            }
        }
    });

    let inconsistencias = [];

    Object.keys(parcelas).forEach(item => {
        const valores = parcelas[item];
        if (valores.some(v => v !== valores[0])) {
            inconsistencias.push({ item, valores });
        }
    });

    // 🎯 SCORE (0 a 100)
    let score = 100;

    score -= comprasAltas.length * 5;
    score -= inconsistencias.length * 10;

    if (score < 0) score = 0;

    return {
        comprasAltas,
        inconsistencias,
        score,
        status: getStatus(score)
    };
}

function getStatus(score) {
    if (score >= 80) return "Saudável";
    if (score >= 50) return "Atenção";
    return "Crítico";
}

app.listen(3000, () => console.log("Servidor rodando"));
