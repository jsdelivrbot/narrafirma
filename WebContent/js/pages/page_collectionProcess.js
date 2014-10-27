// Generated from design
"use strict";

define([
    "../widgetBuilder"
], function(
    widgets
) {

    function addWidgets(contentPane, model) {
        widgets.add_label(contentPane, model, "collectionProcessIntro");
        widgets.add_textarea(contentPane, model, "project_generalNotes_collectionProcess");
    }

    var questions = [
        {"id":"collectionProcessIntro", "type":"label", "isInReport":false, "isGridColumn":false},
        {"id":"project_generalNotes_collectionProcess", "type":"textarea", "isInReport":true, "isGridColumn":false}
    ];

    return {
        "id": "page_collectionProcess",
        "name": "Collection process",
        "type": "page",
        "isHeader": true,
        "addWidgets": addWidgets,
        "questions": questions
    };
});