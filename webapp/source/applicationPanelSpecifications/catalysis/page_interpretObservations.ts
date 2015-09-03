import kludgeForUseStrict = require("../../kludgeForUseStrict");
"use strict";

var panel: Panel = {
    id: "page_interpretObservations",
    displayName: "Review and interpret observations",
    displayType: "page",
    section: "catalysis",
    modelClass: "InterpretObservationsActivity",
    panelFields: [
         {
            id: "catalysisReportReviewExcerpts",
            valuePath: "/clientState/catalysisReportIdentifier",
            valueType: "string",
            valueOptions: "project_catalysisReports",
            valueOptionsSubfield: "catalysisReport_shortName",
            required: true,
            displayType: "select",
            displayName: "Catalysis report",
            displayPrompt: "Choose a catalysis report to work on"
        },
        {
            id: "project_observationsDisplayList",
            valuePath: "/clientState/catalysisReportIdentifier",
            valueType: "array",
            required: true,
            displayType: "grid",
            displayConfiguration: "panel_createOrEditObservation",
            displayName: "Catalysis observations",
            displayPrompt: "These are the observations you have collected from the\nbrowse, graph, and trends pages."
        }
    ]
};

export = panel;

