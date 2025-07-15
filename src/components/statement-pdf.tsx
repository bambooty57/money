import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Document, Page, Text, View, Font } from '@react-pdf/renderer';

// NotoSansKR 폰트 등록
Font.register({
  family: 'NotoSansKR',
  src: '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf'
});

export interface StatementPdfOptions {
  customer: any;
  transactions: any[]; // 거래명세서 표에 들어갈 데이터(여러 건)
  payments: any[]; // 입금내역
  supplier: any;
  title?: string;
  printDate?: string;
  photoUrl?: string; // 고객 사진 URL 추가
}

// 유틸: 셀 내 텍스트 줄바꿈(셀 너비, 폰트, 폰트크기, 최대줄수)
function wrapText(text: string, font: any, fontSize: number, maxWidth: number, maxLines: number = 3): string[] {
  if (!text) return [''];
  const words = String(text).split(/\s+/);
  let lines: string[] = [];
  let current = '';
  for (let word of words) {
    const test = current ? current + ' ' + word : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.length > 0) {
    // 마지막 줄 ... 처리
    let last = lines[maxLines - 1];
    while (font.widthOfTextAtSize(last + '...', fontSize) > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + '...';
  }
  return lines;
}

// 레거시 PDF 생성 함수 (pdf-lib 기반)
export async function generateStatementPdf({ customer, transactions, payments, supplier, title = '거래명세서', printDate, photoUrl }: StatementPdfOptions): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  let page = pdfDoc.addPage([595, 842]); // A4
  const fontUrl = '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf';
  const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
  const font = await pdfDoc.embedFont(fontBytes);
  let y = 780;
  
  // 1. 상단 로고/제목/출력일
  try {
    const logoUrl = '/kubotalogo5.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      const logoImg = await pdfDoc.embedPng(logoBytes);
      page.drawImage(logoImg, { x: 50, y: y - 20, width: 150, height: 60 });
    }
  } catch {}
  
  page.drawText(title, { x: 220, y, size: 28, font, color: rgb(0,0,0) });
  const today = printDate || `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}`;
  page.drawText(`출력일: ${today}`, { x: 420, y, size: 11, font, color: rgb(0.5,0.5,0.5) });
  y -= 40;
  
  // 2. 고객정보 박스
  const customerTable = [
    ['고객명', customer.name || ''],
    ['고객유형', customer.customer_type || ''],
    ['주민번호', customer.ssn || ''],
    ['사업자번호', customer.business_no || ''],
    ['휴대폰번호', customer.mobile || customer.phone || ''],
    ['주소', customer.address || ''],
    ['지번주소', customer.address_jibun || '']
  ];
  
  const customerBoxX = 60;
  const customerBoxY = y;
  const customerBoxWidth = 350;
  const customerBoxHeight = 126;
  
  // 고객정보 박스
  page.drawRectangle({ x: customerBoxX, y: customerBoxY - customerBoxHeight, width: customerBoxWidth, height: customerBoxHeight, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
  customerTable.forEach(([k, v], i) => {
    const rowY = customerBoxY - 15 - (i * 15);
    page.drawText(`${k}:`, { x: customerBoxX + 10, y: rowY, size: 9, font, color: rgb(0.3,0.3,0.3) });
    page.drawText(v, { x: customerBoxX + 100, y: rowY, size: 9, font, color: rgb(0,0,0) });
    if (i < customerTable.length - 1) {
      page.drawLine({ start: {x: customerBoxX + 5, y: rowY - 3}, end: {x: customerBoxX + customerBoxWidth - 5, y: rowY - 3}, thickness: 0.3, color: rgb(0.9,0.9,0.9) });
    }
  });
  
  y -= customerBoxHeight + 75;
  
  // 3. 거래명세서 표
  const headers = ['#', '일자', '거래명', '기종/모델', '대변(매출)', '차변(입금)', '잔액', '비고'];
  const colWidths = [28, 48, 70, 90, 80, 80, 80, 140];
  const tableWidth = colWidths.reduce((a,b)=>a+b,0);
  const baseRowHeight = 32;
  const rowCount = Math.max(transactions.length, 1);
  const tableHeight = baseRowHeight * (rowCount + 2);
  
  page.drawRectangle({ x: customerBoxX, y: y, width: tableWidth, height: -tableHeight, borderColor: rgb(0.2,0.4,0.8), borderWidth: 2 });
  y -= tableHeight;
  
  // 합계 계산
  const summary = {
    total_amount: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
    total_paid: transactions.reduce((sum, tx) => sum + (tx.paid_amount || 0), 0),
    total_unpaid: transactions.reduce((sum, tx) => sum + (tx.unpaid_amount || 0), 0),
  };
  
  // PDF 저장
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// 거래명세서 PDF 테이블 컴포넌트 (react-pdf) - 안전한 버전
interface StatementPDFTableProps {
  transactions: any[];
  customer: any;
  supplier: any;
  title?: string;
  printDate?: string;
}

export function StatementPDFTable({ transactions = [], customer, supplier, title = '거래명세서', printDate }: StatementPDFTableProps) {
  // 합계 계산
  const summary = {
    total_amount: transactions.reduce((sum, tx) => sum + (tx.매출액 || tx.amount || 0), 0),
    total_paid: transactions.reduce((sum, tx) => sum + (tx.입금액 || tx.paid_amount || 0), 0),
    total_unpaid: transactions.reduce((sum, tx) => sum + (tx.잔액 || tx.unpaid_amount || 0), 0),
  };
  
  // 실제 공급자 정보
  const supplierInfo = {
    company_name: '구보다농기계영암대리점',
    ceo_name: '정현목',
    business_no: '743-39-01106',
    address: '전남 영암군 군서면 녹암대동보길184',
    phone: '010-2602-3276',
    account: '농협 302-2602-3276-61 (정현목)'
  };
  
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={{ padding: 20, fontFamily: 'NotoSansKR' }}>
        {/* 제목 - 한 줄 전체 가운데 정렬 */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontSize: 18, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontSize: 10 }}>{'출력일: ' + (printDate || new Date().toLocaleDateString())}</Text>
        </View>
        
        {/* 고객정보와 공급자정보 나란히 배치, 내부 2열 구조 */}
        <View style={{ flexDirection: 'row', marginBottom: 15 }}>
          {/* 고객 정보 */}
          <View style={{ flex: 1, backgroundColor: '#f0f8ff', padding: 10 }}>
            <Text style={{ fontSize: 12, marginBottom: 8 }}>고객 정보</Text>
            <View style={{ flexDirection: 'row' }}>
              {/* 1열 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>고객명: {customer?.name || '-'}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>고객유형: {customer?.customer_type || '-'}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>휴대폰: {customer?.mobile || customer?.phone || '-'}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>사업자번호: {customer?.business_no || '-'}</Text>
              </View>
              {/* 2열 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>주민번호: {customer?.ssn || '-'}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>주소: {customer?.address || '-'}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>지번주소: {customer?.address_jibun || '-'}</Text>
              </View>
            </View>
          </View>
          
          {/* 공급자 정보 */}
          <View style={{ flex: 1, backgroundColor: '#f0fff0', padding: 10 }}>
            <Text style={{ fontSize: 12, marginBottom: 8 }}>공급자 정보</Text>
            <View style={{ flexDirection: 'row' }}>
              {/* 1열 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>상호: {supplierInfo.company_name}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>대표자: {supplierInfo.ceo_name}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>전화: {supplierInfo.phone}</Text>
              </View>
              {/* 2열 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>사업자번호: {supplierInfo.business_no}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>주소: {supplierInfo.address}</Text>
                <Text style={{ fontSize: 9, marginBottom: 4 }}>계좌: {supplierInfo.account}</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* 테이블 헤더 (width px 단위로 변경) */}
        <View style={{ flexDirection: 'row', backgroundColor: '#e1f5fe', padding: 5 }}>
          <Text style={{ width: 40, fontSize: 9 }}>#</Text>
          <Text style={{ width: 80, fontSize: 9 }}>일자</Text>
          <Text style={{ width: 110, fontSize: 9 }}>거래명</Text>
          <Text style={{ width: 180, fontSize: 9 }}>기종/모델</Text>
          <Text style={{ width: 110, fontSize: 9 }}>매출액</Text>
          <Text style={{ width: 110, fontSize: 9 }}>입금액</Text>
          <Text style={{ width: 110, fontSize: 9 }}>잔액</Text>
          <Text style={{ width: 140, fontSize: 9 }}>비고</Text>
        </View>
        
        {/* 거래 데이터 */}
        {transactions && transactions.length === 0 ? (
          <View style={{ flexDirection: 'row', padding: 10 }}>
            <Text style={{ fontSize: 9 }}>데이터 없음</Text>
          </View>
        ) : (
          transactions && transactions.map((tx, idx) => (
            <View key={`tx-${idx}`}>
              {/* 거래 메인 행 (width px 단위로 변경) */}
              <View style={{ flexDirection: 'row', padding: 5, backgroundColor: '#fff5f5' }}>
                <Text style={{ width: 40, fontSize: 9 }}>{idx + 1}</Text>
                <Text style={{ width: 80, fontSize: 9 }}>{tx.거래일 || tx.created_at?.slice(0, 10) || ''}</Text>
                <Text style={{ width: 110, fontSize: 9 }}>{tx.거래유형 || tx.type || ''}</Text>
                <Text style={{ width: 180, fontSize: 9 }}>{(tx.기종 || tx.model || tx.models_types?.model || '') + ((tx.기종 || tx.model || tx.models_types?.model) && (tx.모델 || tx.model_type || tx.models_types?.type) ? '/' : '') + (tx.모델 || tx.model_type || tx.models_types?.type || '')}</Text>
                <Text style={{ width: 110, fontSize: 9 }}>{(tx.매출액 || tx.amount || 0).toLocaleString()}</Text>
                <Text style={{ width: 110, fontSize: 9 }}>{(tx.입금액 || tx.paid_amount || 0).toLocaleString()}</Text>
                <Text style={{ width: 110, fontSize: 9 }}>{(tx.잔액 || tx.unpaid_amount || 0).toLocaleString()}</Text>
                <Text style={{ width: 140, fontSize: 9 }}>{tx.description || tx.notes || tx.note || ''}</Text>
              </View>
              {/* 입금내역 */}
              {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
                <View>
                  {/* 입금 헤더 - Place '비고' immediately after '상세' */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#e3f2fd', padding: 3 }}>
                    <Text style={{ width: 60, fontSize: 8 }}>입금일</Text>
                    <Text style={{ width: 80, fontSize: 8 }}>금액</Text>
                    <Text style={{ width: 80, fontSize: 8 }}>방법</Text>
                    <Text style={{ width: 80, fontSize: 8 }}>입금자</Text>
                    {/* Reduce width for 상세 and 비고, and remove marginRight for 상세 */}
                    <Text style={{ width: 90, fontSize: 8, marginRight: 0, paddingRight: 0 }}>상세</Text>
                    <Text style={{ width: 60, fontSize: 8, marginLeft: 0, paddingLeft: 0 }}>비고</Text>
                  </View>
                  {tx.payments.map((payment: any, payIdx: number) => (
                    <View key={`pay-${idx}-${payIdx}`} style={{ flexDirection: 'row', padding: 3, backgroundColor: '#f8f9fa' }}>
                      <Text style={{ width: 60, fontSize: 8 }}>{payment.paid_at?.slice(0, 10) || ''}</Text>
                      <Text style={{ width: 80, fontSize: 8 }}>{(payment.amount || 0).toLocaleString()}</Text>
                      <Text style={{ width: 80, fontSize: 8 }}>{payment.method || ''}</Text>
                      <Text style={{ width: 80, fontSize: 8 }}>{payment.payer_name || ''}</Text>
                      <Text style={{ width: 90, fontSize: 8, marginRight: 0, paddingRight: 0 }}>{payment.method === '현금'
                        ? `장소:${payment.cash_place||''} 수령:${payment.cash_receiver||''}`
                        : payment.method === '계좌이체'
                          ? `계좌:${payment.account_number||''} (${payment.account_holder||''})`
                          : payment.detail || ''}</Text>
                      <Text style={{ width: 60, fontSize: 8, marginLeft: 0, paddingLeft: 0 }}>{[
                        payment.bank_name, 
                        payment.account_number, 
                        payment.account_holder, 
                        payment.cash_place, 
                        payment.cash_receiver, 
                        payment.detail, 
                        payment.note
                      ].filter(Boolean).join(' / ')}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', backgroundColor: '#f8f9fa', padding: 3 }}>
                  <Text style={{ width: 110, fontSize: 8 }}></Text>
                  <Text style={{ width: 470, fontSize: 8 }}>입금없음</Text>
                </View>
              )}
            </View>
          ))
        )}
        
        {/* 합계 행 (가운데 정렬, 항목 간 간격 넓힘) */}
        <View style={{ flexDirection: 'row', backgroundColor: '#f3e5f5', padding: 12, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ width: 180, fontSize: 12 }}>합계</Text>
          <Text style={{ width: 160, fontSize: 12 }}>매출액: {summary.total_amount.toLocaleString()}</Text>
          <Text style={{ width: 160, fontSize: 12 }}>입금액: {summary.total_paid.toLocaleString()}</Text>
          <Text style={{ width: 160, fontSize: 12 }}>잔액: {summary.total_unpaid.toLocaleString()}</Text>
        </View>
        
        {/* 고객 서명란 - 순서: 일자 → 고객서명 */}
        <View style={{ marginTop: 25, marginBottom: 20 }}>
          <View style={{
            height: 80,
            backgroundColor: '#fafafa',
            padding: 15
          }}>
            <Text style={{ fontSize: 11, color: '#333', marginBottom: 10, textAlign: 'center' }}>
              위 거래명세서의 내용을 확인하였으며, 이에 동의합니다.
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 15, justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, color: '#666', letterSpacing: 8 }}>
                {/* '년', '월', '일' 사이에 em space(\u2003) 3개씩 추가 */}
                2025년 0 0 월 0 0 일   고객 서명: _______________________
              </Text>
            </View>
          </View>
        </View>
        
        {/* 페이지 번호 - 항상 하단 중앙 고정, 여러 페이지 지원 */}
        <Text
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 9,
            color: '#666',
          }}
          render={({ pageNumber, totalPages }) => `- ${pageNumber}/${totalPages} -`}
        />
      </Page>
    </Document>
  );
} 