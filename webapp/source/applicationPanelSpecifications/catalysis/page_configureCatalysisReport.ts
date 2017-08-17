import Globals = require("../../Globals");
"use strict";

var panel: Panel = {
    id: "page_configureCatalysisReport",
    displayName: "Configure Catalysis Report",
    tooltipText: "Decide what questions you want to consider as you build your catalysis report.",
    panelFields: [
        {
            id: "configureCatalysisReport_label",
            valueType: "none",
            displayType: "label",
            displayPrompt: `
                On this page you can choose the <strong>questions</strong> you want to explore in your catalysis report.
                You can also specify a threshold for statistical tests.
            `
        },
        {
            id: "configureCatalysisReport_chooseReport",
            valuePath: "/clientState/catalysisReportName",
            valueType: "string",
            valueOptions: "project_catalysisReports",
            valueOptionsSubfield: "catalysisReport_shortName",
            displayType: "select",
            displayName: "Catalysis report",
            displayPrompt: "Choose a catalysis <strong>report</strong> to work on."
        },
        {
            id: "configureCatalysisReport_promptToSelectCatalysisReportForInterpretations",
            valueType: "none",
            displayType: "label",
            displayPrompt: "<strong>Please select a catalysis report above to get a list of questions here.</strong>",
            displayVisible: function(panelBuilder, model) {
                return !Globals.clientState().catalysisReportName();
            }
        },
        {
            id: "configureCatalysisReport_minimumSubsetSize",
            valuePath: "/clientState/catalysisReportIdentifier/minimumSubsetSize",
            valueType: "string",
            valueOptions: [
                "0",
                "5",
                "10",
                "15",
                "20",
                "25",
                "30",
                "35",
                "40",
                "45",
                "50"
            ],
            displayType: "select",
            displayName: "Minimum subset size",
            displayPrompt: "How large should <strong>subsets</strong> of stories be to be considered for statistical tests?",
            displayVisible: function(panelBuilder, model) {
                return !!Globals.clientState().catalysisReportName();
            }
        },

        {
            id: "configureCatalysisReport_correlationLineChoice",
            valuePath: "/clientState/catalysisReportIdentifier/correlationLineChoice",
            valueType: "string",
            valueOptions: [
                "none",
                "0.01",
                "0.05"
            ],
            displayType: "select",
            displayName: "Mark correlation lines",
            displayPrompt: "At what significance level should <strong>correlations</strong> be marked on scatterplots?",
            displayVisible: function(panelBuilder, model) {
                return !!Globals.clientState().catalysisReportName();
            }
        },

        {
            id: "configureCatalysisReport_chooseGraphTypes",
            valueType: "object",
            valuePath: "/clientState/catalysisReportIdentifier/graphTypesToCreate",
            displayType: "catalysisReportGraphTypesChooser",
            displayPrompt: "Which <strong>graph types</strong> should be included in the catalysis report?",
            displayVisible: function(panelBuilder, model) {
                return !!Globals.clientState().catalysisReportName();
            }
        },

        {
            id: "configureCatalysisReport_chooseQuestions",
            valueType: "object",
            valuePath: "/clientState/catalysisReportIdentifier/questionsToInclude",
            displayType: "catalysisReportQuestionChooser",
            displayPrompt: "Which <strong>questions</strong> should be included in the catalysis report?",
            displayVisible: function(panelBuilder, model) {
                return !!Globals.clientState().catalysisReportName();
            }
        }
    ]
};

export = panel;

