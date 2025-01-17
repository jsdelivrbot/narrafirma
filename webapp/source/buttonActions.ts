import Project = require("./Project");
import browser = require("./panelBuilder/browser");
import csvImportExport = require("./csvImportExport");
import dialogSupport = require("./panelBuilder/dialogSupport");
import navigationPane = require("./navigationPane");
import pageDisplayer = require("./pageDisplayer");
import questionnaireGeneration = require("./questionnaireGeneration");
import surveyBuilder = require("./surveyBuilderMithril");
import surveyCollection = require("./surveyCollection");
import surveyStorage = require("./surveyStorage");
import translate = require("./panelBuilder/translate");
import generateRandomUuid = require("./pointrel20150417/generateRandomUuid");
import toaster = require("./panelBuilder/toaster");
import ClientState = require("./ClientState");
import printing = require("./printing");
import projectImportExport = require("./projectImportExport");
import ClusteringDiagram = require("./applicationWidgets/ClusteringDiagram");

"use strict";

var project: Project;
var clientState: ClientState;

// Call this to set up the project or other needed data
export function initialize(theProject: Project, theClientState: ClientState) {
    project = theProject;
    clientState = theClientState;
}

export function helpButtonClicked() {
    var pageSpecification = navigationPane.getCurrentPageSpecification();
    if (!pageSpecification) {
        console.log("no pageSpecification for current page");
        return;
    }
    
    var helpURL = 'help/' + pageSpecification.section + "/help_" + pageSpecification.id + '.html';
    
    browser.launchApplication(helpURL, 'help');
}

// Caller should call wizard.forward() on successful save to see the last page, and provide a retry message otherwise
// Caller may also want to call (the returned) surveyDialog.hide() to close the window, or let the user do it.
function openMithrilSurveyDialog(questionnaire, callback, previewModeTitleText = null) {  
    var surveyDiv = document.createElement("div");
    var surveyViewFunction = surveyBuilder.buildSurveyForm(null, questionnaire, callback, {previewMode: !!previewModeTitleText, ignoreTitleChange: true, dataEntry: true});
    
    var dialogConfiguration = {
        dialogModel: null,
        dialogTitle: "Enter Story" + (previewModeTitleText || ""),
        dialogStyle: undefined,
        dialogConstructionFunction: surveyViewFunction,
        dialogOKButtonLabel: "Close",
        dialogOKCallback: function(dialogConfiguration, hideDialogMethod) { hideDialogMethod(); }
    };
    
    return dialogSupport.openDialog(dialogConfiguration);
}

function openSurveyDialog() {
    var storyCollectionName: string = clientState.storyCollectionName();
    
    if (!storyCollectionName) {
        // TODO: translate
        alert("Please select a story collection first.");
        return null;
    }

    var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionName, true);
    if (!questionnaire) return;

    var surveyDialog = openMithrilSurveyDialog(questionnaire, finished);
    
    function finished(status, surveyResult, wizardPane) {
        console.log("surveyResult", status, surveyResult);
        if (status === "submitted") {
            surveyStorage.storeSurveyResult(project.pointrelClient, project.projectIdentifier, storyCollectionName, surveyResult, wizardPane);
        }
    }
}

///////// Button functions

export function copyStoryFormURL() {
    alert("Story form URL is: " + "http://localhost:8080/survey.html");
}

export function guiOpenSection(model, fieldSpecification, value) {
    var section = fieldSpecification.displayConfiguration.section;
    
    // Don't queue an extra redraw as one is already queued since this code get called by a button press
    var isRedrawAlreadyQueued = true;
    pageDisplayer.showPage(section, false, isRedrawAlreadyQueued);
    // document.body.scrollTop = 0;
    // document.documentElement.scrollTop = 0;
    window.scrollTo(0, 0);
}

function copyDraftPNIQuestionVersionsIntoAnswers_Basic() {
    var finalQuestionIDs = [
        "project_pniQuestions_goal_final",
        "project_pniQuestions_relationships_final",
        "project_pniQuestions_focus_final",
        "project_pniQuestions_range_final",
        "project_pniQuestions_scope_final",
        "project_pniQuestions_emphasis_final"
    ];

    var copiedAnswersCount = 0;

    for (var index in finalQuestionIDs) {
        var finalQuestionID = finalQuestionIDs[index];
        var draftQuestionID = finalQuestionID.replace("_final", "_draft");
        var finalValue = project.tripleStore.queryLatestC(project.projectIdentifier, finalQuestionID);
        if (!finalValue) {
            var draftValue = project.tripleStore.queryLatestC(project.projectIdentifier, draftQuestionID);
            if (draftValue) {
                project.tripleStore.addTriple(project.projectIdentifier, finalQuestionID, draftValue);
                copiedAnswersCount++;
            }
        }
    }

    return copiedAnswersCount;
}

