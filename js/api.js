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
        try {
            // Build the search query
            const searchQuery = this.buildSearchQuery(query, filters);


            // For full-text search, use comprehensive search to get more results
            const searchType = filters.searchType || 'metadata';

            let allResults;

            if (searchType === 'fulltext' || searchType === 'both') {
                // Use comprehensive search for full-text and both modes to get more results
                allResults = await this.getComprehensiveFullTextResults(query, filters);
                this.allSearchResults = allResults;
                this.lastApiResponse = { response: { numFound: allResults.length } };
            } else {
                // For metadata search, use standard parameters
                const allResultsParams = new URLSearchParams({
                    q: searchQuery,
                    output: 'json',
                    rows: '1000', // Standard limit for metadata search
                    sort: 'date desc'
                });

                const response = await fetch(`${this.baseURL}?${allResultsParams}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Store the API response for total count access
                this.lastApiResponse = data;

                if (!data.response || !data.response.docs) {
                    this.allSearchResults = [];
                    this.lastSearchResults = [];
                    return [];
                }

                // Transform all results
                allResults = this.transformResults(data.response.docs);
                this.allSearchResults = allResults;
            }

            // Apply client-side pagination
            const resultsPerPage = filters.resultsPerPage || 6;
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
        let searchQuery = query;

        // Handle search type (metadata, fulltext, both)
        const searchType = filters.searchType || 'metadata';

        if (searchType === 'fulltext') {
            // For full-text search, we want to search within the actual OCR'd text content
            // Internet Archive's full-text search searches within document text content
            // We'll use the text field to search within OCR'd content
            searchQuery = `text:(${query})`;

            // For full-text search, we should NOT add collection constraints
            // as this limits the search scope and prevents finding content within documents
            // Only add basic filters that don't restrict the search scope

            // Add filters to the search query (but not collection constraints)
            if (filters.documentType) {
                searchQuery += ` AND mediatype:${filters.documentType}`;
            }

            if (filters.dateStart || filters.dateEnd) {
                const startDate = filters.dateStart || '*';
                const endDate = filters.dateEnd || '*';
                searchQuery += ` AND date:[${startDate} TO ${endDate}]`;
            }

            if (filters.language) {
                searchQuery += ` AND language:${filters.language}`;
            }

            return searchQuery;

        } else if (searchType === 'both') {
            // For both metadata and full-text, we'll search both
            // This combines metadata search with full-text search
            const metadataFields = [
                `title:(${query})`,
                `description:(${query})`,
                `creator:(${query})`,
                `subject:(${query})`,
                `collection:(${query})`
            ];
            const metadataSearch = `(${metadataFields.join(' OR ')})`;
            const fullTextSearch = `text:(${query})`;
            searchQuery = `(${metadataSearch} OR ${fullTextSearch})`;
        } else {
            // For metadata-only search, we can be more specific about which fields to search
            // This searches title, description, creator, subject, etc.
            // We'll use field-specific searches for better metadata targeting
            const metadataFields = [
                `title:(${query})`,
                `description:(${query})`,
                `creator:(${query})`,
                `subject:(${query})`,
                `collection:(${query})`
            ];
            searchQuery = `(${metadataFields.join(' OR ')})`;
        }

        // Add collection constraints based on active custom filters
        if (window.filterManager && filters.searchScope !== 'all') {
            const activeFilters = window.filterManager.getActiveFilters();

            if (activeFilters.length > 0) {
                // For regular filters, use standard search constraints
                const filterConstraints = activeFilters.map(f => f.searchConstraint).join(' OR ');
                searchQuery += ` AND (${filterConstraints})`;
            }
        }
        // For 'all' scope, don't add any collection constraints
        // This allows searching the entire Internet Archive without restrictions

        // Add filters to the search query
        if (filters.documentType) {
            searchQuery += ` AND mediatype:${filters.documentType}`;
        }

        if (filters.dateStart || filters.dateEnd) {
            const startDate = filters.dateStart || '*';
            const endDate = filters.dateEnd || '*';
            searchQuery += ` AND date:[${startDate} TO ${endDate}]`;
        }

        if (filters.location && filters.searchScope !== 'all') {
            searchQuery += ` AND coverage:${filters.location}`;
        }

        if (filters.language) {
            searchQuery += ` AND language:${filters.language}`;
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

    transformResults(docs) {
        // Filter out null/undefined docs first
        return docs
            .filter(doc => doc && typeof doc === 'object' && doc.identifier)
            .map(doc => ({
                identifier: doc.identifier,
                title: doc.title || doc.name || 'Untitled',
                description: doc.description || doc.summary || doc.notes || '',
                creator: doc.creator || doc.uploader || doc.contributor || 'Unknown',
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
            }));
    }

    transformItem(data) {
        if (!data.metadata) {
            return null;
        }

        const metadata = data.metadata;

        return {
            identifier: metadata.identifier,
            title: metadata.title || 'Untitled',
            description: metadata.description || metadata.summary || metadata.notes || '',
            creator: metadata.creator || metadata.uploader || metadata.contributor || 'Unknown',
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
                    // Debug logging removed
                    break;
                }

                const transformedResults = this.transformResults(data.response.docs);
                allResults.push(...transformedResults);


                // If we got fewer results than requested, we've reached the end
                if (data.response.docs.length < rowsPerRequest) {
                    // Debug logging removed
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