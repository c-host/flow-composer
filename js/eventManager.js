/**
 * Event Manager
 * Centralized event handling for the application
 */

class EventManager {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Event options
     */
    on(event, callback, options = {}) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push({ callback, options });
    }

    /**
     * Add one-time event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Event options
     */
    once(event, callback, options = {}) {
        if (!this.onceEvents.has(event)) {
            this.onceEvents.set(event, []);
        }
        this.onceEvents.get(event).push({ callback, options });
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.events.has(event)) {
            const listeners = this.events.get(event);
            const index = listeners.findIndex(listener => listener.callback === callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }

        if (this.onceEvents.has(event)) {
            const listeners = this.onceEvents.get(event);
            const index = listeners.findIndex(listener => listener.callback === callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to callbacks
     */
    emit(event, ...args) {
        // Emit regular events
        if (this.events.has(event)) {
            this.events.get(event).forEach(({ callback, options }) => {
                try {
                    if (options.async) {
                        Promise.resolve(callback(...args)).catch(error => {
                            console.error(`Error in async event handler for ${event}:`, error);
                        });
                    } else {
                        callback(...args);
                    }
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }

        // Emit once events and remove them
        if (this.onceEvents.has(event)) {
            const listeners = this.onceEvents.get(event);
            listeners.forEach(({ callback, options }) => {
                try {
                    if (options.async) {
                        Promise.resolve(callback(...args)).catch(error => {
                            console.error(`Error in async once event handler for ${event}:`, error);
                        });
                    } else {
                        callback(...args);
                    }
                } catch (error) {
                    console.error(`Error in once event handler for ${event}:`, error);
                }
            });
            this.onceEvents.delete(event);
        }
    }

    /**
     * Clear all events
     */
    clear() {
        this.events.clear();
        this.onceEvents.clear();
    }

    /**
     * Get event listener count
     * @param {string} event - Event name
     * @returns {number} - Number of listeners
     */
    listenerCount(event) {
        let count = 0;
        if (this.events.has(event)) {
            count += this.events.get(event).length;
        }
        if (this.onceEvents.has(event)) {
            count += this.onceEvents.get(event).length;
        }
        return count;
    }

    /**
     * Get all event names
     * @returns {Array<string>} - Array of event names
     */
    eventNames() {
        const events = new Set();
        this.events.forEach((_, event) => events.add(event));
        this.onceEvents.forEach((_, event) => events.add(event));
        return Array.from(events);
    }
}

// Create global event manager instance
const eventManager = new EventManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventManager, eventManager };
} else {
    window.eventManager = eventManager;
} 