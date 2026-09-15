import { configurePageFeatures } from './runtime/features.js';
import './js/01-10-rotom-ui.js';
import './js/01-20-html-structure.js';
import './js/01-30-theme.js';
import { bind01Core } from './js/01-core.js';
import './js/02-engine.js';
import './js/03-10-calc-state.js';
import './js/03-11-calc-shared-render.js';
import { bind0318UiChoice } from './js/03-18-ui-choice.js';
import './js/03-19-picker-dialog.js';
import './js/03-20-calc-combobox.js';
import './js/03-21-calc-combobox-options.js';
import './js/03-22-calc-combobox-events.js';
import './js/03-30-calc-side-render.js';
import './js/03-31-calc-conditions.js';
import './js/03-32-calc-ui.js';
import { bind0333CalcUiEvents } from './js/03-33-calc-ui-events.js';
import { bind0334CalcMoveDialog } from './js/03-34-calc-move-dialog.js';
import './js/03-40-calc-entry-effects.js';
import { bind0350CalcResults } from './js/03-50-calc-results.js';
import { bind0360CalcEvents } from './js/03-60-calc-events.js';
import './js/04-00-party-presets-state.js';
import './js/04-01-party-presets-image.js';
import './js/04-02-party-presets-integration.js';
import './js/04-03-party-presets-ui.js';
import { bind05Init } from './js/05-init.js';

configurePageFeatures({
  dex: () => import('./features/feature-dex.js'),
  matchup: () => import('./features/feature-matchup.js'),
  finetune: () => import('./features/feature-finetune.js'),
  revcalc: () => import('./features/feature-revcalc.js'),
});

// DOM bindings run only after the complete core module graph has evaluated.
bind01Core();
bind0318UiChoice();
bind0333CalcUiEvents();
bind0334CalcMoveDialog();
bind0350CalcResults();
bind0360CalcEvents();
bind05Init();
