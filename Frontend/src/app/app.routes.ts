import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/locator/locator').then((m) => m.LocatorComponent),
  },
];
