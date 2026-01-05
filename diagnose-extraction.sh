#!/bin/bash

# ApplySafe Job Extraction Diagnostic Script
# Run this to check if job extraction is working

echo "🔍 ApplySafe Job Extraction Diagnostic"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[CHECK 1]${NC} Verifying extension structure..."
if [ -f "applysafe-extension/manifest.json" ]; then
    echo -e "${GREEN}✅ manifest.json found${NC}"
else
    echo -e "${RED}❌ manifest.json NOT found${NC}"
fi

if [ -f "applysafe-extension/content/content.js" ]; then
    echo -e "${GREEN}✅ content.js found${NC}"
else
    echo -e "${RED}❌ content.js NOT found${NC}"
fi

if [ -f "applysafe-extension/popup/popup.js" ]; then
    echo -e "${GREEN}✅ popup.js found${NC}"
else
    echo -e "${RED}❌ popup.js NOT found${NC}"
fi
echo ""

echo -e "${BLUE}[CHECK 2]${NC} Checking content script for key functions..."

if grep -q "function extractJobData" applysafe-extension/content/content.js; then
    echo -e "${GREEN}✅ extractJobData() function found${NC}"
else
    echo -e "${RED}❌ extractJobData() function NOT found${NC}"
fi

if grep -q "function isJobPostingPage" applysafe-extension/content/content.js; then
    echo -e "${GREEN}✅ isJobPostingPage() function found${NC}"
else
    echo -e "${RED}❌ isJobPostingPage() function NOT found${NC}"
fi

if grep -q "SITE_SELECTORS" applysafe-extension/content/content.js; then
    echo -e "${GREEN}✅ SITE_SELECTORS defined${NC}"
else
    echo -e "${RED}❌ SITE_SELECTORS NOT defined${NC}"
fi
echo ""

echo -e "${BLUE}[CHECK 3]${NC} Checking for LinkedIn selectors..."

if grep -q "linkedin.com" applysafe-extension/content/content.js; then
    echo -e "${GREEN}✅ LinkedIn selectors found${NC}"
    
    # Count LinkedIn selectors
    LINKEDIN_SELECTORS=$(grep -A 20 "'linkedin.com':" applysafe-extension/content/content.js | grep ":" | wc -l)
    echo -e "   Found ${YELLOW}${LINKEDIN_SELECTORS}${NC} LinkedIn selector definitions"
else
    echo -e "${RED}❌ LinkedIn selectors NOT found${NC}"
fi
echo ""

echo -e "${BLUE}[CHECK 4]${NC} Checking popup.js for analysis trigger..."

if grep -q "analyzeJob" applysafe-extension/popup/popup.js; then
    echo -e "${GREEN}✅ analyzeJob action found${NC}"
else
    echo -e "${RED}❌ analyzeJob action NOT found${NC}"
fi

if grep -q "getJobData" applysafe-extension/popup/popup.js; then
    echo -e "${GREEN}✅ getJobData message found${NC}"
else
    echo -e "${RED}❌ getJobData message NOT found${NC}"
fi
echo ""

echo -e "${BLUE}[CHECK 5]${NC} Checking manifest.json permissions..."

if grep -q '"content_scripts"' applysafe-extension/manifest.json; then
    echo -e "${GREEN}✅ content_scripts defined${NC}"
else
    echo -e "${RED}⚠️  content_scripts NOT defined${NC}"
fi

if grep -q '"host_permissions"' applysafe-extension/manifest.json; then
    echo -e "${GREEN}✅ host_permissions defined${NC}"
    # Show some of them
    echo "   Sample permissions:"
    grep -A 5 '"host_permissions"' applysafe-extension/manifest.json | head -10 | sed 's/^/     /'
else
    echo -e "${RED}❌ host_permissions NOT defined${NC}"
fi
echo ""

echo -e "${BLUE}[CHECK 6]${NC} Checking background service worker..."

if [ -f "applysafe-extension/background/service-worker.js" ]; then
    echo -e "${GREEN}✅ service-worker.js found${NC}"
    
    if grep -q "analyzeJob" applysafe-extension/background/service-worker.js; then
        echo -e "${GREEN}✅ analyzeJob handler found in service worker${NC}"
    else
        echo -e "${RED}❌ analyzeJob handler NOT in service worker${NC}"
    fi
else
    echo -e "${RED}❌ service-worker.js NOT found${NC}"
fi
echo ""

echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Diagnostic Complete${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. If all checks pass: Job extraction should work"
echo "2. If any check fails: Fix the issue and reload extension"
echo "3. Open DevTools (F12) on a job page to see logs"
echo "4. Use job-extraction-debugger.html for detailed testing"
echo ""
echo -e "${BLUE}To reload extension:${NC}"
echo "  1. Go to chrome://extensions/"
echo "  2. Find ApplySafe extension"
echo "  3. Click the reload (↻) button"
echo "  4. Refresh the job posting page"
echo ""
