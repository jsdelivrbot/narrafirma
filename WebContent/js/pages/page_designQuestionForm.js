// Generated from design
"use strict";

define([
    "../widgetBuilder"
], function(
    widgets
) {

    function addWidgets(contentPane, model) {
        widgets.add_label(contentPane, model, "questionFormLabel");
        widgets.add_text(contentPane, model, "questionForm_title");
        widgets.add_text(contentPane, model, "questionForm_image");
        widgets.add_textarea(contentPane, model, "questionForm_startText");
        widgets.add_textarea(contentPane, model, "questionForm_endText");
    }

    var questions = [
        {"id":"questionFormLabel", "type":"label", "isInReport":false, "isGridColumn":false},
        {"id":"questionForm_title", "type":"text", "isInReport":true, "isGridColumn":false},
        {"id":"questionForm_image", "type":"text", "isInReport":true, "isGridColumn":false},
        {"id":"questionForm_startText", "type":"textarea", "isInReport":true, "isGridColumn":false},
        {"id":"questionForm_endText", "type":"textarea", "isInReport":true, "isGridColumn":false}
    ];

    return {
        "id": "page_designQuestionForm",
        "name": "Design question form",
        "type": "page",
        "isHeader": false,
        "addWidgets": addWidgets,
        "questions": questions
    };
});