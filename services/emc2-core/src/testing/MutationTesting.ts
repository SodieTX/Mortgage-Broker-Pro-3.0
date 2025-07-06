/**
 * Mutation Testing Framework
 * 
 * Google-inspired approach to validate test quality by
 * introducing controlled mutations and ensuring tests catch them
 */

import * as ts from 'typescript';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Types of mutations to apply
 */
export enum MutationType {
  // Arithmetic mutations
  ARITHMETIC_OPERATOR = 'arithmetic_operator',
  
  // Comparison mutations
  COMPARISON_OPERATOR = 'comparison_operator',
  
  // Logical mutations
  LOGICAL_OPERATOR = 'logical_operator',
  
  // Constant mutations
  NUMERIC_CONSTANT = 'numeric_constant',
  STRING_CONSTANT = 'string_constant',
  
  // Boolean mutations
  BOOLEAN_LITERAL = 'boolean_literal',
  
  // Control flow mutations
  RETURN_VALUE = 'return_value',
  CONDITION_NEGATION = 'condition_negation',
  
  // Method mutations
  METHOD_CALL_REMOVAL = 'method_call_removal',
  
  // Boundary mutations
  BOUNDARY_CONDITION = 'boundary_condition'
}

/**
 * Mutation definition
 */
export interface Mutation {
  type: MutationType;
  filePath: string;
  line: number;
  column: number;
  original: string;
  mutated: string;
  description: string;
}

/**
 * Mutation test result
 */
export interface MutationResult {
  mutation: Mutation;
  killed: boolean;
  testsFailed: string[];
  executionTime: number;
  error?: string;
}

/**
 * Mutation operators for TypeScript code
 */
export class MutationOperators {
  /**
   * Arithmetic operator mutations
   */
  static arithmeticMutations(operator: string): string[] {
    const mutations: Record<string, string[]> = {
      '+': ['-', '*', '/'],
      '-': ['+', '*', '/'],
      '*': ['+', '-', '/'],
      '/': ['+', '-', '*'],
      '%': ['+', '-', '*', '/']
    };
    return mutations[operator] || [];
  }
  
  /**
   * Comparison operator mutations
   */
  static comparisonMutations(operator: string): string[] {
    const mutations: Record<string, string[]> = {
      '>': ['<', '>=', '<=', '==', '!='],
      '<': ['>', '>=', '<=', '==', '!='],
      '>=': ['>', '<', '<=', '==', '!='],
      '<=': ['>', '<', '>=', '==', '!='],
      '==': ['!=', '>', '<', '>=', '<='],
      '===': ['!==', '==', '!='],
      '!=': ['==', '>', '<', '>=', '<='],
      '!==': ['===', '==', '!=']
    };
    return mutations[operator] || [];
  }
  
  /**
   * Logical operator mutations
   */
  static logicalMutations(operator: string): string[] {
    const mutations: Record<string, string[]> = {
      '&&': ['||'],
      '||': ['&&'],
      '!': ['']
    };
    return mutations[operator] || [];
  }
  
  /**
   * Numeric constant mutations
   */
  static numericMutations(value: number): number[] {
    const mutations = [
      0,
      1,
      -1,
      value + 1,
      value - 1,
      value * 2,
      value / 2,
      -value
    ];
    
    // Add boundary values
    if (value > 0) {
      mutations.push(Number.MAX_SAFE_INTEGER, Number.MIN_VALUE);
    }
    
    return [...new Set(mutations)].filter(v => v !== value);
  }
  
  /**
   * String constant mutations
   */
  static stringMutations(value: string): string[] {
    return [
      '',
      ' ',
      'null',
      'undefined',
      value.toUpperCase(),
      value.toLowerCase(),
      value.split('').reverse().join(''),
      value + ' '
    ].filter(v => v !== value);
  }
  
  /**
   * Boolean literal mutations
   */
  static booleanMutations(value: boolean): boolean[] {
    return [!value];
  }
}

/**
 * TypeScript AST visitor for finding mutation points
 */
export class MutationVisitor {
  private mutations: Mutation[] = [];
  private sourceFile: ts.SourceFile;
  private filePath: string;
  
  constructor(sourceFile: ts.SourceFile, filePath: string) {
    this.sourceFile = sourceFile;
    this.filePath = filePath;
  }
  
  findMutations(): Mutation[] {
    this.visit(this.sourceFile);
    return this.mutations;
  }
  
  private visit(node: ts.Node) {
    // Skip test files
    if (this.filePath.includes('.test.') || this.filePath.includes('.spec.')) {
      return;
    }
    
    // Binary expressions (arithmetic, comparison, logical)
    if (ts.isBinaryExpression(node)) {
      this.visitBinaryExpression(node);
    }
    
    // Numeric literals
    if (ts.isNumericLiteral(node)) {
      this.visitNumericLiteral(node);
    }
    
    // String literals
    if (ts.isStringLiteral(node)) {
      this.visitStringLiteral(node);
    }
    
    // Boolean literals
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
      this.visitBooleanLiteral(node);
    }
    
