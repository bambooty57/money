# 📝 기종/모델 추가 기능 구현 규칙

## 1. 데이터 흐름 및 동작 방식
- **입력값**: 사용자는 기종명(newModel), 형식명(newType)을 입력한다.
- **API 호출**: `/api/models-types` 엔드포인트에 POST 요청을 보낸다.
  - Content-Type: application/json
  - body: `{ model: newModel, type: newType }`
- **응답 처리**:
  - 성공 시: 입력값 초기화, "추가 완료" 메시지 표시, onChange 콜백 호출
  - 실패 시: "추가 실패" 메시지 표시
- **실시간 동기화**: useModelTypesRealtime 훅을 통해 Supabase 실시간 구독으로 DB 변경 즉시 UI에 반영된다.

## 2. 코드 패턴 (예시)
```typescript
async function handleAdd() {
  if (!newModel || !newType) return setMsg('기종명/형식명을 모두 입력하세요');
  const res = await fetch('/api/models-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: newModel, type: newType })
  });
  if (res.ok) {
    setNewModel(''); setNewType(''); setMsg('추가 완료');
    if (onChange) onChange(data.id);
  } else {
    setMsg('추가 실패');
  }
}
```

## 3. 핵심 규칙
- **RESTful API**: POST 방식, JSON body
- **입력값 검증**: 두 필드 모두 필수
- **성공/실패 메시지**: 사용자에게 즉시 피드백
- **onChange 콜백**: 외부 연동 및 상태 갱신
- **Supabase 실시간 구독**: DB 변경 즉시 UI 반영 (캐싱/지연 없음)

## 4. 적용 목적
- 이 규칙은 기종/모델 추가 기능의 정상 동작 방식을 정의하며, 수정/삭제 기능 오류 해결 시 동일한 패턴을 적용하는 기준이 된다. 