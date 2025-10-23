/**
 * Modal Management
 * Handles all modal functionality for the application
 */

class ModalManager {
    constructor(stateManager, eventManager) {
        this.state = stateManager;
        this.events = eventManager;
        this.modalStack = []; // Track modal stack for proper ESC key handling
        this.setupGlobalEscapeHandler();
    }

    /**
     * Setup global ESC key handler for modal stack management
     */
    setupGlobalEscapeHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalStack.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                this.closeTopModal();
            }
        });
    }

    /**
     * Add modal to stack
     * @param {string} modalId - Modal identifier
     * @param {Function} closeFunction - Function to call when closing this modal
     */
    pushModal(modalId, closeFunction) {
        // Remove existing modal with same ID if present
        this.modalStack = this.modalStack.filter(modal => modal.id !== modalId);

        // Add new modal to top of stack
        this.modalStack.push({
            id: modalId,
            closeFunction: closeFunction
        });
    }

    /**
     * Remove modal from stack
     * @param {string} modalId - Modal identifier
     */
    popModal(modalId) {
        this.modalStack = this.modalStack.filter(modal => modal.id !== modalId);
    }

    /**
     * Close the topmost modal
     */
    closeTopModal() {
        if (this.modalStack.length > 0) {
            const topModal = this.modalStack[this.modalStack.length - 1];
            if (topModal && topModal.closeFunction) {
                topModal.closeFunction();
            }
        }
    }

    /**
     * Get current modal stack (for debugging)
     */
    getModalStack() {
        return this.modalStack.map(modal => modal.id);
    }

    /**
     * Show flow creation modal
     */
    showFlowCreationModal() {
        const modal = document.getElementById('flow-creation-modal');
        const header = modal.querySelector('.modal-header h2');
        const createButton = modal.querySelector('.modal-footer .btn-primary');

        if (modal) {
            header.textContent = 'Create New Flow';
            createButton.textContent = 'Create Flow';
            createButton.onclick = () => this.delegateToApp('createNewFlow');

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.delegateToApp('clearFlowCreationForm');
            this.delegateToApp('populateMaterialsAssignment');
            this.delegateToApp('setupFlowCreationEventListeners');

            // Add click outside to close
            const handleClickOutside = (e) => {
                if (e.target === modal) {
                    this.hideFlowCreationModal();
                    modal.removeEventListener('click', handleClickOutside);
                }
            };
            modal.addEventListener('click', handleClickOutside);

            // Add escape key to close
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.hideFlowCreationModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }

    /**
     * Hide flow creation modal
     */
    hideFlowCreationModal() {
        const modal = document.getElementById('flow-creation-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        // Clean up any remaining drag artifacts
        this.delegateToApp('cleanupDragArtifacts');
    }

    /**
     * Show flow details modal
     * @param {string} flowId - ID of the flow to show details for
     */
    showFlowDetails(flowId) {
        // Debug logging removed

        // Get flows from the app instance instead of state manager
        const app = this.getAppInstance();
        if (!app) {
            console.error('ModalManager: App instance not available');
            return;
        }

        const createdFlows = app.createdFlows || [];
        // Debug logging removed
        const flow = createdFlows.find(f => f.id === flowId);
        // Debug logging removed
        if (!flow) {
            console.warn('ModalManager: Flow not found for ID:', flowId);
            return;
        }

        const modal = document.getElementById('flow-details-modal');
        const title = document.getElementById('flow-details-title');
        const content = document.getElementById('flow-details-content');

        if (modal && title && content) {
            // Set the modal title to include all flow information
            title.innerHTML = `
                <div class="flow-modal-title">
                    <div class="flow-title-main">
                        <span class="flow-name"><strong>Title:</strong> ${flow.name}</span>
                    </div>
                    <div class="flow-title-meta">
                        <span class="flow-description-short"><strong>Description:</strong> ${flow.description}</span>
                    </div>
                    <div class="flow-date-meta">
                        <span class="flow-date">Created: ${window.renderManager.formatDate(flow.created)}</span>
                    </div>
                </div>
            `;
            // Debug logging removed
            const flowDetailsHTML = window.renderManager.renderFlowDetails(flow);
            // Debug logging removed
            content.innerHTML = flowDetailsHTML || '<p>Error loading flow details</p>';

            // Replace Feather icons in the flow details
            if (typeof feather !== 'undefined') {
                // Use a small delay to ensure DOM is ready
                setTimeout(() => {
                    feather.replace();
                }, 10);
            }

            // Add Edit Flow button to existing modal footer
            const modalFooter = modal.querySelector('.modal-footer');
            if (modalFooter) {
                // Remove existing Edit Flow button if any
                const existingEditBtn = modalFooter.querySelector('.btn-primary');
                if (existingEditBtn) {
                    existingEditBtn.remove();
                }

                // Add Edit Flow button
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-primary';
                editBtn.textContent = 'Edit Flow';
                editBtn.onclick = () => this.delegateToApp('editFlow', flow.id);
                modalFooter.appendChild(editBtn);
            }

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Add click outside to close
            const handleClickOutside = (e) => {
                if (e.target === modal) {
                    this.hideFlowDetailsModal();
                    modal.removeEventListener('click', handleClickOutside);
                }
            };
            modal.addEventListener('click', handleClickOutside);

            // Add modal to stack for proper ESC key handling
            this.pushModal('flow-details-modal', () => {
                this.hideFlowDetailsModal();
            });
        }
    }

    /**
     * Hide flow details modal
     */
    hideFlowDetailsModal() {
        const modal = document.getElementById('flow-details-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';

            // Remove modal from stack
            this.popModal('flow-details-modal');

            // Clear material preview state
            this.delegateToApp('closeFlowMaterialPreview');
        }
    }

    /**
     * Show flow edit modal
     */
    showFlowEditModal() {
        const modal = document.getElementById('flow-creation-modal');
        const header = modal.querySelector('.modal-header h2');
        const createButton = modal.querySelector('.modal-footer .btn-primary');

        if (modal) {
            header.textContent = 'Edit Flow';
            createButton.textContent = 'Save Changes';
            createButton.onclick = () => this.delegateToApp('saveFlowChanges');

            modal.style.display = 'flex';

            // Populate materials first, then setup event listeners after a short delay
            // to ensure DOM is fully updated
            this.delegateToApp('populateMaterialsAssignment');

            setTimeout(() => {
                this.delegateToApp('setupFlowCreationEventListeners');
            }, 100);
        }
    }

    /**
     * Show notification message
     * @param {string} message - Message to display
     * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
     */
    showNotification(message, type = 'info') {
        // Use the proper Utils.Notification system
        if (window.Utils && window.Utils.Notification) {
            window.Utils.Notification.show(message, type, {
                duration: 3000,
                autoClose: true
            });
        } else {
            // Fallback to console if Utils not available
        }
    }

    /**
     * Get the app instance
     * @returns {Object|null} The app instance or null if not available
     */
    getAppInstance() {
        // Try to get demoApp from window first
        let app = window.demoApp;

        // If not available, try to get it from the global scope
        if (!app && typeof demoApp !== 'undefined') {
            app = demoApp;
        }

        return app;
    }

    /**
     * Delegate method calls to the main app
     * @param {string} methodName - Name of the method to call
     * @param {...any} args - Arguments to pass to the method
     * @returns {any} Result of the delegated method call
     */
    delegateToApp(methodName, ...args) {
        const app = this.getAppInstance();

        if (app && typeof app[methodName] === 'function') {
            return app[methodName](...args);
        } else {
            // Try to find the method in UI manager as fallback
            if (app && app.ui && typeof app.ui[methodName] === 'function') {
                return app.ui[methodName](...args);
            }

            console.warn(`ModalManager: Method '${methodName}' not found on demoApp or UI manager. Available methods:`,
                app ? Object.getOwnPropertyNames(Object.getPrototypeOf(app)) : 'demoApp not available');
            return null;
        }
    }

    /**
     * Close all open modals
     */
    closeAllModals() {
        this.hideFlowCreationModal();
        this.hideFlowDetailsModal();

        // Close any other modals that might be open
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });

        // Restore body overflow
        document.body.style.overflow = 'auto';
    }

    /**
     * Check if any modal is currently open
     * @returns {boolean} True if any modal is open
     */
    isAnyModalOpen() {
        const modals = document.querySelectorAll('.modal');
        return Array.from(modals).some(modal =>
            modal.style.display === 'flex' || modal.style.display === 'block'
        );
    }

    /**
     * Get the currently open modal
     * @returns {HTMLElement|null} The open modal element or null
     */
    getOpenModal() {
        const modals = document.querySelectorAll('.modal');
        return Array.from(modals).find(modal =>
            modal.style.display === 'flex' || modal.style.display === 'block'
        ) || null;
    }
}

// Initialize and expose globally
window.modalManager = new ModalManager(stateManager, eventManager);

// Set up global reference to demoApp when it's available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for demoApp to be initialized
    const checkForDemoApp = () => {
        if (window.demoApp) {
            // demoApp is available, no additional setup needed
        } else {
            // Check again in 100ms
            setTimeout(checkForDemoApp, 100);
        }
    };
    checkForDemoApp();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalManager };
} else {
    window.ModalManager = ModalManager;
}
