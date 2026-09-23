import sys,json,xml.etree.ElementTree as ET
elements=[]
for _,e in ET.iterparse(sys.argv[1],events=('end',)):
    if e.tag not in ('node','way'): continue
    obj={'type':e.tag,'id':int(e.attrib['id']),'tags':{t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}}
    if e.tag=='node': obj.update(lat=float(e.attrib['lat']),lon=float(e.attrib['lon']))
    else: obj['nodes']=[int(n.attrib['ref']) for n in e.findall('nd')]
    elements.append(obj); e.clear()
ways=[e for e in elements if e['type']=='way' and any(k in e['tags'] for k in ('highway','building','building:part'))]
needed={n for w in ways for n in w['nodes']}
elements=[e for e in elements if e['type']=='node' and e['id'] in needed]+ways
with open(sys.argv[2],'w',encoding='utf-8') as out: json.dump({'elements':elements},out,ensure_ascii=False)
print('OSM XML converted:',len(elements),'elements')
