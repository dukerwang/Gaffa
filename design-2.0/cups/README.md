# Cups mockups

The approved mockups from the 2026-10-25 Cups brainstorm. They're built from Matchday Militia's real data at MW8 and seen as Not Too Xabi. Spec: `docs/superpowers/specs/2026-10-25-cups-redesign-design.md`.

- `composition.html`: the three page compositions. Duke chose A, the Trophy Shelf.
- `draw-swipe.html`: Round Pager and Round Columns, plus the seed treatments. Duke chose the Round Pager and the seed column.

These are the record to port from, not shipped code. To rebuild them:

```bash
node node_modules/tsx/dist/cli.mjs design-2.0/cups/assets.ts
mkdir -p design-2.0/cups/out
node design-2.0/cups/build.mjs draw-swipe design-2.0/cups/out
```

`assets.ts` renders the crests from the app's own shield, division and icon data, and the trophies from `design-2.0/trophies/trophies.mjs`. Its imports are relative to this folder.

One bug in the mockup is worth knowing before porting: the pager's tap handler first scrolled by `offsetLeft`, which is relative to the offset parent, not the scroller. The shipped `useSwipePager.go()` uses `offsetLeft` too, so the `RoundPager` scroller must be `position: relative`.
