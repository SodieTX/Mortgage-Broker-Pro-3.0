// coverageGuard.test.ts
// Fails if coverage summary is below minimum thresholds

import fs from 'fs';
import path from 'path';

describe('Coverage Guard', () => {
  it('should meet minimum coverage thresholds', () => {
    const coverageSummaryPath = path.resolve(__dirname, '../../coverage/coverage-summary.json');
    if (!fs.existsSync(coverageSummaryPath)) {
      throw new Error('Coverage summary not found. Run tests with coverage first.');
    }
    const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
    const global = summary.total;
    // Set your minimums here (raise as you improve)
    const minStatements = 20;
    const minBranches = 10;
    const minFunctions = 15;
    const minLines = 20;
    expect(global.statements.pct).toBeGreaterThanOrEqual(minStatements);
    expect(global.branches.pct).toBeGreaterThanOrEqual(minBranches);
    expect(global.functions.pct).toBeGreaterThanOrEqual(minFunctions);
    expect(global.lines.pct).toBeGreaterThanOrEqual(minLines);
  });
});
