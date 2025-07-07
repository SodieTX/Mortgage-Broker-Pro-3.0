const fs = require('fs');
const path = require('path');

const REQUIRED_ENV = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
  'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
  'DATABASE_URL'
];

module.exports = {
  async run() {
    const issues = [];
    let envFile = path.join(process.cwd(), '.env');
    let envVars = {};
    if (fs.existsSync(envFile)) {
      fs.readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key) envVars[key.trim()] = value ? value.trim() : '';
      });
    } else {
      issues.push({
        type: 'Env',
        message: '.env file is missing',
        fix: 'Create a .env file in the project root with all required variables.',
        impact: 'Missing environment variables can cause services to fail at runtime.',
        autoFix: () => {
          fs.copyFileSync('.env.example', '.env');
          console.log('Auto-fix: .env file created from .env.example');
        }
      });
      return { issues };
    }
    for (const key of REQUIRED_ENV) {
      if (!envVars[key]) {
        issues.push({
          type: 'Env',
          message: `Missing required env var: ${key}`,
          fix: `Add ${key}=<value> to your .env file.`,
          impact: `Service may not start or may behave unpredictably without ${key}.`,
          autoFix: null
        });
      }
    }
    return { issues };
  }
};
