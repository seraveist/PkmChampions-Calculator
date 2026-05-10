# Damage Calculator Support Matrix

This document separates damage-related mechanics into three groups for the
Pokemon Champions calculator refactor.

- Supported: useful for one-turn damage calculation and currently handled by the engine.
- Add UI/state: useful for one-turn damage calculation, but needs explicit user input.
- Deferred / unnecessary: depends on battle history, execution order, or non-damage workflows that are outside the calculator's main goal.

## Supported

These are appropriate for the calculator and are already handled directly or through existing field/side inputs.

Field/state modifiers that directly affect one attack are declared in `data/overrides/field-mechanics.json` and bundled as `RULES.fieldMechanics`.

### Core Inputs

- Pokemon, move, ability, item
- EVs, nature, stat ranks, status
- Weather, terrain, gravity
- Critical hit, Reflect, Light Screen, Helping Hand, Protect
- Stealth Rock, Spikes
- Ruin abilities as field toggles
- Auto entry effects as derived calculation state

### Move Rules

- Type/effectiveness exceptions: Freeze-Dry, Flying Press
- Type changing: Weather Ball, Terrain Pulse, Liquid Voice, Aerilate/Refrigerate/Pixilate/Galvanize/Dragonize
- Alternate stat target/use: Psyshock, Foul Play, Body Press
- Fixed or non-standard damage: Seismic Toss, Night Shade, Super Fang, Nature's Madness, Final Gambit, Endeavor, OHKO moves
- Variable BP already supported by existing fields: Gyro Ball, Electro Ball, Heat Crash, Heavy Slam, Low Kick, Grass Knot, Solar Beam, Solar Blade, Weather Ball, Terrain Pulse, Rising Voltage, Expanding Force, Misty Explosion, Grav Apple, Stored Power, Power Trip, Last Respects, Knock Off, Acrobatics, Poltergeist, Steel Roller
- Multi-hit approximations: fixed-hit moves, 2-5 hit average, Skill Link, Loaded Dice, Parental Bond

### Ability Rules

- Weather suppression: Air Lock, Cloud Nine
- Ability suppression / ignoring: Neutralizing Gas, Mold Breaker, Teravolt, Turboblaze
- Immunity and type interaction: Levitate, Water Absorb, Dry Skin, Storm Drain, Volt Absorb, Lightning Rod, Motor Drive, Flash Fire, Well-Baked Body, Sap Sipper, Earth Eater, Soundproof, Bulletproof, Scrappy, Mind's Eye
- Damage modifiers: Dark Aura, Fairy Aura, Aura Break, Flare Boost, Toxic Boost, Purifying Salt, Water Bubble, Neuroforce, Tinted Lens, Sniper, Filter, Prism Armor, Solid Rock, Multiscale, Shadow Shield, Fluffy, Punk Rock, Thick Fat, Heatproof
- Stat/BP modifiers: Technician, Tough Claws, Iron Fist, Strong Jaw, Mega Launcher, Sharpness, Reckless, Punk Rock, Steelworker, Steely Spirit, Dragon's Maw, Transistor, Rocky Payload, Sheer Force, Sand Force, Normalize, Analytic, Supreme Overlord, Huge Power, Pure Power, Guts, Solar Power, Flower Gift, Orichalcum Pulse, Hadron Engine, Protosynthesis, Quark Drive, Blaze/Torrent/Overgrow/Swarm, Defeatist, Hustle, Gorilla Tactics
- Defensive exceptions: Battle Armor, Shell Armor, Sturdy, Disguise, Ice Face, Unaware, Fur Coat, Ice Scales, Marvel Scale, Grass Pelt
- Item interaction helpers: Klutz, Heavy Metal, Light Metal

### Item Rules

- Type boost items and Plates
- Choice Band, Choice Specs, Assault Vest, Eviolite, Metal Powder, Deep Sea Tooth/Scale, Thick Club, Light Ball
- Life Orb, Expert Belt, Muscle Band, Wise Glasses, Punching Glove
- Utility Umbrella, Booster Energy
- Focus Sash, Sitrus Berry, Leftovers in KO estimate
- Type-resist berries, including Chilan Berry
- Unnerve / As One blocking resist berries

## Add UI/State

