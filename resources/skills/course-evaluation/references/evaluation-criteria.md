# Evaluation Criteria Reference

This document provides detailed guidance for the course-evaluation skill on how to assess each type of criterion, how to write effective feedback, and the exact JSON output format the app expects.

---

## Criterion Types

### 1. File Existence

**Pattern:** `"File <filename> exists in the scratch directory"`

**How to assess:**
- A file exists if its contents were provided in the evaluation prompt. The app includes all relevant scratch files inline.
- A file does not exist if it is referenced in a criterion but no contents were provided for it in the prompt.
- File paths are relative to the learner's scratch directory. Match on the file name regardless of leading path components unless the criterion specifies a subdirectory.

**Examples:**

| Criterion | Assessment |
|---|---|
| `"File config.ts exists in the scratch directory"` | Satisfied if `config.ts` contents appear in the prompt. |
| `"File output/result.json exists"` | Satisfied if `output/result.json` contents appear in the prompt. |
| `"A file named server.go is present"` | Satisfied if any file named `server.go` was provided. |

---

### 2. Function Definition

**Pattern:** `"Function <name> is defined in <file>"` or `"Function <name> is exported from <file>"`

**How to assess:**
- Search the file contents for a function declaration matching the name.
- For export checks: look for `export function <name>`, `export const <name> =`, `export default function <name>`, `module.exports.<name>`, `func <Name>` (Go), `pub fn <name>` (Rust), `def <name>` (Python), etc. depending on the language.
- If a specific signature is required (parameter types, return type), verify it matches.
- Do not require exact formatting — look for semantic equivalence.

**Common language patterns:**

```typescript
// TypeScript / JavaScript
export function parseConfig(filePath: string): Config { ... }
export const parseConfig = (filePath: string): Config => { ... }
```

```go
// Go — exported if name starts with uppercase
func ParseConfig(filePath string) (Config, error) { ... }
```

```rust
// Rust
pub fn parse_config(file_path: &str) -> Config { ... }
```

```python
# Python — no export keyword; check for def at module level
def parse_config(file_path: str) -> Config: ...
```

---

### 3. Output Correctness

**Pattern:** `"<function>(<args>) returns <expected>"` or `"Running <command> produces output containing <text>"`

**How to assess:**
- Trace the function logic statically. Determine what the function would return given the specified input.
- For return-value checks: determine if the return type and structure match the expectation (e.g., "an object with a 'name' field of type string").
- For output checks: look for provided terminal output excerpts in the prompt. If no output was provided, the criterion cannot be verified — mark as not satisfied and note the ambiguity.
- Do not run the code. Base your assessment on reading the implementation.

**Examples:**

| Criterion | How to assess |
|---|---|
| `"parseConfig('config.json') returns an object with a 'name' field"` | Read `parseConfig`. Does it parse JSON and return an object? Does the type include a `name` field? |
| `"Running npm test produces no errors"` | Look for provided test output. If absent, mark not satisfied. |
| `"The output file contains valid JSON"` | If the output file is provided, attempt to parse it mentally. |

---

### 4. Command Execution Result

**Pattern:** `"Running <command> succeeds"` or `"<command> exits with code 0"` or `"Output contains <text>"`

**How to assess:**
- The app may provide terminal output snippets in the prompt. Check these against the expected result.
- If the criterion requires a command to succeed but no output was provided, mark as not satisfied and note that the command output was not included.
- Check for error messages, stack traces, or "FAIL" indicators in provided output.
- Do not assume success from the absence of output.

---

## Feedback Tone Guidelines

### Core Principles

**Constructive:** Assume the learner is capable and trying. Frame problems as fixable gaps, not failures.

**Specific:** Reference the actual file names, function names, or output from the learner's work. Do not give generic feedback that could apply to any submission.

**Actionable:** Every piece of negative feedback must include a concrete suggestion for how to fix the problem.

### Do and Do Not

| Do | Do Not |
|---|---|
| "Your `parseConfig` function is present but not exported — add `export` before `function`." | "You forgot to export the function." |
| "The function returns a string, but the criterion requires an object with a `name` field." | "The return type is wrong." |
| "Consider using `fs.readFileSync` instead of `fetch` for synchronous file reads." | "Your approach is incorrect." |
| "All criteria are met. Well-implemented — the type assertion on line 3 is a clean approach." | "Great job!" (without specifics) |
| "The file `config.ts` was not provided, so we cannot verify file existence." | Silently marking it as failed |

### Feedback Structure for `pass: false`

1. Acknowledge what was done correctly (even partially — do not lead with failure).
2. State what is missing or incorrect, referencing specific files/functions/output.
3. Give a direct fix: what exactly should the learner change or add.

**Example (pass: false):**
> "Your `config.ts` file is correctly structured and the `parseConfig` function is defined. However, the function is not exported, which means other modules cannot import it — add `export` before the `function` keyword to fix this. Additionally, the function currently returns `any` rather than a typed `Config` object; declaring a `Config` interface and using a type assertion will satisfy the return type criterion."

### Feedback Structure for `pass: true`

1. Confirm the work is complete.
2. Note one specific thing done well.
3. Optionally suggest a natural extension or improvement (not required for passing).

**Example (pass: true):**
> "All criteria are satisfied. Your `parseConfig` function is correctly exported, reads the config file synchronously, and returns a typed object with the required `name` field. If you'd like to go further, consider adding validation to throw a descriptive error when required fields are missing."

---

## Output Format

The evaluation result must be output as a fenced JSON code block at the end of your response:

````
```json
{
  "pass": true,
  "feedback": "Your implementation is complete and all criteria are satisfied. The parseConfig function is correctly exported from config.ts, reads the file using fs.readFileSync, and returns an object containing the name field as required."
}
```
````

### Schema

```typescript
type EvaluationResult = {
  pass: boolean;     // true iff ALL criteria are satisfied
  feedback: string;  // 3-5 sentence natural-language feedback
};
```

### Validation Rules

- `pass` must be a JSON boolean (`true` or `false`), not a string.
- `feedback` must be a JSON string. Single-line preferred. Use `\n` only if the text is long enough to warrant it.
- No additional fields are permitted. The app reads only `pass` and `feedback`.
- The JSON must be syntactically valid (no trailing commas, no single quotes, no comments).
- The code block must use the ` ```json ` language tag exactly.

### Placement

The JSON code block must appear **at the very end** of your response, after any step-by-step reasoning. The app extracts the last ` ```json ... ``` ` block from the agent output.
