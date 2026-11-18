import json, re, sys, html
d = json.load(open(sys.argv[1]))
c = [c for c in d['capitulos'] if c['titulo'] == 'Conjuros'][0]
n = c['nodos']
start = [i for i, x in enumerate(n) if x[0] == 'h' and x[2] == 'Descripciones de conjuros'][0]
plain = lambda h: html.unescape(re.sub(r'<[^>]+>', '', h)).replace(' ', ' ').strip()
ATR = {'fuerza': 'FUE', 'destreza': 'DES', 'constitución': 'CON', 'inteligencia': 'INT', 'sabiduría': 'SAB', 'carisma': 'CAR'}
spells = []; cur = None
def cerrar():
    if cur: spells.append(cur)
for x in n[start + 1:]:
    if x[0] == 'h' and x[1] == 4:
        cerrar(); cur = {'nombre': x[2], 'id': x[3], 'cab': '', 'meta': [], 'parrafos': [], 'listas': []}; continue
    if x[0] == 'h': cerrar(); cur = None; continue
    if not cur: continue
    if x[0] == 'p':
        txt = x[1]; cls = x[2] if len(x) > 2 else ''
        if not cur['cab'] and plain(txt).startswith(('Truco', 'Abjuración', 'Adivinación', 'Conjuración', 'Encantamiento', 'Evocación', 'Ilusión', 'Nigromancia', 'Transmutación')) or (not cur['cab'] and re.match(r'^<i>[^<]*(nivel|Truco)', txt)):
            cur['cab'] = plain(txt); continue
        if cls == 'meta' or re.match(r'^(Tiempo de lanzamiento|Duración):', plain(txt)): cur['meta'].append(txt); continue
        cur['parrafos'].append(txt)
    elif x[0] == 'li':
        cur['parrafos'].append('• ' + (x[1] if len(x) > 1 and isinstance(x[1], str) else ''))
    elif x[0] == 't':
        filas = x[2]
        cur['parrafos'].append(' / '.join(' · '.join(plain(str(cel)) for cel in f[1:]) for f in filas if isinstance(f, list)))
cerrar()
out = []
for s in spells:
    cab = s['cab']
    m = re.match(r'^(Truco de (\w+)|(\w+) de nivel (\d))\s*\(([^)]*)\)', cab)
    if not m:
        print('SIN CABECERA', s['nombre'], cab, file=sys.stderr); continue
    nivel = 0 if m.group(2) else int(m.group(4))
    escuela = (m.group(2) or m.group(3)).capitalize()
    clases = [c.strip() for c in m.group(5).split(',')]
    ritual = 'ritual' in cab.lower()
    meta = plain(' '.join(s['meta']))
    get = lambda k, sig: (re.search(k + r':\s*(.*?)(?=\s*(?:' + sig + r'):|$)', meta) or [None, ''])[1].strip()
    tiempo = get('Tiempo de lanzamiento', 'Alcance|Componentes|Duración')
    alcance = get('Alcance', 'Componentes|Duración')
    comp = get('Componentes', 'Duración')
    dur = get('Duración', 'XXXX')
    texto_p = [plain(p) for p in s['parrafos']]
    mejora = ''
    cuerpo = []
    for p, raw in zip(texto_p, s['parrafos']):
        if re.match(r'^(Con un espacio de conjuro de nivel superior|Mejora de truco)\.', p): mejora = p
        else: cuerpo.append(p)
    texto = '\n'.join(cuerpo)
    tl = texto.lower()
    tirada = ''; salva = ''
    if re.search(r'ataque de conjuro', tl): tirada = 'ataque'
    ms = re.search(r'tirada de salvación de (fuerza|destreza|constitución|inteligencia|sabiduría|carisma)', tl)
    if ms and tirada != 'ataque': tirada = 'salvacion'; salva = ATR[ms.group(1)]
    md = re.search(r'(\d+d\d+(?:\s*\+\s*\d+)?)(\s*(?:\+|más)\s*tu modificador por aptitud mágica)?\s+de daño(?: de)? (\w+)', texto)
    dano = tipo = ''; sumaMod = False
    if md: dano = re.sub(r'\s+', ' ', md.group(1)); tipo = md.group(3); sumaMod = bool(md.group(2))
    cura = ''
    mc = re.search(r'(?:recupera|recuperará|recuperarán|recupere|recuperan)[^.]{0,60}?(\d+d\d+)(\s*(?:\+|más)\s*tu modificador por aptitud mágica)?', tl)
    if mc and not dano: cura = mc.group(1); sumaMod = bool(mc.group(2))
    masNivel = ''
    mm = re.search(r'aumenta en (\d+d\d+) por cada nivel', mejora)
    if mm: masNivel = mm.group(1)
    mitad = bool(re.search(r'mitad (?:de ese |del |de dicho )?daño', tl))
    out.append(dict(nombre=s['nombre'], nivel=nivel, escuela=escuela, clases=clases, ritual=ritual, tiempo=tiempo, alcance=alcance, componentes=comp, duracion=dur,
        conc=dur.lower().startswith('concentración'), texto=texto, mejora=mejora, tirada=tirada, salva=salva, dano=dano, tipo=tipo, cura=cura, sumaMod=sumaMod, masNivel=masNivel, mitad=mitad))
json.dump({'formato': 'mesa-del-dm/conjuros', 'fuente': 'SRD 5.2.1 en español (CC-BY-4.0)', 'conjuros': out}, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'conjuros', file=sys.stderr)
