#!/usr/bin/env python3
"""Lectura de fuentes desde el entorno del proyecto Paula (ver docs/SPEC.md §12).
Uso (siempre con python3 -I):
  fuentes.py sp-buscar "<texto en el título>"      -> lista capítulos StatPearls del corpus local
  fuentes.py sp-leer <archivo.nxml|título exacto> [--seccion Treatment]  -> texto plano del capítulo
  fuentes.py nbk NBK430732 [NBK...]                -> título real (PubMed) de cada NBK
  fuentes.py pubmed <PMID>                          -> resumen en texto
  fuentes.py pmc <PMCID> [--seccion palabra]        -> texto plano del artículo PMC (HTML de pmc.ncbi.nlm.nih.gov; efetch XML no trae el cuerpo de revistas no-OA)
  fuentes.py pmc-buscar "<consulta>"                -> PMCIDs + títulos (máx 10)
  fuentes.py pdf <url>                              -> texto del PDF (curl + pdftotext)
  fuentes.py html <url>                             -> texto plano de la página
  fuentes.py copia <archivo.md> <texto_fuente.txt> [n=10]  -> frases propias con >= n palabras idénticas a la fuente
Corpus StatPearls: $TMPDIR/fuentes/statpearls (crear con extraer_statpearls.py).
"""
import sys,os,re,json,time,html,subprocess,urllib.request,urllib.parse,tempfile
EU='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
SP=os.path.join(os.environ.get('TMPDIR','/tmp'),'fuentes','statpearls')
def IDX():
    p=os.path.join(SP,'indice.tsv')
    return p if os.path.exists(p) else p+'.part'
def get(url,binary=False):
    r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'material-de-estudio-medicina/1.0 (lector automatico de fuentes abiertas)'}),timeout=60).read()
    time.sleep(0.34); return r if binary else r.decode('utf-8','replace')
def plano(xml):
    xml=re.sub(r'(?s)<(script|style|ref-list|table-wrap-foot)[^>]*>.*?</\1>','',xml)
    xml=re.sub(r'</(p|title|sec|li|tr|h\d|div)>','\n',xml)
    t=html.unescape(re.sub(r'<[^>]+>',' ',xml))
    return re.sub(r'[ \t]+',' ',re.sub(r'\n\s*\n+','\n\n',t)).strip()
def seccion(texto,clave):
    if not clave: return texto
    i=texto.lower().find(clave.lower()); return texto[i:i+12000] if i>=0 else '(sección no encontrada)\n'+texto[:3000]
def arg(flag):
    return sys.argv[sys.argv.index(flag)+1] if flag in sys.argv else None
def main():
    c=sys.argv[1] if len(sys.argv)>1 else '-h'; a=sys.argv[2:]
    if c=='sp-buscar':
        q=a[0].lower()
        for l in open(IDX(),encoding='utf-8'):
            f,t=l.rstrip('\n').split('\t',1)
            if q in t.lower(): print(f+'\t'+t)
    elif c=='sp-leer':
        f=a[0]
        if not f.endswith('.nxml'):
            for l in open(IDX(),encoding='utf-8'):
                x,t=l.rstrip('\n').split('\t',1)
                if t.lower()==f.lower(): f=x; break
        print(seccion(plano(open(os.path.join(SP,f),encoding='utf-8').read()),arg('--seccion')))
    elif c=='nbk':
        for n in a:
            ids=json.loads(get(EU+'esearch.fcgi?db=pubmed&retmode=json&term='+n))['esearchresult']['idlist']
            if not ids: print(n+'\tSIN RESULTADO'); continue
            r=json.loads(get(EU+'esummary.fcgi?db=pubmed&retmode=json&id='+ids[0]))['result']
            print(n+'\tPMID '+ids[0]+'\t'+r[ids[0]]['title'])
    elif c=='pubmed':
        print(get(EU+'efetch.fcgi?db=pubmed&rettype=abstract&retmode=text&id='+a[0]))
    elif c=='pmc':
        pid=a[0] if a[0].startswith('PMC') else 'PMC'+a[0]
        h=get('https://pmc.ncbi.nlm.nih.gov/articles/'+pid+'/'); m=re.search(r'(?s)<article.*?</article>',h)
        print(seccion(plano(m.group(0) if m else h),arg('--seccion')))
    elif c=='pmc-buscar':
        q=urllib.parse.urlencode({'db':'pmc','term':a[0],'retmode':'json','retmax':10})
        ids=json.loads(get(EU+'esearch.fcgi?'+q))['esearchresult']['idlist']
        if ids:
            r=json.loads(get(EU+'esummary.fcgi?db=pmc&retmode=json&id='+','.join(ids)))['result']
            for k in r['uids']: print('PMC'+k+'\t'+r[k].get('pubdate','')+'\t'+r[k]['title'])
    elif c=='pdf':
        with tempfile.NamedTemporaryFile(suffix='.pdf',delete=False) as t: t.write(get(a[0],True)); p=t.name
        print(subprocess.run(['pdftotext','-layout',p,'-'],capture_output=True,text=True).stdout); os.unlink(p)
    elif c=='html':
        print(plano(get(a[0])))
    elif c=='copia':
        n=int(a[2]) if len(a)>2 else 10
        norm=lambda s: re.findall(r'\w+',s.lower())
        src=norm(open(a[1],encoding='utf-8').read()); sh={tuple(src[i:i+n]) for i in range(len(src)-n+1)}
        for i,l in enumerate(open(a[0],encoding='utf-8'),1):
            w=norm(l)
            hits=[' '.join(w[j:j+n]) for j in range(len(w)-n+1) if tuple(w[j:j+n]) in sh]
            if hits: print(f'{a[0]}:{i}: {hits[0]}')
    else: print(__doc__)
if __name__=='__main__': main()
