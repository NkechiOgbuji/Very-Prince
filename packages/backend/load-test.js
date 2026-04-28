import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Load test configuration
export const options = {
  stages: [
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 1000 }, // Hold at 1000 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // Less than 0.1% failed requests
    http_reqs: ['rate>500'], // More than 500 requests per second
  },
  rps: 1000, // Target 1000 requests per second
};

// Base URL for the API
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testOrgs = ['org1', 'org2', 'org3', 'org4', 'org5'];

export function setup() {
  console.log('Load test setup complete');
  return { orgs: testOrgs };
}

export default function(data) {
  // Randomly select an organization for testing
  const orgId = data.orgs[Math.floor(Math.random() * data.orgs.length)];
  
  // Test GET /api/stats/tvl endpoint
  const tvlResponse = http.get(`${BASE_URL}/api/stats/tvl`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  check(tvlResponse, {
    'TVL endpoint status is 200': (r) => r.status === 200,
    'TVL response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test GET /api/orgs endpoint
  const orgsResponse = http.get(`${BASE_URL}/api/orgs`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  check(orgsResponse, {
    'Orgs endpoint status is 200': (r) => r.status === 200,
    'Orgs response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Small delay between requests
  sleep(0.1);
}

export function teardown(data) {
  console.log('Load test teardown complete');
}

// Custom metrics
export const metrics = {
  tvlRequests: new Rate('tvl_requests'),
  orgsRequests: new Rate('orgs_requests'),
};
