"""Public-only Discogs CC0 refresh. No database, credentials or private inputs."""
from datetime import datetime,timezone
from pathlib import Path
import hashlib,json,re,time,urllib.request
from discogs_metadata import snapshot,TITLE

def encode(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2,allow_nan=False)+'\n').encode('utf-8')

def fetch(kind,ident):
    if type(ident) is not int or ident<=0:raise ValueError('invalid public identifier')
    time.sleep(3.2)
    request=urllib.request.Request('https://api.discogs.com/'+kind+'/'+str(ident),headers={'User-Agent':'MY-BLUE-NOTE/1.0 (public CC0 metadata refresh)','Accept':'application/json'})
    with urllib.request.urlopen(request,timeout=40) as response:return json.load(response)

def check(data):
    body=json.dumps(data,ensure_ascii=False)
    if re.search(r'<\s*(script|iframe)|\b[A-Z]:[\\/]|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:password|api[_-]?key|access[_-]?token)\s*[=:]',body,re.I):raise ValueError('public metadata security check failed')
    if any(key in data for key in ['images','community','lowest_price','num_for_sale','user_data']):raise ValueError('restricted data')

def run(root):
    documents={p.relative_to(root).as_posix():json.loads(p.read_text('utf-8')) for p in (root/'data').rglob('*.json')}
    previous=documents['data/version.json']['data_version'];count=0
    for name,doc in sorted(documents.items()):
        if not name.startswith('data/albums/'):continue
        for row in doc.get('records',[]):
            if row['kind']!='album_stories' or row['fields'].get('title',{}).get('value')!=TITLE:continue
            old=json.loads(row['fields']['body']['value'])
            stamp=datetime.now(timezone.utc).isoformat(timespec='seconds')
            master=fetch('masters',old['master_id']);release=fetch('releases',old['release_id'])
            # 검수 식별자를 자동 재매핑하거나 다른 판본과 합치지 않는다.
            if master['id']!=old['master_id'] or release['id']!=old['release_id']:raise ValueError('identifier drift')
            data=snapshot(master,release,stamp);check(data)
            row['fields']['body']['value']=json.dumps(data,ensure_ascii=False,separators=(',',':'))
            row['fields']['body']['checked_on']=stamp[:10];count+=1
    if not count:raise ValueError('no approved metadata to refresh')
    payload=b''.join(n.encode()+b'\0'+encode(d) for n,d in sorted(documents.items()) if n!='data/version.json')
    version='v1-'+hashlib.sha256(payload).hexdigest()[:24]
    documents['data/version.json']['data_version']=version
    output={name:encode(doc) for name,doc in documents.items()}
    index=root/'assets/data/search-index.json';search=json.loads(index.read_text('utf-8'));search['data_version']=version
    output['assets/data/search-index.json']=encode(search)
    for page in root.rglob('*.html'):output[page.relative_to(root).as_posix()]=page.read_bytes().replace(previous.encode(),version.encode())
    # 모든 API 응답과 보안 검사가 끝난 뒤에만 공개 파일 변경. 실패하면 게시하지 않는다.
    for name,body in output.items():(root/name).write_bytes(body)
    print('Refreshed public metadata records:',count)

if __name__=='__main__':run(Path(__file__).resolve().parents[1])
