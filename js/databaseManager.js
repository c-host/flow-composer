/**
 * Database Manager
 * Handles IndexedDB operations for flow persistence
 */
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'FlowComposerDB';
        this.dbVersion = 4;
        this.storeName = 'flows';
        this.fallbackMode = false;
        this.inMemoryStorage = new Map();
    }

    /**
     * Initialize IndexedDB for local storage with version conflict handling
     */
    async initDatabase() {
        return new Promise((resolve, reject) => {
            try {
                // First, try to detect existing database version
                this.detectExistingVersion()
                    .then(existingVersion => {
                        if (existingVersion && existingVersion > this.dbVersion) {
                            this.handleVersionConflict(existingVersion, resolve, reject);
                        } else {
                            this.openDatabase(resolve, reject);
                        }
                    })
                    .catch(error => {
                        this.openDatabase(resolve, reject);
                    });
            } catch (error) {
                console.error('Error initializing IndexedDB:', error);
                this.enableFallbackMode();
                resolve();
            }
        });
    }

    /**
     * Detect existing database version
     */
    async detectExistingVersion() {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(this.dbName);

                request.onsuccess = () => {
                    const db = request.result;
                    const version = db.version;
                    db.close();
                    resolve(version);
                };

                request.onerror = () => {
                    resolve(null); // No existing database
                };

                request.onblocked = () => {
                    resolve(null); // Database is blocked, treat as no existing version
                };
            } catch (error) {
                resolve(null);
            }
        });
    }

    /**
     * Handle version conflict scenarios
     */
    handleVersionConflict(existingVersion, resolve, reject) {
        const conflictMessage = `Database version conflict detected. The existing database is version ${existingVersion}, but the application expects version ${this.dbVersion}.`;


        // Show user notification about the conflict
        this.showVersionConflictNotification(existingVersion);

        // For now, enable fallback mode to allow the app to continue working
        // In the future, this could be enhanced with user choice dialogs
        this.enableFallbackMode();
        resolve();
    }

    /**
     * Show notification about version conflict (production mode - silent)
     */
    showVersionConflictNotification(existingVersion) {
        // In production, we handle this silently
        // Only log to console for debugging, no user notifications
    }

    /**
     * Open database with proper error handling
     */
    openDatabase(resolve, reject) {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
            console.error('Error opening IndexedDB:', request.error);
            this.enableFallbackMode();
            resolve(); // Don't reject, use fallback mode instead
        };

        request.onsuccess = () => {
            this.db = request.result;
            this.fallbackMode = false;
            resolve();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create flows store
            if (!db.objectStoreNames.contains(this.storeName)) {
                const flowsStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                flowsStore.createIndex('created', 'created', { unique: false });
                flowsStore.createIndex('lastModified', 'lastModified', { unique: false });
            }
        };

        request.onblocked = () => {
            this.enableFallbackMode();
            resolve();
        };
    }

    /**
     * Enable fallback mode using in-memory storage (production mode - silent)
     */
    enableFallbackMode() {
        this.fallbackMode = true;
        this.inMemoryStorage.clear();

        // In production, we handle this silently without user notifications
        // The app will work normally with localStorage backup
    }

    /**
     * Save flows to IndexedDB or fallback storage (production mode)
     * @param {Array} flows - Array of flow objects to save
     */
    async saveFlowsToStorage(flows) {
        // Always save to localStorage first for reliability
        this.saveToLocalStorage(flows);

        if (this.fallbackMode) {
            // Use in-memory storage as secondary backup
            this.inMemoryStorage.set('flows', flows);
            return;
        }

        if (!this.db) {
            this.inMemoryStorage.set('flows', flows);
            return;
        }

        try {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Clear existing flows
            await store.clear();

            // Save all flows
            for (const flow of flows) {
                await store.add(flow);
            }

        } catch (error) {
            this.inMemoryStorage.set('flows', flows);
        }
    }

    /**
     * Save flows to localStorage (production backup)
     * @param {Array} flows - Array of flow objects to save
     */
    saveToLocalStorage(flows) {
        try {
            const flowsData = JSON.stringify(flows);
            localStorage.setItem('flowComposer_flows', flowsData);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    /**
     * Load flows from IndexedDB or fallback storage (production mode)
     * @returns {Promise<Array>} Array of flow objects
     */
    async loadFlowsFromStorage() {
        // Try localStorage first for reliability
        const localStorageFlows = this.loadFromLocalStorage();
        if (localStorageFlows.length > 0) {
            return localStorageFlows;
        }

        if (this.fallbackMode) {
            // Use in-memory storage
            const flows = this.inMemoryStorage.get('flows') || [];
            return flows;
        }

        if (!this.db) {
            return localStorageFlows;
        }

        try {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const flows = request.result || [];
                    // Also save to localStorage for backup
                    if (flows.length > 0) {
                        this.saveToLocalStorage(flows);
                    }
                    resolve(flows);
                };

                request.onerror = () => {
                    resolve(localStorageFlows);
                };
            });
        } catch (error) {
            return localStorageFlows;
        }
    }

    /**
     * Load flows from localStorage (production primary)
     * @returns {Array} Array of flow objects
     */
    loadFromLocalStorage() {
        try {
            const flowsData = localStorage.getItem('flowComposer_flows');
            if (flowsData) {
                return JSON.parse(flowsData);
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
        return [];
    }

    /**
     * Check if database is ready or in fallback mode
     * @returns {boolean} True if database is initialized or fallback mode is active
     */
    isReady() {
        return this.db !== null || this.fallbackMode;
    }

    /**
     * Check if in fallback mode
     * @returns {boolean} True if using fallback storage
     */
    isInFallbackMode() {
        return this.fallbackMode;
    }

    /**
     * Get database instance (for advanced operations)
     * @returns {IDBDatabase|null} Database instance or null
     */
    getDatabase() {
        return this.db;
    }

    /**
     * Get storage mode information
     * @returns {Object} Storage mode details
     */
    getStorageInfo() {
        return {
            mode: this.fallbackMode ? 'fallback' : 'indexeddb',
            isReady: this.isReady(),
            dbVersion: this.dbVersion,
            storeName: this.storeName
        };
    }

    /**
     * Clear all stored data (both IndexedDB and fallback)
     */
    async clearAllData() {
        if (this.fallbackMode) {
            this.inMemoryStorage.clear();
            return;
        }

        if (this.db) {
            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                await store.clear();
            } catch (error) {
                console.error('Error clearing IndexedDB storage:', error);
            }
        }
    }

    /**
     * Attempt to recover from fallback mode by trying to reinitialize IndexedDB
     * This can be called when the user wants to try using IndexedDB again
     */
    async attemptRecovery() {
        if (!this.fallbackMode) {
            return true;
        }


        try {
            // Try to detect version again
            const existingVersion = await this.detectExistingVersion();

            if (existingVersion && existingVersion > this.dbVersion) {
                this.showRecoveryFailedNotification(existingVersion);
                return false;
            }

            // Try to open database with current version
            return new Promise((resolve) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onsuccess = () => {
                    this.db = request.result;
                    this.fallbackMode = false;
                    this.showRecoverySuccessNotification();
                    resolve(true);
                };

                request.onerror = () => {
                    this.showRecoveryFailedNotification();
                    resolve(false);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const flowsStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                        flowsStore.createIndex('created', 'created', { unique: false });
                        flowsStore.createIndex('lastModified', 'lastModified', { unique: false });
                    }
                };
            });
        } catch (error) {
            console.error('Error during recovery attempt:', error);
            this.showRecoveryFailedNotification();
            return false;
        }
    }

    /**
     * Show recovery success notification (production mode - silent)
     */
    showRecoverySuccessNotification() {
        // In production, we handle this silently
    }

    /**
     * Show recovery failed notification (production mode - silent)
     */
    showRecoveryFailedNotification(existingVersion = null) {
        // In production, we handle this silently
        const message = existingVersion
            ? `Database recovery failed. Version conflict still exists (existing: ${existingVersion}, required: ${this.dbVersion}). Continuing with fallback mode.`
            : 'Database recovery failed. Continuing with fallback mode.';

    }

    /**
     * Get detailed status information for debugging
     */
    getDetailedStatus() {
        return {
            ...this.getStorageInfo(),
            fallbackMode: this.fallbackMode,
            hasDatabase: this.db !== null,
            inMemoryDataSize: this.inMemoryStorage.size,
            dbName: this.dbName,
            storeName: this.storeName,
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
} else {
    window.DatabaseManager = DatabaseManager;
}

