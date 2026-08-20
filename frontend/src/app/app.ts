import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { MatMiniFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatIcon, MatMiniFabButton],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class App {
  readonly themeSrvice = inject(ThemeService);
}
