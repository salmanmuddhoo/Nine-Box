# Nine-Box

A Nine-Box grid for the annual review: build your team, place each person by
**Savoir-être** (behaviour) and **Savoir-faire** (impact / potential), check the
distribution against the tier targets, and work out the annual increments.

It is based on the IML template `Nine_Box_Grid_Template_Pour_IML.xlsx`: same
scales, same box names and actions.

## Private by design

- The app is a single static web page. There is **no server and no database**:
  nothing you type is uploaded anywhere.
- Your work lives in the browser tab. To keep it, click **Save** (a `.json`
  file) or **Export Excel** (a formatted `.xlsx`). Both files can be opened
  again with **Open…** to carry on.
- Optional: tick **Keep a draft in this browser** to survive a page refresh. The
  draft stays in that browser on that computer only, and unticking the box
  deletes it.
- Treat the saved files as confidential HR documents.

## Using it

1. **Team** – name the team and add members: type them, paste a list (one per
   line, `Name; Position`), or **Import from Excel**. The original IML template
   imports as-is, with the levels already chosen in it.
2. **Settings** – check the tiers, their target share, the default increment %
   per tier, and which tier each box feeds.
3. **Grid** – drag each name into a box, or click a name to pick its levels.
   Each person shows as a figure coloured by their tier.
4. **Calibration** – compare each tier with its target and move individuals to
   another tier where needed, without changing their box. The increment budget
   (per tier and in total) updates as you go.
5. **Export Excel** for the final record (team list, grid, calibration, notes),
   or **Export PDF** for a landscape A4 report to print or share. The PDF can
   leave out salary amounts, so it can go to people who should not see them.

### Default tiers

| Tier             | Target | Boxes                                                         |
| ---------------- | -----: | ------------------------------------------------------------- |
| Excellente Année |   10 % | Top Talent                                                    |
| Bonne Année      |   40 % | Potentiel à Guider, Leadership Émergent                       |
| Année normale    |   40 % | Core Performer, Performance à Risque, Décalage (Mauvais Fit)  |
| Mauvaise Année   |   10 % | Bas Performer, Besoin d'Amélioration, À Développer            |

Everything in this table can be changed in **Settings** (names, colours,
targets, increments, box → tier mapping, and tiers can be added or removed).
No default increment % is set: enter your own.

## Running it

- **Hosted:** the `Deploy to GitHub Pages` workflow publishes the app from
  `main`. Turn it on once under *Settings → Pages → Source: GitHub Actions*.
- **Offline:** `npm run build` produces `dist/index.html`, a single file with
  everything inlined. Copy it anywhere and open it in a browser. Every CI run
  also attaches this file as the `nine-box` artifact.
- **Development:** `npm install`, then `npm run dev`.

```bash
npm test          # unit tests (grid logic, saved files, Excel and PDF export)
npm run build     # type-check and build dist/index.html
```

---

Developed by Salman Muddhoo using AI.
