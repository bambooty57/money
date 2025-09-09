import { z } from 'zod';

// 기본 스키마들
export const CustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, '고객명은 필수입니다'),
  business_number: z.string().nullable().optional(),
  representative_name: z.string().nullable().optional(),
  customer_type: z.enum(['일반농민', '센터등 사업자', '관공서', '기타'], {
    errorMap: () => ({ message: '올바른 고객 유형을 선택해주세요' })
  }).optional(),
  phone: z.string().min(1, '전화번호는 필수입니다'),
  email: z.string().email('올바른 이메일 형식이 아닙니다').nullable(),
  address: z.string().nullable(),
  grade: z.string().min(1, '등급은 필수입니다').optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CustomerInsertSchema = z.object({
  name: z.string().min(1, '고객명은 필수입니다'),
  business_number: z.string().nullable().optional(),
  representative_name: z.string().nullable().optional(),
  customer_type: z.enum(['일반농민', '센터등 사업자', '관공서', '기타']).optional(),
  phone: z.string().min(1, '전화번호는 필수입니다'),
  email: z.string().email('올바른 이메일 형식이 아닙니다').nullable().optional(),
  address: z.string().nullable().optional(),
  grade: z.string().min(1, '등급은 필수입니다').optional(),
});

export const CustomerUpdateSchema = z.object({
  name: z.string().min(1, '고객명은 필수입니다').optional(),
  business_number: z.string().nullable().optional(),
  representative_name: z.string().nullable().optional(),
  customer_type: z.enum(['일반농민', '센터등 사업자', '관공서', '기타']).optional(),
  phone: z.string().min(1, '전화번호는 필수입니다').optional(),
  email: z.string().email('올바른 이메일 형식이 아닙니다').nullable().optional(),
  address: z.string().nullable().optional(),
  grade: z.string().min(1, '등급은 필수입니다').optional(),
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  type: z.string().min(1, '거래 유형은 필수입니다'),
  amount: z.number().min(0, '금액은 0 이상이어야 합니다'),
  status: z.enum(['paid', 'unpaid'], {
    errorMap: () => ({ message: '결제 상태는 paid 또는 unpaid여야 합니다' })
  }),
  description: z.string().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const TransactionInsertSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  type: z.string().min(1, '거래 유형은 필수입니다'),
  amount: z.number().min(0, '금액은 0 이상이어야 합니다'),
  status: z.enum(['paid', 'unpaid']),
  description: z.string().nullable().optional(),
});

export const TransactionUpdateSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다').optional(),
  type: z.string().min(1, '거래 유형은 필수입니다').optional(),
  amount: z.number().min(0, '금액은 0 이상이어야 합니다').optional(),
  status: z.enum(['paid', 'unpaid']).optional(),
  description: z.string().nullable().optional(),
});

export const LegalActionSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  type: z.string().min(1, '법적 조치 유형은 필수입니다'),
  description: z.string().min(1, '설명은 필수입니다'),
  status: z.enum(['completed', 'in_progress'], {
    errorMap: () => ({ message: '상태는 completed 또는 in_progress여야 합니다' })
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const LegalActionInsertSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  type: z.string().min(1, '법적 조치 유형은 필수입니다'),
  description: z.string().min(1, '설명은 필수입니다'),
  status: z.enum(['completed', 'in_progress']),
});

export const LegalActionUpdateSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다').optional(),
  type: z.string().min(1, '법적 조치 유형은 필수입니다').optional(),
  description: z.string().min(1, '설명은 필수입니다').optional(),
  status: z.enum(['completed', 'in_progress']).optional(),
});

export const ContactSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  type: z.string().min(1, '연락 유형은 필수입니다'),
  content: z.string().min(1, '내용은 필수입니다'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ContactInsertSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  type: z.string().min(1, '연락 유형은 필수입니다'),
  content: z.string().min(1, '내용은 필수입니다'),
});

