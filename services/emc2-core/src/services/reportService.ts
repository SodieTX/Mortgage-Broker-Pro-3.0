/**
 * Report Service
 * 
 * Generates professional PDF reports for mortgage scenarios
 */

import PDFDocument from 'pdfkit';
import { Scenario } from '../types/scenario';
import { CalculationService } from './calculationService';

export class ReportService {
  private calculationService: CalculationService;

  constructor() {
    this.calculationService = new CalculationService();
  }

  /**
   * Generate a comprehensive scenario report
   */
  async generateScenarioReport(scenario: Scenario): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.addHeader(doc, scenario);

      // Executive Summary
      this.addExecutiveSummary(doc, scenario);

      // Loan Details
      this.addLoanDetails(doc, scenario);

      // Calculations Results
      if (scenario.calculations) {
        this.addCalculationResults(doc, scenario);
      }

      // Footer
      this.addFooter(doc);

      doc.end();
    });
  }

  /**
   * Generate DSCR analysis report
   */
  async generateDSCRReport(
    property: any,
    loanAmount: number,
    interestRate: number,
    termMonths: number,
    purchasePrice?: number
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Calculate DSCR
      const dscrResult = this.calculationService.calculateDSCR(
        property,
        loanAmount,
        interestRate,
        termMonths
      );

      // Calculate investment metrics if purchase price provided
      const investmentMetrics = purchasePrice
        ? this.calculationService.calculateInvestmentMetrics(
            property,
            purchasePrice,
            loanAmount,
            interestRate,
            termMonths,
            0
          )
        : null;

      // Header
      doc.fontSize(24).text('DSCR Analysis Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).fillColor('#666').text(new Date().toLocaleDateString(), { align: 'center' });
      doc.moveDown(2);

      // Property Overview
      doc.fontSize(16).fillColor('#000').text('Property Overview', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Monthly Rent: ${this.formatCurrency(property.monthlyRent)}`);
      doc.text(`Annual Gross Income: ${this.formatCurrency(property.monthlyRent * 12)}`);
      doc.text(`Vacancy Rate: ${(property.vacancyRate * 100).toFixed(1)}%`);
      doc.text(`Property Taxes: ${this.formatCurrency(property.propertyTaxes)}/year`);
      doc.text(`Insurance: ${this.formatCurrency(property.insurance)}/year`);
      doc.moveDown();

      // DSCR Analysis
      doc.fontSize(16).text('DSCR Analysis', { underline: true });
      doc.moveDown();
      
      // Key metric box
      const dscrColor = dscrResult.dscr >= 1.25 ? '#0f0' : '#f00';
      doc.rect(50, doc.y, 200, 60)
        .fillAndStroke('#f5f5f5', '#ddd');
      doc.fillColor('#000');
      doc.fontSize(24).text(dscrResult.dscr.toString(), 60, doc.y - 50, {
        width: 180,
        align: 'center'
      });
      doc.fontSize(12).text('Debt Service Coverage Ratio', 60, doc.y - 30, {
        width: 180,
        align: 'center'
      });
      doc.moveDown(3);

      doc.fontSize(11);
      doc.text(`Net Operating Income: ${this.formatCurrency(dscrResult.netOperatingIncome)}`);
      doc.text(`Annual Debt Service: ${this.formatCurrency(dscrResult.totalDebtService)}`);
      doc.text(`Annual Cash Flow: ${this.formatCurrency(dscrResult.cashFlow)}`);
      doc.text(`Break-Even Occupancy: ${dscrResult.breakEvenOccupancy}%`);
      doc.text(`Loan Approved: ${dscrResult.loanApproved ? 'Yes' : 'No'}`);
      doc.text(`Maximum Qualifying Loan: ${this.formatCurrency(dscrResult.maxLoanAmount)}`);
      doc.moveDown();

      // Investment Metrics
      if (investmentMetrics) {
        doc.fontSize(16).text('Investment Analysis', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Cap Rate: ${investmentMetrics.capRate}%`);
        doc.text(`Cash-on-Cash Return: ${investmentMetrics.cashOnCashReturn}%`);
        doc.text(`Monthly Profit/Loss: ${this.formatCurrency(investmentMetrics.monthlyProfit)}`);
        doc.text(`Break-Even Period: ${investmentMetrics.breakEvenYears} years`);
        doc.text(`Total Investment: ${this.formatCurrency(investmentMetrics.metrics.totalInvestment)}`);
      }

      // Disclaimer
      doc.moveDown(2);
      doc.fontSize(9).fillColor('#666');
      doc.text('This report is for informational purposes only and should not be considered as financial advice.', {
        align: 'center'
      });

      doc.end();
    });
  }

  /**
   * Generate loan comparison report
   */
  async generateLoanComparisonReport(scenarios: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).text('Loan Comparison Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).fillColor('#666').text(new Date().toLocaleDateString(), { align: 'center' });
      doc.moveDown(2);

      // Comparison table
      const tableTop = 150;
      const col1 = 50;
      const colWidth = 120;

      // Table headers
      doc.fontSize(10).fillColor('#000');
      doc.text('Loan Details', col1, tableTop, { width: colWidth, align: 'left' });
      
      scenarios.forEach((scenario, index) => {
        const colX = col1 + (index + 1) * colWidth;
        doc.text(`Option ${index + 1}`, colX, tableTop, { width: colWidth, align: 'center' });
      });

      // Draw header line
      doc.moveTo(col1, tableTop + 20)
        .lineTo(col1 + (scenarios.length + 1) * colWidth, tableTop + 20)
        .stroke();

      // Table rows
      const rows = [
        { label: 'Loan Amount', key: 'loanAmount', format: 'currency' },
        { label: 'Interest Rate', key: 'interestRate', format: 'percent' },
        { label: 'Term', key: 'termMonths', format: 'months' },
        { label: 'Monthly Payment', key: 'monthlyPayment', format: 'currency' },
        { label: 'Total Interest', key: 'totalInterest', format: 'currency' },
        { label: 'LTV', key: 'ltv', format: 'percent' },
        { label: 'DTI', key: 'dti', format: 'percent' },
      ];

      let currentY = tableTop + 30;
      rows.forEach((row) => {
        doc.fontSize(9);
        doc.text(row.label, col1, currentY, { width: colWidth });
        
        scenarios.forEach((scenario, index) => {
          const colX = col1 + (index + 1) * colWidth;
          const value = this.getNestedValue(scenario, row.key);
          const formatted = this.formatValue(value, row.format);
          doc.text(formatted, colX, currentY, { width: colWidth, align: 'center' });
        });
        
        currentY += 20;
      });

      // Recommendation
      doc.moveDown(2);
      doc.fontSize(12).text('Recommendation', { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      
      // Find best option based on monthly payment
      const bestIndex = scenarios.reduce((best, current, index) => {
        const currentPayment = this.getNestedValue(current, 'monthlyPayment');
        const bestPayment = this.getNestedValue(scenarios[best], 'monthlyPayment');
        return currentPayment < bestPayment ? index : best;
      }, 0);
      
      doc.text(`Based on the analysis, Option ${bestIndex + 1} offers the lowest monthly payment.`);

      doc.end();
    });
  }

  // Helper methods
  private addHeader(doc: PDFKit.PDFDocument, scenario: Scenario) {
    doc.fontSize(20).text('Mortgage Scenario Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(scenario.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#666').text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);
  }

  private addExecutiveSummary(doc: PDFKit.PDFDocument, scenario: Scenario) {
    doc.fontSize(16).fillColor('#000').text('Executive Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    
    if (scenario.description) {
      doc.text(scenario.description);
      doc.moveDown();
    }

    doc.text(`Status: ${scenario.status.toUpperCase()}`);
    doc.text(`Created: ${new Date(scenario.createdAt).toLocaleDateString()}`);
    doc.moveDown(2);
  }

  private addLoanDetails(doc: PDFKit.PDFDocument, scenario: Scenario) {
    doc.fontSize(16).text('Loan Details', { underline: true });
    doc.moveDown();
    doc.fontSize(11);

    const loanData = scenario.loanData;
    
    if (loanData.borrower) {
      doc.text(`Borrower: ${loanData.borrower.firstName} ${loanData.borrower.lastName}`);
      doc.text(`Credit Score: ${loanData.borrower.creditScore || 'N/A'}`);
      doc.text(`Annual Income: ${this.formatCurrency(loanData.borrower.annualIncome || 0)}`);
      doc.moveDown();
    }

    if (loanData.property) {
      doc.text(`Property: ${loanData.property.address || 'N/A'}`);
      doc.text(`Purchase Price: ${this.formatCurrency(loanData.property.purchasePrice || 0)}`);
      doc.text(`Property Type: ${loanData.property.propertyType || 'N/A'}`);
      doc.moveDown();
    }

    if (loanData.loan) {
      doc.text(`Loan Amount: ${this.formatCurrency(loanData.loan.loanAmount || 0)}`);
      doc.text(`Loan Purpose: ${loanData.loan.loanPurpose || 'N/A'}`);
      doc.text(`Loan Type: ${loanData.loan.loanType || 'N/A'}`);
      doc.text(`Term: ${loanData.loan.termMonths || 360} months`);
    }
    
    doc.moveDown(2);
  }

  private addCalculationResults(doc: PDFKit.PDFDocument, scenario: Scenario) {
    doc.fontSize(16).text('Calculation Results', { underline: true });
    doc.moveDown();
    doc.fontSize(11);

    const calcs = scenario.calculations!;

    if (calcs.loanMetrics) {
      doc.text('Loan Metrics:', { underline: true });
      doc.text(`LTV: ${calcs.loanMetrics.loanToValue}%`);
      doc.text(`DTI: ${calcs.loanMetrics.debtToIncome}%`);
      doc.text(`Monthly Payment: ${this.formatCurrency(calcs.loanMetrics.monthlyPayment)}`);
      doc.text(`Affordability Score: ${calcs.loanMetrics.affordabilityScore}/100`);
      doc.moveDown();
    }

    if (calcs.dscr) {
      doc.text('DSCR Analysis:', { underline: true });
      doc.text(`DSCR: ${calcs.dscr.ratio}`);
      doc.text(`NOI: ${this.formatCurrency(calcs.dscr.netOperatingIncome)}`);
      doc.text(`Cash Flow: ${this.formatCurrency(calcs.dscr.cashFlow)}`);
      doc.text(`Approved: ${calcs.dscr.approved ? 'Yes' : 'No'}`);
    }
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    doc.fontSize(9).fillColor('#666');
    doc.text('This report is confidential and for professional use only.', 50, 700, {
      align: 'center',
      width: 500
    });
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatValue(value: any, format: string): string {
    if (value === null || value === undefined) return 'N/A';
    
    switch (format) {
      case 'currency':
        return this.formatCurrency(value);
      case 'percent':
        return `${value}%`;
      case 'months':
        return `${value} months`;
      default:
        return value.toString();
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
