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

    var config = App.getInstance();

    var ModalGenerateMessage = ModalView.extend({
        template: 'tpl-modal-talend-message-editor',
        className: 'modal-defect-editor',
        events: {
            'click [data-js-close]': 'onClickClose'
        },
        initialize: function (option) {
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

            this.appModel = new SingletonAppModel();
            this.defectTypesCollection = new SingletonDefectTypeCollection();
            this.defectTypesCollection.ready.done(function () {
                this.render(option);
            }.bind(this));
            this.selectedIssue = null;
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
            var message = '';
            var it = this;
            message += 'Daily report of ' + Moment().format('LL') + '\n';
            console.log(items);
            _.each(items, function (i) {
                if (i.attributes.statistics.executions.failed > 0) {
                    message += i.attributes.name + ': :heavy_exclamation_mark: ';
                    message += it.testDetails(i);
                    message += '\n';
                } else {
                    message += i.attributes.name + ': :heavy_check_mark: \n';
                }
            });
            return message;
        },
        testDetails: function (item) {
            var message = '';
            message += item.attributes.statistics.executions.failed + ' tests KO';
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

        setupMarkdownEditor: function () {
            this.markdownEditor = new MarkdownEditor({
                value: this.getMessagePreview(this.items),
                placeholder: Localization.dialog.commentForDefect
            });
            $('[data-js-issue-comment]', this.$el).html(this.markdownEditor.$el);
        },
        onShown: function () {
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
