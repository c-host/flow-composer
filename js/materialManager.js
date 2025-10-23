/**
 * Material Management
 * Handles all material selection, display, and flow integration functionality
 */

class MaterialManager {
    constructor(stateManager, eventManager) {
        this.state = stateManager;
        this.events = eventManager;

        // Material state management
        this.selectedMaterials = [];
        this.materialState = {
            selectedCount: 0,
            documentTypeCoverage: {},
            lastUpdated: null
        };
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
            console.warn(`MaterialManager: Method '${methodName}' not found on demoApp. Available methods:`,
                app ? Object.getOwnPropertyNames(Object.getPrototypeOf(app)) : 'demoApp not available');
            return null;
        }
    }

    /**
     * Show notification using the app's notification system
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, error, warning)
     */
    showNotification(message, type = 'info') {
        if (window.Utils && window.Utils.Notification) {
            window.Utils.Notification.show(message, type, {
                duration: 3000,
                autoClose: true
            });
        } else {
        }
    }

    /**
     * Get DOM element using Utils.DOM.getElement
     * @param {string} selector - CSS selector
     * @returns {Element|null} DOM element or null if not found
     */
    getElement(selector) {
        if (window.Utils && window.Utils.DOM && window.Utils.DOM.getElement) {
            return window.Utils.DOM.getElement(selector);
        } else {
            return document.querySelector(selector);
        }
    }

    /**
     * Get all DOM elements using Utils.DOM.getAllElements or querySelectorAll
     * @param {string} selector - CSS selector
     * @returns {NodeList} DOM elements
     */
    getAllElements(selector) {
        if (window.Utils && window.Utils.DOM && window.Utils.DOM.getAllElements) {
            return window.Utils.DOM.getAllElements(selector);
        } else {
            return document.querySelectorAll(selector);
        }
    }

    /**
     * Check if Internet Archive API is available
     * @returns {boolean} True if API is available
     */
    isAPIAvailable() {
        return !!(window.internetArchiveAPI &&
            typeof window.internetArchiveAPI.getMaterialByIdentifier === 'function');
    }

    /**
     * Get material by identifier from Internet Archive API
     * @param {string} identifier - Material identifier
     * @returns {Object|null} Material object or null if not found
     */
    getMaterialByIdentifier(identifier) {
        if (!this.isAPIAvailable()) {
            console.warn('Internet Archive API not available');
            return null;
        }
        return window.internetArchiveAPI.getMaterialByIdentifier(identifier);
    }

    /**
     * Update material state
     * @param {Object} newState - New state properties to update
     */
    updateMaterialState(newState) {
        // Prevent duplicate updates by checking if state actually changed
        const currentState = { ...this.materialState };
        const updatedState = {
            ...this.materialState,
            ...newState,
            lastUpdated: new Date().toISOString()
        };

        // Check if state actually changed
        const hasChanged = JSON.stringify(currentState) !== JSON.stringify(updatedState);
        if (!hasChanged) {
            return; // Skip update if no changes
        }

        this.materialState = updatedState;
    }

    /**
     * Clear material state
     */
    clearMaterialState() {
        this.selectedMaterials = [];
        this.materialState = {
            selectedCount: 0,
            documentTypeCoverage: {},
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Log material operation for debugging
     * @param {string} operation - Operation being performed
     * @param {Object} details - Additional details
     */
    logMaterialOperation(operation, details = {}) {
        // Debug logging removed for production
    }

    /**
     * Get selected materials count
     * @returns {number} Number of selected materials
     */
    getSelectedMaterialsCount() {
        return this.selectedMaterials.length;
    }

    /**
     * Check if material is selected
     * @param {string} identifier - Material identifier
     * @returns {boolean} True if material is selected
     */
    isMaterialSelected(identifier) {
        return this.selectedMaterials.some(material => material.identifier === identifier);
    }

    /**
     * Find material by identifier
     * @param {string} identifier - Material identifier
     * @returns {Object|null} Material object or null if not found
     */
    findMaterialByIdentifier(identifier) {
        return this.selectedMaterials.find(material => material.identifier === identifier) || null;
    }

    /**
     * Get document types from selected materials
     * @returns {Array} Array of unique document types
     */
    getDocumentTypes() {
        const documentTypes = [
            'photographic', 'conversational', 'endangered', 'academic',
            'policy', 'financial', 'ephemeral', 'institutional'
        ];
        return documentTypes;
    }

    /**
     * Calculate document type coverage
     * @returns {Object} Coverage statistics for each document type
     */
    calculateDocumentTypeCoverage() {
        const documentTypes = this.getDocumentTypes();
        const coverage = {};

        documentTypes.forEach(type => {
            coverage[type] = this.selectedMaterials.filter(material =>
                material.documentType === type
            ).length;
        });

        return coverage;
    }

    /**
     * Validate material object
     * @param {Object} material - Material object to validate
     * @returns {boolean} True if material is valid
     */
    validateMaterial(material) {
        return !!(material &&
            material.identifier &&
            material.title &&
            typeof material.identifier === 'string' &&
            typeof material.title === 'string');
    }

    /**
     * Create material summary for logging
     * @param {Object} material - Material object
     * @returns {Object} Material summary
     */
    createMaterialSummary(material) {
        return {
            identifier: material.identifier,
            title: material.title ? material.title.substring(0, 50) + '...' : 'No title',
            documentType: material.documentType || 'unknown',
            hasNotes: !!(material.notes && material.notes.trim())
        };
    }

    /**
     * Get all selected materials
     * @returns {Array} Array of selected materials
     */
    getSelectedMaterials() {
        return [...this.selectedMaterials];
    }

    /**
     * Set selected materials (for initialization)
     * @param {Array} materials - Array of materials to set
     */
    setSelectedMaterials(materials) {
        if (Array.isArray(materials)) {
            this.selectedMaterials = [...materials];
            this.updateMaterialState({
                selectedCount: this.selectedMaterials.length,
                documentTypeCoverage: this.calculateDocumentTypeCoverage()
            });
        }
    }

    // ============================================================================
    // MATERIAL DATA FUNCTIONS
    // ============================================================================

    /**
     * Get the original material identifier from a flow-specific identifier
     * @param {string} flowMaterialId - Flow-specific material identifier
     * @returns {string} Original material identifier
     */
    getOriginalMaterialId(flowMaterialId) {
        this.logMaterialOperation('getOriginalMaterialId', { flowMaterialId });

        if (flowMaterialId.includes('_flow_')) {
            return flowMaterialId.split('_flow_')[0];
        }
        return flowMaterialId;
    }

    /**
     * Get current material document type from form (for saving)
     * @param {string} identifier - Material identifier
     * @returns {string} Document type value
     */
    getCurrentMaterialDocumentType(identifier) {
        this.logMaterialOperation('getCurrentMaterialDocumentType', { identifier });

        const item = document.querySelector(`[data-identifier="${identifier}"] .material-doc-type`);
        const result = item ? item.value : 'policy';
        // Debug logging removed
        return result;
    }

    /**
     * Get current material notes from form (for saving)
     * @param {string} identifier - Material identifier
     * @returns {string} Notes value
     */
    getCurrentMaterialNotes(identifier) {
        this.logMaterialOperation('getCurrentMaterialNotes', { identifier });

        const item = document.querySelector(`[data-identifier="${identifier}"] .material-notes`);
        const result = item ? item.value : '';
        // Debug logging removed
        return result;
    }

    /**
     * Get material data from API or persisted flow data
     * @param {string} identifier - Material identifier
     * @returns {Object} Material data object
     */
    getMaterialData(identifier) {
        this.logMaterialOperation('getMaterialData', { identifier });

        // Debug logging removed

        // Check if this is a flow-specific identifier
        const originalIdentifier = this.getOriginalMaterialId(identifier);
        const isFlowSpecific = originalIdentifier !== identifier;

        // Try to get material from current API first (for newly created flows)
        let material = this.getMaterialByIdentifier(originalIdentifier);

        if (material) {
            // Debug logging removed

            // If this is a flow-specific identifier, merge with flow-specific data
            if (isFlowSpecific) {
                // Find the flow-specific data
                const app = this.getAppInstance();
                if (app && app.createdFlows) {
                    for (const flow of app.createdFlows) {
                        const flowMaterial = flow.materials.find(m => m.identifier === identifier);
                        if (flowMaterial) {
                            // Debug logging removed
                            return {
                                ...material,
                                identifier: identifier, // Keep flow-specific identifier
                                originalIdentifier: originalIdentifier,
                                documentType: flowMaterial.documentType,
                                notes: flowMaterial.notes,
                                order: flowMaterial.order
                            };
                        }
                    }
                }
            }

            return material;
        }

        // If not found in API, try to get from flow's persisted data
        // Debug logging removed
        const app = this.getAppInstance();
        if (app && app.createdFlows) {
            for (const flow of app.createdFlows) {
                const flowMaterial = flow.materials.find(m => m.identifier === identifier);
                if (flowMaterial) {
                    // Debug logging removed
                    // Return the complete material data if available
                    return flowMaterial.completeData || flowMaterial;
                }
            }
        }

        // For duplicate materials, try to find the original material
        if (identifier.includes('_duplicate_')) {
            const originalIdentifier = identifier.split('_duplicate_')[0];
            // Debug logging removed

            // Try to get original material from API
            const originalMaterial = this.getMaterialByIdentifier(originalIdentifier);
            if (originalMaterial) {
                // Debug logging removed
                return originalMaterial;
            }

            // Try to get original material from flow data
            if (app && app.createdFlows) {
                for (const flow of app.createdFlows) {
                    const flowMaterial = flow.materials.find(m => m.identifier === originalIdentifier);
                    if (flowMaterial) {
                        // Debug logging removed
                        return flowMaterial.completeData || flowMaterial;
                    }
                }
            }
        }

        console.error('❌ Debug: Material not found in API or flow data for identifier:', identifier);
        throw new Error(`Material not found in API or flow data for identifier: ${identifier}`);
    }

    // ============================================================================
    // MATERIAL SELECTION FUNCTIONS
    // ============================================================================

    /**
     * Toggle material selection (add/remove from selected materials)
     * @param {string} identifier - Material identifier
     */
    toggleMaterialSelection(identifier) {
        this.logMaterialOperation('toggleMaterialSelection', { identifier });

        const material = this.getMaterialByIdentifier(identifier);
        if (!material) {
            console.warn('MaterialManager: Material not found for selection:', identifier);
            return;
        }

        const index = this.selectedMaterials.findIndex(m => m.identifier === identifier);

        if (index > -1) {
            // Remove from selection
            this.selectedMaterials.splice(index, 1);
            this.logMaterialOperation('materialDeselected', { identifier, title: material.title });
        } else {
            // Add to selection
            this.selectedMaterials.push(material);
            this.logMaterialOperation('materialSelected', { identifier, title: material.title });
        }

        // Update state
        this.updateMaterialState({
            selectedCount: this.selectedMaterials.length,
            documentTypeCoverage: this.calculateDocumentTypeCoverage()
        });

        // Update all UI components for this material
        this.updateAllMaterialUI(identifier);
    }

    /**
     * Add material to selection
     * @param {string} identifier - Material identifier
     * @returns {boolean} Success status
     */
    addMaterial(identifier) {
        this.logMaterialOperation('addMaterial', { identifier });

        const material = this.getMaterialByIdentifier(identifier);
        if (!material) {
            console.warn('MaterialManager: Material not found for addition:', identifier);
            return false;
        }

        // Check if already selected
        const isAlreadySelected = this.selectedMaterials.some(m => m.identifier === identifier);
        if (isAlreadySelected) {
            return true;
        }

        // Add to selection
        this.selectedMaterials.push(material);
        this.logMaterialOperation('materialAdded', { identifier, title: material.title });

        // Update state
        this.updateMaterialState({
            selectedCount: this.selectedMaterials.length,
            documentTypeCoverage: this.calculateDocumentTypeCoverage()
        });

        return true;
    }

    /**
     * Remove material from selection
     * @param {string} identifier - Material identifier
     * @returns {boolean} Success status
     */
    removeMaterial(identifier) {
        this.logMaterialOperation('removeMaterial', { identifier });

        const beforeCount = this.selectedMaterials.length;
        this.selectedMaterials = this.selectedMaterials.filter(m => m.identifier !== identifier);
        const afterCount = this.selectedMaterials.length;

        if (beforeCount === afterCount) {
            return false;
        }

        this.logMaterialOperation('materialRemoved', { identifier, removedCount: beforeCount - afterCount });

        // Update state
        this.updateMaterialState({
            selectedCount: this.selectedMaterials.length,
            documentTypeCoverage: this.calculateDocumentTypeCoverage()
        });

        return true;
    }

    /**
     * Select material (add to selection)
     * @param {string} identifier - Material identifier
     * @returns {boolean} Success status
     */
    selectMaterial(identifier) {
        return this.addMaterial(identifier);
    }

    /**
     * Deselect material (remove from selection)
     * @param {string} identifier - Material identifier
     * @returns {boolean} Success status
     */
    deselectMaterial(identifier) {
        return this.removeMaterial(identifier);
    }

    /**
     * Check if material is selected
     * @param {string} identifier - Material identifier
     * @returns {boolean} True if material is selected
     */
    isMaterialSelected(identifier) {
        return this.selectedMaterials.some(m => m.identifier === identifier);
    }

    /**
     * Clear all selected materials
     */
    async clearSelectedMaterials() {
        this.logMaterialOperation('clearSelectedMaterials', {
            previousCount: this.selectedMaterials.length
        });

        // Debug logging removed

        this.selectedMaterials = [];

        // Debug logging removed

        // Update state
        this.updateMaterialState({
            selectedCount: 0,
            documentTypeCoverage: this.calculateDocumentTypeCoverage()
        });

        // Update UI
        // Debug logging removed
        this.updateSelectedMaterialsDisplay();

        // Update all material cards globally
        // Debug logging removed
        this.updateAllMaterialCards();

        // Update preview panel select button
        // Debug logging removed
        this.updatePreviewPanelSelectButton();

        this.logMaterialOperation('selectedMaterialsCleared', { clearedCount: 0 });
        // Debug logging removed
    }

    /**
     * Remove material from flow creation (alias for removeMaterial)
     * @param {string} identifier - Material identifier
     */
    removeMaterialFromFlow(identifier) {
        this.logMaterialOperation('removeMaterialFromFlow', { identifier });

        // Debug logging removed

        // Check for duplicate identifiers
        const duplicateCount = this.selectedMaterials.filter(m => m.identifier === identifier).length;
        // Debug logging removed

        const beforeCount = this.selectedMaterials.length;
        this.selectedMaterials = this.selectedMaterials.filter(m => m.identifier !== identifier);
        const afterCount = this.selectedMaterials.length;

        // Debug logging removed

        // Add visual feedback for removal
        const removedMaterial = this.selectedMaterials.find(m => m.identifier === identifier);
        if (removedMaterial) {
            this.showNotification(`Removed "${removedMaterial.title}" from flow`, 'info');
        }

        // Update state
        this.updateMaterialState({
            selectedCount: this.selectedMaterials.length,
            documentTypeCoverage: this.calculateDocumentTypeCoverage()
        });

        // Update the UI
        this.updateSelectedMaterialsDisplay();
        this.populateMaterialsAssignment();

        // Update document type coverage
        this.updateDocumentTypeCoverage();

        // Update all UI components for this material
        this.updateAllMaterialUI(identifier);
    }

    // ============================================================================
    // MATERIAL DISPLAY FUNCTIONS
    // ============================================================================

    /**
     * Update selected materials display
     */
    updateSelectedMaterialsDisplay() {
        this.logMaterialOperation('updateSelectedMaterialsDisplay', {
            selectedCount: this.selectedMaterials.length
        });

        // Debug logging removed

        const countElement = this.getElement('#selected-materials-count');
        const listElement = this.getElement('#selected-materials-list');
        const createButton = this.getElement('#create-flow-btn');

        if (countElement) {
            countElement.textContent = this.selectedMaterials.length;
        }

        if (listElement) {
            if (this.selectedMaterials.length === 0) {
                listElement.innerHTML = '<p class="empty-state">No materials selected yet.</p>';
            } else {
                const materialsHTML = this.selectedMaterials.map(material => `
                    <div class="selected-material-card">
                        <div class="material-preview">
                            ${material.thumbnail ?
                        `<img src="${material.thumbnail}" alt="${material.title}">` :
                        `<div class="material-placeholder">${this.getMediaIcon(material.type)}</div>`
                    }
                        </div>
                        <div class="material-info">
                            <h4>${material.title}</h4>
                            <p>${material.type} • ${this.formatDate(material.date)}</p>
                        </div>
                        <div class="material-actions">
                            <button class="btn btn-small btn-secondary" 
                                    onclick="demoApp.removeMaterialFromFlow('${material.identifier}')">
                                Remove
                            </button>
                        </div>
                    </div>
                `).join('');

                listElement.innerHTML = materialsHTML;

                // Replace Feather icons in the selected materials
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
        }

        if (createButton) {
            createButton.disabled = this.selectedMaterials.length === 0;
        }

        // Only update flow selection if we're not in edit mode
        const app = this.getAppInstance();
        if (app && !app.editingFlow) {
            app.updateFlowSelectionState();
            app.updateFlowSelectionDropdown();
        }
    }

    /**
     * Update document type coverage display
     */
    updateDocumentTypeCoverage() {
        this.logMaterialOperation('updateDocumentTypeCoverage');

        const coverage = this.getDocumentTypeCoverage();
        const container = this.getElement('.coverage-badges');

        if (!container) return;

        const documentTypeIcons = {
            'photographic': '<i data-feather="camera" class="icon-sm"></i>',
            'conversational': '<i data-feather="message-circle" class="icon-sm"></i>',
            'endangered': '<i data-feather="alert-triangle" class="icon-sm"></i>',
            'academic': '<i data-feather="book" class="icon-sm"></i>',
            'policy': '<i data-feather="clipboard" class="icon-sm"></i>',
            'financial': '<i data-feather="dollar-sign" class="icon-sm"></i>',
            'ephemeral': '<i data-feather="globe" class="icon-sm"></i>',
            'institutional': '<i data-feather="home" class="icon-sm"></i>'
        };

        const documentTypeLabels = {
            'photographic': 'Photographic',
            'conversational': 'Conversational',
            'endangered': 'Endangered',
            'academic': 'Academic',
            'policy': 'Policy',
            'financial': 'Financial',
            'ephemeral': 'Ephemeral Web',
            'institutional': 'Institutional'
        };

        container.innerHTML = Object.entries(coverage).map(([type, count]) => {
            const hasItems = count > 0;
            return `
                <div class="coverage-badge ${hasItems ? 'has-items' : ''}">
                    <span class="badge-icon">${documentTypeIcons[type]}</span>
                    <span class="badge-label">${documentTypeLabels[type]}</span>
                    <span class="badge-count">${count}</span>
                </div>
            `;
        }).join('');

        // Replace Feather icons in the new content
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Get document type coverage
     * @returns {Object} Coverage object with document type counts
     */
    getDocumentTypeCoverage() {
        this.logMaterialOperation('getDocumentTypeCoverage');

        const documentTypes = [
            'photographic', 'conversational', 'endangered', 'academic',
            'policy', 'financial', 'ephemeral', 'institutional'
        ];

        const coverage = {};
        documentTypes.forEach(type => {
            coverage[type] = this.selectedMaterials.filter(material =>
                this.getMaterialDocumentType(material.identifier) === type
            ).length;
        });

        return coverage;
    }

    /**
     * Get current document type coverage from form (for saving)
     * @returns {Object} Coverage object with current document type counts
     */
    getCurrentDocumentTypeCoverage() {
        this.logMaterialOperation('getCurrentDocumentTypeCoverage');

        const documentTypes = [
            'photographic', 'conversational', 'endangered', 'academic',
            'policy', 'financial', 'ephemeral', 'institutional'
        ];

        const coverage = {};
        documentTypes.forEach(type => {
            coverage[type] = this.selectedMaterials.filter(material =>
                this.getCurrentMaterialDocumentType(material.identifier) === type
            ).length;
        });

        return coverage;
    }

    /**
     * Get material document type (helper function)
     * @param {string} identifier - Material identifier
     * @returns {string} Document type
     */
    getMaterialDocumentType(identifier) {
        // This is a simplified version - in the real app, this would check the material's document type
        // For now, we'll use a default or check if there's a form element
        const item = document.querySelector(`[data-identifier="${identifier}"] .material-doc-type`);
        return item ? item.value : 'policy';
    }

    /**
     * Get media icon for material type
     * @param {string} mediaType - Media type
     * @returns {string} Icon HTML
     */
    getMediaIcon(mediaType) {
        if (window.Utils && window.Utils.Material && window.Utils.Material.getTypeIcon) {
            return window.Utils.Material.getTypeIcon(mediaType);
        }

        // Fallback icons
        const icons = {
            'audio': '<i data-feather="music" class="icon-sm"></i>',
            'video': '<i data-feather="video" class="icon-sm"></i>',
            'texts': '<i data-feather="file-text" class="icon-sm"></i>',
            'image': '<i data-feather="image" class="icon-sm"></i>',
            'software': '<i data-feather="monitor" class="icon-sm"></i>',
            'web': '<i data-feather="globe" class="icon-sm"></i>'
        };

        return icons[mediaType] || '<i data-feather="file-text" class="icon-sm"></i>';
    }

    /**
     * Format date for display
     * @param {string} dateString - Date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (window.internetArchiveAPI && window.internetArchiveAPI.formatDate) {
            return window.internetArchiveAPI.formatDate(dateString);
        }

        // Fallback date formatting
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (error) {
            return dateString || 'Unknown';
        }
    }

    /**
     * Update material card display
     * @param {string} identifier - Material identifier
     */
    updateMaterialCardDisplay(identifier) {
        this.logMaterialOperation('updateMaterialCardDisplay', { identifier });

        const card = this.getElement(`[data-identifier="${identifier}"]`);
        if (!card) {
            console.warn('🔧 updateMaterialCardDisplay: Card not found for identifier:', identifier);
            return;
        }

        const isSelected = this.selectedMaterials.some(m => m.identifier === identifier);
        // Debug logging removed

        // Update selection state
        if (isSelected) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        // Update material card select button
        const selectBtn = card.querySelector('.material-select-btn');
        if (selectBtn) {
            if (isSelected) {
                selectBtn.innerHTML = '<i data-feather="check" class="icon-sm"></i><span>Selected</span>';
                selectBtn.className = 'material-select-btn selected';
                // Debug logging removed
            } else {
                selectBtn.innerHTML = '<i data-feather="plus" class="icon-sm"></i><span>Select</span>';
                selectBtn.className = 'material-select-btn';
                // Debug logging removed
            }

            // Replace Feather icons in the updated button
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        } else {
            console.warn('🔧 updateMaterialCardDisplay: Select button not found for identifier:', identifier);
        }
    }

    /**
     * Update preview panel select button
     * @param {string} identifier - Material identifier (optional, if not provided, updates current preview)
     */
    updatePreviewPanelSelectButton(identifier = null) {
        this.logMaterialOperation('updatePreviewPanelSelectButton', { identifier });

        const previewContent = this.getElement('#preview-content');
        if (!previewContent || previewContent.style.display === 'none') {
            return;
        }

        const selectBtn = previewContent.querySelector('.btn-primary');
        if (!selectBtn) return;

        // If no identifier provided, try to get it from the current preview
        if (!identifier) {
            // Try to get identifier from the preview content data attribute or other means
            const previewData = previewContent.querySelector('[data-identifier]');
            if (previewData) {
                identifier = previewData.dataset.identifier;
            } else {
                // Fallback: try to find by title in all materials (API + selected)
                const previewTitle = previewContent.querySelector('.material-preview-title');
                if (previewTitle) {
                    const title = previewTitle.textContent.trim();
                    // Check selected materials first
                    const selectedMaterial = this.selectedMaterials.find(m => m.title === title);
                    if (selectedMaterial) {
                        identifier = selectedMaterial.identifier;
                    } else {
                        // Check API materials
                        const apiMaterial = this.getMaterialByIdentifier(title);
                        if (apiMaterial) {
                            identifier = apiMaterial.identifier;
                        }
                    }
                }
            }
        }

        // If we still don't have an identifier, just reset the button to unselected state
        if (!identifier) {
            selectBtn.innerHTML = '<i data-feather="plus" class="icon-sm"></i> Select Material';
            selectBtn.className = 'btn btn-primary';
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            return;
        }

        const isSelected = this.selectedMaterials.some(m => m.identifier === identifier);

        if (isSelected) {
            selectBtn.innerHTML = '<i data-feather="check" class="icon-sm"></i> Selected';
            selectBtn.className = 'btn btn-primary selected';
        } else {
            selectBtn.innerHTML = '<i data-feather="plus" class="icon-sm"></i> Select Material';
            selectBtn.className = 'btn btn-primary';
        }

        // Replace Feather icons in the updated button
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Update all UI components for a material selection change
     * @param {string} identifier - Material identifier
     */
    updateAllMaterialUI(identifier) {
        this.logMaterialOperation('updateAllMaterialUI', { identifier });

        // Update material card
        this.updateMaterialCardDisplay(identifier);

        // Update preview panel if this material is being previewed
        this.updatePreviewPanelSelectButton(identifier);

        // Update selected materials display
        this.updateSelectedMaterialsDisplay();
    }

    /**
     * Update all material cards globally
     */
    updateAllMaterialCards() {
        this.logMaterialOperation('updateAllMaterialCards');

        const materialCards = this.getAllElements('.material-card');
        // Debug logging removed

        materialCards.forEach(card => {
            const identifier = card.dataset.identifier;
            if (identifier) {
                // Debug logging removed
                this.updateMaterialCardDisplay(identifier);
            }
        });
    }

    // ============================================================================
    // MATERIAL FLOW FUNCTIONS
    // ============================================================================

    /**
     * Populate materials assignment
     */
    populateMaterialsAssignment() {
        this.logMaterialOperation('populateMaterialsAssignment', {
            selectedCount: this.selectedMaterials.length
        });

        // Debug logging removed

        const container = this.getElement('#materials-assignment-list');
        if (!container) {
            console.error('❌ materials-assignment-list container not found');
            return;
        }

        const materialsHTML = this.selectedMaterials.map(material => `
            <div class="material-assignment-item" data-identifier="${material.identifier}">
                <div class="material-drag-handle" draggable="true" data-identifier="${material.identifier}">
                    <i data-feather="menu" class="drag-icon icon-sm"></i>
                </div>    
                <div class="material-assignment-header">
                    <div class="material-preview">
                        <div class="material-icon">${this.getMediaIcon(material.type)}</div>
                    </div>
                    <div class="material-info">
                        <div class="material-title">${material.title}</div>
                        <div class="material-date">${material.type} • ${this.formatDate(material.date)}</div>
                    </div>
                    <div class="material-actions">
                        <button class="remove-material-btn" onclick="demoApp.removeMaterialFromFlow('${material.identifier}')">
                            Remove
                        </button>
                    </div>
                </div>
                <div class="material-assignment-controls">
                    <div class="control-group">
                        <label>Document Type:</label>
                        <select class="material-doc-type">
                            <option value="photographic" ${this.getMaterialDocumentType(material.identifier) === 'photographic' ? 'selected' : ''}>Photographic Documentation</option>
                            <option value="conversational" ${this.getMaterialDocumentType(material.identifier) === 'conversational' ? 'selected' : ''}>Conversational Documentation</option>
                            <option value="endangered" ${this.getMaterialDocumentType(material.identifier) === 'endangered' ? 'selected' : ''}>Endangered/At-Risk Document</option>
                            <option value="academic" ${this.getMaterialDocumentType(material.identifier) === 'academic' ? 'selected' : ''}>Academic/Research Document</option>
                            <option value="policy" ${this.getMaterialDocumentType(material.identifier) === 'policy' ? 'selected' : ''}>Policy Document</option>
                            <option value="financial" ${this.getMaterialDocumentType(material.identifier) === 'financial' ? 'selected' : ''}>Financial Document</option>
                            <option value="ephemeral" ${this.getMaterialDocumentType(material.identifier) === 'ephemeral' ? 'selected' : ''}>Ephemeral Web Document</option>
                            <option value="institutional" ${this.getMaterialDocumentType(material.identifier) === 'institutional' ? 'selected' : ''}>Institutional Document</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Research Notes:</label>
                        <textarea class="material-notes" placeholder="Add your research notes, analysis, or context about this material...">${this.getMaterialNotes(material.identifier)}</textarea>
                    </div>
                </div>
            </div>
        `).join('');

        // Debug logging removed

        container.innerHTML = materialsHTML;

        // Replace Feather icons in the new content
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        // Debug logging removed

        // Setup drag and drop after populating with a small delay to ensure DOM is ready
        setTimeout(() => {
            const app = this.getAppInstance();
            if (app && app.dragDrop && app.dragDrop.reinitializeDragDrop) {
                // Force re-initialization to ensure drag and drop works in Edit Flow modal
                app.dragDrop.reinitializeDragDrop(true);
            } else if (app && app.setupMaterialDragAndDrop) {
                app.setupMaterialDragAndDrop();
            }
        }, 10);

        // Update document type coverage
        this.updateDocumentTypeCoverage();
    }

    /**
     * Handle material selection in narrative layout
     * @param {string} materialId - Material identifier
     */
    selectMaterialInNarrative(materialId) {
        this.logMaterialOperation('selectMaterialInNarrative', { materialId });

        // Remove previous selection
        const allItems = this.getAllElements('.material-narrative-item');
        allItems.forEach(item => item.classList.remove('selected'));

        // Add selection to clicked item
        const selectedItem = this.getElement(`[data-material-id="${materialId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Preview the material
        const app = this.getAppInstance();
        if (app && app.previewMaterialInFlow) {
            app.previewMaterialInFlow(materialId);
        }
    }

    /**
     * Get material notes from assignment form
     * @param {string} identifier - Material identifier
     * @returns {string} Material notes
     */
    getMaterialNotes(identifier) {
        this.logMaterialOperation('getMaterialNotes', { identifier });

        const app = this.getAppInstance();

        // First try to get from the current editing flow if we're editing
        if (app && app.editingFlow) {
            const flowMaterial = app.editingFlow.materials.find(m => m.identifier === identifier);
            if (flowMaterial && flowMaterial.notes) {
                // Debug logging removed
                return flowMaterial.notes;
            }
        }

        // For new flows, always return empty string to prevent persistence from previous flows
        // Only check form element if we're in edit mode
        if (app && app.editingFlow) {
            const item = this.getElement(`[data-identifier="${identifier}"] .material-notes`);
            const result = item ? item.value : '';
            // Debug logging removed
            return result;
        } else {
            // For new flows, always return empty string
            // Debug logging removed
            return '';
        }
    }
}

// Initialize and expose globally
window.materialManager = new MaterialManager(stateManager, eventManager);

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
    module.exports = { MaterialManager };
} else {
    window.MaterialManager = MaterialManager;
}
