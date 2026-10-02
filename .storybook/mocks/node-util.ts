// Stand-in for node:util in the browser. The story fixtures only strip a payload
// (`stripForManager`); the save path that compares entries never runs in Storybook.
// ponytail: compares the JSON text, so key order counts; use a real deep-equal if a
// story ever saves as the Account Manager through manager-scope.ts.
export const isDeepStrictEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
