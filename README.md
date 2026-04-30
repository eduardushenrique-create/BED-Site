# Forma 3D — Design System

> ⚠️ **Brand name placeholder:** No brand name was provided. Files use **"Forma"** as a working name. Replace everywhere once confirmed.

## Overview

**Forma 3D** is a Brazilian e-commerce platform selling 3D-printed gifts and personalized objects. The product catalog is centered on physical presents — decorative items, personalized keepsakes, themed figurines — manufactured via FDM/resin 3D printing. The store targets gift-givers looking for something unique, modern, and personal, as opposed to mass-market alternatives.

**Language:** Brazilian Portuguese (pt-BR)  
**Market:** B2C gift e-commerce  
**Sources:** No external codebase or Figma provided. Design system created from brand brief.

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Warm but direct.** The brand talks like a creative friend who makes things — not a corporate store.
- **You-first.** Uses "você" (you) not "nós" (we). E.g., "Escolha o presente perfeito" not "Oferecemos presentes".
- **Positive and energetic** — short, punchy sentences. Active voice.
- **No excessive enthusiasm.** Exclamation marks are rare and earned.
- **No emoji** in UI copy. Emoji may appear in user-generated reviews only.

### Casing
- **Sentence case** for headings and CTAs. "Adicionar ao carrinho", not "Adicionar Ao Carrinho".
- Product names use **Title Case**: "Porta-Retratos Geométrico".
- Labels and tags use **lowercase**: "novo", "mais vendido", "personalizado".

### Copy Examples
- Hero: "Presentes feitos para durar."
- Product CTA: "Adicionar ao carrinho"
- Empty state: "Nenhum produto encontrado. Tente outro filtro."
- Success: "Pedido confirmado. Você receberá um e-mail em breve."
- Error: "Algo deu errado. Tente novamente."

### Numerics & Prices
- Brazilian Real: **R$ 89,90** (space between R$ and amount; comma decimal)
- Dates: **27 de abril de 2026** (long form) / **27/04/2026** (short)

---

## VISUAL FOUNDATIONS

### Colors
- **Primary:** Warm terracotta `#C8552A` — bold, handcrafted feel, anchors CTAs and highlights.
- **Background:** Off-white `#F5F2EE` — warm, not clinical; gives a material/paper feel.
- **Surface:** White `#FFFFFF` — cards, modals, inputs.
- **Dark:** Near-black `#1C1917` — headlines, primary text.
- **Neutral mid:** `#78716C` — secondary text, labels, borders.
- **Neutral light:** `#E8E2DA` — dividers, inactive states.
- **Accent teal:** `#1D7A72` — secondary accent for badges, success states, highlights.

### Typography
- **Display:** "Outfit" (Google Fonts) — geometric, modern, high contrast at large sizes.
- **Body:** "DM Sans" (Google Fonts) — humanist grotesque; warm but clean, great at small sizes.
- **Mono:** "DM Mono" (Google Fonts) — used for prices, SKUs, order numbers.
- Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / 80px — 1.25 ratio.
- Line height: 1.5 for body, 1.15 for display.

### Spacing
- Base unit: **4px**. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px.
- Component padding: 12px / 16px / 24px (small/medium/large).
- Page max-width: **1280px**, with 24px gutters on mobile.

### Backgrounds & Surfaces
- **Off-white page background** (#F5F2EE) — never pure white for the full page.
- Cards use **white** with a subtle warm shadow (no colored left borders).
- No gradients on backgrounds. Gradients only in product photography overlays (bottom-to-transparent).
- Occasional full-bleed hero sections in dark (#1C1917) with white text.

### Animation
- **Subtle and fast.** Transitions: 150ms ease-out for state changes; 250ms for modals/drawers.
- **Hover states:** Slight color shift on buttons (darken 10%), gentle scale(1.02) on product cards.
- **Press states:** scale(0.97) on buttons. No color-only press states.
- No bounce. No spring physics. Easing: ease-out for enter; ease-in for exit.

### Borders & Radius
- Corner radius: **8px** standard, **12px** for product cards, **999px** for pills/badges, **4px** for inputs.
- Borders: 1px solid `#E8E2DA` on inputs and dividers. No decorative borders on cards (use shadow instead).

### Shadows
- **Card:** `0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)`
- **Elevated (drawer/modal):** `0 8px 40px rgba(0,0,0,0.14)`
- **Button (primary on hover):** none (color shift only)
- No colored or neon shadows.

### Iconography (see ICONOGRAPHY section below)
- Lucide Icons CDN — thin stroke (1.5px), 24px default, 20px in compact UI.

### Imagery
- **Warm, natural light.** Product photos on neutral or white backgrounds.
- No filters. No oversaturation. Grain is acceptable.
- Aspect ratio: **4:3** for product thumbnails, **16:9** for hero images.

---

## ICONOGRAPHY

- **Icon system:** [Lucide Icons](https://lucide.dev) via CDN (`https://unpkg.com/lucide@latest`).
- Style: outlined, 1.5px stroke weight, rounded caps/joins.
- Default size: 24×24px; compact (nav, badges): 20×20px.
- Color: inherits text color; never a separate icon color unless conveying semantic meaning (red for error, teal for success).
- No emoji used as icons anywhere in product UI.
- No PNG icon files at this time. All icons are inline SVG via Lucide.
- Logo: see `assets/logo.svg` — wordmark + cube mark combination.

---

## FILE INDEX

```
README.md                  ← This file
SKILL.md                   ← Agent skill definition
colors_and_type.css        ← CSS custom properties (colors + typography)
assets/
  logo.svg                 ← Primary logo (wordmark + mark)
  logo-mark.svg            ← Icon-only mark
  logo-white.svg           ← Reversed logo for dark backgrounds
preview/
  colors-brand.html        ← Brand color swatches
  colors-neutral.html      ← Neutral scale swatches
  colors-semantic.html     ← Semantic color tokens
  type-scale.html          ← Type scale specimen
  type-specimens.html      ← Heading + body specimens
  spacing-tokens.html      ← Spacing & radius tokens
  shadows.html             ← Shadow system
  buttons.html             ← Button states
  inputs.html              ← Form input states
  cards.html               ← Product card variants
  badges.html              ← Badges & tags
ui_kits/
  website/
    README.md              ← Website kit notes
    index.html             ← Interactive storefront prototype
    Header.jsx             ← Navigation header
    ProductCard.jsx        ← Product card component
    CartDrawer.jsx         ← Slide-out cart
    ProductDetail.jsx      ← PDP layout
    Footer.jsx             ← Footer component
```