These are worth supporting, but the current UI does not expose the required condition clearly enough.

### Completed

- Current HP percentage for each side
  - Used by Eruption, Water Spout, Flail, Reversal, Hard Press, Final Gambit, Endeavor.
  - Also decides `fullHP` for Multiscale, Shadow Shield, Sturdy, Focus Sash, Disguise, Tera Shell, Ice Face.
  - UI now has one HP% input per side. `fullHP` and `pinch` are derived from `hpPct`.

- Conditional move flags
  - `lastMoveFailed`: Temper Flare, Stomping Tantrum.
  - `attackerWasHit`: Avalanche.
  - `targetWasHit`: Assurance.
  - `fallenAllies`: Last Respects, Supreme Overlord.
  - UI shows a compact conditions section only when the selected move or ability needs it.

- Speed-based action condition
  - `attackerMovedFirst`: Bolt Beak, Fishious Rend.
  - `attackerMovedSecond`: Payback.
  - UI keeps the current speed-based automatic verdict and explicitly labels it as automatic.

- Flash Fire charged state
  - Flash Fire immunity is automatic.
  - The attack boost has a user-controlled "Flash Fire active" toggle when the attacker has Flash Fire.

- Field/state mechanics cleanup
  - Weather damage modifiers, terrain BP modifiers, screen/protect handling, and clearly deferred room effects.
  - Weather damage, terrain BP, screens, and Protect are now data-driven.
- Deferred field/state scope cleanup
  - Magic Room, Wonder Room, Aurora Veil.
  - Friend Guard, Battery, Power Spot.
  - These are tracked as deferred field/state rows in the generated coverage matrix.
- Result modifier label cleanup
  - Short multiplier labels.
  - Korean labels for common block/critical/fixed-damage traces.
  - Deduplicated and capped result-card trace display.
- Booster Energy consumed/active nuance
  - Protosynthesis/Quark Drive can now use `auto`, `active`, or `inactive` Booster Energy state.
  - This supports held-item activation and already-consumed active state separately.
- Showdown / showdown calculator reference cases
  - Mold Breaker vs defensive ability.
  - Tera Shell.
  - Paradox abilities.
  - Type-changing abilities.
  - Fixed damage / OHKO.
  - These are now covered by golden tests.

## Deferred / Unnecessary

These should not be part of the first UI/state cleanup.

### Requires Previous Damage

- Counter
- Mirror Coat
- Metal Burst
- Comeuppance

Reason: they depend on the exact damage received earlier. This belongs better in a future reverse-calculation or battle-history tool, not the main damage calculator.

### Requires Battle History Or Random Branching

- Rage Fist, if added to the data later: requires hit count.
- Fickle Beam: has a random stronger branch.
- Bide, if added later: requires accumulated damage.

Reason: useful only with extra battle-history controls. Add only if Champions usage makes them important.

### Requires Switch-In Or Turn Counter Context

- Stakeout
- Slow Start

Reason: they require "target just switched in" or "turn count since entering battle". These are not natural inputs for the current one-turn attacker-versus-defender calculator.

### Reactive Rank Abilities

- Anger Point
- Weak Armor
- Stamina
- Berserk

Reason: these mostly change future turns after taking a hit. Since the calculator evaluates the current hit, the user can represent the already-applied result with manual ranks.

### Requires Side Or Global Battle Context

- Magic Room
- Wonder Room
- Aurora Veil
- Friend Guard
- Battery
- Power Spot

Reason: these need item/global-room state, a separate Aurora Veil side state, or ally-position context. They are tracked as deferred so they do not disappear from planning, but they are outside the first one-attack calculator model.

## UI/State Refactor Direction

The calculator should keep the current simple result display. We do not need a detailed formula panel.

Recommended state split:

- Source state: user inputs only.
- Derived state: auto entry effects and automatic defaults, rebuilt every calculation.
- Battle context: optional one-turn conditions such as HP%, full HP, move condition flags, and Flash Fire active.

Recommended implementation order:

1. Keep `makeCalcState()` as the only place that derives calculation state.
2. Continue moving field/state mechanics into data where it reduces name-based branching.
3. Add golden tests for every new condition branch.
4. Keep auto entry effect summaries at the top and keep result trace compact.