    // Prefix unary expressions (!)
    if (ts.isPrefixUnaryExpression(node)) {
      this.visitPrefixUnaryExpression(node);
    }
    
    // If statements
    if (ts.isIfStatement(node)) {
      this.visitIfStatement(node);
    }
    
    // Return statements
    if (ts.isReturnStatement(node)) {
      this.visitReturnStatement(node);
    }
    
    ts.forEachChild(node, child => this.visit(child));
  }
  
  private visitBinaryExpression(node: ts.BinaryExpression) {
    const operator = node.operatorToken.getText();
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.operatorToken.pos);
    
    let mutations: string[] = [];
    let type: MutationType;
    
    // Arithmetic operators
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      mutations = MutationOperators.arithmeticMutations(operator);
      type = MutationType.ARITHMETIC_OPERATOR;
    }
    
    // Comparison operators
    else if (['>', '<', '>=', '<=', '==', '===', '!=', '!=='].includes(operator)) {
      mutations = MutationOperators.comparisonMutations(operator);
      type = MutationType.COMPARISON_OPERATOR;
    }
    
    // Logical operators
    else if (['&&', '||'].includes(operator)) {
      mutations = MutationOperators.logicalMutations(operator);
      type = MutationType.LOGICAL_OPERATOR;
    }
    
    mutations.forEach(mutated => {
      this.mutations.push({
        type,
        filePath: this.filePath,
        line: line + 1,
        column: character + 1,
        original: operator,
        mutated,
        description: `Change ${operator} to ${mutated}`
      });
    });
  }
  
  private visitNumericLiteral(node: ts.NumericLiteral) {
    const value = Number(node.text);
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
    
    MutationOperators.numericMutations(value).forEach(mutated => {
      this.mutations.push({
        type: MutationType.NUMERIC_CONSTANT,
        filePath: this.filePath,
        line: line + 1,
        column: character + 1,
        original: node.text,
        mutated: mutated.toString(),
        description: `Change ${value} to ${mutated}`
      });
    });
  }
  
  private visitStringLiteral(node: ts.StringLiteral) {
    const value = node.text;
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
    
    // Skip import statements and similar
    if (value.includes('/') || value.includes('.')) return;
    
    MutationOperators.stringMutations(value).slice(0, 3).forEach(mutated => {
      this.mutations.push({
        type: MutationType.STRING_CONSTANT,
        filePath: this.filePath,
        line: line + 1,
        column: character + 1,
        original: `'${value}'`,
        mutated: `'${mutated}'`,
        description: `Change "${value}" to "${mutated}"`
      });
    });
  }
  
  private visitBooleanLiteral(node: ts.Node) {
    const value = node.kind === ts.SyntaxKind.TrueKeyword;
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
    
    this.mutations.push({
      type: MutationType.BOOLEAN_LITERAL,
      filePath: this.filePath,
      line: line + 1,
      column: character + 1,
      original: value.toString(),
      mutated: (!value).toString(),
      description: `Change ${value} to ${!value}`
    });
  }
  
  private visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression) {
    if (node.operator === ts.SyntaxKind.ExclamationToken) {
      const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
      
      this.mutations.push({
        type: MutationType.LOGICAL_OPERATOR,
        filePath: this.filePath,
        line: line + 1,
        column: character + 1,
        original: '!',
        mutated: '',
        description: 'Remove negation operator'
      });
    }
  }
  
  private visitIfStatement(node: ts.IfStatement) {
    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
    
    this.mutations.push({
      type: MutationType.CONDITION_NEGATION,
      filePath: this.filePath,
      line: line + 1,
      column: character + 1,
      original: 'if',
      mutated: 'if !',
      description: 'Negate if condition'
    });
  }
  
  private visitReturnStatement(node: ts.ReturnStatement) {
    if (node.expression) {
      const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.pos);
      
      // For numeric returns
      if (ts.isNumericLiteral(node.expression)) {
        this.mutations.push({
          type: MutationType.RETURN_VALUE,
          filePath: this.filePath,
          line: line + 1,
          column: character + 1,
          original: node.expression.text,
          mutated: '0',
          description: 'Return 0 instead'
        });
      }
      
      // For boolean returns
      if (node.expression.kind === ts.SyntaxKind.TrueKeyword || 
          node.expression.kind === ts.SyntaxKind.FalseKeyword) {
        const value = node.expression.kind === ts.SyntaxKind.TrueKeyword;
        this.mutations.push({
          type: MutationType.RETURN_VALUE,
          filePath: this.filePath,
          line: line + 1,
          column: character + 1,
          original: value.toString(),
          mutated: (!value).toString(),
          description: `Return ${!value} instead`
        });
      }
    }
  }
}

/**
 * Mutation test runner
 */
export class MutationTestRunner {
  private originalFiles: Map<string, string> = new Map();
  private testCommand: string;
  private timeout: number;
  
