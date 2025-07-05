"use client";

import { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { generateStatementPdf } from '@/components/statement-pdf';
import React from "react";
import { Card } from "@/components/ui/card";

interface Customer {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  created_at?: string;
  date: string;
  description: string;
  amount: number;
  paid_amount: number;
  unpaid_amount: number;
  status: string;
  note?: string;
  type?: string;
  payments?: any[];
  model?: string;
  model_type?: string;
  models_types?: { model?: string; type?: string };
}

export default function StatementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 1. 고객 목록 불러오기
  useEffect(() => {
    fetch("/api/customers?page=1&pageSize=100")
      .then((res) => res.json())
      .then((data) => setCustomers(data.data || []));
  }, []);

  // 2. 고객 선택 시 거래내역+부분합 fetch
  useEffect(() => {
    if (!selectedCustomer) return;
    setLoading(true);
    fetch(`/api/customers/${selectedCustomer}/summary`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data.transactions || []);
        setSummary(data);
        setCustomerName(customers.find((c) => c.id === selectedCustomer)?.name || "");
      })
      .finally(() => setLoading(false));
  }, [selectedCustomer, customers]);

  // 3. 엑셀 다운로드
  const handleExcelDownload = () => {
    if (!transactions.length) return;
    const ws = XLSX.utils.json_to_sheet([
      ...transactions.map((tx) => ({
        일자: tx.created_at?.slice(0, 10) || "",
        "대변(매출)": tx.amount || 0,
        "차변(입금)": tx.paid_amount || 0,
        잔액: tx.unpaid_amount || 0,
        비고: tx.note || "",
      })),
      {
        일자: "합계",
        "대변(매출)": summary?.total_amount || 0,
        "차변(입금)": summary?.total_paid || 0,
        잔액: summary?.total_unpaid || 0,
        비고: "",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, customerName || "거래명세서");
    XLSX.writeFile(wb, `${customerName || "거래명세서"}.xlsx`);
  };

  // 4. PDF 생성 및 인쇄
  const fetchSupplierInfo = async () => {
    const res = await fetch('/api/supplier-info');
    if (!res.ok) throw new Error('공급자 정보 로드 실패');
    return res.json();
  };
  const handlePdfPrint = async () => {
    if (!transactions.length) return;
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([595, 842]); // A4
    // 폰트 로드
    const fontUrl = '/Noto_Sans_KR/static/NotoSansKR-Regular.ttf';
    const fontBoldUrl = '/Noto_Sans_KR/static/NotoSansKR-Bold.ttf';
    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    const fontBoldBytes = await fetch(fontBoldUrl).then(res => res.arrayBuffer());
    const font = await pdfDoc.embedFont(fontBytes);
    const fontBold = await pdfDoc.embedFont(fontBoldBytes);
    // 상단 헤더
    const headerY = 780;
    try {
      const logoUrl = '/kubotalogo5.png';
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImg = await pdfDoc.embedPng(logoBytes);
        page.drawImage(logoImg, { x: 50, y: headerY - 20, width: 150, height: 60 });
      }
    } catch {}
    page.drawText('거래명세서', { x: 220, y: headerY, size: 28, font, color: rgb(0,0,0) });
    const today = new Date();
    const printDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    page.drawText(`출력일: ${printDate}`, { x: 420, y: headerY, size: 11, font, color: rgb(0.5,0.5,0.5) });
    let y = 760;
    page.drawLine({ start: {x: 50, y}, end: {x: 545, y}, thickness: 2, color: rgb(0.7,0.7,0.8) });
    y -= 25;
    // 고객정보+사진 박스 (거래상세와 동일)
    const customer = customers.find(c => c.id === selectedCustomer) || {};
    const customerTable = [
      ['고객명', (customer as any).name || ''],
      ['고객유형', (customer as any).customer_type || ''],
      ['주민번호', (customer as any).ssn || ''],
      ['사업자번호', (customer as any).business_no || ''],
      ['휴대폰번호', (customer as any).mobile || (customer as any).phone || ''],
      ['주소', (customer as any).address || ''],
      ['지번주소', (customer as any).address_jibun || '']
    ];
    const customerBoxX = 60;
    const customerBoxY = y;
    const customerBoxWidth = 350;
    const customerBoxHeight = 126;
    const photoBoxX = customerBoxX + customerBoxWidth + 10;
    const photoBoxWidth = 120;
    page.drawRectangle({ x: customerBoxX, y: customerBoxY - customerBoxHeight, width: customerBoxWidth, height: customerBoxHeight, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
    customerTable.forEach(([k, v], i) => {
      const rowY = customerBoxY - 15 - (i * 15);
      page.drawText(`${k}:`, { x: customerBoxX + 10, y: rowY, size: 9, font, color: rgb(0.3,0.3,0.3) });
      page.drawText(v, { x: customerBoxX + 100, y: rowY, size: 9, font, color: rgb(0,0,0) });
      if (i < customerTable.length - 1) {
        page.drawLine({ start: {x: customerBoxX + 5, y: rowY - 3}, end: {x: customerBoxX + customerBoxWidth - 5, y: rowY - 3}, thickness: 0.3, color: rgb(0.9,0.9,0.9) });
      }
    });
    // 고객사진 박스 (fetch, draw, fallback 모두 거래상세와 동일하게 복사)
    page.drawRectangle({ x: photoBoxX, y: customerBoxY - customerBoxHeight, width: photoBoxWidth, height: customerBoxHeight, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
    let photoUrl = '';
    try {
      const filesResponse = await fetch(`/api/files?customer_id=${selectedCustomer}`);
      if (filesResponse.ok) {
        const customerFiles = await filesResponse.json();
        if (Array.isArray(customerFiles) && customerFiles.length > 0) {
          const firstFile = customerFiles[0];
          if (firstFile && firstFile.url) {
            photoUrl = firstFile.url;
          }
        }
      }
    } catch {}
    if (photoUrl && String(photoUrl).trim() !== '') {
      try {
        const photoResponse = await fetch(photoUrl);
        if (photoResponse.ok) {
          const photoBytes = await photoResponse.arrayBuffer();
          const contentType = photoResponse.headers.get('content-type') || '';
          let photoImg;
          try {
            const blob = new Blob([photoBytes], { type: contentType || 'image/jpeg' });
            const imageUrl = URL.createObjectURL(blob);
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = () => resolve(true);
              img.onerror = (err) => reject(new Error('이미지 로드 실패'));
              img.src = imageUrl;
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxSize = 300;
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const base64Data = dataUrl.split(',')[1];
            const reEncodedBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            photoImg = await pdfDoc.embedJpg(reEncodedBytes);
            URL.revokeObjectURL(imageUrl);
          } catch {
            photoImg = await pdfDoc.embedJpg(photoBytes);
          }
          const maxPhotoWidth = photoBoxWidth - 10;
          const maxPhotoHeight = customerBoxHeight - 10;
          const photoDims = photoImg.scale(Math.min(maxPhotoWidth/photoImg.width, maxPhotoHeight/photoImg.height));
          const photoX = photoBoxX + (photoBoxWidth - photoDims.width) / 2;
          const photoY = customerBoxY - 5 - photoDims.height;
          page.drawImage(photoImg, { x: photoX, y: photoY, width: photoDims.width, height: photoDims.height });
        }
      } catch {
        page.drawText('사진 없음', { x: photoBoxX + 35, y: customerBoxY - 70, size: 10, font, color: rgb(0.5,0.5,0.5) });
      }
    } else {
      page.drawText('사진 없음', { x: photoBoxX + 35, y: customerBoxY - 70, size: 10, font, color: rgb(0.5,0.5,0.5) });
    }
    y -= customerBoxHeight + 75;
    // 거래명세서 표 복원
    <Table>
      <TableHeader className="bg-gray-100 text-lg">
        <TableRow>
          <TableHead className="w-20 text-center">#</TableHead>
          <TableHead className="w-24 text-center">일자</TableHead>
          <TableHead className="w-32 text-center">거래명</TableHead>
          <TableHead className="w-40 text-center">기종/모델</TableHead>
          <TableHead className="text-right w-32 pl-8">대변(매출)</TableHead>
          <TableHead className="text-right w-32">차변(입금)</TableHead>
          <TableHead className="text-right w-32 pl-32">잔액</TableHead>
          <TableHead className="w-56 text-center">비고</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="text-lg">
        {transactions.map((tx, idx) => (
          <React.Fragment key={tx.id}>
            <TableRow className="bg-red-50 ring-2 ring-red-200 rounded-xl shadow hover:bg-red-100 min-h-[72px] transition-all duration-200">
              <TableCell className="text-center align-middle px-4 py-8 bg-red-50 font-semibold w-20">{idx + 1}</TableCell>
              <TableCell className="px-4 py-8 bg-red-50 font-semibold w-24 text-center">{tx.created_at?.slice(0, 10) || ""}</TableCell>
              <TableCell className="px-4 py-8 bg-red-50 font-semibold w-32 text-center">{tx.type || ""}</TableCell>
              <TableCell className="px-4 py-8 bg-red-50 font-semibold w-40 text-center">{tx.model || tx.models_types?.model || ''}{(tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : ''}{tx.model_type || tx.models_types?.type || ''}</TableCell>
              <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">{tx.amount?.toLocaleString() || ""}</TableCell>
              <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32 pl-32">{tx.paid_amount?.toLocaleString() || ""}</TableCell>
              <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">{tx.unpaid_amount?.toLocaleString() || ""}</TableCell>
              <TableCell className="px-4 py-8 bg-red-50 font-semibold w-56 text-center">{tx.note || ""}</TableCell>
            </TableRow>
            {/* 입금내역 하위 표 또는 입금없음 표시 */}
            {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
              <>
                <TableRow className="bg-blue-50">
                  <TableCell className="w-20" />
                  <TableCell className="w-20" />
                  <TableCell className="w-24 text-center">입금일</TableCell>
                  <TableCell className="w-28 text-right pr-4">금액</TableCell>
                  <TableCell className="w-28 pl-4">입금방법</TableCell>
                  <TableCell className="w-28">입금자</TableCell>
                  <TableCell className="w-40 text-center">비고</TableCell>
                  <TableCell />
                </TableRow>
                {tx.payments.map((p, pidx) => (
                  <TableRow key={p.id || pidx}>
                    <TableCell className="w-20" />
                    <TableCell className="w-20" />
                    <TableCell className="w-24 text-center">{p.paid_at?.slice(0, 10) || ""}</TableCell>
                    <TableCell className="w-28 text-right pr-4">{p.amount?.toLocaleString() || ""}</TableCell>
                    <TableCell className="w-28 pl-4">{p.method || ""}</TableCell>
                    <TableCell className="w-28">{p.payer_name || ""}</TableCell>
                    <TableCell className="w-40 text-center">{[p.bank_name, p.account_number, p.account_holder, p.cash_place, p.cash_receiver, p.detail, p.note].filter(Boolean).join(' / ')}</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </>
            ) : (
              <TableRow className="bg-blue-50">
                <TableCell className="w-20" />
                <TableCell className="w-20" />
                <TableCell className="w-20" />
                <TableCell colSpan={5} className="text-center text-blue-700 font-bold py-4 text-lg">입금없음</TableCell>
                <TableCell />
              </TableRow>
            )}
          </React.Fragment>
        ))}
        {summary && (
          <TableRow className="bg-blue-100 font-bold text-xl">
            <TableCell className="border-none" colSpan={2}></TableCell>
            <TableCell className="border-none text-center">총합계</TableCell>
            <TableCell className="border-none text-center px-2 text-red-700">총매출: {summary.total_amount?.toLocaleString()}</TableCell>
            <TableCell className="border-none text-center px-2 text-blue-700">총입금: {summary.total_paid?.toLocaleString()}</TableCell>
            <TableCell className="border-none text-center px-2 text-yellow-700">총잔금: {summary.total_unpaid?.toLocaleString()}</TableCell>
            <TableCell className="border-none" colSpan={2}></TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    // drawLine(구분선) 추가 (공급자 정보 위)
    page.drawLine({ start: { x: 40, y: 75 }, end: { x: 555, y: 75 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
    // 하단 공급자 정보(중앙 정렬, 3행: 공급자, 주소, 계좌)
    let supplier: any = {};
    try {
      supplier = await fetchSupplierInfo();
    } catch (e) {
      supplier = {};
    }
    const accountText = supplier.accounts && supplier.accounts.length > 0
      ? `${supplier.accounts[0].bank} ${supplier.accounts[0].number} (${supplier.accounts[0].holder})`
      : '';
    const supplierLine1 = `공급자: ${supplier.name || ''} | 대표: ${supplier.ceo || ''} | 사업자등록번호: ${supplier.biznum || ''}`;
    const supplierLine2 = `주소: ${supplier.address || ''} | 연락처: ${supplier.phone || ''}`;
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
    // 서명란 (거래상세와 동일)
    const confirmText = `${printDate.slice(0,4)}년     월     일     확인자:     ${(customer as any).name || ''}     (서명)`;
    const confirmWidth = font.widthOfTextAtSize(confirmText, 11);
    const confirmX = (595 - confirmWidth) / 2;
    page.drawText(confirmText, { x: confirmX, y: 90, size: 11, font, color: rgb(0.2,0.2,0.2) });
    // 페이지 번호 하단 중앙 표시 (거래상세 PDF와 동일하게)
    const pageNumber = '1/1'; // 단일 페이지 기준, 추후 멀티페이지 지원 시 currentPage/totalPages로 변경
    const pageWidth = 595;
    const pageTextWidth = font.widthOfTextAtSize(pageNumber, 10);
    const pageX = (pageWidth - pageTextWidth) / 2;
    page.drawText(pageNumber, {
      x: pageX,
      y: 10,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });
    // PDF 저장 및 인쇄 (반드시 모든 await 이후 실행)
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.print();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Card className="rounded-2xl shadow-xl border bg-white p-8 max-w-[1400px] w-full mx-auto">
        <h1 className="text-3xl font-bold text-blue-800 flex items-center gap-3 mb-8 justify-center text-center">
          거래명세서
        </h1>
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
          <label className="text-lg font-semibold text-gray-700">고객 선택:</label>
          <select
            className="border rounded px-4 py-2 text-lg min-w-[200px]"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            title="고객 선택"
          >
            <option value="">고객을 선택하세요</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button onClick={handleExcelDownload} className="bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold">엑셀 다운로드</Button>
          <Button onClick={handlePdfPrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-lg font-bold">프린트</Button>
        </div>
        <div className="mb-8 border-b pb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              👤 {customerName} <span className="text-lg text-gray-500">거래명세서</span>
            </h2>
            {/* 고객 정보 등 추가 정보 필요시 여기에 */}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px] divide-y divide-blue-100">
            <TableHeader>
              <TableRow className="bg-blue-50">
                <TableHead className="w-20 text-center">#</TableHead>
                <TableHead className="w-24 text-center">일자</TableHead>
                <TableHead className="w-32 text-center">거래명</TableHead>
                <TableHead className="w-40 text-center">기종/모델</TableHead>
                <TableHead className="text-right w-32 pl-8">대변(매출)</TableHead>
                <TableHead className="text-right w-32">차변(입금)</TableHead>
                <TableHead className="text-right w-32 pl-32">잔액</TableHead>
                <TableHead className="w-56 text-center">비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx, idx) => (
                <React.Fragment key={tx.id}>
                  <TableRow className="bg-red-50 ring-2 ring-red-200 rounded-xl shadow hover:bg-red-100 min-h-[72px] transition-all duration-200">
                    <TableCell className="text-center align-middle px-4 py-8 bg-red-50 font-semibold w-20">{idx + 1}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-24 text-center">{tx.created_at?.slice(0, 10) || ""}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-32 text-center">{tx.type || ""}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-40 text-center">{tx.model || tx.models_types?.model || ''}{(tx.model || tx.models_types?.model) && (tx.model_type || tx.models_types?.type) ? '/' : ''}{tx.model_type || tx.models_types?.type || ''}</TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">{tx.amount?.toLocaleString() || ""}</TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32 pl-32">{tx.paid_amount?.toLocaleString() || ""}</TableCell>
                    <TableCell className="text-right px-4 py-8 bg-red-50 font-semibold w-32">{tx.unpaid_amount?.toLocaleString() || ""}</TableCell>
                    <TableCell className="px-4 py-8 bg-red-50 font-semibold w-56 text-center">{tx.note || ""}</TableCell>
                  </TableRow>
                  {/* 입금내역 하위 표 또는 입금없음 표시 */}
                  {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
                    <>
                      <TableRow className="bg-blue-50">
                        <TableCell className="w-20" />
                        <TableCell className="w-20" />
                        <TableCell className="w-24 text-center">입금일</TableCell>
                        <TableCell className="w-28 text-right pr-4">금액</TableCell>
                        <TableCell className="w-28 pl-4">입금방법</TableCell>
                        <TableCell className="w-28">입금자</TableCell>
                        <TableCell className="w-40 text-center">비고</TableCell>
                        <TableCell />
                      </TableRow>
                      {tx.payments.map((p, pidx) => (
                        <TableRow key={p.id || pidx}>
                          <TableCell className="w-20" />
                          <TableCell className="w-20" />
                          <TableCell className="w-24 text-center">{p.paid_at?.slice(0, 10) || ""}</TableCell>
                          <TableCell className="w-28 text-right pr-4">{p.amount?.toLocaleString() || ""}</TableCell>
                          <TableCell className="w-28 pl-4">{p.method || ""}</TableCell>
                          <TableCell className="w-28">{p.payer_name || ""}</TableCell>
                          <TableCell className="w-40 text-center">{[p.bank_name, p.account_number, p.account_holder, p.cash_place, p.cash_receiver, p.detail, p.note].filter(Boolean).join(' / ')}</TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </>
                  ) : (
                    <TableRow className="bg-blue-50">
                      <TableCell className="w-20" />
                      <TableCell className="w-20" />
                      <TableCell className="w-20" />
                      <TableCell colSpan={5} className="text-center text-blue-700 font-bold py-4 text-lg">입금없음</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {summary && (
                <TableRow className="bg-blue-100 font-bold text-xl">
                  <TableCell className="border-none" colSpan={2}></TableCell>
                  <TableCell className="border-none text-center">총합계</TableCell>
                  <TableCell className="border-none text-center px-2 text-red-700">총매출: {summary.total_amount?.toLocaleString()}</TableCell>
                  <TableCell className="border-none text-center px-2 text-blue-700">총입금: {summary.total_paid?.toLocaleString()}</TableCell>
                  <TableCell className="border-none text-center px-2 text-yellow-700">총잔금: {summary.total_unpaid?.toLocaleString()}</TableCell>
                  <TableCell className="border-none" colSpan={2}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
} 