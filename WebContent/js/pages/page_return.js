// Generated from design
"use strict";

define([
    "../widgetBuilder"
], function(
    widgets
) {

    function addWidgets(contentPane, model) {
        widgets.add_label(contentPane, model, "returnIntroLabel");
        widgets.add_textarea(contentPane, model, "project_generalNotes_return");
    }

    var questions = [
        {"id":"returnIntroLabel", "type":"label", "isInReport":false, "isGridColumn":false},
        {"id":"project_generalNotes_return", "type":"textarea", "isInReport":true, "isGridColumn":false}
    ];

    return {
        "id": "page_return",
        "name": "Return",
        "type": "page",
        "isHeader": true,
        "addWidgets": addWidgets,
        "questions": questions
    };
});