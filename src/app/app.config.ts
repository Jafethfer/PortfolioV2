import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `withComponentInputBinding` maps route data/params to component inputs
    // by name — that's how each stage receives its `characterClass` from
    // `data: { characterClass: ... }` declared in `app.routes`.
    provideRouter(routes, withComponentInputBinding()),
  ]
};
