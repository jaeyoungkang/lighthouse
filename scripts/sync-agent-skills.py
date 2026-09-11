#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import stat
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MARKER_NAME = ".skill-sync-generated"
IGNORE_PATTERNS = shutil.ignore_patterns(".DS_Store", "__pycache__", ".git")
RESERVED_ARCHIVE_PARTS = {".git", "__pycache__"}
PACKAGED_SKILL_IDENTITIES = {
    "architecture-fitness-review": {
        "sourceRepository": "https://github.com/jaeyoung2026/architecture-fitness.git",
        "artifactPath": "skills/architecture-fitness-review",
    }
}


@dataclass(frozen=True)
class SkillSource:
    directory: Path
    marker_source: Path

    @property
    def name(self) -> str:
        return self.directory.name


def build_parser() -> argparse.ArgumentParser:
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(
        description="Sync shared Agent Skills into Claude and Codex runtime directories."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=repo_root / "shared-skills",
        help="Canonical shared skill directory.",
    )
    parser.add_argument(
        "--claude-dir",
        type=Path,
        default=repo_root / ".claude" / "skills",
        help="Claude Code project skill directory.",
    )
    parser.add_argument(
        "--codex-dir",
        type=Path,
        default=repo_root / ".agents" / "skills",
        help="Codex project skill directory.",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Remove previously generated skills that no longer exist in the source directory.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check that generated skill directories match the source without writing changes.",
    )
    return parser


def extract_skill_name(skill_dir: Path) -> str:
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        raise ValueError(f"Missing SKILL.md in {skill_dir}")

    lines = skill_file.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"{skill_file} must start with YAML frontmatter")

    for line in lines[1:]:
        stripped = line.strip()
        if stripped == "---":
            break
        if stripped.startswith("name:"):
            return stripped.split(":", 1)[1].strip()

    raise ValueError(f"Could not find frontmatter name in {skill_file}")


def discover_directory_skills(source_root: Path) -> list[Path]:
    if not source_root.exists():
        return []

    return sorted(
        child for child in source_root.iterdir() if child.is_dir() and (child / "SKILL.md").exists()
    )


def load_json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read packaged skill provenance {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Packaged skill provenance must be an object: {path}")
    return value


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def tree_digest(file_hashes: dict[str, str]) -> str:
    digest = hashlib.sha256()
    for relative, file_digest in sorted(file_hashes.items()):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(bytes.fromhex(file_digest))
        digest.update(b"\0")
    return digest.hexdigest()


def materialize_packaged_skill(archive_path: Path, temporary_root: Path) -> SkillSource:
    manifest_path = archive_path.with_suffix(".provenance.json")
    manifest = load_json_object(manifest_path)
    skill_name = manifest.get("skill")
    if not isinstance(skill_name, str) or not skill_name:
        raise ValueError(f"Packaged skill provenance has no skill name: {manifest_path}")

    required = {
        "schemaVersion": 2,
        "artifactArchive": archive_path.name,
        "installCommand": "python3 scripts/sync-agent-skills.py --prune",
        "integrityCheckCommand": "npm run guard:skills",
    }
    for key, expected in required.items():
        if manifest.get(key) != expected:
            raise ValueError(
                f"Packaged skill provenance {key} must equal {expected!r}: {manifest_path}"
            )
    package_version = manifest.get("packageVersion")
    if not isinstance(package_version, str) or not package_version:
        raise ValueError(f"Packaged skill provenance has no packageVersion: {manifest_path}")
    expected_identity = PACKAGED_SKILL_IDENTITIES.get(skill_name)
    if expected_identity is None:
        raise ValueError(f"Packaged skill has no trusted source identity: {skill_name}")
    for key, expected in expected_identity.items():
        if manifest.get(key) != expected:
            raise ValueError(
                f"Packaged skill provenance {key} must equal {expected!r}: {manifest_path}"
            )
    revision = manifest.get("sourceRevision")
    if (
        not isinstance(revision, str)
        or len(revision) != 40
        or any(character not in "0123456789abcdef" for character in revision)
    ):
        raise ValueError(
            f"Packaged skill provenance sourceRevision must be a full revision: {manifest_path}"
        )

    archive_digest = digest_bytes(archive_path.read_bytes())
    if manifest.get("artifactArchiveSha256") != archive_digest:
        raise ValueError(
            "Packaged skill archive digest drift: "
            f"manifest={manifest.get('artifactArchiveSha256')!r} observed={archive_digest!r}"
        )

    declared_files = manifest.get("files")
    if not isinstance(declared_files, dict) or not all(
        isinstance(relative, str) and isinstance(file_digest, str)
        for relative, file_digest in declared_files.items()
    ):
        raise ValueError(f"Packaged skill provenance files must be a hash map: {manifest_path}")

    destination = temporary_root / skill_name
    observed_files: dict[str, str] = {}
    observed_members: set[str] = set()
    with zipfile.ZipFile(archive_path) as archive:
        for info in archive.infolist():
            if "\\" in info.filename:
                raise ValueError(f"Packaged skill archive has a non-portable path: {info.filename}")
            archive_member = Path(info.filename)
            if archive_member.is_absolute() or ".." in archive_member.parts:
                raise ValueError(f"Packaged skill archive has an unsafe path: {info.filename}")
            normalized_member = archive_member.as_posix()
            if normalized_member != info.filename.rstrip("/"):
                raise ValueError(
                    f"Packaged skill archive has a non-canonical path: {info.filename}"
                )
            if normalized_member in observed_members:
                raise ValueError(f"Packaged skill archive has a duplicate path: {info.filename}")
            observed_members.add(normalized_member)
            if not archive_member.parts or archive_member.parts[0] != skill_name:
                raise ValueError(
                    f"Packaged skill archive must contain only {skill_name}/: {info.filename}"
                )
            relative_parts = archive_member.parts[1:]
            if relative_parts and (
                relative_parts[-1] in {".DS_Store", MARKER_NAME}
                or RESERVED_ARCHIVE_PARTS.intersection(relative_parts)
            ):
                raise ValueError(
                    f"Packaged skill archive has a reserved runtime path: {info.filename}"
                )
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise ValueError(f"Packaged skill archive must not contain symlinks: {info.filename}")
            file_type = stat.S_IFMT(mode)
            if info.is_dir():
                if file_type not in (0, stat.S_IFDIR):
                    raise ValueError(
                        f"Packaged skill archive has an unsupported entry type: {info.filename}"
                    )
                continue
            if file_type not in (0, stat.S_IFREG):
                raise ValueError(
                    f"Packaged skill archive has an unsupported entry type: {info.filename}"
                )
            if not relative_parts:
                raise ValueError(f"Packaged skill archive has an invalid root file: {info.filename}")
            relative = Path(*relative_parts).as_posix()
            content = archive.read(info)
            observed_files[relative] = digest_bytes(content)
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)

    if manifest.get("fileCount") != len(observed_files):
        raise ValueError(
            "Packaged skill fileCount drift: "
            f"manifest={manifest.get('fileCount')!r} observed={len(observed_files)}"
        )
    if declared_files != observed_files:
        raise ValueError(f"Packaged skill per-file hash map drift: {archive_path}")
    observed_tree_digest = tree_digest(observed_files)
    if manifest.get("artifactTreeSha256") != observed_tree_digest:
        raise ValueError(
            "Packaged skill tree digest drift: "
            f"manifest={manifest.get('artifactTreeSha256')!r} observed={observed_tree_digest!r}"
        )

    ensure_skill_shape(destination)
    return SkillSource(directory=destination, marker_source=archive_path)


