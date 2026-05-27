import { Routes } from '@angular/router';
import { Terry } from './characters/terry';
import { TerryStage } from './stages/terry-stage';
import { JoeStage } from './stages/joe-stage';

/**
 * Stage routing. Each entry mounts a concrete `Stage` subclass and feeds
 * its `characterClass` input via route `data` (resolved by Angular's
 * `withComponentInputBinding()` — route data keys map to component inputs
 * of matching names, so `data.characterClass` lands on the stage's
 * `characterClass = input.required<Type<Character>>()`).
 *
 * Both stages currently spawn Terry; swap the `characterClass` here when
 * another character ships.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'stage-1', pathMatch: 'full' },
  { path: 'stage-1', component: TerryStage, data: { characterClass: Terry } },
  { path: 'stage-2', component: JoeStage, data: { characterClass: Terry } },
];
