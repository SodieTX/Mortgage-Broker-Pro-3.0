const http = require('http');

// This E2E test simulates a real scenario: create a loan, match a lender, simulate lender responses, and deliver terms to a borrower.
// It expects all services to be running locally on their default ports.

module.exports = {
  async run() {
    const issues = [];
    // 1. Create a loan scenario (simulate POST to core service)
    const loanPayload = JSON.stringify({
      borrower: { name: 'Test User', creditScore: 720 },
      amount: 500000,
      propertyType: 'residential',
      state: 'TX'
    });
    let scenarioId = null;
    await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/v1/scenarios',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loanPayload) }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 201) {
            issues.push({
              type: 'E2E',
              message: 'Failed to create loan scenario (POST /api/v1/scenarios)',
              fix: 'Ensure the core service is running and implements scenario creation.',
              impact: 'No scenarios can be created, so the system is non-functional.',
              autoFix: null
            });
            resolve();
            return;
          }
          try {
            const resp = JSON.parse(data);
            scenarioId = resp.id;
            if (!scenarioId) throw new Error('No scenario ID returned');
          } catch {
            issues.push({
              type: 'E2E',
              message: 'Invalid response from scenario creation',
              fix: 'Return a valid scenario ID in the response.',
              impact: 'Downstream services cannot proceed without a scenario ID.',
              autoFix: null
            });
          }
          resolve();
        });
      });
      req.on('error', () => {
        issues.push({
          type: 'E2E',
          message: 'Core service is unreachable on port 3001',
          fix: 'Start the core service and ensure it listens on port 3001.',
          impact: 'No scenarios can be created.',
          autoFix: null
        });
        resolve();
      });
      req.write(loanPayload);
      req.end();
    });
    // 2. Match a lender (simulate GET to Athena)
    if (scenarioId) {
      await new Promise((resolve) => {
        http.get(`http://localhost:3003/api/v1/match/${scenarioId}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode !== 200) {
              issues.push({
                type: 'E2E',
                message: 'Failed to match lender (GET /api/v1/match/:id)',
                fix: 'Ensure Athena service is running and implements lender matching.',
                impact: 'No lenders can be matched to scenarios.',
                autoFix: null
              });
              resolve();
              return;
            }
            try {
              const resp = JSON.parse(data);
              if (!Array.isArray(resp.matches) || resp.matches.length === 0) throw new Error('No matches');
            } catch {
              issues.push({
                type: 'E2E',
                message: 'Invalid response from lender matching',
                fix: 'Return a valid matches array in the response.',
                impact: 'Borrowers cannot see any lender offers.',
                autoFix: null
              });
            }
            resolve();
          });
        }).on('error', () => {
          issues.push({
            type: 'E2E',
            message: 'Athena service is unreachable on port 3003',
            fix: 'Start the Athena service and ensure it listens on port 3003.',
            impact: 'No lenders can be matched.',
            autoFix: null
          });
          resolve();
        });
      });
    }
    // 3. Simulate lender responses and borrower communication (stub for now)
    // TODO: Implement real lender/borrower comms checks as services are built
    return { issues };
  }
};
