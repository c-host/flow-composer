// Internet Archive API Service
class InternetArchiveAPI {
    constructor() {
        this.baseURL = 'https://archive.org/advancedsearch.php';
        this.metadataURL = 'https://archive.org/metadata';
        this.lastSearchResults = []; // Store last search results for material selection
        this.allSearchResults = []; // Store all results for pagination
        this.lastApiResponse = null; // Store the last API response for total count
    }

    async search(query, filters = {}) {
        // Store filters for pagination
        this._lastFilters = filters;

        try {
            const trimmedQuery = query ? query.trim() : '';
            const searchQuery = this.buildSearchQuery(query, filters);

            // Validate query - ensure it's not empty
            if (!searchQuery || searchQuery.trim() === '') {
                console.warn('[InternetArchiveAPI] Empty search query, using wildcard');
                // For empty queries, use a wildcard that matches all items
                const finalQuery = (filters.searchScope === 'collection' && window.PROJECT_CONFIG && window.PROJECT_CONFIG.collectionId)
                    ? `collection:${window.PROJECT_CONFIG.collectionId}`
                    : '*';
                return this._performSearchWithQuery(finalQuery, filters);
            }

            return this._performSearchWithQuery(searchQuery, filters);

        } catch (error) {
            console.error('[InternetArchiveAPI] Error fetching from Internet Archive:', error);
            console.error('[InternetArchiveAPI] Error details:', {
                message: error.message,
                stack: error.stack,
                query: query,
                filters: filters
            });
            this.allSearchResults = [];
            this.lastSearchResults = [];
            return [];
        }
    }

