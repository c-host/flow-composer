/**
 * State Manager
 * Centralized state management for the application
 */

class StateManager {
    constructor(initialState = {}) {
        this.state = new Proxy(initialState, {
            set: (target, property, value) => {
                const oldValue = target[property];
                target[property] = value;

                // Emit state change event
                if (oldValue !== value) {
                    eventManager.emit('state:changed', {
                        property,
                        oldValue,
                        newValue: value,
                        timestamp: Date.now()
                    });

                    // Emit specific property change event
                    eventManager.emit(`state:${property}:changed`, {
                        oldValue,
                        newValue: value,
                        timestamp: Date.now()
                    });
                }

                return true;
            }
        });

        this.subscribers = new Map();
        this.history = [];
        this.maxHistory = 50;
    }

    /**
     * Get state value
     * @param {string} key - State key
     * @returns {any} - State value
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Set state value
     * @param {string} key - State key
     * @param {any} value - State value
     */
    set(key, value) {
        this.addToHistory(key, this.state[key], value);
        this.state[key] = value;
    }

    /**
     * Update multiple state values
     * @param {Object} updates - Object with key-value pairs to update
     */
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    /**
     * Subscribe to state changes
     * @param {string} key - State key to subscribe to
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }

        this.subscribers.get(key).add(callback);

        // Return unsubscribe function
        return () => {
            const subscribers = this.subscribers.get(key);
            if (subscribers) {
                subscribers.delete(callback);
                if (subscribers.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    }

    /**
     * Subscribe to all state changes
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribeToAll(callback) {
        return eventManager.on('state:changed', callback);
    }

    /**
     * Get entire state object
     * @returns {Object} - Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Reset state to initial values
     * @param {Object} initialState - New initial state
     */
    reset(initialState = {}) {
        this.history = [];
        Object.keys(this.state).forEach(key => {
            delete this.state[key];
        });
        Object.assign(this.state, initialState);
    }

    /**
     * Add state change to history
     * @param {string} key - State key
     * @param {any} oldValue - Old value
     * @param {any} newValue - New value
     */
    addToHistory(key, oldValue, newValue) {
        this.history.push({
            key,
            oldValue,
            newValue,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    /**
     * Get state change history
     * @param {string} key - Optional state key to filter by
     * @returns {Array} - History of state changes
     */
    getHistory(key = null) {
        if (key) {
            return this.history.filter(change => change.key === key);
        }
        return [...this.history];
    }

    /**
     * Undo last state change
     * @param {string} key - Optional state key to undo
     * @returns {boolean} - True if undo was successful
     */
    undo(key = null) {
        const changes = key ?
            this.history.filter(change => change.key === key) :
            this.history;

        if (changes.length === 0) return false;

        const lastChange = changes[changes.length - 1];
        this.state[lastChange.key] = lastChange.oldValue;

        // Remove from history
        const index = this.history.indexOf(lastChange);
        if (index > -1) {
            this.history.splice(index, 1);
        }

        return true;
    }

    /**
     * Get state snapshot
     * @returns {Object} - State snapshot with metadata
     */
    getSnapshot() {
        return {
            state: this.getState(),
            history: this.getHistory(),
            subscribers: Array.from(this.subscribers.keys()),
            timestamp: Date.now()
        };
    }

    /**
     * Load state from snapshot
     * @param {Object} snapshot - State snapshot
     */
    loadSnapshot(snapshot) {
        if (snapshot.state) {
            this.reset(snapshot.state);
        }
        if (snapshot.history) {
            this.history = [...snapshot.history];
        }
    }

    /**
     * Clear all subscribers
     */
    clearSubscribers() {
        this.subscribers.clear();
    }

    /**
     * Get subscriber count for a key
     * @param {string} key - State key
     * @returns {number} - Number of subscribers
     */
    getSubscriberCount(key) {
        const subscribers = this.subscribers.get(key);
        return subscribers ? subscribers.size : 0;
    }
}

// Create global state manager instance with default state
const stateManager = new StateManager({
    // Search state
    searchQuery: '',
    searchScope: '',
    searchResults: [],
    currentPage: 1,
    resultsPerPage: 6,
    isLoading: false,

    // Material selection state
    selectedMaterials: [],
    selectedFlows: [],

    // Flow state
    createdFlows: [],
    currentFlow: null,

    // UI state
    activeModal: null,
    notifications: []
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateManager, stateManager };
} else {
    window.stateManager = stateManager;
} 