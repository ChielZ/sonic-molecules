# Sonic Molecules

Just-intonation chords and scales as balls and rods on a prime lattice. Each ratio is a ball, coloured by its diatonic letter or by its odd prime factors. Rods show the lattice steps between notes. 1/1 is D.

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
| `index.html` | HTML: paste only the part between the two `CodePen` comments |
| `style.css` | CSS: paste as is (the fonts come in through the `@import` at the top) |
| `main.js` | JS: paste as is (three.js is imported by full URL, so no import map or package settings are needed) |

## How it works

- **Input**: ratios (`5/4`, `7`) or whole chords (`4:5:6:7`, read relative to the first number). Primes above 7 are skipped with a message.
- **Lattices**: x = 3, y = 5, and z = 7 (`3 · 5 · 7`, octave-reduced) or z = 2 (`2 · 3 · 5`, octaves kept apart). Every step is one unit, so an octave is as long as a 3/1 step. +z points toward the viewer, and the Front view shows the 3–5 plane.
- **Note names**: line of fifths from D. 3 = one fifth up, 5 = four fifths (major third), so 5/1 is F♯ and 3/5 is F. The *Name 7 as* setting picks the spelling of 7: *raised sixth* = ten fifths up (7/1 is B♯, 1/7 is F♭), *flat seventh* = two fifths down (7/1 is C, 1/7 is E). Diatonic colours follow the name, so the setting changes them too.
- **Colours**: three modes, from the `DIATONIC`, `PRIME` and `ACCIDENTAL` tables at the top of `main.js`. *Diatonic* follows the letter, *prime factors* the odd primes in the ratio, *accidentals* the number of sharps or flats in the name (natural, one, two, or three and more). Diatonic and accidental colours follow the *Name 7 as* setting.
- **Rods**: *none* shows the balls only. *Straight* joins notes one step apart on one axis. *Diagonal* also joins notes one step apart on two or three axes (1/1 to 3/5, 1/1 to 105/1). Rods run from ball centre to ball centre and are drawn with normal depth, so a rod that recedes shows on the face of the ball further back.
- **Projection**: orthographic by default, so the Front view is an exact grid. Perspective is a toggle.
- **Settings** are remembered in `localStorage` under `sonic-molecules:v1`.
