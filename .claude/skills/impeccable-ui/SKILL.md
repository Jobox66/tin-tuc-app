---
name: impeccable-ui
description: Eliminates cookie-cutter template UIs (AI slop such as purple-blue gradients, default Inter font, three boring cards). Provides an in-depth design vocabulary (critique, audit, polish, bolder, quieter, typeset) and enforces high-quality UI/UX. Use when building, styling or reviewing frontend UI (React, Vue, Tailwind, CSS), critiquing or auditing a design, polishing visual details, fixing typography, spacing, contrast or accessibility, or setting up PRODUCT.md / DESIGN.md context. Triggers - UI design, frontend styling, design critique, design audit, polish, bolder, quieter, typeset, harden, anti-slop, thiết kế giao diện, làm đẹp UI, review UI, sửa giao diện.
metadata:
  title: "Impeccable UI/UX Design System (Anti-AI Slop)"
  version: "1.0.0"
  category: "ui-design"
  tags: "ui, ux, design-system, impeccable, anti-slop, tailwind, frontend, styling"
  author: "DucTN"
  based-on: "Impeccable design principles by Paul Bakaus"
---

# Impeccable UI/UX Design System (Anti-AI-Slop)

Respond in the user's language. Keep code, identifiers, commands and error messages as-is.

## 1. Core Goal
Fix **"AI Slop"** — the biggest weakness of AI models when generating UIs: AI tends to produce average, cookie-cutter interfaces lacking brand personality (default Inter font, neon purple-blue gradients, excessive rounded corners, three identical cards).

This skill forces the AI to think like a **Principal Product Designer / Design System Engineer**, following practical design principles with a distinct personality.

---

## 2. "Anti-AI-Slop" Rules (Mandatory)
- ❌ **NO stock purple-blue gradients**: Do not use `bg-gradient-to-r from-purple-500 to-indigo-600` for hero sections unless the brand explicitly requires it.
- ❌ **NO reliance on default fonts**: Choose typography that fits the problem (Geometric Sans, Modern Serif, intentional Monospace); do not default to Inter.
- ❌ **NO Card overuse**: Avoid pointless nesting (Card inside Card inside Card). Use whitespace, subtle borders (`border-border/40`), or background contrast to separate content.
- ❌ **NO gratuitously flashy buttons**: Each screen has **exactly 1 Primary Action (CTA)**. Other buttons must be Secondary (outline/ghost) so the user's attention is not scattered.
- ✅ **Contrast & Accessibility (WCAG AA/AAA)**: Ensure text-to-background contrast of at least 4.5:1.

---

## 3. Design Vocabulary

When the user gives UI adjustment commands, respond according to the intended direction:

| Command / Keyword | Meaning & Corresponding AI Action |
|---|---|
| `audit` | Scan the entire current UI for spacing, contrast, accessibility and messy typography issues. |
| `critique` | Act as a demanding Senior Designer evaluating UX weaknesses and Visual Hierarchy. |
| `polish` | Refine details: micro-spacing alignment (4px/8px grid), smooth transitions (150-200ms), subtle hover states. |
| `bolder` | Increase contrast, heavier typography, decisive lines, less bland safeness. |
| `quieter` | Reduce UI noise: smaller font sizes, softer colors, more whitespace for breathing room. |
| `typeset` | Review all font scale, line-height, letter-spacing (tracking) for the most readable, professional text. |
| `harden` | Optimize real-world states: loading skeleton, empty state, error state, long text overflow (truncation). |

---

## 4. Project Context
Before coding UI, the AI must check whether the project has these 2 context files:
1. `PRODUCT.md`: Defines target users, product personality, desired emotional response.
2. `DESIGN.md`: Color palette, spacing system, typography tokens, component primitives.

*(If missing, the AI proactively proposes creating these 2 files before coding large components).*

---

## 5. Standard Output Component Structure
When writing Frontend code (React, Vue, Tailwind, CSS):
```tsx
// 1. Clear hierarchy: consistent spacing (4/8px system)
// 2. Complete states: default, hover, active, focus-visible, disabled
// 3. Accessibility: aria-label, role, keyboard navigation
```
