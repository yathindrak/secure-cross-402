export async function summarize(input: any) {
  // Dummy summarization: return first 200 chars or simple echo
  const text = input?.text || '';
  const summary = text.length > 200 ? text.slice(0, 200) + '...' : text;
  return { summary, length: text.length };
}
