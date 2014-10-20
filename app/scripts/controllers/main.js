'use strict';

/**
 * @ngdoc function
 * @name todoApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the todoApp
 */
angular.module('todoApp')
  .controller('TasksListCtrl', function ($scope) {
    $scope.tasks = [
      'T1',
      'T2',
      'T3'
    ];
  });
