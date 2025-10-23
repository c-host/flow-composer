/**
 * Filter Manager
 * Handles custom search filters for collections, playlists, and user profiles
 */
class FilterManager {
    constructor() {
        this.filters = [];
        this.activeFilters = [];
        this.storageKey = 'flowComposer_customFilters';
        this.loadFilters();
    }

    /**
     * Parse and categorize Internet Archive URLs
     * @param {string} url - Internet Archive URL
     * @returns {Object|null} Parsed filter object or null if invalid
     */
    parseUrl(url) {
        try {
            // Check if it's just a simple name (no URL)
            if (!url.includes('http') && !url.includes('archive.org')) {
                const name = url.trim();
                if (name && !name.includes('/') && !name.includes(' ')) {
                    // Smart detection: try both user and collection approaches
                    // We'll create a flexible filter that searches both
                    return {
                        type: 'smart',
                        identifier: name,
                        name: `Search: ${name}`,
                        url: `https://archive.org/search.php?query=${encodeURIComponent(name)}`,
                        icon: '<i data-feather="search" class="icon-sm"></i>',
                        searchConstraint: `(uploader:${name} OR creator:"${name}" OR collection:${name})`
                    };
                }
                return null;
            }

            const urlObj = new URL(url);

            // Must be archive.org domain
            if (!urlObj.hostname.includes('archive.org')) {
                return null;
            }

            const pathParts = urlObj.pathname.split('/').filter(part => part);

            // Collection URL: /details/collection-name
            if (pathParts[0] === 'details' && pathParts.length === 2) {
                return {
                    type: 'collection',
                    identifier: pathParts[1],
                    name: this.formatCollectionName(pathParts[1]),
                    url: url,
                    icon: '<i data-feather="book" class="icon-sm"></i>',
                    searchConstraint: `collection:${pathParts[1]}`
                };
            }

            // User profile URL: /details/@username/uploads
            if (pathParts[0] === 'details' && pathParts[1].startsWith('@') && pathParts[2] === 'uploads') {
                const username = pathParts[1].substring(1); // Remove @
                return {
                    type: 'user',
                    identifier: `@${username}`,
                    name: `User: ${username}`,
                    url: url,
                    icon: '<i data-feather="user" class="icon-sm"></i>',
                    searchConstraint: `(uploader:${username} OR creator:"${username}")`
                };
            }


            return null;
        } catch (error) {
            console.error('Error parsing URL:', error);
            return null;
        }
    }

