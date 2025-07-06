/**
 * Task Queue Service
 * 
 * General-purpose background task processing for CPU-intensive operations
 */

import Queue from 'bull';
import { logger } from '../utils/logger';
import { ReportService } from './reportService';
import { getDatabase } from '../db/connection';
import { StorageService } from './storage.service';

export interface TaskJob {
  id: string;
  type: 'report' | 'calculation' | 'import' | 'export' | 'cleanup' | 'file-processing';
  data: any;
  priority?: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ReportTaskData {
  type: 'scenario' | 'dscr' | 'comparison';
  scenarioId?: string;
  reportData: any;
  userId: string;
}

export interface FileProcessingTaskData {
  filePath: string;
  operation: 'convert' | 'validate' | 'extract';
  format?: string;
  userId: string;
}

export interface CalculationTaskData {
  type: 'bulk-calculations' | 'scenario-analysis' | 'market-analysis';
  data: any;
  userId: string;
}

export interface ImportTaskData {
  filePath: string;
  type: 'borrowers' | 'properties' | 'rates';
  format: 'csv' | 'xlsx' | 'json';
  userId: string;
}

export class TaskQueueService {
  private taskQueue: Queue.Queue | null = null;
  private reportQueue: Queue.Queue | null = null;
  private fileQueue: Queue.Queue | null = null;
  private isInitialized = false;
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  /**
   * Initialize the task queue service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      };

      // Create different queues for different types of tasks
      this.taskQueue = new Queue('general-tasks', { redis: redisConfig });
      this.reportQueue = new Queue('report-generation', { redis: redisConfig });
      this.fileQueue = new Queue('file-processing', { redis: redisConfig });

      // Set up processors
      this.setupProcessors();
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('Task queue service initialized');
    } catch (error) {
      logger.error('Failed to initialize task queue service:', error);
      throw error;
    }
  }

  /**
   * Set up queue processors
   */
  private setupProcessors(): void {
    if (!this.taskQueue || !this.reportQueue || !this.fileQueue) return;

    // General task processor
    this.taskQueue.process('calculation', 5, this.processCalculationTask.bind(this));
    this.taskQueue.process('import', 2, this.processImportTask.bind(this));
    this.taskQueue.process('export', 2, this.processExportTask.bind(this));
    this.taskQueue.process('cleanup', 1, this.processCleanupTask.bind(this));

    // Report generation processor (CPU intensive, limit concurrency)
    this.reportQueue.process('scenario-report', 3, this.processScenarioReport.bind(this));
    this.reportQueue.process('dscr-report', 3, this.processDSCRReport.bind(this));
    this.reportQueue.process('comparison-report', 2, this.processComparisonReport.bind(this));

    // File processing processor
    this.fileQueue.process('file-convert', 2, this.processFileConversion.bind(this));
    this.fileQueue.process('file-validate', 5, this.processFileValidation.bind(this));
    this.fileQueue.process('data-extract', 3, this.processDataExtraction.bind(this));
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    const queues = [this.taskQueue, this.reportQueue, this.fileQueue];

    queues.forEach(queue => {
      if (!queue) return;

      queue.on('completed', (job) => {
        logger.info(`Task ${job.id} completed`, { type: job.name, queue: queue.name });
      });

      queue.on('failed', (job, err) => {
        logger.error(`Task ${job.id} failed`, { 
          type: job.name, 
          queue: queue.name, 
          error: err.message 
        });
      });

      queue.on('stalled', (job) => {
        logger.warn(`Task ${job.id} stalled`, { type: job.name, queue: queue.name });
      });

      queue.on('progress', (job, progress) => {
        logger.debug(`Task ${job.id} progress: ${progress}%`, { type: job.name });
      });
    });
  }

  // ===============================
  // PUBLIC QUEUE METHODS
  // ===============================

