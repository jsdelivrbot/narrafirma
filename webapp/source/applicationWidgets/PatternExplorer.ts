import charting = require("./charting");
import calculateStatistics = require("../calculateStatistics");
import storyCardDisplay = require("../storyCardDisplay");
import questionnaireGeneration = require("../questionnaireGeneration");
import topic = require("../pointrel20150417/topic");
import valuePathResolver = require("../panelBuilder/valuePathResolver");
import PanelBuilder = require("../panelBuilder/PanelBuilder");
import dialogSupport = require("../panelBuilder/dialogSupport");
import m = require("mithril");
import Project = require("../Project");
import GridWithItemPanel = require("../panelBuilder/GridWithItemPanel");
import generateRandomUuid = require("../pointrel20150417/generateRandomUuid");
import Globals = require("../Globals");
import _ = require("lodash");
import toaster = require("../panelBuilder/toaster");

"use strict";

// Question types that have data associated with them for filters and graphs
var nominalQuestionTypes = ["select", "boolean", "checkbox", "checkboxes", "radiobuttons"];

var patternsPanelSpecification = {
    id: "patternsPanel",
    modelClass: "Pattern",
    panelFields: [
        {id: "id", displayName: "Index"},
        {id: "patternName", displayName: "Pattern name", valueOptions: []},
        {id: "graphType", displayName: "Graph type", valueOptions: []},
        {id: "significance", displayName: "Significance value", valueOptions: []},
        // {id: "reviewed", displayName: "Reviewed", valueOptions: []},
        {id: "observation", displayName: "Observation", valueOptions: []},
        {id: "strength", displayName: "Strength", valueOptions: []},
    ]
};

const interpretationsColumnSpec = {id: "interpretations", displayName: "Interpretations", valueOptions: []};

// TODO: Duplicate code for this function copied from charting
function nameForQuestion(question) {
    if (question.displayName) return question.displayName;
    if (question.displayPrompt) return question.displayPrompt;
    return question.id;
}

// TODO: Next two functions from add_storyBrowser and so are duplicate code

function buildStoryDisplayPanel(panelBuilder: PanelBuilder, model) {
    var storyCardDiv = storyCardDisplay.generateStoryCardContent(model, undefined);
    
     return storyCardDiv;
}

function makeItemPanelSpecificationForQuestions(questions) {
    // TODO: add more participant and survey info, like timestamps and participant ID
    
    var storyItemPanelSpecification = {
         id: "patternBrowserQuestions",
         modelClass: "Story",
         panelFields: questions,
         buildPanel: buildStoryDisplayPanel
    };
    
    return storyItemPanelSpecification;
}

// Do not store the option texts directly in selection as they might have braces
//function sha256ForOption(optionText) {
//    return SHA256(optionText, digests.outputTypes.Hex);
//}

function decodeBraces(optionText) {
    return optionText.replace("&#123;", "{").replace("&#125;", "}"); 
}

class PatternExplorer {
    project: Project = null;
    catalysisReportIdentifier: string = null;
    catalysisReportObservationSetIdentifier: string = null;
    
    questionsToInclude = null;
    modelForPatternsGrid = {patterns: []};
    patternsGridFieldSpecification: any = null;
    patternsGrid: GridWithItemPanel;
    
    graphHolder: GraphHolder;

    questions = [];
    
    modelForStoryGrid = {storiesSelectedInGraph: []};
    // TODO: Improve typing here that was GridDisplayConfiguration
    storyGridFieldSpecification: any = null;
    storyGrid: GridWithItemPanel = null;
     
    currentPattern = null;
    
    observationPanelSpecification = null;
    saveGraphSelectionSpecification = null;
    textAnswersPanelSpecification = null;
    
    minimumStoryCountRequiredForTest = Project.defaultMinimumStoryCountRequiredForTest;
    numHistogramBins = Project.defaultNumHistogramBins;
    showInterpretationsInGrid = Project.defaultShowInterpretationsInGrid;
    numScatterDotOpacityLevels = Project.defaultNumScatterDotOpacityLevels;
    scatterDotSize = Project.defaultScatterDotSize;
    correlationLineChoice = Project.defaultCorrelationLineChoice;
    graphTypesToCreate = Project.defaultGraphTypesToCreate;
    
