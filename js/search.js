// Search Manager - Handles search interface and results
class SearchManager {
  constructor() {
    this.currentResults = [];
    this.allResults = []; // Store all results for client-side filtering
    this.filteredResults = []; // Store filtered results
    this.isFiltering = false; // Track if currently filtering
    this.isLoading = false;
    this.currentPage = 1; // Added for pagination
    this.resultsPerPage = 4; // Default results per page
    this.searchScope = 'all'; // Default search scope
    this.totalResults = 0; // Total results count
    this.currentSearchQuery = ''; // Current search query
    this.currentSearchFilters = {}; // Current search filters
    this.isBrowsingAllItems = false; // Track if browsing all items mode
  }

  renderSearch() {
    const container = document.getElementById('search-container');
    if (!container) return;

    container.innerHTML = `
      <div class="search-interface">
        <div class="search-form">
          <input 
            type="text" 
            id="demo-search-query" 
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
            <label for="demo-document-type">Document Type:</label>
            <select id="demo-document-type">
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
    const filters = ['demo-document-type'];
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

    // Reset browse mode when performing a regular search
    this.isBrowsingAllItems = false;

    // Reset to page 1 for new searches (not pagination)
    if (!isPagination) {
      this.currentPage = 1;
    }

    this.isLoading = true;
    this.showLoading(isPagination);

    try {
      const filters = this.getFilters();
      const resultsPerPage = this.resultsPerPage || Number.MAX_SAFE_INTEGER;
      this.resultsPerPage = resultsPerPage;

      // Get document type filter but don't pass it to API - apply client-side instead
      const documentTypeFilter = filters.documentType;
      const apiFilters = { ...filters };
      delete apiFilters.documentType; // Remove from API filters

      const results = await window.internetArchiveAPI.search(query, {
        ...apiFilters,
        resultsPerPage: resultsPerPage,
        page: this.currentPage || 1
      });

      // Store all results from API for client-side filtering
      // The API stores all results in allSearchResults before paginating
      const allResults = window.internetArchiveAPI ? window.internetArchiveAPI.getAllSearchResults() : [];

      // Store all results for client-side filtering
      if (allResults && allResults.length > 0) {
        this.allResults = allResults;

        // Apply document type filter client-side if one is set
        // Use documentTypeFilter from getFilters() or currentSearchFilters
        const documentType = documentTypeFilter || this.currentSearchFilters.documentType;
        if (documentType) {
          this.currentSearchFilters.documentType = documentType;
          this.filteredResults = allResults.filter(item => item.type === documentType);

          this.isFiltering = true;
          this.totalResults = this.filteredResults.length;

          // Get paginated results from filtered set
          const resultsPerPage = this.resultsPerPage || Number.MAX_SAFE_INTEGER;
          const startIndex = (this.currentPage - 1) * resultsPerPage;
          const endIndex = startIndex + resultsPerPage;
          this.currentResults = this.filteredResults.slice(startIndex, endIndex);
        } else {
          // No filter - show all results
          this.currentSearchFilters.documentType = '';
          this.filteredResults = allResults;
          this.isFiltering = false;
          this.totalResults = allResults.length;
          this.currentResults = results; // Use paginated results from API
        }
      } else {
        // Fallback: if getAllSearchResults is empty, store current results
        // This shouldn't happen normally, but handle it gracefully
        console.warn('[SearchManager] getAllSearchResults returned empty, using current page results');
        this.allResults = results;
        this.filteredResults = results;
        this.isFiltering = false;
        this.currentResults = results;
        this.totalResults = window.internetArchiveAPI ? window.internetArchiveAPI.getTotalResultsCount() : results.length;
      }

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
    const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'all';

    return {
      query: document.getElementById('demo-search-query')?.value || '',
      documentType: document.getElementById('demo-document-type')?.value || '',
      searchScope: searchScope
    };
  }

  updateFilters() {
    const filters = this.getFilters();
    // Filters are now handled locally
  }

  clearFilters() {
    document.getElementById('demo-search-query').value = '';
    document.getElementById('demo-document-type').value = '';
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
    if (!container) {
      console.warn('[SearchManager] displayResults: Container not found');
      return;
    }

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
      console.error('[SearchManager] displayResults: renderManager or renderSearchResults not available');
      // Fallback to basic display without pagination
      container.innerHTML = `
        <div class="search-results-header">
          <h3>Found ${finalValidResults.length} results</h3>
          <p>Showing materials from the Internet Archive related to your search. Select materials to create flows from them.</p>
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

  showNoResultsMessage(message) {
    const container = document.getElementById('demo-search-results');
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
                src="https://archive.org/embed/${identifier}?ui=embed&wrapper=false" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                webkitallowfullscreen="true" 
                mozallowfullscreen="true" 
                allowfullscreen
                style="border: none;"
                onload="(function() { const loadingEl = document.getElementById('iframe-loading-${identifier}'); if (loadingEl) { setTimeout(() => { loadingEl.style.display='none'; }, 1000); } })();"
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

    // Add timeout message logic for loading
    const loadingElement = document.getElementById(`iframe-loading-${identifier}`);
    if (loadingElement) {
      let timeoutMessageShown = false;
      const timeoutThreshold = 10000; // 10 seconds
      const loadTimeoutId = setTimeout(() => {
        if (loadingElement && loadingElement.style.display !== 'none' && !timeoutMessageShown) {
          timeoutMessageShown = true;
          const existingText = loadingElement.querySelector('p');
          if (existingText) {
            const timeoutMessage = document.createElement('div');
            timeoutMessage.className = 'loading-timeout-message';
            timeoutMessage.style.cssText = 'margin-top: 1rem; text-align: center; font-size: 0.875rem; color: var(--text-secondary); max-width: 400px; padding: 0 1rem;';
            timeoutMessage.innerHTML = `
              <p style="margin: 0.5rem 0;">This resource is taking longer than expected to load from the Internet Archive.</p>
              <p style="margin: 0.5rem 0;">It will eventually load. For immediate access, <a href="https://archive.org/details/${identifier}" target="_blank" style="color: var(--primary-color); text-decoration: underline;">visit the Internet Archive</a>.</p>
            `;
            loadingElement.appendChild(timeoutMessage);
          }
        }
      }, timeoutThreshold);

      // Clear timeout when iframe loads
      const iframe = modal.querySelector('iframe');
      if (iframe) {
        const originalOnload = iframe.onload;
        iframe.onload = function () {
          if (originalOnload) originalOnload.call(this);
          if (loadTimeoutId) {
            clearTimeout(loadTimeoutId);
          }
        };
      }
    }

    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }


  async goToPage(page, position = 'top') {
    this.currentPage = page;

    // If filtering is active, use filtered results
    if (this.isFiltering && this.filteredResults.length > 0) {
      const resultsPerPageValue = document.getElementById('demo-results-per-page')?.value || '4';
      const resultsPerPage = resultsPerPageValue === 'all' ? Number.MAX_SAFE_INTEGER : parseInt(resultsPerPageValue);
      this.resultsPerPage = resultsPerPage;
      const startIndex = (page - 1) * resultsPerPage;
      const endIndex = startIndex + resultsPerPage;
      const paginatedResults = this.filteredResults.slice(startIndex, endIndex);

      this.currentResults = paginatedResults;
      this.displayResults(paginatedResults);

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
      return;
    }

    // If browsing all items, use cached results instead of re-searching
    if (this.isBrowsingAllItems) {
      const allResults = window.internetArchiveAPI?.getAllSearchResults() || this.allResults || [];
      const resultsPerPage = this.resultsPerPage || Number.MAX_SAFE_INTEGER;
      const startIndex = (page - 1) * resultsPerPage;
      const endIndex = startIndex + resultsPerPage;
      const paginatedResults = allResults.slice(startIndex, endIndex);

      this.currentResults = paginatedResults;
      this.totalResults = allResults.length;
      this.displayResults(paginatedResults);

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
      return;
    }

    // If we have allResults stored (from a previous search), use them for pagination
    if (this.allResults && this.allResults.length > 0) {
      const resultsPerPage = this.resultsPerPage || Number.MAX_SAFE_INTEGER;
      const startIndex = (page - 1) * resultsPerPage;
      const endIndex = startIndex + resultsPerPage;
      const paginatedResults = this.allResults.slice(startIndex, endIndex);

      this.currentResults = paginatedResults;
      this.totalResults = this.allResults.length;
      this.displayResults(paginatedResults);

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
      return;
    }

    // Fallback: re-perform search for pagination
    await this.performSearch(true);

    // Only scroll if pagination button was clicked from bottom
    if (position === 'bottom') {
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
    }
  }

  /**
   * Change results per page and refresh search
   */
  async changeResultsPerPage() {
    const select = document.getElementById('demo-results-per-page');
    if (select) {
      const value = select.value;
      if (value === 'all') {
        this.resultsPerPage = Number.MAX_SAFE_INTEGER;
      } else {
        this.resultsPerPage = parseInt(value);
      }

      // Re-slice current cached results client-side instead of re-searching
      this.currentPage = 1;

      let sourceResults = [];

      if (this.isFiltering && this.filteredResults.length > 0) {
        sourceResults = this.filteredResults;
      } else if (this.isBrowsingAllItems) {
        sourceResults = window.internetArchiveAPI?.getAllSearchResults() || this.allResults || [];
      } else if (this.allResults && this.allResults.length > 0) {
        sourceResults = this.allResults;
      } else {
        // Fallback to last known results from API if available
        sourceResults = (window.internetArchiveAPI?.getAllSearchResults?.() || window.internetArchiveAPI?.getLastSearchResults?.() || []);
      }

      if (!sourceResults || sourceResults.length === 0) {
        // Nothing to paginate yet; avoid triggering a new search
        return;
      }

      this.totalResults = sourceResults.length;
      const paginatedResults = sourceResults.slice(0, this.resultsPerPage);
      this.currentResults = paginatedResults;
      await this.displayResults(paginatedResults);
    }
  }

  /**
   * Browse all items from collection
   */
  async browseAllItems() {
    const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'all';
    const projectConfig = window.PROJECT_CONFIG || {};
    const collectionName = projectConfig.projectName || 'Collection';

    // Only allow browsing when collection scope is selected
    if (searchScope !== 'collection') {
      this.showError(`Browse All Items is only available when ${collectionName} Collection scope is selected.`);
      return;
    }

    this.isBrowsingAllItems = true;
    this.isLoading = true;
    this.currentPage = 1; // Reset to first page
    this.showLoading();

    // Clear search query
    const queryInput = document.getElementById('demo-search-query');
    if (queryInput) {
      queryInput.value = '';
    }

    try {
      const filters = this.getFilters();
      const resultsPerPageValue = document.getElementById('demo-results-per-page')?.value || '4';
      const resultsPerPage = resultsPerPageValue === 'all' ? Number.MAX_SAFE_INTEGER : parseInt(resultsPerPageValue);
      this.resultsPerPage = resultsPerPage;

      // Perform search with empty query - API will handle collection constraint
      const results = await window.internetArchiveAPI.search('', {
        ...filters,
        resultsPerPage: resultsPerPage,
        page: this.currentPage || 1
      });

      // Store all results from API for client-side filtering
      const allResults = window.internetArchiveAPI ? window.internetArchiveAPI.getAllSearchResults() : results;
      this.allResults = allResults;

      // Apply document type filter if one is selected
      const documentType = filters.documentType || this.currentSearchFilters.documentType;
      if (documentType) {
        this.currentSearchFilters.documentType = documentType;
        this.filteredResults = allResults.filter(item => item.type === documentType);
        this.isFiltering = true;
        this.totalResults = this.filteredResults.length;

        // Get paginated results from filtered set
        const resultsPerPage = this.resultsPerPage || Number.MAX_SAFE_INTEGER;
        const startIndex = (this.currentPage - 1) * resultsPerPage;
        const endIndex = startIndex + resultsPerPage;
        this.currentResults = this.filteredResults.slice(startIndex, endIndex);
      } else {
        // No filter - show all results
        this.currentSearchFilters.documentType = '';
        this.filteredResults = allResults;
        this.isFiltering = false;
        this.totalResults = allResults.length;
        this.currentResults = results;
      }

      this.displayResults(this.currentResults);

      // Show success message
      const projectConfig = window.PROJECT_CONFIG || {};
      const collectionName = projectConfig.projectName || 'Collection';
      this.showSuccess(`Found ${this.totalResults} items in the ${collectionName} collection.`);

    } catch (error) {
      console.error('Browse all items error:', error);
      this.showError('An error occurred while browsing items. Please try again.');
    } finally {
      this.isLoading = false;
      this.hideLoading();
    }
  }

  /**
   * Update browse button visibility based on search scope
   */
  updateBrowseButtonVisibility() {
    const browseBtn = document.getElementById('browse-all-btn');
    const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'all';

    if (browseBtn) {
      if (searchScope === 'collection') {
        browseBtn.style.display = 'inline-block';
      } else {
        browseBtn.style.display = 'none';
      }
    }
  }

  /**
   * Change document type filter and update display
   */
  changeDocumentTypeFilter() {
    const select = document.getElementById('demo-document-type');
    if (select) {
      const documentType = select.value;
      this.currentSearchFilters.documentType = documentType;
      this.currentPage = 1; // Reset to first page

      // Get all results - try allResults first, then API
      let allResults = this.allResults;
      if (!allResults || allResults.length === 0) {
        // Try to get from API
        allResults = window.internetArchiveAPI ? window.internetArchiveAPI.getAllSearchResults() : [];
      }

      // If no results available, do nothing - don't trigger search or show error
      // User can select filter first, then click search/browse to get filtered results
      if (!allResults || allResults.length === 0) {
        // Silently return - no error message, just wait for user to perform search/browse
        return;
      }

      // Store allResults for future filtering
      this.allResults = allResults;

      // Filter all results by document type
      if (documentType) {
        this.filteredResults = allResults.filter(item => item.type === documentType);
        this.isFiltering = true;
      } else {
        // No filter - show all results
        this.filteredResults = [...allResults];
        this.isFiltering = false;
      }

      // Update total results to reflect filtered count
      this.totalResults = this.filteredResults.length;

      // If filtering resulted in no results, show helpful message
      if (this.filteredResults.length === 0) {
        this.showNoResultsMessage('No results available for the selected filter. Please change filters or perform a new search.');
        return;
      }

      // Get paginated results from filtered set
        const resultsPerPage = this.resultsPerPage || Number.MAX_SAFE_INTEGER;
      const startIndex = (this.currentPage - 1) * resultsPerPage;
      const endIndex = startIndex + resultsPerPage;
      const paginatedResults = this.filteredResults.slice(startIndex, endIndex);

      this.currentResults = paginatedResults;
      this.displayResults(paginatedResults);
    }
  }

  /**
   * Update search note based on selected scope
   */
  updateSearchNote() {
    const searchScope = document.querySelector('input[name="search-scope"]:checked')?.value || 'all';
    const projectConfig = window.PROJECT_CONFIG || {};
    const collectionName = projectConfig.projectName || 'Collection';
    const scopeConfig = searchScope === 'collection' ?
      { description: `Searching the ${collectionName} collection`, placeholder: 'Search for materials...' } :
      { description: 'Searching the entire Internet Archive', placeholder: 'Search for materials...' };

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