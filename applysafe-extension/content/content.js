/**
 * ApplySafe - Content Script
 * Detects and extracts job posting data from various job sites
 * Injects warning overlays for suspicious postings
 */

(function() {
  'use strict';

  if (window.__applysafeContentLoaded) {
    console.log('ApplySafe: Content script already loaded, skipping reinjection');
    return;
  }

  window.__applysafeContentLoaded = true;

  // Track if we've already processed this page
  let processed = false;
  let currentJobData = null;
  let warningBadge = null;
  let lastWidgetSignature = null;
  let linkedinRetryTimer = null;
  let linkedinRetryCount = 0;

  const MAX_LINKEDIN_RETRIES = 6;
  const LINKEDIN_TITLE_SELECTORS = [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    '.jobs-details-top-card__job-title',
    '.jobs-details__main-content h1',
    '.scaffold-layout__detail h1',
    '.top-card-layout__title',
    '.topcard__title'
  ];
  const LINKEDIN_COMPANY_SELECTORS = [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '.jobs-details-top-card__company-url',
    '.jobs-unified-top-card__subtitle-primary-grouping a',
    '.job-details-jobs-unified-top-card__primary-description-without-tagline a',
    'a[href*="/company/"]'
  ];
  const LINKEDIN_DESCRIPTION_SELECTORS = [
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '.jobs-description-content__text',
    '.jobs-description-content__text--stretch',
    '.jobs-details__main-content',
    '.scaffold-layout__detail [class*="description"]'
  ];
  const LINKEDIN_LOCATION_SELECTORS = [
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
    '.job-details-jobs-unified-top-card__primary-description-container span',
    '.jobs-unified-top-card__primary-description-container span'
  ];
  const LINKEDIN_JOB_SHELL_SELECTORS = [
    '.jobs-search__job-details',
    '.jobs-search__job-details--container',
    '.job-view-layout',
    '.jobs-details',
    '.jobs-unified-top-card',
    '.job-details-jobs-unified-top-card',
    '.scaffold-layout__detail',
    '.jobs-box__html-content'
  ];

  // Site-specific selectors for extracting job data
  const SITE_SELECTORS = {
    'linkedin.com': {
      // Job title - be very specific to avoid picking up user headlines
      title: '.job-details-jobs-unified-top-card__job-title h1, .job-details-jobs-unified-top-card__job-title a, .job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title a, .jobs-unified-top-card__job-title, .jobs-details-top-card__job-title, h1.jobs-details__main-title, .jobs-details__main-content h1, .scaffold-layout__detail h1, .top-card-layout__title, .topcard__title',
      company: '.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .jobs-unified-top-card__subtitle-primary-grouping a, .job-details-jobs-unified-top-card__primary-description-without-tagline a, a.app-aware-link[href*="/company/"], .artdeco-entity-lockup__subtitle a, .jobs-company__name a, .jobs-company__name, [data-test-id="job-details-jobs-unified-top-card__company-name"], span[class*="company-name"], .jobs-details-top-card__company-url',
      description: '.jobs-description__content .jobs-box__html-content, .jobs-description__content, .jobs-box__html-content, .jobs-description-content__text, .jobs-description-content__text--stretch, #job-details, .jobs-details__main-content',
      salary: '.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, .salary-main-rail__salary-range',
      location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-container span, .jobs-unified-top-card__primary-description-container span',
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

  function extractFromSelectorList(selectors, options = {}) {
    for (const selector of selectors) {
      const text = extractText(selector, options);
      if (text) return text;
    }
    return '';
  }

  function hasLinkedInJobShell() {
    if (!window.location.hostname.toLowerCase().includes('linkedin.com')) {
      return false;
    }

    return LINKEDIN_JOB_SHELL_SELECTORS.some((selector) => document.querySelector(selector));
  }

  function getLinkedInPanelTitle() {
    return extractFromSelectorList(LINKEDIN_TITLE_SELECTORS, { isTitle: true });
  }

  function resetLinkedInRetryState() {
    linkedinRetryCount = 0;
    if (linkedinRetryTimer) {
      clearTimeout(linkedinRetryTimer);
      linkedinRetryTimer = null;
    }
  }

  function scheduleLinkedInRetry(reason) {
    if (!window.location.hostname.toLowerCase().includes('linkedin.com')) {
      return;
    }

    if (linkedinRetryTimer || linkedinRetryCount >= MAX_LINKEDIN_RETRIES) {
      return;
    }

    linkedinRetryCount += 1;
    processed = false;
    console.log(`ApplySafe: Scheduling LinkedIn retry ${linkedinRetryCount}/${MAX_LINKEDIN_RETRIES} - ${reason}`);
    linkedinRetryTimer = setTimeout(() => {
      linkedinRetryTimer = null;
      processPage();
    }, 1200);
  }

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
      // Exclude non-job pages first
      if (url.includes('/in/') || url.includes('/feed') || url.includes('/messaging') ||
          url.includes('/mynetwork') || url.includes('/notifications')) {
        console.log('ApplySafe: Skipping - this is a LinkedIn profile/feed page, not a job posting');
        return false;
      }

      if (!url.includes('/jobs/')) {
        return false;
      }

      if (url.includes('/jobs/view/') || url.includes('/job-view/') || url.includes('/jobs/collections/')) {
        return true;
      }

      if (url.includes('/jobs/search/') || url.includes('/jobs/search')) {
        return hasLinkedInJobShell() || !!getLinkedInPanelTitle() || url.includes('currentjobid=');
      }

      return hasLinkedInJobShell() || !!getLinkedInPanelTitle();
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
      if (window.location.hostname.includes('linkedin.com') && window.location.href.toLowerCase().includes('/jobs/') && hasLinkedInJobShell()) {
        console.log('ApplySafe: LinkedIn job shell detected but details are still loading');
        scheduleLinkedInRetry('job shell visible before title and details loaded');
        return;
      }

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
      resetLinkedInRetryState();
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
      if (window.location.hostname.includes('linkedin.com') && hasLinkedInJobShell()) {
        scheduleLinkedInRetry('title or company missing after extraction');
      }
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

    if (hostname.includes('linkedin.com')) {
      if (!data.title || data.title.length < 3) {
        data.title = extractFromSelectorList(LINKEDIN_TITLE_SELECTORS, { isTitle: true });
      }

      if (!data.company || data.company.length < 2) {
        data.company = extractFromSelectorList(LINKEDIN_COMPANY_SELECTORS);
      }

      if (!data.description || data.description.length < 120) {
        const linkedinDescription = extractFromSelectorList(LINKEDIN_DESCRIPTION_SELECTORS);
        if (linkedinDescription && linkedinDescription.length > (data.description?.length || 0)) {
          data.description = linkedinDescription;
        }
      }

      if (!data.location || data.location.length < 2) {
        data.location = extractFromSelectorList(LINKEDIN_LOCATION_SELECTORS);
      }
    }
    
    // Debug logging
    console.log('ApplySafe: Extracted job data:', {
      title: data.title ? `${data.title.substring(0, 50)}...` : 'NOT FOUND',
      company: data.company ? `${data.company.substring(0, 30)}...` : 'NOT FOUND',
      descriptionLength: data.description ? data.description.length : 0,
      salary: data.salary ? 'FOUND' : 'NOT FOUND',
      location: data.location ? `${data.location.substring(0, 30)}...` : 'NOT FOUND'
    });
    
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
          
          // Skip LinkedIn profile headlines (typically contain multiple | separators)
          // e.g., "Data scientist | software engineer | passionate about..."
          const pipeCount = (cleanText.match(/\|/g) || []).length;
          if (pipeCount >= 2) {
            console.log('ApplySafe: Skipping potential LinkedIn headline:', cleanText.substring(0, 50));
            continue;
          }
          
          // Skip if it looks like a profile tagline (contains "passionate about", "looking for", etc.)
          if (/passionate about|looking for|seeking|open to|helping|building|connecting/i.test(cleanText)) {
            console.log('ApplySafe: Skipping potential profile description:', cleanText.substring(0, 50));
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
        // ALWAYS clear old data first to ensure fresh extraction
        currentJobData = null;
        // Only extract if this is actually a job posting page
        if (isJobPostingPage()) {
          currentJobData = extractJobData();
          console.log('ApplySafe: Fresh job data extracted:', {
            title: currentJobData?.title,
            company: currentJobData?.company,
            url: currentJobData?.url
          });
        } else {
          console.log('ApplySafe: Not a job posting page, setting job data to null');
        }
        sendResponse({ success: true, jobData: currentJobData });
        break;
        
      case 'getJobData':
        // ALWAYS re-extract to ensure we have the latest job data
        // This handles SPAs where the job changes without full page reload
        console.log('ApplySafe: Getting job data, current URL:', window.location.href);
        
        // Check if URL has changed - if so, definitely need fresh data
        const currentUrl = window.location.href;
        if (currentJobData && currentJobData.url !== currentUrl) {
          console.log('ApplySafe: URL changed, clearing old job data');
          currentJobData = null;
        }
        
        // Extract fresh data if needed or if explicitly requested
        if (!currentJobData || request.forceRefresh) {
          console.log('ApplySafe: Extracting fresh job data...');
          if (isJobPostingPage()) {
            currentJobData = extractJobData();
          } else {
            currentJobData = null;
            console.log('ApplySafe: Not a job posting page');
          }
        }
        
        sendResponse({ jobData: currentJobData });
        console.log('ApplySafe: Sent job data:', currentJobData ? {
          title: currentJobData.title,
          company: currentJobData.company,
          url: currentJobData.url
        } : 'null');
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
      const settings = await chrome.storage.local.get(['settings', 'user', 'guestScans']);
      
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
      
      // Check if user is signed in
      const isSignedIn = !!settings.user?.email;

      console.log('ApplySafe: Starting auto-analysis...');
      
      // Show loading state immediately
      showFloatingWidget({ loading: true, jobTitle: currentJobData.title, company: currentJobData.company });
      
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
      
      // Handle various response formats
      if (response) {
        if (response.success && response.result) {
          // Standard success response
          showFloatingWidget(response.result);
        } else if (response.analysis) {
          // Alternative response format
          showFloatingWidget(response.analysis);
        } else if (response.riskScore !== undefined) {
          // Direct analysis object
          showFloatingWidget(response);
        } else if (!response.success && response.error) {
          // Error response but still show widget with error state
          console.log('ApplySafe: Analysis error from backend:', response.error);
          showFloatingWidget({ error: true, message: response.message || response.error });
        } else {
          // Unexpected response format
          console.warn('ApplySafe: Unexpected response format:', response);
          showFloatingWidget({ error: true, jobTitle: currentJobData.title, company: currentJobData.company });
        }
      } else {
        // No response
        console.warn('ApplySafe: No response from analysis');
        showFloatingWidget({ error: true, jobTitle: currentJobData.title, company: currentJobData.company });
      }
    } catch (error) {
      console.log('ApplySafe: Auto-analysis error:', error.message);
      showFloatingWidget({ error: true, message: error.message });
    }
  }

  // Show floating widget (always visible)
  async function showFloatingWidget(data) {
    const widgetSignature = JSON.stringify({
      url: window.location.href,
      title: data?.jobTitle || currentJobData?.title || '',
      company: data?.company || currentJobData?.company || '',
      riskScore: data?.riskScore ?? null,
      loading: !!data?.loading,
      error: !!data?.error,
      message: data?.message || '',
      guestLimitReached: !!data?.guestLimitReached,
      h1bSponsored: !!(data?.h1bData?.sponsors || data?.h1bData?.sponsored || data?.h1bData?.isH1BSponsor || data?.h1bData?.isH1bSponsor)
    });

    const existing = document.getElementById('applysafe-floating-widget');
    if (existing && widgetSignature === lastWidgetSignature) {
      return;
    }

    if (existing) existing.remove();
    lastWidgetSignature = widgetSignature;

    // Get user data and stats from background
    let userData = null;
    let stats = { threatsBlocked: 0, jobsScanned: 0, safetyRate: '100%' };
    let recentScans = [];
    let subscriptionData = { status: 'trial', planName: 'Free Trial' };
    let h1bData = data.h1bData || null;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getWidgetData' });
      console.log('ApplySafe: getWidgetData response:', response);
      if (response && response.success) {
        userData = response.user;
        stats = response.stats || stats;
        recentScans = response.recentScans || [];
        subscriptionData = response.subscription || subscriptionData;
        console.log('ApplySafe: User loaded:', userData?.email, userData?.name, 'Subscription:', subscriptionData.status);
      }
      
      // Fetch H-1B data if not already present and we have a company name
      if (!h1bData && data.company) {
        try {
          console.log('ApplySafe: Fetching H-1B data for:', data.company);
          const h1bResponse = await chrome.runtime.sendMessage({ 
            action: 'checkH1BSponsorship', 
            companyName: data.company 
          });
          console.log('ApplySafe: H-1B response:', h1bResponse);
          if (h1bResponse && h1bResponse.success && h1bResponse.h1bData) {
            h1bData = h1bResponse.h1bData;
            console.log('ApplySafe: H-1B data loaded:', h1bData);
          }
        } catch (e) {
          console.log('ApplySafe: H-1B check failed', e);
        }
      }
    } catch (e) {
      console.log('ApplySafe: Could not get widget data', e);
    }

    const extensionLogoUrl = chrome.runtime.getURL('icons/applysafe-logo-horizontal.png');
    const widget = document.createElement('div');
    widget.id = 'applysafe-floating-widget';
    
    // Determine risk level and colors
    let riskClass = 'safe';
    let riskLabel = 'Looks Safe';
    let riskColor = '#10b981';
    let riskBg = '#ecfdf5';
    
    if (data.guestLimitReached) {
      riskClass = 'limit';
      riskLabel = 'Sign In Required';
      riskColor = '#8b5cf6';
      riskBg = '#f5f3ff';
    } else if (data.loading) {
      riskClass = 'loading';
      riskLabel = 'Reviewing...';
      riskColor = '#6b7280';
      riskBg = '#edf4ff';
    } else if (data.error) {
      riskClass = 'error';
      riskLabel = 'Error';
      riskColor = '#ef4444';
      riskBg = '#fef2f2';
    } else if (data.riskScore !== undefined) {
      if (data.riskScore > 60) {
        riskClass = 'danger';
        riskLabel = 'High Risk';
        riskColor = '#ef4444';
        riskBg = '#fef2f2';
      } else if (data.riskScore > 30) {
        riskClass = 'warning';
        riskLabel = 'Caution';
        riskColor = '#f59e0b';
        riskBg = '#fffbeb';
      }
    }

    const score = data.riskScore ?? '—';
    // Check all possible H-1B sponsor property names
    const h1bSponsored = h1bData?.sponsors || h1bData?.sponsored || h1bData?.isH1BSponsor || h1bData?.isH1bSponsor;
    const h1bStatus = h1bSponsored ? 'H-1B sponsor' : '';
    console.log('ApplySafe Widget: H-1B data:', h1bData, 'Sponsored:', h1bSponsored);
    console.log('ApplySafe Widget: User data:', userData);
    const userName = userData?.name || 'Guest User';
    const userEmail = userData?.email || 'Sign in to sync';
    const userAvatar = userData?.picture || '';
    const isSignedIn = !!userData?.email;

    widget.innerHTML = `
      <style>
        #applysafe-floating-widget {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2147483647;
          font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
          animation: applysafe-fade-in 0.16s ease-out;
        }
        #applysafe-floating-widget {
          --asw-ink: #0f2f73;
          --asw-muted: #6782a2;
          --asw-panel: rgba(248, 252, 255, 0.97);
          --asw-panel-alt: #edf5ff;
          --asw-border: rgba(15, 47, 115, 0.12);
          --asw-shadow: 0 24px 60px rgba(22, 66, 132, 0.18);
          --asw-pine: #17d7c0;
          --asw-pine-soft: #d8fbf5;
          --asw-amber: #5aa9f8;
          --asw-amber-soft: #e7f2ff;
          --asw-rust: #e9647e;
          --asw-rust-soft: #ffe7ed;
          --asw-cream: #f7fbff;
        }
        #applysafe-floating-widget * {
          box-sizing: border-box;
        }
        @keyframes applysafe-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes applysafe-spin {
          to { transform: rotate(360deg); }
        }
        
        /* Collapsed Pill */
        .asw-collapsed {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: var(--asw-panel);
          border-radius: 22px;
          border: 1px solid var(--asw-border);
          box-shadow: var(--asw-shadow);
          cursor: pointer;
          transition: box-shadow 0.2s ease, background-color 0.2s ease;
        }
        .asw-collapsed:hover {
          box-shadow: 0 16px 34px rgba(22, 66, 132, 0.14);
        }
        .asw-pill-score {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: white;
          background: ${riskColor};
        }
        .asw-pill-score.loading::after {
          content: '';
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: applysafe-spin 0.8s linear infinite;
        }
        .asw-pill-info {
          flex: 1;
        }
        .asw-pill-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--asw-ink);
        }
        .asw-pill-status {
          font-size: 10px;
          color: var(--asw-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .asw-pill-close {
          width: 24px;
          height: 24px;
          border: none;
          background: #edf4ff;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .asw-pill-close:hover { background: #dbeafe; }
        .asw-pill-close svg { width: 14px; height: 14px; stroke: #6b82a1; }
        
        /* Expanded Full Panel */
        .asw-expanded {
          display: none;
          width: 380px;
          max-height: 85vh;
          background: var(--asw-panel);
          border-radius: 24px;
          border: 1px solid var(--asw-border);
          box-shadow: var(--asw-shadow);
          overflow: hidden;
          flex-direction: column;
        }
        .asw-expanded > div:not(.asw-header):not(.asw-footer) {
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
        }
        .asw-expanded > div:not(.asw-header):not(.asw-footer)::-webkit-scrollbar {
          width: 8px;
        }
        .asw-expanded > div:not(.asw-header):not(.asw-footer)::-webkit-scrollbar-track {
          background: #f2f8ff;
        }
        .asw-expanded > div:not(.asw-header):not(.asw-footer)::-webkit-scrollbar-thumb {
          background: #c5d9f3;
          border-radius: 4px;
        }
        .asw-expanded > div:not(.asw-header):not(.asw-footer)::-webkit-scrollbar-thumb:hover {
          background: #8aa8cf;
        }
        
        /* Footer - Always at bottom */
        .asw-footer {
          padding: 10px 16px;
          background: rgba(244, 249, 255, 0.94);
          border-top: 1px solid var(--asw-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        #applysafe-floating-widget.expanded .asw-collapsed { display: none; }
        #applysafe-floating-widget.expanded .asw-expanded { display: flex; }
        
        /* Header */
        .asw-header {
          background:
            radial-gradient(circle at top left, rgba(122, 201, 255, 0.18), transparent 30%),
            linear-gradient(145deg, #12377f 0%, #0a1a47 100%);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: white;
        }
        .asw-header-left {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
        }
        .asw-wordmark {
          display: block;
          width: min(178px, 100%);
          height: auto;
          object-fit: contain;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          filter: drop-shadow(0 10px 22px rgba(18, 87, 70, 0.22));
        }
        .asw-brand-tag {
          font-size: 9px;
          opacity: 0.74;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding-left: 2px;
          display: block;
        }
        .asw-header-btns {
          display: flex;
          gap: 8px;
        }
        .asw-header-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: rgba(255,255,255,0.2);
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .asw-header-btn:hover { background: rgba(255,255,255,0.3); }
        .asw-header-btn svg { width: 16px; height: 16px; stroke: white; }
        
        /* User Section */
        .asw-user {
          padding: 12px 16px;
          background: rgba(241, 247, 255, 0.8);
          border-bottom: 1px solid var(--asw-border);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .asw-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e1ecfb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          overflow: hidden;
        }
        .asw-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .asw-user-info {
          flex: 1;
          min-width: 0;
        }
        .asw-user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--asw-ink);
        }
        .asw-user-email {
          font-size: 11px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .asw-signin-btn {
          padding: 6px 12px;
          background: #0fb9ad;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
        }
        .asw-signin-btn:hover { background: #0d9f95; }
        .asw-logout-btn {
          padding: 6px 12px;
          background: #eef4ff;
          color: #5e7693;
          border: 1px solid #d7e4f7;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .asw-logout-btn:hover {
          background: #ffe7ed;
          color: #d44a68;
          border-color: #f9b7c3;
        }
        
        /* Trial Banner */
        .asw-trial {
          padding: 10px 16px;
          background: var(--asw-amber-soft);
          border-bottom: 1px solid rgba(90, 169, 248, 0.18);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .asw-trial-icon { font-size: 16px; }
        .asw-trial-info {
          flex: 1;
        }
        .asw-trial-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--asw-amber);
        }
        .asw-trial-text {
          font-size: 10px;
          color: #5a7aa7;
        }
        .asw-upgrade-btn {
          padding: 5px 10px;
          background: var(--asw-amber);
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .asw-upgrade-btn:hover { background: #418fe0; }
        
        /* Stats Bar */
        .asw-stats {
          display: flex;
          padding: 12px 16px;
          background: rgba(244, 249, 255, 0.88);
          border-bottom: 1px solid var(--asw-border);
        }
        .asw-stat {
          flex: 1;
          text-align: center;
        }
        .asw-stat-num {
          font-size: 18px;
          font-weight: 700;
          color: var(--asw-ink);
        }
        .asw-stat-label {
          font-size: 9px;
          color: var(--asw-muted);
          text-transform: uppercase;
        }
        .asw-stat-divider {
          width: 1px;
          background: rgba(15, 47, 115, 0.08);
        }
        
        /* Main Content - Scrollable */
        .asw-content {
          flex: 1;
          overflow-y: auto;
          max-height: 400px;
        }
        
        /* Risk Card */
        .asw-risk {
          padding: 16px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(232, 242, 255, 0.72));
          border-bottom: 1px solid var(--asw-border);
        }
        .asw-risk-top {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 12px;
        }
        .asw-risk-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: ${riskColor};
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .asw-risk-score {
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
        }
        .asw-risk-label {
          font-size: 8px;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .asw-risk-info h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
          color: ${riskColor};
        }
        .asw-risk-info p {
          margin: 0;
          font-size: 11px;
          color: var(--asw-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .asw-job-title {
          font-size: 13px;
          color: var(--asw-ink);
          margin-bottom: 4px;
        }
        .asw-company {
          font-size: 12px;
          color: var(--asw-muted);
        }
        
        /* Sections */
        .asw-section {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(34, 40, 36, 0.08);
        }
        .asw-section-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--asw-ink);
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .asw-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .asw-list li {
          font-size: 12px;
          color: #34516f;
          padding: 5px 0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .asw-list li::before {
          content: '•';
          color: ${riskColor};
          font-weight: bold;
        }
        .asw-signal-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .asw-signal-item {
          display: grid;
          grid-template-columns: 10px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
        }
        .asw-signal-mark {
          display: block;
          width: 8px;
          height: 8px;
          margin-top: 4px;
          border-radius: 999px;
          background: #cbd5d1;
        }
        .asw-signal-mark.positive {
          background: #10b981;
        }
        .asw-signal-mark.negative {
          background: #ef4444;
        }
        .asw-signal-text {
          min-width: 0;
          font-size: 12px;
          line-height: 1.45;
          color: #34516f;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        
        /* H-1B Section */
        .asw-h1b {
          background: #ecfffb;
          padding: 12px 16px;
          border-bottom: 1px solid #c8f7f1;
        }
        .asw-h1b-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #059669;
          margin-bottom: 10px;
        }
        .asw-h1b-stats {
          display: flex;
          gap: 16px;
        }
        .asw-h1b-stat {
          text-align: center;
        }
        .asw-h1b-stat-val {
          font-size: 16px;
          font-weight: 700;
          color: #047857;
        }
        .asw-h1b-stat-label {
          font-size: 9px;
          color: #059669;
        }
        
        /* AI Analysis */
        .asw-ai {
          padding: 12px 16px;
          background: #eef6ff;
          border-bottom: 1px solid #cfe4ff;
        }
        .asw-ai-title {
          font-size: 11px;
          font-weight: 600;
          color: #215ea8;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .asw-ai-text {
          font-size: 12px;
          color: #285179;
          line-height: 1.5;
        }
        
        /* Actions */
        .asw-actions {
          padding: 12px 16px;
          display: flex;
          gap: 8px;
          background: rgba(248, 252, 255, 0.94);
          border-bottom: 1px solid #d9e7f8;
        }
        .asw-action-btn {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--asw-border);
          background: rgba(255, 251, 245, 0.92);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          color: var(--asw-ink);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .asw-action-btn:hover { background: #f9fafb; }
        .asw-action-btn.danger { color: var(--asw-rust); border-color: rgba(180, 88, 61, 0.22); }
        .asw-action-btn.danger:hover { background: var(--asw-rust-soft); }
        .asw-cta-stack {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .asw-cta-btn {
          width: 100%;
          min-width: 0;
          justify-content: flex-start;
          text-align: left;
          white-space: normal;
          line-height: 1.35;
          padding: 11px 12px;
        }
        .asw-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(116px, 122px);
          gap: 14px;
          align-items: start;
        }
        .asw-hero-copy {
          min-width: 0;
        }
        .asw-usage-card {
          min-width: 116px;
          min-height: 82px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--asw-border);
          background: var(--asw-panel-alt);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 4px;
        }
        .asw-usage-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--asw-pine);
          line-height: 1;
        }
        .asw-usage-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--asw-muted);
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .asw-job-analysis {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        .asw-job-analysis-inner {
          display: grid;
          grid-template-columns: 60px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }
        .asw-score-card {
          width: 60px;
          min-height: 60px;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          text-align: center;
        }
        .asw-score-card-value {
          font-size: 24px;
          line-height: 1;
        }
        .asw-score-card-label {
          margin-top: 3px;
          font-size: 10px;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .asw-job-copy {
          min-width: 0;
        }
        .asw-job-status {
          margin: 0 0 2px 0;
          font-size: 14px;
          font-weight: 700;
        }
        .asw-job-name {
          margin: 0 0 4px 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--asw-ink);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .asw-job-company {
          margin: 0;
          font-size: 12px;
          color: var(--asw-muted);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        
        /* Recent Scans */
        .asw-recent {
          padding: 12px 16px;
        }
        .asw-recent-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--asw-ink);
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .asw-recent-title a {
          font-size: 10px;
          color: var(--asw-pine);
          text-decoration: none;
          text-transform: none;
        }
        .asw-scan-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(34, 40, 36, 0.08);
        }
        .asw-scan-item:last-child { border-bottom: none; }
        .asw-scan-score {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: white;
        }
        .asw-scan-score.safe { background: #10b981; }
        .asw-scan-score.warning { background: #f59e0b; }
        .asw-scan-score.danger { background: #ef4444; }
        .asw-scan-info {
          flex: 1;
          min-width: 0;
        }
        .asw-scan-title {
          font-size: 11px;
          font-weight: 500;
          color: var(--asw-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .asw-scan-company {
          font-size: 10px;
          color: var(--asw-muted);
        }
        .asw-scan-time {
          font-size: 9px;
          color: #9ca3af;
        }
        
        .asw-footer-text {
          font-size: 9px;
          color: var(--asw-muted);
        }
        .asw-footer-links {
          display: flex;
          gap: 12px;
        }
        .asw-footer-links a {
          font-size: 10px;
          color: var(--asw-muted);
          text-decoration: none;
        }
        .asw-footer-links a:hover { color: var(--asw-pine); }
        
        /* Minimize button in footer */
        .asw-minimize {
          padding: 8px 16px;
          background: var(--asw-pine);
          color: white;
          border: none;
          border-radius: 0 0 16px 16px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
        }
        .asw-minimize:hover { background: #155846; }
        @media (max-width: 420px) {
          .asw-hero-grid {
            grid-template-columns: 1fr;
          }
          .asw-usage-card {
            align-items: flex-start;
            text-align: left;
          }
        }
      </style>
      
      <!-- Collapsed Pill -->
      <div class="asw-collapsed">
        <div class="asw-pill-score ${data.loading ? 'loading' : ''}">${data.loading ? '' : score}</div>
        <div class="asw-pill-info">
          <div class="asw-pill-title">ApplySafe</div>
          <div class="asw-pill-status">${riskLabel}${h1bStatus ? ` • ${h1bStatus}` : ''}</div>
        </div>
        <button class="asw-pill-close" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <!-- Expanded Full Panel -->
      <div class="asw-expanded">
        <!-- Header -->
        <div class="asw-header">
          <div class="asw-header-left">
            <img class="asw-wordmark" src="${extensionLogoUrl}" alt="ApplySafe">
            <span class="asw-brand-tag">Job scam review desk</span>
          </div>
          <div class="asw-header-btns">
            <button class="asw-header-btn" id="asw-dashboard-btn" title="Dashboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button class="asw-header-btn" id="asw-collapse-btn" title="Minimize">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Scrollable Content -->
        <div style="flex: 1; overflow-y: auto; overflow-x: hidden;">
        <!-- Welcome Section -->
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
          ${!isSignedIn ? `
            <!-- Guest Mode -->
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 11px; background: var(--asw-pine-soft); color: var(--asw-pine); padding: 4px 8px; border-radius: 999px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Guest Mode</span>
            </div>
            <div class="asw-hero-grid">
              <div class="asw-hero-copy">
                <h2 style="margin: 0 0 4px 0; font-size: 18px; color: var(--asw-ink); font-weight: 700;">Review desk ready</h2>
                <p style="margin: 0; font-size: 13px; color: var(--asw-muted);">Review scam signals before you apply or share a listing.</p>
              </div>
              <div class="asw-usage-card">
                <div class="asw-usage-value">${subscriptionData?.scansToday || 0}/5</div>
                <div class="asw-usage-label">Scans used today</div>
              </div>
            </div>
          ` : `
            <!-- Returning User -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <h2 style="margin: 0 0 2px 0; font-size: 18px; color: var(--asw-ink); font-weight: 700;">Welcome back, ${escapeHtml(userData?.name || 'User')}</h2>
                <p style="margin: 0; font-size: 13px; color: var(--asw-muted);">Here is today's listing review summary.</p>
              </div>
              <button style="padding: 8px 16px; background: var(--asw-pine); color: white; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer;">Upgrade</button>
            </div>
            <!-- Stats -->
            <div style="display: flex; gap: 10px;">
              <div style="flex: 1; padding: 12px; background: var(--asw-panel-alt); border-radius: 12px; text-align: center; border: 1px solid var(--asw-border);">
                <div style="font-size: 16px; font-weight: 700; color: var(--asw-ink);">${stats.jobsScanned ?? 0}</div>
                <div style="font-size: 11px; color: var(--asw-muted); margin-top: 2px;">Listings Checked</div>
              </div>
              <div style="flex: 1; padding: 12px; background: var(--asw-panel-alt); border-radius: 12px; text-align: center; border: 1px solid var(--asw-border);">
                <div style="font-size: 16px; font-weight: 700; color: var(--asw-pine);">${stats.safetyRate ?? 0}</div>
                <div style="font-size: 11px; color: var(--asw-muted); margin-top: 2px;">Safer Rate</div>
              </div>
              <div style="flex: 1; padding: 12px; background: var(--asw-panel-alt); border-radius: 12px; text-align: center; border: 1px solid var(--asw-border);">
                <div style="font-size: 16px; font-weight: 700; color: var(--asw-rust);">${stats.threatsBlocked ?? 0}</div>
                <div style="font-size: 11px; color: var(--asw-muted); margin-top: 2px;">Scams Flagged</div>
              </div>
            </div>
          `}
        </div>
        
        <!-- Job Analysis -->
        <div class="asw-job-analysis">
          <div class="asw-job-analysis-inner">
            <div class="asw-score-card" style="background: ${riskColor};">
              <div class="asw-score-card-value">${score}</div>
              <div class="asw-score-card-label">${score === '—' ? 'Analyzing' : 'Score'}</div>
            </div>
            <div class="asw-job-copy">
              <h3 class="asw-job-status" style="color: ${riskColor};">${riskLabel}</h3>
              <p class="asw-job-name">${escapeHtml(data.jobTitle || 'Job Title')}</p>
              <p class="asw-job-company">${escapeHtml(data.company || 'Company')}</p>
            </div>
          </div>
        </div>
        
        <!-- Description Section -->
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
          <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: var(--asw-ink); text-transform: uppercase;">Signals To Review</h4>
          <div class="asw-signal-list">
            ${data.positiveIndicators && data.positiveIndicators.length > 0 ? data.positiveIndicators.slice(0, 3).map(indicator => `
              <div class="asw-signal-item">
                <span class="asw-signal-mark positive" aria-hidden="true"></span>
                <span class="asw-signal-text">${escapeHtml(indicator)}</span>
              </div>
            `).join('') : ''}
            ${data.redFlags && data.redFlags.length > 0 ? data.redFlags.slice(0, 3).map(flag => `
              <div class="asw-signal-item">
                <span class="asw-signal-mark negative" aria-hidden="true"></span>
                <span class="asw-signal-text">${escapeHtml(flag)}</span>
              </div>
            `).join('') : ''}
          </div>
        </div>
        
        <!-- H1B Section -->
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb; ${h1bSponsored ? 'background: #ecfdf5;' : 'background: #fef3c7;'}">
          <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: var(--asw-ink); text-transform: uppercase;">H-1B Sponsorship</h4>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 11px; background: ${h1bSponsored ? '#d1fae5' : '#fcd34d'}; color: ${h1bSponsored ? '#059669' : '#92400e'}; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
              ${h1bSponsored ? 'Verified Sponsor' : 'Status Unknown'}
            </span>
          </div>
          ${h1bSponsored ? `
            <div style="display: flex; gap: 12px;">
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 700; color: #059669;">${(h1bData.totalApplications || h1bData.totalVisas || h1bData.visaCount || h1bData.history?.estimatedTotal || 0).toLocaleString()}+</div>
                <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Total Visas</div>
              </div>
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 700; color: #059669;">${h1bData.history?.years || h1bData.years || h1bData.yearRange || '2010-2024'}</div>
                <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Active Years</div>
              </div>
              ${h1bData.medianSalary ? `
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 700; color: #059669;">$${(h1bData.medianSalary / 1000).toFixed(0)}k</div>
                <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Median Salary</div>
              </div>
              ` : ''}
            </div>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #059669;">
              ${escapeHtml(h1bData.note || 'This company has sponsored H-1B visas')}
            </p>
          ` : `
            <p style="margin: 0; font-size: 11px; color: #92400e;">
              No H-1B sponsorship records found. This doesn't mean they won't sponsor — check with the employer directly.
            </p>
          `}
        </div>
        
        <!-- AI Analysis Section -->
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb; background: rgba(216, 235, 228, 0.52);">
          <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: var(--asw-pine); text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
            Desk Notes
          </h4>
          <p style="margin: 0; font-size: 12px; color: #27463d; line-height: 1.5;">
            ${escapeHtml(data.explanation ? data.explanation.substring(0, 300) : 'Reviewing posting details...')}${data.explanation && data.explanation.length > 300 ? '...' : ''}
          </p>
        </div>
        
        <!-- Action Section -->
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
          ${!isSignedIn ? `
            <p id="asw-create-account-link" style="margin: 0 0 12px 0; font-size: 12px; color: var(--asw-pine); font-weight: 600; cursor: pointer;">
              Create a free account to save your review history
            </p>
          ` : ''}
          <div class="asw-cta-stack">
            <button id="asw-report-btn" class="asw-cta-btn" style="background: var(--asw-rust-soft); color: var(--asw-rust); border: 1px solid rgba(180, 88, 61, 0.18); border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Report job posting
            </button>
            <button id="asw-whitelist-btn" class="asw-cta-btn" style="background: var(--asw-pine-soft); color: var(--asw-pine); border: 1px solid rgba(30, 106, 85, 0.14); border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;">
              Trust employer
            </button>
          </div>
        </div>
          
        </div>
        
        <!-- Footer -->
        <div class="asw-footer">
          <span class="asw-footer-text">Signals from listing text, recruiter details, and employer patterns.</span>
          <div class="asw-footer-links">
            <a href="#" id="asw-help">Help</a>
            <a href="#" id="asw-privacy">Privacy</a>
          </div>
        </div>
        
        <!-- Minimize Button -->
        <button class="asw-minimize" id="asw-minimize-btn">Minimize</button>
      </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const collapsedView = widget.querySelector('.asw-collapsed');
    const pillClose = widget.querySelector('.asw-pill-close');
    const collapseBtn = widget.querySelector('#asw-collapse-btn');
    const minimizeBtn = widget.querySelector('#asw-minimize-btn');
    const dashboardBtn = widget.querySelector('#asw-dashboard-btn');
    const signinBtn = widget.querySelector('#asw-signin-btn');
    const logoutBtn = widget.querySelector('#asw-logout-btn');
    const upgradeBtn = widget.querySelector('#asw-upgrade-btn');
    const reportBtn = widget.querySelector('#asw-report-btn');
    const whitelistBtn = widget.querySelector('#asw-whitelist-btn');
    const viewAllBtn = widget.querySelector('#asw-view-all');

    // Expand on pill click
    collapsedView.addEventListener('click', (e) => {
      if (!e.target.closest('.asw-pill-close')) {
        widget.classList.add('expanded');
      }
    });

    // Close widget
    pillClose.addEventListener('click', (e) => {
      e.stopPropagation();
      widget.remove();
    });

    // Collapse handlers
    if (collapseBtn) collapseBtn.addEventListener('click', () => widget.classList.remove('expanded'));
    if (minimizeBtn) minimizeBtn.addEventListener('click', () => widget.classList.remove('expanded'));

    // Open dashboard
    if (dashboardBtn) dashboardBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openDashboard' });
    });

    // Sign in
    if (signinBtn) signinBtn.addEventListener('click', () => {
      signinBtn.disabled = true;
      signinBtn.textContent = 'Signing in...';
      chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Sign in error:', chrome.runtime.lastError);
          signinBtn.disabled = false;
          signinBtn.textContent = 'Sign In';
          return;
        }
        if (response && response.success) {
          // Refresh widget after sign-in
          widget.remove();
          setTimeout(() => autoAnalyze(), 1000);
        } else {
          signinBtn.disabled = false;
          signinBtn.textContent = 'Sign In';
          alert(response?.error || 'Sign in failed. Please try again.');
        }
      });
    });
    
    // Guest sign-in button (when limit reached)
    const guestSigninBtn = widget.querySelector('#asw-guest-signin-btn');
    if (guestSigninBtn) guestSigninBtn.addEventListener('click', () => {
      guestSigninBtn.disabled = true;
      guestSigninBtn.textContent = 'Signing in...';
      chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Sign in error:', chrome.runtime.lastError);
          guestSigninBtn.disabled = false;
          guestSigninBtn.textContent = 'Sign In with Google';
          return;
        }
        if (response && response.success) {
          // Refresh widget after sign-in to re-analyze
          widget.remove();
          setTimeout(() => autoAnalyze(), 1000);
        } else {
          guestSigninBtn.disabled = false;
          guestSigninBtn.textContent = 'Sign In with Google';
          alert(response?.error || 'Sign in failed. Please try again.');
        }
      });
    });
    
    // Create free account link (for guest users)
    const createAccountLink = widget.querySelector('#asw-create-account-link');
    if (createAccountLink) createAccountLink.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Sign in error:', chrome.runtime.lastError);
          return;
        }
        if (response && response.success) {
          // Refresh widget after sign-in to re-analyze
          widget.remove();
          setTimeout(() => autoAnalyze(), 1000);
        } else {
          alert(response?.error || 'Sign in failed. Please try again.');
        }
      });
    });

    // Logout
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        chrome.runtime.sendMessage({ action: 'logout' }, () => {
          // Refresh widget to show logged out state
          widget.remove();
          showFloatingWidget(data);
        });
      }
    });

    // Upgrade (or Sign In if not signed in)
    if (upgradeBtn) upgradeBtn.addEventListener('click', async () => {
      // Check if this is a sign-in button (user not signed in)
      if (upgradeBtn.textContent === 'Sign In') {
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = 'Signing in...';
        chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Sign in error:', chrome.runtime.lastError);
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = 'Sign In';
            return;
          }
          if (response && response.success) {
            // Refresh widget after sign-in
            widget.remove();
            setTimeout(() => autoAnalyze(), 1000);
          } else {
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = 'Sign In';
            alert(response?.error || 'Sign in failed. Please try again.');
          }
        });
        return;
      }
      
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = 'Loading...';
      chrome.runtime.sendMessage({ action: 'startCheckout' }, (response) => {
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = 'Upgrade';
        if (response && (response.url || response.success)) {
          // If response has url, open it. Otherwise background already opened it
          if (response.url) {
            window.open(response.url, '_blank');
          } else {
            alert('Opening Stripe checkout in a new tab...');
          }
        } else {
          alert('Failed to start checkout. ' + (response?.error || 'Please try again later.'));
        }
      });
    });

    // Report scam
    if (reportBtn) reportBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reportScam', data: { url: window.location.href, ...data } });
      alert('Thank you for reporting! This job has been flagged for review.');
    });

    // Whitelist
    if (whitelistBtn) whitelistBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'addToWhitelist', company: data.company, reason: 'trusted from page widget' });
      alert('Company added to trusted companies!');
    });

    // View all
    if (viewAllBtn) viewAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'openDashboard' });
    });
  }

  // Show warning badge on the page (legacy function, now calls showFloatingWidget)
  function showWarningBadge(analysis) {
    showFloatingWidget(analysis);
  }

  // Hide warning badge
  function hideWarningBadge() {
    if (warningBadge) {
      warningBadge.remove();
      warningBadge = null;
    }
    lastWidgetSignature = null;
    const existing = document.getElementById('applysafe-warning-badge');
    if (existing) existing.remove();
    const floatingWidget = document.getElementById('applysafe-floating-widget');
    if (floatingWidget) floatingWidget.remove();
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
    let lastJobTitle = currentJobData?.title || null;
    
    // URL change observer - check more frequently for better responsiveness
    const urlObserver = setInterval(() => {
      const newUrl = window.location.href;
      
      // Check if URL changed
      if (newUrl !== lastUrl) {
        console.log('ApplySafe: URL changed, re-processing page');
        console.log('  Old URL:', lastUrl);
        console.log('  New URL:', newUrl);
        lastUrl = newUrl;
        processed = false;
        currentJobData = null;  // CRITICAL: Clear old job data immediately
        lastJobTitle = null;
        hideWarningBadge();
        // Wait for page to load new content
        setTimeout(processPage, 1500);
      }
      // Also check for LinkedIn job panel changes (URL might stay same but content changes)
      else if (window.location.hostname.includes('linkedin.com')) {
        // LinkedIn uses a job details panel that updates without URL change sometimes
        const currentTitle = getLinkedInPanelTitle();
        if (currentTitle && currentTitle !== lastJobTitle) {
          console.log('ApplySafe: LinkedIn job panel changed, re-processing');
          console.log('  Old title:', lastJobTitle, '→ New title:', currentTitle);
          processed = false;
          currentJobData = null;
          lastJobTitle = currentTitle;
          hideWarningBadge();
          setTimeout(processPage, 1000);
        }
      }
    }, 750);  // Poll steadily without re-triggering the widget on every SPA repaint
    
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
