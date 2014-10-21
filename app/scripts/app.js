'use strict';

/**
 * @ngdoc overview
 * @name todoApp
 * @description
 * # todoApp
 *
 * Main module of the application.
 */
angular
        .module('todoApp', [
            'ngTouch'
        ]);

$(function() {
    console.log($('accordion'));
    $('body').on('accordionbeforeactivate',function(ev,ui){
        console.log(ui);
    });
});