import re,glob,sys,json
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from oklch import oklch
ROOT=sys.argv[1]
def norm(h): h=h.lower(); return ''.join(c*2 for c in h) if len(h)==3 else h
PALE={'ebf3fb','eef6ff','eff6ff','eaf3fb','eef5fc','eaf2fb','f0f7ff','eef4fb','edf5ff','eaf2fa','dce6f0','eef6fd','f0f6ff','eff7ff','eaf2f9','edf4fb','eef5fb','f7fbff','f8fbff'}
def brand(h):
    if norm(h) in PALE: return True
    L,C,H=oklch(norm(h)); return 200<=H<=275 and ((L>=0.85 and C>=0.024) or C>=0.045)
EXCL=re.compile(r'qdoc|tpl-paper|dn-a4|inv-a4|rct-a4|a4-|print|margin-color|margin-status|\.badge|badge-|dot-|-dot\b|so-dot|delivery-state|status-(draft|sent|quoted|premium)|qdoc-status|tone-|rct-pay-pill|rct-status|severity|monitor-item\.(sent|draft|won|lost)|employee-status|expiry-pill|rfq-new|nobid|\.(sent|confirmed|ofd|transit|pending|awaiting|unpaid|credited|voided|inactive)\b',re.I)
used=set(); stats={}
def conv_body(body):
    n=[0]
    def rh(m):
        h=m.group(1)
        if not brand(h): return m.group(0)
        h6=norm(h); used.add(h6); n[0]+=1; return f'var(--c-{h6})'
    def rr(m):
        r,g,b,a=m.group(1),m.group(2),m.group(3),m.group(4)
        h6='%02x%02x%02x'%(int(r),int(g),int(b))
        if not brand(h6): return m.group(0)
        used.add(h6); n[0]+=1
        pct=round(float(a)*100,2)
        return f'color-mix(in srgb, var(--c-{h6}) {pct:g}%, transparent)'
    body=re.sub(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![0-9a-fA-F])',rh,body)
    body=re.sub(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)',rr,body)
    return body,n[0]
def conv_css(s):
    # find @media print block spans to skip
    skip=[]
    for m in re.finditer(r'@media[^{]*print[^{]*\{',s):
        i=m.end(); depth=1
        while depth and i<len(s):
            if s[i]=='{': depth+=1
            elif s[i]=='}': depth-=1
            i+=1
        skip.append((m.start(),i))
    out=[]; last=0; total=0
    for m in re.finditer(r'([^{}]*)\{([^{}]*)\}',s):
        sel=m.group(1); body=m.group(2)
        if any(a<=m.start()<b for a,b in skip) or EXCL.search(re.sub(r'/\*.*?\*/','',sel,flags=re.S)) or '@keyframes' in sel:
            continue
        nb,n=conv_body(body)
        if n:
            out.append(s[last:m.start(2)]); out.append(nb); last=m.end(2); total+=n
    out.append(s[last:]); return ''.join(out),total
files=[f for f in sorted(glob.glob(ROOT+'/css/*.css')) if not f.endswith('theme.css')]
for f in files:
    s=open(f,encoding='utf-8').read(); ns,t=conv_css(s)
    if t: open(f,'w',encoding='utf-8').write(ns); stats[f.split('/')[-1]]=t
# index.html: <style> blocks and style="" attributes
f=ROOT+'/index.html'; s=open(f,encoding='utf-8').read(); tot=0
def rs(m):
    global tot
    ns,t=conv_css(m.group(2)); tot+=t; return m.group(1)+ns+m.group(3)
s=re.sub(r'(<style[^>]*>)(.*?)(</style>)',rs,s,flags=re.S)
def ra(m):
    global tot
    nb,n=conv_body(m.group(2)); tot+=n; return m.group(1)+nb+m.group(3)
s=re.sub(r'(style=")([^"]*)(")',ra,s)
open(f,'w',encoding='utf-8').write(s); stats['index.html']=tot
json.dump(sorted(used|set(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'tokens.json')))) ),open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'tokens.json'),'w'))
print(stats, 'tokens:',len(used))
