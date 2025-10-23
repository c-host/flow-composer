/**
 * Component System
 * Modular UI components for the application
 */

class Component {
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? Utils.DOM.getElement(element) : element;
        this.options = { ...this.defaultOptions, ...options };
        this.state = {};
        this.isInitialized = false;

        // Remove automatic init() call - let derived classes control initialization
        // Derived classes should call this.init() after setting up their properties
    }

    get defaultOptions() {
        return {};
    }

    /**
     * Initialize component
     */
    init() {
        if (this.isInitialized) return;

        this.setupEventListeners();
        this.render();
        this.isInitialized = true;

        // Emit initialization event
        eventManager.emit('component:initialized', {
            component: this.constructor.name,
            element: this.element
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Override in subclasses
    }

    /**
     * Render component
     */
    render() {
        // Override in subclasses
    }

    /**
     * Update component state
     * @param {Object} newState - New state
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    /**
     * Destroy component
     */
    destroy() {
        this.isInitialized = false;
        eventManager.emit('component:destroyed', {
            component: this.constructor.name,
            element: this.element
        });
    }
}

/**
 * Search Component
 */
class SearchComponent extends Component {
    constructor(element, options = {}) {
        super(element, options);
        // Now explicitly initialize after super() sets up base properties
        if (this.element) {
            this.init();
        }
    }

    get defaultOptions() {
        return {
            placeholder: CONFIG.SEARCH_SCOPES.FILTERS.placeholder,
            debounceDelay: 300
        };
    }

    setupEventListeners() {
        const searchInput = this.element.querySelector(CONFIG.SELECTORS.SEARCH_QUERY);
        const searchButton = this.element.querySelector(CONFIG.SELECTORS.SEARCH_BUTTON);
        const scopeInputs = this.element.querySelectorAll('input[name="search-scope"]');

        if (searchInput) {
            // Only search on Enter key press, not on every input
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.performSearch();
            });
        }

        scopeInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateSearchScope();
            });
        });
    }

    async performSearch() {
        const query = Utils.DOM.getElement(CONFIG.SELECTORS.SEARCH_QUERY)?.value || '';
        const documentType = Utils.DOM.getElement('#demo-document-type')?.value || '';
        const searchType = Utils.DOM.getElement('#demo-search-type')?.value || 'metadata';
        const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || CONFIG.SEARCH.DEFAULT_SCOPE;

        if (Utils.Validation.isEmpty(query.trim())) {
            this.showNotification(CONFIG.ERRORS.INVALID_INPUT, CONFIG.CLASSES.ERROR);
            return;
        }

        // Update state
        stateManager.update({
            searchQuery: query,
            searchScope: searchScope,
            isLoading: true
        });

        try {
            if (!window.internetArchiveAPI) {
                throw new Error(CONFIG.ERRORS.API_NOT_AVAILABLE);
            }

            const { result: results, duration } = await Utils.Performance.measureTime(
                () => internetArchiveAPI.search(query, { documentType, searchType, searchScope }),
                'Search'
            );

            stateManager.update({
                searchResults: results,
                currentPage: 1,
                isLoading: false
            });

            // Get the total count from the API, not just the current page results
            const totalResults = internetArchiveAPI.getTotalResultsCount();
            this.showNotification(`Found ${totalResults} results in ${duration}ms`, CONFIG.CLASSES.SUCCESS);

        } catch (error) {
            console.error('Search error:', error);
            stateManager.update({ isLoading: false });
            this.showNotification(CONFIG.ERRORS.SEARCH_FAILED, CONFIG.CLASSES.ERROR);
        }
    }

    updateSearchScope() {
        const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || CONFIG.SEARCH.DEFAULT_SCOPE;
        const scopeConfig = searchScope === 'filters' ? CONFIG.SEARCH_SCOPES.FILTERS : CONFIG.SEARCH_SCOPES.ALL;

        const searchNote = Utils.DOM.getElement('#search-note');
        const searchInput = Utils.DOM.getElement(CONFIG.SELECTORS.SEARCH_QUERY);
        const emptyStateMessage = Utils.DOM.getElement('#empty-state-message');

        if (searchNote) {
            const linkHTML = scopeConfig.url ?
                `<a href="${scopeConfig.url}" target="_blank">${scopeConfig.description}</a>` :
                scopeConfig.description;
            Utils.DOM.setHTML(searchNote, `<i data-feather="search" class="icon-sm"></i> ${linkHTML}`);
        }

        if (searchInput) {
            searchInput.placeholder = scopeConfig.placeholder;
        }

        if (emptyStateMessage) {
            Utils.DOM.setText(emptyStateMessage, scopeConfig.emptyMessage);
        }

        stateManager.set('searchScope', searchScope);
    }

    showNotification(message, type = 'info') {
        Utils.Notification.show(message, type);
    }
}

