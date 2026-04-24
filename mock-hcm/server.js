const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// In-memory mock database
let hcmBalances = {
  // employeeId_locationId: balance
  'EMP1_LOC1': 10,
  'EMP2_LOC1': 15,
  'EMP1_LOC2': 5,
};

// Simulate random network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get('/api/hcm/balances/:employeeId/:locationId', async (req, res) => {
  await delay(200); // 200ms latency
  
  const { employeeId, locationId } = req.params;
  const key = `${employeeId}_${locationId}`;
  
  // Simulate occasional 500 error (10% chance)
  if (Math.random() < 0.1) {
      return res.status(500).json({ error: 'HCM Internal Server Error' });
  }

  if (hcmBalances[key] !== undefined) {
    return res.json({ employeeId, locationId, balance: hcmBalances[key] });
  } else {
    // Return 0 if not found, or maybe 404
    return res.status(404).json({ error: 'Balance not found' });
  }
});

app.post('/api/hcm/time-off', async (req, res) => {
  await delay(300);
  
  const { employeeId, locationId, days, type, startDate, endDate } = req.body;
  
  // Validate dimensions
  if (!employeeId || !locationId || !days || !type) {
      return res.status(400).json({ error: 'Missing required dimensions' });
  }
  
  const key = `${employeeId}_${locationId}`;
  
  // Simulate occasional HCM rejection even if balance seems fine locally
  // (e.g. invalid date range, blacklisted days in HCM)
  if (Math.random() < 0.05) {
      return res.status(400).json({ error: 'Invalid dates according to HCM calendar' });
  }

  const currentBalance = hcmBalances[key] || 0;
  
  if (currentBalance >= days) {
      // Deduct balance
      hcmBalances[key] -= days;
      return res.status(200).json({ 
          success: true, 
          message: 'Time off recorded in HCM',
          newBalance: hcmBalances[key],
          hcmReferenceId: `HCM-REQ-${Date.now()}`
      });
  } else {
      return res.status(400).json({ 
          error: 'Insufficient balance in HCM',
          currentBalance 
      });
  }
});

// Batch endpoint
app.get('/api/hcm/balances/batch', async (req, res) => {
  await delay(500);
  
  // Occasionally simulate a bonus (anniversary) before returning batch
  if (Math.random() < 0.3) {
      const keys = Object.keys(hcmBalances);
      if (keys.length > 0) {
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          hcmBalances[randomKey] += 1; // Give 1 day bonus
          console.log(`[Mock HCM] Bonus applied to ${randomKey}`);
      }
  }

  const balancesArray = Object.entries(hcmBalances).map(([key, balance]) => {
      const parts = key.split('_');
      const locationId = parts.pop();
      const employeeId = parts.join('_');
      return { employeeId, locationId, balance };
  });

  return res.json(balancesArray);
});

// Admin endpoint to reset/set balances for testing
app.post('/api/admin/set-balance', (req, res) => {
    const { employeeId, locationId, balance } = req.body;
    const key = `${employeeId}_${locationId}`;
    hcmBalances[key] = balance;
    res.json({ success: true, newBalance: balance });
});


app.listen(PORT, () => {
  console.log(`Mock HCM server listening on port ${PORT}`);
});
