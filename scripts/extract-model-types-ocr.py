import re
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .env.local에서 환경변수 로드
load_dotenv('.env.local')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 주어진 텍스트 데이터
RAW_DATA = '''
B2320 (형식명) - 기종: 트랙터
L45SV (형식명) - 기종: 트랙터
L45SV-OC (형식명) - 기종: 트랙터
L47H (형식명) - 기종: 트랙터
L47H-OC (형식명) - 기종: 트랙터
L47K (형식명) - 기종: 트랙터
L47K-OC (형식명) - 기종: 트랙터
L55H (형식명) - 기종: 트랙터
L55H-OC (형식명) - 기종: 트랙터
L55K (형식명) - 기종: 트랙터
L55K-OC (형식명) - 기종: 트랙터
L55C (형식명) - 기종: 트랙터
L62K (형식명) - 기종: 트랙터
L62K-OC (형식명) - 기종: 트랙터
L62C (형식명) - 기종: 트랙터
MR627 (형식명) - 기종: 트랙터
MR677 (형식명) - 기종: 트랙터
MR737 (형식명) - 기종: 트랙터
MR877 (형식명) - 기종: 트랙터
MR907 (형식명) - 기종: 트랙터
MR1057 (형식명) - 기종: 트랙터
MR1157H (형식명) - 기종: 트랙터
MR1157HA (형식명) - 기종: 트랙터
M7400 (형식명) - 기종: 트랙터
M7361 (형식명) - 기종: 트랙터
M5-1141 (형식명) - 기종: 트랙터
M5E1151 (형식명) - 기종: 트랙터
M6-1131 (형식명) - 기종: 트랙터
M6-1431 (형식명) - 기종: 트랙터
M7-7154H (형식명) - 기종: 트랙터
M7-7174H (형식명) - 기종: 트랙터
ER575K (형식명) - 기종: 콤바인
ER575KC (형식명) - 기종: 콤바인
ER575KO (형식명) - 기종: 콤바인
ER610K (형식명) - 기종: 콤바인
ER613KO (형식명) - 기종: 콤바인
ZR6130 (형식명) - 기종: 콤바인
ZR7130 (형식명) - 기종: 콤바인
ZHW600 (형식명) - 기종: 벼이삭수집
KPW4 (형식명) - 기종: 이앙기
KND6 (형식명) - 기종: 이앙기
KNW6F (형식명) - 기종: 이앙기
KNW6FS (형식명) - 기종: 이앙기
KNW6L (형식명) - 기종: 이앙기
KNW6R (형식명) - 기종: 이앙기
KNW6S (형식명) - 기종: 이앙기
KNW6FS-GS (형식명) - 기종: 이앙기
KNW6L-GS (형식명) - 기종: 이앙기
KNW6R-GS (형식명) - 기종: 이앙기
KNW6S-GS (형식명) - 기종: 이앙기
KNW8F (형식명) - 기종: 이앙기
KNW8FS (형식명) - 기종: 이앙기
KNW8FS-GS (형식명) - 기종: 이앙기
KNW10F-GS (형식명) - 기종: 이앙기
HSY-6 (형식명) - 기종: 농업살포기
HSY-6S (형식명) - 기종: 농업살포기
NDS-80F (형식명) - 기종: 농업살포기
NDS-80F-KR (형식명) - 기종: 농업살포기
KNGN-3M7C (형식명) - 기종: 성분산포기
CS-30 (형식명) - 기종: 약제살포기
CS-100 (형식명) - 기종: 약제살포기
콤비이식기 (형식명) - 기종: 콤비이식기
양변탑농무료제초기 (형식명) - 기종: 양변탑농무료제초기
TMS300 (형식명) - 기종: KBT(부분식)
TABOON (형식명) - 기종: KBT(부분식)
FTN800-S (형식명) - 기종: KBT(부분식)
RB700-K (사사키) (형식명) - 기종: 로우터
SZ-700K (텐션) (형식명) - 기종: 로우터
M2200(진흥) (형식명) - 기종: 로우터
L4004A (스기노) (형식명) - 기종: 그레이더
L3001A (스기노) (형식명) - 기종: 그레이더
WC2580S (스기노) (형식명) - 기종: 제어균평기
K2B302C (스기노) (형식명) - 기종: 고속경운기
K1B45C (스기노) (형식명) - 기종: 고속경운기
R144BAC (스기노) (형식명) - 기종: 고속경운기
NP237M (형식명) - 기종: 정지기
WC600D (스기명) (형식명) - 기종: 승용관리기
TM750D (스기노) (형식명) - 기종: 승용관리기
MGA-970B-KR (형식명) - 기종: 배부수확기
MGA-982B-KR (형식명) - 기종: 배부수확기
BSA500E-KR (형식명) - 기종: 제초기
BSA600E-KR (형식명) - 기종: 제초기
BSA601CEGE-KR (형식명) - 기종: 제초기
BSA951CE-KR (형식명) - 기종: 제초기
BSA-2000CE(CA)-KR (형식명) - 기종: 제초기
EMV-1200 (형식명) - 기종: 다목적SSI
SSA-V1002CT-DX (형식명) - 기종: 벼이삭SSI
SSA-V-2A(미쇼) (형식명) - 기종: 벼이삭SSI
KPA (형식명) - 기종: KPA
TC-110J (형식명) - 기종: 전경기(디우)
DDE-12KR (형식명) - 기종: 퇴비살포기
KHR7Y (형식명) - 기종: 퇴비살포기
U-10-5 (형식명) - 기종: 퇴비살포기
HN1253D (형식명) - 기종: 마늘(사사키)
NC1255 (형식명) - 기종: 마늘(사사키)
TXZ45T-4D (형식명) - 기종: 고바시
TXZ45T-4L (형식명) - 기종: 고바시
TXZ50ST-4L (형식명) - 기종: 고바시
TXZ55T-4L (형식명) - 기종: 고바시
TXZ62ST-4L (형식명) - 기종: 고바시
'''

# (형식명) - 기종: ... 패턴 추출
pattern = re.compile(r'([A-Za-z0-9\-()]+) \(형식명\) - 기종: ([^\n]+)')
model_type_pairs = set(pattern.findall(RAW_DATA))

print(f'총 {len(model_type_pairs)}개 (형식명, 기종) 쌍 추출됨:')
for type_, model in model_type_pairs:
    print(f'{type_} / {model}')

# Supabase DB에 저장 (중복 방지)
for type_, model in model_type_pairs:
    # 이미 존재하는지 확인
    exists = supabase.table('models_types').select('id').eq('model', model).eq('type', type_).execute()
    if not exists.data:
        supabase.table('models_types').insert({
            'model': model,
            'type': type_,
        }).execute() 