/**
 * Material Card Component
 */
class MaterialCardComponent extends Component {
    constructor(element, material, options = {}) {
        super(element, options);

        // Validate and set material
        if (!material || typeof material !== 'object') {
            console.error('MaterialCardComponent: Invalid material provided:', material);
            this.material = null;
            return; // Don't initialize with invalid material
        }

        this.material = material;
        this.context = options.context || 'search';
        this.showActions = options.showActions !== false;
        this.onClick = options.onClick || null;
        this.onSelect = options.onSelect || null;
        this.onPlay = options.onPlay || null;
        this.onPreview = options.onPreview || null;
        this.onRemove = options.onRemove || null;

        // Now init after all properties are set
        this.init();
    }

    setupEventListeners() {
        const selectButton = this.element.querySelector('.material-select-btn');
        const playButton = this.element.querySelector('.btn-primary');
        const previewButton = this.element.querySelector('.btn-info');
        const card = this.element.querySelector('.material-card');

        if (selectButton) {
            selectButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection();
            });
        }

        if (playButton) {
            playButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playMedia();
            });
        }

        if (previewButton) {
            previewButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.previewDocument();
            });
        }

        if (card && this.onClick) {
            card.addEventListener('click', () => {
                this.onClick(this.material.identifier);
            });
        }
    }

    render() {
        // Validate material object
        if (!this.material || typeof this.material !== 'object') {
            Utils.DOM.setHTML(this.element, `
                <div class="material-card error">
                    <div class="material-content">
                        <h3>Error: Invalid material data</h3>
                        <p>Material information is missing or invalid.</p>
                    </div>
                </div>
            `);
            return;
        }

        if (!this.material.identifier || !this.material.title) {
            Utils.DOM.setHTML(this.element, `
                <div class="material-card error">
                    <div class="material-content">
                        <h3>Error: Missing material properties</h3>
                        <p>Material is missing identifier or title.</p>
                    </div>
                </div>
            `);
            return;
        }

        // Ensure all required properties exist with defaults
        const material = {
            identifier: this.material.identifier || 'unknown',
            title: this.material.title || 'Untitled',
            type: this.material.type || 'unknown',
            creator: this.material.creator || 'Unknown',
            date: this.material.date || 'Unknown date',
            description: this.material.description || '',
            url: this.material.url || '#',
            thumbnail: this.material.thumbnail || null,
            size: this.material.size || 0,
            ...this.material
        };

        // Validate that we have at least the essential properties
        if (!material.identifier || material.identifier === 'unknown') {
            Utils.DOM.setHTML(this.element, `
                <div class="material-card error">
                    <div class="material-content">
                        <h3>Error: Missing material identifier</h3>
                        <p>Material data is incomplete.</p>
                    </div>
                </div>
            `);
            return;
        }

        const icon = Utils.Material.getTypeIcon(material.type);
        const formattedDate = Utils.Material.formatDate(material.date);
        const formattedSize = Utils.Material.formatFileSize(material.size);
        const isSelected = this.isSelected();
        const previewUrl = this.getMaterialPreviewUrl();

        // Get cached media info
        const mediaInfo = material.cachedMediaInfo || {};
        const hasPlayableMedia = mediaInfo.hasPlayableMedia || Utils.Material.hasPlayableMedia(material.type);
        const playableMediaType = mediaInfo.playableMediaType || Utils.Material.getPlayableMediaType(material.type);
        const hasDocumentViewer = mediaInfo.hasDocumentViewer || Utils.Material.hasDocumentViewer(material.type);

        // Generate action buttons based on context
        const actionButtons = this.generateActionButtons(hasPlayableMedia, playableMediaType, hasDocumentViewer);

        Utils.DOM.setHTML(this.element, `
            <div class="material-card ${isSelected ? 'selected' : ''}" data-identifier="${material.identifier}" onclick="demoApp.previewMaterial('${material.identifier}')" style="cursor: pointer;">
                <div class="material-content">
                    <h3>${Utils.String.escapeHTML(material.title)}</h3>
                    <p>${Utils.String.truncate(Utils.String.escapeHTML(material.description || 'No description available'), 100)}</p>
                    
                    <div class="material-meta">
                        <span><i data-feather="user" class="icon-sm"></i> ${Utils.String.escapeHTML(material.creator)}</span>
                        <span><i data-feather="calendar" class="icon-sm"></i> ${formattedDate}</span>
                        ${formattedSize ? `<span><i data-feather="hard-drive" class="icon-sm"></i> ${formattedSize}</span>` : ''}
                        <span>${icon} ${material.type}</span>
                    </div>
                    
                    ${this.showActions ? `
                        <div class="material-actions">
                            ${actionButtons}
                        </div>
                    ` : ''}
                </div>
            </div>
        `);

        // Re-setup event listeners after re-render
        this.setupEventListeners();
    }

    generateActionButtons(hasPlayableMedia, playableMediaType, hasDocumentViewer) {
        const buttons = [];

        // Context-specific buttons
        switch (this.context) {
            case 'search':
                // For search context, only include select button on the card
                // All other action buttons (View on Archive, Preview, etc.) are in the preview panel
                const isSelected = this.isSelected();
                buttons.push(`
                    <button class="material-select-btn ${isSelected ? 'selected' : ''}" 
                            onclick="event.stopPropagation(); demoApp.toggleMaterialSelection('${this.material.identifier}')">
                        <i data-feather="${isSelected ? 'check' : 'plus'}" class="icon-sm"></i>
                        ${isSelected ? 'Selected' : 'Select'}
                    </button>
                `);
                break;

            case 'flow':
                // Flow-specific actions
                if (hasPlayableMedia && playableMediaType) {
                    const playIcon = playableMediaType === 'video' ? 'play' : 'volume-2';
                    const playText = playableMediaType === 'video' ? 'Play Video' : 'Play Audio';
                    buttons.push(`
                        <button class="btn btn-primary" onclick="demoApp.playMedia('${this.material.originalIdentifier || this.material.identifier}', '${playableMediaType}', '${this.escapeJS(this.material.title)}')">
                            <i data-feather="${playIcon}" class="icon-sm"></i> ${playText}
                        </button>
                    `);
                }
                break;

            case 'assignment':
                // Assignment-specific actions
                buttons.push(`
                    <button class="remove-material-btn" onclick="demoApp.removeMaterialFromFlow('${this.material.identifier}')">
                        Remove
                    </button>
                `);
                break;
        }

        // Add view link for non-search contexts (flow, assignment, etc.)
        if (this.context !== 'search') {
            buttons.push(`
                <a href="${this.material.url}" target="_blank" class="material-link" onclick="event.stopPropagation()">
                    <i data-feather="external-link" class="icon-sm"></i>
                    View on Internet Archive
                </a>
            `);
        }

        // Add media play button if available and not in flow or search context
        if (hasPlayableMedia && playableMediaType && this.context !== 'flow' && this.context !== 'search') {
            const playIcon = playableMediaType === 'video' ? 'play' : 'volume-2';
            const playText = playableMediaType === 'video' ? 'Play Video' : 'Play Audio';

            buttons.push(`
                <button class="btn btn-primary btn-sm" onclick="demoApp.playMedia('${this.material.identifier}', '${playableMediaType}', '${this.escapeJS(this.material.title)}')">
                    <i data-feather="${playIcon}" class="icon-sm"></i> ${playText}
                </button>
            `);
        }

        // Add document preview button if available and not in search context
        if (hasDocumentViewer && this.context !== 'search') {
            buttons.push(`
                <button class="btn btn-info btn-sm" onclick="demoApp.previewDocument('${this.material.identifier}', '${this.escapeJS(this.material.title)}')">
                    <i data-feather="file-text" class="icon-sm"></i> Preview Document
                </button>
            `);
        }

        // Add custom actions if provided and not in search context
        if (this.options.customActions && this.context !== 'search') {
            buttons.push(this.options.customActions);
        }

        return buttons.join('');
    }

    isSelected() {
        const selectedMaterials = stateManager.get('selectedMaterials') || [];
        return selectedMaterials.some(m => m.identifier === this.material.identifier);
    }

    getMaterialPreviewUrl() {
        return this.material.thumbnail || null;
    }

    async toggleSelection() {
        if (this.onSelect) {
            this.onSelect(this.material.identifier);
        }
    }

    playMedia() {
        if (this.onPlay) {
            this.onPlay(this.material.identifier, this.material.type, this.material.title);
        }
    }

    previewDocument() {
        if (this.onPreview) {
            this.onPreview(this.material.identifier, this.material.title);
        }
    }

    removeFromFlow() {
        if (this.onRemove) {
            this.onRemove(this.material.identifier);
        }
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
}

