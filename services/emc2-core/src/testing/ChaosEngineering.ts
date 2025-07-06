/**
 * Chaos Engineering Framework
 * 
 * Microsoft/Netflix-inspired approach to test system resilience
 * through controlled chaos injection
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { FastifyInstance } from 'fastify';
import { EventEmitter } from 'events';

/**
 * Types of chaos that can be injected
 */
export enum ChaosType {
  // Network chaos
  NETWORK_LATENCY = 'network_latency',
  NETWORK_FAILURE = 'network_failure',
  NETWORK_PACKET_LOSS = 'network_packet_loss',
  
  // Database chaos
  DATABASE_SLOW_QUERY = 'database_slow_query',
  DATABASE_CONNECTION_LOSS = 'database_connection_loss',
  DATABASE_DEADLOCK = 'database_deadlock',
  
  // Redis chaos
  REDIS_LATENCY = 'redis_latency',
  REDIS_MEMORY_PRESSURE = 'redis_memory_pressure',
  REDIS_CONNECTION_FAILURE = 'redis_connection_failure',
  
  // Resource chaos
  CPU_SPIKE = 'cpu_spike',
  MEMORY_LEAK = 'memory_leak',
  DISK_FULL = 'disk_full',
  
  // Application chaos
  RANDOM_EXCEPTION = 'random_exception',
  SLOW_FUNCTION = 'slow_function',
  INFINITE_LOOP = 'infinite_loop',
  
  // Time chaos
  CLOCK_SKEW = 'clock_skew',
  TIME_TRAVEL = 'time_travel'
}

/**
 * Chaos experiment configuration
 */
export interface ChaosExperiment {
  name: string;
  description: string;
  chaosType: ChaosType;
  target: string;
  duration: number;
  intensity: number; // 0-100
  schedule?: {
    start: Date;
    end: Date;
    frequency: 'once' | 'periodic' | 'random';
    interval?: number;
  };
}

/**
 * Chaos result
 */
export interface ChaosResult {
  experiment: ChaosExperiment;
  startTime: Date;
  endTime: Date;
  systemMetrics: {
    availability: number;
    errorRate: number;
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: number;
  };
  failures: Array<{
    time: Date;
    type: string;
    message: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }>;
  recovered: boolean;
  recoveryTime?: number;
}

/**
 * Chaos Monkey - Injects chaos into the system
 */
export class ChaosMonkey extends EventEmitter {
  private active: boolean = false;
  private experiments: Map<string, ChaosExperiment> = new Map();
  private activeExperiments: Set<string> = new Set();
  
  constructor(
    private db?: Pool,
    private redis?: Redis,
    private app?: FastifyInstance
  ) {
    super();
  }
  
  /**
   * Start the chaos monkey
   */
  start(): void {
    this.active = true;
    this.emit('started');
    console.log('🐵 Chaos Monkey activated!');
  }
  
  /**
   * Stop the chaos monkey
   */
  stop(): void {
    this.active = false;
    this.activeExperiments.clear();
    this.emit('stopped');
    console.log('🐵 Chaos Monkey deactivated');
  }
  
