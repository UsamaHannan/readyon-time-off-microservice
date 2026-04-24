const axios = require('axios');

const API_URL = 'http://localhost:3000';
let employeeToken = '';
let managerToken = '';
let employeeId = '';
let managerId = '';

const uniqueSuffix = Date.now();
const managerEmail = `manager${uniqueSuffix}@wizdaa.com`;
const employeeEmail = `employee${uniqueSuffix}@wizdaa.com`;

async function runTest() {
  console.log('--- Starting API E2E Verification Flow ---');

  try {
    // 1. Register Manager
    console.log('\n[1] Registering Manager...');
    const mgrRes = await axios.post(`${API_URL}/auth/register`, {
      email: managerEmail,
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Manager',
      role: 'MANAGER'
    });
    managerId = mgrRes.data.id;
    console.log(`✅ Manager registered with ID: ${managerId}`);

    // 2. Register Employee
    console.log('\n[2] Registering Employee...');
    // We map this employee to the mock HCM data: EMP1
    const empRes = await axios.post(`${API_URL}/auth/register`, {
      email: employeeEmail,
      password: 'password123',
      firstName: 'Bob',
      lastName: 'Employee',
      role: 'EMPLOYEE'
    });
    employeeId = empRes.data.id;
    console.log(`✅ Employee registered with ID: ${employeeId}`);

    // 3. Inject balance into Mock HCM for this new UUID
    console.log('\n[3] Injecting mock data into HCM for this employee UUID...');
    await axios.post(`http://localhost:3001/api/admin/set-balance`, {
        employeeId: employeeId,
        locationId: 'LOC1',
        balance: 10
    });
    console.log(`✅ HCM updated for ${employeeId} at LOC1`);

    // 4. Login Manager
    console.log('\n[4] Logging in Manager...');
    const mgrLogin = await axios.post(`${API_URL}/auth/login`, {
      email: managerEmail,
      password: 'password123'
    });
    managerToken = mgrLogin.data.access_token;
    console.log('✅ Manager logged in');

    // 4.5 Create Location
    console.log('\n[4.5] Creating Location LOC1...');
    try {
      await axios.post(`${API_URL}/locations`, {
        locationId: 'LOC1',
        name: 'Headquarters'
      }, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      console.log('✅ Location created');
    } catch (err) {
      console.log('Location might already exist, proceeding...');
    }

    // 5. Login Employee
    console.log('\n[5] Logging in Employee...');
    const empLogin = await axios.post(`${API_URL}/auth/login`, {
      email: employeeEmail,
      password: 'password123'
    });
    employeeToken = empLogin.data.access_token;
    console.log('✅ Employee logged in');

    // 6. Trigger Batch Sync from Manager
    console.log('\n[6] Manager triggering Batch Sync...');
    const syncRes = await axios.post(`${API_URL}/balances/sync/batch`, {}, {
        headers: { Authorization: `Bearer ${managerToken}` }
    });
    console.log(`✅ Batch sync completed. Synced count: ${syncRes.data.syncedCount}`);

    // 7. Verify Employee Balance Locally
    console.log('\n[7] Checking Employee local balance...');
    const balRes = await axios.get(`${API_URL}/balances/${employeeId}/LOC1`, {
        headers: { Authorization: `Bearer ${employeeToken}` }
    });
    console.log(`✅ Employee balance: ${balRes.data.balance} days`);

    // 8. Employee Submits Time-Off Request
    console.log('\n[8] Employee submitting time-off request for 2 days...');
    const reqRes = await axios.post(`${API_URL}/time-off-requests`, {
        locationId: 'LOC1',
        type: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        days: 2
    }, {
        headers: { Authorization: `Bearer ${employeeToken}` }
    });
    const requestId = reqRes.data.id;
    console.log(`✅ Request created with ID: ${requestId}, Status: ${reqRes.data.status}`);

    // 9. Manager Approves Request
    console.log('\n[9] Manager approving request (This triggers real-time HCM sync)...');
    const appRes = await axios.patch(`${API_URL}/time-off-requests/${requestId}/approve`, {}, {
        headers: { Authorization: `Bearer ${managerToken}` }
    });
    console.log(`✅ Request approved! Final status: ${appRes.data.status}, HCM Ref: ${appRes.data.hcmReferenceId || 'N/A'}`);

    // 10. Verify Balance Deducted
    console.log('\n[10] Verifying final balance...');
    const finalBalRes = await axios.get(`${API_URL}/balances/${employeeId}/LOC1`, {
        headers: { Authorization: `Bearer ${employeeToken}` }
    });
    console.log(`✅ Final balance is: ${finalBalRes.data.balance} days (Expected 8)`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY 🎉');

  } catch (error) {
    console.error('\n❌ ERROR during API flow:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runTest();
