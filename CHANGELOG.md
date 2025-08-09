# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-08-09

This release introduces a significant improvement in API design and establishes a robust quality assurance foundation. It includes a **breaking change** to the JSON output format for better extensibility and easier parsing.

### ⚠️ BREAKING CHANGES

- **JSON Output Format Changed**: The `disk_usage` command's JSON output has been changed from an array of tuples `[["path", size]]` to an array of dictionaries `[{"path": "...", "size": ...}]`. This enhances API clarity and allows for future additions of metadata fields without further breaking changes. Scripts parsing the old format must be updated.

### Added

- **End-to-End Testing Suite**: A comprehensive E2E test suite has been established, ensuring the reliability of all major commands (`duplicate remove`, `duplicate move`, `disk_usage`).
- **Guaranteed UTF-8 Output**: The `--output-file` option was added to all relevant commands, ensuring file outputs are always encoded in UTF-8, resolving potential character encoding issues on Windows.
- **Separated Output Streams**: Program output (data) is now sent to `stdout`, while human-readable logs (INFO level and above) are sent to `stderr`. This facilitates seamless integration with command-line tools like `jq`.
- **Production-Ready Logging**: Implemented a production-ready logging configuration.

### Changed

- **Improved API Extensibility**: The new dictionary-based JSON format for `disk_usage` makes the API more extensible for future features (e.g., adding timestamps, permissions).
- **Optimized Logging Level**: Default logging level is now set to `INFO` for cleaner output in production environments.
- **Removed Debug Code**: All debugging artifacts and temporary code have been removed from the production codebase.

### Fixed

- **Corrected Argument Parsing**: Fixed a bug where the `disk_usage` command incorrectly handled the `--path` argument.
- **JSON Output Structure**: The `disk_usage` command now correctly generates a structured and valid JSON, which was previously failing in some E2E tests.
- **E2E Test Reliability**: Updated and fixed E2E tests to align with the new JSON output structure, ensuring the test suite is accurate and reliable.
