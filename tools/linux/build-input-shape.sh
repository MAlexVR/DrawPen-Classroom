#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="${project_dir}/tools/linux/drawpen-x11-input-shape.c"
output_file="${project_dir}/assets/build/drawpen-x11-input-shape"

cc \
  -O2 \
  -Wall \
  -Wextra \
  -Wpedantic \
  "${source_file}" \
  -o "${output_file}" \
  -lX11 \
  -Wl,-l:libXext.so.6

chmod 0755 "${output_file}"
echo "Built ${output_file}"
