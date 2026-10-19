/**
 * What an account form's Server Action returns (useActionState): a message
 * for the whole form, one message per invalid field, and the values to put
 * back in the fields (never passwords).
 */
export interface FormState<Field extends string = string> {
  status?: "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  values?: Partial<Record<Field, string>>;
}

/** A FormData entry as a string ("" when missing or a file). */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