def discover_skill_sources(source_root: Path, temporary_root: Path) -> list[SkillSource]:
    sources = [
        SkillSource(directory=directory, marker_source=directory)
        for directory in discover_directory_skills(source_root)
    ]
    sources.extend(
        materialize_packaged_skill(archive_path, temporary_root)
        for archive_path in sorted(source_root.glob("*.skill"))
    )
    names = [source.name for source in sources]
    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ValueError(f"Duplicate Agent Skill sources: {', '.join(duplicates)}")
    return sorted(sources, key=lambda source: source.name)


def nested_git_metadata(source_root: Path) -> list[Path]:
    return sorted(path for path in source_root.rglob(".git") if path.exists())


def ensure_skill_shape(skill_dir: Path) -> str:
    skill_name = extract_skill_name(skill_dir)
    if skill_name != skill_dir.name:
        raise ValueError(
            f"Skill directory name mismatch: frontmatter name '{skill_name}' != folder '{skill_dir.name}'"
        )
    return skill_name


def overwrite_generated_skill(source: SkillSource, target_dir: Path, repo_root: Path) -> None:
    if target_dir.exists():
        marker = target_dir / MARKER_NAME
        if not marker.exists():
            raise RuntimeError(
                f"Refusing to overwrite non-generated directory: {target_dir}"
            )
        shutil.rmtree(target_dir)

    shutil.copytree(source.directory, target_dir, ignore=IGNORE_PATTERNS)
    (target_dir / MARKER_NAME).write_text(
        marker_text(source.marker_source, repo_root),
        encoding="utf-8",
    )


def marker_text(source_dir: Path, repo_root: Path) -> str:
    try:
        relative_source = source_dir.resolve().relative_to(repo_root)
    except ValueError:
        relative_source = Path(source_dir.name)
    return f"Generated by scripts/sync-agent-skills.py from {relative_source.as_posix()}\n"


def prune_generated_skills(source_names: set[str], target_root: Path) -> list[Path]:
    removed: list[Path] = []
    if not target_root.exists():
        return removed

    for child in sorted(target_root.iterdir()):
        if not child.is_dir():
            continue
        if not (child / MARKER_NAME).exists():
            continue
        if child.name in source_names:
            continue
        shutil.rmtree(child)
        removed.append(child)
    return removed