  /**
   * Queue a report generation task
   */
  async queueReportGeneration(
    reportData: ReportTaskData,
    priority: number = 0
  ): Promise<string> {
    await this.initialize();

    if (!this.reportQueue) {
      throw new Error('Report queue not available');
    }

    const jobType = `${reportData.type}-report`;
    const job = await this.reportQueue.add(jobType, reportData, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    return job.id.toString();
  }

  /**
   * Queue a calculation task
   */
  async queueCalculation(
    calculationData: CalculationTaskData,
    priority: number = 0
  ): Promise<string> {
    await this.initialize();

    if (!this.taskQueue) {
      throw new Error('Task queue not available');
    }

    const job = await this.taskQueue.add('calculation', calculationData, {
      priority,
      attempts: 2,
      removeOnComplete: 5,
      removeOnFail: 3,
    });

    return job.id.toString();
  }

  /**
   * Queue a file processing task
   */
  async queueFileProcessing(
    fileData: FileProcessingTaskData,
    priority: number = 0
  ): Promise<string> {
    await this.initialize();

    if (!this.fileQueue) {
      throw new Error('File queue not available');
    }

    const jobType = `file-${fileData.operation}`;
    const job = await this.fileQueue.add(jobType, fileData, {
      priority,
      attempts: 2,
      removeOnComplete: 5,
      removeOnFail: 3,
    });

    return job.id.toString();
  }

  /**
   * Queue a data import task
   */
  async queueDataImport(
    importData: ImportTaskData,
    priority: number = 0
  ): Promise<string> {
    await this.initialize();

    if (!this.taskQueue) {
      throw new Error('Task queue not available');
    }

    const job = await this.taskQueue.add('import', importData, {
      priority,
      attempts: 1, // Don't retry imports
      removeOnComplete: 3,
      removeOnFail: 5,
    });

    return job.id.toString();
  }

  /**
   * Schedule cleanup task
   */
  async scheduleCleanup(
    cleanupType: 'expired-sessions' | 'old-reports' | 'temp-files',
    scheduleTime?: Date
  ): Promise<string> {
    await this.initialize();

    if (!this.taskQueue) {
      throw new Error('Task queue not available');
    }

    const delay = scheduleTime ? scheduleTime.getTime() - Date.now() : 0;

    const job = await this.taskQueue.add('cleanup', { type: cleanupType }, {
      delay: Math.max(0, delay),
      attempts: 1,
      removeOnComplete: 1,
      removeOnFail: 1,
    });

    return job.id.toString();
  }

  // ===============================
  // TASK PROCESSORS
  // ===============================

  /**
   * Process scenario report generation
   */
  private async processScenarioReport(job: any): Promise<{ reportPath: string }> {
    const { scenarioId, userId } = job.data as ReportTaskData;
    
    job.progress(10);
    
    try {
      const database = await getDatabase();
      const scenarioResult = await database.query('SELECT * FROM scenarios WHERE id = $1', [scenarioId]);
      
      if (scenarioResult.rows.length === 0) {
        throw new Error('Scenario not found');
      }

      job.progress(30);

      const scenario = scenarioResult.rows[0];
      const pdfBuffer = await this.reportService.generateScenarioReport(scenario);

      job.progress(80);

      // Save to cloud storage
      const storage = new StorageService();
      const reportPath = `reports/${userId}/scenario-${scenarioId}-${Date.now()}.pdf`;
      
      const uploadedFile = await storage.uploadFile(
        pdfBuffer,
        reportPath,
        'application/pdf',
        StorageService.CONTAINERS.GENERATED_REPORTS,
        {
          userId,
          scenarioId,
          reportType: 'scenario',
          generatedAt: new Date().toISOString()
        }
      );
      
      logger.info(`Scenario report saved to storage: ${uploadedFile.url}`);
      
      // Store report URL in database for quick access
      await database.query(
        `INSERT INTO report_history (user_id, scenario_id, report_type, report_url, generated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [userId, scenarioId, 'scenario', uploadedFile.url]
      );

      job.progress(100);

      // Optionally send notification email
      // await this.notifyReportReady(userId, reportPath, 'scenario');

      return { reportPath };
    } catch (error) {
      logger.error('Failed to process scenario report:', error);
      throw error;
    }
  }

  /**
   * Process DSCR report generation
   */
  private async processDSCRReport(job: any): Promise<{ reportPath: string }> {
    const { reportData, userId } = job.data as ReportTaskData;
    
    job.progress(20);

    try {
      const { property, loanAmount, interestRate, termMonths, purchasePrice } = reportData;
      
      const pdfBuffer = await this.reportService.generateDSCRReport(
        property,
        loanAmount,
        interestRate,
        termMonths,
        purchasePrice
      );

      job.progress(80);

      // Save to cloud storage
      const storage = new StorageService();
      const reportPath = `reports/${userId}/dscr-${Date.now()}.pdf`;
      
      const uploadedFile = await storage.uploadFile(
        pdfBuffer,
        reportPath,
        'application/pdf',
        StorageService.CONTAINERS.GENERATED_REPORTS,
        {
          userId,
          reportType: 'dscr',
          property: JSON.stringify(property),
          loanAmount: loanAmount.toString(),
          generatedAt: new Date().toISOString()
        }
      );
      
      logger.info(`DSCR report saved to storage: ${uploadedFile.url}`);
      
      // Store report URL in database
      const db = await getDatabase();
      await db.query(
        `INSERT INTO report_history (user_id, report_type, report_url, metadata, generated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, 'dscr', uploadedFile.url, JSON.stringify({ property, loanAmount, interestRate, termMonths })]
      );
      
      job.progress(100);

      return { reportPath };
    } catch (error) {
      logger.error('Failed to process DSCR report:', error);
      throw error;
    }
  }

  /**
   * Process comparison report generation
   */
  private async processComparisonReport(job: any): Promise<{ reportPath: string }> {
    const { reportData, userId } = job.data as ReportTaskData;
    
    job.progress(20);

    try {
      const { scenarios } = reportData;
      
      const pdfBuffer = await this.reportService.generateLoanComparisonReport(scenarios);

      job.progress(80);

      // Save to cloud storage
      const storageService = new StorageService();
      const reportPath = `reports/${userId}/comparison-${Date.now()}.pdf`;
      
      const uploadedFile = await storageService.uploadFile(
        pdfBuffer,
        reportPath,
        'application/pdf',
        StorageService.CONTAINERS.GENERATED_REPORTS,
        {
          userId,
          reportType: 'comparison',
          scenarioCount: scenarios.length.toString(),
          generatedAt: new Date().toISOString()
        }
      );
      
      logger.info(`Comparison report saved to storage: ${uploadedFile.url}`);
      
      // Store report URL in database
      const db = await getDatabase();
      await db.query(
        `INSERT INTO report_history (user_id, report_type, report_url, metadata, generated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, 'comparison', uploadedFile.url, JSON.stringify({ scenarioIds: scenarios.map((s: any) => s.id) })]
      );
      
      job.progress(100);

      return { reportPath };
    } catch (error) {
      logger.error('Failed to process comparison report:', error);
      throw error;
    }
  }

  /**
   * Process calculation tasks
   */
  private async processCalculationTask(job: any): Promise<any> {
    const { type, data, userId } = job.data as CalculationTaskData;
    
    job.progress(10);
    logger.debug(`Processing ${type} calculation for user ${userId}`);

    try {
      switch (type) {
        case 'bulk-calculations':
          return await this.processBulkCalculations(data, job);
        case 'scenario-analysis':
          return await this.processScenarioAnalysis(data, job);
        case 'market-analysis':
          return await this.processMarketAnalysis(data, job);
        default:
          throw new Error(`Unknown calculation type: ${type}`);
      }
    } catch (error) {
      logger.error(`Failed to process ${type} calculation:`, error);
      throw error;
    }
  }

  /**
   * Process data import tasks
   */
  private async processImportTask(job: any): Promise<{ imported: number; errors: string[] }> {
    const { filePath, type, format, userId } = job.data as ImportTaskData;
    
    job.progress(10);

    try {
      // Implementation would depend on the import type
      logger.info(`Processing ${type} import from ${filePath} for user ${userId}`);
      
      job.progress(50);
      
      // Process file based on format and type
      const result = await this.processDataFile(filePath, type, format, job);
      
      job.progress(100);

      return result;
    } catch (error) {
      logger.error('Failed to process import task:', error);
      throw error;
    }
  }

  /**
   * Process file processing tasks
   */
  private async processFileConversion(job: any): Promise<{ outputPath: string }> {
    const { filePath, format, userId } = job.data as FileProcessingTaskData;
    
    job.progress(20);
    logger.debug(`Converting file ${filePath} to ${format} for user ${userId}`);

    try {
      // Download source file from storage
      const storageService = new StorageService();
      const sourceBuffer = await storageService.downloadFile(filePath, StorageService.CONTAINERS.TEMP_UPLOADS);
      
      let convertedBuffer: Buffer;
      let mimeType: string;
      
      // Perform conversion based on format
      switch (format) {
        case 'pdf':
          // Convert to PDF (if not already)
          convertedBuffer = await this.convertToPdf(sourceBuffer, filePath);
          mimeType = 'application/pdf';
          break;
        case 'csv':
          // Convert to CSV (from Excel, JSON, etc.)
          convertedBuffer = await this.convertToCsv(sourceBuffer, filePath);
          mimeType = 'text/csv';
          break;
        case 'json':
          // Convert to JSON
          convertedBuffer = await this.convertToJson(sourceBuffer, filePath);
          mimeType = 'application/json';
          break;
        default:
          throw new Error(`Unsupported conversion format: ${format}`);
      }
      
      job.progress(80);
      
      // Upload converted file
      const outputPath = `converted/${userId}/${Date.now()}.${format}`;
      const uploadedFile = await storageService.uploadFile(
        convertedBuffer,
        outputPath,
        mimeType,
        StorageService.CONTAINERS.TEMP_UPLOADS,
        {
          userId,
          originalFile: filePath,
          conversionType: format,
          convertedAt: new Date().toISOString()
        }
      );
      
      job.progress(100);

      return { outputPath };
    } catch (error) {
      logger.error('Failed to process file conversion:', error);
      throw error;
    }
  }

  private async processFileValidation(job: any): Promise<{ valid: boolean; errors: string[] }> {
    // Implementation for file validation
    job.progress(100);
    return { valid: true, errors: [] };
  }

  private async processDataExtraction(job: any): Promise<{ data: any[] }> {
    // Implementation for data extraction
    job.progress(100);
    return { data: [] };
  }

  private async processExportTask(job: any): Promise<{ exportPath: string }> {
    const { type, data, format, userId } = job.data;
    
    job.progress(10);

    try {
      logger.info(`Processing ${type} export for user ${userId}`);
      
      job.progress(50);
      
      // Process export based on type and format
      let exportBuffer: Buffer;
      let mimeType: string;
      
      switch (format) {
        case 'csv':
          exportBuffer = await this.exportToCsv(data, type);
          mimeType = 'text/csv';
          break;
        case 'json':
          exportBuffer = Buffer.from(JSON.stringify(data, null, 2));
          mimeType = 'application/json';
          break;
        case 'xlsx':
          exportBuffer = await this.exportToExcel(data, type);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'pdf':
          exportBuffer = await this.exportToPdf(data, type);
          mimeType = 'application/pdf';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      // Save to storage
      const storageService = new StorageService();
      const exportPath = `exports/${userId}/${type}-${Date.now()}.${format}`;
      
      const uploadedFile = await storageService.uploadFile(
        exportBuffer,
        exportPath,
        mimeType,
        StorageService.CONTAINERS.GENERATED_REPORTS,
        {
          userId,
          exportType: type,
          format,
          recordCount: Array.isArray(data) ? data.length.toString() : '1',
          exportedAt: new Date().toISOString()
        }
      );
      
      logger.info(`Data exported to: ${uploadedFile.url}`);
      
      // Store export record in database
      const db = await getDatabase();
      await db.query(
        `INSERT INTO export_history (user_id, export_type, format, file_url, record_count, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, type, format, uploadedFile.url, Array.isArray(data) ? data.length : 1]
      );
      
      job.progress(100);

      return { exportPath };
    } catch (error) {
      logger.error('Failed to process export task:', error);
      throw error;
    }
  }

  private async processCleanupTask(job: any): Promise<{ cleaned: number }> {
    const { type } = job.data;
    
    job.progress(20);

    try {
      let cleaned = 0;
      
      switch (type) {
        case 'expired-sessions':
          cleaned = await this.cleanExpiredSessions();
          break;
        case 'old-reports':
          cleaned = await this.cleanOldReports();
          break;
        case 'temp-files':
          cleaned = await this.cleanTempFiles();
          break;
      }

      job.progress(100);

      return { cleaned };
    } catch (error) {
      logger.error(`Failed to process cleanup task ${type}:`, error);
      throw error;
    }
  }

  // ===============================
  // HELPER METHODS
  // ===============================

  private async processBulkCalculations(data: any, job: any): Promise<any> {
    const { scenarios, calculationType, parameters } = data;
    const results = [];
    
    logger.info(`Processing bulk calculations: ${calculationType} for ${scenarios.length} scenarios`);
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      job.progress(Math.floor((i / scenarios.length) * 90));
      
      try {
        let result;
        switch (calculationType) {
          case 'monthly-payment':
            result = this.calculateMonthlyPayment(
              scenario.loanAmount,
              scenario.interestRate,
              scenario.termMonths
            );
            break;
          case 'total-interest':
            result = this.calculateTotalInterest(
              scenario.loanAmount,
              scenario.interestRate,
              scenario.termMonths
            );
            break;
          case 'amortization':
            result = this.generateAmortizationSchedule(
              scenario.loanAmount,
              scenario.interestRate,
              scenario.termMonths
            );
            break;
          case 'ltv':
            result = this.calculateLTV(
              scenario.loanAmount,
              scenario.propertyValue || scenario.purchasePrice
            );
            break;
          case 'dti':
            result = this.calculateDTI(
              scenario.monthlyDebt,
              scenario.monthlyIncome
            );
            break;
          default:
            throw new Error(`Unknown calculation type: ${calculationType}`);
        }
        
        results.push({
          scenarioId: scenario.id,
          calculationType,
          result,
          status: 'success'
        });
      } catch (error) {
        logger.error(`Failed to calculate for scenario ${scenario.id}:`, error);
        results.push({
          scenarioId: scenario.id,
          calculationType,
          error: error.message,
          status: 'failed'
        });
      }
    }
    
    job.progress(100);
    
    return {
      results,
      summary: {
        total: scenarios.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length
      }
    };
  }

