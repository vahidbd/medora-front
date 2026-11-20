# Medora on Grid

Medora's screens follow the **Grid UI kit** exactly: its tokens, its
measurements and its component class names. This file is the acceptance
list. If a diff breaks one of these rules, the change isn't done.

Words come from `GLOSSARY.md` (tenant, staff member, role, membership…).
This file is about how things look.

## Where the look lives

| File | What it holds |
| --- | --- |
| `src/styles/grid-tokens.css` | Every kit token as a CSS variable. Light on `:root`, dark on `.dark` (set by next-themes). Medora adds only the chart series, `--sidebar-ring` and `--focus-edge`. |
| `src/styles/grid-tokens-aa.css` | The one deliberate deviation: the kit token values that put text under 4.5:1 or focus under 3:1, moved to the nearest same-hue shade that passes. See "Accessibility over the kit". |
| `src/styles/grid-kit.css` | The kit's component CSS, **copied as it is**. Never edit it; diff it against a newer kit instead. |
| `src/styles/grid-app.css` | What Medora needs beyond the kit, built only from the tokens: base-ui states, the shell's extras, gates, cards, tables, notices. |
| `src/styles/grid-list.css`, `grid-record.css` | The joins list tables and record sections need. |
| `src/styles/grid-native.css`, `grid-pickers.css` | No browser chrome (tooltips, validation bubbles, scrollbars, spinners), the kit's motion, and the date and time fields. |
| `src/styles/sections/*.css` | One file per area that needs more, built only from the tokens. |
| `src/app/globals.css` | Imports them as a `components` layer and maps the tokens to Tailwind (`bg-card`, `text-muted-foreground`, `border-border`…). |

Type is **Inter** (with `cv11`, `ss01`) and **Geist Mono** for ids, codes
and money in tables. Nothing else.

## Primitives carry the kit