export function copyDraftPNIQuestionVersionsIntoAnswers() {
    var copiedAnswersCount = copyDraftPNIQuestionVersionsIntoAnswers_Basic();
    var template = translate("#copyDraftPNIQuestion_template", "Copied {{copiedAnswersCount}} answers.\n\n(Note that blank draft answers are not copied, and non-blank final answers are not replaced.)");
    var message = template.replace("{{copiedAnswersCount}}", copiedAnswersCount);
    alert(message);
}

export function logoutButtonClicked() {
    // TODO: Warn if have any read-only changes that would be lost
    if (confirm("Are you sure you want to log out the current NarraFirma user?")) {
        var isWordPressAJAX = !!window["ajaxurl"];
        if (isWordPressAJAX) {
            window.location.href = window.location.href.split("wp-content")[0] + "wp-login.php?action=logout";
        } else {
            window.location.href = "/logout";
        }
    }
}

export function loginButtonClicked() {
    // TODO: Warn if have any read-only changes that would be lost
    if (confirm("Would you like to log in a new NarraFirma user?")) {
        var isWordPressAJAX = !!window["ajaxurl"];
        if (isWordPressAJAX) {
            window.location.href = window.location.href.split("wp-content")[0] + "wp-login.php?action=login";
        } else {
            window.location.href = "/login";
        }
    }
}

/*
function previewQuestionForm(model, fieldSpecification) {
    console.log("previewQuestionForm", model);
    var questionnaire = questionnaireGeneration.buildQuestionnaireFromTemplate(project, model);
    
    var surveyDialog = openMithrilSurveyDialog(questionnaire, finished, true);
    
    function finished(status, surveyResult, wizardPane) {
        console.log("surveyResult", status, surveyResult);
        if (wizardPane) wizardPane.forward();
    }
}
*/

export function previewQuestionForm(model, fieldSpecification) {
    var questionnaire = questionnaireGeneration.buildQuestionnaireFromTemplate(model);
    window["narraFirma_previewQuestionnaire"] = questionnaire;
    
    var w = window.open("survey.html#preview=" + (new Date().toISOString()), "_blank");
}

