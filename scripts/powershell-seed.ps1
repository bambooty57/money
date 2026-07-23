# PowerShell을 사용한 더미 데이터 생성 스크립트

Write-Host "🌱 PowerShell을 통한 더미 데이터 생성 시작..." -ForegroundColor Green

# API 베이스 URL
$apiBase = "http://localhost:3000/api"

# 고객 데이터 배열
$customers = @(
    @{
        name = "김농민"
        phone = "010-1234-5678"
        business_no = "123-45-67890"
        address = "경기도 안산시 단원구 농민로 123"
        email = "kim@example.com"
        grade = "A"
    },
    @{
        name = "(주)그린센터"
        phone = "010-2345-6789"
        business_no = "234-56-78901"
        address = "서울시 강남구 테헤란로 456"
        email = "center@green.co.kr"
        grade = "B"
    },
    @{
        name = "안산시청"
        phone = "031-481-2000"
        business_no = "345-67-89012"
        address = "경기도 안산시 단원구 시청로 789"
        email = "contact@ansan.go.kr"
        grade = "S"
    },
    @{
        name = "박개인사업자"
        phone = "010-4567-8901"
        business_no = "456-78-90123"
        address = "인천시 남동구 산업로 101"
        email = "park@business.com"
        grade = "C"
    },
    @{
        name = "최농장"
        phone = "010-5678-9012"
        business_no = "567-89-01234"
        address = "충남 천안시 동남구 농장길 202"
        email = "choi@farm.kr"
        grade = "A"
    }
)

# 기존 고객 데이터 확인
try {
    Write-Host "📊 기존 고객 데이터 확인 중..." -ForegroundColor Yellow
    $existingCustomers = Invoke-RestMethod -Uri "$apiBase/customers" -Method GET
    Write-Host "✅ 기존 고객 수: $($existingCustomers.Count)명" -ForegroundColor Green
}
catch {
    Write-Host "❌ API 연결 실패: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 새 고객 데이터 생성
$createdCustomers = @()
Write-Host "`n👥 새 고객 데이터 생성 중..." -ForegroundColor Yellow

foreach ($customer in $customers) {
    try {
        $jsonBody = $customer | ConvertTo-Json -Depth 3
        $response = Invoke-RestMethod -Uri "$apiBase/customers" -Method POST -Body $jsonBody -ContentType "application/json"
        
        if ($response.data) {
            $createdCustomers += $response.data
            Write-Host "✅ $($customer.name) 생성 완료" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️ $($customer.name) 생성 응답이 예상과 다름" -ForegroundColor Yellow
        }
        
        # API 요청 간격 조절
        Start-Sleep -Milliseconds 200
    }
    catch {
        Write-Host "❌ $($customer.name) 생성 실패: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n✅ 총 $($createdCustomers.Count)개 고객 데이터 생성 완료" -ForegroundColor Green

# 거래 데이터 생성 (고객이 생성된 경우에만)
if ($createdCustomers.Count -gt 0) {
    Write-Host "`n💰 거래 데이터 생성 중..." -ForegroundColor Yellow
    
    # 거래 데이터 템플릿
    $transactionTemplates = @(
        @{ customer_index = 0; type = "비료 구매"; amount = 150000; status = "unpaid"; description = "가을 작물용 복합비료 10포" },
        @{ customer_index = 0; type = "농약 구매"; amount = 80000; status = "paid"; description = "살충제 및 살균제" },
        @{ customer_index = 1; type = "대량 구매"; amount = 2500000; status = "unpaid"; description = "센터 전체 물량 공급계약" },
        @{ customer_index = 1; type = "컨설팅 서비스"; amount = 500000; status = "paid"; description = "농업 기술 컨설팅" },
        @{ customer_index = 2; type = "공공사업"; amount = 5000000; status = "paid"; description = "시민 텃밭 조성 사업" },
        @{ customer_index = 3; type = "개별 주문"; amount = 300000; status = "unpaid"; description = "소규모 농자재 구매" },
        @{ customer_index = 4; type = "시설 자재"; amount = 1200000; status = "paid"; description = "비닐하우스 자재 구매" }
    )
    
    $createdTransactions = @()
    
    foreach ($template in $transactionTemplates) {
        if ($template.customer_index -lt $createdCustomers.Count) {
            $transaction = @{
                customer_id = $createdCustomers[$template.customer_index].id
                type = $template.type
                amount = $template.amount
                status = $template.status
                description = $template.description
            }
            
            try {
                $jsonBody = $transaction | ConvertTo-Json -Depth 3
                $response = Invoke-RestMethod -Uri "$apiBase/transactions" -Method POST -Body $jsonBody -ContentType "application/json"
                
                if ($response.data) {
                    $createdTransactions += $response.data
                    $customerName = $createdCustomers[$template.customer_index].name
                    Write-Host "✅ $customerName - $($template.type) 생성 완료" -ForegroundColor Green
                }
                
                Start-Sleep -Milliseconds 200
            }
            catch {
                Write-Host "❌ 거래 데이터 생성 실패: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "`n✅ 총 $($createdTransactions.Count)개 거래 데이터 생성 완료" -ForegroundColor Green
    
    # 미수금 계산
    $unpaidTransactions = $transactionTemplates | Where-Object { $_.status -eq "unpaid" }
    $totalUnpaid = ($unpaidTransactions | Measure-Object -Property amount -Sum).Sum
    
    Write-Host "`n💳 미수금 현황:" -ForegroundColor Cyan
    Write-Host "   🔴 미수금 총액: $($totalUnpaid.ToString('N0'))원" -ForegroundColor Red
    Write-Host "   📊 미수금 건수: $($unpaidTransactions.Count)건" -ForegroundColor Yellow
}

# 최종 요약
Write-Host "`n🎉 더미 데이터 생성 완료!" -ForegroundColor Green
Write-Host "📋 생성 결과:" -ForegroundColor Cyan
Write-Host "   👥 새 고객: $($createdCustomers.Count)명" -ForegroundColor White
if ($createdTransactions) {
    Write-Host "   💰 새 거래: $($createdTransactions.Count)건" -ForegroundColor White
}

Write-Host "`n🚀 웹 애플리케이션에서 확인해보세요!" -ForegroundColor Green
Write-Host "   - 고객 목록: http://localhost:3000/customers" -ForegroundColor Blue
Write-Host "   - 거래 내역: http://localhost:3000/transactions" -ForegroundColor Blue
Write-Host "   - 법적 조치: http://localhost:3000/legal-actions" -ForegroundColor Blue 