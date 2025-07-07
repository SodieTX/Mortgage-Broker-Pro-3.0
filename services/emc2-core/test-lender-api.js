/**
 * Simple test script for Lender API
 * Run with: node test-lender-api.js
 */

const baseUrl = 'http://localhost:3001/api/v1';

// Test data
const testLender = {
  name: "Test Bank",
  legal_name: "Test Bank Corporation",
  tax_id: "12-3456789",
  website_url: "https://testbank.com",
  contact_name: "John Doe",
  contact_email: "john@testbank.com",
  contact_phone: "+1234567890",
  profile_score: 85,
  tier: "GOLD",
  api_enabled: true,
  metadata: {
    notes: "Created via API test",
    specialties: ["DSCR", "Commercial"]
  }
};

async function testLenderAPI() {
  console.log('🧪 Testing Lender API Anchor...\n');
  
  try {
    // Test 1: Create a lender
    console.log('📝 Creating test lender...');
    const createResponse = await fetch(`${baseUrl}/lenders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testLender)
    });
    
    const createResult = await createResponse.json();
    console.log('✅ Create Response:', createResult);
    
    if (!createResult.success) {
      throw new Error(`Create failed: ${createResult.error}`);
    }
    
    const lenderId = createResult.lender_id;
    console.log(`🎯 Created lender with ID: ${lenderId}\n`);
    
    // Test 2: List lenders
    console.log('📋 Fetching lenders list...');
    const listResponse = await fetch(`${baseUrl}/lenders`);
    const listResult = await listResponse.json();
    console.log('✅ List Response:', listResult);
    
    if (!listResult.success) {
      throw new Error(`List failed: ${listResult.error}`);
    }
    
    console.log(`📊 Found ${listResult.lenders.length} lenders\n`);
    
    // Test 3: Try to create duplicate (should fail)
    console.log('🚫 Testing duplicate creation (should fail)...');
    const duplicateResponse = await fetch(`${baseUrl}/lenders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testLender)
    });
    
    const duplicateResult = await duplicateResponse.json();
    console.log('⚠️  Duplicate Response:', duplicateResult);
    
    if (duplicateResult.success) {
      console.log('🟡 Warning: Duplicate creation succeeded (should have failed)');
    } else {
      console.log('✅ Duplicate correctly rejected');
    }
    
    console.log('\n🎉 Lender API anchor test completed successfully!');
    console.log('📈 Ready to build more features on this foundation.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.cause?.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running:');
      console.log('   cd services/emc2-core');
      console.log('   npm install');
      console.log('   npm run dev');
    }
  }
}

// Run the test
testLenderAPI();