export const ContactUpdateSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다').optional(),
  type: z.string().min(1, '연락 유형은 필수입니다').optional(),
  content: z.string().min(1, '내용은 필수입니다').optional(),
});

export const FileSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  name: z.string().min(1, '파일명은 필수입니다'),
  type: z.string().min(1, '파일 유형은 필수입니다'),
  url: z.string().url('올바른 URL 형식이 아닙니다'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const FileInsertSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다'),
  name: z.string().min(1, '파일명은 필수입니다'),
  type: z.string().min(1, '파일 유형은 필수입니다'),
  url: z.string().url('올바른 URL 형식이 아닙니다'),
});

export const FileUpdateSchema = z.object({
  customer_id: z.string().uuid('올바른 고객 ID가 아닙니다').optional(),
  name: z.string().min(1, '파일명은 필수입니다').optional(),
  type: z.string().min(1, '파일 유형은 필수입니다').optional(),
  url: z.string().url('올바른 URL 형식이 아닙니다').optional(),
});

// 검증 함수들
export function validateCustomer(data: unknown) {
  return CustomerSchema.parse(data);
}

export function validateCustomerInsert(data: unknown) {
  return CustomerInsertSchema.parse(data);
}

export function validateCustomerUpdate(data: unknown) {
  return CustomerUpdateSchema.parse(data);
}

export function validateTransaction(data: unknown) {
  return TransactionSchema.parse(data);
}

export function validateTransactionInsert(data: unknown) {
  return TransactionInsertSchema.parse(data);
}

export function validateTransactionUpdate(data: unknown) {
  return TransactionUpdateSchema.parse(data);
}

export function validateLegalAction(data: unknown) {
  return LegalActionSchema.parse(data);
}

export function validateLegalActionInsert(data: unknown) {
  return LegalActionInsertSchema.parse(data);
}

export function validateLegalActionUpdate(data: unknown) {
  return LegalActionUpdateSchema.parse(data);
}

export function validateContact(data: unknown) {
  return ContactSchema.parse(data);
}

export function validateContactInsert(data: unknown) {
  return ContactInsertSchema.parse(data);
}

export function validateContactUpdate(data: unknown) {
  return ContactUpdateSchema.parse(data);
}

export function validateFile(data: unknown) {
  return FileSchema.parse(data);
}

export function validateFileInsert(data: unknown) {
  return FileInsertSchema.parse(data);
}

export function validateFileUpdate(data: unknown) {
  return FileUpdateSchema.parse(data);
}

// 안전한 검증 함수들 (에러를 throw하지 않음)
export function safeValidateCustomer(data: unknown) {
  const result = CustomerSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    error: result.success ? null : result.error,
  };
}

export function safeValidateTransaction(data: unknown) {
  const result = TransactionSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    error: result.success ? null : result.error,
  };
}

export function safeValidateLegalAction(data: unknown) {
  const result = LegalActionSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    error: result.success ? null : result.error,
  };
}

// 배열 검증 함수들
export function validateCustomers(data: unknown) {
  return z.array(CustomerSchema).parse(data);
}

export function validateTransactions(data: unknown) {
  return z.array(TransactionSchema).parse(data);
}

export function validateLegalActions(data: unknown) {
  return z.array(LegalActionSchema).parse(data);
}

// API 응답 검증을 위한 래퍼 스키마들
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.nullable(),
    error: z.object({
      message: z.string(),
      details: z.unknown().optional(),
    }).nullable(),
    count: z.number().optional(),
  });

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    count: z.number(),
    error: z.object({
      message: z.string(),
      details: z.unknown().optional(),
    }).nullable(),
  });

// 에러 처리 헬퍼
export function formatZodError(error: z.ZodError) {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

export function createValidationError(error: z.ZodError) {
  return {
    type: 'VALIDATION_ERROR',
    message: '입력 데이터가 올바르지 않습니다',
    details: formatZodError(error),
  };
} 