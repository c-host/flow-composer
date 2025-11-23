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
            if (createButton) {
                createButton.textContent = 'Create Flow';
                // Remove inline onclick attribute if present
                createButton.removeAttribute('onclick');
                // Remove any existing event listeners by cloning and replacing
                const newButton = createButton.cloneNode(true);
                createButton.parentNode.replaceChild(newButton, createButton);
                // Add new event listener
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.delegateToApp('createNewFlow');
                });
            }

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
        const app = this.getAppInstance();

        // If we're in edit mode, cancel the edit to restore original state
        if (app && app.editingFlow) {
            if (app && typeof app.cancelFlowEdit === 'function') {
                app.cancelFlowEdit();
            }
        }

        // Clean up Quill editors before closing
        if (app && app.materials && typeof app.materials.cleanupQuillEditors === 'function') {
            app.materials.cleanupQuillEditors();
        }

        // Clear form fields to prevent stale data
        this.delegateToApp('clearFlowCreationForm');

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

        // Get flows from the app instance instead of state manager
        const app = this.getAppInstance();
        if (!app) {
            console.error('ModalManager: App instance not available');
            return;
        }

        const createdFlows = app.createdFlows || [];
        const flow = createdFlows.find(f => f.id === flowId);
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
            // Render immediately to avoid delay
            const flowDetailsHTML = window.renderManager.renderFlowDetails(flow);
            content.innerHTML = flowDetailsHTML || '<p>Error loading flow details</p>';

            // Replace Feather icons in the flow details
            if (typeof feather !== 'undefined') {
                // Use a small delay to ensure DOM is ready
                setTimeout(() => {
                    feather.replace();
                }, 10);
            }

            // Automatically load inline media previews for all materials
            setTimeout(() => {
                this.loadAllInlineMediaPreviews(flow);
            }, 100);

            // Setup document type filter functionality
            setTimeout(() => {
                this.setupDocumentTypeFilters(flow);
            }, 150);

            // Enhance descriptions asynchronously in the background (non-blocking)
            setTimeout(() => {
                window.renderManager.enhanceFlowDetailsDescriptions(flow).catch(error => {
                    console.warn('[ModalManager] Error enhancing flow descriptions:', error);
                });
            }, 200);

            // Note: Feather icons, media previews, and filters are now set up in the renderFlowDetails promise callback above

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
            if (createButton) {
                createButton.textContent = 'Save Changes';
                // Remove any existing onclick handlers and set new one
                createButton.onclick = null;
                createButton.removeAttribute('onclick');
                // Remove any existing event listeners by cloning and replacing
                const newButton = createButton.cloneNode(true);
                createButton.parentNode.replaceChild(newButton, createButton);
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.delegateToApp('saveFlowChanges');
                });
            }

            modal.style.display = 'flex';

            // Populate materials first, then setup event listeners after a short delay
            // to ensure DOM is fully updated
            // Use a longer delay to ensure editingFlow is set and materials are ready
            this.delegateToApp('populateMaterialsAssignment');

            setTimeout(() => {
                this.delegateToApp('setupFlowCreationEventListeners');
            }, 200);
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

    /**
     * Load inline media previews for all materials in flow using lazy loading
     * @param {Object} flow - Flow object
     */
    async loadAllInlineMediaPreviews(flow) {
        if (!flow || !flow.materials) return;

        // Track concurrent loads to limit them
        let concurrentLoads = 0;
        const maxConcurrentLoads = 3;
        const pendingLoads = [];

        // Function to load a single material
        const loadMaterial = (material) => {
            return new Promise((resolve) => {
                try {
                    // Try demoApp first (tool), then publicApp (public frontend), then previewManager directly
                    let previewManager = null;
                    if (window.demoApp && window.demoApp.preview) {
                        previewManager = window.demoApp.preview;
                    } else if (window.publicApp && window.previewManager) {
                        previewManager = window.previewManager;
                    } else if (window.previewManager) {
                        previewManager = window.previewManager;
                    }

                    if (previewManager && typeof previewManager.loadMediaPreviewForFlow === 'function') {
                        // Check if embed is already loaded before attempting to load
                        const mediaContainer = document.getElementById(`flow-media-embed-${material.identifier}`);
                        const hasLoadedEmbed = mediaContainer && mediaContainer.querySelector('iframe');

                        if (!hasLoadedEmbed) {
                            concurrentLoads++;
                            previewManager.loadMediaPreviewForFlow(material.identifier, material)
                                .then(() => {
                                    concurrentLoads--;
                                    // Process next pending load
                                    if (pendingLoads.length > 0) {
                                        const next = pendingLoads.shift();
                                        loadMaterial(next);
                                    }
                                    resolve();
                                })
                                .catch((error) => {
                                    concurrentLoads--;
                                    console.warn('Error loading media preview for material:', material.identifier, error);
                                    // Process next pending load
                                    if (pendingLoads.length > 0) {
                                        const next = pendingLoads.shift();
                                        loadMaterial(next);
                                    }
                                    resolve();
                                });
                        } else {
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                } catch (error) {
                    console.warn('Error loading media preview for material:', material.identifier, error);
                    resolve();
                }
            });
        };

        // Filter materials that should have previews
        const materialsToLoad = flow.materials.filter(material =>
            material && material.identifier && material.type !== 'data' && material.type !== 'software'
        );

        // Use Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            const observerOptions = {
                root: null, // viewport
                rootMargin: '100px', // Start loading 100px before element is visible
                threshold: 0.01 // Trigger when 1% of element is visible
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const container = entry.target;
                        const identifier = container.getAttribute('data-material-identifier');
                        const material = materialsToLoad.find(m => m.identifier === identifier);

                        if (material) {
                            // Stop observing this element
                            observer.unobserve(container);

                            // Load the material (respecting concurrent load limit)
                            if (concurrentLoads < maxConcurrentLoads) {
                                loadMaterial(material);
                            } else {
                                pendingLoads.push(material);
                            }
                        }
                    }
                });
            }, observerOptions);

            // Observe all media containers
            materialsToLoad.forEach(material => {
                const mediaContainer = document.getElementById(`flow-media-embed-${material.identifier}`);
                if (mediaContainer) {
                    // Add data attribute for identification
                    mediaContainer.setAttribute('data-material-identifier', material.identifier);
                    observer.observe(mediaContainer);
                }
            });

            // Fallback: Load first few materials immediately (visible ones)
            const initialLoadCount = Math.min(maxConcurrentLoads, materialsToLoad.length);
            for (let i = 0; i < initialLoadCount; i++) {
                const material = materialsToLoad[i];
                const mediaContainer = document.getElementById(`flow-media-embed-${material.identifier}`);
                if (mediaContainer) {
                    // Check if element is likely visible (rough check)
                    const rect = mediaContainer.getBoundingClientRect();
                    const isVisible = rect.top < window.innerHeight + 100;
                    if (isVisible) {
                        loadMaterial(material);
                    }
                }
            }
        } else {
            // Fallback for browsers without Intersection Observer
            // Load materials with delay, but limit concurrent loads
            for (let i = 0; i < materialsToLoad.length; i++) {
                const material = materialsToLoad[i];
                setTimeout(() => {
                    if (concurrentLoads < maxConcurrentLoads) {
                        loadMaterial(material);
                    } else {
                        pendingLoads.push(material);
                    }
                }, i * 300); // 300ms delay between each material
            }
        }
    }

    /**
     * Setup document type filter functionality (using coverage badges)
     * @param {Object} flow - Flow object
     */
    setupDocumentTypeFilters(flow) {
        const filterBadges = document.querySelectorAll('.coverage-badge.filter-badge');
        if (!filterBadges.length) return;

        filterBadges.forEach(badge => {
            // Only make clickable if it has items (not disabled)
            const hasItems = badge.classList.contains('has-items') && !badge.classList.contains('disabled');
            const filterType = badge.getAttribute('data-filter-type');

            if (hasItems) {
                // Add click handler
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.applyDocumentTypeFilter(flow, filterType, filterBadges);
                });

                // Add keyboard support
                badge.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.applyDocumentTypeFilter(flow, filterType, filterBadges);
                    }
                });
            }
        });
    }

    /**
     * Apply document type filter
     * @param {Object} flow - Flow object
     * @param {string} filterType - Document type to filter by, or 'all' for all materials
     * @param {NodeList} filterBadges - All filter badge elements
     */
    applyDocumentTypeFilter(flow, filterType, filterBadges) {
        // Update active state
        filterBadges.forEach(badge => badge.classList.remove('active'));
        const activeBadge = Array.from(filterBadges).find(badge => badge.getAttribute('data-filter-type') === filterType);
        if (activeBadge) {
            activeBadge.classList.add('active');
        }

        // Filter materials
        const materialItems = document.querySelectorAll('.material-narrative-item');
        materialItems.forEach(item => {
            if (filterType === 'all') {
                // Show all materials
                item.style.display = '';
            } else {
                // Show only materials matching the selected document type
                const materialId = item.getAttribute('data-material-id');
                const material = flow.materials.find(m => m.identifier === materialId);
                if (material && material.documentType === filterType) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    }
}

// Initialize and expose globally
window.modalManager = new ModalManager(window.stateManager || null, window.eventManager || null);

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
