import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, 'applysafe-extension');
const screenshotsDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });

// Inject stub for chrome.* APIs so the page doesn't throw before rendering
const chromeStub = `
  window.chrome = {
    storage: {
      local: { get: (k, cb) => cb && cb({}), set: () => {}, remove: () => {} },
      sync: { get: (k, cb) => cb && cb({}), set: () => {} },
      onChanged: { addListener: () => {} }
    },
    runtime: {
      sendMessage: () => {},
      onMessage: { addListener: () => {} },
      getURL: (p) => p,
      id: 'fake-extension-id'
    },
    tabs: {
      query: (opts, cb) => cb && cb([{ id: 1, url: 'https://www.linkedin.com/jobs/view/1234' }]),
      create: () => {}
    },
    identity: { getAuthToken: (opts, cb) => cb && cb(null) },
    alarms: { create: () => {}, onAlarm: { addListener: () => {} } },
    notifications: { create: () => {} },
    contextMenus: { create: () => {} }
  };
`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
  });

  // --- Screenshot 1: Popup ---
  const popupCtx = await browser.newContext({ viewport: { width: 400, height: 620 } });
  const popupPage = await popupCtx.newPage();
  await popupPage.addInitScript(chromeStub);
  await popupPage.goto(`file://${extensionPath}/popup/popup.html`);
  await popupPage.waitForTimeout(1500);
  await popupPage.screenshot({ path: path.join(screenshotsDir, '1-popup.png') });
  console.log('✓ Popup screenshot saved');
  await popupCtx.close();

  // --- Screenshot 2: Dashboard ---
  const dashCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dashPage = await dashCtx.newPage();
  await dashPage.addInitScript(chromeStub);
  await dashPage.goto(`file://${extensionPath}/dashboard/dashboard.html`);
  await dashPage.waitForTimeout(1500);
  await dashPage.screenshot({ path: path.join(screenshotsDir, '2-dashboard.png'), fullPage: false });
  console.log('✓ Dashboard screenshot saved');
  await dashCtx.close();

  // --- Screenshot 3: Dashboard dark mode ---
  const darkCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });
  const darkPage = await darkCtx.newPage();
  await darkPage.addInitScript(chromeStub);
  await darkPage.goto(`file://${extensionPath}/dashboard/dashboard.html`);
  await darkPage.waitForTimeout(500);
  await darkPage.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await darkPage.waitForTimeout(500);
  await darkPage.screenshot({ path: path.join(screenshotsDir, '3-dashboard-dark.png'), fullPage: false });
  console.log('✓ Dashboard dark mode screenshot saved');
  await darkCtx.close();

  await browser.close();
  console.log('\nScreenshots saved to:', screenshotsDir);
})();
