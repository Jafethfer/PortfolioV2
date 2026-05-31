import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Legend } from './components/legend/legend';
import { StageTransition } from './components/stage-transition/stage-transition';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Legend, StageTransition],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
