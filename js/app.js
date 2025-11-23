/**
 * Demo Application
 * Main application class for the Archival Framework
 */
class DemoApp {
    constructor() {
        this.selectedFlows = [];
        this.createdFlows = [];
        this.selectedMaterials = []; // Initialize selectedMaterials array
        // Media state is now managed by MediaManager
        // Search state is now managed by SearchManager
        // Database operations are now managed by DatabaseManager
        // UI operations are now managed by UIManager
        // Preview operations are now managed by PreviewManager
        this.database = new DatabaseManager();
        this.ui = new UIManager(this);
        this.preview = new PreviewManager(this);

        // Initialize IndexedDB with proper error handling
        this.initDatabase().catch(error => {
            console.error('Database initialization failed:', error);
            // App will continue with fallback mode
        });
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.updateDisplay();
        this.ui.init();

        // Setup placeholder protection against browser extension interference
        this.setupPlaceholderProtection();
    }

    /**
     * Setup placeholder protection against browser extension interference
     */
    setupPlaceholderProtection() {
        // Store original placeholder values
        const originalPlaceholders = new Map();
        const restorationInProgress = new Set();

        // Function to store original placeholder values
        const storeOriginalPlaceholders = () => {
            const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
            inputs.forEach(input => {
                if (input.placeholder && input.placeholder !== 'null') {
                    const key = input.id || input.className || input.tagName;
                    originalPlaceholders.set(key, input.placeholder);
                }
            });
        };

        // Function to restore placeholders (with loop prevention)
        const restorePlaceholders = () => {
            const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
            inputs.forEach(input => {
                const currentPlaceholder = input.getAttribute('placeholder');
                if (currentPlaceholder === 'null') {
                    const key = input.id || input.className || input.tagName;
                    const originalPlaceholder = originalPlaceholders.get(key);

                    if (originalPlaceholder && !restorationInProgress.has(key)) {
                        restorationInProgress.add(key);

                        // Use requestAnimationFrame to avoid conflicts with extensions
                        requestAnimationFrame(() => {
                            input.placeholder = originalPlaceholder;
                            // Remove from restoration set after a delay
                            setTimeout(() => restorationInProgress.delete(key), 100);
                        });
                    }
                }
            });
        };

        // Store original placeholders on page load
        storeOriginalPlaceholders();

        // Debounced restoration function
        let restorationTimeout;
        const debouncedRestore = () => {
            clearTimeout(restorationTimeout);
            restorationTimeout = setTimeout(restorePlaceholders, 50);
        };

        // Monitor for placeholder changes (with throttling)
        const observer = new MutationObserver((mutations) => {
            let shouldRestore = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'placeholder') {
                    const target = mutation.target;
                    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                        const newValue = target.getAttribute('placeholder');
                        if (newValue === 'null') {
                            shouldRestore = true;
                        }
                    }
                }
            });

            if (shouldRestore) {
                debouncedRestore();
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['placeholder'],
            subtree: true
        });

        // Also restore placeholders on ESC key press (defensive)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Store placeholders before extensions can interfere
                storeOriginalPlaceholders();
                debouncedRestore();
            }
        });

        // Additional protection: restore placeholders when they become visible again
        const visibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.target.tagName === 'INPUT' || entry.target.tagName === 'TEXTAREA') {
                    const input = entry.target;
                    if (input.getAttribute('placeholder') === 'null') {
                        const key = input.id || input.className || input.tagName;
                        const originalPlaceholder = originalPlaceholders.get(key);
                        if (originalPlaceholder) {
                            input.placeholder = originalPlaceholder;
                        }
                    }
                }
            });
        });

        // Observe all input and textarea elements
        document.querySelectorAll('input, textarea').forEach(el => {
            visibilityObserver.observe(el);
        });
    }

    /**
     * Initialize IndexedDB for local storage
     */
    async initDatabase() {
        try {
            await this.database.initDatabase();
            // Load flows after database is initialized
            await this.loadFlowsFromStorage();

            // Show database status notification if in fallback mode
            if (this.database.isInFallbackMode()) {
                this.showDatabaseStatusNotification();
            }
        } catch (error) {
            console.error('Database initialization failed, enabling fallback mode:', error);
            // Ensure database is in fallback mode
            this.database.enableFallbackMode();
            // Load any existing flows from fallback storage
            await this.loadFlowsFromStorage();
            this.showDatabaseStatusNotification();
        }
    }

    /**
     * Show database status notification (production mode - silent)
     */
    showDatabaseStatusNotification() {
        // In production, we handle database issues silently
        // The app works normally with localStorage backup
        const storageInfo = this.database.getStorageInfo();
        if (storageInfo.mode === 'fallback') {
        }
    }

    /**
     * Attempt to recover database from fallback mode
     */
    async attemptDatabaseRecovery() {
        try {
            const success = await this.database.attemptRecovery();
            if (success) {
                // Reload flows from the recovered database
                await this.loadFlowsFromStorage();
                this.updateCreatedFlows();
            }
            return success;
        } catch (error) {
            console.error('Error during database recovery:', error);
            // In production, we handle this silently
            return false;
        }
    }

    /**
     * Get database status information
     */
    getDatabaseStatus() {
        return this.database.getDetailedStatus();
    }

    /**
     * Save flows to localStorage (production primary storage)
     */
    saveFlowsToLocalStorage() {
        try {
            const flowsData = JSON.stringify(this.createdFlows);
            localStorage.setItem('flowComposer_flows', flowsData);
        } catch (error) {
            console.error('Error saving flows to localStorage:', error);
        }
    }

    /**
     * Load flows from localStorage (production primary storage)
     */
    loadFlowsFromLocalStorage() {
        try {
            const flowsData = localStorage.getItem('flowComposer_flows');
            if (flowsData) {
                this.createdFlows = JSON.parse(flowsData);
                this.updateCreatedFlows();
                return true;
            }
        } catch (error) {
            console.error('Error loading flows from localStorage:', error);
        }
        return false;
    }

    /**
     * Save flows to IndexedDB or fallback storage
     */
    async saveFlowsToStorage() {
        try {
            await this.database.saveFlowsToStorage(this.createdFlows);
            // Also save to localStorage as backup
            this.saveFlowsToLocalStorage();
        } catch (error) {
            console.error('Error saving flows to storage:', error);
            // Try to save to localStorage as backup
            this.saveFlowsToLocalStorage();
            // In production, we handle this silently - localStorage backup ensures persistence
        }
    }

    /**
     * Load flows from IndexedDB or fallback storage
     */
    async loadFlowsFromStorage() {
        try {
            this.createdFlows = await this.database.loadFlowsFromStorage();
            this.updateCreatedFlows();
        } catch (error) {
            console.error('Error loading flows from storage:', error);
            // Try to load from localStorage backup
            const loadedFromBackup = this.loadFlowsFromLocalStorage();
            if (!loadedFromBackup) {
                // Ensure we have an empty array if loading fails
                this.createdFlows = [];
                this.updateCreatedFlows();
            }
        }
    }


    /**
     * Get import/export manager
     */
    get importExport() {
        return window.importExportManager;
    }

    /**
     * Get modal manager
     */
    get modals() {
        return window.modalManager;
    }

    get dragDrop() {
        return window.dragDropManager;
    }

    get media() {
        return window.mediaManager;
    }

    get materials() {
        return window.materialManager;
    }

    /**
     * Get render manager
     */
    get render() {
        return window.renderManager;
    }

    /**
     * Get search manager
     */
    get search() {
        return window.searchManager;
    }

    // ===== UI DELEGATION METHODS =====
    /**
     * Update display components
     */
    updateDisplay() {
        this.ui.updateDisplay();
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, error, warning)
     */
    showNotification(message, type = 'info') {
        return this.ui.showNotification(message, type);
    }

    /**
     * Clear flow creation form
     */
    clearFlowCreationForm() {
        this.ui.clearFlowCreationForm();
    }

    /**
     * Global cleanup operations
     */
    globalCleanup() {
        this.ui.globalCleanup();
    }

    /**
     * Setup flow creation event listeners
     */
    setupFlowCreationEventListeners() {
        return this.ui.setupFlowCreationEventListeners();
    }

    // ===== PREVIEW DELEGATION METHODS =====
    /**
     * Preview material in the preview panel
     * @param {string} identifier - Material identifier
     */
    async previewMaterial(identifier) {
        return this.preview.previewMaterial(identifier);
    }

    /**
     * Close preview panel
     */
    closePreview() {
        this.preview.closePreview();
    }

    /**
     * Get media icon for material type
     * @param {string} mediaType - Media type
     * @returns {string} Icon HTML
     */
    getMediaIcon(mediaType) {
        return this.preview.getMediaIcon(mediaType);
    }

    /**
     * Toggle description display in material cards
     * @param {string} identifier - Material identifier
     */
    toggleDescription(identifier) {
        this.preview.toggleDescription(identifier);
    }

    /**
     * Toggle description display in preview panel
     * @param {string} identifier - Material identifier
     */
    togglePreviewDescription(identifier) {
        this.preview.togglePreviewDescription(identifier);
    }

    /**
     * Get the correct media type for fullscreen functionality
     * @param {string} materialType - Material type
     * @returns {string} Mapped media type
     */
    getFullscreenMediaType(materialType) {
        // Direct mapping to avoid circular dependency with PreviewManager
        const typeMapping = {
            'movies': 'video',
            'texts': 'document',
            'image': 'image',
            'audio': 'audio',
            'video': 'video'
        };
        return typeMapping[materialType] || materialType;
    }

    /**
     * Handle fullscreen modal close
     */
    handleFullscreenClose() {
        return this.media.handleFullscreenClose();
    }

    /**
     * Preview material in flow context
     * @param {string} identifier - Material identifier
     */
    async previewMaterialInFlow(identifier) {
        return this.preview.previewMaterialInFlow(identifier);
    }

    /**
     * Update selected materials display
     */
    updateSelectedMaterialsDisplay() {
        return this.materials.updateSelectedMaterialsDisplay();
    }











    /**
     * Toggle material selection
     */
    toggleMaterialSelection(identifier) {
        return this.materials.toggleMaterialSelection(identifier);
    }






    /**
     * Clear selected materials
     */
    async clearSelectedMaterials() {
        await this.materials.clearSelectedMaterials();
        this.showNotification('All materials cleared', 'success');
    }

    // ===== SEARCH DELEGATION METHODS =====

    /**
     * Perform search using SearchManager
     */
    async performSearch() {
        return this.search.performSearch();
    }

    /**
     * Display search results using SearchManager
     */
    async displaySearchResults(results) {
        return this.search.displayResults(results);
    }

    /**
     * Render material card using SearchManager
     */
    async renderMaterialCard(material) {
        return this.search.renderMaterialCard(material);
    }

    /**
     * Go to specific page using SearchManager
     */
    async goToPage(page) {
        return this.search.goToPage(page);
    }

    /**
     * Change results per page using SearchManager
     */
    async changeResultsPerPage() {
        return this.search.changeResultsPerPage();
    }

    /**
     * Update search note using SearchManager
     */
    updateSearchNote() {
        return this.search.updateSearchNote();
    }

    // ===== SEARCH STATE DELEGATION =====

    /**
     * Get current page from SearchManager
     */
    get currentPage() {
        return this.search.currentPage;
    }

    /**
     * Set current page in SearchManager
     */
    set currentPage(page) {
        this.search.currentPage = page;
    }

    /**
     * Get results per page from SearchManager
     */
    get resultsPerPage() {
        return this.search.resultsPerPage;
    }

    /**
     * Set results per page in SearchManager
     */
    set resultsPerPage(count) {
        this.search.resultsPerPage = count;
    }

    /**
     * Get search scope from SearchManager
     */
    get searchScope() {
        return this.search.searchScope;
    }

    /**
     * Set search scope in SearchManager
     */
    set searchScope(scope) {
        this.search.searchScope = scope;
    }

    /**
     * Get total results from SearchManager
     */
    get totalResults() {
        return this.search.totalResults;
    }

    /**
     * Set total results in SearchManager
     */
    set totalResults(count) {
        this.search.totalResults = count;
    }

    /**
     * Get current search query from SearchManager
     */
    get currentSearchQuery() {
        return this.search.currentSearchQuery;
    }

    /**
     * Set current search query in SearchManager
     */
    set currentSearchQuery(query) {
        this.search.currentSearchQuery = query;
    }

    /**
     * Get current search filters from SearchManager
     */
    get currentSearchFilters() {
        return this.search.currentSearchFilters;
    }

    /**
     * Set current search filters in SearchManager
     */
    set currentSearchFilters(filters) {
        this.search.currentSearchFilters = filters;
    }

    /**
     * Get loading state from SearchManager
     */
    get isLoading() {
        return this.search.isLoading;
    }

    /**
     * Set loading state in SearchManager
     */
    set isLoading(loading) {
        this.search.isLoading = loading;
    }

    // ===== END SEARCH DELEGATION METHODS =====







    /**
     * Open media in fullscreen
     */
    async openFullscreen(identifier, mediaType, title, imageUrl = null) {
        return this.media.openFullscreen(identifier, mediaType, title, imageUrl);
    }

    /**
     * Preview document in preview panel
     */
    async previewDocument(identifier, title) {
        return this.media.previewDocument(identifier, title);
    }

    /**
     * Preview image in preview panel
     */
    async previewImage(identifier, title) {
        return this.media.previewImage(identifier, title);
    }

    /**
     * Preview item in preview panel (general preview for any item type)
     */
    async previewItem(identifier, title) {
        return this.media.previewItem(identifier, title);
    }

    /**
     * Show flow creation modal
     */
    showFlowCreationModal() {
        return this.modals.showFlowCreationModal();
    }

    /**
     * Hide flow creation modal
     */
    hideFlowCreationModal() {
        return this.modals.hideFlowCreationModal();
    }

    /**
 * Clean up drag artifacts (ghost elements, drop indicators, etc.)
 */
    cleanupDragArtifacts() {
        if (this.dragDrop && typeof this.dragDrop.cleanupDragArtifacts === 'function') {
            return this.dragDrop.cleanupDragArtifacts();
        }
        return null;
    }


    /**
     * Populate materials assignment
     */
    populateMaterialsAssignment() {
        return this.materials.populateMaterialsAssignment();
    }

    /**
     * Update document type coverage display
     */
    updateDocumentTypeCoverage() {
        return this.materials.updateDocumentTypeCoverage();
    }

    /**
     * Create new flow from selected materials (debounced version)
     */
    async createNewFlow() {
        // Prevent multiple rapid clicks
        if (this.isCreatingFlow) {
            return;
        }
        this.isCreatingFlow = true;
        const name = document.getElementById('new-flow-name')?.value?.trim();
        const description = document.getElementById('new-flow-description')?.value?.trim();

        if (!name) {
            this.showNotification('Please enter a flow name', 'error');
            this.isCreatingFlow = false;
            return;
        }

        if (this.materials.getSelectedMaterials().length === 0) {
            this.showNotification('Please select at least one material', 'error');
            this.isCreatingFlow = false;
            return;
        }

        try {
            // Sync all Quill editors to flow objects before saving
            // This ensures all content is captured even if Quill instances are in a bad state
            if (this.materials && typeof this.materials.syncAllQuillEditorsToFlow === 'function') {
                this.materials.syncAllQuillEditorsToFlow();
            }

            const selectedMaterials = this.materials.getSelectedMaterials();

            // Create flow object with complete material data
            const newFlow = {
                id: `flow-${Date.now()}`,
                name,
                description,
                materials: selectedMaterials.map((material, index) => {
                    // Get the complete material data from the API to ensure persistence
                    const completeMaterial = window.internetArchiveAPI.getMaterialByIdentifier(material.identifier);

                    return {
                        ...material,
                        // Store complete material data for persistence
                        completeData: completeMaterial || material,
                        documentType: this.getCurrentMaterialDocumentType(material.identifier),
                        notes: this.getCurrentMaterialNotes(material.identifier),
                        order: index
                    };
                }),
                documentTypes: this.getUniqueDocumentTypes(),
                documentTypeCoverage: this.getDocumentTypeCoverage(),
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: 1,
                status: 'draft'
            };

            // Add to created flows
            this.createdFlows.push(newFlow);

            // Clear selected materials
            await this.materials.clearSelectedMaterials();

            // Hide modal
            this.hideFlowCreationModal();

            // Update display
            this.updateCreatedFlows();

            // Save to local storage
            await this.saveFlowsToStorage();

            // Show success message
            this.showNotification(`Flow "${name}" created successfully!`, 'success');

        } catch (error) {
            console.error('Error creating flow:', error);
            this.showNotification('Error creating flow. Please try again.', 'error');
        } finally {
            // Always reset the flag
            this.isCreatingFlow = false;
        }
    }

    /**
     * Get material document type from assignment form
     */
    getMaterialDocumentType(identifier) {
        return Utils.Material.getDocumentType(identifier);
    }

    /**
     * Get material notes from assignment form
     */
    getMaterialNotes(identifier) {
        return Utils.Material.getNotes(identifier);
    }

    /**
     * Get current material document type from form (for saving)
     */
    getCurrentMaterialDocumentType(identifier) {
        return Utils.Material.getCurrentDocumentType(identifier);
    }

    /**
     * Get current material notes from form (for saving)
     */
    getCurrentMaterialNotes(identifier) {
        return Utils.Material.getCurrentNotes(identifier);
    }

    /**
     * Get material data from API or persisted flow data
     */
    getMaterialData(identifier) {
        return Utils.Material.getData(identifier);
    }

    /**
     * Get unique document types from assigned materials
     */
    getUniqueDocumentTypes() {
        if (window.Utils && window.Utils.DocumentType && window.Utils.DocumentType.getUniqueTypes) {
            return window.Utils.DocumentType.getUniqueTypes();
        }
        // Fallback to default types
        return [
            { id: 'photographic', name: 'photographic', label: 'Photographic Documentation', description: 'Photographic documentation' },
            { id: 'conversational', name: 'conversational', label: 'Conversational Documentation', description: 'Conversations and interviews' },
            { id: 'endangered', name: 'endangered', label: 'Endangered Documents', description: 'Endangered materials' },
            { id: 'academic', name: 'academic', label: 'Academic Documents', description: 'Academic research' },
            { id: 'policy', name: 'policy', label: 'Policy Documents', description: 'Policy documents' },
            { id: 'financial', name: 'financial', label: 'Financial Documents', description: 'Financial records' },
            { id: 'ephemeral', name: 'ephemeral', label: 'Ephemeral Web Documents', description: 'Ephemeral materials' },
            { id: 'institutional', name: 'institutional', label: 'Institutional Documents', description: 'Institutional documents' }
        ];
    }

    /**
     * Get document type coverage
     */
    getDocumentTypeCoverage() {
        return this.materials.getDocumentTypeCoverage();
    }

    /**
     * Get current document type coverage from form (for saving)
     */
    getCurrentDocumentTypeCoverage() {
        return this.materials.getCurrentDocumentTypeCoverage();
    }

    /**
     * Get document type description
     */
    getDocumentTypeDescription(type) {
        return Utils.DocumentType.getDescription(type);
    }

    /**
     * Update created flows display
     */
    async updateCreatedFlows() {
        const section = document.getElementById('created-flows-section');
        const container = document.getElementById('created-flows-container');

        if (!section || !container) return;

        // Synchronize with state manager
        if (window.stateManager) {
            window.stateManager.set('createdFlows', [...this.createdFlows]);
        }

        // Always show the section
        section.style.display = 'block';

        // Get the flows controls (search input)
        const flowsControls = document.querySelector('.flows-controls');
        const searchInput = document.getElementById('flows-search-input');

        if (this.createdFlows.length === 0) {
            // Hide search input when there are no flows
            if (flowsControls) {
                flowsControls.style.display = 'none';
            }
            // Clear search input to prevent stale state
            if (searchInput) {
                searchInput.value = '';
            }

            // Show empty state message
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="layers" class="icon-xl"></i></div>
                    <h3>No Flows Created Yet</h3>
                    <p>To get started, you can either create a new flow from selected archival materials or import an existing flow.</p>
                    <p style="margin-top: var(--spacing-4);">
                        <strong>Create a flow:</strong> Select materials from the search results above and click "Create Flow from Archival Materials".<br>
                        <strong>Import a flow:</strong> Use the "Import Flows" button below to load flows from a JSON file.
                    </p>
                </div>
            `;

            // Replace Feather icons in the empty state
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Update flow selection dropdown (will be empty)
            this.updateFlowSelectionDropdown();
            return;
        }

        // Show search input when there are flows
        if (flowsControls) {
            flowsControls.style.display = 'block';
        }

        container.innerHTML = this.createdFlows.map(flow => this.render.renderCreatedFlowCard(flow)).join('');

        // Replace Feather icons in the created flows
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        // Update flow selection dropdown
        this.updateFlowSelectionDropdown();
    }




    /**
     * Toggle created flow selection
     */
    toggleCreatedFlowSelection(flowId) {
        const isSelected = this.selectedFlows.includes(flowId);
        const flow = this.createdFlows.find(f => f.id === flowId);

        if (isSelected) {
            this.selectedFlows = this.selectedFlows.filter(id => id !== flowId);
            this.showNotification(`Removed: ${flow.name}`, 'info');
        } else {
            this.selectedFlows.push(flowId);
            this.showNotification(`Added: ${flow.name}`, 'success');
        }

        this.updateDisplay();
    }

    /**
     * Show flow details modal
     */
    showFlowDetails(flowId) {
        return this.modals.showFlowDetails(flowId);
    }

    /**
     * Hide flow details modal
     */
    hideFlowDetailsModal() {
        return this.modals.hideFlowDetailsModal();
    }


    /**
     * Edit existing flow
     */
    editFlow(flowId) {
        const flow = this.createdFlows.find(f => f.id === flowId);
        if (!flow) {
            console.error('Flow not found:', flowId);
            return;
        }

        // Close flow details modal if open
        this.hideFlowDetailsModal();

        // Store the flow being edited
        this.editingFlow = flow;

        // Populate the flow creation modal with existing data
        this.populateFlowEditForm(flow);

        // Show the modal in edit mode
        this.showFlowEditModal();
    }

    /**
     * Populate flow edit form with existing data
     */
    populateFlowEditForm(flow) {
        document.getElementById('new-flow-name').value = flow.name || '';
        document.getElementById('new-flow-description').value = flow.description || '';

        // Set selected materials to the flow's materials (remove duplicates)
        // IMPORTANT: Preserve all properties including notes, documentType, order, etc.
        const uniqueMaterials = [];
        const seenIdentifiers = new Set();

        for (const material of flow.materials) {
            if (!seenIdentifiers.has(material.identifier)) {
                seenIdentifiers.add(material.identifier);
                // Create a copy of the material with all its properties preserved
                // This ensures notes, documentType, and other flow-specific data are maintained
                const materialCopy = { ...material };

                // Explicitly preserve notes - only set default if notes is undefined/null, not if it's empty string
                if (material.notes !== undefined && material.notes !== null) {
                    materialCopy.notes = material.notes;
                } else {
                    materialCopy.notes = '';
                }

                // Preserve documentType with default
                materialCopy.documentType = material.documentType || 'policy';

                // Preserve order
                materialCopy.order = material.order !== undefined ? material.order : uniqueMaterials.length;

                uniqueMaterials.push(materialCopy);
            } else {
                console.warn('Duplicate material found in flow:', material.identifier, material.title);
            }
        }

        // Set selected materials
        this.materials.setSelectedMaterials(uniqueMaterials);

        // Create draft state from the flow (this becomes the source of truth during editing)
        if (this.materials && typeof this.materials.createDraft === 'function') {
            this.materials.createDraft(flow);
        }
    }

    /**
     * Show flow edit modal
     */
    showFlowEditModal() {
        return this.modals.showFlowEditModal();
    }

    /**
     * Save flow changes (debounced version)
     */
    async saveFlowChanges() {
        // Prevent multiple rapid clicks
        if (this.isSavingFlow) {
            return;
        }
        this.isSavingFlow = true;
        const name = document.getElementById('new-flow-name')?.value?.trim();
        const description = document.getElementById('new-flow-description')?.value?.trim();

        if (!name) {
            this.showNotification('Please enter a flow name', 'error');
            this.isSavingFlow = false;
            return;
        }

        if (this.materials.getSelectedMaterials().length === 0) {
            this.showNotification('Please select at least one material', 'error');
            this.isSavingFlow = false;
            return;
        }

        try {
            // Sync all Quill editors to draft state before saving
            // This ensures all content is captured even if Quill instances are in a bad state
            if (this.materials && typeof this.materials.syncAllQuillEditorsToFlow === 'function') {
                this.materials.syncAllQuillEditorsToFlow();
            }

            // Also sync document types to draft state
            const selectedMaterials = this.materials.getSelectedMaterials();
            selectedMaterials.forEach((material, index) => {
                const docType = this.getCurrentMaterialDocumentType(material.identifier);
                if (this.materials && typeof this.materials.setDraft === 'function') {
                    this.materials.setDraft(material.identifier, 'documentType', docType);
                    this.materials.setDraft(material.identifier, 'order', index);
                }
            });

            // Apply draft state to the flow object
            let updatedFlow = this.editingFlow;
            if (this.materials && typeof this.materials.applyDraft === 'function') {
                updatedFlow = this.materials.applyDraft(this.editingFlow);
            }

            // Update flow metadata
            updatedFlow = {
                ...updatedFlow,
                name,
                description,
                materials: selectedMaterials.map((material, index) => ({
                    ...material,
                    documentType: this.getCurrentMaterialDocumentType(material.identifier),
                    notes: this.getCurrentMaterialNotes(material.identifier),
                    order: index
                })),
                documentTypes: this.getUniqueDocumentTypes(),
                documentTypeCoverage: this.getCurrentDocumentTypeCoverage(),
                lastModified: new Date().toISOString(),
                version: (this.editingFlow.version || 1) + 1
            };

            // Update the flow in the array
            const index = this.createdFlows.findIndex(f => f.id === this.editingFlow.id);
            if (index !== -1) {
                this.createdFlows[index] = updatedFlow;
            }

            // Clear editing state and draft
            this.editingFlow = null;
            if (this.materials && typeof this.materials.clearDraft === 'function') {
                this.materials.clearDraft();
            }
            await this.materials.clearSelectedMaterials();

            // Hide modal
            this.hideFlowCreationModal();

            // Update display
            this.updateCreatedFlows();

            // Save to local storage
            await this.saveFlowsToStorage();

            // Show success message
            this.showNotification(`Flow "${name}" updated successfully!`, 'success');

        } catch (error) {
            console.error('Error updating flow:', error);
            this.showNotification('Error updating flow. Please try again.', 'error');
        } finally {
            // Always reset the flag
            this.isSavingFlow = false;
        }
    }

    /**
     * Cancel flow editing and restore original state
     */
    cancelFlowEdit() {
        // Clear selected materials - user canceled, so they don't want flow materials in selection
        if (this.materials && typeof this.materials.clearSelectedMaterials === 'function') {
            this.materials.clearSelectedMaterials().catch(console.error);
        }

        // Clear draft state
        if (this.materials && typeof this.materials.clearDraft === 'function') {
            this.materials.clearDraft();
        }

        // Clear editing state
        this.editingFlow = null;

        // Clean up Quill editors
        if (this.materials && typeof this.materials.cleanupQuillEditors === 'function') {
            this.materials.cleanupQuillEditors();
        }
    }

    /**
     * Duplicate existing flow
     */
    duplicateFlow(flowId) {
        const originalFlow = this.createdFlows.find(f => f.id === flowId);
        if (!originalFlow) return;

        // Create a duplicate with new ID and metadata
        const duplicatedFlow = {
            ...originalFlow,
            id: `flow - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: 1,
            status: 'draft'
        };

        // Add to created flows
        this.createdFlows.push(duplicatedFlow);

        // Update display and save to storage
        this.updateCreatedFlows();
        this.saveFlowsToStorage();

        this.showNotification(`Flow "${originalFlow.name}" duplicated successfully!`, 'success');
    }




    /**
     * Setup drag and drop for material reordering
     */
    setupMaterialDragAndDrop() {
        if (this.dragDrop && typeof this.dragDrop.setupMaterialDragAndDrop === 'function') {
            return this.dragDrop.setupMaterialDragAndDrop();
        }
        return null;
    }

    /**
     * Handle drag start
     */
    handleDragStart(event) {
        if (this.dragDrop && typeof this.dragDrop.handleDragStart === 'function') {
            return this.dragDrop.handleDragStart(event);
        }
        return null;
    }

    /**
     * Handle drag over
     */
    handleDragOver(event) {
        if (this.dragDrop && typeof this.dragDrop.handleDragOver === 'function') {
            return this.dragDrop.handleDragOver(event);
        }
        return null;
    }

    /**
     * Handle drop
     */
    handleDrop(event) {
        if (this.dragDrop && typeof this.dragDrop.handleDrop === 'function') {
            return this.dragDrop.handleDrop(event);
        }
        return null;
    }

    /**
     * Handle drag end
     */
    handleDragEnd(event) {
        if (this.dragDrop && typeof this.dragDrop.handleDragEnd === 'function') {
            return this.dragDrop.handleDragEnd(event);
        }
        return null;
    }

    /**
     * Get element after which to insert dragged element
     */
    getDragAfterElement(container, y) {
        if (this.dragDrop && typeof this.dragDrop.getDragAfterElement === 'function') {
            return this.dragDrop.getDragAfterElement(container, y);
        }
        return null;
    }

    /**
     * Update materials order in data model
     */
    updateMaterialsOrder() {
        if (this.dragDrop && typeof this.dragDrop.updateMaterialsOrder === 'function') {
            return this.dragDrop.updateMaterialsOrder();
        }
        return null;
    }

    /**
     * Remove material from flow creation
     */
    removeMaterialFromFlow(identifier) {
        return this.materials.removeMaterialFromFlow(identifier);
    }


    /**
     * Export flow to JSON file
     */
    exportFlow(flowId) {
        return this.importExport.exportFlow(flowId);
    }

    /**
     * Export all flows to JSON file
     */
    exportAllFlows() {
        return this.importExport.exportAllFlows();
    }

    /**
     * Import flows from JSON file
     */
    importFlows() {
        return this.importExport.importFlows();
    }


    /**
     * Search flows by name, description, or material content
     */
    searchFlows(query) {
        const container = document.getElementById('created-flows-container');
        if (!container) return;

        // If there are no flows, don't perform search
        if (this.createdFlows.length === 0) {
            return;
        }

        const searchTerm = query.toLowerCase().trim();
        const flowsToShow = this.createdFlows.filter(flow => {
            // Search in flow metadata
            const flowMatch =
                flow.name.toLowerCase().includes(searchTerm) ||
                flow.description.toLowerCase().includes(searchTerm);

            if (flowMatch) return true;

            // Search in materials
            const materialMatch = flow.materials.some(material =>
                material.title.toLowerCase().includes(searchTerm) ||
                (material.notes && material.notes.toLowerCase().includes(searchTerm)) ||
                (material.creator && material.creator.toLowerCase().includes(searchTerm)) ||
                (material.description && material.description.toLowerCase().includes(searchTerm))
            );

            return materialMatch;
        });

        container.innerHTML = flowsToShow.map(flow => this.render.renderCreatedFlowCard(flow)).join('');

        // Replace Feather icons in the search results
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Get flows by document type coverage
     */
    getFlowsByDocumentType(documentType) {
        const container = document.getElementById('created-flows-container');
        if (!container) return;

        const flowsToShow = this.createdFlows.filter(flow =>
            flow.materials.some(material => material.documentType === documentType)
        );

        container.innerHTML = flowsToShow.map(flow => this.render.renderCreatedFlowCard(flow)).join('');

        // Replace Feather icons in the filtered results
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }


    /**
     * Delete flow with confirmation
     */
    deleteFlow(flowId) {
        const flow = this.createdFlows.find(f => f.id === flowId);
        if (!flow) return;

        const confirmed = confirm(`Are you sure you want to delete the flow "${flow.name}" ? This action cannot be undone.`);

        if (confirmed) {
            // Remove from created flows
            this.createdFlows = this.createdFlows.filter(f => f.id !== flowId);

            // Remove from selected flows if present
            this.selectedFlows = this.selectedFlows.filter(id => id !== flowId);

            // Update display and save to storage
            this.updateCreatedFlows();
            this.saveFlowsToStorage();

            this.showNotification(`Flow "${flow.name}" deleted successfully`, 'success');
        }
    }



    /**
     * Expand flow materials in card
     */
    expandFlowMaterials(flowId) {
        const flow = this.createdFlows.find(f => f.id === flowId);
        if (flow) {
            flow.isExpanded = true;
            this.updateCreatedFlows();
        }
    }

    /**
     * Collapse flow materials in card
     */
    collapseFlowMaterials(flowId) {
        const flow = this.createdFlows.find(f => f.id === flowId);
        if (flow) {
            flow.isExpanded = false;
            this.updateCreatedFlows();
        }
    }

    /**
     * Get document type icon
     */
    getDocumentTypeIcon(documentType) {
        return Utils.DocumentType.getIcon(documentType);
    }

    /**
     * Close flow media preview
     */
    closeFlowMediaPreview() {
        const materialDetailsContent = document.getElementById('flow-preview-content');
        if (materialDetailsContent) {
            materialDetailsContent.innerHTML = `
                <div class="material-details-placeholder">
                    <div class="placeholder-icon"><i data-feather="mouse-pointer" class="icon-xl"></i></div>
                    <h4>Select a Material</h4>
                    <p>Click on any material from the narrative to view detailed information and preview media.</p>
                </div>
            `;

            // Replace Feather icons in the placeholder
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Close flow material preview (for modal cleanup)
     */
    closeFlowMaterialPreview() {
        const materialDetailsContent = document.getElementById('flow-preview-content');
        if (materialDetailsContent) {
            materialDetailsContent.innerHTML = `
                <div class="material-details-placeholder">
                    <div class="placeholder-icon"><i data-feather="mouse-pointer" class="icon-xl"></i></div>
                    <h4>Select a Material</h4>
                    <p>Click on any material from the narrative to view detailed information and preview media.</p>
                </div>
            `;

            // Replace Feather icons in the placeholder
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
        this.currentMediaPlayer = null;
    }

    /**
     * Play media in flow details modal
     */
    async playMediaInFlow(identifier, mediaType, title) {
        return this.media.playMediaInFlow(identifier, mediaType, title);
    }

    /**
     * Preview document in flow details modal
     */
    async previewDocumentInFlow(identifier, title) {
        return this.media.previewDocumentInFlow(identifier, title);
    }

    /**
     * Preview image in flow details modal
     */
    async previewImageInFlow(identifier, title) {
        return this.media.previewImageInFlow(identifier, title);
    }

    /**
     * Preview item in flow details modal (general preview for any item type)
     */
    async previewItemInFlow(identifier, title) {
        return this.media.previewItemInFlow(identifier, title);
    }



    /**
     * Handle material selection in narrative layout
     */
    selectMaterialInNarrative(materialId) {
        return this.materials.selectMaterialInNarrative(materialId);
    }


    /**
     * Get truncated description with consistent length
     */
    getTruncatedDescription(description, maxLength = 500) {
        return Utils.Material.getTruncatedDescription(description, maxLength);
    }

    /**
     * Toggle flow description expand/collapse
     */
    toggleFlowDescription(identifier) {
        const flowPreviewContent = document.querySelector('#flow-preview-content');
        if (!flowPreviewContent) return;

        const truncatedText = flowPreviewContent.querySelector('.description-text.truncated');
        const fullText = flowPreviewContent.querySelector('.description-text.full');
        const showMoreBtn = flowPreviewContent.querySelector('.description-toggle');
        const showLessBtn = flowPreviewContent.querySelector('.description-toggle:last-child');

        if (truncatedText && fullText && showMoreBtn && showLessBtn) {
            if (truncatedText.style.display !== 'none') {
                // Show full description
                truncatedText.style.display = 'none';
                fullText.style.display = 'block';
                showMoreBtn.style.display = 'none';
                showLessBtn.style.display = 'inline-block';
            } else {
                // Show truncated description
                truncatedText.style.display = 'block';
                fullText.style.display = 'none';
                showMoreBtn.style.display = 'inline-block';
                showLessBtn.style.display = 'none';
            }
        }
    }

    /**
     * Toggle flow details description expand/collapse for a specific material item
     */
    toggleFlowDetailsDescription(identifier) {
        const materialItem = document.querySelector(`[data-material-id="${identifier}"]`);
        if (!materialItem) return;

        const descriptionContainer = materialItem.querySelector('.material-description');
        if (!descriptionContainer) return;

        const truncatedText = descriptionContainer.querySelector('.description-text.truncated');
        const fullText = descriptionContainer.querySelector('.description-text.full');
        const toggleButtons = descriptionContainer.querySelectorAll('.description-toggle');
        const showMoreBtn = toggleButtons[0];
        const showLessBtn = toggleButtons[1];

        if (truncatedText && fullText && showMoreBtn && showLessBtn) {
            if (truncatedText.style.display !== 'none') {
                // Show full description
                truncatedText.style.display = 'none';
                fullText.style.display = 'block';
                showMoreBtn.style.display = 'none';
                showLessBtn.style.display = 'inline-block';
            } else {
                // Show truncated description
                truncatedText.style.display = 'block';
                fullText.style.display = 'none';
                showMoreBtn.style.display = 'inline-block';
                showLessBtn.style.display = 'none';
            }
        }
    }

    /**
    * Generate HTML for flow selection section
    */
    getFlowSelectionHTML() {
        // Flow selection is now handled in the main HTML between buttons
        return '';
    }

    /**
    * Update flow selection state (enable/disable button)
    */
    updateFlowSelectionState() {
        const addButton = document.getElementById('add-to-flow-btn');
        const selectElement = document.getElementById('add-to-flow-select');

        if (addButton && selectElement) {
            const hasSelection = selectElement.value !== '';
            const hasMaterials = this.materials.getSelectedMaterials().length > 0;

            addButton.disabled = !hasSelection || !hasMaterials;

            // Show/hide the flow selection section based on whether there are materials selected
            const flowSelectionSection = document.querySelector('.flow-selection-section');
            if (flowSelectionSection) {
                flowSelectionSection.style.display = hasMaterials ? 'flex' : 'none';
            }
        }
    }

    /**
     * Handle flow selection change
     */
    handleFlowSelection(flowId) {
        const addButton = document.getElementById('add-to-flow-btn');
        if (addButton) {
            addButton.disabled = !flowId;
        }

        // Store selected flow ID for later use
        this.selectedFlowId = flowId;
    }

    /**
     * Add selected materials to existing flow (debounced version)
     */
    async addSelectedMaterialsToFlow() {
        // Prevent multiple rapid clicks
        if (this.isAddingMaterials) {
            return;
        }
        this.isAddingMaterials = true;
        const selectedMaterials = this.materials.getSelectedMaterials();
        const flowId = this.selectedFlowId;

        if (!flowId || selectedMaterials.length === 0) {
            this.showNotification('Please select a flow and materials', 'error');
            return;
        }

        const flow = this.createdFlows.find(f => f.id === flowId);
        if (!flow) {
            this.showNotification('Selected flow not found', 'error');
            return;
        }

        try {
            // First, check for duplicates before adding anything
            const duplicateMaterials = [];
            const newMaterials = [];

            for (const material of selectedMaterials) {
                const existingMaterial = flow.materials.find(m => m.identifier === material.identifier);
                if (!existingMaterial) {
                    newMaterials.push(material);
                } else {
                    duplicateMaterials.push(material.title);
                }
            }

            // If there are duplicates, ask user what to do
            if (duplicateMaterials.length > 0) {
                // Always show the specific titles of duplicate items (formatted for readability)
                const duplicateTitles = duplicateMaterials.map(title => `"${this.formatMaterialTitleForDialog(title)}"`).join('\n• ');
                const duplicateMessage = `${duplicateMaterials.length} material${duplicateMaterials.length === 1 ? '' : 's'} already in this flow:\n\n• ${duplicateTitles}`;

                // Ask user if they want to force add duplicates
                const shouldForceAdd = confirm(`${duplicateMessage}\n\nDo you want to add them anyway? (This will create duplicates in the flow)`);

                if (shouldForceAdd) {
                    // Force add all materials including duplicates
                    return this.forceAddMaterialsToFlow(flowId);
                } else {
                    // User cancelled - don't add ANY materials, just show info and let them remove items
                    this.showNotification(`Cancelled adding materials. You can remove duplicate items from your selection if needed.`, 'info');
                    return; // Exit without adding anything or opening edit modal
                }
            }

            // If no new materials to add, don't proceed
            if (newMaterials.length === 0) {
                this.showNotification('No new materials to add to this flow', 'info');
                return;
            }

            // Add new materials to flow (no duplicates)
            for (const material of newMaterials) {
                // Generate flow-specific identifier
                const flowMaterialId = this.generateFlowMaterialId(material.identifier, flow.id);

                // Check if material already exists in flow
                const existingMaterial = flow.materials.find(m => m.identifier === flowMaterialId);
                if (!existingMaterial) {
                    flow.materials.push({
                        identifier: flowMaterialId, // Use flow-specific identifier
                        originalIdentifier: material.identifier, // Keep original for API lookups
                        title: material.title,
                        description: material.description,
                        type: material.type,
                        date: material.date,
                        thumbnail: material.thumbnail,
                        documentType: 'policy', // default
                        notes: '',
                        order: flow.materials.length
                    });
                } else {
                    console.warn('Material already exists in flow:', flowMaterialId, material.title);
                }
            }

            // Show success message
            this.showNotification(`Added ${newMaterials.length} new materials to "${flow.name}"`, 'success');

            // Save and update display
            await this.saveFlowsToStorage();
            this.updateCreatedFlows();

            // Clear selected materials and update UI
            await this.materials.clearSelectedMaterials();

            // Clear flow selection and reset dropdown
            this.selectedFlowId = null;
            const selectElement = document.getElementById('add-to-flow-select');
            if (selectElement) {
                selectElement.value = '';
            }

            // Open edit modal for the flow
            this.editFlow(flowId);

        } catch (error) {
            console.error('Error adding materials to flow:', error);
            this.showNotification('Failed to add materials to flow', 'error');
        } finally {
            // Always reset the flag
            this.isAddingMaterials = false;
        }
    }

    /**
     * Update flow selection dropdown in main HTML
     */
    updateFlowSelectionDropdown() {
        const selectElement = document.getElementById('add-to-flow-select');
        if (selectElement) {
            // Store current selection
            const currentValue = selectElement.value;

            // Update options with material count indicators
            selectElement.innerHTML = `
                <option value="">-- Select a Flow --</option>
                ${this.createdFlows.map(flow => {
                const selectedMaterialIds = this.materials.getSelectedMaterials().map(m => m.identifier);
                const existingCount = flow.materials.filter(m => selectedMaterialIds.includes(m.identifier)).length;
                const newCount = selectedMaterialIds.length - existingCount;

                let label = flow.name;
                if (existingCount > 0 && newCount > 0) {
                    label += ` (${newCount} new, ${existingCount} duplicates)`;
                } else if (existingCount > 0) {
                    label += ` (${existingCount} duplicates)`;
                } else if (newCount > 0) {
                    label += ` (${newCount} new)`;
                }

                return `<option value="${flow.id}" ${flow.id === currentValue ? 'selected' : ''}>${label}</option>`;
            }).join('')}
            `;

            // Update button state
            this.updateFlowSelectionState();
        }
    }

    /**
     * Force add materials to flow (including duplicates)
     */
    async forceAddMaterialsToFlow(flowId) {
        const selectedMaterials = this.materials.getSelectedMaterials();
        const flow = this.createdFlows.find(f => f.id === flowId);

        if (!flowId || selectedMaterials.length === 0) {
            this.showNotification('Please select a flow and materials', 'error');
            return;
        }

        if (!flow) {
            this.showNotification('Selected flow not found', 'error');
            return;
        }

        try {
            // Add all materials to flow (including duplicates)
            for (const material of selectedMaterials) {
                // Generate flow-specific identifier
                const flowMaterialId = this.generateFlowMaterialId(material.identifier, flow.id);

                // For force add, we allow duplicates but give them unique identifiers
                const existingCount = flow.materials.filter(m => m.originalIdentifier === material.identifier).length;
                const duplicateIdentifier = existingCount > 0 ? `${flowMaterialId}_duplicate_${existingCount + 1}` : flowMaterialId;

                flow.materials.push({
                    identifier: duplicateIdentifier, // Use flow-specific identifier
                    originalIdentifier: material.identifier, // Keep original for API lookups
                    title: material.title,
                    description: material.description,
                    type: material.type,
                    date: material.date,
                    thumbnail: material.thumbnail,
                    documentType: 'policy', // default
                    notes: '',
                    order: flow.materials.length
                });
            }

            // Save and update display
            await this.saveFlowsToStorage();
            this.updateCreatedFlows();

            // Show success message
            this.showNotification(`Added ${selectedMaterials.length} materials to "${flow.name}" (including duplicates)`, 'success');

            // Clear selected materials and update UI
            await this.materials.clearSelectedMaterials();

            // Clear flow selection and reset dropdown
            this.selectedFlowId = null;
            const selectElement = document.getElementById('add-to-flow-select');
            if (selectElement) {
                selectElement.value = '';
            }

            // Open edit modal for the flow
            this.editFlow(flowId);

        } catch (error) {
            console.error('Error force adding materials to flow:', error);
            this.showNotification('Failed to add materials to flow', 'error');
        }
    }

    /**
     * Format material title for display in confirmation dialogs
     */
    formatMaterialTitleForDialog(title, maxLength = 60) {
        return Utils.String.formatTitleForDialog(title, maxLength);
    }

    /**
     * Generate a unique material identifier for a specific flow
     */
    generateFlowMaterialId(originalIdentifier, flowId) {
        return Utils.ID.generateFlowMaterialId(originalIdentifier, flowId);
    }

    /**
     * Get the original material identifier from a flow-specific identifier
     */
    getOriginalMaterialId(flowMaterialId) {
        return Utils.ID.getOriginalMaterialId(flowMaterialId);
    }
}



// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Function to initialize when all dependencies are ready
    const initializeApp = () => {
        // Wait for all dependencies to be available
        if (!window.internetArchiveAPI) {
            setTimeout(initializeApp, 100);
            return;
        }

        try {
            window.demoApp = new DemoApp();


        } catch (error) {
            console.error('Error initializing app:', error);
        }
    };

    // Start initialization
    initializeApp();
}); 
