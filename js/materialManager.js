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

        // Quill editor instances map
        this.quillInstances = new Map();

        // Event listener references for cleanup
        this.quillEventListeners = new Map();

        // MutationObserver references for cleanup
        this.quillObservers = new Map();

        // Window focus/blur handler reference
        this.windowFocusHandler = null;

        // Draft state for editing flows - stores edits separately from source data
        // Structure: { [materialId]: { notes, documentType, order } }
        this.draftState = null;

        // Original flow data backup for cancel operations
        this.originalFlowBackup = null;
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
        // No-op for production
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
     * Get document types from config
     * @returns {Array} Array of unique document type IDs
     */
    getDocumentTypes() {
        if (window.Utils && window.Utils.DocumentType && window.Utils.DocumentType.getUniqueTypes) {
            return window.Utils.DocumentType.getUniqueTypes().map(type => type.id || type.name);
        }
        // Fallback to default types
        return [
            'photographic', 'conversational', 'endangered', 'academic',
            'policy', 'financial', 'ephemeral', 'institutional'
        ];
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
            // Preserve all properties including notes, documentType, order, etc. when setting materials
            // Use explicit property copying to ensure all flow-specific data is preserved
            this.selectedMaterials = materials.map(m => {
                const materialCopy = { ...m };
                // Explicitly preserve notes and other flow-specific properties
                if (m.notes !== undefined) {
                    materialCopy.notes = m.notes;
                }
                if (m.documentType !== undefined) {
                    materialCopy.documentType = m.documentType;
                }
                if (m.order !== undefined) {
                    materialCopy.order = m.order;
                }
                return materialCopy;
            });
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

        // If we have draft state, get from draft first
        if (this.hasDraft()) {
            const draftDocType = this.getDraft(identifier, 'documentType');
            if (draftDocType !== null && draftDocType !== undefined) {
                return draftDocType;
            }
        }

        // Fallback to form element
        const item = document.querySelector(`[data-identifier="${identifier}"] .material-doc-type`);
        const result = item ? item.value : 'policy';
        return result;
    }

    /**
     * Get current material notes from form (for saving)
     * @param {string} identifier - Material identifier
     * @returns {string} Notes value (HTML format)
     */
    getCurrentMaterialNotes(identifier) {
        this.logMaterialOperation('getCurrentMaterialNotes', { identifier });

        // Try to get from Quill editor first - use health check
        if (this.isQuillInstanceValid(identifier)) {
            const quill = this.quillInstances.get(identifier);
            // Get the full HTML content including all formatting and links
            // Use innerHTML to preserve all HTML attributes (href, style, etc.)
            const htmlContent = quill.root.innerHTML.trim();

            // Return empty string if it's just the default empty paragraph
            if (htmlContent === '<p><br></p>' || htmlContent === '<p></p>' || htmlContent === '') {
                return '';
            }

            // Return the full HTML with all attributes (including links)
            return htmlContent;
        }

        // If we have draft state, get from draft (source of truth during editing)
        if (this.hasDraft()) {
            const draftNotes = this.getDraft(identifier, 'notes');
            if (draftNotes !== null && draftNotes !== undefined) {
                return String(draftNotes);
            }
        }

        // Fallback: try to get from selectedMaterials (for new flow creation)
        const selectedMaterial = this.selectedMaterials.find(m => m.identifier === identifier);
        if (selectedMaterial && selectedMaterial.notes !== undefined && selectedMaterial.notes !== null) {
            const notesStr = String(selectedMaterial.notes);
            if (notesStr.trim()) {
                return notesStr;
            }
        }

        // Fallback: try to get from textarea (for backward compatibility)
        const item = document.querySelector(`[data-identifier="${identifier}"] .material-notes`);
        if (item && item.value) {
            return item.value;
        }

        return '';
    }

    /**
     * Get material data from API or persisted flow data
     * @param {string} identifier - Material identifier
     * @returns {Object} Material data object
     */
    getMaterialData(identifier) {
        this.logMaterialOperation('getMaterialData', { identifier });


        // Check if this is a flow-specific identifier
        const originalIdentifier = this.getOriginalMaterialId(identifier);
        const isFlowSpecific = originalIdentifier !== identifier;

        // Try to get material from current API first (for newly created flows)
        let material = this.getMaterialByIdentifier(originalIdentifier);

        if (material) {

            // If this is a flow-specific identifier, merge with flow-specific data
            if (isFlowSpecific) {
                // Find the flow-specific data
                const app = this.getAppInstance();
                if (app && app.createdFlows) {
                    for (const flow of app.createdFlows) {
                        const flowMaterial = flow.materials.find(m => m.identifier === identifier);
                        if (flowMaterial) {
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
        const app = this.getAppInstance();
        if (app && app.createdFlows) {
            for (const flow of app.createdFlows) {
                const flowMaterial = flow.materials.find(m => m.identifier === identifier);
                if (flowMaterial) {
                    // Return the complete material data if available
                    return flowMaterial.completeData || flowMaterial;
                }
            }
        }

        // For duplicate materials, try to find the original material
        if (identifier.includes('_duplicate_')) {
            const originalIdentifier = identifier.split('_duplicate_')[0];

            // Try to get original material from API
            const originalMaterial = this.getMaterialByIdentifier(originalIdentifier);
            if (originalMaterial) {
                return originalMaterial;
            }

            // Try to get original material from flow data
            if (app && app.createdFlows) {
                for (const flow of app.createdFlows) {
                    const flowMaterial = flow.materials.find(m => m.identifier === originalIdentifier);
                    if (flowMaterial) {
                        return flowMaterial.completeData || flowMaterial;
                    }
                }
            }
        }

        console.error('Material not found in API or flow data for identifier:', identifier);
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


        this.selectedMaterials = [];


        // Update state
        this.updateMaterialState({
            selectedCount: 0,
            documentTypeCoverage: this.calculateDocumentTypeCoverage()
        });

        // Update UI
        this.updateSelectedMaterialsDisplay();

        // Update all material cards globally
        this.updateAllMaterialCards();

        // Update preview panel select button
        this.updatePreviewPanelSelectButton();

        this.logMaterialOperation('selectedMaterialsCleared', { clearedCount: 0 });
    }

    /**
     * Remove material from flow creation (alias for removeMaterial)
     * @param {string} identifier - Material identifier
     */
    removeMaterialFromFlow(identifier) {
        this.logMaterialOperation('removeMaterialFromFlow', { identifier });

        // Clean up Quill editor for this material
        this.cleanupQuillEditors(identifier);


        // Check for duplicate identifiers
        const duplicateCount = this.selectedMaterials.filter(m => m.identifier === identifier).length;

        const beforeCount = this.selectedMaterials.length;
        this.selectedMaterials = this.selectedMaterials.filter(m => m.identifier !== identifier);
        const afterCount = this.selectedMaterials.length;


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
        // Use Utils.Material.getDocumentType() which properly handles editing flow persistence
        if (window.Utils && window.Utils.Material && typeof window.Utils.Material.getDocumentType === 'function') {
            return window.Utils.Material.getDocumentType(identifier);
        }
        // Fallback: check form element
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
            } else {
                selectBtn.innerHTML = '<i data-feather="plus" class="icon-sm"></i><span>Select</span>';
                selectBtn.className = 'material-select-btn';
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

        materialCards.forEach(card => {
            const identifier = card.dataset.identifier;
            if (identifier) {
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


        const container = this.getElement('#materials-assignment-list');
        if (!container) {
            console.error('materials-assignment-list container not found');
            return;
        }

        const materialsHTML = this.selectedMaterials.map(material => `
            <div class="material-assignment-item" data-identifier="${material.identifier}">
                <div class="material-assignment-header">
                    <div class="material-drag-handle" draggable="true" data-identifier="${material.identifier}">
                        <i data-feather="menu" class="drag-icon icon-sm"></i>
                    </div>
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
                        <div id="quill-editor-${material.identifier}" class="material-notes-editor"></div>
                    </div>
                </div>
            </div>
        `).join('');


        container.innerHTML = materialsHTML;

        // Replace Feather icons in the new content
        if (typeof feather !== 'undefined') {
            feather.replace();
        }


        // Initialize Quill editors for each material
        // Use requestAnimationFrame to ensure DOM is ready without arbitrary delays
        requestAnimationFrame(() => {
            this.initializeQuillEditors();
        });

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

        // Preview the material (skip embed reload since it's already shown inline)
        const app = this.getAppInstance();
        if (app && app.preview && app.preview.previewMaterialInFlow) {
            app.preview.previewMaterialInFlow(materialId, true);
        }
    }

    /**
     * Check if Quill instance is valid and healthy
     * @param {string} identifier - Material identifier
     * @returns {boolean} True if Quill instance is valid
     */
    isQuillInstanceValid(identifier) {
        if (!this.quillInstances.has(identifier)) {
            return false;
        }

        const quill = this.quillInstances.get(identifier);
        if (!quill || !quill.root) {
            return false;
        }

        // Check if root is in the DOM
        if (!document.contains(quill.root)) {
            return false;
        }

        // Validate Quill instance health by checking if it can get length
        try {
            const length = quill.getLength();
            if (length === undefined || length === null || length < 0) {
                return false;
            }
        } catch (e) {
            return false;
        }

        return true;
    }

    /**
     * Validate and recover Quill instance if needed
     * @param {string} identifier - Material identifier
     * @returns {boolean} True if instance is valid or was recovered
     */
    validateAndRecoverQuill(identifier) {
        if (this.isQuillInstanceValid(identifier)) {
            return true;
        }

        // Try to recover by reinitializing this specific editor
        const material = this.selectedMaterials.find(m => m.identifier === identifier);
        if (!material) {
            return false;
        }

        const editorId = `quill-editor-${material.identifier}`;
        const editorElement = document.getElementById(editorId);
        if (!editorElement) {
            return false;
        }

        // Clean up invalid instance
        this.cleanupQuillEditors(identifier);

        // Reinitialize
        if (typeof Quill !== 'undefined') {
            try {
                const quill = new Quill(editorElement, {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline'],
                            ['link'],
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                            ['clean']
                        ]
                    },
                    placeholder: 'Add your research notes, analysis, or context about this material...'
                });

                this.quillInstances.set(identifier, quill);

                // Set up event listeners
                const textChangeHandler = () => {
                    this.syncQuillContentToFlow(identifier, quill);
                    if (quill.root.classList.contains('ql-blank')) {
                        quill.root.classList.remove('ql-blank');
                    }
                };

                const blurHandler = () => {
                    this.syncQuillContentToFlow(identifier, quill);
                };

                quill.on('text-change', textChangeHandler);
                quill.root.addEventListener('blur', blurHandler, true);

                this.quillEventListeners.set(identifier, {
                    textChange: textChangeHandler,
                    blur: blurHandler
                });

                // Restore content from draft
                const notesContent = this.getMaterialNotesForQuill(identifier);
                if (notesContent && notesContent.trim()) {
                    Promise.resolve().then(() => {
                        try {
                            const delta = quill.clipboard.convert(notesContent);
                            quill.setContents(delta, 'api');
                            quill.update();
                        } catch (e) {
                            // Silently fail - recovery attempt failed
                        }
                    });
                }

                return true;
            } catch (e) {
                console.error(`[Quill Recovery] Failed to recover Quill instance for ${identifier}:`, e);
                return false;
            }
        }

        return false;
    }

    /**
     * Create draft state from current flow data
     * @param {Object} flow - Flow object to create draft from
     */
    createDraft(flow) {
        if (!flow || !flow.materials) {
            this.draftState = {};
            return;
        }

        this.draftState = {};
        flow.materials.forEach(material => {
            if (material && material.identifier) {
                this.draftState[material.identifier] = {
                    notes: material.notes !== undefined ? String(material.notes) : '',
                    documentType: material.documentType || 'policy',
                    order: material.order !== undefined ? material.order : 0
                };
            }
        });

        // Store original flow as backup for cancel
        this.originalFlowBackup = JSON.parse(JSON.stringify(flow));
    }

    /**
     * Get draft value for a material
     * @param {string} identifier - Material identifier
     * @param {string} field - Field name ('notes', 'documentType', 'order')
     * @returns {any} Draft value or null if not found
     */
    getDraft(identifier, field) {
        if (!this.draftState || !this.draftState[identifier]) {
            return null;
        }
        return this.draftState[identifier][field] ?? null;
    }

    /**
     * Update draft value for a material
     * @param {string} identifier - Material identifier
     * @param {string} field - Field name ('notes', 'documentType', 'order')
     * @param {any} value - Value to set
     */
    setDraft(identifier, field, value) {
        if (!this.draftState) {
            this.draftState = {};
        }
        if (!this.draftState[identifier]) {
            this.draftState[identifier] = {};
        }
        this.draftState[identifier][field] = value;
    }

    /**
     * Clear draft state
     */
    clearDraft() {
        this.draftState = null;
        this.originalFlowBackup = null;
    }

    /**
     * Apply draft state to flow object (for saving)
     * @param {Object} flow - Flow object to apply draft to
     * @returns {Object} Updated flow object
     */
    applyDraft(flow) {
        if (!this.draftState || !flow || !flow.materials) {
            return flow;
        }

        const updatedFlow = { ...flow };
        updatedFlow.materials = flow.materials.map(material => {
            const draft = this.draftState[material.identifier];
            if (draft) {
                return {
                    ...material,
                    notes: draft.notes !== undefined ? draft.notes : material.notes,
                    documentType: draft.documentType || material.documentType || 'policy',
                    order: draft.order !== undefined ? draft.order : material.order
                };
            }
            return material;
        });

        return updatedFlow;
    }

    /**
     * Check if draft state exists
     * @returns {boolean} True if draft state exists
     */
    hasDraft() {
        return this.draftState !== null && Object.keys(this.draftState).length > 0;
    }

    /**
     * Get original flow backup for cancel operations
     * @returns {Object|null} Original flow backup or null
     */
    getOriginalFlowBackup() {
        return this.originalFlowBackup;
    }

    /**
     * Sync Quill content to draft state (not to source)
     * @param {string} identifier - Material identifier
     * @param {Object} quill - Quill instance
     */
    syncQuillContentToFlow(identifier, quill) {
        if (!quill || !quill.root) return;

        try {
            const app = this.getAppInstance();
            if (!app) return; // App not initialized yet, skip sync

            // Get content from Quill - use Delta format for better preservation
            let content = '';
            try {
                // Try to get as HTML first (for compatibility)
                const htmlContent = quill.root.innerHTML.trim();
                const isEmpty = htmlContent === '<p><br></p>' || htmlContent === '<p></p>' || htmlContent === '';
                content = isEmpty ? '' : htmlContent;
            } catch (e) {
                return;
            }

            // If we're in edit mode with draft state, sync to draft
            if (app.editingFlow && this.hasDraft()) {
                this.setDraft(identifier, 'notes', content);
            } else {
                // For new flow creation (no draft), sync to selectedMaterials
                const selectedMaterial = this.selectedMaterials.find(m => m && m.identifier === identifier);
                if (selectedMaterial) {
                    selectedMaterial.notes = content;
                }
            }

        } catch (e) {
            // Silently fail - don't break the app if sync fails
        }
    }

    /**
     * Sync all Quill editors to flow objects
     * Called before save operations to ensure all changes are captured
     */
    syncAllQuillEditorsToFlow() {
        this.quillInstances.forEach((quill, identifier) => {
            if (this.isQuillInstanceValid(identifier)) {
                this.syncQuillContentToFlow(identifier, quill);
            }
        });
    }

    /**
     * Setup window focus handler to restore Quill editing state
     */
    setupWindowFocusHandler() {
        // Remove existing handler if any
        if (this.windowFocusHandler) {
            window.removeEventListener('focus', this.windowFocusHandler);
        }

        // Create new handler
        this.windowFocusHandler = () => {
            // When window regains focus, ensure Quill instances are still valid
            // Quill should remain editable, but we can verify and restore if needed
            this.quillInstances.forEach((quill, identifier) => {
                if (quill && quill.root && document.contains(quill.root)) {
                    // Quill instance is valid, ensure it's still editable
                    // The instance should remain functional, but we can trigger a refresh if needed
                    try {
                        // Just verify the instance is accessible
                        const length = quill.getLength();
                        if (length === undefined || length === null) {
                            // Instance appears invalid, but don't log
                        }
                    } catch (e) {
                        // Error checking instance, but don't log
                    }
                }
            });
        };

        window.addEventListener('focus', this.windowFocusHandler);
    }

    /**
     * Remove window focus handler
     */
    removeWindowFocusHandler() {
        if (this.windowFocusHandler) {
            window.removeEventListener('focus', this.windowFocusHandler);
            this.windowFocusHandler = null;
        }
    }

    /**
     * Initialize Quill editors for all material assignment items
     */
    async initializeQuillEditors() {
        // Wait for Quill to be available
        if (typeof Quill === 'undefined') {
            // Retry after a short delay if Quill hasn't loaded yet
            setTimeout(() => {
                if (typeof Quill !== 'undefined') {
                    this.initializeQuillEditors();
                } else {
                    console.warn('Quill is not loaded - falling back to plain textarea');
                    this.fallbackToTextarea();
                }
            }, 100);
            return;
        }

        this.selectedMaterials.forEach(material => {
            const editorId = `quill-editor-${material.identifier}`;
            const editorElement = document.getElementById(editorId);

            if (!editorElement) {
                console.warn('Quill editor element not found:', editorId);
                return;
            }

            // Ensure element is in the DOM and visible
            if (!editorElement.offsetParent && editorElement.style.display === 'none') {
                console.warn('Quill editor element is hidden:', editorId);
            }

            // Destroy existing Quill instance if it exists
            if (this.quillInstances.has(material.identifier)) {
                const existingQuill = this.quillInstances.get(material.identifier);
                try {
                    // Remove event listeners first
                    if (this.quillEventListeners.has(material.identifier)) {
                        const listeners = this.quillEventListeners.get(material.identifier);
                        if (listeners.textChange && existingQuill) {
                            existingQuill.off('text-change', listeners.textChange);
                        }
                        if (listeners.blur && existingQuill && existingQuill.root) {
                            existingQuill.root.removeEventListener('blur', listeners.blur, true);
                        }
                        this.quillEventListeners.delete(material.identifier);
                    }

                    // Properly destroy the Quill instance
                    if (existingQuill) {
                        // Quill doesn't have a built-in destroy method, so we clear content and remove
                        if (existingQuill.root) {
                            existingQuill.root.innerHTML = '';
                        }
                    }
                } catch (e) {
                    console.warn('Error cleaning up Quill instance:', e);
                }
                this.quillInstances.delete(material.identifier);
            }

            // CRITICAL: Verify editor element is in DOM before initializing Quill
            if (!document.contains(editorElement)) {
                console.error(`[Quill Debug] CRITICAL: Editor element ${editorId} is NOT in DOM before Quill initialization!`);
                return;
            }

            // Clear the editor element before creating new Quill instance
            // This ensures a clean slate
            editorElement.innerHTML = '';

            // CRITICAL: Verify element is still in DOM after clearing
            if (!document.contains(editorElement)) {
                console.error(`[Quill Debug] CRITICAL: Editor element ${editorId} was removed from DOM after clearing!`);
                return;
            }

            // Get existing notes content - use draft state as source of truth during editing
            let notesContent = this.getMaterialNotesForQuill(material.identifier);

            // CRITICAL FIX: Ensure editor element is ready and has proper attributes
            // Don't set contentEditable on the wrapper - Quill will handle that
            editorElement.style.pointerEvents = 'auto';
            editorElement.style.position = 'relative';
            editorElement.style.zIndex = '1';

            // Initialize Quill editor
            let quill;
            try {
                quill = new Quill(editorElement, {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline'],
                            ['link'],
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                            ['clean']
                        ]
                    },
                    placeholder: 'Add your research notes, analysis, or context about this material...'
                });

                // CRITICAL: Immediately verify root is in DOM after Quill creation
                if (quill && quill.root) {
                    const rootInDOM = document.contains(quill.root);
                    const editorInDOM = document.contains(editorElement);
                    const rootIsChildOfEditor = editorElement.contains(quill.root);

                    if (!rootInDOM) {
                        console.error(`[Quill Debug] CRITICAL: Quill root is NOT in DOM immediately after creation for ${material.identifier}!`);

                        // Try to manually reattach if editor is in DOM but root is not
                        if (editorInDOM && !rootIsChildOfEditor && quill.root.parentElement) {
                            // Root has wrong parent, but cannot manually fix (Quill manages its own DOM)
                        }
                    }

                    // Verify Quill's internal structure
                    const toolbar = editorElement.querySelector('.ql-toolbar');
                    const container = editorElement.querySelector('.ql-container');
                    const editor = editorElement.querySelector('.ql-editor');
                }
            } catch (e) {
                console.error(`[Quill Debug] CRITICAL ERROR creating Quill for ${material.identifier}:`, e);
                return;
            }

            // CRITICAL FIX: Force Quill to be editable and interactive
            if (quill && quill.root) {
                // Ensure contentEditable is set (Quill should do this, but force it)
                if (quill.root.contentEditable !== 'true') {
                    quill.root.contentEditable = 'true';
                    quill.root.setAttribute('contenteditable', 'true');
                }

                // Force pointer events with !important via style
                quill.root.style.setProperty('pointer-events', 'auto', 'important');
                quill.root.style.setProperty('user-select', 'text', 'important');
                quill.root.style.setProperty('-webkit-user-select', 'text', 'important');
                quill.root.style.setProperty('-moz-user-select', 'text', 'important');

                // Make it focusable
                quill.root.tabIndex = 0;

                // Ensure container is also interactive
                const container = editorElement.querySelector('.ql-container');
                if (container) {
                    container.style.setProperty('pointer-events', 'auto', 'important');
                }

                // Check for overlaying elements
                try {
                    const rect = quill.root.getBoundingClientRect();
                    const elementAtPoint = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    if (elementAtPoint && elementAtPoint !== quill.root && !quill.root.contains(elementAtPoint)) {
                        // Element at editor center is not the editor itself, but don't log
                    }
                } catch (e) {
                    // Error checking overlay, but don't log
                }
            }

            // Diagnostic logging: Quill initialization
            const rootComputedStyle = quill ? window.getComputedStyle(quill.root) : null;

            if (!quill || !quill.root) {
                console.error(`[Quill Debug] CRITICAL: Failed to create Quill instance for ${material.identifier}`);
                return;
            }

            // Store Quill instance immediately
            this.quillInstances.set(material.identifier, quill);

            // CRITICAL: Verify Quill is actually functional - check immediately and after delay
            const verifyQuillConnection = () => {
                try {
                    if (!quill || !quill.root) {
                        console.error(`[Quill Debug] Quill or root is null for ${material.identifier}`);
                        return;
                    }

                    const testLength = quill.getLength();
                    const testText = quill.getText();
                    const isEnabled = !quill.isEnabled || quill.isEnabled();
                    const rootIsConnected = quill.root.isConnected;
                    const editorElementStillInDOM = document.contains(editorElement);

                    // If root is not connected, try to fix it
                    if (!rootIsConnected) {
                        console.error(`[Quill Debug] CRITICAL: Root is NOT connected for ${material.identifier}! Attempting recovery...`);

                        // Check if editorElement still exists and is in DOM
                        if (editorElementStillInDOM) {
                            // Check if root is a child of editorElement
                            const rootInEditor = editorElement.contains(quill.root);

                            // If root exists but isn't in editorElement, try to reattach
                            if (!rootInEditor && quill.root.parentElement) {
                                // Don't move it - Quill manages its own DOM structure
                            }
                        } else {
                            console.error(`[Quill Debug] Editor element itself is not in DOM!`);
                        }
                    }

                    // Try to enable Quill if it's disabled
                    if (quill.isEnabled && !quill.isEnabled()) {
                        quill.enable(true);
                    }
                } catch (e) {
                    console.error(`[Quill Debug] Error testing Quill functionality for ${material.identifier}:`, e);
                }
            };

            // Check immediately
            verifyQuillConnection();

            // Check again after a delay to see if something removes it
            setTimeout(verifyQuillConnection, 100);
            setTimeout(verifyQuillConnection, 500);

            // Set up real-time sync listeners (syncs to draft state)
            const textChangeHandler = (delta, oldDelta, source) => {
                const hasBlankClass = quill.root.classList.contains('ql-blank');
                const content = quill.root.innerHTML;
                const textLength = quill.getLength();
                const textContent = quill.getText().trim();

                this.syncQuillContentToFlow(material.identifier, quill);

                // Ensure placeholder is cleared when user types
                // Check both text length and actual text content
                if (hasBlankClass && (textLength > 1 || textContent.length > 0)) {
                    quill.root.classList.remove('ql-blank');
                }
            };

            // Also listen to editor-change which fires for all changes including formatting
            const editorChangeHandler = (name, ...args) => {
                // Handle editor change
            };

            const blurHandler = () => {
                this.syncQuillContentToFlow(material.identifier, quill);
            };

            // Add event listeners for real-time sync
            // Use both Quill's event system and native DOM events
            quill.on('text-change', textChangeHandler);
            quill.on('editor-change', editorChangeHandler);

            // Also listen directly on the root element
            quill.root.addEventListener('blur', blurHandler, true);

            // CRITICAL: Add beforeinput event which fires before input
            quill.root.addEventListener('beforeinput', (e) => {
                // Handle beforeinput event
            }, true);

            // CRITICAL: Add composition events for IME input
            quill.root.addEventListener('compositionstart', (e) => {
            }, true);
            quill.root.addEventListener('compositionend', (e) => {
                // Handle compositionend event
            }, true);

            // Store editor-change handler for cleanup
            const storedListeners = {
                textChange: textChangeHandler,
                editorChange: editorChangeHandler,
                blur: blurHandler
            };

            // Add input event logging to track user typing - use capture phase
            const inputHandler = (e) => {
                const hasBlank = quill.root.classList.contains('ql-blank');
                const length = quill.getLength();
                const text = quill.getText().trim();


                // MANUAL placeholder removal if Quill's isn't working
                if (hasBlank && (length > 1 || text.length > 0)) {
                    quill.root.classList.remove('ql-blank');
                }
            };
            quill.root.addEventListener('input', inputHandler, true);
            // Also add to the container as fallback
            const container = editorElement.querySelector('.ql-container');
            if (container) {
                container.addEventListener('input', inputHandler, true);
            }

            // Add MutationObserver to watch for content changes as fallback
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        const hasBlank = quill.root.classList.contains('ql-blank');
                        const length = quill.getLength();
                        const text = quill.getText().trim();

                        if (hasBlank && (length > 1 || text.length > 0)) {
                            quill.root.classList.remove('ql-blank');
                        }
                    }
                });
            });
            observer.observe(quill.root, {
                childList: true,
                characterData: true,
                subtree: true
            });

            // Store observer for cleanup
            if (!this.quillObservers) {
                this.quillObservers = new Map();
            }
            this.quillObservers.set(material.identifier, observer);

            // Add keydown event to catch typing before text-change
            const keydownHandler = (e) => {
                // Handle keydown event
            };
            quill.root.addEventListener('keydown', keydownHandler, true);
            if (container) {
                container.addEventListener('keydown', keydownHandler, true);
            }

            // Add focus event logging
            quill.root.addEventListener('focus', () => {
                // Handle focus event
            }, true);

            // Add click event to verify editor is clickable - use both capture and bubble
            const clickHandler = (e) => {
                // Handle click event

                // Force focus if not already focused
                if (document.activeElement !== quill.root) {
                    setTimeout(() => {
                        quill.root.focus();
                        quill.focus();
                    }, 0);
                }
            };
            // Add in both capture and bubble phases
            quill.root.addEventListener('click', clickHandler, true);
            quill.root.addEventListener('click', clickHandler, false);
            if (container) {
                container.addEventListener('click', clickHandler, true);
                container.addEventListener('click', clickHandler, false);
            }

            // Also add to the wrapper element
            editorElement.addEventListener('click', (e) => {
                // Handle click on editor element
            }, true);

            // Also add mousedown to catch earlier
            const mousedownHandler = (e) => {
                // Handle mousedown event
            };
            quill.root.addEventListener('mousedown', mousedownHandler, true);
            if (container) {
                container.addEventListener('mousedown', mousedownHandler, true);
            }

            // Add toolbar click logging - use setTimeout to ensure toolbar is fully rendered
            // Don't clone the container as that breaks Quill's internal handlers
            setTimeout(() => {
                const toolbar = quill.getModule('toolbar');
                if (toolbar && toolbar.container) {
                    // Add click handler with capture phase - don't clone, just add listener
                    toolbar.container.addEventListener('click', (e) => {
                        const button = e.target.closest('button, .ql-picker, .ql-picker-label, .ql-picker-item');
                        if (button) {
                            // Handle toolbar button click
                        } else {
                            // Handle toolbar click (no button)
                        }
                    }, true); // Use capture phase to catch before Quill's handlers

                    // Also add mousedown to catch earlier
                    toolbar.container.addEventListener('mousedown', (e) => {
                        const button = e.target.closest('button, .ql-picker, .ql-picker-label');
                        if (button) {
                            // Handle toolbar mousedown
                        }
                    }, true);

                    // Log toolbar button states
                    const buttons = toolbar.container.querySelectorAll('button, .ql-picker');
                } else {
                    // No toolbar found, but don't log
                }
            }, 200);

            // Store listener references for cleanup
            this.quillEventListeners.set(material.identifier, storedListeners);

            // Set initial content immediately after Quill instance is created
            // Use a microtask to ensure Quill is fully initialized but without arbitrary delays
            Promise.resolve().then(() => {
                // Verify Quill is ready
                if (!quill || !quill.root) {
                    return;
                }

                // Diagnostic: Check Quill state before setting content
                const initialState = {
                    hasRoot: !!quill.root,
                    rootInDOM: document.contains(quill.root),
                    rootClasses: quill.root.className,
                    hasBlankClass: quill.root.classList.contains('ql-blank'),
                    currentLength: quill.getLength(),
                    currentHTML: quill.root.innerHTML.substring(0, 100),
                    hasToolbar: !!quill.getModule('toolbar'),
                    toolbarInDOM: quill.getModule('toolbar') ? document.contains(quill.getModule('toolbar').container) : false
                };

                // Set content if available
                if (notesContent && notesContent.trim()) {
                    try {
                        // Use Quill's clipboard API to convert HTML to Delta format
                        // This preserves all formatting including bullets, line breaks, links

                        const delta = quill.clipboard.convert(notesContent);
                        quill.setContents(delta, 'api');
                        quill.update();

                        // Ensure placeholder is cleared
                        if (quill.root.classList.contains('ql-blank')) {
                            quill.root.classList.remove('ql-blank');
                        }

                        // Verify content was set correctly
                        const length = quill.getLength();
                        const hasBlankAfter = quill.root.classList.contains('ql-blank');
                        const htmlAfter = quill.root.innerHTML.substring(0, 100);
                        const textAfter = quill.getText().substring(0, 50);

                        if (length > 1) { // Length 1 is just the newline, >1 means content
                        } else {
                            // Content may not have been set correctly, but don't log
                        }
                    } catch (e) {
                        console.error(`[Quill Init] Error setting HTML content for ${material.identifier}:`, e);
                        console.error(`[Quill Init] HTML content that failed:`, notesContent.substring(0, 200));

                        // Try alternative: set HTML directly via root.innerHTML (last resort)
                        try {
                            quill.root.innerHTML = notesContent;
                            quill.update();

                            // Verify it worked
                            const length = quill.getLength();
                            if (length > 1) {
                                if (quill.root.classList.contains('ql-blank')) {
                                    quill.root.classList.remove('ql-blank');
                                }
                            } else {
                                throw new Error('Direct HTML set did not result in content');
                            }
                        } catch (e2) {
                            console.error(`[Quill Init] Direct HTML set also failed for ${material.identifier}:`, e2);
                            // Last resort: try plain text if HTML conversion fails
                            try {
                                // Strip HTML tags for plain text fallback
                                const textContent = notesContent.replace(/<[^>]*>/g, '').trim();
                                if (textContent) {
                                    quill.setText(textContent);
                                    quill.update();
                                    // Used plain text fallback - formatting was lost
                                }
                            } catch (e3) {
                                console.error(`[Quill Init] All content setting methods failed for ${material.identifier}:`, e3);
                            }
                        }
                    }
                } else {
                    // Ensure empty state with placeholder
                    try {
                        const currentLength = quill.getLength();
                        const hasBlankClass = quill.root.classList.contains('ql-blank');

                        // Don't force setContents if Quill is already in empty state
                        if (currentLength <= 1) {
                            if (!hasBlankClass) {
                                quill.root.classList.add('ql-blank');
                            }
                        } else {
                            quill.setContents([{ insert: '\n' }], 'api');
                            quill.root.classList.add('ql-blank');
                        }
                    } catch (e) {
                        // Error setting empty state, but don't log
                    }
                }
            });

        });

        // Setup window focus handler if not already set up
        if (!this.windowFocusHandler) {
            this.setupWindowFocusHandler();
        }
    }

    /**
     * Get material notes content for Quill initialization
     * @param {string} identifier - Material identifier
     * @returns {string} Material notes content (HTML or plain text)
     */
    getMaterialNotesForQuill(identifier) {
        // If we have draft state, get from draft (source of truth during editing)
        if (this.hasDraft()) {
            const draftNotes = this.getDraft(identifier, 'notes');
            if (draftNotes !== null && draftNotes !== undefined && draftNotes !== '') {
                return String(draftNotes);
            }
        }

        // Fallback: try to get from selectedMaterials (for new flow creation)
        const selectedMaterial = this.selectedMaterials.find(m => m.identifier === identifier);
        if (selectedMaterial && selectedMaterial.notes !== undefined && selectedMaterial.notes !== null && selectedMaterial.notes !== '') {
            return String(selectedMaterial.notes);
        }

        // For new flows, return empty string
        return '';
    }

    /**
     * Get material notes from assignment form
     * @param {string} identifier - Material identifier
     * @returns {string} Material notes (HTML format)
     */
    getMaterialNotes(identifier) {
        this.logMaterialOperation('getMaterialNotes', { identifier });

        const app = this.getAppInstance();

        // First try to get from Quill editor if it exists and is valid
        if (this.isQuillInstanceValid(identifier)) {
            const quill = this.quillInstances.get(identifier);
            const htmlContent = quill.root.innerHTML.trim();
            // Return empty string if it's just the default empty paragraph
            if (htmlContent === '<p><br></p>' || htmlContent === '<p></p>' || htmlContent === '') {
                return '';
            }
            return htmlContent;
        }

        // Fallback: try to get from the current editing flow if we're editing
        if (app && app.editingFlow) {
            const flowMaterial = app.editingFlow.materials.find(m => m.identifier === identifier);
            if (flowMaterial && flowMaterial.notes) {
                return flowMaterial.notes;
            }
        }

        // Fallback: try to get from selectedMaterials
        const selectedMaterial = this.selectedMaterials.find(m => m.identifier === identifier);
        if (selectedMaterial && selectedMaterial.notes) {
            return selectedMaterial.notes;
        }

        // For new flows, return empty string
        return '';
    }

    /**
     * Fallback to textarea if Quill is not available
     */
    fallbackToTextarea() {
        this.selectedMaterials.forEach(material => {
            const editorId = `quill-editor-${material.identifier}`;
            const editorElement = document.getElementById(editorId);

            if (!editorElement) {
                return;
            }

            // Replace Quill editor div with textarea
            const textarea = document.createElement('textarea');
            textarea.className = 'material-notes';
            textarea.placeholder = 'Add your research notes, analysis, or context about this material...';
            textarea.value = this.getMaterialNotesForQuill(material.identifier);

            editorElement.parentNode.replaceChild(textarea, editorElement);
        });
    }

    /**
     * Clean up Quill editor instances
     * @param {string} identifier - Optional material identifier to clean up specific editor
     */
    cleanupQuillEditors(identifier = null) {
        if (identifier) {
            // Clean up specific editor
            if (this.quillInstances.has(identifier)) {
                const quill = this.quillInstances.get(identifier);

                // Remove event listeners
                if (this.quillEventListeners.has(identifier)) {
                    const listeners = this.quillEventListeners.get(identifier);
                    if (listeners.textChange && quill) {
                        quill.off('text-change', listeners.textChange);
                    }
                    if (listeners.editorChange && quill) {
                        quill.off('editor-change', listeners.editorChange);
                    }
                    if (listeners.blur && quill && quill.root) {
                        quill.root.removeEventListener('blur', listeners.blur, true);
                    }
                    this.quillEventListeners.delete(identifier);
                }

                // Remove MutationObserver
                if (this.quillObservers && this.quillObservers.has(identifier)) {
                    const observer = this.quillObservers.get(identifier);
                    observer.disconnect();
                    this.quillObservers.delete(identifier);
                }

                if (quill && quill.root) {
                    quill.root.innerHTML = '';
                }
                this.quillInstances.delete(identifier);
            }
        } else {
            // Clean up all editors
            this.quillInstances.forEach((quill, id) => {
                // Remove event listeners
                if (this.quillEventListeners.has(id)) {
                    const listeners = this.quillEventListeners.get(id);
                    if (listeners.textChange && quill) {
                        quill.off('text-change', listeners.textChange);
                    }
                    if (listeners.editorChange && quill) {
                        quill.off('editor-change', listeners.editorChange);
                    }
                    if (listeners.blur && quill && quill.root) {
                        quill.root.removeEventListener('blur', listeners.blur, true);
                    }
                }

                // Remove MutationObserver
                if (this.quillObservers && this.quillObservers.has(id)) {
                    const observer = this.quillObservers.get(id);
                    observer.disconnect();
                }

                if (quill && quill.root) {
                    quill.root.innerHTML = '';
                }
            });
            this.quillInstances.clear();
            this.quillEventListeners.clear();
            if (this.quillObservers) {
                this.quillObservers.clear();
            }
        }

        // Remove window focus handler if cleaning up all editors
        if (!identifier) {
            this.removeWindowFocusHandler();
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
