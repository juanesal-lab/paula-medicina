import tarfile,re,sys,os,urllib.request,html
dest=sys.argv[1]; url=sys.argv[2]
idx=open(os.path.join(dest,'indice.tsv.part'),'w',encoding='utf-8')
req=urllib.request.Request(url)
n=0
with urllib.request.urlopen(req) as r, tarfile.open(fileobj=r,mode='r|gz') as t:
    for m in t:
        b=os.path.basename(m.name)
        if not b.endswith('.nxml') or b.startswith('nurse'): continue
        s=t.extractfile(m).read()
        open(os.path.join(dest,b),'wb').write(s)
        txt=s.decode('utf-8','replace')
        ttl=re.search(r'<title>(.*?)</title>',txt,re.S)
        idx.write(b+'\t'+html.unescape(re.sub(r'<[^>]+>','',ttl.group(1)).strip() if ttl else '')+'\n'); n+=1
idx.close(); os.replace(os.path.join(dest,'indice.tsv.part'),os.path.join(dest,'indice.tsv'))
print('articulos',n)
