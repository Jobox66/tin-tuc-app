#!/usr/bin/env bash
# Kich hoat workflow sync qua GitHub API (workflow_dispatch).
# Dung de test truoc khi cam vao dich vu cron ben ngoai.
#
#   GITHUB_TOKEN=github_pat_xxx ./scripts/trigger-sync.sh
#
# Token: fine-grained PAT, chi can quyen "Actions: Read and write"
# tren dung repo nay. KHONG can quyen gi khac.

set -euo pipefail

REPO="${REPO:-Jobox66/tin-tuc-app}"
BRANCH="${BRANCH:-master}"
WORKFLOW="${WORKFLOW:-sync.yml}"

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Thieu GITHUB_TOKEN." >&2
    echo "Vi du: GITHUB_TOKEN=github_pat_xxx $0" >&2
    exit 1
fi

URL="https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -d "{\"ref\":\"${BRANCH}\"}")

case "$code" in
    204) echo "OK - da kich hoat sync tren nhanh ${BRANCH}." ;;
    401) echo "401 - token sai hoac het han." >&2; exit 1 ;;
    403) echo "403 - token thieu quyen 'Actions: Read and write'." >&2; exit 1 ;;
    404) echo "404 - sai repo/workflow, hoac token khong thay repo nay." >&2; exit 1 ;;
    422) echo "422 - nhanh '${BRANCH}' khong ton tai, hoac workflow chua co workflow_dispatch." >&2; exit 1 ;;
    *)   echo "HTTP ${code} - that bai." >&2; exit 1 ;;
esac
