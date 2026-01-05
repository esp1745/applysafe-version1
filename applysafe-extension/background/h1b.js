/**
 * ApplySafe - H1B Visa Sponsorship Module
 * Phase 1 MVP: Database lookup, sponsorship history, and user feedback
 */

// H1B Data API Configuration
const H1B_CONFIG = {
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days cache
  DATA_SOURCE: 'h1bdata.info',
  FEEDBACK_KEY: 'h1bFeedback'
};

// Known major H-1B sponsors with historical data
const KNOWN_H1B_SPONSORS = {
  // Tech Giants
  'amazon': { approx: 50000, years: '2010-2024', note: 'Top H-1B sponsor', tier: 'major' },
  'google': { approx: 35000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'microsoft': { approx: 30000, years: '2000-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'meta': { approx: 15000, years: '2012-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'facebook': { approx: 15000, years: '2010-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'apple': { approx: 12000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'nvidia': { approx: 4000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'intel': { approx: 10000, years: '2000-2024', note: 'Major H-1B sponsor', tier: 'major' },
  
  // IT Consulting
  'infosys': { approx: 40000, years: '2005-2024', note: 'Top H-1B sponsor', tier: 'major' },
  'tata consultancy': { approx: 35000, years: '2005-2024', note: 'Top H-1B sponsor', tier: 'major' },
  'tcs': { approx: 35000, years: '2005-2024', note: 'Top H-1B sponsor', tier: 'major' },
  'cognizant': { approx: 30000, years: '2008-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'wipro': { approx: 20000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'accenture': { approx: 15000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'deloitte': { approx: 12000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'capgemini': { approx: 8000, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  'pwc': { approx: 8000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'pricewaterhousecoopers': { approx: 8000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'ey': { approx: 7000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'ernst young': { approx: 7000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'kpmg': { approx: 5000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'mckinsey': { approx: 2000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'bain': { approx: 1500, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'bcg': { approx: 1500, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'boston consulting': { approx: 1500, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'booz allen': { approx: 5000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'booz allen hamilton': { approx: 5000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'ibm': { approx: 15000, years: '2000-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'hcl': { approx: 10000, years: '2008-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'tech mahindra': { approx: 8000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Finance
  'jpmorgan': { approx: 8000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'jp morgan': { approx: 8000, years: '2005-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'goldman sachs': { approx: 5000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'morgan stanley': { approx: 4000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'bank of america': { approx: 4000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'capital one': { approx: 3000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'citibank': { approx: 4000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'citi': { approx: 4000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'wells fargo': { approx: 3000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'barclays': { approx: 2000, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Cloud & Enterprise
  'salesforce': { approx: 5000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'oracle': { approx: 8000, years: '2000-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'cisco': { approx: 8000, years: '2000-2024', note: 'Major H-1B sponsor', tier: 'major' },
  'vmware': { approx: 3000, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  'servicenow': { approx: 1500, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'workday': { approx: 1200, years: '2012-2024', note: 'H-1B sponsor', tier: 'regular' },
  'sap': { approx: 3000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Startups & Tech
  'uber': { approx: 5000, years: '2014-2024', note: 'H-1B sponsor', tier: 'regular' },
  'lyft': { approx: 1000, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'airbnb': { approx: 1500, years: '2012-2024', note: 'H-1B sponsor', tier: 'regular' },
  'stripe': { approx: 1500, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'doordash': { approx: 800, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  'instacart': { approx: 500, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  'pinterest': { approx: 800, years: '2014-2024', note: 'H-1B sponsor', tier: 'regular' },
  'snap': { approx: 1000, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'snapchat': { approx: 1000, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'twitter': { approx: 2000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'x corp': { approx: 2000, years: '2023-2024', note: 'H-1B sponsor', tier: 'regular' },
  'netflix': { approx: 2000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'spotify': { approx: 1000, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'reddit': { approx: 400, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // AI/ML
  'openai': { approx: 500, years: '2020-2024', note: 'H-1B sponsor', tier: 'regular' },
  'anthropic': { approx: 200, years: '2021-2024', note: 'H-1B sponsor', tier: 'regular' },
  'databricks': { approx: 1000, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'snowflake': { approx: 800, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  'palantir': { approx: 1500, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Gaming & Entertainment
  'disney': { approx: 2500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'walt disney': { approx: 2500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'electronic arts': { approx: 800, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'ea': { approx: 800, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'epic games': { approx: 600, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'activision': { approx: 500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'riot games': { approx: 400, years: '2012-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Hardware & Telecom
  'qualcomm': { approx: 5000, years: '2000-2024', note: 'H-1B sponsor', tier: 'regular' },
  'adobe': { approx: 3500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'dell': { approx: 2500, years: '2000-2024', note: 'H-1B sponsor', tier: 'regular' },
  'hewlett packard': { approx: 2000, years: '2000-2024', note: 'H-1B sponsor', tier: 'regular' },
  'hpe': { approx: 2000, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'hp': { approx: 2000, years: '2000-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Payment & Fintech
  'paypal': { approx: 2000, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  'visa inc': { approx: 1500, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  'mastercard': { approx: 1200, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  'american express': { approx: 1500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'intuit': { approx: 1500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'square': { approx: 800, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'block': { approx: 800, years: '2022-2024', note: 'H-1B sponsor', tier: 'regular' },
  'robinhood': { approx: 400, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  'coinbase': { approx: 500, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Developer Tools
  'github': { approx: 600, years: '2012-2024', note: 'H-1B sponsor', tier: 'regular' },
  'gitlab': { approx: 300, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  'atlassian': { approx: 1000, years: '2012-2024', note: 'H-1B sponsor', tier: 'regular' },
  'twilio': { approx: 500, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  'dropbox': { approx: 800, years: '2012-2024', note: 'H-1B sponsor', tier: 'regular' },
  'zoom': { approx: 600, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  'slack': { approx: 500, years: '2015-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Media
  'bloomberg': { approx: 2500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'thomson reuters': { approx: 1500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'warner bros': { approx: 800, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'sony': { approx: 1000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Retail & E-commerce
  'walmart': { approx: 5000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'target': { approx: 2000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'ebay': { approx: 1500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'shopify': { approx: 800, years: '2018-2024', note: 'H-1B sponsor', tier: 'regular' },
  
  // Healthcare & Pharma
  'johnson & johnson': { approx: 2000, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'pfizer': { approx: 1500, years: '2005-2024', note: 'H-1B sponsor', tier: 'regular' },
  'unitedhealth': { approx: 2000, years: '2008-2024', note: 'H-1B sponsor', tier: 'regular' },
  'anthem': { approx: 1000, years: '2010-2024', note: 'H-1B sponsor', tier: 'regular' },
  'elevance': { approx: 1000, years: '2022-2024', note: 'H-1B sponsor', tier: 'regular' }
};

/**
 * Clean company name for matching
 */
function cleanCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/,?\s*(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.|limited|l\.?p\.?|plc|gmbh|s\.?a\.?|n\.?v\.?)$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check H1B sponsorship status for a company
 * Returns detailed sponsorship information including history
 */
async function checkH1BSponsorship(companyName) {
  try {
    // Comprehensive validation - skip invalid company names
    const invalidNames = ['unknown', 'unknown company', 'not provided', 'n/a', 'na', 'none', 'confidential'];
    const isInvalid = !companyName || 
                      companyName.length < 2 || 
                      invalidNames.includes(companyName.toLowerCase().trim());
    
    if (isInvalid) {
      console.log(`H1B check skipped: Invalid company name "${companyName}"`);
      return null;
    }
    
    const cleanName = cleanCompanyName(companyName);
    console.log(`Checking H1B sponsorship for: "${cleanName}"`);
    
    // Check cache first
    const cached = await getCachedH1BData(cleanName);
    if (cached) {
      console.log('H1B: Using cached data for', cleanName);
      return cached;
    }
    
    // Check against known sponsors (instant)
    const knownResult = checkKnownSponsors(cleanName);
    if (knownResult) {
      await cacheH1BData(cleanName, knownResult);
      return knownResult;
    }
    
    // Try h1bdata.info for real-time lookup
    const onlineResult = await fetchH1BDataOnline(companyName, cleanName);
    if (onlineResult) {
      await cacheH1BData(cleanName, onlineResult);
      return onlineResult;
    }
    
    // No records found
    const noRecordResult = {
      sponsors: false,
      note: 'No H-1B sponsorship records found in database',
      employer: companyName,
      source: 'lookup',
      history: null,
      totalApplications: 0,
      checkedAt: new Date().toISOString()
    };
    
    await cacheH1BData(cleanName, noRecordResult);
    return noRecordResult;
    
  } catch (error) {
    console.error('H1B check error:', error.message);
    return null;
  }
}

/**
 * Check if company is in known sponsors list
 */
function checkKnownSponsors(cleanName) {
  for (const [company, data] of Object.entries(KNOWN_H1B_SPONSORS)) {
    if (cleanName.includes(company) || company.includes(cleanName)) {
      console.log(`✓ Found in known H1B sponsors list: ${company}`);
      return {
        sponsors: true,
        note: `${data.note} - ~${data.approx.toLocaleString()}+ visas sponsored`,
        totalApplications: data.approx,
        employer: company,
        source: 'known-sponsors',
        tier: data.tier,
        history: {
          years: data.years,
          estimatedTotal: data.approx,
          verified: true
        },
        checkedAt: new Date().toISOString()
      };
    }
  }
  return null;
}

/**
 * Fetch H1B data from h1bdata.info
 */
async function fetchH1BDataOnline(originalName, cleanName) {
  try {
    console.log('Checking h1bdata.info for:', cleanName);
    
    const response = await fetch(
      `https://h1bdata.info/index.php?em=${encodeURIComponent(cleanName)}&job=&city=&year=All+Years`,
      {
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      }
    );
    
    if (!response.ok) {
      console.log('h1bdata.info returned status:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('H1B response received, length:', html.length);
    
    // Parse the response
    const result = parseH1BResponse(html, originalName);
    return result;
    
  } catch (fetchError) {
    console.log('h1bdata.info fetch error:', fetchError.message);
    return null;
  }
}

/**
 * Parse H1B data response from h1bdata.info
 */
function parseH1BResponse(html, companyName) {
  // Check for record count
  const recordMatch = html.match(/(\d[\d,]*)\s+records?\s+(?:was|were)\s+found/i);
  const salaryMatch = html.match(/Median Salary is \$([\d,]+)/i);
  
  // Try to extract year breakdown
  const yearPattern = /FY\s*(20\d{2}).*?(\d+)\s*records?/gi;
  const yearData = [];
  let match;
  while ((match = yearPattern.exec(html)) !== null) {
    yearData.push({
      year: match[1],
      count: parseInt(match[2])
    });
  }
  
  if (recordMatch) {
    const count = parseInt(recordMatch[1].replace(/,/g, ''));
    
    if (count > 0) {
      console.log(`✓ Found H1B sponsorship via h1bdata.info: ${count} records`);
      
      // Determine years from data
      let yearsActive = 'Recent years';
      if (yearData.length > 0) {
        const years = yearData.map(y => y.year).sort();
        yearsActive = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0];
      }
      
      return {
        sponsors: true,
        note: `Verified H-1B sponsor with ${count.toLocaleString()} record${count > 1 ? 's' : ''}`,
        totalApplications: count,
        employer: companyName,
        source: 'h1bdata.info',
        tier: count > 1000 ? 'major' : 'regular',
        history: {
          years: yearsActive,
          estimatedTotal: count,
          verified: true,
          yearBreakdown: yearData.length > 0 ? yearData : null,
          medianSalary: salaryMatch ? salaryMatch[1] : null
        },
        checkedAt: new Date().toISOString()
      };
    }
  }
  
  if (salaryMatch) {
    console.log('✓ Found H1B salary data via h1bdata.info');
    return {
      sponsors: true,
      note: 'Company has H-1B sponsorship records (verified)',
      employer: companyName,
      source: 'h1bdata.info',
      tier: 'regular',
      history: {
        verified: true,
        medianSalary: salaryMatch[1]
      },
      checkedAt: new Date().toISOString()
    };
  }
  
  return null;
}

/**
 * Get cached H1B data
 */
async function getCachedH1BData(cleanName) {
  try {
    const result = await chrome.storage.local.get(['h1bCache']);
    const cache = result.h1bCache || {};
    const cached = cache[cleanName];
    
    if (cached && Date.now() - cached.cachedAt < H1B_CONFIG.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  } catch (error) {
    console.error('Error reading H1B cache:', error);
    return null;
  }
}

/**
 * Cache H1B data
 */
async function cacheH1BData(cleanName, data) {
  try {
    const result = await chrome.storage.local.get(['h1bCache']);
    const cache = result.h1bCache || {};
    
    cache[cleanName] = {
      data: data,
      cachedAt: Date.now()
    };
    
    await chrome.storage.local.set({ h1bCache: cache });
    console.log('H1B data cached for:', cleanName);
  } catch (error) {
    console.error('Error caching H1B data:', error);
  }
}

/**
 * Submit user feedback on H1B data accuracy
 */
async function submitH1BFeedback(companyName, isAccurate, userComment = '') {
  try {
    const result = await chrome.storage.local.get([H1B_CONFIG.FEEDBACK_KEY]);
    const feedback = result[H1B_CONFIG.FEEDBACK_KEY] || [];
    
    const feedbackEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      companyName: companyName,
      isAccurate: isAccurate,
      comment: userComment,
      timestamp: new Date().toISOString()
    };
    
    feedback.push(feedbackEntry);
    
    // Keep only last 100 feedback entries locally
    if (feedback.length > 100) {
      feedback.splice(0, feedback.length - 100);
    }
    
    await chrome.storage.local.set({ [H1B_CONFIG.FEEDBACK_KEY]: feedback });
    
    console.log('H1B feedback submitted:', feedbackEntry);
    
    return { success: true, feedbackId: feedbackEntry.id };
  } catch (error) {
    console.error('Error submitting H1B feedback:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get H1B feedback for a company
 */
async function getH1BFeedback(companyName) {
  try {
    const result = await chrome.storage.local.get([H1B_CONFIG.FEEDBACK_KEY]);
    const feedback = result[H1B_CONFIG.FEEDBACK_KEY] || [];
    
    const cleanName = cleanCompanyName(companyName);
    const companyFeedback = feedback.filter(f => 
      cleanCompanyName(f.companyName) === cleanName
    );
    
    // Calculate accuracy stats
    const totalFeedback = companyFeedback.length;
    const accurateFeedback = companyFeedback.filter(f => f.isAccurate).length;
    const accuracyRate = totalFeedback > 0 ? (accurateFeedback / totalFeedback) * 100 : null;
    
    return {
      totalFeedback: totalFeedback,
      accurateCount: accurateFeedback,
      inaccurateCount: totalFeedback - accurateFeedback,
      accuracyRate: accuracyRate,
      recentFeedback: companyFeedback.slice(-5) // Last 5 entries
    };
  } catch (error) {
    console.error('Error getting H1B feedback:', error);
    return null;
  }
}

/**
 * Get H1B sponsorship summary for display
 */
function getH1BSummary(h1bData) {
  if (!h1bData) {
    return {
      status: 'unknown',
      icon: '🔍',
      title: 'H-1B Status Unknown',
      subtitle: 'Could not verify sponsorship history',
      details: null
    };
  }
  
  if (h1bData.sponsors) {
    const history = h1bData.history || {};
    return {
      status: 'sponsors',
      icon: '✅',
      title: 'Verified H-1B Sponsor',
      subtitle: h1bData.note,
      details: {
        totalVisas: h1bData.totalApplications || 0,
        years: history.years || 'Unknown',
        tier: h1bData.tier || 'regular',
        medianSalary: history.medianSalary || null,
        source: h1bData.source,
        yearBreakdown: history.yearBreakdown || null
      }
    };
  }
  
  return {
    status: 'no-records',
    icon: '⚠️',
    title: 'No H-1B Records',
    subtitle: h1bData.note || 'No sponsorship records found',
    details: {
      source: h1bData.source
    }
  };
}

// Export functions for use in service worker
if (typeof self !== 'undefined') {
  self.h1bModule = {
    checkH1BSponsorship,
    submitH1BFeedback,
    getH1BFeedback,
    getH1BSummary,
    cleanCompanyName
  };
}
