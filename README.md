# Sonic Molecules

Just-intonation chords and scales as balls and rods on a prime lattice. Each ratio is a ball, coloured by its diatonic letter, its odd prime factors or its accidentals. Rods show the lattice steps between notes. 1/1 is D.

## Run it

Browsers won't load ES modules from a `file://` page, so serve the folder. From the project folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. An internet connection is needed: three.js loads from jsDelivr and the fonts from Google Fonts.

## Files and CodePen

The three files match CodePen's three panels:

| File | CodePen panel |
| --- | --- |
| `index.html` | HTML: paste only the part between the two `CodePen` comments (the app and the settings pop-up) |
| `style.css` | CSS: paste as is (the fonts come in through the `@import` at the top) |
| `main.js` | JS: paste as is (three.js is imported by full URL, so no import map or package settings are needed) |

## How it works

- **Note sets**: the library in the side panel. Click a set to load it, or step through all sets with the arrow buttons above the model or the ← → keys. The sets live in `LIBRARY_TEXT` near the top of `main.js`, in a plain text format: a line without `//` is a group (indent to nest groups), and a line with `//` is a set, its ratios followed by `//` and its name. Editing the notes box turns the set into your own.
- **Layout**: the side panel holds what you change most: note sets, notes, colour, labels and image export. Lattice, projection, the spelling of 7, rods, grid and axis key are in the Settings pop-up (Esc or a click outside closes it).
- **Input**: ratios (`5/4`, `7`) or whole chords (`4:5:6:7`, read relative to the first number). Primes above 7 are skipped with a message.
- **Lattices**: x = 3, y = 5, and z = 7 (`3 · 5 · 7`, octave-reduced) or z = 2 (`2 · 3 · 5`, octaves kept apart). Every step is one unit, so an octave is as long as a 3/1 step. +z points toward the viewer, and the Front view shows the 3–5 plane.
- **Note names**: line of fifths from D. 3 = one fifth up, 5 = four fifths (major third), so 5/1 is F♯ and 3/5 is F. The *Name 7 as* setting picks the spelling of 7: *raised sixth* = ten fifths up (7/1 is B♯, 1/7 is F♭), *flat seventh* = two fifths down (7/1 is C, 1/7 is E). Diatonic colours follow the name, so the setting changes them too.
- **Colours**: three modes, from the `DIATONIC`, `PRIME` and `ACCIDENTAL` tables at the top of `main.js`. *Diatonic* follows the letter, *prime factors* the odd primes in the ratio, *accidentals* the number of sharps or flats in the name (natural, one, two, or three and more). Diatonic and accidental colours follow the *Name 7 as* setting.
- **Rods**: *none* shows the balls only. *Straight* joins notes one step apart on one axis. *Diagonal* also joins notes one step apart on two or three axes (1/1 to 3/5, 1/1 to 105/1). Rods run from ball centre to ball centre and are drawn with normal depth, so a rod that recedes shows on the face of the ball further back.
- **Labels** are drawn into the 3D scene just in front of their own ball, so nearer balls and rods hide them. Labels further back are drawn fainter.
- **Sound**: pressing a ball plays a sine tone (10 ms attack, 2 s exponential decay) through Web Audio. Every note is brought into the octave centred on D4 (293.66 Hz, A4 = 440), within a tritone either side (G♯3 to G♯4 in equal temperament), so 1/1 and 2/1 both sound as D4, 4/3 sounds above it and 3/2 below. The constants are in the sound section of `main.js`.
- **Projection**: orthographic by default, so the Front view is an exact grid. Perspective is a toggle.
- **Settings** and the current note set are remembered in `localStorage` under `sonic-molecules:v1`.
