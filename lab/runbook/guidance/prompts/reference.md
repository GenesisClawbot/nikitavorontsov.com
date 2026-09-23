The attached PNG is a rough visual reference for revising this Runbook dashboard. Use its composition as direction, not a pixel-perfect specification: a compact masthead, a readable run list, a clearly paired selected-run detail, and an explicit mobile stack. The live React source and tests remain the functional contract, including all exact synthetic content and controls.

Small token sheet for this route only:
- Paper #F7F4ED, ink #182A33, raised surface #FFFFFF, rule #D6D5CD.
- Status emphasis: teal #1B6D69 for success/selection; rust #B55B36 for attention; red #B5483D for failure.
- Display headings: Georgia or a local serif; interface: a local sans; numerical metadata: a local monospace.
- Spacing: 8px base; 16px controls; 24px panel padding; 40px page sections. Use comfortable mobile tap targets.

Read src/App.jsx, src/styles.css, and tests/App.test.jsx before editing. Preserve the behavior and copy; do not add packages or remote resources. Run tests and build. In the final note, say what you took from the reference and what you intentionally adapted.
