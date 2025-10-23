/**
 * Render Manager
 * Centralized HTML rendering and template management
 */
class RenderManager {
    constructor(demoApp) {
        this.app = demoApp;
    }

    /**
     * Get the app instance
     * @returns {Object|null} The app instance or null if not available
     */
    getAppInstance() {
        return this.app || window.demoApp || null;
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
            console.warn(`RenderManager: Method '${methodName}' not found on demoApp`);
            return null;
        }
    }

    /**
     * Show notification message
     * @param {string} message - Message to display
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        if (window.Utils && window.Utils.Notification) {
            window.Utils.Notification.show(message, type);
        } else {
        }
    }

    // ===== FLOW RENDERING METHODS =====

    /**
     * Render created flow card
     * @param {Object} flow - Flow object
     * @returns {string} HTML string
     */
    renderCreatedFlowCard(flow) {
        const app = this.getAppInstance();
        if (!app) return '';

        const isSelected = app.selectedFlows.includes(flow.id);
        const materialsPreview = flow.materials.slice(0, 3);
        const remainingCount = flow.materials.length - 3;
        const isExpanded = flow.isExpanded || false;

        const statusActions = this.getStatusActions(flow);

        // Determine which materials to show
        const materialsToShow = isExpanded ?
            (flow.materials.length > 10 ? flow.materials.slice(0, 10) : flow.materials) :
            materialsPreview;

        return `
            <div class="created-flow-card ${isSelected ? 'selected' : ''}" data-flow-id="${flow.id}" onclick="demoApp.showFlowDetails('${flow.id}')" style="cursor: pointer;">
                <div class="created-flow-header">
                    <div class="created-flow-info">
                        <div class="flow-title-row">
                            <h3><strong>Title:</strong> ${this.escapeHTML(flow.name)}</h3>
                        </div>
                        <p><strong>Description:</strong> ${this.escapeHTML(flow.description)}</p>
                        <div class="flow-meta">
                            <span class="flow-date">Created: ${this.formatDate(flow.created)}</span>
                        </div>
                    </div>
                </div>
                <div class="created-flow-materials">
                    <h4>Materials (${flow.materials.length})</h4>
                    <div class="created-materials-preview">
                        ${materialsToShow.map(material => `
                            <div class="created-material-preview-item">
                                <div class="created-material-icon">${this.getMediaIcon(material.type)}</div>
                                <div class="created-material-title">${this.escapeHTML(material.title)}</div>
                                <div class="created-material-type">${this.escapeHTML(material.documentType)}</div>
                            </div>
                        `).join('')}
                        ${!isExpanded && remainingCount > 0 ? `
                            <div class="more-created-materials" onclick="event.stopPropagation(); demoApp.expandFlowMaterials('${flow.id}')" style="cursor: pointer;">
                                +${remainingCount} more
                            </div>
                        ` : ''}
                        ${isExpanded && flow.materials.length > 10 ? `
                            <div class="more-created-materials" style="color: var(--gray-600); font-style: italic;">
                                Showing 10 of ${flow.materials.length} materials. View details for full list.
                            </div>
                        ` : ''}
                        ${isExpanded && flow.materials.length <= 10 ? `
                            <div class="more-created-materials" onclick="event.stopPropagation(); demoApp.collapseFlowMaterials('${flow.id}')" style="cursor: pointer; color: var(--primary-color);">
                                Show less
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="created-flow-actions" onclick="event.stopPropagation();">
                    <button class="created-flow-view-btn"
                            onclick="demoApp.showFlowDetails('${flow.id}')">
                        View Details
                    </button>
                    <button class="created-flow-export-btn"
                            onclick="demoApp.exportFlow('${flow.id}')">
                        Export
                    </button>
                    <button class="created-flow-duplicate-btn"
                            onclick="demoApp.duplicateFlow('${flow.id}')">
                        Duplicate
                    </button>
                    ${statusActions}
                </div>
            </div>
        `;
    }

    /**
     * Render flow details content
     * @param {Object} flow - Flow object
     * @returns {string} HTML string
     */
    renderFlowDetails(flow) {
        return `
            <div class="flow-details">
                <!-- Research Narrative Layout -->
                <div class="flow-narrative-layout">
                    <!-- Left: Research Overview & Document Type Analysis -->
                    <div class="flow-overview-panel">
                        <!-- Document Type Coverage Analysis -->
                        <div class="coverage-analysis-section">
                            <h4><i data-feather="bar-chart-2" class="icon-sm"></i> Document Type Coverage</h4>
                            <p class="coverage-description">Analysis of available archival materials by document type</p>
                            <div class="document-type-coverage">
                                ${this.renderDocumentTypeCoverage(flow)}
                            </div>
                        </div>

                        <!-- Archive Gaps Analysis -->
                        <div class="gaps-analysis-section">
                            <h4><i data-feather="search" class="icon-sm"></i> Archive Gaps</h4>
                            <p class="gaps-description">Document types with limited or no available materials</p>
                            <div class="gaps-list">
                                ${this.renderArchiveGaps(flow)}
                            </div>
                        </div>
                    </div>

                    <!-- Center: Materials Timeline/Narrative -->
                    <div class="flow-materials-panel">
                        <div class="materials-narrative-header">
                            <h4><i data-feather="book" class="icon-sm"></i> Archival Narrative</h4>
                            <p class="narrative-description">Materials organized to tell the research story</p>
                        </div>
                        
                        <div class="materials-timeline">
                            ${flow.materials.map((material, index) => `
                                <div class="material-narrative-item" data-material-id="${material.identifier}" onclick="demoApp.selectMaterialInNarrative('${material.identifier}')">
                                    <div class="narrative-item-header">
                                        <div class="narrative-item-number">${index + 1}</div>
                                        <div class="narrative-item-info">
                                            <h5 class="material-title">${this.escapeHTML(material.title)}</h5>
                                            <div class="material-meta">
                                                <span class="material-doc-type-badge">${this.getDocumentTypeIcon(material.documentType)} ${this.escapeHTML(material.documentType)}</span>
                                                <span class="material-media-type-badge">${this.getMediaIcon(material.type)} ${this.escapeHTML(material.type)}</span>
                                            </div>
                                        </div>
                                        <div class="narrative-item-actions">
                                            <button class="btn btn-sm btn-primary" onclick="demoApp.previewMaterialInFlow('${material.identifier}')">
                                                Preview
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="narrative-item-content">
                                        <div class="material-preview-narrative">
                                            ${material.thumbnail ?
                `<img src="${this.escapeHTML(material.thumbnail)}" alt="${this.escapeHTML(material.title)}" onclick="demoApp.previewMaterialInFlow('${material.identifier}')" style="cursor: pointer;">` :
                ''
            }
                                        </div>
                                        
                                        <div class="narrative-item-content-main">
                                            ${material.notes ? `
                                                <div class="research-notes">
                                                    <h6>Research Notes:</h6>
                                                    <p style="white-space: pre-wrap;">${this.escapeHTML(material.notes)}</p>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Right: Material Details & Media Preview -->
                    <div class="flow-details-panel">
                        <div class="material-details-header">
                            <h4><i data-feather="clipboard" class="icon-sm"></i> Material Details</h4>
                        </div>
                        
                        <div class="material-details-content" id="flow-preview-content">
                            <div class="material-details-placeholder">
                                <div class="placeholder-icon"><i data-feather="mouse-pointer" class="icon-xl"></i></div>
                                <h4>Select a Material</h4>
                                <p>Click on any material from the narrative to view detailed information and preview media.</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render document type coverage
     * @param {Object} flow - Flow object
     * @returns {string} HTML string
     */
    renderDocumentTypeCoverage(flow) {
        const app = this.getAppInstance();
        if (!app) return '';

        // Get all possible document types from the system
        const allDocumentTypes = app.getUniqueDocumentTypes();

        // Count materials by document type in this specific flow
        const flowDocumentTypeCounts = {};
        flow.materials.forEach(material => {
            if (material.documentType) {
                flowDocumentTypeCounts[material.documentType] = (flowDocumentTypeCounts[material.documentType] || 0) + 1;
            }
        });

        return allDocumentTypes.map(docType => {
            const count = flowDocumentTypeCounts[docType.name] || 0;
            const hasItems = count > 0;

            return `
                <div class="coverage-badge ${hasItems ? 'has-items' : 'no-items'}" data-doc-type="${docType.name}">
                    <div class="badge-icon">${this.getDocumentTypeIcon(docType.name)}</div>
                    <div class="badge-label">${docType.name.charAt(0).toUpperCase() + docType.name.slice(1)}</div>
                    <div class="badge-count">${count}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render archive gaps analysis
     * @param {Object} flow - Flow object
     * @returns {string} HTML string
     */
    renderArchiveGaps(flow) {
        const app = this.getAppInstance();
        if (!app) return '';

        // Get all available document types from the flow's materials
        const usedDocumentTypes = [...new Set(flow.materials.map(m => m.documentType).filter(Boolean))];

        // Get all possible document types from the system
        const allPossibleDocumentTypes = app.getUniqueDocumentTypes();

        // Find gaps (document types not used in this flow)
        const gaps = allPossibleDocumentTypes.filter(docType => !usedDocumentTypes.includes(docType.name));

        if (gaps.length === 0) {
            return '<p class="no-gaps">All document types have available materials.</p>';
        }

        return gaps.map(docType => `
            <div class="gap-item">
                <div class="gap-icon">${this.getDocumentTypeIcon(docType.name)}</div>
                <div class="gap-info">
                    <h6>${docType.name.charAt(0).toUpperCase() + docType.name.slice(1)}</h6>
                    <p>No materials</p>
                </div>
            </div>
        `).join('');
    }

    /**
     * Get status badge HTML
     * @param {string} status - Flow status
     * @returns {string} HTML string
     */
    getStatusBadge(status) {
        const statusConfig = {
            'draft': { label: 'Draft', class: 'status-draft', icon: '<i data-feather="edit-3" class="icon-sm"></i>' },
            'complete': { label: 'Complete', class: 'status-complete', icon: '<i data-feather="check-circle" class="icon-sm"></i>' },
            'archived': { label: 'Archived', class: 'status-archived', icon: '<i data-feather="package" class="icon-sm"></i>' }
        };

        const config = statusConfig[status] || statusConfig['draft'];
        return `<span class="status-badge ${config.class}">${config.icon} ${config.label}</span>`;
    }

    /**
     * Get status action buttons
     * @param {Object} flow - Flow object
     * @returns {string} HTML string
     */
    getStatusActions(flow) {
        return `
            <button class="created-flow-delete-btn"
                    onclick="demoApp.deleteFlow('${flow.id}')">
                Delete
            </button>
        `;
    }

    // ===== MATERIAL RENDERING METHODS =====

    /**
     * Render material preview
     * @param {Object} material - Material object
     * @returns {string} HTML string
     */
    async renderMaterialPreview(material) {
        const mediaIcon = this.getMediaIcon(material.type);
        const formattedDate = this.formatDate(material.date);
        const fileSize = material.size && window.internetArchiveAPI ?
            window.internetArchiveAPI.formatFileSize(material.size) : '';

        // Check what media capabilities this item actually has
        const mediaInfo = await window.internetArchiveAPI.getMediaInfo(material.identifier);
        const hasVideo = mediaInfo && mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0;
        const hasAudio = mediaInfo && mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0;
        const hasDocuments = mediaInfo && mediaInfo.hasDocuments && mediaInfo.documentFiles.length > 0;

        let previewHTML = `
            <div class="material-preview-detail" data-identifier="${material.identifier}" data-type="${material.type}">
                <div class="material-preview-header">
                    <h3 class="material-preview-title">${this.escapeHTML(material.title)}</h3>
                    <div class="material-preview-meta">
                        <div class="material-preview-meta-item">
                            <span class="material-preview-meta-label">Type:</span>
                            <span>${mediaIcon} ${this.escapeHTML(material.type)}</span>
                        </div>
                        <div class="material-preview-meta-item">
                            <span class="material-preview-meta-label">Date:</span>
                            <span>${this.escapeHTML(formattedDate)}</span>
                        </div>
                        ${material.creator !== 'Unknown' ? `
                            <div class="material-preview-meta-item">
                                <span class="material-preview-meta-label">Creator:</span>
                                <span>${this.escapeHTML(material.creator)}</span>
                            </div>
                        ` : ''}
                        ${fileSize ? `
                            <div class="material-preview-meta-item">
                                <span class="material-preview-meta-label">Size:</span>
                                <span>${this.escapeHTML(fileSize)}</span>
                            </div>
                        ` : ''}
                        <div class="material-preview-meta-item">
                            <span class="material-preview-meta-label">Files:</span>
                            <span>${material.fileCount}</span>
                        </div>
                    </div>
                </div>
        `;

        // Add description if available (with consistent truncation)
        if (material.description) {
            const { text: truncatedDescription, isLong: isDescriptionLong } = this.getTruncatedDescription(material.description);

            previewHTML += `
                <div class="material-preview-description">
                    <div class="description-text ${isDescriptionLong ? 'truncated' : ''}">${this.escapeHTML(truncatedDescription)}</div>
                    ${isDescriptionLong ? `
                        <button class="description-toggle" onclick="demoApp.togglePreviewDescription('${material.identifier}')">
                            Show more
                        </button>
                        <div class="description-text full" style="display: none;">${this.escapeHTML(material.description)}</div>
                        <button class="description-toggle" onclick="demoApp.togglePreviewDescription('${material.identifier}')" style="display: none;">
                            Show less
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // Add integrated media preview embed with loading animation (only for non-data and non-software types)
        if (material.type !== 'data' && material.type !== 'software') {
            previewHTML += `
                <div class="integrated-media-preview">
                    <div class="media-embed-container" id="media-embed-${material.identifier}">
                        <div class="media-loading" id="media-loading-${material.identifier}">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Add preview/play buttons based on actual media capabilities
        const app = this.getAppInstance();
        const isSelected = app && app.materials ? app.materials.isMaterialSelected(material.identifier) : false;

        previewHTML += `
            <div class="material-preview-actions">
                <button class="btn btn-primary" onclick="demoApp.toggleMaterialSelection('${material.identifier}')">
                    <i data-feather="${isSelected ? 'check' : 'plus'}" class="icon-sm"></i> ${isSelected ? 'Selected' : 'Select Material'}
                </button>
                <a href="${material.url}" target="_blank" class="btn btn-secondary">
                    <i data-feather="external-link" class="icon-sm"></i> View on Archive
                </a>
        `;

        // Add Open Fullscreen button with correct media type mapping (only for non-data and non-software types)
        if (material.type !== 'data' && material.type !== 'software') {
            const fullscreenMediaType = this.getFullscreenMediaType(material.type);
            const originalId = material.originalIdentifier || material.identifier;
            previewHTML += `
                <button class="btn btn-secondary" onclick="demoApp.openFullscreen('${originalId}', '${fullscreenMediaType}', '${this.escapeJS(material.title)}')">
                    <i data-feather="search" class="icon-sm"></i> Open Fullscreen
                </button>
            `;
        }

        previewHTML += `
            </div>
        </div>
        `;

        return previewHTML;
    }

    /**
     * Render material card
     * @param {Object} material - Material object
     * @param {string} context - Rendering context
     * @returns {string} HTML string
     */
    renderMaterialCard(material, context = 'search') {
        // Enhanced validation before rendering
        if (!material || typeof material !== 'object' || material === null || material === undefined) {
            console.warn('RenderManager: Invalid material object provided:', material);
            return '<div class="material-card error"><div class="material-content"><h3>Error: Invalid material data</h3></div></div>';
        }

        if (!material.identifier || !material.title || typeof material.identifier !== 'string' || typeof material.title !== 'string') {
            console.warn('RenderManager: Material missing required properties:', material);
            return '<div class="material-card error"><div class="material-content"><h3>Error: Missing material properties</h3></div></div>';
        }

        if (window.Utils && window.Utils.MaterialCard && window.Utils.MaterialCard.createHTML) {
            return window.Utils.MaterialCard.createHTML(material, {
                context: context
            });
        }

        // Fallback implementation if Utils.MaterialCard is not available
        const icon = this.getMediaIcon(material.type);
        const formattedDate = this.formatDate(material.date);
        const isSelected = this.isMaterialSelected(material.identifier);

        return `
            <div class="material-card ${isSelected ? 'selected' : ''}" data-identifier="${material.identifier}" onclick="demoApp.previewMaterial('${material.identifier}')" style="cursor: pointer;">
                <div class="material-content">
                    <h3>${this.escapeHTML(material.title)}</h3>
                    <p>${this.escapeHTML(material.description || 'No description available')}</p>
                    
                    <div class="material-meta">
                        <span>👤 ${this.escapeHTML(material.creator)}</span>
                        <span>📅 ${this.escapeHTML(formattedDate)}</span>
                        <span>${icon} ${this.escapeHTML(material.type)}</span>
                    </div>
                    
                    <div class="material-actions">
                        <button class="material-select-btn ${isSelected ? 'selected' : ''}" 
                                onclick="event.stopPropagation(); demoApp.toggleMaterialSelection('${material.identifier}')">
                            <i data-feather="${isSelected ? 'check' : 'plus'}" class="icon-sm"></i>
                            ${isSelected ? 'Selected' : 'Select'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Check if material is selected
     * @param {string} identifier - Material identifier
     * @returns {boolean} True if selected
     */
    isMaterialSelected(identifier) {
        const app = this.getAppInstance();
        if (app && app.materials && typeof app.materials.isMaterialSelected === 'function') {
            return app.materials.isMaterialSelected(identifier);
        }
        return false; // Default fallback
    }

    // ===== SEARCH RENDERING METHODS =====

    /**
     * Render pagination controls
     * @param {number} totalResults - Total number of results
     * @returns {string} HTML string
     */
    renderPagination(totalResults) {
        const resultsPerPage = parseInt(document.getElementById('demo-results-per-page')?.value || '6');
        const totalPages = Math.ceil(totalResults / resultsPerPage);
        const currentPage = this.getCurrentPage() || 1;

        if (totalPages <= 1) {
            return '';
        }

        let paginationHTML = `
            <div class="pagination">
                <div class="pagination-info">
                    Page ${currentPage} of ${totalPages} (${totalResults} total results)
                </div>
        `;

        // Previous button
        if (currentPage > 1) {
            paginationHTML += `
                <button class="pagination-btn nav-btn" onclick="searchManager.goToPage(${currentPage - 1})">Previous</button>
            `;
        }

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                paginationHTML += `
                    <button class="pagination-btn current-page">${i}</button>
                `;
            } else {
                paginationHTML += `
                    <button class="pagination-btn" onclick="searchManager.goToPage(${i})">${i}</button>
                `;
            }
        }

        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `
                <button class="pagination-btn nav-btn" onclick="searchManager.goToPage(${currentPage + 1})">Next</button>
            `;
        }

        paginationHTML += '</div>';
        return paginationHTML;
    }

    /**
     * Render search results
     * @param {Array} results - Search results array
     * @returns {string} HTML string
     */
    async renderSearchResults(results) {
        if (results.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-feather="search" class="icon-xl"></i></div>
                    <h3>No Results Found</h3>
                    <p>Try adjusting your search terms or filters to find more materials.</p>
                </div>
            `;
        }

        // Render cards asynchronously with enhanced validation
        const cardsHTML = (await Promise.all(
            results
                .filter(item => {
                    // Enhanced validation to prevent undefined materials
                    if (!item || typeof item !== 'object' || item === null || item === undefined) {
                        console.warn('RenderManager: Filtering out invalid material object:', item);
                        return false;
                    }
                    if (!item.identifier || !item.title || typeof item.identifier !== 'string' || typeof item.title !== 'string') {
                        console.warn('RenderManager: Filtering out material missing required properties:', item);
                        return false;
                    }
                    return true;
                })
                .map(async item => {
                    // Additional safety check before rendering - use same validation as filter
                    if (!item || typeof item !== 'object' || item === null || item === undefined) {
                        return '<div class="material-card error"><div class="material-content"><h3>Error: Invalid material data</h3></div></div>';
                    }
                    if (!item.identifier || !item.title || typeof item.identifier !== 'string' || typeof item.title !== 'string') {
                        return '<div class="material-card error"><div class="material-content"><h3>Error: Missing material properties</h3></div></div>';
                    }
                    return await this.renderMaterialCard(item, 'search');
                })
        )).filter(card => card !== null && card !== undefined && card !== '');

        // Get total results from API for proper pagination
        const totalResults = window.internetArchiveAPI ? window.internetArchiveAPI.getTotalResultsCount() : results.length;

        return `
            <div class="search-results-header">
                <h3>Found ${totalResults} results</h3>
                <p>Showing materials from the Internet Archive related to your search.</p>
            </div>
            
            ${this.renderPagination(totalResults)}
            
            <div class="results-grid">
                ${cardsHTML.join('')}
            </div>
            
            ${this.renderPagination(totalResults)}
        `;
    }

    /**
     * Render material modal
     * @param {Object} material - Material object
     * @returns {string} HTML string
     */
    async renderMaterialModal(material) {
        // Check for playable media and document viewer
        const hasPlayableMedia = await window.internetArchiveAPI.hasPlayableMediaSmart(material.identifier, material.type);
        const hasDocumentViewer = await window.internetArchiveAPI.hasDocumentViewer(material.identifier, material.type);
        const playableMediaType = hasPlayableMedia ? await window.internetArchiveAPI.getPlayableMediaType(material.identifier, material.type) : null;

        let actionButtons = `
            <a href="${material.url}" target="_blank" class="btn btn-primary">
                View in Internet Archive
            </a>
        `;

        // Add media play button if available
        if (hasPlayableMedia && playableMediaType) {
            const playIcon = playableMediaType === 'video' ? 'play' : 'volume-2';
            const playText = playableMediaType === 'video' ? 'Play Video' : 'Play Audio';
            actionButtons += `
                <button class="btn btn-primary" onclick="demoApp.playMedia('${material.identifier}', '${playableMediaType}', '${this.escapeJS(material.title)}')">
                    <i data-feather="${playIcon}" class="icon-sm"></i> ${playText}
                </button>
            `;
        }

        // Add document preview button if available
        if (hasDocumentViewer) {
            actionButtons += `
                <button class="btn btn-info" onclick="demoApp.previewDocument('${material.identifier}', '${this.escapeJS(material.title)}')">
                    <i data-feather="file-text" class="icon-sm"></i> Preview Document
                </button>
            `;
        }

        // Only show general preview button if no specific media or document viewers are available
        if (!hasPlayableMedia && !hasDocumentViewer) {
            actionButtons += `
                <button class="btn btn-primary" onclick="demoApp.previewItem('${material.identifier}', '${this.escapeJS(material.title)}')">
                    <i data-feather="search" class="icon-sm"></i> Preview Item
                </button>
            `;
        }

        actionButtons += `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                Close
            </button>
        `;

        const fileSize = material.size && window.internetArchiveAPI ?
            window.internetArchiveAPI.formatFileSize(material.size) : '';

        return `
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>${this.escapeHTML(material.title)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-content">
                        <div class="material-details">
                            <p><strong>Description:</strong> ${this.escapeHTML(material.description || 'No description available')}</p>
                            <p><strong>Creator:</strong> ${this.escapeHTML(material.creator)}</p>
                            <p><strong>Date:</strong> ${this.escapeHTML(this.formatDate(material.date))}</p>
                            <p><strong>Type:</strong> ${this.escapeHTML(material.type)}</p>
                            <p><strong>Language:</strong> ${this.escapeHTML(material.language)}</p>
                            ${fileSize ? `<p><strong>Size:</strong> ${this.escapeHTML(fileSize)}</p>` : ''}
                            <p><strong>Files:</strong> ${material.fileCount}</p>
                        </div>
                        <div class="modal-actions">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== MEDIA RENDERING METHODS =====

    /**
     * Create loading HTML
     * @param {string} message - Loading message
     * @returns {string} HTML string
     */
    createLoadingHTML(message = 'Loading media...') {
        return `
            <div class="media-preview-loading">
                <div class="loading-spinner"></div>
                <p>${this.escapeHTML(message)}</p>
            </div>
        `;
    }

    /**
     * Create error HTML
     * @param {string} message - Error message
     * @returns {string} HTML string
     */
    createErrorHTML(message = 'Error loading media') {
        return `
            <div class="media-preview-error">
                <div class="error-icon"><i data-feather="alert-triangle" class="icon-xl"></i></div>
                <p>${this.escapeHTML(message)}</p>
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.innerHTML = ''">Close</button>
            </div>
        `;
    }

    /**
     * Create iframe HTML
     * @param {string} src - Iframe source
     * @param {string} title - Iframe title
     * @param {Object} options - Iframe options
     * @returns {string} HTML string
     */
    createIframeHTML(src, title, options = {}) {
        const defaultOptions = {
            width: '100%',
            height: '400px',
            frameborder: '0',
            allowfullscreen: true,
            ...options
        };

        const attributes = Object.entries(defaultOptions)
            .map(([key, value]) => `${key}="${this.escapeHTML(value)}"`)
            .join(' ');

        return `<iframe src="${this.escapeHTML(src)}" title="${this.escapeHTML(title)}" ${attributes}></iframe>`;
    }

    /**
     * Create media controls HTML
     * @param {string} identifier - Material identifier
     * @param {string} mediaType - Media type
     * @param {string} title - Media title
     * @param {string} materialType - Material type (to conditionally hide fullscreen button for data types)
     * @returns {string} HTML string
     */
    createMediaControlsHTML(identifier, mediaType, title, materialType = null, originalIdentifier = null) {
        let controlsHTML = `
            <div class="media-player-controls">
        `;

        // Only add Open Fullscreen button for non-data and non-software types
        if (materialType !== 'data' && materialType !== 'software') {
            const fullscreenId = originalIdentifier || identifier;
            controlsHTML += `
                <button class="btn btn-secondary" onclick="demoApp.openFullscreen('${fullscreenId}', '${mediaType}', '${this.escapeJS(title)}')">
                    <i data-feather="search" class="icon-sm"></i> Open Fullscreen
                </button>
            `;
        }

        const archiveId = originalIdentifier || identifier;
        controlsHTML += `
                <a href="https://archive.org/details/${archiveId}" target="_blank" class="btn btn-secondary">
                    <i data-feather="external-link" class="icon-sm"></i> View on Archive
                </a>
            </div>
        `;

        return controlsHTML;
    }

    // ===== UTILITY RENDERING METHODS =====


    /**
     * Create notification HTML
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     * @returns {string} HTML string
     */
    createNotificationHTML(message, type) {
        const typeConfig = {
            'success': { icon: '<i data-feather="check-circle" class="icon-sm"></i>', class: 'notification-success' },
            'error': { icon: '<i data-feather="x-circle" class="icon-sm"></i>', class: 'notification-error' },
            'warning': { icon: '<i data-feather="alert-triangle" class="icon-sm"></i>', class: 'notification-warning' },
            'info': { icon: '<i data-feather="info" class="icon-sm"></i>', class: 'notification-info' }
        };

        const config = typeConfig[type] || typeConfig['info'];

        return `
            <div class="notification ${config.class}" data-type="${type}">
                <div class="notification-icon">${config.icon}</div>
                <div class="notification-content">
                    <span class="notification-message">${this.escapeHTML(message)}</span>
                    <button class="notification-close" onclick="Utils.Notification.hide(this.closest('.notification'))">&times;</button>
                </div>
            </div>
        `;
    }

    // ===== HELPER METHODS =====

    /**
     * Get media icon for material type
     * @param {string} mediaType - Media type
     * @returns {string} Icon HTML
     */
    getMediaIcon(mediaType) {
        const app = this.getAppInstance();
        if (app && typeof app.getMediaIcon === 'function') {
            return app.getMediaIcon(mediaType);
        }
        return '<i data-feather="file-text" class="icon-sm"></i>'; // Default fallback
    }

    /**
     * Get document type icon
     * @param {string} documentType - Document type
     * @returns {string} Icon HTML
     */
    getDocumentTypeIcon(documentType) {
        const app = this.getAppInstance();
        if (app && typeof app.getDocumentTypeIcon === 'function') {
            return app.getDocumentTypeIcon(documentType);
        }
        return '<i data-feather="file-text" class="icon-sm"></i>'; // Default fallback
    }

    /**
     * Escape HTML characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHTML(str) {
        if (window.Utils && window.Utils.String && window.Utils.String.escapeHTML) {
            return window.Utils.String.escapeHTML(str);
        }
        // Fallback escape function
        if (!str) return '';
        // Ensure str is a string before setting textContent
        if (typeof str !== 'string') {
            str = String(str);
        }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Escape string for JavaScript string literals
     * @param {string} str - String to escape
     * @returns {string} JavaScript-safe string
     */
    escapeJS(str) {
        if (!str) return '';
        // Ensure str is a string before calling replace
        if (typeof str !== 'string') {
            str = String(str);
        }
        return str.replace(/['"\\\n\r\t]/g, function (match) {
            const escape = {
                "'": "\\'",
                '"': '\\"',
                '\\': '\\\\',
                '\n': '\\n',
                '\r': '\\r',
                '\t': '\\t'
            };
            return escape[match];
        });
    }

    /**
     * Format date for display
     * @param {string} dateString - Date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        if (window.internetArchiveAPI && typeof window.internetArchiveAPI.formatDate === 'function') {
            return window.internetArchiveAPI.formatDate(dateString);
        }
        return dateString; // Fallback
    }

    /**
     * Get the correct media type for fullscreen functionality
     * @param {string} materialType - Material type
     * @returns {string} Mapped media type
     */
    getFullscreenMediaType(materialType) {
        const app = this.getAppInstance();
        if (app && typeof app.getFullscreenMediaType === 'function') {
            return app.getFullscreenMediaType(materialType);
        }
        // Fallback mapping
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
     * Get truncated description with consistent length
     * @param {string} description - Description text
     * @param {number} maxLength - Maximum length (default: 500)
     * @returns {Object} - { text: string, isLong: boolean }
     */
    getTruncatedDescription(description, maxLength = 500) {
        if (window.Utils && window.Utils.Material && window.Utils.Material.getTruncatedDescription) {
            return window.Utils.Material.getTruncatedDescription(description, maxLength);
        }
        // Fallback implementation
        if (!description || description.length <= maxLength) {
            return { text: description, isLong: false };
        }
        return {
            text: description.substring(0, maxLength) + '...',
            isLong: true
        };
    }

    /**
     * Get current page from search manager
     * @returns {number} Current page number
     */
    getCurrentPage() {
        if (window.searchManager && typeof window.searchManager.currentPage !== 'undefined') {
            return window.searchManager.currentPage;
        }
        return 1; // Default fallback
    }
}

// Initialize and expose globally
window.renderManager = new RenderManager();

// Set up global reference to demoApp when it's available
document.addEventListener('DOMContentLoaded', () => {
    const checkForDemoApp = () => {
        if (window.demoApp) {
            window.renderManager.app = window.demoApp;
        } else {
            setTimeout(checkForDemoApp, 100);
        }
    };
    checkForDemoApp();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RenderManager };
} else {
    window.RenderManager = RenderManager;
}