    async _performSearchWithQuery(searchQuery, filters = {}) {
        try {
            // Build API request
            const buildParamsStart = performance.now();
            // For "Entire Archive" searches, use a smaller row limit to avoid connection resets
            // For collection searches, we can use more rows since the collection is smaller
            const maxRows = filters.searchScope === 'all' ? '1000' : '10000';

            const allResultsParams = new URLSearchParams({
                q: searchQuery,
                output: 'json',
                rows: maxRows, // Adjust based on search scope
                sort: 'date desc'
            });
            const apiUrl = `${this.baseURL}?${allResultsParams}`;

            let response;
            try {
                // Create AbortController for timeout (AbortSignal.timeout may not be available in all browsers)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
            } catch (fetchError) {
                console.error('[InternetArchiveAPI] Fetch error:', fetchError);
                if (fetchError.name === 'AbortError') {
                    throw new Error('Request timeout: The Internet Archive API took too long to respond.');
                } else if (fetchError.name === 'TypeError' && (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('ERR_NAME_NOT_RESOLVED') || fetchError.message.includes('ERR_CONNECTION_RESET'))) {
                    // Provide specific guidance for connection resets
                    if (fetchError.message.includes('ERR_CONNECTION_RESET') || fetchError.message.includes('Connection reset')) {
                        const collectionName = (window.PROJECT_CONFIG && window.PROJECT_CONFIG.projectName) ? window.PROJECT_CONFIG.projectName + ' Collection' : 'Collection';
                        throw new Error(`Connection reset: The Internet Archive API response was too large. Try narrowing your search terms or using the ${collectionName} scope for more targeted results.`);
                    }

                    throw new Error('Network error: Unable to reach the Internet Archive API. Please check your internet connection and try again.');
                }
                throw fetchError;
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error response');
                console.error('[InternetArchiveAPI] HTTP error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
            }

            let data;
            try {
                // Read response as text first to handle potential connection resets
                const responseText = await response.text();

                if (!responseText || responseText.trim() === '') {
                    throw new Error('Empty response from Internet Archive API');
                }

                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('[InternetArchiveAPI] JSON parse error:', parseError);

                // If it's a connection reset or incomplete JSON, provide helpful message
                if (parseError.message.includes('Unexpected end') || parseError.message.includes('JSON') || parseError.message.includes('incomplete')) {
                    const collectionName = (window.PROJECT_CONFIG && window.PROJECT_CONFIG.projectName) ? window.PROJECT_CONFIG.projectName + ' Collection' : 'Collection';
                    throw new Error(`The Internet Archive API response was incomplete. This may happen with very large result sets. Try narrowing your search or using the ${collectionName} scope.`);
                }

                throw new Error(`Failed to parse API response: ${parseError.message}`);
            }

            // Store the API response for total count access
            this.lastApiResponse = data;

            if (!data.response || !data.response.docs) {
                console.warn('[InternetArchiveAPI] No results in API response');
                this.allSearchResults = [];
                this.lastSearchResults = [];
                return [];
            }

            // Transform all results
            const allResults = this.transformResults(data.response.docs);
            this.allSearchResults = allResults;

            // Apply client-side pagination
            const resultsPerPage = filters.resultsPerPage === 'all' || filters.resultsPerPage === Number.MAX_SAFE_INTEGER
                ? Number.MAX_SAFE_INTEGER
                : (filters.resultsPerPage || 4);
            const page = filters.page || 1;
            const startIndex = (page - 1) * resultsPerPage;
            const endIndex = startIndex + resultsPerPage;
            const paginatedResults = allResults.slice(startIndex, endIndex);

            this.lastSearchResults = paginatedResults; // Store current page results

            return paginatedResults;

        } catch (error) {
            console.error('Error fetching from Internet Archive:', error);
            this.allSearchResults = [];
            this.lastSearchResults = [];
            return [];
        }
    }

    // Get all search results for pagination
    getAllSearchResults() {
        return this.allSearchResults;
    }

    // Get total count of all results
    getTotalResultsCount() {
        return this.lastApiResponse?.response?.numFound || 0;
    }

    // Get material by identifier from last search results
    getMaterialByIdentifier(identifier) {
        return this.allSearchResults.find(material => material.identifier === identifier) || null;
    }

    // Get all last search results
    getLastSearchResults() {
        return this.lastSearchResults;
    }

    buildSearchQuery(query, filters) {
        const trimmedQuery = query ? query.trim() : '';
        const isEmptyQuery = !trimmedQuery;
        let searchQuery = '';

        // Add collection constraint if searching collection scope
        if (filters.searchScope === 'collection' && window.PROJECT_CONFIG && window.PROJECT_CONFIG.collectionId) {
            searchQuery = `collection:${window.PROJECT_CONFIG.collectionId}`;
        }

        // Add text search if provided
        if (!isEmptyQuery) {
            // Search in title, description, creator, and subject fields
            const metadataFields = [
                `title:(${trimmedQuery})`,
                `description:(${trimmedQuery})`,
                `creator:(${trimmedQuery})`,
                `subject:(${trimmedQuery})`
            ];
            const textSearch = `(${metadataFields.join(' OR ')})`;

            if (searchQuery) {
                searchQuery += ` AND ${textSearch}`;
            } else {
                searchQuery = textSearch;
            }
        }

        // Document type filter is now applied client-side, not in API query
        // This allows users to switch document types without re-searching

        // Add date filters
        if (filters.dateStart || filters.dateEnd) {
            const startDate = filters.dateStart || '*';
            const endDate = filters.dateEnd || '*';
            if (searchQuery) {
                searchQuery += ` AND date:[${startDate} TO ${endDate}]`;
            } else {
                searchQuery = `date:[${startDate} TO ${endDate}]`;
            }
        }

        // Add language filter
        if (filters.language) {
            if (searchQuery) {
                searchQuery += ` AND language:${filters.language}`;
            } else {
                searchQuery = `language:${filters.language}`;
            }
        }

        return searchQuery;
    }

    async getItemDetails(identifier) {
        try {
            const response = await fetch(`${this.metadataURL}/${identifier}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.transformItem(data);

        } catch (error) {
            console.error('Error fetching item details:', error);
            return null;
        }
    }

    /**
     * Normalize description field - handle arrays and convert to string with preserved line breaks
     * @param {string|Array|undefined} description - Description from API (can be string, array, or undefined)
     * @returns {string} Normalized description string
     */
    normalizeDescription(description) {
        if (!description) {
            return '';
        }

        // If it's an array, join with newlines to preserve paragraph breaks
        if (Array.isArray(description)) {
            return description.filter(item => item != null).join('\n');
        }

        // If it's already a string, return as-is
        if (typeof description === 'string') {
            return description;
        }

        // Fallback: convert to string
        return String(description);
    }

    transformResults(docs) {
        // Filter out null/undefined docs first
        return docs
            .filter(doc => doc && typeof doc === 'object' && doc.identifier)
            .map(doc => {

                return {
                    identifier: doc.identifier,
                    title: doc.title || doc.name || 'Untitled',
                    description: this.normalizeDescription(doc.description || doc.summary || doc.notes || ''),
                    creator: doc.creator || doc.uploader || doc.contributor || 'Unknown',
                    uploader: doc.uploader || null,
                    date: doc.date || doc.publicdate || doc.year || 'Unknown date',
                    language: doc.language || 'en',
                    type: doc.mediatype || 'unknown',
                    url: `https://archive.org/details/${doc.identifier}`,
                    thumbnail: doc.thumbnail || null,
                    downloadUrl: doc.downloadUrl || null,
                    fileCount: doc.filecount || 0,
                    size: doc.size || 0,
                    text: doc.text || null, // Include text content for full-text search
                    metadata: doc
                };
            });
    }