    constructor(args) {
        this.project = Globals.project();
        
       // Graph display initialization
        
       this.graphHolder = {
            graphResultsPane: charting.createGraphResultsPane("narrafirma-graph-results-pane chartEnclosure"),
            chartPanes: [],
            allStories: [],
            currentGraph: null,
            currentSelectionExtentPercentages: null,
            minimumStoryCountRequiredForTest: Project.defaultMinimumStoryCountRequiredForTest,
            numHistogramBins: Project.defaultNumHistogramBins,
            numScatterDotOpacityLevels: Project.defaultNumScatterDotOpacityLevels,
            scatterDotSize: Project.defaultScatterDotSize,
            correlationLineChoice: Project.defaultCorrelationLineChoice,
            graphTypesToCreate: Project.defaultGraphTypesToCreate
        };
        
        // Story grid initialization
        
        var storyItemPanelSpecification = makeItemPanelSpecificationForQuestions(this.questions);

        var storyGridConfiguration = {
            idProperty: "storyID",
            columnsToDisplay: ["storyName", "storyText"],
            viewButton: true,
            navigationButtons: true
        };
        
        this.storyGridFieldSpecification = {
            id: "storiesSelectedInGraph",
            itemPanelID: undefined,
            // TODO: Why is itemPanelSpecification in here twice (also in displayConfiguration)?
            itemPanelSpecification: storyItemPanelSpecification,
            displayConfiguration: {
                itemPanelSpecification: storyItemPanelSpecification,
                gridConfiguration: storyGridConfiguration
            },
            // TODO: Why is gridConfiguration in here twice (also in displayConfiguration)?
            gridConfiguration: storyGridConfiguration
        };

        this.storyGrid = new GridWithItemPanel({panelBuilder: args.panelBuilder, model: this.modelForStoryGrid, fieldSpecification: this.storyGridFieldSpecification});

        // Observation panel initialization
        
        this.saveGraphSelectionSpecification = {
            "id": "saveGraphSelectionPanel",
            panelFields: [        
                {
                    id: "saveGraphSelectionPanel_insertGraphSelection",
                    displayPrompt: "Save graph selection to observation",
                    displayType: "button",
                    displayPreventBreak: true,
                    displayConfiguration: this.insertGraphSelection.bind(this)
                },
                {
                    id: "saveGraphSelectionPanel_resetGraphSelection",
                    displayPrompt: "Display graph selection selected in observation",
                    displayType: "button",
                    displayConfiguration: this.resetGraphSelection.bind(this)
                }]};

        this.textAnswersPanelSpecification = {
            "id": "textAnswersPanel",
            panelFields: [
                {
                    id: "textAnswersPanel_texts",
                    valuePath: "currentTextAnswers",
                    displayName: "Text answers",
                    displayPrompt: "These are the <strong>answers</strong> your participants gave to this text question. They are sorted alphabetically. Answers with a number in parentheses were entered more than once. To include any of these answers in your catalysis report, copy and paste them into your observation.",
                    displayType: "textarea",
                    }
            ]
        }

        this.observationPanelSpecification = {
            "id": "observationPanel",
            panelFields: [        
                {
                    id: "observationPanel_description",
                    valuePath: "currentObservationDescription",
                    displayName: "Observation",
                    displayPrompt: "If this pattern is noteworthy, enter an <strong>observation</strong> about the pattern here.",
                    displayType: "textarea"
                },
                {
                    id: "observationPanel_title",
                    valuePath: "currentObservationTitle",
                    displayName: "Observation",
                    displayPrompt: "Please give this observation a <strong>name</strong>.",
                    displayType: "text"
                    // Maybe TODO: Tab order problem if hide this is not visible when tab out of previous field -- it will skip to page notes
                    // displayVisible: function(panelBuilder, model) {
                    //     return model.currentObservationDescription();
                    // }
                },
                {
                    id: "observationPanel_strenth",
                    valuePath: "currentObservationStrength",
                    displayName: "Observation",
                    displayPrompt: "How <strong>strong</strong> is this pattern?",
                    displayType: "select",
                    valueOptions: ["1 (weak)", "2 (medium)", "3 (strong)"]
                },
                {
                    id: "observationPanel_interpretationsList",
                    valuePath: "currentObservationInterpretations",
                    valueType: "array",
                    displayType: "grid",
                    displayConfiguration: "panel_addInterpretation",
                    displayName: "Interpretations",
                    displayPrompt: "Enter at least two <strong>competing interpretations</strong> for the observation here.",
                    displayVisible: function(panelBuilder, model) {
                        return model.currentObservationDescription() || model.currentObservationTitle();
                    }
                }
            ]
        };
        
        // Pattern grid initialization
        
        this.questionsToInclude = this.project.tripleStore.queryLatestC(this.catalysisReportIdentifier, "questionsToInclude"); 
        this.modelForPatternsGrid.patterns = this.buildPatternList();
        
        var patternsGridConfiguration = {
            idProperty: "id",
            columnsToDisplay: true,
            navigationButtons: true,
            selectCallback: this.patternSelected.bind(this)
        };

        var patternsGridFieldSpecification = {
            id: "patterns",
            itemPanelID: undefined,
            // TODO: Why is itemPanelSpecification in here twice (also in displayConfiguration)?
            itemPanelSpecification: patternsPanelSpecification,
            displayConfiguration: {
                itemPanelSpecification: patternsPanelSpecification,
                gridConfiguration: patternsGridConfiguration
            },
            // TODO: Why is gridConfiguration in here twice (also in displayConfiguration)?
            gridConfiguration: patternsGridConfiguration
        };

        this.patternsGridFieldSpecification = patternsGridFieldSpecification;
 
        this.patternsGrid = new GridWithItemPanel({panelBuilder: args.panelBuilder, model: this.modelForPatternsGrid, fieldSpecification: patternsGridFieldSpecification});

        // TODO: selections in observation should be stored in original domain units, not scaled display units
 
        // Put up a "please pick pattern" message
        this.chooseGraph(null);
    }
    
