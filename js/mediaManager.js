/**
 * Media Management
 * Handles all media preview, playback, and fullscreen functionality
 */

class MediaManager {
    constructor(stateManager, eventManager) {
        this.state = stateManager;
        this.events = eventManager;

        // Media state management
        this.currentMediaPlayer = null;
        this.currentMediaState = {
            identifier: null,
            mediaType: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            previewIframe: null,
            fullscreenModal: null
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
            console.warn(`MediaManager: Method '${methodName}' not found on demoApp. Available methods:`,
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
     * Check if Internet Archive API is available
     * @returns {boolean} True if API is available
     */
    isAPIAvailable() {
        return !!(window.internetArchiveAPI &&
            typeof window.internetArchiveAPI.getMediaInfo === 'function' &&
            typeof window.internetArchiveAPI.getMaterialByIdentifier === 'function');
    }

    /**
     * Get media info from Internet Archive API
     * @param {string} identifier - Material identifier
     * @returns {Promise<Object>} Media info object
     */
    async getMediaInfo(identifier) {
        if (!this.isAPIAvailable()) {
            throw new Error('Internet Archive API not available');
        }
        return await window.internetArchiveAPI.getMediaInfo(identifier);
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
     * Update media state
     * @param {Object} newState - New state properties to update
     */
    updateMediaState(newState) {
        this.currentMediaState = {
            ...this.currentMediaState,
            ...newState
        };
    }

    /**
     * Clear media state
     */
    clearMediaState() {
        this.currentMediaState = {
            identifier: null,
            mediaType: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            previewIframe: null,
            fullscreenModal: null
        };
        this.currentMediaPlayer = null;
    }

    /**
     * Log media operation for debugging
     * @param {string} operation - Operation being performed
     * @param {Object} details - Additional details
     */
    logMediaOperation(operation, details = {}) {
        // Debug logging removed
    }

    // ============================================================================
    // CORE MEDIA FUNCTIONS
    // ============================================================================

    /**
     * Stop current media playback
     */
    stopCurrentMedia() {
        this.logMediaOperation('stopCurrentMedia');

        if (this.currentMediaPlayer) {
            // Stop any iframes or media elements
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                if (iframe.src && iframe.src.includes('archive.org')) {
                    iframe.src = iframe.src; // Reload to stop
                }
            });

            // Remove any media players
            const mediaPlayers = document.querySelectorAll('.media-player, .document-viewer');
            mediaPlayers.forEach(player => {
                player.remove();
            });

            this.currentMediaPlayer = null;
        }

        // Reset media state
        this.clearMediaState();
    }

    /**
     * Pause media in preview iframe, native media element, or image
     */
    pausePreviewMedia() {
        this.logMediaOperation('pausePreviewMedia');

        if (this.currentMediaState.previewIframe) {
            try {
                if (this.currentMediaState.previewIframe.tagName === 'IFRAME') {
                    // Handle iframe content
                    this.currentMediaState.previewIframe.contentWindow.postMessage({
                        action: 'pause',
                        source: 'flow-composer'
                    }, '*');

                    // Also try to reload the iframe to stop playback
                    const currentSrc = this.currentMediaState.previewIframe.src;
                    this.currentMediaState.previewIframe.src = '';
                    setTimeout(() => {
                        this.currentMediaState.previewIframe.src = currentSrc;
                    }, 100);
                } else if (this.currentMediaState.previewIframe.tagName === 'VIDEO' || this.currentMediaState.previewIframe.tagName === 'AUDIO') {
                    // Handle native media elements
                    this.currentMediaState.previewIframe.pause();
                    this.currentMediaState.currentTime = this.currentMediaState.previewIframe.currentTime;
                } else if (this.currentMediaState.previewIframe.tagName === 'IMG') {
                    // Handle images - no need to pause, just track state
                    this.currentMediaState.isPlaying = false;
                }

                this.currentMediaState.isPlaying = false;
                // Debug logging removed
            } catch (error) {
                console.warn('Could not pause preview media:', error);
            }
        }
    }

    /**
     * Set playback position for fullscreen media
     * @param {Element} mediaElement - Media element to set position for
     * @param {number} currentTime - Time position in seconds
     */
    setFullscreenPlaybackPosition(mediaElement, currentTime) {
        if (mediaElement && currentTime > 0) {
            try {
                mediaElement.currentTime = currentTime;
            } catch (error) {
                console.warn('Could not set playback position:', error);
            }
        }
    }

    /**
     * Get modal manager instance
     */
    getModalManager() {
        const app = this.getAppInstance();
        return app ? app.modals : null;
    }

    /**
     * Handle fullscreen modal close
     */
    handleFullscreenClose() {
        this.logMediaOperation('handleFullscreenClose');

        // Remove modal from stack
        const modalManager = this.getModalManager();
        if (modalManager) {
            modalManager.popModal('fullscreen-modal');
        }

        // Stop both preview and fullscreen media
        this.pausePreviewMedia();

        if (this.currentMediaState.fullscreenModal) {
            // Stop any media elements in the fullscreen modal
            const mediaElements = this.currentMediaState.fullscreenModal.querySelectorAll('video, audio');
            mediaElements.forEach(element => {
                element.pause();
                element.currentTime = 0;
            });

            // Remove the modal
            this.currentMediaState.fullscreenModal.remove();
            this.currentMediaState.fullscreenModal = null;
        }

        // Reset playback state
        this.currentMediaState.isPlaying = false;
        this.currentMediaState.currentTime = 0;

        // Debug logging removed
    }

    /**
     * Close media preview section
     */
    closeMediaPreview() {
        this.logMediaOperation('closeMediaPreview');

        this.stopCurrentMedia();

        // Media preview is now integrated into the main preview panel
        // No separate section to hide
    }

    // ============================================================================
    // PREVIEW FUNCTIONS (MAIN PANEL)
    // ============================================================================

    /**
     * Play media in preview panel
     * @param {string} identifier - Material identifier
     * @param {string} mediaType - Type of media (video, audio)
     * @param {string} title - Media title
     */
    async playMedia(identifier, mediaType, title) {
        this.logMediaOperation('playMedia', { identifier, mediaType, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = this.getElement('#media-preview-section');
        const mediaPreviewContent = this.getElement('#media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) return;

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML('Loading media...');

        try {
            // First try to get media info to see what's available
            const mediaInfo = await this.getMediaInfo(identifier);
            const material = this.getMaterialByIdentifier(identifier);

            if (!mediaInfo || !material) {
                throw new Error('Unable to get media information');
            }

            let mediaHTML = '';

            if (mediaType === 'video') {
                if (mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0) {
                    // Use Internet Archive embed
                    mediaHTML = `
                        <div class="media-player">
                            <div class="media-player-container">
                                <iframe 
                                    id="preview-iframe-${identifier}"
                                    src="https://archive.org/embed/${identifier || identifier}" 
                                    width="100%" 
                                    height="300" 
                                    frameborder="0" 
                                    webkitallowfullscreen="true" 
                                    mozallowfullscreen="true">
                                </iframe>
                            </div>
                            <div class="media-player-info">
                                <h4>${title || 'Video Content'}</h4>
                                ${window.renderManager.createMediaControlsHTML(identifier, 'video', title, material.type, identifier)}
                                <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                                    View on Internet Archive
                                </a>
                            </div>
                        </div>
                    `;
                } else {
                    // Fallback for video
                    mediaHTML = `
                        <div class="video-fallback">
                            <h4>Video Preview</h4>
                            <p>This video cannot be previewed directly. Please visit the Internet Archive to view it.</p>
                            <a href="${material.url}" target="_blank" class="btn btn-primary">
                                View on Internet Archive
                            </a>
                        </div>
                    `;
                }
            } else if (mediaType === 'audio') {
                if (mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0) {
                    // Use Internet Archive embed for audio
                    mediaHTML = `
                        <div class="media-player">
                            <div class="media-player-container">
                                <iframe 
                                    id="preview-iframe-${identifier}"
                                    src="https://archive.org/embed/${identifier || identifier}" 
                                    width="100%" 
                                    height="166" 
                                    frameborder="0">
                                </iframe>
                            </div>
                            <div class="media-player-info">
                                <h4>${title || 'Audio Content'}</h4>
                                ${window.renderManager.createMediaControlsHTML(identifier, 'audio', title, material.type, identifier)}
                                <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                                    View on Internet Archive
                                </a>
                            </div>
                        </div>
                    `;
                } else {
                    // Fallback for audio
                    mediaHTML = `
                        <div class="audio-fallback">
                            <h4>Audio Preview</h4>
                            <p>This audio cannot be previewed directly. Please visit the Internet Archive to listen to it.</p>
                            <a href="${material.url}" target="_blank" class="btn btn-primary">
                                View on Internet Archive
                            </a>
                        </div>
                    `;
                }
            }

            if (mediaHTML) {
                this.currentMediaPlayer = identifier;
                mediaPreviewContent.innerHTML = mediaHTML;

                // Track the preview iframe for media state management
                const previewIframe = document.querySelector(`#preview-iframe-${identifier}`);
                if (previewIframe) {
                    this.updateMediaState({
                        previewIframe: previewIframe,
                        identifier: identifier,
                        mediaType: mediaType
                    });
                }
            } else {
                // Generic fallback
                mediaPreviewContent.innerHTML = `
                    <div class="media-fallback">
                        <h4>Media Preview</h4>
                        <p>This media cannot be previewed directly. Please visit the Internet Archive to view it.</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error playing media:', error);
            const material = this.getMaterialByIdentifier(identifier);
            mediaPreviewContent.innerHTML = `
                <div class="media-preview-error">
                    <h5>Media Error</h5>
                    <p>Unable to load media preview. Please try again.</p>
                    ${material ? `<a href="${material.url}" target="_blank" class="btn btn-secondary">View on Internet Archive</a>` : ''}
                </div>
            `;
        }
    }

    /**
     * Preview document in preview panel
     * @param {string} identifier - Material identifier
     * @param {string} title - Document title
     */
    async previewDocument(identifier, title) {
        this.logMediaOperation('previewDocument', { identifier, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = this.getElement('#media-preview-section');
        const mediaPreviewContent = this.getElement('#media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) return;

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML('Loading document...');

        try {
            const documentHTML = window.internetArchiveAPI.getDocumentViewerHTML(identifier, title);
            if (documentHTML) {
                this.currentMediaPlayer = identifier;
                mediaPreviewContent.innerHTML = `
                    <div class="media-player">
                        <div class="media-player-container">
                            <iframe 
                                src="https://archive.org/stream/${identifier}" 
                                width="100%" 
                                height="500" 
                                frameborder="0">
                            </iframe>
                        </div>
                        <div class="media-player-info">
                            <h4>${title || 'Document Content'}</h4>
                            ${window.renderManager.createMediaControlsHTML(identifier, 'document', title, material.type, identifier)}
                            <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                                View on Internet Archive
                            </a>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to external link
                const material = this.getMaterialByIdentifier(identifier);
                mediaPreviewContent.innerHTML = `
                    <div class="document-preview-placeholder">
                        <h4>Document Preview</h4>
                        <p>This document cannot be previewed directly. Please visit the Internet Archive to view it.</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error previewing document:', error);
            mediaPreviewContent.innerHTML = window.renderManager.createErrorHTML('Unable to load document preview. Please try again.');

            // Replace Feather icons in the error message
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Preview image in preview panel
     * @param {string} identifier - Material identifier
     * @param {string} title - Image title
     */
    async previewImage(identifier, title) {
        this.logMediaOperation('previewImage', { identifier, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = this.getElement('#media-preview-section');
        const mediaPreviewContent = this.getElement('#media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) return;

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML('Loading image viewer...');

        try {
            const material = this.getMaterialByIdentifier(identifier);

            if (!material) {
                throw new Error('Unable to get material information');
            }

            // Use Internet Archive's image viewer embed for navigation
            // This embeds just the image viewer component with navigation controls
            this.currentMediaPlayer = identifier;
            mediaPreviewContent.innerHTML = `
                <div class="media-player">
                    <div class="media-player-container">
                        <iframe 
                            src="https://archive.org/embed/${identifier || identifier}" 
                            width="100%" 
                            height="500" 
                            frameborder="0"
                            webkitallowfullscreen="true"
                            mozallowfullscreen="true"
                            allowfullscreen>
                        </iframe>
                    </div>
                    <div class="media-player-info">
                        <h4>${title || 'Image Viewer'}</h4>
                        ${window.renderManager.createMediaControlsHTML(identifier, 'image', title, material.type, identifier)}
                        <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                            View on Internet Archive
                        </a>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error previewing image:', error);
            mediaPreviewContent.innerHTML = window.renderManager.createErrorHTML('Unable to load image viewer. Please try again.');

            // Replace Feather icons in the error message
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Preview item in preview panel (general preview for any item type)
     * @param {string} identifier - Material identifier
     * @param {string} title - Item title
     */
    async previewItem(identifier, title) {
        this.logMediaOperation('previewItem', { identifier, title });

        this.stopCurrentMedia();

        const previewContent = this.getElement('#preview-content');
        if (!previewContent) return;

        // Show loading state
        previewContent.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading item preview...</p>
            </div>
        `;

        try {
            const material = this.getMaterialByIdentifier(identifier);
            if (!material) {
                throw new Error('Material not found');
            }

            // Use Internet Archive embed for general items
            const originalId = identifier || identifier;
            const embedHTML = window.internetArchiveAPI.getItemEmbedHTML(originalId);
            if (embedHTML) {
                this.currentMediaPlayer = identifier;
                previewContent.innerHTML = `
                    <div class="media-player">
                        <div class="media-player-header">
                            <h4>${title || 'Item Preview'}</h4>
                        </div>
                        <div class="media-player-container">
                            ${embedHTML}
                        </div>
                        <div class="media-player-info">
                            <h4>${title || 'Item Content'}</h4>
                            <div class="media-player-controls">
                                <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                                    View on Internet Archive
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to external link
                previewContent.innerHTML = `
                    <div class="media-fallback">
                        <h4>Item Preview</h4>
                        <p>This item cannot be previewed directly. Please visit the Internet Archive to view it.</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error previewing item:', error);
            previewContent.innerHTML = `
                <div class="error-state">
                    <h4>Preview Error</h4>
                    <p>Unable to load item preview. Please try again.</p>
                </div>
            `;
        }
    }

    // ============================================================================
    // FULLSCREEN FUNCTIONS
    // ============================================================================

    /**
     * Open media in fullscreen modal
     * @param {string} identifier - Material identifier
     * @param {string} mediaType - Type of media (video, audio, document, image, item)
     * @param {string} title - Media title
     * @param {string} imageUrl - Optional image URL
     */
    async openFullscreen(identifier, mediaType, title, imageUrl = null) {
        this.logMediaOperation('openFullscreen', { identifier, mediaType, title });

        // Track the current preview media before opening fullscreen
        const previewIframe = document.querySelector('#media-preview-content iframe, #flow-media-preview-content iframe');
        const previewImage = document.querySelector('#media-preview-content img, #flow-media-preview-content img');

        if (previewIframe && previewIframe.src && previewIframe.src.includes('archive.org')) {
            this.updateMediaState({
                previewIframe: previewIframe,
                identifier: identifier,
                mediaType: mediaType
            });
        } else if (previewImage && previewImage.src && previewImage.src.includes('archive.org')) {
            this.updateMediaState({
                previewIframe: previewImage, // Reuse the property for images
                identifier: identifier,
                mediaType: mediaType
            });
        }

        // Pause the preview media to prevent double playback
        this.pausePreviewMedia();

        // Remove any existing fullscreen modals
        const existingModals = document.querySelectorAll('.fullscreen-modal');
        existingModals.forEach(modal => modal.remove());

        const modal = document.createElement('div');
        modal.className = 'fullscreen-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Store reference to the modal
        this.updateMediaState({ fullscreenModal: modal });

        // Show loading state
        modal.innerHTML = `
            <div class="fullscreen-content">
                <div class="fullscreen-header">
                    <h3>${title || 'Loading...'}</h3>
                    <button class="fullscreen-close" onclick="demoApp.handleFullscreenClose()">×</button>
                </div>
                <div class="fullscreen-media">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        try {
            let contentHTML = '';
            const height = mediaType === 'document' ? '90vh' : '80vh';

            if (mediaType === 'video' || mediaType === 'audio' || mediaType === 'item') {
                // Get the actual media URL
                const mediaInfo = await this.getMediaInfo(identifier);
                let mediaUrl = null;
                let actualMediaType = mediaType;

                // For 'item' type, determine the actual media type
                if (mediaType === 'item') {
                    if (mediaInfo && mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0) {
                        actualMediaType = 'video';
                    } else if (mediaInfo && mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0) {
                        actualMediaType = 'audio';
                    }
                }

                if (actualMediaType === 'video' && mediaInfo && mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0) {
                    const videoFile = mediaInfo.videoFiles[0];
                    mediaUrl = videoFile.url || `https://archive.org/download/${identifier}/${videoFile.name}`;
                } else if (actualMediaType === 'audio' && mediaInfo && mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0) {
                    const audioFile = mediaInfo.audioFiles[0];
                    mediaUrl = audioFile.url || `https://archive.org/download/${identifier}/${audioFile.name}`;
                }

                if (mediaUrl) {
                    const mediaElement = actualMediaType === 'audio' ?
                        `<audio controls style="width: 100%; height: 60px;">
                            <source src="${mediaUrl}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>` :
                        `<video controls style="width: 100%; height: ${height}; max-width: 100%; object-fit: contain;">
                            <source src="${mediaUrl}" type="video/mp4">
                            <source src="${mediaUrl}" type="video/webm">
                            Your browser does not support the video element.
                        </video>`;

                    contentHTML = `
                        <div class="fullscreen-content">
                            <div class="fullscreen-header">
                                <h3>${title || `${actualMediaType.charAt(0).toUpperCase() + actualMediaType.slice(1)} Player`}</h3>
                                <button class="fullscreen-close" onclick="demoApp.handleFullscreenClose()">×</button>
                            </div>
                            <div class="fullscreen-media">
                                ${mediaElement}
                            </div>
                        </div>
                    `;
                } else {
                    // Fallback to iframe embed
                    contentHTML = `
                        <div class="fullscreen-content">
                            <div class="fullscreen-header">
                                <h3>${title || `${actualMediaType.charAt(0).toUpperCase() + actualMediaType.slice(1)} Player`}</h3>
                                <button class="fullscreen-close" onclick="demoApp.handleFullscreenClose()">×</button>
                            </div>
                            <div class="fullscreen-media">
                                <div class="media-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 2; background-color: var(--surface-2);">
                                    <div class="loading-spinner"></div>
                                </div>
                                <iframe 
                                    src="https://archive.org/embed/${identifier}" 
                                    width="100%" 
                                    height="${actualMediaType === 'audio' ? '166' : height}" 
                                    frameborder="0" 
                                    webkitallowfullscreen="true" 
                                    mozallowfullscreen="true"
                                    onload="setTimeout(() => { this.parentElement.querySelector('.media-loading').style.display='none'; }, 1000);">
                                </iframe>
                            </div>
                        </div>
                    `;
                }
            } else if (mediaType === 'document') {
                contentHTML = `
                    <div class="fullscreen-content">
                        <div class="fullscreen-header">
                            <h3>${title || 'Document Viewer'}</h3>
                            <button class="fullscreen-close" onclick="demoApp.handleFullscreenClose()">×</button>
                        </div>
                        <div class="fullscreen-media">
                            <div class="media-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 2; background-color: var(--surface-2);">
                                <div class="loading-spinner"></div>
                            </div>
                            <iframe 
                                src="https://archive.org/stream/${identifier}" 
                                width="100%" 
                                height="${height}" 
                                frameborder="0"
                                onload="setTimeout(() => { this.parentElement.querySelector('.media-loading').style.display='none'; }, 1000);">
                            </iframe>
                        </div>
                    </div>
                `;
            } else if (mediaType === 'image') {
                // Use Internet Archive's image viewer embed for navigation
                // This embeds just the image viewer component with navigation controls
                contentHTML = `
                    <div class="fullscreen-content">
                        <div class="fullscreen-header">
                            <h3>${title || 'Image Viewer'}</h3>
                            <button class="fullscreen-close" onclick="demoApp.handleFullscreenClose()">×</button>
                        </div>
                        <div class="fullscreen-media">
                            <div class="media-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 2; background-color: var(--surface-2);">
                                <div class="loading-spinner"></div>
                            </div>
                            <iframe 
                                src="https://archive.org/embed/${identifier}" 
                                width="100%" 
                                height="90vh" 
                                frameborder="0"
                                webkitallowfullscreen="true"
                                mozallowfullscreen="true"
                                allowfullscreen
                                onload="setTimeout(() => { this.parentElement.querySelector('.media-loading').style.display='none'; }, 1000);">
                            </iframe>
                        </div>
                    </div>
                `;
            }

            // Update modal content
            modal.innerHTML = contentHTML;

            // Set playback position for video/audio elements if we have a current time
            if (this.currentMediaState.currentTime > 0) {
                setTimeout(() => {
                    const mediaElement = modal.querySelector('video, audio');
                    if (mediaElement) {
                        this.setFullscreenPlaybackPosition(mediaElement, this.currentMediaState.currentTime);
                    }
                }, 500); // Small delay to ensure media is loaded
            }

        } catch (error) {
            console.error('❌ Error in openFullscreen:', error);
            modal.innerHTML = `
                <div class="fullscreen-content">
                    <div class="fullscreen-header">
                        <h3>Error Loading Media</h3>
                        <button class="fullscreen-close" onclick="demoApp.handleFullscreenClose()">×</button>
                    </div>
                    <div class="fullscreen-media">
                        <p>Unable to load media. Please try again.</p>
                        <a href="https://archive.org/details/${identifier}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                </div>
            `;
        }

        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.handleFullscreenClose();
            }
        });

        // Add modal to stack for proper ESC key handling
        const modalManager = this.getModalManager();
        if (modalManager) {
            modalManager.pushModal('fullscreen-modal', () => {
                this.handleFullscreenClose();
            });
        } else {
            // Fallback to direct ESC handling if modal manager not available
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.handleFullscreenClose();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }

    // ============================================================================
    // FLOW-SPECIFIC MEDIA FUNCTIONS
    // ============================================================================

    /**
     * Play media in flow details modal
     * @param {string} identifier - Material identifier
     * @param {string} mediaType - Type of media (video, audio)
     * @param {string} title - Media title
     */
    async playMediaInFlow(identifier, mediaType, title) {
        this.logMediaOperation('playMediaInFlow', { identifier, mediaType, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = document.getElementById('flow-media-preview-section');
        const mediaPreviewContent = document.getElementById('flow-media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) {
            console.error('❌ Media preview elements not found');
            return;
        }

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML(`Loading ${mediaType} player...`);

        try {
            const material = this.getMaterialByIdentifier(identifier);
            // Debug logging removed

            // Get media info
            const mediaInfo = await this.getMediaInfo(identifier);

            let mediaUrl = null;

            if (mediaType === 'video') {
                if (mediaInfo && mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0) {
                    const videoFile = mediaInfo.videoFiles[0];
                    mediaUrl = videoFile.url || `https://archive.org/download/${identifier}/${videoFile.name}`;
                    // Debug logging removed
                }
            } else if (mediaType === 'audio') {
                if (mediaInfo && mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0) {
                    const audioFile = mediaInfo.audioFiles[0];
                    mediaUrl = audioFile.url || `https://archive.org/download/${identifier}/${audioFile.name}`;
                }
            }

            if (mediaUrl) {
                this.currentMediaPlayer = identifier;

                // Create appropriate media element based on type
                const mediaElement = mediaType === 'audio' ?
                    `<audio controls style="width: 100%; height: 60px;">
                        <source src="${mediaUrl}" type="audio/mpeg">
                        Your browser does not support the audio element.
                    </audio>` :
                    `<video controls style="width: 100%; height: 400px; max-width: 100%; object-fit: contain;">
                        <source src="${mediaUrl}" type="video/mp4">
                        <source src="${mediaUrl}" type="video/webm">
                        Your browser does not support the video element.
                    </video>`;

                mediaPreviewContent.innerHTML = `
                    <div class="media-player">
                        <div class="media-player-container">
                            ${mediaElement}
                        </div>
                        <div class="media-player-info">
                            <h4>${title || 'Media Content'}</h4>
                            ${window.renderManager.createMediaControlsHTML(identifier, mediaType, title, material.type, identifier)}
                            <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                                View on Internet Archive
                            </a>
                        </div>
                    </div>
                `;

                // Track the media element for state management
                const previewMediaElement = mediaPreviewContent.querySelector('video, audio');
                if (previewMediaElement) {
                    this.updateMediaState({
                        previewIframe: previewMediaElement, // Reuse the property for media elements
                        identifier: identifier,
                        mediaType: mediaType
                    });
                }
            } else {
                // Fallback to external link
                mediaPreviewContent.innerHTML = `
                    <div class="media-preview-error">
                        <h5>Media Not Available</h5>
                        <p>This ${mediaType} cannot be played directly. Please visit the Internet Archive to view it.</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error playing media:', error);
            mediaPreviewContent.innerHTML = `
                <div class="media-preview-error">
                    <h5>Error Loading Media</h5>
                    <p>Unable to load the ${mediaType}. Please try again or visit the Internet Archive directly.</p>
                    <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="btn btn-primary">
                        View on Internet Archive
                    </a>
                </div>
            `;
        }
    }

    /**
     * Preview document in flow details modal
     * @param {string} identifier - Material identifier
     * @param {string} title - Document title
     */
    async previewDocumentInFlow(identifier, title) {
        this.logMediaOperation('previewDocumentInFlow', { identifier, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = document.getElementById('flow-media-preview-section');
        const mediaPreviewContent = document.getElementById('flow-media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) return;

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML('Loading document viewer...');

        try {
            const material = this.getMaterialByIdentifier(identifier);

            // Try to get document HTML
            const documentHTML = window.internetArchiveAPI.getDocumentViewerHTML(identifier, title);

            if (documentHTML) {
                this.currentMediaPlayer = identifier;
                mediaPreviewContent.innerHTML = `
                    <div class="media-player">
                        <div class="media-player-container">
                            <iframe 
                                src="https://archive.org/stream/${identifier}" 
                                width="100%" 
                                height="500" 
                                frameborder="0">
                            </iframe>
                        </div>
                        <div class="media-player-info">
                            <h4>${title || 'Document Content'}</h4>
                            ${window.renderManager.createMediaControlsHTML(identifier, 'document', title, material.type, identifier)}
                            <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                                View on Internet Archive
                            </a>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to external link
                mediaPreviewContent.innerHTML = `
                    <div class="document-preview-placeholder">
                        <h4>Document Preview</h4>
                        <p>This document cannot be previewed directly. Please visit the Internet Archive to view it.</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error previewing document:', error);
            mediaPreviewContent.innerHTML = `
                <div class="media-preview-error">
                    <h5>Error Loading Document</h5>
                    <p>Unable to load the document. Please try again or visit the Internet Archive directly.</p>
                    <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="btn btn-primary">
                        View on Internet Archive
                    </a>
                </div>
            `;
        }
    }

    /**
     * Preview image in flow details modal
     * @param {string} identifier - Material identifier
     * @param {string} title - Image title
     */
    async previewImageInFlow(identifier, title) {
        this.logMediaOperation('previewImageInFlow', { identifier, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = document.getElementById('flow-media-preview-section');
        const mediaPreviewContent = document.getElementById('flow-media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) return;

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML('Loading image viewer...');

        try {
            const material = this.getMaterialByIdentifier(identifier);

            // Use Internet Archive's image viewer embed for navigation
            // This embeds just the image viewer component with navigation controls
            this.currentMediaPlayer = identifier;
            mediaPreviewContent.innerHTML = `
                <div class="media-player">
                    <div class="media-player-container">
                        <iframe 
                            src="https://archive.org/embed/${identifier || identifier}" 
                            width="100%" 
                            height="500" 
                            frameborder="0"
                            webkitallowfullscreen="true"
                            mozallowfullscreen="true"
                            allowfullscreen>
                        </iframe>
                    </div>
                    <div class="media-player-info">
                        <h4>${title || 'Image Content'}</h4>
                        ${window.renderManager.createMediaControlsHTML(identifier, 'image', title, material.type, identifier)}
                        <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="media-link">
                            View on Internet Archive
                        </a>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error previewing image:', error);
            mediaPreviewContent.innerHTML = `
                <div class="media-preview-error">
                    <h5>Error Loading Image</h5>
                    <p>Unable to load the image. Please try again or visit the Internet Archive directly.</p>
                    <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="btn btn-primary">
                        View on Internet Archive
                    </a>
                </div>
            `;
        }
    }

    /**
     * Preview item in flow details modal (general preview for any item type)
     * @param {string} identifier - Material identifier
     * @param {string} title - Item title
     */
    async previewItemInFlow(identifier, title) {
        this.logMediaOperation('previewItemInFlow', { identifier, title });

        this.stopCurrentMedia();

        const mediaPreviewSection = document.getElementById('flow-media-preview-section');
        const mediaPreviewContent = document.getElementById('flow-media-preview-content');

        if (!mediaPreviewSection || !mediaPreviewContent) return;

        // Show the media preview section
        mediaPreviewSection.style.display = 'block';

        // Show loading state
        mediaPreviewContent.innerHTML = window.renderManager.createLoadingHTML('Loading item preview...');

        try {
            const material = this.getMaterialByIdentifier(identifier);

            // Check if this item has video content
            const mediaInfo = await this.getMediaInfo(identifier);
            const hasVideo = mediaInfo && mediaInfo.hasVideo && mediaInfo.videoFiles.length > 0;
            const hasAudio = mediaInfo && mediaInfo.hasAudio && mediaInfo.audioFiles.length > 0;

            // Determine the appropriate media type for fullscreen
            let fullscreenMediaType = 'item';
            if (hasVideo) {
                fullscreenMediaType = 'video';
            } else if (hasAudio) {
                fullscreenMediaType = 'audio';
            }

            // Use Internet Archive embed for general items
            const originalId = identifier || identifier;
            const embedHTML = window.internetArchiveAPI.getItemEmbedHTML(originalId);

            if (embedHTML) {
                this.currentMediaPlayer = identifier;
                mediaPreviewContent.innerHTML = `
                    <div class="media-player">
                        <div class="media-player-container">
                            <iframe 
                                src="https://archive.org/embed/${identifier || identifier}" 
                                width="100%" 
                                height="500" 
                                frameborder="0">
                            </iframe>
                        </div>
                        <div class="media-player-info">
                            <h4>${title || 'Item Content'}</h4>
                            <div class="media-player-controls">
                                <button class="btn btn-secondary" onclick="demoApp.openFullscreen('${material.originalIdentifier || identifier}', '${fullscreenMediaType}', '${title}')">
                                    <i data-feather="search" class="icon-sm"></i> Open Fullscreen
                                </button>
                                <a href="https://archive.org/details/${material.originalIdentifier || identifier}" target="_blank" class="media-link">
                                    View on Internet Archive
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to external link
                mediaPreviewContent.innerHTML = `
                    <div class="media-preview-error">
                        <h5>Preview Not Available</h5>
                        <p>This item cannot be previewed directly. Please visit the Internet Archive to view it.</p>
                        <a href="${material.url}" target="_blank" class="btn btn-primary">
                            View on Internet Archive
                        </a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error previewing item:', error);
            mediaPreviewContent.innerHTML = `
                <div class="media-preview-error">
                    <h5>Error Loading Item</h5>
                    <p>Unable to load the item. Please try again or visit the Internet Archive directly.</p>
                    <a href="https://archive.org/details/${identifier || identifier}" target="_blank" class="btn btn-primary">
                        View on Internet Archive
                    </a>
                </div>
            `;
        }
    }
}

// Initialize and expose globally
window.mediaManager = new MediaManager(stateManager, eventManager);

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
    module.exports = { MediaManager };
} else {
    window.MediaManager = MediaManager;
}
