/**
 * Import/Export & Statistics Manager
 * Handles flow import/export functionality and statistics
 */

class ImportExportManager {
    constructor(stateManager, eventManager) {
        this.state = stateManager;
        this.events = eventManager;
    }

    /**
     * Export flow to JSON file
     * @param {string} flowId - ID of the flow to export
     */
    exportFlow(flowId) {
        const createdFlows = this.state.get('createdFlows') || [];
        const flow = createdFlows.find(f => f.id === flowId);
        if (!flow) return;

        const flowData = JSON.stringify(flow, null, 2);
        const blob = new Blob([flowData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${flow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_flow.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification(`Flow "${flow.name}" exported successfully!`, 'success');
    }

    /**
     * Export all flows to JSON file
     */
    exportAllFlows() {
        const createdFlows = this.state.get('createdFlows') || [];
        if (createdFlows.length === 0) {
            this.showNotification('No flows to export', 'error');
            return;
        }

        const flowsData = JSON.stringify(createdFlows, null, 2);
        const blob = new Blob([flowsData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `flow_composer_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification(`Exported ${createdFlows.length} flows successfully!`, 'success');
    }

    /**
     * Import flows from JSON file
     */
    importFlows() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.multiple = false;

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importedData = JSON.parse(text);

                let flowsToImport = [];
                if (Array.isArray(importedData)) {
                    flowsToImport = importedData;
                } else {
                    flowsToImport = [importedData];
                }

                // Validate and process imported flows
                const validFlows = flowsToImport.filter(flow =>
                    flow.id && flow.name && flow.materials && Array.isArray(flow.materials)
                );

                if (validFlows.length === 0) {
                    this.showNotification('No valid flows found in the file', 'error');
                    return;
                }

                // Get current flows and add imported flows with new IDs to avoid conflicts
                const currentFlows = window.demoApp ? window.demoApp.createdFlows || [] : this.state.get('createdFlows') || [];
                const newFlows = [];

                for (const flow of validFlows) {
                    const newFlow = {
                        ...flow,
                        id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        created: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                        version: 1
                    };
                    newFlows.push(newFlow);
                }

                // Update state with new flows
                this.state.set('createdFlows', [...currentFlows, ...newFlows]);

                // Also update the app's createdFlows array
                if (window.demoApp) {
                    window.demoApp.createdFlows = [...currentFlows, ...newFlows];
                }

                // Emit event to update UI
                this.events.emit('flows:imported', { count: validFlows.length });

                this.showNotification(`Imported ${validFlows.length} flows successfully!`, 'success');

            } catch (error) {
                console.error('Error importing flows:', error);
                this.showNotification('Error importing flows. Please check the file format.', 'error');
            }
        };

        input.click();
    }



    /**
     * Show notification message
     * @param {string} message - Message to display
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        if (window.Utils && window.Utils.Notification) {
            window.Utils.Notification.show(message, type);
        } else {
            // Fallback to console if Utils not available
        }
    }
}

// Initialize and expose globally
window.importExportManager = new ImportExportManager(stateManager, eventManager);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImportExportManager };
} else {
    window.ImportExportManager = ImportExportManager;
}
