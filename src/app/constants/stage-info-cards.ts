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
    body: 'A fullstack software engineer with 5 years shipping fast, reliable web apps — front to back.',
  },
  {
    title: 'How I build',
    body: 'Clean architecture and DDD — Onion, CQRS, SOLID & DRY — with MediatR, FluentValidation and AutoMapper keeping it testable and tidy.',
  },
  {
    title: 'Why fighters?',
    body: 'Because I’m a lifelong gamer — this whole thing is a love letter to that. I work in both English and Spanish, driven by one thing: building awesome tools for awesome people.',
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
    body: 'Angular is my specialty — Signals, RxJS, and architecture that scales. I’ve also worked with React and Nuxt.',
  },
  { image: 'assets/img/tech/angular.png', imageAlt: 'Angular' },
  {
    title: 'Backend',
    body: '.NET Core is my home turf for building robust APIs and services. I’ve also worked with Node.js and Express.',
  },
  { image: 'assets/img/tech/dotnetcore.png', imageAlt: '.NET Core' },
  {
    title: 'Data & cloud',
    body: 'Relational with MSSQL, PostgreSQL and MySQL; MongoDB when NoSQL fits. Deployed across Azure, AWS and Google Cloud.',
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
    body: 'Five years of production software — CRMs, ERPs, real-time tools and AI. A few highlights:',
  },
  {
    title: 'CRMs & ERPs',
    body: 'Built CRMs and ERPs wired into Meta, WhatsApp and ad platforms — the connected systems companies run their business on.',
  },
  {
    title: 'Real-time meetings',
    body: 'Shipped a meeting platform with automatic calendaring and real-time messaging — scheduling and conversation, live and in one place.',
  },
  {
    title: 'Data & AI',
    body: 'Integrated LLMs for data analysis and built dashboards that turn a flood of raw data into a clear product view.',
  },
  {
    title: 'Built to scale',
    body: 'Engineered for growth — Redis caching for speed, Kubernetes for scale. Apps that stay fast as they get big.',
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
