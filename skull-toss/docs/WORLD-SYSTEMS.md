# World systems (v54, v56–v60)

This covers these systems:

- the musical clock the world moves to;
- how the travel scenery is laid out;
- how a boss's lair reveals itself;
- the portals between places;
- the carnival's attractions (the mini-games);
- the land (hills, dips and a bending road);
- the band (layers over the music);
- v60's research translation: the Drowned Theater's water, surfaces and Bank Rings, depth lanes, and the ring's
  personalities and tells.

Each section says where the code lives and what the tests check.

## The musical clock (`02f_music_clock.js`, `src/audio/beats.json`)

**What it does.** One clock gives the beat, the position within the beat, the bar and the phrase. It reads the
recorded track's playback position, smoothed between the browser's updates, through that track's beat map. A beat map
lists the time of every beat in the loop.

**Beat maps.** `node tools/beatmap.mjs` makes them. It decodes each loop in headless Chromium and builds an onset
envelope. It then finds the tempo by autocorrelation and tracks the beats one by one, letting the period drift slowly.
A loop whose tempo wanders therefore stays in step.

| Loop | Tempo (BPM) |
|---|---|
| menu | 108.6 |
| a | 106.2 |
| b | 104.6 |
| boss | 109.9 |
| pause | 98.6 |
| shop | 104.3 |

**No music playing.** When the sound is muted, a track is loading, or the game is under test, the clock runs free at
104 BPM on the world's time. The scenery moves the same way every time.

**Roles, not a metronome.** Each kind of scenery has its own relation to the music, a phase of its own, and a strength
of its own (`Groove`):

| Kind | Movement |
|---|---|
| Grass and corn | Sway all the time |
| Trees | Sway over two beats |
| Pumpkins, jack-o'-lanterns, hay, scarecrows | Hop on alternate beats (half the pieces on the ones and threes, half on the twos and fours) |
| Some gravestones | Settle once a bar |
| Lanterns | Swing every two beats |

**Phrases.** The phrase (four bars) changes who's busiest: bars 9–12 the trees, 13–16 the gravedigger.

**Hand-overs.**
- One act hands over to the next on the next bar, crossing over two beats.
- A boss comes in on the next beat.
- The pause menu and the Cart come in at once.
- The next act is fetched while the current one plays (`reelSoon`).

**The boss's music.** The recording can't change, so the fight adds to it:
- under half the boss's health, a drum on every beat, scheduled from the clock on the music bus;
- under a quarter, a hat between beats as well;
- on the knockout, the music drops away on the next beat, holds, and comes back (`musicHold`).

**The loops' keys** (v57). `tools/beatmap.mjs` also finds each loop's key: a pitch-class profile from FFT frames every
quarter second, matched to the Krumhansl–Schmuckler major and minor profiles. It's stored with the beat map.

| Loop | Key |
|---|---|
| menu | A minor |
| a | C major |
| b | C major |
| boss | G minor |
| pause | E minor |
| shop | C major |

**Not done.** True stems (separate recordings of the drums, bass and melody) would let the recorded score itself change.
The loops are single mixes, so the band plays over them instead (below).

## The travel scenery (`06g_travel.js`)

The land is a field, not a strip. Scenery is laid out in these passes:

1. The lane-side rows.
2. The tree lines.
3. **Clusters** (v54): a few pieces of the zone's own mix arranged round a centre, then turned, scaled and nudged. The
   shapes are a copse, a knot of stones, a patch, and a stand of trees. They sit anywhere from just off the lane to well
   out in the field.
4. **Far masses** (v54): the zone's backdrop, larger, 30–60 m out.
5. **Low ground dressing** beside the lane (v54).
6. **The arena frame** (v54): big trees either side of each boss's ground.
7. The landmarks.
8. The near-edge silhouettes.

**Density.** A slow swell along the track decides where the clusters go. There are open stretches on purpose.

**Flat ground detail** (v54). Dead grass, pebbles, twigs, leaf litter and scuffs lie across the lane too. They're
painted on the ground, so they never stand in a throw's way.

**The lair's clear zone.** Nothing but the lair itself stands within 32 m in front of the boss's lair and across its
width.

**Under load.** The ground dressing and the clusters' small pieces (`lite`) are the first things to go when adaptive
quality steps down.

