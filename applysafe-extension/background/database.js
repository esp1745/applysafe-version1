// IndexedDB for ApplySafe - Job History & Analytics
const DB_NAME = 'ApplySafeDB';
const DB_VERSION = 1;
let db = null;

// Initialize database
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      console.log('ApplySafe: Database initialized');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Jobs store - all analyzed jobs
      if (!db.objectStoreNames.contains('jobs')) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id', autoIncrement: true });
        jobStore.createIndex('url', 'url', { unique: false });
        jobStore.createIndex('company', 'company', { unique: false });
        jobStore.createIndex('timestamp', 'timestamp', { unique: false });
        jobStore.createIndex('riskScore', 'riskScore', { unique: false });
        jobStore.createIndex('platform', 'platform', { unique: false });
      }
      
      // Companies store - H1B data cache
      if (!db.objectStoreNames.contains('companies')) {
        const companyStore = db.createObjectStore('companies', { keyPath: 'name' });
        companyStore.createIndex('h1bSponsors', 'h1bSponsors', { unique: false });
        companyStore.createIndex('lastChecked', 'lastChecked', { unique: false });
      }
      
      // Scams store - reported scams
      if (!db.objectStoreNames.contains('scams')) {
        const scamStore = db.createObjectStore('scams', { keyPath: 'id', autoIncrement: true });
        scamStore.createIndex('company', 'company', { unique: false });
        scamStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Whitelist store - trusted companies
      if (!db.objectStoreNames.contains('whitelist')) {
        const whitelistStore = db.createObjectStore('whitelist', { keyPath: 'company' });
        whitelistStore.createIndex('addedAt', 'addedAt', { unique: false });
      }
      
      console.log('ApplySafe: Database schema created');
    };
  });
}

// Save analyzed job
async function saveJob(jobData, analysis) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    
    const record = {
      url: jobData.url || window.location.href,
      title: jobData.title,
      company: jobData.company,
      location: jobData.location,
      salary: jobData.salary,
      platform: getPlatform(jobData.url || window.location.href),
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      redFlags: analysis.redFlags,
      positiveIndicators: analysis.positiveIndicators,
      aiSummary: analysis.analysis,
      h1bSponsorship: analysis.companyVerification?.h1bSponsorship,
      timestamp: Date.now()
    };
    
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all jobs
async function getAllJobs(limit = 100) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    const index = store.index('timestamp');
    
    const request = index.openCursor(null, 'prev'); // Newest first
    const results = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Search jobs
async function searchJobs(query) {
  if (!db) await initDB();
  
  const allJobs = await getAllJobs(500);
  const lowerQuery = query.toLowerCase();
  
  return allJobs.filter(job => 
    job.title?.toLowerCase().includes(lowerQuery) ||
    job.company?.toLowerCase().includes(lowerQuery) ||
    job.location?.toLowerCase().includes(lowerQuery)
  );
}

// Get jobs by company
async function getJobsByCompany(companyName) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    const index = store.index('company');
    
    const request = index.getAll(companyName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Cache company H1B data
async function cacheCompanyH1B(companyName, h1bData) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['companies'], 'readwrite');
    const store = transaction.objectStore('companies');
    
    const record = {
      name: companyName,
      h1bSponsors: h1bData.sponsors,
      totalApplications: h1bData.totalApplications,
      note: h1bData.note,
      lastChecked: Date.now()
    };
    
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get cached H1B data
async function getCachedH1B(companyName) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['companies'], 'readonly');
    const store = transaction.objectStore('companies');
    
    const request = store.get(companyName);
    request.onsuccess = () => {
      const result = request.result;
      // Cache valid for 7 days
      if (result && (Date.now() - result.lastChecked) < 7 * 24 * 60 * 60 * 1000) {
        resolve(result);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Report scam
async function reportScam(jobData, reason) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['scams'], 'readwrite');
    const store = transaction.objectStore('scams');
    
    const record = {
      url: jobData.url,
      title: jobData.title,
      company: jobData.company,
      reason: reason,
      timestamp: Date.now()
    };
    
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Add to whitelist
async function addToWhitelist(company, reason) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['whitelist'], 'readwrite');
    const store = transaction.objectStore('whitelist');
    
    const record = {
      company: company,
      reason: reason,
      addedAt: Date.now()
    };
    
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Check if company is whitelisted
async function isWhitelisted(company) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['whitelist'], 'readonly');
    const store = transaction.objectStore('whitelist');
    
    const request = store.get(company);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get statistics
async function getStats() {
  if (!db) await initDB();
  
  const allJobs = await getAllJobs(1000);
  
  const stats = {
    totalJobs: allJobs.length,
    scamsCaught: allJobs.filter(j => j.riskScore >= 60).length,
    safeJobs: allJobs.filter(j => j.riskScore < 40).length,
    h1bSponsors: allJobs.filter(j => j.h1bSponsorship?.sponsors).length,
    platforms: {},
    companiesScanned: new Set(allJobs.map(j => j.company).filter(Boolean)).size,
    avgRiskScore: allJobs.length > 0 
      ? Math.round(allJobs.reduce((sum, j) => sum + j.riskScore, 0) / allJobs.length) 
      : 0
  };
  
  // Count by platform
  allJobs.forEach(job => {
    stats.platforms[job.platform] = (stats.platforms[job.platform] || 0) + 1;
  });
  
  return stats;
}

// Helper function to extract platform from URL
function getPlatform(url) {
  if (!url) return 'Unknown';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('indeed.com')) return 'Indeed';
  if (url.includes('glassdoor.com')) return 'Glassdoor';
  if (url.includes('ziprecruiter.com')) return 'ZipRecruiter';
  if (url.includes('monster.com')) return 'Monster';
  if (url.includes('dice.com')) return 'Dice';
  return 'Other';
}

// Clear old jobs (keep last 90 days)
async function cleanOldJobs() {
  if (!db) await initDB();
  
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    const index = store.index('timestamp');
    
    const request = index.openCursor(IDBKeyRange.upperBound(ninetyDaysAgo));
    let deleteCount = 0;
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deleteCount++;
        cursor.continue();
      } else {
        console.log(`ApplySafe: Cleaned ${deleteCount} old jobs`);
        resolve(deleteCount);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDB,
    saveJob,
    getAllJobs,
    searchJobs,
    getJobsByCompany,
    cacheCompanyH1B,
    getCachedH1B,
    reportScam,
    addToWhitelist,
    isWhitelisted,
    getStats,
    cleanOldJobs
  };
}
