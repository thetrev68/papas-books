#!/bin/bash

# Comprehensive dark mode update script for remaining pages
# This script adds dark mode classes to all white backgrounds, text, and borders

cd "$(dirname "$0")/.."

# Common patterns to update across all files
files=(
  "src/pages/ImportPage.tsx"
  "src/pages/ReconcilePage.tsx"
  "src/pages/ReportsPage.tsx"
  "src/components/settings/AccountsTab.tsx"
  "src/components/settings/CategoriesTab.tsx"
  "src/components/settings/PayeesTab.tsx"
  "src/components/settings/RulesTab.tsx"
  "src/components/settings/AccessTab.tsx"
)

for file in "${files[@]}"; do
  echo "Processing $file..."

  # Background colors
  sed -i 's/className="\([^"]*\)bg-white\([^"]*\)"/className="\1bg-white dark:bg-gray-800\2"/g' "$file"
  sed -i 's/className="\([^"]*\)bg-neutral-50\([^"]*\)"/className="\1bg-neutral-50 dark:bg-gray-900\2"/g' "$file"
  sed -i 's/className="\([^"]*\)bg-neutral-100\([^"]*\)"/className="\1bg-neutral-100 dark:bg-gray-900\2"/g' "$file"

  # Text colors
  sed -i 's/className="\([^"]*\)text-neutral-900\([^"]*\)"/className="\1text-neutral-900 dark:text-gray-100\2"/g' "$file"
  sed -i 's/className="\([^"]*\)text-neutral-800\([^"]*\)"/className="\1text-neutral-800 dark:text-gray-100\2"/g' "$file"
  sed -i 's/className="\([^"]*\)text-neutral-700\([^"]*\)"/className="\1text-neutral-700 dark:text-gray-300\2"/g' "$file"
  sed -i 's/className="\([^"]*\)text-neutral-600\([^"]*\)"/className="\1text-neutral-600 dark:text-gray-400\2"/g' "$file"
  sed -i 's/className="\([^"]*\)text-neutral-500\([^"]*\)"/className="\1text-neutral-500 dark:text-gray-400\2"/g' "$file"
  sed -i 's/className="\([^"]*\)text-neutral-400\([^"]*\)"/className="\1text-neutral-400 dark:text-gray-500\2"/g' "$file"

  # Border colors
  sed -i 's/className="\([^"]*\)border-neutral-200\([^"]*\)"/className="\1border-neutral-200 dark:border-gray-700\2"/g' "$file"
  sed -i 's/className="\([^"]*\)border-neutral-300\([^"]*\)"/className="\1border-neutral-300 dark:border-gray-600\2"/g' "$file"

  # Divide colors
  sed -i 's/className="\([^"]*\)divide-neutral-200\([^"]*\)"/className="\1divide-neutral-200 dark:divide-gray-700\2"/g' "$file"

  # Hover states
  sed -i 's/className="\([^"]*\)hover:bg-neutral-50\([^"]*\)"/className="\1hover:bg-neutral-50 dark:hover:bg-gray-700\2"/g' "$file"
  sed -i 's/className="\([^"]*\)hover:bg-neutral-100\([^"]*\)"/className="\1hover:bg-neutral-100 dark:hover:bg-gray-700\2"/g' "$file"
  sed -i 's/className="\([^"]*\)hover:bg-neutral-200\([^"]*\)"/className="\1hover:bg-neutral-200 dark:hover:bg-gray-600\2"/g' "$file"
  sed -i 's/className="\([^"]*\)hover:text-neutral-700\([^"]*\)"/className="\1hover:text-neutral-700 dark:hover:text-gray-300\2"/g' "$file"
  sed -i 's/className="\([^"]*\)hover:border-neutral-300\([^"]*\)"/className="\1hover:border-neutral-300 dark:hover:border-gray-600\2"/g' "$file"

done

echo "Dark mode classes added to all files!"
