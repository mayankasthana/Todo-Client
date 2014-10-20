'use strict';

/**
 * @ngdoc function
 * @name todoApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the todoApp
 */
angular.module('todoApp')
  .controller('TodoCtrl', function ($scope,$http) {
      $http.get('http://localhost:8000/public/api/tasks').success(function(data){
          $scope.tasks = data;
          console.log($scope.tasks);
      });
      $http.get('http://localhost:8000/public/api/users').success(function(data){
          $scope.users = data;
      });
  });