  /**
   * Run a chaos experiment
   */
  async runExperiment(experiment: ChaosExperiment): Promise<ChaosResult> {
    if (!this.active) {
      throw new Error('Chaos Monkey is not active');
    }
    
    const experimentId = `${experiment.name}-${Date.now()}`;
    this.activeExperiments.add(experimentId);
    
    const result: ChaosResult = {
      experiment,
      startTime: new Date(),
      endTime: new Date(),
      systemMetrics: {
        availability: 100,
        errorRate: 0,
        latency: { p50: 0, p95: 0, p99: 0 },
        throughput: 0
      },
      failures: [],
      recovered: true
    };
    
    try {
      this.emit('experiment:start', experiment);
      
      // Inject chaos based on type
      switch (experiment.chaosType) {
        case ChaosType.NETWORK_LATENCY:
          await this.injectNetworkLatency(experiment);
          break;
          
        case ChaosType.DATABASE_SLOW_QUERY:
          await this.injectDatabaseSlowQuery(experiment);
          break;
          
        case ChaosType.REDIS_LATENCY:
          await this.injectRedisLatency(experiment);
          break;
          
        case ChaosType.CPU_SPIKE:
          await this.injectCPUSpike(experiment);
          break;
          
        case ChaosType.MEMORY_LEAK:
          await this.injectMemoryLeak(experiment);
          break;
          
        case ChaosType.RANDOM_EXCEPTION:
          await this.injectRandomException(experiment);
          break;
          
        case ChaosType.CLOCK_SKEW:
          await this.injectClockSkew(experiment);
          break;
          
        default:
          throw new Error(`Unknown chaos type: ${experiment.chaosType}`);
      }
      
      // Monitor system during chaos
      result.systemMetrics = await this.monitorSystem(experiment.duration);
      
    } catch (error) {
      result.failures.push({
        time: new Date(),
        type: 'experiment_failure',
        message: error instanceof Error ? error.message : 'Unknown error',
        impact: 'high'
      });
      result.recovered = false;
    } finally {
      result.endTime = new Date();
      this.activeExperiments.delete(experimentId);
      this.emit('experiment:end', result);
    }
    
    return result;
  }
  
  /**
   * Inject network latency
   */
  private async injectNetworkLatency(experiment: ChaosExperiment): Promise<void> {
    const baseLatency = 50; // Base latency in ms
    const additionalLatency = (experiment.intensity / 100) * 5000; // Up to 5s
    
    if (this.app) {
      this.app.addHook('onRequest', async (request, reply) => {
        if (Math.random() * 100 < experiment.intensity) {
          const delay = baseLatency + Math.random() * additionalLatency;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      });
    }
    
    await this.maintainChaos(experiment.duration);
  }
  
  /**
   * Inject database slow queries
   */
  private async injectDatabaseSlowQuery(experiment: ChaosExperiment): Promise<void> {
    if (!this.db) return;
    
    const originalQuery = this.db.query.bind(this.db);
    
    // Monkey patch the query method
    (this.db as any).query = async function(...args: any[]) {
      if (Math.random() * 100 < experiment.intensity) {
        // Add artificial delay
        const delay = 100 + Math.random() * 5000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return originalQuery(...args);
    };
    
    await this.maintainChaos(experiment.duration);
    
    // Restore original method
    (this.db as any).query = originalQuery;
  }
  
  /**
   * Inject Redis latency
   */
  private async injectRedisLatency(experiment: ChaosExperiment): Promise<void> {
    if (!this.redis) return;
    
    const methods = ['get', 'set', 'del', 'incr', 'expire'];
    const originalMethods: Record<string, Function> = {};
    
    // Monkey patch Redis methods
    methods.forEach(method => {
      originalMethods[method] = (this.redis as any)[method].bind(this.redis);
      
      (this.redis as any)[method] = async function(...args: any[]) {
        if (Math.random() * 100 < experiment.intensity) {
          const delay = 50 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return originalMethods[method](...args);
      };
    });
    
    await this.maintainChaos(experiment.duration);
    
    // Restore original methods
    methods.forEach(method => {
      (this.redis as any)[method] = originalMethods[method];
    });
  }
  
  /**
   * Inject CPU spike
   */
  private async injectCPUSpike(experiment: ChaosExperiment): Promise<void> {
    const endTime = Date.now() + experiment.duration;
    
    const cpuBurner = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(cpuBurner);
        return;
      }
      
      // Burn CPU cycles
      const intensity = experiment.intensity / 100;
      const iterations = 1000000 * intensity;
      
      for (let i = 0; i < iterations; i++) {
        Math.sqrt(Math.random());
      }
    }, 100);
    
    await this.maintainChaos(experiment.duration);
  }
  
  /**
   * Inject memory leak
   */
  private async injectMemoryLeak(experiment: ChaosExperiment): Promise<void> {
    const leakedObjects: any[] = [];
    const endTime = Date.now() + experiment.duration;
    
    const leaker = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(leaker);
        return;
      }
      
