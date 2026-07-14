import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || !/^https?:\/\/.+/.test(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch job page' }, { status: 502 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise elements
    $('script, style, nav, footer, header, aside, [role="banner"], [role="navigation"]').remove();

    // Try to extract structured fields from common job sites
    const title =
      $('h1').first().text().trim() ||
      $('[class*="job-title"]').first().text().trim() ||
      $('[class*="jobtitle"]').first().text().trim();

    const company =
      $('[class*="company"]').first().text().trim() ||
      $('[class*="employer"]').first().text().trim();

    const location =
      $('[class*="location"]').first().text().trim();

    const salary =
      $('[class*="salary"]').first().text().trim() ||
      $('[class*="compensation"]').first().text().trim();

    // Get main body text
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000);

    const domain = new URL(url).hostname.replace('www.', '');

    return NextResponse.json({
      jobData: {
        title: title.slice(0, 200) || undefined,
        company: company.slice(0, 200) || undefined,
        location: location.slice(0, 200) || undefined,
        salary: salary.slice(0, 200) || undefined,
        description: bodyText,
        companyDomain: domain,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
