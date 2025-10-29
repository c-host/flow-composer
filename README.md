# Flow Composer

Flow Composer is a browser-based application for searching the Internet Archive, selecting materials, and organizing them into flows. A flow is a collection of materials arranged in a specific order and categorized by document type.

## Search Functionality

You can search the Internet Archive for materials including texts, images, audio recordings, and videos. The search supports three modes:

- Metadata only: searches titles, descriptions, and other metadata fields
- Full text content: searches the actual content of documents
- Both: combines metadata and full text searching

You can filter results by document type (texts, images, audio, videos) and choose how many results to display per page (6, 12, 24, or 48).

There are two search scope options:

- Entire Archive: searches across all materials in the Internet Archive
- Custom Filters: searches within specific collections, user uploads, or playlists you configure

### Custom Filter Management

You can save custom filters to search within specific Internet Archive collections or user profiles. To add a filter, enter a username or collection name. The system will search for that name as a user, collection, and creator.

You can view all your saved filters, activate or deactivate them, and remove them. Filters can be exported to a JSON file or imported from one.

## Material Selection and Management

When you search, results appear as cards showing the material title, creator, date, type, and a brief description. You can:

- Click any material card to view detailed information in a preview panel on the right
- Click the "Select" button to add materials to your selection
- View selected materials in a grid below the search results

The preview panel shows metadata such as title, creator, description, date, and file size. For media files, you can preview images, play audio or video, or view documents in the preview panel. A "Open Fullscreen" button is available for media that opens a larger viewing window.

You can clear all selected materials at once.

## Flows

A flow is a named collection of materials arranged in a specific order. Each material in a flow is assigned to one of eight document types:

1. Photographic Documentation - visual evidence and imagery
2. Conversational Documentation - oral histories and interviews
3. Endangered Documents - at-risk materials and ephemera
4. Academic Documents - research and scholarly analysis
5. Policy Documents - legislation and regulations
6. Financial Documents - economic and funding information
7. Ephemeral Web Documents - online content and digital media
8. Institutional Documents - official records and reports

### Creating Flows

To create a flow, select one or more materials from search results and click "Create Flow from Archival Materials". Give the flow a name and description, then assign each material to a document type. 

For each material, you can add research notes (annotations) that are saved with the material in the flow. These notes can include observations, connections to other materials, or any research-related information. 

Materials can be reordered by dragging them up or down in the list.

The flow creation interface shows which document types are represented in your flow so you can see what categories you have covered.

### Managing Flows

Once created, flows appear in the "Created Flows" section. You can:

- Click a flow to view its details, including all materials in order with their document type assignments and research notes
- Edit a flow to change its name, description, materials, document type assignments, or research notes
- Duplicate a flow to create a copy
- Delete a flow after confirming
- Search flows by name, description, material content, or research notes
- Export all flows to a JSON file for backup or sharing
- Import flows from a previously exported JSON file

You can also add selected materials to an existing flow using the "Add to Flow" button. If any materials already exist in the flow, you will be notified and can choose whether to add them anyway (which creates duplicates) or cancel.

## Data Management

All flows are automatically saved to your browser's local storage. If you close the application and return later, your flows will still be there. You can export your flows to a JSON file at any time to create a backup or share them. You can also import flows from a JSON file.

## User Interface Features

The application includes a dark mode and light mode toggle. The interface adapts to your system's theme preference by default, but you can switch manually using the theme button in the navigation bar.

A help modal is available from the navigation bar that explains how to use the various features of the application.

The layout is responsive and works on different screen sizes. The preview panel can be closed when not needed.

## Technical Requirements

Flow Composer runs entirely in your web browser. No server or installation is required. You need an internet connection to search and access materials from the Internet Archive. All data is stored locally in your browser using IndexedDB with a fallback to localStorage if IndexedDB is unavailable.

