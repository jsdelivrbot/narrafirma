import PointrelClient = require("./pointrel20150417/PointrelClient");
import surveyCollection = require("./surveyCollection");
import TripleStore = require("./pointrel20150417/TripleStore");
import PanelSpecificationCollection = require("./panelBuilder/PanelSpecificationCollection");

"use strict";

var serverURL = "/api/pointrel20150417";

// TODO: Rethink this as a more general way to watch models within the project (so, with arbitrary object IDs, not just the project ID)

class Project {
    journalIdentifier: string;
    projectIdentifier: string;
    userIdentifier: any;
    readOnly: boolean = false;
    pointrelClient: PointrelClient;
    tripleStore: TripleStore;
    redrawCallback: Function;
    static defaultMinimumStoryCountRequiredForTest = 20;
    static defaultNumHistogramBins = 20;
    static defaultShowInterpretationsInGrid = false;
    static defaultNumScatterDotOpacityLevels = 3;
    static defaultScatterDotSize = 8;
    static defaultCorrelationLineChoice = "0.05";
    static defaultGraphTypesToCreate = {
        "data integrity graphs": false,
        "texts": false,
        "bar graphs": false,
        "histograms": false,
        "tables": false,
        "multiple histograms": false,
        "scatterplots": false,
        "multiple scatterplots": false
    }

    // The activeQuestionnaires field tracks what should be available to survey users and to construct related messages
    activeQuestionnaires = {};
    
    constructor(journalIdentifier, projectIdentifier, userIdentifier, updateServerStatus, redrawCallback) {
        this.journalIdentifier = journalIdentifier;
        this.projectIdentifier = projectIdentifier;
        this.userIdentifier = userIdentifier;
        this.redrawCallback = redrawCallback;
    
        this.pointrelClient = new PointrelClient(serverURL, this.journalIdentifier, this.userIdentifier, this.receivedMessage.bind(this), updateServerStatus);
        
        // For now, listen on all topics in the journal
        // TODO: Think about how to move topicIdentifier into pointrelClient initialization
        // var topicIdentifier = "project001";
        // pointrelClient.topicIdentifier = topicIdentifier;
        
        this.tripleStore = new TripleStore(this.pointrelClient, "narrafirmaProject");
        // console.log("tripleStore", this.tripleStore);
        
        // Redraw on any new tripleStore message (however, the ones we send will not get callbacks)
        this.tripleStore.subscribe(undefined, undefined, undefined, this.redrawCallback.bind(this));
    }

    startup(callback) {
        this.pointrelClient.reportJournalStatus((error, response) => {
            console.log("reportJournalStatus response", error, response);
            if (error) {
                console.log("Failed to startup project", error);
                callback(error);
            } else {
                this.pointrelClient.startup();
                callback(null, response);
            }
        });
    }

    projectName() {
        return this.journalIdentifier.substring("NarraFirmaProject-".length);
    }
    
    // TODO: Redundant code with what is in GridWithItemPanel
    getListForField(fieldName) {
        var setIdentifier = this.getFieldValue(fieldName);
        return this.tripleStore.getListForSetIdentifier(setIdentifier);
    }
    
    getFieldValue(fieldName) {
        return this.tripleStore.queryLatestC(this.projectIdentifier, fieldName);
    }
    
    setFieldValue(fieldName, newValue, oldValue = undefined) {
        // TODO: Need to add support in tripleStore for oldValue; note callback is the fourth parameter
        this.tripleStore.addTriple(this.projectIdentifier, fieldName, newValue);
    }

    fieldValue(fieldName, newValue = undefined) {
        if (newValue === undefined) {
            return this.getFieldValue(fieldName);
        } else {
            return this.setFieldValue(fieldName, newValue);
        }
    }
    
