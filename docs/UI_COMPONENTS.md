# Gaffa UI Components

The authoritative reference for reusable UI primitives in Gaffa (`src/components/ui/`).

All primitives are styled with Gaffa's design tokens in `globals.css` and strictly enforce `docs/UI_RULES.md` and `docs/DECISIONS.md`.

---

## Why these exist

Previously, features re-implemented dialogs, buttons, and selects independently across dozens of CSS modules. This created:
- Ghost cards declaring both border and box-shadow (violating Rule 7).
- Inconsistent mobile behavior where only some dialogs converted to bottom sheets.
- Lowercase button labels violating the 2026-09-09 Title Case decision.
- Excessive AI context and token spend recreating boilerplate.

These primitives provide small, high-leverage prop APIs that are **responsive by default** and **context-efficient for coding agents**.

---

## Primitives

### 1. `Button`

Unified action control replacing ad-hoc `.btn` CSS classes.

- **Import**: `import { Button } from '@/components/ui';`
- **Typography**: Sofia Sans Semi Condensed (`--font-label`), 600 weight.
- **Physics**: Active press scaling (`--press-scale: 0.97`) via Emil Kowalski micro-interaction rules.
- **Rule**: Buttons are **Title Case** (`Save Lineup`, `Join League`, not `Save lineup`).

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | Visual treatment. `primary` uses the green ramp (`--color-accent`). |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | `'sm'` (28px) for compact rows; `'md'` (36px) standard; `'lg'` (44px touch target). |
| `loading` | `boolean` | `false` | Displays an inline spinner while preserving layout dimensions. |
| `fullWidth` | `boolean` | `false` | Expands to fill container width. |
| `leadIcon` | `React.ReactNode` | — | Icon slot to the left of the label. |
| `tailIcon` | `React.ReactNode` | — | Icon slot to the right of the label. |
| `href` | `string` | — | Polymorphic: renders `NavigationLink` when passed. |
| `disabled` | `boolean` | `false` | Native disabled attribute and styles. |

#### Example

```tsx
import { Button } from '@/components/ui';

// Standard action button
<Button variant="primary" onClick={handleSubmit}>
  Save Lineup
</Button>

// Secondary with loading state
<Button variant="secondary" loading={isSubmitting}>
  Update Settings
</Button>

// Navigation link button
<Button variant="primary" href="/league/join">
  Join League
</Button>
```

---

### 2. `ResponsiveModal`

Universal overlay container for modals and sheets across Gaffa.

- **Import**: `import { ResponsiveModal } from '@/components/ui';`
- **Desktop (`>640px`)**: Centered floating dialog with `--shadow-xl` and no border (Rule 7). Newsreader serif title.
- **Mobile (`<=640px`)**: Automatically transforms into a bottom sheet drawer with top rounded corners, swipe drag handle, `92dvh` max height, and safe-area-inset padding.
- **Backdrop safety**: Dismissal requires both mousedown and click on the backdrop, preventing accidental close during text selection or native select dismissal.
- **Escape layering**: Closes on Escape, deferring automatically if `SquadPeekDrawer` is mounted. Freezes body scroll while active.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | — | Controls open/closed visibility. |
| `onClose` | `() => void` | — | Callback fired when user requests dismissal (Esc, close button, or scrim click). |
| `title` | `string` | — | Newsreader serif dialog title (Title Case). |
| `lead` | `React.ReactNode` | — | Slot to the left of title (crest, badge, icon). |
| `children` | `React.ReactNode` | — | Scrollable dialog body content. |
| `footer` | `React.ReactNode` | — | Pinned bottom action bar. |
| `wide` | `boolean` | `false` | Expands max-width from 520px to 1180px for multi-column tools. |
| `padded` | `boolean` | `false` | Applies standard content padding to the body container. |

#### Example

```tsx
import { ResponsiveModal, Button } from '@/components/ui';

<ResponsiveModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Propose Loan"
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" type="submit">
        Send Proposal
      </Button>
    </>
  }
>
  <div className={styles.content}>
    {/* Form contents */}
  </div>
</ResponsiveModal>
```

