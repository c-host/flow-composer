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
        const material = window.internetArchiveAPI.getMaterialByIdentifier(identifier);

        if (!material) {
            console.error('❌ [Debug] Material not found for identifier:', identifier);
            return;
        }

        // Stop any current media
        this.stopCurrentMedia();

        // Update current preview
        this.currentPreview = identifier;

        // Show preview panel
        const previewPanel = Utils.DOM.getElement('#preview-panel');
        const previewContent = Utils.DOM.getElement('#preview-content');
        const previewClose = Utils.DOM.getElement('#preview-close');

        if (previewPanel && previewContent && previewClose) {
            previewClose.style.display = 'block';

            // Show loading state
            previewContent.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading preview...</p>
                </div>
            `;

            // Render preview content
            const previewHTML = await window.renderManager.renderMaterialPreview(material);
            previewContent.innerHTML = previewHTML;

            // Replace Feather icons in the preview content
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Update the preview panel select button to reflect current selection state
            this.app.materials.updatePreviewPanelSelectButton(identifier);

            // Automatically load media preview
            this.loadMediaPreview(identifier, material);

        } else {
            console.error('❌ [Debug] Preview panel elements not found');
        }
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

            // Debug logging removed

            let embedHTML = '';

            // Determine the best preview method based on material type and capabilities
            if (hasPlayableMedia && playableMediaType) {
                // Use Internet Archive embed for playable media
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
                // Use Internet Archive embed for images
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

                // Add event listener for iframe load
                iframe.addEventListener('load', () => {
                    // Wait a bit for content to render before hiding loading
                    setTimeout(() => {
                        if (loadingElement && loadingElement.style.display !== 'none') {
                            loadingElement.style.display = 'none';
                        }
                    }, 1000); // 1 second delay to ensure content is rendered
                });

                // Fallback timeout in case iframe doesn't fire load event
                setTimeout(() => {
                    if (loadingElement && loadingElement.style.display !== 'none') {
                        loadingElement.style.display = 'none';
                    }
                }, 15000); // 15 second fallback
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
        return this.app.media.stopCurrentMedia();
    }

    /**
     * Pause preview media
     */
    pausePreviewMedia() {
        return this.app.media.pausePreviewMedia();
    }

    /**
     * Set fullscreen playback position
     * @param {HTMLElement} mediaElement - Media element
     * @param {number} currentTime - Current time
     */
    setFullscreenPlaybackPosition(mediaElement, currentTime) {
        return this.app.media.setFullscreenPlaybackPosition(mediaElement, currentTime);
    }

    /**
     * Handle fullscreen close
     */
    handleFullscreenClose() {
        return this.app.media.handleFullscreenClose();
    }

    /**
     * Close media preview
     */
    closeMediaPreview() {
        return this.app.media.closeMediaPreview();
    }

    /**
     * Preview material in flow context
     * @param {string} identifier - Material identifier
     */
    async previewMaterialInFlow(identifier) {
        const material = this.app.materials.getSelectedMaterials().find(m => m.identifier === identifier) ||
            this.app.createdFlows.flatMap(f => f.materials).find(m => m.identifier === identifier);

        if (!material) {
            console.error('Material not found for preview:', identifier);
            return;
        }

        // Replace the material details content instead of showing overlay
        const materialDetailsContent = document.getElementById('flow-preview-content');

        if (materialDetailsContent) {
            // Create combined content with material details + embedded preview
            materialDetailsContent.innerHTML = await this.renderCombinedMaterialDetails(material);

            // Replace Feather icons in the material details
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Load the media preview with loading spinner
            this.loadMediaPreviewForFlow(identifier, material);
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
                        ${material.fileCount ? `<span><strong>Files:</strong> ${material.fileCount}</span>` : ''}
                    </div>
                </div>
        `;

        // Add description if available (with consistent truncation)
        if (material.description) {
            const { text: truncatedDescription, isLong: isDescriptionLong } = this.getTruncatedDescription(material.description);

            previewHTML += `
                <div class="material-description">
                    <div class="description-text ${isDescriptionLong ? 'truncated' : ''}">${this.escapeHTML(truncatedDescription)}</div>
                    ${isDescriptionLong ? `
                        <button class="description-toggle" onclick="demoApp.toggleFlowDescription('${material.identifier}')">
                            Show more
                        </button>
                        <div class="description-text full" style="display: none;">${this.escapeHTML(material.description)}</div>
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
                // Use Internet Archive embed for playable media
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
                // Use Internet Archive embed for images
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

                // Add event listener for iframe load
                iframe.addEventListener('load', () => {
                    // Wait a bit for content to render before hiding loading
                    setTimeout(() => {
                        if (loadingElement && loadingElement.style.display !== 'none') {
                            loadingElement.style.display = 'none';
                        }
                    }, 1000); // 1 second delay to ensure content is rendered
                });

                // Fallback timeout in case iframe doesn't fire load event
                setTimeout(() => {
                    if (loadingElement && loadingElement.style.display !== 'none') {
                        loadingElement.style.display = 'none';
                    }
                }, 15000); // 15 second fallback
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
