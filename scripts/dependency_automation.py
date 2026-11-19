"""Merge reviewed routine Dependabot updates without executing PR code."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
from pathlib import PurePosixPath

DEPENDABOT = 49699333
CODEX = 199175422
GITHUB_ACTIONS = 15368
GITHUB_ACTIONS_USER = 41898282
REPOSITORIES = {
    "lykomi/lykomi": {"CI", "Dependency review"},
    "lykomi/ui": {"Quality", "Runtime skills", "Neo4j preset", "Dependency review"},
}
CONTROLLED = (
    "@lykomi/*",
    "@assistant-ui/*",
    "@ag-ui/*",
    "agent-framework*",
    "lykomi*",
    "mcp",
    "fastmcp",
    "azure-search-documents",
    "graphql-core",
    "@azure/msal*",
    "msal*",
    "azure-identity",
    "react-pdf",
    "pdfjs-dist",
    "pyjwt",
    "authlib",
    "cryptography",
    "oauthlib",
    "requests-oauthlib",
    "python-jose",
    "pyopenssl",
)
MANIFESTS = {
    "package.json",
    "pnpm-lock.yaml",
    "pyproject.toml",
    "uv.lock",
    "requirements.txt",
    "go.mod",
    "go.sum",
    "Package.swift",
    "Package.resolved",
}


def gh(*args):
    result = subprocess.run(
        ["gh", *args], check=True, text=True, capture_output=True, timeout=90
    )
    return json.loads(result.stdout)


def api(path):
    return gh("api", path)


def pages(path, key=None):
    result = gh("api", "--paginate", "--slurp", path)
    return [item for page in result for item in (page[key] if key else page)]


def dependency_records(message):
    """Parse only Dependabot's flat signed trailer, rejecting unknown YAML shapes."""
    marker = "\n---\nupdated-dependencies:\n"
    if message.count(marker) != 1:
        raise ValueError("missing or ambiguous signed update metadata")
    trailer = message.split(marker)[1].split("\n...\n", 1)
    if len(trailer) != 2:
        raise ValueError("unterminated signed update metadata")
    records = []
    for line in trailer[0].splitlines():
        match = re.fullmatch(r"(- |  )([a-z-]+): (.+)", line)
        if not match:
            raise ValueError("unsupported update metadata")
        prefix, key, value = match.groups()
        if prefix == "- ":
            if key != "dependency-name":
                raise ValueError("invalid update record")
            records.append({})
        if not records or key in records[-1]:
            raise ValueError("invalid or duplicate update field")
        if value.startswith('"'):
            value = json.loads(value)
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1].replace("''", "'")
        if not isinstance(value, str) or not re.fullmatch(
            r"[A-Za-z0-9@/_.:+-]+", value
        ):
            raise ValueError("unsupported update value")
        records[-1][key] = value
    if not records:
        raise ValueError("empty dependency metadata")
    return records


def classify_single_update(message, records):
    """Security updates omit update-type; accept only an exact signed bump sentence."""
    if len(records) != 1 or "update-type" in records[0]:
        return records
    record = records[0]
    # Read the verified commit body, never the editable PR title/body or labels.
    prose = message.split("\n---\nupdated-dependencies:\n", 1)[0]
    # Never search release-note quotes for a replacement canonical sentence.
    paragraphs = prose.split("\n\n", 2)
    if len(paragraphs) < 2:
        return records
    sentence = paragraphs[1].split("\n", 1)[0]
    match = re.fullmatch(
        r"Bumps \[([^\]\n]+)\]\(https://[^\s)]+\) from "
        r"(\d+\.\d+\.\d+) to (\d+\.\d+\.\d+)\.$",
        sentence,
    )
    if match is None:
        return records
    name, previous, target = match.groups()
    if name != record.get("dependency-name") or target != record.get(
        "dependency-version"
    ):
        return records
    before, after = (
        tuple(map(int, version.split("."))) for version in (previous, target)
    )
    if after <= before or after[0] != before[0]:
        return records
    kind = "minor" if after[1] != before[1] else "patch"
    return [{**record, "update-type": "version-update:semver-" + kind}]


def routine_updates(commits):
    records = []
    if not commits:
        return False, "no commits", records
    for commit in commits:
        if (
            (commit.get("author") or {}).get("id") != DEPENDABOT
            or (commit.get("committer") or {}).get("id") not in {DEPENDABOT, 19864447}
            or commit["commit"].get("verification", {}).get("verified") is not True
            or len(commit.get("parents", [])) != 1
        ):
            return False, "non-bot, unsigned or merge commit", records
        try:
            message = commit["commit"]["message"]
            records.extend(classify_single_update(message, dependency_records(message)))
        except (ValueError, TypeError):
            return False, "unrecognized signed metadata", records
    for record in records:
        name = record.get("dependency-name", "")
        kind = record.get("update-type", "")
        version = record.get("dependency-version", "")
        if kind not in {"version-update:semver-patch", "version-update:semver-minor"}:
            return False, "major or unclassified update requires approval", records
        if not re.fullmatch(r"v?\d+\.\d+\.\d+", version):
            return (
                False,
                "prerelease or unrecognized version requires approval",
                records,
            )
        if kind.endswith("minor") and version.removeprefix("v").startswith("0."):
            return False, "pre-1.0 minor requires approval", records
        normalized = re.sub(r"[-_.]+", "-", name.lower())
        if any(fnmatch.fnmatchcase(normalized, pattern) for pattern in CONTROLLED):
            return False, "controlled dependency requires independent review", records
    return True, "routine patch/minor", records


