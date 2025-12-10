# Flow Composer

Flow Composer is a browser-based application with two distinct interfaces:

1. **Public Archive Display** (root page): A read-only public interface for displaying a curated archive and published research flows. Visitors can browse and search the archive, view published flows, and explore materials without authentication.

2. **Flow Composer Tool** (password-protected): A workshop tool for creating and managing flows. This interface provides full functionality for searching the Internet Archive, selecting materials, organizing them into flows, and publishing flows for public display.

A flow is a collection of materials arranged in a specific order and categorized by document type. Flows created in the tool can be published and displayed on the public archive page.

## About This Project

Flow Composer is a work-in-progress application initially developed for [Dineba](https://dineba.ge/). The application is being created to support Dineba's initiative: **"Dineba: A Digital Archive of Georgia's Ecological Landscape"**.

**About Dineba:**
> Dineba is a non-formal archiving initiative based in Tbilisi, focused on documenting and contextualizing visual and written resources. It aims to support efforts to rescue and preserve underserved and at-risk archival material by encouraging documentation, conservation and re-contextualisation. Dineba researches, identifies and digitizes private and public archives. Dineba studies archives not only as repositories but also as systems, assessing how different processes influence their formation. Likewise, Dineba examines how to expand their effect through new associations, curatorial choices, and the artistic appropriation of archives as a production method.
>
> Most recently, Dineba initiated a community-based digital archive project focused on archiving Georgia's ecological landscape.

**Open Infrastructure:**
While initially developed for Dineba's specific project, Flow Composer is designed as general-purpose infrastructure that others are invited to use and adapt for their own Internet Archive collections. The application is fully configurable and can be customized for any project working with Internet Archive materials. See the [Project Configuration](#project-configuration) section for details on how to set it up for your own collection.

## Setup

### Quick Start (Local Development)

1. **Set up authentication:**
   ```bash
   cp js/toolAuth.js.template js/toolAuth.js
   ```
   Then edit `js/toolAuth.js` and change the password from `'changeme'` to your desired password.

2. **Start a local server:**
   - Using Python: `python -m http.server 8000`
   - Using Node.js: `npx http-server`
   - Using VS Code: Use the Live Server extension

3. **Access the applications:**
   - Public Archive Display: `http://localhost:8000/` (or your port) - No authentication needed
   - Flow Composer Tool: `http://localhost:8000/tool/` (password: whatever you set in toolAuth.js)

### Local Development

#### Authentication Setup

The `js/toolAuth.js` file is required for the backend tool to work. This file is not included in the repository for security reasons.

**To set up authentication:**
1. Copy the template file: `cp js/toolAuth.js.template js/toolAuth.js`
2. Open `js/toolAuth.js`
3. Change the value of `TOOL_PASSWORD` from `'changeme'` to your desired password
4. Save the file
5. Note: `js/toolAuth.js` is gitignored and won't be committed to the repository

#### Testing Locally

- **Public Archive Display** (`index.html`): No authentication needed, works immediately. Displays published flows and allows browsing/searching the archive.
- **Flow Composer Tool** (`tool/index.html`): Requires password (default: `changeme` unless changed). Used for workshops where participants create flows from archival materials.

#### File Structure

- `index.html` - Public archive display (read-only, shows curated archive and published flows)
- `tool/index.html` - Flow Composer Tool (password protected, workshop interface for creating flows)
- `flows/` - Published flows directory (flows created in the tool are saved here for public display)
- `config/project.json` - Project configuration 
- `config/project.json.example` - Configuration template/reference
- `js/toolAuth.js` - Local authentication config (gitignored)

### Project Configuration

Flow Composer is designed to work with any Internet Archive collection. The `config/project.json` file is the one the Dineba project uses and included for reference.

**To customize for your project:**

1. **Edit `config/project.json`** directly with your project details:
   - You can use `config/project.json.example` as a reference for the structure
   - The current file contains the Dineba project configuration as an example
   - `projectName` - Short name for your project/archive
   - `projectTitle` - Full title displayed on pages
   - `projectSubtitle` - Subtitle/description
   - `projectDescription` - Meta description for SEO
   - `collectionId` - Internet Archive collection identifier (e.g., "additional_collections" from "https://archive.org/details/additional_collections")
   - `collectionUrl` - Full URL to your collection on Internet Archive (e.g., "https://archive.org/details/additional_collections")
   - `footerText` - Footer text content
   - `footerLink` - Footer link URL (optional)
   - `footerLinkText` - Text for footer link (defaults to "Internet Archive")
   - `documentTypes` - Array of document type definitions (see below)

2. **Customize Document Types:**
   Each document type in the `documentTypes` array should have:
   - `id` - Unique identifier (used internally and for interoperability)
   - `label` - Display name
   - `description` - Description of the document type
   - `icon` - Feather icon name (e.g., "camera", "book", "clipboard")

   Example:
   ```json
   {
     "id": "photographic",
     "label": "Photographic Documentation",
     "description": "Photographic documentation of physical objects, scenes, or events.",
     "icon": "camera"
   }
   ```

#### Document Type Interoperability

Flow Composer supports sharing flows between different instances, even if they use different document type systems:

- **Native Types**: Document types defined in your `config/project.json` are considered "native" types
- **Imported Types**: When you import a flow from another instance, any document types that don't exist in your config are automatically registered as "imported" types
- **Type Matching**: Document types are matched by their `id` field, allowing flows to be shared between projects with compatible type systems
- **Preservation**: Imported flows preserve their original document type definitions, ensuring flows remain usable even when shared between different projects

This allows researchers working on related topics to share flows even if they've customized their document type taxonomies for their specific contexts.

### GitHub Secrets Configuration (Production)

To enable password protection for the Flow Composer Tool on GitHub Pages:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `TOOL_PASSWORD`
5. Value: Enter your desired password
6. Click **Add secret**

The GitHub Actions workflow will automatically inject this password during build.

**Security Note:** This is client-side password protection intended for basic access control in workshop settings. The password is embedded in the deployed JavaScript file and can be viewed by anyone who inspects the source code. For production use cases requiring stronger security, consider implementing server-side authentication.

### Published Flows

To publish flows:

1. Export flows from the backend tool (using Export All Flows)
2. Save each flow as a JSON file in the `flows/` directory
3. Update `flows/index.json` to include the new flow filename
4. Commit and push to GitHub

Example `flows/index.json`:
```json
{
  "flows": [
    "flow-1.json",
    "flow-2.json"
  ]
}
```

### GitHub Pages Deployment

The GitHub Actions workflow automatically triggers on pushes to the `main` or `trunk` branches and will:
1. Build the site with password injection from GitHub Secrets
2. Deploy to GitHub Pages
3. Generate `js/toolAuth.js` during build (not committed to repo)

**Prerequisites:**
- GitHub Pages must be enabled in your repository settings
- The `TOOL_PASSWORD` secret must be configured (see [GitHub Secrets Configuration](#github-secrets-configuration-production) above)

## Public Archive Display

The public archive display (`index.html`) provides a read-only interface where visitors can:

- Browse and search published flows
- View materials within published flows
- Explore the curated archive
- Search for specific materials or topics

No authentication is required to access the public archive display.

## Flow Composer Tool

The Flow Composer Tool (`tool/index.html`) is a password-protected workshop interface where participants can create and manage flows. The following sections describe the features available in the tool.

## Search Functionality (Tool)

In the Flow Composer Tool, you can search the Internet Archive for materials including texts, images, audio recordings, and videos.

You can filter results by document type (texts, images, audio, videos) and choose how many results to display per page.

There are two search scope options:

- Entire Archive: searches across all materials in the Internet Archive
- Custom Collection: searches within a specific collection

## Material Selection and Management (Tool)

When you search in the Flow Composer Tool, results appear as cards showing the material title, creator, date, type, and a brief description. You can:

- Click any material card to view detailed information in a preview panel on the right
- Click the "Select" button to add materials to your selection
- View selected materials in a grid below the search results

The preview panel shows metadata such as title, creator, description, date, and file size. For media files, you can preview images, play audio or video, or view documents in the preview panel. A "Open Fullscreen" button is available for media that opens a larger viewing window.

You can clear all selected materials at once.

## Flows (Tool)

A flow is a named collection of materials arranged in a specific order. Each material in a flow is assigned to a document type. Document types are defined in your project configuration (`config/project.json`) and can be customized for your specific project needs.

For example, the Dineba project uses the following document types:
- Photographic Documentation - visual evidence and imagery
- Conversational Documentation - oral histories and interviews
- Endangered Documents - at-risk materials and ephemera
- Academic Documents - research and scholarly analysis
- Policy Documents - legislation and regulations
- Financial Documents - economic and funding information
- Ephemeral Web Documents - online content and digital media
- Institutional Documents - official records and reports

See the [Project Configuration](#project-configuration) section for details on how to customize document types for your project.

### Creating Flows (Tool)

In the Flow Composer Tool, participants can create flows during workshops. To create a flow, select one or more materials from search results and click "Create Flow from Archival Materials". Give the flow a name and description, then assign each material to a document type. 

For each material, you can add research notes (annotations) that are saved with the material in the flow. These notes can include observations, connections to other materials, or any research-related information. 

Materials can be reordered by dragging them up or down in the list.

The flow creation interface shows which document types are represented in your flow so you can see what categories you have covered.

### Managing Flows (Tool)

In the Flow Composer Tool, once created, flows appear in the "Created Flows" section. You can:

- Click a flow to view its details, including all materials in order with their document type assignments and research notes
- Edit a flow to change its name, description, materials, document type assignments, or research notes
- Duplicate a flow to create a copy
- Delete a flow after confirming
- Search flows by name, description, material content, or research notes
- Export all flows to a JSON file for backup or sharing
- Import flows from a previously exported JSON file

You can also add selected materials to an existing flow using the "Add to Flow" button. If any materials already exist in the flow, you will be notified and can choose whether to add them anyway (which creates duplicates) or cancel.

### Publishing Flows

Once flows are created in the tool, they can be published to the public archive display. See the "Published Flows" section in Setup for instructions on how to publish flows.

## Data Management (Tool)

In the Flow Composer Tool, all flows are automatically saved to your browser's local storage. If you close the application and return later, your flows will still be there. You can export your flows to a JSON file at any time to create a backup or share them. You can also import flows from a JSON file.

## User Interface Features

Both interfaces include:

- **Dark mode and light mode toggle**: The interface adapts to your system's theme preference by default, but you can switch manually using the theme button in the navigation bar
- **Responsive layout**: Works on different screen sizes

The Flow Composer Tool also includes:

- **Help modal**: Available from the navigation bar that explains how to use the various features of the tool

## Technical Requirements

Flow Composer runs entirely in your web browser. No server or installation is required. You need an internet connection to:

- Access the public archive display and view published flows
- Search and access materials from the Internet Archive (in the tool)
- Load materials for viewing

In the Flow Composer Tool, all flows are stored locally in your browser using localStorage. The public archive display loads published flows from the `flows/` directory.

