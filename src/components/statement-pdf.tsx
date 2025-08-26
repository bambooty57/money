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

// @react-pdf/renderer 컴포넌트 제거 - React 19 호환성 문제로 pdf-lib만 사용 