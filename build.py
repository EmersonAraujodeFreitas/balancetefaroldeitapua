# Junta os módulos em um script clássico (js/app.js) e gera js/base.js com a base embutida.
import re, json, os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js')
partes = []
for f in ['parser.mjs', 'analise.mjs', 'executivo.mjs', 'app.mjs']:
    s = open(os.path.join(d, f)).read()
    s = re.sub(r'^import [^;]+;\n', '', s, flags=re.M)
    s = re.sub(r'^export (async function|function|const|let)', r'\1', s, flags=re.M)
    partes.append(f'// ===== {f}\n' + s)
codigo = '/* Gerado por build.py a partir de js/*.mjs — edite os .mjs */\n(async () => {\n"use strict";\n' + '\n'.join(partes) + '\n})();\n'
open(os.path.join(d, 'app.js'), 'w').write(codigo)
base = json.load(open(os.path.join(os.path.dirname(d), 'data', 'balancetes.json')))
open(os.path.join(d, 'base.js'), 'w').write('window.__BASE_BALANCETES__ = ' + json.dumps(base, ensure_ascii=False) + ';\n')
print('ok', len(codigo))