      // Leak memory based on intensity
      const size = 1024 * 1024 * (experiment.intensity / 100); // Up to 1MB per interval
      const leak = Buffer.alloc(size);
      leakedObjects.push(leak);
    }, 1000);
    
    await this.maintainChaos(experiment.duration);
    
    // Clean up (in real chaos, this wouldn't happen)
    leakedObjects.length = 0;
  }
  
  /**
   * Inject random exceptions
   */
  private async injectRandomException(experiment: ChaosExperiment): Promise<void> {
    if (!this.app) return;
    
    this.app.addHook('preHandler', async (request, reply) => {
      if (Math.random() * 100 < experiment.intensity) {
        throw new Error('🐵 Chaos Monkey says: Random failure!');
      }
    });
    
    await this.maintainChaos(experiment.duration);
  }
  
  /**
   * Inject clock skew
   */
  private async injectClockSkew(experiment: ChaosExperiment): Promise<void> {
    const originalDateNow = Date.now;
    const skewMs = (experiment.intensity / 100) * 3600000; // Up to 1 hour
    
    Date.now = function() {
      return originalDateNow() + (Math.random() - 0.5) * 2 * skewMs;
    };
    
    await this.maintainChaos(experiment.duration);
    
    Date.now = originalDateNow;
  }
  
  /**
   * Maintain chaos for specified duration
   */
  private async maintainChaos(duration: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration));
  }
  
  /**
   * Monitor system metrics during chaos
   */
  private async monitorSystem(duration: number): Promise<ChaosResult['systemMetrics']> {
    const startTime = Date.now();
    const metrics = {
      requests: 0,
      errors: 0,
      latencies: [] as number[],
      availability: 100
    };
    
    // Simulate monitoring
    const monitor = setInterval(() => {
      // In real implementation, would collect actual metrics
      metrics.requests++;
      
      if (Math.random() < 0.1) { // 10% error rate during chaos
        metrics.errors++;
      }
      
      metrics.latencies.push(50 + Math.random() * 500);
    }, 100);
    
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(monitor);
    
    // Calculate final metrics
    const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
    const sortedLatencies = metrics.latencies.sort((a, b) => a - b);
    
    return {
      availability: 100 - errorRate,
      errorRate,
      latency: {
        p50: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0,
        p95: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
        p99: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0
      },
      throughput: (metrics.requests / (duration / 1000))
    };
  }
}

/**
 * Chaos test scenarios
 */
export class ChaosScenarios {
  /**
   * Black Friday scenario - extreme load
   */
  static blackFriday(): ChaosExperiment[] {
    return [
      {
        name: 'black-friday-cpu',
        description: 'Simulate high CPU usage during peak traffic',
        chaosType: ChaosType.CPU_SPIKE,
        target: 'all',
        duration: 300000, // 5 minutes
        intensity: 80
      },
      {
        name: 'black-friday-db',
        description: 'Simulate database slowdown under load',
        chaosType: ChaosType.DATABASE_SLOW_QUERY,
        target: 'database',
        duration: 300000,
        intensity: 60
      },
      {
        name: 'black-friday-network',
        description: 'Simulate network congestion',
        chaosType: ChaosType.NETWORK_LATENCY,
        target: 'network',
        duration: 300000,
        intensity: 70
      }
    ];
  }
  
  /**
   * Infrastructure failure scenario
   */
  static infrastructureFailure(): ChaosExperiment[] {
    return [
      {
        name: 'db-connection-loss',
        description: 'Database becomes unavailable',
        chaosType: ChaosType.DATABASE_CONNECTION_LOSS,
        target: 'database',
        duration: 60000, // 1 minute
        intensity: 100
      },
      {
        name: 'redis-failure',
        description: 'Redis cache fails',
        chaosType: ChaosType.REDIS_CONNECTION_FAILURE,
        target: 'redis',
        duration: 30000,
        intensity: 100
      }
    ];
  }
  
