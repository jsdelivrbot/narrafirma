import kludgeForUseStrict = require("../../kludgeForUseStrict");
"use strict";

var panel: Panel = {
    id: "page_explorePatterns",
    displayName: "Explore patterns",
    panelFields: [
        {
            id: "explorePatternsLabel",
            valueType: "none",
            displayType: "label",
            displayPrompt: "On this page you will look over the most significant statistical results\nand save some to observations for later use."
        },
        {
            id: "catalysisReportExplorePatterns",
            valuePath: "/clientState/catalysisReportIdentifier",
            valueType: "string",
            valueOptions: "project_catalysisReports",
            valueOptionsSubfield: "catalysisReport_shortName",
            displayType: "select",
            displayName: "Catalysis report",
            displayPrompt: "Choose a catalysis report to work on"
        },
        {
            id: "explorePatterns_minSubsetSize",
            valueType: "string",
            valueOptions: [
                "20",
                "30",
                "40",
                "50"
            ],
            displayType: "select",
            displayName: "Minimum subset size",
            displayPrompt: "How large should subsets of stories be to be considered for comparison?"
        },
        {
            id: "explorePatterns_display",
            valuePath: "/clientState/catalysisReportIdentifier",
            valueType: "none",
            displayType: "patternExplorer",
            displayPrompt: "Pattern explorer"
        }
    ]
};

export = panel;
