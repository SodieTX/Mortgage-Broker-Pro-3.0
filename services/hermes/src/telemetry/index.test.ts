import { initializeTelemetry } from './index';
import { NodeSDK } from '@opentelemetry/sdk-node';

jest.mock('@opentelemetry/sdk-node', () => {
  return {
    NodeSDK: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Hermes Telemetry Initialization', () => {
  let originalProcessOn: any;
  let processOnMock: jest.Mock;
  let sdkInstance: NodeSDK;
  let originalShuttingDown: any;

  beforeEach(() => {
    processOnMock = jest.fn();
    originalProcessOn = process.on;
    (process as any).on = processOnMock;
    // Save and reset global shuttingDown if present
    originalShuttingDown = (global as any).shuttingDown;
    (global as any).shuttingDown = false;
  });

  afterEach(() => {
    (process as any).on = originalProcessOn;
    jest.clearAllMocks();
    (global as any).shuttingDown = originalShuttingDown;
  });

  it('should initialize and start the OpenTelemetry SDK', async () => {
    const sdk = initializeTelemetry();
    expect(NodeSDK).toHaveBeenCalled();
    expect(sdk.start).toBeDefined();
    expect(processOnMock).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnMock).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('should handle errors in sdk.start()', async () => {
    (NodeSDK as jest.Mock).mockImplementationOnce(() => ({
      start: jest.fn().mockRejectedValue(new Error('fail-start')),
      shutdown: jest.fn().mockResolvedValue(undefined),
    }));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    initializeTelemetry();
    // Wait for promise rejection
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).toHaveBeenCalledWith(
      'Failed to start OpenTelemetry SDK:',
      expect.any(Error)
    );
    spy.mockRestore();
  });

  it('should handle errors in sdk.shutdown()', async () => {
    const sdk = initializeTelemetry();
    const shutdownFn = processOnMock.mock.calls.find(([sig]) => sig === 'SIGTERM')[1];
    (sdk.shutdown as jest.Mock).mockRejectedValueOnce(new Error('fail-shutdown'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await shutdownFn();
    expect(spy).toHaveBeenCalledWith('Error terminating OpenTelemetry', expect.any(Error));
    spy.mockRestore();
  });

  it('should not shutdown twice if already shutting down', async () => {
    const sdk = initializeTelemetry();
    const shutdownFn = processOnMock.mock.calls.find(([sig]) => sig === 'SIGTERM')[1];
    // Simulate shuttingDown already true
    (global as any).shuttingDown = true;
    await shutdownFn();
    expect(sdk.shutdown).not.toHaveBeenCalled();
    (global as any).shuttingDown = false;
  });

  it('should log info on successful shutdown (SIGTERM)', async () => {
    const sdk = initializeTelemetry();
    const shutdownFn = processOnMock.mock.calls.find(([sig]) => sig === 'SIGTERM')[1];
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    await shutdownFn();
    expect(infoSpy).toHaveBeenCalledWith('OpenTelemetry terminated');
    infoSpy.mockRestore();
  });

  it('should log info on successful shutdown (SIGINT)', async () => {
    const sdk = initializeTelemetry();
    const shutdownFn = processOnMock.mock.calls.find(([sig]) => sig === 'SIGINT')[1];
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    await shutdownFn();
    expect(infoSpy).toHaveBeenCalledWith('OpenTelemetry terminated');
    infoSpy.mockRestore();
  });

  it('should handle non-Error thrown in sdk.start()', async () => {
    (NodeSDK as jest.Mock).mockImplementationOnce(() => ({
      start: jest.fn().mockRejectedValue('fail-start-string'),
      shutdown: jest.fn().mockResolvedValue(undefined),
    }));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    initializeTelemetry();
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).toHaveBeenCalledWith(
      'Failed to start OpenTelemetry SDK:',
      'fail-start-string'
    );
    spy.mockRestore();
  });

  it('should handle non-Error thrown in sdk.shutdown()', async () => {
    const sdk = initializeTelemetry();
    const shutdownFn = processOnMock.mock.calls.find(([sig]) => sig === 'SIGTERM')[1];
    (sdk.shutdown as jest.Mock).mockRejectedValueOnce('fail-shutdown-string');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await shutdownFn();
    expect(spy).toHaveBeenCalledWith('Error terminating OpenTelemetry', 'fail-shutdown-string');
    spy.mockRestore();
  });
});