/**
 * Modal Component
 */
class ModalComponent extends Component {
    constructor(element, options = {}) {
        super(element, options);
        // Now explicitly initialize after super() sets up base properties
        if (this.element) {
            this.init();
        }
    }

    get defaultOptions() {
        return {
            closeOnOverlayClick: true,
            closeOnEscape: true,
            animationDuration: CONFIG.UI.MODAL_ANIMATION_DURATION
        };
    }

    setupEventListeners() {
        const closeButton = this.element.querySelector('.modal-close');
        const overlay = this.element;

        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.close();
            });
        }

        if (this.options.closeOnOverlayClick) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });
        }

        if (this.options.closeOnEscape) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.close();
                }
            });
        }
    }

    open() {
        Utils.DOM.show(this.element);
        Utils.DOM.addClass(this.element, 'modal-open');

        // Emit open event
        eventManager.emit('modal:opened', {
            modal: this.element.id,
            element: this.element
        });
    }

    close() {
        Utils.DOM.removeClass(this.element, 'modal-open');
        Utils.DOM.hide(this.element);

        // Emit close event
        eventManager.emit('modal:closed', {
            modal: this.element.id,
            element: this.element
        });
    }

    isOpen() {
        return this.element.style.display === 'block';
    }

    setContent(content) {
        const modalBody = this.element.querySelector('.modal-body');
        if (modalBody) {
            Utils.DOM.setHTML(modalBody, content);
        }
    }
}

// Create global component instances
let searchComponent;

// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const searchElement = Utils.DOM.getElement('.search-interface');

    if (searchElement) {
        searchComponent = new SearchComponent(searchElement);
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Component,
        SearchComponent,
        MaterialCardComponent,
        ModalComponent
    };
} else {
    window.Component = Component;
    window.SearchComponent = SearchComponent;
    window.MaterialCardComponent = MaterialCardComponent;
    window.ModalComponent = ModalComponent;
} 