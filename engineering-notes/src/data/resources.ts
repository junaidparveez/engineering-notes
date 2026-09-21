import type { Resource } from '../types';

/** The 10 reference links. Official docs over playlists, deliberately. */
export const RESOURCES: Resource[] = [
  { label: "Java", description: "dev.java / official Java learning and language guides", url: "https://dev.java/learn/" },
  { label: "Spring", description: "Spring Framework reference", url: "https://docs.spring.io/spring-framework/reference/" },
  { label: "PostgreSQL", description: "PostgreSQL performance tips / EXPLAIN docs", url: "https://www.postgresql.org/docs/current/performance-tips.html" },
  { label: "Kafka", description: "Apache Kafka documentation", url: "https://kafka.apache.org/documentation/" },
  { label: "Redis", description: "Redis documentation", url: "https://redis.io/docs/latest/" },
  { label: "AWS", description: "AWS Skill Builder / getting started", url: "https://aws.amazon.com/training/digital/" },
  { label: "Kubernetes", description: "Kubernetes official tutorials", url: "https://kubernetes.io/docs/tutorials/" },
  { label: "OpenTelemetry", description: "OpenTelemetry docs", url: "https://opentelemetry.io/docs/" },
  { label: "DSA", description: "NeetCode practice roadmap", url: "https://neetcode.io/practice" },
  { label: "System Design", description: "System Design Primer", url: "https://github.com/donnemartin/system-design-primer" },
];
