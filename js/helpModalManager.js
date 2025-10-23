/**
 * Help Modal Manager
 * Manages help modal display and interaction
 */
class HelpModalManager {
    constructor() {
        this.isInitialized = false;
        this.escapeKeyHandler = null;
        this.clickHandler = null;
    }

    /**
     * Initialize the help modal manager
     */
    init() {
        if (this.isInitialized) return;

        this.setupEventListeners();
        this.isInitialized = true;
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Add F1 key listener for help modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.showHelpModal();
            }
        });
    }

    /**
     * Get modal manager instance
     */
    getModalManager() {
        // Try to get modal manager from global app instance
        if (window.demoApp && window.demoApp.modals) {
            return window.demoApp.modals;
        }
        return null;
    }

    /**
     * Show the help modal
     */
    showHelpModal() {
        const helpModal = document.getElementById('help-modal');
        if (!helpModal) {
            console.warn('HelpModalManager: Help modal element not found');
            return;
        }

        // Show modal
        helpModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Setup click outside to close
        this.clickHandler = (e) => {
            if (e.target === helpModal) {
                this.hideHelpModal();
            }
        };
        helpModal.addEventListener('click', this.clickHandler);

        // Add modal to stack for proper ESC key handling
        const modalManager = this.getModalManager();
        if (modalManager) {
            modalManager.pushModal('help-modal', () => {
                this.hideHelpModal();
            });
        } else {
            // Fallback to direct ESC handling if modal manager not available
            this.escapeKeyHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hideHelpModal();
                }
            };
            document.addEventListener('keydown', this.escapeKeyHandler);
        }

    }

    /**
     * Hide the help modal
     */
    hideHelpModal() {
        const helpModal = document.getElementById('help-modal');
        if (!helpModal) {
            console.warn('HelpModalManager: Help modal element not found');
            return;
        }

        // Hide modal
        helpModal.style.display = 'none';
        document.body.style.overflow = 'auto';

        // Remove modal from stack
        const modalManager = this.getModalManager();
        if (modalManager) {
            modalManager.popModal('help-modal');
        }

        // Clean up event listeners
        if (this.clickHandler) {
            helpModal.removeEventListener('click', this.clickHandler);
            this.clickHandler = null;
        }

        if (this.escapeKeyHandler) {
            document.removeEventListener('keydown', this.escapeKeyHandler);
            this.escapeKeyHandler = null;
        }

    }

    /**
     * Toggle help modal visibility
     */
    toggleHelpModal() {
        const helpModal = document.getElementById('help-modal');
        if (!helpModal) return;

        const isVisible = helpModal.style.display === 'flex';
        if (isVisible) {
            this.hideHelpModal();
        } else {
            this.showHelpModal();
        }
    }

    /**
     * Check if help modal is currently visible
     * @returns {boolean} True if modal is visible
     */
    isHelpModalVisible() {
        const helpModal = document.getElementById('help-modal');
        if (!helpModal) return false;
        return helpModal.style.display === 'flex';
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.hideHelpModal();
        this.isInitialized = false;
    }
}

// Initialize and expose globally
window.helpModalManager = new HelpModalManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.helpModalManager.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HelpModalManager };
} else {
    window.HelpModalManager = HelpModalManager;
}
