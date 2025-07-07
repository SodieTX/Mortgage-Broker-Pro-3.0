const http = require('http');

module.exports = {
  async run() {
    const issues = [];
    // Check Hermes health endpoint
    await new Promise((resolve) => {
      http.get('http://localhost:3002/health', (res) => {
        if (res.statusCode !== 200) {
          issues.push({
            type: 'Health',
            message: 'Hermes /health endpoint did not return 200',
            fix: 'Ensure the /health endpoint is implemented and returns 200 OK.',
            impact: 'Without a working health endpoint, orchestrators and load balancers cannot monitor service health. This can cause downtime or missed alerts.',
            autoFix: null
          });
        }
        resolve();
      }).on('error', () => {
        issues.push({
          type: 'Health',
          message: 'Hermes /health endpoint is unreachable',
          fix: 'Start the Hermes service and ensure it listens on port 3002.',
          impact: 'If the service is not running, it cannot serve requests or be monitored.',
          autoFix: null
        });
        resolve();
      });
    });
    return { issues };
  }
};