---

### 3. `SegmentedControl`

Accessible tablist and segmented switcher for view and mode toggles.

- **Import**: `import { SegmentedControl } from '@/components/ui';`
- **Typography**: Sofia Sans Semi Condensed (`--font-label`).
- **Keyboard navigation**: Implements `role="tablist"` and `role="tab"` with arrow key (`ArrowLeft`, `ArrowRight`, `Home`, `End`) navigation.
- **Visuals**: Crisp active pill indicator with high contrast in both themes.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `Array<{ value: T; label: string; icon?: ReactNode; disabled?: boolean }>` | — | Selectable options. |
| `value` | `T` | — | Currently active value. |
| `onChange` | `(value: T) => void` | — | Callback when a segment is selected. |
| `size` | `'sm' \| 'md'` | `'md'` | `'sm'` (26px height) or `'md'` (32px height). |
| `fullWidth` | `boolean` | `false` | Stretches segments evenly across parent width. |
| `ariaLabel` | `string` | `'View options'` | Accessible label for the tablist. |

#### Example

```tsx
import { SegmentedControl } from '@/components/ui';

<SegmentedControl
  value={activeTab}
  onChange={setActiveTab}
  options={[
    { value: 'roster', label: 'Active Roster' },
    { value: 'pitch', label: 'Pitch View' },
    { value: 'retained', label: 'Retained List' },
  ]}
/>
```

---

### 4. `SimpleSelect`

Single-value select input that pairs a clean desktop surface with native OS pickers on mobile.

- **Import**: `import { SimpleSelect } from '@/components/ui';`
- **Mobile ergonomics**: Tapping on iOS/Android opens the device native wheel/sheet picker.
- **Desktop**: Styled trigger matching Gaffa's control surface tokens with custom caret.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `Array<{ value: T; label: string; disabled?: boolean }>` | — | Select options. |
| `value` | `T` | — | Current value. |
| `onChange` | `(value: T) => void` | — | Change handler. |
| `label` | `string` | — | Optional field label rendered in uppercase condensed tracking. |
| `placeholder` | `string` | — | Optional disabled initial option. |
| `size` | `'sm' \| 'md'` | `'md'` | Height and padding preset. |
| `fullWidth` | `boolean` | `false` | Width 100%. |

#### Example

```tsx
import { SimpleSelect } from '@/components/ui';

<SimpleSelect
  label="Primary Position"
  value={position}
  onChange={setPosition}
  options={[
    { value: 'GK', label: 'Goalkeeper (GK)' },
    { value: 'CB', label: 'Centre-Back (CB)' },
    { value: 'CM', label: 'Central Midfielder (CM)' },
    { value: 'ST', label: 'Striker (ST)' },
  ]}
/>
```

---

### 5. `Kbd`

Keyboard keycap display component for shortcuts and hints.

- **Import**: `import { Kbd } from '@/components/ui';`
- **Affordance copy rule**: Follows the 2026-09-08 decision on inanimate agency. Affordances must be stated as infinitive purpose (`Enter to open · Esc to return`) or direct imperatives (`Press Enter to open`), never keys as active agents.

#### Example

```tsx
import { Kbd } from '@/components/ui';

<span className={styles.hint}>
  <Kbd>Enter</Kbd> to open · <Kbd>Esc</Kbd> to return
</span>
```

---

## Agent Usage Contract

When authoring or modifying UI in Gaffa:
1. **Never write raw modal overlays or scrims**: Use `ResponsiveModal`.
2. **Never create custom `.btnPrimary` / `.btnSecondary` classes**: Use `Button`.
3. **Never hardcode button text in lowercase or sentence case**: Buttons are Title Case (`Save Lineup`).
4. **Never create custom tab bars using unstyled buttons**: Use `SegmentedControl`.
5. **Never declare both `border` and `box-shadow` on a container**: Elevation is border XOR shadow (Rule 7).