  constructor(testCommand: string = 'npm test', timeout: number = 30000) {
    this.testCommand = testCommand;
    this.timeout = timeout;
  }
  
  /**
   * Run mutation testing on a file
   */
  async runMutationTest(filePath: string): Promise<MutationResult[]> {
    const results: MutationResult[] = [];
    
    // Parse the file
    const sourceCode = readFileSync(filePath, 'utf-8');
    this.originalFiles.set(filePath, sourceCode);
    
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
    
    // Find mutations
    const visitor = new MutationVisitor(sourceFile, filePath);
    const mutations = visitor.findMutations();
    
    // Test each mutation
    for (const mutation of mutations) {
      const result = await this.testMutation(mutation);
      results.push(result);
      
      // Restore original file
      writeFileSync(filePath, this.originalFiles.get(filePath)!);
    }
    
    return results;
  }
  
  /**
   * Test a single mutation
   */
  private async testMutation(mutation: Mutation): Promise<MutationResult> {
    const startTime = Date.now();
    
    try {
      // Apply mutation
      this.applyMutation(mutation);
      
      // Run tests
      const output = execSync(this.testCommand, {
        timeout: this.timeout,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // If tests pass, mutation survived (bad!)
      return {
        mutation,
        killed: false,
        testsFailed: [],
        executionTime: Date.now() - startTime
      };
      
    } catch (error: any) {
      // If tests fail, mutation was killed (good!)
      const failedTests = this.extractFailedTests(error.stdout || '');
      
      return {
        mutation,
        killed: true,
        testsFailed: failedTests,
        executionTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
  
  /**
   * Apply a mutation to the source code
   */
  private applyMutation(mutation: Mutation) {
    const sourceCode = this.originalFiles.get(mutation.filePath)!;
    const lines = sourceCode.split('\n');
    const line = lines[mutation.line - 1];
    
    // Simple string replacement (would need more sophisticated AST manipulation for production)
    const mutatedLine = line.replace(mutation.original, mutation.mutated);
    lines[mutation.line - 1] = mutatedLine;
    
    const mutatedCode = lines.join('\n');
    writeFileSync(mutation.filePath, mutatedCode);
  }
  
  /**
   * Extract failed test names from test output
   */
  private extractFailedTests(output: string): string[] {
    const failedTests: string[] = [];
    
    // Jest format
    const jestMatches = output.match(/✕ (.+) \(/g);
    if (jestMatches) {
      failedTests.push(...jestMatches.map(m => m.replace('✕ ', '').replace(' (', '')));
    }
    
    // Mocha format
    const mochaMatches = output.match(/\d+\) (.+)/g);
    if (mochaMatches) {
      failedTests.push(...mochaMatches.map(m => m.replace(/\d+\) /, '')));
    }
    
    return failedTests;
  }
  
  /**
   * Generate mutation testing report
   */
  generateReport(results: MutationResult[]): MutationReport {
    const killed = results.filter(r => r.killed).length;
    const survived = results.filter(r => !r.killed).length;
    const total = results.length;
    const mutationScore = total > 0 ? (killed / total) * 100 : 0;
    
    const byType = new Map<MutationType, { killed: number; survived: number }>();
    
    results.forEach(result => {
      const type = result.mutation.type;
      const current = byType.get(type) || { killed: 0, survived: 0 };
      
      if (result.killed) {
        current.killed++;
      } else {
        current.survived++;
      }
      
      byType.set(type, current);
    });
    
    return {
      totalMutations: total,
      killedMutations: killed,
      survivedMutations: survived,
      mutationScore,
      byType: Object.fromEntries(byType),
      survivedMutationDetails: results
        .filter(r => !r.killed)
        .map(r => ({
          mutation: r.mutation,
          location: `${r.mutation.filePath}:${r.mutation.line}:${r.mutation.column}`,
          description: r.mutation.description
        }))
    };
  }
}

/**
 * Mutation testing report
 */
export interface MutationReport {
  totalMutations: number;
  killedMutations: number;
  survivedMutations: number;
  mutationScore: number;
  byType: Record<MutationType, { killed: number; survived: number }>;
  survivedMutationDetails: Array<{
    mutation: Mutation;
    location: string;
    description: string;
  }>;
}

/**
 * Mutation testing configuration
 */
export interface MutationTestConfig {
  targetFiles: string[];
  excludePatterns?: string[];
  testCommand?: string;
  timeout?: number;
  mutationTypes?: MutationType[];
  maxMutationsPerFile?: number;
}

/**
 * Run mutation testing on multiple files
 */
export async function runMutationTesting(config: MutationTestConfig): Promise<MutationReport> {
  const runner = new MutationTestRunner(config.testCommand, config.timeout);
  const allResults: MutationResult[] = [];
  
  for (const file of config.targetFiles) {
    const results = await runner.runMutationTest(file);
    allResults.push(...results);
  }
  
  return runner.generateReport(allResults);
}
