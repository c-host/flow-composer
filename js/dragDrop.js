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
            console.error('❌ Materials assignment container not found');
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

        // Clear existing event listeners by cloning and replacing the container
        // Use requestAnimationFrame to batch DOM operations and prevent forced reflows
        requestAnimationFrame(() => {
            // Don't re-initialize if drag is in progress
            if (this.draggedIdentifier) {
                return;
            }

            // Store current drag state before DOM manipulation
            const currentDragState = this.draggedIdentifier;

            const newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);
            container = newContainer;

            // Restore drag state after DOM manipulation
            this.draggedIdentifier = currentDragState;

            // Add new event listeners
            container.addEventListener('dragover', this.handleDragOver.bind(this));
            container.addEventListener('drop', this.handleDrop.bind(this));

            // Setup drag handles for each material
            const dragHandles = container.querySelectorAll('.material-drag-handle');

            dragHandles.forEach(handle => {
                // Add new listeners with proper binding
                handle.addEventListener('dragstart', this.handleDragStart.bind(this));
                handle.addEventListener('dragend', this.handleDragEnd.bind(this));
            });
        });
    }

    /**
     * Handle drag start
     */
    handleDragStart(event) {

        // Prevent multiple drag starts
        if (this.draggedIdentifier) {
            return;
        }

        const materialItem = event.target.closest('.material-assignment-item');
        if (!materialItem) {
            console.error('❌ No material item found for drag start');
            return;
        }

        // Store the dragged element identifier
        this.draggedIdentifier = materialItem.dataset.identifier;

        // Set drag data
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this.draggedIdentifier);

        // Add visual feedback
        materialItem.classList.add('dragging');

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
            // Debug logging removed
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
            console.error('❌ No dragged identifier found for drop');
            return;
        }

        const container = event.currentTarget;
        const draggedElement = container.querySelector(`[data-identifier="${this.draggedIdentifier}"]`);

        if (!draggedElement) {
            console.error('❌ Dragged element not found in container');
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
        // Debug logging removed
        this.updateMaterialsOrder();

        // Update document type coverage
        this.delegateToApp('updateDocumentTypeCoverage');

        // Clean up
        this.draggedIdentifier = null;
        // Debug logging removed
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
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.material-assignment-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Update materials order in data model
     */
    updateMaterialsOrder() {
        // Debug logging removed
        const container = document.querySelector('#materials-assignment-list');
        if (!container) {
            console.error('❌ Container not found for updating materials order');
            return;
        }

        const materialItems = container.querySelectorAll('.material-assignment-item');
        // Debug logging removed

        const newOrder = [];

        // Get selectedMaterials from the app instance
        const app = this.getAppInstance();
        if (!app) {
            console.error('❌ App instance not available for updating materials order');
            return;
        }

        // Get selected materials from the material manager instead of app.selectedMaterials
        let selectedMaterials = [];
        if (app.materials && app.materials.getSelectedMaterials) {
            selectedMaterials = app.materials.getSelectedMaterials();
        } else if (app.selectedMaterials && Array.isArray(app.selectedMaterials)) {
            selectedMaterials = app.selectedMaterials;
        } else {
            console.error('❌ No selectedMaterials available from material manager or app');
            return;
        }

        if (!Array.isArray(selectedMaterials)) {
            console.error('❌ selectedMaterials is not an array:', selectedMaterials);
            return;
        }

        materialItems.forEach((item, index) => {
            const identifier = item.dataset.identifier;

            const material = selectedMaterials.find(m => m.identifier === identifier);
            if (material) {
                newOrder.push(material);
                // Debug logging removed
            } else {
            }
        });

        // Debug logging removed

        // Update the material manager's selectedMaterials
        if (app.materials && app.materials.setSelectedMaterials) {
            app.materials.setSelectedMaterials(newOrder);
        } else {
            // Fallback to app.selectedMaterials if material manager method not available
            app.selectedMaterials = newOrder;
        }
        // Debug logging removed
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

        // Debug logging removed
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
