import { Routes } from '@angular/router';
import { Terry } from './characters/terry/terry';
import { Joe } from './characters/joe/joe';
import { Ryo } from './characters/ryo/ryo';
import { TerryStage } from './stages/terry-stage/terry-stage';
import { JoeStage } from './stages/joe-stage/joe-stage';
import { RyoStage } from './stages/ryo-stage/ryo-stage';
import { Landing } from './components/landing/landing';

/**
 * Stage routing. Each entry mounts a concrete `Stage` subclass and feeds
 * its `characterClass` input via route `data` (resolved by Angular's
 * `withComponentInputBinding()` — route data keys map to component inputs
 * of matching names, so `data.characterClass` lands on the stage's
 * `characterClass = input.required<Type<Character>>()`).
 *
 * Stage-1 spawns Terry; stage-2 (Joe's Thailand stage) spawns Joe; stage-3
 * (Ryo's Kyokugen dojo) spawns Ryo. Swap the `characterClass` here when
 * another character ships.
 *
 * The entry route (`''`) is the `Landing` title screen — it has no
 * `characterClass`, which is how `Stage._resolveStageNeighbors` tells it apart
 * from the stages so it never appears in the prev/next stage cycle.
 */
export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'stage-1', component: TerryStage, data: { characterClass: Terry } },
  { path: 'stage-2', component: JoeStage, data: { characterClass: Joe } },
  { path: 'stage-3', component: RyoStage, data: { characterClass: Ryo } },
];
