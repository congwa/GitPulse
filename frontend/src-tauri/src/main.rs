// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;
use serde::Serialize;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            run_git_log,
            check_git_repo,
            get_head_hash,
            deep_execute,
            deep_read_file,
            deep_ls,
            deep_grep,
            deep_glob,
        ])
        .setup(|app| {
            // 在 debug 模式下自动打开 DevTools
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 检查目录是否是有效的 Git 仓库
#[tauri::command]
fn check_git_repo(path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    Ok(output.status.success())
}

/// 执行 git log 并返回原始输出
/// format 和 extra_args 由前端控制
#[tauri::command]
fn run_git_log(path: String, format: String, extra_args: Vec<String>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("log")
        .arg(&format)
        .arg("--numstat")
        .current_dir(&path);

    for arg in &extra_args {
        cmd.arg(arg);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git log failed: {}", stderr));
    }

    String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in git output: {}", e))
}

/// 获取仓库最新 commit 的 hash
#[tauri::command]
fn get_head_hash(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to execute git rev-parse: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git rev-parse failed: {}", stderr));
    }

    String::from_utf8(output.stdout)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("Invalid UTF-8 in git output: {}", e))
}

// ============================================
// DeepAgent 后端命令
// ============================================

/// 安全路径解析：确保 file_path 不会逃逸出 repo_path
fn resolve_safe_path(repo_path: &str, file_path: &str) -> Result<PathBuf, String> {
    let base = Path::new(repo_path).canonicalize()
        .map_err(|e| format!("Invalid repo path: {}", e))?;
    let target = base.join(file_path).canonicalize()
        .map_err(|e| format!("Invalid file path '{}': {}", file_path, e))?;

    if !target.starts_with(&base) {
        return Err(format!("Path traversal denied: {}", file_path));
    }
    Ok(target)
}

/// 命令白名单校验 — 只允许安全的只读命令
fn validate_command(command: &str) -> Result<(), String> {
    let trimmed = command.trim();
    let allowed_prefixes = [
        "git ", "git\t",
        "rg ", "rg\t",
        "grep ", "grep\t",
        "find ", "find\t",
        "wc ", "wc\t",
        "head ", "head\t",
        "tail ", "tail\t",
        "cat ", "cat\t",
        "ls ", "ls\t",
        "stat ", "stat\t",
        "file ", "file\t",
        "sort ", "sort\t",
        "uniq ", "uniq\t",
        "awk ", "awk\t",
        "sed ", "sed\t",
        "echo ", "echo\t",
    ];

    // 检查是否以允许的命令开头
    let is_allowed = allowed_prefixes.iter().any(|p| trimmed.starts_with(p))
        || trimmed == "git" || trimmed == "ls" || trimmed == "pwd";

    if !is_allowed {
        return Err(format!("Command not allowed: {}", trimmed.chars().take(50).collect::<String>()));
    }

    // 禁止危险操作
    let forbidden = ["rm ", "rm\t", "rmdir", "mv ", "cp ", "> ", ">> ", "| rm", "; rm",
                     "git push", "git reset --hard", "git checkout", "git clean",
                     "git stash drop", "chmod", "chown", "sudo"];
    for f in &forbidden {
        if trimmed.contains(f) {
            return Err(format!("Forbidden operation in command: {}", f.trim()));
        }
    }

    Ok(())
}

