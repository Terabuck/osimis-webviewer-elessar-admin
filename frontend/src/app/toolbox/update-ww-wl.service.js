// frontend/src/app/toolbox/update-ww-wl.service.js
angular.module('app.toolbox')
    .service('UpdateWWWLService', function($http, $scope) {
        
        this.isUpdatingWWWL = false;
        this.updateProgress = 0;
        this.updateStatus = [];

        // Safe Apply function for AngularJS digest cycle
        const safeApply = (fn) => {
            const phase = $scope.$root.$$phase;
            if (phase === '$apply' || phase === '$digest') {
                fn();
            } else {
                $scope.$apply(fn);
            }
        };

        this.updateWWWLTags = async function(vm) {
            console.log('[updateWWWLTags] Starting update process...');
            this.isUpdatingWWWL = true;
            this.updateProgress = 0;
            this.updateStatus = [];

            for (let i = 0; i < vm.panes.length; i++) {
                if (!vm.panes[i] || !vm.panes[i].csViewport || !vm.panes[i].csViewport.getCurrentImage()) {
                    this.updateStatus[i] = 'Skipped: No image loaded';
                    continue;
                }

                const pane = vm.panes[i];
                const image = pane.csViewport.getCurrentImage();
                const instanceId = image.instanceId;

                try {
                    // Update progress
                    this.updateStatus[i] = `Processing instance ${instanceId}`;
                    this.updateProgress = (i / vm.panes.length) * 100;
                    safeApply(() => {});

                    // 1. Modify via Orthanc
                    const modifyRes = await $http({
                        method: 'POST',
                        url: `/orthanc/instances/${instanceId}/modify`,
                        data: {
                            Replace: {
                                WindowWidth: image.windowWidth,
                                WindowCenter: image.windowCenter,
                                SOPInstanceUID: generateNewUID() // Critical for new instance
                            },
                            Force: true
                        },
                        responseType: 'blob',
                        headers: {'Content-Type': 'application/json'}
                    });

                    // 2. Upload modified instance
                    const uploadRes = await $http({
                        method: 'POST',
                        url: '/orthanc/instances',
                        data: modifyRes.data,
                        headers: {'Content-Type': 'application/dicom'}
                    });

                    const newInstanceId = uploadRes.data.ID;

                    // 3. Delete original instance
                    await $http.delete(`/orthanc/instances/${instanceId}`);

                    // 4. Update viewer with new instance
                    pane.csViewport.setImage(newInstanceId);
                    pane.csViewport.refresh();

                    // Record success
                    this.updateStatus[i] = `Updated successfully! New ID: ${newInstanceId}`;

                } catch (error) {
                    this.updateStatus[i] = `Error: ${error.data || error.statusText || 'Unknown error'}`;
                    console.error(`Failed to update instance ${instanceId}:`, error);
                }

                // Update progress
                this.updateProgress = ((i + 1) / vm.panes.length) * 100;
                safeApply(() => {});
            }

            this.isUpdatingWWWL = false;
            safeApply(() => {});

            // Generate audit log
            generateAuditReport(this.updateStatus);
        };

        // UID generator (DICOM compliant)
        function generateNewUID() {
            const root = '1.2.826.0.1.3680043.10.5113'; // Your organization's OID
            const random = Math.floor(Math.random() * 1000000000);
            const timestamp = Date.now();
            return `${root}.${timestamp}.${random}`;
        }

        // Audit logging for QA
        function generateAuditReport(statuses) {
            const report = {
                timestamp: new Date().toISOString(),
                user: 'admin', // Replace with actual user
                operations: statuses.map((status, i) => ({
                    pane: i,
                    status: status.includes('Error') ? 'Failed' : 
                           status.includes('Skipped') ? 'Skipped' : 'Success',
                    message: status
                }))
            };

            // Send to server or save locally
            $http.post('/api/audit/ww-wl-update', report);
        }
    });