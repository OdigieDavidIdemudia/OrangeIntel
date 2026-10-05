# Project structure

This repository is organized to support maintainability and future growth.

## Suggested layout
```text
.
├── README.md
├── LICENSE
├── .gitignore
├── appsettings.json.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   └── CONTRIBUTING.md
├── src/
├── tests/
├── assets/
├── config/
└── scripts/
```

## Notes
- Keep business logic in `src/`.
- Keep environment-specific values in local config files.
- Keep docs in `docs/` so the project remains easy to navigate.
