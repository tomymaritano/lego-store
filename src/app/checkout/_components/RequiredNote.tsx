/** "* Campos obligatorios" next to a form's submit button. */
export function RequiredNote() {
  return (
    <p className="text-caption text-fg-muted">
      <span aria-hidden="true" className="text-danger">
        *
      </span>{" "}
      Campos obligatorios
    </p>
  );
}
