'use strict';

// Métricas no formato texto do Prometheus, sem dependências externas.
function createMetrics() {
  const requests = new Map(); // "method|route|status" -> contagem
  const durationBuckets = [0.005, 0.01, 0.05, 0.1, 0.5, 1];
  const histogram = { buckets: durationBuckets.map(() => 0), sum: 0, count: 0 };
  const startedAt = Date.now();

  function observe({ method, route, status, seconds }) {
    const key = `${method}|${route}|${status}`;
    requests.set(key, (requests.get(key) || 0) + 1);
    durationBuckets.forEach((b, i) => {
      if (seconds <= b) histogram.buckets[i] += 1;
    });
    histogram.sum += seconds;
    histogram.count += 1;
  }

  function render(extra = {}) {
    const lines = [];
    lines.push('# HELP http_requests_total Total de requisições HTTP.');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, value] of requests) {
      const [method, route, status] = key.split('|');
      lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`);
    }
    lines.push('# HELP http_request_duration_seconds Duração das requisições HTTP.');
    lines.push('# TYPE http_request_duration_seconds histogram');
    durationBuckets.forEach((b, i) => {
      lines.push(`http_request_duration_seconds_bucket{le="${b}"} ${histogram.buckets[i]}`);
    });
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${histogram.count}`);
    lines.push(`http_request_duration_seconds_sum ${histogram.sum}`);
    lines.push(`http_request_duration_seconds_count ${histogram.count}`);
    lines.push('# HELP process_uptime_seconds Tempo de execução do processo.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${(Date.now() - startedAt) / 1000}`);
    for (const [name, value] of Object.entries(extra)) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    return lines.join('\n') + '\n';
  }

  return { observe, render };
}

module.exports = { createMetrics };
