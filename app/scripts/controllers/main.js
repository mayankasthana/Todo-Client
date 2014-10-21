'use strict';

/**
 * @ngdoc function
 * @name todoApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the todoApp
 */
angular.module('todoApp', ['ui.bootstrap', 'ngDragDrop'])
        .controller('TodoCtrl', function($scope, $http) {
            $scope.newTask = {};
            
            $http.get('http://localhost:8000/public/api/tasks').success(function(data) {
                $scope.tasks = data;
                console.log(data);
                getTaskMembers();
            });
            $http.get('http://localhost:8000/public/api/users').success(function(data) {
                $scope.users = data;
            });
            function getTaskMembers() {
                console.log($scope.tasks.length);
                $scope.tasks.forEach(function(task) {
                    $http.get('http://localhost:8000/public/api/task/' + task.id + '/users').success(function(data) {
                        task.members = data;
                        console.log("Task members")
                        console.log(data);
                    });
                });
            }
            $scope.sortByDate = function(task){
                var date = new Date(task.created_at);
                //console.log("date");
                //console.log(date);
                return date;
            };
            $scope.orderPredicates = [{'displayOption': 'Priority - High to Low', 'pred': 'priority'},
                {'displayOption': 'Priority - Low to High', 'pred': '-priority'},
                {'displayOption': 'Date - Oldest first', 'pred': $scope.sortByDate}
            ];

            $scope.addNewTask = function(input) {
                //get currently logged in user token and send
                //Put 
                if(input.length==0)
                    return;
                var data = {};
                data['newTaskText'] = input;
                data['userId'] = $scope.users[0].id;
                $http.post('http://localhost:8000/public/api/task', data).success(function(task) {
                    $scope.tasks.push(task);
                    $scope.newTask.text = ''; 
                });
            };
            $scope.printStatus = function(status) {
                console.log(status);
            };
            $scope.incPriority = function(task) {
                if (task.priority > 1)
                    task.priority -= 1;
                $scope.tasks.forEach(function(task_elem){
                    if(task.priority === task_elem.priority && task.id !== task_elem.id){
                        task_elem.priority+=1;
                }
                });
            };
            $scope.decPriority = function(task) {
                if (task.priority !== $scope.minPriority())
                    task.priority += 1;
                $scope.tasks.forEach(function(task_elem){
                    if(task.priority === task_elem.priority && task.id !== task_elem.id){
                        task_elem.priority-=1;
                }
                });                
            };
            $scope.minPriority = function() {
                var minPriorit = 0;
                for (var i = 0; i < $scope.tasks.length; i++) {
                    if ($scope.tasks[i].priority > minPriorit)
                        minPriorit = $scope.tasks[i].priority;
                }
                return minPriorit;
            }

            $scope.removeTask = function(task) {
                console.log("trying to remove task");
                $http.delete('http://localhost:8000/public/api/task/' + task.id).success(function(res) {
                    $scope.tasks = $scope.tasks.filter(function(el) {
                        return el.id !== task.id;
                    });
                }).error(function(err) {
                    console.log("error in delete");
                });
            };
            $scope.addMember = function(task) {
                if (task.members === undefined)
                    task.members = [];
                if (task.newMember !== undefined)
                    task.members.push(task.newMember.id);
                delete task.newMember;
            };

            $scope.removeMember = function(task, member) {
                task.members = task.members.filter(function(taskMem) {
                    return taskMem !== member;
                });
            };
        });
