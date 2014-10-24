'use strict';
/**
 * @ngdoc function
 * @name todoApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the todoApp
 */
angular.module('todoApp', ['ui.bootstrap', 'ngDragDrop', 'directive.g+signin', 'ngCookies', 'angular-loading-bar', 'ngAnimate'])
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
        .service('Auth', ['$http', 'Util', '$rootScope', function($http, Util, $rootScope) {
                var self = this;
                this.isLoggedin = {val: false};
                this.successGAuthCallback = function(event, authResult) {
                    console.log("signed in from google");
                    console.log(authResult);
                    $http.post(Util.serverURL + 'api/login',
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
                        $rootScope.$broadcast('loggedIn');
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
            $scope.users = [];
            $scope.tasks = [];
            $scope.activeTaskId = 0;
            $scope.$on('loggedIn', function(event) {
                // alert('Hi ' + Auth.me.displayName + '!');
                $http.get(Util.serverURL + 'api/tasks?access_token=' + $scope.access_token).success(function(data) {
                    $scope.tasks = data;
                    getTaskMembers();
                });
                $http.get(Util.serverURL + 'api/users?access_token=' + $scope.access_token).success(function(data) {
                    $scope.users = data;
                });
            });
            $scope.$on('event:google-plus-signin-success', Auth.successGAuthCallback);
            $scope.$on('event:google-plus-signin-failure', function(event, authResult) {
                // Auth failure or signout detected
            });
            function getTaskMembers() {
                $scope.tasks.forEach(function(task) {
                    $http.get(Util.serverURL + 'api/task/' + task.id + '/users?access_token=' + $scope.access_token).success(function(data) {
                        task.members = data;
                    });
                });
            }
            $scope.getTaskComments = function(task) {
                $http.get(Util.serverURL + 'api/task/' + task.id + '/comments').success(function(comments) {
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
                //{'displayOption': 'Date - Oldest first', 'pred': $scope.sortByDate}
                {'displayOption': 'Date - Oldest first', 'pred': 'id'},
                {'displayOption': 'Date - Newest first', 'pred': '-id'}
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
                $http.post(Util.serverURL + 'api/task?access_token=' + $scope.access_token, data).success(function(task) {
                    $scope.tasks.push(task);
                    $scope.newTask.text = '';
                });
            };
            $scope.candidateMembers = function(task) {
                return $scope.users.filter(function(user) {
                    if (task.members === undefined)
                        return true;
                    return task.members.indexOf(user.id) === -1;
//                    for (var i = 0; i < task.members.length; i++) {
//                        var mem = task.members[i];
//                        
//                        if (mem === user.id) {
//                            return false;
//                        }
//                    }

                });
            }
            $scope.printStatus = function(status) {
                console.log(status);
            };
            $scope.setAllPriorities = function(tasks, priorityList) {
                tasks.forEach(function(task) {
                    var pr = priorityList.filter(function(taskPriority) {
                        return taskPriority.task_id === task.id;
                    });
                    task.priority = pr.length == 1 ? pr[0].priority : 0;
                });
            };
            $scope.incPriority = function(task) {
                if (task.priority == 1)
                    return;
                $http.put(Util.serverURL + 'api/task/' + task.id + '/priority/inc')
                        .success(function(priorityList) {
                            //task.priority -= 1;
                            $scope.setAllPriorities($scope.tasks, priorityList);
//                    $scope.tasks.forEach(function(task_elem) {
//                        if (task.priority === task_elem.priority && task.id !== task_elem.id) {
//                            task_elem.priority += 1;
//                        }
//                    });
                        }).error(function(err) {
                    console.log(err);
                });
            };
            $scope.decPriority = function(task) {
                if (task.priority === $scope.minPriority())
                    return;
                $http.put(Util.serverURL + 'api/task/' + task.id + '/priority/dec')
                        .success(function(priorityList) {
                            $scope.setAllPriorities($scope.tasks, priorityList);
                        }).error(function(err) {
                    console.log(err);
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
                $http.delete(Util.serverURL + 'api/task/' + task.id + '?access_token=' + $scope.access_token).success(function(res) {
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
                $http.post(Util.serverURL + 'api/task/' + task.id + '/users',
                        {ids: [task.newMember.id]})
                        .success(function(res) {
                            console.log(res);
                            if (task.members === undefined)
                                task.members = [];
                            if (task.newMember !== undefined)
                                task.members.push(task.newMember.id);
                            delete task.newMember;
                        }).error(function(err) {
                    console.log(err);
                });
            };
            $scope.removeMember = function(task, member) {
                $http.post(Util.serverURL + 'api/task/' + task.id + '/users/del', {ids: [member]})
                        .success(function(res) {
                            task.members = task.members.filter(function(taskMem) {
                                return taskMem !== member;
                            });
                        })
                        .error(function(err) {
                            console.log(err);
                        });
            };
            $scope.syncTask = function(task) {

            };
            $scope.addComment = function(task, commentText) {
                if (commentText === undefined || commentText.length == 0)
                    return;
                $http.put(Util.serverURL + 'api/task/' + task.id + '/comment',
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
            $scope.taskById = function(taskId) {
                var tasks = $scope.tasks.filter(function(task) {
                    return task.id == taskId
                });
                return (tasks.length > 0) ? tasks[0] : null;
            };
            $scope.saveStatus = function(task) {
                var state = task.status;
                $http.put(Util.serverURL + 'api/task/' + task.id + '/status/' + task.status)
                        .success(function(newPriorityList) {
                            newPriorityList.forEach(function(list) {
                                var task = $scope.taskById(list.task_id);
                                task.priority = list.priority;
                            });
                        })
                        .error(function(err) {
                            console.log(err);
                        });
            }

            $scope.refreshEverything = function() {

            }

            $scope.noOfTasksToDo = function(tasks) {
                return (tasks.filter(function(task) {
                    return task.status === "0";
                })).length;
            }
        });
function signInCallback(authResult) {
    console.log(authResult);
}