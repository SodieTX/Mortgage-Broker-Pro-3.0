#!/usr/bin/env node
/**
 * Pinocchio Test: Prime-Time Readiness & No-Facade Guarantee
 * - Reports issues, suggests fixes, explains impact, and can auto-fix (with chaperone safety check)
 */
const fs = require('fs');
const path = require('path');

const checks = [
  require('./pinocchio/health-check'),
  require('./pinocchio/env-check'),
  require('./pinocchio/e2e-check'),
  require('./pinocchio/contract-check'),
  require('./pinocchio/dependency-check'),
  require('./pinocchio/placeholder-check'),
  require('./pinocchio/test-coverage-check'),
  require('./pinocchio/secret-check'),
  require('./pinocchio/logging-check'),
  require('./pinocchio/ci-cd-check'),
];

async function main() {
  let issues = [];
  for (const check of checks) {
    const result = await check.run();
    if (result.issues.length > 0) {
      issues = issues.concat(result.issues);
      for (const issue of result.issues) {
        console.error(`\n[${issue.type}] ${issue.message}`);
        console.info(`Fix: ${issue.fix}`);
        console.info(`Impact: ${issue.impact}`);
      }
    }
  }
  if (issues.length === 0) {
    console.log('\n✅ Pinocchio Test: All checks passed. System is ready for prime time!');
    process.exit(0);
  }
  // Offer auto-fix
  const autoFixable = issues.filter(i => i.autoFix);
  if (autoFixable.length > 0) {
    console.log('\nAuto-fixable issues found. Running auto-fix...');
    for (const issue of autoFixable) {
      await issue.autoFix();
    }
    // Chaperone: re-run all checks to ensure system integrity
    let postFixIssues = [];
    for (const check of checks) {
      const result = await check.run();
      postFixIssues = postFixIssues.concat(result.issues);
    }
    if (postFixIssues.length === 0) {
      console.log('\n✅ Auto-fix succeeded and system integrity is intact.');
      process.exit(0);
    } else {
      console.error('\n❌ Auto-fix introduced new issues! Manual intervention required.');
      for (const issue of postFixIssues) {
        console.error(`[${issue.type}] ${issue.message}`);
      }
      process.exit(2);
    }
  } else {
    console.error('\n❌ Pinocchio Test failed. Please fix the above issues.');
    process.exit(1);
  }
}

main();