    static controller(args) {
        return new PatternExplorer(args);
    }
    
    static view(controller, args) {
        return controller.calculateView(args);
    }
    
    calculateView(args) {
        var panelBuilder: PanelBuilder = args.panelBuilder;
        
        // Handling of caching of questions and stories
        var catalysisReportIdentifier = this.getCurrentCatalysisReportIdentifier(args);
        if (catalysisReportIdentifier !== this.catalysisReportIdentifier) {
            this.catalysisReportIdentifier = catalysisReportIdentifier;
            this.currentCatalysisReportChanged(this.catalysisReportIdentifier);
        }
        
        var parts;
        
        function isMissingQuestionsToInclude(questionsToInclude) {
            if (!questionsToInclude) return true;
            for (var keys in questionsToInclude) {
                return false;
            }
            return true; 
        }
        
        if (!this.catalysisReportIdentifier) {
            parts = [m("div.narrafirma-choose-catalysis-report", "Please select a catalysis report to work with.")];
        } else if (isMissingQuestionsToInclude(this.questionsToInclude)) {
            parts = [m("div.narrafirma-choose-questions-to-include", "Please select some questions to include in the report (on the previous page).")];
        } else {
            if (this.currentPattern && this.currentPattern.graphType === "data integrity") {
                parts = [
                    this.patternsGrid.calculateView(),
                    m("div.narrafirma-graph-results-panel", {config: this.insertGraphResultsPaneConfig.bind(this)}),
                    panelBuilder.buildPanel(this.observationPanelSpecification, this)
                ];
            } else if (this.currentPattern && this.currentPattern.graphType === "texts") {
                parts = [
                    this.patternsGrid.calculateView(),
                    panelBuilder.buildPanel(this.textAnswersPanelSpecification, this),
                    panelBuilder.buildPanel(this.observationPanelSpecification, this)
                ];
            } else {    
                parts = [
                    this.patternsGrid.calculateView(),
                    this.currentPattern ?
                        [
                            m("div.narrafirma-graph-results-panel", {config: this.insertGraphResultsPaneConfig.bind(this)}),
                            m("div.narrafirma-pattern-browser-selected-stories-header", "Selected stories (" + this.modelForStoryGrid.storiesSelectedInGraph.length + ")"),
                            this.storyGrid.calculateView(),
                            panelBuilder.buildPanel(this.saveGraphSelectionSpecification, this),
                            panelBuilder.buildPanel(this.observationPanelSpecification, this)
                        ] :
                        // TODO: Translate
                        m("div.narrafirma-choose-pattern", "Please select a pattern to view as a graph.")
                ];
            }
        }
        return m("div.narrafirma-patterns-grid", parts);
    }
    
    insertGraphResultsPaneConfig(element: HTMLElement, isInitialized: boolean, context: any) {
        if (!isInitialized) {
            element.appendChild(this.graphHolder.graphResultsPane);
        }       
    }
    
