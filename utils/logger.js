// utils/logger.js
// Activity logger for SSI wallet operations

class Logger {
  constructor() {
    this.logs = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type,
      id: Date.now() + Math.random(),
    };
    
    // Add to beginning of array
    this.logs.unshift(logEntry);
    
    // Keep only last 50 logs for performance
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(0, 50);
    }
    
    // Console log with emoji indicators
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    return logEntry;
  }

  info(message) {
    return this.log(message, 'info');
  }

  success(message) {
    return this.log(message, 'success');
  }

  error(message) {
    return this.log(message, 'error');
  }

  warning(message) {
    return this.log(message, 'warning');
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    console.log('🗑️ Logs cleared');
  }
}

// Export singleton instance
export default new Logger();