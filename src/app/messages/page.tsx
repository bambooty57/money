'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Send, XCircle, CheckCircle, Clock, Users, DollarSign, AlertCircle } from 'lucide-react';

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

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [currentMonth, setCurrentMonth] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [exclusionDialog, setExclusionDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');
  const [excludedBy, setExcludedBy] = useState('');

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(month);
  }, []);

  useEffect(() => {
    if (currentMonth) {
      fetchScheduledCustomers();
      fetchHistory();
    }
  }, [currentMonth]);

  const fetchScheduledCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/solapi/scheduled?month=${currentMonth}`);
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const scheduledIds = customers.filter(c => !c.isExcluded).map(c => c.id);
      setSelectedCustomers(new Set(scheduledIds));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
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
          excludedBy: excludedBy,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setExclusionDialog(false);
        setExclusionReason('');
        setExcludedBy('');
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

  const openExclusionDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setExclusionDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + '원';
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
      case 'pending':
        return <Badge className="bg-yellow-500">대기</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📱 문자메시지 관리</h1>
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
              <CardTitle className="text-sm font-medium text-gray-600">발송일</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">25일</p>
                  <p className="text-sm text-gray-500">매월</p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>발송 예정 고객</CardTitle>
                  <CardDescription>
                    {currentMonth} 발송 대상 고객 목록입니다. 체크박스로 선택/제외할 수 있습니다.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedCustomers.size > 0 && selectedCustomers.size === customers.filter(c => !c.isExcluded).length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all">전체 선택</Label>
                </div>
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
                          checked={!customer.isExcluded && selectedCustomers.has(customer.id)}
                          onCheckedChange={(checked) => handleSelectCustomer(customer.id, checked as boolean)}
                          disabled={customer.isExcluded}
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
                            <span className="mx-2">•</span>
                            <span className="font-medium text-red-600">
                              {formatCurrency(customer.totalArrears)}
                            </span>
                            <span className="mx-2">•</span>
                            <span>{customer.transactionCount}건</span>
                          </div>
                          {customer.isExcluded && customer.exclusionReason && (
                            <div className="text-sm text-red-600 mt-1">
                              사유: {customer.exclusionReason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        {customer.isExcluded ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInclude(customer.id)}
                            className="text-green-600 border-green-600 hover:bg-green-50"
                          >
                            포함하기
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExclusionDialog(customer)}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            제외하기
                          </Button>
                        )}
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
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>{item.mobile}</span>
                          <span className="mx-2">•</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="mx-2">•</span>
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

      {/* 제외 사유 입력 다이얼로그 */}
      <Dialog open={exclusionDialog} onOpenChange={setExclusionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발송 대상 제외</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name} 고객을 {currentMonth} 발송 대상에서 제외합니다.
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
            <div>
              <Label htmlFor="excludedBy">처리자 (선택)</Label>
              <Input
                id="excludedBy"
                placeholder="처리자 이름을 입력하세요"
                value={excludedBy}
                onChange={(e) => setExcludedBy(e.target.value)}
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
