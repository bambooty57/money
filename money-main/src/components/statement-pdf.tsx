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

// 유틸: 셀 내 텍스트 줄바꿈(셀 너비, 폰트, 폰트크기, 최대줄수) - 한글 지원 개선
function wrapText(text: string, font: any, fontSize: number, maxWidth: number, maxLines: number = 3): string[] {
  if (!text) return [''];
  const textStr = String(text);
  
  // 공백으로 단어 분리 시도
  const words = textStr.split(/\s+/);
  let lines: string[] = [];
  let current = '';
  
  for (let word of words) {
    const test = current ? current + ' ' + word : word;
    const testWidth = font.widthOfTextAtSize(test, fontSize);
    
    if (testWidth > maxWidth) {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) break;
      }
      current = word;
      
      // 단어 자체가 너무 길면 문자 단위로 자르기 (한글 지원)
      const wordWidth = font.widthOfTextAtSize(word, fontSize);
      if (wordWidth > maxWidth) {
        let charLine = '';
        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          const testCharLine = charLine + char;
          if (font.widthOfTextAtSize(testCharLine, fontSize) > maxWidth) {
            if (charLine) {
              lines.push(charLine);
              if (lines.length >= maxLines) break;
            }
            charLine = char;
          } else {
            charLine = testCharLine;
          }
        }
        current = charLine;
        if (lines.length >= maxLines) break;
      }
    } else {
      current = test;
    }
  }
  
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  
  // 최대 줄 수 초과 시 마지막 줄 자르기
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (font.widthOfTextAtSize(last + '...', fontSize) > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + '...';
  }
  
  return lines.length > 0 ? lines : [''];
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

// 헤더 그리기 함수 (로고, 제목, 출력일, 페이지 번호)
async function drawPageHeader(page: any, font: any, title: string, printDate: string, pageNum: number, totalPages: number, logoImg?: any) {
  const headerY = 550;
  
  // 로고 이미지
  if (logoImg) {
    page.drawImage(logoImg, { x: 50, y: headerY - 20, width: 150, height: 60 });
  }

  // 제목
  page.drawText(title, { 
    x: 320,
    y: headerY, 
    size: 28, 
    font, 
    color: rgb(0,0,0) 
  });
  
  // 출력일 및 페이지 번호
  const outputDateText = `출력일: ${printDate}`;
  const pageNumberText = `${pageNum}/${totalPages}`;
  const outputDateWidth = font.widthOfTextAtSize(outputDateText, 11);
  const pageNumberWidth = font.widthOfTextAtSize(pageNumberText, 11);
  const rightMargin = 50;
  
  // 출력일
  page.drawText(outputDateText, { 
    x: 792 - rightMargin - pageNumberWidth - 10 - outputDateWidth,
    y: headerY, 
    size: 11, 
    font, 
    color: rgb(0.5,0.5,0.5) 
  });
  
  // 페이지 번호
  page.drawText(pageNumberText, { 
    x: 792 - rightMargin - pageNumberWidth,
    y: headerY, 
    size: 11, 
    font, 
    color: rgb(0.5,0.5,0.5) 
  });
  
  return 530; // y 시작 위치 반환
}

// 테이블 헤더 그리기 함수
function drawTableHeader(page: any, font: any, y: number, headers: string[], colWidths: number[], tableStartX: number, tableWidth: number) {
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
  
  // 헤더 텍스트 및 수직 구분선
  let headerX = tableStartX;
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: headerX + 5,
      y: y - 15,
      size: 10,
      font,
      color: rgb(0,0,0)
    });
    
    if (i < headers.length - 1) {
      const lineX = headerX + colWidths[i];
      page.drawLine({
        start: { x: lineX, y: y - 20 },
        end: { x: lineX, y: y },
        thickness: 0.5,
        color: rgb(0.2, 0.4, 0.8)
      });
    }
    
    headerX += colWidths[i];
  });
  
  return y - 20;
}

