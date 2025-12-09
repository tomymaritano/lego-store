#!/bin/bash

# Package template for marketplace distribution
# Usage: ./scripts/package-for-sale.sh

set -e

VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME="ecommerce-template-nextjs-v${VERSION}"
OUTPUT_DIR="dist"
TIMESTAMP=$(date +%Y%m%d)

echo "📦 Packaging E-commerce Template v${VERSION}..."

# Create output directory
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Create temp directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="${TEMP_DIR}/${PACKAGE_NAME}"

mkdir -p "${PACKAGE_DIR}"

# Copy source files (excluding dev/build artifacts)
echo "📁 Copying source files..."

cp -r src "${PACKAGE_DIR}/"
cp -r public "${PACKAGE_DIR}/"
cp -r .storybook "${PACKAGE_DIR}/"
cp -r screenshots "${PACKAGE_DIR}/" 2>/dev/null || mkdir -p "${PACKAGE_DIR}/screenshots"

# Copy config files
cp package.json "${PACKAGE_DIR}/"
cp tsconfig.json "${PACKAGE_DIR}/"
cp tailwind.config.ts "${PACKAGE_DIR}/" 2>/dev/null || true
cp postcss.config.mjs "${PACKAGE_DIR}/"
cp next.config.mjs "${PACKAGE_DIR}/"
cp vitest.config.ts "${PACKAGE_DIR}/" 2>/dev/null || true
cp playwright.config.ts "${PACKAGE_DIR}/" 2>/dev/null || true
cp components.json "${PACKAGE_DIR}/" 2>/dev/null || true

# Copy documentation
cp README.md "${PACKAGE_DIR}/"
cp CHANGELOG.md "${PACKAGE_DIR}/"
cp LICENSE "${PACKAGE_DIR}/"
cp MARKETPLACE.md "${PACKAGE_DIR}/"

# Copy dot files
cp .eslintrc.json "${PACKAGE_DIR}/" 2>/dev/null || true
cp .prettierrc "${PACKAGE_DIR}/" 2>/dev/null || true
cp .env.example "${PACKAGE_DIR}/" 2>/dev/null || echo "NEXT_PUBLIC_API_URL=" > "${PACKAGE_DIR}/.env.example"

# Create .gitignore for buyers
cat > "${PACKAGE_DIR}/.gitignore" << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build
.next/
out/
build/
dist/
storybook-static/

# Testing
coverage/
playwright-report/
test-results/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Cache
.eslintcache
.cache/
EOF

# Remove any sensitive or unnecessary files
rm -rf "${PACKAGE_DIR}/src/stories" 2>/dev/null || true
rm -f "${PACKAGE_DIR}/lighthouse-report"* 2>/dev/null || true

echo "🗜️  Creating ZIP archive..."

# Create ZIP
cd "${TEMP_DIR}"
zip -r "${PACKAGE_NAME}.zip" "${PACKAGE_NAME}" -x "*.DS_Store" -x "*__MACOSX*"

# Move to output
mv "${PACKAGE_NAME}.zip" "${OLDPWD}/${OUTPUT_DIR}/"

# Cleanup
rm -rf "${TEMP_DIR}"

cd "${OLDPWD}"

# Show result
ZIP_SIZE=$(ls -lh "${OUTPUT_DIR}/${PACKAGE_NAME}.zip" | awk '{print $5}')
echo ""
echo "✅ Package created successfully!"
echo ""
echo "📄 File: ${OUTPUT_DIR}/${PACKAGE_NAME}.zip"
echo "📏 Size: ${ZIP_SIZE}"
echo ""
echo "Ready to upload to:"
echo "  - Gumroad"
echo "  - Lemon Squeezy"
echo "  - Creative Market"
echo "  - ThemeForest"
