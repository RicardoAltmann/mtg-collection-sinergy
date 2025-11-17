import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, LogLevel } from '../../src/js/utils/logger.js';

describe('logger.js', () => {
  beforeEach(() => {
    // Reset console spies before each test
    vi.clearAllMocks();
  });

  it('should have all log level methods', () => {
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.setLevel).toBeDefined();
  });

  it('should allow changing log level', () => {
    expect(() => logger.setLevel(LogLevel.DEBUG)).not.toThrow();
    expect(() => logger.setLevel(LogLevel.ERROR)).not.toThrow();
  });

  it('should log messages with correct prefixes', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    logger.setLevel(LogLevel.DEBUG);
    logger.debug('test message');
    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG]', 'test message');
  });

  it('should respect log level filtering', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    logger.setLevel(LogLevel.ERROR);
    logger.debug('should not appear');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
