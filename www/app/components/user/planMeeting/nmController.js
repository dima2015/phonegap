(function () {

    var controller = function ($mdDialog, userResources, plannerResources, mixedContentToArray, $location, $routeParams) {


        var c = this;
        c.isUpdate = false;
        var changedEvents = [];
        var _evs = [];
        var calendar;
        var groupId;
        c.meetingId='';
        var selectDay = function () {
            var date = moment();
            date.utc();
            var day = date.day();
            if (day <= 6) {
                date.add(7 - date.day(), 'days').minute(0).hour(0);
            }
            else {
                date.add(8, 'days').minute(0).hour(0);
            }

            return date;
        };
        var checkNewEvents = function (events) {
            var newEvents = [];
            for (var i = 0; i < events.length; i++) {
                if (events[i].new === true) {
                    newEvents.push(events[i]);
                }
            }
            return newEvents;
        };
        var backendEventAdapter = function (events, switcher) {
            var adaptedEvents = [];
            if (switcher) {
                for (var i = 0; i < events.length; i++) {
                    adaptedEvents.push({
                        time_start: events[i]._start._d.toISOString().split('.')[0].replace('T', ' '),
                        time_end: events[i]._end._d.toISOString().split('.')[0].replace('T', ' ')
                    })
                }
            }
            else {
                adaptedEvents[0] = [];
                adaptedEvents[1] = [];
                for (var key in events) {
                    adaptedEvents[0].push(events[key].specificId);
                    adaptedEvents[1].push({
                        time_start: events[key]._start._d.toISOString().split('.')[0].replace('T', ' '),
                        time_end: events[key]._end._d.toISOString().split('.')[0].replace('T', ' ')
                    })
                }
            }

            return adaptedEvents;

        };
        var adaptToResolution = function () {
            if (window.innerWidth <= 768) {
                calendarConfig.defaultView = 'agendaDay';
            }
        };
        var getTimeslots = function () {
            plannerResources.plannerManagedMeetingsTimeslots.query({
                    groupId: groupId,
                    meetingId: c.meetingId,
                    timeslotId: ''
                })
                .$promise.then(function (response) {
                var splittedTimeStart, splittedTimeEnd;
                for (var i = 0; i < response.length; i++) {
                    splittedTimeStart = response[i].time_start.split(' ');
                    splittedTimeEnd = response[i].time_end.split(' ');
                    _evs.push({
                        title: '',
                        start: splittedTimeStart[0] + 'T' + splittedTimeStart[1],
                        end: splittedTimeEnd[0] + 'T' + splittedTimeEnd[1],
                        specificId: response[i].id
                    });

                }
                calendar = jQuery('#meetingTimeslots').fullCalendar(calendarConfig);
            })
        };

        var processUrl = function () {
            var urlParams;
            if (!($routeParams.type.length === 1 && $routeParams.type === '_')) {
                urlParams = $routeParams.type.split('&');
                groupId = urlParams[0];
                c.meetingId = urlParams[1];
                c.isUpdate = true;
                c.toolbarTitle = 'Edit meeting'
            }
        };

        var getMeetingInfo = function () {
            if (c.isUpdate) {
                plannerResources.plannerMeetings.get({groupId: groupId, meetingId: c.meetingId})
                    .$promise.then(function (response) {
                    c.data.meeting.name = response.title;
                    c.data.meeting.description = response.description;
                    c.data.meeting.duration = parseInt(response.duration) / 60;
                    getTimeslots();
                })
            }
            else {
                calendar = jQuery('#meetingTimeslots').fullCalendar(calendarConfig);
            }

        };

        var removeTimeslot = function (id) {
            confirmPopup.message = 'Deleting event';
            confirmPopup.show();
            plannerResources.plannerManagedMeetingsTimeslots.remove({
                groupId: groupId,
                meetingId: c.meetingId,
                timeslotId: id
            }).$promise
                .then(function () {
                    confirmPopup.hide();
                }, function () {
                    confirmPopup.hide();
                })
        };


        var createMeeting = function (events) {
            var processedEvents = backendEventAdapter(events, true);
            confirmPopup.message = "Creating meeting";
            confirmPopup.show();
            plannerResources.plannerMeetings.save({groupId: grabCheckedGroup(), meetingId: ''}, jQuery.param({
                title: c.data.meeting.name,
                description: c.data.meeting.description,
                duration: (c.data.meeting.duration * 60)
            })).$promise.then(function (response) {
                if(c.changedImg){
                    camera.uploader.upload(groupId,response.id);
                }
                saveMeetingTimeslots(response.id, processedEvents, true, true)
            }, function (response) {
                if (response.status === 422) {
                    mixedContentToArray.process(response.data, c.errors, true);
                    confirmPopup.hide();
                }
                confirmPopup.hide();

            })
        };
        var updateMeetingTimeslots = function (events, redirect) {
            var counter = 0;
            for (var i = 0; i < events[1].length; i++) {
                plannerResources.plannerManagedMeetingsTimeslots.update({
                        groupId: groupId,
                        meetingId: c.meetingId,
                        timeslotId: events[0][i]
                    },
                    jQuery.param(events[1][i])).$promise.then(function () {
                    if (counter === events[1].length - 1) {
                        confirmPopup.hide();
                        if (redirect) {
                            $location.path('/user');
                        }
                    }
                    counter++;

                }, function (response) {
                    if (response.status === 422) {
                        mixedContentToArray.process(response.data, c.errors, true);
                        confirmPopup.hide();
                    }
                    confirmPopup.hide();
                })
            }

        };
        var saveMeetingTimeslots = function (meeting_id, events, redirect, showPopupCondition, isUpdate) {
            var counter = 0;
            var group_id;
            if (c.isUpdate) {
                group_id = groupId;
            }
            else {
                group_id = grabCheckedGroup();
            }
            for (var i = 0; i < events.length; i++) {
                plannerResources.plannerManagedMeetingsTimeslots.save({
                        groupId: group_id,
                        meetingId: meeting_id,
                        timeslotId: ''
                    },
                    jQuery.param(events[i])
                ).$promise.then(function () {
                    if (counter === events.length - 1 && showPopupCondition) {
                        confirmPopup.hide();
                        if (redirect) {
                            $location.path('/user');
                        }

                    }
                    counter++;
                }, function (response) {
                    if (response.status === 422) {
                        mixedContentToArray.process(response.data, c.errors, true);
                        confirmPopup.hide();
                    }
                    confirmPopup.hide();

                })
            }

        };
        var updateMeeting = function (events) {
            var alsoEditedEvents = false;
            var newEvents = backendEventAdapter(checkNewEvents(events), true);
            var modifiedEvents = backendEventAdapter(changedEvents, false);
            confirmPopup.message = "Saving changes";
            confirmPopup.show();
            alsoEditedEvents = modifiedEvents[1].length > 0;
            plannerResources.plannerMeetings.update({groupId: groupId, meetingId: c.meetingId}, jQuery.param({
                title: c.data.meeting.name,
                description: c.data.meeting.description,
                duration: (c.data.meeting.duration * 60)
            })).$promise.then(function () {
                if(c.changedImg){
                    camera.uploader.upload(groupId, c.meetingId);
                }
                saveMeetingTimeslots(meetingId, newEvents, true, !alsoEditedEvents, true);
                updateMeetingTimeslots(modifiedEvents, true);
                if (newEvents.length === 0 && modifiedEvents[1].length === 0) {
                    confirmPopup.hide();
                    $location.path('/user');
                }
            }, function (response) {
                if (response.status === 422) {
                    mixedContentToArray.process(response.data, c.errors, true);
                    confirmPopup.hide();
                }
                confirmPopup.hide();

            })
        };
        var camera = {
            camera: {
                image: null,
                setOptions: function (srcType) {
                    var options = {
                        // Some common settings are 20, 50, and 100
                        quality: 50,
                        destinationType: Camera.DestinationType.FILE_URI,
                        // In this app, dynamically set the picture source, Camera or photo gallery
                        sourceType: srcType,
                        encodingType: Camera.EncodingType.JPEG,
                        mediaType: Camera.MediaType.PICTURE,
                        allowEdit: true,
                        correctOrientation: true  //Corrects Android orientation quirks
                    };
                    return options;
                },

                openCamera: function () {

                    var srcType = Camera.PictureSourceType.CAMERA;
                    var options = this.setOptions(srcType);
                    var _this = this;

                    navigator.camera.getPicture(function cameraSuccess(imageUri) {

                        _this.image = imageUri;
                        _this.displayImage();

                    }, function cameraError(error) {
                        console.debug("Unable to obtain picture: " + error, "app");

                    }, options);
                },

                displayImage: function () {
                    jQuery('.md__img img:first-child').hide();
                    jQuery('.md__img img:last-child').removeAttr('style');
                    var elem = document.getElementById('altImg');
                    elem.src = this.image;
                    c.changedImg = true;
                },

                openFilePicker: function (selection) {

                    var srcType = Camera.PictureSourceType.SAVEDPHOTOALBUM;
                    var options = this.setOptions(srcType);
                    var _this = this;

                    navigator.camera.getPicture(function cameraSuccess(imageUri) {

                        _this.image = imageUri;
                        _this.displayImage();

                    }, function cameraError(error) {
                        console.debug("Unable to obtain picture: " + error, "app");

                    }, options);
                },
            },

            uploader: {
                loadingStatus:{
                    percentage: 0.0,
                    setPercentage: function(percentage){
                        this.percentage = percentage;
                    },
                    increment: function(){
                        //TODO
                    }

                },
                win: function (r) {
                    console.log("Code = " + r.responseCode);
                    console.log("Response = " + r.response);
                    console.log("Sent = " + r.bytesSent)
                    confirmPopup.hide();

                },

                fail: function (error) {
                    alert("An error has occurred: Code = " + error.code);
                    console.log("upload error source " + error.source);
                    console.log("upload error target " + error.target);
                },

                upload: function (groupId, meetingId) {
                    var uri = encodeURI('http://api.plunner.com/employees/planners/groups/'+groupId+'/meetings/'+meetingId+'/image');
                    var _this = this;
                    var options = new FileUploadOptions();
                    options.fileKey = "file";
                    console.log(camera.camera.image);
                    options.fileName = camera.camera.image.substr(camera.camera.image.lastIndexOf('/') + 1);
                    options.mimeType = "image/jpg";

                    var headers = { 'Authorization': window.localStorage['auth_token']};

                    options.headers = headers;

                    var ft = new FileTransfer();
                    ft.onprogress = function (progressEvent) {
                        if (progressEvent.lengthComputable) {
                            _this.loadingStatus.setPercentage(progressEvent.loaded / progressEvent.total);
                        } else {
                            _this.loadingStatus.increment();
                        }
                    };
                    ft.upload(camera.camera.image, uri, this.win, this.fail, options);
                }
            }
        };
        var calendarConfig = {
            height: 400,
            firstDay: 1,
            allDaySlot: false,
            header: {
                right: 'deleteBtn, prev,next today'
            },
            defaultView: 'agendaWeek',
            slotDuration: '00:15:00',
            events: _evs,
            editable: true,
            selectable: true,
            selectHelper: true,
            selectConstraint: {
                start: selectDay().toISOString(),
                end: selectDay().add(30, 'days')
            },
            eventConstraint: {
                start: selectDay().toISOString(),
                end: selectDay().add(30, 'days')
            },
            eventRender: function (event, element) {
                element.append("<i class='material-icons removeEvent'>close</i>");
                element.find(".removeEvent").click(function () {
                    if (c.isUpdate) {
                        removeTimeslot(event.specificId);
                    }
                    calendar.fullCalendar('removeEvents', event._id);
                });
            },
            select: function (start, end) {
                calendar.fullCalendar('renderEvent',
                    {
                        start: start,
                        end: end.add('15','m'),
                        new: true
                    },
                    true // make the event "stick"
                );
                calendar.fullCalendar('unselect');
            },
            eventResize: function (event) {
                //changedEvents[event._id] = event;
                console.log(event.new !== true);
                if (event.new !== true) {
                    changedEvents[event._id] = event;
                }
            },
            eventDrop: function (event) {
                if (event.new !== true) {
                    changedEvents[event._id] = event;
                }
            }
        };
        var confirmPopup = {
            message: '',
            show: function () {
                $mdDialog.show({
                        template: '<md-dialog><md-dialog-content><div class="md-dialog-content plan_meeting__submit_dialog" layout="row"><md-progress-circular flex="33" md-mode="indeterminate"></md-progress-circular> <span flex>' + this.message + '</span> </div> </md-dialog-content> </md-dialog>',
                        parent: angular.element(document.body),
                        clickOutsideToClose: false
                    }
                );
            },
            hide: function () {
                $mdDialog.cancel();
            }
        };
        var getGroups = function () {
            plannerResources.plannerManagedMeetings.query({groupId: ''}).$promise
                .then(function (response) {
                    c.groups = response;
                    fillCheckedGroups();
                })

        };
        var grabCheckedGroup = function () {
            for (var i = 0; i < c.checkedGroups.length; i++) {
                if (c.checkedGroups[i].selected == true) {
                    return c.checkedGroups[i].id;
                }
            }
        };
        var fillCheckedGroups = function () {
            var selected = false;
            for (var i = 0; i < c.groups.length; i++) {
                if (c.groups[i].id === groupId) {
                    selected = true;
                }
                c.checkedGroups.push({id: c.groups[i].id, selected: selected});
            }
        };
        c.toolbarTitle = 'Plan meeting';
        c.events = [];
        c.showEmptyState = false;
        c.deleteMeeting = function () {
            confirmPopup.message = "Deleting meeting";
            confirmPopup.show();
            plannerResources.plannerMeetings.remove({groupId: groupId, meetingId: c.meetingId}).$promise
                .then(function () {
                    confirmPopup.hide();
                    $location.path('/user');
                }, function () {
                    confirmPopup.hide();
                })
        };
        c.changedImg = false;
        c.errors = [];
        c.data = {
            meeting: {
                name: '',
                description: '',
                duration: 30
            }
        };
        c.getMode = function () {
            return c.isUpdate;
        };
        c.submit = function () {
            var events, areErrors, minEventDuration;
            if (!c.showEmptyState) {
                events = calendar.fullCalendar('clientEvents');
            }
            else {
                events = [];
            }
            c.invalidFlags.name = c.data.meeting.name === '';
            c.invalidFlags.description = c.data.meeting.description === '';
            for (var i = 0; i < c.checkedGroups.length; i++) {
                if (c.checkedGroups[i].selected === true) {
                    c.invalidFlags.groups = false;
                    break;
                }
                c.invalidFlags.groups = true;
            }
            c.invalidFlags.time_windows_num = (events.length === 0);
            for (i = 0; i < events.length; i++) {
                minEventDuration = (events[i].end.format('x') - events[i].start.format('x')) / 1000;
                if (minEventDuration / 60 < c.data.meeting.duration) {
                    c.invalidFlags.time_windows_dur = true;
                    break;
                }
            }

            for (var key in c.invalidFlags) {
                if (c.invalidFlags[key] === true) {
                    areErrors = true;
                    break;
                }
            }
            if (!areErrors) {
                if (!c.isUpdate) {
                    createMeeting(events);
                }
                else {
                    updateMeeting(events);
                }

            }
        };
        c.openCamera = function(){
            camera.camera.openCamera();
        };
        c.openGallery = function(){
            camera.camera.openFilePicker();
        };

        c.checkedGroups = [];
        c.invalidFlags = {
            name: false,
            description: false,
            groups: false,
            time_windows_num: false,
            time_windows_dur: false
        };


        adaptToResolution();
        processUrl();
        getGroups();
        getMeetingInfo();


    };

    var app = angular.module('Plunner');
    app.controller('nmController', ['$mdDialog', 'userResources', 'plannerResources', 'mixedContentToArray', '$location', '$routeParams', controller]);
}());
