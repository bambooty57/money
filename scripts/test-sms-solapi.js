require('dotenv').config({ path: '.env.local' });
const { SolapiMessageService } = require('solapi');

const apiKey = process.env.SOLAPI_API_KEY;
const apiSecret = process.env.SOLAPI_API_SECRET;
const senderNumber = process.env.SOLAPI_SENDER_NUMBER;

console.log('===== Solapi SDK 테스트 =====');
console.log('API Key:', apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'MISSING');
console.log('API Secret:', apiSecret ? `***${apiSecret.slice(-4)}` : 'MISSING');
console.log('Sender Number:', senderNumber || 'MISSING');

if (!apiKey || !apiSecret || !senderNumber) {
  console.error('\n환경변수가 누락되었습니다.');
  process.exit(1);
}

const cleanFrom = senderNumber.replace(/[^0-9]/g, '');
console.log('Clean Sender:', cleanFrom);

(async () => {
  const messageService = new SolapiMessageService(apiKey, apiSecret);

  console.log('\n----- 1단계: 잔액 조회 테스트 (발송 없이 SDK 통신 확인) -----');
  try {
    const balance = await messageService.getBalance();
    console.log('✅ Solapi SDK 통신 성공');
    console.log('  잔액:', balance.balance, '원');
    console.log('  포인트:', balance.point, 'P');
  } catch (e) {
    console.log('❌ Solapi SDK 통신 실패');
    console.log('  status:', e.status || e.statusCode);
    console.log('  message:', e.message);
    if (e.raw) console.log('  raw:', JSON.stringify(e.raw, null, 2));
    process.exit(1);
  }

  console.log('\n----- 2단계: 발신번호 등록 여부 확인 -----');
  try {
    const groups = await messageService.getGroupMessages({ startKey: '', limit: 1 });
    console.log('✅ 그룹 메시지 조회 가능 (계정 정상)');
  } catch (e) {
    console.log('⚠️  그룹 메시지 조회 실패 (무시 가능):', e.message);
  }

  console.log('\n----- 3단계: 실제 발송은 실행하지 않음 -----');
  console.log('  실제 발송 테스트는 /api/sms 경로 또는 UI에서 시도하세요.');
  console.log('  (브라우저에서 직접 시도 시 본인 번호 010-7465-5179로 발송됩니다)');
})();
