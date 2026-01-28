/**
 * Context Preview Test Script
 * Tests getContextPreview, editLines, and findAndReplaceCode
 */

import { getContextPreview } from './mcp-server-last/utils/file-utils.js';
import { editLines } from './mcp-server-last/tools/dev-tools.js';
import { findAndReplaceCode } from './mcp-server-last/tools/filesystem-tools.js';

const TEST_FILE = 'tmp_rovodev_test_context_preview.ts';

console.log('\n=== CONTEXT PREVIEW TEST ===\n');

// Test 1: getContextPreview helper
console.log('Test 1: getContextPreview helper fonksiyonu');
console.log('============================================');
try {
  const preview = await getContextPreview(TEST_FILE, 3, 8, 3);
  console.log(preview);
  console.log('\u2705 Test 1 BAŞARILI\n');
} catch (err) {
  console.error('❌ Test 1 HATALI:', err.message);
}

// Test 2: editLines insert operation
console.log('\nTest 2: editLines INSERT operasyonu');
console.log('============================================');
try {
  const result = await editLines(TEST_FILE, {
    operation: 'insert',
    startLine: 8,
    content: '  // Eklenen yorum satırı',
    dryRun: false
  });
  
  console.log('Message:', result.message);
  console.log('Lines Affected:', result.linesAffected);
  if (result.contextPreview) {
    console.log(result.contextPreview);
  }
  console.log('\u2705 Test 2 BAŞARILI\n');
} catch (err) {
  console.error('❌ Test 2 HATALI:', err.message);
}

// Test 3: editLines replace operation
console.log('\nTest 3: editLines REPLACE operasyonu');
console.log('============================================');
try {
  const result = await editLines(TEST_FILE, {
    operation: 'replace',
    startLine: 3,
    endLine: 8,
    content: 'function newFunction() {\n  console.log(\'Bu yeni fonksiyon\');\n  const x = 10;\n  const y = 20;\n  return x * y;\n}',
    dryRun: false
  });
  
  console.log('Message:', result.message);
  console.log('Lines Affected:', result.linesAffected);
  if (result.contextPreview) {
    console.log(result.contextPreview);
  }
  console.log('\u2705 Test 3 BAŞARILI\n');
} catch (err) {
  console.error('❌ Test 3 HATALI:', err.message);
}

// Test 4: findAndReplaceCode
console.log('\nTest 4: findAndReplaceCode operasyonu');
console.log('============================================');
try {
  const result = await findAndReplaceCode(
    TEST_FILE,
    'anotherFunction',
    'renamedFunction',
    false,
    false
  );
  
  console.log('Replacements:', result.replacements);
  console.log('Success:', result.success);
  if (result.contextPreview) {
    console.log(result.contextPreview);
  }
  console.log('\u2705 Test 4 BAŞARILI\n');
} catch (err) {
  console.error('❌ Test 4 HATALI:', err.message);
}

// Test 5: editLines delete operation
console.log('\nTest 5: editLines DELETE operasyonu');
console.log('============================================');
try {
  const result = await editLines(TEST_FILE, {
    operation: 'delete',
    startLine: 14,
    endLine: 18,
    dryRun: false
  });
  
  console.log('Message:', result.message);
  console.log('Lines Affected:', result.linesAffected);
  if (result.contextPreview) {
    console.log(result.contextPreview);
  }
  console.log('\u2705 Test 5 BAŞARILI\n');
} catch (err) {
  console.error('❌ Test 5 HATALI:', err.message);
}

console.log('\n=== TÜM TESTLER TAMAMLANDI ===\n');
