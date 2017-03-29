/*
 * Copyright 2016 EPAM Systems
 *
 *
 * This file is part of EPAM Report Portal.
 * https://github.com/epam/ReportPortal
 *
 * Report Portal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Report Portal is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Report Portal.  If not, see <http://www.gnu.org/licenses/>.
 */
define(function (require, exports, module) {
    'use strict';

    var $ = require('jquery');
    var Backbone = require('backbone');
    var Epoxy = require('backbone-epoxy');
    var Util = require('util');
    var TwitterNewsItemView = require('components/twitterNewsComponent/TwitterNewsItemView');

    var TwitterModel = Epoxy.Model.extend({
       defaults: {
           id: '',
           text: '',
           user: '',
           entities: {},
       },
        computeds: {
           textHtml: {
               deps: ['text', 'entities'],
               get: function(text, entities) {
                    var replaceObjects = [];
                    function parseEntitie(entities, getHtml) {
                        _.each(entities, function(entity) {
                            if(entity.indices[0] !== entity.indices[1]) {
                                replaceObjects.push({
                                    start: entity.indices[0],
                                    end: entity.indices[1],
                                    html: getHtml(entity),
                                })
                            }
                        });
                    }
                   parseEntitie(entities.urls, function(entity) { return '<a target="_blank" href="' + entity.url+ '">' + entity.display_url + '</a>'; });
                   parseEntitie(entities.user_mentions, function(entity) { return '<a target="_blank" href="https://twitter.com/intent/user?user_id=' + entity.id+ '">@' + entity.screen_name + '</a>'; });
                   parseEntitie(entities.hashtags, function(entity) { return '<a target="_blank" href="https://twitter.com/hashtag/' + entity.text+ '">#' + entity.text + '</a>'; });
                   replaceObjects.sort(function(a, b) {
                       return a.start - b.start;
                   });
                   var currentReplaceObject = replaceObjects.shift();
                   var result = '';
                   _.each(text, function(letter, index) {
                       if(!currentReplaceObject && replaceObjects.length) { currentReplaceObject = replaceObjects.shift() }
                       if(!currentReplaceObject || index < currentReplaceObject.start) {
                           result += letter;
                           return true;
                       }
                       if(currentReplaceObject.start === index) {
                           result += currentReplaceObject.html;
                           return true;
                       }
                       if(index >=currentReplaceObject.end) {
                           result += letter;
                           currentReplaceObject = null;
                       }
                   })
                   return result.replace(/\n/g, '<br>');
               }
           }
        }
    });

    var TwitterCollection = Backbone.Collection.extend({
        model: TwitterModel,
    })

    var TwitterNewsComponent = Epoxy.View.extend({
        className: 'post-news-component',
        template: 'tpl-twitter-news-component',
        events: {
        },

        initialize: function() {
            this.renderViews = [];
            this.collection = new TwitterCollection();
            this.listenTo(this.collection, 'reset', this.renderTwits);
            this.render();
            this.update();
        },
        render: function() {
            this.$el.html(Util.templates(this.template, this.options));
            this.scrollEl = Util.setupBaronScroll($('[data-js-items-container]', this.$el));
        },
        update: function() {
            var self = this;
            $.ajax({
                url: '//evbyminsd6293.minsk.epam.com:8081/twitter',
                dataType: 'jsonp',
                jsonp: 'jsonp',
                crossDomain: true,
                async: true,
            })
                .done(function(data) {
                    self.collection.reset(data);
                })
        },
        renderTwits: function() {
            this.destroyTwits();
            var self = this;
            _.each(this.collection.models, function(model) {
                var view = new TwitterNewsItemView({model: model});
                self.renderViews.push(view);
                $('[data-js-items-container]', self.$el).append(view.$el);
            })
            Util.setupBaronScrollSize(this.scrollEl, { maxHeight: 450 });
        },
        destroyTwits: function() {
            _.each(this.renderViews, function(view) {
                view.destroy();
            });
            this.renderViews = [];
        },
        onDestroy: function() {
            this.destroyTwits();
        }
    });


    return TwitterNewsComponent;
});