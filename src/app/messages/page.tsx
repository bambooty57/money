'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Calendar, Send, XCircle, CheckCircle, Clock, Users, DollarSign, 
  AlertCircle, Play, RefreshCw, History 
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  totalArrears: number;
  transactionCount: number;
  isExcluded: boolean;
  exclusionReason?: string;
  excludedBy?: string;
  excludedAt?: string;
}

interface Stats {
  total: number;
  excluded: number;
  scheduled: number;
  totalAmount: number;
  excludedAmount: number;
  scheduledAmount: number;
}

interface HistoryItem {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  message: string;
  amount: number;
  sentAt: string;
  status: 'success' | 'failed' | 'pending';
  messageId?: string;
  errorMessage?: string;
  notificationType: string;
}

interface SchedulerRun {
  id: string;
  month: string;
  total_customer: number;
  excluded_count: number;
  sent_count: number;
  success_count: number;
  failed_count: number;
  executed_at: string;
  status: 'success' | 'partial' | 'failed';
}

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [currentMonth, setCurrentMonth] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [schedulerRuns, setSchedulerRuns] = useState<SchedulerRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [exclusionDialog, setExclusionDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [confirmSendDialog, setConfirmSendDialog] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [editingTemplate, setEditingTemplate] = useState('');
  const [sendDay, setSendDay] = useState(25);
  const [daySaveResult, setDaySaveResult] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaveResult, setTemplateSaveResult] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(month);
  }, []);

  useEffect(() => {
    if (currentMonth) {
      fetchScheduledCustomers();
      fetchHistory();
      fetchSchedulerRuns();
      fetchMessageTemplate();
    }
  }, [currentMonth]);

  const fetchScheduledCustomers = async () => {
    setLoading(true);
    try {
      // CDN/브라우저 캐시 우회 (제외/포함 변경 즉시 반영을 위해)
      const response = await fetch(`/api/solapi/scheduled?month=${currentMonth}&_t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        console.error('발송 예정 조회 서버 에러 status:', response.status);
        return;
      }
      const result = await response.json();
      if (result.success) {
        setCustomers(result.data.customers);
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('발송 예정 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/solapi/history?month=${currentMonth}`);
      const result = await response.json();
      if (result.success) {
        setHistory(result.data);
        setHistoryStats(result.stats);
      }
    } catch (error) {
      console.error('발송 이력 조회 오류:', error);
    }
  };

  const fetchSchedulerRuns = async () => {
    try {
      const response = await fetch(`/api/solapi/scheduler/runs?month=${currentMonth}`);
      const result = await response.json();
      if (result.success) {
        setSchedulerRuns(result.data);
      }
    } catch (error) {
      console.error('스케줄러 이력 조회 오류:', error);
    }
  };

  const fetchMessageTemplate = async () => {
    try {
      const response = await fetch(`/api/message-settings?_t=${Date.now()}`, { cache: 'no-store' });
      const result = await response.json();
      if (result.success) {
        setMessageTemplate(result.data.template);
        setEditingTemplate(result.data.template);
        if (result.data.sendDay) {
          setSendDay(result.data.sendDay);
        }
      }
    } catch (error) {
      console.error('메시지 템플릿 조회 오류:', error);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setTemplateSaveResult(null);
    try {
      const response = await fetch('/api/message-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: editingTemplate, sendDay }),
      });
      const result = await response.json();
      if (result.success) {
        setMessageTemplate(editingTemplate);
        setTemplateSaveResult('저장되었습니다.');
        setTimeout(() => setTemplateSaveResult(null), 3000);
      } else {
        setTemplateSaveResult('저장 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('템플릿 저장 오류:', error);
      setTemplateSaveResult('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendDayChange = async (newDay: number) => {
    setSendDay(newDay);
    setSavingDay(true);
    setDaySaveResult(null);
    try {
      const response = await fetch('/api/message-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: editingTemplate || messageTemplate, sendDay: newDay }),
      });
      const result = await response.json();
      if (result.success) {
        setDaySaveResult(`${newDay}일로 저장되었습니다.`);
        fetchScheduledCustomers();
        setTimeout(() => setDaySaveResult(null), 3000);
      } else {
        setDaySaveResult('저장 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('발송일 저장 오류:', error);
      setDaySaveResult('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingDay(false);
    }
  };

  const handleManualSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const response = await fetch('/api/solapi/scheduler/monthly', {
        method: 'POST',
      });
      const result = await response.json();
      setSendResult(result);
      
      // 데이터 새로고침
      await fetchScheduledCustomers();
      await fetchHistory();
      await fetchSchedulerRuns();
    } catch (error) {
      console.error('수동 발송 오류:', error);
      setSendResult({ success: false, message: '발송 중 오류가 발생했습니다.' });
    } finally {
      setSending(false);
      setConfirmSendDialog(false);
    }
  };

  const handleCheckboxChange = (customer: Customer, checked: boolean) => {
    if (checked) {
      handleInclude(customer.id);
    } else {
      setSelectedCustomer(customer);
      setExclusionReason('');
      setExclusionDialog(true);
    }
  };

  const handleExclude = async () => {
    if (!selectedCustomer) return;

    try {
      const response = await fetch('/api/solapi/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          month: currentMonth,
          reason: exclusionReason,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setExclusionDialog(false);
        setExclusionReason('');
        setSelectedCustomer(null);
        fetchScheduledCustomers();
      } else {
        alert(result.error || '제외 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('제외 처리 오류:', error);
      alert('제외 처리 중 오류가 발생했습니다.');
    }
  };

  const handleInclude = async (customerId: string) => {
    try {
      const response = await fetch(`/api/solapi/exclusions?customerId=${customerId}&month=${currentMonth}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        fetchScheduledCustomers();
      } else {
        alert(result.error || '포함 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('포함 처리 오류:', error);
      alert('포함 처리 중 오류가 발생했습니다.');
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    return (amount ?? 0).toLocaleString() + '원';
  };

  const createPreviewMessage = (customer: Customer) => {
    const [year, month] = currentMonth.split('-');
    const amountStr = (customer.totalArrears ?? 0).toLocaleString();
    return editingTemplate
      .replace('{customerName}', customer.name)
      .replace('{month}', String(parseInt(month)))
      .replace('{day}', String(sendDay))
      .replace('{amount}', amountStr);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">성공</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">실패</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500">부분 성공</Badge>;
      case 'pending':
        return <Badge className="bg-blue-500">대기</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">문자메시지 관리</h1>
          <p className="text-gray-600 mt-1">월별 미수금 알림 발송 관리</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <Input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">전체 대상</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.total}명</p>
                  <p className="text-sm text-gray-500">{formatCurrency(stats.totalAmount)}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">발송 예정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.scheduled}명</p>
                  <p className="text-sm text-gray-500">{formatCurrency(stats.scheduledAmount)}</p>
                </div>
                <Send className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">제외됨</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.excluded}명</p>
                  <p className="text-sm text-gray-500">{formatCurrency(stats.excludedAmount)}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">발송일 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <select
                      value={sendDay}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSendDay(val);
                        handleSendDayChange(val);
                      }}
                      className="text-2xl font-bold bg-white border border-purple-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer text-purple-900 hover:bg-purple-50"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}일
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => handleSendDayChange(sendDay)}
                      disabled={savingDay}
                      variant="outline"
                      size="sm"
                      className="border-purple-300 text-purple-700 hover:bg-purple-100 font-semibold"
                    >
                      {savingDay ? '저장 중...' : '저장'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {daySaveResult ? (
                      <span className={daySaveResult.includes('실패') ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                        {daySaveResult}
                      </span>
                    ) : (
                      '매월 정기 발송일 (선택 시 자동 저장)'
                    )}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 발송 메시지 템플릿 편집 */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="py-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg">발송 메시지 설정</h3>
            <p className="text-sm text-gray-600">
              변수: <code className="bg-gray-200 px-1 rounded">{'{customerName}'}</code> 고객명, 
              <code className="bg-gray-200 px-1 rounded ml-1">{'{month}'}</code> 월, 
              <code className="bg-gray-200 px-1 rounded ml-1">{'{day}'}</code> 일, 
              <code className="bg-gray-200 px-1 rounded ml-1">{'{amount}'}</code> 미수금액
            </p>
          </div>
          <Textarea
            value={editingTemplate}
            onChange={(e) => setEditingTemplate(e.target.value)}
            rows={3}
            className="bg-white text-sm"
            placeholder="발송할 메시지를 입력하세요"
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {editingTemplate.length}자 {editingTemplate.length > 90 ? '(LMS)' : '(SMS)'}
            </div>
            <div className="flex items-center gap-2">
              {templateSaveResult && (
                <span className={`text-sm px-2 py-1 rounded ${
                  templateSaveResult.includes('실패') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {templateSaveResult}
                </span>
              )}
              <Button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || editingTemplate === messageTemplate}
                variant="outline"
                size="sm"
              >
                {savingTemplate ? '저장 중...' : '템플릿 저장'}
              </Button>
              <Button
                onClick={() => setConfirmSendDialog(true)}
                disabled={sending || !stats || stats.scheduled === 0}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    지금 발송 ({stats?.scheduled || 0}명)
                  </>
                )}
              </Button>
            </div>
          </div>
          {sendResult && (
            <div className={`text-sm px-3 py-2 rounded ${sendResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {sendResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 최근 스케줄러 실행 이력 */}
      {schedulerRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              최근 발송 이력 (자동/수동)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schedulerRuns.slice(0, 5).map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(run.status)}
                    <div>
                      <p className="font-medium">{run.month} 발송</p>
                      <p className="text-sm text-gray-600">
                        전체 {run.total_customer}명 / 발송 {run.sent_count}명 / 
                        성공 {run.success_count}명 / 실패 {run.failed_count}명
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{formatDate(run.executed_at)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scheduled">발송 예정</TabsTrigger>
          <TabsTrigger value="history">발송 이력</TabsTrigger>
        </TabsList>

        {/* 발송 예정 탭 */}
        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>발송 예정 고객</CardTitle>
                <CardDescription>
                  {currentMonth} 발송 대상 고객 목록입니다. 체크박스를 해제하면 발송 대상에서 제외되며, 다시 선택하기 전까지 다음 달에도 제외 상태가 유지됩니다.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  발송 대상 고객이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        customer.isExcluded ? 'bg-red-50 border-red-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <Checkbox
                          checked={!customer.isExcluded}
                          onCheckedChange={(checked) => handleCheckboxChange(customer, checked as boolean)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-lg">{customer.name}</span>
                            {customer.isExcluded && (
                              <Badge variant="destructive">제외됨</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span>{customer.mobile}</span>
                            <span className="mx-2">*</span>
                            <span className="font-medium text-red-600">
                              {formatCurrency(customer.totalArrears)}
                            </span>
                            <span className="mx-2">*</span>
                            <span>{customer.transactionCount}건</span>
                          </div>
                          {/* 발송 메시지 미리보기 */}
                          <div className={`mt-2 p-3 rounded-md text-sm border ${
                            customer.isExcluded 
                              ? 'bg-gray-100 border-gray-300 text-gray-500' 
                              : 'bg-blue-50 border-blue-200 text-gray-700'
                          }`}>
                            <span className="font-medium text-xs text-blue-600 block mb-1">발송 메시지</span>
                            {createPreviewMessage(customer)}
                          </div>
                          {customer.isExcluded && customer.exclusionReason && (
                            <div className="text-sm text-red-600 mt-1">
                              사유: {customer.exclusionReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 발송 이력 탭 */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>발송 이력</CardTitle>
              <CardDescription>
                {currentMonth} 발송된 메시지 이력입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyStats && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{historyStats.total}</p>
                    <p className="text-sm text-gray-600">전체</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{historyStats.success}</p>
                    <p className="text-sm text-gray-600">성공</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{historyStats.failed}</p>
                    <p className="text-sm text-gray-600">실패</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(historyStats.totalAmount)}
                    </p>
                    <p className="text-sm text-gray-600">총액</p>
                  </div>
                </div>
              )}

              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  발송 이력이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.customerName}</span>
                          {getStatusBadge(item.status)}
                          <Badge variant="outline" className="text-xs">
                            {item.notificationType === 'monthly' ? '자동' : '수동'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>{item.mobile}</span>
                          <span className="mx-2">*</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="mx-2">*</span>
                          <span>{formatDate(item.sentAt)}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {item.message}
                        </div>
                        {item.errorMessage && (
                          <div className="text-sm text-red-600 mt-1">
                            오류: {item.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 확인 발송 다이얼로그 */}
      <Dialog open={confirmSendDialog} onOpenChange={setConfirmSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문자 발송 확인</DialogTitle>
            <DialogDescription>
              발송 예정 고객 {stats?.scheduled || 0}명에게 문자를 발송합니다. 발송 후 취소는 불가능합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">전체 대상:</span>
                <span className="font-medium">{stats?.total || 0}명</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">제외:</span>
                <span className="font-medium text-red-600">{stats?.excluded || 0}명</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">발송 대상:</span>
                <span className="font-bold text-green-600">{stats?.scheduled || 0}명</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendDialog(false)}>
              취소
            </Button>
            <Button 
              onClick={handleManualSend} 
              disabled={sending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  발송하기
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 제외 사유 입력 다이얼로그 */}
      <Dialog open={exclusionDialog} onOpenChange={setExclusionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발송 대상 제외</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name} 고객을 발송 대상에서 제외합니다. 제외는 체크박스를 다시 선택해 해제하기 전까지 다음 달에도 자동으로 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">제외 사유 (선택)</Label>
              <Textarea
                id="reason"
                placeholder="제외 사유를 입력하세요"
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusionDialog(false)}>
              취소
            </Button>
            <Button onClick={handleExclude} className="bg-red-600 hover:bg-red-700">
              제외하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
