/**
 * Every piece of fixed prose in the app, extracted from the old single-file
 * version rather than retyped. It lives here instead of inside JSX so the copy
 * can be proof-read in one place, and so a component stays a component.
 *
 * Rendered text only: the markup that surrounded it in the old app belongs to
 * whichever component draws it.
 */

export interface Labelled {
  label: string;
  body: string;
}

/** Dashboard hero. */
export const HERO = {
  eyebrow: "Your positioning",
  headline: "From strong enterprise developer → interview-ready product backend engineer.",
  // The paragraph is in three pieces because one word is bold in the middle:
  // <p>{bodyLead}<strong>{bodyEmphasis}</strong>{bodyTail}</p>
  bodyLead: "Your resume already proves Java/Spring, Kafka, platform engines, security, Docker and production AI/RAG work. The highest-return move is not adding random frameworks. It is proving ",
  bodyEmphasis: "depth",
  bodyTail: ": JVM + data performance + distributed reliability + AWS/Kubernetes + testing/observability + system design + interview execution.",
  chips: [
    { label: "Primary:", value: "SDE-II / Backend Engineer" },
    { label: "Stretch:", value: "Senior Backend Engineer" },
    { label: "Differentiator:", value: "Backend + AI Platform" },
    { label: "Target:", value: "₹20–35+ LPA / strong TC roles" },
  ],
} as const;

/** The dashboard ring caption, shown under the percentage. */
export const RING_CAPTION =
  "Tracker estimate—not a hiring guarantee. Proof + mocks + applications matter as much as topic completion.";

/** The three "what I changed from your old plan" notices. */
export const PLAN_CHANGE_NOTICES: { tone: "good" | "warn"; label: string; body: string }[] = [
  { tone: "good", label: "Kept & elevated:", body: "Java/Spring, Kafka, security, idempotency, AI/RAG and platform-engine experience. These are already credible resume differentiators." },
  { tone: "warn", label: "Moved earlier:", body: "Testing, SQL/Hibernate tuning, Redis, networking, observability and production debugging. These are common interview gaps and current hiring signals." },
  { tone: "warn", label: "Deprioritized:", body: "Advanced React, deep MongoDB, multiple AI frameworks, service mesh and heavy Terraform before your core backend/cloud/design gaps are closed. Add WebFlux/Reactor, gRPC or deeper CDC only when target JDs justify them." },
];

/** Application strategy, three phases of the plan. */
export const APPLICATION_STRATEGY: Labelled[] = [
  { label: "Weeks 1–8:", body: "build depth + proof; keep networking/referrals warm." },
  { label: "Weeks 9–16:", body: "5–10 targeted applications/week while cloud + system design become credible." },
  { label: "Weeks 17–24:", body: "10–15 targeted applications/week, mocks, referrals, interview-loop optimization and negotiation." },
];

/** How to score yourself, shown above the skill grid. */
export const SKILL_SCORING_GUIDE = "1 = awareness · 2 = can follow a tutorial · 3 = can implement independently · 4 = can debug/operate/explain trade-offs · 5 = can design, mentor and handle production failure modes.";

/** The two "I can prove it" readiness gates. */
export const READINESS_GATES: { title: string; items: string[] }[] = [
  {
    title: "Backend gate",
    items: [
      "Explain JVM + concurrency without hand-waving",
      "Diagnose a slow SQL/Hibernate flow",
      "Design Kafka retry/DLQ/idempotency semantics",
      "Explain Redis cache invalidation + distributed lock trade-offs",
      "Debug a realistic production failure scenario",
    ],
  },
  {
    title: "Product-company gate",
    items: [
      "Solve common medium DSA patterns under time pressure",
      "Deliver 45-minute HLD with estimates + trade-offs",
      "Deliver extensible/concurrent Java LLD",
      "Show one deployed/observable/reliable project",
      "Tell 8 strong STAR stories with measurable impact",
    ],
  },
];

