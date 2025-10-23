// Search Manager - Handles search interface and results
class SearchManager {
  constructor() {
    this.currentResults = [];
    this.isLoading = false;
    this.currentPage = 1; // Added for pagination
    this.resultsPerPage = 6; // Default results per page
    this.searchScope = 'all'; // Default search scope
    this.totalResults = 0; // Total results count
    this.currentSearchQuery = ''; // Current search query
    this.currentSearchFilters = {}; // Current search filters
  }

  renderSearch() {
    const container = document.getElementById('search-container');
    if (!container) return;

    container.innerHTML = `
      <div class="search-interface">
        <div class="search-form">
          <input 
            type="text" 
            id="search-query" 
            placeholder="Search..." 
            value=""
          />
          <button onclick="searchManager.performSearch()">
            <i data-feather="search" class="icon-sm"></i>
            Search
          </button>
        </div>
        
        <div class="search-filters">
          <div class="filter-group">
            <label for="document-type-filter">Document Type:</label>
            <select id="document-type-filter">
              <option value="">All Types</option>
              <option value="texts">Texts</option>
              <option value="image">Images</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="software">Software</option>
              <option value="web">Web</option>
              <option value="data">Data</option>
              <option value="collection">Collections</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="date-start">Start Date:</label>
            <input type="date" id="date-start" placeholder="Start Date" />
          </div>
          
          <div class="filter-group">
            <label for="date-end">End Date:</label>
            <input type="date" id="date-end" placeholder="End Date" />
          </div>
        </div>
        
        <div class="search-actions">
          <button class="btn btn-secondary" onclick="searchManager.clearFilters()">
            Clear Filters
          </button>
          <button class="btn btn-primary" onclick="searchManager.performSearch()">
            Search Archive
          </button>
        </div>
      </div>
      
      <div id="search-results" class="search-results">
        <div class="empty-state">
          <div class="empty-state-icon"><i data-feather="search" class="icon-xl"></i></div>
          <h3>Ready to Search</h3>
          <p>Search....</p>
        </div>
      </div>
      
      <div id="search-loading" class="loading" style="display: none;">
        Searching the Internet Archive...
      </div>
    `;

    this.setupSearchListeners();
    this.loadSampleMaterials();
  }

