import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface StatementPdfOptions {
  customer: any;
  transactions: any[]; // 거래명세서 표에 들어갈 데이터(여러 건)
  payments: any[]; // 입금내역
  supplier: any;
  title?: string;
  printDate?: string;
}

export async function generateStatementPdf({ customer, transactions, payments, supplier, title = '거래명세서', printDate }: StatementPdfOptions): Promise<Blob> {
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
  // 2. 고객정보 박스 (간단화)
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
  // 3. 거래명세서 표 (여러 건)
  const headers = ['일자', '거래명', '기종/모델', '대변(매출)', '차변(입금)', '잔액', '비고'];
  const colWidths = [60, 60, 100, 70, 70, 70, 70];
  let colX = customerBoxX;
  const tableWidth = colWidths.reduce((a,b)=>a+b,0);
  // 헤더 배경 및 border
  colX = customerBoxX;
  headers.forEach((header, i) => {
    // 셀 배경
    page.drawRectangle({ x: colX, y: y, width: colWidths[i], height: 22, color: rgb(0.96,0.98,1), borderColor: rgb(0.7,0.7,0.8), borderWidth: 1 });
    // 컬럼명
    page.drawText(header, { x: colX + 6, y: y + 6, size: 11, font: font, color: rgb(0.15,0.2,0.4) });
    colX += colWidths[i];
  });
  y -= 22;
  // 합계 계산
  const summary = {
    total_amount: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
    total_paid: transactions.reduce((sum, tx) => sum + (tx.paid_amount || 0), 0),
    total_unpaid: transactions.reduce((sum, tx) => sum + (tx.unpaid_amount || 0), 0),
  };
  transactions.forEach((tx, idx) => {
    colX = customerBoxX;
    // 데이터 행 border
    let rowY = y;
    for (let i = 0; i < headers.length; i++) {
      page.drawRectangle({ x: colX, y: rowY, width: colWidths[i], height: 24, color: rgb(1,1,1), borderColor: rgb(0.85,0.9,1), borderWidth: 0.7 }); // 기존 height: 20 → 24
      colX += colWidths[i];
    }
    // 데이터 행 텍스트
    colX = customerBoxX;
    const row = [
      tx.created_at?.slice(0,10) || '',
      tx.type || '',
      (tx.model || tx.models_types?.model || '') + ((tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : '') + (tx.model_type || tx.models_types?.type || ''),
      tx.amount?.toLocaleString() || '',
      (tx.paid_amount||0).toLocaleString(),
      (tx.unpaid_amount||0).toLocaleString(),
      tx.note || ''
    ];
    row.forEach((cell, i) => {
      let color = rgb(0,0,0);
      let useBold = false;
      let alignX = colX + 6;
      if (i === 3) { color = rgb(0.8,0.1,0.1); useBold = true; alignX = colX + colWidths[i] - 8 - font.widthOfTextAtSize(cell, 11); }
      if (i === 4) { color = rgb(0.1,0.2,0.8); useBold = true; alignX = colX + colWidths[i] - 8 - font.widthOfTextAtSize(cell, 11); }
      if (i === 5) { color = rgb(0.8,0.6,0.1); useBold = true; alignX = colX + colWidths[i] - 8 - font.widthOfTextAtSize(cell, 11); }
      if (i === 0 || i === 1 || i === 2 || i === 6) alignX = colX + 6;
      page.drawText(cell, { x: alignX, y: rowY + 8, size: 11, font: useBold ? font : font, color }); // 기존 y+6 → y+8
      colX += colWidths[i];
    });
    y -= 24; // 기존 20 → 24
    // 입금내역 하위 표 (웹 Table과 동일하게, border/배경/정렬/컬러)
    colX = customerBoxX + 10;
    if (Array.isArray(tx.payments) && tx.payments.length > 0) {
      // 하위 표 헤더
      const paymentHeaders = ['입금일', '금액', '입금방법', '입금자', '비고'];
      const paymentColWidths = [70, 80, 80, 80, 180];
      let paymentY = y;
      let paymentX = colX;
      paymentHeaders.forEach((h, i) => {
        page.drawRectangle({ x: paymentX, y: paymentY, width: paymentColWidths[i], height: 20, color: rgb(0.93,0.97,1), borderColor: rgb(0.7,0.7,0.8), borderWidth: 0.7 }); // 기존 18 → 20
        page.drawText(h, { x: paymentX + 4, y: paymentY + 6, size: 9, font: font, color: rgb(0.15,0.2,0.4) }); // 기존 y+5 → y+6
        paymentX += paymentColWidths[i];
      });
      paymentY -= 20; // 기존 18 → 20
      tx.payments.forEach((p: any) => {
        paymentX = colX;
        const paymentRow = [
          p.paid_at?.slice(0,10) || '',
          p.amount?.toLocaleString() || '',
          p.method || '',
          p.payer_name || '',
          [p.bank_name, p.account_number, p.account_holder, p.cash_place, p.cash_receiver, p.detail, p.note].filter(Boolean).join(' / ')
        ];
        paymentRow.forEach((cell, i) => {
          let color = rgb(0,0,0);
          let useBold = false;
          let alignX = paymentX + 4;
          if (i === 1) { color = rgb(0.1,0.2,0.8); useBold = true; alignX = paymentX + paymentColWidths[i] - 8 - font.widthOfTextAtSize(cell, 9); }
          if (i === 0 || i === 2 || i === 3 || i === 4) alignX = paymentX + 4;
          page.drawText(cell, { x: alignX, y: paymentY + 6, size: 9, font: useBold ? font : font, color }); // 기존 y+4 → y+6
          page.drawRectangle({ x: paymentX, y: paymentY, width: paymentColWidths[i], height: 20, borderColor: rgb(0.7,0.7,0.8), borderWidth: 0.7 }); // 기존 18 → 20
          paymentX += paymentColWidths[i];
        });
        paymentY -= 20; // 기존 18 → 20
      });
      y = paymentY - 6; // 기존 -4 → -6
    } else {
      // '입금내역 없음' 셀 스타일
      page.drawRectangle({ x: colX, y: y, width: 490, height: 20, color: rgb(0.98,0.98,0.98), borderColor: rgb(0.8,0.8,0.8), borderWidth: 0.7 }); // 기존 18 → 20
      page.drawText('입금내역 없음', { x: colX + 200, y: y + 6, size: 10, font, color: rgb(0.6,0.6,0.6) }); // 기존 y+5 → y+6
      y -= 20; // 기존 18 → 20
    }
  });
  // 합계 행 (웹 Table과 동일하게 강조)
  if (transactions.length > 0) {
    colX = customerBoxX;
    let sumY = y;
    // 합계 행은 셀 테두리 없이 배경색만 적용
    for (let i = 0; i < headers.length; i++) {
      page.drawRectangle({ x: colX, y: sumY, width: colWidths[i], height: 24, color: rgb(0.93,0.97,1) }); // borderColor, borderWidth 제거, height 24
      colX += colWidths[i];
    }
    colX = customerBoxX;
    const sumRow = [
      '합계', '', '',
      summary.total_amount?.toLocaleString() || '',
      summary.total_paid?.toLocaleString() || '',
      summary.total_unpaid?.toLocaleString() || '',
      ''
    ];
    sumRow.forEach((cell, i) => {
      let color = rgb(0,0,0);
      let alignX = colX + 6;
      let useBold = true;
      if (i === 3) { color = rgb(0.8,0.1,0.1); alignX = colX + colWidths[i] - 8 - font.widthOfTextAtSize(cell, 11); }
      if (i === 4) { color = rgb(0.1,0.2,0.8); alignX = colX + colWidths[i] - 8 - font.widthOfTextAtSize(cell, 11); }
      if (i === 5) { color = rgb(0.8,0.6,0.1); alignX = colX + colWidths[i] - 8 - font.widthOfTextAtSize(cell, 11); }
      if (i === 0 || i === 1 || i === 2 || i === 6) alignX = colX + 6;
      page.drawText(cell, { x: alignX, y: y + 8, size: 11, font: font, color });
      colX += colWidths[i];
    });
    y -= 24;
  }
  // 5. 하단 공급자 정보
  if (supplier) {
    const accountText = supplier.accounts && supplier.accounts.length > 0
      ? `${supplier.accounts[0].bank} ${supplier.accounts[0].number} (${supplier.accounts[0].holder})`
      : '';
    const supplierLine1 = `공급자: ${supplier.name} | 대표: ${supplier.ceo} | 사업자등록번호: ${supplier.biznum}`;
    const supplierLine2 = `주소: ${supplier.address} | 연락처: ${supplier.phone}`;
    const supplierLine3 = accountText;
    const line1Width = font.widthOfTextAtSize(supplierLine1, 11);
    const line2Width = font.widthOfTextAtSize(supplierLine2, 11);
    const line3Width = font.widthOfTextAtSize(supplierLine3, 14);
    const line1CenterX = (595 - line1Width) / 2;
    const line2CenterX = (595 - line2Width) / 2;
    const line3CenterX = (595 - line3Width) / 2;
    page.drawText(supplierLine1, { x: line1CenterX, y: 60, size: 11, font, color: rgb(0.2,0.2,0.2) });
    page.drawText(supplierLine2, { x: line2CenterX, y: 40, size: 11, font, color: rgb(0.2,0.2,0.2) });
    if (supplierLine3) {
      page.drawText(supplierLine3, { x: line3CenterX, y: 22, size: 14, font, color: rgb(0.09,0.46,0.82) });
    }
  }
  // 6. 서명란
  const confirmText = `${today.slice(0,4)}년     월     일     확인자:     ${customer.name || ''}     (서명)`;
  const confirmWidth = font.widthOfTextAtSize(confirmText, 11);
  const confirmX = (595 - confirmWidth) / 2;
  page.drawText(confirmText, { x: confirmX, y: 90, size: 11, font, color: rgb(0.2,0.2,0.2) });
  // 7. PDF 저장
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
} 