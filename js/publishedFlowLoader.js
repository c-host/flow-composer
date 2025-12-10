/**
 * PublishedFlow Loader
 * Loads published flows from flows/ directory
 */

class PublishedFlowLoader {
    constructor() {
        this.flows = [];
        this.loaded = false;
    }

    /**
     * Load flows index to get list of available flow files
     */
    async loadFlowsIndex() {
        try {
            const response = await fetch('flows/index.json');
            if (!response.ok) {
                console.warn('[PublishedFlowLoader] flows/index.json not found (HTTP', response.status, '), will try to load individual flows');
                return null;
            }
            const index = await response.json();
            return index.flows || [];
        } catch (error) {
            console.error('[PublishedFlowLoader] Error loading flows index:', error);
            return null;
        }
    }

    /**
     * Load a single flow from JSON file
     */
    async loadFlow(filename) {
        try {
            const response = await fetch(`flows/${filename}`);
            if (!response.ok) {
                console.warn(`[PublishedFlowLoader] Flow file not found: ${filename} (HTTP ${response.status})`);
                return null;
            }
            const flow = await response.json();
            return flow;
        } catch (error) {
            console.error(`[PublishedFlowLoader] Error loading flow ${filename}:`, error);
            return null;
        }
    }

    /**
     * Load all published flows
     */
    async loadAllFlows() {
        if (this.loaded) {
            return this.flows;
        }

        try {
            // Try to load from index first
            const flowFiles = await this.loadFlowsIndex();

            if (flowFiles && flowFiles.length > 0) {
                // Load all flows listed in index
                const flowPromises = flowFiles.map(filename => this.loadFlow(filename));
                const loadedFlows = await Promise.all(flowPromises);
                this.flows = loadedFlows.filter(flow => flow !== null);
            } else {
                // Fallback: try to load known flow files
                const knownFlows = ['asnajgapnas-flow.json'];
                const flowPromises = knownFlows.map(filename => this.loadFlow(filename));
                const loadedFlows = await Promise.all(flowPromises);
                this.flows = loadedFlows.filter(flow => flow !== null);
            }

            this.loaded = true;
            return this.flows;
        } catch (error) {
            console.error('[PublishedFlowLoader] Error loading flows:', error);
            this.flows = [];
            return this.flows;
        }
    }

    /**
     * Get all loaded flows
     */
    getFlows() {
        return this.flows;
    }

    /**
     * Get flow by ID
     */
    getFlowById(id) {
        return this.flows.find(flow => flow.id === id);
    }

    /**
     * Search flows by query
     */
    searchFlows(query) {
        if (!query || query.trim() === '') {
            return this.flows;
        }

        const searchTerm = query.toLowerCase().trim();
        return this.flows.filter(flow => {
            // Search in flow metadata
            const nameMatch = flow.name && flow.name.toLowerCase().includes(searchTerm);
            const descMatch = flow.description && flow.description.toLowerCase().includes(searchTerm);

            // Search in materials
            const materialMatch = flow.materials && flow.materials.some(material =>
                (material.title && material.title.toLowerCase().includes(searchTerm)) ||
                (material.description && material.description.toLowerCase().includes(searchTerm)) ||
                (material.creator && material.creator.toLowerCase().includes(searchTerm))
            );

            return nameMatch || descMatch || materialMatch;
        });
    }
}

// Initialize and export
if (typeof window !== 'undefined') {
    window.publishedFlowLoader = new PublishedFlowLoader();
}

