# ADR 002: Redis as Primary Storage for Telemetry

## Status

Accepted

## Context

Veyra needs to store telemetry data (metrics, logs, traces, alerts) for observability. We need to decide between using a dedicated time-series database or Redis.

## Decision

Use Redis as the primary storage for telemetry data in the observability package.

## Rationale

- **Simplicity**: Redis is already used for memory, retrieval, and caching
- **Performance**: In-memory storage provides fast read/write operations
- **Scalability**: Redis can handle high throughput for telemetry
- **Cost**: No additional infrastructure needed
- **Integration**: Easy to integrate with existing Redis setup
- **Sufficient for MVP**: Meets current requirements without over-engineering

## Consequences

### Positive

- Reduced infrastructure complexity
- Faster development time
- Lower operational cost
- Consistent storage layer

### Negative

- Memory constraints for large datasets
- Data loss on Redis restart (mitigated by persistence)
- Limited query capabilities compared to time-series databases
- May need migration to dedicated solution at scale

## Alternatives Considered

- **Prometheus**: Better for metrics but adds complexity
- **Elasticsearch**: More powerful but heavier infrastructure
- **TimescaleDB**: Purpose-built but additional service to manage

## Migration Path

If Redis becomes insufficient:
1. Implement dual-write to Redis and time-series DB
2. Gradually migrate queries to new storage
3. Deprecate Redis for telemetry
4. Remove Redis telemetry code

## Implementation

- Use Redis key prefixes for different telemetry types
- Implement TTL for data retention
- Enable Redis persistence (AOF)
- Monitor memory usage
