const fs = require('fs');
const path = require('path');

// This contract check ensures that OpenAPI specs exist and are up to date for all services.
module.exports = {
  async run() {
    const issues = [];
    const openapiPath = path.join(process.cwd(), 'docs', 'api', 'openapi.yaml');
    if (!fs.existsSync(openapiPath)) {
      issues.push({
        type: 'Contract',
        message: 'OpenAPI spec (openapi.yaml) is missing.',
        fix: 'Create and maintain an OpenAPI spec for your APIs in docs/api/openapi.yaml.',
        impact: 'Without a contract, API changes can break consumers without warning.',
        autoFix: null
      });
    } else {
      // Optionally, validate the spec (could use swagger-cli or similar)
      // For now, just check it exists
    }
    return { issues };
  }
};
