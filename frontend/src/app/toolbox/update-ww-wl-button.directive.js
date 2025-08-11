// frontend/src/app/toolbox/update-ww-wl-button.directive.js

angular.module('app.toolbox')
  .directive('updateWwlButton', function (UpdateWWWLService) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: 'app/toolbox/update-ww-wl-button.popover.html', // Link to the HTML template
      link: function (scope, element, attrs) {
        // Define the function when button is clicked
        scope.updateWWWL = function () {
          // Call the service to handle the window/level update logic
          UpdateWWWLService.updateWWWLTags(scope.vm);
        };
      }
    };
  });