    // TODO: What do do about this function? Especially if want to track chat messages or log messages or undoable changes for project?
    receivedMessage(message) {
        // console.log("Project receivedMessage", message);
        
        if (message.change && message.change.action === "addTriple") {
            // Ignore addTriple messages as we handle only the ones we did not send via a subscription
            // console.log("Ignoring tripleStore message", message);
            return;
        }
        
        if (message.messageType === "questionnairesMessage") {
            // console.log("Project receivedMessage questionnairesMessage", message);
            surveyCollection.updateActiveQuestionnaires(message.change, false, null);
        }

        // Since this event came from the network, queue a Mithril redraw
        // The tripleStore may not be updated yet, so this redraw needs to get queued for later by the application
        if (this.redrawCallback) {
            // console.log("project calling redrawCallback");
            this.redrawCallback();
        }
    }

    // Project-specific data lookup
    
    findCatalysisReport(shortName) {
        var catalysisReports = this.tripleStore.queryLatestC(this.projectIdentifier, "project_catalysisReports");
        if (!catalysisReports) return null;
        var catalysisReportIdentifiers = this.tripleStore.getListForSetIdentifier(catalysisReports);
        for (var i = 0; i < catalysisReportIdentifiers.length; i++) {
            var reportShortName = this.tripleStore.queryLatestC(catalysisReportIdentifiers[i], "catalysisReport_shortName");
            if (reportShortName === shortName) {
                return catalysisReportIdentifiers[i];
            }
        }
        return null;
    }
    
    findQuestionnaireTemplate(shortName): string {
        var questionnaires: Array<string> = this.getListForField("project_storyForms");
        for (var i = 0; i < questionnaires.length; i++) {
            if (this.tripleStore.queryLatestC(questionnaires[i], "questionForm_shortName") === shortName) {
                return questionnaires[i];
            }
        }
        return null;
    }
    
    /*
    allStoryFormShortNames(): string[] {
        var result = [];
        var questionnaires: Array<string> = this.getListForField("project_storyForms");
        for (var i = 0; i < questionnaires.length; i++) {
            result.push(this.tripleStore.queryLatestC(questionnaires[i], "questionForm_shortName"));
        }
        return result;
    }
    */
    
    findStoryCollection(shortName): string {
        var storyCollections: Array<string> = this.getListForField("project_storyCollections");
        for (var i = 0; i < storyCollections.length; i++) {
            if (this.tripleStore.queryLatestC(storyCollections[i], "storyCollection_shortName") === shortName) {
                return storyCollections[i];
            }
        }
        return null;
    }
    
    private collectAllQuestionsForQuestionList(questionListName: string) {
        var questionIdentifiers: Array<string> = this.getListForField(questionListName);
        var questions = [];
        questionIdentifiers.forEach((questionIdentifier) => {
            var question = this.tripleStore.makeObject(questionIdentifier, true);
            questions.push(question);
        });
        return questions;
    }
    
    collectAllElicitingQuestions() {
        var questions = this.collectAllQuestionsForQuestionList("project_elicitingQuestionsList");
        return questions;
    }
    
    collectAllStoryQuestions() {
        var questions = this.collectAllQuestionsForQuestionList("project_storyQuestionsList");
        return questions;
    }
    
    collectAllParticipantQuestions() {
        var questions = this.collectAllQuestionsForQuestionList("project_participantQuestionsList");
        return questions;
    }
    
    collectAllAnnotationQuestions() {
        var questions = this.collectAllQuestionsForQuestionList("project_annotationQuestionsList");
        return questions;
    }
    
    questionsForCategory(questionCategory: string) {
        switch (questionCategory) {
            case "elicitingQuestion":
                return this.collectAllElicitingQuestions();
            case "storyQuestion":
                return this.collectAllStoryQuestions();
            case "participantQuestion":
                return this.collectAllParticipantQuestions();
            case "annotationQuestion":
                return this.collectAllAnnotationQuestions();
            default:
                throw new Error("Unexpected question category: " + questionCategory);
        }
    }
    
