/**
 * Public Search Manager
 * Client-side search using Internet Archive Advanced Search API for collection
 */

class PublicSearchManager {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.currentPage = 1;
        this.resultsPerPage = 4;
        this.currentQuery = '';
        this.currentFilters = {
            documentType: '',
            dateStart: '',
            dateEnd: ''
        };
        this.isLoading = false;
        this.collection = (window.PROJECT_CONFIG && window.PROJECT_CONFIG.collectionId) ? window.PROJECT_CONFIG.collectionId : '';
        this.totalResults = 0;
    }

    /**
     * Initialize collection from config (call after config is loaded)
     */
    initializeCollection() {
        if (window.PROJECT_CONFIG && window.PROJECT_CONFIG.collectionId) {
            this.collection = window.PROJECT_CONFIG.collectionId;
        }
    }

    /**
     * Search the collection using Internet Archive Advanced Search API
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Function} onProgress - Optional callback for progress updates
     */
    async search(query = '', filters = {}, onProgress = null) {
        this.isLoading = true;
        this.currentQuery = query || '';
        // Store document type filter separately - don't include it in API query
        // We'll apply it client-side after getting all results
        const documentTypeFilter = filters.documentType || this.currentFilters.documentType;
        this.currentFilters = { ...this.currentFilters, ...filters };
        // Remove documentType from filters that go to API
        delete this.currentFilters.documentType;
        this.currentPage = 1; // Reset to first page on new search


        try {
            // Build search query with collection constraint
            let searchQuery = `collection:${this.collection}`;

            // Add text search if provided
            if (this.currentQuery.trim()) {
                const searchTerm = this.currentQuery.trim();
                // Search in title, description, creator, and subject fields
                const textSearch = `(title:(${searchTerm}) OR description:(${searchTerm}) OR creator:(${searchTerm}) OR subject:(${searchTerm}))`;
                searchQuery += ` AND ${textSearch}`;
            }

            // Document type filter is now applied client-side, not in API query
            // This allows users to switch document types without re-searching

            // Add date filters
            if (this.currentFilters.dateStart || this.currentFilters.dateEnd) {
                const startDate = this.currentFilters.dateStart || '*';
                const endDate = this.currentFilters.dateEnd || '*';
                searchQuery += ` AND date:[${startDate} TO ${endDate}]`;
            }

            // Build API request URL
            // Internet Archive API uses fl[] for field list - need to add each field separately
            const fields = ['identifier', 'title', 'description', 'creator', 'date', 'mediatype', 'language', 'publicdate', 'uploader', 'item_size', 'filecount', 'thumbnail'];

            const params = new URLSearchParams({
                q: searchQuery,
                output: 'json',
                rows: '10000', // Get up to 10000 results
                sort: 'date desc'
            });

            // Add field list parameters (fl[] for each field)
            fields.forEach(field => {
                params.append('fl[]', field);
            });

            if (onProgress) {
                onProgress(0, 0); // Indicate search started
            }

            const response = await fetch(`https://archive.org/advancedsearch.php?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.response || !data.response.docs) {
                console.warn('[PublicSearch] No results in API response');
                this.items = [];
                this.filteredItems = [];
                this.totalResults = 0;
                this.isLoading = false;
                return [];
            }

            // Transform results to match expected format
            const results = this.transformResults(data.response.docs);
            this.totalResults = data.response.numFound || results.length;
            this.items = results;

            // Apply document type filter client-side if one is set
            // Restore documentType to currentFilters for filtering
            if (documentTypeFilter) {
                this.currentFilters.documentType = documentTypeFilter;
                this.filteredItems = results.filter(item => item.type === documentTypeFilter);
            } else {
                this.currentFilters.documentType = '';
                this.filteredItems = results;
            }


            if (onProgress) {
                onProgress(results.length, this.totalResults);
            }

            this.isLoading = false;
            return this.getPaginatedResults();

        } catch (error) {
            console.error('[PublicSearch] Error performing search:', error);
            this.isLoading = false;
            this.items = [];
            this.filteredItems = [];
            this.totalResults = 0;
            return [];
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

    /**
     * Transform API results to match expected material format
     */
    transformResults(docs) {
        return docs.map(doc => {

            // Generate thumbnail URL
            let thumbnail = doc.thumbnail;
            if (!thumbnail && doc.identifier) {
                thumbnail = `https://archive.org/services/img/${doc.identifier}`;
            }

            return {
                identifier: doc.identifier,
                title: doc.title || 'Untitled',
                description: this.normalizeDescription(doc.description || doc.summary || doc.notes || ''),
                creator: doc.creator || doc.uploader || doc.contributor || 'Unknown',
                uploader: doc.uploader || null,
                date: doc.date || doc.publicdate || doc.year || 'Unknown date',
                language: doc.language || 'en',
                type: doc.mediatype || 'unknown',
                url: `https://archive.org/details/${doc.identifier}`,
                thumbnail: thumbnail,
                downloadUrl: null,
                fileCount: doc.filecount || 0,
                size: doc.item_size || 0,
                metadata: doc
            };
        });
    }

    /**
     * Browse all items in the collection (no search query)
     */
    async browseAll(onProgress = null, filters = {}) {
        return this.search('', filters, onProgress);
    }

    /**
     * Load items on demand (for backward compatibility)
     * Now uses browseAll to load all items from collection
     */
    async loadItems(onProgress = null) {
        if (this.items.length > 0) {
            if (onProgress) {
                onProgress(this.items.length, this.totalResults);
            }
            return this.items;
        }

        // Load all items from collection
        return this.browseAll(onProgress);
    }

    /**
     * Get paginated results
     */
    getPaginatedResults() {
        const startIndex = (this.currentPage - 1) * this.resultsPerPage;
        const endIndex = startIndex + this.resultsPerPage;
        return this.filteredItems.slice(startIndex, endIndex);
    }

    /**
     * Get total number of filtered results
     */
    getTotalResults() {
        // Always use filteredItems.length for accurate pagination
        // This ensures client-side filtering works correctly
        if (this.filteredItems.length > 0 || this.items.length === 0) {
            return this.filteredItems.length;
        }
        // Fallback to totalResults from API if no filtering has been applied
        return this.totalResults || this.items.length;
    }

    /**
     * Get total number of pages
     */
    getTotalPages() {
        return Math.ceil(this.getTotalResults() / this.resultsPerPage);
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
        }
        return this.getPaginatedResults();
    }

    /**
     * Change results per page
     */
    setResultsPerPage(count) {
        if (count === 'all' || count === Number.MAX_SAFE_INTEGER) {
            this.resultsPerPage = Number.MAX_SAFE_INTEGER;
        } else {
            this.resultsPerPage = count;
        }
        this.currentPage = 1;
        return this.getPaginatedResults();
    }

    /**
     * Clear filters and show all items
     */
    clearFilters() {
        this.currentQuery = '';
        this.currentFilters = {
            documentType: '',
            dateStart: '',
            dateEnd: ''
        };
        this.filteredItems = [...this.items];
        this.currentPage = 1;
        return this.getPaginatedResults();
    }
}

// Initialize and export
if (typeof window !== 'undefined') {
    window.publicSearchManager = new PublicSearchManager();
}
