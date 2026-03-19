#!/usr/bin/env bash

set -euo pipefail

output_file="${1:-release-notes.md}"
current_tag="${2:-${GITHUB_REF_NAME:-}}"

if [[ -z "${current_tag}" ]]; then
  echo "current tag is required" >&2
  exit 1
fi

previous_tag="$(git describe --tags --abbrev=0 "${current_tag}^" 2>/dev/null || true)"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

breaking_file="${tmp_dir}/breaking.md"
features_file="${tmp_dir}/features.md"
fixes_file="${tmp_dir}/fixes.md"
performance_file="${tmp_dir}/performance.md"
refactors_file="${tmp_dir}/refactors.md"
docs_file="${tmp_dir}/docs.md"
maintenance_file="${tmp_dir}/maintenance.md"
other_file="${tmp_dir}/other.md"

touch \
  "${breaking_file}" \
  "${features_file}" \
  "${fixes_file}" \
  "${performance_file}" \
  "${refactors_file}" \
  "${docs_file}" \
  "${maintenance_file}" \
  "${other_file}"

git_range=("${current_tag}")
if [[ -n "${previous_tag}" ]]; then
  git_range=("${previous_tag}..${current_tag}")
fi

format_commit_ref() {
  local sha short_sha

  sha="$1"
  short_sha="${sha:0:7}"

  if [[ -n "${GITHUB_SERVER_URL:-}" && -n "${GITHUB_REPOSITORY:-}" ]]; then
    printf '[`%s`](%s/%s/commit/%s)' "${short_sha}" "${GITHUB_SERVER_URL}" "${GITHUB_REPOSITORY}" "${sha}"
    return
  fi

  printf '`%s`' "${short_sha}"
}

extract_breaking_note() {
  local body

  body="$1"
  printf '%s\n' "${body}" | awk '
    found {
      if ($0 ~ /^[[:space:]]*$/) {
        exit
      }

      if ($0 ~ /^[A-Z-]+: /) {
        exit
      }

      gsub(/^[[:space:]]+/, "", $0)
      printf "%s ", $0
      next
    }

    /^BREAKING CHANGE: / {
      sub(/^BREAKING CHANGE: /, "", $0)
      found = 1
      printf "%s ", $0
      next
    }

    /^BREAKING-CHANGE: / {
      sub(/^BREAKING-CHANGE: /, "", $0)
      found = 1
      printf "%s ", $0
      next
    }
  ' | sed 's/[[:space:]]*$//'
}

append_commit() {
  local file line

  file="$1"
  line="$2"

  printf '%s\n' "${line}" >> "${file}"
}

while IFS= read -r -d '' sha \
  && IFS= read -r -d '' subject \
  && IFS= read -r -d '' body; do
  sha="${sha//$'\n'/}"
  sha="${sha//$'\r'/}"
  type="other"
  description="${subject}"
  is_breaking="false"

  if [[ "${subject}" == *": "* ]]; then
    prefix="${subject%%: *}"
    parsed_type="${prefix%%(*}"
    parsed_type="${parsed_type%!}"

    if [[ "${parsed_type}" =~ ^[a-z]+$ ]]; then
      type="${parsed_type}"
      description="${subject#*: }"

      if [[ "${prefix}" == *"!" ]]; then
        is_breaking="true"
      fi
    fi
  fi

  if [[ "${body}" == *"BREAKING CHANGE:"* ]] || [[ "${body}" == *"BREAKING-CHANGE:"* ]]; then
    is_breaking="true"
  fi

  commit_ref="$(format_commit_ref "${sha}")"
  line="- ${description} (${commit_ref})"

  case "${type}" in
    feat)
      append_commit "${features_file}" "${line}"
      ;;
    fix)
      append_commit "${fixes_file}" "${line}"
      ;;
    perf)
      append_commit "${performance_file}" "${line}"
      ;;
    refactor)
      append_commit "${refactors_file}" "${line}"
      ;;
    docs)
      append_commit "${docs_file}" "${line}"
      ;;
    chore|build|ci|style|test|revert)
      append_commit "${maintenance_file}" "${line}"
      ;;
    *)
      append_commit "${other_file}" "${line}"
      ;;
  esac

  if [[ "${is_breaking}" == "true" ]]; then
    breaking_note="$(extract_breaking_note "${body}")"

    if [[ -n "${breaking_note}" ]]; then
      append_commit "${breaking_file}" "- ${breaking_note} (${commit_ref})"
    else
      append_commit "${breaking_file}" "${line}"
    fi
  fi
done < <(git log --reverse --format='%H%x00%s%x00%b%x00' "${git_range[@]}")

section_count=0

write_section() {
  local title file

  title="$1"
  file="$2"

  if [[ ! -s "${file}" ]]; then
    return
  fi

  section_count=$((section_count + 1))
  printf '## %s\n\n' "${title}" >> "${output_file}"
  cat "${file}" >> "${output_file}"
  printf '\n' >> "${output_file}"
}

{
  printf '# Release Notes\n\n'
  printf 'Changes in `%s`.\n\n' "${current_tag}"

  if [[ -n "${previous_tag}" ]]; then
    printf 'Compared to `%s`.\n\n' "${previous_tag}"
  fi
} > "${output_file}"

write_section "Breaking Changes" "${breaking_file}"
write_section "Features" "${features_file}"
write_section "Fixes" "${fixes_file}"
write_section "Performance" "${performance_file}"
write_section "Refactors" "${refactors_file}"
write_section "Documentation" "${docs_file}"
write_section "Maintenance" "${maintenance_file}"
write_section "Other Changes" "${other_file}"

if [[ "${section_count}" -eq 0 ]]; then
  printf 'No user-facing changes were detected from the commit history.\n' >> "${output_file}"
fi

if [[ -n "${previous_tag}" && -n "${GITHUB_SERVER_URL:-}" && -n "${GITHUB_REPOSITORY:-}" ]]; then
  printf '\n[Full Changelog](%s/%s/compare/%s...%s)\n' \
    "${GITHUB_SERVER_URL}" \
    "${GITHUB_REPOSITORY}" \
    "${previous_tag}" \
    "${current_tag}" >> "${output_file}"
fi