    addQuestionForCategory(question, questionCategory: string) {
        var questionListName;
        var questionClass;
        
        switch (questionCategory) {
            case "elicitingQuestion":
                questionListName = "project_elicitingQuestionsList";
                questionClass = "ElicitingQuestion";
                break;
            case "storyQuestion":
                questionListName = "project_storyQuestionsList";
                questionClass = "StoryQuestion";
                break;
            case "participantQuestion":
                questionListName = "project_participantQuestionsList";
                questionClass = "ParticipantQuestion";
                break;
            case "annotationQuestion":
                questionListName = "project_annotationQuestionsList";
                questionClass = "AnnotationQuestion";
                break;
            default:
                throw new Error("Unexpected question category: " + questionCategory);
        }
        
        var setIdentifier = this.getFieldValue(questionListName);
        if (!setIdentifier) {
            // Need to create list
            setIdentifier = this.tripleStore.newIdForSet(questionClass + "Set");
            // console.log("Making set for ", questionListName, setIdentifier); 
            this.setFieldValue(questionListName, setIdentifier);
        }
        this.tripleStore.makeNewSetItem(setIdentifier, questionClass, question);
    }
    
    storiesForCatalysisReport(catalysisReportIdentifier) {
        var result = [];
        
        var storyCollectionsIdentifier = this.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_storyCollections");
        var storyCollectionItems = this.tripleStore.getListForSetIdentifier(storyCollectionsIdentifier);
        
        if (storyCollectionItems.length === 0) return [];
        
        storyCollectionItems.forEach((storyCollectionPointer) => {
            if (storyCollectionPointer) {
                var storyCollectionIdentifier = this.tripleStore.queryLatestC(storyCollectionPointer, "storyCollection");
                result = result.concat(surveyCollection.getStoriesForStoryCollection(storyCollectionIdentifier));
            } else {
                console.log("ERROR: null or undefined storyCollectionPointer", catalysisReportIdentifier);
            }
        });
        
        return result;
    }

