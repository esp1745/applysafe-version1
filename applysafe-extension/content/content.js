/**
 * ApplySafe - Content Script
 * Detects and extracts job posting data from various job sites
 * Injects warning overlays for suspicious postings
 */

(function() {
  'use strict';

  // Track if we've already processed this page
  let processed = false;
  let currentJobData = null;
  let warningBadge = null;

  // Site-specific selectors for extracting job data
  const SITE_SELECTORS = {
    'linkedin.com': {
      title: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .t-24.t-bold, h1.t-24, .jobs-details h1, .job-details h1, h1[class*="job"]',
      company: '.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .jobs-unified-top-card__subtitle-primary-grouping a, .job-details-jobs-unified-top-card__primary-description-without-tagline a, a.app-aware-link[href*="/company/"], .artdeco-entity-lockup__subtitle a, .jobs-company__name a, .jobs-company__name, [data-test-id="job-details-jobs-unified-top-card__company-name"], span[class*="company-name"]',
      description: '.jobs-description__content, .jobs-box__html-content, .jobs-description-content__text, #job-details, .jobs-details__main-content',
      salary: '.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .salary-main-rail__salary-range',
      location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-container span',
      posted: '.jobs-unified-top-card__posted-date',
      applicants: '.jobs-unified-top-card__applicant-count',
      container: '.jobs-search__job-details, .job-view-layout, .jobs-details'
    },
    'indeed.com': {
      title: 'h1.jobsearch-JobInfoHeader-title, h1[class*="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title span, [data-testid="jobsearch-JobInfoHeader-title"], h1.icl-u-xs-mb--xs, .jobsearch-ViewJobLayout h1, #viewJobSSRRoot h1',
      company: '[data-company], [data-testid="inlineHeader-companyName"], a[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating-companyHeader, .icl-u-lg-mr--sm, [data-testid="company-name"], [class*="companyName"]',
      description: '#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid="jobDescriptionText"], [id*="jobDescriptionText"], div[class*="jobDescription"]',
      salary: '#salaryInfoAndJobType, [data-testid="attribute_snippet_testid"], .icl-u-xs-mt--xs, [data-testid="salaryInfoAndJobType"], .salary-snippet, .jobsearch-JobMetadataHeader-item, [class*="salary"]',
      location: '[data-testid="inlineHeader-companyLocation"], div[data-testid="inlineHeader-companyLocation"], .jobsearch-JobInfoHeader-subtitle, [data-testid="job-location"], .css-1ojh0uo, .companyLocation, [class*="companyLocation"]',
      posted: '.jobsearch-HiringInsights-entry--bullet, [data-testid="myJobsStateDate"], [class*="date"]',
      container: '.jobsearch-ViewJobLayout-jobDisplay, .jobsearch-JobComponent, #viewJobSSRRoot'
    },
    'glassdoor.com': {
      title: '[data-test="job-title"], [class*="JobDetails"] h1, h1[class*="job"], .JobDetails__Title',
      company: '[data-test="employer-name"], [data-test="employerName"], .EmployerProfile_employerName, [class*="EmployerProfile"] a, .JobDetails__EmployerProfile a, div[data-test="employerName"], h4',
      description: '[data-test="jobDescriptionWrapper"], [class*="JobDetails__JobDescriptionContainer"], .JobDetails__JobDescription, [class*="jobDescriptionContent"], #JobDescriptionContainer, .desc',
      salary: '[data-test="detailSalary"], [class*="SalaryEstimate"]',
      location: '[data-test="location"], .location',
      container: '[id*="JobView"], .JobDetails, [class*="JobView"]'
    },
    'ziprecruiter.com': {
      title: '.job_title, .hiring-entity-header h1',
      company: '.hiring_entity_name, .job_company',
      description: '.job_description, .jobDescriptionSection',
      salary: '.job_salary',
      location: '.location_text, .job_location',
      container: '.job_content'
    },
    'monster.com': {
      title: '.job-title, h1[name="job-title"]',
      company: '.company-name, [data-testid="company-name"]',
      description: '.job-description, [data-testid="job-description"]',
      salary: '.salary-info',
      location: '.location',
      container: '.job-content'
    },
    'dice.com': {
      title: '[data-cy="jobTitle"], .job-title',
      company: '[data-cy="companyNameLink"], .company-name',
      description: '[data-cy="jobDescription"], .job-description',
      salary: '[data-cy="compensationText"]',
      location: '[data-cy="locationText"]',
      container: '.job-details-container'
    },
    'greenhouse.io': {
      title: '.app-title, h1.heading, h1',
      company: '.company-name, .employer-name, [class*="company"]',
      description: '#content, .content, .job-description, [class*="description"]',
      salary: '[class*="salary"], [class*="compensation"]',
      location: '.location, [class*="location"]',
      container: '#app_body, .application, main'
    },
    'lever.co': {
      title: '.posting-headline h2, h1.posting-headline, h2',
      company: '.posting-company, [class*="company"]',
      description: '.posting-page .content, .section-wrapper, [data-qa="job-description"]',
      salary: '[class*="salary"], [class*="compensation"]',
      location: '.posting-categories .location, .location, [class*="location"]',
      container: '.posting-page, .content-wrapper, main'
    },
    'myworkdayjobs.com': {
      title: '[data-automation-id="jobPostingHeader"], h2[data-automation-id], h1',
      company: '[data-automation-id="companyName"], [class*="company"]',
      description: '[data-automation-id="jobPostingDescription"], [class*="description"]',
      salary: '[data-automation-id="salary"], [class*="salary"]',
      location: '[data-automation-id="location"], [class*="location"]',
      container: '[data-automation-id="jobPostingPage"], main'
    },
    'bamboohr.com': {
      title: 'h1.JobDetails__title, h1',
      company: '.JobDetails__company, [class*="company"]',
      description: '.JobDetails__description, [class*="description"]',
      salary: '[class*="salary"], [class*="compensation"]',
      location: '.JobDetails__location, [class*="location"]',
      container: '.JobDetails, main'
    },
    'icims.com': {
      title: '.iCIMS_Header h1, h1',
      company: '.iCIMS_CompanyName, [class*="company"]',
      description: '.iCIMS_JobContent, [class*="description"]',
      salary: '[class*="salary"]',
      location: '.iCIMS_JobLocation, [class*="location"]',
      container: '.iCIMS_MainWrapper, main'
    },
    'smartrecruiters.com': {
      title: 'h1.job-title, h1',
      company: '.company-name, [class*="company"]',
      description: '.job-description, [class*="description"]',
      salary: '[class*="salary"]',
      location: '.job-location, [class*="location"]',
      container: '.job-details, main'
    },
    'jobvite.com': {
      title: 'h1.jv-header, h1',
      company: '.jv-company-name, [class*="company"]',
      description: '.jv-job-detail-description, [class*="description"]',
      salary: '[class*="salary"]',
      location: '.jv-job-detail-meta .location, [class*="location"]',
      container: '.jv-job-detail, main'
    },
    'ashbyhq.com': {
      title: 'h1[class*="Title"], h1',
      company: '[class*="CompanyName"], [class*="company"]',
      description: '[class*="Description"], [class*="JobDescription"]',
      salary: '[class*="Compensation"], [class*="salary"]',
      location: '[class*="Location"]',
      container: '[class*="JobPosting"], main'
    },
    'breezy.hr': {
      title: '.position-title h1, h1',
      company: '.company-name, [class*="company"]',
      description: '.position-description, [class*="description"]',
      salary: '[class*="salary"]',
      location: '.position-location, [class*="location"]',
      container: '.position-page, main'
    },
    'google.com': {
      title: 'h1, h2, h3[class*="title"], [role="heading"], [class*="job-title"]',
      company: '[class*="company"], [class*="employer"], [itemprop="hiringOrganization"]',
      description: '[class*="description"], [itemprop="description"], [role="article"], section, article, div[class*="content"]',
      salary: '[class*="salary"], [class*="compensation"], [class*="pay"]',
      location: '[class*="location"], [itemprop="jobLocation"], [class*="address"]',
      container: 'main, [role="main"], body'
    },
    'default': {
      title: 'h1, [class*="title"], [class*="Title"]',
      company: '[class*="company"], [class*="Company"], [class*="employer"]',
      description: '[class*="description"], [class*="Description"], article',
      salary: '[class*="salary"], [class*="Salary"], [class*="compensation"]',
      location: '[class*="location"], [class*="Location"]',
      container: 'main, article, [role="main"]'
    }
  };

  // Initialize content script
  function init() {
    if (processed) return;
    
    console.log('ApplySafe: Content script initializing...');
    
    // Listen for messages from popup FIRST
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', processPage);
    } else {
      // Page already loaded, process immediately
      setTimeout(processPage, 100); // Small delay to ensure DOM is ready
    }
    
    // Watch for dynamic content changes (SPAs)
    observePageChanges();
  }

  // Check if this is actually a job posting page (not a profile, feed, etc.)
  function isJobPostingPage() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    // LinkedIn-specific checks
    if (hostname.includes('linkedin.com')) {
      // Valid job URLs contain /jobs/ or /job-view/
      if (url.includes('/jobs/view/') || url.includes('/jobs/collections/')) {
        return true;
      }
      // Exclude profile pages, feed, messaging, etc.
      if (url.includes('/in/') || url.includes('/feed') || url.includes('/messaging') || 
          url.includes('/mynetwork') || url.includes('/notifications')) {
        console.log('ApplySafe: Skipping - this is a LinkedIn profile/feed page, not a job posting');
        return false;
      }
      // Generic /jobs/ might be job search results
      if (url.includes('/jobs/')) {
        return true;
      }
      return false;
    }
    
    // Indeed - must be viewing a specific job
    if (hostname.includes('indeed.com')) {
      if (url.includes('/viewjob') || url.includes('/job/') || url.includes('jk=')) {
        return true;
      }
      return false;
    }
    
    // Glassdoor - job listings
    if (hostname.includes('glassdoor.com')) {
      if (url.includes('/job-listing/') || url.includes('/Job/')) {
        return true;
      }
      return false;
    }
    
    // For other job sites, assume they're job pages (they're more specialized)
    return true;
  }

  // Process the current page
  function processPage() {
    if (processed) {
      console.log('ApplySafe: Page already processed, skipping');
      return;
    }
    
    // Check if this is actually a job posting page
    if (!isJobPostingPage()) {
      console.log('ApplySafe: Not a job posting page, skipping analysis');
      processed = true;
      currentJobData = null;
      return;
    }
    
    processed = true;
    console.log('ApplySafe: Processing page...');
    
    // Extract job data
    currentJobData = extractJobData();
    
    if (currentJobData && currentJobData.title) {
      console.log('ApplySafe: Job data extracted successfully');
      
      // Notify background script
      try {
        chrome.runtime.sendMessage({
          action: 'jobDetected',
          jobData: currentJobData,
          url: window.location.href
        }).catch(err => {
          console.log('ApplySafe: Background connection not ready yet');
        });
      } catch (error) {
        console.log('ApplySafe: Extension context invalidated');
      }
      
      // Auto-analyze if enabled
      autoAnalyze().catch(err => {
        console.log('ApplySafe: Auto-analysis error', err);
      });
    } else {
      console.log('ApplySafe: No valid job data found on page');
    }
  }

  // Extract job data from the page
  function extractJobData() {
    const hostname = window.location.hostname;
    let selectors = SITE_SELECTORS.default;
    
    // Find matching site selectors
    for (const site of Object.keys(SITE_SELECTORS)) {
      if (hostname.includes(site)) {
        selectors = { ...SITE_SELECTORS.default, ...SITE_SELECTORS[site] };
        console.log('ApplySafe: Using selectors for:', site);
        break;
      }
    }
    
    // Debug: Log available headings and text on page
    if (hostname.includes('google.com') || hostname.includes('careers')) {
      console.log('ApplySafe: Debug - Page structure:');
      const h1s = document.querySelectorAll('h1');
      const h2s = document.querySelectorAll('h2');
      const h3s = document.querySelectorAll('h3');
      console.log('H1s found:', h1s.length, Array.from(h1s).map(h => h.textContent.trim().substring(0, 50)));
      console.log('H2s found:', h2s.length, Array.from(h2s).map(h => h.textContent.trim().substring(0, 50)));
      console.log('H3s found:', h3s.length, Array.from(h3s).map(h => h.textContent.trim().substring(0, 50)));
      console.log('Page title:', document.title);
    }
    
    // Extract data using selectors
    let company = extractText(selectors.company);
    
    // Clean company name (remove ratings, extra whitespace, etc.)
    if (company) {
      company = company
        .replace(/\n[\d.]+$/, '')  // Remove rating like "\n3.8"
        .replace(/\s*\d+\.?\d*\s*★.*$/, '')  // Remove star ratings
        .replace(/\s*\(\d+\).*$/, '')  // Remove review counts
        .split('\n')[0]  // Take only first line
        .trim();
    }
    
    const data = {
      title: extractText(selectors.title, { isTitle: true }),
      company: company,
      description: extractText(selectors.description),
      salary: extractText(selectors.salary),
      location: extractText(selectors.location),
      posted: extractText(selectors.posted),
      applicants: extractText(selectors.applicants),
      url: window.location.href,
      timestamp: Date.now()
    };
    
    // Extract additional metadata
    data.contactEmail = extractEmails(data.description);
    data.contactPhone = extractPhones(data.description);
    data.companyDomain = extractCompanyDomain();
    data.pageMetadata = extractMetadata();
    data.companyWebsite = extractCompanyWebsite();
    
    // LinkedIn-specific company extraction fallback
    if ((!data.company || data.company.length < 2) && window.location.hostname.includes('linkedin.com')) {
      console.log('ApplySafe: Attempting LinkedIn company extraction fallbacks...');
      
      // Try various LinkedIn-specific selectors
      const linkedinCompanySelectors = [
        // New LinkedIn job card layout
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        // Company link in header
        'a[href*="/company/"]',
        // Company name near job title  
        '.jobs-top-card__company-url',
        '.topcard__org-name-link',
        // Any link containing company
        '.jobs-unified-top-card a[data-control-name*="company"]',
        // Fallback to any company-related element
        '[class*="company-name"]',
        '[class*="companyName"]'
      ];
      
      for (const selector of linkedinCompanySelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          // Validate it's a reasonable company name (not too long, not empty)
          if (text.length >= 2 && text.length < 100 && !text.includes('\n')) {
            data.company = text;
            console.log('ApplySafe: Company found via LinkedIn fallback:', data.company, 'using selector:', selector);
            break;
          }
        }
      }
      
      // Last resort: Extract company from any /company/ link URL
      if (!data.company || data.company.length < 2) {
        const companyLink = document.querySelector('a[href*="/company/"]');
        if (companyLink) {
          const href = companyLink.getAttribute('href');
          const match = href.match(/\/company\/([^/?]+)/);
          if (match && match[1]) {
            // Convert URL slug to title case (e.g., "amazon" -> "Amazon")
            const slug = match[1].replace(/-/g, ' ');
            data.company = slug.charAt(0).toUpperCase() + slug.slice(1);
            console.log('ApplySafe: Company extracted from LinkedIn URL slug:', data.company);
          }
        }
      }
    }
    
    // Fallback 1: Try to extract company from page title if not found
    if (!data.company || data.company.length < 2) {
      const pageTitle = document.title;
      
      // LinkedIn title format: "Job Title | Company Name | LinkedIn" or "(X) Job Title | Company"
      if (window.location.hostname.includes('linkedin.com')) {
        // Remove notification count like "(3)"
        const cleanTitle = pageTitle.replace(/^\(\d+\)\s*/, '');
        const parts = cleanTitle.split('|').map(p => p.trim());
        
        // Usually: [Job Title, Company Name, LinkedIn]
        if (parts.length >= 2) {
          const potentialCompany = parts[1];
          if (potentialCompany && potentialCompany.toLowerCase() !== 'linkedin' && potentialCompany.length > 1) {
            data.company = potentialCompany;
            console.log('ApplySafe: Company extracted from LinkedIn page title:', data.company);
          }
        }
      }
      // Google Careers format: "JobTitle - Google Careers"
      else if (pageTitle.includes('Google')) {
        data.company = 'Google';
        console.log('ApplySafe: Company extracted as Google from title');
      }
      // Glassdoor titles often format as "JobTitle - CompanyName | Glassdoor"
      else {
        const titleMatch = pageTitle.match(/^[^-]+-\s*([^|]+)/);
        if (titleMatch && titleMatch[1]) {
          const potentialCompany = titleMatch[1].trim();
          // Validate it's not just site name
          const excludedWords = ['glassdoor', 'indeed', 'linkedin', 'careers', 'jobs'];
          const isValid = potentialCompany.length > 2 && 
                         !excludedWords.some(word => potentialCompany.toLowerCase().includes(word));
          if (isValid) {
            data.company = potentialCompany;
            console.log('ApplySafe: Company extracted from page title:', data.company);
          }
        }
      }
    }
    
    // Fallback 2: Try to extract from URL hostname
    if (!data.company || data.company.length < 2) {
      const hostname = window.location.hostname;
      // Check if it's a company career site (e.g., careers.microsoft.com)
      if (hostname.includes('careers.')) {
        const companyFromUrl = hostname.split('.')[1];
        if (companyFromUrl && companyFromUrl.length > 2) {
          data.company = companyFromUrl.charAt(0).toUpperCase() + companyFromUrl.slice(1);
          console.log('ApplySafe: Company extracted from URL:', data.company);
        }
      }
    }
    
    // Fallback 3: If still no title, try to get ANY h1, h2, or h3
    if (!data.title || data.title.length < 3) {
      const headings = document.querySelectorAll('h1, h2');
      for (const heading of headings) {
        const text = heading.textContent.trim();
        if (text.length > 5 && text.length < 200) {
          data.title = text;
          console.log('ApplySafe: Title extracted from heading fallback:', data.title);
          break;
        }
      }
    }
    
    // Fallback 4: If still no description, get main content
    if (!data.description || data.description.length < 50) {
      const mainContent = document.querySelector('main, article, [role="main"]');
      if (mainContent) {
        data.description = mainContent.textContent.trim();
        console.log('ApplySafe: Description extracted from main content, length:', data.description.length);
      }
    }
    
    // Debug logging
    console.log('ApplySafe: Final extracted job data:', {
      title: data.title,
      company: data.company,
      descriptionLength: data.description?.length || 0,
      salary: data.salary,
      location: data.location,
      companyWebsite: data.companyWebsite
    });
    
    // If title or company looks wrong, log warning
    if (!data.title || data.title === 'Indeed' || data.title.length < 3) {
      console.warn('ApplySafe: Invalid title extracted. Selectors may need updating for this site.');
    }
    if (!data.company || data.company === 'Unknown' || data.company.length < 2) {
      console.warn('ApplySafe: Invalid company extracted. H1B check will be skipped.');
    }
    
    return data;
  }

  // Extract text content from selector
  function extractText(selector, options = {}) {
    if (!selector) return '';
    
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.innerText || el.textContent;
      if (text && text.trim()) {
        let cleanText = text.trim();
        
        // Skip if it's just the site name or generic text
        if (cleanText.length < 3 || cleanText.toLowerCase().includes('indeed.com') || cleanText === 'Indeed') {
          continue;
        }
        
        // If this is for title extraction, apply additional filters
        if (options.isTitle) {
          // Skip welcome messages and greetings
          if (/^(welcome|hello|hi|hey|dear|greetings),?\s+/i.test(cleanText)) {
            continue;
          }
          // Skip navigation/menu items
          if (cleanText.toLowerCase().includes('my jobs') || 
              cleanText.toLowerCase().includes('messages') ||
              cleanText.toLowerCase().includes('notifications')) {
            continue;
          }
          
          // Clean up job title text
          cleanText = cleanText
            .replace(/\s*-\s*job post$/i, '')  // Remove "- job post"
            .replace(/\s*\|\s*indeed$/i, '')   // Remove "| Indeed"
            .replace(/\n+/g, ' ')              // Replace newlines with space
            .replace(/\s+/g, ' ')              // Normalize multiple spaces
            .trim();
        }
        
        return cleanText;
      }
    }
    return '';
  }

  // Extract email addresses from text
  function extractEmails(text) {
    if (!text) return [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(text.match(emailRegex) || [])];
  }

  // Extract phone numbers from text
  function extractPhones(text) {
    if (!text) return [];
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    return [...new Set(text.match(phoneRegex) || [])];
  }

  // Extract company domain from page
  function extractCompanyDomain() {
    // Try to find company website links
    const links = document.querySelectorAll('a[href*="company"], a[href*="website"]');
    for (const link of links) {
      try {
        const url = new URL(link.href);
        if (!url.hostname.includes('linkedin') && 
            !url.hostname.includes('indeed') &&
            !url.hostname.includes('glassdoor')) {
          return url.hostname;
        }
      } catch (e) {}
    }
    return null;
  }

  // Extract company website URL
  function extractCompanyWebsite() {
    // Look for company website links in the page
    const selectors = [
      'a[href*="careers"]',
      'a[href*="jobs"]',
      'a[data-testid*="company"]',
      'a[class*="company"]',
      'a[class*="employer"]'
    ];
    
    for (const selector of selectors) {
      const links = document.querySelectorAll(selector);
      for (const link of links) {
        try {
          const url = new URL(link.href);
          // Exclude job board domains
          if (!url.hostname.includes('linkedin') && 
              !url.hostname.includes('indeed') &&
              !url.hostname.includes('glassdoor') &&
              !url.hostname.includes('ziprecruiter') &&
              !url.hostname.includes('monster')) {
            return link.href;
          }
        } catch (e) {}
      }
    }
    return null;
  }

  // Extract page metadata
  function extractMetadata() {
    return {
      pageTitle: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogDescription: document.querySelector('meta[property="og:description"]')?.content
    };
  }

  // Handle messages from popup/background
  function handleMessage(request, sender, sendResponse) {
    console.log('ApplySafe: Message received:', request.action);
    
    switch (request.action) {
      case 'reprocessPage':
        // Re-extract job data (for popup opening)
        console.log('ApplySafe: Reprocess page requested');
        // Only extract if this is actually a job posting page
        if (isJobPostingPage()) {
          currentJobData = extractJobData();
        } else {
          currentJobData = null;
          console.log('ApplySafe: Not a job posting page, setting job data to null');
        }
        sendResponse({ success: true });
        break;
        
      case 'getJobData':
        // If we don't have job data yet, try to extract it now
        if (!currentJobData) {
          console.log('ApplySafe: No cached job data, extracting now...');
          // Only extract if this is actually a job posting page
          if (isJobPostingPage()) {
            currentJobData = extractJobData();
          } else {
            currentJobData = null;
            console.log('ApplySafe: Not a job posting page');
          }
        }
        sendResponse({ jobData: currentJobData });
        console.log('ApplySafe: Sent job data:', currentJobData ? 'available' : 'null');
        break;
        
      case 'showWarning':
        showWarningBadge(request.analysis);
        sendResponse({ success: true });
        break;
        
      case 'hideWarning':
        hideWarningBadge();
        sendResponse({ success: true });
        break;
        
      case 'ping':
        sendResponse({ alive: true });
        break;
        
      case 'forceAnalyze':
        // Force re-extraction and re-analysis
        console.log('ApplySafe: Force analyze requested');
        processed = false;
        currentJobData = null;
        hideWarningBadge();
        
        // Re-extract and process
        setTimeout(() => {
          processPage();
          sendResponse({ success: true });
        }, 100);
        
        return true; // Keep channel open for async
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  }

  // Auto-analyze job posting
  async function autoAnalyze() {
    try {
      const settings = await chrome.storage.local.get(['settings']);
      
      // Check if auto-analyze is enabled (default to true)
      if (settings.settings?.autoAnalyze === false) {
        console.log('ApplySafe: Auto-analyze disabled');
        return;
      }
      
      // Check whitelist
      const domain = window.location.hostname;
      if (settings.settings?.whitelist && settings.settings.whitelist.includes(domain)) {
        console.log('ApplySafe: Domain whitelisted');
        return;
      }
      
      if (!currentJobData || !currentJobData.title) {
        console.log('ApplySafe: No job data to analyze');
        return;
      }
      
      console.log('ApplySafe: Starting auto-analysis...');
      
      // Request analysis with timeout
      const analysisPromise = chrome.runtime.sendMessage({
        action: 'analyzeJob',
        jobData: currentJobData,
        url: window.location.href,
        autoAnalysis: true
      });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), 15000)
      );
      
      const response = await Promise.race([analysisPromise, timeoutPromise]);
      
      console.log('ApplySafe: Auto-analysis response:', response);
      
      if (response && response.success && response.result) {
        if (response.result.riskScore > 30) {
          showWarningBadge(response.result);
        }
      }
    } catch (error) {
      console.log('ApplySafe: Auto-analysis error:', error.message);
    }
  }

  // Show warning badge on the page
  function showWarningBadge(analysis) {
    // Remove existing badge
    hideWarningBadge();
    
    // Create badge container
    warningBadge = document.createElement('div');
    warningBadge.id = 'applysafe-warning-badge';
    warningBadge.className = `applysafe-badge applysafe-${getRiskLevel(analysis.riskScore)}`;
    
    // Badge HTML
    warningBadge.innerHTML = `
      <div class="applysafe-badge-header">
        <div class="applysafe-badge-icon">
          ${getShieldIcon(analysis.riskScore)}
        </div>
        <div class="applysafe-badge-info">
          <div class="applysafe-badge-title">ApplySafe Analysis</div>
          <div class="applysafe-badge-score">Risk Score: ${analysis.riskScore}/100</div>
        </div>
        <button class="applysafe-badge-toggle" aria-label="Expand details">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <button class="applysafe-badge-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="applysafe-badge-content">
        <div class="applysafe-badge-verdict">${getVerdictText(analysis.riskScore)}</div>
        ${analysis.redFlags && analysis.redFlags.length > 0 ? `
          <div class="applysafe-badge-section">
            <div class="applysafe-badge-section-title">⚠️ Red Flags</div>
            <ul class="applysafe-badge-list">
              ${analysis.redFlags.slice(0, 3).map(f => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${analysis.positiveIndicators && analysis.positiveIndicators.length > 0 ? `
          <div class="applysafe-badge-section">
            <div class="applysafe-badge-section-title">✓ Positive Signs</div>
            <ul class="applysafe-badge-list applysafe-positive">
              ${analysis.positiveIndicators.slice(0, 3).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        <div class="applysafe-badge-explanation">
          ${escapeHtml(analysis.explanation || '')}
        </div>
        <div class="applysafe-badge-actions">
          <button class="applysafe-btn applysafe-btn-report">Report Scam</button>
          <button class="applysafe-btn applysafe-btn-details">View Details</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(warningBadge);
    
    // Add event listeners
    const toggleBtn = warningBadge.querySelector('.applysafe-badge-toggle');
    const closeBtn = warningBadge.querySelector('.applysafe-badge-close');
    const content = warningBadge.querySelector('.applysafe-badge-content');
    const reportBtn = warningBadge.querySelector('.applysafe-btn-report');
    const detailsBtn = warningBadge.querySelector('.applysafe-btn-details');
    
    toggleBtn.addEventListener('click', () => {
      warningBadge.classList.toggle('applysafe-expanded');
    });
    
    closeBtn.addEventListener('click', () => {
      hideWarningBadge();
    });
    
    reportBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'reportScam',
        data: {
          url: window.location.href,
          analysis: analysis,
          timestamp: Date.now()
        }
      });
      reportBtn.textContent = 'Reported!';
      reportBtn.disabled = true;
    });
    
    detailsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
    
    // Auto-expand for high risk
    if (analysis.riskScore > 60) {
      setTimeout(() => {
        warningBadge.classList.add('applysafe-expanded');
      }, 500);
    }
  }

  // Hide warning badge
  function hideWarningBadge() {
    if (warningBadge) {
      warningBadge.remove();
      warningBadge = null;
    }
    const existing = document.getElementById('applysafe-warning-badge');
    if (existing) {
      existing.remove();
    }
  }

  // Get risk level string
  function getRiskLevel(score) {
    if (score <= 30) return 'safe';
    if (score <= 60) return 'warning';
    return 'danger';
  }

  // Get verdict text
  function getVerdictText(score) {
    if (score <= 30) return 'This job posting appears legitimate.';
    if (score <= 60) return 'Some concerns detected. Proceed with caution.';
    return 'High risk of scam! Be very careful.';
  }

  // Get shield icon based on risk
  function getShieldIcon(score) {
    const color = score <= 30 ? '#10B981' : score <= 60 ? '#F59E0B' : '#EF4444';
    return `
      <svg viewBox="0 0 24 24" fill="${color}">
        <path d="M12 2L3 7V12C3 16.97 7.02 21.5 12 22.5C16.98 21.5 21 16.97 21 12V7L12 2Z"/>
        ${score <= 30 
          ? '<path d="M10 15.5L7.5 13L8.91 11.59L10 12.67L14.59 8.09L16 9.5L10 15.5Z" fill="white"/>'
          : score <= 60
          ? '<path d="M12 8v5m0 3h.01" stroke="white" stroke-width="2" fill="none"/>'
          : '<path d="M15 9l-6 6m0-6l6 6" stroke="white" stroke-width="2" fill="none"/>'
        }
      </svg>
    `;
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Observe page changes for SPAs
  function observePageChanges() {
    let lastUrl = window.location.href;
    
    // URL change observer - check more frequently for better responsiveness
    const urlObserver = setInterval(() => {
      if (window.location.href !== lastUrl) {
        console.log('ApplySafe: URL changed, re-processing page');
        console.log('  Old URL:', lastUrl);
        console.log('  New URL:', window.location.href);
        lastUrl = window.location.href;
        processed = false;
        currentJobData = null;
        hideWarningBadge();
        // Wait for page to load new content
        setTimeout(processPage, 1500);
      }
    }, 500);
    
    // DOM mutation observer for dynamic content
    let mutationTimeout = null;
    const isGlassdoor = window.location.hostname.includes('glassdoor.com');
    
    const mutationObserver = new MutationObserver((mutations) => {
      // Debounce mutations to avoid excessive re-extraction
      if (mutationTimeout) return;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Check if significant content was added
          for (const node of mutation.addedNodes) {
            // More aggressive detection for Glassdoor
            const isJobContent = node.nodeType === 1 && (
              node.matches?.('[class*="job"], [class*="Job"], [class*="description"], [data-test*="job"], [data-test*="Job"]') ||
              node.querySelector?.('[class*="job"], [class*="Job"], [class*="description"], [data-test*="job"], [data-test*="Job"]')
            );
            
            if (isJobContent) {
              // Re-extract job data with debouncing
              mutationTimeout = setTimeout(() => {
                console.log('ApplySafe: DOM mutation detected, checking for new job...');
                const newData = extractJobData();
                
                // Log what we found
                console.log('ApplySafe: Extracted after mutation:', {
                  title: newData?.title,
                  company: newData?.company,
                  previousTitle: currentJobData?.title
                });
                
                // Only update if we got valid new data and it's different
                if (newData && newData.title && newData.title !== currentJobData?.title) {
                  console.log('ApplySafe: New job detected! Updating...');
                  currentJobData = newData;
                  // Trigger auto-analysis for the new job
                  processed = false;
                  processPage();
                }
                mutationTimeout = null;
              }, 2000);
              break;
            }
          }
        }
      }
    });
    
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  init();
})();
