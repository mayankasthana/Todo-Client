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
      });
      $http.get('http://localhost:8000/public/api/users').success(function(data){
          $scope.users = data;
      });
      $scope.addNewTask = function(input){
          console.log(input);
          //get currently logged in user token and send
          //Put 
          $http.put('http://localhost:8000/public/api/addTask').success(function(task){
              $scope.tasks.push(task);
          });
      }
  });
