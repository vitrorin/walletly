# Card Management UI — Design Spec

**Date:** 2026-05-26
**Scope:** Add and delete cards from the HomeScreen card carousel in Walletly.

---

## Problem

Cards must currently be added directly from the Firestore console. There is no in-app UI to create or remove cards.

---

## Decisions

| Question | Choice | Rationale |
|---|---|---|
| Add card container | Bottom sheet (slide-up Modal) | Native feel on mobile, works on web without extra libraries |
| Color selection | Preset palette of 8 colors | Zero dependencies, visually consistent with dark theme |
| Delete interaction | Long press → Alert.alert confirmation | No extra gesture library needed, cross-platform |

---

## New Component: `src/components/CardSheet.tsx`

A React Native `Modal` with a slide-up animation driven by `Animated.Value`. Opens only in **add** mode (tapping `+`). Editing is out of scope.

### Form fields

| Field | Input type | Validation |
|---|---|---|
| Nombre | TextInput | Required, non-empty |
| Banco | TextInput | Required, non-empty |
| Últimos 4 dígitos | TextInput (numeric, maxLength 4) | Exactly 4 digits |
| Tipo | Toggle button (crédito / débito) | Required, defaults to crédito |
| Color | 8 color swatches | Required, defaults to `#6c63ff` |

**Preset colors:** `#6c63ff`, `#e91e8c`, `#00b4d8`, `#06d6a0`, `#f77f00`, `#ef233c`, `#3a86ff`, `#8338ec`

### Behavior

- **Open:** `+` card in carousel calls `setSheetOpen(true)` in HomeScreen.
- **Save:** Calls `addDoc(collection(db, 'users', uid, 'cards'), { name, bank, lastFour, type, color })` — Firestore generates the ID. Closes sheet and resets form on success.
- **Cancel / backdrop tap:** Closes sheet, resets all fields.
- **Validation error:** Inline error message below the offending field; does not close sheet.

### Animation

`Animated.Value` starts at `300` (off-screen below), animates to `0` on open with `Animated.spring`. On close, reverse spring before setting `Modal` visible to `false`.

---

## Changes to `src/screens/HomeScreen.tsx`

### Add card wiring
- State: `const [sheetOpen, setSheetOpen] = useState(false)`
- The existing `<View style={styles.addCard}>` becomes `<TouchableOpacity onPress={() => setSheetOpen(true)}>`
- Render `<CardSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />`

### Delete card wiring
- Each card `<View>` in the carousel becomes `<TouchableOpacity onLongPress={() => handleDeleteCard(card)}`
- `handleDeleteCard(card)` calls:
  ```
  Alert.alert(
    card.name,
    '¿Eliminar esta tarjeta?',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteDoc(...) }
    ]
  )
  ```
- `deleteDoc(doc(db, 'users', uid, 'cards', card.id))` — direct Firestore call, no new hook needed.

---

## Out of scope

- Editing an existing card's fields (name, bank, color)
- Reordering cards
- Associating a card with existing transactions retroactively

---

## Files changed

| File | Change |
|---|---|
| `src/components/CardSheet.tsx` | New |
| `src/screens/HomeScreen.tsx` | Wire `+` button, add long-press delete |

No changes to hooks, navigation, Firestore schema, or Cloud Functions.