    /**
     * Format collection name for display
     * @param {string} identifier - Collection identifier
     * @returns {string} Formatted name
     */
    formatCollectionName(identifier) {
        return identifier
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Add a new filter from URL
     * @param {string} url - Internet Archive URL
     * @returns {Object} Result object with success status and message
     */
    addFilter(url) {
        const parsed = this.parseUrl(url);

        if (!parsed) {
            return {
                success: false,
                message: 'Invalid input. Please provide a name (username, collection name) or a valid Internet Archive URL.'
            };
        }

        // Check if filter already exists
        const existingFilter = this.filters.find(f => f.identifier === parsed.identifier);
        if (existingFilter) {
            // If filter exists but is not active, activate it instead of creating a duplicate
            if (!this.activeFilters.includes(existingFilter.id)) {
                this.activeFilters.push(existingFilter.id);
                this.saveFilters();
                this.updateFilterButtons();
                this.updateSearchNote();
                return {
                    success: true,
                    message: `Activated existing filter: ${existingFilter.name}`,
                    filter: existingFilter
                };
            }
            return {
                success: false,
                message: `Filter "${parsed.name}" already exists and is active.`
            };
        }

        // Add to filters
        const filter = {
            ...parsed,
            id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            addedAt: new Date().toISOString()
        };

        this.filters.push(filter);

        // Automatically activate the new filter
        this.activeFilters.push(filter.id);

        this.saveFilters();

        return {
            success: true,
            message: `Added filter: ${filter.name}`,
            filter: filter
        };
    }

    /**
     * Remove a filter
     * @param {string} filterId - Filter ID to remove
     * @returns {boolean} Success status
     */
    removeFilter(filterId) {
        const initialLength = this.filters.length;
        this.filters = this.filters.filter(f => f.id !== filterId);
        this.activeFilters = this.activeFilters.filter(id => id !== filterId);

        if (this.filters.length < initialLength) {
            this.saveFilters();
            this.updateFilterButtons();
            this.updateSearchNote();
            this.updateFilterManagementModal();
            return true;
        }
        return false;
    }

    /**
     * Toggle filter active state
     * @param {string} filterId - Filter ID to toggle
     * @returns {boolean} New active state
     */
    toggleFilter(filterId) {
        const isActive = this.activeFilters.includes(filterId);

        if (isActive) {
            this.activeFilters = this.activeFilters.filter(id => id !== filterId);
        } else {
            this.activeFilters.push(filterId);
        }

        this.saveFilters();
        this.updateFilterButtons();
        this.updateSearchNote();
        this.updateFilterManagementModal();
        return !isActive;
    }

    /**
     * Get all filters
     * @returns {Array} Array of all filters
     */
    getAllFilters() {
        return [...this.filters];
    }

    /**
     * Get active filters
     * @returns {Array} Array of active filter objects
     */
    getActiveFilters() {
        return this.filters.filter(f => this.activeFilters.includes(f.id));
    }

    /**
     * Get search constraints for active filters
     * @returns {string} Combined search constraint string
     */
    getSearchConstraints() {
        const activeFilters = this.getActiveFilters();
        if (activeFilters.length === 0) {
            return '';
        }

        // If multiple filters, combine with OR
        if (activeFilters.length === 1) {
            return activeFilters[0].searchConstraint;
        }

        return `(${activeFilters.map(f => f.searchConstraint).join(' OR ')})`;
    }

    /**
     * Clear all active filters
     */
    clearActiveFilters() {
        this.activeFilters = [];
        this.saveFilters();
        this.updateFilterButtons();
        this.updateSearchNote();
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.filters = [];
        this.activeFilters = [];
        this.saveFilters();
        this.updateFilterButtons();
        this.updateSearchNote();
        this.updateFilterManagementModal();
    }

    /**
     * Get filter by ID
     * @param {string} filterId - Filter ID
     * @returns {Object|null} Filter object or null
     */
    getFilter(filterId) {
        return this.filters.find(f => f.id === filterId) || null;
    }

    /**
     * Check if filter is active
     * @param {string} filterId - Filter ID
     * @returns {boolean} Active state
     */
    isFilterActive(filterId) {
        return this.activeFilters.includes(filterId);
    }

    /**
     * Get filters by type
     * @param {string} type - Filter type (collection, user)
     * @returns {Array} Array of filters of specified type
     */
    getFiltersByType(type) {
        return this.filters.filter(f => f.type === type);
    }

    /**
     * Save filters to localStorage
     */
    saveFilters() {
        try {
            const data = {
                filters: this.filters,
                activeFilters: this.activeFilters,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving filters:', error);
        }
    }

    /**
     * Load filters from localStorage
     */
    loadFilters() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                this.filters = parsed.filters || [];
                this.activeFilters = parsed.activeFilters || [];
            }
        } catch (error) {
            console.error('Error loading filters:', error);
            this.filters = [];
            this.activeFilters = [];
        }
    }

    /**
     * Export filters to JSON
     * @returns {string} JSON string of filters
     */
    exportFilters() {
        return JSON.stringify({
            filters: this.filters,
            activeFilters: this.activeFilters,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    /**
     * Import filters from JSON
     * @param {string} jsonData - JSON string of filters
     * @returns {Object} Result object with success status and message
     */
    importFilters(jsonData) {
        try {
            const data = JSON.parse(jsonData);

            if (!data.filters || !Array.isArray(data.filters)) {
                return {
                    success: false,
                    message: 'Invalid filter data format.'
                };
            }

            // Validate filter structure
            const validFilters = data.filters.filter(filter => {
                return filter.id && filter.type && filter.identifier && filter.searchConstraint;
            });

            if (validFilters.length === 0) {
                return {
                    success: false,
                    message: 'No valid filters found in import data.'
                };
            }

            // Merge with existing filters (avoid duplicates)
            const existingIdentifiers = new Set(this.filters.map(f => f.identifier));
            const newFilters = validFilters.filter(f => !existingIdentifiers.has(f.identifier));

            this.filters.push(...newFilters);
            this.saveFilters();

            return {
                success: true,
                message: `Imported ${newFilters.length} new filters.`,
                importedCount: newFilters.length
            };
        } catch (error) {
            return {
                success: false,
                message: 'Error parsing import data: ' + error.message
            };
        }
    }

    /**
     * Get filter statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            total: this.filters.length,
            active: this.activeFilters.length,
            byType: {
                collection: 0,
                user: 0,
                smart: 0
            }
        };

        this.filters.forEach(filter => {
            if (stats.byType[filter.type] !== undefined) {
                stats.byType[filter.type]++;
            }
        });

        return stats;
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {Object} Validation result
     */
    validateUrl(url) {
        const parsed = this.parseUrl(url);
        return {
            isValid: parsed !== null,
            type: parsed?.type || null,
            message: parsed ? `Valid ${parsed.type} input` : 'Invalid input'
        };
    }

    // ===== UI METHODS =====

    /**
     * Add filter from main UI input
     */
    addFilterFromUI() {
        const input = document.getElementById('filter-url-input');
        if (!input) return;

        const url = input.value.trim();
        if (!url) {
            this.showNotification('Please enter a URL', 'error');
            return;
        }

        const result = this.addFilter(url);
        if (result.success) {
            input.value = '';
            this.updateFilterButtons();
            this.updateSearchNote();
            this.showNotification(result.message, 'success');

            // Debug logging
        } else {
            this.showNotification(result.message, 'error');
        }
    }

    /**
     * Add filter from modal input
     */
    addFilterFromModal() {
        const input = document.getElementById('modal-filter-url-input');
        if (!input) return;

        const url = input.value.trim();
        if (!url) {
            this.showNotification('Please enter a URL', 'error');
            return;
        }

        const result = this.addFilter(url);
        if (result.success) {
            input.value = '';
            this.updateFilterManagementModal();
            this.updateFilterButtons();
            this.showNotification(result.message, 'success');
        } else {
            this.showNotification(result.message, 'error');
        }
    }

    /**
     * Update filter buttons in main UI
     */
    updateFilterButtons() {
        const container = document.getElementById('filter-buttons');
        if (!container) return;

        const activeFilters = this.getActiveFilters();

        if (activeFilters.length === 0) {
            container.innerHTML = '<div class="no-active-filters">No active filters. Add filters to search within specific collections, users, or playlists.</div>';
            return;
        }

        container.innerHTML = activeFilters.map(filter => `
            <div class="filter-button" data-filter-id="${filter.id}">
                <span class="filter-icon">${filter.icon}</span>
                <span class="filter-name">${filter.name}</span>
                <button class="filter-remove" onclick="filterManager.removeFilter('${filter.id}')" title="Remove filter">
                    ×
                </button>
            </div>
        `).join('');
    }

    /**
     * Show filter management modal
     */
    showFilterManagementModal() {
        const modal = document.getElementById('filter-management-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.updateFilterManagementModal();
        }
    }

    /**
     * Hide filter management modal
     */
    hideFilterManagementModal() {
        const modal = document.getElementById('filter-management-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Update filter management modal content
     */
    updateFilterManagementModal() {
        this.updateFilterStats();
        this.updateFiltersList();
    }

    /**
     * Update filter statistics
     */
    updateFilterStats() {
        const container = document.getElementById('filter-stats');
        if (!container) return;

        const stats = this.getStats();
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-number">${stats.total}</span>
                    <span class="stat-label">Total Filters</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.active}</span>
                    <span class="stat-label">Active</span>
                </div>
            </div>
        `;
    }

    /**
     * Update filters list in modal
     */
    updateFiltersList() {
        const container = document.getElementById('filters-list');
        if (!container) return;

        const allFilters = this.getAllFilters();

        if (allFilters.length === 0) {
            container.innerHTML = '<div class="no-filters">No filters added yet. Add your first filter above!</div>';
            return;
        }

        container.innerHTML = allFilters.map(filter => `
            <div class="filter-item" data-filter-id="${filter.id}">
                <div class="filter-info">
                    <span class="filter-icon">${filter.icon}</span>
                    <div class="filter-details">
                        <div class="filter-name">${filter.name}</div>
                        <div class="filter-type">${filter.type.charAt(0).toUpperCase() + filter.type.slice(1)}</div>
                        <div class="filter-url">${filter.url}</div>
                    </div>
                </div>
                <div class="filter-actions">
                    <button class="btn btn-sm ${this.isFilterActive(filter.id) ? 'btn-primary' : 'btn-outline'}" 
                            onclick="filterManager.toggleFilter('${filter.id}')">
                        ${this.isFilterActive(filter.id) ? 'Active' : 'Inactive'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="filterManager.removeFilter('${filter.id}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Export filters to file
     */
    exportFiltersToFile() {
        try {
            const data = this.exportFilters();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `flow-composer-filters-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Filters exported successfully', 'success');
        } catch (error) {
            this.showNotification('Error exporting filters: ' + error.message, 'error');
        }
    }

    /**
     * Import filters from file
     */
    importFiltersFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = this.importFilters(e.target.result);
                if (result.success) {
                    this.updateFilterManagementModal();
                    this.updateFilterButtons();
                    this.showNotification(result.message, 'success');
                } else {
                    this.showNotification(result.message, 'error');
                }
            } catch (error) {
                this.showNotification('Error importing filters: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        if (window.demoApp && window.demoApp.showNotification) {
            window.demoApp.showNotification(message, type);
        } else {
        }
    }

    /**
     * Initialize UI components
     */
    initUI() {
        this.updateFilterButtons();
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Enter key support for filter inputs
        const inputs = ['filter-url-input', 'modal-filter-url-input'];
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        if (inputId === 'filter-url-input') {
                            this.addFilterFromUI();
                        } else {
                            this.addFilterFromModal();
                        }
                    }
                });
            }
        });

        // Search scope change listener
        const scopeInputs = document.querySelectorAll('input[name="search-scope"]');
        scopeInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateSearchNote();
            });
        });
    }

    /**
     * Update search note based on current scope and filters
     */
    updateSearchNote() {
        const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'filters';

        // Get scope config like the other implementations
        const scopeConfig = searchScope === 'filters' ? CONFIG.SEARCH_SCOPES.FILTERS : CONFIG.SEARCH_SCOPES.ALL;

        const searchNote = document.getElementById('search-note');
        const searchInput = document.getElementById('demo-search-query');
        const emptyStateMessage = document.getElementById('empty-state-message');

        if (searchNote) {
            if (searchScope === 'all') {
                searchNote.innerHTML = '<i data-feather="search" class="icon-sm"></i> Searching the entire Internet Archive';
            } else {
                const activeFilters = this.getActiveFilters();
                if (activeFilters.length === 0) {
                    searchNote.innerHTML = '<i data-feather="search" class="icon-sm"></i> No active filters. Add filters to search within specific collections, users, or playlists.';
                } else {
                    const filterNames = activeFilters.map(f => f.name).join(', ');
                    searchNote.innerHTML = `<i data-feather="search" class="icon-sm"></i> Searching within: ${filterNames}`;
                }
            }
        }

        // Set placeholder text for search input
        if (searchInput) {
            searchInput.placeholder = scopeConfig.placeholder;
        }

        if (emptyStateMessage) {
            emptyStateMessage.textContent = scopeConfig.emptyMessage;
        }

        // Replace Feather icons in the updated search note
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
}

// Initialize filter manager
window.filterManager = new FilterManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterManager;
} else {
    window.FilterManager = FilterManager;
}
