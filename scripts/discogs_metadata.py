"""Discogs 데이터의 공개 허용 필드와 출처 범위. 제한 데이터는 입력받지 않는다."""
from datetime import datetime,timezone,timedelta
import re

TITLE='Discogs metadata · 공개 기본 정보'
SCHEMA='discogs-public-v1'
INSTRUMENT=re.compile(r'^(?:.*Saxophone|Trumpet|Trombone|Piano|Electric Piano|Organ|Bass|Double Bass|Drums|Percussion|Congas|Bongos|Guitar|Vibraphone|Flute|Clarinet|Tuba|French Horn|Cello|Violin|Vocals)(?:\s*\[.*\])?$',re.I)

def snapshot(master,release,retrieved_at):
    mid=master['id'];rid=release['id']
    if release.get('master_id')!=mid:raise ValueError('Master/Release mismatch')
    master_url='https://www.discogs.com/master/'+str(mid);release_url='https://www.discogs.com/release/'+str(rid)
    tracks=master.get('tracklist') or release.get('tracklist') or []
    origin='MASTER' if master.get('tracklist') else 'RELEASE'
    def flatten(items):
        result=[]
        for row in items:
            result.append({k:str(row.get(k,'') or '') for k in ['position','title','duration','type_']})
            result+=flatten(row.get('sub_tracks',[]))
        return result
    credits=[];credit_origin='MASTER' if master.get('extraartists') else 'RELEASE'
    for person in (master.get('extraartists') or release.get('extraartists') or []):
        for role in re.split(r',\s*(?![^\[]*\])',person.get('role','')):
            if INSTRUMENT.fullmatch(role.strip()):credits.append({'name':person.get('name',''),'instrument':role.strip(),'tracks':person.get('tracks',''),'scope':'explicit_track_positions' if person.get('tracks') else 'release_credit_not_all_tracks','source_type':credit_origin})
    # 원문 Notes의 긴 라이너 노트는 복제하지 않는다. 출처의 짧은 발췌만 표시.
    notes=master.get('notes') or release.get('notes') or ''
    notes=re.sub('<[^>]*>','',notes)
    if len(notes)>1000:notes=notes[:1000]+' … (원문에서 계속)'
    stamp=datetime.fromisoformat(retrieved_at)
    return {'schema':SCHEMA,'master_id':mid,'release_id':rid,'master_url':master_url,'release_url':release_url,
        'retrieved_at':retrieved_at,'expires_at':(stamp+timedelta(hours=6)).isoformat(),
        'title':master.get('title',''),'artists':[a['name'] for a in master.get('artists',[]) if a.get('name')],
        'genres':master.get('genres',[]),'styles':master.get('styles',[]),'year':master.get('year') or None,
        'release_year':release.get('year') or None,'release_country':release.get('country') or None,
        'tracklist':flatten(tracks),'tracklist_source':origin,'credits':credits,'credits_source':credit_origin,
        'notes':notes,'notes_source':'MASTER' if master.get('notes') else 'RELEASE'}

def is_fresh(data,now=None):
    try:
        start=datetime.fromisoformat(data['retrieved_at']);end=datetime.fromisoformat(data['expires_at'])
        now=now or datetime.now(timezone.utc)
        return data['schema']==SCHEMA and start.tzinfo and start<=now<end and end-start==timedelta(hours=6)
    except (ValueError,KeyError,TypeError):return False