    transformItem(data) {
        if (!data.metadata) {
            return null;
        }

        const metadata = data.metadata;

        return {
            identifier: metadata.identifier,
            title: metadata.title || 'Untitled',
            description: this.normalizeDescription(metadata.description || metadata.summary || metadata.notes || ''),
            creator: metadata.creator || metadata.uploader || metadata.contributor || 'Unknown',
            uploader: metadata.uploader || null,
            date: metadata.date || metadata.publicdate || metadata.year || 'Unknown date',
            language: metadata.language || 'en',
            type: metadata.mediatype || 'unknown',
            url: `https://archive.org/details/${metadata.identifier}`,
            thumbnail: metadata.thumbnail || null,
            downloadUrl: metadata.downloadUrl || null,
            fileCount: metadata.filecount || 0,
            size: metadata.size || 0,
            metadata: metadata
        };
    }

    // Get sample materials for demonstration
    async getSampleMaterials() {
        const sampleQueries = [
            'culture'
        ];

        const allResults = [];

        for (const query of sampleQueries) {
            try {
                const results = await this.search(query, {});
                allResults.push(...results.slice(0, 3)); // Take first 3 from each query
            } catch (error) {
                console.error(`Error fetching sample materials for query "${query}":`, error);
            }
        }

        // Remove duplicates and return unique results
        const uniqueResults = allResults.filter((item, index, self) =>
            index === self.findIndex(t => t.identifier === item.identifier)
        );

        return uniqueResults.slice(0, 12); // Return max 12 unique results
    }

    // Search with specific document type focus
    async searchByDocumentType(documentType, query = '') {
        return this.search(query, { documentType });
    }

