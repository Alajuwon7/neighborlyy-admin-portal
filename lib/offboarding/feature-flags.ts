// Single source of truth for offboarding capability gates. Phase 5 enables
// transfer by flipping CAN_USE_TRANSFER. The disposition card MUST consult
// this flag rather than implementing parallel code paths — see the spec at
// docs/superpowers/specs/2026-05-09-offboarding-phase-3-design.md
// (forward-compatibility constraint #1).
export const CAN_USE_TRANSFER = false;
