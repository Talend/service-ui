/*
 * This file is part of Report Portal.
 *
 * Report Portal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Report Portal is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Report Portal.  If not, see <http://www.gnu.org/licenses/>.
 */
define(function (require) {
    'use strict';

    var $ = require('jquery');
    var _ = require('underscore');
    var ModalView = require('modals/_modalView');
    var Backbone = require('backbone');
    var App = require('app');
    var Util = require('util');
    var Localization = require('localization');
    var Moment = require('moment');
    var MarkdownEditor = require('components/markdown/MarkdownEditor');
    var SingletonDefectTypeCollection = require('defectType/SingletonDefectTypeCollection');
    var SingletonAppStorage = require('storage/SingletonAppStorage');
    var SingletonAppModel = require('model/SingletonAppModel');
    var SingletonRegistryInfoModel = require('model/SingletonRegistryInfoModel');
    var talendConfig = require('talendConfig');
    var CallService = require('callService');
    var call = CallService.call;
    var coreService = require('coreService');


    var config = App.getInstance();

    var ModalGenerateMessage = ModalView.extend({
        template: 'tpl-modal-talend-message-editor',
        className: 'modal-defect-editor',
        events: {
            'click [data-js-close]': 'onClickClose',
            'click [data-js-send]': 'onClickSend',
        },
        initialize: function (option) {
            this.content = "";
            this.context = option.context;
            this.registryInfo = new SingletonRegistryInfoModel();
            this.appStorage = new SingletonAppStorage();
            this.viewModel = new Backbone.Model();
            if (this.appStorage.get('replaceComment') === undefined) {
                this.viewModel.set({replaceComment: true});
            } else {
                this.viewModel.set({replaceComment: this.appStorage.get('replaceComment')});
            }
            this.items = option.items;
            var self = this;
            this.getMessagePreview(this.items).done(function () {
                self.appModel = new SingletonAppModel();
                self.defectTypesCollection = new SingletonDefectTypeCollection();
                self.defectTypesCollection.ready.done(function () {
                    this.render(option);
                }.bind(self));
                self.selectedIssue = null;
            });

        },

        render: function () {
            this.$el.html(Util.templates(this.template, {
                item: this.items[0],
                isMultipleEdit: this.isMultipleEdit(),
                defectsGroup: config.defectsGroupSorted,
                subDefects: this.getSubDefects(),
                getIssueType: this.getIssueType,
                getIssueComment: this.getIssueComment,
                getDefectType: this.getDefectType()
            }));
            this.applyBindings();
            this.setupAnchors();
            this.setupMarkdownEditor();
        },

        isMultipleEdit: function () {
            return this.items.length > 1;
        },

        setupAnchors: function () {
            this.$type = $('[data-js-issue-name]', this.$el);
            this.$replaceComments = $('[data-js-replace-comment]', this.$el);
        },

        onKeySuccess: function () {
            $('[data-js-save]', this.$el).focus().trigger('click');
            // this.updateDefectType();
        },

        getIssueType: function (item) {
            var data = item.getIssue();
            return data.issue_type;
        },

        getIssueComment: function (item) {
            var data = item.getIssue();
            return data.comment ? data.comment : '';
        },
        getMessagePreview: function (items) {
            var async = $.Deferred();
            console.log(talendConfig);
            this.content = '';
            var it = this;
            this.content += 'Daily report of ' + Moment().format('LL') + '\n';
            var promises = [];
            _.each(items, function (i) {
                promises.push(it.launchDetails(i).promise());
            });
            Promise.all(promises).then(function(values) {
                console.log(values);
                async.resolve();
            });

            return async;
        },
        urlName: function (item) {
            var url = '';
            url = window.location.origin + '/#' + item.appModel.attributes.projectId + '/launches/all%7Cpage.page=1&page.size=50&page.sort=start_time,number%2CDESC/' + item.attributes.id;
            return url;
        },
        launchDetails: function (launch) {
            var async = $.Deferred();
            var self = this;

            if (launch.attributes.statistics.executions.failed > 0) {
                coreService.getTestItemsByLaunch(launch.id)
                    .done(function (response) {
                        var nbFeaturesKO = 0;
                        var jira = [];
                        _.each(response.content, function (test) {
                            if (test.description != undefined && test.description.startsWith("Feature") && test.statistics.executions.failed > 0) {
                                nbFeaturesKO++;
                            }
                            if (test.issue!=undefined && test.issue.externalSystemIssues != undefined && test.issue.externalSystemIssues.length > 0) {
                                _.each(test.issue.externalSystemIssues,function(issue){
                                    jira.push(issue.ticketId);
                                });
                            }
                            //
                        });
                        var featuresKOString = nbFeaturesKO > 0 ? '`'+ nbFeaturesKO+' features KO`' : '';
                        self.content += '<' + self.urlName(launch) + '|' + launch.attributes.name + '>' + ': :heavy_exclamation_mark: '+featuresKOString;
                        if(jira.length>0){
                            self.content += _.uniq(jira).join(",");
                        }
                        self.content += self.testDetails(launch);
                        self.content += '\n';
                        async.resolve();
                    })
                    .fail(function (error) {
                        Util.ajaxFailMessenger(error, 'getItemsWidgetBugTable');
                        async.resolve();
                    });
            } else {
                this.content += '<' + self.urlName(launch) + '|' + launch.attributes.name + '>' + ': :heavy_check_mark: \n';
                async.resolve();
            }

            return async;
        },
        testDetails: function (item) {
            var message = '';

            //if(item.)

            message += '\n' + item.attributes.statistics.executions.failed + ' tests KO : ';
            for (var property in item.attributes.statistics.defects) {
                if (item.attributes.statistics.defects.hasOwnProperty(property)) {
                    switch (property) {
                        case 'product_bug':
                            message += (item.attributes.statistics.defects.product_bug.total > 0) ? item.attributes.statistics.defects.product_bug.total + ' Product bug ' : '';
                            break;
                        case 'automation_bug':
                            message += (item.attributes.statistics.defects.automation_bug.total > 0) ? item.attributes.statistics.defects.automation_bug.total + ' Automation bug ' : '';
                            break;
                        case 'system_issue':
                            message += (item.attributes.statistics.defects.automation_bug.total > 0) ? item.attributes.statistics.defects.automation_bug.total + ' System issue ' : '';
                            break;
                        case 'to_investigate':
                            message += (item.attributes.statistics.defects.to_investigate.total > 0) ? item.attributes.statistics.defects.to_investigate.total + ' To investigate ' : '';
                            break;
                        case 'no_defect':
                            message += (item.attributes.statistics.defects.no_defect.total > 0) ? item.attributes.statistics.defects.no_defect.total + ' No defect ' : '';
                            break;
                        default:
                        // code block
                    }
                }
            }

            return message;
        },
        getDefectType: function () {
            var self = this;
            return function (item) {
                var issue = self.getIssueType(item);
                var issueType = self.defectTypesCollection.getDefectType(issue);
                return issueType;
            };
        },

        getSubDefects: function () {
            var def = {};
            var defectTypes = this.defectTypesCollection.toJSON();
            _.each(defectTypes, function (d) {
                var type = d.typeRef;
                if (def[type]) {
                    def[type].push(d);
                } else {
                    def[type] = [d];
                }
            });
            return def;
        },
        onClickSend: function () {
            call('POST', talendConfig.slackapi, {"text": this.markdownEditor.getValue()}, null, false).complete(function (response) {
                if (response.status == 200) {
                    Util.ajaxSuccessMessenger('talendSendSlackMessage');
                } else {
                    Util.ajaxFailMessenger('talendSendSlackMessage');
                }
            });
        },
        setupMarkdownEditor: function () {
            var self = this;
            self.markdownEditor = new MarkdownEditor({
                value: self.content,
                placeholder: Localization.dialog.commentForDefect
            });
            $('[data-js-issue-comment]', self.$el).html(self.markdownEditor.$el);
            console.log("getMessagePreview end");
        },
        onShown: function () {
            console.log("ONSHOWN");
            this.markdownEditor.update();
            this.listenTo(this.markdownEditor, 'change', this.disableHideBackdrop);
            this.initState = {
                comment: this.markdownEditor.getValue(),
                selectedIssue: this.selectedIssue,
                replaceComments: this.$replaceComments.is(':checked')
            };
            !this.isMultipleEdit() && (this.initState.ignoreAA = this.viewModel.get('ignoreAA'));
        },
        isChanged: function () {
            var answer = !(this.initState.comment === this.markdownEditor.getValue() &&
                this.initState.selectedIssue === this.selectedIssue &&
                this.initState.replaceComments === this.$replaceComments.is(':checked')
            );
            if (!this.isMultipleEdit()) {
                answer = answer || !(this.initState.ignoreAA === this.viewModel.get('ignoreAA'));
            }
            return answer;
        },
        onHide: function () {
            this.ignoreSwitcher && this.ignoreSwitcher.destroy();
            this.markdownEditor.destroy();
        },
        onClickClose: function () {
            config.trackingDispatcher.trackEventNumber(157);
        },
        onClickCancel: function () {
            config.trackingDispatcher.trackEventNumber(159);
        }
    });

    return ModalGenerateMessage;
});
