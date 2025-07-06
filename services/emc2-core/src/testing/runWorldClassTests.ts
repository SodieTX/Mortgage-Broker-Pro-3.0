#!/usr/bin/env ts-node
/**
 * 🏆 World-Class Test Runner CLI
 * Run all tests from one place!
 */

import { worldClassTests, TestPillar } from './WorldClassTestSuite';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('🌂 Mary Poppins World-Class Test Runner');
  console.log('=' .repeat(80));
  
  switch (command) {
    case 'all':
      // Run all test suites
      await worldClassTests.runAll();
      break;
      
    case 'chaos':
      // Run chaos engineering tests
      await worldClassTests.runPillar(TestPillar.CHAOS);
      break;
      
    case 'mutation':
      // Run mutation tests
      await worldClassTests.runPillar(TestPillar.MUTATION);
      break;
      
    case 'time-travel':
      // Run time-travel tests
      await worldClassTests.runPillar(TestPillar.TIME_TRAVEL);
      break;
      
    case 'chaos-monkey':
      // Unleash chaos for specified duration
      const duration = parseInt(args[1]) || 60000; // Default 1 minute
      await worldClassTests.runChaosMonkey(duration);
      break;
      
    case 'sleep-well':
      // Run the ultimate test
      const report = await worldClassTests.runSleepWellTest();
      if (report.canSleepWell) {
        console.log('\n😴 ✅ YOU CAN SLEEP WELL AT NIGHT!');
        console.log(report.recommendation);
      } else {
        console.log('\n😰 ❌ DON\'T SLEEP YET!');
        console.log(`Critical failures: ${report.criticalFailures}`);
        console.log(report.recommendation);
      }
      break;
      
    case 'quick':
      // Run quick smoke tests
      console.log('Running quick test suite...');
      await worldClassTests.runAll({
        enableSleepWell: false,
        enablePerformance: false,
        parallel: true
      });
      break;
      
    case 'help':
    default:
      printHelp();
      break;
  }
}

function printHelp() {
  console.log(`
Usage: npm run test:world-class [command] [options]

Commands:
  all           Run all world-class test suites
  chaos         Run chaos engineering tests only
  mutation      Run mutation testing only
  time-travel   Run time-travel tests only
  chaos-monkey  Unleash chaos for [duration] ms
  sleep-well    Run the ultimate 24-hour test
  quick         Run quick smoke tests (parallel)
  help          Show this help message

Examples:
  npm run test:world-class all
  npm run test:world-class chaos-monkey 300000
  npm run test:world-class sleep-well

"In every test that must be done, there is an element of fun!"
  `);
}

// Run the CLI
main().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
