# API Reference

This document provides a detailed reference for the core functions available in the `file_management_tool` project.

---

## `analyze_disk_usage`

Analyzes the disk usage of files within the specified paths, sorts them by size in descending order, and returns the results.

### Signature

```python
from typing import List, Optional, Tuple

def analyze_disk_usage(
    paths: List[str],
    exclude_patterns: Optional[List[str]] = None
) -> List[Tuple[str, int]]:
```
*Note: While the function signature indicates a return type of `List[Tuple[str, int]]`, the CLI wrapper serializes this into a more structured JSON format. See [CLI Output](#cli-output) below.*

### Parameters

- **`paths`** (List[str], required)
  - A list of absolute or relative paths to the directories or files to be analyzed.
  - If a path points to a file, its size is recorded directly.
  - If a path points to a directory, it will be walked recursively.

- **`exclude_patterns`** (Optional[List[str]], default: `None`)
  - A list of directory names to exclude from the analysis. This is a simple string match, not a glob or regex pattern.
  - Example: `["node_modules", ".git"]` would skip any directory with these names.

### Returns

- (`List[Tuple[str, int]]`)
  - A list of tuples, where each tuple contains:
    - `[0]` (str): The full path to the file.
    - `[1]` (int): The size of the file in bytes.
  - The list is sorted by file size in descending order.

### CLI Output (`--output-format json`)

When called from the CLI with `--output-format json`, the returned list of tuples is serialized into a JSON array of dictionaries for better clarity and extensibility:

```json
[
  {
    "path": "C:\path\to\large_file.dat",
    "size": 104857600
  },
  {
    "path": "C:\path\to\another_file.log",
    "size": 51200
  }
]
```

### Example Usage

```python
from file_management_tool.disk_analyzer import analyze_disk_usage

# Define paths to analyze
scan_paths = ["./src", "./documents"]

# Define directories to exclude
exclusions = ["__pycache__", "temp"]

# Analyze disk usage
file_list = analyze_disk_usage(paths=scan_paths, exclude_patterns=exclusions)

# Print the top 5 largest files
print("Top 5 largest files:")
for file_path, file_size in file_list[:5]:
    print(f"  - {file_path}: {file_size / 1024:.2f} KB")

```

### Error Handling

- If a path in the `paths` list does not exist, a warning will be logged, and the path will be skipped.
- If there are permission errors while accessing a file or directory, a warning will be logged, and the item will be skipped.
- The function is designed to be resilient and will continue processing other files even if some are inaccessible.

### Future Extensibility

The dictionary-based JSON output format used by the CLI wrapper is designed for future enhancements. Potential fields to be added include:

- `created_at`: File creation timestamp.
- `modified_at`: Last modification timestamp.
- `permissions`: File permissions (e.g., `"-rw-r--r--"`).
- `hash`: The calculated hash (MD5, SHA256) of the file.

These additions will not break parsing for clients that correctly access fields by key.