  setupSearchListeners() {
    // Add enter key listener to search input
    const searchInput = document.getElementById('demo-search-query');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch();
        }
      });
    }

    // Add filter change listeners
    const filters = ['demo-document-type', 'demo-search-type'];
    filters.forEach(filterId => {
      const element = document.getElementById(filterId);
      if (element) {
        // Listen for both change and input events
        element.addEventListener('change', () => {
          this.updateFilters();
        });
        element.addEventListener('input', () => {
          this.updateFilters();
        });
      }
    });
  }

  async performSearch(isPagination = false) {
    const query = document.getElementById('demo-search-query')?.value || '';

    if (!query.trim()) {
      this.showError('Please enter a search term.');
      return;
    }

    this.isLoading = true;
    this.showLoading(isPagination);

    try {
      const filters = this.getFilters();
      const resultsPerPage = parseInt(document.getElementById('demo-results-per-page')?.value || '6');

      const results = await window.internetArchiveAPI.search(query, {
        ...filters,
        resultsPerPage: resultsPerPage,
        page: this.currentPage || 1
      });

      this.currentResults = results;

      // Update total results count from API for pagination
      this.totalResults = window.internetArchiveAPI ? window.internetArchiveAPI.getTotalResultsCount() : results.length;

      this.displayResults(results);

    } catch (error) {
      console.error('Search error:', error);
      this.showError('An error occurred while searching. Please try again.');
    } finally {
      this.isLoading = false;
      this.hideLoading();
    }
  }

  getFilters() {
    const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'filters';

    return {
      query: document.getElementById('demo-search-query')?.value || '',
      documentType: document.getElementById('demo-document-type')?.value || '',
      searchType: document.getElementById('demo-search-type')?.value || 'metadata',
      searchScope: searchScope
    };
  }

  updateFilters() {
    const filters = this.getFilters();
    // Filters are now handled locally
  }

  clearFilters() {
    document.getElementById('search-query').value = '';
    document.getElementById('document-type-filter').value = '';
    document.getElementById('date-start').value = '';
    document.getElementById('date-end').value = '';

    this.updateFilters();
  }

  async loadSampleMaterials() {
    try {
      const samples = await window.internetArchiveAPI.getSampleMaterials();
      if (samples.length > 0) {
        this.displaySampleResults(samples);
      }
    } catch (error) {
      console.error('Error loading sample materials:', error);
    }
  }

  async displayResults(results) {
    const container = document.getElementById('demo-search-results');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-feather="search" class="icon-xl"></i></div>
          <h3>No Results Found</h3>
          <p>Try adjusting your search terms or filters to find more materials.</p>
        </div>
      `;

      // Replace Feather icons in the empty state
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
      return;
    }

    // Filter out invalid items first with enhanced validation
    const validResults = results.filter(item => {
      if (!item || typeof item !== 'object' || item === null || item === undefined) {
        return false;
      }
      if (!item.identifier || !item.title || typeof item.identifier !== 'string' || typeof item.title !== 'string') {
        return false;
      }
      return true;
    });

    // Final validation before Promise.all to catch any remaining undefined materials
    const finalValidResults = validResults.filter(item =>
      item &&
      typeof item === 'object' &&
      item.identifier &&
      item.title &&
      typeof item.identifier === 'string' &&
      typeof item.title === 'string'
    );


    // Use the existing renderSearchResults method that includes pagination controls
    if (window.renderManager && window.renderManager.renderSearchResults) {
      container.innerHTML = await window.renderManager.renderSearchResults(finalValidResults);
    } else {
      console.error('Search: renderManager or renderSearchResults not available');
      // Fallback to basic display without pagination
      container.innerHTML = `
        <div class="search-results-header">
          <h3>Found ${finalValidResults.length} results</h3>
          <p>Showing materials from the Internet Archive related to your search.</p>
        </div>
        <div class="results-grid">
          <div class="error">Error: Render manager not available</div>
        </div>
      `;
    }

    // Replace Feather icons in the search results
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  async displaySampleResults(samples) {
    const container = document.getElementById('search-results');
    if (!container) return;

    // Show loading state while rendering cards
    container.innerHTML = `
      <div class="search-results-header">
        <h3>Sample Materials</h3>
        <p>Here are some example materials from the Internet Archive</p>
      </div>
      
      <div class="results-grid">
        <div class="loading">Loading materials...</div>
      </div>
    `;

    // Filter out invalid items first
    const validSamples = samples.filter(item => item && typeof item === 'object');

    // Render cards asynchronously
    const cardsHTML = await Promise.all(
      validSamples.map(item => window.renderManager.renderMaterialCard(item, 'search'))
    );

    container.innerHTML = `
      <div class="search-results-header">
        <h3>Sample Materials</h3>
        <p>Here are some example materials from the Internet Archive.</p>
      </div>
      
      <div class="results-grid">
        ${cardsHTML.join('')}
      </div>
    `;

    // Replace Feather icons in the sample results
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }


  async showMaterialDetails(identifier) {
    try {
      const details = await window.internetArchiveAPI.getItemDetails(identifier);
      if (details) {
        this.showMaterialModal(details);
      }
    } catch (error) {
      console.error('Error fetching material details:', error);
      this.showError('Could not load material details.');
    }
  }

  async showMaterialModal(material) {
    const modalHTML = await window.renderManager.renderMaterialModal(material);
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal.firstElementChild);
  }

  showLoading(isPagination = false) {
    const container = document.getElementById('demo-search-results');
    if (container) {
      const message = isPagination ? 'Loading page...' : 'Searching the Internet Archive...';
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  hideLoading() {
    // Loading state is automatically replaced when results are displayed
    // This method is kept for compatibility but doesn't need to do anything
    // since the loading state is replaced by displayResults() or showError()
  }

  showError(message) {
    const container = document.getElementById('demo-search-results');
    if (container) {
      container.innerHTML = `
        <div class="error">
          <h3>Search Error</h3>
          <p>${message}</p>
        </div>
      `;
    }
  }

  showSuccess(message) {
    const container = document.getElementById('demo-search-results');
    if (container) {
      container.innerHTML = `
        <div class="success">
          <h3>Success</h3>
          <p>${message}</p>
        </div>
      `;
    }
  }

  // Play media in an inline embed below the material card
  async playMedia(identifier, mediaType, title) {
    // Find the material card for this item
    const materialCard = document.querySelector(`[data-identifier="${identifier}"]`);

    if (!materialCard) {
      console.error('Material card not found for:', identifier);
      return;
    }

    // Remove any existing inline media embeds
    const existingEmbeds = document.querySelectorAll('.inline-media-embed');
    existingEmbeds.forEach(embed => embed.remove());

    // Create the inline embed
    const embed = document.createElement('div');
    embed.className = 'inline-media-embed';
    embed.setAttribute('data-for-identifier', identifier);
    embed.style.cssText = `
      grid-column: 1 / -1;
      margin-top: 1rem;
      padding: 1rem;
      background-color: var(--surface-2);
      border: 1px solid var(--border-primary);
      border-radius: 0.5rem;
      width: 100%;
    `;

    embed.innerHTML = `
      <div class="inline-media-header" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      ">
        <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${title}</h4>
        <button onclick="this.closest('.inline-media-embed').remove()" style="
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        ">×</button>
      </div>
      <div class="inline-media-content">
        ${window.internetArchiveAPI.getMediaPlayerHTML(identifier, mediaType, title)}
      </div>
    `;

    // Find the results grid and insert the embed
    const resultsGrid = materialCard.closest('.results-grid');
    if (resultsGrid) {
      // Insert the embed at the end of the grid
      resultsGrid.appendChild(embed);

      // Scroll to the embed
      embed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Preview document in a modal
  async previewDocument(identifier, title) {
    // Remove any existing modals first
    const existingModals = document.querySelectorAll('.modal-overlay');
    existingModals.forEach(modal => modal.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="modal modal-large" style="
        background: var(--surface-3);
        border-radius: 8px;
        max-width: 90vw;
        max-height: 90vh;
        width: 90vw;
        height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      ">
        <div class="modal-header" style="
          padding: 1rem;
          border-bottom: 1px solid var(--border-primary);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0; font-size: 1.25rem;">${title}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        <div class="modal-content" style="
          flex: 1;
          overflow: hidden;
          padding: 1rem;
        ">
          ${window.internetArchiveAPI.getDocumentViewerHTML(identifier, title)}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  async previewItem(identifier, title) {
    // Remove any existing modals first
    const existingModals = document.querySelectorAll('.modal-overlay');
    existingModals.forEach(modal => modal.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="modal modal-large" style="
        background: var(--surface-3);
        border-radius: 8px;
        max-width: 90vw;
        max-height: 90vh;
        width: 90vw;
        height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      ">
        <div class="modal-header" style="
          padding: 1rem;
          border-bottom: 1px solid var(--border-primary);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0; font-size: 1.25rem;">${title}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        <div class="modal-content" style="
          flex: 1;
          overflow: hidden;
          padding: 1rem;
        ">
          <div class="item-embed" style="height: 100%; display: flex; flex-direction: column;">
            <div class="item-embed-container" style="flex: 1; position: relative;">
              <div class="iframe-loading" id="iframe-loading-${identifier}" style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--surface-2);
                color: var(--text-secondary);
                font-size: 0.875rem;
                z-index: 1;
              ">
                <p>Loading item preview...</p>
              </div>
              <iframe 
                src="https://archive.org/embed/${identifier}" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                webkitallowfullscreen="true" 
                mozallowfullscreen="true" 
                allowfullscreen
                style="border: none;"
                onload="document.getElementById('iframe-loading-${identifier}').style.display='none';"
                onerror="document.getElementById('iframe-loading-${identifier}').innerHTML='<p>Failed to load item. <a href=\\"https://archive.org/details/${identifier}\\" target=\\"_blank\\">Click here to view on Internet Archive</a></p>';">
              </iframe>
            </div>
            <div class="item-embed-info" style="
              padding: 1rem;
              background-color: var(--surface-2);
              border-top: 1px solid var(--border-primary);
            ">
              <div class="item-embed-controls" style="display: flex; gap: 0.5rem; align-items: center;">
                <a href="https://archive.org/details/${identifier}" target="_blank" class="item-link" style="
                  color: var(--primary-color);
                  text-decoration: none;
                  font-size: 0.875rem;
                  font-weight: 500;
                ">
                  View on Internet Archive →
                </a>
                <button onclick="window.open('https://archive.org/embed/${identifier}', '_blank')" style="
                  background-color: var(--gray-600);
                  color: white;
                  border: none;
                  padding: 0.5rem 1rem;
                  border-radius: 0.375rem;
                  font-size: 0.875rem;
                  cursor: pointer;
                ">
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }


  async goToPage(page) {
    this.currentPage = page;
    await this.performSearch(true);
  }

  /**
   * Change results per page and refresh search
   */
  async changeResultsPerPage() {
    const select = document.getElementById('demo-results-per-page');
    if (select) {
      this.resultsPerPage = parseInt(select.value);

      // If there's a current search query, refresh the search
      const query = document.getElementById('demo-search-query')?.value || '';
      if (query.trim()) {
        this.currentPage = 1; // Reset to first page
        await this.performSearch(true); // This is more like pagination than a new search
      }
    }
  }

  /**
   * Update search note based on selected scope
   */
  updateSearchNote() {
    // Delegate to filterManager if available
    if (window.filterManager && window.filterManager.updateSearchNote) {
      window.filterManager.updateSearchNote();
      return;
    }

    // Fallback implementation
    const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'filters';
    const scopeConfig = searchScope === 'all' ?
      { description: 'Searching the entire Internet Archive', placeholder: 'Search for materials...' } :
      { description: 'Searching with custom filters', placeholder: 'Search for materials...' };

    const searchNote = document.getElementById('search-note');
    const searchInput = document.getElementById('demo-search-query');
    const emptyStateMessage = document.querySelector('.empty-state p');

    if (searchNote) {
      const linkHTML = scopeConfig.description;
      searchNote.innerHTML = `<i data-feather="search" class="icon-sm"></i> ${linkHTML}`;

      // Replace Feather icons in the updated search note
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }

    if (searchInput) {
      searchInput.placeholder = scopeConfig.placeholder;
    }

    if (emptyStateMessage) {
      emptyStateMessage.textContent = scopeConfig.description;
    }
  }

}

// Initialize search manager
const searchManager = new SearchManager();
window.searchManager = searchManager; 