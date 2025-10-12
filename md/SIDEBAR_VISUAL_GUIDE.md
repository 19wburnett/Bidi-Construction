# Dashboard Sidebar - Visual Guide

## Desktop View (Expanded)

```
┌─────────────────────┬────────────────────────────────────────┐
│                     │     BIDI Dashboard Header              │
│   [BIDI Logo]       │   [Notifications] [Credits] [Profile] │
│                     │                                        │
├─────────────────────┼────────────────────────────────────────┤
│                     │                                        │
│  ┌───────────────┐  │                                        │
│  │  + New Job    │  │                                        │
│  └───────────────┘  │                                        │
│  ┌───────────────┐  │                                        │
│  │  ⚡ New Takeoff│  │        Main Content Area              │
│  └───────────────┘  │                                        │
│                     │                                        │
│  🏠 Dashboard       │        (Your page content             │
│                     │         displays here)                │
│  💼 Jobs         (3)│                                        │
│    - New Job        │                                        │
│    - Past Requests  │                                        │
│                     │                                        │
│  🧮 Takeoffs     (2)│                                        │
│    - New Takeoff    │                                        │
│    - All Takeoffs   │                                        │
│                     │                                        │
│  👥 Contacts        │                                        │
│                     │                                        │
│  🏗️  Subcontractors │                                        │
│                     │                                        │
│  🔔 Notifications   │                                        │
│                     │                                        │
│  ⚙️  Settings       │                                        │
│                     │                                        │
│  💳 Subscription    │                                        │
│                     │                                        │
│ ─────────────────── │                                        │
│  Stats Summary      │                                        │
│  Active Jobs: 3     │                                        │
│  Takeoffs: 2        │                                        │
│  Pending Bids: 5    │                                        │
│                     │                                        │
│  ⬅️  Collapse        │                                        │
└─────────────────────┴────────────────────────────────────────┘
```

## Desktop View (Collapsed)

```
┌──┬───────────────────────────────────────────────┐
│  │     BIDI Dashboard Header                     │
│🏢│   [Notifications] [Credits] [Profile]        │
│  │                                               │
├──┼───────────────────────────────────────────────┤
│  │                                               │
│🏠│                                               │
│  │                                               │
│💼│                                               │
│  │         Main Content Area                    │
│🧮│         (Full width)                         │
│  │                                               │
│👥│                                               │
│  │                                               │
│🏗️│                                               │
│  │                                               │
│🔔│                                               │
│  │                                               │
│⚙️│                                               │
│  │                                               │
│💳│                                               │
│  │                                               │
│➡️│                                               │
└──┴───────────────────────────────────────────────┘
```

## Mobile View (Menu Closed)

```
┌───────────────────────────────────┐
│   BIDI Dashboard Header           │
│   [Notifications] [Profile]       │
├───────────────────────────────────┤
│  ☰ Menu                           │
├───────────────────────────────────┤
│                                   │
│                                   │
│        Main Content               │
│        (Full width)               │
│                                   │
│                                   │
│                                   │
└───────────────────────────────────┘
```

## Mobile View (Menu Open)

```
┌─────────────────────┬─────────────┐
│                     │             │
│   [BIDI Logo]       │      ❌     │
│                     │             │
│  ┌───────────────┐  │   Overlay   │
│  │  + New Job    │  │   (Dimmed)  │
│  └───────────────┘  │             │
│  ┌───────────────┐  │             │
│  │  ⚡ New Takeoff│  │             │
│  └───────────────┘  │             │
│                     │             │
│  🏠 Dashboard       │             │
│                     │             │
│  💼 Jobs         (3)│             │
│                     │             │
│  🧮 Takeoffs     (2)│             │
│                     │             │
│  👥 Contacts        │             │
│                     │             │
│  🏗️  Subcontractors │             │
│                     │             │
│  🔔 Notifications   │             │
│                     │             │
│  ⚙️  Settings       │             │
│                     │             │
│  💳 Subscription    │             │
│                     │             │
│ ─────────────────── │             │
│  Stats Summary      │             │
│  Active Jobs: 3     │             │
│  Takeoffs: 2        │             │
└─────────────────────┴─────────────┘
```

## Active Page Highlighting

When on the **Jobs** page:

```
🏠 Dashboard       ← gray text
━━━━━━━━━━━━━━━━━━
💼 Jobs         (3) ← 🟠 Orange background, bold
   - New Job       ← Orange text, shown
   - Past Requests ← Orange text, shown
━━━━━━━━━━━━━━━━━━
🧮 Takeoffs     (2) ← gray text
👥 Contacts        ← gray text
```

When on the **Takeoffs** page:

```
💼 Jobs         (3) ← gray text
━━━━━━━━━━━━━━━━━━
🧮 Takeoffs     (2) ← 🟠 Orange background, bold
   - New Takeoff   ← Orange text, shown
   - All Takeoffs  ← Orange text, shown
━━━━━━━━━━━━━━━━━━
👥 Contacts        ← gray text
```

## Badges

Badges appear when there are items to show:

```
💼 Jobs         [3]  ← Blue badge with count
🧮 Takeoffs     [2]  ← Blue badge with count
🔔 Notifications[5]  ← Red badge with count
```

## Quick Actions Section