    observationAccessor(pattern, field: string, newValue = undefined) {
        if (!this.catalysisReportObservationSetIdentifier) throw new Error("observationAccessor: this.catalysisReportObservationSetIdentifier is undefined");
        if (pattern.graphType == "data integrity") {
            var patternReference = this.patternReferenceForQuestions([pattern.patternName]);
        } else {
            var patternReference = this.patternReferenceForQuestions(pattern.questions);
        }
         
        var observationIdentifier: string = this.project.tripleStore.queryLatestC(this.catalysisReportObservationSetIdentifier, patternReference);
        
        if (!observationIdentifier) {
            if (field !== "observationInterpretations" && newValue === undefined) return "";
            // Lazy initialize the observation as will need to return a list which might be empty but could get used
            observationIdentifier = generateRandomUuid("Observation");
            // TODO: Ideally should not be creating entry just for looking at it
            this.project.tripleStore.addTriple(this.catalysisReportObservationSetIdentifier, patternReference, observationIdentifier);
            // Need this for printing later so know what questions & pattern go with the observation
            var patternCopyWithoutAccessorFunction = {
                id: pattern.id,
                graphType: pattern.graphType,
                patternName: pattern.patternName,
                questions: pattern.questions
            };
            this.project.tripleStore.addTriple(observationIdentifier, "pattern", patternCopyWithoutAccessorFunction);
        }

        if (newValue === undefined) {
            var result = this.project.tripleStore.queryLatestC(observationIdentifier, field);
            if (result === undefined || result === null) {
                result = "";
            }
            return result;
        } else {
            this.project.tripleStore.addTriple(observationIdentifier, field, newValue);
            return newValue;
        }
    }

    currentTextAnswers() {
        if (!this.catalysisReportObservationSetIdentifier) throw new Error("currentTextAnswers: this.catalysisReportObservationSetIdentifier is undefined");
        if (!this.currentPattern) return "";
        if (!this.currentPattern.questions[0]) return "";
        if (!this.graphHolder.allStories) return "";

        var questionID = this.currentPattern.questions[0].id; 
        var stories = this.graphHolder.allStories; 
        var answers = {};
        var answerKeys = [];

        stories.forEach(function (story) {
            var text = story.fieldValue(questionID);
            if (text) {
                if (!answers[text]) {
                    answers[text] = 0;
                    answerKeys.push(text);
                }
                answers[text] += 1;
            }
        });
        answerKeys.sort();
        
        var sortedAndFormattedAnswers = "";
        for (var i = 0; i < answerKeys.length; i++) {
            var answer = answerKeys[i];
            sortedAndFormattedAnswers += answer;
            if (answers[answer] > 1) sortedAndFormattedAnswers += " (" + answers[answer] + ") ";
            if (i < answerKeys.length - 1) sortedAndFormattedAnswers +=  "\n--------\n";
        }
        return sortedAndFormattedAnswers;
    }
    
    currentObservationDescription(newValue = undefined) {
        if (!this.currentPattern) {
            return "";
            // throw new Error("pattern is not defined");
        }
        return this.observationAccessor(this.currentPattern, "observationDescription", newValue);
    }
    
    currentObservationTitle(newValue = undefined) {
        if (!this.currentPattern) {
            return "";
            // throw new Error("pattern is not defined");
        }
        return this.observationAccessor(this.currentPattern, "observationTitle", newValue);
    }

    currentObservationStrength(newValue = undefined) {
        if (!this.currentPattern) {
            return "";
            // throw new Error("pattern is not defined");
        }
        return this.observationAccessor(this.currentPattern, "observationStrength", newValue);
    }

    currentObservationInterpretations(newValue = undefined) {
        if (!this.currentPattern) {
            return "";
            // throw new Error("pattern is not defined");
        }
        return this.observationAccessor(this.currentPattern, "observationInterpretations", newValue);
    }
    
    // We don't make the set when the report is created; lazily make it if needed now
    getObservationSetIdentifier(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            throw new Error("getObservationSetIdentifier: catalysisReportIdentifier is not defined"); 
        }
        
        var setIdentifier = this.project.tripleStore.queryLatestC(catalysisReportIdentifier, "catalysisReport_observations");
        
        if (!setIdentifier) {
            setIdentifier = generateRandomUuid("ObservationSet");
            this.project.tripleStore.addTriple(catalysisReportIdentifier, "catalysisReport_observations", setIdentifier);
        }

