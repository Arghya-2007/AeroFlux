// Must be imported before any other module
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const isProduction = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',

  integrations: [
    // CPU profiling for performance bottleneck detection
    nodeProfilingIntegration(),
  ],

  // Performance Monitoring — capture 100% in dev, 20% in production
  tracesSampleRate: isProduction ? 0.2 : 1.0,

  // Profiling — sample 100% of transactions that are already sampled for tracing
  profilesSampleRate: 1.0,

  // Send default PII (IP addresses, cookies) — adjust per your privacy policy
  sendDefaultPii: true,

  // Attach stack traces to pure capture messages
  attachStacktrace: true,

  // Filter out health-check noise from transactions
  ignoreTransactions: [
    'GET /api/v1/health',
    'GET /api/v1',
  ],

  // Before sending an event, strip sensitive headers
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },

  // Before sending a breadcrumb, filter console noise in production
  beforeBreadcrumb(breadcrumb) {
    if (isProduction && breadcrumb.category === 'console') {
      return null;
    }
    return breadcrumb;
  },
});

