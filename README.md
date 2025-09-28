# Fonbet event listener

A basic Chrome extension that listen to fonbet score changes and log them on a page/do a alert on main.

## Features

- Background script for handling extension events
- Content script for interacting with web pages
- Popup interface with HTML, CSS, and JavaScript
- Basic messaging between components

## Project Structure

```
chrome-extension/
│
├── manifest.json        # Extension configuration
├── background.js        # Background script
├── content.js           # Content script for web page interactions
│
├── popup/               # Popup interface
│   ├── popup.html       # Popup HTML structure
│   ├── popup.css        # Popup styling
│   └── popup.js         # Popup functionality
│
└── icons/               # Extension icons
    ├── icon16.png       # 16x16 icon
    ├── icon48.png       # 48x48 icon
    └── icon128.png      # 128x128 icon
```

## Installation for Development

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by clicking the toggle in the top right corner
3. Click "Load unpacked" and select the `chrome-extension` directory
4. The extension should now be installed and ready for testing

## Development

### Making Changes

1. Edit the files as needed for your specific extension
2. After making changes, go to `chrome://extensions/`
3. Find your extension and click the refresh button
4. If you're working with the background script, you may need to reload the extension

### Testing

- To test the popup: Click on the extension icon in your browser toolbar
- To test content scripts: Visit any webpage
- To debug: Right-click the extension icon and select "Inspect popup" or go to `chrome://extensions/`, find your extension, and click "service worker" link in the "Inspect views" section

## Customization

1. Update the `manifest.json` file with your extension's name, description, and permissions
2. Replace the placeholder icons with your own
3. Modify the background script, content script, and popup to implement your desired functionality

## Publishing

1. Prepare your extension for publishing by creating a ZIP file of the extension directory
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
3. Click "New Item" and upload your ZIP file
4. Fill in the store listing information and submit for review

## Notes

- You must replace the placeholder icons with your own before publishing
- Make sure to only request the permissions your extension actually needs
- Consider privacy and security implications when developing your extension