At the top of the sidebar:

```
┌─────────────────────────┐
│  ┌─────────────────┐    │
│  │  + New Job      │  ← Orange button
│  └─────────────────┘    │
│                         │
│  ┌─────────────────┐    │
│  │  🧮 New Takeoff │  ← White button with border
│  └─────────────────┘    │
└─────────────────────────┘
```

## Stats Summary (Bottom)

```
┌─────────────────────────┐
│  Stats Summary          │
│  ───────────────────    │
│  Active Jobs      3     │
│  Active Takeoffs  2     │
│  Pending Bids     5 🟠  │ ← Orange if > 0
└─────────────────────────┘
```

## Interaction States

### Hover State
```
💼 Jobs         (3)
   ↓ (mouse over)
💼 Jobs         (3) ← Light gray background
```

### Click/Active State
```
💼 Jobs         (3)
   ↓ (click)
💼 Jobs         (3) ← Orange background, bold text
   - New Job       ← Sub-items appear
   - Past Requests
```

### Collapse Transition
```
Expanded (256px)          Collapsed (80px)
┌──────────────┐         ┌────┐
│ 🏠 Dashboard │  ───►   │ 🏠 │
│ 💼 Jobs   (3)│         │ 💼 │
│ 🧮 Takeoffs  │         │ 🧮 │
└──────────────┘         └────┘
```

## Color Scheme

- **Primary**: Orange (#ea580c) - Active states, highlights
- **Background**: White (#ffffff)
- **Border**: Light gray (#e5e7eb)
- **Text**: Dark gray (#374151)
- **Text Hover**: Black (#000000)
- **Badge Background**: Light gray (#f3f4f6)
- **Badge Active**: Orange with white text

## Responsive Breakpoints

- **Desktop**: `lg` (1024px) and up - Sidebar always visible
- **Tablet/Mobile**: Below `lg` - Sidebar hidden, accessible via menu button

## Animation

- **Sidebar open/close**: 300ms ease-in-out
- **Hover effects**: 200ms ease
- **Active state**: Instant
- **Badge updates**: Fade in/out 150ms

## Accessibility

- **Keyboard Navigation**: Tab through items, Enter to select
- **Screen Readers**: Proper ARIA labels on all items
- **Focus Indicators**: Visible outline on keyboard focus
- **Color Contrast**: WCAG AA compliant

## Real-World Examples

### New Job Flow
```
User clicks "+ New Job" button
      ↓
Sidebar stays visible (desktop)
OR closes automatically (mobile)
      ↓
Navigates to /dashboard/new-job
      ↓
Jobs section highlighted in sidebar
```

### Navigating to Takeoffs
```
User clicks "🧮 Takeoffs"
      ↓
Orange highlight appears
      ↓
Sub-items expand:
  - New Takeoff
  - All Takeoffs
      ↓
Navigates to /dashboard/takeoff
      ↓
Badge shows count: (2)
```

### Checking Notifications
```
Badge shows: 🔔 [5]
      ↓
User clicks Notifications
      ↓
Opens notifications page
      ↓
After viewing, badge updates to [0]
```

## Component Structure

```
DashboardLayout
├── DashboardNavbar (top)
│   ├── Logo
│   ├── Notifications
│   ├── Credits
│   └── Profile
│
├── DashboardSidebar (left)
│   ├── Logo (duplicate for sidebar)
│   ├── Quick Actions
│   │   ├── New Job Button
│   │   └── New Takeoff Button
│   ├── Navigation Items
│   │   ├── Dashboard
│   │   ├── Jobs (with sub-items)
│   │   ├── Takeoffs (with sub-items)
│   │   ├── Contacts
│   │   ├── Subcontractors
│   │   ├── Notifications
│   │   ├── Settings
│   │   └── Subscription
│   ├── Stats Summary
│   └── Collapse Toggle
│
└── Main Content Area (right)
    └── Your Page Content
```

## Tips for Using

1. **Quick Actions**: Use for your most common tasks
2. **Badges**: Glance to see what needs attention
3. **Collapse**: Get more screen space when needed
4. **Mobile Menu**: Access everything on small screens
5. **Stats**: Quick overview without opening pages

## Customization Examples

Want to add a new section? Here's how it looks:

### Before
```
🏗️  Subcontractors
🔔 Notifications
⚙️  Settings
```

### After (adding "Reports")
```
🏗️  Subcontractors
📊 Reports        ← NEW
🔔 Notifications
⚙️  Settings
```

## Common Patterns

### Section with Badge
```typescript
{
  label: 'Jobs',
  href: '/dashboard/jobs',
  icon: Briefcase,
  badge: 3  // Shows [3] next to label
}
```

### Section with Sub-items
```typescript
{
  label: 'Takeoffs',
  href: '/dashboard/takeoff',
  icon: Calculator,
  subItems: [
    { label: 'New Takeoff', href: '/dashboard/takeoff/new' },
    { label: 'All Takeoffs', href: '/dashboard/takeoff' }
  ]
}
```

### Section without Extras
```typescript
{
  label: 'Contacts',
  href: '/dashboard/contacts',
  icon: Users
}
```

---

This sidebar provides a professional, intuitive navigation experience that unifies your entire dashboard! 🎨✨

