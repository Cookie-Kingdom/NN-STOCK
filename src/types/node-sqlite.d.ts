// ponytail: @types/node 20 predates node:sqlite (Node 22.5+). Delete this file once @types/node is bumped to 22+.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      get(...params: unknown[]): unknown;
    };
    close(): void;
  }
}
