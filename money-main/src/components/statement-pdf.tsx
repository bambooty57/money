import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

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

// 값 표시 유틸리티 함수
function displayValue(val: any): string {
  if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') {
    return '';
  }
  return String(val);
}

// 텍스트 너비 기반 자동 줄바꿈 함수
function splitTextByWidth(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  if (!text || text.trim() === '') return [''];
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // 단어가 너무 길면 강제로 자르기
        lines.push(word);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [''];
}

// 완전한 PDF 생성 함수 (이전 양식 복원)
export async function generateStatementPdf({ customer, transactions, payments, supplier, title = '거래명세서', printDate, photoUrl }: StatementPdfOptions): Promise<Blob> {
  try {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([842, 595]); // A4 가로 모드 (Landscape)

    // 폰트 로드
  const fontUrl = '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf';
  const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
  const font = await pdfDoc.embedFont(fontBytes);

    // 1. 상단 헤더 (로고, 제목, 출력일) - 가로 모드에 맞게 조정
    const headerY = 550; // 가로 모드에 맞게 y 위치 조정
  
    // 로고 이미지
  try {
    const logoUrl = '/kubotalogo5.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      const logoImg = await pdfDoc.embedPng(logoBytes);
        page.drawImage(logoImg, { x: 50, y: headerY - 20, width: 150, height: 60 });
      }
    } catch (logoError) {
      console.error('로고 로드 실패:', logoError);
    }

    // 제목 (가로 모드에서 중앙에 맞게 조정)
    page.drawText(title, { 
      x: 320, // 가로 모드 중앙으로 이동
      y: headerY, 
      size: 28, 
      font, 
      color: rgb(0,0,0) 
    });
    
    // 출력일 (가로 모드에서 우측으로 이동)
  const today = printDate || `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}`;
    page.drawText(`출력일: ${today}`, { 
      x: 650, // 가로 모드에서 우측으로 이동
      y: headerY, 
      size: 11, 
      font, 
      color: rgb(0.5,0.5,0.5) 
    });
    
    let y = 530; // 가로 모드에 맞게 y 위치 조정
    page.drawLine({ start: {x: 50, y}, end: {x: 792, y}, thickness: 2, color: rgb(0.7,0.7,0.8) });
    y -= 25;
  
  // 2. 고객정보 박스
    const getField = (...fields: string[]) => {
      for (const f of fields) {
        if (customer[f] !== undefined && customer[f] !== null) return customer[f];
      }
      return '';
    };

  const customerTable = [
      ['고객명', displayValue(getField('name', 'customer_name'))],
      ['고객유형', displayValue(getField('customer_type', 'type'))],
      ['주민번호', displayValue(getField('ssn', 'rrn'))],
      ['사업자번호', displayValue(getField('business_no', 'business_number', 'biznum', 'business_reg_no', 'biz_no'))],
      ['휴대폰번호', displayValue(getField('mobile', 'phone', 'mobile_phone', 'cell_phone', 'phone_number'))],
      ['주소', displayValue(getField('address', 'addr', 'road_address', 'road_addr'))],
      ['지번주소', displayValue(getField('jibun_address', 'jibun_addr', 'lot_address', 'old_address', 'jibun', 'lot_addr', 'address_jibun'))]
  ];
  
  const customerBoxX = 60;
  const customerBoxY = y;
  const customerBoxWidth = 350;
  const customerBoxHeight = 126;
  
    // 고객정보 박스 그리기
    page.drawRectangle({
      x: customerBoxX,
      y: customerBoxY - customerBoxHeight,
      width: customerBoxWidth,
      height: customerBoxHeight,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1
    });
    
    // 고객정보 내용 표시
  customerTable.forEach(([k, v], i) => {
    const rowY = customerBoxY - 15 - (i * 15);
      // 라벨
      page.drawText(`${k}:`, { 
        x: customerBoxX + 10, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0.3,0.3,0.3) 
      });
      // 값
      page.drawText(v, { 
        x: customerBoxX + 100, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0,0,0) 
      });
      // 구분선
    if (i < customerTable.length - 1) {
        page.drawLine({ 
          start: {x: customerBoxX + 5, y: rowY - 3}, 
          end: {x: customerBoxX + customerBoxWidth - 5, y: rowY - 3}, 
          thickness: 0.3, 
          color: rgb(0.9,0.9,0.9) 
        });
      }
    });

    // 공급자 정보 박스 (페이지 내에서 배치)
    const supplierBoxX = 450; // 고정 위치로 조정
    const supplierBoxWidth = 292; // 페이지 안에 들어가도록 너비 조정 (842-450-50 = 342, 여유 50)
    
    const supplierTable = [
      ['공급자명', displayValue(supplier?.name || supplier?.company_name || '')],
      ['대표자명', displayValue(supplier?.ceo || supplier?.ceo_name || '')],
      ['사업자번호', displayValue(supplier?.biznum || supplier?.business_no || '')],
      ['전화번호', displayValue(supplier?.phone || '')],
      ['계좌번호', displayValue(supplier?.accounts?.[0] ? `${supplier.accounts[0].bank} ${supplier.accounts[0].number}` : '')],
      ['예금주', displayValue(supplier?.accounts?.[0]?.holder || '')],
      ['주소', displayValue(supplier?.address || '')]
    ];
    
    // 공급자정보 박스 그리기
    page.drawRectangle({
      x: supplierBoxX,
      y: customerBoxY - customerBoxHeight,
      width: supplierBoxWidth,
      height: customerBoxHeight,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1
    });
    
    // 공급자정보 내용 표시
    supplierTable.forEach(([k, v], i) => {
      const rowY = customerBoxY - 15 - (i * 15);
      // 라벨
      page.drawText(`${k}:`, { 
        x: supplierBoxX + 10, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0.3,0.3,0.3) 
      });
      // 값
      page.drawText(v, { 
        x: supplierBoxX + 100, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0,0,0) 
      });
      // 구분선
      if (i < supplierTable.length - 1) {
        page.drawLine({ 
          start: {x: supplierBoxX + 5, y: rowY - 3}, 
          end: {x: supplierBoxX + supplierBoxWidth - 5, y: rowY - 3}, 
          thickness: 0.3, 
          color: rgb(0.9,0.9,0.9) 
        });
      }
    });

    y -= customerBoxHeight + 30;

    // 3. 거래명세서 표 (헤더를 데이터 위치에 맞게 조정)
    const headers = ['#', '일자', '거래명', '기종/모델', '비고', '매출', '입금', '잔액'];
    const colWidths = [35, 90, 120, 120, 90, 90, 90, 107]; // 총 742px (페이지 안에 맞게 조정)
    const tableStartX = 50;
  const tableWidth = colWidths.reduce((a,b)=>a+b,0);
    
    // 테이블 헤더 배경
    page.drawRectangle({
      x: tableStartX,
      y: y - 20,
      width: tableWidth,
      height: 20,
      color: rgb(0.9, 0.95, 1.0),
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1
    });
    
    // 헤더 텍스트
    let headerX = tableStartX;
    headers.forEach((header, i) => {
      page.drawText(header, {
        x: headerX + 5,
        y: y - 15,
        size: 10,
        font,
        color: rgb(0,0,0)
      });
      headerX += colWidths[i];
    });
    
    y -= 20;
    
    // 거래 데이터 행 (기존 로직 사용)
    transactions.forEach((tx, idx) => {
      const rowHeight = 20;
      
      // 행 배경 (홀수/짝수 구분)
      if (idx % 2 === 0) {
        page.drawRectangle({
          x: tableStartX,
          y: y - rowHeight,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98)
        });
      }
      
      // 행 테두리
      page.drawRectangle({
        x: tableStartX,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.5
      });
      
      // 기존 로직 사용: 거래별 입금액과 잔액 계산
      const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const unpaid = (tx.amount || 0) - paid;
      
      // 디버그 정보 출력
      console.log(`거래 ${idx + 1}: 매출=${tx.amount}, 입금=${paid}, 잔액=${unpaid}`);
      
      // 셀 데이터 (정확한 컬럼 배치)
      const rowData = [
        String(idx + 1),                          // # 컬럼
        tx.created_at?.slice(0, 10) || '',        // 일자 컬럼
        tx.type || '',                            // 거래명 컬럼
        `${tx.model || tx.models_types?.model || ''}${(tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : ''}${tx.model_type || tx.models_types?.type || ''}`, // 기종/모델 컬럼
        tx.description || tx.notes || tx.note || '', // 비고 컬럼
        (tx.amount || 0).toLocaleString(),        // 매출 컬럼 (매출액)
        paid.toLocaleString(),                    // 입금 컬럼 (입금액)
        unpaid.toLocaleString()                   // 잔액 컬럼 (잔액)
      ];
      
      // 헤더와 동일한 방식으로 위치 계산
      let cellX = tableStartX;
      rowData.forEach((cellData, cellIdx) => {
        // 텍스트 정렬 (금액은 우측, 나머지는 좌측)
        const isAmount = cellIdx >= 5; // 금액 관련 컬럼
        const textX = isAmount ? cellX + colWidths[cellIdx] - 10 : cellX + 5;
        
        page.drawText(cellData, {
          x: textX,
          y: y - 15,
          size: 9,
          font,
          color: rgb(0,0,0)
        });
        
        cellX += colWidths[cellIdx]; // 헤더와 동일한 방식
      });
      
      y -= rowHeight;
      
      // 입금내역 표시 (기존 방식으로 간단하게)
      if (Array.isArray(tx.payments) && tx.payments.length > 0) {
        tx.payments.forEach((payment: any) => {
          const paymentHeight = 15;
          
          // 입금행 배경
          page.drawRectangle({
            x: tableStartX,
            y: y - paymentHeight,
            width: tableWidth,
            height: paymentHeight,
            color: rgb(0.95, 0.98, 1.0),
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 0.5
          });
          
          // 입금 정보 (기존 형태로)
          const paymentInfo = `      └ ${payment.paid_at?.slice(0, 10) || ''} ${payment.method || ''} ${(payment.amount || 0).toLocaleString()}원 (${payment.payer_name || ''})`;
          page.drawText(paymentInfo, {
            x: tableStartX + 5,
            y: y - 12,
            size: 8,
            font,
            color: rgb(0.2, 0.2, 0.8)
          });
          
          y -= paymentHeight;
        });
      }
    });
    
    // 합계 행 (기존 로직 사용)
    y -= 10;
    
    // 기존 방식으로 합계 계산
    const summary = {
      total_amount: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      total_paid: transactions.reduce((sum, tx) => {
        const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        return sum + paid;
      }, 0),
      total_unpaid: transactions.reduce((sum, tx) => {
        const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const unpaid = (tx.amount || 0) - paid;
        return sum + unpaid;
      }, 0)
    };
    
    page.drawRectangle({
      x: tableStartX,
      y: y - 25,
      width: tableWidth,
      height: 25,
      color: rgb(0.9, 0.9, 0.9),
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1
    });
    
    // 합계 텍스트
    const summaryLabelStart = tableStartX + colWidths.slice(0, 4).reduce((sum, width) => sum + width, 0);
    page.drawText('합계', {
      x: summaryLabelStart + 5,
      y: y - 18,
      size: 11,
      font,
      color: rgb(0,0,0)
    });
    
    // 합계 금액들
    const summaryAmounts = [
      { value: summary.total_amount.toLocaleString(), index: 5 },
      { value: summary.total_paid.toLocaleString(), index: 6 },
      { value: summary.total_unpaid.toLocaleString(), index: 7 }
    ];
    
    summaryAmounts.forEach(({ value, index }) => {
      const columnStart = tableStartX + colWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
      page.drawText(value, {
        x: columnStart + colWidths[index] - 10,
        y: y - 18,
        size: 10,
        font,
        color: rgb(0,0,0)
      });
    });
    
    y -= 50;
    
    // 고객 확인 서명란 (테이블 너비에 맞게 조정)
    const confirmBoxHeight = 80;
    page.drawRectangle({
      x: 50,
      y: y - confirmBoxHeight,
      width: tableWidth, // 테이블과 동일한 너비
      height: confirmBoxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1
    });
    
    page.drawText('위 거래내용이 틀림없음을 확인하며 잔액에 대하여                      년                      월                      일까지  완납하겠음을 확인합니다', {
      x: 70,
      y: y - 25,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2)
    });
    
    const confirmY = y - 50;
    const confirmText = `년        월        일        확인자:                     (서명)`;
    const confirmWidth = font.widthOfTextAtSize(confirmText, 11);
    const confirmX = (tableWidth - confirmWidth) / 2 + tableStartX; // 테이블 너비에 맞게 중앙 정렬
    page.drawText(confirmText, { x: confirmX, y: confirmY, size: 11, font, color: rgb(0.2,0.2,0.2) });
  
  // PDF 저장
  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  } catch (err) {
    console.error('PDF 생성 중 오류:', err);
    throw err;
  }
}

// @react-pdf/renderer 컴포넌트 제거 - React 19 호환성 문제로 pdf-lib만 사용 