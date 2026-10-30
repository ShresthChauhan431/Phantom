# Rive Assets for PHANTOM

Place the production Rive state machine file here:
`phantom-status.riv`

### Expected State Machine & Inputs
- **State Machine Name**: `PhantomStatusMachine` (or default state machine)
- **Supported States / Triggers / Inputs**:
  - `idle`
  - `scanning`
  - `analyzing`
  - `change_found`
  - `confirmed`

When `phantom-status.riv` is present, the website's `RivePhantomIndicator` component will automatically load and animate the Rive canvas. If absent, it gracefully falls back to the clean, minimal static indicator without throwing errors or interrupting execution.
