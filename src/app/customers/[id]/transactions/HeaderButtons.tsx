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

  return (
    <div className="flex gap-3 mb-4">
      <Button
        variant="outline"
        size="default"
        onClick={() => router.push('/transactions')}
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