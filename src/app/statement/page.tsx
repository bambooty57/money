"use client";

import { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

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
        적요: tx.description || "",
        "대변(매출)": tx.amount || 0,
        "차변(입금)": tx.paid_amount || 0,
        잔액: tx.unpaid_amount || 0,
        비고: tx.note || "",
      })),
      {
        일자: "합계",
        적요: "",
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

  // 4. 프린트
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-lg mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold text-blue-800 flex items-center gap-3 mb-8">
          📑 거래명세서
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
          <Button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-lg font-bold">프린트</Button>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          {!selectedCustomer && <p className="text-xl text-gray-500">고객을 선택하세요.</p>}
          {loading && <p className="text-xl text-blue-600">로딩 중...</p>}
          {selectedCustomer && !loading && (
            <>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{customerName} 거래명세서</h2>
              <Table>
                <TableHeader className="bg-gray-100 text-lg">
                  <TableRow>
                    <TableHead>일자</TableHead>
                    <TableHead>거래명</TableHead>
                    <TableHead>적요</TableHead>
                    <TableHead>대변(매출)</TableHead>
                    <TableHead>차변(입금)</TableHead>
                    <TableHead>잔액</TableHead>
                    <TableHead>비고</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-lg">
                  {transactions.map((tx) => (
                    <>
                      <TableRow key={tx.id}>
                        <TableCell>{tx.created_at?.slice(0, 10) || ""}</TableCell>
                        <TableCell>{tx.type || ""}</TableCell>
                        <TableCell>{tx.description || ""}</TableCell>
                        <TableCell className="text-red-700 font-semibold">{tx.amount?.toLocaleString() || ""}</TableCell>
                        <TableCell className="text-blue-700 font-semibold">{tx.paid_amount?.toLocaleString() || ""}</TableCell>
                        <TableCell className="text-yellow-700 font-semibold">{tx.unpaid_amount?.toLocaleString() || ""}</TableCell>
                        <TableCell>{tx.note || ""}</TableCell>
                      </TableRow>
                      {/* 입금내역 하위 표 */}
                      <TableRow>
                        <TableCell colSpan={7} className="p-0 bg-gray-50">
                          <div className="pl-6 pb-2 pt-2">
                            <div className="font-semibold text-blue-800 mb-1">입금내역</div>
                            <Table className="w-auto border border-blue-200">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-center border border-gray-300">입금일</TableHead>
                                  <TableHead className="text-center border border-gray-300">금액</TableHead>
                                  <TableHead className="text-center border border-gray-300">입금방법</TableHead>
                                  <TableHead className="text-center border border-gray-300">입금자</TableHead>
                                  <TableHead className="text-center border border-gray-300">비고</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
                                  tx.payments.map((p: any, idx: number) => (
                                    <TableRow key={p.id || idx}>
                                      <TableCell className="p-6 border border-gray-300">{p.paid_at?.slice(0, 10) || ""}</TableCell>
                                      <TableCell className="p-6 text-blue-700 font-semibold border border-gray-300">{p.amount?.toLocaleString() || ""}</TableCell>
                                      <TableCell className="p-6 border border-gray-300">{p.method || ""}</TableCell>
                                      <TableCell className="p-6 border border-gray-300">{p.payer_name || ""}</TableCell>
                                      <TableCell className="p-6 border border-gray-300">
                                        {[p.bank_name, p.account_number, p.account_holder, p.cash_place, p.cash_receiver, p.detail, p.note].filter(Boolean).join(' / ')}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-gray-400 text-center border border-gray-300">입금내역 없음</TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    </>
                  ))}
                  {/* 합계 행 */}
                  {summary && (
                    <TableRow className="bg-blue-50 font-bold">
                      <TableCell>합계</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-red-700">{summary.total_amount?.toLocaleString()}</TableCell>
                      <TableCell className="text-blue-700">{summary.total_paid?.toLocaleString()}</TableCell>
                      <TableCell className="text-yellow-700">{summary.total_unpaid?.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 