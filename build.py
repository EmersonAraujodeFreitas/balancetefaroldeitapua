# Junta os módulos em um script clássico (js/app.js) e gera js/base.js com a base embutida.
import re, json, os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js')
partes = []
for f in ['parser.mjs', 'analise.mjs', 'graficos.mjs', 'executivo.mjs', 'gestao.mjs', 'acesso.mjs', 'contratos.mjs', 'app.mjs']:
    s = open(os.path.join(d, f)).read()
    s = re.sub(r'^import [^;]+;\n', '', s, flags=re.M)
    s = re.sub(r'^export (async function|function|const|let)', r'\1', s, flags=re.M)
    partes.append(f'// ===== {f}\n' + s)
codigo = '/* Gerado por build.py a partir de js/*.mjs — edite os .mjs */\n(async () => {\n"use strict";\n' + '\n'.join(partes) + '\n})();\n'
open(os.path.join(d, 'app.js'), 'w').write(codigo)
arq = os.path.join(os.path.dirname(d), 'data', 'balancetes.json')
# sem o arquivo público (dados na base protegida), base.js fica vazio
conteudo = 'window.__BASE_BALANCETES__ = ' + json.dumps(json.load(open(arq)), ensure_ascii=False) + ';\n' if os.path.exists(arq) else 'window.__BASE_BALANCETES__ = null;\n'
open(os.path.join(d, 'base.js'), 'w').write(conteudo)
print('ok', len(codigo))
