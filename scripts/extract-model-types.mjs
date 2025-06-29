// 기종.형식명.jpg 파일명에서 기종/형식명 추출 후 Supabase DB에 저장
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ROOT_DIR = '.';
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif'];

async function main() {
  const files = fs.readdirSync(ROOT_DIR);
  const modelTypeSet = new Set();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;
    // 1) 기종.형식명.jpg
    const match = file.match(/^(.+?)\.(.+?)\.(jpg|jpeg|png|gif)$/i);
    if (match) {
      const model = match[1].trim();
      const type = match[2].trim();
      modelTypeSet.add(`${model}|${type}`);
      continue;
    }
    // 2) 기종1.jpg (형식명 없음)
    const match2 = file.match(/^(.+?)\.(jpg|jpeg|png|gif)$/i);
    if (match2) {
      const model = match2[1].trim();
      const type = '';
      modelTypeSet.add(`${model}|${type}`);
    }
  }

  if (modelTypeSet.size === 0) {
    console.log('⚠️ 추출된 기종/형식명이 없습니다. 파일명을 확인하세요.');
    return;
  }

  // models_types 테이블 존재 여부 확인
  const { error: tableError } = await supabase.from('models_types').select('*').limit(1);
  if (tableError) {
    console.error('❌ models_types 테이블이 존재하지 않거나 권한이 없습니다. 테이블을 먼저 생성하세요.');
    return;
  }

  // 중복 없이 DB에 저장
  for (const item of modelTypeSet) {
    const [model, type] = item.split('|');
    // 이미 존재하는지 확인
    const { data: exists, error } = await supabase
      .from('models_types')
      .select('id')
      .eq('model', model)
      .eq('type', type)
      .maybeSingle();
    if (error) {
      console.error(`❌ DB 조회 오류: ${model}/${type}`, error.message);
      continue;
    }
    if (exists) {
      console.log(`ℹ️ 이미 존재: ${model} / ${type}`);
      continue;
    }
    // 신규 저장
    const { error: insertError } = await supabase
      .from('models_types')
      .insert([{ model, type }]);
    if (insertError) {
      console.error(`❌ 저장 실패: ${model} / ${type}`, insertError.message);
    } else {
      console.log(`✅ 저장 완료: ${model} / ${type}`);
    }
  }

  console.log('🎉 기종/형식명 추출 및 저장 완료!');
}

main(); 