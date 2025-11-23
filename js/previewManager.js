/**
 * Preview Manager
 * Handles material preview, display logic, and media handling
 */
class PreviewManager {
    constructor(demoApp) {
        this.app = demoApp;
        this.currentPreview = null;
    }

    /**
     * Preview a material by identifier
     * @param {string} identifier - Material identifier
     */
    async previewMaterial(identifier) {
        // Try to get material from search results first for immediate display
        let material = null;
        if (window.publicSearchManager) {
            const items = window.publicSearchManager.items || [];
            material = items.find(item => item.identifier === identifier);
        }

        // Fallback to internetArchiveAPI
        if (!material && window.internetArchiveAPI) {
            material = window.internetArchiveAPI.getMaterialByIdentifier(identifier);
        }

        // If we have material, show it immediately, then enhance and render full preview
        if (material) {
            this.showPreviewImmediate(material, identifier);
            // Note: Description enhancement happens inside showPreviewImmediate when full preview loads
            return;
        }

        // If no material found, fetch from metadata endpoint (fallback)
        try {
            const response = await fetch(`https://archive.org/metadata/${identifier}`);
            if (response.ok) {
                const data = await response.json();
                if (data.metadata) {
                    // Normalize description (handle arrays from Internet Archive API)
                    const normalizeDescription = (desc) => {
                        if (!desc) return '';
                        if (Array.isArray(desc)) {
                            return desc.filter(item => item != null).join('\n');
                        }
                        return typeof desc === 'string' ? desc : String(desc);
                    };

                    material = {
                        identifier: data.metadata.identifier,
                        title: data.metadata.title || 'Untitled',
                        description: normalizeDescription(data.metadata.description || data.metadata.summary || ''),
                        creator: data.metadata.creator || 'Unknown',
                        date: data.metadata.date || data.metadata.publicdate || 'Unknown date',
                        type: data.metadata.mediatype || 'unknown',
                        url: `https://archive.org/details/${data.metadata.identifier}`,
                        thumbnail: data.metadata.thumbnail || null,
                        metadata: data.metadata
                    };

                    this.showPreviewImmediate(material, identifier);
                    return;
                }
            }
        } catch (error) {
            console.error('[PreviewManager] Error fetching from metadata endpoint:', error);
        }

        if (!material) {
            console.error('[PreviewManager] Material not found for identifier:', identifier);
            return;
        }
    }