// 완전한 PDF 생성 함수 (페이지 분할 지원)
export async function generateStatementPdf({ customer, transactions, payments, supplier, title = '거래명세서', printDate, photoUrl }: StatementPdfOptions): Promise<Blob> {
  try {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

    // 폰트 로드
  const fontUrl = '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf';
  const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
  const font = await pdfDoc.embedFont(fontBytes);
  
  // 로고 이미지 로드
  let logoImg: any = null;
  try {
    const logoUrl = '/kubotalogo5.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      logoImg = await pdfDoc.embedPng(logoBytes);
    }
  } catch (logoError) {
    console.error('로고 로드 실패:', logoError);
  }
  
  // 출력일
  const today = printDate || `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}`;
  
  // 페이지 관리 변수
  let currentPage = pdfDoc.addPage([842, 595]); // 첫 페이지
  let pageNum = 1;
  const minY = 100; // 최소 y 위치 (이 아래로 내려가면 새 페이지)
  
  // 첫 페이지에 헤더와 고객/공급자 정보 그리기
  let y = await drawPageHeader(currentPage, font, title, today, pageNum, 1, logoImg);
  currentPage.drawLine({ start: {x: 50, y}, end: {x: 792, y}, thickness: 2, color: rgb(0.7,0.7,0.8) });
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
    currentPage.drawRectangle({
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
      currentPage.drawText(`${k}:`, { 
        x: customerBoxX + 10, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0.3,0.3,0.3) 
      });
      // 값
      currentPage.drawText(v, { 
        x: customerBoxX + 100, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0,0,0) 
      });
      // 구분선
    if (i < customerTable.length - 1) {
        currentPage.drawLine({ 
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
    currentPage.drawRectangle({
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
      currentPage.drawText(`${k}:`, { 
        x: supplierBoxX + 10, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0.3,0.3,0.3) 
      });
      // 값
      currentPage.drawText(v, { 
        x: supplierBoxX + 100, 
        y: rowY, 
        size: 9, 
        font, 
        color: rgb(0,0,0) 
      });
      // 구분선
      if (i < supplierTable.length - 1) {
        currentPage.drawLine({ 
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
  
  // 페이지 분할을 위한 함수
  const checkAndCreateNewPage = async (requiredHeight: number) => {
    if (y - requiredHeight < minY) {
      // 새 페이지 생성
      pageNum++;
      currentPage = pdfDoc.addPage([842, 595]);
      y = await drawPageHeader(currentPage, font, title, today, pageNum, 999, logoImg); // totalPages는 나중에 업데이트
      y = drawTableHeader(currentPage, font, y - 25, headers, colWidths, tableStartX, tableWidth);
    }
  };
  
  // 첫 페이지에 테이블 헤더 그리기
  y = drawTableHeader(currentPage, font, y, headers, colWidths, tableStartX, tableWidth);
    
    // 거래 데이터 행 (비고 2줄 지원 및 구분선 추가, 페이지 분할 지원)
    for (let idx = 0; idx < transactions.length; idx++) {
      const tx = transactions[idx];
      
      // 기존 로직 사용: 거래별 입금액과 잔액 계산
      const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const unpaid = (tx.amount || 0) - paid;
      
      // 비고 텍스트는 비고 컬럼에만 표시 (입금내역의 () 안에는 넣지 않음)
      const remarksText = tx.description || tx.notes || tx.note || '';
      const remarksMaxWidth = colWidths[4] - 10; // 비고 컬럼 너비에서 패딩 제외
      const remarksLines = wrapText(remarksText, font, 9, remarksMaxWidth, 2);
      const remarksRowHeight = Math.max(20, remarksLines.length * 12 + 8); // 최소 20px, 줄당 12px + 여백
      
      // 입금내역 높이 계산
      const paymentRows = Array.isArray(tx.payments) ? tx.payments.length : 0;
      const paymentHeight = paymentRows * 15;
      
      const rowHeight = remarksRowHeight;
      const totalRowHeight = rowHeight + paymentHeight;
      
      // 페이지 분할 체크
      await checkAndCreateNewPage(totalRowHeight + 10);
      
      // 행 배경 (홀수/짝수 구분)
      if (idx % 2 === 0) {
        currentPage.drawRectangle({
          x: tableStartX,
          y: y - rowHeight,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98)
        });
      }
      
      // 행 테두리
      currentPage.drawRectangle({
        x: tableStartX,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.5
      });
      
      // 셀 데이터 (정확한 컬럼 배치)
      const rowData = [
        String(idx + 1),                          // # 컬럼
        tx.created_at?.slice(0, 10) || '',        // 일자 컬럼
        tx.type || '',                            // 거래명 컬럼
        `${tx.model || tx.models_types?.model || ''}${(tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : ''}${tx.model_type || tx.models_types?.type || ''}`, // 기종/모델 컬럼
        remarksLines,                             // 비고 컬럼 (줄바꿈된 배열)
        (tx.amount || 0).toLocaleString(),        // 매출 컬럼 (매출액)
        paid.toLocaleString(),                    // 입금 컬럼 (입금액)
        unpaid.toLocaleString()                   // 잔액 컬럼 (잔액)
      ];
      
      // 헤더와 동일한 방식으로 위치 계산
      let cellX = tableStartX;
      rowData.forEach((cellData, cellIdx) => {
        // 비고 컬럼은 여러 줄 처리
        if (cellIdx === 4 && Array.isArray(cellData)) {
          // 비고 컬럼: 여러 줄 텍스트 (각 줄을 셀 안에 제한)
          cellData.forEach((line, lineIdx) => {
            // 텍스트가 셀 너비를 초과하지 않도록 확인
            const maxTextWidth = colWidths[4] - 10;
            let displayText = line;
            if (font.widthOfTextAtSize(line, 9) > maxTextWidth) {
              // 텍스트가 너무 길면 자르기
              let truncated = '';
              for (let i = 0; i < line.length; i++) {
                const test = truncated + line[i];
                if (font.widthOfTextAtSize(test, 9) <= maxTextWidth) {
                  truncated = test;
                } else {
                  break;
                }
              }
              displayText = truncated + (lineIdx === cellData.length - 1 ? '' : '');
            }
            
            currentPage.drawText(displayText, {
              x: cellX + 5,
              y: y - 12 - (lineIdx * 12), // 줄 간격 12px
              size: 9,
              font,
              color: rgb(0,0,0)
            });
          });
        } else {
          // 일반 컬럼: 단일 텍스트
          const text = String(cellData);
          const isAmount = cellIdx >= 5; // 금액 관련 컬럼 (매출, 입금, 잔액)
          
          // 텍스트가 셀 너비를 초과하지 않도록 확인
          const cellWidth = colWidths[cellIdx] - 10; // 패딩 제외
          let displayText = text;
          const textWidth = font.widthOfTextAtSize(text, 9);
          
          if (textWidth > cellWidth) {
            // 텍스트가 너무 길면 자르기
            let truncated = '';
            for (let i = 0; i < text.length; i++) {
              const test = truncated + text[i];
              if (font.widthOfTextAtSize(test, 9) <= cellWidth) {
                truncated = test;
              } else {
                break;
              }
            }
            displayText = truncated;
          }
          
          // 금액은 우측 정렬, 나머지는 좌측 정렬
          const textX = isAmount 
            ? cellX + colWidths[cellIdx] - 10 - font.widthOfTextAtSize(displayText, 9) // 우측 정렬
            : cellX + 5; // 좌측 정렬
          
          currentPage.drawText(displayText, {
            x: textX,
            y: y - 15,
            size: 9,
            font,
            color: rgb(0,0,0)
          });
        }
        
        // 컬럼 사이 수직 구분선 (모두 동일하게)
        if (cellIdx < rowData.length - 1) {
          const lineX = cellX + colWidths[cellIdx];
          currentPage.drawLine({
            start: { x: lineX, y: y - rowHeight },
            end: { x: lineX, y: y },
            thickness: 0.5,
            color: rgb(0.6, 0.6, 0.6)
          });
        }
        
        cellX += colWidths[cellIdx]; // 헤더와 동일한 방식
      });
      
      y -= rowHeight;
      
      // 입금내역 표시 (기존 방식으로 간단하게)
      if (Array.isArray(tx.payments) && tx.payments.length > 0) {
        for (const payment of tx.payments) {
          const paymentHeight = 15;
          
          // 페이지 분할 체크 (입금 행 추가 전)
          await checkAndCreateNewPage(paymentHeight + 10);
          
          // 입금행 배경
          currentPage.drawRectangle({
            x: tableStartX,
            y: y - paymentHeight,
            width: tableWidth,
            height: paymentHeight,
            color: rgb(0.95, 0.98, 1.0),
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 0.5
          });
          
          // 입금 정보 - 입금내역의 비고 내용만 () 안에 포함
          const paymentDate = payment.paid_at?.slice(0, 10) || '';
          const paymentMethod = payment.method || '';
          const paymentAmount = (payment.amount || 0).toLocaleString();
          const payerName = payment.payer_name || '';
          
          // 입금내역의 비고만 사용 (거래의 비고는 사용하지 않음)
          const paymentNote = payment.note || '';
          
          // 입금 정보 형식: └ 날짜 방법 금액원 (입금자명 비고내용)
          const paymentInfo = `      └ ${paymentDate} ${paymentMethod} ${paymentAmount}원 (${payerName}${paymentNote ? ' ' + paymentNote : ''})`;
          currentPage.drawText(paymentInfo, {
            x: tableStartX + 5,
            y: y - 12,
            size: 8,
            font,
            color: rgb(0.2, 0.2, 0.8)
          });
          
          y -= paymentHeight;
        }
      }
    }
    
    // 합계 행 (페이지 분할 체크)
    await checkAndCreateNewPage(25 + 10);
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
    
    currentPage.drawRectangle({
      x: tableStartX,
      y: y - 25,
      width: tableWidth,
      height: 25,
      color: rgb(0.9, 0.9, 0.9),
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1
    });
    
    // 합계 행 수직 구분선 (모두 동일하게)
    let summaryCellX = tableStartX;
    for (let i = 0; i < colWidths.length - 1; i++) {
      summaryCellX += colWidths[i];
      currentPage.drawLine({
        start: { x: summaryCellX, y: y - 25 },
        end: { x: summaryCellX, y: y },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.6)
      });
    }
    
    // 합계 텍스트
    const summaryLabelStart = tableStartX + colWidths.slice(0, 4).reduce((sum, width) => sum + width, 0);
    currentPage.drawText('합계', {
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
      const cellWidth = colWidths[index] - 10;
      const textWidth = font.widthOfTextAtSize(value, 10);
      
      // 우측 정렬 (금액은 항상 우측 정렬)
      const textX = columnStart + cellWidth - textWidth;
      
      currentPage.drawText(value, {
        x: textX,
        y: y - 18,
        size: 10,
        font,
        color: rgb(0,0,0)
      });
    });
    
    // 서명란 (페이지 분할 체크)
    await checkAndCreateNewPage(80 + 10);
    y -= 50;
    
    // 고객 확인 서명란 (테이블 너비에 맞게 조정)
    const confirmBoxHeight = 80;
    currentPage.drawRectangle({
      x: 50,
      y: y - confirmBoxHeight,
      width: tableWidth, // 테이블과 동일한 너비
      height: confirmBoxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1
    });
    
    currentPage.drawText('위 거래내용이 틀림없음을 확인하며 잔액에 대하여                      년                      월                      일까지  완납하겠음을 확인합니다', {
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
    currentPage.drawText(confirmText, { x: confirmX, y: confirmY, size: 11, font, color: rgb(0.2,0.2,0.2) });
  
  // 모든 페이지의 페이지 번호 업데이트
  const totalPages = pdfDoc.getPageCount();
  for (let p = 0; p < totalPages; p++) {
    const pg = pdfDoc.getPage(p);
    const headerY = 550;
    const outputDateText = `출력일: ${today}`;
    const pageNumberText = `${p + 1}/${totalPages}`;
    const outputDateWidth = font.widthOfTextAtSize(outputDateText, 11);
    const pageNumberWidth = font.widthOfTextAtSize(pageNumberText, 11);
    const rightMargin = 50;
    
    // 기존 페이지 번호 덮어쓰기 (배경으로 덮기)
    pg.drawRectangle({
      x: 792 - rightMargin - pageNumberWidth - 10 - outputDateWidth,
      y: headerY - 5,
      width: outputDateWidth + 10 + pageNumberWidth + 10,
      height: 15,
      color: rgb(1, 1, 1)
    });
    
    // 출력일
    pg.drawText(outputDateText, { 
      x: 792 - rightMargin - pageNumberWidth - 10 - outputDateWidth,
      y: headerY, 
      size: 11, 
      font, 
      color: rgb(0.5,0.5,0.5) 
    });
    
    // 페이지 번호
    pg.drawText(pageNumberText, { 
      x: 792 - rightMargin - pageNumberWidth,
      y: headerY, 
      size: 11, 
      font, 
      color: rgb(0.5,0.5,0.5) 
    });
  }
  
  // PDF 저장
  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  } catch (err) {
    console.error('PDF 생성 중 오류:', err);
    throw err;
  }
}

// @react-pdf/renderer 컴포넌트 제거 - React 19 호환성 문제로 pdf-lib만 사용 