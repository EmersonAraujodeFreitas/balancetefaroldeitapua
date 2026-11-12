# Balancetes Farol de Itapuã

Site de análise dos balancetes mensais ("Demonstrativo de Receitas e Despesas") emitidos pela Logo Gestão Condominial, feito para o conselho fiscal.

## Como funciona

- **Alimentação por PDF**: na aba *Importar PDF*, arraste o balancete do mês. O PDF é lido no próprio navegador (PDF.js, sem servidor), e o site confere a soma das despesas e receitas lidas com os totais impressos no balancete antes de aceitar.
- **Memória mês a mês**: cada balancete é guardado pelo mês de referência. Reimportar o mesmo mês substitui a versão anterior (útil quando a Logo reemite o demonstrativo).
- **Análises que se adaptam**: painel, categorias, fornecedores, alertas, parcelas a vencer, roteiro de perguntas e minuta de parecer são recalculados a partir de todos os meses carregados. Categorias, fornecedores e meses novos entram sozinhos nas regras.
- **Leitura adaptativa do PDF**: as colunas são localizadas pelo cabeçalho da tabela em cada página, então pequenos deslocamentos de layout do PDF não quebram a leitura.

## Deixar os meses novos visíveis para todos

Meses importados ficam primeiro só no navegador de quem importou. Para publicar:

1. Crie um token em GitHub → Settings → Developer settings → Fine-grained tokens, com acesso só a este repositório e permissão **Contents: Read and write**.
2. Na aba *Importar PDF*, preencha usuário, repositório, branch e o token, e clique em **Publicar base no GitHub**. O site grava `data/balancetes.json` com um commit; em 1 a 2 minutos todos veem os dados novos.

## Publicação (GitHub Pages)

Settings → Pages → *Deploy from a branch* → `main` / `(root)`.

## Arquivos

- `index.html` – interface
- `js/parser.mjs` – leitor do PDF da Logo
- `js/analise.mjs` – indicadores e regras de alerta
- `js/app.mjs` – telas, importação e publicação
- `js/executivo.mjs` – análises executivas e gráficos comparativos
- `js/app.js` e `js/base.js` – gerados por `python3 build.py` a partir dos `.mjs` (o site carrega estes dois, por isso também abre direto do computador)
- `img/` – logo do condomínio
- `js/vendor/` – PDF.js 6.2.108 (Apache-2.0)
- `data/balancetes.json` – base publicada (ago/2025 a set/2026 já carregados)
- `frontend/`, `backend/` – protótipo anterior, mantido sem alterações

Dados pessoais (CPF em nomes de fornecedores e telefones) são mascarados na leitura, porque o repositório é público.
