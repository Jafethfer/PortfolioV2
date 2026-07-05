import { InfoCardData } from '../components/info-card/info-card';

/**
 * Parallax "about me" content, one array per stage. Kept out of the stage
 * components so the copy can be edited in one place without touching
 * component logic. Each stage imports its own array and forwards it into
 * `<app-parallax [cards]>`. Naming: `infoCardsStage<N>` — bump the number
 * for each new stage that wants a parallax info section.
 *
 * The portfolio is a 3-chapter arc (see the plan): stage 1 = who I am,
 * stage 2 = what I can do, stage 3 = what I've shipped + contact. All three
 * are built and routed (`stage-1`/`stage-2`/`stage-3` in `app.routes`).
 */

/** Stage 1 — Terry. Chapter: "Who I am" — identity, approach, the personal beat. */
export const infoCardsStage1: ReadonlyArray<InfoCardData> = [
  {
    title: 'Hi, I’m Brando',
    body: 'A fullstack engineer with 5 years shipping and modernizing web apps — front to back, most recently leading the build as a Tech Lead.',
  },
  {
    title: 'Across borders',
    body: 'Based in Honduras, building with teams across the US. Fully bilingual — C2 English, native Spanish — so nothing gets lost in the handoff.',
  },
  {
    title: 'How I build',
    body: 'Clean architecture — Onion and CQRS, kept testable and tidy. My specialty is bringing legacy systems into modern, stateless shape without breaking what already works.',
  },
  {
    title: 'Beyond the code',
    body: 'It’s not just features. I chase down performance bottlenecks, tighten security, and wire in the third-party integrations that make a product feel whole.',
  },
  {
    title: 'Why fighters?',
    body: 'Because I’m a lifelong gamer — this whole thing is a love letter to that. Driven by one thing: building awesome tools for awesome people.',
  },
  {
    title: 'Round 2 →',
    body: 'That’s who I am. Walk on to see what I can do.',
  },
];

/** Stage 2 — Joe. Chapter: "What I can do" — the fullstack craft + tech logos. */
export const infoCardsStage2: ReadonlyArray<InfoCardData> = [
  {
    title: 'What I can do',
    body: 'Fullstack, genuinely — here’s the toolkit I reach for.',
  },
  {
    title: 'Frontend',
    body: 'Angular is my specialty — Signals, RxJS, and architecture that scales. I’ve also shipped with React and Nuxt.',
    logos: ['assets/img/tech/react.svg', 'assets/img/tech/nuxt.svg'],
  },
  { image: 'assets/img/tech/angular.png', imageAlt: 'Angular' },
  {
    title: 'Backend',
    body: '.NET Core is my home turf for robust APIs and services. I’ve also built with Node.js and Express.',
    logos: ['assets/img/tech/nodejs.svg', 'assets/img/tech/express.svg'],
  },
  { image: 'assets/img/tech/dotnetcore.png', imageAlt: '.NET Core' },
  {
    title: 'Data & cloud',
    body: 'Relational with SQL Server, PostgreSQL and MySQL; MongoDB when NoSQL fits. Deployed across Google Cloud, AWS and Azure.',
    logos: [
      'assets/img/tech/postgresql.svg',
      'assets/img/tech/mysql.svg',
      'assets/img/tech/sqlserver.svg',
      'assets/img/tech/mongodb.svg',
      'assets/img/tech/azure.svg',
      'assets/img/tech/aws.svg',
    ],
  },
  { image: 'assets/img/tech/gcp.png', imageAlt: 'Google Cloud' },
  {
    title: 'Final round →',
    body: 'That’s the toolkit. Walk on to see what I’ve built with it.',
  },
];

/**
 * Stage 3 — Ryo. The "What I've shipped" chapter: projects, trajectory, and
 * the contact CTA. The Contact card — and the site's only contact link — lives
 * here at the deliberate end of the chapter arc.
 */
export const infoCardsStage3: ReadonlyArray<InfoCardData> = [
  {
    title: 'What I’ve shipped',
    body: 'Five years of production software — CRMs, real-time tools, AI, and legacy systems rebuilt for the modern web. A few highlights:',
  },
  {
    title: 'CRMs & marketing',
    body: 'Built a multi-branch automotive CRM, rolled out across a dealer group — wired into Meta, WhatsApp and ad platforms, with a WhatsApp chatbot and unified campaign tracking for data-driven marketing.',
  },
  {
    image: 'assets/img/misc/crm-template.png',
    imageAlt: 'Example CRM dashboard interface',
    caption: 'Reference mockup only — the CRM I built is protected under NDA.',
  },
  {
    title: 'Real-time meetings',
    body: 'Built a meeting platform with automatic calendaring and real-time messaging — scheduling and conversation, live and in one place.',
  },
  {
    title: 'Data & AI',
    body: 'Integrated LLMs for data analysis and built dashboards that turn a flood of raw data into a clear, at-a-glance product view.',
  },
  {
    title: 'Legacy → modern',
    body: 'Migrated legacy ASP.NET MVC and VB.NET apps to Angular, Nuxt and .NET Core APIs — refactoring stateful monoliths into clean, stateless services, and leading the frontend on one of them.',
  },
  {
    title: 'Built to scale',
    body: 'Cut a screen’s load time from about a minute to a few seconds — killing session-locking and redundant per-request database reads. Redis caching and Kubernetes keep things fast as they grow.',
  },
  {
    logos: ['assets/img/tech/docker.svg', 'assets/img/tech/kubernetes.svg'],
  },
  {
    title: 'Led the build',
    body: 'I’ve led a team as Tech Lead — owning technical direction and delivery, and running services on Google Cloud with Cloud Run, Cloud SQL and Redis.',
  },
  {
    title: 'Let’s build something',
    body: 'Like what you see? I’m always up for building awesome tools for awesome people. Let’s talk.',
  },
  {
    title: 'Contact me',
    links: [
      { label: 'GitHub', url: 'https://github.com/Jafethfer' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/brando-fernandez/' },
      { label: 'Email', url: 'mailto:jafethfer10@gmail.com' },
    ],
  },
];
