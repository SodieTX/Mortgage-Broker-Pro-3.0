#!/usr/bin/env ts-node
/**
 * Test Coverage Analysis Script
 * Mary Poppins' Coverage Inspector
 */

import * as fs from 'fs';
import * as path from 'path';

interface CoverageData {
  total: {
    lines: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
  [key: string]: any;
}

interface FileReport {
  path: string;
  lines: number;
  coverage: number;
  missing: string[];
  grade: string;
}

class CoverageAnalyzer {
  private coverageData: CoverageData | null = null;
  
  async analyze() {
    console.log('🌂 Mary Poppins Coverage Analysis\n');
    
    // Load coverage data
    const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
    
    if (!fs.existsSync(coveragePath)) {
      console.error('❌ No coverage data found! Run tests first: npm test');
      process.exit(1);
    }
    
    this.coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    
    // Overall summary
    this.printOverallSummary();
    
    // File-by-file analysis
    this.analyzeFiles();
    
    // Recommendations
    this.printRecommendations();
  }
  
  private printOverallSummary() {
    const total = this.coverageData!.total;
    const avgCoverage = (
      total.lines.pct + 
      total.statements.pct + 
      total.functions.pct + 
      total.branches.pct
    ) / 4;
    
    const grade = this.getGrade(avgCoverage);
    
    console.log('📊 Overall Coverage Summary');
    console.log('─'.repeat(50));
    console.log(`Lines:      ${this.formatCoverage(total.lines)}`);
    console.log(`Statements: ${this.formatCoverage(total.statements)}`);
    console.log(`Functions:  ${this.formatCoverage(total.functions)}`);
    console.log(`Branches:   ${this.formatCoverage(total.branches)}`);
    console.log('─'.repeat(50));
    console.log(`Average:    ${avgCoverage.toFixed(2)}% - Grade: ${grade}\n`);
  }
  
  private formatCoverage(metric: any): string {
    const pct = metric.pct.toFixed(2);
    const bar = this.getProgressBar(metric.pct);
    const emoji = metric.pct >= 80 ? '✅' : metric.pct >= 60 ? '⚠️' : '❌';
    return `${bar} ${pct.padStart(6)}% (${metric.covered}/${metric.total}) ${emoji}`;
  }
  
  private getProgressBar(pct: number): string {
    const filled = Math.floor(pct / 5);
    const empty = 20 - filled;
    return `[${'>'.repeat(filled)}${'-'.repeat(empty)}]`;
  }
  
  private getGrade(pct: number): string {
    if (pct >= 95) return 'A+ 🌟';
    if (pct >= 90) return 'A 🎉';
    if (pct >= 80) return 'B ✅';
    if (pct >= 70) return 'C ⚠️';
    if (pct >= 60) return 'D 😟';
    return 'F ❌';
  }
  
  private analyzeFiles() {
    console.log('\n📁 File Analysis (Worst Coverage First)');
    console.log('─'.repeat(80));
    
    const files: FileReport[] = [];
    
    for (const [filePath, data] of Object.entries(this.coverageData!)) {
      if (filePath === 'total') continue;
      
      const relativePath = filePath.replace(/.*src/, 'src');
      const coverage = data.lines.pct;
      
      files.push({
        path: relativePath,
        lines: data.lines.total,
        coverage,
        missing: this.getMissingLines(data),
        grade: this.getGrade(coverage)
      });
    }
    
    // Sort by coverage (worst first)
    files.sort((a, b) => a.coverage - b.coverage);
    
    // Show worst 10 files
    const worstFiles = files.slice(0, 10);
    
    worstFiles.forEach(file => {
      console.log(`\n${file.grade} ${file.path}`);
      console.log(`   Coverage: ${file.coverage.toFixed(2)}% | Lines: ${file.lines}`);
      if (file.missing.length > 0) {
        console.log(`   Missing: ${file.missing.slice(0, 5).join(', ')}${file.missing.length > 5 ? '...' : ''}`);
      }
    });
    
    console.log('\n' + '─'.repeat(80));
    console.log(`Total Files: ${files.length}`);
    console.log(`Files < 80% coverage: ${files.filter(f => f.coverage < 80).length}`);
    console.log(`Files with 0% coverage: ${files.filter(f => f.coverage === 0).length}`);
  }
  
  private getMissingLines(_data: any): string[] {
    // In a real implementation, this would parse the detailed lcov data
    // For now, return empty array
    return [];
  }
  
  private printRecommendations() {
    const total = this.coverageData!.total;
    const avgCoverage = (
      total.lines.pct + 
      total.statements.pct + 
      total.functions.pct + 
      total.branches.pct
    ) / 4;
    
    console.log('\n🎯 Mary Poppins\' Recommendations');
    console.log('─'.repeat(50));
    
    if (avgCoverage < 80) {
      console.log('❌ Coverage is BELOW 80% - This is unacceptable!');
      console.log('\nImmediate Actions Required:');
      console.log('1. Stop all feature development');
      console.log('2. Write tests for uncovered code');
      console.log('3. Focus on critical services first');
      console.log('4. Use TDD for all new code');
      
      if (total.functions.pct < 70) {
        console.log('\n⚠️  Function coverage is critically low!');
        console.log('   - Many functions are completely untested');
        console.log('   - Start by writing unit tests for each function');
      }
      
      if (total.branches.pct < 70) {
        console.log('\n⚠️  Branch coverage is poor!');
        console.log('   - Edge cases are not tested');
        console.log('   - Add tests for error paths and conditionals');
      }
    } else {
      console.log('✅ Coverage is above 80% - Good, but not great!');
      console.log('\nNext Steps:');
      console.log('1. Aim for 90%+ coverage');
      console.log('2. Focus on critical paths');
      console.log('3. Add integration tests');
      console.log('4. Implement mutation testing');
    }
    
    console.log('\n📚 Testing Best Practices:');
    console.log('- Every bug fix should include a test');
    console.log('- Write tests before code (TDD)');
    console.log('- Test edge cases and error paths');
    console.log('- Keep tests fast and isolated');
    console.log('- Use meaningful test descriptions');
    
    console.log('\n"In every job that must be done, there is an element of fun!"');
    console.log('- But first, make it work, then make it tested!\n');
  }
}

// Run the analyzer
const analyzer = new CoverageAnalyzer();
analyzer.analyze().catch(console.error);
