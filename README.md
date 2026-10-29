# Nine-Box

A Nine-Box grid for the annual review: build your team, place each person by
**Savoir-être** (behaviour) and **Savoir-faire** (impact / potential), check the
distribution against the tier targets, and work out the annual increments.

It is based on the IML template `Nine_Box_Grid_Template_Pour_IML.xlsx`, with
one more level on each scale: **Faible, Moyen, Bon, Élevé**. The grid is
therefore 4 × 4 (16 boxes); the nine boxes of the template keep their names,
actions and tiers.

## Private by design

- The app is a single static web page. There is **no server and no database**:
  nothing you type is uploaded anywhere.
- Your work lives in the browser tab. To keep it, click **Save** (a `.json`
  file) or **Export** to Excel (a formatted `.xlsx`). Both files can be opened
  again with **Open…** to carry on. Files saved before the fourth level was
  added open too: their Élevé ratings stay Élevé.
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
   another tier where needed, without changing their box. Each person's
   increment % follows their tier, and the average per tier updates as you go.
5. **Export** and choose:
   - **Excel** for the final record (team list, grid, calibration), or
   - **PDF** for a landscape A4 report: the team as a tree (manager on top,
     each member with their tier), the grid, and optionally the calibration.

The **Guide** button next to Export recaps these steps and lists the guiding
questions for the review.

### Default tiers

Each level is worth points (Faible 1, Moyen 2, Bon 3, Élevé 4). A box's tier
follows the total of its Savoir-être and Savoir-faire points:

| Tier             | Target | Points | Boxes                                                                                              |
| ---------------- | -----: | -----: | -------------------------------------------------------------------------------------------------- |
| Excellente Année |   10 % |      8 | Top Talent                                                                                         |
| Bonne Année      |   40 % |    6–7 | Haut Potentiel, Futur Leader, Potentiel à Guider, Performer Solide, Leadership Émergent            |
| Année normale    |   40 % |    4–5 | Performance à Risque, Performance à Encadrer, Performer en Croissance, Core Performer, Contributeur Fiable, À Accompagner, Décalage (Mauvais Fit) |
| Mauvaise Année   |   10 % |   ≤ 3 | Besoin d'Amélioration, Bas Performer, À Développer                                                 |

Everything in this table can be changed in **Settings** (names, colours,
targets, increments, box → tier mapping, and tiers can be added or removed).
No default increment % is set: enter your own.

## Running it

- **Hosted:** production is the `main` branch, deployed by Vercel
  (build command `npm run build`, output directory `dist`).
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
