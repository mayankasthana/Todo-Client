'use strict';
/**
 * @ngdoc function
 * @name todoApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the todoApp
 */
angular.module('todoApp', ['angularMoment', 'ui.bootstrap', 'directive.g+signin', 'ngCookies', 'ui.bootstrap.datetimepicker', 'ui.select', 'flow'])//, 'angular-loading-bar'
        .config(['$httpProvider', function ($httpProvider) {
                $httpProvider.defaults.useXDomain = true;
                //$httpProvider.defaults.withCredentials = true;
                $httpProvider.interceptors.push('authInjector');

                delete $httpProvider.defaults.headers.common['X-Requested-With'];
            }])
        .factory('authInjector', ['$cookieStore', '$rootScope', function ($cookieStore, $rootScope) {
                var authInjector = {
                    request: function (config) {
                        config.headers['access-token'] = $cookieStore.get('access_token');
                        return config;
                    },
                    responseError: function (response) {
                        if (response.status === 401) {
                            $rootScope.$broadcast('logged-out');
                        }
                    }
                };
                return authInjector;
            }])
        .config(function ($sceProvider) {
            $sceProvider.enabled(false);
        })
        .filter('propsFilter', function () {
            return function (items, props) {
                var out = [];

                if (angular.isArray(items)) {
                    items.forEach(function (item) {
                        var itemMatches = false;

                        var keys = Object.keys(props);
                        for (var i = 0; i < keys.length; i++) {
                            var prop = keys[i];
                            var text = props[prop].toLowerCase();
                            if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
                                itemMatches = true;
                                break;
                            }
                        }

                        if (itemMatches) {
                            out.push(item);
                        }
                    });
                } else {
                    // Let the output be the input untouched
                    out = items;
                }

                return out;
            };
        })
        .service('Util', ['$location', function ($location) {
                this.serverURL = (function () {
                    console.log($location.host());
                    if ($location.host() === 'localhost') {
                        return 'http://localhost:8000/public/';
                    }
                    else if ($location.host().contains('mayankasthana')) {
                        return 'http://todoserver.mayankasthana.com/public/';
                    }
                    else {
                        return null;
                    }
                }());
                this.fileUploadURL = this.serverURL + 'upload/';
            }])
        .config(['flowFactoryProvider', function (flowFactoryProvider) {
                flowFactoryProvider.defaults = {
                    permanentErrors: [500, 501],
                    maxChunkRetries: 1,
                    chunkRetryInterval: 5000,
                    simultaneousUploads: 1
                };
                flowFactoryProvider.on('catchAll', function (event) {
                    console.log('catchAll', arguments);
                });
                // Can be used with different implementations of Flow.js
                //flowFactoryProvider.factory = fustyFlowFactory;
            }])
        .service('Auth', ['$http', 'Util', '$rootScope', '$cookieStore', function ($http, Util, $rootScope, $cookieStore) {
                var self = this;
                this.isLoggedin = {val: false};
                this.me = {};
                console.log('access token from cookie');
                console.log('access token time');
                console.log($cookieStore.get('access_token_time'));
                this.getMe = function () {
                    $http.get(Util.serverURL + 'api/me')
                            .success(function (user) {
                                console.log(user);
                                user.id = parseInt(user.id);
                                user.access_token_time = parseInt(user.access_token_time);
                                self.me = JSON.parse(JSON.stringify(user));
                                self.isLoggedin.val = true;
                                $rootScope.$broadcast('loggedIn', user);
                                console.log(self.me);
                            })
                            .error(function (err) {
                                console.log(err);
                            });
                };
                self.isCookieAccessKeyValid = function () {
                    return Date.now() - $cookieStore.get('access_token_time') < 3600 * 1000;
                };
                if ($cookieStore.get('access_token') !== null) {
                    console.log('The cookie access token is not null');
                    console.log('time now: ' + (new Date().getTime()));
                    console.log('access token time: ' + $cookieStore.get('access_token_time'));
                    console.log(new Date().getTime() - $cookieStore.get('access_token_time'));
                    if (self.isCookieAccessKeyValid())
                    {
                        console.log('last token is still valid');
                        //get Auth.me
                        this.getMe();
                    }
                }
                $rootScope.$on('logged-out', function (event) {
                    self.isLoggedin.val = false;
                    $cookieStore.delete('access_token');
                    $cookieStore.delete('access_token_time');
                });
                this.successGAuthCallback = function (event, authResult) {
                    if (self.isLoggedin.val === true) {
                        return;
                    }
                    console.log('signed in from google');
                    console.log(authResult);
                    $http.post(Util.serverURL + 'api/login',
                            {
                                'code': authResult.code,
                                'access_token': authResult.access_token,
                                'gplus_id': authResult.gplus_id
                            }).success(function (user) {
                        user.id = parseInt(user.id);
                        console.log('Sign in successful from server');
                        self.access_token = authResult.access_token;
                        $cookieStore.put('access_token', authResult.access_token);
                        $cookieStore.put('access_token_time', Date.now());
                        self.isLoggedin.val = true;
                        self.me = JSON.parse(JSON.stringify(user));
                        console.log(user);
                        $rootScope.$broadcast('loggedIn', user);
                    }).error(function (err) {
                        console.log(err);
                    });
                };
                $rootScope.$on('logged-out', function (event) {
                    self.isLoggedin.val = false;
                    //TODO delete from cookie
                    $cookieStore.remove('access_token');
                    $cookieStore.remove('access_token_time');
                });
            }])
        .controller('TodoCtrl', function ($scope, $http, $cookies, Auth, Util, $timeout) {
            $scope.isLoggedin = Auth.isLoggedin;
            $scope.me = Auth.me;
            console.log(Util.serverURL);
            $scope.newTask = {};
            $scope.users = [];
            $scope.tasks = [];
            $scope.notifications = [];
            $scope.mode = 'New';
            $scope.activeTaskId = 0;
            $scope.localLoginValid = Auth.isCookieAccessKeyValid;
            $scope.Util = Util;
            $scope.priorityFilterVal = {
                '0': true,
                '1': true,
                '2': true,
                '3': true
            };
            $scope.statusFilterVal = {
                '0': true,
                '1': true,
                '2': false //archived
            };
            $scope.setStatusFilter = function (statusCode) {
                switch (statusCode) {
                    case 0:
                        $scope.statusFilterVal[0] = true;
                        $scope.statusFilterVal[1] = false;
                        break;
                    case 1:
                        $scope.statusFilterVal[0] = false;
                        $scope.statusFilterVal[1] = true;
                        break;
                    case 2:
                        $scope.statusFilterVal[0] = true;
                        $scope.statusFilterVal[1] = true;
                        break;
                }
            };
            $scope.replaceTaskMarkup = function (text) {
                var taskRegex = /<task>(.*)<\/task>/;
                var res = taskRegex.exec(text);
                if (res !== null) {
                    var taskId = res[1];
                    var task = $scope.taskById(taskId);
                    var replText = '';
                    if (task === null) {
                        replText = 'Task #' + taskId;
                    } else {
                        replText = task.title;
                    }
                    return text.replace(taskRegex, replText);
                }
                return text;
            };
            $scope.replaceUserMarkup = function (text) {
                var taskRegex = /<user>(.*)<\/user>/;
                var res = taskRegex.exec(text);
                if (res !== null) {
                    var userId = res[1];
                    return text.replace(taskRegex, $scope.userById(userId).displayName);
                }
                return text;
            };
            $scope.replaceCommentMarkup = function (text) {
                var taskRegex = /<comment>(.*)<\/comment>/;
                var res = taskRegex.exec(text);
                if (res !== null) {
                    var commentId = res[1];
                    return text.replace(taskRegex, 'Comment #' + commentId);
                }
                return text;
            };
            $scope.replaceNotifMarkup = function (text) {
                text = $scope.replaceTaskMarkup(text);
                text = $scope.replaceUserMarkup(text);
                text = $scope.replaceCommentMarkup(text);
                return text;
            };
            $scope.getNotifications = function () {
                $http.get(Util.serverURL + 'api/notifs').success(function (notifs) {
                    console.log(notifs);
                    $scope.notifications = notifs.map(function (notif) {
                        notif.id = parseInt(notif.id);
                        notif.dispMsg = $scope.replaceNotifMarkup(notif.message);
                        return notif;
                    });
                });
            };
            $scope.statusFilter = function (task) {
                return $scope.statusFilterVal[task.status];
            };
            $scope.priorityFilter = function (task) {
                return ($scope.priorityFilterVal[task.priority]);
            };
            $scope.$on('loggedIn', function (event, user) {
                $scope.me = user;
                $http.get(Util.serverURL + 'api/tasks').success(function (data) {
                    console.log(data);
                    $scope.tasks = data.map(function (task) {
                        task.id = parseInt(task.id);
                        task.priority = parseInt(task.priority);
                        task.status = parseInt(task.status);
                        task.created_at = new Date(task.created_at);
                        task.completed_at = wrapTimeStamp(task.created_at);
                        console.log(task.completed_at);
                        task.deadline = wrapDateTime(task.deadlinedate, task.deadlinetime);
                        task.created_by_user_id = parseInt(task.created_by_user_id);
                        return task;
                    });
                });
                function wrapDateTime(date, time) {
                    // if date is given and time is not, assume last second of day.
                    console.log('wrapDateTime');
                    console.log(date);
                    console.log(time);

                    var mom = date && time && new moment(date + ' ' + time, 'YYYY-MM-DD HH:mm:ss');
                    console.log('mom');
                    console.log(mom);
                }
                function wrapTimeStamp(timeStamp) {
                    if (timeStamp) {
                        return new moment(timeStamp);
                    }
                    else {
                        return null;
                    }
                }
                $http.get(Util.serverURL + 'api/users').success(function (data) {
                    console.log(data);
                    $scope.users = data.map(function (user) {
                        user.id = parseInt(user.id);
                        user.access_token_time = parseInt(user.access_token_time);
                        if (user.id === Auth.me.id) {
                            user.displayName = 'Me';
                        }
                        //ouid = parseInt('user.access_token_time');
                        return user;
                    });
                });
                $scope.getNotifications();
            });
            $scope.$on('event:google-plus-signin-success', Auth.successGAuthCallback);
            $scope.$on('event:google-plus-signin-failure', function (event, authResult) {
                // Auth failure or signout detected
            });
            $scope.getTaskMembers = function (task) {
                $http.get(Util.serverURL + 'api/task/' + task.id + '/users').success(function (data) {
                    console.log(data);

                    task.members = data.map(function (userId) {
                        return $scope.userById(userId);
                    });
                });
            };
            $scope.getTaskAssignees = function (task) {
                $http.get(Util.serverURL + 'api/task/' + task.id + '/assignees').success(function (data) {

                    task.assignees = data.map(function (userId) {
                        return parseInt(userId);
                    });
                });
            };
            $scope.memberSelected = function (task, $item) {
                if (typeof ($item) !== 'undefined') {
                    $scope.addMember(task, [$item]);
                }
            };
            $scope.memberRemove = function (task, $item) {
                if (typeof ($item) !== 'undefined') {
                    $scope.removeMember(task, $item);
                }
            };
            $scope.getTaskComments = function (task) {
                $http.get(Util.serverURL + 'api/task/' + task.id + '/comments').success(function (comments) {
                    console.log(comments);

                    task.comments = comments.map(function (comment) {
                        comment.id = parseInt(comment.id);
                        comment.task_id = parseInt(comment.task_id);
                        comment.user_id = parseInt(comment.user_id);
                        return comment;
                    });
                });
            };
            $scope.sortByDate = function (task) {
                var date = new Date(task.created_at);
                //console.log("date");
                //console.log(date);
                return date;
            };
            $scope.orderPredicates = [{'displayOption': 'Priority - High to Low', 'pred': ['-priority']},
                {'displayOption': 'Priority - Low to High', 'pred': 'priority'},
                //{'displayOption': 'Date - Oldest first', 'pred': $scope.sortByDate}
                {'displayOption': 'Date - Oldest first', 'pred': 'id'},
                {'displayOption': 'Date - Newest first', 'pred': '-id'}
            ];

            $scope.addUpdateTask = function (newTask) {
                newTask.priority = angular.element('#priorityRadioGroup').find('.active').find('input').prop('value');
                newTask.deadlinedate = newTask.deadlinedate === null ? null : new moment(newTask.deadlinedate).format('YYYY-MM-DD');
                newTask.deadlinetime = newTask.deadlinetime === null ? null : new moment(newTask.deadlinetime).format('HH:mm:ss');
                newTask.description = newTask.description === undefined ? '' : newTask.description;
                if (newTask.deadline) {
                    newTask.deadline = new moment(newTask.deadline);
                    newTask.deadlinedate = newTask.deadline.format('YYYY-MM-DD');
                    newTask.deadlinetime = newTask.deadline.format('HH:mm:ss');
                }
                console.log('Add update task');
                console.log(newTask);
                if (newTask.title.length === 0) {
                    return;
                }
                $http.post(Util.serverURL + 'api/task', newTask)
                        .success(function (task) {
                            console.log(task);

                            $scope.replaceTaskByNewCopy(task);
                            $scope.newTask = {};
                            //redirect to new task id
                            $('#myModal').modal('hide');
                            //add me by default
                            $scope.addMember(task, [Auth.me]);
                        })
                        .error(function (err) {
                            console.log(err);
                        });
            };
            $scope.candidateMembers = function (task) {
                return $scope.users.filter(function (user) {
                    if (task.members === undefined) {
                        return true;
                    }
                    if (user.id === Auth.me.id) {
                        return false;
                    }
                    return task.members.indexOf(user.id) === -1;
                });
            };
            $scope.candidateAssignees = function (task) {
                if (typeof task.members === 'undefined') {
                    return [];
                }
                else {
                    return task.members
                            .filter(function (mem) {
                                if (typeof task.assignees !== 'undefined') {
                                    return (task.assignees.indexOf(mem.id) === -1);
                                } else {
                                    return false;
                                }
                            })
                            .map(function (mem) {
                                //return $scope.userById(memId);
                                return mem;
                            });
                }
                return $scope.users.filter(function (user) {
                    if (typeof task.assignees === 'undefined') {
                        return true;
                    }
                    return task.assignees.indexOf(user.id) === -1;
                });
            };
            $scope.printStatus = function (status) {
                console.log(status);
            };
            $scope.setAllPriorities = function (tasks, priorityList) {
                tasks.forEach(function (task) {
                    var pr = priorityList.filter(function (taskPriority) {
                        return taskPriority.task_id === task.id;
                    });
                    task.priority = pr.length === 1 ? pr[0].priority : 0;
                });
            };
            $scope.incPriority = function (task) {
                if (task.priority === 1) {
                    return;
                }
                $http.put(Util.serverURL + 'api/task/' + task.id + '/priority/inc')
                        .success(function (priorityList) {
                            console.log(priorityList);

                            //task.priority -= 1;
                            $scope.setAllPriorities($scope.tasks, priorityList);
//                    $scope.tasks.forEach(function(task_elem) {
//                        if (task.priority === task_elem.priority && task.id !== task_elem.id) {
//                            task_elem.priority += 1;
//                        }
//                    });
                        }).error(function (err) {
                    console.log(err);
                });
            };
            $scope.decPriority = function (task) {
                if (task.priority === $scope.minPriority()) {
                    return;
                }
                $http.put(Util.serverURL + 'api/task/' + task.id + '/priority/dec')
                        .success(function (priorityList) {
                            $scope.setAllPriorities($scope.tasks, priorityList);
                        }).error(function (err) {
                    console.log(err);
                });
            };
            $scope.minPriority = function () {
                var minPriorit = 0;
                for (var i = 0; i < $scope.tasks.length; i++) {
                    if ($scope.tasks[i].priority > minPriorit)
                    {
                        minPriorit = $scope.tasks[i].priority;
                    }
                }
                return minPriorit;
            };

            $scope.removeTask = function (task) {
                var r = confirm('Are you sure you want to delete the task?');
                if (r === false) {
                    return;
                }
                console.log('trying to remove task');
                $http.delete(Util.serverURL + 'api/task/' + task.id).success(function (res) {
                    console.log(res);
                    $scope.tasks = $scope.tasks.filter(function (tsk) {
                        if (tsk.id === task.id) {
                            return false;
                        }
                        return true;
                    });
                }).error(function (err) {
                    console.log('error in delete');
                });
            };
            $scope.editTask = function (task) {
                $scope.mode = 'Edit';
                $scope.newTask = extend(task);
                $scope.newTask.deadline = new moment($scope.newTask.deadlinedate + 'T' + $scope.newTask.deadlinetime);
                console.log('Edit task');
                console.log($scope.newTask);
//remove active label
                //add active label
                angular.element('#myModal').modal('show');
                angular.element('#priorityRadioGroup label.active').removeClass('active');
                angular.element('#priorityRadioGroup label input[value=' + task.priority + ']').parent().addClass('active');

            };
            $scope.newTaskActionInit = function () {
                $scope.newTask = {};
                $scope.mode = 'New';
            };
            function disableElem(selector) {
                angular.element(selector).prop('disabled', true);
            }
            ;
            function enableElem(selector) {
                angular.element(selector).prop('disabled', false);
            }
            ;
            $scope.makeAlert = function (thing) {
                alert(thing);
            };
            $scope.addMember = function (task, members) {
                typeof task.members === 'undefined' ? task.members = [] : '';
                disableElem('#add-mem-btn');
                /*                memberIds = memberIds.filter(function(memId) {
                 return task.members.indexOf(memId) === -1;
                 });
                 */
                var memberIds = members.map(function (mem) {
                    return mem.id;
                });
                $http.post(Util.serverURL + 'api/task/' + task.id + '/users',
                        {ids: memberIds})
                        .success(function (res) {
                            enableElem('#add-mem-btn');
                            console.log(res);
                            if (task.members === undefined) {
                                task.members = [];
                            }
                            if (typeof memberIds !== 'undefined') {
                                if (typeof task.members === 'undefined') {
                                    task.members = [];
                                }
                                /*memberIds.map(function(memId) {
                                 task.members.push($scope.userById(memId));
                                 });
                                 */
                            }
                            delete task.newMember;
                        }).error(function (err) {
                    enableElem('#add-mem-btn');
                    console.log(err);
                });
            };
            $scope.addAssignee = function (task, userIds) {
                //remove all user ids which are already added.
                userIds = userIds.filter(function (userId) {
                    return task.assignees.indexOf(userId) === -1;
                });
                $http.post(Util.serverURL + 'api/task/' + task.id + '/assign',
                        {ids: [task.newAssignee.id]})
                        .success(function (res) {
                            console.log(res);
                            if (typeof task.assignees === 'undefined') {
                                task.assignees = [];
                            }
                            task.assignees.push(parseInt(task.newAssignee.id));
                            //$scope.addMember(task, userIds);
                            delete task.newAssignee;
                        }).error(function (err) {
                    console.log(err);
                });
            };
            $scope.removeMember = function (task, mem) {
                var member = mem.id;
                task.members = task.members.filter(function (taskMem) {
                    return parseInt(taskMem.id) !== parseInt(member);
                });
                $http.post(Util.serverURL + 'api/task/' + task.id + '/users/del', {ids: [member]})
                        .success(function (res) {
                            console.log(res);

                            $scope.removeAssignee(task, mem);
                        })
                        .error(function (err) {
                            console.log(err);
                        });
            };
            $scope.removeAssignee = function (task, member) {
                //member = member.id
                $http.post(Util.serverURL + 'api/task/' + task.id + '/assignee/del', {ids: [member]})
                        .success(function (res) {
                            console.log(res);
                            task.assignees = task.assignees.filter(function (taskMem) {
                                return taskMem.id !== member;
                            });
                        })
                        .error(function (err) {
                            console.log(err);
                        });
            };
            $scope.syncTask = function (task) {

            };
            $scope.addComment = function (task, commentText) {
                if (commentText === undefined || commentText.length === 0)
                {
                    return;
                }
                $http.put(Util.serverURL + 'api/task/' + task.id + '/comment',
                        {
                            comment: commentText,
                            userId: Auth.me.id
                        }
                ).success(function (commentObj) {
                    console.log(commentObj);
                    commentObj.id = parseInt(commentObj.id);
                    commentObj.task_id = parseInt(commentObj.task_id);
                    commentObj.user_id = parseInt(commentObj.user_id);
                    if (task.comments === undefined) {
                        task.comments = [];
                    }
                    task.comments.push(commentObj);
                    task.newComment = '';
                }).error(function (err) {
                    console.log(err);
                });
            };
            $scope.priorities = {
                '0': 'Low',
                '1': 'Normal',
                '2': 'High',
                '3': 'Urgent'
            };
            $scope.priorityText = function (priority) {
                return $scope.priorities[priority];
            };
            $scope.priorityCss = {
                '0': 'success',
                '1': 'info',
                '2': 'warning',
                '3': 'danger'
            };
            $scope.priorityColour = {
                '0': '#5cb85c',
                '1': '#5bc0de',
                '2': '#f0ad4e',
                '3': '#d9534f'
            };
            $scope.toggleaActiveState = function (task) {
                if (task.id !== $scope.activeTaskId) {
                    $scope.activeTaskId = task.id;
                    $scope.getTaskComments(task);
                    $scope.getTaskMembers(task);
                    $scope.getTaskAssignees(task);
                    $scope.getTaskAttachments(task);
                }
                else {
                    $scope.activeTaskId = 0;
                }
            };
            $scope.displayDeadline = function (task) {
                var str = '';
                var mom;
                if (task.deadlinedate === null && task.deadlinetime === null) {
                    return 'No deadline';
                }
                else if (task.deadlinedate !== null && task.deadlinetime !== null) {
                    mom = new moment(task.deadlinedate + 'T' + task.deadlinetime);
                    return 'Due ' + mom.calendar();
                }
                else if (task.deadlinedate !== null) {
                    mom = new moment(task.deadlinedate);
                    return 'Due ' + mom.calendar();
                }
            };
            $scope.userById = function (uid) {

                var users = $scope.users.filter(function (user) {
                    return parseInt(user.id) === parseInt(uid);
                });
                if (users.length > 0) {
                    return users[0];
                }
                else {
                    return null;
                }
            };
            $scope.taskById = function (taskId) {
                console.log('No of tasks: ' + $scope.tasks.length);
                var tasks = $scope.tasks.filter(function (task) {
                    //console.log(task.id + " === "+ taskId+" = "+ (parseInt(task.id)===parseInt(taskId)));
                    return parseInt(task.id) === parseInt(taskId);
                });
                return (tasks.length > 0) ? tasks[0] : null;
            };
            $scope.replaceTaskByNewCopy = function (task) {
                task.id = parseInt(task.id);
                task.priority = parseInt(task.priority);
                task.status = parseInt(task.status);
                $scope.tasks = $scope.tasks.filter(function (tsk) {
                    return tsk.id !== task.id;
                });
                $scope.tasks.push(task);
            };
            $scope.saveStatus = function (task) {
                var state = task.status;
                $http.put(Util.serverURL + 'api/task/' + task.id + '/status/' + task.status)
                        .success(function (task) {
                            console.log(task);
                            $scope.replaceTaskByNewCopy(task);
                            //refresh task members
                            //refresh comments
                            //refresh task assignees
                            if ($scope.isActive(task)) {
                                $scope.getTaskAssignees(task);
                                $scope.getTaskMembers(task);
                                $scope.getTaskComments(task);
                            }
                        })
                        .error(function (err) {
                            console.log(err);
                        });
            };
            $scope.toggleStatus = function (task) {
                if (parseInt(task.status) === 1) {
                    task.status = 0;
                }
                else if (parseInt(task.status) === 0)
                {
                    task.status = 1;
                }
                $scope.saveStatus(task);
            };
            $scope.refreshEverything = function () {

            };
            $scope.isDone = function (task) {
                return  parseInt(task.status) === 1;
            };
            $scope.noOfTasksToDo = function (tasks) {
                return (tasks.filter(function (task) {
                    return task.status === '0';
                })).length;
            };
            $scope.isActive = function (task) {
                return $scope.activeTaskId === task.id;
            }
            ;
            $scope.markReadNotif = function (notif) {
                console.log(notif);
                $http.put(Util.serverURL + 'api/notif/' + notif.id + '/seen')
                        .success(function (res) {
                            //remove notif from current notifs
                            $scope.notifications = $scope.notifications.filter(function (ntif) {
                                return notif !== ntif;
                            });
                        })
                        .error(function (err) {
                            console.log(err);
                        });
            };
            /*
             * Attachments section
             */
            $scope.uploadURL = function (task, user) {
                return Util.fileUploadURL
                        + task.id + '/'
                        + user.id + '/';
            };

            $scope.getTaskAttachments = function (task) {
                $http.get(Util.serverURL + 'api/task/' + task.id + '/atts')
                        .success(function (data) {
                            console.log(data);
                            task.atts = data.map(function (att) {
                                att.link = Util.serverURL + 'api/att/' + att.id;
                                return att;
                            });
                        });
            };

            $scope.setUploadSuccess = function ($file, task) {
                console.log($file);
                console.log(task);
                $scope.getTaskAttachments(task);
            };

            $scope.incompleteFiles = function ($file) {
                console.log($file.isComplete());
                return !$file.isComplete();
            };
            $scope.removeAtt = function (att, task) {
                $http.delete(Util.serverURL + 'api/att/' + att.id)
                        .success(function (res) {
                            $scope.getTaskAttachments(task);
                        })
                        .error(function (err) {
                            console.log(err);
                        });
            };
        });
function signInCallback(authResult) {
    console.log(authResult);
}
// extends 'from' object with members from 'to'. If 'to' is null, a deep clone of 'from' is returned
function extend(from, to)
{
    if (from == null || typeof from != 'object') {
        return from;
    }
    if (from.constructor != Object && from.constructor != Array) {
        return from;
    }
    if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
            from.constructor == String || from.constructor == Number || from.constructor == Boolean) {
        return new from.constructor(from);
    }

    to = to || new from.constructor();

    for (var name in from)
    {
        to[name] = typeof to[name] === 'undefined' ? extend(from[name], null) : to[name];
    }

    return to;
}