  private async processScenarioAnalysis(data: any, job: any): Promise<any> {
    const { scenarioId, analysisType, parameters } = data;
    
    logger.info(`Processing scenario analysis: ${analysisType} for scenario ${scenarioId}`);
    
    const db = await getDatabase();
    const scenarioResult = await db.query('SELECT * FROM scenarios WHERE id = $1', [scenarioId]);
    
    if (scenarioResult.rows.length === 0) {
      throw new Error('Scenario not found');
    }
    
    const scenario = scenarioResult.rows[0];
    const loanData = scenario.loan_data;
    
    job.progress(30);
    
    let analysis = {};
    
    switch (analysisType) {
      case 'sensitivity':
        // Analyze how changes in key variables affect the scenario
        analysis = {
          interestRateSensitivity: this.analyzeInterestRateSensitivity(loanData, parameters),
          ltvSensitivity: this.analyzeLTVSensitivity(loanData, parameters),
          incomeSensitivity: this.analyzeIncomeSensitivity(loanData, parameters)
        };
        break;
        
      case 'risk-assessment':
        // Comprehensive risk analysis
        analysis = {
          creditRisk: this.assessCreditRisk(loanData),
          marketRisk: this.assessMarketRisk(loanData),
          liquidityRisk: this.assessLiquidityRisk(loanData),
          overallRiskScore: this.calculateOverallRiskScore(loanData)
        };
        break;
        
      case 'profitability':
        // Analyze profitability metrics
        analysis = {
          netPresentValue: this.calculateNPV(loanData, parameters),
          internalRateOfReturn: this.calculateIRR(loanData, parameters),
          profitMargin: this.calculateProfitMargin(loanData, parameters),
          breakEvenPoint: this.calculateBreakEvenPoint(loanData, parameters)
        };
        break;
        
      case 'comparison':
        // Compare with similar scenarios
        const similarScenarios = await this.findSimilarScenarios(scenario, parameters);
        analysis = {
          comparedScenarios: similarScenarios.length,
          performanceRanking: this.rankScenarioPerformance(scenario, similarScenarios),
          recommendations: this.generateRecommendations(scenario, similarScenarios)
        };
        break;
        
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
    
    job.progress(90);
    
    // Store analysis results
    await db.query(
      `INSERT INTO scenario_analysis (scenario_id, analysis_type, results, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [scenarioId, analysisType, JSON.stringify(analysis)]
    );
    
    job.progress(100);
    
    return {
      scenarioId,
      analysisType,
      analysis,
      timestamp: new Date().toISOString()
    };
  }

  private async processMarketAnalysis(data: any, job: any): Promise<any> {
    const { location, propertyType, dateRange, analysisDepth } = data;
    
    logger.info(`Processing market analysis for ${location} - ${propertyType}`);
    
    job.progress(20);
    
    const db = await getDatabase();
    
    // Gather market data from various sources
    const marketData = {
      location,
      propertyType,
      dateRange,
      
      // Historical price trends
      priceTrends: await this.analyzePriceTrends(location, propertyType, dateRange),
      
      // Market inventory analysis
      inventory: await this.analyzeInventory(location, propertyType),
      
      // Days on market trends
      marketVelocity: await this.analyzeMarketVelocity(location, propertyType),
      
      // Interest rate impact
      rateImpact: await this.analyzeRateImpact(location, dateRange),
      
      // Comparable sales analysis
      comparables: await this.findComparables(location, propertyType, dateRange),
      
      // Market forecast
      forecast: await this.generateMarketForecast(location, propertyType)
    };
    
    job.progress(70);
    
    // Calculate market indicators
    const indicators = {
      marketHealth: this.calculateMarketHealth(marketData),
      buyerMarketScore: this.calculateBuyerMarketScore(marketData),
      investmentPotential: this.calculateInvestmentPotential(marketData),
      riskLevel: this.assessMarketRisk(marketData)
    };
    
    job.progress(90);
    
    // Store analysis results
    await db.query(
      `INSERT INTO market_analysis (location, property_type, analysis_data, indicators, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [location, propertyType, JSON.stringify(marketData), JSON.stringify(indicators)]
    );
    
    job.progress(100);
    
    return {
      marketData,
      indicators,
      recommendations: this.generateMarketRecommendations(marketData, indicators),
      timestamp: new Date().toISOString()
    };
  }

  private async processDataFile(filePath: string, type: string, format: string, job: any): Promise<{ imported: number; errors: string[] }> {
    // TODO: Implementation for data file processing
    logger.debug(`Processing ${type} data file ${filePath} in ${format} format`);
    job.progress(100);
    return { imported: 0, errors: [] };
  }

  private async cleanExpiredSessions(): Promise<number> {
    const db = await getDatabase();
    const result = await db.query(
      'DELETE FROM auth.user_sessions WHERE expires_at < NOW()'
    );
    return result.rowCount || 0;
  }

  private async cleanOldReports(): Promise<number> {
    // Implementation for cleaning old reports
    return 0;
  }

  private async cleanTempFiles(): Promise<number> {
    // Implementation for cleaning temp files
    return 0;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    await this.initialize();

    const queues = [
      { name: 'tasks', queue: this.taskQueue },
      { name: 'reports', queue: this.reportQueue },
      { name: 'files', queue: this.fileQueue },
    ];

    const stats: any = {};

    for (const { name, queue } of queues) {
      if (queue) {
        stats[name] = {
          waiting: await queue.getWaitingCount(),
          active: await queue.getActiveCount(),
          completed: await queue.getCompletedCount(),
          failed: await queue.getFailedCount(),
          delayed: await queue.getDelayedCount(),
        };
      } else {
        stats[name] = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
      }
    }

    return stats;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<any> {
    await this.initialize();

    const queues = [this.taskQueue, this.reportQueue, this.fileQueue];

    for (const queue of queues) {
      if (!queue) continue;

      try {
        const job = await queue.getJob(jobId);
        if (job) {
          return {
            id: job.id,
            name: job.name,
            data: job.data,
            progress: job.progress(),
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            returnvalue: job.returnvalue,
          };
        }
      } catch (error) {
        // Job not found in this queue, continue
      }
    }

    return null;
  }
}

// Export singleton instance
export const taskQueueService = new TaskQueueService();
