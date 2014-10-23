'use strict';

/**
 * @ngdoc function
 * @name todoApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the todoApp
 */
angular.module('todoApp', ['ui.bootstrap', 'ngDragDrop', 'directive.g+signin', 'ngCookies'])
        .config(['$httpProvider', function($httpProvider) {
                $httpProvider.defaults.useXDomain = true;
                //$httpProvider.defaults.withCredentials = true;
                delete $httpProvider.defaults.headers.common['X-Requested-With'];
            }])
        .service('Util', ['$location', function($location) {
                this.serverURL = function() {
                    console.log($location.host());
                    if ($location.host() === 'localhost') {
                        return 'http://localhost:8000/public/';
                    }
                    else if ($location.host().contains('mayankasthana')) {
                        return 'http://todoserver.mayankasthana.com/public/'
                    }
                    else
                        return null;
                }();
            }])
        .service('Auth', ['$http','Util', function($http,Util) {
                var self = this;
                this.isLoggedin = {val: false};
                this.successGAuthCallback = function(event, authResult) {
                    console.log("signed in from google");
                    console.log(authResult);
                    $http.post(Util.serverURL+'api/login',
                            {
                                "code": authResult['code'],
                                "access_token": authResult['access_token'],
                                "gplus_id": authResult['gplus_id']
                            }).success(function(user) {
                        console.log("Sign in successful from server");
                        self.access_token = authResult['access_token'];
                        self.isLoggedin.val = true;
                        self.me = user;
                        console.log(user);
                        console.log('Logged in? ' + self.isLoggedin.val);
                    }).error(function(err) {
                        console.log(err);
                    });
                }
            }])
        .controller('TodoCtrl', function($scope, $http, $cookies, Auth, Util) {
            $scope.isLoggedin = Auth.isLoggedin;
            $scope.me = Auth.me;
            console.log(Util.serverURL);
            $scope.newTask = {};
            $scope.activeTaskId = 0;
            $scope.$on('event:google-plus-signin-success', Auth.successGAuthCallback);
            $scope.$on('event:google-plus-signin-failure', function(event, authResult) {
                // Auth failure or signout detected
            });
            $http.get(Util.serverURL+'api/tasks?access_token=' + $scope.access_token).success(function(data) {
                $scope.tasks = data;
                console.log(data);
                getTaskMembers();
            });
            $http.get(Util.serverURL+'api/users?access_token=' + $scope.access_token).success(function(data) {
                $scope.users = data;
            });
            function getTaskMembers() {
                $scope.tasks.forEach(function(task) {
                    $http.get(Util.serverURL+'api/task/' + task.id + '/users?access_token=' + $scope.access_token).success(function(data) {
                        task.members = data;
                    });
                });
            }
            $scope.getTaskComments = function(task) {
                $http.get(Util.serverURL+'api/task/' + task.id + '/comments').success(function(comments) {
                    task.comments = comments;
                });
            }
            $scope.sortByDate = function(task) {
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
                if (input.length == 0)
                    return;
                var data = {};
                data['newTaskText'] = input;
                data['userId'] = Auth.me.id;
                console.log(Auth.me);
                $http.post(Util.serverURL+'api/task?access_token=' + $scope.access_token, data).success(function(task) {
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
                $scope.tasks.forEach(function(task_elem) {
                    if (task.priority === task_elem.priority && task.id !== task_elem.id) {
                        task_elem.priority += 1;
                    }
                });
            };
            $scope.decPriority = function(task) {
                if (task.priority !== $scope.minPriority())
                    task.priority += 1;
                $scope.tasks.forEach(function(task_elem) {
                    if (task.priority === task_elem.priority && task.id !== task_elem.id) {
                        task_elem.priority -= 1;
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
                $http.delete(Util.serverURL+'api/task/' + task.id + '?access_token=' + $scope.access_token).success(function(res) {
                    $scope.tasks = $scope.tasks.filter(function(el) {
                        if (el.priority > task.priority)
                            el.priority -= 1;
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
            $scope.$watch('tasks', function(oldVal, newVal) {
                console.log("watch tasks changed");
            });
            $scope.syncTask = function(task) {

            };
            $scope.addComment = function(task, commentText) {
                if (commentText.length == 0)
                    return;
                $http.put(Util.serverURL+'api/task/' + task.id + '/comment',
                        {
                            comment: commentText,
                            userId: Auth.me.id
                        }
                ).success(function(commentObj) {
                    if (task.comments == undefined)
                        task.comments = [];
                    task.comments.push(commentObj);
                    task.newComment = '';
                }).error(function(err) {
                    console.log(err);
                });
            }
            $scope.toggleaActiveState = function(task) {
                if (task.id !== $scope.activeTaskId) {
                    $scope.activeTaskId = task.id;
                    $scope.getTaskComments(task);
                }
                else
                    $scope.activeTaskId = 0;
            }
            $scope.userById = function(uid) {

                var users = $scope.users.filter(function(user) {
                    return user.id == uid;
                });
                if (users.length > 0)
                    return users[0];
                else
                    return null;
            }
        });
function signInCallback(authResult) {
    console.log(authResult);
}