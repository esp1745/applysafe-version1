# ApplySafe - AI Job Scam Detector Chrome Extension 🛡️

A powerful Chrome extension that protects job seekers from fake job postings using AI-powered analysis.

## Features

### 🎯 Smart Scam Detection
- Real-time analysis of job postings as you browse
- Detects red flags like upfront payment requests, vague descriptions, and unrealistic salaries
- Identifies suspicious language patterns and urgency tactics

### 🤖 AI Analysis Engine
- Integrates with Claude API for intelligent job posting analysis
- Heuristic-based fallback when no API key is configured
- Confidence scoring (0-100% risk assessment)

### 💡 Visual Warning System
- Color-coded risk badges (green/yellow/red)
- Expandable panels showing specific concerns
- Non-intrusive overlay warnings on suspicious postings

### 📊 Dashboard & Statistics
- Track scams you've avoided
- View scan history with filtering
- Whitelist trusted companies
- Export your data

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `applysafe-extension` folder
5. The extension icon should appear in your toolbar

### Converting SVG Icons to PNG

Before loading the extension, you need to convert the SVG icons to PNG:

```bash
# Using ImageMagick (install with: brew install imagemagick)
cd applysafe-extension/icons
convert icon16.svg icon16.png
convert icon32.svg icon32.png
convert icon48.svg icon48.png
convert icon128.svg icon128.png
```

Or use any online SVG to PNG converter.

## Configuration

### Claude API Key (Optional)

For enhanced AI-powered analysis:

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Click the ApplySafe extension icon
3. Go to Settings (gear icon)
4. Enter your API key in the settings page

Without an API key, the extension will use heuristic-based detection which is still effective.

## Supported Job Sites

- LinkedIn Jobs
- Indeed
- Glassdoor
- ZipRecruiter
- Monster
- SimplyHired
- Dice
- CareerBuilder
- AngelList / Wellfound
- Upwork
- FlexJobs
- Remote.co
- We Work Remotely
- Remote OK

## How It Works

### Detection Criteria

The AI analyzes job postings for:

1. **Payment Requirements** - Requests for upfront fees or investments
2. **Vague Descriptions** - Unclear job responsibilities
3. **Unrealistic Compensation** - Too-good-to-be-true salaries
4. **Poor Grammar** - Often indicates overseas scams
5. **Pressure Tactics** - "Act now!", "Limited positions"
6. **Personal Emails** - @gmail instead of company domains
7. **Missing Company Info** - No website or verifiable details
8. **MLM Indicators** - Pyramid scheme language

### Risk Scores

- **0-30 (Green)**: Appears safe, standard job posting
- **31-60 (Yellow)**: Some concerns, proceed with caution
- **61-100 (Red)**: High risk, likely a scam

## Privacy

- All analysis happens locally or via API calls to Anthropic
- Your data stays on your device
- No job posting data is sent to third-party servers
- API keys are stored locally in Chrome storage

## Development

### Project Structure

```
applysafe-extension/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # AI analysis & coordination
├── content/
│   ├── content.js         # Page scanning & overlays
│   └── content.css        # Warning badge styles
├── popup/
│   ├── popup.html         # Popup interface
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── options/
│   ├── options.html       # Dashboard page
│   ├── options.css        # Dashboard styles
│   └── options.js         # Dashboard logic
└── icons/                 # Extension icons
```

### Building

No build step required - just load the extension in developer mode.

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on multiple job sites
5. Submit a pull request

## License

MIT License - feel free to use and modify for your own purposes.

## Support

If you find this extension helpful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs or issues
- 💡 Suggesting new features
- 🤝 Contributing code

---

**Stay safe in your job search! 🛡️**