def reviewed(head, reviews, comments):
    for review in reviews:
        body = review.get("body", "").lstrip()
        body = body.removeprefix("<!-- codex-review-receipt:v1 -->").lstrip()
        if (
            review["user"]["id"] == CODEX
            and review.get("commit_id") == head
            and review.get("state") not in {"PENDING", "DISMISSED"}
            and body.startswith("### 💡 Codex Review")
        ):
            return True
    for comment in comments:
        body = comment.get("body", "").lstrip()
        body = body.removeprefix("<!-- codex-review-receipt:v1 -->").lstrip()
        if comment["user"]["id"] != CODEX or not body.lstrip().startswith(
            "Codex Review: Didn't find any major issues"
        ):
            continue
        match = re.search(r"\*?\*?Reviewed commit:\*?\*?\s*`([a-f0-9]{7,40})`", body)
        if match and head.startswith(match[1]):
            return True
    return False


def unresolved_threads(repo, number):
    owner, name = repo.split("/")
    query = """query($owner:String!,$name:String!,$number:Int!,$cursor:String){
      repository(owner:$owner,name:$name){pullRequest(number:$number){
        reviewThreads(first:100,after:$cursor){nodes{isResolved}
          pageInfo{hasNextPage endCursor}}}}}"""
    cursor = None
    while True:
        args = [
            "api",
            "graphql",
            "-f",
            "query=" + query,
            "-f",
            "owner=" + owner,
            "-f",
            "name=" + name,
            "-F",
            "number=" + str(number),
        ]
        if cursor:
            args += ["-f", "cursor=" + cursor]
        data = gh(*args)["data"]["repository"]["pullRequest"]["reviewThreads"]
        if any(not item["isResolved"] for item in data["nodes"]):
            return True
        if not data["pageInfo"]["hasNextPage"]:
            return False
        cursor = data["pageInfo"]["endCursor"]
        if not cursor:
            raise ValueError("incomplete review pagination")


def strict_protection(repo):
    required = REPOSITORIES[repo]
    for rule in pages(f"repos/{repo}/rules/branches/main?per_page=100"):
        params = rule.get("parameters", {})
        checks = {
            item["context"]
            for item in params.get("required_status_checks", [])
            if item.get("integration_id") == GITHUB_ACTIONS
        }
        if (
            rule["type"] == "required_status_checks"
            and params.get("strict_required_status_checks_policy")
            and required <= checks
        ):
            return True
    return False


def review_marker(repo, number, head):
    return f"<!-- lykomi-codex-request:v1 {repo}#{number} {head} -->"


def review_inflight(repo, number, head, comments):
    marker = review_marker(repo, number, head)
    for item in comments:
        body = item.get("body", "")
        if item["user"]["id"] == GITHUB_ACTIONS_USER and marker in body:
            return True
        if item["user"]["id"] == CODEX and head in body:
            # A summary suppresses duplicates; it never grants merge clearance.
            if "<!-- codex-review-state:v1 " in body:
                return True
        if item["user"]["id"] == GITHUB_ACTIONS_USER and re.search(
            re.escape(f"<!-- lykomi-codex-request:v1 {repo}#{number} ")
            + r"[a-f0-9]{40} -->",
            body,
        ):
            continue  # Our own explicit request for an older head.
        # An unbound manual request cannot be cleared by unrelated bot chatter.
        if body.lstrip().startswith("@codex review"):
            return True
    return False


