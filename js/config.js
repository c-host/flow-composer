/**
 * Application Configuration
 * Centralized configuration for the Archival Framework Demo
 */

// Detect application mode (backend tool vs public frontend)
const APP_MODE = (function () {
    const path = window.location.pathname;
    if (path.includes('/tool/') || path.includes('/tool/index.html')) {
        return 'backend';
    }
    return 'frontend';
})();

const CONFIG = {
    // Application Mode
    MODE: APP_MODE,
    IS_BACKEND: APP_MODE === 'backend',
    IS_FRONTEND: APP_MODE === 'frontend',
    // API Configuration
    API: {
        BASE_URL: 'https://archive.org',
        SEARCH_ENDPOINT: '/advancedsearch.php',
        METADATA_ENDPOINT: '/metadata',
        EMBED_BASE_URL: 'https://archive.org/embed'
    },

    // Search Configuration
    SEARCH: {
        DEFAULT_QUERY: '',
        DEFAULT_SCOPE: 'all',
        RESULTS_PER_PAGE_OPTIONS: [6, 12, 24, 50],
        DEFAULT_RESULTS_PER_PAGE: 6,
        MAX_RESULTS: 1000
    },

    // Document Types
    DOCUMENT_TYPES: {
        TEXTS: 'texts',
        IMAGE: 'image',
        AUDIO: 'audio',
        MOVIE: 'movie',
        VIDEO: 'video'
    },

    // Flow Configuration
    FLOW: {
        ICONS: [
            { value: '<i data-feather="home" class="icon-sm"></i>', label: 'Institutional' },
            { value: '<i data-feather="users" class="icon-sm"></i>', label: 'Community' },
            { value: '<i data-feather="book" class="icon-sm"></i>', label: 'Knowledge' },
            { value: '<i data-feather="message-circle" class="icon-sm"></i>', label: 'Dialogue' },
            { value: '<i data-feather="arrow-right" class="icon-sm"></i>', label: 'Water' },
            { value: '<i data-feather="layers" class="icon-sm"></i>', label: 'Landscape' },
            { value: '<i data-feather="book" class="icon-sm"></i>', label: 'Archive' },
            { value: '<i data-feather="search" class="icon-sm"></i>', label: 'Research' }
        ],
        DEFAULT_COLOR: '#000000',
        DEFAULT_ICON: '<i data-feather="home" class="icon-sm"></i>'
    },

    // Material Assignment Types (loaded from PROJECT_CONFIG)
    get MATERIAL_TYPES() {
        if (window.PROJECT_CONFIG && window.PROJECT_CONFIG.documentTypes) {
            return window.PROJECT_CONFIG.documentTypes.map(type => ({
                value: type.id,
                label: type.label
            }));
        }
        // Fallback to default
        return [
            { value: 'photographic', label: 'Photographic' },
            { value: 'conversational', label: 'Conversational' },
            { value: 'endangered', label: 'Endangered' },
            { value: 'academic', label: 'Academic' },
            { value: 'policy', label: 'Policy' },
            { value: 'financial', label: 'Financial' },
            { value: 'ephemeral', label: 'Ephemeral Web' },
            { value: 'institutional', label: 'Institutional' }
        ];
    },

    // UI Configuration
    UI: {
        ANIMATION_DURATION: 300,
        NOTIFICATION_DURATION: 3000,
        MODAL_ANIMATION_DURATION: 300,
        LOADING_DELAY: 100
    },

    // Search Scope Configuration (loaded from PROJECT_CONFIG)
    get SEARCH_SCOPES() {
        const projectConfig = window.PROJECT_CONFIG || {};
        const collectionId = projectConfig.collectionId || '';
        const projectName = projectConfig.projectName || 'Collection';

        return {
            COLLECTION: {
                value: 'collection',
                label: `${projectName} Collection`,
                description: `Search within the ${projectName} collection`,
                placeholder: 'Enter search terms for your research topic',
                emptyMessage: `Enter search terms to find materials in the ${projectName} collection.`,
                url: projectConfig.collectionUrl || null
            },
            ALL: {
                value: 'all',
                label: 'Entire Internet Archive',
                description: 'Search the entire Internet Archive',
                placeholder: 'Enter search terms for your research topic',
                emptyMessage: 'Click the search button above to find materials in the entire Internet Archive.',
                url: null
            }
        };
    },

    // Error Messages
    ERRORS: {
        SEARCH_FAILED: 'Search failed. Please try again.',
        MATERIAL_NOT_FOUND: 'Material not found in search results',
        FLOW_NOT_FOUND: 'Flow not found',
        API_NOT_AVAILABLE: 'Internet Archive API not loaded',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        INVALID_INPUT: 'Please enter a valid search term'
    },

    // Success Messages
    SUCCESS: {
        MATERIAL_SELECTED: 'Material selected',
        MATERIAL_REMOVED: 'Material removed',
        FLOW_SELECTED: 'Flow selected',
        FLOW_REMOVED: 'Flow removed',
        FLOW_CREATED: 'Flow created successfully!',
        MATERIALS_CLEARED: 'All materials cleared'
    },

    // CSS Classes
    CLASSES: {
        SELECTED: 'selected',
        LOADING: 'loading',
        ERROR: 'error',
        SUCCESS: 'success',
        INFO: 'info',
        HIDDEN: 'hidden',
        DISABLED: 'disabled'
    },

    // DOM Selectors
    SELECTORS: {
        SEARCH_QUERY: '#demo-search-query',
        SEARCH_BUTTON: '#search-button',
        SEARCH_RESULTS: '#demo-search-results',
        SELECTED_MATERIALS_COUNT: '#selected-materials-count',
        SELECTED_MATERIALS_LIST: '#selected-materials-list',
        CREATE_FLOW_BTN: '#create-flow-btn',
        FLOW_CREATION_MODAL: '#flow-creation-modal',
        FLOW_DETAILS_MODAL: '#flow-details-modal',
        CREATED_FLOWS_CONTAINER: '#created-flows-container',
        APP_STATUS: '#app-status'
    }
};

// Freeze the configuration to prevent modifications
Object.freeze(CONFIG);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
} 