export function copyInterpretationsToClusteringDiagram() {
    var shortName = clientState.catalysisReportName();
    if (!shortName) {
        alert("Please pick a catalysis report to work with.");
        return;
    }
    
    var catalysisReportIdentifier = project.findCatalysisReport(shortName);
    if (!catalysisReportIdentifier) {
        alert("Problem finding catalysis report identifier.");
        return;
    }
    
    var allInterpretations = [];
    var observationSetIdentifier = project.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_observations");
    if (!observationSetIdentifier) {
        alert("No observations have been made on the Explore Patterns page.");
        return;
    }
    var observations = project.tripleStore.queryAllLatestBCForA(observationSetIdentifier);
    
    for (var key in observations) {
        var observationIdentifier = observations[key];
        var interpretationsSetIdentifier = project.tripleStore.queryLatestC(observationIdentifier, "observationInterpretations");
        if (interpretationsSetIdentifier) {
            var interpretations = project.tripleStore.getListForSetIdentifier(interpretationsSetIdentifier);
            for (var i = 0; i < interpretations.length; i++) {
                var interpretationIdentifier = interpretations[i];
                var interpretationName = project.tripleStore.queryLatestC(interpretationIdentifier, "interpretation_name");
                var interpretationText = project.tripleStore.queryLatestC(interpretationIdentifier, "interpretation_text");
                allInterpretations.push({
                    "type": "Interpretation",
                    id: interpretationIdentifier,
                    name: interpretationName,
                    text: interpretationText
                });
            }
        }
    }
    
    if (allInterpretations.length === 0) {
        alert("No interpretations have been found for this catalysis report.");
    }
    
    var clusteringDiagram: ClusteringDiagramModel = project.tripleStore.queryLatestC(catalysisReportIdentifier, "interpretationsClusteringDiagram");
    if (!clusteringDiagram) {
        clusteringDiagram = ClusteringDiagram.newDiagramModel();
    }
 
    function findUUIDForInterpretationName(name: string) {
        for (var index = 0; index < allInterpretations.length; index++) {
            const interpretation = allInterpretations[index];
            if (interpretation.name === name) {
                return interpretation.id;
            }
        }
        return null;
    }

    // Make sure every item has a referenceUUID linking it to an interpretation
    const existingReferenceUUIDs = {};
    clusteringDiagram.items.forEach((item) => {
        if (item.type === "item" && !item.referenceUUID) {
            // If no referenceUUID already set, find interpretation based on name
            const uuid = findUUIDForInterpretationName(item.name);
            // Only allow one item to link to an interpretation
            // if there are two items with the same name, only the first one
            // will be mapped to the correct interpretation
            // the second one will be left unconnected to anything
            if (!uuid) {
                console.log("No UUID found for intepretation name", item.name);
            } else {
                if (existingReferenceUUIDs[uuid]) {
                    console.log("Two interpretations with same name", item.name, uuid);
                } else {
                    item.referenceUUID = uuid
                }
            }
        }
        existingReferenceUUIDs[item.referenceUUID] = true;
    });

    var updatedItemCount = 0;
    // Update name and notes on existing items
    clusteringDiagram.items.forEach((item) => {
        if (item.type === "item") {
            if (item.referenceUUID) {
                const newName = project.tripleStore.queryLatestC(item.referenceUUID, "interpretation_name") || "Deleted interpretation";
                if (newName !== item.name) {
                    item.name = newName;
                    updatedItemCount++;
                }
                item.notes = project.tripleStore.queryLatestC(item.referenceUUID, "interpretation_text") || "";
            } else {
                if (item.name && item.name.indexOf("Deleted interpretation") !== 0) {
                    const newName =  "Deleted interpretation: " + (item.name || "Missing name");
                    if (newName !== item.name) {
                        item.name = newName;
                        updatedItemCount++;
                    }
                }
            }
        }
    });

    function findObservationForInterpretation(observationIDs, interpretationName) {
        for (var i = 0; i < observationIDs.length; i++) {
            const observationID = observationIDs[i];
            var interpretationsListIdentifier = project.tripleStore.queryLatestC(observationID, "observationInterpretations");
            var interpretationsList = project.tripleStore.getListForSetIdentifier(interpretationsListIdentifier);
            for (var j = 0; j < interpretationsList.length; j++) {
                const interpretationID = interpretationsList[j];
                var interpretation = project.tripleStore.makeObject(interpretationID, true);
                var name = interpretation.interpretation_name;
                if (name === interpretationName) {
                    return observationID;
                }
            }
        }
        return null;
    }
    
    // add items for interpretations not represented in the space
    var addedItemCount = 0;
    var observationIDs = project.tripleStore.getListForSetIdentifier(observationSetIdentifier);
    allInterpretations.forEach((interpretation) => {
        if (!existingReferenceUUIDs[interpretation.id]) {
            // check that this interpretation is attached to an observation; if not, it should not be added to the diagram
            const observationID = findObservationForInterpretation(observationIDs, interpretation.name);
            if (observationID) {
                // if the user creates an observation and adds interpretations to it,
                // and then deletes the name and text of the observation, 
                // the observation will still exist in the system,
                // and the interpretations will still exist, and they will still link to the observation,
                // but they should be hidden from the clustering diagram and the report.
                var observationName = project.tripleStore.queryLatestC(observationID, "observationTitle");
                var observationDescription = project.tripleStore.queryLatestC(observationID, "observationDescription");
                if (observationName || observationDescription) {
                    addedItemCount++;
                    const item = ClusteringDiagram.addNewItemToDiagram(clusteringDiagram, "item", interpretation.name, interpretation.text);
                    item.referenceUUID = interpretation.id;
                }
            }
        }
    });

    project.tripleStore.addTriple(catalysisReportIdentifier, "interpretationsClusteringDiagram", clusteringDiagram);
    if (addedItemCount === 0 && updatedItemCount === 0) {
        toaster.toast("The clustering diagram is up to date.");
    } else {
        toaster.toast("Added " + addedItemCount + " interpretations and updated " + updatedItemCount +  " interpretations in the clustering diagram.");
    }
}

export function setQuestionnaireForStoryCollection(storyCollectionIdentifier): boolean {
    if (!storyCollectionIdentifier) return false;
    var questionnaireName = project.tripleStore.queryLatestC(storyCollectionIdentifier, "storyCollection_questionnaireIdentifier");
    var questionnaire = questionnaireGeneration.buildQuestionnaire(questionnaireName);
    if (!questionnaire) return false;
    project.tripleStore.addTriple(storyCollectionIdentifier, "questionnaire", questionnaire);
    return true;
}

