# The Lab plate + tool sheet — generation brief

**Fermenta Tycoon.** Two images: a painted workshop room, and a sheet of the six
tools that stand in it.

Same pattern as the cellar, which is now proven: a painted plate, and the game's
own objects placed on it at measured coordinates.

---

# PART 1 — THE LAB PLATE

## The one rule: paint only what never changes

Everything that carries live information has to stay drawn, which means the plate
must leave **room** for it rather than picturing it.

**PAINTED (yours):**
- The walls, floor and ceiling
- **The workbench itself** — the single most important object in the picture
- Background clutter: shelving on the back wall, hanging bunches, a slate, crates,
  sacks, a stool, cobwebs in the corners
- The cellar door in the left wall

**LEFT EMPTY (mine, drawn over the top):**
- **Every vessel.** Jars, trays, onggi, casks — all of them are live batches with
  seven visible states between them (fill level, lid open, running hot, spoiled,
  being stirred, heated, misting). A painted jar is a jar you cannot tell from
  someone else's.
- **Every tool.** The player only owns what they have bought, and a painted press
  is a press they appear to own before they do. See Part 2.
- **The window.** It shows the actual month and weather — bare tree under snow in
  February, full canopy in July, rain running down the glass. It is the only place
  in the game where the season is a picture rather than a number. Leave a
  **window-shaped opening in the right-hand wall**: frame and reveal painted, the
  glass itself flat dark. I draw the sky, the tree and the weather into it.
- **The empty bench footprints** — dashed outlines showing where a new culture can
  go. These need clear tabletop.

## Geometry

Match the room the game already draws, or nothing will line up:

- **1344 x 800**, matching the cellar plate so both rooms feel like one building.
- **Isometric or shallow one-point perspective with a low horizon.** Floor and
  tabletop lines at roughly **2.4 horizontal to 1 vertical** — that is the exact
  rhombus every vessel sits on. Get this and everything locks in; miss it and
  everything looks stuck on.
- **The bench is a rhombus, seen corner-on**, occupying the middle of the frame:
  back corner around 40% down the image, front corner around 78% down, left and
  right corners roughly 6% and 94% across. Its top surface must be **clear** —
  that is where the jars go — with visible thickness and two shaded side faces
  below it.
- **Floor space behind the bench**, left and right of centre, for the big casks
  that stand on the ground rather than on the table.
- **Standing room at six points around the edges** for the tools (Part 2):
  back-left, back-right, mid-left, mid-right, front-left, front-right. Keep these
  clear of painted furniture.
- A **breathing margin** of ~6% at every edge; the panel crops slightly at some
  window sizes.

## Light

Warm and overhead, centred over the bench, falling off toward the corners — a
workshop with one good lamp over the work. **No hard cast shadows from painted
furniture**: my objects carry their own soft ellipse shadow, and if the painted
crates throw sharp shadows one way and mine do not, the mismatch reads instantly.

The room should feel **warmer and more lived-in than the cellar** — that is the
whole contrast between them. The cellar is cool, still and stone; the workshop is
amber, cluttered and in use.

## Palette

| role | hex |
|---|---|
| deepest ground | `#15100b` |
| wall / panel brown | `#1e1710` |
| bench top, lit | `#7a5631` |
| bench top, body | `#5c3f22` |
| bench side, shadow | `#4a3018` -> `#33200f` |
| cream, brightest | `#f4ead9` |
| cream, mid | `#c3b39a` |
| lamp glow | `#e08a3c` |
| brass fittings | `#d9b871` |

Nothing outside this set. The cellar plate arrived lit in cool blue-grey stone and
had to be warmed with a multiply pass to join the game — starting in the palette
saves that.

## Style

Same hand as everything else:

- **Flat fills only.** No gradients inside an object. Volume from **three flat
  facets** — lit, body, shadow — meeting at hard edges. Cut paper, not rendering.
- **Cream contour lines at 25-40% opacity**, never black outlines.
- **No interior texture.** No wood grain, no stone speckle. The game lays its own
  paper grain over the top.
- **Fewer marks than feels right.**
- A faint hand-drawn wobble, as if pen rather than ruled.

## Prompt

> Flat-shaded axonometric cut-paper illustration of an empty fermentation
> workshop interior. A large empty wooden workbench seen corner-on in the centre,
> its top surface completely clear. Stone and timber walls, warm overhead lamp,
> shelving and hanging bundles on the back wall, a closed wooden door in the left
> wall, an empty window opening in the right wall with dark glass. No jars, no
> bottles, no barrels, no tools, no machinery, no people. Three flat tones per
> object, thin cream contour lines, no gradients, no interior texture, warm dark
> brown palette, no text.

---

# PART 2 — THE TOOL SHEET

Six tools. They cannot be painted into the plate because the player only sees what
they own, and each animates when it is actually working.

## The grid

- **3 columns x 2 rows = 6 cells**, canvas **1152 x 768**, each cell **384 x 384**.
- Solid `#15100b` background, no gutters, no labels.
- Each tool **centred, filling ~75%** of its cell, standing on an implied floor —
  drawn as if seen from the same eye level as the bench, so it can stand in the
  room without looking pasted.
- Same style and palette as Part 1.

## The cells, in order

| # | cell | tool | what it is, and what it does |
|---|---|---|---|
| 1 | r1c1 | **Clip-on Fan** | A small caged desk fan on a clamp. Drives airflow over a koji bed — sheds heat and moisture together. Draw the cage and the blades as **separate shapes**: the blades animate. |
| 2 | r1c2 | **Ultrasonic Mister** | A squat tank unit with a nozzle on top. Holds humidity up. Leave the air above the nozzle **clear** — the plume is drawn. |
| 3 | r1c3 | **Hydro-Press** | A tall timber frame press with a screw and a plate. The single most characterful object in the game — it is what turns a moromi into soy sauce. Give it presence: two uprights, a cross-beam, a threaded screw, a pressing plate, a catch tray. |
| 4 | r2c1 | **Centrifuge** | A benchtop machine with a heavy lid. Spins liquid clear. Draw the **lid separately** if you can — the rotor animates under it. |
| 5 | r2c2 | **Geared Agitator** | A motor head on a post with a long paddle shaft hanging down into a vessel. Keeps a big cask from stratifying. The **paddle shaft is a separate shape** — it swings. |
| 6 | r2c3 | **Mash Paddle** | A long oak paddle, standing or leaning. No motor, no machine — the cheap answer to a big vessel. Simplest object on the sheet; leave it that way. |

## The moving parts

Three of the six animate when the tool is actually being used — the fan turns
while something is on forced vent, the mister plumes while anything is misting,
the centrifuge spins while it is running. If the sheet can be delivered with those
parts on **their own transparent layer** (or as three extra cells containing just
the blade cluster, the rotor and the paddle shaft on the flat background), the
motion stays. If not, I will draw those parts over the painted bodies — slightly
less pretty, still correct.

**This is worth asking for.** A fan that visibly turns when a bed is on forced
vent is one of the few places the simulation is legible at a glance.

## What to avoid

- No vessels, jars or produce anywhere on the tool sheet — those are separate art
- No electrical cords snaking off the cell; they clip badly when placed
- No brand names, gauges with numbers, or readable dials — the game supplies all
  the numbers, and painted ones contradict them
