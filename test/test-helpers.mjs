export const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

export const memoryStore = (tokens) => ({
  load: async () => tokens,
  save: async (nextTokens) => { tokens = nextTokens; },
  get tokens() { return tokens; },
});
