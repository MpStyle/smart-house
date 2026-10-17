# TODO

## Frontend

- [x] Document a script that updates frontend endpoints from the backend OpenAPI contract using `@rtk-query/codegen-openapi`.

## Backend
- [x] Use braces and multiline bodies for every `if`, `else`, `for`, `foreach`, `try`, and `catch`, including single-statement bodies.
- [x] Leave a blank line before every `return`.
- [x] Add a project `.editorconfig` covering these conventions, with a complementary return-spacing check.
- [x] Document all public methods in English.
- [x] Version all APIs under `/api/v1` and update the frontend.
- [x] Create and update an OpenAPI contract during builds of the entry-point project.

## General

- [x] Generate C# and TypeScript SDK libraries from the backend OpenAPI contract, with a shared regeneration command and CI drift checks.
- [x] Configure GitHub Packages publication of both SDKs through explicit `sdk-vX.Y.Z` release tags.
- [x] Write all READMEs, documentation, and code comments in English.