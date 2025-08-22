// Simple in-memory rate limiter for development
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_IP = 1; // One post per IP per 60 seconds

export class RateLimiter {
  static isAllowed(ip: string): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    // Clean up expired records
    if (record && now > record.resetTime) {
      rateLimitStore.delete(ip);
      return { allowed: true };
    }

    if (record) {
      const remaining = Math.max(0, MAX_REQUESTS_PER_IP - record.count);
      return {
        allowed: record.count < MAX_REQUESTS_PER_IP,
        resetTime: record.resetTime,
        remaining
      };
    }

    // Create new record
    const resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitStore.set(ip, { count: 1, resetTime });
    
    return { allowed: true, resetTime, remaining: MAX_REQUESTS_PER_IP - 1 };
  }

  static increment(ip: string): void {
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (record && now <= record.resetTime) {
      record.count++;
    } else {
      const resetTime = now + RATE_LIMIT_WINDOW;
      rateLimitStore.set(ip, { count: 1, resetTime });
    }
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(ip);
      }
    }
  }
}

// Cleanup old records every 5 minutes
if (typeof global.setInterval === 'function') {
  setInterval(() => {
    RateLimiter.cleanup();
  }, 5 * 60 * 1000);
}