        return setIdentifier;
    }
    
    currentCatalysisReportChanged(catalysisReportIdentifier) {
        if (!catalysisReportIdentifier) {
            return;
        }
        this.minimumStoryCountRequiredForTest = this.project.minimumStoryCountRequiredForTest(catalysisReportIdentifier);
        this.graphHolder.minimumStoryCountRequiredForTest = this.minimumStoryCountRequiredForTest; 
        this.numHistogramBins = this.project.numberOfHistogramBins(catalysisReportIdentifier);
        this.graphHolder.numHistogramBins = this.numHistogramBins; 
        this.showInterpretationsInGrid = this.project.showInterpretationsInGrid(catalysisReportIdentifier);
        this.numScatterDotOpacityLevels = this.project.numScatterDotOpacityLevels(catalysisReportIdentifier);
        this.graphHolder.numScatterDotOpacityLevels = this.numScatterDotOpacityLevels;
        this.scatterDotSize = this.project.scatterDotSize(catalysisReportIdentifier);
        this.graphHolder.scatterDotSize = this.scatterDotSize;
        this.correlationLineChoice = this.project.correlationLineChoice(catalysisReportIdentifier);
        this.graphHolder.correlationLineChoice = this.correlationLineChoice; // because need to pass it in to charting methods
        this.graphTypesToCreate = this.project.graphTypesToCreate(catalysisReportIdentifier);
        
        this.catalysisReportObservationSetIdentifier = this.getObservationSetIdentifier(catalysisReportIdentifier);
        this.graphHolder.allStories = this.project.storiesForCatalysisReport(catalysisReportIdentifier);

        var leadingStoryQuestions = questionnaireGeneration.getStoryNameAndTextQuestions();
        var elicitingQuestions = this.project.elicitingQuestionsForCatalysisReport(catalysisReportIdentifier);
        var numStoriesToldQuestions = this.project.numStoriesToldQuestionsForCatalysisReport(catalysisReportIdentifier);
        var storyQuestions = this.project.storyQuestionsForCatalysisReport(catalysisReportIdentifier); 
        var participantQuestions = this.project.participantQuestionsForCatalysisReport(catalysisReportIdentifier);
        var annotationQuestions = questionnaireGeneration.convertEditorQuestions(this.project.collectAllAnnotationQuestions(), "A_");
        this.questions = [];
        this.questions = this.questions.concat(leadingStoryQuestions, elicitingQuestions, numStoriesToldQuestions, storyQuestions, participantQuestions, annotationQuestions);
        this.questionsToInclude = this.project.tripleStore.queryLatestC(this.catalysisReportIdentifier, "questionsToInclude"); 

        if (this.showInterpretationsInGrid) {
            let hasColumnAlready = false;
            for (var index = 0; index < patternsPanelSpecification.panelFields.length; index++) {
                if (patternsPanelSpecification.panelFields[index].displayName === "Interpretations") {
                    hasColumnAlready = true;
                    break;
                }
            }
            if (!hasColumnAlready) patternsPanelSpecification.panelFields.push(interpretationsColumnSpec);
        }
        else {
            patternsPanelSpecification.panelFields =
                patternsPanelSpecification.panelFields.filter(function (each) { return each.displayName !== "Interpretations"; });
        }
        this.patternsGrid.updateDisplayConfigurationAndData(this.patternsGridFieldSpecification);
        this.modelForPatternsGrid.patterns = this.buildPatternList();
        this.patternsGrid.updateData();

        this.storyGridFieldSpecification.itemPanelSpecification = makeItemPanelSpecificationForQuestions(this.questions);
        this.storyGrid.updateDisplayConfigurationAndData(this.storyGridFieldSpecification);
        this.chooseGraph(null);     
    }
    
    // TODO: Similar to what is in add_graphBrowser
    getCurrentCatalysisReportIdentifier(args) {
        var model = args.model;
        var fieldSpecification = args.fieldSpecification;
        
        // Get selected catalysis report
        var catalysisReportShortName = valuePathResolver.newValuePathForFieldSpecification(model, fieldSpecification)();
        
        if (!catalysisReportShortName) return null;
        
        return this.project.findCatalysisReport(catalysisReportShortName);
    }
    
    patternReferenceForQuestions(questions) {
        // TODO: Maybe should be object instead of array?
        var result = [];
        questions.forEach(function (question) {
            var typeOfObject = Object.prototype.toString.call(question);
            if (typeOfObject == "[object String]") { // no question list for data integrity graphs
                result.push(question);
            } else {
                result.push(question.id);
            }
        });
        return {setItem: result};
    }
    
    makePattern(id, graphType, questions, patternNameIfDataIntegrity) {
        var pattern; 

        if (graphType == "data integrity") {
            pattern = {id: id, observation: null, graphType: graphType, patternName: patternNameIfDataIntegrity, questions: questions};           
        } else if (questions.length === 1) {
            pattern = {id: id, observation: null, graphType: graphType, patternName: nameForQuestion(questions[0]), questions: questions};
        } else if (questions.length === 2) {
            pattern = {id: id, observation: null, graphType: graphType, patternName: nameForQuestion(questions[0]) + " vs. " + nameForQuestion(questions[1]), questions: questions};
        } else if (questions.length === 3) {
            pattern = {id: id, observation: null, graphType: graphType, patternName: nameForQuestion(questions[0]) + " vs. " + nameForQuestion(questions[1]) + " + " + nameForQuestion(questions[2]), questions: questions};
        } else {
            console.log("Unexpected number of questions", questions);
            throw new Error("Unexpected number of questions: " + questions.length);
        }
        
        var observation = () => {
            return this.observationAccessor(pattern, "observationTitle") || this.observationAccessor(pattern, "observationDescription");
        }
        var strength = () => {
            return this.observationAccessor(pattern, "observationStrength") || "";
        };
        
        // Next assignment creates a circular reference
        pattern.observation = observation;
        pattern.strength = strength;

        if (this.showInterpretationsInGrid) {
            const interpretationSetID = this.observationAccessor(pattern, "observationInterpretations");
            const interpretationIDs = this.project.tripleStore.getListForSetIdentifier(interpretationSetID); 
            const interpretationNames = [];
            interpretationIDs.forEach(id => {
                const itemName = this.project.tripleStore.queryLatestC(id, "interpretation_name");
                interpretationNames.push(itemName);
            });
            pattern.interpretations = interpretationNames.join("\n");
        }
        
        return pattern;
    }

    buildPatternList() {
        var result = [];
        var nominalQuestions = [];
        var ratioQuestions = [];
        var textQuestions = [];

        if (!this.questionsToInclude) return result;

        this.questions.forEach((question) => {
            // Skip questions that are not included in configuration
            if (this.questionsToInclude[question.id]) {
                if (question.displayType === "slider") {
                    ratioQuestions.push(question);
                } else if (question.displayType === "text" || question.displayType === "textarea") {
                    textQuestions.push(question);
                } else if (nominalQuestionTypes.indexOf(question.displayType) !== -1)  {
                    nominalQuestions.push(question);
                }
            }
        });

        var questionCount = 0;
        function nextID() {
            return ("00000" + questionCount++).slice(-5);
        }

        if (this.graphTypesToCreate["data integrity graphs"]) {
            result.push(this.makePattern(nextID(), "data integrity", ratioQuestions, "All scale values"));
            result.push(this.makePattern(nextID(), "data integrity", ratioQuestions, "Participant means"));
            result.push(this.makePattern(nextID(), "data integrity", ratioQuestions, "Participant standard deviations"));
            result.push(this.makePattern(nextID(), "data integrity", nominalQuestions, "Unanswered choice questions"));
            result.push(this.makePattern(nextID(), "data integrity", ratioQuestions, "Unanswered scale questions"));
        }

        if (this.graphTypesToCreate["texts"]) {
            textQuestions.forEach((question) => {
                result.push(this.makePattern(nextID(), "texts", [question], "Text answers"));
            });
        }
     
        if (this.graphTypesToCreate["bar graphs"]) {
            nominalQuestions.forEach((question1) => {
                result.push(this.makePattern(nextID(), "bar", [question1], null));
            });
        };

        // Prevent mirror duplicates and self-matching questions
        var usedQuestions;
        
        if (this.graphTypesToCreate["tables"]) {
            usedQuestions = [];
            nominalQuestions.forEach((question1) => {
                usedQuestions.push(question1);
                nominalQuestions.forEach((question2) => {
                    if (usedQuestions.indexOf(question2) !== -1) return;
                    result.push(this.makePattern(nextID(), "table", [question1, question2], null));
                });
            });
        };

        if (this.graphTypesToCreate["histograms"]) {
            ratioQuestions.forEach((question1) => {
                result.push(this.makePattern(nextID(), "histogram", [question1], null));
            });
        };

        if (this.graphTypesToCreate["multiple histograms"]) {
            ratioQuestions.forEach((question1) => {
                nominalQuestions.forEach((question2) => {
                    result.push(this.makePattern(nextID(), "multiple histogram", [question1, question2], null));
                });
            });
        };

        if (this.graphTypesToCreate["scatterplots"]) {
            usedQuestions = [];
            ratioQuestions.forEach((question1) => {
                usedQuestions.push(question1);
                ratioQuestions.forEach((question2) => {
                    if (usedQuestions.indexOf(question2) !== -1) return;
                    result.push(this.makePattern(nextID(), "scatter", [question1, question2], null));
                });
            });
        };

        if (this.graphTypesToCreate["multiple scatterplots"]) {
            usedQuestions = [];
            ratioQuestions.forEach((question1) => {
                usedQuestions.push(question1);
                ratioQuestions.forEach((question2) => {
                    if (usedQuestions.indexOf(question2) !== -1) return;
                    nominalQuestions.forEach((question3) => {
                    result.push(this.makePattern(nextID(), "multiple scatter", [question1, question2, question3], null));
                    });
                });
            });
        };

        // if a lot of patterns, use progress dialog, otherwise just calculate (and avoid having a dialog blip onto the screen and off again)
        if (result.length > 200) { // this is an arbitrary number, just a guess as to how long it will take to calculate 
            // first set all stats to "none" in case they cancel partway through
            result.forEach((pattern) => { pattern.significance = "None (calculation cancelled)"; });
            var progressModel = dialogSupport.openProgressDialog("Processing statistics for question combinations", "Generating statistical results...", "Cancel", dialogCancelled);
            var patternIndex = 0;
            var stories = this.graphHolder.allStories;
            var minimumStoryCountRequiredForTest = this.minimumStoryCountRequiredForTest;
            setTimeout(function() { calculateStatsForNextPattern(); }, 0);
        } else { // just calculate without any progress dialog
            var patternIndex = 0;
            result.forEach((pattern) => {
                calculateStatistics.calculateStatisticsForPattern(result[patternIndex], patternIndex, result.length, 
                    this.graphHolder.allStories, this.minimumStoryCountRequiredForTest, null); // no progress model
                patternIndex += 1;
            });
        }

        function calculateStatsForNextPattern() {
            if (progressModel.cancelled) {
                toaster.toast("Cancelled after calculating statistics for " + (patternIndex + 1) + " patterns");
            } else if (patternIndex >= result.length) {
                progressModel.hideDialogMethod();
                progressModel.redraw();
            } else {
                calculateStatistics.calculateStatisticsForPattern(result[patternIndex], patternIndex, result.length, 
                    stories, minimumStoryCountRequiredForTest, progressModel);  
                patternIndex += 1;
                setTimeout(function() { calculateStatsForNextPattern(); }, 0);
            }
        }
    
        function dialogCancelled(dialogConfiguration, hideDialogMethod) {
            progressModel.cancelled = true;
            hideDialogMethod();
        }
        return result;
        }
    
    chooseGraph(pattern) {
        // Remove old graph(s)
        while (this.graphHolder.chartPanes.length) {
            var chartPane = this.graphHolder.chartPanes.pop();
            this.graphHolder.graphResultsPane.removeChild(chartPane);
            // TODO: Do these need to be destroyed or freed somehow?
        }

        this.graphHolder.excludeStoryTooltips = false; // seems to stay set on
        
        // Need to remove the float end node, if any        
        while (this.graphHolder.graphResultsPane.firstChild) {
            this.graphHolder.graphResultsPane.removeChild(this.graphHolder.graphResultsPane.firstChild);
        }
        
        this.modelForStoryGrid.storiesSelectedInGraph = [];
        
        if (pattern === null) {
            return;
        }

        this.graphHolder.currentGraph = PatternExplorer.makeGraph(pattern, this.graphHolder, this.updateStoriesPane.bind(this));
        this.graphHolder.currentSelectionExtentPercentages = null;
        // TODO: Is this obsolete? this.graphHolder.currentSelectionSubgraph = null;
    }
    
    static makeGraph(pattern, graphHolder, selectionCallback) {
        var graphType = pattern.graphType;
        var q1 = pattern.questions[0];
        var q2 = pattern.questions[1];
        var q3 = pattern.questions[2]
        var newGraph = null;
        switch (graphType) {
            case "bar":
                newGraph = charting.d3BarChartForQuestion(graphHolder, q1, selectionCallback);
                break;
            case "table":
                newGraph = charting.d3ContingencyTable(graphHolder, q1, q2, selectionCallback);
                break;
            case "histogram":
                newGraph = charting.d3HistogramChartForQuestion(graphHolder, q1, null, null, selectionCallback);
                break;
            case "multiple histogram":
                // Choice question needs to come before scale question in args
                newGraph = charting.multipleHistograms(graphHolder, q2, q1, selectionCallback);
                break;
            case "scatter":
                newGraph = charting.d3ScatterPlot(graphHolder, q1, q2, null, null, selectionCallback);
                break;        
            case "multiple scatter":
                newGraph = charting.multipleScatterPlot(graphHolder, q1, q2, q3, selectionCallback);
                break;
            case "data integrity":
                if (pattern.patternName === "Unanswered choice questions" || pattern.patternName === "Unanswered scale questions") {
                    newGraph = charting.d3BarChartForDataIntegrity(graphHolder, pattern.questions, pattern.patternName);
                    break;
                } else {
                    if (pattern.patternName === "Participant means" || pattern.patternName === "Participant standard deviations") {
                    graphHolder.excludeStoryTooltips = true; // no stories to link tooltips to in these cases
                    }
                newGraph = charting.d3HistogramChartForDataIntegrity(graphHolder, pattern.questions, pattern.patternName);
                break;
                }
            case "texts":
                newGraph = null;
                break;
           default:
                console.log("ERROR: Unexpected graph type");
                alert("ERROR: Unexpected graph type");
                break;
        }
        
        return newGraph;
    }

    updateStoriesPane(stories) {
        this.modelForStoryGrid.storiesSelectedInGraph = stories;
        this.storyGrid.updateData();
    }
    
    patternSelected(selectedPattern) {
        this.chooseGraph(selectedPattern);
        this.currentPattern = selectedPattern;
        
        this.modelForStoryGrid.storiesSelectedInGraph = [];
        this.storyGrid.updateData();
    }
    
    insertGraphSelection() {
        if (!this.graphHolder.currentGraph) {
            // TODO: Translated
            alert("Please select a pattern first");
            return;
        }
        
        if (!this.graphHolder.currentSelectionExtentPercentages) {
            alert("Please select something in a graph first");
            return;
        }
        
        if (this.scanForSelectionJSON()) {
            // TODO: Translate
            alert("The insertion would change a previously saved selection within a {...} section;\nplease pick a different insertion point.");
            return;
        }
        
        if (!this.currentPattern) return;
        
        // Find observation textarea and other needed data
        var textarea = <HTMLTextAreaElement>document.getElementById("observationPanel_description");
        var selection = this.graphHolder.currentSelectionExtentPercentages;
        var textToInsert = JSON.stringify(selection);
        
        // Replace the currently selected text in the textarea (or insert at caret if nothing selected)
        var selectionStart = textarea.selectionStart;
        var selectionEnd = textarea.selectionEnd;
        var oldText = this.currentObservationDescription();
        var newText = oldText.substring(0, selectionStart) + textToInsert + oldText.substring(selectionEnd);
        this.currentObservationDescription(newText);
        
        // Set the new value explicitly here rather than waiting for a Mithril redraw so that we can then select it
        textarea.value = newText;
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionStart + textToInsert.length;
        textarea.focus();
    }
    
    scanForSelectionJSON(doFocus = false) {
        // TODO: Fix this for Mithril conversion
        var textarea = <HTMLTextAreaElement>document.getElementById("observationPanel_description");
        if (!this.currentPattern) return;
        var text = this.currentObservationDescription();
    
        if (doFocus) textarea.focus();
    
        var selectionStart = textarea.selectionStart;
        var selectionEnd = textarea.selectionEnd;
        
        // Find the text for a selection surrounding the current insertion point
        // This assumes there are not nested objects with nested braces
        var start;
        var end;
        
        // Special case of entire selection -- but could return more complex nested object...
        if (selectionStart !== selectionEnd) {
            if (text.charAt(selectionStart) === "{" && text.charAt(selectionEnd - 1) === "}") {
                return text.substring(selectionStart, selectionEnd);
            }
        }
        
        for (start = selectionStart - 1; start >= 0; start--) {
            if (text.charAt(start) === "}") return null;
            if (text.charAt(start) === "{") break;
        }
        if (start < 0) return null;
        // Now find the end
        for (end = start; end < text.length; end++) {
            if (text.charAt(end) === "}") break;
        }
        if (end >= text.length) return null;
        return text.substring(start, end + 1);
    }
    
    resetGraphSelection() {
        if (!this.graphHolder.currentGraph) {
            // TODO: Translate
            alert("Please select a pattern first");
            return;
        }
        
        // TODO: Need better approach to finding brush extent text and safely parsing it
    
        // Find observation textarea and other needed data
        // var selectedText = oldText.substring(selectionStart, selectionEnd);
        var selectedText = this.scanForSelectionJSON(true);
        if (!selectedText) {
            // TODO: Translate
            alert("The text insertion point was not inside a graph selection description.\nTry clicking inside the {...} items first.");
            return;
        }
        
        var selection = null;
        try {
            selection = JSON.parse(selectedText);
        } catch (e) {
            console.log("JSON parse error", e);
        }
        
        if (!selection) {
            // TODO: Translate
            alert('The selected text was not a complete valid stored selection.\nTry clicking inside the {...} items first.');
            return;
        }
        
        var graph = this.graphHolder.currentGraph;
        if (_.isArray(graph)) {
            var optionText = selection.subgraphChoice;
            if (!optionText) {
                // TODO: Translate
                alert("No subgraphChoice specified in stored selection");
                return;
            }
            optionText = decodeBraces(optionText);
            var graphs = this.graphHolder.currentGraph;
            graphs.forEach(function (subgraph) {
                if (subgraph.subgraphChoice === optionText) {
                    graph = subgraph;
                }
            });
        }
        
        charting.restoreSelection(graph, selection);
    }
}

export = PatternExplorer;