  /**
   * Gradual degradation scenario
   */
  static gradualDegradation(): ChaosExperiment[] {
    const experiments: ChaosExperiment[] = [];
    
    // Gradually increase intensity
    for (let i = 0; i < 5; i++) {
      experiments.push({
        name: `gradual-degradation-${i}`,
        description: `Gradual system degradation phase ${i + 1}`,
        chaosType: ChaosType.NETWORK_LATENCY,
        target: 'all',
        duration: 60000,
        intensity: (i + 1) * 20
      });
    }
    
    return experiments;
  }
}

/**
 * Resilience validator
 */
export class ResilienceValidator {
  /**
   * Validate system resilience based on chaos results
   */
  static validate(results: ChaosResult[]): ResilienceReport {
    const totalExperiments = results.length;
    const successfulRecoveries = results.filter(r => r.recovered).length;
    const criticalFailures = results.flatMap(r => 
      r.failures.filter(f => f.impact === 'critical')
    ).length;
    
    const avgRecoveryTime = results
      .filter(r => r.recoveryTime)
      .reduce((sum, r) => sum + r.recoveryTime!, 0) / 
      results.filter(r => r.recoveryTime).length || 0;
    
    const overallScore = this.calculateResilienceScore(results);
    
    return {
      totalExperiments,
      successfulRecoveries,
      criticalFailures,
      avgRecoveryTime,
      overallScore,
      recommendations: this.generateRecommendations(results),
      breakdown: {
        availability: this.calculateAvgMetric(results, 'availability'),
        errorRate: this.calculateAvgMetric(results, 'errorRate'),
        latency: {
          p50: this.calculateAvgLatency(results, 'p50'),
          p95: this.calculateAvgLatency(results, 'p95'),
          p99: this.calculateAvgLatency(results, 'p99')
        }
      }
    };
  }
  
  private static calculateResilienceScore(results: ChaosResult[]): number {
    let score = 100;
    
    results.forEach(result => {
      // Deduct points for failures
      score -= result.failures.length * 5;
      
      // Deduct points for not recovering
      if (!result.recovered) score -= 20;
      
      // Deduct points for poor metrics
      if (result.systemMetrics.availability < 99) score -= 10;
      if (result.systemMetrics.errorRate > 5) score -= 10;
      if (result.systemMetrics.latency.p99 > 1000) score -= 5;
    });
    
    return Math.max(0, score);
  }
  
  private static calculateAvgMetric(results: ChaosResult[], metric: string): number {
    const values = results.map(r => (r.systemMetrics as any)[metric]);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private static calculateAvgLatency(results: ChaosResult[], percentile: string): number {
    const values = results.map(r => (r.systemMetrics.latency as any)[percentile]);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private static generateRecommendations(results: ChaosResult[]): string[] {
    const recommendations: string[] = [];
    
    // Check for database issues
    const dbFailures = results.filter(r => 
      r.experiment.chaosType.includes('DATABASE')
    );
    if (dbFailures.some(r => !r.recovered)) {
      recommendations.push('Implement database connection pooling and retry logic');
      recommendations.push('Add read replicas for failover');
    }
    
    // Check for high latency
    const highLatency = results.filter(r => 
      r.systemMetrics.latency.p99 > 2000
    );
    if (highLatency.length > 0) {
      recommendations.push('Implement request timeouts and circuit breakers');
      recommendations.push('Add caching layer to reduce load');
    }
    
    // Check for memory issues
    const memoryIssues = results.filter(r => 
      r.experiment.chaosType === ChaosType.MEMORY_LEAK
    );
    if (memoryIssues.some(r => !r.recovered)) {
      recommendations.push('Implement memory monitoring and alerts');
      recommendations.push('Add automatic restart on memory threshold');
    }
    
    return recommendations;
  }
}

/**
 * Resilience report
 */
export interface ResilienceReport {
  totalExperiments: number;
  successfulRecoveries: number;
  criticalFailures: number;
  avgRecoveryTime: number;
  overallScore: number;
  recommendations: string[];
  breakdown: {
    availability: number;
    errorRate: number;
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
}
