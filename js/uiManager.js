/**
 * UI Manager
 * Handles UI setup, event listeners, and display management
 */
class UIManager {
    constructor(demoApp) {
        this.app = demoApp;
        this.updateCoverageTimeout = null;
        this.notesUpdateTimeout = null;
    }

    /**
     * Initialize UI setup and event listeners
     */
    init() {
        this.setupEventListeners();
        this.setupSearchScopeToggle();
        this.setupImportExportListeners();
        this.setupFlowCreationEventListeners();
        this.setupThemeToggle();
        this.setupOSThemeSync();
    }

    /**
     * Set up event listeners for user interactions
     */
    setupEventListeners() {
        const searchInput = Utils.DOM.getElement(CONFIG.SELECTORS.SEARCH_QUERY);
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.app.performSearch();
                }
            });
        }

        // Page unload cleanup
        window.addEventListener('beforeunload', () => {
            this.globalCleanup();
        });

        // Error recovery cleanup
        window.addEventListener('error', () => {
            this.globalCleanup();
        });
    }

    /**
     * Setup theme toggle behavior
     */
    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        const updateThemeIcon = (theme) => {
            const icon = btn.querySelector('.theme-icon');
            if (icon) {
                icon.setAttribute('data-feather', theme === 'dark' ? 'moon' : 'sun');
                // Re-initialize feather icons for the updated icon
                if (window.feather) {
                    window.feather.replace();
                }
            }
        };

        const setTheme = (next) => {
            document.documentElement.setAttribute('data-theme', next);
            updateThemeIcon(next);
            try { localStorage.setItem('theme', next); } catch (e) { }
        };

        // Initialize icon based on current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateThemeIcon(currentTheme);

        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            setTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    /**
     * Sync theme with OS preference if no explicit user preference
     */
    setupOSThemeSync() {
        try {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const apply = (e) => {
                if (!localStorage.getItem('theme')) {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    // Update icon when OS theme changes
                    const btn = document.getElementById('theme-toggle');
                    if (btn) {
                        const icon = btn.querySelector('.theme-icon');
                        if (icon) {
                            icon.setAttribute('data-feather', newTheme === 'dark' ? 'moon' : 'sun');
                            if (window.feather) {
                                window.feather.replace();
                            }
                        }
                    }
                }
            };
            if (mq.addEventListener) mq.addEventListener('change', apply);
            else if (mq.addListener) mq.addListener(apply);
        } catch (e) { }
    }

    /**
     * Set up search scope toggle functionality
     */
    setupSearchScopeToggle() {
        const searchScopeInputs = Utils.DOM.getElements('input[name="search-scope"]');
        const filterManagement = document.getElementById('filter-management');

        searchScopeInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.app.updateSearchNote();
                this.toggleFilterManagement();
            });
        });

        this.app.updateSearchNote();
        this.toggleFilterManagement();
    }

    /**
     * Toggle filter management visibility based on search scope
     */
    toggleFilterManagement() {
        const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'filters';
        const filterManagement = document.getElementById('filter-management');

        if (filterManagement) {
            if (searchScope === 'all') {
                filterManagement.style.display = 'none';
            } else {
                filterManagement.style.display = 'block';
            }
        }
    }

    /**
     * Set up import/export event listeners
     */
    setupImportExportListeners() {
        // Listen for flows imported event to update UI
        if (window.eventManager) {
            window.eventManager.on('flows:imported', (data) => {
                this.app.updateCreatedFlows();
                this.app.saveFlowsToStorage();
            });
        }
    }

    /**
     * Set up flow creation event listeners
     */
    setupFlowCreationEventListeners() {

        // Setup drag and drop - use reinitializeDragDrop with force to ensure it works in Edit Flow modal
        if (this.app.dragDrop && this.app.dragDrop.reinitializeDragDrop) {
            this.app.dragDrop.reinitializeDragDrop(true);
        } else {
            this.app.setupMaterialDragAndDrop();
        }

        // Setup document type change listeners with debouncing
        const debouncedUpdateCoverage = () => {
            clearTimeout(this.updateCoverageTimeout);
            this.updateCoverageTimeout = setTimeout(() => {
                this.app.updateDocumentTypeCoverage();
            }, 300);
        };

        document.addEventListener('change', (event) => {
            if (event.target.classList.contains('material-doc-type')) {
                const identifier = event.target.closest('[data-identifier]')?.dataset.identifier;
                // Debug logging removed
                debouncedUpdateCoverage();
            }
        });

        // Setup notes change listeners with throttling
        const throttledNotesUpdate = (identifier) => {
            if (!this.notesUpdateTimeout) {
                // Debug logging removed
                this.notesUpdateTimeout = setTimeout(() => {
                    this.notesUpdateTimeout = null;
                }, 1000);
            }
        };

        document.addEventListener('input', (event) => {
            if (event.target.classList.contains('material-notes')) {
                const identifier = event.target.closest('[data-identifier]')?.dataset.identifier;
                throttledNotesUpdate(identifier);
            }
        });

        // Setup save button listener
        const saveButton = document.getElementById('save-flow-button');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.app.createNewFlow();
            });
        }
    }

    /**
     * Update display components
     */
    updateDisplay() {
        this.app.updateSelectedMaterialsDisplay();
        this.app.updateCreatedFlows();
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, error, warning)
     */
    showNotification(message, type = 'info') {
        return this.app.modals.showNotification(message, type);
    }

    /**
     * Clear flow creation form
     */
    clearFlowCreationForm() {
        document.getElementById('new-flow-name').value = '';
        document.getElementById('new-flow-description').value = '';

        // Clear any existing material form fields to prevent persistence
        const materialItems = document.querySelectorAll('.material-assignment-item');
        materialItems.forEach(item => {
            const docTypeSelect = item.querySelector('.material-doc-type');
            const notesTextarea = item.querySelector('.material-notes');

            if (docTypeSelect) {
                docTypeSelect.value = 'policy';
            }
            if (notesTextarea) {
                notesTextarea.value = '';
            }
        });
    }

    /**
     * Global cleanup operations
     */
    globalCleanup() {
        this.app.cleanupDragArtifacts();

        // Close any open modals
        const modals = document.querySelectorAll('.modal[style*="display: flex"]');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });

        // Reset body overflow
        document.body.style.overflow = 'auto';

        // Debug logging removed
    }

    /**
     * Clean up timeouts and intervals
     */
    cleanup() {
        if (this.updateCoverageTimeout) {
            clearTimeout(this.updateCoverageTimeout);
            this.updateCoverageTimeout = null;
        }
        if (this.notesUpdateTimeout) {
            clearTimeout(this.notesUpdateTimeout);
            this.notesUpdateTimeout = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
}