#[derive(Serialize)]
pub struct ExecuteResponse {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// 在仓库目录下执行命令（带白名单校验）
#[tauri::command]
fn deep_execute(repo_path: String, command: String) -> Result<ExecuteResponse, String> {
    validate_command(&command)?;

    let output = Command::new("bash")
        .args(["-c", &command])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(ExecuteResponse {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// 读取仓库中的文件（支持行级分页）
#[tauri::command]
fn deep_read_file(
    repo_path: String,
    file_path: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<String, String> {
    let full_path = resolve_safe_path(&repo_path, &file_path)?;

    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read '{}': {}", file_path, e))?;

    // 行级分页
    match (offset, limit) {
        (Some(off), Some(lim)) => {
            let lines: Vec<&str> = content.lines().collect();
            let start = off.min(lines.len());
            let end = (start + lim).min(lines.len());
            let numbered: Vec<String> = lines[start..end]
                .iter()
                .enumerate()
                .map(|(i, line)| format!("{:>6}|{}", start + i + 1, line))
                .collect();
            Ok(numbered.join("\n"))
        }
        (Some(off), None) => {
            let lines: Vec<&str> = content.lines().collect();
            let start = off.min(lines.len());
            let numbered: Vec<String> = lines[start..]
                .iter()
                .enumerate()
                .map(|(i, line)| format!("{:>6}|{}", start + i + 1, line))
                .collect();
            Ok(numbered.join("\n"))
        }
        (None, Some(lim)) => {
            let lines: Vec<&str> = content.lines().collect();
            let end = lim.min(lines.len());
            let numbered: Vec<String> = lines[..end]
                .iter()
                .enumerate()
                .map(|(i, line)| format!("{:>6}|{}", i + 1, line))
                .collect();
            Ok(numbered.join("\n"))
        }
        (None, None) => Ok(content),
    }
}

#[derive(Serialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

/// 列出仓库中某目录的文件
#[tauri::command]
fn deep_ls(repo_path: String, path: String) -> Result<Vec<FileInfo>, String> {
    let full_path = resolve_safe_path(&repo_path, &path)?;

    if !full_path.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(&full_path)
        .map_err(|e| format!("Failed to read dir '{}': {}", path, e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Read dir error: {}", e))?;
        let meta = entry.metadata().map_err(|e| format!("Metadata error: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件和 node_modules
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let rel_path = Path::new(&path).join(&name).to_string_lossy().to_string();
        entries.push(FileInfo {
            name,
            path: rel_path,
            is_dir: meta.is_dir(),
            size: meta.len(),
        });
    }

    // 目录在前，文件在后，按名称排序
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });

    Ok(entries)
}

#[derive(Serialize)]
pub struct GrepMatch {
    pub file: String,
    pub line_number: u32,
    pub content: String,
}

/// 在仓库中搜索文本（优先使用 ripgrep，降级到 grep）
#[tauri::command]
fn deep_grep(
    repo_path: String,
    pattern: String,
    path: String,
    glob: Option<String>,
) -> Result<Vec<GrepMatch>, String> {
    let full_path = resolve_safe_path(&repo_path, &path)?;

    // 尝试使用 ripgrep
    let mut cmd = Command::new("rg");
    cmd.args(["--no-heading", "--line-number", "--max-count", "50", "--max-filesize", "1M"])
        .arg("--fixed-strings") // 字面搜索
        .arg(&pattern);

    if let Some(ref g) = glob {
        cmd.args(["--glob", g]);
    }

    cmd.arg(full_path.to_string_lossy().to_string());

    let output = cmd.output();

    let output = match output {
        Ok(o) => o,
        Err(_) => {
            // ripgrep 不可用，降级到 grep
            let mut fallback = Command::new("grep");
            fallback.args(["-rHnF", &pattern])
                .arg(full_path.to_string_lossy().to_string());
            fallback.output()
                .map_err(|e| format!("Neither rg nor grep available: {}", e))?
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let base = Path::new(&repo_path).canonicalize().unwrap_or_else(|_| PathBuf::from(&repo_path));

    let matches: Vec<GrepMatch> = stdout
        .lines()
        .filter_map(|line| {
            // 格式: file:line:content
            let mut parts = line.splitn(3, ':');
            let file = parts.next()?;
            let line_num: u32 = parts.next()?.parse().ok()?;
            let content = parts.next().unwrap_or("").to_string();

            // 转为相对路径
            let abs_file = Path::new(file).canonicalize().unwrap_or_else(|_| PathBuf::from(file));
            let rel = abs_file.strip_prefix(&base)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| file.to_string());

            Some(GrepMatch { file: rel, line_number: line_num, content })
        })
        .collect();

    Ok(matches)
}

/// glob 搜索仓库文件
#[tauri::command]
fn deep_glob(repo_path: String, pattern: String, path: String) -> Result<Vec<FileInfo>, String> {
    let search_path = resolve_safe_path(&repo_path, &path)?;

    // 使用 find + grep 模拟 glob
    let output = Command::new("find")
        .arg(search_path.to_string_lossy().to_string())
        .args(["-type", "f", "-name", &pattern])
        .args(["-not", "-path", "*/node_modules/*"])
        .args(["-not", "-path", "*/.git/*"])
        .args(["-not", "-path", "*/target/*"])
        .arg("-maxdepth")
        .arg("10")
        .output()
        .map_err(|e| format!("find failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let base = Path::new(&repo_path).canonicalize().unwrap_or_else(|_| PathBuf::from(&repo_path));

    let entries: Vec<FileInfo> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let abs = Path::new(line).canonicalize().ok()?;
            let rel = abs.strip_prefix(&base).ok()?.to_string_lossy().to_string();
            let meta = std::fs::metadata(line).ok()?;
            let name = abs.file_name()?.to_string_lossy().to_string();
            Some(FileInfo {
                name,
                path: rel,
                is_dir: false,
                size: meta.len(),
            })
        })
        .collect();

    Ok(entries)
}
