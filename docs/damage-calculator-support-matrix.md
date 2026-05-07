# Damage Calculator Support Matrix

This document separates damage-related mechanics into three groups for the
Pokemon Champions calculator refactor.

- Supported: useful for one-turn damage calculation and currently handled by the engine.
- Add UI/state: useful for one-turn damage calculation, but needs explicit user input.
- Deferred / unnecessary: depends on battle history, execution order, or non-damage workflows that are outside the calculator's main goal.

## Supported

These are appropriate for the calculator and are already handled directly or through existing field/side inputs.

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
- Alternate stat target/use: Psyshock, Foul Play
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

### High Priority

- Current HP percentage for each side
  - Used by Eruption, Water Spout, Flail, Reversal, Hard Press, Final Gambit, Endeavor.
  - Also decides `fullHP` for Multiscale, Shadow Shield, Sturdy, Focus Sash, Disguise, Tera Shell, Ice Face.
  - Recommended UI: one HP% input per side. `fullHP` should be derived from `hpPct === 1`.

- Conditional move flags
  - `lastMoveFailed`: Temper Flare, Stomping Tantrum.
  - `attackerWasHit`: Avalanche.
  - `targetWasHit`: Assurance.
  - `fallenAllies`: Last Respects, Supreme Overlord.
  - Recommended UI: show a compact "move conditions" row only when the selected move or ability needs it.

- Manual action condition
  - `attackerMovedFirst`: Bolt Beak, Fishious Rend.
  - `attackerMovedSecond`: Payback.
  - The calculator does not need priority/speed judgment as a core feature, so this should be a manual condition toggle, not an automatic speed verdict.

- Flash Fire charged state
  - Flash Fire immunity is automatic, but the attack boost needs a user-controlled "Flash Fire active" toggle when the attacker has Flash Fire.

### Medium Priority

- Pinch state cleanup
  - Current UI has an attacker-only pinch checkbox.
  - Keep it simple, but consider deriving it from HP% <= 33 when HP% UI is added.
  - Used by Blaze, Torrent, Overgrow, Swarm, Defeatist.

- Booster Energy consumed/active nuance
  - Current logic treats Booster Energy as activating Protosynthesis/Quark Drive.
  - This is enough for now, but a future version could separate "held item" from "already consumed and active".

- Body Press
  - Present in the data and important for damage calculation.
  - Needs a small engine rule: use the attacker's Defense stat/rank as the offensive stat.
  - No new UI is needed, but it should get its own golden test when implemented.

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

## UI/State Refactor Direction

The calculator should keep the current simple result display. We do not need a detailed formula panel.

Recommended state split:

- Source state: user inputs only.
- Derived state: auto entry effects and automatic defaults, rebuilt every calculation.
- Battle context: optional one-turn conditions such as HP%, full HP, move condition flags, and Flash Fire active.

Recommended implementation order:

1. Keep `makeCalcState()` as the only place that derives calculation state.
2. Add `battle` or `conditions` fields to side state instead of scattering new flags.
3. Add HP% controls and derive `fullHP` from them.
4. Add contextual move-condition controls that only appear when selected moves/abilities need them.
5. Replace automatic speed verdict use for Bolt Beak/Fishious Rend/Payback with manual condition toggles.
6. Keep auto entry effect summaries at the top and keep result trace compact.
