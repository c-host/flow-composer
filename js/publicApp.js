/**
 * Public Application
 * Simplified app for public read-only frontend
 */

class PublicApp {
    constructor() {
        this.flows = [];
        this.searchManager = window.publicSearchManager;
        this.publishedFlowLoader = window.publishedFlowLoader;
        this.isLoading = false;
    }

    /**
     * Initialize the public application
     */
    async init() {
        this.isLoading = true;

        // Setup placeholder protection against browser extension interference
        this.setupPlaceholderProtection();

        try {
            // Wait for config to load if configLoader is available
            if (window.configLoader) {
                await window.configLoader.load();
            }

            // Initialize search manager collection from config
            if (this.searchManager && typeof this.searchManager.initializeCollection === 'function') {
                this.searchManager.initializeCollection();
            }

            // Load flows only (fast) - IA items will load on demand
            const flows = await this.publishedFlowLoader.loadAllFlows();

            this.flows = flows;
            this.isLoading = false;

            // Update UI
            this.updateFlowsDisplay();
            this.updateSearchDisplay(); // Will show empty state until user searches/browses
        } catch (error) {
            console.error('[PublicApp] Error initializing:', error);
            this.isLoading = false;
            this.showNotification('Error loading content. Please refresh the page.', 'error');
        }
    }

    /**
     * Setup placeholder protection against browser extension interference
     */
    setupPlaceholderProtection() {
        if (window.Utils && Utils.PlaceholderProtection && typeof Utils.PlaceholderProtection.enable === 'function') {
            this.placeholderProtection = Utils.PlaceholderProtection.enable();
        }
    }

