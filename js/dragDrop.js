/**
 * Drag & Drop Management
 * Handles all drag and drop functionality for the application
 */

class DragDropManager {
    constructor(stateManager, eventManager) {
        this.state = stateManager;
        this.events = eventManager;
        this.draggedIdentifier = null;
        this.dragGhost = null;
        this.isInitialized = false;
        this.lastMaterialCount = 0;
        this.dragDropAbortController = null; // For cleaning up event listeners
    }

    /**
     * Setup drag and drop for material reordering
     */
    setupMaterialDragAndDrop() {
        // Check if already initialized to prevent multiple setups
        if (this.isInitialized) {
            return;
        }

        // Try multiple ways to find the container
        let container = document.getElementById('materials-assignment-list');
        if (!container) {
            container = document.querySelector('#materials-assignment-list');
        }
        if (!container) {
            container = document.querySelector('.materials-assignment #materials-assignment-list');
        }
        if (!container) {
            container = document.querySelector('[id="materials-assignment-list"]');
        }


        if (!container) {
            console.error('Materials assignment container not found');
            console.error('🔍 Available elements with similar IDs:');
            document.querySelectorAll('[id*="materials"]').forEach(el => {
                console.error('  -', el.id, el.tagName, el.className);
            });
            return;
        }

        // Check if materials exist before setting up drag-drop
        const materialItems = container.querySelectorAll('.material-assignment-item');
        if (materialItems.length === 0) {
            // Don't mark as initialized if no materials found
            return;
        }

        // Mark as initialized
        this.isInitialized = true;

        // CRITICAL FIX: Use event delegation instead of cloning container
        // Cloning destroys Quill instances! Instead, remove old listeners and add new ones
        // Use requestAnimationFrame to batch DOM operations
        requestAnimationFrame(() => {
            // Don't re-initialize if drag is in progress
            if (this.draggedIdentifier) {
                return;
            }

            // Remove old event listeners if they exist (using AbortController for clean removal)
            if (this.dragDropAbortController) {
                this.dragDropAbortController.abort();
            }
            this.dragDropAbortController = new AbortController();
            const signal = this.dragDropAbortController.signal;

            // Use event delegation on the container for drag events
            // This way we don't need to attach listeners to individual elements
            container.addEventListener('dragover', this.handleDragOver.bind(this), { signal });
            container.addEventListener('drop', this.handleDrop.bind(this), { signal });

            // Use event delegation for dragstart and dragend on drag handles
            // The drag handle has draggable="true", so the browser will make it draggable
            container.addEventListener('dragstart', (e) => {
                // Only handle if the drag started on or inside a drag handle
                const dragHandle = e.target.closest('.material-drag-handle');
                if (dragHandle && dragHandle.hasAttribute('draggable')) {
                    this.handleDragStart(e);
                }
            }, { signal });

            container.addEventListener('dragend', (e) => {
                // Only handle if the drag ended on or inside a drag handle
                const dragHandle = e.target.closest('.material-drag-handle');
                if (dragHandle && dragHandle.hasAttribute('draggable')) {
                    this.handleDragEnd(e);
                }
            }, { signal });
        });
    }

    /**
     * Handle drag start
     */
    handleDragStart(event) {
        // Prevent drag if clicking on Quill editor elements
        const quillElement = event.target.closest('.material-notes-editor, .ql-toolbar, .ql-container, .ql-editor');
        if (quillElement) {
            event.preventDefault();
            return;
        }

        // Prevent multiple drag starts
        if (this.draggedIdentifier) {
            return;
        }

        const materialItem = event.target.closest('.material-assignment-item');
        if (!materialItem) {
            console.error('No material item found for drag start');
            return;
        }

        // Store the dragged element identifier
        this.draggedIdentifier = materialItem.dataset.identifier;


        // Set drag data
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this.draggedIdentifier);

        // Add visual feedback
        materialItem.classList.add('dragging');

        // Log CSS state of Quill elements - use getElementById to find the actual editor
        const materialId = materialItem.dataset.identifier;
        const quillEditor = document.getElementById(`quill-editor-${materialId}`);

