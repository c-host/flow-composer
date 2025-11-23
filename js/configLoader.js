/**
 * Configuration Loader
 * Loads and validates project configuration from config/project.json
 */

class ConfigLoader {
    constructor() {
        this.config = null;
        this.loadPromise = null;
    }

    /**
     * Load configuration from JSON file
     * @returns {Promise<Object>} Configuration object
     */
    async load() {
        if (this.config) {
            return this.config;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = this._loadConfig();
        return this.loadPromise;
    }

    async _loadConfig() {
        try {
            // Determine the correct path based on current location
            // If we're in /tool/, go up one level to get to root
            const isToolPage = window.location.pathname.includes('/tool/');
            const configPath = isToolPage ? '../config/project.json' : 'config/project.json';
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
            }
            const config = await response.json();

            // Validate required fields
            this._validateConfig(config);

            // Set defaults for optional fields
            if (!config.footerLinkText) {
                config.footerLinkText = 'Internet Archive';
            }

            this.config = config;
            window.PROJECT_CONFIG = config;
            return config;
        } catch (error) {
            console.error('[ConfigLoader] Error loading configuration:', error);
            // Return default config as fallback
            return this._getDefaultConfig();
        }
    }

    /**
     * Validate configuration structure
     * @param {Object} config - Configuration object to validate
     */
    _validateConfig(config) {
        const required = [
            'projectName',
            'projectTitle',
            'projectSubtitle',
            'projectDescription',
            'collectionId',
            'collectionUrl',
            'footerText',
            'documentTypes'
        ];

        const missing = required.filter(field => !config[field]);
        if (missing.length > 0) {
            throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
        }

        if (!Array.isArray(config.documentTypes) || config.documentTypes.length === 0) {
            throw new Error('documentTypes must be a non-empty array');
        }

        // Validate document type structure
        config.documentTypes.forEach((type, index) => {
            if (!type.id || !type.label || !type.description) {
                throw new Error(`Document type at index ${index} is missing required fields (id, label, description)`);
            }
        });
    }

    /**
     * Get default configuration (fallback)
     * @returns {Object} Default configuration
     */
    _getDefaultConfig() {
        const defaultConfig = {
            projectName: 'Archive',
            projectTitle: 'Archive',
            projectSubtitle: 'Digital Archive',
            projectDescription: 'Explore the archive',
            collectionId: '',
            collectionUrl: 'https://archive.org',
            footerText: 'Digital Archive. Hosted on the',
            footerLink: 'https://archive.org',
            footerLinkText: 'Internet Archive',
            documentTypes: [
                {
                    id: 'photographic',
                    label: 'Photographic Documentation',
                    description: 'Photographic documentation of physical objects, scenes, or events.',
                    icon: 'camera'
                },
                {
                    id: 'conversational',
                    label: 'Conversational Documentation',
                    description: 'Documentation of conversations, interviews, or meetings.',
                    icon: 'message-circle'
                },
                {
                    id: 'endangered',
                    label: 'Endangered Documents',
                    description: 'Materials that are at risk of being lost, destroyed, or degraded.',
                    icon: 'alert-triangle'
                },
                {
                    id: 'academic',
                    label: 'Academic Documents',
                    description: 'Research reports, academic papers, and scholarly materials.',
                    icon: 'book'
                },
                {
                    id: 'policy',
                    label: 'Policy Documents',
                    description: 'Official policies, regulations, and legal documents.',
                    icon: 'clipboard'
                },
                {
                    id: 'financial',
                    label: 'Financial Documents',
                    description: 'Financial records, budgets, and accounting documents.',
                    icon: 'dollar-sign'
                },
                {
                    id: 'ephemeral',
                    label: 'Ephemeral Web Documents',
                    description: 'Web-based materials that are transient or have a limited lifespan.',
                    icon: 'globe'
                },
                {
                    id: 'institutional',
                    label: 'Institutional Documents',
                    description: 'Documents produced by government bodies, corporations, or other formal institutions.',
                    icon: 'home'
                }
            ]
        };

        this.config = defaultConfig;
        window.PROJECT_CONFIG = defaultConfig;
        return defaultConfig;
    }

    /**
     * Get configuration (synchronous, returns cached config or null)
     * @returns {Object|null} Configuration object or null if not loaded
     */
    getConfig() {
        return this.config;
    }

    /**
     * Check if config is loaded
     * @returns {boolean}
     */
    isLoaded() {
        return this.config !== null;
    }
}

// Initialize and expose globally
const configLoader = new ConfigLoader();
window.configLoader = configLoader;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigLoader, configLoader };
} else {
    window.ConfigLoader = ConfigLoader;
}

