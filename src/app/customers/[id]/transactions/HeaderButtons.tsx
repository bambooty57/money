"use client";
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';

export default function HeaderButtons() {
  const router = useRouter();

  const handlePdfExport = () => {
    // TransactionDetailClient에 PDF 내보내기 이벤트 전송
    window.dispatchEvent(new CustomEvent('exportPdf'));
  };

  const handleBackToTransactions = () => {
    // 검색 상태를 초기화하고 거래관리 페이지로 이동
    router.push('/transactions?clear=1');
  };

  return (
    <div className="flex gap-3 mb-4">
      <Button
        variant="outline"
        size="default"
        onClick={handleBackToTransactions}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        거래관리로 돌아가기
      </Button>
      <Button
        variant="default"
        size="default"
        onClick={handlePdfExport}
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        PDF로 내보내기
      </Button>
    </div>
  );
} 