The components in `src/components/ui` (shadcn's, on Base UI, owned here)
render the kit's classes, so a screen built from them already looks like
Grid. Use them instead of styling markup by hand. A new primitive is taken
from shadcn's Base UI set and fitted to the kit's classes the same way.

| Use | Renders |
| --- | --- |
| `Button` | `.btn` (`btn-primary`, `btn-outline`, `btn-ghost`, `btn-danger`, `btn-sm`, `btn-xs`); icon sizes give `.btn-icon` (`bare`, `is-primary`, `is-sm`…). |
| `Input`, `Textarea`, `Select`, `DateField`, `NumberField` | `.input` (36 tall, 10px corners, halo on focus). |
| `Checkbox`, `RadioGroup`, `Switch` | `.check-box`, `.radio-dot`, `.switch-track`. |
| `Dialog`, `AlertDialog` | `.dlg` at 480 (`--dialog-w`) or 420 (`--confirm-w`), head, body, foot with an optional note on the left. |
| `Sheet` | `.drawer`, a full-height card 10px in from the edges, 560 wide by default. |
| `DropdownMenu`, `Popover`, `Tooltip` | `.pop` / `.menu-*` / `.tip`. |
| `Tabs` | `.tabs-seg` (segmented, the default) or `.tabs-underline` (`variant="line"`). |
| `Card` | `.card`: 16px corners, 24px padding, the dotted rule under the head. `CardContent className="flush"` for a table that runs to the card's edges. |
| `Table` | `.table`: 60px rows, 42px uppercase header, 11.5/600 at 0.06em. |
| `Badge`, `StatusBadge` | `.badge` with a tone (`neutral`, `info`, `success`, `warning`, `danger`) and a dot. |
| `Alert` | `.notice` with a tone. |
| `Toaster` (sonner) | `.save-alert`, bottom right. |
| `Skeleton` | `.skeleton`. |
| `EmptyState`, `LoadFailedState` | `.list-empty` in a dashed box: nothing here, or it didn't load (with Try again). Never the same thing. |
| `InitialsAvatar` | `.ava`, a circle in one of the status pastels, the same colour for a person everywhere. |
| `.choice-row`, `.choice-group-head` | A radio or checkbox with its words beside it, an optional `.choice-sub` line under them; a group of them under a heading set like a table header. |

## The shell

- Sidebar 256 wide; 68 minimised; 68 + 232 when a group's rail is open.
  Blocks with a gap between them (the kit has no sidebar label): Home on
  top, the work areas as they arrive, then Workspace (Staff, Roles,
  Break-glass, Brands, Companies, Settings) and, for platform staff only,
  Platform (Tenants, Domains), each group opening its rail. Search is the search
  box at the top of the sidebar (⌘K), not a row. A screen the staff member
  has no permission for is not drawn (`config/navigation.ts`, `useCanSee`);
  the API still checks every call.
- The brand row is the **tenant switch**: "Medora", then the tenant you
  are working in. With more than one tenant it opens "Work in"; switching
  drops everything loaded for the old tenant. With one it is plain text.
  Platform staff with no tenant of their own see "Platform" there, and
  only the Platform screens.
- The main panel is a card 10px in from the window, 18px corners. The
  topbar is 64 tall: crumbs on the left (a record page names itself with
  `useBreadcrumb(name)`), the date on the right, and before it Break-glass
  for a role that needs it (a small outline button, or a warning badge with
  its end time while open).
- ⌘K (Ctrl+K) opens the command bar: go to any screen you can see. Record
  search joins it with the first records.
- The account menu, at the foot of the sidebar: who you are, your role in
  this tenant, the theme (System, Light, Dark; System by default) and Sign
  out.
- On a phone (640 and under) the sidebar is a drawer behind the menu
  button, and a page more than one level deep shows only its parent as a
  back link. The full trail stays in the markup for screen readers, and the
  current page is `aria-current="page"`.
- The sign-in gate covers the states before the shell: signing in, no
  Medora account for this sign-in, an expired invitation, access ended or
  paused in every tenant, no second factor on this session, and the API
  unavailable (with Try again). Each is one gate card. Accepting an
  invitation (`/sign-up`) is a gate card too.

## Page types

**Plain pages** (Home, Staff today): `PageHeader` with a title and a one
line description, then the kit's cards. A table sits in a flush card. The
main action, when there is one, is on the right of the header, and there is
one primary button on screen at a time.

A brand's colour shows as a swatch: 14px beside its name in a table, the
height of a small button beside the colour field, and a plain muted box
when the brand has none, so names stay in line. A list inside a drawer
(a brand's domains) is rows split by a hairline (`.domain-row`): the value
and a muted line under it on the left, the status badge and an icon
button on the right.

**List pages** arrive with the first list that needs filters, saved views
or paging. They get one list engine (a toolbar row under the title: view
picker, search, filters in a drawer, display options, the main action at
the end; a pager at the foot), built once and used by every list, with its
rules added here in the same pull request.

**Record pages** arrive with the first record (a patient, an order). They
follow the kit's editor shape: header with back link, title, status badge,
one line of facts and actions; a numbered section rail; sections that are
for reading, each with an Edit button that opens a drawer. Their rules land
here with them.

**Public pages** a patient sees (sign-in, brand sites, the patient app) are
built to their own rules: no tracking scripts and no third-party scripts
on any page that shows health data (ADRs 0018, 0022).

## Spacing

Nothing touches the edge of the box it sits in.

- **Text keeps 8 or more from any edge it sits against**: a row's rule, a
  card's border, a box's border, a drawer's head or foot. In a card the
  first and last lines sit about 20 from the card's top and bottom. Gaps
  come from the kit's tokens (`--card-pad` 24, `--box-pad` 16,
  `--space-*`), never a smaller number picked by eye.
- **Table cells pad top and bottom.** `grid-app.css` gives every body cell
  10 above and below (8 for a cell with a badge or tag, 4 for a cell with a
  button, field or avatar). A one-line row keeps its height (60, 44
  compact); a cell that wraps grows its row instead of touching the rules.
- **A table that ends a flush card keeps 8 under its last row.**
- **A table wider than its card scrolls inside it**, never the page.
- **Empty states and notices** keep their own padding. A box inside a card
  is padded with `--box-pad`, not flush with its text.

## Copy and formats

- Sentence case everywhere: titles, buttons, menu items, column headers
  (the header is then uppercased by CSS).
- **No em dash in anything a person reads** (lint refuses one). An empty
  table cell is blank; an empty fact says "Not set".
- Australian formats through `src/lib/format.ts` and nothing else:
  "$1,234.56", "15 Nov 2026", "15 Nov 2026, 14:05", DD/MM/YYYY in inputs.
  Money is held in cents and always keeps its currency.
- A destructive button names its verb: "Remove access", never "OK".
- The product is **Medora**. A tenant's own brand shows only on that
  brand's pages, from configuration (ADR 0023).
- The screen never shows an API path, an error code or a stack trace.

## Accessibility over the kit

WCAG AA wins where a kit token value fails it. This is the only place
Medora departs from the kit's values, and it is one file,
`grid-tokens-aa.css`, imported straight after the tokens (remove the import
and the kit is back exactly). Its header lists each token's before and
after values and the contrast it reaches.

- Text tokens reach 4.5:1 on the darkest surface they sit on. Placeholders
  stay lighter than typed values.
- In dark, `--destructive` is the text red and `--destructive-solid` is the
  fill on danger buttons. Light keeps the kit's one red for both.
- The focus ring (`--halo-strong`) and a focused field's edge
  (`--input-focus`) reach 3:1, shown at once on focus. The ring is subtle:
  a 1px line at 3:1 with a soft 4px glow, never a thick band.
- Nav rows and underline tabs take a **focus edge** instead of the halo:
  1px of `--focus-edge`, drawn inside the row, because a scrolling list
  clips anything drawn outside it. Keyboard focus only: the shell moves
  focus into a rail or the phone drawer only when it was opened from the
  keyboard.
- **Known shortfall:** a field's edge at rest (`--input`) stays the kit's
  1.33:1, under WCAG 1.4.11's 3:1. Fields are identified by their label and
  their value or placeholder; a field with no label gets one.
- A new screen keeps its text on these tokens. Don't reach for a lighter
  grey to make something "quieter".

## Don't

- **No hex, rgb or Tailwind palette colours** (`blue-500`, `gray-200`)
  outside `grid-tokens.css` and `grid-tokens-aa.css`. Use the tokens. (The
  one exception is `global-error.tsx`, which must draw when the token file
  itself failed.)
- **No sizes picked by eye.** No `h-9`, `rounded-[12px]`, `text-[13.5px]`,
  `px-3.5`: the kit already sets heights, radii, type and gaps. If a
  primitive doesn't fit, add a rule to `grid-app.css` from the tokens.
- **No per-screen table, card or button styling.** One of each; a genuine
  difference becomes a documented class in `grid-app.css`.
- **No tinted primary.** The primary is near-black (`--primary`); colour is
  for status.
- **No colour-only status.** Every status has a label.
- **No stripped focus.** Focus shows the kit's halo, or the focus edge on
  nav rows and underline tabs.
- **No focus moved after a click.** Move focus for the keyboard only (a
  click from Enter or Space has `detail` 0).
- **No emoji or filled glyphs.** Lucide icons at 1.7 stroke.
- **No motion over the kit's durations** (`--dur-quick`, `--dur-fast`,
  `--dur-medium`), and none at all with reduced motion.

## Checking a screen without the API

`npm run dev:preview` starts the app against a local mock API with made-up
tenants and staff, signed in as a preview owner, so every screen can be
checked while the API is offline. See `dev/README.md`.