Terrain height and the bending road: see The land, below.

## The lair's reveal (`06g_travel.js: LANDMARK`)

Every boss's lair on the horizon is drawn smaller still when it's far away, a perspective pushed further than true. It
comes into view in stages:

| Distance | What you see |
|---|---|
| Beyond 120 m | A small dark shape in the haze |
| 120 → 75 m | Its colour comes up through the silhouette |
| 75 → 55 m | Its `reveal` part appears (the Pumpkin King's crown) |
| Inside 45 m | Full size |

A lair's SVG can have an optional `<g id="reveal">` layer (see `src/art/travel/king-lair.svg`).

## Portals (`07t_portal.js`)

One state handles every hand-over:

`PORTAL_OPEN → throw → RIFT_TRAVEL → RIFT_EXIT → the destination's set-up (behind the rift) → play`

The sequence after an end boss:

1. The end boss goes down, and the ring, its pole and the targets go at once.
2. The reward, the body part and the shard follow.
3. A black portal opens where the ring was.
4. A make through it goes into the rift: the camera follows Morty down a tunnel until the far end opens on the
   destination. A miss costs nothing.

**Routes.** Boss → Can Alley (if you take it) → portal → the next map (or the crossing into it). If you skip Can Alley,
the portal goes straight to the next map.

**In tests.** The spec's older tests run with portals off (`T.portalsOn()` switches them on).

## Power-ups (`07c_power.js`)

| Where | Power-ups |
|---|---|
| From the start | Skull Rush, Deadeye, BONK Blast, Ghost Toss, Bone Magnet, Second Chance, Cursed Skull |
| Map 2, the Gilded Graveyard | **Lucky Skull**: a clank off the rim can drop in (60%, two uses) |
| Map 3, the Whistling Woods | **Ricochet**: a bonk costs nothing (one use) |
| Map 4, the Drowned Theater | **Heavy Skull**: smashes through obstacles and seeds (three uses) |
| Map 5, the Black Marsh | **Time Bone**: the ring, hazards, machinery and targets at half speed |
| Map 6, the Bone Desert | **Combo Bone**: +×0.25 for each make in a row |
| Adventure+ only | **Chaos Skull**: every make rolls ×1–×4 |

**Dealing.** A map's new prop goes into the Director's bag twice on that map.

**Synergies.** A make while both of a pair are on pays ×1.5:

| Pair | Synergy |
|---|---|
| Heavy Skull + Ricochet | Pinball |
| Ghost Toss + Deadeye | Phantom Eye |
| Time Bone + Combo Bone | Slow Burn |
| Lucky Skull + Second Chance | Charmed |
| Skull Rush + Time Bone | Warp Speed |
| Chaos Skull + Cursed Skull | Doom Roll |

**v57: six with physics of their own** (`07v_newpowers.js`), each running in the flight's own steps on the run's time:

| Power-up | From | How it works |
|---|---|---|
| Vine Swing | map 3 | The vine's end sways over the lane at 2.8 m. Within 0.42 m of it the skull grabs: a pendulum round the branch (5.6 m up), steered toward the ring's x, released when its free flight would cross the ring's plane at the ring's height. |
| Diving Skull | the water maps | A first touch on open water before the ring dives (`s.sub.dive`): it settles 0.55 m down, steers under the ring, and within 1.6 m of the ring's plane breaches on a 0.45 s arc to where the ring will be. |
| Clone Skull | map 5 | Two analytic clones fanned ±0.75 m/s. At the ring's plane, if the skull would miss and a clone is through, the clone takes its place (`cloneSwap`). |
| Rewind Bone | map 6 | A miss while it's on isn't counted (no life, no streak lost). When the miss has played, the skull runs back along its recorded path over 0.9 s, the ring's phase returns to the launch, and the throw is taken off the count. |
| Homing Bone | map 7 | v60: a nudge, not a lock-on (the owner's call). In the last 0.45 s before the ring's plane, if the predicted crossing is within 0.75 m of where the ring will be, the skull is steered toward it (gain 0.6, up to 6 m/s²), with 0.8 m/s of correction in all per throw (`s.homeDv`): enough to turn a clank into a rim-in, never enough to save a wide one. |
| Gravity Flip | map 8 | The throw's gravity is −G (`skull.g`). The aim mapping, the guide and the ground test all use the throw's own gravity, so the aim still marks the ring-plane crossing. A miss goes up and away. |

## The attractions (`07u_attractions.js`, v56)

The eight mini-games are attractions, not ring challenges. While one is on:

- the ring is hidden, and nothing crosses it (`attrOn()` switches the ring test off in the flight);
- the ring is parked on the attraction's plane, so the aim guide's reticle, the camera's safe box and the camera's
  follow all read that depth;
- the flight is judged where it crosses that plane (`attrCheck`), or, for Can Alley's cans and Sudden Death's
  blades, by a swept test against each thing;
- a hit resolves as `tgt` or `bull` and a miss as `board`, `curtain`, `pocket`, `fake`, `blade`, or the usual `wide`,
  `over`, `low` or `short` (07_game.js: `RESULT`). The attraction's word replaces the ring's, and it never lights the
  ring, pays a skull for a streak, or counts as a signature shot.

**Longshot's throw.** The aim point is on the board's plane and the flight time grows with the square root of the
distance, so a throw carries 150 m without leaving the screen. The skull is kept visible to 24 m past the board.

**Randomness.** The attractions roll the run's dice (`runRand`), so a replay plays the same gallery, rounds, winds and
cans.

**In tests.** `T.attr()` reads the state, `T.attrThrow(x, y)` throws to meet (x, y) on the plane, and
`T.attrProps`, `T.attrCurtain`, `T.attrWindSet`, `T.attrSwing(ahead)` and `T.pitchHoles()` set things up.

## The land (`06h_land.js`, v57)

Each map's `travel.land` sets:

| Key | Meaning | Range |
|---|---|---|
| `hills` | how high the land rises either side of the road | 0–8 m |
| `roll` | how much the road itself rises and falls | 0–4 m |
| `wave` | the length of the road's swells | 40–300 m |
| `curve` | how far the road bends (1 is about 9 m either way) | 0–2 |
| `bend` | the length of the bends | 60–400 m |

- **Looks only.** Within 9 m of the camera the land is flat and the road straight. The height eases in to 48 m out and
  the bend to 22 m, so the play space never changes.
- **Relative to the camera.** A hill ahead flattens into the ground under the next throws as the world advances.
- **The bend moves things sideways, not the camera.** The camera always faces the same way, so the road snakes across
  the view and a lair on the horizon swings into line.
- **Drawing.** 23 slices from 170 m in to 9 m. Each is a curtain from its skyline down to the highest point any nearer
  slice reaches, painted with the ground plate's own gradient (so flat land matches the painted ground exactly). The
  map's hill colour comes up where the land rises, with a rim and a faint ink line only along real crests.
- **In among the scenery.** The props, the wanderers and the ground dressing are drawn between the slices at their own
  depths, so a crest hides the foot of whatever stands beyond it.
- **The road.** A strip over the slices in the lane's own material, fading in beyond the ring.
- **Under load.** The hill colour and the crest lines go when adaptive quality steps down.

## The band (`02f_music_clock.js`, v57)

Parts scheduled on the musical clock a tenth of a second ahead, on the music bus, in the playing loop's key. They play
over the acts and the boss only (no drive or hats over the boss, which has its own drum), and never with the music off.

| Layer | When | What |
|---|---|---|
| drive | three in a row | a soft kick on one and three |
| hats | on fire (six in a row) | eighth-note hats |
| heart | the last skull | lub-dub on every beat |
| walk | the world moving | woodblock on the off-beats (switches by the beat) |
| bass | the last eight hits before a boss (Adventure) | root and fifth, a note to the half bar |
| sting | a perfect or a bullseye | four notes up the scale on the next four eighths |

Layers come and go on the bar line. `T.bandDry()` runs the scheduler without sound for the tests.

## The sky over the road (`06g_travel.js: skyUpdate`, v58)

How far along the map's track the camera stands (`TRAVEL.D` over the track's end) is the night's progress `p`. From it:

- **The moon.** It moves outward and down on its own side of the sky: `dx` toward its edge (at most 0.55 U), `dy` down
  to just above the horizon. The path is eased (smoothstep) and scaled by the map's `travel.sky.arc`. It never crosses
  the ring's band. The moon's plate, its halo (now drawn live, `drawSkyGrade`), its GPU light, the vignette's clearing
  and its road down the water (`moonPath`, its own plate on the water maps) all take the same offset.
- **The night.** A wash over the sky plate, from `late[0]` at the zenith to `late[1]` at the horizon, at `p × k`.

`travel.sky` is `{ arc 0–1, late [zenith, horizon], k 0–0.6 }`, checked by the build. The screen (the Drowned Theater)
and a moonless map don't move.

## The ring's reflection (`08l_water.js: RING_REFL`, v58)

The ring has exactly one reflection, and only over water: `drawRingReflection`. It draws the ring, a boss and the skull
in flight, mirrored at the ring's own water line with a cartoon squash (`REFLECT.ring`, 0.26), darkened, and laid in
wavering strips like the scenery's reflections. It is drawn every frame whatever the phone's quality; the scenery's
reflections still drop out first. The ring's post gets slow rings in the water round it. `drawTrackAndShadow` gives the
ring no shadow over water. The boardwalk ends at `WALK_END` (3.3 m, `01_data.js`) so the ring stands in open water.

## The MapTravelController (`06g_travel.js`, v58)

`travelDistAt(h)` returns how far on the camera stands after `h` makes, from two things:

- the **map's profile**: its `travel` block (step, arrival, land, sky);
- the **mode's movement profile**, `MAP_TRAVEL`:

| Profile | Modes | Movement |
|---|---|---|
| `legs` | Adventure, Adventure+ | The travel table: steps through acts I–III and the approach, still through the bosses. |
| `road` | Arcade, Practice, the Director's Challenge, the Feature | 0.8 × step a make, linear, then easing toward the track's end (the slopes meet: no lurch). |
| `arena` | Boss Rush | The arena of the boss being fought. |
| `still` | the attractions, the title | Stays at 0. |

`travelGoal` is the only caller, and the camera anticipation (`08k_feel.js`) reads the same function. A new mode names
its profile in the table; nothing is special-cased by map or mode.

## The flow (`06i_flow.js`, v58)

Curl noise: `curl(x, y, t, scale, octaves)` is the curl of a value-noise potential, so the field has no sources or sinks
(its discrete divergence is zero at the curl's own step, and the spec checks that). Built on it:

- `current(x, y, z, t, drift)` is the underwater current. It has two layers, a macro swirl plus the biome's drift and
  micro turbulence, in m/s.
- `wander(seed, t)` is a creature's own meander.

**Uses:**

- the aquatic motes, bubbles, the weed's sway (`FLOW_SWAY`) and the swimmers' wander;
- fireflies, spores, embers and the weather's bubbles;
- the mist banks;
- the portal's motes.

**The rule:** nothing in the skull's flight, the aim, the ring, the targets or the obstacles reads it. The spec throws
the same throw twice with the water churning between and checks the two flights match.

## The aquatic environment (`08m_aquatic.js`, `06j_aqua_props.js`, v58)

A map with water has an `aquatic` biome in its JSON. It has two kinds.

**`submerged`** (the Drowned Theater): the camera is under water. `look.ambient.water` must be false: no surface, no
reflections, no dive.

| Layer | What |
|---|---|
| far | `far`: whales, mantas and schools crossing where the sky would be (`drawAquaFar`). |
| floor | Caustics: a tileable folded-light tile made once, laid in perspective bands, two layers drifting against each other (`drawCaustics`). |
| world | The creatures, merged into the scenery by depth (`aquaWorldList`, drawn in `drawGroundWorld`). |
| column | Attenuation (thickest at the horizon), light shafts, marine snow, bubbles, and the caustics again, fainter, over everything standing (`drawAquaColumn`). |
| front | Now and then a big dark fish passes close, low in the frame and to one side, never while aiming or in flight (`drawAquaFront`). |

**`surface`** (the Black Marsh): the camera is above murky water. The life under the water is drawn on the water plane
as dark shapes with a sheen along their backs. What sits on the water is drawn in the world. Ripples come from
swimmers, frogs, bubbles and insects.

**Fauna and behaviour:**

| Creature | Biome | Behaviour |
|---|---|---|
| school | submerged | Members follow their place in the group, a beat behind; they burst apart when threatened and regroup. |
| fish | submerged | Wander on the flow and scatter. |
| crab | submerged | Crawls sideways in fits and starts; digs in when threatened. |
| eel | submerged | Comes out of its hole and sways, then goes back; goes back at once if threatened. |
| jelly | submerged | Drifts on the current with a slow pulse. |
| turtle | submerged | Glides across every so often. |
| octopus | submerged | Sits and shifts colour; jets away. |
| shrimp | submerged | Little flicks along the floor. |
| minnows, bigfish, swamp-eel, tadpoles | surface | Shapes under the surface; big fish make a boil now and then. |
| frog | surface | Sits on its own pad; jumps in when startled and climbs back later. |
| snapper | surface | Its head comes up and goes down, with a ring each way. |
| gator | surface | Eyes and snout far off, gliding, with a V wake. |
| strider | surface | Skates the surface in darts, dimpling it. |
| dragonfly | surface | Darts on the flow and touches down. |

A threat is the skull within 2.6 m, or the world travelling past (near the lane). Swimmers steer out of the ring's
cone (`|x| < 2.1 + 0.1 z` at throw heights) and are clamped out of it (`aqKeepOut`). None of it is ever hit.

**Depth:** each creature's colour is blended toward the water's `deep` colour with distance, and its ink fades. Near
ones read darker-lined and larger; far ones are muted.

**The sea bed's scenery (`06j_aqua_props.js`):** coral (fan, brain, branch), barnacled rock, seaweed, shells, anemones,
a broken stage flat, a ruined column, a wall with a playbill and a sand drift. These are ordinary travel scenery,
placed through the zones' mixes.

**Seat rows:** a travel zone can carry `rows` with these fields:

- `asset`, `every` (metres between rows), `deep` (seats per row) and `from`;
- `stagger`;
- `gone`, `over` (knocked over: `tilt`) and `buried` (sunk into the floor and clipped at it: `sink`).

The build checks the `aquatic` block: its kind, the fauna that belong to that kind, 0–12 of each, and the water's
colours, ranges and current.

## MAP → ECOSYSTEM → CAST (`blueprint.json: ecosystem`, `08n_wildlife.js`, v58)

Characters are not global. `blueprint.json: ecosystem` holds three things:

- `cast`: every character and creature, with the maps it may appear on;
- `variants`: the character's look per map:

| Character | Variants |
|---|---|
| skeleton | plain · drowned · bleached · echo |
| gravedigger | sexton · prospector |
| zombie | intro · plain |

- `identityTest`: the ten questions.

Each map's `ecosystem` holds:

- `teaches`: the order's word for its place;
- `cast`;
- `wildlife` counts for the land and air creatures;
- `vegetation`, `props` and `hazards`;
- `heat` (the desert).

The build (`ecosystem_problems`) derives who a map actually shows from what the code reads, and refuses a map that
shows anyone who isn't in its cast, or whose cast has anyone the rules don't allow there. What it reads:

- the walkers, the ghost flag, the gravedigger, the witch and the cat;
- the sky life (crows, or bats, or both with `batsToo`);
- the fireflies;
- the water's fauna;
- the wildlife.

In the code:

- `castVariant(who)` picks the look: the skeleton's cel is washed and dressed per variant (`skeletonVariant`), the echo
  flickers and trails a double, and the gravedigger wears a prospector's hat in the desert.
- `flockKind()` decides who flies over. Travel zones' flocks use it too, so the Woods and the desert get none.

**The Map Identity Test**, per map:

| # | Question | Check |
|---|---|---|
| 1 | Without the background, is it still identifiable? | ≥ 4 scenery kinds no other map has. |
| 2 | Does the cast belong? | Every member allowed; at least one not on either neighbour. |
| 3 | Does something live here? | ≥ 2 kinds of wildlife. |
| 4 | Does it grow its own? | ≥ 2 vegetation kinds, all on its track. |
| 5 | What's lying about? | ≥ 3 prop kinds, all on its track. |
| 6 | Its own ground? | Lane unlike both neighbours'. |
| 7 | Its own air? | Weather unlike both neighbours'. |
| 8 | Does it teach its lesson? | `teaches` = the order's word; hazards named. |
| 9 | Its own palette? | Sky + ground mid-tones ≥ 20 (RGB) from every other map. |
| 10 | Is its end its own? | A lair landmark no other map has. |

**The wildlife (`08n_wildlife.js`)** is the land and air counterpart of the aquatic module. It shares:

- the travel shift (creatures keep their place in the world as the camera moves);
- threats (the skull near, or Morty going by);
- the flow (wander) and the depth tone;
- the merge into the scenery's depth order.

Creatures and behaviour:

| Creature | Behaviour |
|---|---|
| owl | Perched; turns its head after the skull; blinks; flies off when threatened. |
| deer | Grazes, alerts, bounds away. |
| fox | Trots across, sits, trots on. |
| spirit | A glowing wisp wandering on the flow, with a GPU glow. |
| vulture | Circles high. |
| scorpion | Crawls; digs in when threatened. |
| tumbleweed | Rolls with the wind, bouncing; never closer than 6.5 m. |
| clockbug | Runs while wound, then rewinds its key. |
| fungi | Pulse; flare when threatened; GPU glow. |
| voidling | Fades in far off, watches, fades out. |
| fragment | A piece of an earlier world, turning and drifting. |

`drawHeatHaze` wavers the band over the horizon with strip copies of the frame. It is drawn before the ring, so the ring
never wavers. Spirits and fragments are clamped out of the ring's cone.

## Encounters (`07w_encounter.js`, v59)

The hierarchy is **RING → THROW → WORLD INTERACTION → CONSEQUENCE**. The ring is the mandatory target and judges every
throw as before. Three layers:

| Layer | What |
|---|---|
| Ring Target | The ring. |
| Ring Modifier | The map's movers, threats, blockers and deflectors (07m_obstacles.js); the pendulum and jump-cut ring mechanics. |
| Ring Interaction | `ENC.it`: an optional object behind the ring (map JSON `encounter: { interaction, consequence }`). |

**The Ring Interaction.**

- **Presence:** on hits where `stageHits % 6 >= 3`, in phases A and B only (no boss, no mini-game, no crossing).
- **Placement:** it hangs from a pivot at `ring.x ± 0.72 rc`, `ring.y + 0.25`, `ring.z + 1`, on a 0.55 m pendulum. Its
  angle is integrated on the run's simulation clock, with an idle sway on the obstacles' clock (`OB.t`), so replays agree.
  The hit radius is 0.18 m, so a straight make at the ring's centre never chains; going through the ring's lower side
  half does.
- **Consequence:** after a make, hitting it scores `150 × chain` (the chain resets on any throw that doesn't chain).
  - `path`: `ENC.calm = 2`, so the next throw's obstacles stand aside (`obStandsAside`: no collision, no force, no
    cannon fire, drawn faded).
  - `bonus`: points only.
- A hit without a make only rings it.

**Behaviour.** `obBehaviour(O)` derives idle / notice / telegraph / active / recover from each obstacle's own cycle:

- the fuse, the crusher's shudder, the spikes' peek and the scrim's flicker are its telegraph;
- a knockout or the cleared way is its recover;
- the aim coming near (`O.sense`) is its notice.

`drawObEyes` shows the state.

**Weak points** (`encWeak`, the Threats only):

- the cannon's powder cap;
- the rivet at the crusher's outer top corner.

`weakCheck` runs before `obstacleCheck`, so a hit on the weak point lands first: +200, and the threat is out for two
throws.

**Skull Sense.** While aiming, `updateEncounter` samples the unforced arc of the current aim. How near it passes to the
interaction becomes `ENC.sense` (a tremble and a glint), and how near it passes to each obstacle becomes `O.sense`
(the notice state).

**Categories.** `ENC_CATS` lists the eleven. `OB_CAT` maps each obstacle kind and `TARGET_CAT` each target type to one.

**The camera** (`04c_camera.js`). `cam.mode = ENC.phase`, one of `ring`, `travel`, `throw` or `consequence`, laid over
the five existing moves:

| State | Adds |
|---|---|
| ring | A little lean toward the ring. |
| travel | A push forward. |
| throw | Follows a make on toward the interaction. |
| consequence | A short push toward `ENC.focus` for about a second. |

All of it stays inside the map's camera bounds and the ring's safe box.

## The Drowned Theater's water (`07x_water.js`, v60)

The map's `medium` block (`{ kind: "water", g, drag: [across, up/down] }`, validated by the build) puts the whole throw
under water, not only a miss that falls in (`08l_water.js`).

- **The step.** `waterPush` runs at the top of each flight step, after the obstacles' push and the power-ups': it rebases
  the arc, damps `v.x` and `v.y` by `exp(−drag·dt)` and sets the step's gravity to `g0 × medium.g`. Along the lane (`v.z`)
  nothing is lost, so every throw still reaches the ring plane when it always did.
- **The aim** (`waterAim`, called from `aimVelocity`). The aim point still means where the throw crosses the ring plane,
  as it does under a Gravity Flip: the launch is solved through still water (drag and buoyancy). The crossing is linear
  in the launch, so two runs of the same step give the coefficients, cached per flight time, gravity, wind and medium.
- **The water's own things.** `current` (an undertow: a box that pushes, on a slow tide `swell: [period, min]`), `jet`
  (a vent at `at: [x, z]` that bursts a column `h` high on `pulse: [on, off]`, fizzing for the last 0.5 s first), and
  `pocket` (trapped air, radius 0.3–1.2 m, drifting: inside it the throw flies at full weight with no drag). Currents,
  vents and pockets are not compensated by the aim: they're the player's to read.
- **Wind (v61).** The aim guide, Skull Sense and `waterAim` never include the wind (`forcedPath({wind: false})`); the flight does.
- **One model.** The flight, the aim guide (`forcedPath`), Skull Sense and the spec's aim all step the same model. The
  obstacles' clock ticks before each step, as the game's update does, so the guide and the throw agree to 1 mm through
  the undertow.
- **Tests:** "v60 Under the sea", "v60 The water's own things".

## Surfaces, bank boards and Bank Rings (`07y_banks.js`, v60)

**Surfaces.** `SURFACES` gives each material a restitution `e` (how much of the speed into it comes back) and a friction
`f` (how much along it is lost), a sound (`Sound.surface`) and bits:

| Material | e | f | Where |
|---|---|---|---|
| bone | 0.85 | 0.10 | the Bone Desert's ground |
| stone | 0.65 | 0.20 | the Gilded Graveyard's headstone and ground, the Clockwork Caves' ground |
| metal | 0.95 | 0.05 | the gilded urns (their bounce is exactly what it was), the gilded plaque |
| ghost | 1.10 | 0.00 | the Black Abyss's urns and floor (it gives back more than it got) |
| mud | 0.20 | 0.60 | the Drowned Theater's sand and the Black Marsh's ground |

`surfaceBounce(v, n, mat)` returns `v_t·(1 − f) − e·v_n·n`. A map's `ground` scales the ground bounce relative to stone
(which is how packed earth always bounced), so it only changes how a decided throw lands.

**Bank boards** (`kind: "bank"`): `at: [x, z]` the middle of the face, `len` along the lane, `y: [low, high]`, `mat`,
optional `yaw` (≤ 30°), `slide: [amp, period]` (a moving bank) and `seal`.

- The flight finds the exact touch (`bankTime`: the arc against the face's plane, pushed out by the skull's radius) as
  it does the ring and the ground, and bounces off by the board's material.
- The aim guide steps the same bounce (`bankStep`). The Full guide shows it, the Short guide doesn't reach it, and an
  urn's bounce is never drawn.

**Bank Rings.** `seal: { need, every }`: counted from the board's arrival, every `every`th ring fills with a gilt film
showing a pip per bank it wants. A throw that has banked `need` times (off a board or an urn) opens it with a ding; any
other throw through the window bounces off (`sealed`, a miss). A miss leaves the count, so a sealed ring stays sealed
until it's banked in.

The Gilded Graveyard teaches it:

- Act III: a stone headstone on the right (from hit 20; hits 22, 25 and 28 are sealed).
- The approach: a sliding gilt plaque on the left.

A board-to-board double bank can't reach the ring: the aim reaches at most 0.47 m across per metre of depth. So a ring
that wants two banks counts an urn as the second; no map asks for two yet.

**Chains climb.** `chainPitch(n)` raises each bank, urn bounce and target hit in one throw by two semitones.

**Tests:** "v60 Surfaces", "v60 A bank board", "v60 Bank Rings".

## Depth lanes (`07z_lanes.js`, v60)

`ring.lanes: { z: [near, mid, far], from }` (the build checks they sit inside the ring's zone, at least 1.5 m apart).

- **Which lane.** In the first half's line or static ring, from hit `from`, each ring stands in one lane. The lane is a
  hash of the run's seed, the map and the hit, so a miss throws at the same ring again and a replay sees the same
  lanes. It's fixed as the skull settles (`lanesAfterThrow`), so it never moves under a throw.
- **How it reads:**
  - scale (the projection);
  - its post walking down the lane;
  - a haze over a far ring (`drawLaneHaze`);
  - a pair of stakes per lane with the live one's lanterns lit (`drawLanes`);
  - the camera's lean with the aim, which slides a near ring further than a far one;
  - a whistle up or down, with FURTHER BACK! / CLOSER!
- **The physics doesn't change.** The ring is only nearer or further along the same lane.
- **Where:** the Bone Desert (5.6 / 6.6 / 7.6 m, from hit 10) and the Black Abyss (5.0 / 6.0 / 7.1 m, from hit 20).
- **Test:** "v60 Depth lanes".

## Ring personalities and tells (`07z_rings.js`, v60)

`ring.personality: { kind, from, to }`. It applies in the first half's line or static ring, on the simulation's own
clock `PERS.t`, and the flight judges the ring where its character put it.

| Kind | Map (Act III) | What it does | Its tell |
|---|---|---|---|
| timid | the Whistling Woods | Within 2.2 m of the ring plane, a throw makes it flinch along its line away from the skull's predicted crossing (0.32 m, never out of its zone). It eases back after. | Aimed at, it trembles and ticks nervously. |
| shy | the Drowned Theater | Every 3.2 s it turns edge-on and back (up to 72°). Its window's width across is `cos(yaw)`, and `hitRing` divides `dx` by it. | A whirr 0.5 s before. |
| decoy | the Black Marsh | A will-o'-the-wisp ring hangs 1.05 m above, mirrored across the lane (never overlapping the real one). Through its window is `decoy`. Not in Adventure+, which has its own ghost rings. | No post, no reflection, a green flicker, a hiss when aimed at. |
| aggressive | the Clockwork Caves | Every 2.6 s it lunges along its line at three times its pace for 0.4 s (`persRate`, used by the phase, the crossing test and the judging alike). | A whirr 0.5 s before. |

**Tells for every ring:**

- A ring on its line ticks softly 0.22 s before it turns round, while you're aiming.
- The Final Reel's ring dings as its film starts to flicker.

**Tests:** "v60 Ring personalities"; the Homing Bone's nudge is in "v57 power-ups".

## The owner's playtest fixes (v61)

- **The aim line.** `guideNow()` (`07u_attractions.js`) is the guide in force: `"off"` in Long Shot, Can Alley and
  Perfect Pitch (`NO_GUIDE`), otherwise `settings.guide`. It gates the dots, the crosshair and the last throw's ghost
  (`08k_feel.js`).
- **The wind.** The guide (`buildPreview`, `forcedPreview`), Skull Sense and `waterAim` leave the wind out. The flight
  (`posAt`, `forcedPath` by default) keeps it. Gale Force's levels are breeze 1.2, gust 2.0, gale 2.8, storm 3.6 and
  hurricane 4.4 m/s².
- **The progression bar.** `renderProgress` adds `.off` (hidden) in a mini-game, and `.noarea` (no stage chip, boss
  marks or ticks) in every mode but the Adventure.
- **Adventure+'s print.** The red cast only. `plusPrintHold` (the stuck frame) and the torn frames were removed.
- **Perfect Pitch.** The pockets are laid out so the drawn rims (1.45 × r) clear each other by 0.12 m or more, and the
  catch zones (r + the skull's radius) never touch. `PITCH.rim` is the drawn scale.
- **Tests:** "v61 The aim line", "v61 Gale Force", "v61 The area progression bar", "v61 Perfect Pitch"; the woods wind
  test now checks that the guide leaves the wind out.

