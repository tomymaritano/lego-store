export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** Lower-cased, accent-free form of one character ("Á" -> "a"); may be empty for lone combining marks. */
function fold(char: string) {
  return char.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Splits `text` into matched / unmatched segments for every word of `query`,
 * ignoring case and accents ("estrella" matches "Estrélla"). Segments keep the
 * original characters, so the result renders the text unchanged.
 */
export function highlightMatches(text: string, query: string): HighlightSegment[] {
  const terms = [...new Set(query.split(/\s+/).map((term) => [...term].map(fold).join("")).filter(Boolean))];
  if (!text || terms.length === 0) return text ? [{ text, match: false }] : [];

  // Folded text plus, for each folded char, the index of the original char it came from.
  const chars = [...text];
  let folded = "";
  const origin: number[] = [];
  chars.forEach((char, index) => {
    for (const f of fold(char)) {
      folded += f;
      origin.push(index);
    }
  });

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const term of terms) {
    let from = folded.indexOf(term);
    while (from !== -1) {
      for (let i = from; i < from + term.length; i++) marked[origin[i]] = true;
      from = folded.indexOf(term, from + term.length);
    }
  }

  const segments: HighlightSegment[] = [];
  chars.forEach((char, index) => {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[index]) last.text += char;
    else segments.push({ text: char, match: marked[index] });
  });
  return segments;
}
