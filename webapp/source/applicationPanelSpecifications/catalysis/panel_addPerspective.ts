import kludgeForUseStrict = require("../../kludgeForUseStrict");
"use strict";

var panel: Panel = {
    id: "panel_addPerspective",
    displayName: "Add or change perspective",
    displayType: "panel",
    section: "catalysis",
    modelClass: "Perspective",
    panelFields: [
        {
            id: "perspective_name",
            valueType: "string",
            required: true,
            displayType: "text",
            displayName: "Name",
            displayPrompt: "Please give this perspective a name."
        },
        {
            id: "perspective_description",
            valueType: "string",
            required: true,
            displayType: "textarea",
            displayName: "Perspective",
            displayPrompt: "Describe this perspective."
        },
        {
            id: "perspective_linkedResultsList",
            valueType: "none",
            displayType: "annotationsGrid",
            displayConfiguration: "panel_annotateResultForPerspective",
            displayPrompt: "Results linked to this perspective"
        },
        {
            id: "perspective_linkedExcerptsList",
            valueType: "none",
            displayType: "annotationsGrid",
            displayConfiguration: "panel_annotateExcerptForPerspective",
            displayPrompt: "Excerpts linked to this perspective"
        },
        {
            id: "perspective_linkedInterpretationsList",
            valueType: "none",
            displayType: "annotationsGrid",
            displayConfiguration: "panel_annotateInterpretationForPerspective",
            displayPrompt: "Interpretations linked to this perspective"
        }
    ]
};

export = panel;

