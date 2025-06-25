#!/usr/bin/env node

/**
 * 스키마 체크 스크립트
 * Supabase 데이터베이스 스키마와 TypeScript 타입의 동기화를 확인합니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

function log(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, COLORS.GREEN);
}

function logError(message) {
  log(`❌ ${message}`, COLORS.RED);
}

function logWarning(message) {
  log(`⚠️  ${message}`, COLORS.YELLOW);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, COLORS.BLUE);
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    logSuccess(`${description} 파일이 존재합니다: ${filePath}`);
    return true;
  } else {
    logError(`${description} 파일이 없습니다: ${filePath}`);
    return false;
  }
}

function checkTypeScript() {
  logInfo('TypeScript 타입 체크 중...');
  
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    logSuccess('TypeScript 타입 체크 통과');
    return true;
  } catch (error) {
    logError('TypeScript 타입 오류 발견:');
    console.log(error.stdout?.toString() || error.message);
    return false;
  }
}

function checkSupabaseTypes() {
  const supabaseTypesPath = path.join(process.cwd(), 'src/types/supabase.ts');
  const databaseTypesPath = path.join(process.cwd(), 'src/types/database.ts');
  
  logInfo('Supabase 타입 파일 체크 중...');
  
  const supabaseExists = checkFileExists(supabaseTypesPath, 'Supabase 타입');
  const databaseExists = checkFileExists(databaseTypesPath, '데이터베이스 타입');
  
  if (!supabaseExists || !databaseExists) {
    logWarning('일부 타입 파일이 누락되었습니다.');
    return false;
  }
  
  // 파일 크기 체크 (빈 파일인지 확인)
  const supabaseStats = fs.statSync(supabaseTypesPath);
  if (supabaseStats.size < 100) {
    logWarning('Supabase 타입 파일이 비어있거나 너무 작습니다.');
    return false;
  }
  
  logSuccess('모든 타입 파일이 정상입니다.');
  return true;
}

function checkValidators() {
  const validatorsPath = path.join(process.cwd(), 'src/lib/schema-validators.ts');
  
  logInfo('스키마 검증자 체크 중...');
  
  if (!checkFileExists(validatorsPath, '스키마 검증자')) {
    return false;
  }
  
  // 검증자 파일에서 중요한 export들이 있는지 확인
  const validatorsContent = fs.readFileSync(validatorsPath, 'utf8');
  const requiredExports = [
    'validateCustomer',
    'validateTransaction', 
    'validateLegalAction',
    'CustomerSchema',
    'TransactionSchema'
  ];
  
  const missingExports = requiredExports.filter(exportName => 
    !validatorsContent.includes(`${exportName}`) && 
    !validatorsContent.includes(`export.*${exportName}`)
  );
  
  if (missingExports.length > 0) {
    logError(`검증자 파일에서 누락된 exports: ${missingExports.join(', ')}`);
    return false;
  }
  
  logSuccess('스키마 검증자가 정상입니다.');
  return true;
}

function checkSupabaseClient() {
  const supabaseClientPath = path.join(process.cwd(), 'src/lib/supabase.ts');
  
  logInfo('Supabase 클라이언트 체크 중...');
  
  if (!checkFileExists(supabaseClientPath, 'Supabase 클라이언트')) {
    return false;
  }
  
  const clientContent = fs.readFileSync(supabaseClientPath, 'utf8');
  
  // 타입 안전성 체크
  if (!clientContent.includes('Database')) {
    logWarning('Supabase 클라이언트에 Database 타입이 적용되지 않았습니다.');
    return false;
  }
  
  // 필수 함수들 체크
  const requiredFunctions = ['typedQuery', 'SchemaChecker', 'storageHelper'];
  const missingFunctions = requiredFunctions.filter(func => 
    !clientContent.includes(func)
  );
  
  if (missingFunctions.length > 0) {
    logError(`Supabase 클라이언트에서 누락된 함수들: ${missingFunctions.join(', ')}`);
    return false;
  }
  
  logSuccess('Supabase 클라이언트가 정상입니다.');
  return true;
}

function checkEnvironmentVariables() {
  logInfo('환경 변수 체크 중...');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(envVar => 
    !process.env[envVar]
  );
  
  if (missingEnvVars.length > 0) {
    logWarning(`누락된 환경 변수: ${missingEnvVars.join(', ')}`);
    logInfo('프로덕션 환경에서는 이 환경 변수들이 필요합니다.');
    return false;
  }
  
  logSuccess('모든 필수 환경 변수가 설정되었습니다.');
  return true;
}

function generateReport(results) {
  log('\n' + '='.repeat(50), COLORS.BOLD);
  log('스키마 체크 리포트', COLORS.BOLD);
  log('='.repeat(50), COLORS.BOLD);
  
  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([check, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? COLORS.GREEN : COLORS.RED;
    log(`${check}: ${status}`, color);
  });
  
  log(`\n총 체크: ${totalChecks}, 통과: ${passedChecks}, 실패: ${totalChecks - passedChecks}`, COLORS.BOLD);
  
  if (passedChecks === totalChecks) {
    logSuccess('\n모든 체크를 통과했습니다! 🎉');
    return 0;
  } else {
    logError(`\n${totalChecks - passedChecks}개의 체크가 실패했습니다.`);
    logInfo('문제를 해결한 후 다시 실행해주세요.');
    return 1;
  }
}

function main() {
  log('🔍 스키마 및 타입 안전성 체크를 시작합니다...', COLORS.BOLD);
  
  const results = {
    'TypeScript 타입 체크': checkTypeScript(),
    'Supabase 타입 파일': checkSupabaseTypes(),
    '스키마 검증자': checkValidators(),
    'Supabase 클라이언트': checkSupabaseClient(),
    '환경 변수': checkEnvironmentVariables()
  };
  
  const exitCode = generateReport(results);
  process.exit(exitCode);
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
  main();
}

module.exports = {
  checkTypeScript,
  checkSupabaseTypes,
  checkValidators,
  checkSupabaseClient,
  checkEnvironmentVariables
}; 