export function updateQuestionnaireForStoryCollection(storyCollectionIdentifier) {
    if (!storyCollectionIdentifier) {
        alert("Problem: No storyCollectionIdentifier");
        return;
    }
    
    var storyCollectionName = project.tripleStore.queryLatestC(storyCollectionIdentifier, "storyCollection_shortName");
    if (!storyCollectionName) {
        alert("Problem: No storyCollectionName");
        return;
    }
    
    // TODO: Translate
    var confirmResult = confirm('Update story form for story collection "' + storyCollectionName + '"?"\n(Updating is not recommended once data collection has begun.)');
    if (!confirmResult) return;
    
    var updateResult = setQuestionnaireForStoryCollection(storyCollectionIdentifier);

    if (!updateResult) {
        alert("Problem: No questionnaire could be created");
        return;
    }
    
    toaster.toast("Updated story form");
    
    return;
}

function isNamedItemInDiagram(diagram: ClusteringDiagramModel, name: string, itemType: string = null) {
    // Array.some returns true or false depending on whether there is soem item that tests true 
    return diagram.items.some((item) => {
        if (!itemType || item.type === itemType) {
            if (item.name === name) {
                return true;
            }
        }
        return false;
    });
}

function copyClusteringDiagramElements(fromDiagramField: string, fromType: string, toDiagramField: string, toType: string) {
    var fromDiagram: ClusteringDiagramModel = project.getFieldValue(fromDiagramField);
    if (!fromDiagram || !fromDiagram.items.length) return;
    var toDiagram: ClusteringDiagramModel = project.getFieldValue(toDiagramField) || ClusteringDiagram.newDiagramModel();
    var addedItemCount = 0;
    
    fromDiagram.items.forEach((item) => {
        if (item.type === fromType) {
            if (!isNamedItemInDiagram(toDiagram, item.name, toType)) {
                ClusteringDiagram.addNewItemToDiagram(toDiagram, toType, item.name, item.notes);
                addedItemCount++;
            }
        }
    });
    
    if (addedItemCount) {
        toaster.toast("Updating diagram");
        project.setFieldValue(toDiagramField, toDiagram);
    } else {
        toaster.toast("No changes were needed to diagram");
    }
}

export function copyPlanningStoriesToClusteringDiagram(model) {
    var list = project.getListForField("project_projectStoriesList");
    var toDiagramField = "project_storyElements_answersClusteringDiagram";
    var toDiagram: ClusteringDiagramModel = project.getFieldValue(toDiagramField) || ClusteringDiagram.newDiagramModel();
    var addedItemCount = 0;
        
    list.forEach((projectStoryIdentifier) => {
        var projectStory = project.tripleStore.makeObject(projectStoryIdentifier);
        
        var storyName = projectStory.projectStory_name;
        var storyText = projectStory.projectStory_text;
        
        if (!isNamedItemInDiagram(toDiagram, storyName, "cluster")) {
            ClusteringDiagram.addNewItemToDiagram(toDiagram, "cluster", storyName, storyText);
            addedItemCount++;
        }    
    });
    
    if (addedItemCount) {
        toaster.toast("Updating diagram");
        project.setFieldValue(toDiagramField, toDiagram);
    } else {
        toaster.toast("No changes were needed to diagram");
    }

}

export function copyAnswersToClusteringDiagram(model) {
    copyClusteringDiagramElements("project_storyElements_answersClusteringDiagram", "item", "project_storyElements_answerClustersClusteringDiagram", "item");
}

export function copyAnswerClustersToClusteringDiagram(model) {
    copyClusteringDiagramElements("project_storyElements_answerClustersClusteringDiagram", "cluster", "project_storyElements_attributesClusteringDiagram", "cluster");
}

export function copyAttributesToClusteringDiagram(model) {
    copyClusteringDiagramElements("project_storyElements_attributesClusteringDiagram", "item", "project_storyElements_attributeClustersClusteringDiagram", "item");
}

export var enterSurveyResult = openSurveyDialog;
export var toggleWebActivationOfSurvey = surveyCollection.toggleWebActivationOfSurvey;
export var storyCollectionStop = surveyCollection.storyCollectionStop;

export var importCSVQuestionnaire = csvImportExport.importCSVQuestionnaire;
export var importCSVStories = csvImportExport.importCSVStories;
export var exportQuestionnaire = csvImportExport.exportQuestionnaire;
export var exportStoryCollection = csvImportExport.exportStoryCollection;
export var autoFillStoryForm = csvImportExport.autoFillStoryForm;

export var exportProject = projectImportExport.exportProject;
export var importProject = projectImportExport.importProject;

export var printStoryForm = printing.printStoryForm;
export var printStoryCards = printing.printStoryCards;
export var printCatalysisReport = printing.printCatalysisReport;
export var exportPresentationOutline = printing.exportPresentationOutline;
export var exportCollectionSessionAgenda = printing.exportCollectionSessionAgenda;
export var printSensemakingSessionAgenda = printing.printSensemakingSessionAgenda;

export var printProjectReport = printing.printProjectReport;