def decision(repo, number):
    prefix = f"repos/{repo}"
    pr = api(f"{prefix}/pulls/{number}")
    head = pr["head"]["sha"]
    result = {"number": number, "head": head, "eligible": False}

    def stop(reason):
        return {**result, "reason": reason}

    if pr["state"] != "open" or pr["draft"] or pr["user"]["id"] != DEPENDABOT:
        return stop("not an open ready Dependabot PR")
    if pr["base"]["ref"] != "main" or pr["head"]["repo"]["full_name"] != repo:
        return stop("fork or non-main target")
    if not re.match(
        r"^dependabot/(npm_and_yarn|uv|pip|go_modules|gomod|swift)/", pr["head"]["ref"]
    ):
        return stop(
            "workflow/container/unknown ecosystem requires independent approval"
        )
    commits = pages(f"{prefix}/pulls/{number}/commits?per_page=100")
    if len(commits) != pr["commits"] or commits[-1]["sha"] != head:
        return stop("incomplete commit inventory")
    eligible, reason, records = routine_updates(commits)
    result["updates"] = records
    if not eligible:
        return stop(reason)
    files = pages(f"{prefix}/pulls/{number}/files?per_page=100")
    if len(files) != pr["changed_files"] or not files:
        return stop("incomplete changed-file inventory")
    if any(
        PurePosixPath(item["filename"]).name not in MANIFESTS
        or item["filename"].startswith(".github/")
        or item["status"] != "modified"
        for item in files
    ):
        return stop("unexpected changed files require review")
    if not strict_protection(repo):
        return stop("strict trusted CI protection is not configured")
    checks = pages(f"{prefix}/commits/{head}/check-runs?per_page=100", "check_runs")
    required = REPOSITORIES[repo]
    trusted = {
        item["name"]
        for item in checks
        if item.get("app", {}).get("id") == GITHUB_ACTIONS
        and item["conclusion"] == "success"
        and item["status"] == "completed"
    }
    if not required <= trusted or any(
        item["status"] != "completed"
        or item["conclusion"] not in {"success", "neutral", "skipped"}
        for item in checks
    ):
        return stop("waiting for successful checks")
    comparison = api(f"{prefix}/compare/main...{head}")
    if comparison["behind_by"] != 0 or pr.get("mergeable") is not True:
        return stop("base changed, mergeability unknown or protection blocked")
    reviews = pages(f"{prefix}/pulls/{number}/reviews?per_page=100")
    comments = pages(f"{prefix}/issues/{number}/comments?per_page=100")
    latest = {}
    for review in reviews:
        if review["state"] in {"APPROVED", "CHANGES_REQUESTED"}:
            latest[review["user"]["id"]] = review["state"]
    if "CHANGES_REQUESTED" in latest.values() or unresolved_threads(repo, number):
        return stop("unresolved review findings")
    if not reviewed(head, reviews, comments):
        return {
            **stop("waiting for final-head Codex code review"),
            "review_requestable": not review_inflight(repo, number, head, comments)
            and not any(
                review["user"]["id"] == CODEX
                and review.get("commit_id") == head
                and review["state"] == "PENDING"
                for review in reviews
            ),
        }
    if pr.get("mergeable_state") != "clean":
        return stop("base changed, mergeability unknown or protection blocked")
    return {**result, "eligible": True, "reason": "reviewed and tested routine update"}


def run(repo, apply=False):
    if repo not in REPOSITORIES:
        raise ValueError("unsupported repository")
    reports, merged, requested = [], 0, 0
    for pr in pages(f"repos/{repo}/pulls?state=open&per_page=100"):
        if pr["user"]["id"] != DEPENDABOT:
            continue
        report = decision(repo, pr["number"])
        if apply and report.get("review_requestable") and requested < 1:
            fresh = decision(repo, pr["number"])
            if fresh.get("review_requestable") and fresh["head"] == report["head"]:
                current = api(f"repos/{repo}/pulls/{pr['number']}")
                if (
                    current["head"]["sha"] == report["head"]
                    and not current["draft"]
                    and current["state"] == "open"
                    and current["base"]["ref"] == "main"
                ):
                    marker = review_marker(repo, pr["number"], report["head"])
                    gh(
                        "api",
                        "--method",
                        "POST",
                        f"repos/{repo}/issues/{pr['number']}/comments",
                        "-f",
                        "body=@codex review\n"
                        f"Review dependency update head {report['head']}. "
                        "Check compatibility, lockfile changes "
                        "and release requirements. "
                        "Do not approve or merge.\n\n" + marker,
                    )
                    requested += 1
                    report["review_requested"] = True
        if apply and report["eligible"] and merged < 1:
            # Repeat all state checks immediately before a SHA-conditional merge.
            fresh = decision(repo, pr["number"])
            if fresh["eligible"] and fresh["head"] == report["head"]:
                response = gh(
                    "api",
                    "--method",
                    "PUT",
                    f"repos/{repo}/pulls/{pr['number']}/merge",
                    "-f",
                    "sha=" + report["head"],
                    "-f",
                    "merge_method=squash",
                )
                report["merged"] = response.get("merged") is True
                report["merge_sha"] = response.get("sha")
                merged += int(report["merged"])
        reports.append(report)
    output = {
        "repository": repo,
        "apply": apply,
        "decisions": reports,
        "merged": merged,
        "reviews_requested": requested,
    }
    print(json.dumps(output, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as stream:
            stream.write("## Dependency maintenance\n\n")
            for report in reports:
                stream.write(
                    f"- #{report['number']}: {report['reason']}; "
                    f"merged={report.get('merged', False)}\n"
                )
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, choices=REPOSITORIES)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    run(args.repo, args.apply)
