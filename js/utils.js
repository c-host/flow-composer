/**
 * Utility Functions
 * Common helper functions used throughout the application
 */

const Utils = {
    /**
     * DOM Utilities
     */
    DOM: {
        /**
         * Get element by selector with error handling
         * @param {string} selector - CSS selector
         * @param {boolean} required - Whether element is required (throws error if not found)
         * @returns {HTMLElement|null} - The element or null if not found
         */
        getElement(selector, required = false) {
            const element = document.querySelector(selector);
            if (required && !element) {
                throw new Error(`Required element not found: ${selector}`);
            }
            return element;
        },

        /**
         * Get multiple elements by selector
         * @param {string} selector - CSS selector
         * @returns {NodeList} - List of elements
         */
        getElements(selector) {
            return document.querySelectorAll(selector);
        },

        /**
         * Show element
         * @param {HTMLElement|string} element - Element or selector
         */
        show(element) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.style.display = 'block';
        },

        /**
         * Hide element
         * @param {HTMLElement|string} element - Element or selector
         */
        hide(element) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.style.display = 'none';
        },

        /**
         * Toggle element visibility
         * @param {HTMLElement|string} element - Element or selector
         */
        toggle(element) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) {
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
        },

        /**
         * Add class to element
         * @param {HTMLElement|string} element - Element or selector
         * @param {string} className - Class name to add
         */
        addClass(element, className) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.classList.add(className);
        },

        /**
         * Remove class from element
         * @param {HTMLElement|string} element - Element or selector
         * @param {string} className - Class name to remove
         */
        removeClass(element, className) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.classList.remove(className);
        },

        /**
         * Toggle class on element
         * @param {HTMLElement|string} element - Element or selector
         * @param {string} className - Class name to toggle
         */
        toggleClass(element, className) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.classList.toggle(className);
        },

        /**
         * Set element text content
         * @param {HTMLElement|string} element - Element or selector
         * @param {string} text - Text content
         */
        setText(element, text) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.textContent = text;
        },

        /**
         * Set element HTML content
         * @param {HTMLElement|string} element - Element or selector
         * @param {string} html - HTML content
         */
        setHTML(element, html) {
            const el = typeof element === 'string' ? this.getElement(element) : element;
            if (el) el.innerHTML = html;
        }
    },

    /**
     * Placeholder protection utilities (guards against extensions overwriting placeholders)
     */
    PlaceholderProtection: {
        enable() {
            if (typeof document === 'undefined') {
                return { restore: () => { }, disconnect: () => { } };
            }

            const originalPlaceholders = new Map();
            const restorationInProgress = new Set();

            const storeOriginalPlaceholders = () => {
                const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
                inputs.forEach(input => {
                    if (input.placeholder && input.placeholder !== 'null') {
                        const key = input.id || input.className || input.tagName;
                        originalPlaceholders.set(key, input.placeholder);
                    }
                });
            };

            const restorePlaceholders = () => {
                const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
                inputs.forEach(input => {
                    const currentPlaceholder = input.getAttribute('placeholder');
                    if (currentPlaceholder === 'null') {
                        const key = input.id || input.className || input.tagName;
                        const originalPlaceholder = originalPlaceholders.get(key);

                        if (originalPlaceholder && !restorationInProgress.has(key)) {
                            restorationInProgress.add(key);

                            requestAnimationFrame(() => {
                                input.placeholder = originalPlaceholder;
                                setTimeout(() => restorationInProgress.delete(key), 100);
                            });
                        }
                    }
                });
            };

            storeOriginalPlaceholders();

            let restorationTimeout;
            const debouncedRestore = () => {
                clearTimeout(restorationTimeout);
                restorationTimeout = setTimeout(restorePlaceholders, 50);
            };

            const observer = new MutationObserver((mutations) => {
                let shouldRestore = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'placeholder') {
                        const target = mutation.target;
                        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                            const newValue = target.getAttribute('placeholder');
                            if (newValue === 'null') {
                                shouldRestore = true;
                            }
                        }
                    }
                });

                if (shouldRestore) {
                    debouncedRestore();
                }
            });

            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['placeholder'],
                subtree: true
            });

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    storeOriginalPlaceholders();
                    debouncedRestore();
                }
            };
            document.addEventListener('keydown', escHandler);

            const visibilityObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.target.tagName === 'INPUT' || entry.target.tagName === 'TEXTAREA') {
                        const input = entry.target;
                        if (input.getAttribute('placeholder') === 'null') {
                            const key = input.id || input.className || input.tagName;
                            const originalPlaceholder = originalPlaceholders.get(key);
                            if (originalPlaceholder) {
                                input.placeholder = originalPlaceholder;
                            }
                        }
                    }
                });
            });

            document.querySelectorAll('input, textarea').forEach(el => {
                visibilityObserver.observe(el);
            });

            return {
                restore: restorePlaceholders,
                disconnect: () => {
                    observer.disconnect();
                    visibilityObserver.disconnect();
                    document.removeEventListener('keydown', escHandler);
                }
            };
        }
    },

    /**
     * String Utilities
     */
    String: {
        /**
         * Truncate string to specified length
         * @param {string} str - String to truncate
         * @param {number} length - Maximum length
         * @param {string} suffix - Suffix to add (default: '...')
         * @returns {string} - Truncated string
         */
        truncate(str, length, suffix = '...') {
            if (!str || str.length <= length) return str;
            return str.substring(0, length - suffix.length) + suffix;
        },

        /**
         * Capitalize first letter of string
         * @param {string} str - String to capitalize
         * @returns {string} - Capitalized string
         */
        capitalize(str) {
            if (!str) return str;
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        /**
         * Convert string to title case
         * @param {string} str - String to convert
         * @returns {string} - Title case string
         */
        toTitleCase(str) {
            if (!str) return str;
            return str.replace(/\w\S*/g, (txt) =>
                txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
        },

        /**
         * Escape HTML special characters
         * @param {string} str - String to escape
         * @returns {string} - Escaped string
         */
        escapeHTML(str) {
            if (!str) return str;
            // Ensure str is a string before setting textContent
            if (typeof str !== 'string') {
                str = String(str);
            }
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

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
        },

        /**
         * Format material title for display in confirmation dialogs
         * @param {string} title - Title to format
         * @param {number} maxLength - Maximum length (default: 60)
         * @returns {string} - Formatted title
         */
        formatTitleForDialog(title, maxLength = 60) {
            if (title.length <= maxLength) {
                return title;
            }
            return title.substring(0, maxLength) + '...';
        }
    },

    /**
     * Array Utilities
     */
    Array: {
        /**
         * Remove item from array by value
         * @param {Array} array - Array to modify
         * @param {*} value - Value to remove
         * @returns {Array} - Modified array
         */
        removeByValue(array, value) {
            const index = array.indexOf(value);
            if (index > -1) {
                array.splice(index, 1);
            }
            return array;
        },

        /**
         * Remove item from array by predicate function
         * @param {Array} array - Array to modify
         * @param {Function} predicate - Function to test each element
         * @returns {Array} - Modified array
         */
        removeByPredicate(array, predicate) {
            const index = array.findIndex(predicate);
            if (index > -1) {
                array.splice(index, 1);
            }
            return array;
        },

        /**
         * Get unique items from array
         * @param {Array} array - Array to deduplicate
         * @returns {Array} - Array with unique items
         */
        unique(array) {
            return [...new Set(array)];
        },

        /**
         * Group array items by key
         * @param {Array} array - Array to group
         * @param {string|Function} key - Key or function to group by
         * @returns {Object} - Grouped items
         */
        groupBy(array, key) {
            return array.reduce((groups, item) => {
                const groupKey = typeof key === 'function' ? key(item) : item[key];
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                groups[groupKey].push(item);
                return groups;
            }, {});
        }
    },

    /**
     * Object Utilities
     */
    Object: {
        /**
         * Deep clone object
         * @param {Object} obj - Object to clone
         * @returns {Object} - Cloned object
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            if (typeof obj === 'object') {
                const clonedObj = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        clonedObj[key] = this.deepClone(obj[key]);
                    }
                }
                return clonedObj;
            }
        },

        /**
         * Merge objects deeply
         * @param {Object} target - Target object
         * @param {...Object} sources - Source objects
         * @returns {Object} - Merged object
         */
        deepMerge(target, ...sources) {
            if (!sources.length) return target;
            const source = sources.shift();

            if (this.isObject(target) && this.isObject(source)) {
                for (const key in source) {
                    if (source.hasOwnProperty(key)) {
                        if (this.isObject(source[key])) {
                            if (!target[key]) Object.assign(target, { [key]: {} });
                            this.deepMerge(target[key], source[key]);
                        } else {
                            Object.assign(target, { [key]: source[key] });
                        }
                    }
                }
            }

            return this.deepMerge(target, ...sources);
        },

        /**
         * Check if value is an object
         * @param {*} value - Value to check
         * @returns {boolean} - True if object
         */
        isObject(value) {
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        }
    },

    /**
     * Async Utilities
     */
    Async: {
        /**
         * Delay execution for specified time
         * @param {number} ms - Milliseconds to delay
         * @returns {Promise} - Promise that resolves after delay
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * Retry async function with exponential backoff
         * @param {Function} fn - Function to retry
         * @param {number} maxRetries - Maximum number of retries
         * @param {number} baseDelay - Base delay in milliseconds
         * @returns {Promise} - Promise that resolves with function result
         */
        async retry(fn, maxRetries = 3, baseDelay = 1000) {
            for (let i = 0; i <= maxRetries; i++) {
                try {
                    return await fn();
                } catch (error) {
                    if (i === maxRetries) throw error;
                    const delay = baseDelay * Math.pow(2, i);
                    await this.delay(delay);
                }
            }
        },

        /**
         * Debounce function calls
         * @param {Function} func - Function to debounce
         * @param {number} wait - Wait time in milliseconds
         * @returns {Function} - Debounced function
         */
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * Throttle function calls
         * @param {Function} func - Function to throttle
         * @param {number} limit - Time limit in milliseconds
         * @returns {Function} - Throttled function
         */
        throttle(func, limit) {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
    },

    /**
     * Validation Utilities
     */
    Validation: {
        /**
         * Check if value is empty (null, undefined, empty string, empty array)
         * @param {*} value - Value to check
         * @returns {boolean} - True if empty
         */
        isEmpty(value) {
            return value === null ||
                value === undefined ||
                value === '' ||
                (Array.isArray(value) && value.length === 0) ||
                (typeof value === 'object' && Object.keys(value).length === 0);
        },

        /**
         * Check if value is a valid email
         * @param {string} email - Email to validate
         * @returns {boolean} - True if valid email
         */
        isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        /**
         * Check if value is a valid URL
         * @param {string} url - URL to validate
         * @returns {boolean} - True if valid URL
         */
        isValidURL(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }
    },

    /**
     * Material Utilities
     * Common functions for handling material objects and their display
     */
    Material: {
        /**
         * Get display name for a material
         * @param {Object} material - Material object
         * @returns {string} - Display name
         */
        getDisplayName(material) {
            return material.title || material.identifier || 'Untitled Material';
        },

        /**
         * Get icon for material type
         * @param {string} type - Material type
         * @returns {string} - Icon HTML
         */
        getTypeIcon(type) {
            const icons = {
                'texts': '<i data-feather="file-text" class="icon-sm"></i>',
                'image': '<i data-feather="image" class="icon-sm"></i>',
                'audio': '<i data-feather="music" class="icon-sm"></i>',
                'video': '<i data-feather="video" class="icon-sm"></i>',
                'movie': '<i data-feather="video" class="icon-sm"></i>',
                'movies': '<i data-feather="video" class="icon-sm"></i>',
                'data': '<i data-feather="bar-chart-2" class="icon-sm"></i>',
                'software': '<i data-feather="hard-drive" class="icon-sm"></i>',
                'web': '<i data-feather="globe" class="icon-sm"></i>',
                'collection': '<i data-feather="book" class="icon-sm"></i>',
                'unknown': '<i data-feather="file" class="icon-sm"></i>'
            };
            return icons[type] || icons.unknown;
        },

        /**
         * Format material date for display
         * @param {string} dateString - Date string
         * @returns {string} - Formatted date
         */
        formatDate(dateString) {
            if (!dateString) return 'Unknown date';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Invalid date';
                return date.toLocaleDateString();
            } catch (error) {
                return 'Invalid date';
            }
        },

        /**
         * Format file size for display
         * @param {number|string} size - File size in bytes
         * @returns {string} - Formatted file size
         */
        formatFileSize(size) {
            if (!size) return '';
            const bytes = parseInt(size);
            if (isNaN(bytes)) return '';

            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let unitIndex = 0;
            let fileSize = bytes;

            while (fileSize >= 1024 && unitIndex < units.length - 1) {
                fileSize /= 1024;
                unitIndex++;
            }

            return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
        },

        /**
         * Truncate description text with consistent logic
         * @param {string} description - Description text
         * @param {number} maxLength - Maximum length (default: 150)
         * @returns {Object} - { text: string, isLong: boolean }
         */
        truncateDescription(description, maxLength = 150) {
            if (!description) {
                return { text: '', isLong: false };
            }

            const isLong = description.length > maxLength;
            const text = isLong ?
                description.substring(0, maxLength - 3) + '...' :
                description;

            return { text, isLong };
        },

        /**
         * Check if material has playable media
         * @param {string} type - Material type
         * @returns {boolean} - True if playable
         */
        hasPlayableMedia(type) {
            const playableTypes = ['video', 'movie', 'movies', 'audio'];
            return playableTypes.includes(type);
        },

        /**
         * Get playable media type
         * @param {string} type - Material type
         * @returns {string|null} - Media type or null
         */
        getPlayableMediaType(type) {
            if (type === 'video' || type === 'movie' || type === 'movies') {
                return 'video';
            } else if (type === 'audio') {
                return 'audio';
            }
            return null;
        },

        /**
         * Check if material has document viewer
         * @param {string} type - Material type
         * @returns {boolean} - True if has document viewer
         */
        hasDocumentViewer(type) {
            return type === 'texts';
        },

        /**
         * Get material thumbnail URL with fallback
         * @param {Object} material - Material object
         * @returns {string|null} - Thumbnail URL or null
         */
        getThumbnailUrl(material) {
            // If thumbnail is already provided, use it
            if (material.thumbnail) {
                return material.thumbnail;
            }

            // Otherwise, construct thumbnail URL from identifier
            // Format: https://ia800305.us.archive.org/0/items/{identifier}/__ia_thumb.jpg
            if (material.identifier) {
                // Extract server number from identifier hash or use default
                // For now, use a common server pattern
                return `https://archive.org/services/img/${material.identifier}`;
            }

            return null;
        },

        /**
         * Get material creator display name
         * @param {Object} material - Material object
         * @returns {string} - Creator name
         */
        getCreatorName(material) {
            return material.creator || 'Unknown Creator';
        },

        /**
         * Check if material is selected
         * @param {Object} material - Material object
         * @param {Array} selectedMaterials - Array of selected materials
         * @returns {boolean} - True if selected
         */
        isSelected(material, selectedMaterials) {
            return selectedMaterials.some(m => m.identifier === material.identifier);
        },

        /**
         * Get material meta information for display
         * @param {Object} material - Material object
         * @returns {Array} - Array of meta items
         */
        getMetaInfo(material) {
            const meta = [];

            // Type with icon
            meta.push({
                icon: this.getTypeIcon(material.type),
                label: material.type,
                title: 'Type'
            });

            // Date
            meta.push({
                icon: '<i data-feather="calendar" class="icon-sm"></i>',
                label: this.formatDate(material.date),
                title: 'Date'
            });

            // File size
            if (material.size) {
                meta.push({
                    icon: '<i data-feather="hard-drive" class="icon-sm"></i>',
                    label: this.formatFileSize(material.size),
                    title: 'Size'
                });
            }

            // Creator
            if (material.creator && material.creator !== 'Unknown') {
                meta.push({
                    icon: '<i data-feather="user" class="icon-sm"></i>',
                    label: material.creator,
                    title: 'Creator'
                });
            }

            return meta;
        },

        /**
         * Generate material action buttons based on context
         * @param {Object} material - Material object
         * @param {string} context - Context ('search', 'flow', 'assignment')
         * @param {Object} options - Additional options
         * @returns {string} - HTML string for action buttons
         */
        getActionButtons(material, context = 'search', options = {}) {
            const buttons = [];

            // Always include view link
            buttons.push(`
                <a href="${material.url}" target="_blank" class="material-link" onclick="event.stopPropagation()">
                    <i data-feather="external-link" class="icon-sm"></i>
                    View on Internet Archive
                </a>
            `);

            // Context-specific buttons
            switch (context) {
                case 'search':
                    // Select button
                    const isSelected = options.isSelected || false;
                    buttons.push(`
                        <button class="material-select-btn ${isSelected ? 'selected' : ''}" 
                                onclick="event.stopPropagation(); demoApp.toggleMaterialSelection('${material.identifier}')">
                            <i data-feather="${isSelected ? 'check' : 'plus'}" class="icon-sm"></i>
                            ${isSelected ? 'Selected' : 'Select'}
                        </button>
                    `);
                    break;

                case 'flow':
                    // Flow-specific actions
                    if (this.hasPlayableMedia(material.type)) {
                        const mediaType = this.getPlayableMediaType(material.type);
                        const playIcon = mediaType === 'video' ? 'play' : 'volume-2';
                        const playText = mediaType === 'video' ? 'Play Video' : 'Play Audio';
                        buttons.push(`
                            <button class="btn btn-primary" onclick="demoApp.playMedia('${material.originalIdentifier || material.identifier}', '${mediaType}', '${Utils.String.escapeJS(material.title)}')">
                                <i data-feather="${playIcon}" class="icon-sm"></i> ${playText}
                            </button>
                        `);
                    }
                    break;

                case 'assignment':
                    // Assignment-specific actions
                    buttons.push(`
                        <button class="remove-material-btn" onclick="demoApp.removeMaterialFromFlow('${material.identifier}')">
                            Remove
                        </button>
                    `);
                    break;
            }

            return buttons.join('');
        },

        /**
         * Get material document type from assignment form
         * @param {string} identifier - Material identifier
         * @returns {string} Document type
         */
        getDocumentType(identifier) {
            if (window.demoApp && window.demoApp.materials) {
                // First try to get from the current editing flow if we're editing
                if (window.demoApp.editingFlow) {
                    const flowMaterial = window.demoApp.editingFlow.materials.find(m => m.identifier === identifier);
                    if (flowMaterial && flowMaterial.documentType) {
                        return flowMaterial.documentType;
                    }
                }

                // For new flows, always return default value to prevent persistence from previous flows
                // Only check form element if we're in edit mode
                if (window.demoApp.editingFlow) {
                    const item = document.querySelector(`[data-identifier="${identifier}"] .material-doc-type`);
                    const result = item ? item.value : 'policy';
                    return result;
                } else {
                    // For new flows, always return default
                    return 'policy';
                }
            }
            return 'policy'; // Default fallback
        },

        /**
         * Get material notes from assignment form
         * @param {string} identifier - Material identifier
         * @returns {string} Material notes
         */
        getNotes(identifier) {
            if (window.demoApp && window.demoApp.materials) {
                return window.demoApp.materials.getMaterialNotes(identifier);
            }
            return ''; // Default fallback
        },

        /**
         * Get current material document type from form (for saving)
         * @param {string} identifier - Material identifier
         * @returns {string} Current document type
         */
        getCurrentDocumentType(identifier) {
            if (window.demoApp && window.demoApp.materials) {
                return window.demoApp.materials.getCurrentMaterialDocumentType(identifier);
            }
            return 'policy'; // Default fallback
        },

        /**
         * Get current material notes from form (for saving)
         * @param {string} identifier - Material identifier
         * @returns {string} Current material notes
         */
        getCurrentNotes(identifier) {
            if (window.demoApp && window.demoApp.materials) {
                return window.demoApp.materials.getCurrentMaterialNotes(identifier);
            }
            return ''; // Default fallback
        },

        /**
         * Get material data from API or persisted flow data
         * @param {string} identifier - Material identifier
         * @returns {Object} Material data
         */
        getData(identifier) {
            if (window.demoApp && window.demoApp.materials) {
                return window.demoApp.materials.getMaterialData(identifier);
            }
            return null; // Default fallback
        },

        /**
         * Get truncated description with consistent length
         * @param {string} description - Description text
         * @param {number} maxLength - Maximum length (default: 500)
         * @returns {Object} - { text: string, isLong: boolean }
         */
        getTruncatedDescription(description, maxLength = 500) {
            if (!description || description.length <= maxLength) {
                return { text: description, isLong: false };
            }
            return {
                text: description.substring(0, maxLength) + '...',
                isLong: true
            };
        }
    },

    /**
     * Material Card Utilities
     * Easy creation of material cards using the component system
     */
    MaterialCard: {
        /**
         * Create a material card HTML string using the component system
         * @param {Object} material - Material object
         * @param {Object} options - Component options
         * @returns {string} - HTML string for the material card
         */
        createHTML(material, options = {}) {
            // Validate material object
            if (!material || typeof material !== 'object') {
                console.error('Utils.MaterialCard.createHTML: Invalid material provided:', material);
                return `
                    <div class="material-card error">
                        <div class="material-content">
                            <h3>Error: Invalid material data</h3>
                            <p>Material information is missing or invalid.</p>
                        </div>
                    </div>
                `;
            }

            if (!material.identifier || !material.title) {
                console.error('Utils.MaterialCard.createHTML: Material missing required properties:', material);
                return `
                    <div class="material-card error">
                        <div class="material-content">
                            <h3>Error: Missing material properties</h3>
                            <p>Material is missing identifier or title.</p>
                        </div>
                    </div>
                `;
            }

            // Validate required properties
            const requiredProps = ['identifier', 'title', 'type', 'creator', 'date'];
            const missingProps = requiredProps.filter(prop => !material[prop]);

            if (missingProps.length > 0) {
                console.error('Utils.MaterialCard.createHTML: Missing required properties:', missingProps, material);
                return `
                    <div class="material-card error">
                        <div class="material-content">
                            <h3>Error: Incomplete material data</h3>
                            <p>Missing properties: ${missingProps.join(', ')}</p>
                            <p>Material ID: ${material.identifier || 'Unknown'}</p>
                        </div>
                    </div>
                `;
            }

            try {
                // Additional validation before creating component
                if (!material || typeof material !== 'object' || !material.identifier || !material.title) {
                    console.error('Utils.MaterialCard.createHTML: Material failed final validation:', material);
                    return `
                        <div class="material-card error">
                            <div class="material-content">
                                <h3>Error: Invalid material data</h3>
                                <p>Material information is missing or invalid.</p>
                            </div>
                        </div>
                    `;
                }

                // Create a temporary element
                const tempElement = document.createElement('div');

                // Final validation before component creation
                if (!material || typeof material !== 'object' || !material.identifier || !material.title) {
                    console.error('Utils.MaterialCard.createHTML: Material failed final validation before component creation:', material);
                    return `
                        <div class="material-card error">
                            <div class="material-content">
                                <h3>Error: Invalid material data</h3>
                                <p>Material information is missing or invalid.</p>
                            </div>
                        </div>
                    `;
                }

                // Create the component with all options
                const component = new MaterialCardComponent(tempElement, material, options);

                // Render and get HTML
                component.render();
                const html = tempElement.innerHTML;

                // Clean up
                tempElement.remove();

                return html;
            } catch (error) {
                console.error('Utils.MaterialCard.createHTML: Error creating material card:', error, material);
                return `
                    <div class="material-card error">
                        <div class="material-content">
                            <h3>Error: Failed to create material card</h3>
                            <p>Error: ${error.message}</p>
                            <p>Material ID: ${material.identifier || 'Unknown'}</p>
                        </div>
                    </div>
                `;
            }
        },

        /**
         * Create a material card component instance
         * @param {HTMLElement} element - DOM element to render into
         * @param {Object} material - Material object
         * @param {Object} options - Component options
         * @returns {MaterialCardComponent} - Component instance
         */
        createComponent(element, material, options = {}) {
            return new MaterialCardComponent(element, material, options);
        },

        /**
         * Create material cards for search context
         * @param {Array} materials - Array of material objects
         * @param {Object} options - Additional options
         * @returns {Array} - Array of HTML strings
         */
        createSearchCards(materials, options = {}) {
            return materials.map(material => this.createHTML(material, {
                context: 'search',
                onClick: options.onClick || null,
                onSelect: options.onSelect || null,
                onPlay: options.onPlay || null,
                onPreview: options.onPreview || null,
                customActions: options.customActions || null,
                ...options
            }));
        },

        /**
         * Create material cards for flow context
         * @param {Array} materials - Array of material objects
         * @param {Object} options - Additional options
         * @returns {Array} - Array of HTML strings
         */
        createFlowCards(materials, options = {}) {
            return materials.map(material => this.createHTML(material, {
                context: 'flow',
                onClick: options.onClick || null,
                onPlay: options.onPlay || null,
                onPreview: options.onPreview || null,
                customActions: options.customActions || null,
                ...options
            }));
        },

        /**
         * Create material cards for assignment context
         * @param {Array} materials - Array of material objects
         * @param {Object} options - Additional options
         * @returns {Array} - Array of HTML strings
         */
        createAssignmentCards(materials, options = {}) {
            return materials.map(material => this.createHTML(material, {
                context: 'assignment',
                onRemove: options.onRemove || null,
                customActions: options.customActions || null,
                ...options
            }));
        }
    },

    /**
     * Notification Utilities
     * Common functions for displaying notifications
     */
    Notification: {
        /**
         * Show a notification message
         * @param {string} message - Message to display
         * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
         * @param {Object} options - Additional options
         */
        show(message, type = 'info', options = {}) {

            const {
                duration = 5000,
                position = 'top-right',
                autoClose = true
            } = options;

            // Create notification element using render manager
            const notificationContainer = document.createElement('div');
            notificationContainer.innerHTML = window.renderManager.createNotificationHTML(message, type);
            const notification = notificationContainer.firstElementChild;


            // Add to page with batched DOM update to prevent forced reflows
            requestAnimationFrame(() => {
                document.body.appendChild(notification);
            });


            // Ensure notification is fully visible
            this.ensureNotificationVisibility(notification);

            // Show with animation
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);

            // Auto-close if enabled
            if (autoClose) {
                setTimeout(() => {
                    this.hide(notification);
                }, duration);
            }

            return notification;
        },

        /**
         * Ensure notification is fully visible within viewport
         * @param {HTMLElement} notification - Notification element
         */
        ensureNotificationVisibility(notification) {

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;


            // Get notification dimensions
            const rect = notification.getBoundingClientRect();
            const notificationWidth = rect.width;
            const notificationHeight = rect.height;


            // Check if notification would be cut off
            const rightOverflow = rect.right > viewportWidth;
            const leftOverflow = rect.left < 0;
            const topOverflow = rect.top < 0;
            const bottomOverflow = rect.bottom > viewportHeight;



            // Adjust position if needed
            if (rightOverflow) {
                notification.style.right = '10px';
                notification.style.left = 'auto';
            }

            if (leftOverflow) {
                notification.style.left = '10px';
                notification.style.right = 'auto';
            }

            if (topOverflow) {
                notification.style.top = '10px';
            }

            if (bottomOverflow) {
                notification.style.top = `${viewportHeight - notificationHeight - 10}px`;
            }

            // Re-check after adjustments
            setTimeout(() => {
                const newRect = notification.getBoundingClientRect();
            }, 100);
        },

        /**
         * Hide a notification
         * @param {HTMLElement} notification - Notification element
         */
        hide(notification) {
            if (notification && notification.parentElement) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.parentElement.removeChild(notification);
                    }
                }, 300);
            }
        },

        /**
         * Show success notification
         * @param {string} message - Success message
         * @param {Object} options - Additional options
         */
        success(message, options = {}) {
            return this.show(message, 'success', options);
        },

        /**
         * Show error notification
         * @param {string} message - Error message
         * @param {Object} options - Additional options
         */
        error(message, options = {}) {
            return this.show(message, 'error', options);
        },

        /**
         * Show info notification
         * @param {string} message - Info message
         * @param {Object} options - Additional options
         */
        info(message, options = {}) {
            return this.show(message, 'info', options);
        },

        /**
         * Show warning notification
         * @param {string} message - Warning message
         * @param {Object} options - Additional options
         */
        warning(message, options = {}) {
            return this.show(message, 'warning', options);
        },

        /**
         * Clear all notifications
         */
        clearAll() {
            const notifications = document.querySelectorAll('.notification');
            notifications.forEach(notification => {
                this.hide(notification);
            });
        }
    },

    /**
     * Document Type Utilities
     * Common functions for handling document types and their metadata
     */
    DocumentType: {
        /**
         * Get document types from config, including imported types
         * @returns {Array} Array of document type objects with id, label, description, icon, and source
         */
        getUniqueTypes() {
            const configTypes = [];
            const importedTypes = [];

            // Get native types from config
            if (window.PROJECT_CONFIG && window.PROJECT_CONFIG.documentTypes) {
                window.PROJECT_CONFIG.documentTypes.forEach(type => {
                    configTypes.push({
                        id: type.id,
                        name: type.id, // For backward compatibility
                        label: type.label,
                        description: type.description,
                        icon: type.icon,
                        source: 'native'
                    });
                });
            }

            // Get imported types from flows (stored in window.importedDocumentTypes)
            if (window.importedDocumentTypes && Array.isArray(window.importedDocumentTypes)) {
                window.importedDocumentTypes.forEach(type => {
                    // Only add if not already in config types
                    if (!configTypes.find(t => t.id === type.id)) {
                        importedTypes.push({
                            id: type.id,
                            name: type.id, // For backward compatibility
                            label: type.label || type.name || type.id,
                            description: type.description || 'Document',
                            icon: type.icon || 'file-text',
                            source: 'imported'
                        });
                    }
                });
            }

            return [...configTypes, ...importedTypes];
        },

        /**
         * Get document type description
         * @param {string} type - Document type ID
         * @returns {string} Description of the document type
         */
        getDescription(type) {
            const allTypes = this.getUniqueTypes();
            const docType = allTypes.find(t => t.id === type || t.name === type);
            return docType ? docType.description : 'Document';
        },

        /**
         * Get document type label
         * @param {string} type - Document type ID
         * @returns {string} Label of the document type
         */
        getLabel(type) {
            const allTypes = this.getUniqueTypes();
            const docType = allTypes.find(t => t.id === type || t.name === type);
            return docType ? docType.label : type;
        },

        /**
         * Get document type icon
         * @param {string} documentType - Document type ID
         * @returns {string} Icon HTML for the document type
         */
        getIcon(documentType) {
            const allTypes = this.getUniqueTypes();
            const docType = allTypes.find(t => t.id === documentType || t.name === documentType);
            const iconName = docType ? docType.icon : 'file-text';
            return `<i data-feather="${iconName}" class="icon-sm"></i>`;
        },

        /**
         * Register imported document types from a flow
         * @param {Array} documentTypes - Array of document type definitions from imported flow
         */
        registerImportedTypes(documentTypes) {
            if (!window.importedDocumentTypes) {
                window.importedDocumentTypes = [];
            }

            if (Array.isArray(documentTypes)) {
                documentTypes.forEach(type => {
                    // Only add if not already registered
                    const exists = window.importedDocumentTypes.find(t => t.id === type.id);
                    if (!exists) {
                        window.importedDocumentTypes.push({
                            id: type.id,
                            label: type.label || type.name || type.id,
                            description: type.description || 'Document',
                            icon: type.icon || 'file-text'
                        });
                    }
                });
            }
        }
    },

    /**
     * ID Generation Utilities
     * Common functions for generating and parsing unique identifiers
     */
    ID: {
        /**
         * Generate a unique material identifier for a specific flow
         * @param {string} originalIdentifier - Original material identifier
         * @param {string} flowId - Flow identifier
         * @returns {string} Flow-specific material identifier
         */
        generateFlowMaterialId(originalIdentifier, flowId) {
            return `${originalIdentifier}_flow_${flowId}`;
        },

        /**
         * Get the original material identifier from a flow-specific identifier
         * @param {string} flowMaterialId - Flow-specific material identifier
         * @returns {string} Original material identifier
         */
        getOriginalMaterialId(flowMaterialId) {
            // This delegates to the materials manager since it has the logic
            if (window.demoApp && window.demoApp.materials) {
                return window.demoApp.materials.getOriginalMaterialId(flowMaterialId);
            }
            // Fallback: simple parsing if no app instance available
            return flowMaterialId.replace(/_flow_.*$/, '');
        }
    },

    /**
     * Performance Utilities
     */
    Performance: {
        /**
         * Measure execution time of function
         * @param {Function} fn - Function to measure
         * @param {string} name - Name for logging
         * @returns {Promise<number>} - Execution time in milliseconds
         */
        async measureTime(fn, name = 'Function') {
            const start = performance.now();
            const result = await fn();
            const end = performance.now();
            const duration = Math.round(end - start);
            return { result, duration };
        },

        /**
         * Create performance mark
         * @param {string} name - Mark name
         */
        mark(name) {
            if (performance.mark) {
                performance.mark(name);
            }
        },

        /**
         * Measure between two performance marks
         * @param {string} startMark - Start mark name
         * @param {string} endMark - End mark name
         * @param {string} measureName - Measure name
         */
        measure(startMark, endMark, measureName) {
            if (performance.measure) {
                performance.measure(measureName, startMark, endMark);
            }
        }
    }
};

// Freeze the utilities to prevent modifications
Object.freeze(Utils);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
} else {
    window.Utils = Utils;
} 