        if (quillEditor) {
            // Quill creates its own structure inside the editor element
            const toolbar = quillEditor.querySelector('.ql-toolbar');
            const container = quillEditor.querySelector('.ql-container');
            const editor = quillEditor.querySelector('.ql-editor');

        }

        // Create a semi-transparent clone for visual feedback
        const rect = materialItem.getBoundingClientRect();
        this.dragGhost = materialItem.cloneNode(true);
        this.dragGhost.style.position = 'fixed';
        this.dragGhost.style.top = rect.top + 'px';
        this.dragGhost.style.left = rect.left + 'px';
        this.dragGhost.style.width = rect.width + 'px';
        this.dragGhost.style.opacity = '0.5';
        this.dragGhost.style.pointerEvents = 'none';
        this.dragGhost.style.zIndex = '1000';
        this.dragGhost.style.transform = 'rotate(2deg)';
        this.dragGhost.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        document.body.appendChild(this.dragGhost);
    }

    /**
     * Handle drag over
     */
    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const container = event.currentTarget;
        const draggedElement = container.querySelector(`[data-identifier="${this.draggedIdentifier}"]`);

        if (!draggedElement || !this.draggedIdentifier) {
            return;
        }

        // Remove existing drop indicators
        container.querySelectorAll('.drop-indicator').forEach(el => el.remove());

        const afterElement = this.getDragAfterElement(container, event.clientY);

        if (afterElement) {
            // Insert drop indicator
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.style.height = '2px';
            indicator.style.backgroundColor = 'var(--primary-color)';
            indicator.style.margin = '4px 0';
            container.insertBefore(indicator, afterElement);
        } else {
            // Insert at the end
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.style.height = '2px';
            indicator.style.backgroundColor = 'var(--primary-color)';
            indicator.style.margin = '4px 0';
            container.appendChild(indicator);
        }
    }

    /**
     * Handle drop
     */
    handleDrop(event) {
        event.preventDefault();

        if (!this.draggedIdentifier) {
            console.error('No dragged identifier found for drop');
            return;
        }

        const container = event.currentTarget;
        const draggedElement = container.querySelector(`[data-identifier="${this.draggedIdentifier}"]`);

        if (!draggedElement) {
            console.error('Dragged element not found in container');
            return;
        }

        // Remove drop indicators
        container.querySelectorAll('.drop-indicator').forEach(el => el.remove());

        // Get the drop position
        const afterElement = this.getDragAfterElement(container, event.clientY);

        // Move the element in the DOM
        if (afterElement) {
            container.insertBefore(draggedElement, afterElement);
        } else {
            container.appendChild(draggedElement);
        }

        // Update the data model
        this.updateMaterialsOrder();

        // Update document type coverage
        this.delegateToApp('updateDocumentTypeCoverage');

        // Clean up
        this.draggedIdentifier = null;
    }

    /**
     * Handle drag end
     */
    handleDragEnd(event) {
        // Remove visual feedback
        const materialItem = event.target.closest('.material-assignment-item');
        if (materialItem) {
            materialItem.classList.remove('dragging');
        }

        // Remove drop indicators
        const container = document.querySelector('#materials-assignment-list');
        if (container) {
            container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        }

        // Remove drag ghost
        if (this.dragGhost) {
            if (document.body.contains(this.dragGhost)) {
                document.body.removeChild(this.dragGhost);
            }
            this.dragGhost = null;
        }

        // Only clear dragged identifier if drop was not successful
        // The identifier will be cleared in handleDrop() after successful drop
        if (this.draggedIdentifier) {
            this.draggedIdentifier = null;
        }
    }

    /**
     * Get element after which to insert dragged element
     * Returns the element that should come after the dragged element (i.e., insert before this element)
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.material-assignment-item:not(.dragging)')];

        if (draggableElements.length === 0) {
            return null;
        }

        // Find the element that should come after the insertion point
        // We iterate through elements and find where the cursor position falls
        for (let i = 0; i < draggableElements.length; i++) {
            const child = draggableElements[i];
            const box = child.getBoundingClientRect();
            const centerY = box.top + box.height / 2;

            // If cursor is above the center of this element, insert before it
            if (y < centerY) {
                return child;
            }
        }

        // If cursor is below all elements, return null to append at end
        return null;
    }

    /**
     * Update materials order in data model
     */
    updateMaterialsOrder() {
        const container = document.querySelector('#materials-assignment-list');
        if (!container) {
            console.error('Container not found for updating materials order');
            return;
        }

        const materialItems = container.querySelectorAll('.material-assignment-item');

        const newOrder = [];

        // Get selectedMaterials from the app instance
        const app = this.getAppInstance();
        if (!app) {
            console.error('App instance not available for updating materials order');
            return;
        }

        // Get selected materials from the material manager instead of app.selectedMaterials
        let selectedMaterials = [];
        if (app.materials && app.materials.getSelectedMaterials) {
            selectedMaterials = app.materials.getSelectedMaterials();
        } else if (app.selectedMaterials && Array.isArray(app.selectedMaterials)) {
            selectedMaterials = app.selectedMaterials;
        } else {
            console.error('No selectedMaterials available from material manager or app');
            return;
        }

        if (!Array.isArray(selectedMaterials)) {
            console.error('selectedMaterials is not an array:', selectedMaterials);
            return;
        }

        materialItems.forEach((item, index) => {
            const identifier = item.dataset.identifier;

            const material = selectedMaterials.find(m => m.identifier === identifier);
            if (material) {
                newOrder.push(material);
            }
        });

        // Update the material manager's selectedMaterials
        if (app.materials && app.materials.setSelectedMaterials) {
            app.materials.setSelectedMaterials(newOrder);
        } else {
            // Fallback to app.selectedMaterials if material manager method not available
            app.selectedMaterials = newOrder;
        }
    }

    /**
     * Re-setup drag and drop when materials are added
     * @param {boolean} forceReinitialize - Force re-initialization even if already initialized
     */
    reinitializeDragDrop(forceReinitialize = false) {

        // Don't re-initialize if drag is in progress
        if (this.draggedIdentifier) {
            return;
        }

        // Check if materials actually exist before re-initializing
        const container = document.getElementById('materials-assignment-list');
        if (!container) {
            return;
        }

        const materialItems = container.querySelectorAll('.material-assignment-item');
        if (materialItems.length === 0) {
            return;
        }

        // Always re-initialize if forced, or if not already initialized, or if material count changed
        if (forceReinitialize || !this.isInitialized || this.lastMaterialCount !== materialItems.length) {
            this.lastMaterialCount = materialItems.length;
            this.isInitialized = false;

            // Use setTimeout to ensure DOM is fully updated before re-initializing
            setTimeout(() => {
                // Double-check drag state before proceeding
                if (!this.draggedIdentifier) {
                    this.setupMaterialDragAndDrop();
                }
            }, 50);
        } else {
        }
    }

    /**
     * Clean up drag artifacts (ghost elements, drop indicators, etc.)
     */
    cleanupDragArtifacts() {
        // Remove any remaining drag ghost elements
        const ghostElements = document.querySelectorAll('[style*="position: fixed"][style*="opacity: 0.5"]');
        ghostElements.forEach(element => {
            if (document.body.contains(element)) {
                document.body.removeChild(element);
            }
        });

        // Remove drop indicators
        const dropIndicators = document.querySelectorAll('.drop-indicator');
        dropIndicators.forEach(indicator => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        });

        // Remove dragging class from all elements
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(element => {
            element.classList.remove('dragging');
        });

        // Clear dragged identifier
        this.draggedIdentifier = null;
        this.dragGhost = null;

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
            console.warn(`DragDropManager: Method '${methodName}' not found on demoApp. Available methods:`,
                app ? Object.getOwnPropertyNames(Object.getPrototypeOf(app)) : 'demoApp not available');
            return null;
        }
    }
}

// Initialize and expose globally
window.dragDropManager = new DragDropManager(window.stateManager || null, window.eventManager || null);

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
    module.exports = { DragDropManager };
} else {
    window.DragDropManager = DragDropManager;
}
