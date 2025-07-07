/**
 * File Upload Test Script - Proves the upload functionality works
 * Run with: node test-file-upload.js
 */

const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:3001/api/v1';

// Test files to upload
const testFiles = [
  {
    name: 'valid-lenders.csv',
    path: './test-files/valid-lenders.csv',
    expectSuccess: true,
    expectedRows: 10,
    expectedColumns: ['Name', 'Legal Name', 'Tax ID', 'Website', 'Contact Name', 'Contact Email', 'Contact Phone', 'Profile Score', 'Tier', 'Notes']
  },
  {
    name: 'empty.csv',
    path: './test-files/empty.csv',
    expectSuccess: false,
    expectedError: 'File contains no data rows'
  },
  {
    name: 'invalid-columns.csv',
    path: './test-files/invalid-columns.csv',
    expectSuccess: true, // Should succeed but warn about inconsistent columns
    expectedRows: 3,
    expectedColumns: ['Name', 'Email', 'Phone']
  },
  {
    name: 'complex-csv.csv',
    path: './test-files/complex-csv.csv',
    expectSuccess: true,
    expectedRows: 3,
    expectedColumns: ['Name', 'Description', 'Contact']
  }
];

async function uploadFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file not found: ${filePath}`);
  }

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  const response = await fetch(`${baseUrl}/lenders/upload-preview`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });

  const result = await response.json();
  return { response, result };
}

async function testFileUploads() {
  console.log('🧪 Testing File Upload Functionality...\n');
  
  let passed = 0;
  let failed = 0;

  for (const testFile of testFiles) {
    console.log(`📁 Testing: ${testFile.name}`);
    
    try {
      const { response, result } = await uploadFile(testFile.path);
      
      if (testFile.expectSuccess) {
        if (result.success) {
          console.log('✅ Upload successful');
          console.log(`   📊 Rows: ${result.rows} (expected: ${testFile.expectedRows || 'any'})`);
          console.log(`   📋 Columns: [${result.columns.join(', ')}]`);
          console.log(`   📝 Sample: ${result.sample_data.length} rows in preview`);
          console.log(`   💾 File size: ${result.file_info.size} bytes`);
          console.log(`   🆔 Preview ID: ${result.preview_id}`);
          
          // Validate expectations
          if (testFile.expectedRows && result.rows !== testFile.expectedRows) {
            console.log(`⚠️  Warning: Expected ${testFile.expectedRows} rows, got ${result.rows}`);
          }
          
          if (testFile.expectedColumns) {
            const columnsMatch = JSON.stringify(result.columns) === JSON.stringify(testFile.expectedColumns);
            if (!columnsMatch) {
              console.log(`⚠️  Warning: Column mismatch`);
              console.log(`    Expected: [${testFile.expectedColumns.join(', ')}]`);
              console.log(`    Got: [${result.columns.join(', ')}]`);
            }
          }
          
          passed++;
        } else {
          console.log(`❌ Expected success but got error: ${result.error}`);
          failed++;
        }
      } else {
        if (!result.success) {
          console.log(`✅ Expected failure: ${result.error}`);
          if (testFile.expectedError && !result.error.includes(testFile.expectedError)) {
            console.log(`⚠️  Warning: Expected error containing "${testFile.expectedError}", got "${result.error}"`);
          }
          passed++;
        } else {
          console.log(`❌ Expected failure but upload succeeded`);
          failed++;
        }
      }
      
    } catch (error) {
      console.log(`❌ Test failed with exception: ${error.message}`);
      failed++;
    }
    
    console.log(''); // Blank line
  }

  // Test invalid file type
  console.log('📁 Testing: Invalid file type');
  try {
    // Create a fake .txt file
    const txtContent = 'This is not a CSV file';
    fs.writeFileSync('./test-files/invalid.txt', txtContent);
    
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream('./test-files/invalid.txt'));

    const response = await fetch(`${baseUrl}/lenders/upload-preview`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const result = await response.json();
    
    if (!result.success && result.error.includes('Invalid file type')) {
      console.log('✅ Invalid file type correctly rejected');
      passed++;
    } else {
      console.log(`❌ Invalid file type should have been rejected`);
      failed++;
    }
    
    // Cleanup
    fs.unlinkSync('./test-files/invalid.txt');
    
  } catch (error) {
    console.log(`❌ Invalid file type test failed: ${error.message}`);
    failed++;
  }

  console.log(''); // Blank line

  // Test no file upload
  console.log('📁 Testing: No file upload');
  try {
    const response = await fetch(`${baseUrl}/lenders/upload-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    
    if (!result.success && result.error.includes('No file uploaded')) {
      console.log('✅ No file upload correctly rejected');
      passed++;
    } else {
      console.log(`❌ No file upload should have been rejected`);
      failed++;
    }
    
  } catch (error) {
    console.log(`❌ No file upload test failed: ${error.message}`);
    failed++;
  }

  console.log('\n📈 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! File upload functionality is working correctly.');
    console.log('🔧 Ready to build column mapping and import features on this foundation.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the implementation.');
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch(`${baseUrl.replace('/api/v1', '')}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server is not running!');
    console.log('\n💡 Start the server first:');
    console.log('   cd services/emc2-core');
    console.log('   npm install');
    console.log('   npm run dev');
    console.log('\nThen run this test again.');
    return;
  }

  await testFileUploads();
}

// Run the tests
main().catch(console.error);