    /**
     * Show preview immediately with existing material data
     * @param {Object} material - Material object
     * @param {string} identifier - Material identifier
     */
    showPreviewImmediate(material, identifier) {
        // Stop any current media
        this.stopCurrentMedia();

        // Update current preview
        this.currentPreview = identifier;

        // Show preview panel
        const previewPanel = Utils.DOM.getElement('#preview-panel');
        const previewContent = Utils.DOM.getElement('#preview-content');
        const previewClose = Utils.DOM.getElement('#preview-close');

        if (!previewPanel || !previewContent) {
            console.error('[PreviewManager] Preview panel elements not found');
            throw new Error('Preview panel not available');
        }

        if (previewPanel && previewContent && previewClose) {
            previewClose.style.display = 'block';

            // Render preview content immediately (no loading state to avoid delay)
            if (!window.renderManager) {
                console.error('[PreviewManager] renderManager not available');
                previewContent.innerHTML = `
                    <div class="error-state">
                        <p>Error: Render manager not available. Please refresh the page.</p>
                    </div>
                `;
                return;
            }

            // Show basic preview immediately with correct order:
            // 1. Metadata (Title, Date, Creator, Size)
            // 2. iframe embed div
            // 3. Action buttons
            // 4. Unformatted description text (will be formatted asynchronously)
            const { text: truncatedDescription } = window.renderManager.getTruncatedDescription(material.description || '');
            const fileSize = material.size && window.internetArchiveAPI ?
                window.internetArchiveAPI.formatFileSize(material.size) : '';
            const mediaIcon = window.renderManager.getMediaIcon(material.type);

            const basicPreview = `
                <div class="material-preview-detail" data-identifier="${material.identifier}" data-type="${material.type}">
                    <div class="material-preview-header">
                        <h3 class="material-preview-title">${window.renderManager.escapeHTML(material.title)}</h3>
                        <div class="material-preview-meta">
                            <div class="material-preview-meta-item">
                                <span class="material-preview-meta-label">Type:</span>
                                <span>${mediaIcon} ${window.renderManager.escapeHTML(material.type)}</span>
                            </div>
                            <div class="material-preview-meta-item">
                                <span class="material-preview-meta-label">Date:</span>
                                <span>${window.renderManager.escapeHTML(window.renderManager.formatDate(material.date))}</span>
                            </div>
                            ${material.creator !== 'Unknown' ? `
                                <div class="material-preview-meta-item">
                                    <span class="material-preview-meta-label">Creator:</span>
                                    <span>${window.renderManager.escapeHTML(material.creator)}</span>
                                </div>
                            ` : ''}
                            ${fileSize ? `
                                <div class="material-preview-meta-item">
                                    <span class="material-preview-meta-label">Size:</span>
                                    <span>${window.renderManager.escapeHTML(fileSize)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ${material.type !== 'data' && material.type !== 'software' ? `
                        <div class="integrated-media-preview">
                            <div class="media-embed-container" id="media-embed-${material.identifier}">
                                <div class="media-loading" id="media-loading-${material.identifier}">
                                    <div class="loading-spinner"></div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="material-preview-actions">
                        <a href="https://archive.org/details/${material.identifier}" target="_blank" class="btn btn-secondary">
                            <i data-feather="external-link" class="icon-sm"></i> View on Archive
                        </a>
                        ${material.type !== 'data' && material.type !== 'software' ? `
                            <button class="btn btn-secondary" onclick="(window.demoApp || window.publicApp).openFullscreen('${material.identifier}', '${this.getFullscreenMediaType(material.type)}', '${window.renderManager.escapeJS(material.title)}')">
                                <i data-feather="search" class="icon-sm"></i> Open Fullscreen
                            </button>
                        ` : ''}
                    </div>
                    ${material.description ? `
                        <div class="material-preview-description">
                            <div class="description-text">${window.renderManager.escapeHTML(truncatedDescription)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
            previewContent.innerHTML = basicPreview;

            // Replace Feather icons immediately
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Load iframe immediately so it can start loading while text formatting happens
            if (material.type !== 'data' && material.type !== 'software') {
                this.loadMediaPreview(identifier, material);
            }

            // Replace Feather icons immediately
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Enhance description and update only the description section (preserve everything else)
            // This happens asynchronously while the iframe is already loading
            this.enhanceMaterialDescription(identifier, material).then(enhancedMaterial => {
                // Only update if preview panel is still showing this material
                if (this.currentPreview !== identifier || !previewContent) {
                    return;
                }

                const finalMaterial = enhancedMaterial || material;

                // Update only the description section with formatted text
                const descriptionContainer = previewContent.querySelector('.material-preview-description');
                if (descriptionContainer && finalMaterial.description) {
                    const { text: truncatedDescription, isLong: isDescriptionLong } = window.renderManager.getTruncatedDescription(finalMaterial.description);

                    descriptionContainer.innerHTML = `
                        <div class="description-text ${isDescriptionLong ? 'truncated' : ''}">${window.renderManager.escapeHTMLWithLineBreaks(truncatedDescription)}</div>
                        ${isDescriptionLong ? `
                            <button class="description-toggle" onclick="(window.demoApp || window.publicApp).togglePreviewDescription('${material.identifier}')">
                                Show more
                            </button>
                            <div class="description-text full" style="display: none;">${window.renderManager.escapeHTMLWithLineBreaks(finalMaterial.description)}</div>
                            <button class="description-toggle" onclick="(window.demoApp || window.publicApp).togglePreviewDescription('${material.identifier}')" style="display: none;">
                                Show less
                            </button>
                        ` : ''}
                    `;

                    // Replace Feather icons after description update
                    if (typeof feather !== 'undefined') {
                        feather.replace();
                    }
                }
            }).catch(error => {
                console.warn('[PreviewManager] Error enhancing description:', error);
            });

            // Update the preview panel select button to reflect current selection state (only for backend tool)
            if (this.app && this.app.materials && this.app.materials.updatePreviewPanelSelectButton) {
                this.app.materials.updatePreviewPanelSelectButton(identifier);
            }
        }
    }

    /**
     * Enhance material description from metadata endpoint
     * Returns enhanced material object with formatted description, or null if enhancement fails
     * @param {string} identifier - Material identifier
     * @param {Object} currentMaterial - Current material object
     * @returns {Promise<Object|null>} Enhanced material object or null
     */
    async enhanceMaterialDescription(identifier, currentMaterial) {
        try {
            const response = await fetch(`https://archive.org/metadata/${identifier}`);
            if (response.ok) {
                const data = await response.json();
                if (data.metadata) {
                    // Normalize description (handle arrays from Internet Archive API)
                    const normalizeDescription = (desc) => {
                        if (!desc) return '';
                        if (Array.isArray(desc)) {
                            return desc.filter(item => item != null).join('\n');
                        }
                        return typeof desc === 'string' ? desc : String(desc);
                    };

                    const enhancedDescription = normalizeDescription(data.metadata.description || data.metadata.summary || '');

                    // Return enhanced material if description has changed
                    if (enhancedDescription && enhancedDescription !== currentMaterial.description) {
                        return {
                            ...currentMaterial,
                            description: enhancedDescription
                        };
                    }
                }
            }
        } catch (error) {
            console.warn('[PreviewManager] Error enhancing material description:', error);
        }

        // Return null if enhancement failed or description unchanged
        return null;
    }

    /**
     * Get the correct media type for fullscreen functionality
     * @param {string} materialType - Material type
     * @returns {string} Mapped media type
     */
    getFullscreenMediaType(materialType) {
        const mediaTypeMap = {
            'movies': 'video',
            'texts': 'document',
            'audio': 'audio',
            'image': 'image'
        };
        return mediaTypeMap[materialType] || materialType;
    }

    /**
     * Load media preview for a material
     * @param {string} identifier - Material identifier
     * @param {Object} material - Material object
     */
    async loadMediaPreview(identifier, material) {
        const mediaContainer = document.getElementById(`media-embed-${identifier}`);
        const loadingElement = document.getElementById(`media-loading-${identifier}`);

        if (!mediaContainer || !loadingElement) {
            console.warn('Media container or loading element not found for:', identifier);
            return;
        }

        // Ensure loading state is visible and container is positioned
        mediaContainer.style.position = 'relative';
        loadingElement.style.display = 'flex';
        loadingElement.style.alignItems = 'center';
        loadingElement.style.justifyContent = 'center';
        loadingElement.style.zIndex = '2';
        loadingElement.style.position = 'absolute';
        loadingElement.style.top = '0';
        loadingElement.style.left = '0';
        loadingElement.style.width = '100%';

        // Set appropriate height based on material type
        if (material.type === 'audio') {
            loadingElement.style.height = '30px';
            loadingElement.style.fontSize = '12px';
            // Use smaller spinner for audio
            loadingElement.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid var(--gray-200); border-top: 2px solid var(--primary-color); margin: 0;"></div>';
        } else {
            loadingElement.style.height = '300px';
        }

        try {
            // Get media info to determine the best preview method
            const mediaInfo = material.cachedMediaInfo || {};
            const hasPlayableMedia = mediaInfo.hasPlayableMedia || Utils.Material.hasPlayableMedia(material.type);
            const playableMediaType = mediaInfo.playableMediaType || Utils.Material.getPlayableMediaType(material.type);
            const hasDocumentViewer = mediaInfo.hasDocumentViewer || Utils.Material.hasDocumentViewer(material.type);


            let embedHTML = '';

            // Determine the best preview method based on material type and capabilities
            if (hasPlayableMedia && playableMediaType) {
                // Use Internet Archive embed for playable media with parameters to minimize title overlay
                embedHTML = `
                    <iframe 
                        src="https://archive.org/embed/${identifier}?ui=embed&wrapper=false" 
                        width="100%" 
                        height="100%" 
                        frameborder="0"
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true" 
                        allowfullscreen
                        onerror="this.style.display='none'; document.getElementById('media-loading-${identifier}').innerHTML='<div class=\"loading-spinner\"></div>';">
                    </iframe>
                `;
            } else if (hasDocumentViewer || material.type === 'texts') {
                // Use Internet Archive embed for documents
                embedHTML = `
                    <iframe 
                        src="https://archive.org/embed/${identifier}" 
                        width="100%" 
                        height="100%" 
                        frameborder="0"
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true" 
                        allowfullscreen
                        onerror="this.style.display='none'; document.getElementById('media-loading-${identifier}').innerHTML='<div class=\"loading-spinner\"></div>';">
                    </iframe>
                `;
            } else if (material.type === 'image') {
                // Use Internet Archive embed for images with parameters to minimize title overlay
                embedHTML = `
                    <iframe 
                        src="https://archive.org/embed/${identifier}?ui=embed&wrapper=false" 
                        width="100%" 
                        height="100%" 
                        frameborder="0"
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true" 
                        allowfullscreen
                        onerror="this.style.display='none'; document.getElementById('media-loading-${identifier}').innerHTML='<div class=\"loading-spinner\"></div>';">
                    </iframe>
                `;
            } else {
                // Fallback for unsupported media types
                embedHTML = `
                    <div class="media-fallback">
                        <p>Preview not available for this media type</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Archive
                        </a>
                    </div>
                `;
            }

            // Create iframe element and append it while keeping loading state
            const iframeContainer = document.createElement('div');
            iframeContainer.innerHTML = embedHTML;
            const iframe = iframeContainer.querySelector('iframe');

            if (iframe) {
                // Position iframe behind loading state
                iframe.style.position = 'absolute';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.zIndex = '1';

                // Set appropriate height for audio materials
                if (material.type === 'audio') {
                    iframe.style.height = '30px';
                }

                // Add iframe to container
                mediaContainer.appendChild(iframe);

                // Track loading state and timeout message
                let timeoutMessageShown = false;
                const timeoutThreshold = 10000; // 10 seconds
                let loadTimeoutId = null;

                // Show timeout message after threshold
                loadTimeoutId = setTimeout(() => {
                    if (loadingElement && loadingElement.style.display !== 'none' && !timeoutMessageShown) {
                        timeoutMessageShown = true;
                        const spinner = loadingElement.querySelector('.loading-spinner');
                        if (spinner) {
                            const timeoutMessage = document.createElement('div');
                            timeoutMessage.className = 'loading-timeout-message';
                            timeoutMessage.style.cssText = 'margin-top: 1rem; text-align: center; font-size: 0.875rem; color: var(--text-secondary); max-width: 400px;';
                            timeoutMessage.innerHTML = `
                                <p style="margin: 0.5rem 0;">This resource is taking longer than expected to load from the Internet Archive.</p>
                                <p style="margin: 0.5rem 0;">It will eventually load. For immediate access, <a href="https://archive.org/details/${identifier}" target="_blank" style="color: var(--primary-color); text-decoration: underline;">visit the Internet Archive</a>.</p>
                            `;
                            loadingElement.appendChild(timeoutMessage);
                        }
                    }
                }, timeoutThreshold);

                // Add event listener for iframe load
                iframe.addEventListener('load', () => {
                    // Wait a bit for content to render before hiding loading
                    setTimeout(() => {
                        if (loadTimeoutId) {
                            clearTimeout(loadTimeoutId);
                        }
                        if (loadingElement && loadingElement.style.display !== 'none') {
                            loadingElement.style.display = 'none';
                        }
                    }, 1000); // 1 second delay to ensure content is rendered
                });
            } else {
                // No iframe (fallback case), hide loading immediately
                loadingElement.style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading media preview:', error);
            loadingElement.innerHTML = '<p>Error loading preview</p>';
        }
    }

    /**
     * Render material preview HTML
     * @param {Object} material - Material object
     * @returns {string} HTML string for preview
     */

    /**
     * Close preview panel
     */
    closePreview() {
        this.stopCurrentMedia();
        this.currentPreview = null;

        const previewContent = Utils.DOM.getElement('#preview-content');
        const previewClose = Utils.DOM.getElement('#preview-close');

        if (previewContent) {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <div class="preview-placeholder-icon"><i data-feather="mouse-pointer" class="icon-xl"></i></div>
                    <h4>Select a Material</h4>
                    <p>Click on any material from the search results to preview it here.</p>
                </div>
            `;
        }

        if (previewClose) {
            previewClose.style.display = 'none';
        }
    }

    /**
     * Get media icon for material type
     * @param {string} mediaType - Media type
     * @returns {string} Icon HTML
     */
    getMediaIcon(mediaType) {
        return Utils.Material.getTypeIcon(mediaType);
    }

    /**
     * Toggle description display in material cards
     * @param {string} identifier - Material identifier
     */
    toggleDescription(identifier) {
        const card = document.querySelector(`[data-identifier="${identifier}"]`);
        if (!card) return;

        const truncatedText = card.querySelector('.description-text.truncated');
        const fullText = card.querySelector('.description-text.full');
        const showMoreBtn = card.querySelector('.description-toggle');
        const showLessBtn = card.querySelector('.description-toggle:last-child');

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
     * Toggle description display in preview panel
     * @param {string} identifier - Material identifier
     */
    togglePreviewDescription(identifier) {
        const previewPanel = document.querySelector('#preview-content');
        if (!previewPanel) return;

        const truncatedText = previewPanel.querySelector('.description-text.truncated');
        const fullText = previewPanel.querySelector('.description-text.full');
        const showMoreBtn = previewPanel.querySelector('.description-toggle');
        const showLessBtn = previewPanel.querySelector('.description-toggle:last-child');

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
     * Get truncated description text
     * @param {string} description - Full description
     * @param {number} maxLength - Maximum length
     * @returns {Object} Truncated text and length flag
     */
    getTruncatedDescription(description, maxLength = 500) {
        if (!description || description.length <= maxLength) {
            return { text: description || '', isLong: false };
        }

        const truncated = description.substring(0, maxLength).trim();
        const lastSpace = truncated.lastIndexOf(' ');
        const finalText = lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';

        return { text: finalText, isLong: true };
    }

    /**
     * Stop current media playback
     */
    stopCurrentMedia() {
        if (this.app && this.app.media && this.app.media.stopCurrentMedia) {
            return this.app.media.stopCurrentMedia();
        }
        return null;
    }

    /**
     * Pause preview media
     */
    pausePreviewMedia() {
        if (this.app && this.app.media && this.app.media.pausePreviewMedia) {
            return this.app.media.pausePreviewMedia();
        }
        return null;
    }

    /**
     * Set fullscreen playback position
     * @param {HTMLElement} mediaElement - Media element
     * @param {number} currentTime - Current time
     */
    setFullscreenPlaybackPosition(mediaElement, currentTime) {
        if (this.app && this.app.media && this.app.media.setFullscreenPlaybackPosition) {
            return this.app.media.setFullscreenPlaybackPosition(mediaElement, currentTime);
        }
        return null;
    }

    /**
     * Handle fullscreen close
     */
    handleFullscreenClose() {
        if (this.app && this.app.media && this.app.media.handleFullscreenClose) {
            return this.app.media.handleFullscreenClose();
        }
        return null;
    }

    /**
     * Close media preview
     */
    closeMediaPreview() {
        if (this.app && this.app.media && this.app.media.closeMediaPreview) {
            return this.app.media.closeMediaPreview();
        }
        return null;
    }

    /**
     * Preview material in flow context
     * @param {string} identifier - Material identifier
     * @param {boolean} skipEmbedReload - If true, don't reload embed if already loaded
     */
    async previewMaterialInFlow(identifier, skipEmbedReload = false) {
        let material = null;
        if (this.app && this.app.materials && this.app.materials.getSelectedMaterials) {
            material = this.app.materials.getSelectedMaterials().find(m => m.identifier === identifier);
        }
        if (!material && this.app && this.app.createdFlows) {
            material = this.app.createdFlows.flatMap(f => f.materials).find(m => m.identifier === identifier);
        }

        if (!material) {
            console.error('Material not found for preview:', identifier);
            return;
        }

        // Only load inline media preview if not already loaded and not skipping reload
        if (!skipEmbedReload) {
            const mediaContainer = document.getElementById(`flow-media-embed-${identifier}`);
            const hasLoadedEmbed = mediaContainer && mediaContainer.querySelector('iframe');
            if (!hasLoadedEmbed) {
                this.loadMediaPreviewForFlow(identifier, material);
            }
        }

        // Update expandable details if it exists
        const materialDetailsContent = document.getElementById(`flow-preview-content-${identifier}`);
        if (materialDetailsContent) {
            materialDetailsContent.innerHTML = await this.renderMaterialDetailsOnly(material);

            // Replace Feather icons in the material details
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Render material preview for flow context
     * @param {Object} material - Material object
     * @returns {string} HTML string for flow preview
     */
    async renderMaterialPreviewForFlow(material) {
        return `
        <div class="material-preview-detail">
        <div class="material-preview-header">
            <h3 class="material-preview-title">${material.title}</h3>
            <div class="material-preview-meta">
                <div class="material-preview-meta-item">
                    <span class="material-preview-meta-label">Type:</span>
                    <span>${this.getMediaIcon(material.type)} ${material.type}</span>
                </div>
                <div class="material-preview-meta-item">
                    <span class="material-preview-meta-label">Date:</span>
                    <span>${window.internetArchiveAPI.formatDate(material.date)}</span>
                </div>
                ${material.creator !== 'Unknown' ? `
                    <div class="material-preview-meta-item">
                        <span class="material-preview-meta-label">Creator:</span>
                        <span>${material.creator}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        ${material.description ? `
            <div class="material-preview-description">
                <div class="description-text">${material.description}</div>
            </div>
        ` : ''}
        <div class="material-preview-actions">
            <a href="${material.url}" target="_blank" class="btn btn-primary">
                <i data-feather="external-link" class="icon-sm"></i> View on Archive
            </a>
        </div>
        </div>
        `;
    }

    /**
     * Render material details only (no media embed) for expandable details section
     * @param {Object} material - Material object
     * @returns {string} HTML string for material details
     */
    async renderMaterialDetailsOnly(material) {
        const formattedDate = window.internetArchiveAPI ?
            window.internetArchiveAPI.formatDate(material.date) :
            material.date;

        const fileSize = material.size && window.internetArchiveAPI ?
            window.internetArchiveAPI.formatFileSize(material.size) : '';

        // Get fullscreen media type mapping
        const fullscreenMediaType = this.getFullscreenMediaType(material.type);

        let previewHTML = `
            <div class="material-details-combined" data-type="${material.type}">
                <!-- Material Header -->
                <div class="material-details-header">
                    <h4>${this.escapeHTML(material.title)}</h4>
                    <div class="material-meta">
                        <span><strong>Type:</strong> ${this.getMediaIcon(material.type)} ${this.escapeHTML(material.type)}</span>
                        <span><strong>Date:</strong> ${this.escapeHTML(formattedDate)}</span>
                        ${material.creator && material.creator !== 'Unknown' ? `<span><strong>Creator:</strong> ${this.escapeHTML(material.creator)}</span>` : ''}
                        ${material.uploader ? `<span><strong>Uploaded by:</strong> ${this.escapeHTML(material.uploader)}</span>` : ''}
                        ${fileSize ? `<span><strong>Size:</strong> ${this.escapeHTML(fileSize)}</span>` : ''}
                        ${material.language ? `<span><strong>Language:</strong> ${this.escapeHTML(material.language)}</span>` : ''}
                    </div>
                </div>
        `;

        // Add full description (not truncated)
        if (material.description) {
            previewHTML += `
                <div class="material-description">
                    <div class="description-text full">${this.escapeHTMLWithLineBreaks(material.description)}</div>
                </div>
            `;
        }

        // Add action buttons
        const originalId = material.originalIdentifier || material.identifier;
        previewHTML += `
            <div class="material-actions">
                <a href="https://archive.org/details/${originalId}" target="_blank" class="btn btn-secondary">
                    <i data-feather="external-link" class="icon-sm"></i> View on Archive
                </a>
        `;

        // Only add Open Fullscreen button for non-data and non-software types
        if (material.type !== 'data' && material.type !== 'software') {
            previewHTML += `
                <button class="btn btn-secondary" onclick="(window.demoApp || window.publicApp).openFullscreen('${originalId}', '${fullscreenMediaType}', '${this.escapeJS(material.title)}')">
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
     * Render combined material details with embedded preview for flow context
     * @param {Object} material - Material object
     * @returns {string} HTML string for combined material details
     */
    async renderCombinedMaterialDetails(material) {
        const formattedDate = window.internetArchiveAPI ?
            window.internetArchiveAPI.formatDate(material.date) :
            material.date;

        const fileSize = material.size && window.internetArchiveAPI ?
            window.internetArchiveAPI.formatFileSize(material.size) : '';

        // Get media preview HTML
        const mediaPreviewHTML = await this.getMediaPreviewHTML(material);

        // Get fullscreen media type mapping
        const fullscreenMediaType = this.getFullscreenMediaType(material.type);

        let previewHTML = `
            <div class="material-details-combined" data-type="${material.type}">
                <!-- Material Header -->
                <div class="material-details-header">
                    <h4>${this.escapeHTML(material.title)}</h4>
                    <div class="material-meta">
                        <span><strong>Type:</strong> ${this.getMediaIcon(material.type)} ${this.escapeHTML(material.type)}</span>
                        <span><strong>Date:</strong> ${this.escapeHTML(formattedDate)}</span>
                        ${material.creator !== 'Unknown' ? `<span><strong>Creator:</strong> ${this.escapeHTML(material.creator)}</span>` : ''}
                        ${fileSize ? `<span><strong>Size:</strong> ${this.escapeHTML(fileSize)}</span>` : ''}
                    </div>
                </div>
        `;

        // Add description if available (with consistent truncation)
        if (material.description) {
            const { text: truncatedDescription, isLong: isDescriptionLong } = this.getTruncatedDescription(material.description);

            previewHTML += `
                <div class="material-description">
                    <div class="description-text ${isDescriptionLong ? 'truncated' : ''}">${this.escapeHTMLWithLineBreaks(truncatedDescription)}</div>
                    ${isDescriptionLong ? `
                        <button class="description-toggle" onclick="demoApp.toggleFlowDescription('${material.identifier}')">
                            Show more
                        </button>
                        <div class="description-text full" style="display: none;">${this.escapeHTMLWithLineBreaks(material.description)}</div>
                        <button class="description-toggle" onclick="demoApp.toggleFlowDescription('${material.identifier}')" style="display: none;">
                            Show less
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // Add embedded media preview (only for non-data and non-software types)
        if (material.type !== 'data' && material.type !== 'software') {
            previewHTML += `
                ${mediaPreviewHTML}
            `;
        }

        // Add action buttons
        const originalId = material.originalIdentifier || material.identifier;
        previewHTML += `
            <div class="material-actions">
                <a href="https://archive.org/details/${originalId}" target="_blank" class="btn btn-secondary">
                    <i data-feather="external-link" class="icon-sm"></i> View on Archive
                </a>
        `;

        // Only add Open Fullscreen button for non-data and non-software types
        if (material.type !== 'data' && material.type !== 'software') {
            const originalId = material.originalIdentifier || material.identifier;
            previewHTML += `
                <button class="btn btn-secondary" onclick="(window.demoApp || window.publicApp).openFullscreen('${originalId}', '${fullscreenMediaType}', '${this.escapeJS(material.title)}')">
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
     * Get media preview HTML for material (consistent with search preview)
     * @param {Object} material - Material object
     * @returns {string} HTML string for media preview
     */
    async getMediaPreviewHTML(material) {
        // Use the same embedding logic as search preview for consistency
        if (window.internetArchiveAPI && window.internetArchiveAPI.getItemEmbedHTML) {
            // Use the robust Internet Archive embed that works for all document types
            const originalId = material.originalIdentifier || material.identifier;
            const embedHTML = window.internetArchiveAPI.getItemEmbedHTML(originalId);
            if (embedHTML) {
                return `
                    <div class="integrated-media-preview">
                        <div class="media-embed-container" id="flow-media-embed-${material.identifier}">
                            <div class="media-loading" id="flow-media-loading-${material.identifier}">
                                <div class="loading-spinner"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // Fallback to specific media type handling if Internet Archive API is not available
        const mediaType = material.type;

        if (mediaType === 'texts') {
            return `
                <div class="integrated-media-preview">
                    <div class="media-embed-container" id="flow-media-embed-${material.identifier}">
                        <div class="media-loading" id="flow-media-loading-${material.identifier}">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (mediaType === 'image') {
            return `
                <div class="integrated-media-preview">
                    <div class="media-embed-container" id="flow-media-embed-${material.identifier}">
                        <div class="media-loading" id="flow-media-loading-${material.identifier}">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (mediaType === 'audio' || mediaType === 'video' || mediaType === 'movie') {
            return `
                <div class="integrated-media-preview">
                    <div class="media-embed-container" id="flow-media-embed-${material.identifier}">
                        <div class="media-loading" id="flow-media-loading-${material.identifier}">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Try generic Internet Archive embed for unknown types
            return `
                <div class="integrated-media-preview">
                    <div class="media-embed-container" id="flow-media-embed-${material.identifier}">
                        <div class="media-loading" id="flow-media-loading-${material.identifier}">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Load media preview for flow context
     * @param {string} identifier - Material identifier
     * @param {Object} material - Material object
     */
    async loadMediaPreviewForFlow(identifier, material) {
        const mediaContainer = document.getElementById(`flow-media-embed-${identifier}`);
        const loadingElement = document.getElementById(`flow-media-loading-${identifier}`);

        if (!mediaContainer || !loadingElement) {
            console.warn('Flow media container or loading element not found for:', identifier);
            return;
        }

        // Check if embed is already loaded - if so, skip reloading
        const existingIframe = mediaContainer.querySelector('iframe');
        if (existingIframe && loadingElement.style.display === 'none') {
            // Embed already loaded, don't reload
            return;
        }

        // Ensure loading state is visible and container is positioned
        mediaContainer.style.position = 'relative';
        loadingElement.style.display = 'flex';
        loadingElement.style.alignItems = 'center';
        loadingElement.style.justifyContent = 'center';
        loadingElement.style.zIndex = '2';

        // Set appropriate height based on material type
        if (material.type === 'audio') {
            loadingElement.style.height = '30px';
            loadingElement.style.fontSize = '12px';
            // Use smaller spinner for audio
            loadingElement.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid var(--gray-200); border-top: 2px solid var(--primary-color); margin: 0;"></div>';
        } else {
            loadingElement.style.height = '300px';
        }

        try {
            // Get media info to determine the best preview method
            const mediaInfo = material.cachedMediaInfo || {};
            const hasPlayableMedia = mediaInfo.hasPlayableMedia || Utils.Material.hasPlayableMedia(material.type);
            const playableMediaType = mediaInfo.playableMediaType || Utils.Material.getPlayableMediaType(material.type);
            const hasDocumentViewer = mediaInfo.hasDocumentViewer || Utils.Material.hasDocumentViewer(material.type);

            let embedHTML = '';

            // Determine the best preview method based on material type and capabilities
            if (hasPlayableMedia && playableMediaType) {
                // Use Internet Archive embed for playable media with parameters to minimize title overlay
                const originalId = material.originalIdentifier || identifier;
                embedHTML = `
                    <iframe 
                        src="https://archive.org/embed/${originalId}?ui=embed&wrapper=false" 
                        width="100%" 
                        height="100%" 
                        frameborder="0"
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true" 
                        allowfullscreen
                        onerror="this.style.display='none'; document.getElementById('flow-media-loading-${identifier}').innerHTML='<div class=\"loading-spinner\"></div>';">
                    </iframe>
                `;
            } else if (hasDocumentViewer || material.type === 'texts') {
                // Use Internet Archive embed for documents
                const originalId = material.originalIdentifier || identifier;
                embedHTML = `
                    <iframe 
                        src="https://archive.org/embed/${originalId}" 
                        width="100%" 
                        height="100%" 
                        frameborder="0"
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true" 
                        allowfullscreen
                        onerror="this.style.display='none'; document.getElementById('flow-media-loading-${identifier}').innerHTML='<div class=\"loading-spinner\"></div>';">
                    </iframe>
                `;
            } else if (material.type === 'image') {
                // Use Internet Archive embed for images with parameters to minimize title overlay
                const originalId = material.originalIdentifier || identifier;
                embedHTML = `
                    <iframe 
                        src="https://archive.org/embed/${originalId}?ui=embed&wrapper=false" 
                        width="100%" 
                        height="100%" 
                        frameborder="0"
                        webkitallowfullscreen="true" 
                        mozallowfullscreen="true" 
                        allowfullscreen
                        onerror="this.style.display='none'; document.getElementById('flow-media-loading-${identifier}').innerHTML='<div class=\"loading-spinner\"></div>';">
                    </iframe>
                `;
            } else {
                // Fallback for unsupported media types
                embedHTML = `
                    <div class="media-fallback">
                        <p>Preview not available for this media type</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Archive
                        </a>
                    </div>
                `;
            }

            // Create iframe element and append it while keeping loading state
            const iframeContainer = document.createElement('div');
            iframeContainer.innerHTML = embedHTML;
            const iframe = iframeContainer.querySelector('iframe');

            if (iframe) {
                // Ensure container has explicit height for absolutely positioned iframe
                if (material.type !== 'audio') {
                    mediaContainer.style.height = '300px';
                }

                // Position iframe behind loading state
                iframe.style.position = 'absolute';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.width = '100%';
                iframe.style.zIndex = '1';

                // Set explicit height for video materials (not percentage-based)
                if (material.type === 'audio') {
                    iframe.style.height = '30px';
                } else {
                    // Use explicit height for videos to prevent collapse
                    iframe.style.height = '300px';
                }

                // Add iframe to container
                mediaContainer.appendChild(iframe);

                // Track loading state and timeout message
                let timeoutMessageShown = false;
                const timeoutThreshold = 10000; // 10 seconds
                let loadTimeoutId = null;
                const originalId = material.originalIdentifier || identifier;

                // Show timeout message after threshold
                loadTimeoutId = setTimeout(() => {
                    if (loadingElement && loadingElement.style.display !== 'none' && !timeoutMessageShown) {
                        timeoutMessageShown = true;
                        const spinner = loadingElement.querySelector('.loading-spinner');
                        if (spinner) {
                            const timeoutMessage = document.createElement('div');
                            timeoutMessage.className = 'loading-timeout-message';
                            timeoutMessage.style.cssText = 'margin-top: 1rem; text-align: center; font-size: 0.875rem; color: var(--text-secondary); max-width: 400px;';
                            timeoutMessage.innerHTML = `
                                <p style="margin: 0.5rem 0;">This resource is taking longer than expected to load from the Internet Archive.</p>
                                <p style="margin: 0.5rem 0;">It will eventually load. For immediate access, <a href="https://archive.org/details/${originalId}" target="_blank" style="color: var(--primary-color); text-decoration: underline;">visit the Internet Archive</a>.</p>
                            `;
                            loadingElement.appendChild(timeoutMessage);
                        }
                    }
                }, timeoutThreshold);

                // Add event listener for iframe load
                iframe.addEventListener('load', () => {
                    // Wait a bit for content to render before hiding loading
                    setTimeout(() => {
                        if (loadTimeoutId) {
                            clearTimeout(loadTimeoutId);
                        }
                        if (loadingElement && loadingElement.style.display !== 'none') {
                            loadingElement.style.display = 'none';
                        }
                    }, 1000); // 1 second delay to ensure content is rendered
                });
            } else {
                // No iframe (fallback case), hide loading immediately
                loadingElement.style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading flow media preview:', error);
            loadingElement.innerHTML = '<div class="loading-spinner"></div>';
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHTML(str) {
        if (!str) return '';
        // Ensure str is a string before calling replace
        if (typeof str !== 'string') {
            str = String(str);
        }
        return str.replace(/[&<>"']/g, function (match) {
            const escape = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escape[match];
        });
    }

    /**
     * Sanitize HTML by removing dangerous tags while preserving formatting
     * Normalizes styling to match website standards
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML string
     */
    sanitizeHTML(html) {
        if (!html) return '';
        if (typeof html !== 'string') html = String(html);

        // List of allowed HTML tags for formatting
        const allowedTags = ['p', 'br', 'span', 'div', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote'];

        // Create a temporary container
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Recursively sanitize all nodes
        const sanitizeNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();

                // Remove dangerous tags
                if (!allowedTags.includes(tagName)) {
                    // Return just the text content of removed tags
                    return Array.from(node.childNodes).map(sanitizeNode).join('');
                }

                // Remove empty spans and br tags at the beginning
                if (tagName === 'span' && (!node.textContent || node.textContent.trim() === '')) {
                    return Array.from(node.childNodes).map(sanitizeNode).join('');
                }

                // For allowed tags, preserve structure but remove inline styles
                // We'll use CSS classes instead for consistent styling
                let attrs = '';
                if (tagName === 'p') {
                    // Only preserve dir attribute for paragraph direction (for RTL languages)
                    const dir = node.getAttribute('dir');
                    if (dir && (dir === 'ltr' || dir === 'rtl')) {
                        attrs += ` dir="${this.escapeHTML(dir)}"`;
                    }
                    // Add class for consistent styling
                    attrs += ' class="description-paragraph"';
                } else if (tagName === 'span') {
                    // Remove all inline styles from spans - we'll style via CSS
                    // Only preserve dir if it's meaningful
                    const dir = node.getAttribute('dir');
                    if (dir && (dir === 'ltr' || dir === 'rtl')) {
                        attrs += ` dir="${this.escapeHTML(dir)}"`;
                    }
                } else if (tagName === 'br') {
                    // Keep br tags as-is, but ensure they're self-closing
                    return '<br>';
                }

                // Recursively sanitize children
                const children = Array.from(node.childNodes).map(sanitizeNode).join('');

                // Don't wrap empty content in tags
                if (!children.trim() && tagName !== 'br') {
                    return '';
                }

                return `<${tagName}${attrs}>${children}</${tagName}>`;
            }

            return '';
        };

        let sanitized = Array.from(temp.childNodes).map(sanitizeNode).join('');

        // Remove leading empty spans and br tags
        sanitized = sanitized.replace(/^(<span[^>]*><\/span>|<br\s*\/?>)+/i, '');

        // Remove trailing empty spans and br tags
        sanitized = sanitized.replace(/(<span[^>]*><\/span>|<br\s*\/?>)+$/i, '');

        // Normalize multiple consecutive br tags to single br
        sanitized = sanitized.replace(/(<br\s*\/?>){2,}/gi, '<br>');

        // Remove empty paragraphs
        sanitized = sanitized.replace(/<p[^>]*>\s*<\/p>/gi, '');

        return sanitized;
    }

    /**
     * Escape HTML characters and preserve line breaks
     * Handles both plain text (with \n) and HTML descriptions (with <p>, <br>, etc.)
     * @param {string} str - String to escape
     * @returns {string} Escaped string with line breaks converted to <br> tags, or sanitized HTML
     */
    escapeHTMLWithLineBreaks(str) {
        if (!str) {
            return '';
        }

        // Ensure str is a string
        if (typeof str !== 'string') {
            str = String(str);
        }

        // Check if the string contains HTML tags
        const hasHTML = /<[a-z][\s\S]*>/i.test(str);

        if (hasHTML) {
            // If it contains HTML, sanitize it (preserves formatting tags, removes dangerous ones)
            const sanitized = this.sanitizeHTML(str);
            return sanitized;
        }

        // If no HTML, treat as plain text and convert newlines to <br>
        const placeholder = '___LINE_BREAK_PLACEHOLDER___';
        const withPlaceholders = str.replace(/\r\n/g, placeholder).replace(/\n/g, placeholder);

        // Escape HTML for security
        const escaped = this.escapeHTML(withPlaceholders);

        // Replace placeholders with <br> tags
        const result = escaped.replace(new RegExp(placeholder, 'g'), '<br>');

        return result;
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
     * Get fullscreen media type mapping
     * @param {string} materialType - Material type
     * @returns {string} Mapped media type for fullscreen
     */
    getFullscreenMediaType(materialType) {
        // Direct mapping without calling back to app to avoid circular dependency
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
     * @param {string} description - Full description
     * @param {number} maxLength - Maximum length
     * @returns {Object} Truncated text and length flag
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PreviewManager;
} else {
    window.PreviewManager = PreviewManager;
}