    // Format file size for display
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format date for display
    formatDate(dateString) {
        if (!dateString || dateString === 'Unknown date') {
            return 'Unknown date';
        }

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    // Get document type icon
    getDocumentTypeIcon(type) {
        const icons = {
            texts: '<i data-feather="file-text" class="icon-sm"></i>',
            image: '<i data-feather="image" class="icon-sm"></i>',
            audio: '<i data-feather="music" class="icon-sm"></i>',
            video: '<i data-feather="video" class="icon-sm"></i>',
            movie: '<i data-feather="video" class="icon-sm"></i>',
            movies: '<i data-feather="video" class="icon-sm"></i>',
            software: '<i data-feather="hard-drive" class="icon-sm"></i>',
            web: '<i data-feather="globe" class="icon-sm"></i>',
            data: '<i data-feather="bar-chart-2" class="icon-sm"></i>',
            collection: '<i data-feather="book" class="icon-sm"></i>'
        };

        return icons[type] || '<i data-feather="file-text" class="icon-sm"></i>';
    }

    // Check if item is accessible
    isItemAccessible(item) {
        return item && item.identifier && item.url;
    }

    // Get preview URL for different media types
    getPreviewUrl(item) {
        if (!item || !item.identifier) return null;

        const type = item.type;
        if (type === 'image') {
            return `https://archive.org/services/img/${item.identifier}`;
        } else if (type === 'texts') {
            return `https://archive.org/stream/${item.identifier}`;
        } else if (type === 'audio' || type === 'video' || type === 'movie') {
            return `https://archive.org/embed/${item.identifier}`;
        }

        return item.url;
    }

    // Get media information for an item
    async getMediaInfo(identifier) {
        try {
            const response = await fetch(`${this.metadataURL}/${identifier}`);
            if (!response.ok) return null;

            const data = await response.json();
            if (!data.files) return null;

            const files = Object.values(data.files);

            const mediaInfo = {
                hasVideo: false,
                hasAudio: false,
                hasImages: false,
                hasDocuments: false,
                videoFiles: [],
                audioFiles: [],
                imageFiles: [],
                documentFiles: []
            };

            files.forEach(file => {
                const format = file.format?.toLowerCase() || '';
                const name = file.name?.toLowerCase() || '';
                const source = file.source?.toLowerCase() || '';

                // Enhanced video detection
                if (format.includes('video') || format.includes('movie') ||
                    name.includes('.mp4') || name.includes('.avi') || name.includes('.mov') ||
                    name.includes('.webm') || name.includes('.mkv') || name.includes('.flv')) {
                    mediaInfo.hasVideo = true;
                    mediaInfo.videoFiles.push(file);
                }
                // Enhanced audio detection
                else if (format.includes('audio') || format.includes('sound') ||
                    name.includes('.mp3') || name.includes('.wav') || name.includes('.ogg') ||
                    name.includes('.flac') || name.includes('.aac') || name.includes('.m4a') ||
                    source.includes('audio') || source.includes('sound')) {
                    mediaInfo.hasAudio = true;
                    mediaInfo.audioFiles.push(file);
                }
                // Enhanced image detection
                else if (format.includes('image') || format.includes('picture') ||
                    name.includes('.jpg') || name.includes('.jpeg') || name.includes('.png') ||
                    name.includes('.gif') || name.includes('.bmp') || name.includes('.webp')) {
                    mediaInfo.hasImages = true;
                    mediaInfo.imageFiles.push(file);
                }
                // Enhanced document detection
                else if (format.includes('text') || format.includes('document') ||
                    name.includes('.pdf') || name.includes('.txt') || name.includes('.doc') ||
                    name.includes('.docx') || name.includes('.rtf') || name.includes('.odt')) {
                    mediaInfo.hasDocuments = true;
                    mediaInfo.documentFiles.push(file);
                }
            });

            return mediaInfo;
        } catch (error) {
            console.error('Error getting media info:', error);
            return null;
        }
    }

    // Get embed URL for different media types
    getEmbedUrl(identifier, mediaType) {
        if (mediaType === 'video' || mediaType === 'movie') {
            return this.getVideoEmbedUrl(identifier);
        } else if (mediaType === 'audio') {
            return this.getAudioEmbedUrl(identifier);
        }
        return null;
    }

    getVideoEmbedUrl(identifier) {
        return `https://archive.org/embed/${identifier}`;
    }

    getAudioEmbedUrl(identifier) {
        return `https://archive.org/embed/${identifier}`;
    }

    // Get direct media URL
    async getDirectMediaUrl(identifier, mediaType) {
        try {
            const mediaInfo = await this.getMediaInfo(identifier);
            if (!mediaInfo) return null;

            if (mediaType === 'video' && mediaInfo.videoFiles.length > 0) {
                const videoFile = mediaInfo.videoFiles[0];
                return `https://archive.org/download/${identifier}/${videoFile.name}`;
            } else if (mediaType === 'audio' && mediaInfo.audioFiles.length > 0) {
                const audioFile = mediaInfo.audioFiles[0];
                return `https://archive.org/download/${identifier}/${audioFile.name}`;
            }

            return null;
        } catch (error) {
            console.error('Error getting direct media URL:', error);
            return null;
        }
    }

    // Check if media type is playable
    hasPlayableMedia(mediaType) {
        return ['audio', 'video', 'movie'].includes(mediaType);
    }

    // Smart check for playable media
    async hasPlayableMediaSmart(identifier, mediaType) {
        if (!this.hasPlayableMedia(mediaType)) return false;

        try {
            const mediaInfo = await this.getMediaInfo(identifier);
            if (!mediaInfo) return false;

            if (mediaType === 'video' || mediaType === 'movie') {
                return mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0;
            } else if (mediaType === 'audio') {
                return mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0;
            }

            return false;
        } catch (error) {
            console.error('Error checking playable media:', error);
            return false;
        }
    }

    // Check if item has document viewer
    async hasDocumentViewer(identifier, mediaType) {
        if (mediaType !== 'texts') return false;

        try {
            const mediaInfo = await this.getMediaInfo(identifier);
            if (!mediaInfo) return false;

            // Check if there are PDF files or other viewable documents
            const hasViewableDocs = mediaInfo.documentFiles.some(file => {
                const name = file.name?.toLowerCase() || '';
                return name.includes('.pdf') || name.includes('.txt') || name.includes('.html');
            });

            return hasViewableDocs;
        } catch (error) {
            console.error('Error checking document viewer:', error);
            return false;
        }
    }

    // Get document preview URL
    getDocumentPreviewUrl(identifier) {
        return `https://archive.org/stream/${identifier}`;
    }

    // Get item embed HTML
    getItemEmbedHTML(identifier) {
        return `
            <iframe 
                src="https://archive.org/embed/${identifier}" 
                width="100%" 
                height="400" 
                frameborder="0" 
                webkitallowfullscreen="true" 
                mozallowfullscreen="true">
            </iframe>
        `;
    }

    // Get document viewer HTML
    getDocumentViewerHTML(identifier, title = '') {
        return `
            <div class="document-viewer">
                <div class="document-viewer-header">
                    <h4>${title || 'Document Viewer'}</h4>
                </div>
                <div class="document-viewer-container">
                    <iframe 
                        src="https://archive.org/stream/${identifier}" 
                        width="100%" 
                        height="500" 
                        frameborder="0">
                    </iframe>
                </div>
                <div class="document-viewer-footer">
                    <a href="https://archive.org/details/${identifier}" target="_blank" class="btn btn-secondary">
                        View on Internet Archive
                    </a>
                </div>
            </div>
        `;
    }

    // Get playable media type
    async getPlayableMediaType(identifier, mediaType) {
        try {
            const mediaInfo = await this.getMediaInfo(identifier);
            if (!mediaInfo) return null;

            if (mediaType === 'video' || mediaType === 'movie') {
                if (mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0) {
                    const videoFile = mediaInfo.videoFiles[0];
                    return {
                        type: 'video',
                        url: `https://archive.org/download/${identifier}/${videoFile.name}`,
                        embedUrl: this.getVideoEmbedUrl(identifier),
                        fileName: videoFile.name,
                        size: videoFile.size
                    };
                }
            } else if (mediaType === 'audio') {
                if (mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0) {
                    const audioFile = mediaInfo.audioFiles[0];
                    return {
                        type: 'audio',
                        url: `https://archive.org/download/${identifier}/${audioFile.name}`,
                        embedUrl: this.getAudioEmbedUrl(identifier),
                        fileName: audioFile.name,
                        size: audioFile.size
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Error getting playable media type:', error);
            return null;
        }
    }

    // Get media player HTML
    getMediaPlayerHTML(identifier, mediaType, title = '') {
        const embedUrl = this.getEmbedUrl(identifier, mediaType);
        if (!embedUrl) return null;

        return `
            <div class="media-player">
                <div class="media-player-header">
                    <h4>${title || 'Media Player'}</h4>
                </div>
                <div class="media-player-container">
                    <iframe 
                        src="${embedUrl}" 
                        width="100%" 
                        height="300" 
                        frameborder="0" 
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true">
                    </iframe>
                </div>
                <div class="media-player-info">
                    <h4>${title || 'Media Content'}</h4>
                    <div class="media-player-controls">
                        <a href="https://archive.org/details/${identifier}" target="_blank" class="media-link">
                            View on Internet Archive
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    // Get video information
    async getVideoInfo(identifier) {
        try {
            const mediaInfo = await this.getMediaInfo(identifier);
            if (!mediaInfo || !mediaInfo.hasVideo) return null;

            const videoFiles = mediaInfo.videoFiles;
            if (videoFiles.length === 0) return null;

            // Sort by file size (largest first) to get the best quality
            videoFiles.sort((a, b) => (b.size || 0) - (a.size || 0));

            const bestVideo = videoFiles[0];
            return {
                fileName: bestVideo.name,
                size: bestVideo.size,
                format: bestVideo.format,
                url: `https://archive.org/download/${identifier}/${bestVideo.name}`,
                embedUrl: this.getVideoEmbedUrl(identifier)
            };
        } catch (error) {
            console.error('Error getting video info:', error);
            return null;
        }
    }

    // Check if item is a video
    async isVideo(identifier) {
        const mediaInfo = await this.getMediaInfo(identifier);
        return mediaInfo && mediaInfo.hasVideo;
    }

    // Check if item is a movie
    async isMovie(identifier) {
        return this.isVideo(identifier);
    }

    // Get text snippets from search results to show search term context
    getTextSnippets(material, searchQuery) {
        try {
            // If the material has text content from the API response
            if (material.text && Array.isArray(material.text)) {
                const snippets = [];
                const query = searchQuery.toLowerCase();

                // Extract snippets that contain the search query
                material.text.forEach((textBlock, index) => {
                    if (textBlock.toLowerCase().includes(query)) {
                        // Find the position of the search term
                        const lowerText = textBlock.toLowerCase();
                        const queryIndex = lowerText.indexOf(query);

                        if (queryIndex !== -1) {
                            // Extract context around the search term (100 characters before and after)
                            const start = Math.max(0, queryIndex - 100);
                            const end = Math.min(textBlock.length, queryIndex + query.length + 100);
                            let snippet = textBlock.substring(start, end);

                            // Add ellipsis if we're not at the beginning/end
                            if (start > 0) snippet = '...' + snippet;
                            if (end < textBlock.length) snippet = snippet + '...';

                            // Highlight the search term in the snippet
                            const highlightedSnippet = snippet.replace(
                                new RegExp(searchQuery, 'gi'),
                                match => `<mark>${match}</mark>`
                            );

                            snippets.push({
                                text: highlightedSnippet,
                                page: index + 1,
                                position: queryIndex
                            });
                        }
                    }
                });

                return snippets.slice(0, 3); // Return up to 3 snippets
            }

            return [];
        } catch (error) {
            console.error('Error extracting text snippets:', error);
            return [];
        }
    }


    // Get comprehensive metadata search results (for browse all items)
    async getComprehensiveMetadataResults(filters = {}) {
        try {
            const activeFilters = window.filterManager ? window.filterManager.getActiveFilters() : [];

            // If we have multiple filters, try searching each separately and combining results
            // This can sometimes return more results than a single combined OR query
            if (activeFilters.length > 1) {
                return await this.getComprehensiveMetadataResultsPerFilter(filters, activeFilters);
            }

            const searchQuery = this.buildSearchQuery('', filters);

            const allResults = [];
            let totalCount = 0;
            const maxRequests = 20; // Make up to 20 requests to get more results (up to 20,000 items)
            const rowsPerRequest = 1000; // Internet Archive API limit per request

            for (let i = 0; i < maxRequests; i++) {
                const start = i * rowsPerRequest;

                const params = new URLSearchParams({
                    q: searchQuery,
                    output: 'json',
                    rows: rowsPerRequest.toString(),
                    start: start.toString(),
                    sort: 'date desc',
                    fl: 'identifier,title,description,creator,date,mediatype,language,downloads,publicdate,collection,subject,uploader,filecount,size,thumbnail'
                });

                const response = await fetch(`${this.baseURL}?${params}`);

                if (!response.ok) {
                    break;
                }

                const data = await response.json();

                if (!data.response || !data.response.docs || data.response.docs.length === 0) {
                    break;
                }

                // Capture total count from first request
                if (i === 0 && data.response.numFound) {
                    totalCount = data.response.numFound;
                }

                const transformedResults = this.transformResults(data.response.docs);
                allResults.push(...transformedResults);

                // If we got fewer results than requested, we've reached the end
                if (data.response.docs.length < rowsPerRequest) {
                    break;
                }

                // Small delay between requests to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            return {
                results: allResults,
                totalCount: totalCount || allResults.length
            };

        } catch (error) {
            console.error('Error in comprehensive metadata search:', error);
            return { results: [], totalCount: 0 };
        }
    }

    // Get comprehensive metadata search results by searching each filter separately
    async getComprehensiveMetadataResultsPerFilter(filters = {}, activeFilters = []) {
        try {

            const allResults = [];
            const seenIdentifiers = new Set();
            let totalCount = 0;
            const maxRequestsPerFilter = 20;
            const rowsPerRequest = 1000;

            // Helper function to search a single filter (returns results, doesn't modify shared state)
            const searchSingleFilter = async (filter, filterIndex) => {

                // Local results for this filter only
                const filterResults = [];
                const filterSeenIdentifiers = new Set();

                // Optimized: Search uploader and collection fields, with fallback to plain text
                // Extract the username/identifier from the filter
                const identifier = filter.identifier;
                let queriesToTry = [];

                if (identifier && filter.type === 'smart') {
                    // Primary: Use only the most effective query method first
                    // Based on testing: uploader:"identifier" is the recommended and most reliable format
                    // Try this first, and only use fallbacks if it returns 0 results
                    queriesToTry = [
                        `uploader:"${identifier}"` // Primary: Quoted username (recommended format - this works!)
                    ];
                } else {
                    // For non-smart filters, use the original constraint
                    queriesToTry = [filter.searchConstraint];
                }

                // Helper function to fetch all pages for a query
                const fetchAllPagesForQuery = async (query, queryName) => {
                    const queryResults = [];
                    for (let i = 0; i < maxRequestsPerFilter; i++) {
                        const start = i * rowsPerRequest;

                        const params = new URLSearchParams({
                            q: query,
                            output: 'json',
                            rows: rowsPerRequest.toString(),
                            start: start.toString(),
                            sort: 'date desc',
                            fl: 'identifier,title,description,creator,date,mediatype,language,downloads,publicdate,collection,subject,uploader,filecount,size,thumbnail'
                        });

                        const response = await fetch(`${this.baseURL}?${params}`);

                        if (!response.ok) {
                            break;
                        }

                        const data = await response.json();

                        if (!data.response || !data.response.docs || data.response.docs.length === 0) {
                            break;
                        }

                        const transformedResults = this.transformResults(data.response.docs);
                        queryResults.push(...transformedResults);

                        if (data.response.docs.length < rowsPerRequest) {
                            break;
                        }

                        // Reduced delay for faster performance (50ms instead of 100ms)
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    return queryResults;
                };

                // Try primary query first - if it works, skip all fallbacks
                const primaryQuery = queriesToTry[0];
                const primaryResults = await fetchAllPagesForQuery(primaryQuery, 'Primary query');

                // Add only unique results (by identifier) to this filter's results
                let newItems = 0;
                for (const result of primaryResults) {
                    if (!filterSeenIdentifiers.has(result.identifier)) {
                        filterSeenIdentifiers.add(result.identifier);
                        filterResults.push(result);
                        newItems++;
                    }
                }

                const foundResults = newItems > 0;

                // For smart filters, try additional query strategies
                if (identifier && filter.type === 'smart') {
                    // Fallback: If primary query returned 0 results, try minimal fallback queries
                    // Only try these if the primary uploader query failed
                    if (!foundResults) {
                        // Minimal fallback set: try unquoted uploader, then creator, then subject
                        const fallbackQueries = [
                            `uploader:${identifier}`, // Unquoted uploader (in case quotes cause issues)
                            `creator:"${identifier}"`, // Creator field
                            `subject:${identifier}` // Subject field
                        ];

                        // Run fallback queries in parallel
                        const fallbackPromises = fallbackQueries.map(async (fallbackQuery, fallbackIndex) => {
                            const queryResults = [];
                            for (let i = 0; i < maxRequestsPerFilter; i++) {
                                const start = i * rowsPerRequest;

                                const params = new URLSearchParams({
                                    q: fallbackQuery,
                                    output: 'json',
                                    rows: rowsPerRequest.toString(),
                                    start: start.toString(),
                                    sort: 'date desc',
                                    fl: 'identifier,title,description,creator,date,mediatype,language,downloads,publicdate,collection,subject,uploader,filecount,size,thumbnail'
                                });

                                const response = await fetch(`${this.baseURL}?${params}`);

                                if (!response.ok) {
                                    break;
                                }

                                const data = await response.json();

                                if (!data.response || !data.response.docs || data.response.docs.length === 0) {
                                    break;
                                }

                                const transformedResults = this.transformResults(data.response.docs);
                                queryResults.push(...transformedResults);

                                if (data.response.docs.length < rowsPerRequest) {
                                    break;
                                }

                                // Reduced delay (50ms instead of 100ms)
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }
                            return { query: fallbackQuery, results: queryResults };
                        });

                        const fallbackResults = await Promise.all(fallbackPromises);

                        // Merge all fallback results into this filter's results
                        for (const { query, results } of fallbackResults) {
                            for (const result of results) {
                                if (!filterSeenIdentifiers.has(result.identifier)) {
                                    filterSeenIdentifiers.add(result.identifier);
                                    filterResults.push(result);
                                }
                            }
                        }
                    }

                    // Only try plain text search if we still have 0 results after all field queries
                    if (filterResults.length === 0) {
                        const plainTextQuery = identifier;
                        const queryResults = await fetchAllPagesForQuery(plainTextQuery, `Plain text search`);

                        // Add only unique results (by identifier) to this filter's results
                        for (const result of queryResults) {
                            if (!filterSeenIdentifiers.has(result.identifier)) {
                                filterSeenIdentifiers.add(result.identifier);
                                filterResults.push(result);
                            }
                        }
                    }
                }

                // Return results for this filter
                return filterResults;
            };

            // Search all filters in parallel instead of sequentially
            const filterSearchPromises = activeFilters.map((filter, index) =>
                searchSingleFilter(filter, index)
            );

            const allFilterResults = await Promise.all(filterSearchPromises);

            // Merge all filter results, removing duplicates
            for (const filterResults of allFilterResults) {
                for (const result of filterResults) {
                    if (!seenIdentifiers.has(result.identifier)) {
                        seenIdentifiers.add(result.identifier);
                        allResults.push(result);
                    }
                }
            }

            return {
                results: allResults,
                totalCount: allResults.length // Use actual unique count
            };

        } catch (error) {
            console.error('Error in per-filter comprehensive metadata search:', error);
            return { results: [], totalCount: 0 };
        }
    }

    // Get comprehensive full-text search results
    async getComprehensiveFullTextResults(query, filters = {}) {
        try {
            const searchQuery = this.buildSearchQuery(query, { ...filters, searchType: 'fulltext' });
            const allResults = [];
            const maxRequests = 10; // Make up to 10 requests to get more results
            const rowsPerRequest = 1000; // Use smaller batches for better reliability

            for (let i = 0; i < maxRequests; i++) {
                const start = i * rowsPerRequest;

                const params = new URLSearchParams({
                    q: searchQuery,
                    output: 'json',
                    rows: rowsPerRequest.toString(),
                    start: start.toString(),
                    sort: 'downloads desc',
                    fl: 'identifier,title,description,creator,date,mediatype,language,downloads,publicdate,collection,subject,uploader,filecount,size,thumbnail,text'
                });

                const response = await fetch(`${this.baseURL}?${params}`);

                if (!response.ok) {
                    console.warn(`Full-text request ${i + 1} failed:`, response.status);
                    break;
                }

                const data = await response.json();

                if (!data.response || !data.response.docs || data.response.docs.length === 0) {
                    break;
                }

                const transformedResults = this.transformResults(data.response.docs);
                allResults.push(...transformedResults);


                // If we got fewer results than requested, we've reached the end
                if (data.response.docs.length < rowsPerRequest) {
                    break;
                }

                // Small delay between requests to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            return allResults;

        } catch (error) {
            console.error('Error in comprehensive full-text search:', error);
            return [];
        }
    }
}

// Initialize the API
window.internetArchiveAPI = new InternetArchiveAPI(); 