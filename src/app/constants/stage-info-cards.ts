import { InfoCardData } from '../components/info-card/info-card';

/**
 * Parallax "about me" content, one array per stage. Kept out of the stage
 * components so the copy can be edited in one place without touching
 * component logic. Each stage imports its own array and forwards it into
 * `<app-parallax [cards]>`. Naming: `infoCardsStage<N>` — bump the number
 * for each new stage that wants a parallax info section.
 */

/** Stage 1 — Terry's Geese Tower rooftop. */
export const infoCardsStage1: ReadonlyArray<InfoCardData> = [
  {
    title: 'Hey, I build for the web',
    body: 'Software developer focused on crafting fast, interactive front-end experiences — like this one.',
  },
  {
    title: 'Core stack',
    body: 'Angular, TypeScript, RxJS & Signals, SCSS/Tailwind. Comfortable across the full front-end toolchain.',
  },
  {
    title: 'What I value',
    body: 'Clean architecture, polymorphic abstractions, and animations that feel game-engine smooth.',
  },
  {
    title: 'Experience',
    body: 'Years shipping production web apps — from design systems to real-time, animation-heavy UIs.',
  },
  {
    title: 'Let’s talk',
    body: 'Scroll on. Reach out if you want to build something that plays as good as it looks.',
  },
];