def sync_target(
    skill_sources: list[SkillSource], target_root: Path, prune: bool, repo_root: Path
) -> tuple[list[Path], list[Path]]:
    target_root.mkdir(parents=True, exist_ok=True)

    synced: list[Path] = []
    for source in skill_sources:
        skill_name = ensure_skill_shape(source.directory)
        overwrite_generated_skill(source, target_root / skill_name, repo_root)
        synced.append(target_root / skill_name)

    removed = (
        prune_generated_skills({source.name for source in skill_sources}, target_root)
        if prune
        else []
    )
    return synced, removed


def file_map(root: Path, *, ignore_marker: bool) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Agent skill tree must not contain symlinks: {path}")
        if path.is_dir():
            continue
        if not stat.S_ISREG(path.stat().st_mode):
            raise ValueError(f"Agent skill tree has a non-regular entry: {path}")
        if path.name == ".DS_Store" or "__pycache__" in path.parts or ".git" in path.parts:
            continue
        if ignore_marker and path.name == MARKER_NAME:
            continue
        rel = path.relative_to(root).as_posix()
        files[rel] = path.read_bytes()
    return files


def check_target(
    skill_sources: list[SkillSource], target_root: Path, repo_root: Path
) -> list[str]:
    errors: list[str] = []
    source_names = {source.name for source in skill_sources}

    for source in skill_sources:
        source_dir = source.directory
        target_dir = target_root / source.name
        if not target_dir.exists():
            errors.append(f"missing generated skill: {target_dir}")
            continue
        if target_dir.is_symlink():
            errors.append(f"generated skill root must not be a symlink: {target_dir}")
            continue
        marker = target_dir / MARKER_NAME
        if not marker.exists():
            errors.append(f"missing generated marker: {marker}")
            continue
        expected_marker = marker_text(source.marker_source, repo_root)
        actual_marker = marker.read_text(encoding="utf-8")
        if actual_marker != expected_marker:
            errors.append(f"stale generated marker: {marker}")

        source_files = file_map(source_dir, ignore_marker=False)
        target_files = file_map(target_dir, ignore_marker=True)
        source_paths = set(source_files)
        target_paths = set(target_files)

        for rel in sorted(source_paths - target_paths):
            errors.append(f"missing file in {target_dir}: {rel}")
        for rel in sorted(target_paths - source_paths):
            errors.append(f"extra file in {target_dir}: {rel}")
        for rel in sorted(source_paths & target_paths):
            if source_files[rel] != target_files[rel]:
                errors.append(f"drifted file in {target_dir}: {rel}")

    if target_root.exists():
        for child in sorted(target_root.iterdir()):
            if not child.is_dir():
                continue
            if child.name in source_names:
                continue
            if (child / MARKER_NAME).exists():
                errors.append(f"generated skill no longer in source: {child}")
            elif (child / "SKILL.md").exists():
                errors.append(f"unmanaged runtime skill not in source: {child}")

    return errors


def main() -> int:
    args = build_parser().parse_args()
    source_root = args.source.resolve()
    repo_root = Path(__file__).resolve().parent.parent
    target_roots = [args.claude_dir.resolve(), args.codex_dir.resolve()]

    if not source_root.exists():
        print(f"Source directory does not exist: {source_root}", file=sys.stderr)
        return 1

    nested_git_paths = nested_git_metadata(source_root)
    if nested_git_paths:
        print("Canonical Agent Skills contain nested Git metadata:", file=sys.stderr)
        for path in nested_git_paths:
            print(f"  - {path}", file=sys.stderr)
        print(
            "Preserve any required Git objects or stashes before removing these paths.",
            file=sys.stderr,
        )
        return 1

    with tempfile.TemporaryDirectory(prefix="agent-skill-packages-") as temporary_directory:
        skill_sources = discover_skill_sources(source_root, Path(temporary_directory))
        if not skill_sources:
            print(f"No skills found in {source_root}")
            return 0

        for source in skill_sources:
            ensure_skill_shape(source.directory)

        if args.check:
            all_errors: list[str] = []
            for target_root in target_roots:
                errors = check_target(skill_sources, target_root, repo_root)
                if errors:
                    all_errors.append(f"[check] {target_root}")
                    all_errors.extend(f"  - {error}" for error in errors)
                else:
                    print(f"[check] {target_root} OK")
            if all_errors:
                print("Agent skill sync check failed:", file=sys.stderr)
                print("\n".join(all_errors), file=sys.stderr)
                print(
                    "Run `python3 scripts/sync-agent-skills.py --prune` to regenerate generated skills.",
                    file=sys.stderr,
                )
                return 1
            return 0

        for target_root in target_roots:
            synced, removed = sync_target(skill_sources, target_root, args.prune, repo_root)
            print(f"[sync] {target_root}")
            for path in synced:
                print(f"  + {path.name}")
            for path in removed:
                print(f"  - {path.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
