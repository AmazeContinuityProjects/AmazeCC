---
title: "Every Script, Decoded"
---

# Every Script, Decoded

| script                              | does                                                                  | used by                         |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| `predev` / `dev`                    | codegen buildInfo + `next dev --webpack --experimental-https -p 3001` | humans                          |
| `dev:http`                          | same without HTTPS                                                    | humans on cert-hostile networks |
| `prebuild` / `build`                | buildInfo + `next build --webpack` + `prune-sw-precache`              | CI, prod                        |
| `start` / `serve`                   | static server for `out/`                                              | smoke-testing exports           |
| `pretypecheck` / `typecheck`        | buildInfo + `tsc --noEmit`                                            | humans, CI gate                 |
| `test` (`pretest`)                  | buildInfo + `vitest run`                                              | CI gate                         |
| `lint`                              | flat-config ESLint (all files)                                        | CI gate                         |
| `catalogue:build`                   | rewrites codechef-vit catalogue CSV                                   | rarely (sem updates)            |
| `scanner:dataset` / `scanner:train` | OCR corpus building + MLP training                                    | rarely                          |
| `format` / `format:check`           | Prettier write/verify                                                 | PRs                             |
| `catalogue:build`                   | see above                                                             | —                               |
| `prepare`                           | harmless husky hook for contributors                                  | —                               |
