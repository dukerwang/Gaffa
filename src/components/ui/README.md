# Gaffa Kit (`src/components/ui`)

Gaffa's own component library: plain React and CSS Modules on the tokens in
`src/app/globals.css`, no Tailwind and no headless-UI dependency. Import from
`@/components/ui`. Every component is on the reference page at
[`/kit`](../../app/kit/KitClient.tsx), which is public so a branch preview can be
reviewed without signing in.

The motion values below are an agent's choices, built on the Emil Kowalski and
Apple fluid-interface guidance this repo recommends (`CLAUDE.md`). None of them
is a decision of Duke's; change them freely, and say why.

## Components

| Component | Use it for | Motion |
| --- | --- | --- |
| `Button` | Any action. `primary` once per view. | Press scale; label and spinner cross through a 2px blur when loading. |
| `IconButton` | An icon-only action. `label` is required and doubles as the tooltip. | Press scale 0.92. |
| `HoldButton` | A costly, hard-to-undo action (release, withdraw) in place of an "Are you sure?" dialog. | Fills on a linear 1.2s clock; drains in 200ms on early release. |
| `SegmentedControl` | A compact filter or view switch in a section head. | One thumb slides between segments. |
| `Tabs` | Page-level views of one thing, with optional counts or an unread mark. Give every item an `href` for route tabs (a `<nav>` of links). | One underline travels between tabs. |
| `Switch` | A setting that applies at once. | Thumb stretches toward its destination while pressed. |
| `Checkbox` | A choice that waits on Save; supports indeterminate. | Tick draws in 180ms; unchecking erases instantly. |
| `Select` | One choice from a short list, with a crest or badge per option. | Listbox scales in from the trigger, flips above it near the screen bottom. |
| `Menu` | A short list of actions on one object. | Same surface as Select. |
| `Popover` | A one-off floating panel; Select and Menu are built on it. | Origin-aware scale-in, faster exit. |
| `Tooltip` | Naming an icon for mouse and keyboard users. Touch never opens it. | 450ms delay for the first; instant for the rest of a sweep. |
| `Toaster` + `toast()` | Transient confirmation of something that just happened. | Stacked; fans out on hover; swipe or flick to dismiss; timers pause on hover and in hidden tabs. |
| `ResponsiveModal` | A focused task. Centred on desktop, a bottom sheet under 640px. | Scale-in on desktop; on mobile a drag-to-dismiss sheet with flick velocity and rubber-banding. |
| `MoneyStepper` | A bid or any €m amount. | Hold ± to run with acceleration; the figure rolls; a refused step shakes. |
| `NumberRoll` | Any figure that changes in front of the user: balances, scores, points. | Odometer digits, keyed from the right. |
| `Skeleton` | Content on its way, drawn in the shape of the real thing. | Compositor-only sheen. |
| `Disclosure` | A section that folds away. | Height through `grid-template-rows`. |
| `SimpleSelect`, `Kbd`, `Icon`, `NavigationLink`, `FormattedText` | Unchanged from before the kit. | |

## Conventions

- **Curves.** `--ease-out-strong` for anything entering or answering a press,
  `--ease-in-out-strong` for something on screen moving to a new place,
  `--ease-drawer` for sheets. All three live in `globals.css`.
- **Exits are faster than entrances**, and overlays use transitions rather than
  keyframes so a quick open-close reverses from where it is.
- **Reduced motion** keeps opacity and colour, and drops movement.
- **Hover styles** sit behind `@media (hover: hover) and (pointer: fine)`.
- **A panel's outline is drawn over its rows.** Use a real `border`, or an
  `::after` with `position: absolute; inset: 0; box-shadow: inset 0 0 0 1px
  var(--color-border); pointer-events: none`. Never an inset `box-shadow` on the
  panel itself: it sits beneath a child's background, so a highlighted row, a
  hovered row or a full-bleed pitch hides the left and right edges.
- **Layers.** Popover 1150, Tooltip 1200, Toaster 1300: all above
  `ResponsiveModal`'s literal 1000 and the player card's 1100, because each can open inside a modal. Move
  them onto the `--z-*` scale when the modal moves.
- **Escape** in a Popover is caught in the window's capture phase and stopped,
  so closing a Select inside a modal leaves the modal open.

## Adoption

`<Toaster />` is mounted once in `src/app/layout.tsx`, so any client component
can call `toast()` from `@/components/ui`. Don't mount a second one: each
Toaster renders every toast, so two would show each notice twice.