    elicitingQuestionForStoryCollection(storyCollectionIdentifier) {
        var convertedElicitingQuestion = null;
        var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);
        if (questionnaire) {
            var elicitingQuestionValues = [];
            for (var elicitingQuestionIndex in questionnaire.elicitingQuestions) {
                var elicitingQuestionSpecification = questionnaire.elicitingQuestions[elicitingQuestionIndex];
                elicitingQuestionValues.push(elicitingQuestionSpecification.id || elicitingQuestionSpecification.shortName || elicitingQuestionSpecification.text);
            }
            convertedElicitingQuestion = {
                id: "elicitingQuestion",
                displayName: "Eliciting question",
                displayPrompt: "Please choose a question you would like to respond to",
                displayType: "select",
                valueOptions: elicitingQuestionValues
            }
        }
        return convertedElicitingQuestion;
    }

    elicitingQuestionsForCatalysisReport(catalysisReportIdentifier) {
        var result = [];
        var elicitingQuestionValues = [];
        var storyCollectionsIdentifier = this.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_storyCollections");
        var storyCollectionItems = this.tripleStore.getListForSetIdentifier(storyCollectionsIdentifier);
        if (storyCollectionItems.length === 0) return null; 

        storyCollectionItems.forEach((storyCollectionPointer) => {
            if (storyCollectionPointer) {
                var storyCollectionIdentifier = this.tripleStore.queryLatestC(storyCollectionPointer, "storyCollection");
                var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);
                if (questionnaire) {
                    for (var elicitingQuestionIndex in questionnaire.elicitingQuestions) {
                        var elicitingQuestionSpecification = questionnaire.elicitingQuestions[elicitingQuestionIndex];
                        elicitingQuestionValues.push(elicitingQuestionSpecification.id || elicitingQuestionSpecification.shortName || elicitingQuestionSpecification.text);
                    }
                }
            }
        });
            
        // create ONE eliciting question to cover all story collections, with all possible answers to question
        var convertedElicitingQuestion = {
            id: "elicitingQuestion",
            displayName: "Eliciting question",
            displayPrompt: "Please choose a question you would like to respond to",
            displayType: "select",
            valueOptions: elicitingQuestionValues
        }
        result.push(convertedElicitingQuestion);
        return result;
    }

    storyQuestionsForStoryCollection(storyCollectionIdentifier) {
        var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);
        if (questionnaire) {
            return questionnaire.storyQuestions;
        } else {
            return [];
        }
    }

    storyQuestionsForCatalysisReport(catalysisReportIdentifier) {
        var result = [];  
        var storyCollectionsIdentifier = this.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_storyCollections");
        var storyCollectionItems = this.tripleStore.getListForSetIdentifier(storyCollectionsIdentifier);
        if (storyCollectionItems.length === 0) return []; 

        storyCollectionItems.forEach((storyCollectionPointer) => {
            if (storyCollectionPointer) {
                var storyCollectionIdentifier = this.tripleStore.queryLatestC(storyCollectionPointer, "storyCollection");
                var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);

                if (questionnaire) {

                    for (var questionIndex in questionnaire.storyQuestions) {
                        var question = questionnaire.storyQuestions[questionIndex];

                        // check for existing question (possibly from another story collection) in results
                        var alreadyThere = false;
                        for (var resultQuestionIndex in result) {
                            var resultQuestion = result[resultQuestionIndex];
                            if (question.displayName === resultQuestion.displayName) {
                                alreadyThere = true;
                                break;
                            }
                        }
                        if (!alreadyThere) {
                            result.push(question);
                        }
                    }
                }
            }
        });
        return result;
    }

    participantQuestionsForStoryCollection(storyCollectionIdentifier) {
        var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);
        if (questionnaire) {
            return questionnaire.participantQuestions;
        } else {
            return [];
        }
    }

    participantQuestionsForCatalysisReport(catalysisReportIdentifier) {
        var result = [];  
        var storyCollectionsIdentifier = this.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_storyCollections");
        var storyCollectionItems = this.tripleStore.getListForSetIdentifier(storyCollectionsIdentifier);
        if (storyCollectionItems.length === 0) return []; 

        storyCollectionItems.forEach((storyCollectionPointer) => {
            if (storyCollectionPointer) {
                var storyCollectionIdentifier = this.tripleStore.queryLatestC(storyCollectionPointer, "storyCollection");
                var questionnaire = surveyCollection.getQuestionnaireForStoryCollection(storyCollectionIdentifier);

                if (questionnaire) {

                    for (var questionIndex in questionnaire.participantQuestions) {
                        var question = questionnaire.participantQuestions[questionIndex];
                        var alreadyThere = false;
                        for (var resultQuestionIndex in result) {
                            var resultQuestion = result[resultQuestionIndex];
                            if (question.displayName === resultQuestion.displayName) {
                                alreadyThere = true;
                                break;
                            }
                        }
                        if (!alreadyThere) {
                            result.push(question);
                        }
                    }
                }
            }
        });
        return result;
    }

    numStoriesToldQuestion(maxNumQuestions) {
        var choices = [];
        for (var i = 1; i <= maxNumQuestions; i++) {
            choices.push("" + i);
        }
        var numStoriesToldQuestion = {
            id: "numStoriesTold",
            displayName: "Number of stories told",
            displayPrompt: "This is the number of stories told by each participant.",
            displayType: "select",
            valueOptions: choices 
        }
        return numStoriesToldQuestion;
    }

    numStoriesToldQuestionForStoryCollection(storyCollectionIdentifier) {
        var stories = surveyCollection.getStoriesForStoryCollection(storyCollectionIdentifier);
        var maxNumStoriesTold = 0;
        for (var storyIndex in stories) {
            var numStoriesToldForThisStory = stories[storyIndex].numStoriesTold();
            if (typeof numStoriesToldForThisStory === "string") {
                var numStoriesToldForThisStoryAsInt = parseInt(numStoriesToldForThisStory);
                if (numStoriesToldForThisStoryAsInt > maxNumStoriesTold) maxNumStoriesTold = numStoriesToldForThisStoryAsInt;
            } 
        }
        return this.numStoriesToldQuestion(maxNumStoriesTold);
    }

    numStoriesToldQuestionsForCatalysisReport(catalysisReportIdentifier) {
        var maxNumStoriesTold = 0;
        var storyCollectionsIdentifier = this.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_storyCollections");
        var storyCollectionItems = this.tripleStore.getListForSetIdentifier(storyCollectionsIdentifier);
    
        if (storyCollectionItems.length === 0) return [];
        
        storyCollectionItems.forEach((storyCollectionPointer) => {
            if (storyCollectionPointer) {
                var storyCollectionIdentifier = this.tripleStore.queryLatestC(storyCollectionPointer, "storyCollection");
                var stories = surveyCollection.getStoriesForStoryCollection(storyCollectionIdentifier);
                for (var storyIndex in stories) {
                    var numStoriesToldForThisStory = stories[storyIndex].numStoriesTold();
                    if (typeof numStoriesToldForThisStory === "string") {
                        var numStoriesToldForThisStoryAsInt = parseInt(numStoriesToldForThisStory);
                        if (numStoriesToldForThisStoryAsInt > maxNumStoriesTold) maxNumStoriesTold = numStoriesToldForThisStoryAsInt;
                    }
                }
            }
        });
        return this.numStoriesToldQuestion(maxNumStoriesTold);
    }

    minimumStoryCountRequiredForTest(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var minimumStoryCountRequiredForTest = this.tripleStore.queryLatestC(catalysisReportIdentifier, "minimumSubsetSize");
        if (minimumStoryCountRequiredForTest) {
            return parseInt(minimumStoryCountRequiredForTest, 10);
        } else {
            return Project.defaultMinimumStoryCountRequiredForTest;
        }
    }

    numberOfHistogramBins(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var numHistogramBins = this.tripleStore.queryLatestC(catalysisReportIdentifier, "numHistogramBins");
        if (numHistogramBins) {
            return parseInt(numHistogramBins, 10);
        } else {
            return Project.defaultNumHistogramBins;
        }
    }

    showInterpretationsInGrid(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var showInterpretationsInGrid = this.tripleStore.queryLatestC(catalysisReportIdentifier, "showInterpretationsInGrid");
        if (showInterpretationsInGrid) {
            return showInterpretationsInGrid;
        } else {
            return Project.defaultShowInterpretationsInGrid;
        }
    }

    numScatterDotOpacityLevels(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var numScatterDotOpacityLevels = this.tripleStore.queryLatestC(catalysisReportIdentifier, "numScatterDotOpacityLevels");
        if (numScatterDotOpacityLevels) {
            return parseInt(numScatterDotOpacityLevels, 10);
        } else {
            return Project.defaultNumScatterDotOpacityLevels;
        }
    }
    
    scatterDotSize(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var scatterDotSize = this.tripleStore.queryLatestC(catalysisReportIdentifier, "scatterDotSize");
        if (scatterDotSize) {
            return parseInt(scatterDotSize, 10);
        } else {
            return Project.defaultScatterDotSize;
        }
    }

    correlationLineChoice(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var correlationLineChoice = this.tripleStore.queryLatestC(catalysisReportIdentifier, "correlationLineChoice");
        if (correlationLineChoice) {
            return correlationLineChoice;
        } else {
            return Project.defaultCorrelationLineChoice;
        }
    }

    graphTypesToCreate(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("catalysisReportIdentifier was not supplied");
        }
        var graphTypesToCreate = this.tripleStore.queryLatestC(catalysisReportIdentifier, "graphTypesToCreate");
        if (graphTypesToCreate) {
            return graphTypesToCreate;
        } else {
            return Project.defaultGraphTypesToCreate;
        }
    }
}

export = Project;
