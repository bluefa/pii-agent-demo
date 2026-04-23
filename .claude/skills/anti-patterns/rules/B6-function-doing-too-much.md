# B6. A function doing get + validate + save

Severity: 🟡 important

Split each concern into pure functions. `handleSave` calling `validate()` then `onSave()` is fine only once `validate` is extracted and independently testable.

Related: **C1** (scattered form state) — both often drive the same refactor into a reducer + pure validators.