/** Resume-derived STAR story bank. */
export const STAR_STORIES: { story: string; experience: string; signal: string }[] = [
  {
    story: "Distributed reliability",
    experience: "API idempotency + Kafka email workflows",
    signal: "Retries, duplicate prevention, failure handling, trade-offs",
  },
  {
    story: "Security",
    experience: "SQL injection remediation + fine-grained RBAC",
    signal: "Threat identification, fix, validation, blast-radius reduction",
  },
  {
    story: "Platform ownership",
    experience: "Form / Report / Chart / Workflow engines",
    signal: "Abstraction, reuse, extensibility, product impact",
  },
  {
    story: "AI architecture",
    experience: "OpenAI/Ollama/vLLM provider abstraction + RAG/Qdrant",
    signal: "Provider trade-offs, retrieval, reliability, latency/cost",
  },
  {
    story: "Performance",
    experience: "Caching + DB/query work",
    signal: "Baseline → change → metric → business impact",
  },
  {
    story: "Recognition",
    experience: "CTO Award 2024–25",
    signal: "Why the work mattered; avoid presenting the award without impact",
  },
];

/** The two portfolio project cards. */
export const PROJECTS: {
  badge: string;
  title: string;
  summary: string;
  stack: string[];
  deliverables: { n: string; text: string }[];
}[] = [
  {
    badge: "Flagship · highest ROI",
    title: "Event-Driven Workflow & Notification Platform",
    summary: "Close to your real background, but redesigned as a clean public portfolio project that demonstrates senior-capability backend engineering.",
    stack: ["Java 21", "Spring Boot", "PostgreSQL", "Redis", "Kafka", "Outbox", "Resilience4j", "Testcontainers", "Docker", "Kubernetes", "AWS", "Prometheus"],
    deliverables: [
      { n: "01", text: "Architecture + sequence diagrams + API contracts" },
      { n: "02", text: "Idempotency, retry/DLQ, outbox and failure-injection tests" },
      { n: "03", text: "p95 latency, throughput, cache hit rate and Kafka lag benchmarks" },
      { n: "04", text: "CI/CD + reproducible deployment + rollback notes" },
      { n: "05", text: "ADRs explaining important trade-offs" },
    ],
  },
  {
    badge: "Differentiator · smaller",
    title: "Production RAG Policy Assistant",
    summary: "Use your existing AI/RAG experience, but make the repo prove production engineering—not merely a chatbot demo.",
    stack: ["Spring AI", "Qdrant/pgvector", "Hybrid Search", "Reranking", "Evaluation", "Citations", "Guardrails", "Observability"],
    deliverables: [
      { n: "01", text: "Evaluation dataset + retrieval/answer quality metrics" },
      { n: "02", text: "Tenant isolation + prompt-injection defenses" },
      { n: "03", text: "Provider abstraction with timeout/retry/rate-limit behavior" },
      { n: "04", text: "Latency/token/cost dashboard or report" },
      { n: "05", text: "Clear failure cases and known limitations" },
    ],
  },
];

/** The "Resume rule" callout under the project cards. */
export const RESUME_RULE: Labelled = {
  label: "Quantify before your next major application sprint.",
  body: "Your current resume has strong technologies and ownership, but many bullets do not yet show scale or measured outcomes. Add numbers where you can truthfully defend them: request volume, latency reduction, DB load reduction, number of products/modules served, processing reliability, users/tenants, deployment frequency, or engineering time saved.",
};

/** Study operating system: weekdays, weekend, weekly review. */
export const STUDY_SYSTEM: { title: string; body: string }[] = [
  {
    title: "Weekdays · 2h",
    body: "45m concept → 45m implementation → 30m DSA. On two days, replace DSA with system-design explanation once you reach Week 13.",
  },
  {
    title: "Weekend · 4–6h",
    body: "Project integration, load testing, diagrams, timed OA/mock, and one weekly retrospective.",
  },
  {
    title: "Weekly review · 30m",
    body: "What can I explain without notes? What did I actually build? What failed? What should be removed from next week?",
  },
];

/** Deployment steps listed on the settings page. `emphasis` is bolded inside `text`. */
export const DEPLOY_STEPS: { text: string; emphasis: string | null }[] = [
  { text: "Rename this file to index.html", emphasis: "index.html" },
  { text: "Put it in a GitHub repository", emphasis: null },
  { text: "Import the repo in Vercel", emphasis: null },
  { text: "Framework preset: Other / static", emphasis: null },
];

/** Footer line shown under every page. */
export const FOOTER_NOTE =
  "Built from your resume + current backend-market signals. Optimize for credible depth, measurable proof and interview conversion—not maximum keyword count.";
