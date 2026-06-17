# Veyra Monitoring

This directory contains monitoring configuration for the Veyra platform.

## Prometheus

Prometheus is used for metrics collection and alerting.

### Configuration

- `prometheus.yml` - Prometheus scrape configuration

### Access

- Prometheus UI: http://localhost:9090

## Grafana

Grafana is used for visualization and dashboards.

### Configuration

- `grafana-dashboard.json` - Default dashboard configuration

### Access

- Grafana UI: http://localhost:3001
- Default credentials: admin / admin_change_this

## Metrics

The following metrics are collected:

- HTTP request rate and latency
- Active and completed tasks
- Memory and CPU usage
- Redis connections and operations
- PostgreSQL connections and queries

## Alerting

Alerts can be configured in Prometheus to notify on:
- High error rates
- High latency
- Resource exhaustion
- Task failures