    /**
     * Load IA items on demand (when user searches or browses)
     * Now uses search API to load items from collection
     */
    async loadItemsOnDemand() {
        if (this.searchManager.items.length > 0) {
            return this.searchManager.items;
        }


        // Show loading state
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading archive items from collection...</p>
                </div>
            `;
        }

        // Load all items from collection with progress updates
        const items = await this.searchManager.loadItems((loaded, total) => {
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading archive items... (${loaded}${total > 0 ? ` of ${total}` : ''})</p>
                    </div>
                `;
            }
        });


        // Final update to show all results
        this.updateSearchDisplay();
        return items;
    }

    /**
     * Update flows display
     */
    updateFlowsDisplay(flowsToRender = this.flows) {
        const container = document.getElementById('published-flows-container');
        if (!container) {
            console.warn('[PublicApp] Published flows container not found');
            return;
        }

        const flows = Array.isArray(flowsToRender) ? flowsToRender : [];

        if (flows.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="layers" class="icon-xl"></i></div>
                    <h3>No Published Flows</h3>
                    <p>Published flows will appear here when available.</p>
                </div>
            `;
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            return;
        }

        container.innerHTML = flows.map(flow => this.renderFlowCard(flow)).join('');

        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Search published flows (by name, description, or materials) and update display
     */
    searchFlows(query) {
        const container = document.getElementById('published-flows-container');
        if (!container || !this.publishedFlowLoader) return;

        const searchTerm = (query || '').trim();
        const results = searchTerm
            ? this.publishedFlowLoader.searchFlows(searchTerm)
            : this.publishedFlowLoader.getFlows();

        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="search" class="icon-xl"></i></div>
                    <h3>No Flows Found</h3>
                    <p>Try adjusting your search terms or clearing the search box.</p>
                </div>
            `;
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            return;
        }

        this.updateFlowsDisplay(results);
    }

    /**
     * Render a flow card
     */
    renderFlowCard(flow) {
        const materialsCount = flow.materials ? flow.materials.length : 0;
        const createdDate = flow.created ? new Date(flow.created).toLocaleDateString() : 'Unknown';

        return `
            <div class="created-flow-card" data-flow-id="${flow.id}" onclick="publicApp.showFlowDetails('${flow.id}')" style="cursor: pointer;">
                <div class="created-flow-header">
                    <div class="created-flow-info">
                        <h3>${this.escapeHTML(flow.name || 'Untitled Flow')}</h3>
                        <p>${this.escapeHTML(flow.description || 'No description')}</p>
                        <div class="flow-meta">
                            <span class="flow-date">Published: ${createdDate}</span>
                            <span class="flow-materials-count">${materialsCount} materials</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show flow details
     */
    showFlowDetails(flowId) {
        const flow = this.publishedFlowLoader.getFlowById(flowId);
        if (!flow) {
            this.showNotification('Flow not found', 'error');
            return;
        }

        this.showSimpleFlowModal(flow);
    }

    /**
     * Show simple flow modal (using renderManager for consistency with tool)
     */
    showSimpleFlowModal(flow) {
        const modal = document.getElementById('flow-details-modal');
        if (!modal) {
            console.error('Flow details modal not found');
            return;
        }

        const title = document.getElementById('flow-details-title');
        const content = document.getElementById('flow-details-content');

        if (modal && title && content) {
            // Set the modal title to include all flow information (same as tool)
            title.innerHTML = `
                <div class="flow-modal-title">
                    <div class="flow-title-main">
                        <span class="flow-name"><strong>Title:</strong> ${this.escapeHTML(flow.name || 'Untitled Flow')}</span>
                    </div>
                    <div class="flow-title-meta">
                        <span class="flow-description-short"><strong>Description:</strong> ${this.escapeHTML(flow.description || 'No description')}</span>
                    </div>
                    <div class="flow-date-meta">
                        <span class="flow-date">Created: ${window.renderManager && window.renderManager.formatDate ? window.renderManager.formatDate(flow.created) : (window.internetArchiveAPI && window.internetArchiveAPI.formatDate ? window.internetArchiveAPI.formatDate(flow.created) : new Date(flow.created).toLocaleDateString())}</span>
                    </div>
                </div>
            `;

            // Use renderManager.renderFlowDetails for consistency with tool
            // Render immediately to avoid delay
            if (window.renderManager && window.renderManager.renderFlowDetails) {
                const flowDetailsHTML = window.renderManager.renderFlowDetails(flow);
                content.innerHTML = flowDetailsHTML || '<p>Error loading flow details</p>';

                // Replace Feather icons in the flow details
                if (typeof feather !== 'undefined') {
                    setTimeout(() => {
                        feather.replace();
                    }, 10);
                }

                // Automatically load inline media previews for all materials (same as tool)
                if (window.modalManager && window.modalManager.loadAllInlineMediaPreviews) {
                    setTimeout(() => {
                        window.modalManager.loadAllInlineMediaPreviews(flow);
                    }, 100);
                }

                // Setup document type filter functionality (same as tool)
                if (window.modalManager && window.modalManager.setupDocumentTypeFilters) {
                    setTimeout(() => {
                        window.modalManager.setupDocumentTypeFilters(flow);
                    }, 150);
                }

                // Enhance descriptions asynchronously in the background (non-blocking)
                setTimeout(() => {
                    if (window.renderManager.enhanceFlowDetailsDescriptions) {
                        window.renderManager.enhanceFlowDetailsDescriptions(flow).catch(error => {
                            console.warn('[PublicApp] Error enhancing flow descriptions:', error);
                        });
                    }
                }, 200);
            } else {
                // Fallback to simple rendering
                content.innerHTML = this.renderFlowDetailsFallback(flow);

                // Replace Feather icons in the flow details
                if (typeof feather !== 'undefined') {
                    setTimeout(() => {
                        feather.replace();
                    }, 10);
                }
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
        }
    }

    /**
     * Hide flow details modal
     */
    hideFlowDetailsModal() {
        const modal = document.getElementById('flow-details-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    /**
     * Fallback flow details rendering (if renderManager not available)
     */
    renderFlowDetailsFallback(flow) {
        const materials = flow.materials || [];

        return `
            <div class="flow-details-view">
                <div class="flow-details-header">
                    <h2>${this.escapeHTML(flow.name || 'Untitled Flow')}</h2>
                    <p class="flow-description">${this.escapeHTML(flow.description || 'No description')}</p>
                </div>
                <div class="flow-materials-list">
                    <h3>Materials (${materials.length})</h3>
                    <div class="materials-grid">
                        ${materials.map((material, index) => `
                            <div class="material-card" onclick="publicApp.previewMaterial('${material.identifier}')">
                                <div class="material-icon">${this.getMediaIcon(material.type)}</div>
                                <div class="material-info">
                                    <h4>${this.escapeHTML(material.title || 'Untitled')}</h4>
                                    <p class="material-creator">${this.escapeHTML(material.creator || 'Unknown')}</p>
                                    <p class="material-date">${this.escapeHTML(material.date || 'Unknown date')}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Preview material
     */
    async previewMaterial(identifier, event = null) {
        // Prevent default link behavior if called from a link
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Use preview manager if available (same as tool)
        if (window.previewManager) {
            try {
                await window.previewManager.previewMaterial(identifier);
                // Preview panel is already shown by previewManager
                return;
            } catch (error) {
                console.error('[PublicApp] Error previewing material:', error);
                // Don't fallback to opening Archive page - just log the error
                // The preview panel should still be visible with error message
                return;
            }
        } else {
            console.warn('[PublicApp] PreviewManager not available');
            // Don't open Archive page - this shouldn't happen if previewManager is initialized
            return;
        }
    }

    /**
     * Open fullscreen (for previewManager compatibility)
     */
    async openFullscreen(identifier, mediaType, title, imageUrl = null) {
        if (window.mediaManager) {
            return window.mediaManager.openFullscreen(identifier, mediaType, title, imageUrl);
        }
        // Fallback: open in new tab
        window.open(`https://archive.org/details/${identifier}`, '_blank');
    }

    /**
     * Get unique document types (for renderManager compatibility)
     */
    getUniqueDocumentTypes() {
        if (window.Utils && window.Utils.DocumentType && window.Utils.DocumentType.getUniqueTypes) {
            return window.Utils.DocumentType.getUniqueTypes();
        }
        // Fallback: return standard document types
        return [
            { name: 'photographic', description: 'Photographic documentation' },
            { name: 'conversational', description: 'Conversations and interviews' },
            { name: 'endangered', description: 'Endangered materials' },
            { name: 'academic', description: 'Academic research' },
            { name: 'policy', description: 'Policy documents' },
            { name: 'financial', description: 'Financial records' },
            { name: 'ephemeral', description: 'Ephemeral materials' },
            { name: 'institutional', description: 'Institutional documents' }
        ];
    }

    /**
     * Close preview panel
     */
    closePreview() {
        if (window.previewManager) {
            window.previewManager.closePreview();
        } else {
            // Fallback: clear preview content
            const previewContent = document.getElementById('preview-content');
            if (previewContent) {
                previewContent.innerHTML = `
                    <div class="preview-placeholder">
                        <div class="preview-placeholder-icon"><i data-feather="mouse-pointer" class="icon-xl"></i></div>
                        <h4>Select an Archival Item</h4>
                        <p>Click on any item from the search results to view details.</p>
                    </div>
                `;
            }
            const previewClose = document.getElementById('preview-close');
            if (previewClose) {
                previewClose.style.display = 'none';
            }
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Change results per page
     */
    changeResultsPerPage() {
        const select = document.getElementById('results-per-page');
        if (select) {
            const value = select.value;
            if (value === 'all') {
                this.searchManager.setResultsPerPage(Number.MAX_SAFE_INTEGER);
            } else {
                const count = parseInt(value);
                this.searchManager.setResultsPerPage(count);
            }
            this.updateSearchDisplay();
        }
    }

    /**
     * Change document type filter and update display
     */
    changeDocumentTypeFilter() {
        const select = document.getElementById('document-type-filter');
        if (select) {
            const documentType = select.value;
            // Filter current results by document type
            this.searchManager.currentFilters.documentType = documentType;
            this.searchManager.currentPage = 1; // Reset to first page

            // Apply filter to current items
            if (this.searchManager.items.length > 0) {
                // Filter the items client-side
                let filtered = [...this.searchManager.items];

                if (documentType) {
                    filtered = filtered.filter(item => item.type === documentType);
                }

                this.searchManager.filteredItems = filtered;
                // Update totalResults to reflect filtered count
                this.searchManager.totalResults = filtered.length;

                // If filtering resulted in no results, show helpful message
                if (filtered.length === 0) {
                    this.showNoResultsMessage('No results available for the selected filter. Please change filters or perform a new search.');
                    return;
                }

                this.updateSearchDisplay();
            } else {
                // If no items loaded yet, do nothing - don't trigger search
                // User can select filter first, then click search/browse to get filtered results
                // Silently return - no error message
                return;
            }
        }
    }

    showNoResultsMessage(message) {
        const container = document.getElementById('search-results');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="filter" class="icon-xl"></i></div>
                    <h3>No Results Found</h3>
                    <p>${message}</p>
                </div>
            `;
            // Replace Feather icons
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Update search display
     */
    async updateSearchDisplay() {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (this.searchManager.isLoading) {
            resultsContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading items...</p>
                </div>
            `;
            return;
        }

        // Show empty state if no items loaded and no search performed
        if (this.searchManager.items.length === 0 && !this.searchManager.currentQuery && this.searchManager.filteredItems.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="search" class="icon-xl"></i></div>
                    <h3>Ready to Search</h3>
                    <p>Enter search terms above or click "Browse All" to view all available materials.</p>
                </div>
            `;
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            return;
        }

        // Get paginated results and ensure we're using the correct total
        const totalResults = this.searchManager.getTotalResults();
        const totalPages = this.searchManager.getTotalPages();

        // Ensure current page is valid for filtered results
        if (this.searchManager.currentPage > totalPages && totalPages > 0) {
            this.searchManager.currentPage = totalPages;
        }

        const results = this.searchManager.getPaginatedResults();

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="search" class="icon-xl"></i></div>
                    <h3>No Results Found</h3>
                    <p>Try adjusting your search terms or filters.</p>
                </div>
            `;
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            return;
        }

        // Use renderManager for consistent rendering (same as tool, but without select button)
        if (window.renderManager && window.renderManager.renderMaterialCard) {
            const cardsHTML = await Promise.all(
                results.map(async item => {
                    try {
                        return await window.renderManager.renderMaterialCard(item, 'public');
                    } catch (error) {
                        console.error('[PublicApp] Error rendering material card:', error, item);
                        return this.renderMaterialCard(item); // Fallback
                    }
                })
            );

            resultsContainer.innerHTML = `
                <div class="search-results-header">
                    <p>Showing ${results.length} of ${totalResults} items</p>
                </div>
                ${this.renderPagination('top')}
                <div class="results-grid">
                    ${cardsHTML.join('')}
                </div>
                ${this.renderPagination('bottom')}
            `;
        } else {
            // Fallback to custom rendering
            resultsContainer.innerHTML = `
                <div class="search-results-header">
                    <p>Showing ${results.length} of ${totalResults} items</p>
                </div>
                ${this.renderPagination('top')}
                <div class="results-grid">
                    ${results.map(item => this.renderMaterialCard(item)).join('')}
                </div>
                ${this.renderPagination('bottom')}
            `;
        }

        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Render material card
     */
    renderMaterialCard(material) {
        return `
            <div class="material-card" onclick="event.preventDefault(); event.stopPropagation(); publicApp.previewMaterial('${material.identifier}', event)" style="cursor: pointer;">
                <div class="material-thumbnail">
                    ${material.thumbnail ?
                `<img src="${material.thumbnail}" alt="${this.escapeHTML(material.title)}" />` :
                `<div class="material-icon-large">${this.getMediaIcon(material.type)}</div>`
            }
                </div>
                <div class="material-info">
                    <h4>${this.escapeHTML(material.title || 'Untitled')}</h4>
                    <p class="material-creator">${this.escapeHTML(material.creator || 'Unknown')}</p>
                    <p class="material-date">${this.escapeHTML(material.date || 'Unknown date')}</p>
                    ${material.description ? `<p class="material-description">${this.escapeHTML(material.description.substring(0, 100))}${material.description.length > 100 ? '...' : ''}</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render pagination
     * @param {string} position - Position of pagination ('top' or 'bottom')
     */
    renderPagination(position = 'top') {
        const totalPages = this.searchManager.getTotalPages();
        const currentPage = this.searchManager.currentPage;

        if (totalPages <= 1) return '';

        // Show 3 pages (currentPage - 1 to currentPage + 1) plus first and last pages
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                pages.push(i);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                pages.push('...');
            }
        }

        // Escape position for use in onclick handler
        const positionParam = position === 'bottom' ? "'bottom'" : "'top'";

        return `
            <div class="pagination">
                <button class="btn btn-outline" ${currentPage === 1 ? 'disabled' : ''} onclick="publicApp.goToPage(${currentPage - 1}, ${positionParam})">
                    Previous
                </button>
                <div class="pagination-pages">
                    ${pages.map(page =>
            page === '...' ? '<span>...</span>' :
                `<button class="btn ${page === currentPage ? 'btn-primary' : 'btn-outline'}" onclick="publicApp.goToPage(${page}, ${positionParam})">${page}</button>`
        ).join('')}
                </div>
                <button class="btn btn-outline" ${currentPage === totalPages ? 'disabled' : ''} onclick="publicApp.goToPage(${currentPage + 1}, ${positionParam})">
                    Next
                </button>
            </div>
        `;
    }

    /**
     * Perform search
     */
    async performSearch() {
        const queryInput = document.getElementById('search-query');
        const documentTypeSelect = document.getElementById('document-type-filter');

        const query = queryInput ? queryInput.value.trim() : '';
        const documentType = documentTypeSelect ? documentTypeSelect.value : '';

        // Show loading state
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Searching collection...</p>
                </div>
            `;
        }

        // Perform search using API - don't pass documentType to API, apply it client-side
        await this.searchManager.search(query, {}, (loaded, total) => {
            if (resultsContainer && total > 0) {
                resultsContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Searching collection... (${loaded} of ${total} results)</p>
                    </div>
                `;
            }
        });

        // Apply document type filter client-side if one is selected
        if (documentType) {
            this.searchManager.currentFilters.documentType = documentType;
            // Filter the items client-side
            if (this.searchManager.items.length > 0) {
                this.searchManager.filteredItems = this.searchManager.items.filter(item => item.type === documentType);
                this.searchManager.totalResults = this.searchManager.filteredItems.length;
                this.searchManager.currentPage = 1; // Reset to first page
            }
        } else {
            // Clear filter
            this.searchManager.currentFilters.documentType = '';
            this.searchManager.filteredItems = [...this.searchManager.items];
            this.searchManager.totalResults = this.searchManager.items.length;
        }

        this.updateSearchDisplay();
    }

    /**
     * Browse all items
     */
    async browseAllItems() {
        // Clear search query
        const queryInput = document.getElementById('search-query');
        if (queryInput) {
            queryInput.value = '';
        }

        // Show loading state
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading all items from collection...</p>
                </div>
            `;
        }

        // Get current document type filter if one is selected
        const documentTypeSelect = document.getElementById('document-type-filter');
        const documentType = documentTypeSelect ? documentTypeSelect.value : '';

        // Browse all items from collection using API
        // Pass document type filter so it's applied after fetching all results
        await this.searchManager.browseAll((loaded, total) => {
            if (resultsContainer && total > 0) {
                resultsContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading items... (${loaded} of ${total})</p>
                    </div>
                `;
            }
        }, documentType ? { documentType } : {});

        // Apply document type filter if one is selected (browseAll already applies it, but ensure display is updated)
        if (documentType && this.searchManager.filteredItems.length === 0) {
            this.showNoResultsMessage('No results available for the selected filter. Please change filters or perform a new search.');
            return;
        }

        this.updateSearchDisplay();
    }

    /**
     * Go to page
     * @param {number} page - Page number to navigate to
     * @param {string} position - Position of pagination button ('top' or 'bottom')
     */
    goToPage(page, position = 'top') {
        this.searchManager.goToPage(page);
        this.updateSearchDisplay();

        // Only scroll if pagination button was clicked from bottom
        if (position === 'bottom') {
            // Wait for DOM to update before calculating scroll position
            requestAnimationFrame(() => {
                const layout = document.querySelector('.search-preview-layout');
                if (layout) {
                    // Get navigation element height for offset
                    const nav = document.querySelector('.navigation');
                    const navHeight = nav ? nav.offsetHeight : 64; // Default to 64px if not found

                    // Calculate scroll position: target element position minus nav height
                    const layoutRect = layout.getBoundingClientRect();
                    const currentScrollY = window.scrollY || window.pageYOffset;
                    const targetScrollY = currentScrollY + layoutRect.top - navHeight;

                    window.scrollTo({
                        top: targetScrollY,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }

    /**
     * Get media icon
     */
    getMediaIcon(type) {
        const icons = {
            'texts': '<i data-feather="file-text" class="icon-sm"></i>',
            'image': '<i data-feather="image" class="icon-sm"></i>',
            'audio': '<i data-feather="music" class="icon-sm"></i>',
            'video': '<i data-feather="video" class="icon-sm"></i>',
            'movies': '<i data-feather="video" class="icon-sm"></i>',
            'movie': '<i data-feather="video" class="icon-sm"></i>'
        };
        return icons[type] || '<i data-feather="file" class="icon-sm"></i>';
    }

    /**
     * Escape HTML
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.Utils && window.Utils.Notification) {
            window.Utils.Notification.show(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * Handle fullscreen modal close
     */
    handleFullscreenClose() {
        if (window.mediaManager && window.mediaManager.handleFullscreenClose) {
            return window.mediaManager.handleFullscreenClose();
        }
        return null;
    }

    /**
     * Toggle preview description expand/collapse
     */
    togglePreviewDescription(identifier) {
        if (window.previewManager && window.previewManager.togglePreviewDescription) {
            return window.previewManager.togglePreviewDescription(identifier);
        }
        return null;
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.publicApp = new PublicApp();

    // Initialize previewManager for public frontend (needs minimal app-like object)
    if (window.PreviewManager && !window.previewManager) {
        // Create minimal app object for previewManager
        const minimalApp = {
            openFullscreen: async (identifier, mediaType, title, imageUrl) => {
                if (window.mediaManager) {
                    return window.mediaManager.openFullscreen(identifier, mediaType, title, imageUrl);
                }
                // Fallback: open in new tab
                window.open(`https://archive.org/details/${identifier}`, '_blank');
            },
            materials: {
                updatePreviewPanelSelectButton: () => { } // No-op for public
            },
            media: {
                stopCurrentMedia: () => { },
                pausePreviewMedia: () => { },
                setFullscreenPlaybackPosition: () => { },
                handleFullscreenClose: () => {
                    if (window.mediaManager && window.mediaManager.handleFullscreenClose) {
                        return window.mediaManager.handleFullscreenClose();
                    }
                },
                closeMediaPreview: () => { }
            },
            createdFlows: []
        };
        window.previewManager = new window.PreviewManager(minimalApp);
    }

    window.publicApp.init()
        .then(() => {
            if (window.publicApp && typeof window.publicApp.browseAllItems === 'function') {
                return window.publicApp.browseAllItems();
            }
        })
        .catch(error => {
            console.error('[PublicApp] Initialization failed:', error);
        });
});
