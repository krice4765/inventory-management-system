# Migration Guide: v0.2.x to v0.3.0

This guide provides detailed instructions for migrating from `file-management-tool` v0.2.x to v0.3.0. This version includes a critical breaking change to the JSON output format of the `disk_usage` command.

## 1. Overview of Changes

The primary change in v0.3.0 is the JSON output format for the `disk_usage` command. It has been updated from an array of tuples to a more descriptive array of dictionaries.

### Key Benefits

- **Improved Readability**: The new format is self-documenting, with clear keys like `"path"` and `"size"`.
- **Enhanced Extensibility**: It allows for the addition of new metadata (e.g., `created_at`, `permissions`) in the future without further breaking changes.
- **Simplified Parsing**: Accessing data by key (`item['size']`) is more robust and less error-prone than accessing by index (`item[1]`).

---

## 2. Before and After: Code Comparison

The following example illustrates the necessary code modifications for a Python script that parses the JSON output.

### 以前のコード (v0.2.x)

This code works with the old tuple-based format.

```python
import json
import subprocess

def get_large_files_old(directory):
    # This function is now deprecated
    command = [
        "python", "file_manager_cli.py",
        "disk_usage",
        "--path", directory,
        "--output-format", "json"
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    
    large_files = []
    for item in data:
        # Accessing data by index
        file_path = item[0]
        file_size = item[1]
        if file_size > 1024 * 1024: # 1MB
            large_files.append(file_path)
    return large_files

# Example usage:
# large_files = get_large_files_old("/path/to/scan")
# print(large_files)
```

### 新しいコード (v0.3.0)

This code is updated to work with the new dictionary-based format.

```python
import json
import subprocess

def get_large_files_new(directory):
    # Recommended implementation for v0.3.0
    command = [
        "python", "file_manager_cli.py",
        "disk_usage",
        "--path", directory,
        "--output-format", "json"
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8')
    data = json.loads(result.stdout)
    
    large_files = []
    for item in data:
        # Accessing data by key is more robust
        file_path = item['path']
        file_size = item['size']
        if file_size > 1024 * 1024: # 1MB
            large_files.append(file_path)
    return large_files

# Example usage:
# large_files = get_large_files_new("/path/to/scan")
# print(large_files)
```

---

## 3. Step-by-Step Migration Plan

Follow these steps to ensure a smooth transition to v0.3.0.

### Step 1: Identify Affected Code

Search your codebase for any scripts or applications that execute `file_management_tool disk_usage` and parse its JSON output.

### Step 2: Update Parsing Logic

Modify the parsing logic to use dictionary keys (`item['path']`, `item['size']`) instead of array indices (`item[0]`, `item[1]`).

### Step 3: Test the Changes

Run your updated scripts against the output of v0.3.0. We strongly recommend using the `--output-file` option to avoid character encoding issues, especially on Windows.

```bash
# Generate a test output file with guaranteed UTF-8 encoding
python file_manager_cli.py disk_usage --path . --output-format json --output-file test_output.json

# Run your test script against the generated file
python your_updated_script.py test_output.json
```

---

## 4. Common Migration Patterns

- **Simple Python Scripts**: The change is typically a one-line modification from `item[0]` to `item['path']` and `item[1]` to `item['size']`.
- **Shell Scripts (using `jq`)**: Update your `jq` filters.
  - **Old**: `jq -c '.[] | .[0]'`
  - **New**: `jq -r '.[] | .path'`
- **Automated Dashboards**: If you are feeding this data into a monitoring or dashboard system, update the data mapping configuration to use the new keys.

---

## 5. Troubleshooting and Rollback

### Troubleshooting

- **`KeyError: 'path'` or `KeyError: 'size'`**: This error indicates that the input data is still in the old tuple format. Ensure you are running against v0.3.0 of the tool.
- **`IndexError: list index out of range`**: This likely means your updated script is trying to parse old, tuple-formatted data. Verify the version of the tool that generated the data.
- **JSONDecodeError on Windows**: If you are using shell redirection (`>`) on Windows, the output file may be encoded in `CP932`. **Use the `--output-file` option instead** to get a clean, UTF-8 encoded JSON file.

### Rollback Procedure

If you encounter critical issues, you can temporarily revert to a previous version of the tool:

```bash
# Check out the last commit of the previous version
git checkout <commit_hash_of_v0.2.x>
```

However, we strongly recommend completing the migration to benefit from the improved stability and features of v0.3.0.

---

## ✅ Migration Completion Checklist

- [ ] All scripts parsing the `disk_usage` JSON output have been identified.
- [ ] Parsing logic has been updated from index-based to key-based access.
- [ ] Updated scripts have been tested against the output of v0.3.0.
- [ ] Shell scripts using tools like `jq` have been updated.
- [ ] (If applicable) Automated systems and dashboards have been reconfigured.
- [ ] You are using `--output-file` in automated workflows to prevent encoding issues.
