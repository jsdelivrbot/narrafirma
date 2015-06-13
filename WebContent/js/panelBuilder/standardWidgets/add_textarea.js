define([
    "dijit/form/SimpleTextarea",
    "../valuePathResolver"
], function (SimpleTextarea, valuePathResolver) {
    "use strict";
    function add_textarea(panelBuilder, contentPane, model, fieldSpecification) {
        var questionContentPane = panelBuilder.createQuestionContentPaneWithPrompt(contentPane, fieldSpecification);
        var textarea = new SimpleTextarea({
            rows: "4",
            cols: "80",
            style: "width: 100%;",
            value: valuePathResolver.atFieldSpecification(panelBuilder, model, fieldSpecification)
        });
        textarea.placeAt(questionContentPane);
        return textarea;
    }
    return add_textarea;
});
